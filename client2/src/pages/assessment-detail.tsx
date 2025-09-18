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
import { AssessmentBuilder } from "@/components/assessment-builder";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, FileText, CheckCircle, AlertTriangle, 
  ArrowLeft, ArrowRight, Save 
} from "lucide-react";

export default function AssessmentDetail() {
  const [match] = useRoute("/assessments/:id");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const assessmentId = match?.id;

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["/api/assessments", assessmentId],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/assessments/${assessmentId}`);
      return response.json();
    },
    enabled: !!assessmentId,
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["/api/assessments", assessmentId, "questions"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/assessments/${assessmentId}/questions`);
      return response.json();
    },
    enabled: !!assessmentId,
  });

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ["/api/assessments", assessmentId, "submission"],
    queryFn: async () => {
      try {
        const response = await authenticatedApiRequest("POST", `/api/assessments/${assessmentId}/start`);
        return response.json();
      } catch (error) {
        return null;
      }
    },
    enabled: !!assessmentId && user?.role === "student" && hasStarted,
  });

  const startAssessmentMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest("POST", `/api/assessments/${assessmentId}/start`);
      return response.json();
    },
    onSuccess: (data) => {
      setHasStarted(true);
      if (assessment?.timeLimit) {
        setTimeRemaining(assessment.timeLimit * 60); // Convert minutes to seconds
      }
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", assessmentId, "submission"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start assessment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Timer effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Auto-submit when time runs out
          handleSubmitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const handleStartAssessment = () => {
    startAssessmentMutation.mutate();
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
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

  const handleSubmitAssessment = () => {
    // TODO: Implement assessment submission
    toast({
      title: "Assessment submitted!",
      description: "Your answers have been saved.",
    });
    setLocation("/assessments");
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
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/assessments")}
            data-testid="button-back-to-assessments"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assessments
          </Button>
        </div>

        <AssessmentBuilder assessmentId={assessmentId!} assessment={assessment} />
      </div>
    );
  }

  // Student view - taking assessment
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
              <Badge variant={assessment.status === "published" ? "default" : "secondary"}>
                {assessment.status}
              </Badge>
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
          <Button variant="outline" data-testid="button-save-progress">
            <Save className="w-4 h-4 mr-2" />
            Save Progress
          </Button>
          
          {currentQuestionIndex === questions.length - 1 ? (
            <Button onClick={handleSubmitAssessment} data-testid="button-submit-assessment">
              Submit Assessment
            </Button>
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
          <CardTitle className="text-sm">Question Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((_, index) => (
              <Button
                key={index}
                variant={index === currentQuestionIndex ? "default" : "outline"}
                size="sm"
                className="w-10 h-10 p-0"
                onClick={() => setCurrentQuestionIndex(index)}
                data-testid={`button-question-${index + 1}`}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
