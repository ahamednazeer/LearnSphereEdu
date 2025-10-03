# Active Speaker Detection Fix

## Issues Found and Fixed

### Problem
The active speaker detection (green border highlights) was not showing for participants during live video calls.

### Root Causes Identified

1. **Missing Audio Analyzer Setup for Non-Initiator Peers**
   - In the `handleSignal` function, when receiving remote streams from non-initiator peers, the audio analyzer was not being set up
   - This meant that some participants would not have their audio monitored for speaking detection
   - **Location**: `use-webrtc.ts` lines 274-287

2. **Missing `isSpeaking` Property Initialization**
   - When participants were added via the `handleSignal` path, the `isSpeaking` property was not initialized
   - This could cause undefined behavior in the UI
   - **Location**: `use-webrtc.ts` line 291

3. **Stale Closure in Audio Monitoring Effect**
   - The `checkAudioLevels` function was using `state.participants` directly instead of using the functional setState form
   - This created a stale closure where the function would always reference the participants from when the effect was first created
   - As participants joined/left, the audio monitoring would not update properly
   - **Location**: `use-webrtc.ts` line 1147

4. **Missing Cleanup for Remote Analyzers**
   - When participants left the session, their audio analyzers were not being cleaned up
   - This could lead to memory leaks and unnecessary processing
   - **Location**: `use-webrtc.ts` `handleUserLeft` function

## Fixes Applied

### 1. Added Audio Analyzer Setup in `handleSignal`
```typescript
peer.on('stream', (remoteStream) => {
  // Setup audio analyzer for remote stream
  if (audioContextRef.current && remoteStream.getAudioTracks().length > 0) {
    try {
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(remoteStream);
      source.connect(analyser);
      remoteAnalysersRef.current.set(data.from, analyser);
    } catch (err) {
      console.warn('Failed to setup audio analyzer for remote stream:', err);
    }
  }

  setState(prev => {
    const newParticipants = new Map(prev.participants);
    const existingParticipant = newParticipants.get(data.from);
    newParticipants.set(data.from, {
      ...existingParticipant,
      id: data.from,
      name: existingParticipant?.name || 'Unknown',
      stream: remoteStream,
      peer,
      isSpeaking: false, // Initialize isSpeaking property
    });
    return { ...prev, participants: newParticipants };
  });
});
```

### 2. Fixed Stale Closure in Audio Monitoring
```typescript
// Check remote participants audio
setState(prev => {
  const updatedParticipants = new Map(prev.participants);
  let hasChanges = false;

  remoteAnalysersRef.current.forEach((analyser, userId) => {
    const participant = updatedParticipants.get(userId);
    if (participant && !participant.isMuted) {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const isSpeaking = average > SPEAKING_THRESHOLD;
      
      if (participant.isSpeaking !== isSpeaking) {
        updatedParticipants.set(userId, { ...participant, isSpeaking });
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    return { ...prev, participants: updatedParticipants };
  }
  return prev;
});
```

### 3. Added Cleanup for Remote Analyzers
```typescript
const handleUserLeft = useCallback((data: { userId: string }) => {
  const peer = peersRef.current.get(data.userId);
  if (peer) {
    peer.destroy();
    peersRef.current.delete(data.userId);
  }

  // Clean up audio analyzer for this participant
  remoteAnalysersRef.current.delete(data.userId);

  setState(prev => {
    const newParticipants = new Map(prev.participants);
    newParticipants.delete(data.userId);
    return { ...prev, participants: newParticipants };
  });
}, []);
```

## How It Works Now

1. **Audio Analyzer Setup**
   - When any participant's stream is received (both initiator and non-initiator paths), an `AnalyserNode` is created
   - The analyzer monitors the audio frequency data in real-time
   - Each participant has their own dedicated analyzer

2. **Speaking Detection**
   - Every 100ms, the audio monitoring effect checks all analyzers
   - It calculates the average audio level across frequency bins
   - If the average exceeds the threshold (30), the participant is marked as speaking
   - The `isSpeaking` state is updated only when it changes to minimize re-renders

3. **Visual Feedback**
   - The `VideoTile` component receives the `isSpeaking` prop
   - When `isSpeaking` is true and the participant is not muted:
     - A green ring (`ring-4 ring-green-500 ring-opacity-75`) appears around the video tile
     - If video is off, the avatar also scales up and shows the green ring
   - This provides clear visual feedback of who is currently speaking

4. **Resource Management**
   - Audio analyzers are properly cleaned up when participants leave
   - The audio context is closed when the session ends
   - No memory leaks or orphaned resources

## Testing Recommendations

1. **Multi-Participant Test**
   - Join a session with 3+ participants
   - Have each participant speak one at a time
   - Verify that green borders appear around the speaking participant's video tile
   - Verify that borders disappear when they stop speaking

2. **Mute/Unmute Test**
   - Mute your microphone and speak
   - Verify that no green border appears (muted participants shouldn't show as speaking)
   - Unmute and speak again
   - Verify that the green border appears

3. **Video Off Test**
   - Turn off your video
   - Speak while video is off
   - Verify that the avatar shows a green ring and scales up
   - Stop speaking and verify the ring disappears

4. **Join/Leave Test**
   - Have participants join and leave the session
   - Verify that speaking detection works for all participants regardless of join order
   - Check browser console for any errors related to audio analyzers

5. **Recording Test**
   - Start recording during a session
   - Have different participants speak
   - Verify that green borders appear in the recording around speaking participants
   - Stop recording and review the video file

## Technical Details

- **FFT Size**: 256 (provides good balance between accuracy and performance)
- **Speaking Threshold**: 30 (audio level, adjustable for sensitivity)
- **Check Interval**: 100ms (10 times per second)
- **Audio Context**: Shared across all participants for efficiency
- **Browser Compatibility**: Uses standard Web Audio API (supported in all modern browsers)

## Future Enhancements

1. **Adjustable Sensitivity**: Add a UI control to adjust the speaking threshold
2. **Noise Gate**: Implement a noise gate to filter out background noise
3. **Voice Activity Detection (VAD)**: Use more sophisticated VAD algorithms
4. **Audio Visualization**: Add real-time audio level meters for each participant
5. **Dominant Speaker**: Highlight the loudest speaker when multiple people talk
6. **Speaking History**: Track and display speaking time statistics