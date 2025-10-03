import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileText, Calendar, Clock, User, Star } from "lucide-react";
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
}

export default function AssignmentsPage() {
  const [match, params] = useRoute("/courses/:courseId/assignments");
  const [, setLocation] = useLocation();
  const courseId = params?.courseId;
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, AssignmentSubmission>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAssignments();
  }, [courseId]);

  const fetchAssignments = async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/assignments`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssignments(data);
        
        // Fetch submissions for each assignment
        for (const assignment of data) {
          fetchSubmission(assignment.id);
        }
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast({
        title: "Error",
        description: "Failed to load assignments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmission = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/my-submission`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const submission = await response.json();
        setSubmissions(prev => ({
          ...prev,
          [assignmentId]: submission
        }));
      }
    } catch (error) {
      console.error('Error fetching submission:', error);
    }
  };

  const handleFileUpload = async (assignmentId: string, file: File) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!assignment.allowedFileTypes.includes(fileExtension || '')) {
      toast({
        title: "Invalid File Type",
        description: `Only ${assignment.allowedFileTypes.join(', ')} files are allowed`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size (convert MB to bytes)
    if (file.size > assignment.maxFileSize * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `File size must be less than ${assignment.maxFileSize}MB`,
        variant: "destructive",
      });
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [assignmentId]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const submission = await response.json();
        setSubmissions(prev => ({
          ...prev,
          [assignmentId]: submission
        }));
        
        toast({
          title: "Success",
          description: "Assignment submitted successfully",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [assignmentId]: false }));
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

  const getStatusBadge = (assignment: Assignment, submission?: AssignmentSubmission) => {
    if (!submission) {
      const isOverdue = new Date() > new Date(assignment.dueDate);
      return (
        <Badge variant={isOverdue ? "destructive" : "secondary"}>
          {isOverdue ? "Overdue" : "Not Submitted"}
        </Badge>
      );
    }

    switch (submission.status) {
      case 'submitted':
        return <Badge variant="outline">Submitted</Badge>;
      case 'graded':
        return <Badge variant="default">Graded</Badge>;
      default:
        return <Badge variant="secondary">{submission.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading assignments...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Assignments</h1>
          <p className="text-muted-foreground">Submit your assignments and view feedback</p>
        </div>
        <Button variant="outline" onClick={() => setLocation(`/courses/${courseId}`)}>
          Back to Course
        </Button>
      </div>

      <div className="space-y-6">
        {assignments.map((assignment) => {
          const submission = submissions[assignment.id];
          const isOverdue = new Date() > new Date(assignment.dueDate);
          
          return (
            <Card key={assignment.id} className="w-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {assignment.title}
                    </CardTitle>
                    <CardDescription>{assignment.description}</CardDescription>
                  </div>
                  {getStatusBadge(assignment, submission)}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Due: {format(new Date(assignment.dueDate), 'PPP')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    {assignment.maxPoints} points
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {assignment.instructions && (
                  <div>
                    <h4 className="font-medium mb-2">Instructions</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {assignment.instructions}
                    </p>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  <p>Allowed file types: {assignment.allowedFileTypes.join(', ')}</p>
                  <p>Maximum file size: {assignment.maxFileSize}MB</p>
                </div>

                <Separator />

                {submission ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">Your Submission</p>
                        <p className="text-sm text-muted-foreground">
                          Submitted on {format(new Date(submission.submittedAt), 'PPp')}
                        </p>
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

                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-medium">{submission.originalFileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {(submission.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    {submission.status === 'graded' && (
                      <div className="space-y-3">
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            Grade: {submission.grade}/{assignment.maxPoints}
                          </h4>
                          {submission.feedback && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-sm font-medium mb-1">Feedback</p>
                              <p className="text-sm whitespace-pre-wrap">{submission.feedback}</p>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Graded on {format(new Date(submission.gradedAt!), 'PPp')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!isOverdue ? (
                      <div>
                        <Label htmlFor={`file-${assignment.id}`} className="text-sm font-medium">
                          Upload Assignment
                        </Label>
                        <div className="mt-2">
                          <Input
                            id={`file-${assignment.id}`}
                            type="file"
                            accept={assignment.allowedFileTypes.map(type => `.${type}`).join(',')}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(assignment.id, file);
                              }
                            }}
                            disabled={uploadingFiles[assignment.id]}
                          />
                        </div>
                        {uploadingFiles[assignment.id] && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Uploading...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-sm text-red-600">
                          This assignment is overdue. You can no longer submit.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {assignments.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No assignments available for this course.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}