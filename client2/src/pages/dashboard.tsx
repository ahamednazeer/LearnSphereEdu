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
  Users, BarChart3, PlusCircle 
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted-foreground truncate">
                      {user?.role === "teacher" ? "My Courses" : "Active Courses"}
                    </dt>
                    <dd className="text-lg font-medium text-foreground" data-testid="stat-courses">
                      {courses.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted-foreground truncate">
                      {user?.role === "teacher" ? "Students" : "Completed"}
                    </dt>
                    <dd className="text-lg font-medium text-foreground" data-testid="stat-completed">
                      {user?.role === "teacher" ? "156" : "12"}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-accent" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted-foreground truncate">
                      {user?.role === "teacher" ? "Avg Score" : "Average Grade"}
                    </dt>
                    <dd className="text-lg font-medium text-foreground" data-testid="stat-grade">
                      87%
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted-foreground truncate">
                      {user?.role === "teacher" ? "Engagement" : "Study Hours"}
                    </dt>
                    <dd className="text-lg font-medium text-foreground" data-testid="stat-hours">
                      {user?.role === "teacher" ? "92%" : "24"}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
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
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {user?.role === "teacher" ? "No courses created yet" : "No courses enrolled yet"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {user?.role === "teacher" 
                      ? "Create your first course to get started teaching."
                      : "Enroll in courses to start your learning journey."
                    }
                  </p>
                  <Button onClick={() => setLocation("/courses")} data-testid="button-get-started">
                    {user?.role === "teacher" ? "Create Course" : "Browse Courses"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {courses.slice(0, 4).map((course: any) => (
                  <Card 
                    key={course.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setLocation(`/courses/${course.id}`)}
                    data-testid={`course-card-${course.id}`}
                  >
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg"></div>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary" className={getSubjectColor(course.subject)}>
                          {course.subject}
                        </Badge>
                        {user?.role === "student" && (
                          <span className="text-sm text-muted-foreground">75%</span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{course.title}</h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {course.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="w-4 h-4 mr-1" />
                          <span>{user?.role === "teacher" ? "24 students" : `Dr. ${course.teacherId?.slice(-6)}`}</span>
                        </div>
                        <Button size="sm" data-testid={`button-continue-${course.id}`}>
                          {user?.role === "teacher" ? "Manage" : "Continue"}
                        </Button>
                      </div>
                      {user?.role === "student" && (
                        <div className="mt-4">
                          <Progress value={75} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
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

            {/* Upcoming Items */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>
                  {user?.role === "teacher" ? "Recent Submissions" : "Upcoming Assessments"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user?.role === "teacher" ? (
                    <>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-secondary rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Alice Johnson</p>
                          <p className="text-xs text-muted-foreground">Calculus Midterm - 94%</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-accent rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Bob Chen</p>
                          <p className="text-xs text-muted-foreground">Web Dev Project - 87%</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Carol Williams</p>
                          <p className="text-xs text-muted-foreground">Physics Quiz - 91%</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-destructive rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Calculus Midterm</p>
                          <p className="text-xs text-muted-foreground">Due: Tomorrow, 3:00 PM</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-accent rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Web Dev Project</p>
                          <p className="text-xs text-muted-foreground">Due: Friday, 11:59 PM</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-secondary rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Physics Quiz</p>
                          <p className="text-xs text-muted-foreground">Due: Next Monday</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-4"
                  onClick={() => setLocation(user?.role === "teacher" ? "/analytics" : "/assessments")}
                  data-testid="button-view-all-activity"
                >
                  {user?.role === "teacher" ? "View All Submissions" : "View All Assessments"}
                </Button>
              </CardContent>
            </Card>

            {/* Recent Grades for Students */}
            {user?.role === "student" && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Grades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">History Essay</p>
                        <p className="text-xs text-muted-foreground">World History</p>
                      </div>
                      <span className="text-sm font-semibold text-secondary">92%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Algorithm Quiz</p>
                        <p className="text-xs text-muted-foreground">Computer Science</p>
                      </div>
                      <span className="text-sm font-semibold text-secondary">88%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Lab Report</p>
                        <p className="text-xs text-muted-foreground">Physics</p>
                      </div>
                      <span className="text-sm font-semibold text-accent">85%</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="w-full mt-4"
                    data-testid="button-view-grade-history"
                  >
                    View Grade History
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
