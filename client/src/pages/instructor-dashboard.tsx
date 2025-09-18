import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function InstructorDashboard() {
  const [, setLocation] = useLocation();
  // Placeholder data
  const courses = [
    { id: "1", title: "Python for Data Science", status: "draft", enrollments: 0, completionRate: 0 },
    { id: "2", title: "Cloud Computing 101", status: "published", enrollments: 120, completionRate: 75 },
  ];
  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <Button onClick={() => setLocation("/courses")}>Manage Courses</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader><CardTitle>Total Enrollments</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">120</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Average Completion Rate</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">75%</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Feedback</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">4.8/5</span></CardContent>
        </Card>
      </div>
      <div className="bg-card rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Courses</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Enrollments</th>
              <th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {courses.map(course => (
              <tr key={course.id} className="border-t">
                <td>{course.title}</td>
                <td>{course.status}</td>
                <td>{course.enrollments}</td>
                <td>{course.completionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
