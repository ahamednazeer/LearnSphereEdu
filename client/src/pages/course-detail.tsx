import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, Users, FileText, MessageCircle, 
  Plus, Download, Calendar, Clock 
} from "lucide-react";

export default function CourseDetail() {
  const [match] = useRoute("/courses/:id");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
  });

  const courseId = match?.id;

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["/api/protected/courses", courseId],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}`);
      return response.json();
    },
    enabled: !!courseId,
  });

  const { data: assessments = [], isLoading: assessmentsLoading } = useQuery({
    queryKey: ["/api/protected/courses", courseId, "assessments"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}/assessments`);
      return response.json();
    },
    enabled: !!courseId,
  });

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ["/api/protected/courses", courseId, "announcements"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}/announcements`);
      return response.json();
    },
    enabled: !!courseId,
  });

  const { data: discussions = [], isLoading: discussionsLoading } = useQuery({
    queryKey: ["/api/protected/courses", courseId, "discussions"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}/discussions`);
      return response.json();
    },
    enabled: !!courseId,
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (announcementData: any) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/announcements`, announcementData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses", courseId, "announcements"] });
      setIsAnnouncementDialogOpen(false);
      setNewAnnouncement({ title: "", content: "" });
      toast({
        title: "Announcement created!",
        description: "Your announcement has been posted to the course.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create announcement",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    createAnnouncementMutation.mutate(newAnnouncement);
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

  if (courseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Course not found</h3>
            <p className="text-muted-foreground mb-4">The course you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation("/courses")} data-testid="button-back-to-courses">
              Back to Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Course Header */}
      <div className="hero-gradient text-white rounded-lg p-8 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30">
              {course.subject}
            </Badge>
            <h1 className="text-3xl font-bold mb-2" data-testid="course-title">{course.title}</h1>
            <p className="text-xl text-white/90 mb-4">{course.description}</p>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span>24 students enrolled</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>Created {new Date(course.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          {user?.role === "teacher" && course.teacherId === user.id && (
            <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" data-testid="button-create-announcement">
                  <Plus className="w-4 h-4 mr-2" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                  <DialogDescription>
                    Share important information with your students
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div>
                    <Label htmlFor="announcement-title">Title</Label>
                    <Input
                      id="announcement-title"
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Announcement title"
                      required
                      data-testid="input-announcement-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="announcement-content">Content</Label>
                    <Textarea
                      id="announcement-content"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Announcement content"
                      rows={4}
                      required
                      data-testid="textarea-announcement-content"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAnnouncementDialogOpen(false)}
                      data-testid="button-cancel-announcement"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createAnnouncementMutation.isPending}
                      data-testid="button-submit-announcement"
                    >
                      {createAnnouncementMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Course Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="materials" data-testid="tab-materials">Materials</TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
          <TabsTrigger value="discussions" data-testid="tab-discussions">Discussions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Announcements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="w-5 h-5 mr-2" />
                Recent Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {announcementsLoading ? (
                <div className="text-center py-4">Loading announcements...</div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No announcements yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border-l-4 border-primary pl-4 py-2">
                      <h4 className="font-medium text-foreground">{announcement.title}</h4>
                      <p className="text-muted-foreground text-sm mt-1">{announcement.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(announcement.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-foreground">24</h3>
                <p className="text-muted-foreground">Students Enrolled</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="w-8 h-8 text-secondary mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-foreground">{assessments.length}</h3>
                <p className="text-muted-foreground">Assessments</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <MessageCircle className="w-8 h-8 text-accent mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-foreground">{discussions.length}</h3>
                <p className="text-muted-foreground">Discussions</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="materials" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Course Materials</CardTitle>
              <CardDescription>Resources and files for this course</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No materials uploaded yet</p>
                {user?.role === "teacher" && course.teacherId === user.id && (
                  <Button className="mt-4" variant="outline" data-testid="button-upload-materials">
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Materials
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="assessments" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-foreground">Assessments</h2>
            {user?.role === "teacher" && course.teacherId === user.id && (
              <Button onClick={() => setLocation(`/assessments/create?courseId=${courseId}`)} data-testid="button-create-assessment">
                <Plus className="w-4 h-4 mr-2" />
                Create Assessment
              </Button>
            )}
          </div>
          
          {assessmentsLoading ? (
            <div className="text-center py-4">Loading assessments...</div>
          ) : assessments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">No assessments yet</h3>
                <p className="text-muted-foreground">
                  {user?.role === "teacher" ? "Create your first assessment to test student knowledge." : "Check back later for new assessments."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {assessments.map((assessment: any) => (
                <Card 
                  key={assessment.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setLocation(`/assessments/${assessment.id}`)}
                  data-testid={`assessment-card-${assessment.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-2">{assessment.title}</h3>
                        {assessment.description && (
                          <p className="text-muted-foreground text-sm mb-3">{assessment.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            <span>{assessment.timeLimit ? `${assessment.timeLimit} minutes` : "No time limit"}</span>
                          </div>
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-1" />
                            <span>{assessment.totalPoints} points</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <Badge variant={assessment.status === "published" ? "default" : "secondary"}>
                          {assessment.status}
                        </Badge>
                        {assessment.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Due: {new Date(assessment.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="discussions" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-foreground">Discussions</h2>
            <Button onClick={() => setLocation(`/discussions/create?courseId=${courseId}`)} data-testid="button-create-discussion">
              <Plus className="w-4 h-4 mr-2" />
              New Discussion
            </Button>
          </div>
          
          {discussionsLoading ? (
            <div className="text-center py-4">Loading discussions...</div>
          ) : discussions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">No discussions yet</h3>
                <p className="text-muted-foreground">Start a discussion to engage with your classmates.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {discussions.map((discussion: any) => (
                <Card 
                  key={discussion.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setLocation(`/discussions/${discussion.id}`)}
                  data-testid={`discussion-card-${discussion.id}`}
                >
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-2">{discussion.title}</h3>
                    {discussion.description && (
                      <p className="text-muted-foreground text-sm mb-3">{discussion.description}</p>
                    )}
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Started {new Date(discussion.createdAt).toLocaleDateString()}</span>
                      <span>0 replies</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
