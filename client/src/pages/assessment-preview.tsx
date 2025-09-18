import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, CheckCircle, XCircle, Clock, 
  FileText, Award, Target 
} from "lucide-react";

export default function AssessmentPreview() {
  const [match, params] = useRoute("/assessments/:id/preview");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const assessmentId = params?.id;

  const { data: previewData, isLoading, error } = useQuery({
    queryKey: ["/api/protected/assessments", assessmentId, "review"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/assessments/${assessmentId}/review`);
      return response.json();
    },
    enabled: !!assessmentId && user?.role === "student",
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

  const { assessment, submission, questions, totalScore, maxScore } = previewData;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (percentage: number) => {
    if (percentage >= 90) return "default";
    if (percentage >= 80) return "secondary";
    if (percentage >= 70) return "outline";
    return "destructive";
  };

  const renderQuestionPreview = (question: any, index: number) => {
    const isCorrect = question.isCorrect;
    const studentAnswer = question.studentAnswer;
    const correctAnswer = question.correctAnswer;

    return (
      <Card key={question.id} className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>Question {index + 1}</span>
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
              </CardTitle>
              <CardDescription className="mt-2">
                {question.text}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isCorrect ? "default" : "destructive"}>
                {isCorrect ? "Correct" : "Incorrect"}
              </Badge>
              <Badge variant="outline">
                {question.points} {question.points === 1 ? "point" : "points"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Question Options (for multiple choice) */}
          {question.options && question.type === "multiple_choice" && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Options:</h4>
              <div className="space-y-2">
                {question.options.map((option: string, optionIndex: number) => {
                  const isStudentChoice = studentAnswer === option;
                  const isCorrectChoice = correctAnswer === option;
                  
                  let optionClass = "p-3 rounded-lg border ";
                  if (isCorrectChoice && isStudentChoice) {
                    optionClass += "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200";
                  } else if (isCorrectChoice) {
                    optionClass += "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200";
                  } else if (isStudentChoice) {
                    optionClass += "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200";
                  } else {
                    optionClass += "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300";
                  }

                  return (
                    <div key={optionIndex} className={optionClass}>
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        <div className="flex items-center space-x-2">
                          {isStudentChoice && (
                            <Badge variant="outline" className="text-xs">
                              Your Answer
                            </Badge>
                          )}
                          {isCorrectChoice && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Correct
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* True/False Questions */}
          {question.type === "true_false" && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Options:</h4>
              <div className="space-y-2">
                {["true", "false"].map((option) => {
                  const isStudentChoice = studentAnswer === option;
                  const isCorrectChoice = correctAnswer === option;
                  
                  let optionClass = "p-3 rounded-lg border ";
                  if (isCorrectChoice && isStudentChoice) {
                    optionClass += "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200";
                  } else if (isCorrectChoice) {
                    optionClass += "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200";
                  } else if (isStudentChoice) {
                    optionClass += "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200";
                  } else {
                    optionClass += "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300";
                  }

                  return (
                    <div key={option} className={optionClass}>
                      <div className="flex items-center justify-between">
                        <span className="capitalize">{option}</span>
                        <div className="flex items-center space-x-2">
                          {isStudentChoice && (
                            <Badge variant="outline" className="text-xs">
                              Your Answer
                            </Badge>
                          )}
                          {isCorrectChoice && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Correct
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Short Answer and Fill in the Blank */}
          {(question.type === "short_answer" || question.type === "fill_blank") && (
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Your Answer:</h4>
                <div className={`p-3 rounded-lg border ${
                  isCorrect 
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200"
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
                }`}>
                  {studentAnswer || <span className="italic text-muted-foreground">No answer provided</span>}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Correct Answer:</h4>
                <div className="p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200">
                  {correctAnswer}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation(`/assessments/${assessmentId}`)}
          data-testid="button-back-to-assessment"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Assessment
        </Button>
      </div>

      {/* Assessment Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center space-x-2">
                <FileText className="w-6 h-6" />
                <span>{assessment.title} - Review</span>
              </CardTitle>
              <CardDescription className="mt-2">
                Assessment completed on {new Date(submission.submittedAt).toLocaleString()}
              </CardDescription>
            </div>
            <Badge variant={getScoreBadgeVariant(percentage)}>
              {percentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Score Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
                {totalScore}/{maxScore}
              </div>
              <div className="text-sm text-muted-foreground">Points Earned</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
                {percentage}%
              </div>
              <div className="text-sm text-muted-foreground">Percentage</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {questions.filter((q: any) => q.isCorrect).length}/{questions.length}
              </div>
              <div className="text-sm text-muted-foreground">Correct Answers</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {submission.timeTaken ? Math.round(submission.timeTaken / 60) : 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">Minutes Taken</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Performance</span>
              <span>{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Questions Review */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center space-x-2">
          <Target className="w-5 h-5" />
          <span>Question by Question Review</span>
        </h2>
        
        {questions.map((question: any, index: number) => 
          renderQuestionPreview(question, index)
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-8 flex justify-center space-x-4">
        <Button 
          variant="outline" 
          onClick={() => setLocation(`/assessments/${assessmentId}`)}
        >
          Back to Assessment
        </Button>
        <Button onClick={() => setLocation("/assessments")}>
          Back to Assessments
        </Button>
      </div>
    </div>
  );
}