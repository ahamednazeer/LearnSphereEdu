import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { BookOpen, Clock, Users, Star, Play } from "lucide-react";

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    subject: string;
    coverImage?: string;
    teacher?: {
      firstName: string;
      lastName: string;
      profileImage?: string;
    };
    estimatedHours?: number;
    enrollmentCount?: number;
    rating?: number;
    level?: string;
    price?: number;
    status?: string;
  };
  progress?: number;
  isEnrolled?: boolean;
  userRole?: string;
  onEnroll?: (courseId: string) => void;
  onContinue?: (courseId: string) => void;
  className?: string;
}

export function CourseCard({ 
  course, 
  progress, 
  isEnrolled, 
  userRole, 
  onEnroll, 
  onContinue,
  className 
}: CourseCardProps) {
  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      "Mathematics": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      "Computer Science": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      "Physics": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      "History": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      "Biology": "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
      default: "bg-muted text-muted-foreground",
    };
    return colors[subject] || colors.default;
  };

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return colors[level] || "bg-muted text-muted-foreground";
  };

  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden",
      className
    )}>
      {/* Course Image */}
      <div className="relative aspect-video overflow-hidden">
        {course.coverImage ? (
          <img 
            src={course.coverImage} 
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Overlay with play button for enrolled courses */}
        {isEnrolled && (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Button 
              size="sm" 
              className="bg-white/90 text-black hover:bg-white"
              onClick={() => onContinue?.(course.id)}
            >
              <Play className="w-4 h-4 mr-2" />
              Continue
            </Button>
          </div>
        )}

        {/* Status badge */}
        {course.status && course.status !== 'published' && (
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 bg-black/50 text-white"
          >
            {course.status}
          </Badge>
        )}
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Header with badges */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className={getSubjectColor(course.subject)}>
            {course.subject}
          </Badge>
          {course.level && (
            <Badge variant="outline" className={getLevelColor(course.level)}>
              {course.level}
            </Badge>
          )}
        </div>

        {/* Title and description */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {course.description}
          </p>
        </div>

        {/* Teacher info */}
        {course.teacher && (
          <div className="flex items-center space-x-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={course.teacher.profileImage} />
              <AvatarFallback className="text-xs">
                {course.teacher.firstName[0]}{course.teacher.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {course.teacher.firstName} {course.teacher.lastName}
            </span>
          </div>
        )}

        {/* Course stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            {course.estimatedHours && (
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{course.estimatedHours}h</span>
              </div>
            )}
            {course.enrollmentCount && (
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{course.enrollmentCount}</span>
              </div>
            )}
            {course.rating && (
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{(course.rating / 100).toFixed(1)}</span>
              </div>
            )}
          </div>
          
          {course.price !== undefined && (
            <span className="font-semibold text-foreground">
              {course.price === 0 ? 'Free' : `$${(course.price / 100).toFixed(2)}`}
            </span>
          )}
        </div>

        {/* Progress bar for enrolled courses */}
        {isEnrolled && progress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2">
          {userRole === "teacher" ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => onContinue?.(course.id)}
            >
              Manage Course
            </Button>
          ) : isEnrolled ? (
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => onContinue?.(course.id)}
            >
              Continue Learning
            </Button>
          ) : (
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => onEnroll?.(course.id)}
            >
              Enroll Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}