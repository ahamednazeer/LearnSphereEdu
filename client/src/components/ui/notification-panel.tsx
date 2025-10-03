import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, X, BookOpen, MessageSquare, Award, AlertCircle, Megaphone, FileText, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "course" | "message" | "achievement" | "system" | "announcement" | "assignment" | "grade";
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string;
  actionUrl?: string;
  relatedId?: string;
  relatedType?: string;
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await authenticatedApiRequest('/api/protected/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await authenticatedApiRequest(`/api/protected/notifications/${id}/read`, {
        method: 'PUT',
      });
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest('/api/protected/notifications/read-all', {
        method: 'PUT',
      });
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await authenticatedApiRequest(`/api/protected/notifications/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  const markAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const markAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const removeNotification = (id: string) => {
    deleteNotificationMutation.mutate(id);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case "course":
        return <BookOpen className="w-4 h-4" />;
      case "message":
        return <MessageSquare className="w-4 h-4" />;
      case "achievement":
        return <Award className="w-4 h-4" />;
      case "system":
        return <AlertCircle className="w-4 h-4" />;
      case "announcement":
        return <Megaphone className="w-4 h-4" />;
      case "assignment":
        return <FileText className="w-4 h-4" />;
      case "grade":
        return <GraduationCap className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case "course":
        return "text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300";
      case "message":
        return "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300";
      case "achievement":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300";
      case "system":
        return "text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300";
      case "announcement":
        return "text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300";
      case "assignment":
        return "text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300";
      case "grade":
        return "text-emerald-600 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const formatTimestamp = (createdAt: string) => {
    const timestamp = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
      return "Just now";
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-xs"
                  disabled={markAllAsReadMutation.isPending}
                >
                  {markAllAsReadMutation.isPending ? "Marking..." : "Mark all read"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p>Loading notifications...</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Failed to load notifications</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification: Notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
                        !notification.isRead && "bg-primary/5"
                      )}
                      onClick={() => {
                        if (notification.actionUrl) {
                          window.location.href = notification.actionUrl;
                        }
                        if (!notification.isRead) {
                          markAsRead(notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          getNotificationColor(notification.type)
                        )}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={cn(
                              "text-sm font-medium",
                              !notification.isRead && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            <div className="flex items-center space-x-1">
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="w-6 h-6 p-0"
                                  disabled={markAsReadMutation.isPending}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNotification(notification.id);
                                }}
                                className="w-6 h-6 p-0 text-muted-foreground hover:text-destructive"
                                disabled={deleteNotificationMutation.isPending}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatTimestamp(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}