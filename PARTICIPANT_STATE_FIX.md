# Participant State Synchronization Fix

## Problem
Participants' mute and video status were not being synchronized properly across clients. When a participant muted/unmuted their microphone or turned their video on/off, other participants couldn't see these changes reflected in the UI.

## Root Causes

### 1. Server Not Tracking Participant State
The server was only tracking `userName` and `isHost` for each participant, but not their `isMuted` and `isVideoOff` status. This meant:
- When a new participant joined, they couldn't receive the current state of existing participants
- The server couldn't provide accurate state information to new joiners

### 2. Client Not Sending Initial State
When joining a session, the client wasn't sending their initial mute/video state to the server, so other participants didn't know if the new joiner had their mic muted or video off from the start.

### 3. State Not Included in Participant Lists
The `participants` event (sent to new joiners) and `user-joined` event (broadcast to existing participants) didn't include mute/video state information.

## Solutions Implemented

### Server-Side Changes (`/server/index.ts`)

#### 1. Enhanced User Profile Storage
```typescript
// Before:
const userProfiles = new Map<string, { userName: string; isHost: boolean }>();

// After:
const userProfiles = new Map<string, { 
  userName: string; 
  isHost: boolean; 
  isMuted?: boolean; 
  isVideoOff?: boolean 
}>();
```

#### 2. Updated Join Session Handler
- Now accepts `isMuted` and `isVideoOff` parameters
- Stores initial state in user profile
- Includes state in participants list sent to new joiner
- Broadcasts state to existing participants when someone joins

```typescript
socket.on('join-video-session', ({ sessionId, userId, userName, isHost, isMuted, isVideoOff }) => {
  // Save profile including initial mute/video state
  userProfiles.set(userId, { userName, isHost: !!isHost, isMuted, isVideoOff });
  
  // Send current participants with their state
  const participants = Array.from(videoSessions.get(sessionId) || [])
    .filter(id => id !== userId)
    .map(id => {
      const profile = userProfiles.get(id);
      return { 
        userId: id, 
        userName: profile?.userName || 'Unknown', 
        isHost: !!profile?.isHost,
        isMuted: profile?.isMuted,
        isVideoOff: profile?.isVideoOff
      };
    });
  socket.emit('participants', participants);

  // Notify others including initial state
  socket.to(sessionId).emit('user-joined', { userId, userName, isHost, isMuted, isVideoOff });
});
```

#### 3. Enhanced Participant Update Handler
- Now updates the stored profile state when participants toggle mute/video
- Ensures state persists for new joiners

```typescript
socket.on('participant-update', ({ sessionId, userId, isMuted, isVideoOff }) => {
  // Update the stored profile state
  const profile = userProfiles.get(userId);
  if (profile) {
    if (isMuted !== undefined) profile.isMuted = isMuted;
    if (isVideoOff !== undefined) profile.isVideoOff = isVideoOff;
  }
  
  // Broadcast to other participants
  socket.to(sessionId).emit('participant-update', { userId, isMuted, isVideoOff });
});
```

### Client-Side Changes (`/client/src/hooks/use-webrtc.ts`)

#### 1. Send Initial State When Joining
```typescript
socket.on('connect', () => {
  console.log('Connected to signaling server');
  socket.emit('join-video-session', { 
    sessionId, 
    userId, 
    userName, 
    isHost,
    isMuted: state.isMuted,      // Send initial mute state
    isVideoOff: state.isVideoOff  // Send initial video state
  });
});
```

#### 2. Updated Participants List Handler
- Now receives and uses `isMuted` and `isVideoOff` from server
- Properly initializes participant state

```typescript
socket.on('participants', (arr: Array<{ 
  userId: string; 
  userName: string; 
  isHost: boolean; 
  isMuted?: boolean; 
  isVideoOff?: boolean 
}>) => {
  setState(prev => {
    const newParticipants = new Map(prev.participants);
    for (const p of arr) {
      const existing = newParticipants.get(p.userId);
      newParticipants.set(p.userId, {
        id: p.userId,
        name: p.userName,
        stream: existing?.stream,
        peer: existing?.peer,
        isHost: p.isHost,
        isMuted: p.isMuted ?? existing?.isMuted,        // Use server state
        isVideoOff: p.isVideoOff ?? existing?.isVideoOff, // Use server state
      });
    }
    return { ...prev, participants: newParticipants };
  });
});
```

#### 3. Updated User Joined Handler
- Now receives and uses `isMuted` and `isVideoOff` from the event
- Properly initializes new participant state

```typescript
const handleUserJoined = useCallback((data: { 
  userId: string; 
  userName: string; 
  isHost: boolean; 
  isMuted?: boolean; 
  isVideoOff?: boolean 
}) => {
  setState(prev => {
    const newParticipants = new Map(prev.participants);
    const existing = newParticipants.get(data.userId);
    newParticipants.set(data.userId, {
      id: data.userId,
      name: data.userName,
      stream: existing?.stream,
      peer: existing?.peer,
      isHost: data.isHost,
      isMuted: data.isMuted ?? existing?.isMuted,        // Use event state
      isVideoOff: data.isVideoOff ?? existing?.isVideoOff, // Use event state
    });
    return { ...prev, participants: newParticipants };
  });
  // ... rest of the function
}, [userId, createPeerConnection]);
```

## How It Works Now

### Scenario 1: User A Joins First
1. User A joins with mic muted
2. Server stores: `{ userName: "A", isHost: true, isMuted: true, isVideoOff: false }`
3. User A sees empty participants list (they're alone)

### Scenario 2: User B Joins
1. User B joins with video off
2. Server stores: `{ userName: "B", isHost: false, isMuted: false, isVideoOff: true }`
3. Server sends User B the participants list: `[{ userId: "A", userName: "A", isHost: true, isMuted: true, isVideoOff: false }]`
4. User B's UI correctly shows User A with muted mic icon
5. Server broadcasts to User A: `user-joined` with `{ userId: "B", userName: "B", isHost: false, isMuted: false, isVideoOff: true }`
6. User A's UI correctly shows User B with video off (avatar placeholder)

### Scenario 3: User A Unmutes
1. User A clicks unmute button
2. Client emits: `participant-update` with `{ sessionId, userId: "A", isMuted: false }`
3. Server updates stored profile: `isMuted: false`
4. Server broadcasts to User B: `participant-update` with `{ userId: "A", isMuted: false }`
5. User B's UI removes the muted mic icon from User A's tile

### Scenario 4: User C Joins Late
1. User C joins the session
2. Server sends User C the participants list with current state:
   ```
   [
     { userId: "A", userName: "A", isHost: true, isMuted: false, isVideoOff: false },
     { userId: "B", userName: "B", isHost: false, isMuted: false, isVideoOff: true }
   ]
   ```
3. User C's UI correctly shows:
   - User A with mic unmuted and video on
   - User B with mic unmuted and video off (avatar)

## Benefits

✅ **Accurate State Synchronization**: All participants see the correct mute/video status of others  
✅ **Persistent State**: New joiners receive the current state of existing participants  
✅ **Real-time Updates**: State changes are immediately reflected across all clients  
✅ **Initial State Support**: Participants can join with mic muted or video off, and others will see this  
✅ **No Race Conditions**: Server is the source of truth for participant state  

## Testing Checklist

### Basic State Synchronization
- [ ] Join with mic muted - verify other participants see muted icon
- [ ] Join with video off - verify other participants see avatar
- [ ] Toggle mute during call - verify others see the change
- [ ] Toggle video during call - verify others see the change

### Late Joiner Scenarios
- [ ] User A mutes, then User B joins - verify User B sees User A as muted
- [ ] User A turns off video, then User B joins - verify User B sees User A's avatar
- [ ] Multiple state changes before late joiner - verify late joiner sees current state

### Multi-Participant Scenarios
- [ ] 3+ participants with different states - verify all see correct states
- [ ] Rapid state changes - verify all updates are received
- [ ] Participant leaves and rejoins - verify state resets correctly

### Edge Cases
- [ ] Join with both mic muted and video off
- [ ] Toggle both mic and video quickly
- [ ] Network reconnection - verify state persists
- [ ] Browser refresh - verify state resets to initial values

## Technical Notes

### State Flow
```
Client A (toggleMute)
  ↓ emit: participant-update
Server (receives update)
  ↓ updates userProfiles Map
  ↓ broadcast: participant-update
Client B, C, D... (receive update)
  ↓ update local state
  ↓ re-render UI
```

### State Storage
- **Server**: In-memory Map (lost on server restart)
- **Client**: React state (lost on page refresh)
- **Future**: Could persist to database for session recovery

### Type Safety
All event handlers now have proper TypeScript types including optional `isMuted` and `isVideoOff` properties, ensuring type safety across the codebase.

## Future Enhancements

1. **State Persistence**: Store participant state in database for session recovery
2. **State History**: Track state changes for analytics/debugging
3. **Bulk Updates**: Optimize multiple state changes into single broadcast
4. **State Validation**: Add server-side validation of state changes
5. **State Reconciliation**: Handle conflicts when client and server state diverge