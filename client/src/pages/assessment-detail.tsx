import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AssessmentBuilder } from "@/components/assessment-builder";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, FileText, CheckCircle, AlertTriangle, 
  ArrowLeft, ArrowRight, Save 
} from "lucide-react";
import { ShareButton } from "@/components/share-button";

export default function AssessmentDetail() {
  const [match, params] = useRoute("/assessments/:id");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const assessmentId = params?.id;

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["/api/protected/assessments", assessmentId],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/assessments/${assessmentId}`);
      return response.json();
    },
    enabled: !!assessmentId,
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["/api/protected/assessments", assessmentId, "questions"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/assessments/${assessmentId}/questions`);
      return response.json();
    },
    enabled: !!assessmentId,
  });

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ["/api/protected/assessments", assessmentId, "submission"],
    queryFn: async () => {
      try {
        const response = await authenticatedApiRequest("GET", `/api/protected/assessments/${assessmentId}/submission`);
        return response.json();
      } catch (error) {
        // Return null if no submission exists (404 error is expected)
        return null;
      }
    },
    enabled: !!assessmentId && user?.role === "student",
  });

  // Set submission ID and answers when submission data is loaded
  useEffect(() => {
    if (submission && submission.id) {
      setSubmissionId(submission.id);
      setHasStarted(true);
      
      // Load existing answers if any
      if (submission.answers) {
        const answersMap: Record<string, string> = {};
        submission.answers.forEach((answer: any) => {
          answersMap[answer.questionId] = answer.answer;
        });
        setAnswers(answersMap);
      }
      
      // Set remaining time if assessment has time limit and submission is in progress
      if (assessment?.timeLimit && submission.status === 'in_progress') {
        const elapsed = Math.floor((new Date().getTime() - new Date(submission.startedAt).getTime()) / 1000);
        const remaining = (assessment.timeLimit * 60) - elapsed;
        setTimeRemaining(Math.max(0, remaining));
      }
    }
  }, [submission, assessment]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  const startAssessmentMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest("POST", `/api/protected/assessments/${assessmentId}/start`);
      return response.json();
    },
    onSuccess: (data) => {
      setHasStarted(true);
      setSubmissionId(data.id); // Store the submission ID
      if (assessment?.timeLimit) {
        setTimeRemaining(assessment.timeLimit * 60); // Convert minutes to seconds
      }
      // Invalidate the submission query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/protected/assessments", assessmentId, "submission"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start assessment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for saving individual answers
  const saveAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      if (!submissionId) throw new Error("No submission ID available");
      const response = await authenticatedApiRequest("POST", `/api/protected/submissions/${submissionId}/answers`, {
        questionId,
        answer,
      });
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save answer",
        description: "Your answer couldn't be saved. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for final assessment submission
  const submitAssessmentMutation = useMutation({
    mutationFn: async () => {
      if (!submissionId) throw new Error("No submission ID available");
      const response = await authenticatedApiRequest("POST", `/api/protected/submissions/${submissionId}/submit`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Assessment submitted successfully!",
        description: `Your score: ${data.score}/${data.totalPoints} (${Math.round((data.score / data.totalPoints) * 100)}%)`,
      });
      setLocation("/assessments");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit assessment",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  // Timer effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Auto-submit when time runs out
          handleSubmitAssessment(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, submissionId]);

  const handleStartAssessment = () => {
    startAssessmentMutation.mutate();
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
    
    // Debounced auto-save to prevent too many API calls
    if (submissionId) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      const timeout = setTimeout(() => {
        saveAnswerMutation.mutate({ questionId, answer });
      }, 1000); // Wait 1 second after user stops typing
      
      setSaveTimeout(timeout);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmitAssessment = (isAutoSubmit = false) => {
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true);
    
    if (isAutoSubmit) {
      toast({
        title: "Time's up!",
        description: "Your assessment is being submitted automatically.",
        variant: "destructive",
      });
    }
    
    submitAssessmentMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderQuestionInput = (question: any) => {
    const currentAnswer = answers[question.id] || "";

    switch (question.type) {
      case "multiple_choice":
        return (
          <RadioGroup
            value={currentAnswer}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
            className="space-y-3"
          >
            {question.options?.map((option: string, index: number) => (
              <div key={index} className="flex items-center space-x-3">
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "true_false":
        return (
          <RadioGroup
            value={currentAnswer}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="true" id="true" />
              <Label htmlFor="true" className="cursor-pointer">True</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="false" id="false" />
              <Label htmlFor="false" className="cursor-pointer">False</Label>
            </div>
          </RadioGroup>
        );

      case "short_answer":
        return (
          <Input
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer"
            className="w-full"
          />
        );

      case "fill_blank":
        return (
          <Input
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Fill in the blank"
            className="w-full"
          />
        );

      default:
        return <p className="text-muted-foreground">Unknown question type</p>;
    }
  };

  if (assessmentLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Assessment not found</h3>
            <p className="text-muted-foreground mb-4">The assessment you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation("/assessments")} data-testid="button-back-to-assessments">
              Back to Assessments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Teacher view - show assessment builder
  if (user?.role === "teacher") {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/assessments")}
            data-testid="button-back-to-assessments"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assessments
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setLocation(`/assessments/${assessmentId}/preview`)}
            data-testid="button-teacher-preview"
          >
            <FileText className="w-4 h-4 mr-2" />
            Preview & Statistics
          </Button>
        </div>

        <AssessmentBuilder assessmentId={assessmentId!} assessment={assessment} />
      </div>
    );
  }

  // Student view - assessment already submitted
  if (submission && submission.status === 'submitted') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{assessment.title}</CardTitle>
                <CardDescription className="mt-2">Assessment Completed</CardDescription>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Submitted
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                    Assessment Submitted Successfully!
                  </h3>
                  <p className="text-green-700 dark:text-green-300">
                    Submitted on {new Date(submission.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {submission.score !== undefined && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                      {submission.score}/{submission.totalPoints}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">Points Earned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                      {Math.round((submission.score / submission.totalPoints) * 100)}%
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">Percentage</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                      {submission.timeTaken ? Math.round(submission.timeTaken / 60) : 'N/A'}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">Minutes Taken</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => setLocation(`/assessments/${assessmentId}/preview`)} 
                data-testid="button-view-review"
              >
                Review Assessment
              </Button>
              <ShareButton 
                title={`I completed "${assessment.title}" assessment!`}
                description={submission.score !== undefined ? 
                  `I scored ${submission.score}/${submission.totalPoints} (${Math.round((submission.score / submission.totalPoints) * 100)}%) on this assessment.` :
                  `I successfully completed this assessment.`
                }
                variant="outline"
              />
              <Button onClick={() => setLocation("/assessments")} data-testid="button-back-to-assessments">
                Back to Assessments
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Student view - taking assessment (show start screen only if no submission exists yet)
  if (!hasStarted && !submission) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{assessment.title}</CardTitle>
                {assessment.description && (
                  <CardDescription className="mt-2">{assessment.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <ShareButton 
                  title={`Check out this assessment: ${assessment.title}`}
                  description={assessment.description || `Take this assessment and test your knowledge!`}
                  variant="outline"
                  size="sm"
                />
                <Badge variant={assessment.status === "published" ? "default" : "secondary"}>
                  {assessment.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Questions</p>
                  <p className="font-medium">{questions.length}</p>
                </div>
              </div>
              
              {assessment.timeLimit && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Time Limit</p>
                    <p className="font-medium">{assessment.timeLimit} minutes</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                  <p className="font-medium">{assessment.totalPoints}</p>
                </div>
              </div>
            </div>

            {assessment.timeLimit && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                    This assessment is timed
                  </p>
                </div>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                  You have {assessment.timeLimit} minutes to complete all questions. The timer will start when you begin.
                </p>
              </div>
            )}

            <div className="flex justify-center">
              <Button 
                size="lg"
                onClick={handleStartAssessment}
                disabled={startAssessmentMutation.isPending || questions.length === 0}
                data-testid="button-start-assessment"
              >
                {startAssessmentMutation.isPending ? "Starting..." : "Start Assessment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Taking assessment view
  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No questions available</h3>
            <p className="text-muted-foreground mb-4">This assessment doesn't have any questions yet.</p>
            <Button onClick={() => setLocation("/assessments")} data-testid="button-back-to-assessments">
              Back to Assessments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Assessment Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-foreground">{assessment.title}</h1>
          <div className="flex items-center space-x-2">
            <ShareButton 
              title={`I'm taking "${assessment.title}" assessment`}
              description={`Currently working on this assessment. Wish me luck!`}
              variant="ghost"
              size="sm"
            />
            {timeRemaining !== null && (
              <div className="flex items-center space-x-2 bg-card border border-border rounded-lg px-4 py-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className={`font-mono font-medium ${
                  timeRemaining < 300 ? "text-destructive" : "text-foreground"
                }`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Current Question */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              {currentQuestion.questionText}
            </h2>
            <div className="text-sm text-muted-foreground mb-4">
              Points: {currentQuestion.points}
            </div>
          </div>
          
          {renderQuestionInput(currentQuestion)}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
          data-testid="button-previous-question"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              // Save all current answers
              Object.entries(answers).forEach(([questionId, answer]) => {
                if (submissionId && answer) {
                  saveAnswerMutation.mutate({ questionId, answer });
                }
              });
              toast({
                title: "Progress saved!",
                description: "Your answers have been saved.",
              });
            }}
            disabled={saveAnswerMutation.isPending}
            data-testid="button-save-progress"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveAnswerMutation.isPending ? "Saving..." : "Save Progress"}
          </Button>
          
          {currentQuestionIndex === questions.length - 1 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={isSubmitting || submitAssessmentMutation.isPending}
                  data-testid="button-submit-assessment"
                >
                  {isSubmitting || submitAssessmentMutation.isPending ? "Submitting..." : "Submit Assessment"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit Assessment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to submit your assessment? This action cannot be undone.
                    {Object.keys(answers).length < questions.length && (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                          Warning: You have answered {Object.keys(answers).length} out of {questions.length} questions.
                        </p>
                      </div>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleSubmitAssessment(false)}>
                    Submit Assessment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button onClick={handleNextQuestion} data-testid="button-next-question">
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Question Navigation */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">Question Overview</CardTitle>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-primary rounded-full"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border border-border rounded-full"></div>
                <span>Not answered</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((question: any, index: number) => {
              const isAnswered = answers[question.id] && answers[question.id].trim() !== "";
              const isCurrent = index === currentQuestionIndex;
              
              return (
                <Button
                  key={index}
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  className={`w-10 h-10 p-0 relative ${
                    isAnswered && !isCurrent 
                      ? "bg-green-100 border-green-300 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:border-green-700 dark:text-green-200" 
                      : ""
                  }`}
                  onClick={() => setCurrentQuestionIndex(index)}
                  data-testid={`button-question-${index + 1}`}
                >
                  {index + 1}
                  {isAnswered && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </Button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress: {Object.keys(answers).length}/{questions.length} questions answered</span>
              <span>{Math.round((Object.keys(answers).length / questions.length) * 100)}% complete</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
