import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { 
  BookOpen, CheckCircle, TrendingUp, Clock, 
  Users, BarChart3, PlusCircle, Award, Target, Calendar
} from "lucide-react";
import { PageLoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { StatsCard } from "@/components/ui/stats-card";
import { CourseCard } from "@/components/ui/course-card";

export default function Dashboard() {
  const { user } = useAuth();
  // Fetch recent grades for students
  const { data: recentGrades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["/api/protected/user/recent-grades"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/user/recent-grades");
      return response.json();
    },
    enabled: user?.role === "student",
  });

  // Fetch recent activity for teachers
  const { data: recentActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["/api/protected/user/recent-activity"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/user/recent-activity");
      return response.json();
    },
    enabled: user?.role === "teacher",
  });
  const [, setLocation] = useLocation();

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["/api/protected/courses"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses");
      return response.json();
    },
  });

  const { data: allCourses = [], isLoading: allCoursesLoading } = useQuery({
    queryKey: ["/api/protected/courses/all"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses/all");
      return response.json();
    },
    enabled: user?.role === "student",
  });

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      Mathematics: "bg-primary/10 text-primary",
      "Computer Science": "bg-secondary/10 text-secondary",
      Physics: "bg-accent/10 text-accent",
      History: "bg-purple-100 text-purple-700",
      default: "bg-muted text-muted-foreground",
    };
    return colors[subject] || colors.default;
  };

  if (coursesLoading) {
    return <PageLoadingSpinner />;
  }

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <div className="hero-gradient text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="text-xl text-white/90 mb-6">
              {user?.role === "teacher" 
                ? `Manage your ${courses.length} courses and track student progress`
                : `Continue your learning journey with ${courses.length} active courses`
              }
            </p>
            <div className="flex justify-center space-x-4">
              <Button 
                onClick={() => setLocation("/courses")}
                className="bg-white text-primary hover:bg-gray-50"
                data-testid="button-browse-courses"
              >
                {user?.role === "teacher" ? "Manage Courses" : "Browse Courses"}
              </Button>
              <Button 
                onClick={() => setLocation("/assessments")}
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                data-testid="button-assessments"
              >
                {user?.role === "teacher" ? "Create Assessment" : "Take Assessment"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title={user?.role === "teacher" ? "My Courses" : "Enrolled Courses"}
            value={courses.length}
            icon={BookOpen}
            description={user?.role === "teacher" ? "Courses created" : "Active enrollments"}
          />
          
          {user?.role === "student" && (
            <>
              <StatsCard
                title="Completed Lessons"
                value="24"
                icon={CheckCircle}
                description="This month"
                trend={{ value: 12, isPositive: true }}
              />
              <StatsCard
                title="Study Hours"
                value="18.5"
                icon={Clock}
                description="This week"
                trend={{ value: 8, isPositive: true }}
              />
              <StatsCard
                title="Certificates"
                value="3"
                icon={Award}
                description="Earned"
              />
            </>
          )}
          
          {user?.role === "teacher" && (
            <>
              <StatsCard
                title="Total Students"
                value="156"
                icon={Users}
                description="Across all courses"
                trend={{ value: 15, isPositive: true }}
              />
              <StatsCard
                title="Avg. Rating"
                value="4.8"
                icon={Target}
                description="Course rating"
              />
              <StatsCard
                title="This Month"
                value="12"
                icon={Calendar}
                description="New enrollments"
                trend={{ value: 25, isPositive: true }}
              />
            </>
          )}
        </div>

        {/* Course Grid and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Course Cards */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {user?.role === "teacher" ? "My Courses" : "My Courses"}
              </h2>
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/courses")}
                data-testid="button-view-all-courses"
              >
                View All
              </Button>
            </div>

            {courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={user?.role === "teacher" ? "No courses created yet" : "No courses enrolled yet"}
                description={user?.role === "teacher" 
                  ? "Create your first course to get started teaching."
                  : "Enroll in courses to start your learning journey."
                }
                action={{
                  label: user?.role === "teacher" ? "Create Course" : "Browse Courses",
                  onClick: () => setLocation("/courses")
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courses.slice(0, 4).map((course: any) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={75}
                    isEnrolled={user?.role === "student"}
                    userRole={user?.role}
                    onContinue={(courseId) => setLocation(`/courses/${courseId}`)}
                    className="cursor-pointer"
                    data-testid={`course-card-${course.id}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity Sidebar */}
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-foreground mb-6">Recent Activity</h2>
            
            {/* Quick Actions for Teachers */}
            {user?.role === "teacher" && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setLocation("/courses/create")}
                    data-testid="button-create-course"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Course
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setLocation("/assessments/create")}
                    data-testid="button-create-assessment"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Assessment
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    data-testid="button-view-analytics"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Recent Grades for Students */}
            {user?.role === "student" && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Grades</CardTitle>
                </CardHeader>
                <CardContent>
                  {gradesLoading ? (
                    <div className="text-center text-muted-foreground">Loading...</div>
                  ) : recentGrades.length === 0 ? (
                    <div className="text-center text-muted-foreground">No recent grades.</div>
                  ) : (
                    <div className="space-y-4">
                      {recentGrades.map((grade: any) => (
                        <div key={grade.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{grade.assessmentTitle}</p>
                            <p className="text-xs text-muted-foreground">{grade.courseTitle}</p>
                          </div>
                          <span className="text-sm font-semibold text-secondary">
                            {grade.score ?? "-"}/{grade.totalPoints ?? "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Activity for Teachers */}
            {user?.role === "teacher" && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {activityLoading ? (
                    <div className="text-center text-muted-foreground">Loading...</div>
                  ) : recentActivity.length === 0 ? (
                    <div className="text-center text-muted-foreground">No recent activity.</div>
                  ) : (
                    <div className="space-y-4">
                      {recentActivity.map((item: any) => (
                        <div key={item.id} className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.studentName}</p>
                            <p className="text-xs text-muted-foreground">{item.assessmentTitle} ({item.courseTitle})</p>
                          </div>
                          <span className="text-sm font-semibold text-secondary">
                            {item.score ?? "-"}/{item.totalPoints ?? "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Grades for Students */}
            {/* No fake recent grades. Only show real data if available. */}
          </div>
        </div>
      </div>
    </main>
  );
}
