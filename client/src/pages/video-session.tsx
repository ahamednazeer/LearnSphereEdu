import React, { useState, useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoCall } from '@/components/video-call';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { authenticatedApiRequest } from '@/lib/auth';
import { 
  Users, 
  MessageSquare, 
  Send, 
  X,
  Clock,
  Calendar,
  User,
  Trash2,
  Video,
  Mic,
  ArrowDown,
  Search,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoSessionData {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  sessionType: 'class' | 'tutoring' | 'meeting';
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  maxParticipants: number;
  courseId?: string;
  courseName?: string;
}

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'co-host' | 'participant';
  isPresent: boolean;
  joinedAt?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  messageType: 'text' | 'system';
}

export default function VideoSession() {
  const [, params] = useRoute('/video-session/:sessionId');
  const sessionId = params?.sessionId;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [joinWithVideo, setJoinWithVideo] = useState(true);
  const [joinWithAudio, setJoinWithAudio] = useState(true);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Fetch session data
  const { data: session, isLoading } = useQuery({
    queryKey: ['video-session', sessionId],
    queryFn: async (): Promise<VideoSessionData> => {
      const response = await authenticatedApiRequest('GET', `/api/video-sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      return response.json();
    },
    enabled: !!sessionId,
  });

  // Fetch participants
  const { data: participants = [] } = useQuery({
    queryKey: ['video-session-participants', sessionId],
    queryFn: async (): Promise<Participant[]> => {
      const response = await authenticatedApiRequest('GET', `/api/video-sessions/${sessionId}/participants`);
      if (!response.ok) throw new Error('Failed to fetch participants');
      return response.json();
    },
    enabled: !!sessionId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch chat messages
  const { data: messages = [] } = useQuery({
    queryKey: ['video-session-messages', sessionId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const response = await authenticatedApiRequest('GET', `/api/video-sessions/${sessionId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!sessionId,
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Join session mutation
  const joinSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest('POST', `/api/video-sessions/${sessionId}/join`, {
        userId: user?.id,
      });
      if (!response.ok) throw new Error('Failed to join session');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-session-participants', sessionId] });
      toast({ title: 'Joined session successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to join session', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await authenticatedApiRequest('POST', `/api/video-sessions/${sessionId}/messages`, {
        senderId: user?.id,
        message,
        messageType: 'text',
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-session-messages', sessionId] });
      setChatMessage('');
    },
  });

  // Leave session mutation
  const leaveSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest('POST', `/api/video-sessions/${sessionId}/leave`, {
        userId: user?.id,
      });
      if (!response.ok) throw new Error('Failed to leave session');
      return response.json();
    },
    onSuccess: () => {
      window.location.href = '/courses';
    },
  });

  // Delete session mutation (for host only)
  const deleteSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest('DELETE', `/api/video-sessions/${sessionId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete session');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'Session deleted', 
        description: 'The live session has been deleted successfully' 
      });
      window.location.href = session?.courseId ? `/courses/${session.courseId}` : '/courses';
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to delete session', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Session duration timer
  useEffect(() => {
    if (session?.status === 'active' && session.startedAt) {
      const interval = setInterval(() => {
        const start = new Date(session.startedAt!).getTime();
        const now = Date.now();
        const duration = Math.floor((now - start) / 1000);
        setSessionDuration(duration);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showChat && !showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // Handle chat scroll
  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            // Toggle mute (would need to expose this from VideoCall)
            break;
          case 'e':
            e.preventDefault();
            // Toggle video (would need to expose this from VideoCall)
            break;
          case 'm':
            e.preventDefault();
            setShowChat(!showChat);
            break;
          case 'p':
            e.preventDefault();
            setShowParticipants(!showParticipants);
            break;
        }
      }
    };

    if (hasJoined) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [hasJoined, showChat, showParticipants]);

  // Simulate connection quality (in real app, this would come from WebRTC stats)
  useEffect(() => {
    const interval = setInterval(() => {
      const random = Math.random();
      if (random > 0.8) setConnectionQuality('poor');
      else if (random > 0.5) setConnectionQuality('fair');
      else setConnectionQuality('good');
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Get camera preview when component mounts (before joining)
  useEffect(() => {
    if (!hasJoined && session) {
      const getPreview = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false, // Don't need audio for preview
          });
          setPreviewStream(stream);
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Failed to get camera preview:', error);
          // User might have denied camera access
        }
      };
      getPreview();
    }

    // Cleanup: stop preview stream when joining or unmounting
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [session, hasJoined]);

  // Update preview video element when stream changes
  useEffect(() => {
    if (previewVideoRef.current && previewStream) {
      previewVideoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessageMutation.mutate(chatMessage.trim());
    }
  };

  const handleLeaveSession = () => {
    leaveSessionMutation.mutate();
  };

  const handleDeleteSession = () => {
    if (window.confirm('Are you sure you want to delete this live session? All participants will be disconnected and this action cannot be undone.')) {
      deleteSessionMutation.mutate();
    }
  };

  const handleJoinSession = () => {
    // Stop preview stream before joining
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    
    joinSessionMutation.mutate();
    setHasJoined(true);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const isHost = session?.hostId === user?.id;
  const currentParticipant = participants.find(p => p.id === user?.id);
  
  // Filter participants based on search
  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(participantSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Card className="w-full max-w-2xl mx-4">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
            <Separator />
            <div className="flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
            </div>
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Card className="p-6 max-w-md">
          <CardContent className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
              <p className="text-gray-600">
                The video session you're looking for doesn't exist or has been removed.
              </p>
            </div>
            <Button onClick={() => window.location.href = '/courses'} className="w-full">
              Back to Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pre-join screen
  if (!hasJoined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">{session.title}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                {session.status}
              </Badge>
              <Badge variant="outline">
                {session.sessionType}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Session Info */}
            <div className="space-y-3">
              {session.description && (
                <div>
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Description
                  </h3>
                  <p className="text-gray-600">{session.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Host
                  </h3>
                  <p className="text-gray-600">{session.hostName}</p>
                </div>
                
                {session.scheduledAt && (
                  <div>
                    <h3 className="font-semibold mb-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Scheduled
                    </h3>
                    <p className="text-gray-600">
                      {new Date(session.scheduledAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {session.courseName && (
                <div>
                  <h3 className="font-semibold mb-1">Course</h3>
                  <p className="text-gray-600">{session.courseName}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Device Preview */}
            <div className="space-y-3">
              <h3 className="font-semibold">Join Settings</h3>
              <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden">
                {previewStream && joinWithVideo ? (
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-white">
                    <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">
                      {!previewStream 
                        ? 'Requesting camera access...' 
                        : 'Camera is off'}
                    </p>
                  </div>
                )}
                
                {/* Preview overlay badges */}
                {previewStream && (
                  <div className="absolute bottom-2 left-2 flex gap-2">
                    {!joinWithVideo && (
                      <Badge className="bg-red-500 text-white">
                        <Video className="w-3 h-3 mr-1" />
                        Video Off
                      </Badge>
                    )}
                    {!joinWithAudio && (
                      <Badge className="bg-red-500 text-white">
                        <Mic className="w-3 h-3 mr-1" />
                        Mic Off
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-4">
                <Button
                  variant={joinWithVideo ? "default" : "outline"}
                  onClick={() => setJoinWithVideo(!joinWithVideo)}
                  className="flex-1"
                >
                  {joinWithVideo ? <Video className="w-4 h-4 mr-2" /> : <Video className="w-4 h-4 mr-2 opacity-50" />}
                  {joinWithVideo ? 'Video On' : 'Video Off'}
                </Button>
                <Button
                  variant={joinWithAudio ? "default" : "outline"}
                  onClick={() => setJoinWithAudio(!joinWithAudio)}
                  className="flex-1"
                >
                  {joinWithAudio ? <Mic className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2 opacity-50" />}
                  {joinWithAudio ? 'Audio On' : 'Audio Off'}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Join Button */}
            <div className="space-y-2">
              <Button 
                onClick={handleJoinSession} 
                className="w-full h-12 text-lg"
                disabled={joinSessionMutation.isPending}
              >
                {joinSessionMutation.isPending ? 'Joining...' : 'Join Session'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = session.courseId ? `/courses/${session.courseId}` : '/courses'}
                className="w-full"
              >
                Cancel
              </Button>
            </div>

            {/* Keyboard Shortcuts Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 text-blue-900">Keyboard Shortcuts</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                <div><kbd className="px-1 py-0.5 bg-white rounded border">Ctrl+M</kbd> Toggle Chat</div>
                <div><kbd className="px-1 py-0.5 bg-white rounded border">Ctrl+P</kbd> Toggle Participants</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Main video area */}
      <div className={cn(
        "flex-1 transition-all duration-300 relative",
        (showChat || showParticipants) ? "mr-80" : ""
      )}>
        {/* Session Status Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-3 items-center">
          {/* Row 1: LIVE badge and Duration timer */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {session.status === 'active' && (
              <Badge className="bg-red-500 text-white animate-pulse shadow-lg w-fit whitespace-nowrap">
                <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                LIVE
              </Badge>
            )}
            
            {sessionDuration > 0 && (
              <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur shadow-lg w-fit whitespace-nowrap">
                <Clock className="w-3 h-3 mr-1" />
                {formatDuration(sessionDuration)}
              </Badge>
            )}
          </div>
          
          {/* Row 2: Connection quality */}
          <Badge 
            variant="secondary" 
            className={cn(
              "backdrop-blur shadow-lg w-fit whitespace-nowrap",
              connectionQuality === 'good' && "bg-green-500/80 text-white",
              connectionQuality === 'fair' && "bg-yellow-500/80 text-white",
              connectionQuality === 'poor' && "bg-red-500/80 text-white"
            )}
          >
            {connectionQuality === 'good' && <Wifi className="w-3 h-3 mr-1" />}
            {connectionQuality !== 'good' && <WifiOff className="w-3 h-3 mr-1" />}
            {connectionQuality === 'good' ? 'Good' : connectionQuality === 'fair' ? 'Fair' : 'Poor'}
          </Badge>
        </div>

        <VideoCall
          sessionId={sessionId!}
          sessionTitle={session.title}
          isHost={isHost}
          initialMuted={!joinWithAudio}
          initialVideoOff={!joinWithVideo}
          onLeave={handleLeaveSession}
          onDelete={isHost ? handleDeleteSession : undefined}
          onToggleChat={() => {
            setShowChat(!showChat);
            setShowParticipants(false);
          }}
          onToggleParticipants={() => {
            setShowParticipants(!showParticipants);
            setShowChat(false);
          }}
        />
      </div>

      {/* Side panel */}
      {(showChat || showParticipants) && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          {/* Panel header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              {showChat ? (
                <>
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Participants ({participants.length})
                </>
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowChat(false);
                setShowParticipants(false);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {showChat ? (
              <div className="flex flex-col h-full">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4" onScrollCapture={handleChatScroll}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                      <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs">Start the conversation!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex flex-col",
                            message.senderId === user?.id ? "items-end" : "items-start"
                          )}
                        >
                          {message.messageType === 'system' ? (
                            <div className="text-center w-full">
                              <Badge variant="secondary" className="text-xs">
                                {message.message}
                              </Badge>
                            </div>
                          ) : (
                            <>
                              <div className="text-xs text-gray-500 mb-1">
                                {message.senderName} • {new Date(message.timestamp).toLocaleTimeString()}
                              </div>
                              <div
                                className={cn(
                                  "max-w-[80%] p-3 rounded-lg text-sm break-words",
                                  message.senderId === user?.id
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 text-gray-900"
                                )}
                              >
                                {message.message}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <div className="absolute bottom-20 right-4">
                    <Button
                      size="sm"
                      onClick={scrollToBottom}
                      className="rounded-full shadow-lg"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Message input */}
                <div className="p-4 border-t border-gray-200">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      autoComplete="off"
                      aria-label="Chat message"
                    />
                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Participant search */}
                {participants.length > 5 && (
                  <div className="p-4 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        placeholder="Search participants..."
                        className="pl-9"
                        aria-label="Search participants"
                      />
                    </div>
                  </div>
                )}

                <ScrollArea className="flex-1 p-4">
                  {filteredParticipants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                      <Users className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm">
                        {participantSearch ? 'No participants found' : 'No participants yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredParticipants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="relative">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {participant.name.charAt(0).toUpperCase()}
                            </div>
                            {participant.isPresent && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {participant.name}
                              {participant.id === user?.id && ' (You)'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Badge
                                variant={participant.role === 'host' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {participant.role}
                              </Badge>
                              {participant.isPresent ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="w-3 h-3" />
                                  Present
                                </span>
                              ) : (
                                <span className="text-gray-400">Away</span>
                              )}
                            </div>
                            {participant.joinedAt && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                Joined {new Date(participant.joinedAt).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}