import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Users, Plus, Search } from "lucide-react";

export default function Courses() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    subject: "",
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["/api/protected/courses"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses");
      return response.json();
    },
  });

  const { data: allCourses = [], isLoading: allCoursesLoading } = useQuery({
    queryKey: ["/api/protected/courses/all"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses/all");
      return response.json();
    },
    enabled: user?.role === "student",
  });

  const createCourseMutation = useMutation({
    mutationFn: async (courseData: any) => {
      const response = await authenticatedApiRequest("POST", "/api/protected/courses", courseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] });
      setIsCreateDialogOpen(false);
      setNewCourse({ title: "", description: "", subject: "" });
      toast({
        title: "Course created successfully!",
        description: "Your new course is now available.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/enroll`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] });
      toast({
        title: "Enrolled successfully!",
        description: "You can now access this course.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enrollment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    createCourseMutation.mutate(newCourse);
  };

  const handleEnroll = (courseId: string) => {
    enrollMutation.mutate(courseId);
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

  const filteredCourses = (user?.role === "student" ? allCourses : courses).filter((course: any) =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading || (user?.role === "student" && allCoursesLoading)) {
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
          <h1 className="text-3xl font-bold text-foreground">
            {user?.role === "teacher" ? "My Courses" : "Courses"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {user?.role === "teacher" 
              ? "Manage your courses and track student progress"
              : "Discover and enroll in courses to expand your knowledge"
            }
          </p>
        </div>
        
        {user?.role === "teacher" && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-course">
                <Plus className="w-4 h-4 mr-2" />
                Create Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Course</DialogTitle>
                <DialogDescription>
                  Add a new course to your teaching portfolio
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <Label htmlFor="title">Course Title</Label>
                  <Input
                    id="title"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter course title"
                    required
                    data-testid="input-course-title"
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Select 
                    value={newCourse.subject} 
                    onValueChange={(value) => setNewCourse(prev => ({ ...prev, subject: value }))}
                  >
                    <SelectTrigger data-testid="select-course-subject">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="Computer Science">Computer Science</SelectItem>
                      <SelectItem value="Physics">Physics</SelectItem>
                      <SelectItem value="History">History</SelectItem>
                      <SelectItem value="Biology">Biology</SelectItem>
                      <SelectItem value="Chemistry">Chemistry</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newCourse.description}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your course"
                    rows={3}
                    required
                    data-testid="textarea-course-description"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createCourseMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-courses"
          />
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm 
                ? "No courses found"
                : user?.role === "teacher" 
                  ? "No courses created yet" 
                  : "No courses available"
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Try adjusting your search terms"
                : user?.role === "teacher" 
                  ? "Create your first course to get started teaching."
                  : "Check back later for new courses."
              }
            </p>
            {!searchTerm && user?.role === "teacher" && (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-course">
                Create Your First Course
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course: any) => {
            const isEnrolled = user?.role === "student" && courses.some((c: any) => c.id === course.id);
            
            return (
              <Card 
                key={course.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/courses/${course.id}`)}
                data-testid={`course-card-${course.id}`}
              >
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg"></div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className={getSubjectColor(course.subject)}>
                      {course.subject}
                    </Badge>
                    {isEnrolled && (
                      <Badge variant="default">Enrolled</Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{course.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="w-4 h-4 mr-1" />
                      <span>
                        {user?.role === "teacher" 
                          ? "24 students" 
                          : `Instructor: ${course.teacherId?.slice(-6)}`
                        }
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      {user?.role === "student" && !isEnrolled && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnroll(course.id);
                          }}
                          disabled={enrollMutation.isPending}
                          data-testid={`button-enroll-${course.id}`}
                        >
                          {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant={isEnrolled || user?.role === "teacher" ? "default" : "outline"}
                        data-testid={`button-view-${course.id}`}
                      >
                        {user?.role === "teacher" ? "Manage" : "View"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
