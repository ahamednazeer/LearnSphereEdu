import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Calendar, Clock, User, Star, Edit, Save, X } from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
  allowedFileTypes: string[];
  maxFileSize: number;
  instructions: string;
  status: string;
  createdAt: string;
}

interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  submittedAt: string;
  grade?: number;
  feedback?: string;
  gradedAt?: string;
  gradedBy?: string;
  status: string;
  studentName: string;
  studentEmail: string;
}

export default function AssignmentGradingPage() {
  const [match, params] = useRoute("/courses/:courseId/assignments/:assignmentId/grade");
  const [, setLocation] = useLocation();
  const courseId = params?.courseId;
  const assignmentId = params?.assignmentId;
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingSubmission, setGradingSubmission] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' });

  useEffect(() => {
    fetchAssignmentAndSubmissions();
  }, [assignmentId]);

  const fetchAssignmentAndSubmissions = async () => {
    try {
      // Fetch assignment details
      const assignmentResponse = await fetch(`/api/assignments/${assignmentId}`, {
        credentials: 'include'
      });
      
      if (assignmentResponse.ok) {
        const assignmentData = await assignmentResponse.json();
        setAssignment(assignmentData);
      }

      // Fetch submissions
      const submissionsResponse = await fetch(`/api/assignments/${assignmentId}/submissions`, {
        credentials: 'include'
      });
      
      if (submissionsResponse.ok) {
        const submissionsData = await submissionsResponse.json();
        setSubmissions(submissionsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load assignment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadSubmission = async (submissionId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/assignment-submissions/${submissionId}/download`, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const startGrading = (submission: AssignmentSubmission) => {
    setGradingSubmission(submission.id);
    setGradeForm({
      grade: submission.grade?.toString() || '',
      feedback: submission.feedback || ''
    });
  };

  const cancelGrading = () => {
    setGradingSubmission(null);
    setGradeForm({ grade: '', feedback: '' });
  };

  const submitGrade = async (submissionId: string) => {
    if (!gradeForm.grade || isNaN(Number(gradeForm.grade))) {
      toast({
        title: "Invalid Grade",
        description: "Please enter a valid numeric grade",
        variant: "destructive",
      });
      return;
    }

    const grade = Number(gradeForm.grade);
    if (grade < 0 || grade > (assignment?.maxPoints || 100)) {
      toast({
        title: "Invalid Grade",
        description: `Grade must be between 0 and ${assignment?.maxPoints || 100}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/assignment-submissions/${submissionId}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grade: grade,
          feedback: gradeForm.feedback
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const updatedSubmission = await response.json();
        setSubmissions(prev => 
          prev.map(sub => 
            sub.id === submissionId ? { ...sub, ...updatedSubmission } : sub
          )
        );
        
        setGradingSubmission(null);
        setGradeForm({ grade: '', feedback: '' });
        
        toast({
          title: "Success",
          description: "Grade submitted successfully",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit grade');
      }
    } catch (error) {
      console.error('Error submitting grade:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit grade",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (submission: AssignmentSubmission) => {
    switch (submission.status) {
      case 'submitted':
        return <Badge variant="outline">Pending Review</Badge>;
      case 'graded':
        return <Badge variant="default">Graded</Badge>;
      default:
        return <Badge variant="secondary">{submission.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading assignment data...</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Assignment not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{assignment.title}</h1>
          <p className="text-muted-foreground">Grade student submissions</p>
        </div>
        <Button variant="outline" onClick={() => setLocation(`/courses/${courseId}`)}>
          Back to Course
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Assignment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">Due Date</p>
              <p className="text-muted-foreground">
                {format(new Date(assignment.dueDate), 'PPP')}
              </p>
            </div>
            <div>
              <p className="font-medium">Max Points</p>
              <p className="text-muted-foreground">{assignment.maxPoints}</p>
            </div>
            <div>
              <p className="font-medium">Submissions</p>
              <p className="text-muted-foreground">
                {submissions.length} submitted
              </p>
            </div>
          </div>
          {assignment.description && (
            <div className="mt-4">
              <p className="font-medium mb-2">Description</p>
              <p className="text-muted-foreground">{assignment.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Student Submissions</h2>
        
        {submissions.map((submission) => (
          <Card key={submission.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {submission.studentName}
                  </CardTitle>
                  <CardDescription>{submission.studentEmail}</CardDescription>
                </div>
                {getStatusBadge(submission)}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Submitted: {format(new Date(submission.submittedAt), 'PPp')}
                </div>
                {submission.gradedAt && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    Graded: {format(new Date(submission.gradedAt), 'PPp')}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Submitted File</p>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium">{submission.originalFileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {(submission.fileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadSubmission(submission.id, submission.originalFileName)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>

              <Separator />

              {gradingSubmission === submission.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`grade-${submission.id}`}>
                        Grade (out of {assignment.maxPoints})
                      </Label>
                      <Input
                        id={`grade-${submission.id}`}
                        type="number"
                        min="0"
                        max={assignment.maxPoints}
                        value={gradeForm.grade}
                        onChange={(e) => setGradeForm(prev => ({ ...prev, grade: e.target.value }))}
                        placeholder="Enter grade"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor={`feedback-${submission.id}`}>Feedback</Label>
                    <Textarea
                      id={`feedback-${submission.id}`}
                      value={gradeForm.feedback}
                      onChange={(e) => setGradeForm(prev => ({ ...prev, feedback: e.target.value }))}
                      placeholder="Enter feedback for the student..."
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => submitGrade(submission.id)}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Grade
                    </Button>
                    <Button variant="outline" onClick={cancelGrading}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {submission.status === 'graded' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          Grade: {submission.grade}/{assignment.maxPoints}
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startGrading(submission)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Grade
                        </Button>
                      </div>
                      
                      {submission.feedback && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm font-medium mb-1">Feedback</p>
                          <p className="text-sm whitespace-pre-wrap">{submission.feedback}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button onClick={() => startGrading(submission)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Grade Submission
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {submissions.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No submissions yet for this assignment.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}