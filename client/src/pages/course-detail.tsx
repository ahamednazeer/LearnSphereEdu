import { useState, useRef, useEffect } from "react";
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
  Plus, Download, Calendar, Clock, Edit, Trash2 
} from "lucide-react";
import { ShareButton } from "@/components/share-button";
import CourseBuilder from "@/components/course-builder/CourseBuilder";
// @ts-ignore
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// QuizBuilder component for inline quiz creation
function QuizBuilder({ quiz, onChange }: { quiz: any[]; onChange: (quiz: any[]) => void }) {
  // quiz: [{ question: string, options: string[], answer: number }]
  const addQuestion = () => onChange([...quiz, { question: "", options: ["", "", "", ""], answer: 0 }]);
  const updateQuestion = (idx: number, field: string, value: any) => {
    const newQuiz = quiz.map((q, i) => i === idx ? { ...q, [field]: value } : q);
    onChange(newQuiz);
  };
  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const newQuiz = quiz.map((q, i) => i === qIdx ? { ...q, options: q.options.map((opt: string, j: number) => j === oIdx ? value : opt) } : q);
    onChange(newQuiz);
  };
  const setAnswer = (qIdx: number, aIdx: number) => {
    const newQuiz = quiz.map((q, i) => i === qIdx ? { ...q, answer: aIdx } : q);
    onChange(newQuiz);
  };
  const removeQuestion = (idx: number) => {
    const newQuiz = quiz.filter((_, i) => i !== idx);
    onChange(newQuiz);
  };
  return (
    <div className="bg-muted p-2 rounded mt-2">
      <div className="font-semibold mb-2">Quiz Questions</div>
      {quiz.map((q, qIdx) => (
        <div key={qIdx} className="mb-4 border-b pb-2">
          <Input
            placeholder={`Question ${qIdx + 1}`}
            value={q.question}
            onChange={e => updateQuestion(qIdx, "question", e.target.value)}
            className="mb-2"
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            {q.options.map((opt: string, oIdx: number) => (
              <div key={oIdx} className="flex items-center gap-1">
                <input
                  type="radio"
                  name={`answer-${qIdx}`}
                  checked={q.answer === oIdx}
                  onChange={() => setAnswer(qIdx, oIdx)}
                />
                <Input
                  placeholder={`Option ${oIdx + 1}`}
                  value={opt}
                  onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                />
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => removeQuestion(qIdx)}>
            Remove Question
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" onClick={addQuestion}>
        + Add Question
      </Button>
    </div>
  );
}

export default function CourseDetail() {
  const [match, params] = useRoute("/courses/:id");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    subject: "",
    objectives: "",
    category: "",
    targetAudience: "",
    duration: ""
  });

  // Course Builder State
  const [builderStep, setBuilderStep] = useState(1);
  const [courseData, setCourseData] = useState({
    title: "",
    description: "",
    objectives: "",
    category: "",
    targetAudience: "beginner",
    duration: "",
    thumbnail: null as File | null,
  });
  type Lesson = { title: string; contentType: string; url: string; quiz: any[] };
  type Module = { title: string; lessons: Lesson[] };
  const [builderModules, setBuilderModules] = useState<Module[]>([
    { title: "", lessons: [{ title: "", contentType: "video", url: "", quiz: [] }] }
  ]);
  const [saving, setSaving] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const builderFileRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Upload Materials
  const handleUploadMaterials = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Please select a file.");
      setUploading(false);
      return;
    }
    if (!selectedLessonId) {
      setUploadError("Please select a lesson.");
      setUploading(false);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await authenticatedApiRequest(
        "POST",
        `/api/protected/lessons/${selectedLessonId}/upload`,
        formData
      );
      if (!response.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses", courseId, "materials"] });
      setIsUploadDialogOpen(false);
      toast({ title: "Material uploaded!", description: "Your file has been uploaded." });
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Course Builder Handlers
  const handleCourseInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseData.title || !courseData.description || !courseData.objectives || !courseData.category || !courseData.targetAudience || !courseData.duration || !courseData.thumbnail) {
      setBuilderError("Please fill all required fields.");
      return;
    }
    setBuilderStep(2);
  };

  const handleAddModule = () => {
    setBuilderModules([
      ...builderModules,
      { title: "", lessons: [{ title: "", contentType: "video", url: "", quiz: [] }] }
    ]);
  };

  const handleAddLesson = (modIdx: number) => {
    const newModules = [...builderModules];
    newModules[modIdx].lessons.push({
      title: "",
      contentType: "video",
      url: "",
      quiz: [],
    });
    setBuilderModules(newModules);
  };

  const handleSaveCourse = async () => {
    try {
      if (!user) {
        setBuilderError("You must be logged in to create a course");
        setLocation('/login');
        return;
      }

      if (user.role !== 'teacher') {
        setBuilderError("Only teachers can create courses");
        return;
      }

      if (!courseData.title || !courseData.description || !courseData.category) {
        setBuilderError("Please fill in all required fields");
        return;
      }

      setSaving(true);
      setBuilderError(null);

      const newCourseData = {
        title: courseData.title,
        subject: courseData.category,
        description: courseData.description,
        objectives: courseData.objectives,
        targetAudience: courseData.targetAudience,
        duration: courseData.duration,
        teacherId: user.id,
      };

      const courseRes = await authenticatedApiRequest("POST", "/api/protected/courses", newCourseData);
      if (!courseRes.ok) {
        const errorData = await courseRes.json();
        throw new Error(errorData.message || "Failed to create course");
      }

      const createdCourse = await courseRes.json();

      if (courseData.thumbnail) {
        const formData = new FormData();
        formData.append('thumbnail', courseData.thumbnail);
        
        const thumbnailRes = await authenticatedApiRequest(
          "POST", 
          `/api/protected/courses/${createdCourse.id}/thumbnail`,
          formData
        );
        
        if (!thumbnailRes.ok) {
          console.error('Thumbnail upload failed');
        }
      }

      const courseId = createdCourse.id;

      for (let index = 0; index < builderModules.length; index++) {
        const mod = builderModules[index];
        if (!mod.title) {
          throw new Error(`Module ${index + 1} is missing a title`);
        }
        
        const moduleData = {
          title: mod.title,
          sequenceOrder: index,
          courseId: courseId,
        };

        const modRes = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/modules`, moduleData);
        
        if (!modRes.ok) {
          const errorData = await modRes.json();
          throw new Error(errorData.message || "Failed to create module");
        }
        
        const createdModule = await modRes.json();
        const moduleId = createdModule.id;
        
        for (let lessonIndex = 0; lessonIndex < mod.lessons.length; lessonIndex++) {
          const lesson = mod.lessons[lessonIndex];
          
          const lessonData = {
            title: lesson.title,
            contentType: lesson.contentType,
            url: lesson.url || "",
            sequenceOrder: lessonIndex,
            moduleId: moduleId,
          };

          const lesRes = await authenticatedApiRequest("POST", `/api/protected/modules/${moduleId}/lessons`, lessonData);
          
          if (!lesRes.ok) {
            const errorData = await lesRes.json();
            throw new Error(errorData.message || "Failed to create lesson");
          }
        }
      }
      setCreatedCourseId(courseId);
      setBuilderStep(3);
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] });
    } catch (err: any) {
      setBuilderError(err.message || "Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!createdCourseId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await authenticatedApiRequest("POST", `/api/protected/courses/${createdCourseId}/publish`);
      if (!res.ok) throw new Error("Failed to publish course");
      setLocation("/courses");
      toast({ title: "Course published!", description: "Your course is now live." });
    } catch (err: any) {
      setPublishError(err.message || "Failed to publish course");
    } finally {
      setPublishing(false);
    }
  };

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
  });

  const [isCreateDiscussionDialogOpen, setIsCreateDiscussionDialogOpen] = useState(false);
  const [newDiscussion, setNewDiscussion] = useState({
    title: "",
    description: "",
  });

  const courseId = params?.id;

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
      console.log(`[Course Detail] Fetching discussions for course ${courseId}`);
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}/discussions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch discussions: ${response.status}`);
      }
      const data = await response.json();
      console.log(`[Course Detail] Fetched ${data.length} discussions for course ${courseId}:`, data.map(d => ({ id: d.id, title: d.title })));
      return data;
    },
    enabled: !!courseId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 3, // Retry failed requests up to 3 times
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["/api/protected/courses", courseId, "modules"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}/modules`);
      return response.json();
    },
    enabled: !!courseId,
  });

  const markLessonCompleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/lessons/${lessonId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses", courseId, "modules"] });
      toast({ title: "Lesson completed!", description: "Your progress has been saved." });
    },
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

  // Add a mutation to handle discussion creation from course detail page
  const createDiscussionMutation = useMutation({
    mutationFn: async (discussionData: any) => {
      const payload = {
        ...discussionData,
        createdBy: user?.id,
      };
      
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/discussions`, payload);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create discussion' }));
        throw new Error(errorData.message || 'Failed to create discussion');
      }
      
      return response.json();
    },
    onSuccess: async (newDiscussion) => {
      console.log(`[Course Detail] Discussion created successfully:`, { 
        id: newDiscussion.id, 
        title: newDiscussion.title, 
        courseId 
      });
      
      try {
        // Invalidate all discussion-related queries
        await Promise.all([
          // Invalidate the main discussions query (used by discussions page)
          queryClient.invalidateQueries({ queryKey: ["/api/protected/discussions"] }),
          // Invalidate the courses query (which the discussions query depends on)
          queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] }),
          // Invalidate this course's discussions query
          queryClient.invalidateQueries({ 
            queryKey: ["/api/protected/courses", courseId, "discussions"] 
          }),
          // Invalidate any other course discussion queries
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const queryKey = query.queryKey as string[];
              return queryKey.length >= 3 && 
                     queryKey[0] === "/api/protected/courses" && 
                     queryKey[2] === "discussions";
            }
          })
        ]);

        // Force refetch to ensure immediate updates
        await Promise.all([
          queryClient.refetchQueries({ 
            predicate: (query) => {
              const queryKey = query.queryKey as string[];
              return queryKey.length >= 1 && queryKey[0] === "/api/protected/discussions";
            }
          }),
          queryClient.refetchQueries({ 
            queryKey: ["/api/protected/courses", courseId, "discussions"] 
          }),
          // Also refetch the courses query to ensure fresh data
          queryClient.refetchQueries({ queryKey: ["/api/protected/courses"] })
        ]);

        // Additional aggressive cache clearing for discussions
        queryClient.removeQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey as string[];
            return queryKey.length >= 1 && queryKey[0] === "/api/protected/discussions";
          }
        });
        
        console.log(`[Course Detail] Query invalidation completed for discussion ${newDiscussion.id}`);
      } catch (error) {
        console.error("Error invalidating queries after discussion creation:", error);
      }
      
      // Reset dialog state
      setIsCreateDiscussionDialogOpen(false);
      setNewDiscussion({ title: "", description: "" });
      
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
    if (!courseId) {
      toast({
        title: "Error",
        description: "Course ID is missing.",
        variant: "destructive",
      });
      return;
    }
    createDiscussionMutation.mutate({
      ...newDiscussion,
      courseId,
    });
  };

  const updateCourseMutation = useMutation({
    mutationFn: async (courseData: any) => {
      const response = await authenticatedApiRequest("PUT", `/api/protected/courses/${courseId}`, courseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses", courseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Course updated!",
        description: "Your course has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest("DELETE", `/api/protected/courses/${courseId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Course deleted!",
        description: "Your course has been successfully deleted.",
      });
      setLocation("/courses");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    createAnnouncementMutation.mutate(newAnnouncement);
  };

  const handleEditCourse = () => {
    if (course) {
      setEditFormData({
        title: course.title || "",
        description: course.description || "",
        subject: course.subject || "",
        objectives: course.objectives || "",
        category: course.category || "",
        targetAudience: course.targetAudience || "",
        duration: course.duration || ""
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    updateCourseMutation.mutate(editFormData);
  };

  const handleDeleteCourse = () => {
    deleteCourseMutation.mutate();
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
            <div className="flex gap-2 mb-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {course.subject}
              </Badge>
              {user?.role === "teacher" && course.teacherId === user.id && (
                <Badge 
                  variant={course.status === "published" ? "default" : "secondary"}
                  className={course.status === "published" 
                    ? "bg-green-500/20 text-green-100 border-green-400/30" 
                    : "bg-yellow-500/20 text-yellow-100 border-yellow-400/30"
                  }
                >
                  {course.status === "published" ? "Published" : "Draft"}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2" data-testid="course-title">{course.title}</h1>
            <div 
              className="text-xl text-white/90 mb-4 prose prose-lg max-w-none dark:prose-invert prose-p:text-white/90 prose-strong:text-white prose-em:text-white/90"
              dangerouslySetInnerHTML={{ __html: course.description }}
            />
            <div className="flex items-center space-x-4 text-sm">
              {/* Only show student count if available from backend */}
              {typeof course.studentCount === "number" && (
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{course.studentCount} students enrolled</span>
                </div>
              )}
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>Created {new Date(course.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <ShareButton 
              title={`Check out this course: ${course.title}`}
              description={course.description?.replace(/<[^>]*>/g, '') || `Learn ${course.subject} with this comprehensive course.`}
              variant="outline"
              size="default"
            />
            {user?.role === "student" && course.isEnrolled && (
              <Button 
                variant="default"
                onClick={() => setLocation(`/courses/${course.id}/learn`)}
                data-testid="button-start-learning"
              >
                Start Learning
              </Button>
            )}
            {user?.role === "teacher" && course.teacherId === user.id && (
              <>
                <Button 
                  variant={course.status === "published" ? "outline" : "default"}
                  onClick={() => setLocation(`/courses/${course.id}/preview`)}
                  data-testid="button-preview-course"
                >
                  {course.status === "published" ? "Preview Course" : "Preview & Publish"}
                </Button>
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
              <Button 
                variant="outline" 
                onClick={handleEditCourse}
                data-testid="button-edit-course"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Course
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setIsDeleteDialogOpen(true)}
                data-testid="button-delete-course"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Course
              </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Course Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full ${user?.role === 'teacher' && course?.teacherId === user?.id ? 'grid-cols-6' : 'grid-cols-5'}`}>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
          <TabsTrigger value="materials" data-testid="tab-materials">Materials</TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
          <TabsTrigger value="discussions" data-testid="tab-discussions">Discussions</TabsTrigger>
          {user?.role === 'teacher' && course?.teacherId === user?.id && (
            <TabsTrigger value="builder" data-testid="tab-builder">Course Builder</TabsTrigger>
          )}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Only show stats if real data is available */}
            {typeof course.studentCount === "number" && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="text-2xl font-bold text-foreground">{course.studentCount}</h3>
                  <p className="text-muted-foreground">Students Enrolled</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-6 text-center">
                <BookOpen className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-foreground">
                  {modules.reduce((total: number, module: any) => total + (module.lessons?.length || 0), 0)}
                </h3>
                <p className="text-muted-foreground">Lessons</p>
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
        
        <TabsContent value="content" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-foreground">Course Content</h2>
          </div>
          
          {modulesLoading ? (
            <div className="text-center py-4">Loading course content...</div>
          ) : modules.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">No content available yet</h3>
                <p className="text-muted-foreground">
                  {user?.role === "teacher" ? "Use the Course Builder to add modules and lessons." : "Check back later for new content."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {modules.map((module: any, moduleIndex: number) => (
                <Card key={module.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="flex items-center">
                      <BookOpen className="w-5 h-5 mr-2" />
                      Module {moduleIndex + 1}: {module.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {module.lessons && module.lessons.length > 0 ? (
                      <div className="divide-y">
                        {module.lessons.map((lesson: any, lessonIndex: number) => (
                          <div 
                            key={lesson.id} 
                            className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                lesson.completed ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'
                              }`}>
                                {lesson.completed ? (
                                  <span className="text-sm">✓</span>
                                ) : (
                                  <span className="text-sm font-medium">{lessonIndex + 1}</span>
                                )}
                              </div>
                              <div>
                                <h4 className={`font-medium ${lesson.completed ? 'text-green-600' : 'text-foreground'}`}>
                                  {lesson.title}
                                </h4>
                                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                  <span className="capitalize">{lesson.contentType}</span>
                                  {lesson.duration && (
                                    <>
                                      <span>•</span>
                                      <span>{lesson.duration} min</span>
                                    </>
                                  )}
                                  {lesson.completed && (
                                    <>
                                      <span>•</span>
                                      <span className="text-green-600">Completed</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setLocation(`/courses/${course.id}/learn`);
                                }}
                              >
                                {lesson.url ? "Start Learning" : "View Lesson"}
                              </Button>
                              {user?.role === 'student' && !lesson.completed && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => markLessonCompleteMutation.mutate(lesson.id)}
                                  disabled={markLessonCompleteMutation.isPending}
                                >
                                  {markLessonCompleteMutation.isPending ? "Marking..." : "Mark Complete"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        No lessons in this module yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
                  <>
                    <Button className="mt-4" variant="outline" data-testid="button-upload-materials" onClick={() => setIsUploadDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Upload Materials
                    </Button>
                    {/* Upload Dialog */}
                    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                          Upload Materials
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload Course Material</DialogTitle>
                          <DialogDescription>Select a lesson and upload a file (video, PDF, etc.).</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleUploadMaterials} className="space-y-4">
                          <Label htmlFor="lesson">Lesson</Label>
                          <select
                            id="lesson"
                            value={selectedLessonId}
                            onChange={e => setSelectedLessonId(e.target.value)}
                            required
                            className="w-full border rounded px-2 py-1"
                          >
                            <option value="">Select a lesson</option>
                            {course?.modules?.flatMap((mod: any) =>
                              mod.lessons?.map((lesson: any) => (
                                <option key={lesson.id} value={lesson.id}>
                                  {mod.title} - {lesson.title}
                                </option>
                              ))
                            )}
                          </select>
                          <Label htmlFor="file">File</Label>
                          <Input id="file" type="file" ref={fileInputRef} required />
                          {uploadError && <div className="text-red-500 text-sm">{uploadError}</div>}
                          <Button type="submit" disabled={uploading}>
                            {uploading ? "Uploading..." : "Upload"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </>
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
            <Dialog open={isCreateDiscussionDialogOpen} onOpenChange={setIsCreateDiscussionDialogOpen}>
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
                    Create a discussion topic for this course
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateDiscussion} className="space-y-4">
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
                      onClick={() => setIsCreateDiscussionDialogOpen(false)}
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

        {/* Course Builder Tab - Only for course teachers */}
        {user?.role === 'teacher' && course?.teacherId === user?.id && courseId && (
          <TabsContent value="builder" className="space-y-6">
            <CourseBuilder courseId={courseId} course={course} />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update your course information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCourse} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-title">Course Title</Label>
                <Input
                  id="edit-title"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Course title"
                  required
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-subject">Subject</Label>
                <Input
                  id="edit-subject"
                  value={editFormData.subject}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Subject"
                  required
                  data-testid="input-edit-subject"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Course description"
                rows={3}
                required
                data-testid="textarea-edit-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-objectives">Learning Objectives</Label>
              <Textarea
                id="edit-objectives"
                value={editFormData.objectives}
                onChange={(e) => setEditFormData(prev => ({ ...prev, objectives: e.target.value }))}
                placeholder="What will students learn?"
                rows={3}
                data-testid="textarea-edit-objectives"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Category"
                  data-testid="input-edit-category"
                />
              </div>
              <div>
                <Label htmlFor="edit-target-audience">Target Audience</Label>
                <Input
                  id="edit-target-audience"
                  value={editFormData.targetAudience}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="Beginner, Intermediate, Advanced"
                  data-testid="input-edit-target-audience"
                />
              </div>
              <div>
                <Label htmlFor="edit-duration">Duration</Label>
                <Input
                  id="edit-duration"
                  value={editFormData.duration}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., 8 weeks"
                  data-testid="input-edit-duration"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateCourseMutation.isPending}
                data-testid="button-submit-edit"
              >
                {updateCourseMutation.isPending ? "Updating..." : "Update Course"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Course Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this course? This action cannot be undone.
              All course materials, assessments, and student progress will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteCourse}
              disabled={deleteCourseMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteCourseMutation.isPending ? "Deleting..." : "Delete Course"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


