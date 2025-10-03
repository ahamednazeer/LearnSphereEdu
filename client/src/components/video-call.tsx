import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWebRTC } from '@/hooks/use-webrtc';
import { useAuth } from '@/hooks/use-auth';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Circle,
  Square,
  Phone,
  MessageSquare,
  Users,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoCallProps {
  sessionId: string;
  sessionTitle: string;
  isHost?: boolean;
  onLeave?: () => void;
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
}

interface VideoTileProps {
  stream: MediaStream;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHost?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  name,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isHost = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      // Attach stream and control playback based on video toggle
      el.srcObject = stream;
      if (!isVideoOff) {
        const playPromise = el.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(() => {/* ignore autoplay restrictions */});
        }
      } else {
        try { el.pause(); } catch {}
      }
    }
  }, [stream, isVideoOff]);

  return (
    <Card className="relative overflow-hidden bg-gray-900">
      <CardContent className="p-0 aspect-video">
        {!isVideoOff ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-xl font-semibold text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-white text-sm">{name}</p>
            </div>
          </div>
        )}
        
        {/* Overlay with participant info */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <Badge variant={isHost ? "default" : "secondary"} className="text-xs">
            {name} {isLocal && "(You)"}
            {isHost && " (Host)"}
          </Badge>
          {isMuted && (
            <div className="bg-red-500 rounded-full p-1">
              <MicOff className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const VideoCall: React.FC<VideoCallProps> = ({
  sessionId,
  sessionTitle,
  isHost = false,
  onLeave,
  onToggleChat,
  onToggleParticipants,
}) => {
  const { user } = useAuth();
  const {
    localStream,
    participants,
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isRecording,
    error,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    leaveSession,
    localVideoRef,
  } = useWebRTC({
    sessionId,
    userId: user?.id || '',
    userName: `${user?.firstName} ${user?.lastName}` || 'Unknown',
    isHost,
  });

  const handleLeave = () => {
    leaveSession();
    onLeave?.();
  };

  const participantArray = Array.from(participants.values());
  const totalParticipants = participantArray.length + 1; // +1 for local user

  // Grid layout based on participant count
  const getGridClass = () => {
    if (totalParticipants === 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 6) return "grid-cols-3";
    return "grid-cols-4";
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6 max-w-md">
          <CardContent className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-lg font-semibold">{sessionTitle}</h1>
          <p className="text-gray-400 text-sm">
            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
            {!isConnected && " • Connecting..."}
            {isRecording && " • Recording"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleParticipants}
            className="text-white hover:bg-gray-700"
          >
            <Users className="w-4 h-4 mr-2" />
            Participants
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleChat}
            className="text-white hover:bg-gray-700"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat
          </Button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4">
        <div className={cn("grid gap-4 h-full", getGridClass())}>
          {/* Local video */}
          {localStream && (
            <VideoTile
              stream={localStream}
              name={`${user?.firstName} ${user?.lastName}` || 'You'}
              isLocal={true}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isHost={isHost}
            />
          )}
          
          {/* Remote participants */}
          {participantArray.map((participant) => (
            participant.stream && (
              <VideoTile
                key={participant.id}
                stream={participant.stream}
                name={participant.name}
                isMuted={participant.isMuted}
                isVideoOff={participant.isVideoOff}
                isHost={participant.isHost}
              />
            )
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-center gap-4">
          {/* Mute/Unmute */}
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleMute}
            className="rounded-full w-12 h-12 p-0"
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {/* Video On/Off */}
          <Button
            variant={isVideoOff ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12 p-0"
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>

          {/* Screen Share */}
          {isHost && (
            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="lg"
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className="rounded-full w-12 h-12 p-0"
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </Button>
          )}

          {/* Recording */}
          {isHost && (
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="lg"
              onClick={isRecording ? stopRecording : startRecording}
              className="rounded-full w-12 h-12 p-0"
            >
              {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
            </Button>
          )}

          {/* Settings */}
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full w-12 h-12 p-0"
          >
            <Settings className="w-5 h-5" />
          </Button>

          {/* Leave Call */}
          <Button
            variant="destructive"
            size="lg"
            onClick={handleLeave}
            className="rounded-full w-12 h-12 p-0 ml-4"
          >
            <Phone className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Hidden video element for local stream */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
    </div>
  );
};