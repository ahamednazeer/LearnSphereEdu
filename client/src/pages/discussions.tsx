import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useLocation, useSearch, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, Plus, Search, Users, Calendar, 
  MessageSquare, Reply, BookOpen 
} from "lucide-react";

export default function Discussions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [match] = useRoute("/discussions/create");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const [newDiscussion, setNewDiscussion] = useState({
    title: "",
    description: "",
    courseId: "",
  });

  // Parse courseId from URL params if creating from course detail
  const courseIdFromUrl = new URLSearchParams(searchParams).get('courseId');
  const isCreateRoute = match;

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["/api/protected/courses"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses");
      return response.json();
    },
  });

  const { data: allDiscussions = [], isLoading: discussionsLoading } = useQuery({
    queryKey: ["/api/protected/discussions"],
    queryFn: async () => {
      console.log('Fetching discussions for courses:', courses.map(c => ({ id: c.id, title: c.title })));
      // Get discussions from all enrolled/taught courses
      const coursePromises = courses.map((course: any) => 
        authenticatedApiRequest("GET", `/api/protected/courses/${course.id}/discussions`)
          .then(response => response.json())
          .then(discussions => {
            console.log(`Discussions for course ${course.title}:`, discussions);
            return discussions.map((discussion: any) => ({
              ...discussion,
              courseName: course.title,
              courseSubject: course.subject,
            }));
          })
      );
      const discussionArrays = await Promise.all(coursePromises);
      const allDiscussions = discussionArrays.flat();
      console.log('All discussions fetched:', allDiscussions);
      return allDiscussions;
    },
    enabled: courses.length > 0,
  });

  const createDiscussionMutation = useMutation({
    mutationFn: async (discussionData: any) => {
      console.log('Creating discussion:', discussionData);
      const { courseId, ...data } = discussionData;
      const payload = {
        ...data,
        createdBy: user?.id,
      };
      console.log('Discussion payload:', payload);
      
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/discussions`, payload);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create discussion' }));
        console.error('Discussion creation failed:', errorData);
        throw new Error(errorData.message || 'Failed to create discussion');
      }
      
      const result = await response.json();
      console.log('Discussion created successfully:', result);
      return result;
    },
    onSuccess: (newDiscussion) => {
      // Invalidate both the general discussions query and course-specific queries
      queryClient.invalidateQueries({ queryKey: ["/api/protected/discussions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] });
      
      // Force refetch of discussions after a short delay to ensure the new discussion appears
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/protected/discussions"] });
      }, 100);
      
      setIsCreateDialogOpen(false);
      setNewDiscussion({ title: "", description: "", courseId: "" });
      if (isCreateRoute) {
        setLocation('/discussions');
      }
      toast({
        title: "Discussion created!",
        description: "Your discussion topic has been posted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create discussion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateDiscussion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscussion.courseId) {
      toast({
        title: "Please select a course",
        description: "You must select a course for this discussion.",
        variant: "destructive",
      });
      return;
    }
    createDiscussionMutation.mutate(newDiscussion);
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

  const filteredDiscussions = allDiscussions
    .filter((discussion: any) => 
      selectedCourse === "all" || discussion.courseId === selectedCourse
    )
    .filter((discussion: any) =>
      discussion.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discussion.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discussion.courseName.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Set initial course from URL if available and handle create route
  useEffect(() => {
    if (isCreateRoute) {
      setIsCreateDialogOpen(true);
      if (courseIdFromUrl && courses.length > 0) {
        setNewDiscussion(prev => ({ ...prev, courseId: courseIdFromUrl }));
      }
    }
  }, [isCreateRoute, courseIdFromUrl, courses.length]);

  // Handle dialog close to navigate back to discussions
  const handleDialogClose = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open && isCreateRoute) {
      setLocation('/discussions');
    }
  };

  if (coursesLoading || discussionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Discussions</h1>
          <p className="text-muted-foreground mt-2">
            Engage with your classmates and instructors in course discussions
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-discussion">
              <Plus className="w-4 h-4 mr-2" />
              New Discussion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Start New Discussion</DialogTitle>
              <DialogDescription>
                Create a discussion topic for your course
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateDiscussion} className="space-y-4">
              <div>
                <Label htmlFor="course">Course</Label>
                <Select 
                  value={newDiscussion.courseId} 
                  onValueChange={(value) => setNewDiscussion(prev => ({ ...prev, courseId: value }))}
                >
                  <SelectTrigger data-testid="select-discussion-course">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course: any) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Discussion Title</Label>
                <Input
                  id="title"
                  value={newDiscussion.title}
                  onChange={(e) => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter discussion title"
                  required
                  data-testid="input-discussion-title"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newDiscussion.description}
                  onChange={(e) => setNewDiscussion(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the discussion topic"
                  rows={4}
                  data-testid="textarea-discussion-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => handleDialogClose(false)}
                  data-testid="button-cancel-discussion"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDiscussionMutation.isPending}
                  data-testid="button-submit-discussion"
                >
                  {createDiscussionMutation.isPending ? "Creating..." : "Create Discussion"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search discussions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-discussions"
          />
        </div>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-filter-course">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((course: any) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Discussions List */}
      {filteredDiscussions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm || selectedCourse !== "all"
                ? "No discussions found"
                : "No discussions yet"
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedCourse !== "all"
                ? "Try adjusting your search or filter"
                : "Start the conversation by creating the first discussion."
              }
            </p>
            {!searchTerm && selectedCourse === "all" && (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-discussion">
                Create First Discussion
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDiscussions.map((discussion: any) => (
            <Card 
              key={discussion.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`/discussions/${discussion.id}`)}
              data-testid={`discussion-card-${discussion.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="secondary" className={getSubjectColor(discussion.courseSubject)}>
                        {discussion.courseName}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {discussion.title}
                    </h3>
                    {discussion.description && (
                      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                        {discussion.description}
                      </p>
                    )}
                  </div>
                  <MessageSquare className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {discussion.createdBy?.slice(-2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>Started by User</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{new Date(discussion.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <Reply className="w-4 h-4 mr-1" />
                      <span>0 replies</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      <span>1 participant</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Active Discussions Summary */}
      {filteredDiscussions.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-8 h-8 text-primary mx-auto mb-2" />
              <h3 className="text-2xl font-bold text-foreground">{filteredDiscussions.length}</h3>
              <p className="text-muted-foreground">Active Discussions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <BookOpen className="w-8 h-8 text-secondary mx-auto mb-2" />
              <h3 className="text-2xl font-bold text-foreground">{courses.length}</h3>
              <p className="text-muted-foreground">Courses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-accent mx-auto mb-2" />
              <h3 className="text-2xl font-bold text-foreground">24</h3>
              <p className="text-muted-foreground">Participants</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
