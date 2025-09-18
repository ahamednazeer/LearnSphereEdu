import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import Assessments from "@/pages/assessments";
import AssessmentDetail from "@/pages/assessment-detail";
import AssessmentPreview from "@/pages/assessment-preview";
import TeacherAssessmentPreview from "@/pages/teacher-assessment-preview";
import AssessmentPreviewRouter from "@/pages/assessment-preview-router";
import Discussions from "@/pages/discussions";
import DiscussionDetail from "@/pages/discussion-detail";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Grades from "@/pages/grades";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import NotFound from "@/pages/not-found";

import CoursePreview from "@/pages/course-preview";
import CourseLearning from "@/pages/course-learning";
import InstructorDashboard from "@/pages/instructor-dashboard";

function ProtectedRoute({ component: Component, ...rest }: { component: any }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <div className="lg:pl-64 flex-1">
          <Component {...rest} />
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/courses/:id/preview" component={() => <ProtectedRoute component={CoursePreview} />} />
      <Route path="/courses/:id/learn" component={() => <ProtectedRoute component={CourseLearning} />} />
      <Route path="/courses/:id" component={() => <ProtectedRoute component={CourseDetail} />} />
      <Route path="/courses" component={() => <ProtectedRoute component={Courses} />} />
      <Route path="/assessments" component={() => <ProtectedRoute component={Assessments} />} />
      <Route path="/assessments/:id/preview" component={() => <ProtectedRoute component={AssessmentPreviewRouter} />} />
      <Route path="/assessments/:id" component={() => <ProtectedRoute component={AssessmentDetail} />} />
      <Route path="/grades" component={() => <ProtectedRoute component={Grades} />} />
      <Route path="/discussions" component={() => <ProtectedRoute component={Discussions} />} />
      <Route path="/discussions/create" component={() => <ProtectedRoute component={Discussions} />} />
      <Route path="/discussions/:id" component={() => <ProtectedRoute component={DiscussionDetail} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />

      <Route path="/instructor-dashboard" component={() => <ProtectedRoute component={InstructorDashboard} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
