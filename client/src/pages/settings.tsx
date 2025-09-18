import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedApiRequest } from "@/lib/auth";
import { sessionManager } from "@/lib/sessionManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings as SettingsIcon, Bell, Shield, Monitor, Smartphone, 
  MapPin, Clock, X, Save, Download, Trash2,
  Eye, EyeOff, Key, Mail, Globe, Moon, Sun,
  Volume2, VolumeX, Palette, Languages
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    courseUpdates: true,
    assessmentReminders: true,
    discussionReplies: true,
    gradeNotifications: true,
    systemAnnouncements: true,
  });

  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: "public",
    showEmail: false,
    showProgress: true,
    allowMessages: true,
  });

  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: "system",
    language: "en",
    timezone: "UTC",
    soundEnabled: true,
  });

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["/api/protected/user/sessions"],
    queryFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/user/sessions");
      return response.json();
    },
    enabled: isSessionDialogOpen,
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await authenticatedApiRequest("PUT", "/api/protected/user/password", data);
      return response.json();
    },
    onSuccess: () => {
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordDialogOpen(false);
      toast({
        title: "Password changed!",
        description: "Your password has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password change failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await authenticatedApiRequest("PUT", "/api/protected/user/notifications", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Notifications updated!",
        description: "Your notification preferences have been saved.",
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

  const updatePrivacyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await authenticatedApiRequest("PUT", "/api/protected/user/privacy", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Privacy settings updated!",
        description: "Your privacy preferences have been saved.",
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

  const updateAppearanceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await authenticatedApiRequest("PUT", "/api/protected/user/appearance", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Appearance updated!",
        description: "Your appearance preferences have been saved.",
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
    },
    onError: (error: any) => {
      toast({
        title: "Failed to logout from all sessions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadDataMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest("GET", "/api/protected/user/export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user?.firstName}_${user?.lastName}_data.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Data downloaded",
        description: "Your account data has been downloaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match.",
        variant: "destructive",
      });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate(passwordData);
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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center">
          <SettingsIcon className="w-8 h-8 mr-3" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">Manage your account preferences and security settings</p>
      </div>

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy">
            <Shield className="w-4 h-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Key className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="appearance" data-testid="tab-appearance">
            <Palette className="w-4 h-4 mr-2" />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Email Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                  }
                  data-testid="switch-email-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Push Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.pushNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, pushNotifications: checked }))
                  }
                  data-testid="switch-push-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Course Updates</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified about new lessons and course changes
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.courseUpdates}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, courseUpdates: checked }))
                  }
                  data-testid="switch-course-updates"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Assessment Reminders</h4>
                  <p className="text-sm text-muted-foreground">
                    Reminders for upcoming assessments and deadlines
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.assessmentReminders}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, assessmentReminders: checked }))
                  }
                  data-testid="switch-assessment-reminders"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Discussion Replies</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified when someone replies to your discussions
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.discussionReplies}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, discussionReplies: checked }))
                  }
                  data-testid="switch-discussion-replies"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Grade Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified when grades are posted
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.gradeNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, gradeNotifications: checked }))
                  }
                  data-testid="switch-grade-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">System Announcements</h4>
                  <p className="text-sm text-muted-foreground">
                    Important updates and announcements from the platform
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.systemAnnouncements}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, systemAnnouncements: checked }))
                  }
                  data-testid="switch-system-announcements"
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={() => updateNotificationsMutation.mutate(notificationSettings)}
                  disabled={updateNotificationsMutation.isPending}
                  data-testid="button-save-notifications"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateNotificationsMutation.isPending ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control who can see your information and activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="profile-visibility">Profile Visibility</Label>
                <Select
                  value={privacySettings.profileVisibility}
                  onValueChange={(value) => 
                    setPrivacySettings(prev => ({ ...prev, profileVisibility: value }))
                  }
                >
                  <SelectTrigger data-testid="select-profile-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Anyone can see your profile</SelectItem>
                    <SelectItem value="students">Students Only - Only enrolled students can see</SelectItem>
                    <SelectItem value="teachers">Teachers Only - Only teachers can see</SelectItem>
                    <SelectItem value="private">Private - Only you can see your profile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Show Email Address</h4>
                  <p className="text-sm text-muted-foreground">
                    Allow others to see your email address on your profile
                  </p>
                </div>
                <Switch
                  checked={privacySettings.showEmail}
                  onCheckedChange={(checked) => 
                    setPrivacySettings(prev => ({ ...prev, showEmail: checked }))
                  }
                  data-testid="switch-show-email"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Show Progress</h4>
                  <p className="text-sm text-muted-foreground">
                    Allow others to see your course progress and achievements
                  </p>
                </div>
                <Switch
                  checked={privacySettings.showProgress}
                  onCheckedChange={(checked) => 
                    setPrivacySettings(prev => ({ ...prev, showProgress: checked }))
                  }
                  data-testid="switch-show-progress"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Allow Messages</h4>
                  <p className="text-sm text-muted-foreground">
                    Allow other users to send you direct messages
                  </p>
                </div>
                <Switch
                  checked={privacySettings.allowMessages}
                  onCheckedChange={(checked) => 
                    setPrivacySettings(prev => ({ ...prev, allowMessages: checked }))
                  }
                  data-testid="switch-allow-messages"
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={() => updatePrivacyMutation.mutate(privacySettings)}
                  disabled={updatePrivacyMutation.isPending}
                  data-testid="button-save-privacy"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updatePrivacyMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and login sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Change Password</h4>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-change-password">
                      <Key className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Enter your current password and choose a new one.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showCurrentPassword ? "text" : "password"}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                            required
                            data-testid="input-current-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type={showNewPassword ? "text" : "password"}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                            required
                            minLength={8}
                            data-testid="input-new-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <div className="relative">
                          <Input
                            id="confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            required
                            minLength={8}
                            data-testid="input-confirm-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={changePasswordMutation.isPending}
                          data-testid="button-save-password"
                        >
                          {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
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
                      <Monitor className="w-4 h-4 mr-2" />
                      Manage Sessions
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
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Current</span>
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => downloadDataMutation.mutate()}
                  disabled={downloadDataMutation.isPending}
                  data-testid="button-download-data"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {downloadDataMutation.isPending ? "Downloading..." : "Download"}
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
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how the application looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={appearanceSettings.theme}
                  onValueChange={(value) => 
                    setAppearanceSettings(prev => ({ ...prev, theme: value }))
                  }
                >
                  <SelectTrigger data-testid="select-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center">
                        <Sun className="w-4 h-4 mr-2" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center">
                        <Moon className="w-4 h-4 mr-2" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center">
                        <Monitor className="w-4 h-4 mr-2" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  value={appearanceSettings.language}
                  onValueChange={(value) => 
                    setAppearanceSettings(prev => ({ ...prev, language: value }))
                  }
                >
                  <SelectTrigger data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">
                      <div className="flex items-center">
                        <Languages className="w-4 h-4 mr-2" />
                        English
                      </div>
                    </SelectItem>
                    <SelectItem value="es">
                      <div className="flex items-center">
                        <Languages className="w-4 h-4 mr-2" />
                        Español
                      </div>
                    </SelectItem>
                    <SelectItem value="fr">
                      <div className="flex items-center">
                        <Languages className="w-4 h-4 mr-2" />
                        Français
                      </div>
                    </SelectItem>
                    <SelectItem value="de">
                      <div className="flex items-center">
                        <Languages className="w-4 h-4 mr-2" />
                        Deutsch
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={appearanceSettings.timezone}
                  onValueChange={(value) => 
                    setAppearanceSettings(prev => ({ ...prev, timezone: value }))
                  }
                >
                  <SelectTrigger data-testid="select-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        UTC (Coordinated Universal Time)
                      </div>
                    </SelectItem>
                    <SelectItem value="America/New_York">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Eastern Time (ET)
                      </div>
                    </SelectItem>
                    <SelectItem value="America/Chicago">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Central Time (CT)
                      </div>
                    </SelectItem>
                    <SelectItem value="America/Denver">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Mountain Time (MT)
                      </div>
                    </SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Pacific Time (PT)
                      </div>
                    </SelectItem>
                    <SelectItem value="Europe/London">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Greenwich Mean Time (GMT)
                      </div>
                    </SelectItem>
                    <SelectItem value="Europe/Paris">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Central European Time (CET)
                      </div>
                    </SelectItem>
                    <SelectItem value="Asia/Tokyo">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Japan Standard Time (JST)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Sound Effects</h4>
                  <p className="text-sm text-muted-foreground">
                    Enable sound effects for notifications and interactions
                  </p>
                </div>
                <Switch
                  checked={appearanceSettings.soundEnabled}
                  onCheckedChange={(checked) => 
                    setAppearanceSettings(prev => ({ ...prev, soundEnabled: checked }))
                  }
                  data-testid="switch-sound-enabled"
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={() => updateAppearanceMutation.mutate(appearanceSettings)}
                  disabled={updateAppearanceMutation.isPending}
                  data-testid="button-save-appearance"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateAppearanceMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}