import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Trash2, Edit, Save, FileText, 
  CheckCircle, Circle, SquareCheck 
} from "lucide-react";

interface AssessmentBuilderProps {
  assessmentId: string;
  assessment: any;
}

export function AssessmentBuilder({ assessmentId, assessment }: AssessmentBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  
  const [newQuestion, setNewQuestion] = useState({
    type: "multiple_choice",
    questionText: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    points: 1,
    order: 1,
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["/api/protected/assessments", assessmentId, "questions"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/assessments/${assessmentId}/questions`);
      return response.json();
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: async (questionData: any) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/assessments/${assessmentId}/questions`, questionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/assessments", assessmentId, "questions"] });
      setIsAddQuestionOpen(false);
      setNewQuestion({
        type: "multiple_choice",
        questionText: "",
        options: ["", "", "", ""],
        correctAnswer: "",
        points: 1,
        order: questions.length + 1,
      });
      toast({
        title: "Question added!",
        description: "Your question has been added to the assessment.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add question",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate question data
    if (!newQuestion.questionText.trim()) {
      toast({
        title: "Question text required",
        description: "Please enter the question text.",
        variant: "destructive",
      });
      return;
    }

    if (!newQuestion.correctAnswer.trim()) {
      toast({
        title: "Correct answer required",
        description: "Please specify the correct answer.",
        variant: "destructive",
      });
      return;
    }

    // Prepare question data
    let questionData = {
      ...newQuestion,
      order: questions.length + 1,
    };

    // Handle different question types
    if (newQuestion.type === "multiple_choice") {
      const validOptions = newQuestion.options.filter(option => option.trim() !== "");
      if (validOptions.length < 2) {
        toast({
          title: "Insufficient options",
          description: "Multiple choice questions need at least 2 options.",
          variant: "destructive",
        });
        return;
      }
      questionData.options = validOptions;
    } else if (newQuestion.type === "true_false") {
      questionData.options = ["True", "False"];
    } else {
      // For short_answer and fill_blank, no options needed
      questionData.options = null;
    }

    addQuestionMutation.mutate(questionData);
  };

  const handleQuestionTypeChange = (type: string) => {
    setNewQuestion(prev => ({
      ...prev,
      type,
      options: type === "multiple_choice" ? ["", "", "", ""] : [],
      correctAnswer: "",
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option),
    }));
  };

  const addOption = () => {
    if (newQuestion.options.length < 6) {
      setNewQuestion(prev => ({
        ...prev,
        options: [...prev.options, ""],
      }));
    }
  };

  const removeOption = (index: number) => {
    if (newQuestion.options.length > 2) {
      setNewQuestion(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index),
        correctAnswer: prev.correctAnswer === prev.options[index] ? "" : prev.correctAnswer,
      }));
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    const icons = {
      multiple_choice: <Circle className="w-4 h-4" />,
      true_false: <SquareCheck className="w-4 h-4" />,
      short_answer: <FileText className="w-4 h-4" />,
      fill_blank: <Edit className="w-4 h-4" />,
    };
    return icons[type as keyof typeof icons] || <FileText className="w-4 h-4" />;
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels = {
      multiple_choice: "Multiple Choice",
      true_false: "True/False",
      short_answer: "Short Answer",
      fill_blank: "Fill in the Blank",
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (questionsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Assessment Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{assessment.title}</CardTitle>
              {assessment.description && (
                <CardDescription className="mt-2">{assessment.description}</CardDescription>
              )}
              <div className="flex items-center space-x-4 mt-4 text-sm text-muted-foreground">
                <span>{questions.length} questions</span>
                <span>{assessment.totalPoints} total points</span>
                {assessment.timeLimit && <span>{assessment.timeLimit} minute time limit</span>}
              </div>
            </div>
            <Badge variant={assessment.status === "published" ? "default" : "secondary"}>
              {assessment.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Questions List */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground">Questions</h2>
        <Dialog open={isAddQuestionOpen} onOpenChange={setIsAddQuestionOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-question">
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Question</DialogTitle>
              <DialogDescription>
                Create a new question for this assessment
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddQuestion} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="question-type">Question Type</Label>
                  <Select 
                    value={newQuestion.type} 
                    onValueChange={handleQuestionTypeChange}
                  >
                    <SelectTrigger data-testid="select-question-type">
                      <SelectValue placeholder="Select question type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="short_answer">Short Answer</SelectItem>
                      <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="points">Points</Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    value={newQuestion.points}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                    data-testid="input-question-points"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="question-text">Question Text</Label>
                <Textarea
                  id="question-text"
                  value={newQuestion.questionText}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, questionText: e.target.value }))}
                  placeholder="Enter your question"
                  rows={3}
                  required
                  data-testid="textarea-question-text"
                />
              </div>

              {/* Multiple Choice Options */}
              {newQuestion.type === "multiple_choice" && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Answer Options</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={addOption}
                      disabled={newQuestion.options.length >= 6}
                      data-testid="button-add-option"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-sm font-medium w-6">{String.fromCharCode(65 + index)}.</span>
                        <Input
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          className="flex-1"
                          data-testid={`input-option-${index}`}
                        />
                        {newQuestion.options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(index)}
                            data-testid={`button-remove-option-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Correct Answer */}
              <div>
                <Label htmlFor="correct-answer">Correct Answer</Label>
                {newQuestion.type === "multiple_choice" ? (
                  <Select 
                    value={newQuestion.correctAnswer} 
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, correctAnswer: value }))}
                  >
                    <SelectTrigger data-testid="select-correct-answer">
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      {newQuestion.options
                        .filter(option => option.trim() !== "")
                        .map((option, index) => (
                          <SelectItem key={index} value={option}>
                            {String.fromCharCode(65 + index)}. {option}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                ) : newQuestion.type === "true_false" ? (
                  <Select 
                    value={newQuestion.correctAnswer} 
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, correctAnswer: value }))}
                  >
                    <SelectTrigger data-testid="select-true-false-answer">
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="correct-answer"
                    value={newQuestion.correctAnswer}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, correctAnswer: e.target.value }))}
                    placeholder="Enter the correct answer"
                    required
                    data-testid="input-correct-answer"
                  />
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddQuestionOpen(false)}
                  data-testid="button-cancel-question"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addQuestionMutation.isPending}
                  data-testid="button-save-question"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {addQuestionMutation.isPending ? "Adding..." : "Add Question"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Questions Display */}
      {questions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No questions yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first question to get started with this assessment.
            </p>
            <Button onClick={() => setIsAddQuestionOpen(true)} data-testid="button-add-first-question">
              <Plus className="w-4 h-4 mr-2" />
              Add First Question
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question: any, index: number) => (
            <Card key={question.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-2">
                    {getQuestionTypeIcon(question.type)}
                    <Badge variant="outline">
                      {getQuestionTypeLabel(question.type)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Question {index + 1} • {question.points} points
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" data-testid={`button-edit-question-${question.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" data-testid={`button-delete-question-${question.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {question.questionText}
                  </h3>
                </div>

                {/* Display options for multiple choice */}
                {question.type === "multiple_choice" && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option: string, optionIndex: number) => (
                      <div 
                        key={optionIndex} 
                        className={`flex items-center space-x-2 p-2 rounded ${
                          option === question.correctAnswer 
                            ? "bg-secondary/20 border border-secondary/30" 
                            : "bg-muted/50"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>
                        <span className="flex-1">{option}</span>
                        {option === question.correctAnswer && (
                          <CheckCircle className="w-4 h-4 text-secondary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Display correct answer for other types */}
                {question.type !== "multiple_choice" && (
                  <div className="bg-secondary/20 border border-secondary/30 rounded p-3">
                    <span className="text-sm font-medium text-muted-foreground">Correct Answer: </span>
                    <span className="font-medium">{question.correctAnswer}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assessment Actions */}
      {questions.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-foreground">Assessment Status</h3>
                <p className="text-muted-foreground text-sm">
                  {questions.length} questions • {assessment.totalPoints} total points
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" data-testid="button-preview-assessment">
                  Preview
                </Button>
                <Button 
                  variant={assessment.status === "published" ? "secondary" : "default"}
                  data-testid="button-publish-assessment"
                >
                  {assessment.status === "published" ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
