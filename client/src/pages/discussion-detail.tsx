import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, ArrowLeft, Send, Calendar, 
  MessageSquare, Reply, Users, BookOpen 
} from "lucide-react";

export default function DiscussionDetail() {
  const { user } = useAuth();
  const [match, params] = useRoute("/discussions/:id");
  const discussionId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newPost, setNewPost] = useState("");

  // Get discussion details
  const { data: discussion, isLoading: discussionLoading, error: discussionError } = useQuery({
    queryKey: ["/api/protected/discussions", discussionId],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/discussions/${discussionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch discussion");
      }
      return response.json();
    },
    enabled: !!discussionId,
  });

  // Get discussion posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["/api/protected/discussions", discussionId, "posts"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/discussions/${discussionId}/posts`);
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      return response.json();
    },
    enabled: !!discussionId,
  });

  // Get course details for context
  const { data: course } = useQuery({
    queryKey: ["/api/protected/courses", discussion?.courseId],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${discussion.courseId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch course");
      }
      return response.json();
    },
    enabled: !!discussion?.courseId,
  });

  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/discussions/${discussionId}/posts`, {
        content,
      });
      if (!response.ok) {
        throw new Error("Failed to create post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/discussions", discussionId, "posts"] });
      setNewPost("");
      toast({
        title: "Post added!",
        description: "Your reply has been posted to the discussion.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to post reply",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim()) {
      toast({
        title: "Please enter a message",
        description: "Your post cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    createPostMutation.mutate(newPost);
  };

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      Mathematics: "bg-primary/10 text-primary",
      "Computer Science": "bg-secondary/10 text-secondary",
      Physics: "bg-accent/10 text-accent",
      History: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      Biology: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      Chemistry: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      default: "bg-muted text-muted-foreground",
    };
    return colors[subject] || colors.default;
  };

  if (discussionLoading || postsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (discussionError || !discussion) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Discussion not found
            </h3>
            <p className="text-muted-foreground mb-4">
              The discussion you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/discussions")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Discussions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/discussions")}
          className="flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Discussions
        </Button>
      </div>

      {/* Discussion Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            {course && (
              <Badge variant="secondary" className={getSubjectColor(course.subject)}>
                <BookOpen className="w-3 h-3 mr-1" />
                {course.title}
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl">{discussion.title}</CardTitle>
          {discussion.description && (
            <CardDescription className="text-base mt-2">
              {discussion.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs">
                    {discussion.createdByUsername ? 
                      discussion.createdByUsername.slice(0, 2).toUpperCase() : 
                      discussion.createdBy?.slice(-2).toUpperCase()
                    }
                  </AvatarFallback>
                </Avatar>
                <span>Started by {discussion.createdByUsername || 'User'}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>{new Date(discussion.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Reply className="w-4 h-4 mr-1" />
                <span>{posts.length} replies</span>
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span>{new Set([discussion.createdBy, ...posts.map((p: any) => p.authorId)]).size} participants</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      <div className="space-y-4 mb-6">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No replies yet
              </h3>
              <p className="text-muted-foreground">
                Be the first to reply to this discussion.
              </p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post: any, index: number) => (
            <Card key={post.id}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-sm">
                      {post.authorUsername ? 
                        post.authorUsername.slice(0, 2).toUpperCase() : 
                        post.authorId?.slice(-2).toUpperCase()
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-sm">{post.authorUsername || 'User'}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {post.content}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Reply Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a Reply</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreatePost} className="space-y-4">
            <Textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Write your reply..."
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={createPostMutation.isPending || !newPost.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                {createPostMutation.isPending ? "Posting..." : "Post Reply"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}