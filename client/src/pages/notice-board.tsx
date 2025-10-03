import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedApiRequest } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Plus, Bell, Calendar, User, Download, Edit, Trash2, AlertTriangle, Info, CheckCircle, XCircle, X } from "lucide-react";
import { format } from "date-fns";

interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  targetAudience: 'all' | 'students' | 'teachers' | 'course_specific';
  courseId?: string;
  attachmentUrl?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
}

export default function NoticeBoardPage() {
  const [courseMatch, courseParams] = useRoute("/courses/:courseId/notices");
  const [globalMatch] = useRoute("/notices");
  const [, setLocation] = useLocation();
  const courseId = courseParams?.courseId;
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    priority: 'normal' as const,
    targetAudience: 'all' as const,
    expiresAt: '',
    attachment: null as File | null
  });
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);

  useEffect(() => {
    fetchNotices();
  }, [courseId]);

  useEffect(() => {
    // Check if this is the user's first visit to notice board
    const hasVisitedNoticeBoard = localStorage.getItem('hasVisitedNoticeBoard');
    if (!hasVisitedNoticeBoard) {
      setShowWelcomeBanner(true);
      // Don't set localStorage immediately - let user dismiss the banner
    }
  }, []);

  const fetchNotices = async () => {
    try {
      const params = new URLSearchParams();
      if (courseId) {
        params.append('courseId', courseId);
      }
      
      const response = await authenticatedApiRequest("GET", `/api/protected/notices?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setNotices(data);
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
      toast({
        title: "Error",
        description: "Failed to load notices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNoticeForm({
      title: '',
      content: '',
      priority: 'normal',
      targetAudience: 'all',
      expiresAt: '',
      attachment: null
    });
  };

  const handleCreateNotice = async () => {
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', noticeForm.title);
      formData.append('content', noticeForm.content);
      formData.append('priority', noticeForm.priority);
      formData.append('targetAudience', noticeForm.targetAudience);
      
      if (courseId && noticeForm.targetAudience === 'course_specific') {
        formData.append('courseId', courseId);
      }
      
      if (noticeForm.expiresAt) {
        formData.append('expiresAt', new Date(noticeForm.expiresAt).toISOString());
      }
      
      if (noticeForm.attachment) {
        formData.append('attachment', noticeForm.attachment);
      }

      const response = await authenticatedApiRequest('POST', '/api/protected/notices', formData);

      if (response.ok) {
        const newNotice = await response.json();
        setNotices(prev => [newNotice, ...prev]);
        setShowCreateDialog(false);
        resetForm();
        
        toast({
          title: "Success",
          description: "Notice created successfully",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create notice');
      }
    } catch (error) {
      console.error('Error creating notice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create notice",
        variant: "destructive",
      });
    }
  };

  const handleUpdateNotice = async () => {
    if (!editingNotice || !noticeForm.title.trim() || !noticeForm.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', noticeForm.title);
      formData.append('content', noticeForm.content);
      formData.append('priority', noticeForm.priority);
      formData.append('targetAudience', noticeForm.targetAudience);
      
      if (courseId && noticeForm.targetAudience === 'course_specific') {
        formData.append('courseId', courseId);
      }
      
      if (noticeForm.expiresAt) {
        formData.append('expiresAt', new Date(noticeForm.expiresAt).toISOString());
      }
      
      if (noticeForm.attachment) {
        formData.append('attachment', noticeForm.attachment);
      }

      const response = await authenticatedApiRequest('PUT', `/api/protected/notices/${editingNotice.id}`, formData);

      if (response.ok) {
        const updatedNotice = await response.json();
        setNotices(prev => prev.map(notice => 
          notice.id === editingNotice.id ? updatedNotice : notice
        ));
        setEditingNotice(null);
        resetForm();
        
        toast({
          title: "Success",
          description: "Notice updated successfully",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update notice');
      }
    } catch (error) {
      console.error('Error updating notice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update notice",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) {
      return;
    }

    try {
      const response = await authenticatedApiRequest('DELETE', `/api/protected/notices/${noticeId}`);

      if (response.ok) {
        setNotices(prev => prev.filter(notice => notice.id !== noticeId));
        toast({
          title: "Success",
          description: "Notice deleted successfully",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete notice');
      }
    } catch (error) {
      console.error('Error deleting notice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete notice",
        variant: "destructive",
      });
    }
  };

  const startEditing = (notice: Notice) => {
    setEditingNotice(notice);
    setNoticeForm({
      title: notice.title,
      content: notice.content,
      priority: notice.priority,
      targetAudience: notice.targetAudience,
      expiresAt: notice.expiresAt ? format(new Date(notice.expiresAt), "yyyy-MM-dd'T'HH:mm") : '',
      attachment: null
    });
  };

  const downloadAttachment = async (attachmentUrl: string, fileName: string) => {
    try {
      const response = await fetch(attachmentUrl);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download attachment",
        variant: "destructive",
      });
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'normal':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      urgent: "destructive",
      high: "secondary",
      normal: "outline",
      low: "default"
    } as const;
    
    return (
      <Badge variant={variants[priority as keyof typeof variants] || "outline"}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const canManageNotices = user && (user.role === 'admin' || user.role === 'teacher');

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading notices...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notice Board
          </h1>
          <p className="text-muted-foreground">Stay updated with important announcements</p>
        </div>
        <div className="flex gap-2">
          {canManageNotices && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Notice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Notice</DialogTitle>
                  <DialogDescription>
                    Create a new notice to inform users about important updates.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={noticeForm.title}
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter notice title"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={noticeForm.content}
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Enter notice content"
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={noticeForm.priority} onValueChange={(value: any) => setNoticeForm(prev => ({ ...prev, priority: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="audience">Target Audience</Label>
                      <Select value={noticeForm.targetAudience} onValueChange={(value: any) => setNoticeForm(prev => ({ ...prev, targetAudience: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="students">Students Only</SelectItem>
                          <SelectItem value="teachers">Teachers Only</SelectItem>
                          {courseId && <SelectItem value="course_specific">This Course Only</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="expires">Expires At (Optional)</Label>
                    <Input
                      id="expires"
                      type="datetime-local"
                      value={noticeForm.expiresAt}
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="attachment">Attachment (Optional)</Label>
                    <Input
                      id="attachment"
                      type="file"
                      onChange={(e) => setNoticeForm(prev => ({ ...prev, attachment: e.target.files?.[0] || null }))}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateNotice}>
                    Create Notice
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {courseId && (
            <Button variant="outline" onClick={() => setLocation(`/courses/${courseId}`)}>
              Back to Course
            </Button>
          )}
        </div>
      </div>

      {/* Welcome Banner for First-Time Visitors */}
      {showWelcomeBanner && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4" />
          <div className="flex items-start justify-between w-full">
            <div>
              <AlertTitle>Welcome to the Notice Board! 📢</AlertTitle>
              <AlertDescription className="mt-2">
                This is where you'll find all important announcements, updates, and notifications. 
                {canManageNotices && " As a teacher/admin, you can create and manage notices for your students."}
                {!canManageNotices && " Stay tuned for updates from your instructors and administrators."}
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowWelcomeBanner(false);
                localStorage.setItem('hasVisitedNoticeBoard', 'true');
              }}
              className="ml-4 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      <div className="space-y-4">
        {notices.map((notice) => (
          <Card key={notice.id} className="w-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {getPriorityIcon(notice.priority)}
                    {notice.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(notice.priority)}
                    <Badge variant="outline">
                      {notice.targetAudience === 'course_specific' ? 'Course Specific' : 
                       notice.targetAudience.charAt(0).toUpperCase() + notice.targetAudience.slice(1)}
                    </Badge>
                  </div>
                </div>
                
                {canManageNotices && notice.authorId === user?.id && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(notice)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteNotice(notice.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {notice.authorName}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(notice.createdAt), 'PPp')}
                </div>
                {notice.expiresAt && (
                  <div className="flex items-center gap-1 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    Expires: {format(new Date(notice.expiresAt), 'PPp')}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="whitespace-pre-wrap">{notice.content}</div>
              
              {notice.attachmentUrl && (
                <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Attachment</p>
                    <p className="text-xs text-muted-foreground">{notice.attachmentUrl.split('/').pop()}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadAttachment(notice.attachmentUrl!, notice.attachmentUrl!.split('/').pop()!)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {notices.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No notices available at the moment.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Notice Dialog */}
      <Dialog open={!!editingNotice} onOpenChange={(open) => !open && setEditingNotice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Notice</DialogTitle>
            <DialogDescription>
              Update the notice information.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={noticeForm.title}
                onChange={(e) => setNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter notice title"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={noticeForm.content}
                onChange={(e) => setNoticeForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter notice content"
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={noticeForm.priority} onValueChange={(value: any) => setNoticeForm(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-audience">Target Audience</Label>
                <Select value={noticeForm.targetAudience} onValueChange={(value: any) => setNoticeForm(prev => ({ ...prev, targetAudience: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="students">Students Only</SelectItem>
                    <SelectItem value="teachers">Teachers Only</SelectItem>
                    {courseId && <SelectItem value="course_specific">This Course Only</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-expires">Expires At (Optional)</Label>
              <Input
                id="edit-expires"
                type="datetime-local"
                value={noticeForm.expiresAt}
                onChange={(e) => setNoticeForm(prev => ({ ...prev, expiresAt: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-attachment">New Attachment (Optional)</Label>
              <Input
                id="edit-attachment"
                type="file"
                onChange={(e) => setNoticeForm(prev => ({ ...prev, attachment: e.target.files?.[0] || null }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNotice(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNotice}>
              Update Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}