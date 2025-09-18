import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, BookOpen, Trophy, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface Grade {
  id: string;
  assessmentTitle: string;
  courseTitle: string;
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  feedback?: string;
  status: string;
}

export default function Grades() {
  const { data: grades, isLoading, error } = useQuery<Grade[]>({
    queryKey: ["/api/protected/user/recent-grades"],
  });

  const { data: allGrades } = useQuery<Grade[]>({
    queryKey: ["/api/protected/user/grades"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Failed to load grades. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recentGrades = grades || [];
  const totalGrades = allGrades || [];
  
  // Calculate overall statistics
  const totalAssessments = totalGrades.length;
  const averageScore = totalGrades.length > 0 
    ? totalGrades.reduce((sum, grade) => sum + grade.percentage, 0) / totalGrades.length 
    : 0;
  const passedAssessments = totalGrades.filter(grade => grade.percentage >= 70).length;
  const passRate = totalAssessments > 0 ? (passedAssessments / totalAssessments) * 100 : 0;

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return "bg-green-500";
    if (percentage >= 80) return "bg-blue-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Grades</h1>
        <p className="text-muted-foreground">
          Track your academic performance across all courses
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssessments}</div>
            <p className="text-xs text-muted-foreground">
              Completed assessments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageScore.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Overall performance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Assessments passed (≥70%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grade Letter</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getGradeLetter(averageScore)}</div>
            <p className="text-xs text-muted-foreground">
              Current grade level
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Grades */}
      {recentGrades.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Recent Grades</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentGrades.map((grade) => (
              <Card key={grade.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{grade.assessmentTitle}</CardTitle>
                    <Badge variant="outline" className={`text-white ${getGradeColor(grade.percentage)}`}>
                      {getGradeLetter(grade.percentage)}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {grade.courseTitle}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Score</span>
                      <span className="text-sm">
                        {grade.score}/{grade.totalPoints} ({grade.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    
                    <Progress value={grade.percentage} className="h-2" />
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      {format(new Date(grade.submittedAt), "MMM d, yyyy")}
                    </div>
                    
                    {grade.feedback && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-1">Feedback:</p>
                        <p className="text-sm text-muted-foreground">{grade.feedback}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Grades */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">All Grades</h2>
        {totalGrades.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No grades yet</h3>
                <p className="text-muted-foreground">
                  Complete some assessments to see your grades here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {totalGrades.map((grade) => (
              <Card key={grade.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{grade.assessmentTitle}</h3>
                        <Badge variant="outline" className={`text-white ${getGradeColor(grade.percentage)}`}>
                          {getGradeLetter(grade.percentage)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {grade.courseTitle}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-4 w-4" />
                          {format(new Date(grade.submittedAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {grade.score}/{grade.totalPoints}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {grade.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {grade.feedback && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Feedback:</p>
                      <p className="text-sm text-muted-foreground">{grade.feedback}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}