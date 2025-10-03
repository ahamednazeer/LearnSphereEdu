# Testing the WebRTC Fix

## What Was Fixed
Fixed the "Cannot read properties of undefined (reading 'call')" error that occurred when students and teachers tried to join video sessions.

## How to Test

### Prerequisites
1. Make sure the server is running: `npm run dev`
2. Open the application in **two different browsers** (e.g., Chrome and Firefox) or use incognito/private windows
3. Have a course created with at least one enrolled student

### Test Scenario 1: Teacher Starts Session, Student Joins

#### Browser 1 (Teacher):
1. Log in as a teacher
2. Go to your course
3. Click "Start Live Class"
4. **Expected**: 
   - Camera permission prompt appears
   - After allowing, you see your own video
   - No errors in console
   - Session status shows "Active"

#### Browser 2 (Student):
1. Log in as a student (enrolled in the course)
2. Go to the course page
3. **Expected**: 
   - See "Live Session" banner with "Join Now" button
   - Click "Join Now"
   - Camera permission prompt appears
   - After allowing, you see:
     - Your own video (local)
     - Teacher's video (remote)
   - No errors in console

#### Browser 1 (Teacher) - Verify:
- Should now see student's video appear
- Participant count should show "2"

### Test Scenario 2: Multiple Students Join

#### Browser 3 (Another Student):
1. Log in as a different student
2. Join the same live session
3. **Expected**:
   - See both teacher and first student's videos
   - All participants see the new student

### Test Scenario 3: Rapid Joins (Race Condition Test)

1. Have 3-4 users ready to join
2. Click "Join Now" on all browsers within 1-2 seconds
3. **Expected**:
   - All users successfully join
   - All peer connections establish
   - No "Cannot read properties of undefined" errors
   - Everyone sees everyone else's video

### Test Scenario 4: Slow Network Simulation

1. Open Chrome DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Try joining a session
4. **Expected**:
   - May take longer to connect
   - But should still work without errors
   - Queued connections should process when ready

### Test Scenario 5: Camera Permission Denied

1. Try joining a session
2. Click "Block" on camera permission prompt
3. **Expected**:
   - Error message: "Failed to access camera/microphone. Please check permissions."
   - Application doesn't crash
   - Can still see other participants (if any)

## Console Logs to Look For

### Good Signs ✅
```
Connected to signaling server
Media not ready, queuing peer connection for [username]
(After media ready) Processing queued peer connections
```

### Bad Signs ❌
```
Cannot read properties of undefined (reading 'call')
TypeError: Cannot read properties of undefined
Peer error: [any error]
```

## Debugging Tips

### If Video Doesn't Appear:
1. Check browser console for errors
2. Verify camera permissions are granted
3. Check if `localStream` is set in React DevTools
4. Look for "Media not ready" warnings

### If Peer Connections Fail:
1. Check if both users have granted camera permissions
2. Verify WebSocket connection is established
3. Check for firewall/network issues
4. Look at the Network tab for failed requests

### If "Cannot read properties" Still Appears:
1. Clear browser cache and reload
2. Check if the fix was properly applied to `use-webrtc.ts`
3. Verify `mediaReadyRef.current` is `true` before peer creation
4. Check if `localStreamRef.current` is not null

## Expected Behavior Summary

| Action | Before Fix | After Fix |
|--------|-----------|-----------|
| Teacher starts session | ❌ Crash | ✅ Works |
| Student joins | ❌ Crash | ✅ Works |
| Multiple rapid joins | ❌ Crash | ✅ Works |
| Slow network | ❌ Crash | ✅ Works (queued) |
| Permission denied | ❌ Crash | ✅ Error message |

## Success Criteria

The fix is successful if:
1. ✅ No "Cannot read properties of undefined" errors
2. ✅ Teacher can start a session and see their video
3. ✅ Students can join and see teacher's video
4. ✅ All participants can see each other
5. ✅ Multiple users can join simultaneously
6. ✅ Graceful error handling for permission denials
7. ✅ No race conditions or timing issues

## Rollback Plan

If issues persist:
1. Check git history: `git log --oneline client/src/hooks/use-webrtc.ts`
2. Revert if needed: `git revert <commit-hash>`
3. Report the issue with console logs and steps to reproduce