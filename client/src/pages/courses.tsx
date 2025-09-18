import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Users, Plus, Search, Star, Clock, Globe, Award, Filter, Grid, List } from "lucide-react";
import CourseCreationWizard from "@/components/course-creation-wizard";
import { ShareButton } from "@/components/share-button";
import { PageLoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { CourseCard } from "@/components/ui/course-card";
import { SearchBar } from "@/components/ui/search-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";



export default function Courses() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("title");
  const [filterBy, setFilterBy] = useState("all");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["/api/protected/courses"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses");
      return response.json();
    },
  });

  // Remove the separate allCourses query since we now get everything from the main endpoint

  const enrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/enroll`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses"] });
      toast({
        title: "Enrolled successfully!",
        description: "You can now access this course.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enrollment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEnroll = (courseId: string) => {
    enrollMutation.mutate(courseId);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      technology: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      business: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      "arts-humanities": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      "science-engineering": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      "health-medicine": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      "social-sciences": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
      "language-learning": "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
      "personal-development": "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
      default: "bg-muted text-muted-foreground",
    };
    return colors[category] || colors.default;
  };

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return colors[level] || "bg-muted text-muted-foreground";
  };

  const formatRating = (rating: number) => {
    return (rating / 100).toFixed(1);
  };

  const filteredCourses = courses.filter((course: any) =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <PageLoadingSpinner />;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground animate-fade-in">
            {user?.role === "teacher" ? "My Courses" : "Discover Courses"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {user?.role === "teacher" 
              ? "Manage your courses and track student progress"
              : "Discover and enroll in courses to expand your knowledge"
            }
          </p>
        </div>
        
        {user?.role === "teacher" && (
          <Button 
            onClick={() => setIsCreateWizardOpen(true)}
            className="mt-4 sm:mt-0 animate-pulse-glow"
            data-testid="button-create-course"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="flex-1">
          <SearchBar
            placeholder="Search courses, lessons, or teachers..."
            onSearch={setSearchTerm}
            onResultSelect={(result) => {
              if (result.type === "course") {
                setLocation(`/courses/${result.id}`);
              }
            }}
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter Dropdown */}
          <Select value={filterBy} onValueChange={setFilterBy}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              <SelectItem value="enrolled">Enrolled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="date">Date Created</SelectItem>
              <SelectItem value="popularity">Popularity</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={searchTerm 
            ? "No courses found"
            : user?.role === "teacher" 
              ? "No courses created yet" 
              : "No published courses available"
          }
          description={searchTerm 
            ? "Try adjusting your search terms"
            : user?.role === "teacher" 
              ? "Create your first course to get started teaching."
              : "Teachers need to publish courses before they become available for enrollment. Check back later for new courses."
          }
          action={!searchTerm && user?.role === "teacher" ? {
            label: "Create Your First Course",
            onClick: () => setIsCreateWizardOpen(true)
          } : undefined}
        />
      ) : (
        <div className={cn(
          viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
            : "space-y-4"
        )}>
          {filteredCourses.map((course: any) => {
            const isEnrolled = user?.role === "student" ? course.isEnrolled : false;
            
            return (
              <CourseCard
                key={course.id}
                course={course}
                progress={isEnrolled ? Math.floor(Math.random() * 100) : undefined}
                isEnrolled={isEnrolled}
                userRole={user?.role}
                onEnroll={handleEnroll}
                onContinue={(courseId) => setLocation(`/courses/${courseId}`)}
                className={cn(
                  "animate-fade-in",
                  viewMode === "list" && "flex-row"
                )}
                data-testid={`course-card-${course.id}`}
              />
            );
          })}
        </div>
      )}
      
      {/* Course Creation Wizard */}
      <CourseCreationWizard 
        isOpen={isCreateWizardOpen} 
        onClose={() => setIsCreateWizardOpen(false)} 
      />
    </div>
  );
}
