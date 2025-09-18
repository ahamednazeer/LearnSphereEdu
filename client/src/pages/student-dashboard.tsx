import { useQuery } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["/api/protected/enrollments"],
    queryFn: async () => {
      const res = await authenticatedApiRequest("GET", "/api/protected/enrollments");
      return res.json();
    },
    enabled: !!user,
  });

  return (
    <div className="max-w-5xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My Courses</h1>
      {isLoading ? (
        <div>Loading...</div>
      ) : enrollments.length === 0 ? (
        <div>No enrolled courses yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enrollments.map((enroll: any) => (
            <Card key={enroll.id}>
              <CardHeader>
                <CardTitle>{enroll.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-muted-foreground">{enroll.description}</div>
                <div className="mb-2">Progress: {enroll.progress || 0}%</div>
                <Button onClick={() => setLocation(`/courses/${enroll.id}`)}>
                  Continue Learning
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
