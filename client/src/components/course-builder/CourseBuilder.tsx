import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, Users, FileText, MessageCircle, Plus, Download, Calendar, Clock,
  GripVertical, Eye, Settings, Upload, Play, FileIcon, Link, HelpCircle,
  ChevronDown, ChevronRight, Trash2, Edit3, Save, X, Check, ZoomIn, ZoomOut
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
// @ts-ignore
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Document, Page, pdfjs } from 'react-pdf';
import { ContentMetadata } from "./ContentMetadata";

// Set up PDF.js worker - use local worker file to avoid CDN issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Calculate estimated reading time for text content
const calculateReadingTime = (text: string): string => {
  if (!text || typeof text !== 'string') return '0:30';
  
  // Remove HTML tags and get plain text
  const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (!plainText) return '0:30';
  
  // Count words
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
  
  if (wordCount === 0) return '0:30';
  
  // Average reading speed: 200 words per minute (more realistic)
  const readingTimeMinutes = wordCount / 200;
  const totalSeconds = Math.max(30, Math.round(readingTimeMinutes * 60));
  
  // Format as MM:SS
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Auto-calculate duration based on content type and content
const calculateAutoDuration = (contentType: string, content?: string): string => {
  switch (contentType) {
    case 'article':
    case 'text':
      if (content && content.trim()) {
        return calculateReadingTime(content);
      }
      return '3:00'; // 3 minutes default
      
    case 'video':
      return '8:00'; // 8 minutes default (will be updated when video is uploaded)
      
    case 'pdf':
      return '10:00'; // 10 minutes default
      
    case 'file':
      return '5:00'; // 5 minutes default for general files
      
    case 'quiz':
      if (content && content.trim()) {
        const readingTime = calculateReadingTime(content);
        const [minutes, seconds] = readingTime.split(':').map(Number);
        const totalSeconds = (minutes * 60 + seconds) * 1.5; // 1.5x reading time for quizzes
        const finalMinutes = Math.floor(totalSeconds / 60);
        const finalSeconds = Math.floor(totalSeconds % 60);
        return `${Math.max(2, finalMinutes)}:${finalSeconds.toString().padStart(2, '0')}`;
      }
      return '5:00'; // 5 minutes default
      
    default:
      return '3:00'; // 3 minutes default
  }
};

// Format duration in seconds to MM:SS format
const formatDuration = (durationInSeconds: number): string => {
  if (isNaN(durationInSeconds) || durationInSeconds <= 0) {
    return '0:00';
  }
  
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = Math.floor(durationInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Parse MM:SS format to seconds
const parseDurationToSeconds = (durationString: string): number => {
  if (!durationString || typeof durationString !== 'string') return 0;
  
  const parts = durationString.split(':');
  if (parts.length !== 2) return 0;
  
  const minutes = parseInt(parts[0], 10) || 0;
  const seconds = parseInt(parts[1], 10) || 0;
  
  return minutes * 60 + seconds;
};

// Extract video duration from file
const getVideoDuration = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    let objectUrl: string | null = null;
    let resolved = false;
    
    const cleanup = () => {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.src = '';
    };
    
    const resolveOnce = (duration: string) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(duration);
      }
    };
    
    const onLoadedMetadata = () => {
      const duration = video.duration;
      resolveOnce(formatDuration(duration));
    };
    
    const onError = () => {
      resolveOnce('10:00'); // fallback duration
    };
    
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
    
    // Set a timeout to avoid hanging
    setTimeout(() => {
      resolveOnce('10:00'); // fallback duration
    }, 5000);
    
    try {
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
    } catch (error) {
      resolveOnce('10:00'); // fallback duration
    }
  });
};

interface Lesson {
  id?: string;
  title: string;
  contentType: 'video' | 'pdf' | 'file' | 'article' | 'quiz' | 'text';
  url?: string;
  content?: string;
  duration?: string; // Display format (MM:SS)
  description?: string;
  quiz?: QuizQuestion[];
  completed?: boolean;
  sequenceOrder: number;
  
  // Content metadata fields
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileHash?: string;
  uploadedAt?: number;
  durationSeconds?: number; // Numeric duration for metadata component
  
  // Video-specific metadata
  videoWidth?: number;
  videoHeight?: number;
  videoBitrate?: number;
  videoCodec?: string;
  audioCodec?: string;
  
  // PDF-specific metadata
  pdfPages?: number;
  pdfVersion?: string;
  
  // Text content metadata
  wordCount?: number;
  readingTime?: number;
  
  // General
  thumbnailUrl?: string;
}

interface Module {
  id?: string;
  title: string;
  description?: string;
  lessons: Lesson[];
  sequenceOrder: number;
  expanded?: boolean;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

interface CourseBuilderProps {
  courseId: string;
  course: any;
}

export default function CourseBuilder({ courseId, course }: CourseBuilderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [activeTab, setActiveTab] = useState<'structure' | 'content' | 'settings' | 'preview'>('structure');
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: 'module' | 'lesson', moduleIndex: number, lessonIndex?: number } | null>(null);
  
  // Note: PDF viewer state is now managed locally in ContentEditor component

  // Course settings state
  const [courseSettings, setCourseSettings] = useState({
    title: course?.title || "",
    description: course?.description || "",
    objectives: course?.objectives || "",
    category: course?.subject || "",
    targetAudience: course?.targetAudience || "beginner",
    duration: course?.duration || "",
    thumbnail: null as File | null,
    isPublished: course?.isPublished || false,
  });

  // Fetch existing modules with lessons
  const { data: existingModules, isLoading: modulesLoading } = useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}/modules`);
      if (!response.ok) throw new Error("Failed to fetch modules");
      return response.json();
    },
    enabled: !!courseId
  });

  useEffect(() => {
    if (existingModules && existingModules.length > 0) {
      const builderModules: Module[] = existingModules.map((mod: any, index: number) => ({
        id: mod.id,
        title: mod.title,
        description: mod.description || "",
        sequenceOrder: index,
        expanded: true,
        lessons: mod.lessons?.map((lesson: any, lessonIndex: number) => ({
          id: lesson.id,
          title: lesson.title,
          contentType: lesson.contentType,
          url: lesson.contentUrl || lesson.url || "",
          content: lesson.content || "",
          duration: lesson.duration || "",
          description: lesson.description || "",
          sequenceOrder: lessonIndex,
          completed: lesson.completed || false,
          quiz: lesson.quiz || [],
          
          // Content metadata
          fileName: lesson.fileName,
          fileSize: lesson.fileSize,
          mimeType: lesson.mimeType,
          fileHash: lesson.fileHash,
          uploadedAt: lesson.uploadedAt,
          durationSeconds: lesson.durationSeconds || parseDurationToSeconds(lesson.duration || ""),
          
          // Video metadata
          videoWidth: lesson.videoWidth,
          videoHeight: lesson.videoHeight,
          videoBitrate: lesson.videoBitrate,
          videoCodec: lesson.videoCodec,
          audioCodec: lesson.audioCodec,
          
          // PDF metadata
          pdfPages: lesson.pdfPages,
          pdfVersion: lesson.pdfVersion,
          
          // Text metadata
          wordCount: lesson.wordCount,
          readingTime: lesson.readingTime,
          
          // General
          thumbnailUrl: lesson.thumbnailUrl
        })) || []
      }));
      setModules(builderModules);
    } else {
      // Initialize with default module if no existing modules
      setModules([{
        title: "Module 1",
        description: "",
        sequenceOrder: 0,
        expanded: true,
        lessons: [{
          title: "Introduction",
          contentType: "video",
          url: "",
          content: "",
          sequenceOrder: 0
        }]
      }]);
    }
  }, [existingModules]);

  // Add new module
  const addModule = () => {
    const newModule: Module = {
      title: `Module ${modules.length + 1}`,
      description: "",
      sequenceOrder: modules.length,
      expanded: true,
      lessons: [{
        title: "Introduction",
        contentType: "video",
        url: "",
        content: "",
        sequenceOrder: 0
      }]
    };
    setModules([...modules, newModule]);
  };

  // Add new lesson to module
  const addLesson = (moduleIndex: number) => {
    const newModules = [...modules];
    const newLesson: Lesson = {
      title: `Lesson ${newModules[moduleIndex].lessons.length + 1}`,
      contentType: "video",
      url: "",
      content: "",
      sequenceOrder: newModules[moduleIndex].lessons.length
    };
    newModules[moduleIndex].lessons.push(newLesson);
    setModules(newModules);
  };

  // Update module
  const updateModule = (moduleIndex: number, field: keyof Module, value: any) => {
    const newModules = [...modules];
    newModules[moduleIndex] = { ...newModules[moduleIndex], [field]: value };
    setModules(newModules);
  };

  // Update lesson with auto-duration calculation
  const updateLesson = (moduleIndex: number, lessonIndex: number, field: keyof Lesson, value: any) => {
    const newModules = [...modules];
    const lesson = newModules[moduleIndex].lessons[lessonIndex];
    
    // Update the field using type-safe assignment
    (lesson as any)[field] = value;
    
    // If duration is being updated, also update durationSeconds for metadata
    if (field === 'duration' && typeof value === 'string') {
      lesson.durationSeconds = parseDurationToSeconds(value);
    }
    
    // Auto-calculate duration only when contentType changes or when content changes for text/article types
    // and only if duration is empty or default
    const shouldAutoCalculate = (
      (field === 'contentType') || 
      (field === 'content' && (lesson.contentType === 'text' || lesson.contentType === 'article'))
    ) && (
      !lesson.duration || 
      lesson.duration === '' || 
      lesson.duration === '0:00' ||
      lesson.duration === '3:00' ||
      lesson.duration === '5:00' ||
      lesson.duration === '8:00' ||
      lesson.duration === '10:00'
    );
    
    if (shouldAutoCalculate) {
      const autoDuration = calculateAutoDuration(lesson.contentType, lesson.content);
      lesson.duration = autoDuration;
      lesson.durationSeconds = parseDurationToSeconds(autoDuration);
      console.log(`Auto-calculated duration for ${lesson.contentType} lesson:`, autoDuration);
    }
    
    setModules(newModules);
  };

  // Delete module
  const deleteModule = (moduleIndex: number) => {
    const newModules = modules.filter((_, index) => index !== moduleIndex);
    setModules(newModules);
  };

  // Delete lesson
  const deleteLesson = (moduleIndex: number, lessonIndex: number) => {
    const newModules = [...modules];
    newModules[moduleIndex].lessons = newModules[moduleIndex].lessons.filter((_, index) => index !== lessonIndex);
    setModules(newModules);
  };

  // Toggle module expansion
  const toggleModule = (moduleIndex: number) => {
    updateModule(moduleIndex, 'expanded', !modules[moduleIndex].expanded);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'module' | 'lesson', moduleIndex: number, lessonIndex?: number) => {
    setDraggedItem({ type, moduleIndex, lessonIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset drag state when drag operation ends (including cancellation)
    setDraggedItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetType: 'module' | 'lesson', targetModuleIndex: number, targetLessonIndex?: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newModules = [...modules];

    if (draggedItem.type === 'module' && targetType === 'module') {
      // Reorder modules
      const [movedModule] = newModules.splice(draggedItem.moduleIndex, 1);
      newModules.splice(targetModuleIndex, 0, movedModule);
      
      // Update sequence orders
      newModules.forEach((module, index) => {
        module.sequenceOrder = index;
      });
    } else if (draggedItem.type === 'lesson' && targetType === 'lesson' && draggedItem.lessonIndex !== undefined && targetLessonIndex !== undefined) {
      // Reorder lessons within or between modules
      const [movedLesson] = newModules[draggedItem.moduleIndex].lessons.splice(draggedItem.lessonIndex, 1);
      newModules[targetModuleIndex].lessons.splice(targetLessonIndex, 0, movedLesson);
      
      // Update sequence orders for affected modules
      newModules[draggedItem.moduleIndex].lessons.forEach((lesson, index) => {
        lesson.sequenceOrder = index;
      });
      if (draggedItem.moduleIndex !== targetModuleIndex) {
        newModules[targetModuleIndex].lessons.forEach((lesson, index) => {
          lesson.sequenceOrder = index;
        });
      }
    }

    setModules(newModules);
    setDraggedItem(null);
  };

  // Save course structure
  const saveCourse = async () => {
    try {
      setSaving(true);
      setError(null);

      console.log("Starting course save...");

      // Update course info
      const updateData = {
        title: courseSettings.title,
        subject: courseSettings.category, // Keep for backward compatibility
        category: courseSettings.category, // New field
        description: courseSettings.description,
        objectives: courseSettings.objectives,
        targetAudience: courseSettings.targetAudience,
        duration: courseSettings.duration,
      };
      
      console.log("Updating course with data:", updateData);
      console.log("Duration type:", typeof courseSettings.duration, "Value:", courseSettings.duration);
      const courseRes = await authenticatedApiRequest("PUT", `/api/protected/courses/${courseId}`, updateData);
      if (!courseRes.ok) {
        const errorData = await courseRes.json();
        console.error("Course update failed:", errorData);
        throw new Error(errorData.message || "Failed to update course");
      }
      console.log("Course updated successfully");

      // Save modules and lessons
      console.log("Saving modules and lessons...", modules.length, "modules");
      for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
        const module = modules[moduleIndex];
        
        // Give default title if empty
        let moduleTitle = module.title.trim();
        if (!moduleTitle) {
          moduleTitle = `Module ${moduleIndex + 1}`;
          console.log(`Module ${moduleIndex} has no title, using default: ${moduleTitle}`);
        }
        
        const moduleData = {
          title: moduleTitle,
          description: module.description || "",
          sequenceOrder: moduleIndex,
        };

        let moduleId = module.id;
        if (moduleId) {
          // Update existing module
          console.log(`Updating existing module ${moduleIndex}:`, moduleData);
          const modRes = await authenticatedApiRequest("PUT", `/api/protected/modules/${moduleId}`, moduleData);
          if (!modRes.ok) {
            const errorData = await modRes.json();
            console.error("Module update failed:", errorData);
            throw new Error(errorData.message || "Failed to update module");
          }
          console.log(`Module ${moduleIndex} updated successfully`);
        } else {
          // Create new module
          console.log(`Creating new module ${moduleIndex}:`, moduleData);
          const modRes = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/modules`, moduleData);
          if (!modRes.ok) {
            const errorData = await modRes.json();
            console.error("Module creation failed:", errorData);
            throw new Error(errorData.message || "Failed to create module");
          }
          const createdModule = await modRes.json();
          moduleId = createdModule.id;
          console.log(`Module ${moduleIndex} created with ID:`, moduleId);
          // Update the module with the new ID and title
          const newModules = [...modules];
          newModules[moduleIndex].id = moduleId;
          newModules[moduleIndex].title = moduleTitle; // Update with the actual saved title
          setModules(newModules);
        }
        
        // Save lessons
        console.log(`Saving ${module.lessons.length} lessons for module ${moduleIndex}`);
        for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex++) {
          const lesson = module.lessons[lessonIndex];
          
          // Give default title if empty
          let lessonTitle = lesson.title.trim();
          if (!lessonTitle) {
            lessonTitle = `Lesson ${lessonIndex + 1}`;
            console.log(`Lesson ${lessonIndex} in module ${moduleIndex} has no title, using default: ${lessonTitle}`);
          }
          
          const lessonData = {
            title: lessonTitle,
            contentType: lesson.contentType,
            contentUrl: lesson.url || "",
            content: lesson.content || "",
            duration: lesson.duration || "",
            description: lesson.description || "",
            sequenceOrder: lessonIndex,
            
            // Content metadata fields
            fileName: lesson.fileName,
            fileSize: lesson.fileSize,
            mimeType: lesson.mimeType,
            fileHash: lesson.fileHash,
            uploadedAt: lesson.uploadedAt,
            durationSeconds: lesson.durationSeconds || parseDurationToSeconds(lesson.duration || ""),
            
            // Video-specific metadata
            videoWidth: lesson.videoWidth,
            videoHeight: lesson.videoHeight,
            videoBitrate: lesson.videoBitrate,
            videoCodec: lesson.videoCodec,
            audioCodec: lesson.audioCodec,
            
            // PDF-specific metadata
            pdfPages: lesson.pdfPages,
            pdfVersion: lesson.pdfVersion,
            
            // Text content metadata
            wordCount: lesson.wordCount,
            readingTime: lesson.readingTime,
            
            // General
            thumbnailUrl: lesson.thumbnailUrl,
            quiz: lesson.quiz || []
          };

          if (lesson.id) {
            // Update existing lesson
            console.log(`Updating existing lesson ${lessonIndex} in module ${moduleIndex}:`, lessonData);
            const lesRes = await authenticatedApiRequest("PUT", `/api/protected/lessons/${lesson.id}`, lessonData);
            if (!lesRes.ok) {
              const errorData = await lesRes.json();
              console.error("Lesson update failed:", errorData);
              throw new Error(errorData.message || "Failed to update lesson");
            }
            console.log(`Lesson ${lessonIndex} in module ${moduleIndex} updated successfully`);
          } else {
            // Create new lesson
            console.log(`Creating new lesson ${lessonIndex} in module ${moduleIndex}:`, lessonData);
            const lesRes = await authenticatedApiRequest("POST", `/api/protected/modules/${moduleId}/lessons`, lessonData);
            if (!lesRes.ok) {
              const errorData = await lesRes.json();
              console.error("Lesson creation failed:", errorData);
              throw new Error(errorData.message || "Failed to create lesson");
            }
            const createdLesson = await lesRes.json();
            console.log(`Lesson ${lessonIndex} in module ${moduleIndex} created with ID:`, createdLesson.id);
            const newModules = [...modules];
            newModules[moduleIndex].lessons[lessonIndex].id = createdLesson.id;
            newModules[moduleIndex].lessons[lessonIndex].title = lessonTitle; // Update with the actual saved title
            setModules(newModules);
          }
        }
      }

      // Refresh data
      console.log("Refreshing data...");
      queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses", courseId] });
      
      console.log("Course save completed successfully!");
      toast({ title: "Course saved successfully!", description: "All changes have been saved." });
    } catch (err: any) {
      setError(err.message || "Failed to save course");
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Calculate course progress
  const calculateProgress = () => {
    const totalLessons = modules.reduce((total, module) => total + module.lessons.length, 0);
    const completedLessons = modules.reduce((total, module) => 
      total + module.lessons.filter(lesson => lesson.completed).length, 0
    );
    return totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  };

  if (modulesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Course Builder</h2>
          <p className="text-muted-foreground">Create and manage your course content</p>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={calculateProgress()} className="w-32" />
          <span className="text-sm text-muted-foreground">{Math.round(calculateProgress())}% complete</span>
          <Button onClick={saveCourse} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Course
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="structure">Course Structure</TabsTrigger>
          <TabsTrigger value="content">Content Editor</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Course Structure Tab */}
        <TabsContent value="structure" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Course Structure</h3>
            <Button onClick={addModule} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
          </div>

          <div className="space-y-4">
            {modules.map((module, moduleIndex) => (
              <Card 
                key={moduleIndex}
                className="border-l-4 border-l-primary"
                draggable
                onDragStart={(e) => handleDragStart(e, 'module', moduleIndex)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'module', moduleIndex)}
                onDragEnd={handleDragEnd}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleModule(moduleIndex)}
                      >
                        {module.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                      <div className="flex-1">
                        <Input
                          value={module.title}
                          onChange={(e) => updateModule(moduleIndex, 'title', e.target.value)}
                          placeholder={`Module ${moduleIndex + 1} Title`}
                          className="font-semibold border-none p-0 h-auto text-lg"
                        />
                        <Input
                          value={module.description || ""}
                          onChange={(e) => updateModule(moduleIndex, 'description', e.target.value)}
                          placeholder="Module description (optional)"
                          className="text-sm text-muted-foreground border-none p-0 h-auto mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteModule(moduleIndex)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {module.expanded && (
                  <CardContent className="pt-0">
                    <div className="space-y-3 ml-6">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <div
                          key={lessonIndex}
                          className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'lesson', moduleIndex, lessonIndex)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'lesson', moduleIndex, lessonIndex)}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                          
                          {/* Content Type Icon */}
                          <div className="flex-shrink-0">
                            {lesson.contentType === 'video' && <Play className="w-4 h-4 text-blue-500" />}
                            {lesson.contentType === 'pdf' && <FileIcon className="w-4 h-4 text-red-500" />}
                            {lesson.contentType === 'article' && <Link className="w-4 h-4 text-green-500" />}
                            {lesson.contentType === 'quiz' && <HelpCircle className="w-4 h-4 text-purple-500" />}
                            {lesson.contentType === 'text' && <FileText className="w-4 h-4 text-gray-500" />}
                          </div>

                          <div className="flex-1 space-y-2">
                            <Input
                              value={lesson.title}
                              onChange={(e) => updateLesson(moduleIndex, lessonIndex, 'title', e.target.value)}
                              placeholder={`Lesson ${lessonIndex + 1} Title`}
                              className="font-medium border-none p-0 h-auto"
                            />
                            <div className="flex items-center gap-2">
                              <select
                                value={lesson.contentType}
                                onChange={(e) => updateLesson(moduleIndex, lessonIndex, 'contentType', e.target.value)}
                                className="text-sm border rounded px-2 py-1"
                              >
                                <option value="video">Video</option>
                                <option value="pdf">PDF</option>
                                <option value="article">Article</option>
                                <option value="text">Text Content</option>
                                <option value="quiz">Quiz</option>
                              </select>
                              <div className="flex items-center gap-1">
                                <Input
                                  value={lesson.duration || ""}
                                  onChange={(e) => updateLesson(moduleIndex, lessonIndex, 'duration', e.target.value)}
                                  placeholder="Duration (e.g., 10 min)"
                                  className="text-sm w-24"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const autoDuration = calculateAutoDuration(lesson.contentType, lesson.content);
                                    updateLesson(moduleIndex, lessonIndex, 'duration', autoDuration);
                                    toast({
                                      title: "Duration Updated",
                                      description: `Auto-calculated: ${autoDuration}`,
                                    });
                                  }}
                                  className="p-1 h-6 w-6"
                                  title="Auto-calculate duration"
                                >
                                  <Clock className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedModule(moduleIndex);
                                setSelectedLesson(lessonIndex);
                                setActiveTab('content');
                              }}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteLesson(moduleIndex, lessonIndex)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addLesson(moduleIndex)}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Lesson
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Content Editor Tab */}
        <TabsContent value="content" className="space-y-4">
          <ContentEditor
            modules={modules}
            selectedModule={selectedModule}
            selectedLesson={selectedLesson}
            onUpdateLesson={updateLesson}
            onSelectLesson={(moduleIndex, lessonIndex) => {
              setSelectedModule(moduleIndex);
              setSelectedLesson(lessonIndex);
            }}
            onSaveCourse={saveCourse}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <CourseSettings
            settings={courseSettings}
            onUpdateSettings={setCourseSettings}
            modules={modules}
          />
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <CoursePreview
            course={{ ...course, ...courseSettings }}
            modules={modules}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Content Editor Component
function ContentEditor({ 
  modules, 
  selectedModule, 
  selectedLesson, 
  onUpdateLesson, 
  onSelectLesson,
  onSaveCourse
}: {
  modules: Module[];
  selectedModule: number | null;
  selectedLesson: number | null;
  onUpdateLesson: (moduleIndex: number, lessonIndex: number, field: keyof Lesson, value: any) => void;
  onSelectLesson: (moduleIndex: number, lessonIndex: number) => void;
  onSaveCourse: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // PDF viewer state for ContentEditor
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);

  if (selectedModule === null || selectedLesson === null) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Select a lesson to edit</h3>
        <p className="text-muted-foreground">Choose a lesson from the course structure to start editing its content.</p>
      </div>
    );
  }

  const lesson = modules[selectedModule]?.lessons[selectedLesson];
  if (!lesson) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Store current lesson context to prevent race conditions
    const currentModuleIndex = selectedModule;
    const currentLessonIndex = selectedLesson;
    const currentLesson = modules[currentModuleIndex!]?.lessons[currentLessonIndex!];
    
    if (!currentLesson) {
      toast({
        title: "Upload Error",
        description: "No lesson selected for file upload.",
        variant: "destructive",
      });
      return;
    }

    console.log('File upload started:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      contentType: currentLesson.contentType,
      moduleIndex: currentModuleIndex,
      lessonIndex: currentLessonIndex
    });

    // Validate file type based on lesson content type
    const validTypes: Record<string, string[]> = {
      video: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
      pdf: ['application/pdf'],
      file: [] // Allow any file type for general files
    };

    const expectedTypes = validTypes[currentLesson.contentType];
    if (expectedTypes && expectedTypes.length > 0 && !expectedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: `Please select a ${currentLesson.contentType.toUpperCase()} file. Selected: ${file.type}`,
        variant: "destructive",
      });
      // Clear the input
      e.target.value = '';
      return;
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: `File size must be less than 50MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Show upload progress
      toast({
        title: "Uploading File",
        description: `Uploading ${file.name}...`,
      });

      // If lesson doesn't have an ID, we need to save it first
      if (!currentLesson.id) {
        toast({
          title: "Saving lesson first...",
          description: "Creating lesson before uploading file.",
        });
        
        // Save the course first to get lesson IDs
        await onSaveCourse();
        
        // Get the updated lesson with ID
        const updatedLesson = modules[currentModuleIndex!]?.lessons[currentLessonIndex!];
        if (!updatedLesson?.id) {
          throw new Error("Failed to create lesson. Please try saving the course first.");
        }
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('Uploading file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        lessonId: currentLesson.id
      });

      // Upload file to server using lesson-specific endpoint
      const uploadResponse = await authenticatedApiRequest("POST", `/api/protected/lessons/${currentLesson.id}/upload`, formData);

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || "Failed to upload file");
      }

      const uploadResult = await uploadResponse.json();
      
      console.log('Upload result from server:', uploadResult);
      
      // Update lesson with file information from server response (use stored indices)
      onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'url', uploadResult.url);
      onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'fileName', uploadResult.fileName);
      onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'fileSize', uploadResult.fileSize);
      onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'mimeType', uploadResult.mimeType);
      onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'uploadedAt', uploadResult.uploadedAt);

      // Update metadata fields if available
      if (uploadResult.metadata) {
        const metadata = uploadResult.metadata;
        
        // Video metadata (can be nested in videoInfo object)
        if (metadata.videoInfo) {
          const videoInfo = metadata.videoInfo;
          if (videoInfo.width) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoWidth', videoInfo.width);
          if (videoInfo.height) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoHeight', videoInfo.height);
          if (videoInfo.bitrate) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoBitrate', videoInfo.bitrate);
          if (videoInfo.videoCodec) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoCodec', videoInfo.videoCodec);
          if (videoInfo.audioCodec) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'audioCodec', videoInfo.audioCodec);
        } else {
          // Fallback to direct properties (for backward compatibility)
          if (metadata.videoWidth) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoWidth', metadata.videoWidth);
          if (metadata.videoHeight) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoHeight', metadata.videoHeight);
          if (metadata.videoBitrate) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoBitrate', metadata.videoBitrate);
          if (metadata.videoCodec) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'videoCodec', metadata.videoCodec);
          if (metadata.audioCodec) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'audioCodec', metadata.audioCodec);
        }
        
        // PDF metadata (can be nested in pdfInfo object)
        if (metadata.pdfInfo) {
          const pdfInfo = metadata.pdfInfo;
          if (pdfInfo.pages) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'pdfPages', pdfInfo.pages);
          if (pdfInfo.version) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'pdfVersion', pdfInfo.version);
        } else {
          // Fallback to direct properties
          if (metadata.pdfPages) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'pdfPages', metadata.pdfPages);
          if (metadata.pdfVersion) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'pdfVersion', metadata.pdfVersion);
        }
        
        // Text metadata (can be nested in textInfo object)
        if (metadata.textInfo) {
          const textInfo = metadata.textInfo;
          if (textInfo.wordCount) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'wordCount', textInfo.wordCount);
          if (textInfo.readingTime && textInfo.readingTime.seconds) {
            onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'readingTime', textInfo.readingTime.seconds);
          }
        } else {
          // Fallback to direct properties
          if (metadata.wordCount) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'wordCount', metadata.wordCount);
          if (metadata.readingTime) onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'readingTime', metadata.readingTime);
        }
        
        // Duration from server (can be number or object with seconds/formatted)
        if (metadata.duration) {
          let durationSeconds: number;
          let durationString: string;
          
          if (typeof metadata.duration === 'object' && metadata.duration.seconds) {
            // Server returns {seconds: number, formatted: string}
            durationSeconds = metadata.duration.seconds;
            durationString = metadata.duration.formatted;
          } else if (typeof metadata.duration === 'number') {
            // Server returns just the number
            durationSeconds = metadata.duration;
            durationString = formatDuration(metadata.duration);
          } else {
            // Fallback
            durationSeconds = 0;
            durationString = '0:00';
          }
          
          onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'duration', durationString);
          onUpdateLesson(currentModuleIndex!, currentLessonIndex!, 'durationSeconds', durationSeconds);
        }
      }

      toast({
        title: "File Uploaded Successfully",
        description: `${file.name} has been uploaded with metadata extracted.`,
      });

      // Clear the input to allow re-uploading the same file if needed
      e.target.value = '';

    } catch (error: any) {
      console.error('File upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      
      // Clear the input on error too
      e.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Lesson Navigation */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Course Navigation</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {modules.map((module, moduleIndex) => (
                <div key={moduleIndex}>
                  <div className="px-3 py-2 font-medium text-sm border-b">
                    {module.title || `Module ${moduleIndex + 1}`}
                  </div>
                  {module.lessons.map((lessonItem, lessonIndex) => (
                    <button
                      key={lessonIndex}
                      onClick={() => onSelectLesson(moduleIndex, lessonIndex)}
                      className={`w-full text-left px-6 py-2 text-sm hover:bg-muted/50 ${
                        selectedModule === moduleIndex && selectedLesson === lessonIndex
                          ? 'bg-primary/10 text-primary border-r-2 border-primary'
                          : ''
                      }`}
                    >
                      {lessonItem.title || `Lesson ${lessonIndex + 1}`}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Editor */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Edit Lesson Content</CardTitle>
            <CardDescription>
              Editing: {lesson.title || `Lesson ${selectedLesson + 1}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lesson Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Lesson Title</Label>
                <Input
                  value={lesson.title}
                  onChange={(e) => onUpdateLesson(selectedModule, selectedLesson, 'title', e.target.value)}
                  placeholder="Enter lesson title"
                />
              </div>
              <div>
                <Label>Duration</Label>
                <div className="flex gap-2">
                  <Input
                    value={lesson.duration || ""}
                    onChange={(e) => onUpdateLesson(selectedModule, selectedLesson, 'duration', e.target.value)}
                    placeholder="e.g., 15 minutes"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const autoDuration = calculateAutoDuration(lesson.contentType, lesson.content);
                      onUpdateLesson(selectedModule, selectedLesson, 'duration', autoDuration);
                      // Also update the numeric duration for metadata
                      const durationInSeconds = parseDurationToSeconds(autoDuration);
                      onUpdateLesson(selectedModule, selectedLesson, 'durationSeconds', durationInSeconds);
                      
                      let description = `Auto-calculated duration: ${autoDuration}`;
                      if (lesson.contentType === 'video' && !lesson.url) {
                        description += ' (Upload a video file for accurate duration)';
                      } else if (lesson.contentType === 'article' || lesson.contentType === 'text') {
                        description += ' (Based on reading time)';
                      }
                      
                      toast({
                        title: "Duration Updated",
                        description,
                      });
                    }}
                    className="whitespace-nowrap"
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Auto
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label>Lesson Description</Label>
              <Textarea
                value={lesson.description || ""}
                onChange={(e) => onUpdateLesson(selectedModule, selectedLesson, 'description', e.target.value)}
                placeholder="Brief description of what students will learn"
                rows={3}
              />
            </div>

            {/* Content Type Selector */}
            <div>
              <Label>Content Type</Label>
              <select
                value={lesson.contentType}
                onChange={(e) => onUpdateLesson(selectedModule, selectedLesson, 'contentType', e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="video">Video</option>
                <option value="pdf">PDF Document</option>
                <option value="file">File (Documents, Images, etc.)</option>
                <option value="article">Article (External Link)</option>
                <option value="text">Text Content</option>
                <option value="quiz">Quiz</option>
              </select>
            </div>

            {/* Content Type Specific Editors */}
            {lesson.contentType === 'video' && (
              <div className="space-y-4">
                <div>
                  <Label>Video File</Label>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="video/*"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {lesson.fileName ? 'Change Video' : 'Upload Video'}
                    </Button>
                    {lesson.fileName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileIcon className="w-4 h-4" />
                        <span>{lesson.fileName}</span>
                        {lesson.fileSize && (
                          <span>({(lesson.fileSize / (1024 * 1024)).toFixed(2)} MB)</span>
                        )}
                      </div>
                    )}
                  </div>
                  {lesson.url && (
                    <div className="mt-2">
                      <video src={lesson.url} controls className="w-full max-h-64 rounded" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {lesson.contentType === 'pdf' && (
              <div className="space-y-4">
                <div>
                  <Label>PDF File</Label>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id={`pdf-upload-${selectedModule}-${selectedLesson}`}
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const input = document.getElementById(`pdf-upload-${selectedModule}-${selectedLesson}`) as HTMLInputElement;
                        if (input) {
                          input.click();
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {lesson.fileName ? 'Change PDF' : 'Upload PDF'}
                    </Button>
                  </div>
                  {lesson.fileName && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <div className="flex items-center gap-2">
                        <FileIcon className="w-4 h-4 text-red-500" />
                        <span className="font-medium">{lesson.fileName}</span>
                        {lesson.fileSize && (
                          <span className="text-muted-foreground">
                            ({(lesson.fileSize / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        )}
                      </div>
                      {lesson.pdfPages && (
                        <div className="text-muted-foreground mt-1">
                          {lesson.pdfPages} pages
                        </div>
                      )}
                    </div>
                  )}
                  {lesson.url && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm">PDF Preview:</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPdfViewer(!showPdfViewer)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            {showPdfViewer ? 'Hide' : 'Show'} PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const viewerUrl = `${lesson.url}?inline=true`;
                              window.open(viewerUrl, '_blank');
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Open in Tab
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = lesson.url!;
                              link.download = lesson.fileName || 'document.pdf';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                      
                      {showPdfViewer && (
                        <div className="border rounded overflow-hidden bg-white">
                          <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPdfPageNumber(Math.max(1, pdfPageNumber - 1))}
                                disabled={pdfPageNumber <= 1}
                              >
                                Previous
                              </Button>
                              <span className="text-sm">
                                Page {pdfPageNumber} of {pdfNumPages || '?'}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPdfPageNumber(Math.min(pdfNumPages || 1, pdfPageNumber + 1))}
                                disabled={pdfPageNumber >= (pdfNumPages || 1)}
                              >
                                Next
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPdfScale(Math.max(0.5, pdfScale - 0.1))}
                              >
                                <ZoomOut className="w-3 h-3" />
                              </Button>
                              <span className="text-sm">{Math.round(pdfScale * 100)}%</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPdfScale(Math.min(2.0, pdfScale + 0.1))}
                              >
                                <ZoomIn className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="max-h-96 overflow-auto flex justify-center p-4">
                            <Document
                              file={lesson.url}
                              onLoadSuccess={({ numPages }) => {
                                setPdfNumPages(numPages);
                                setPdfPageNumber(1);
                              }}
                              onLoadError={(error) => {
                                console.error('PDF load error:', error);
                                toast({
                                  title: "PDF Load Error",
                                  description: "Failed to load PDF. Please try again.",
                                  variant: "destructive",
                                });
                              }}
                            >
                              <Page
                                pageNumber={pdfPageNumber}
                                scale={pdfScale}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                            </Document>
                          </div>
                        </div>
                      )}
                      
                      {!showPdfViewer && (
                        <div className="border rounded overflow-hidden bg-gray-50">
                          <div className="p-4 text-center">
                            <div className="w-16 h-16 mx-auto mb-3 text-red-500">
                              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium mb-2">PDF Document Ready</p>
                            <p className="text-xs text-muted-foreground mb-3">
                              Click "Show PDF" to preview inline, "Open in Tab" to view in new tab, or "Download" to save locally
                            </p>
                            <div className="text-xs text-muted-foreground">
                              {lesson.fileName && <div>File: {lesson.fileName}</div>}
                              {lesson.fileSize && <div>Size: {(lesson.fileSize / (1024 * 1024)).toFixed(2)} MB</div>}
                              {lesson.pdfPages && <div>Pages: {lesson.pdfPages}</div>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {lesson.contentType === 'article' && (
              <div className="space-y-4">
                <div>
                  <Label>Article URL</Label>
                  <Input
                    value={lesson.url || ""}
                    onChange={(e) => onUpdateLesson(selectedModule, selectedLesson, 'url', e.target.value)}
                    placeholder="https://example.com/article"
                    type="url"
                  />
                  {lesson.url && (
                    <div className="mt-2">
                      <a 
                        href={lesson.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <Link className="w-4 h-4" />
                        Preview Article
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Article Summary (Optional)</Label>
                  <Textarea
                    value={lesson.content || ""}
                    onChange={(e) => onUpdateLesson(selectedModule, selectedLesson, 'content', e.target.value)}
                    placeholder="Brief summary of the article content for students..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {lesson.contentType === 'text' && (
              <div className="space-y-4">
                <div>
                  <Label>Text Content</Label>
                  <div className="border rounded">
                    {typeof window !== 'undefined' ? (
                      <ReactQuill
                        theme="snow"
                        value={lesson.content || ""}
                        onChange={(value) => {
                          onUpdateLesson(selectedModule, selectedLesson, 'content', value);
                          // Auto-calculate duration when content changes
                          if (value && value.trim() !== '') {
                            const autoDuration = calculateAutoDuration('text', value);
                            if (!lesson.duration || lesson.duration === '') {
                              onUpdateLesson(selectedModule, selectedLesson, 'duration', autoDuration);
                              onUpdateLesson(selectedModule, selectedLesson, 'durationSeconds', parseDurationToSeconds(autoDuration));
                            }
                          }
                        }}
                        placeholder="Enter your lesson content here..."
                        style={{ height: '300px' }}
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link', 'image'],
                            ['clean']
                          ],
                        }}
                      />
                    ) : (
                      <Textarea
                        value={lesson.content || ""}
                        onChange={(e) => onUpdateLesson(selectedModule, selectedLesson, 'content', e.target.value)}
                        placeholder="Enter your lesson content here..."
                        rows={15}
                        className="min-h-[300px]"
                      />
                    )}
                  </div>
                  <div style={{ height: '50px' }}></div> {/* Spacer for ReactQuill */}
                </div>
              </div>
            )}

            {lesson.contentType === 'quiz' && (
              <div className="space-y-4">
                <QuizEditor
                  quiz={lesson.quiz || []}
                  onChange={(quiz) => onUpdateLesson(selectedModule, selectedLesson, 'quiz', quiz)}
                />
              </div>
            )}

            {/* Content Metadata */}
            <div className="mt-6">
              <ContentMetadata lesson={{
                ...lesson,
                // Keep original duration string, add durationSeconds for numeric operations
                durationSeconds: lesson.durationSeconds || parseDurationToSeconds(lesson.duration || "")
              }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Quiz Editor Component
function QuizEditor({ quiz, onChange }: { quiz: QuizQuestion[]; onChange: (quiz: QuizQuestion[]) => void }) {
  const { toast } = useToast();
  
  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      question: "",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      answer: 0,
      explanation: ""
    };
    onChange([...quiz, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const newQuiz = [...quiz];
    newQuiz[index] = { ...newQuiz[index], [field]: value };
    onChange(newQuiz);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuiz = [...quiz];
    const newOptions = [...newQuiz[questionIndex].options];
    newOptions[optionIndex] = value;
    newQuiz[questionIndex] = { ...newQuiz[questionIndex], options: newOptions };
    onChange(newQuiz);
  };

  const removeQuestion = (index: number) => {
    onChange(quiz.filter((_, i) => i !== index));
  };

  const validateQuiz = () => {
    const incompleteQuestions = quiz.filter(q => 
      !q.question.trim() || 
      q.options.some(opt => !opt.trim()) ||
      q.options.filter(opt => opt.trim()).length < 2 ||
      q.answer < 0 || q.answer >= q.options.length // Validate answer index is within bounds
    );
    
    if (incompleteQuestions.length > 0) {
      toast({
        title: "Incomplete Quiz Questions",
        description: `${incompleteQuestions.length} question(s) need to be completed with question text, at least 2 options, and a valid correct answer.`,
        variant: "destructive",
      });
      return false;
    }
    
    toast({
      title: "Quiz Validation Passed",
      description: `All ${quiz.length} question(s) are complete and ready for students.`,
    });
    return true;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-lg font-medium">Quiz Questions</Label>
        <div className="flex gap-2">
          <Button onClick={validateQuiz} variant="outline" size="sm">
            <Check className="w-4 h-4 mr-2" />
            Validate Quiz
          </Button>
          <Button onClick={addQuestion} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </div>
      </div>

      {quiz.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No quiz questions yet. Add your first question to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {quiz.map((question, questionIndex) => (
            <Card key={questionIndex}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">Question {questionIndex + 1}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(questionIndex)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Question</Label>
                  <Textarea
                    value={question.question}
                    onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                    placeholder="Enter your question here..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Answer Options</Label>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`question-${questionIndex}`}
                          checked={question.answer === optionIndex}
                          onChange={() => updateQuestion(questionIndex, 'answer', optionIndex)}
                          className="flex-shrink-0"
                        />
                        <Input
                          value={option}
                          onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                          placeholder={`Option ${optionIndex + 1}`}
                          className="flex-1"
                        />
                        {question.answer === optionIndex && (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Explanation (Optional)</Label>
                  <Textarea
                    value={question.explanation || ""}
                    onChange={(e) => updateQuestion(questionIndex, 'explanation', e.target.value)}
                    placeholder="Explain why this is the correct answer..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Course Settings Component
function CourseSettings({ settings, onUpdateSettings, modules }: {
  settings: any;
  onUpdateSettings: (settings: any) => void;
  modules: Module[];
}) {
  const { toast } = useToast();
  
  // Calculate total course duration from all lessons
  const calculateTotalCourseDuration = (): string => {
    let totalSeconds = 0;
    
    modules.forEach(module => {
      module.lessons.forEach(lesson => {
        if (lesson.duration && typeof lesson.duration === 'string') {
          // Parse duration string to seconds
          const durationStr = lesson.duration.trim();
          if (durationStr.includes(':')) {
            // Format like "5:30" or "1:23:45"
            const parts = durationStr.split(':').map(Number).filter(n => !isNaN(n));
            if (parts.length === 2) {
              totalSeconds += parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
              totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
          } else {
            // Try to parse as number (seconds)
            const seconds = parseInt(durationStr);
            if (!isNaN(seconds)) {
              totalSeconds += seconds;
            }
          }
        } else if (lesson.durationSeconds && typeof lesson.durationSeconds === 'number') {
          // Use numeric duration if available
          totalSeconds += lesson.durationSeconds;
        }
      });
    });
    
    if (totalSeconds === 0) return "0 hours";
    
    // Convert to human-readable format
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0 && minutes > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({ ...settings, title: e.target.value });
  }, [settings, onUpdateSettings]);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ ...settings, category: e.target.value });
  }, [settings, onUpdateSettings]);

  const handleDescriptionChange = useCallback((value: string) => {
    onUpdateSettings({ ...settings, description: value });
  }, [settings, onUpdateSettings]);

  const handleObjectivesChange = useCallback((value: string) => {
    onUpdateSettings({ ...settings, objectives: value });
  }, [settings, onUpdateSettings]);

  const handleTargetAudienceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ ...settings, targetAudience: e.target.value });
  }, [settings, onUpdateSettings]);

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({ ...settings, duration: e.target.value });
  }, [settings, onUpdateSettings]);

  const handleThumbnailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({ ...settings, thumbnail: e.target.files?.[0] || null });
  }, [settings, onUpdateSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Settings</CardTitle>
        <CardDescription>Configure your course details and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Course Title</Label>
            <Input
              value={settings.title}
              onChange={handleTitleChange}
              placeholder="Enter course title"
            />
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={settings.category}
              onChange={handleCategoryChange}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select category</option>
              <option value="Data Science">Data Science</option>
              <option value="Cloud Computing">Cloud Computing</option>
              <option value="Design">Design</option>
              <option value="Programming">Programming</option>
              <option value="Business">Business</option>
              <option value="Marketing">Marketing</option>
              <option value="Technology">Technology</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Course Description</Label>
          <ReactQuill
            theme="snow"
            value={settings.description}
            onChange={handleDescriptionChange}
            placeholder="Describe what students will learn in this course..."
          />
        </div>

        <div>
          <Label>Learning Objectives</Label>
          <ReactQuill
            theme="snow"
            value={settings.objectives}
            onChange={handleObjectivesChange}
            placeholder="List the key learning objectives..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Target Audience</Label>
            <select
              value={settings.targetAudience}
              onChange={handleTargetAudienceChange}
              className="w-full border rounded px-3 py-2"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <Label>Estimated Duration</Label>
            <div className="flex gap-2">
              <Input
                value={settings.duration}
                onChange={handleDurationChange}
                placeholder="e.g., 10 hours, 6 weeks"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const totalDuration = calculateTotalCourseDuration();
                  onUpdateSettings({ ...settings, duration: totalDuration });
                  toast({
                    title: "Duration Updated",
                    description: `Total course duration: ${totalDuration}`,
                  });
                }}
                className="whitespace-nowrap"
              >
                <Clock className="w-4 h-4 mr-1" />
                Calculate
              </Button>
            </div>
          </div>
        </div>

        <div>
          <Label>Course Thumbnail</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={handleThumbnailChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Course Preview Component
function CoursePreview({ course, modules }: { course: any; modules: Module[] }) {
  const [selectedModule, setSelectedModule] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState(0);

  const currentLesson = modules[selectedModule]?.lessons[selectedLesson];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Course Preview</h3>
        <Badge variant="outline">Student View</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Course Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{course.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {modules.map((module, moduleIndex) => (
                  <div key={moduleIndex}>
                    <div className="px-3 py-2 font-medium text-sm border-b bg-muted/30">
                      {module.title || `Module ${moduleIndex + 1}`}
                    </div>
                    {module.lessons.map((lesson, lessonIndex) => (
                      <button
                        key={lessonIndex}
                        onClick={() => {
                          setSelectedModule(moduleIndex);
                          setSelectedLesson(lessonIndex);
                        }}
                        className={`w-full text-left px-6 py-2 text-sm hover:bg-muted/50 flex items-center gap-2 ${
                          selectedModule === moduleIndex && selectedLesson === lessonIndex
                            ? 'bg-primary/10 text-primary border-r-2 border-primary'
                            : ''
                        }`}
                      >
                        {lesson.contentType === 'video' && <Play className="w-3 h-3" />}
                        {lesson.contentType === 'pdf' && <FileIcon className="w-3 h-3" />}
                        {lesson.contentType === 'article' && <Link className="w-3 h-3" />}
                        {lesson.contentType === 'quiz' && <HelpCircle className="w-3 h-3" />}
                        {lesson.contentType === 'text' && <FileText className="w-3 h-3" />}
                        <span className="truncate">{lesson.title || `Lesson ${lessonIndex + 1}`}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lesson Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{currentLesson?.title || 'Select a lesson'}</CardTitle>
              {currentLesson?.duration && (
                <CardDescription className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {currentLesson.duration}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {currentLesson ? (
                <div className="space-y-4">
                  {currentLesson.description && (
                    <p className="text-muted-foreground">{currentLesson.description}</p>
                  )}

                  {currentLesson.contentType === 'video' && currentLesson.url && (
                    <video src={currentLesson.url} controls className="w-full rounded" />
                  )}

                  {currentLesson.contentType === 'pdf' && currentLesson.url && (
                    <div className="border rounded overflow-hidden bg-gray-50">
                      <div className="p-4 text-center">
                        <div className="w-16 h-16 mx-auto mb-3 text-red-500">
                          <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium mb-2">PDF Document</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Click "View PDF" to open in a new tab
                        </p>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Use a viewer URL that forces inline display
                              const viewerUrl = `${currentLesson.url}?inline=true`;
                              window.open(viewerUrl, '_blank');
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Force download
                              const link = document.createElement('a');
                              link.href = currentLesson.url!;
                              link.download = currentLesson.fileName || 'document.pdf';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mt-3">
                          {currentLesson.fileName && <div>File: {currentLesson.fileName}</div>}
                          {currentLesson.fileSize && <div>Size: {(currentLesson.fileSize / (1024 * 1024)).toFixed(2)} MB</div>}
                          {currentLesson.pdfPages && <div>Pages: {currentLesson.pdfPages}</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentLesson.contentType === 'article' && currentLesson.url && (
                    <div className="p-4 border rounded bg-muted/30">
                      <a 
                        href={currentLesson.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <Link className="w-4 h-4" />
                        Read Article
                      </a>
                    </div>
                  )}

                  {currentLesson.contentType === 'text' && currentLesson.content && (
                    <div 
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: currentLesson.content }}
                    />
                  )}

                  {currentLesson.contentType === 'quiz' && currentLesson.quiz && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Quiz Preview</h4>
                      {currentLesson.quiz.map((question, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <h5 className="font-medium mb-3">Question {index + 1}: {question.question}</h5>
                            <div className="space-y-2">
                              {question.options.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center gap-2">
                                  <input type="radio" name={`preview-${index}`} disabled />
                                  <span className={optionIndex === question.answer ? 'font-medium text-green-600' : ''}>
                                    {option}
                                  </span>
                                  {optionIndex === question.answer && <Check className="w-4 h-4 text-green-600" />}
                                </div>
                              ))}
                            </div>
                            {question.explanation && (
                              <div className="mt-3 p-3 bg-muted/50 rounded text-sm">
                                <strong>Explanation:</strong> {question.explanation}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a lesson to preview its content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}