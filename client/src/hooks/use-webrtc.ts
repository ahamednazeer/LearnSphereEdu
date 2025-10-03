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
}

interface UseWebRTCProps {
  sessionId: string;
  userId: string;
  userName: string;
  isHost?: boolean;
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
}

export const useWebRTC = ({ sessionId, userId, userName, isHost = false }: UseWebRTCProps) => {
  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    participants: new Map(),
    isConnected: false,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    isRecording: false,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, SimplePeerInstance>>(new Map());
  const recorderRef = useRef<RecordRTC | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaReadyRef = useRef<boolean>(false);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null); // store camera track for screen share swap
  const pendingPeersRef = useRef<Array<{ userId: string; userName: string; isHost: boolean }>>([]); 
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
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        newParticipants.set(data.userId, {
          id: data.userId,
          name: data.userName,
          stream: remoteStream,
          peer,
          isHost: data.isHost,
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
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        const existingParticipant = newParticipants.get(data.from);
        newParticipants.set(data.from, {
          ...existingParticipant,
          id: data.from,
          name: existingParticipant?.name || 'Unknown',
          stream: remoteStream,
          peer,
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
  const handleUserJoined = useCallback((data: { userId: string; userName: string; isHost: boolean }) => {
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
        isMuted: existing?.isMuted,
        isVideoOff: existing?.isVideoOff,
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log('initializeMedia: Got media stream successfully');
      localStreamRef.current = stream;
      originalVideoTrackRef.current = stream.getVideoTracks()[0] || null;
      mediaReadyRef.current = true;
      setState(prev => ({ ...prev, localStream: stream }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
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
  }, [createPeerConnection]);

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
      socket.emit('join-video-session', { sessionId, userId, userName, isHost });
    });

    // Use refs to avoid recreating socket on handler changes
    socket.on('user-joined', (data) => handlersRef.current.handleUserJoined?.(data));
    socket.on('user-left', (data) => handlersRef.current.handleUserLeft?.(data));
    socket.on('signal', (data) => handlersRef.current.handleSignal?.(data));

    // Initial participants list with names
    socket.on('participants', (arr: Array<{ userId: string; userName: string; isHost: boolean }>) => {
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
            isMuted: existing?.isMuted,
            isVideoOff: existing?.isVideoOff,
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
    if (localStreamRef.current) {
      recorderRef.current = new RecordRTC(localStreamRef.current, {
        type: 'video',
        mimeType: 'video/webm',
      });

      recorderRef.current.startRecording();
      setState(prev => ({ ...prev, isRecording: true }));
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording(() => {
        const blob = recorderRef.current?.getBlob();
        if (blob) {
          // Here you would typically upload the recording to your server
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `session-${sessionId}-${Date.now()}.webm`;
          a.click();
        }
      });

      setState(prev => ({ ...prev, isRecording: false }));
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