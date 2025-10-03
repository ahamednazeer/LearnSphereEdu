# WebRTC Peer Connection Fix

## Problem
When students and teachers tried to join a video session, the application crashed with the error:
```
Cannot read properties of undefined (reading 'call')
```

This error occurred at line 105 in `use-webrtc.ts` when creating a new `Peer` instance.

## Root Cause
The issue was a **race condition** in the media initialization flow:

1. **Socket connects immediately** when the component mounts
2. Socket emits `join-video-session` event right away
3. Other users receive `user-joined` event and try to create peer connections
4. **BUT** `getUserMedia()` is still pending - `localStreamRef.current` is `null`
5. When `simple-peer` tries to create a peer with a `null` stream, it fails internally

### The Flow Problem:
```
Component Mount
    ↓
Socket Connect (immediate)
    ↓
Emit 'join-video-session' (immediate)
    ↓
Other users receive 'user-joined'
    ↓
Try to create Peer with localStreamRef.current (NULL!) ❌
    ↓
CRASH: Cannot read properties of undefined
```

Meanwhile, `getUserMedia()` is still waiting for user permission...

## Solution
Implemented a **media-ready gate** pattern to ensure media is initialized before joining:

### Key Changes:

1. **Added Media Ready Flag**
   ```typescript
   const mediaReadyRef = useRef<boolean>(false);
   const pendingPeersRef = useRef<Array<...>>([]); 
   ```

2. **Delayed Session Join**
   - Socket connects but **doesn't join** immediately
   - Only joins after media is ready:
   ```typescript
   socket.on('connect', () => {
     if (mediaReadyRef.current) {
       socket.emit('join-video-session', ...);
     }
   });
   ```

3. **Join After Media Initialization**
   ```typescript
   const initializeMedia = async () => {
     const stream = await getUserMedia(...);
     localStreamRef.current = stream;
     mediaReadyRef.current = true; // ✅ Mark as ready
     
     // NOW join the session
     if (socketRef.current?.connected) {
       socketRef.current.emit('join-video-session', ...);
     }
     
     // Process any queued peer connections
     pendingPeersRef.current.forEach(data => {
       createPeerConnection(data, true);
     });
   };
   ```

4. **Queue Peer Connections if Media Not Ready**
   ```typescript
   const handleUserJoined = (data) => {
     if (!mediaReadyRef.current) {
       // Queue for later
       pendingPeersRef.current.push(data);
       return;
     }
     
     // Media is ready, create peer now
     createPeerConnection(data, true);
   };
   ```

5. **Guard Peer Creation**
   ```typescript
   const createPeerConnection = (data, initiator) => {
     if (!localStreamRef.current) {
       console.warn('Cannot create peer: stream not ready');
       return null;
     }
     
     const peer = new Peer({
       initiator,
       stream: localStreamRef.current, // ✅ Always valid
     });
     // ...
   };
   ```

### The Fixed Flow:
```
Component Mount
    ↓
Socket Connect
    ↓
Start getUserMedia() (async)
    ↓
Wait for user permission...
    ↓
Media Ready! ✅
    ↓
Set mediaReadyRef.current = true
    ↓
Emit 'join-video-session' (NOW it's safe)
    ↓
Other users receive 'user-joined'
    ↓
Create Peer with valid localStreamRef.current ✅
    ↓
SUCCESS: Peer connections established
```

## Benefits

1. **No Race Conditions**: Media is always ready before peer connections
2. **Graceful Queuing**: If someone joins before media is ready, their connection is queued
3. **Proper Cleanup**: Added `mediaReadyRef.current = false` in cleanup
4. **Better Error Handling**: Guards prevent peer creation with invalid streams
5. **Correct Dependencies**: All useCallback/useEffect hooks have proper dependencies

## Testing

To test the fix:

1. **Teacher starts a session**
   - Should see their own video immediately
   - No errors in console

2. **Student joins the session**
   - Should see teacher's video
   - Teacher should see student's video
   - No "Cannot read properties of undefined" errors

3. **Multiple students join**
   - All participants should see each other
   - Peer connections should establish successfully

4. **Edge Cases**
   - User denies camera permission: Should show error message, not crash
   - Slow network: Queued connections should process when ready
   - Rapid joins: All connections should establish correctly

## Files Modified

- `/client/src/hooks/use-webrtc.ts` - Complete refactor of initialization flow

## Technical Details

### Why `simple-peer` Failed
The `simple-peer` library internally calls methods on the stream object. When the stream is `undefined`, it tries to access properties like `.getTracks()` which causes the "Cannot read properties of undefined (reading 'call')" error deep in the library's internals.

### Why Refs Instead of State
We use `mediaReadyRef` instead of state because:
1. We don't need re-renders when it changes
2. It's checked in callbacks that shouldn't re-create on every render
3. It's a synchronous flag, not UI state

### Pending Peers Queue
The `pendingPeersRef` array stores users who tried to connect before media was ready. Once media initializes, we process all pending connections in order, ensuring no one is left out.

## Future Improvements

1. **Loading State**: Show "Initializing camera..." message to users
2. **Retry Logic**: Automatically retry failed peer connections
3. **Timeout**: Add timeout for media initialization (e.g., 30 seconds)
4. **Fallback**: Allow audio-only mode if video fails
5. **Diagnostics**: Log detailed connection states for debugging