import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoCallProps {
  sessionId: string;
  sessionTitle: string;
  isHost?: boolean;
  initialMuted?: boolean;
  initialVideoOff?: boolean;
  onLeave?: () => void;
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
  onDelete?: () => void;
}

interface VideoTileProps {
  stream?: MediaStream;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHost?: boolean;
  isSpeaking?: boolean;
  isScreenShare?: boolean; // marks this tile as the active screen share
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  name,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isHost = false,
  isSpeaking = false,
  isScreenShare = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      // Always attach and play so audio continues even when video is off
      el.srcObject = stream;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {/* ignore autoplay restrictions */});
      }
    }
  }, [stream]);

  return (
    <Card className={cn(
      "relative overflow-hidden bg-gray-900 transition-all duration-300 ease-out",
      isSpeaking && !isMuted && "ring-4 ring-green-500 ring-opacity-75",
      "animate-in fade-in zoom-in-95 duration-300",
      isScreenShare && "lg:col-span-2 lg:row-span-2"
    )} style={{
      transformOrigin: 'center',
    }}>
      <CardContent className="p-0 aspect-video">
        {/* Keep the media element mounted for consistent sizing */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          style={{ visibility: isVideoOff ? 'hidden' : 'visible' }}
          aria-label={`${name}${isLocal ? ' (You)' : ''}${isMuted ? ' muted' : ''}${isVideoOff || !stream ? ' audio-only' : ' video'}`}
        />
        {(!stream || isVideoOff) && (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 transition-all duration-200",
                isSpeaking && !isMuted ? "ring-4 ring-green-500 ring-opacity-75 scale-110 shadow-lg" : "shadow-sm"
              )} style={{ backgroundColor: `hsl(${(Array.from(name).reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,0)>>>0)%360}, 45%, 45%)` }}>
                <span className="text-xl font-semibold text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <p className="text-white text-sm truncate max-w-[12rem]" title={name}>{name}</p>
                {(!stream || isVideoOff) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200 uppercase tracking-wide">Audio only</span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Overlay with participant info */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
          <div className="flex items-center gap-2">
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
          {/* Mic level bar: shows when speaking and not muted */}
          <div className="ml-auto h-1.5 w-24 rounded bg-gray-700 overflow-hidden" aria-hidden>
            <div className={cn(
              "h-full transition-all duration-150",
              isMuted ? "bg-gray-500 w-1/12" : isSpeaking ? "bg-green-500 w-10/12" : "bg-gray-400 w-3/12"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const VideoCall: React.FC<VideoCallProps> = ({
  sessionId,
  sessionTitle,
  isHost = false,
  initialMuted = false,
  initialVideoOff = false,
  onLeave,
  onToggleChat,
  onToggleParticipants,
  onDelete,
}) => {
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const {
    localStream,
    participants,
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isRecording,
    isSpeaking,
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
    initialMuted,
    initialVideoOff,
  });

  const handleLeave = () => {
    leaveSession();
    onLeave?.();
  };

  // Build a consistent list of tiles including self and remotes
  const participantArray = Array.from(participants.values());
  const tiles: Array<{
    id: string;
    name: string;
    stream?: MediaStream;
    isMuted?: boolean;
    isVideoOff?: boolean;
    isHost?: boolean;
    isLocal?: boolean;
    isSpeaking?: boolean;
    isScreenShare?: boolean;
  }> = [
    {
      id: 'local',
      name: `${user?.firstName} ${user?.lastName}` || 'You',
      stream: localStream || undefined,
      isMuted,
      isVideoOff,
      isHost,
      isLocal: true,
      isSpeaking,
      // Detect if the local stream is currently sharing screen by track label hint
      isScreenShare: Boolean(localStream?.getVideoTracks?.()[0]?.label?.toLowerCase().includes('screen')),
    },
    ...participantArray.map((p) => ({
      id: p.id,
      name: p.name,
      stream: p.stream,
      isMuted: p.isMuted,
      isVideoOff: p.isVideoOff,
      isHost: p.isHost,
      isLocal: false,
      isSpeaking: p.isSpeaking,
      // Heuristic: many browsers include "screen" in the screen-share track label
      isScreenShare: Boolean(p.stream?.getVideoTracks?.()[0]?.label?.toLowerCase().includes('screen')),
    })),
  ];

  // Participant count and stable ordering for layout
  const totalParticipants = tiles.length;
  const sortedTiles = [...tiles].sort((a, b) => {
    if (a.isHost && !b.isHost) return -1; // host first
    if (b.isHost && !a.isHost) return 1;
    if (a.isLocal && !b.isLocal) return -1; // then local
    if (b.isLocal && !a.isLocal) return 1;
    return a.name.localeCompare(b.name);
  });

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
            className="text-white hover:bg-gray-700 relative"
            aria-label={`Participants (${totalParticipants})`}
          >
            <Users className="w-4 h-4 mr-2" />
            Participants
            <Badge className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0">
              {totalParticipants}
            </Badge>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleChat}
            className="text-white hover:bg-gray-700"
            aria-label="Chat"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat
          </Button>
          {isHost && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Session
            </Button>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4">
        <div
          className="grid h-full gap-4 justify-center items-stretch max-w-screen-2xl mx-auto
            grid-cols-[repeat(auto-fit,minmax(260px,1fr))]
            sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]
            lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]"
        >
          {sortedTiles.map((t) => (
            <div
              key={t.id}
              className={cn(
                // container to allow grid span when screen sharing
                t.isScreenShare && "lg:col-span-2 lg:row-span-2"
              )}
            >
              <VideoTile
                stream={t.stream}
                name={t.name}
                isLocal={t.isLocal}
                isMuted={t.isMuted}
                isVideoOff={t.isVideoOff}
                isHost={t.isHost}
                isSpeaking={t.isSpeaking}
                isScreenShare={t.isScreenShare}
              />
            </div>
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
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            title={isMuted ? "Unmute (Ctrl+D)" : "Mute (Ctrl+D)"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {/* Video On/Off */}
          <Button
            variant={isVideoOff ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12 p-0"
            aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}
            title={isVideoOff ? "Turn on camera (Ctrl+E)" : "Turn off camera (Ctrl+E)"}
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
              aria-label={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
              title={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
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
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
            </Button>
          )}

          {/* Settings */}
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full w-12 h-12 p-0"
            aria-label="Settings"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="w-5 h-5" />
          </Button>

          {/* Leave Call */}
          <Button
            variant="destructive"
            size="lg"
            onClick={handleLeave}
            className="rounded-full w-12 h-12 p-0 ml-4"
            aria-label="Leave call"
            title="Leave call"
          >
            <Phone className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device Settings</DialogTitle>
            <DialogDescription>
              Choose your microphone and camera preferences for this session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Microphone</span>
              <Button size="sm" variant={isMuted ? 'secondary' : 'default'} onClick={toggleMute}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Camera</span>
              <Button size="sm" variant={isVideoOff ? 'secondary' : 'default'} onClick={toggleVideo}>
                {isVideoOff ? 'Turn on' : 'Turn off'}
              </Button>
            </div>
            {isHost && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Screen Share</span>
                <Button size="sm" variant={!isScreenSharing ? 'default' : 'destructive'} onClick={isScreenSharing ? stopScreenShare : startScreenShare}>
                  {isScreenSharing ? 'Stop' : 'Start'}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowSettings(false)} className="ml-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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