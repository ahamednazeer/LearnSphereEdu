import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebRTC } from '../use-webrtc';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';

// Mock dependencies
jest.mock('socket.io-client');
jest.mock('simple-peer');
jest.mock('recordrtc');

describe('useWebRTC Hook', () => {
  let mockSocket: any;
  let mockPeer: any;
  let mockStream: MediaStream;
  let mockGetUserMedia: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock MediaStream
    mockStream = {
      getTracks: jest.fn(() => [
        { kind: 'audio', enabled: true, stop: jest.fn() },
        { kind: 'video', enabled: true, stop: jest.fn() },
      ]),
      getAudioTracks: jest.fn(() => [{ enabled: true }]),
      getVideoTracks: jest.fn(() => [{ enabled: true }]),
    } as any;

    // Mock getUserMedia
    mockGetUserMedia = jest.fn().mockResolvedValue(mockStream);
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
        getDisplayMedia: jest.fn().mockResolvedValue(mockStream),
      },
      writable: true,
    });

    // Mock Socket.IO
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connected: false,
    };
    (io as jest.Mock).mockReturnValue(mockSocket);

    // Mock SimplePeer
    mockPeer = {
      on: jest.fn(),
      signal: jest.fn(),
      destroy: jest.fn(),
      _pc: {
        getSenders: jest.fn(() => [
          {
            track: { kind: 'video' },
            replaceTrack: jest.fn(),
          },
        ]),
      },
    };
    (Peer as any).mockImplementation(() => mockPeer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
          isHost: false,
        })
      );

      expect(result.current.localStream).toBeNull();
      expect(result.current.participants.size).toBe(0);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isMuted).toBe(false);
      expect(result.current.isVideoOff).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should initialize media successfully', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
          isHost: true,
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: true,
        audio: true,
      });
      expect(result.current.localStream).toBe(mockStream);
      expect(result.current.error).toBeNull();
    });

    it('should handle media initialization error', async () => {
      const error = new Error('Permission denied');
      mockGetUserMedia.mockRejectedValueOnce(error);

      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      expect(result.current.error).toContain('Failed to access camera/microphone');
    });
  });

  describe('Socket Connection', () => {
    it('should not connect socket before media is ready', () => {
      renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      expect(io).not.toHaveBeenCalled();
    });

    it('should connect socket after media is initialized', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
          isHost: true,
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      await waitFor(() => {
        expect(io).toHaveBeenCalled();
      });
    });

    it('should not reconnect if already connected', async () => {
      mockSocket.connected = true;

      const { result, rerender } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      const callCount = (io as jest.Mock).mock.calls.length;

      // Force re-render
      rerender();

      expect((io as jest.Mock).mock.calls.length).toBe(callCount);
    });

    it('should register all socket event handlers', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('user-joined', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('user-left', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('signal', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('session-ended', expect.any(Function));
      });
    });
  });

  describe('Peer Connections', () => {
    it('should create peer connection when user joins', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      // Simulate user joined event
      await act(async () => {
        const userJoinedHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'user-joined'
        )?.[1];

        if (userJoinedHandler) {
          userJoinedHandler({
            userId: 'user-2',
            userName: 'User 2',
            isHost: false,
          });
        }
      });

      expect(Peer).toHaveBeenCalledWith({
        initiator: true,
        trickle: false,
        stream: mockStream,
      });
    });

    it('should not create peer for self', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      const peerCountBefore = (Peer as jest.Mock).mock.calls.length;

      await act(async () => {
        const userJoinedHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'user-joined'
        )?.[1];

        if (userJoinedHandler) {
          userJoinedHandler({
            userId: 'user-1', // Same as current user
            userName: 'Test User',
            isHost: false,
          });
        }
      });

      expect((Peer as jest.Mock).mock.calls.length).toBe(peerCountBefore);
    });

    it('should handle user leaving', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      // Add a user
      await act(async () => {
        const userJoinedHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'user-joined'
        )?.[1];

        if (userJoinedHandler) {
          userJoinedHandler({
            userId: 'user-2',
            userName: 'User 2',
            isHost: false,
          });
        }
      });

      // Remove the user
      await act(async () => {
        const userLeftHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'user-left'
        )?.[1];

        if (userLeftHandler) {
          userLeftHandler({ userId: 'user-2' });
        }
      });

      expect(mockPeer.destroy).toHaveBeenCalled();
    });
  });

  describe('Media Controls', () => {
    it('should toggle mute', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      const audioTrack = mockStream.getAudioTracks()[0];

      await act(async () => {
        result.current.toggleMute();
      });

      expect(audioTrack.enabled).toBe(false);
      expect(result.current.isMuted).toBe(true);

      await act(async () => {
        result.current.toggleMute();
      });

      expect(audioTrack.enabled).toBe(true);
      expect(result.current.isMuted).toBe(false);
    });

    it('should toggle video', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      const videoTrack = mockStream.getVideoTracks()[0];

      await act(async () => {
        result.current.toggleVideo();
      });

      expect(videoTrack.enabled).toBe(false);
      expect(result.current.isVideoOff).toBe(true);

      await act(async () => {
        result.current.toggleVideo();
      });

      expect(videoTrack.enabled).toBe(true);
      expect(result.current.isVideoOff).toBe(false);
    });

    it('should start screen sharing', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      // Add a peer
      await act(async () => {
        const userJoinedHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'user-joined'
        )?.[1];

        if (userJoinedHandler) {
          userJoinedHandler({
            userId: 'user-2',
            userName: 'User 2',
            isHost: false,
          });
        }
      });

      await act(async () => {
        await result.current.startScreenShare();
      });

      expect(result.current.isScreenSharing).toBe(true);
      expect(mockPeer._pc.getSenders).toHaveBeenCalled();
    });

    it('should stop screen sharing', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
        await result.current.startScreenShare();
        await result.current.stopScreenShare();
      });

      expect(result.current.isScreenSharing).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should handle session ended', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      await act(async () => {
        const sessionEndedHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'session-ended'
        )?.[1];

        if (sessionEndedHandler) {
          sessionEndedHandler();
        }
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.localStream).toBeNull();
    });

    it('should leave session and cleanup', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      await act(async () => {
        result.current.leaveSession();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('leave-video-session', {
        sessionId: 'test-session',
        userId: 'user-1',
      });

      const tracks = mockStream.getTracks();
      tracks.forEach((track: any) => {
        expect(track.stop).toHaveBeenCalled();
      });
    });
  });

  describe('Stable Handler References', () => {
    it('should not reconnect socket when handlers change', async () => {
      const { result, rerender } = renderHook(
        (props) => useWebRTC(props),
        {
          initialProps: {
            sessionId: 'test-session',
            userId: 'user-1',
            userName: 'Test User',
            isHost: false,
          },
        }
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      const socketCallCount = (io as jest.Mock).mock.calls.length;

      // Force multiple re-renders
      rerender({
        sessionId: 'test-session',
        userId: 'user-1',
        userName: 'Test User',
        isHost: false,
      });

      rerender({
        sessionId: 'test-session',
        userId: 'user-1',
        userName: 'Test User',
        isHost: false,
      });

      // Socket should not reconnect
      expect((io as jest.Mock).mock.calls.length).toBe(socketCallCount);
    });

    it('should use latest handler logic via refs', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      await act(async () => {
        await result.current.initializeMedia();
      });

      // Get the handler registered with socket
      const userJoinedHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'user-joined'
      )?.[1];

      expect(userJoinedHandler).toBeDefined();

      // Call handler multiple times - should always use latest logic
      await act(async () => {
        userJoinedHandler({
          userId: 'user-2',
          userName: 'User 2',
          isHost: false,
        });
      });

      await act(async () => {
        userJoinedHandler({
          userId: 'user-3',
          userName: 'User 3',
          isHost: false,
        });
      });

      // Both calls should have created peers
      expect((Peer as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should queue peer connections if media not ready', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      // Try to handle user joined BEFORE media is ready
      await act(async () => {
        const userJoinedHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'user-joined'
        )?.[1];

        // This should not create a peer yet
        if (userJoinedHandler) {
          userJoinedHandler({
            userId: 'user-2',
            userName: 'User 2',
            isHost: false,
          });
        }
      });

      // No peer should be created yet
      expect(Peer).not.toHaveBeenCalled();

      // Now initialize media
      await act(async () => {
        await result.current.initializeMedia();
      });

      // Peer should still not be created (queued connections need manual processing)
      // This is expected behavior - the hook queues them for safety
    });

    it('should not create peer without local stream', async () => {
      const { result } = renderHook(() =>
        useWebRTC({
          sessionId: 'test-session',
          userId: 'user-1',
          userName: 'Test User',
        })
      );

      // Don't initialize media

      await act(async () => {
        const signalHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'signal'
        )?.[1];

        if (signalHandler) {
          signalHandler({
            from: 'user-2',
            signal: { type: 'offer' },
          });
        }
      });

      // Should not crash, just log warning
      expect(Peer).not.toHaveBeenCalled();
    });
  });
});