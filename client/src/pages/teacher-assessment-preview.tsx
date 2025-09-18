import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, Users, CheckCircle, Clock, 
  FileText, BarChart3, TrendingUp, Award,
  Eye, Calendar, Timer
} from "lucide-react";

export default function TeacherAssessmentPreview() {
  const [match, params] = useRoute("/assessments/:id/preview");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const assessmentId = params?.id;

  const { data: previewData, isLoading, error } = useQuery({
    queryKey: ["/api/protected/assessments", assessmentId, "teacher-preview"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/assessments/${assessmentId}/preview`);
      return response.json();
    },
    enabled: !!assessmentId && (user?.role === "teacher" || user?.role === "admin"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !previewData) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Preview not available</h3>
            <p className="text-muted-foreground mb-4">
              {error ? "Failed to load assessment preview." : "Assessment preview is not available."}
            </p>
            <Button onClick={() => setLocation("/assessments")} data-testid="button-back-to-assessments">
              Back to Assessments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { assessment, questions, statistics, submissions } = previewData;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getScoreColor = (percentage: number | null) => {
    if (percentage === null) return "text-gray-500";
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => setLocation(`/assessments/${assessmentId}`)}
          data-testid="button-back-to-assessment"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Assessment
        </Button>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setLocation(`/assessments/${assessmentId}`)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Edit Assessment
          </Button>
        </div>
      </div>

      {/* Assessment Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center space-x-2">
                <FileText className="w-6 h-6" />
                <span>{assessment.title}</span>
              </CardTitle>
              <CardDescription className="mt-2">
                {assessment.description || "No description provided"}
              </CardDescription>
            </div>
            <Badge variant={assessment.status === "published" ? "default" : "secondary"}>
              {assessment.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{statistics.maxScore}</div>
              <div className="text-sm text-muted-foreground">Total Points</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {assessment.timeLimit || "No Limit"}
              </div>
              <div className="text-sm text-muted-foreground">Time Limit (min)</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {new Date(assessment.createdAt).toLocaleDateString()}
              </div>
              <div className="text-sm text-muted-foreground">Created</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Submission Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{statistics.totalSubmissions}</div>
              <div className="text-sm text-muted-foreground">Total Attempts</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{statistics.completedSubmissions}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{statistics.inProgressSubmissions}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{statistics.averagePercentage}%</div>
              <div className="text-sm text-muted-foreground">Average Score</div>
            </div>
          </div>

          {statistics.completedSubmissions > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Class Performance</span>
                <span>{statistics.averagePercentage}%</span>
              </div>
              <Progress value={statistics.averagePercentage} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Submissions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Student Submissions ({submissions.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No submissions yet</h3>
              <p className="text-muted-foreground">Students haven't started this assessment yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Time Taken</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission: any) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">
                        {submission.studentName}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(submission.status)}
                      </TableCell>
                      <TableCell>
                        {submission.score !== null ? (
                          <span>{submission.score}/{submission.maxScore}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.percentage !== null ? (
                          <span className={getScoreColor(submission.percentage)}>
                            {submission.percentage}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(submission.startedAt).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {submission.submittedAt ? (
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <CheckCircle className="w-3 h-3" />
                            <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Timer className="w-3 h-3" />
                          <span>{formatDuration(submission.timeTaken)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/submissions/${submission.id}`)}
                          disabled={submission.status !== 'submitted'}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Questions Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Assessment Questions ({questions.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {questions.map((question: any, index: number) => (
              <Card key={question.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        Question {index + 1}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {question.text}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {question.type.replace('_', ' ')}
                      </Badge>
                      <Badge variant="secondary">
                        {question.points} {question.points === 1 ? "point" : "points"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Show options for multiple choice and true/false */}
                  {question.options && (question.type === "multiple_choice" || question.type === "true_false") && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">Options:</h4>
                      <div className="space-y-2">
                        {(question.type === "true_false" ? ["true", "false"] : question.options).map((option: string, optionIndex: number) => {
                          const isCorrect = option === question.correctAnswer;
                          return (
                            <div 
                              key={optionIndex} 
                              className={`p-3 rounded-lg border ${
                                isCorrect 
                                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200"
                                  : "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="capitalize">{option}</span>
                                {isCorrect && (
                                  <Badge variant="default" className="text-xs bg-green-600">
                                    Correct Answer
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Show correct answer for short answer and fill in the blank */}
                  {(question.type === "short_answer" || question.type === "fill_blank") && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Correct Answer:</h4>
                      <div className="p-3 rounded-lg border bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200">
                        {question.correctAnswer}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="mt-8 flex justify-center space-x-4">
        <Button 
          variant="outline" 
          onClick={() => setLocation(`/assessments/${assessmentId}`)}
        >
          Edit Assessment
        </Button>
        <Button onClick={() => setLocation("/assessments")}>
          Back to Assessments
        </Button>
      </div>
    </div>
  );
}