import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoCall } from '@/components/video-call';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
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

  // Auto-join session when component mounts
  useEffect(() => {
    if (session && user) {
      joinSessionMutation.mutate();
    }
  }, [session, user]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessageMutation.mutate(chatMessage.trim());
    }
  };

  const handleLeaveSession = () => {
    leaveSessionMutation.mutate();
  };

  const isHost = session?.hostId === user?.id;
  const currentParticipant = participants.find(p => p.id === user?.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-6 max-w-md">
          <CardContent className="text-center">
            <p className="text-red-500 mb-4">Session not found</p>
            <Button onClick={() => window.location.href = '/courses'}>
              Back to Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Main video area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        (showChat || showParticipants) ? "mr-80" : ""
      )}>
        <VideoCall
          sessionId={sessionId!}
          sessionTitle={session.title}
          isHost={isHost}
          onLeave={handleLeaveSession}
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
                <ScrollArea className="flex-1 p-4">
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
                                "max-w-[80%] p-3 rounded-lg text-sm",
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
                  </div>
                </ScrollArea>

                {/* Message input */}
                <div className="p-4 border-t border-gray-200">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                    />
                    <Button type="submit" size="sm" disabled={!chatMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <ScrollArea className="p-4">
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{participant.name}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge
                            variant={participant.role === 'host' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {participant.role}
                          </Badge>
                          {participant.isPresent ? (
                            <span className="text-green-600">Present</span>
                          ) : (
                            <span className="text-gray-400">Away</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
}