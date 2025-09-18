import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Calendar } from "lucide-react";

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    subject: string;
    teacherId: string;
    coverImage?: string;
    createdAt: string;
  };
  progress?: number;
  showEnrollButton?: boolean;
  onEnroll?: (courseId: string) => void;
  isEnrolling?: boolean;
}

export function CourseCard({ 
  course, 
  progress, 
  showEnrollButton = false, 
  onEnroll, 
  isEnrolling = false 
}: CourseCardProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      Mathematics: "bg-primary/10 text-primary",
      "Computer Science": "bg-secondary/10 text-secondary",
      Physics: "bg-accent/10 text-accent",
      History: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      Biology: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      Chemistry: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      default: "bg-muted text-muted-foreground",
    };
    return colors[subject] || colors.default;
  };

  const handleCourseClick = () => {
    setLocation(`/courses/${course.id}`);
  };

  const handleEnrollClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEnroll) {
      onEnroll(course.id);
    }
  };

  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCourseClick}
      data-testid={`course-card-${course.id}`}
    >
      {/* Course Image */}
      <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg relative overflow-hidden">
        {course.coverImage ? (
          <img 
            src={course.coverImage} 
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {course.title.charAt(0)}
              </span>
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className={getSubjectColor(course.subject)}>
            {course.subject}
          </Badge>
          {progress !== undefined && (
            <span className="text-sm text-muted-foreground">{progress}%</span>
          )}
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1">
          {course.title}
        </h3>
        
        <div 
          className="text-muted-foreground text-sm mb-4 line-clamp-2 prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: course.description }}
        />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-sm text-muted-foreground">
            {user?.role === "teacher" ? (
              <>
                <Users className="w-4 h-4 mr-1" />
                <span>24 students</span>
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-1" />
                <span>Instructor: {course.teacherId.slice(-6)}</span>
              </>
            )}
          </div>
          
          <div className="flex space-x-2">
            {showEnrollButton && (
              <Button 
                size="sm" 
                onClick={handleEnrollClick}
                disabled={isEnrolling}
                data-testid={`button-enroll-${course.id}`}
              >
                {isEnrolling ? "Enrolling..." : "Enroll"}
              </Button>
            )}
            <Button 
              size="sm" 
              variant={showEnrollButton ? "outline" : "default"}
              data-testid={`button-view-${course.id}`}
            >
              {user?.role === "teacher" ? "Manage" : "View"}
            </Button>
          </div>
        </div>

        {progress !== undefined && (
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
