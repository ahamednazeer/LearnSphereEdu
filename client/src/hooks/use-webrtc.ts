import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import type { Instance as SimplePeerInstance } from 'simple-peer';
import { io, Socket } from 'socket.io-client';
import RecordRTC from 'recordrtc';

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  peer?: SimplePeerInstance;
  isHost?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
}

interface UseWebRTCProps {
  sessionId: string;
  userId: string;
  userName: string;
  isHost?: boolean;
  initialMuted?: boolean;
  initialVideoOff?: boolean;
}

interface WebRTCState {
  localStream: MediaStream | null;
  participants: Map<string, Participant>;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  error: string | null;
  isSpeaking: boolean;
}

export const useWebRTC = ({ 
  sessionId, 
  userId, 
  userName, 
  isHost = false,
  initialMuted = false,
  initialVideoOff = false 
}: UseWebRTCProps) => {
  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    participants: new Map(),
    isConnected: false,
    isMuted: initialMuted,
    isVideoOff: initialVideoOff,
    isScreenSharing: false,
    isRecording: false,
    error: null,
    isSpeaking: false,
  });

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, SimplePeerInstance>>(new Map());
  const recorderRef = useRef<RecordRTC | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaReadyRef = useRef<boolean>(false);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null); // store camera track for screen share swap
  const pendingPeersRef = useRef<Array<{ userId: string; userName: string; isHost: boolean }>>([]); 
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const handlersRef = useRef<{
    handleUserJoined?: (data: { userId: string; userName: string; isHost: boolean }) => void;
    handleUserLeft?: (data: { userId: string }) => void;
    handleSignal?: (data: { from: string; signal: any }) => void;
    handleSessionEnded?: () => void;
  }>({});

  // Create peer connection helper
  const createPeerConnection = useCallback((data: { userId: string; userName: string; isHost: boolean }, initiator: boolean) => {
    if (!localStreamRef.current) {
      console.warn('Cannot create peer connection: local stream not ready');
      return null;
    }

    const peer = new (Peer as any)({
      initiator,
      trickle: false,
      stream: localStreamRef.current,
    }) as SimplePeerInstance;

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', {
        to: data.userId,
        from: userId,
        signal,
      });
    });

    peer.on('stream', (remoteStream) => {
      // Setup audio analyzer for remote stream
      if (audioContextRef.current && remoteStream.getAudioTracks().length > 0) {
        try {
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          const source = audioContextRef.current.createMediaStreamSource(remoteStream);
          source.connect(analyser);
          remoteAnalysersRef.current.set(data.userId, analyser);
        } catch (err) {
          console.warn('Failed to setup audio analyzer for remote stream:', err);
        }
      }

      setState(prev => {
        const newParticipants = new Map(prev.participants);
        newParticipants.set(data.userId, {
          id: data.userId,
          name: data.userName,
          stream: remoteStream,
          peer,
          isHost: data.isHost,
          isSpeaking: false,
        });
        return { ...prev, participants: newParticipants };
      });
    });

    peer.on('error', (error) => {
      console.error('Peer error:', error);
    });

    peersRef.current.set(data.userId, peer);
    return peer;
  }, [userId]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Destroy all peer connections
    peersRef.current.forEach(peer => peer.destroy());
    peersRef.current.clear();

    // Stop recording if active
    if (recorderRef.current) {
      recorderRef.current.stopRecording();
      recorderRef.current = null;
    }

    // Clean up recording resources
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
    }
    recordingCanvasRef.current = null;

    // Clean up audio analyzers
    remoteAnalysersRef.current.clear();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    localAnalyserRef.current = null;

    // Reset media ready flag
    mediaReadyRef.current = false;

    setState({
      localStream: null,
      participants: new Map(),
      isConnected: false,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isRecording: false,
      error: null,
      isSpeaking: false,
    });
  }, []);

  // Handle session ended
  const handleSessionEnded = useCallback(() => {
    setState(prev => ({ ...prev, isConnected: false }));
    cleanup();
  }, [cleanup]);

  // Store in ref for stable reference
  handlersRef.current.handleSessionEnded = handleSessionEnded;

  // Handle user leaving
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

  // Store in ref for stable reference
  handlersRef.current.handleUserLeft = handleUserLeft;

  // Handle WebRTC signaling
  const handleSignal = useCallback((data: { from: string; signal: any }) => {
    const existingPeer = peersRef.current.get(data.from);
    const incomingSignal: any = (data as any).signal;
    const incomingType: 'offer' | 'answer' | undefined = incomingSignal?.type;

    const getPc = (p: any) => (p && (p as any)._pc) || null;

    if (existingPeer) {
      const pc: RTCPeerConnection | null = getPc(existingPeer);

      // Drop duplicate answers when already stable with a remote answer set
      if (
        incomingType === 'answer' &&
        pc?.signalingState === 'stable' &&
        (pc as any)?.remoteDescription
      ) {
        console.warn('Ignoring duplicate answer from', data.from);
        return;
      }

      // Avoid glare: if we are initiator and receive an offer, ignore it
      if ((existingPeer as any).initiator && incomingType === 'offer') {
        console.warn('Ignoring incoming offer due to initiator role (glare) from', data.from);
        return;
      }

      try {
        existingPeer.signal(incomingSignal);
      } catch (err) {
        console.warn('Ignoring signal due to state error:', err);
      }
      return;
    }

    // No peer yet: only create non-initiator when receiving an offer
    if (incomingType !== 'offer') {
      console.warn('Received non-offer before peer exists; ignoring from', data.from);
      return;
    }

    // Check if media is ready before creating peer
    if (!localStreamRef.current) {
      console.warn('Cannot handle signal: local stream not ready');
      return;
    }

    // Create new peer for incoming connection
    const peer = new (Peer as any)({
      initiator: false,
      trickle: false,
      stream: localStreamRef.current,
    }) as SimplePeerInstance;

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', {
        to: data.from,
        from: userId,
        signal,
      });
    });

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
          isSpeaking: false,
        });
        return { ...prev, participants: newParticipants };
      });
    });

    peer.on('error', (error) => {
      console.error('Peer error:', error);
    });

    // Store the peer before applying the initial offer
    peersRef.current.set(data.from, peer);
    try {
      peer.signal(incomingSignal);
    } catch (err) {
      console.warn('Failed to apply initial offer:', err);
    }
  }, [userId]);

  // Store in ref for stable reference
  handlersRef.current.handleSignal = handleSignal;

  // Handle new user joining
  const handleUserJoined = useCallback((data: { userId: string; userName: string; isHost: boolean; isMuted?: boolean; isVideoOff?: boolean }) => {
    console.log('handleUserJoined called:', data.userName, 'mediaReady:', mediaReadyRef.current, 'localStream:', !!localStreamRef.current);

    // Pre-store participant name so UI badges work even before stream
    setState(prev => {
      const newParticipants = new Map(prev.participants);
      const existing = newParticipants.get(data.userId);
      newParticipants.set(data.userId, {
        id: data.userId,
        name: data.userName,
        stream: existing?.stream,
        peer: existing?.peer,
        isHost: data.isHost,
        isMuted: data.isMuted ?? existing?.isMuted,
        isVideoOff: data.isVideoOff ?? existing?.isVideoOff,
      });
      return { ...prev, participants: newParticipants };
    });
    
    if (data.userId === userId) return;

    // If media is not ready yet, queue this peer connection
    if (!mediaReadyRef.current || !localStreamRef.current) {
      console.warn('Media not ready, queuing peer connection for', data.userName);
      pendingPeersRef.current.push(data);
      return;
    }

    console.log('Creating peer connection for', data.userName);
    createPeerConnection(data, true);
  }, [userId, createPeerConnection]);

  // Store in ref for stable reference
  handlersRef.current.handleUserJoined = handleUserJoined;

  // Get user media
  const initializeMedia = useCallback(async () => {
    console.log('initializeMedia: Starting getUserMedia...');
    try {
      // Always request audio, but video is optional based on initialVideoOff
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !initialVideoOff,
        audio: true,
      });

      console.log('initializeMedia: Got media stream successfully');
      localStreamRef.current = stream;
      originalVideoTrackRef.current = stream.getVideoTracks()[0] || null;
      mediaReadyRef.current = true;
      
      // Set initial video state based on initialVideoOff
      setState(prev => ({ 
        ...prev, 
        localStream: stream,
        isVideoOff: initialVideoOff 
      }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup audio analyzer for local stream (independent of video)
      if (stream.getAudioTracks().length > 0) {
        try {
          audioContextRef.current = new AudioContext();
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyser);
          localAnalyserRef.current = analyser;
          console.log('Audio analyzer setup successfully');
        } catch (err) {
          console.warn('Failed to setup audio analyzer for local stream:', err);
        }
      }

      // Apply initial mute state if needed
      if (initialMuted && stream.getAudioTracks().length > 0) {
        stream.getAudioTracks()[0].enabled = false;
        setState(prev => ({ ...prev, isMuted: true }));
      }

      console.log('initializeMedia: Media ready, socket will connect via useEffect');

      // Socket will connect and join automatically via useEffect
      // when state.localStream is set

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to access camera/microphone. Please check permissions.' 
      }));
      return null;
    }
  }, [initialVideoOff, initialMuted]);

  // Initialize socket connection - only after media is ready
  useEffect(() => {
    // Don't connect socket until media is ready
    if (!state.localStream) {
      return;
    }

    // Don't reconnect if already connected
    if (socketRef.current?.connected) {
      return;
    }

    console.log('Initializing socket connection with media ready');

    socketRef.current = io(window.location.origin, {
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      socket.emit('join-video-session', { 
        sessionId, 
        userId, 
        userName, 
        isHost,
        isMuted: state.isMuted,
        isVideoOff: state.isVideoOff
      });
    });

    // Use refs to avoid recreating socket on handler changes
    socket.on('user-joined', (data) => handlersRef.current.handleUserJoined?.(data));
    socket.on('user-left', (data) => handlersRef.current.handleUserLeft?.(data));
    socket.on('signal', (data) => handlersRef.current.handleSignal?.(data));

    // Initial participants list with names
    socket.on('participants', (arr: Array<{ userId: string; userName: string; isHost: boolean; isMuted?: boolean; isVideoOff?: boolean }>) => {
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
            isMuted: p.isMuted ?? existing?.isMuted,
            isVideoOff: p.isVideoOff ?? existing?.isVideoOff,
          });
        }
        return { ...prev, participants: newParticipants };
      });
    });

    // Update UI for remote mute/video toggles
    socket.on('participant-update', (data: { userId: string; isMuted?: boolean; isVideoOff?: boolean }) => {
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        const p = newParticipants.get(data.userId);
        if (p) {
          newParticipants.set(data.userId, {
            ...p,
            isMuted: data.isMuted ?? p.isMuted,
            isVideoOff: data.isVideoOff ?? p.isVideoOff,
          });
        }
        return { ...prev, participants: newParticipants };
      });
    });

    socket.on('session-ended', () => handlersRef.current.handleSessionEnded?.());

    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [state.localStream, sessionId, userId, userName, isHost]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
        
        // Notify other participants
        socketRef.current?.emit('participant-update', {
          sessionId,
          userId,
          isMuted: !audioTrack.enabled,
        });
      }
    }
  }, [sessionId, userId]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setState(prev => ({ ...prev, isVideoOff: !videoTrack.enabled }));
        
        // Notify other participants
        socketRef.current?.emit('participant-update', {
          sessionId,
          userId,
          isVideoOff: !videoTrack.enabled,
        });
      }
    }
  }, [sessionId, userId]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        // Many browsers do not capture system audio without extra flags
        // We'll keep audio from the mic in the existing local stream
        audio: false,
      });

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (!screenVideoTrack) throw new Error('No screen video track');

      // Replace local video track reference for rendering self-view if needed
      if (localStreamRef.current) {
        // Replace the video track in the local stream for UI consistency
        const [oldVideoTrack] = localStreamRef.current.getVideoTracks();
        if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(screenVideoTrack);

        // Update local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          try { (localVideoRef.current as HTMLVideoElement).play(); } catch {}
        }
      }

      // Replace video sender track for all peers
      peersRef.current.forEach((peer) => {
        const sender = peer._pc?.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenVideoTrack);
        }
      });

      // Force video-on state so UI shows the stream tile
      setState(prev => ({ ...prev, isScreenSharing: true, isVideoOff: false }));

      // When user stops sharing via browser UI, revert
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

    } catch (error) {
      console.error('Error starting screen share:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start screen sharing' 
      }));
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    const cameraTrack = originalVideoTrackRef.current;
    if (cameraTrack) {
      // If camera was stopped, try to reacquire
      if (cameraTrack.readyState !== 'live') {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          originalVideoTrackRef.current = camStream.getVideoTracks()[0] || null;
        } catch (e) {
          console.warn('Could not reacquire camera video:', e);
          setState(prev => ({ ...prev, isScreenSharing: false }));
          return;
        }
      }
    }

    if (localStreamRef.current) {
      // Remove screen track and add back camera
      const [currentVideoTrack] = localStreamRef.current.getVideoTracks();
      if (currentVideoTrack) localStreamRef.current.removeTrack(currentVideoTrack);
      if (originalVideoTrackRef.current) localStreamRef.current.addTrack(originalVideoTrackRef.current);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }

    // Replace sender tracks back to camera for all peers
    const newVideo = originalVideoTrackRef.current;
    if (newVideo) {
      peersRef.current.forEach((peer) => {
        const sender = peer._pc?.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideo);
        }
      });
    }

    setState(prev => ({ ...prev, isScreenSharing: false }));
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!localStreamRef.current) {
      console.error('Cannot start recording: no local stream');
      return;
    }

    try {
      // Create a canvas to composite all video streams (Full HD for professional quality)
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      recordingCanvasRef.current = canvas;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Cannot get canvas context');
        return;
      }

      const recordingStartTime = Date.now();

      // Create video elements for all streams
      const localVideo = document.createElement('video');
      localVideo.srcObject = localStreamRef.current;
      localVideo.muted = true;
      localVideo.play().catch(e => console.warn('Local video play error:', e));

      const remoteVideos = new Map<string, HTMLVideoElement>();
      state.participants.forEach((participant, id) => {
        if (participant.stream) {
          const video = document.createElement('video');
          video.srcObject = participant.stream;
          video.muted = true;
          video.play().catch(e => console.warn('Remote video play error:', e));
          remoteVideos.set(id, video);
        }
      });

      // Track audio levels for active speaker detection
      const audioLevels = new Map<string, number>();
      audioLevels.set('local', 0);

      // Setup audio level monitoring for active speaker detection
      const setupAudioMonitoring = () => {
        try {
          const audioContext = new AudioContext();
          
          // Monitor local audio
          if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
            const localSource = audioContext.createMediaStreamSource(localStreamRef.current);
            const localAnalyser = audioContext.createAnalyser();
            localAnalyser.fftSize = 256;
            localSource.connect(localAnalyser);
            
            const localDataArray = new Uint8Array(localAnalyser.frequencyBinCount);
            const updateLocalLevel = () => {
              if (!recordingCanvasRef.current) return;
              localAnalyser.getByteFrequencyData(localDataArray);
              const average = localDataArray.reduce((a, b) => a + b) / localDataArray.length;
              audioLevels.set('local', average);
              requestAnimationFrame(updateLocalLevel);
            };
            updateLocalLevel();
          }

          // Monitor remote audio
          state.participants.forEach((participant, id) => {
            if (participant.stream && participant.stream.getAudioTracks().length > 0) {
              try {
                const remoteSource = audioContext.createMediaStreamSource(participant.stream);
                const remoteAnalyser = audioContext.createAnalyser();
                remoteAnalyser.fftSize = 256;
                remoteSource.connect(remoteAnalyser);
                
                const remoteDataArray = new Uint8Array(remoteAnalyser.frequencyBinCount);
                const updateRemoteLevel = () => {
                  if (!recordingCanvasRef.current) return;
                  remoteAnalyser.getByteFrequencyData(remoteDataArray);
                  const average = remoteDataArray.reduce((a, b) => a + b) / remoteDataArray.length;
                  audioLevels.set(id, average);
                  requestAnimationFrame(updateRemoteLevel);
                };
                updateRemoteLevel();
              } catch (e) {
                console.warn('Error monitoring remote audio:', e);
              }
            }
          });
        } catch (e) {
          console.warn('Error setting up audio monitoring:', e);
        }
      };

      setupAudioMonitoring();

      // Helper function to draw rounded rectangle
      const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      };

      // Helper function to format duration
      const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const displaySeconds = seconds % 60;
        const displayMinutes = minutes % 60;
        
        if (hours > 0) {
          return `${hours}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
        }
        return `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`;
      };

      // Draw all videos to canvas at 30fps
      const drawFrame = () => {
        if (!recordingCanvasRef.current) return;

        // Clear canvas with dark background
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Check if screen is being shared - if so, prioritize screen share
        const screenShareParticipant = Array.from(state.participants.entries()).find(
          ([_, p]) => p.stream && p.stream.getVideoTracks().some(t => t.label.includes('screen'))
        );

        if (state.isScreenSharing || screenShareParticipant) {
          // Screen sharing mode - show screen large with small participant thumbnails
          const screenStream = state.isScreenSharing ? screenStreamRef.current : screenShareParticipant?.[1].stream;
          
          if (screenStream) {
            const screenVideo = document.createElement('video');
            screenVideo.srcObject = screenStream;
            screenVideo.muted = true;
            screenVideo.play().catch(e => console.warn('Screen video play error:', e));

            // Wait for video to be ready
            if (screenVideo.readyState >= 2) {
              // Draw screen share (main area)
              const mainWidth = canvas.width;
              const mainHeight = canvas.height - 150; // Leave space for thumbnails at bottom
              ctx.drawImage(screenVideo, 0, 0, mainWidth, mainHeight);

              // Draw participant thumbnails at bottom
              const thumbnailHeight = 140;
              const thumbnailWidth = 180;
              const thumbnailSpacing = 10;
              const totalParticipants = 1 + remoteVideos.size;
              const thumbnailsStartX = (canvas.width - (totalParticipants * (thumbnailWidth + thumbnailSpacing))) / 2;

              // Draw local thumbnail
              const drawThumbnail = (video: HTMLVideoElement, x: number, y: number, name: string, isVideoOff: boolean, isLocal: boolean) => {
                const id = isLocal ? 'local' : '';
                const audioLevel = audioLevels.get(id) || 0;
                const isActiveSpeaker = audioLevel > 30;

                // Draw video or placeholder
                if (video.readyState >= 2 && !isVideoOff) {
                  ctx.save();
                  drawRoundedRect(x, y, thumbnailWidth, thumbnailHeight, 8);
                  ctx.clip();
                  ctx.drawImage(video, x, y, thumbnailWidth, thumbnailHeight);
                  ctx.restore();
                } else {
                  // Placeholder
                  ctx.fillStyle = '#1f2937';
                  drawRoundedRect(x, y, thumbnailWidth, thumbnailHeight, 8);
                  ctx.fill();
                  
                  // Draw initials
                  ctx.fillStyle = '#6366f1';
                  ctx.beginPath();
                  ctx.arc(x + thumbnailWidth / 2, y + thumbnailHeight / 2 - 10, 25, 0, Math.PI * 2);
                  ctx.fill();
                  
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 20px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  ctx.fillText(initials, x + thumbnailWidth / 2, y + thumbnailHeight / 2 - 10);
                }

                // Draw active speaker border
                if (isActiveSpeaker) {
                  ctx.strokeStyle = '#10b981';
                  ctx.lineWidth = 4;
                  drawRoundedRect(x, y, thumbnailWidth, thumbnailHeight, 8);
                  ctx.stroke();
                }

                // Draw name label at bottom
                ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                ctx.fillRect(x, y + thumbnailHeight - 30, thumbnailWidth, 30);
                ctx.fillStyle = '#ffffff';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(name, x + thumbnailWidth / 2, y + thumbnailHeight - 15);
              };

              let thumbnailIndex = 0;
              drawThumbnail(
                localVideo,
                thumbnailsStartX + thumbnailIndex * (thumbnailWidth + thumbnailSpacing),
                mainHeight + 5,
                'You',
                state.isVideoOff,
                true
              );
              thumbnailIndex++;

              remoteVideos.forEach((video, id) => {
                const participant = state.participants.get(id);
                drawThumbnail(
                  video,
                  thumbnailsStartX + thumbnailIndex * (thumbnailWidth + thumbnailSpacing),
                  mainHeight + 5,
                  participant?.name || 'Participant',
                  participant?.isVideoOff || false,
                  false
                );
                thumbnailIndex++;
              });
            }
          }
        } else {
          // Grid mode - show all participants in grid
          const totalVideos = 1 + remoteVideos.size;
          const cols = Math.ceil(Math.sqrt(totalVideos));
          const rows = Math.ceil(totalVideos / cols);
          
          const padding = 20;
          const gap = 15;
          const availableWidth = canvas.width - (padding * 2) - (gap * (cols - 1));
          const availableHeight = canvas.height - (padding * 2) - (gap * (rows - 1));
          const videoWidth = availableWidth / cols;
          const videoHeight = availableHeight / rows;

          // Helper to draw a participant tile
          const drawParticipantTile = (
            video: HTMLVideoElement,
            x: number,
            y: number,
            name: string,
            isVideoOff: boolean,
            participantId: string
          ) => {
            const audioLevel = audioLevels.get(participantId) || 0;
            const isActiveSpeaker = audioLevel > 30;

            // Draw video or placeholder
            if (video.readyState >= 2 && !isVideoOff) {
              ctx.save();
              drawRoundedRect(x, y, videoWidth, videoHeight, 12);
              ctx.clip();
              ctx.drawImage(video, x, y, videoWidth, videoHeight);
              ctx.restore();
            } else {
              // Draw placeholder
              ctx.fillStyle = '#1f2937';
              drawRoundedRect(x, y, videoWidth, videoHeight, 12);
              ctx.fill();
              
              // Draw avatar circle with initials
              ctx.fillStyle = '#6366f1';
              ctx.beginPath();
              const avatarRadius = Math.min(videoWidth, videoHeight) * 0.15;
              ctx.arc(x + videoWidth / 2, y + videoHeight / 2 - 20, avatarRadius, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = '#ffffff';
              ctx.font = `bold ${avatarRadius}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              ctx.fillText(initials, x + videoWidth / 2, y + videoHeight / 2 - 20);
            }

            // Draw active speaker border
            if (isActiveSpeaker) {
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 6;
              drawRoundedRect(x, y, videoWidth, videoHeight, 12);
              ctx.stroke();
            } else {
              // Draw subtle border
              ctx.strokeStyle = '#374151';
              ctx.lineWidth = 2;
              drawRoundedRect(x, y, videoWidth, videoHeight, 12);
              ctx.stroke();
            }

            // Draw name label at bottom
            const labelHeight = 40;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(x + 10, y + videoHeight - labelHeight - 10, videoWidth - 20, labelHeight);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, x + 20, y + videoHeight - labelHeight / 2 - 10);
          };

          // Draw local video
          drawParticipantTile(
            localVideo,
            padding,
            padding,
            'You',
            state.isVideoOff,
            'local'
          );

          // Draw remote videos
          let index = 1;
          remoteVideos.forEach((video, id) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = padding + col * (videoWidth + gap);
            const y = padding + row * (videoHeight + gap);

            const participant = state.participants.get(id);
            drawParticipantTile(
              video,
              x,
              y,
              participant?.name || 'Participant',
              participant?.isVideoOff || false,
              id
            );
            index++;
          });
        }

        // Draw recording indicator (top-left corner)
        const recX = 20;
        const recY = 20;
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.beginPath();
        ctx.arc(recX + 10, recY + 10, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(recX + 25, recY, 80, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('REC', recX + 30, recY + 10);

        // Draw duration (top-right corner)
        const duration = formatDuration(Date.now() - recordingStartTime);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        const durationWidth = ctx.measureText(duration).width + 20;
        ctx.fillRect(canvas.width - durationWidth - 20, 20, durationWidth, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(duration, canvas.width - 30, 30);

        if (recordingCanvasRef.current) {
          requestAnimationFrame(drawFrame);
        }
      };

      // Start drawing
      drawFrame();

      // Capture canvas stream
      const canvasStream = canvas.captureStream(30); // 30 fps
      
      // Mix audio from all streams
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      
      // Add local audio
      if (localStreamRef.current.getAudioTracks().length > 0 && !state.isMuted) {
        const localAudioSource = audioContext.createMediaStreamSource(localStreamRef.current);
        localAudioSource.connect(audioDestination);
      }
      
      // Add remote audio
      state.participants.forEach((participant) => {
        if (participant.stream && participant.stream.getAudioTracks().length > 0 && !participant.isMuted) {
          try {
            const remoteAudioSource = audioContext.createMediaStreamSource(participant.stream);
            remoteAudioSource.connect(audioDestination);
          } catch (e) {
            console.warn('Error adding remote audio:', e);
          }
        }
      });

      // Combine video from canvas and mixed audio
      const recordingStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);
      
      recordingStreamRef.current = recordingStream;

      // Start RecordRTC with the composite stream
      // Try to use H.264 codec for better compatibility, fallback to VP8
      let mimeType = 'video/webm;codecs=h264,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      
      recorderRef.current = new RecordRTC(recordingStream, {
        type: 'video',
        mimeType: mimeType,
        videoBitsPerSecond: 5000000, // 5 Mbps for Full HD quality
        recorderType: RecordRTC.MediaStreamRecorder,
      });

      recorderRef.current.startRecording();
      setState(prev => ({ ...prev, isRecording: true }));
      console.log('Recording started successfully with mimeType:', mimeType, '(Full HD 1920x1080)');
    } catch (error) {
      console.error('Error starting recording:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start recording' 
      }));
    }
  }, [state.participants, state.isVideoOff, state.isMuted, state.isScreenSharing]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording(async () => {
        const blob = recorderRef.current?.getBlob();
        if (blob) {
          // Determine file extension based on blob type
          let extension = 'webm';
          let fileName = `session-${sessionId}-${Date.now()}`;
          
          // If the blob contains h264, it's more compatible with MP4 players
          // We'll still save as .webm but it will play in most video players
          if (blob.type.includes('h264')) {
            console.log('Recording uses H.264 codec (MP4-compatible)');
          }
          
          // For better compatibility, we save as .mp4 extension even though it's WebM container
          // Modern video players can handle WebM with H.264 codec
          const finalFileName = `${fileName}.mp4`;
          
          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = finalFileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 100);
          
          console.log(`Recording saved as ${finalFileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        }
        
        // Clean up recording resources
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach(track => track.stop());
          recordingStreamRef.current = null;
        }
        
        recordingCanvasRef.current = null;
        recorderRef.current = null;
      });

      setState(prev => ({ ...prev, isRecording: false }));
      console.log('Recording stopped');
    }
  }, [sessionId]);

  // Leave session
  const leaveSession = useCallback(() => {
    socketRef.current?.emit('leave-video-session', { sessionId, userId });
    cleanup();
  }, [sessionId, userId, cleanup]);

  // Initialize media on mount
  useEffect(() => {
    initializeMedia();
    return cleanup;
  }, [initializeMedia, cleanup]);

  // Monitor audio levels for speaking detection
  useEffect(() => {
    if (!state.localStream && state.participants.size === 0) return;

    const SPEAKING_THRESHOLD = 30; // Adjust this value for sensitivity
    const dataArray = new Uint8Array(128);

    const checkAudioLevels = () => {
      // Check local audio
      if (localAnalyserRef.current && !state.isMuted) {
        localAnalyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = average > SPEAKING_THRESHOLD;
        
        setState(prev => {
          if (prev.isSpeaking !== isSpeaking) {
            return { ...prev, isSpeaking };
          }
          return prev;
        });
      }

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
    };

    const intervalId = setInterval(checkAudioLevels, 100); // Check every 100ms

    return () => clearInterval(intervalId);
  }, [state.localStream, state.participants, state.isMuted]);

  return {
    ...state,
    initializeMedia,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    leaveSession,
    localVideoRef,
  };
};