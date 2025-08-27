import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AssessmentBuilder } from "@/components/assessment-builder";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, Clock, Plus, Search, Calendar, 
  CheckCircle, AlertCircle, Eye 
} from "lucide-react";

export default function Assessments() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  
  const [newAssessment, setNewAssessment] = useState({
    title: "",
    description: "",
    timeLimit: "",
    dueDate: "",
  });

  // Parse courseId from URL params if creating from course detail
  const courseIdFromUrl = new URLSearchParams(searchParams).get('courseId');

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["/api/protected/courses"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses");
      return response.json();
    },
    enabled: user?.role === "teacher",
  });

  const { data: allAssessments = [], isLoading: assessmentsLoading } = useQuery({
    queryKey: ["/api/protected/assessments"],
    queryFn: async () => {
      // For students, get assessments from all enrolled courses
      // For teachers, get assessments from their courses
      const coursePromises = courses.map((course: any) => 
        authenticatedApiRequest("GET", `/api/protected/courses/${course.id}/assessments`)
          .then(response => response.json())
      );
      const assessmentArrays = await Promise.all(coursePromises);
      return assessmentArrays.flat();
    },
    enabled: courses.length > 0,
  });

  const createAssessmentMutation = useMutation({
    mutationFn: async (assessmentData: any) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${selectedCourseId}/assessments`, assessmentData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/assessments"] });
      setIsCreateDialogOpen(false);
      setNewAssessment({ title: "", description: "", timeLimit: "", dueDate: "" });
      setSelectedCourseId("");
      // Navigate to the created assessment for adding questions
      setLocation(`/assessments/${data.id}`);
      toast({
        title: "Assessment created successfully!",
        description: "You can now add questions to your assessment.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create assessment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      toast({
        title: "Please select a course",
        description: "You must select a course for this assessment.",
        variant: "destructive",
      });
      return;
    }

    const assessmentData = {
      ...newAssessment,
      timeLimit: newAssessment.timeLimit ? parseInt(newAssessment.timeLimit) : null,
      dueDate: newAssessment.dueDate ? new Date(newAssessment.dueDate).toISOString() : null,
    };

    createAssessmentMutation.mutate(assessmentData);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: <Badge variant="secondary">Draft</Badge>,
      published: <Badge variant="default">Published</Badge>,
      closed: <Badge variant="destructive">Closed</Badge>,
    };
    return badges[status as keyof typeof badges] || <Badge variant="secondary">{status}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      draft: <AlertCircle className="w-4 h-4 text-yellow-500" />,
      published: <CheckCircle className="w-4 h-4 text-green-500" />,
      closed: <AlertCircle className="w-4 h-4 text-red-500" />,
    };
    return icons[status as keyof typeof icons] || <FileText className="w-4 h-4" />;
  };

  const filteredAssessments = allAssessments.filter((assessment: any) =>
    assessment.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Set initial course from URL if available
  if (courseIdFromUrl && !selectedCourseId && courses.length > 0) {
    setSelectedCourseId(courseIdFromUrl);
    setIsCreateDialogOpen(true);
  }

  if (coursesLoading || assessmentsLoading) {
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
            {user?.role === "teacher" ? "My Assessments" : "Assessments"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {user?.role === "teacher" 
              ? "Create and manage assessments for your courses"
              : "Take assessments and view your results"
            }
          </p>
        </div>
        
        {user?.role === "teacher" && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-assessment">
                <Plus className="w-4 h-4 mr-2" />
                Create Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Assessment</DialogTitle>
                <DialogDescription>
                  Set up a new assessment for your students
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateAssessment} className="space-y-4">
                <div>
                  <Label htmlFor="course">Course</Label>
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger data-testid="select-assessment-course">
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
                  <Label htmlFor="title">Assessment Title</Label>
                  <Input
                    id="title"
                    value={newAssessment.title}
                    onChange={(e) => setNewAssessment(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter assessment title"
                    required
                    data-testid="input-assessment-title"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newAssessment.description}
                    onChange={(e) => setNewAssessment(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the assessment"
                    rows={3}
                    data-testid="textarea-assessment-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      value={newAssessment.timeLimit}
                      onChange={(e) => setNewAssessment(prev => ({ ...prev, timeLimit: e.target.value }))}
                      placeholder="Optional"
                      data-testid="input-assessment-time-limit"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="datetime-local"
                      value={newAssessment.dueDate}
                      onChange={(e) => setNewAssessment(prev => ({ ...prev, dueDate: e.target.value }))}
                      data-testid="input-assessment-due-date"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-assessment"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAssessmentMutation.isPending}
                    data-testid="button-submit-assessment"
                  >
                    {createAssessmentMutation.isPending ? "Creating..." : "Create & Add Questions"}
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
            placeholder="Search assessments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-assessments"
          />
        </div>
      </div>

      {/* Assessment Grid */}
      {filteredAssessments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm 
                ? "No assessments found"
                : user?.role === "teacher" 
                  ? "No assessments created yet" 
                  : "No assessments available"
              }
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Try adjusting your search terms"
                : user?.role === "teacher" 
                  ? "Create your first assessment to get started."
                  : "Check back later for new assessments."
              }
            </p>
            {!searchTerm && user?.role === "teacher" && (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-assessment">
                Create Your First Assessment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssessments.map((assessment: any) => (
            <Card 
              key={assessment.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`/assessments/${assessment.id}`)}
              data-testid={`assessment-card-${assessment.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(assessment.status)}
                    <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                      {assessment.title}
                    </h3>
                  </div>
                  {getStatusBadge(assessment.status)}
                </div>

                {assessment.description && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                    {assessment.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-muted-foreground">
                  {assessment.timeLimit && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{assessment.timeLimit} minutes</span>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>{assessment.totalPoints} points</span>
                  </div>

                  {assessment.dueDate && (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Due: {new Date(assessment.dueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Created {new Date(assessment.createdAt).toLocaleDateString()}
                  </span>
                  <Button size="sm" data-testid={`button-view-assessment-${assessment.id}`}>
                    <Eye className="w-4 h-4 mr-1" />
                    {user?.role === "teacher" ? "Manage" : "Take"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
