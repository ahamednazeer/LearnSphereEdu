import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, Users, Plus, Search, ChevronLeft, ChevronRight, 
  Upload, Video, FileText, Award, Settings, Eye, Globe,
  Clock, Target, Tag, Star, DollarSign, Languages
} from "lucide-react";

interface CourseData {
  // Basic Info
  title: string;
  description: string;
  category: string;
  level: string;
  language: string;
  
  // Details
  objectives: string;
  targetAudience: string;
  prerequisites: string;
  estimatedHours: number;
  tags: string[];
  
  // Pricing & Access
  price: number;
  
  // Certificate
  certificateEnabled: boolean;
  certificateType: string;
  certificateRequirements: {
    completionPercentage: number;
    minimumGrade: number;
    assignmentsRequired: boolean;
  };
}

interface CourseCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "technology", label: "Technology", icon: "💻" },
  { value: "business", label: "Business", icon: "💼" },
  { value: "arts-humanities", label: "Arts & Humanities", icon: "🎨" },
  { value: "science-engineering", label: "Science & Engineering", icon: "🔬" },
  { value: "health-medicine", label: "Health & Medicine", icon: "🏥" },
  { value: "social-sciences", label: "Social Sciences", icon: "📚" },
  { value: "language-learning", label: "Language Learning", icon: "🗣️" },
  { value: "personal-development", label: "Personal Development", icon: "🌱" },
];

const LEVELS = [
  { value: "beginner", label: "Beginner", description: "No prior experience required" },
  { value: "intermediate", label: "Intermediate", description: "Some experience recommended" },
  { value: "advanced", label: "Advanced", description: "Extensive experience required" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
];

export default function CourseCreationWizard({ isOpen, onClose }: CourseCreationWizardProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [courseData, setCourseData] = useState<CourseData>({
    title: "",
    description: "",
    category: "",
    level: "",
    language: "en",
    objectives: "",
    targetAudience: "",
    prerequisites: "",
    estimatedHours: 0,
    tags: [],
    price: 0,
    certificateEnabled: true,
    certificateType: "completion",
    certificateRequirements: {
      completionPercentage: 80,
      minimumGrade: 70,
      assignmentsRequired: true,
    },
  });
  
  const [tagInput, setTagInput] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await authenticatedApiRequest("POST", "/api/protected/courses/enhanced", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create course");
      }
      return response.json();
    },
    onSuccess: async (createdCourse) => {
      // Upload thumbnail if provided
      if (thumbnail) {
        const formData = new FormData();
        formData.append("thumbnail", thumbnail);
        
        try {
          await authenticatedApiRequest(
            "POST", 
            `/api/protected/courses/${createdCourse.id}/thumbnail`,
            formData,
            { isFormData: true }
          );
        } catch (error) {
          console.warn("Failed to upload thumbnail:", error);
        }
      }

      // Create certificate if enabled
      if (courseData.certificateEnabled) {
        try {
          const certificateData = {
            courseId: createdCourse.id,
            type: courseData.certificateType,
            title: `Certificate of ${courseData.certificateType === 'completion' ? 'Completion' : 'Achievement'}`,
            description: `This certificate is awarded upon successful completion of ${courseData.title}`,
            requirements: JSON.stringify(courseData.certificateRequirements),
          };
          
          await authenticatedApiRequest("POST", "/api/protected/certificates", certificateData);
        } catch (error) {
          console.warn("Failed to create certificate:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] });
      onClose();
      toast({
        title: "Course created successfully!",
        description: "Your course has been created. Now let's add content!",
      });
      setLocation(`/courses/${createdCourse.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const submitData = {
      ...courseData,
      subject: courseData.category, // For backward compatibility
      tags: JSON.stringify(courseData.tags),
      price: courseData.price * 100, // Convert to cents
    };
    
    createCourseMutation.mutate(submitData);
  };

  const addTag = () => {
    if (tagInput.trim() && !courseData.tags.includes(tagInput.trim())) {
      setCourseData({
        ...courseData,
        tags: [...courseData.tags, tagInput.trim()]
      });
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCourseData({
      ...courseData,
      tags: courseData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnail(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setThumbnailPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return courseData.title.trim() && courseData.description.trim() && courseData.category && courseData.level;
      case 2:
        return courseData.objectives.trim() && courseData.targetAudience.trim() && courseData.estimatedHours > 0;
      case 3:
        return courseData.tags.length > 0;
      case 4:
        return true; // Pricing is optional
      case 5:
        return true; // Certificate settings are optional
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Course Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Course Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Complete Web Development Bootcamp"
                    value={courseData.title}
                    onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Course Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what students will learn in this course..."
                    rows={4}
                    value={courseData.description}
                    onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category *</Label>
                    <Select value={courseData.category} onValueChange={(value) => setCourseData({ ...courseData, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <span className="flex items-center gap-2">
                              <span>{cat.icon}</span>
                              {cat.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Difficulty Level *</Label>
                    <Select value={courseData.level} onValueChange={(value) => setCourseData({ ...courseData, level: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <div>
                              <div className="font-medium">{level.label}</div>
                              <div className="text-sm text-muted-foreground">{level.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Language</Label>
                  <Select value={courseData.language} onValueChange={(value) => setCourseData({ ...courseData, language: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Course Details</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="objectives">Learning Objectives *</Label>
                  <Textarea
                    id="objectives"
                    placeholder="What will students be able to do after completing this course?"
                    rows={4}
                    value={courseData.objectives}
                    onChange={(e) => setCourseData({ ...courseData, objectives: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="targetAudience">Target Audience *</Label>
                  <Textarea
                    id="targetAudience"
                    placeholder="Who is this course designed for?"
                    rows={3}
                    value={courseData.targetAudience}
                    onChange={(e) => setCourseData({ ...courseData, targetAudience: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="prerequisites">Prerequisites</Label>
                  <Textarea
                    id="prerequisites"
                    placeholder="What should students know before taking this course?"
                    rows={3}
                    value={courseData.prerequisites}
                    onChange={(e) => setCourseData({ ...courseData, prerequisites: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="estimatedHours">Estimated Course Duration (hours) *</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    min="1"
                    placeholder="e.g., 40"
                    value={courseData.estimatedHours || ""}
                    onChange={(e) => setCourseData({ ...courseData, estimatedHours: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Course Tags & Thumbnail</h3>
              <div className="space-y-4">
                <div>
                  <Label>Course Tags *</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Add a tag (e.g., JavaScript, React, Web Development)"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {courseData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                  {courseData.tags.length === 0 && (
                    <p className="text-sm text-muted-foreground">Add at least one tag to help students find your course</p>
                  )}
                </div>
                
                <div>
                  <Label>Course Thumbnail</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    {thumbnailPreview ? (
                      <div className="space-y-4">
                        <img src={thumbnailPreview} alt="Thumbnail preview" className="max-w-xs mx-auto rounded-lg" />
                        <Button type="button" variant="outline" onClick={() => {
                          setThumbnail(null);
                          setThumbnailPreview(null);
                        }}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Upload course thumbnail</p>
                          <p className="text-xs text-muted-foreground">Recommended: 1280x720px, JPG or PNG</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailChange}
                          className="hidden"
                          id="thumbnail-upload"
                        />
                        <Button type="button" variant="outline" onClick={() => document.getElementById('thumbnail-upload')?.click()}>
                          Choose File
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Pricing & Access</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="price">Course Price (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-10"
                      value={courseData.price || ""}
                      onChange={(e) => setCourseData({ ...courseData, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set to $0 for a free course. You can change this later.
                  </p>
                </div>
                
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Pricing Tips</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Free courses get more enrollments but no revenue</li>
                    <li>• Consider your target audience's budget</li>
                    <li>• You can run promotions and discounts later</li>
                    <li>• Premium courses should offer significant value</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Certificate Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="certificateEnabled"
                    checked={courseData.certificateEnabled}
                    onCheckedChange={(checked) => setCourseData({ ...courseData, certificateEnabled: !!checked })}
                  />
                  <Label htmlFor="certificateEnabled">Enable course completion certificate</Label>
                </div>
                
                {courseData.certificateEnabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <div>
                      <Label>Certificate Type</Label>
                      <Select 
                        value={courseData.certificateType} 
                        onValueChange={(value) => setCourseData({ ...courseData, certificateType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completion">Certificate of Completion</SelectItem>
                          <SelectItem value="achievement">Certificate of Achievement</SelectItem>
                          <SelectItem value="verified">Verified Certificate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Completion Requirements</Label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <Label htmlFor="completionPercentage" className="text-sm">Course Completion (%)</Label>
                          <Input
                            id="completionPercentage"
                            type="number"
                            min="1"
                            max="100"
                            value={courseData.certificateRequirements.completionPercentage}
                            onChange={(e) => setCourseData({
                              ...courseData,
                              certificateRequirements: {
                                ...courseData.certificateRequirements,
                                completionPercentage: parseInt(e.target.value) || 80
                              }
                            })}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="minimumGrade" className="text-sm">Minimum Grade (%)</Label>
                          <Input
                            id="minimumGrade"
                            type="number"
                            min="1"
                            max="100"
                            value={courseData.certificateRequirements.minimumGrade}
                            onChange={(e) => setCourseData({
                              ...courseData,
                              certificateRequirements: {
                                ...courseData.certificateRequirements,
                                minimumGrade: parseInt(e.target.value) || 70
                              }
                            })}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-3">
                        <Checkbox
                          id="assignmentsRequired"
                          checked={courseData.certificateRequirements.assignmentsRequired}
                          onCheckedChange={(checked) => setCourseData({
                            ...courseData,
                            certificateRequirements: {
                              ...courseData.certificateRequirements,
                              assignmentsRequired: !!checked
                            }
                          })}
                        />
                        <Label htmlFor="assignmentsRequired" className="text-sm">Require all assignments to be completed</Label>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Certificate Benefits
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Increases course completion rates</li>
                    <li>• Provides value to students</li>
                    <li>• Can be shared on LinkedIn and resumes</li>
                    <li>• Builds your course credibility</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Create New Course
          </DialogTitle>
          <DialogDescription>
            Follow these steps to create a comprehensive course that students will love
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
          
          {/* Step Content */}
          <div className="min-h-[400px]">
            {renderStep()}
          </div>
          
          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            <div className="flex gap-2">
              {currentStep === totalSteps ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid() || createCourseMutation.isPending}
                >
                  {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid()}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}