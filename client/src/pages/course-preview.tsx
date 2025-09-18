import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { authenticatedApiRequest } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Module = {
  id: string;
  title: string;
  lessons: {
    id: string;
    title: string;
    contentType: string;
    url: string;
  }[];
};

type Course = {
  id: string;
  title: string;
  description: string;
  objectives: string;
  category: string;
  targetAudience: string;
  duration: string;
  status: string;
  modules: Module[];
};

export default function CoursePreview() {
  const [, params] = useRoute<{ id: string }>("/courses/:id/preview");
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fetchCourse = async () => {
      if (!params?.id) {
        setError("No course ID provided");
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        console.log("Fetching course:", params.id); // Debug log
        const res = await authenticatedApiRequest("GET", `/api/protected/courses/${params.id}/preview`);
        if (!res.ok) throw new Error("Failed to fetch course");
        const data = await res.json();
        console.log("Course data:", data); // Debug log
        setCourse(data);
      } catch (err: any) {
        console.error("Error fetching course:", err); // Debug log
        setError(err.message || "Failed to load course");
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Loading course preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button variant="outline" onClick={() => navigate("/courses")}>
                Back to Courses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Course not found</p>
              <Button variant="outline" onClick={() => navigate("/courses")}>
                Back to Courses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>{course.title}</CardTitle>
          <div className="text-sm text-muted-foreground">
            {course.category} • {course.duration} • {course.targetAudience}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <div dangerouslySetInnerHTML={{ __html: course.description }} />
          </div>

          <div>
            <h3 className="font-semibold mb-2">Learning Objectives</h3>
            <div dangerouslySetInnerHTML={{ __html: course.objectives }} />
          </div>

          <div>
            <h3 className="font-semibold mb-4">Course Content</h3>
            <div className="space-y-4">
              {course.modules && course.modules.length > 0 ? (
                course.modules.map((module, idx) => (
                  <div key={module.id} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Module {idx + 1}: {module.title}</h4>
                    <ul className="space-y-2">
                      {module.lessons.map((lesson, lesIdx) => (
                        <li key={lesson.id} className="flex items-center gap-2 text-sm">
                          <span>{lesIdx + 1}.</span>
                          <span>{lesson.title}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {lesson.contentType}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No modules have been added to this course yet.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button variant="outline" onClick={() => navigate(`/courses/${course.id}`)}>
              Back to Course
            </Button>
            {course.status !== "published" && (
              <Button onClick={async () => {
                try {
                  const res = await authenticatedApiRequest("POST", `/api/protected/courses/${course.id}/publish`);
                  if (!res.ok) throw new Error("Failed to publish course");
                  navigate("/instructor-dashboard");
                } catch (err: any) {
                  setError(err.message || "Failed to publish course");
                }
              }}>
                Publish Course
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
