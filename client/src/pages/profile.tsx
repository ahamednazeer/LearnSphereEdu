import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { sessionManager } from "@/lib/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  User, Mail, Calendar, BookOpen, GraduationCap, 
  Settings, Camera, Save, Shield, Monitor, Smartphone, 
  MapPin, Clock, X
} from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    bio: "",
    profileImage: user?.profileImage || "",
  });

  const { data: userProfile, isLoading } = useQuery({
    queryKey: ["/api/protected/user/profile"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/user/profile");
      return response.json();
    },
    onSuccess: (data) => {
      setProfileData({
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        bio: data.bio || "",
        profileImage: data.profileImage || "",
      });
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["/api/protected/courses"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/courses");
      return response.json();
    },
  });

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["/api/protected/user/sessions"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/user/sessions");
      return response.json();
    },
    enabled: isSessionDialogOpen,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await authenticatedApiRequest("PUT", "/api/protected/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/user/profile"] });
      setIsEditing(false);
      toast({
        title: "Profile updated!",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await sessionManager.terminateSession(sessionId);
    },
    onSuccess: () => {
      refetchSessions();
      toast({
        title: "Session terminated",
        description: "The session has been successfully terminated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to terminate session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: async () => {
      await sessionManager.logoutAll();
    },
    onSuccess: () => {
      toast({
        title: "All sessions terminated",
        description: "You have been logged out from all devices.",
      });
      // The user will be redirected to login automatically
    },
    onError: (error: any) => {
      toast({
        title: "Failed to logout from all sessions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const formatLastActive = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Active now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      student: <Badge variant="default">Student</Badge>,
      teacher: <Badge variant="secondary">Teacher</Badge>,
      admin: <Badge variant="destructive">Admin</Badge>,
    };
    return badges[role as keyof typeof badges] || <Badge>{role}</Badge>;
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
          <TabsTrigger value="courses" data-testid="tab-courses">My Courses</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={profileData.profileImage} alt={user?.firstName} />
                    <AvatarFallback className="text-2xl">
                      {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                    data-testid="button-change-photo"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {user?.firstName} {user?.lastName}
                      </h2>
                      <p className="text-muted-foreground">{user?.email}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        {getRoleBadge(user?.role || "")}
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>Joined {new Date().toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => setIsEditing(!isEditing)}
                      variant={isEditing ? "outline" : "default"}
                      data-testid="button-edit-profile"
                    >
                      {isEditing ? "Cancel" : "Edit Profile"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Form */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and bio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                      disabled={!isEditing}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                      disabled={!isEditing}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email}
                    disabled
                    className="bg-muted"
                    data-testid="input-email"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>

                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    disabled={!isEditing}
                    data-testid="textarea-bio"
                  />
                </div>

                {isEditing && (
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          {/* Course Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <BookOpen className="w-8 h-8 text-primary mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-foreground">{courses.length}</h3>
                <p className="text-muted-foreground">
                  {user?.role === "teacher" ? "Courses Teaching" : "Courses Enrolled"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <GraduationCap className="w-8 h-8 text-secondary mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-foreground">
                  {user?.role === "teacher" ? "156" : "12"}
                </h3>
                <p className="text-muted-foreground">
                  {user?.role === "teacher" ? "Total Students" : "Assessments Completed"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="w-8 h-8 text-accent mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-foreground">87%</h3>
                <p className="text-muted-foreground">
                  {user?.role === "teacher" ? "Avg Student Score" : "Average Grade"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Courses List */}
          <Card>
            <CardHeader>
              <CardTitle>
                {user?.role === "teacher" ? "Courses You're Teaching" : "Your Enrolled Courses"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {courses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {user?.role === "teacher" 
                      ? "You haven't created any courses yet."
                      : "You're not enrolled in any courses yet."
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courses.map((course: any) => (
                    <div 
                      key={course.id} 
                      className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      data-testid={`profile-course-${course.id}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-foreground">{course.title}</h3>
                        <Badge variant="secondary" className={getSubjectColor(course.subject)}>
                          {course.subject}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                        {course.description}
                      </p>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Created {new Date(course.createdAt).toLocaleDateString()}</span>
                        {user?.role === "teacher" && <span>24 students</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account preferences and security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Email Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for course updates and messages
                  </p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-email-settings">
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Change Password</h4>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-change-password">
                  Change
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Privacy Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Control who can see your profile and activity
                  </p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-privacy-settings">
                  Manage
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Active Sessions</h4>
                  <p className="text-sm text-muted-foreground">
                    Manage your active login sessions across devices
                  </p>
                </div>
                <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-manage-sessions">
                      Manage
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Active Sessions</DialogTitle>
                      <DialogDescription>
                        These are the devices currently logged into your account. You can terminate any session you don't recognize.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {sessions.map((session: any) => (
                        <div key={session.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getDeviceIcon(session.userAgent || "")}
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium">
                                  {session.userAgent?.includes('Mobile') ? 'Mobile Device' : 'Desktop'}
                                </p>
                                {session.isCurrent && (
                                  <Badge variant="default" className="text-xs">Current</Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{session.ipAddress || 'Unknown location'}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatLastActive(session.lastActivity || session.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {!session.isCurrent && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => terminateSessionMutation.mutate(session.id)}
                              disabled={terminateSessionMutation.isPending}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {sessions.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No active sessions found</p>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between pt-4 border-t">
                      <Button
                        variant="destructive"
                        onClick={() => logoutAllMutation.mutate()}
                        disabled={logoutAllMutation.isPending}
                      >
                        {logoutAllMutation.isPending ? "Logging out..." : "Logout All Devices"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsSessionDialogOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Download Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Download a copy of your account data
                  </p>
                </div>
                <Button variant="outline" size="sm" data-testid="button-download-data">
                  Download
                </Button>
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-destructive">Delete Account</h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" data-testid="button-delete-account">
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
