import { useAuth } from "@/hooks/use-auth";
import { useRoute } from "wouter";
import TeacherAssessmentPreview from "./teacher-assessment-preview";
import AssessmentPreview from "./assessment-preview";

export default function AssessmentPreviewRouter() {
  const { user } = useAuth();
  const [match, params] = useRoute("/assessments/:id/preview");

  if (user?.role === "teacher" || user?.role === "admin") {
    return <TeacherAssessmentPreview />;
  } else {
    return <AssessmentPreview />;
  }
}