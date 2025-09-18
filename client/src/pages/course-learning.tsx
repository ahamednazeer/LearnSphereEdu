import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { authenticatedApiRequest } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef } from "react";
import { 
  FileIcon, Eye, Download, ZoomIn, ZoomOut, BookOpen, 
  CheckCircle, Circle, Play, Pause, SkipForward, SkipBack,
  Clock, Users, Star, ChevronLeft, ChevronRight, Menu,
  X, Award, Target, BookMarked, Volume2, VolumeX, Maximize,
  Settings, MessageCircle, StickyNote, Bookmark, Share2,
  RotateCcw, FastForward, Rewind, PauseCircle, PlayCircle,
  FileText, MessageSquare, ThumbsUp, ThumbsDown, Flag,
  Edit3, Save, Trash2, Plus, Search, Filter, Calendar,
  TrendingUp, BarChart3, Trophy, Download as DownloadIcon,
  ExternalLink, Link, Info
} from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ShareButton } from "@/components/share-button";

// Set up PDF.js worker - use local worker file to avoid CDN issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function CourseLearning() {
  const [match, params] = useRoute("/courses/:id/learn");
  const courseId = params?.id;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeModule, setActiveModule] = useState(0);
  const [activeLesson, setActiveLesson] = useState(0);
  const [activeTab, setActiveTab] = useState("content");
  
  // PDF viewer state
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [pdfViewerError, setPdfViewerError] = useState(false);
  
  // Video state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Notes and bookmarks
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  
  // Article content state
  const [articleContent, setArticleContent] = useState<string>("");
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string>("");
  
  // Discussion
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [newDiscussion, setNewDiscussion] = useState({
    title: "",
    description: "",
  });
  const [showDiscussionDialog, setShowDiscussionDialog] = useState(false);
  
  // Learning analytics
  const [timeSpent, setTimeSpent] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  
  const { data: courseData, isLoading, error: modulesError } = useQuery({
    queryKey: ["/api/protected/courses", courseId, "modules"],
    queryFn: async () => {
      const res = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}/modules`);
      if (!res.ok) {
        let errorMessage = 'Failed to fetch course modules';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use the response text or status
          try {
            errorMessage = await res.text() || `HTTP ${res.status}: ${res.statusText}`;
          } catch (textError) {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }
      return res.json();
    },
    enabled: !!courseId,
    retry: false, // Don't retry on enrollment errors
  });

  // Get course details
  const { data: course, isLoading: courseLoading, error: courseError } = useQuery({
    queryKey: ["/api/protected/courses", courseId],
    queryFn: async () => {
      const res = await authenticatedApiRequest("GET", `/api/protected/courses/${courseId}`);
      if (!res.ok) {
        let errorMessage = 'Failed to fetch course details';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          try {
            errorMessage = await res.text() || `HTTP ${res.status}: ${res.statusText}`;
          } catch (textError) {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }
      return res.json();
    },
    enabled: !!courseId,
  });

  // Enrollment mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/enroll`);
      if (!res.ok) {
        let errorMessage = 'Failed to enroll';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          try {
            errorMessage = await res.text() || `HTTP ${res.status}: ${res.statusText}`;
          } catch (textError) {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses", courseId, "modules"] });
      toast({
        title: "Enrolled successfully!",
        description: "You can now access this course content.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enrollment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Discussion creation mutation
  const createDiscussionMutation = useMutation({
    mutationFn: async (discussionData: any) => {
      const response = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/discussions`, {
        ...discussionData,
        createdBy: user?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      setShowDiscussionDialog(false);
      setNewDiscussion({ title: "", description: "" });
      toast({
        title: "Discussion created!",
        description: "Your discussion topic has been posted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create discussion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get current lesson data early for useEffect dependencies
  const modules = courseData || [];
  const lessons = modules[activeModule]?.lessons || [];
  const lesson = lessons[activeLesson];

  // Debug logging for lesson data
  useEffect(() => {
    if (lesson) {
      console.log('Current lesson data:', {
        id: lesson.id,
        title: lesson.title,
        contentType: lesson.contentType,
        contentUrl: lesson.contentUrl,
        url: lesson.url,
        hasContent: !!(lesson.contentType && lesson.url),
        description: lesson.description
      });
    }
  }, [lesson]);

  // Debug logging for modules data
  useEffect(() => {
    if (modules && modules.length > 0) {
      console.log('Modules data:', modules.map(module => ({
        id: module.id,
        title: module.title,
        lessonsCount: module.lessons?.length || 0,
        lessons: module.lessons?.map(l => ({
          id: l.id,
          title: l.title,
          contentType: l.contentType,
          hasUrl: !!l.url,
          hasContentUrl: !!l.contentUrl
        })) || []
      })));
    }
  }, [modules]);

  // Auto-fetch article content when lesson changes
  useEffect(() => {
    if (lesson?.contentType === "article" && lesson.url && !lesson.content) {
      // Reset states
      setArticleContent("");
      setArticleError("");
      
      // Only auto-fetch for certain domains that are likely to work
      const url = lesson.url.toLowerCase();
      const autoFetchDomains = [
        'medium.com', 'dev.to', 'hashnode.com', 'blog.', 'docs.',
        'github.io', 'wikipedia.org', 'stackoverflow.com'
      ];
      
      const shouldAutoFetch = autoFetchDomains.some(domain => url.includes(domain));
      
      if (shouldAutoFetch) {
        fetchArticleContent(lesson.url);
      }
    }
  }, [lesson?.id, lesson?.contentType, lesson?.url]);

  // Helper functions
  const calculateCourseProgress = (modules: any[]) => {
    if (!modules || modules.length === 0) return 0;
    
    const totalLessons = modules.reduce((total, module) => 
      total + (module.lessons?.length || 0), 0
    );
    
    if (totalLessons === 0) return 0;
    
    const completedLessons = modules.reduce((total, module) => 
      total + (module.lessons?.filter((lesson: any) => lesson.completed)?.length || 0), 0
    );
    
    return Math.round((completedLessons / totalLessons) * 100);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!isFullscreen) {
        videoRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  const addNote = () => {
    if (newNote.trim()) {
      const note = {
        id: Date.now(),
        content: newNote,
        timestamp: videoRef.current?.currentTime || 0,
        lessonId: lesson?.id,
        createdAt: new Date().toISOString()
      };
      setNotes([...notes, note]);
      setNewNote("");
      setShowNoteDialog(false);
      toast({
        title: "Note added",
        description: "Your note has been saved successfully.",
      });
    }
  };

  const addBookmark = () => {
    const bookmark = {
      id: Date.now(),
      timestamp: videoRef.current?.currentTime || 0,
      lessonId: lesson?.id,
      lessonTitle: lesson?.title,
      moduleTitle: modules[activeModule]?.title,
      createdAt: new Date().toISOString()
    };
    setBookmarks([...bookmarks, bookmark]);
    toast({
      title: "Bookmark added",
      description: "You can find this bookmark in your notes section.",
    });
  };

  const jumpToBookmark = (timestamp: number) => {
    if (videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = timestamp;
    }
  };

  const handleCreateDiscussion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscussion.title.trim()) {
      toast({
        title: "Please enter a title",
        description: "Discussion title is required.",
        variant: "destructive",
      });
      return;
    }
    createDiscussionMutation.mutate(newDiscussion);
  };



  const seekVideo = (percentage: number) => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    if (!video.duration || isNaN(video.duration)) return;
    
    const targetTime = (percentage / 100) * video.duration;
    video.currentTime = targetTime;
  };

  const skipForward = () => {
    if (videoRef.current && videoRef.current.duration) {
      const video = videoRef.current;
      video.currentTime = Math.min(video.currentTime + 10, video.duration);
    }
  };

  const skipBackward = () => {
    if (videoRef.current && videoRef.current.duration) {
      const video = videoRef.current;
      video.currentTime = Math.max(video.currentTime - 10, 0);
    }
  };

  const deleteNote = (noteId: number) => {
    setNotes(notes.filter(n => n.id !== noteId));
    toast({
      title: "Note deleted",
      description: "Your note has been removed.",
    });
  };

  const deleteBookmark = (bookmarkId: number) => {
    setBookmarks(bookmarks.filter(b => b.id !== bookmarkId));
    toast({
      title: "Bookmark deleted",
      description: "Your bookmark has been removed.",
    });
  };

  // Article content fetching with CORS proxy
  const fetchArticleContent = async (url: string) => {
    setArticleLoading(true);
    setArticleError("");
    setArticleContent("");

    try {
      // Try multiple approaches for fetching content
      const corsProxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://cors-anywhere.herokuapp.com/${url}`,
      ];

      let content = "";
      let success = false;

      // Try each proxy service
      for (const proxyUrl of corsProxies) {
        try {
          const response = await fetch(proxyUrl, {
            headers: {
              'Accept': 'application/json, text/html, */*',
            },
          });

          if (response.ok) {
            const data = await response.json();
            const htmlContent = data.contents || data.data || data;
            
            if (htmlContent && typeof htmlContent === 'string') {
              // Extract main content using simple heuristics
              content = extractMainContent(htmlContent);
              if (content.length > 100) { // Ensure we got meaningful content
                success = true;
                break;
              }
            }
          }
        } catch (proxyError) {
          console.log(`Proxy ${proxyUrl} failed:`, proxyError);
          continue;
        }
      }

      if (success && content) {
        setArticleContent(content);
      } else {
        throw new Error("Unable to fetch article content");
      }
    } catch (error) {
      console.error("Failed to fetch article content:", error);
      setArticleError("Unable to load article content. The article may have restrictions that prevent direct loading.");
    } finally {
      setArticleLoading(false);
    }
  };

  // Enhanced text content extraction with better formatting
  const extractMainContent = (html: string): string => {
    try {
      // Create a temporary DOM element to parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove unwanted elements completely
      const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.advertisement', '.ads', '.social-share', '.comments',
        '.sidebar', '.menu', '.navigation', '.cookie-banner',
        '.related-posts', '.author-bio', '.newsletter-signup',
        '.social-buttons', '.share-buttons', '.breadcrumb',
        'iframe', 'embed', 'object', 'video', 'audio',
        '.code-toolbar', '.toolbar', '.copy-button', '.highlight-toolbar',
        '.wp-block-code', '.code-block-header', '.line-numbers',
        '.social-media', '.tags', '.categories', '.metadata',
        '.author-info', '.publication-date', '.reading-time',
        '.table-of-contents', '.toc', '.jump-to-section'
      ];
      
      unwantedSelectors.forEach(selector => {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // Try to find main content area with enhanced selectors
      const contentSelectors = [
        'article', 'main', '.post-content', '.entry-content',
        '.article-content', '.blog-content', '.post-body', 
        '.article-body', '.content', '[role="main"]',
        '.aws-blog-post-content', '.blog-post-content',
        '.markdown-body', '.post-text', '.article-text',
        '.content-body', '.main-content', '.primary-content',
        '.post-container', '.article-container', '.blog-container'
      ];

      let mainContent = null;
      for (const selector of contentSelectors) {
        const element = doc.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 200) {
          mainContent = element;
          break;
        }
      }

      // Fallback to body if no main content found
      if (!mainContent) {
        mainContent = doc.body;
      }

      if (mainContent) {
        // Enhanced text content extraction with better structure preservation
        let textContent = '';
        let inCodeBlock = false;
        let codeBlockContent = '';
        
        // Process each element to maintain structure with enhanced formatting
        const processElement = (element: Element, depth: number = 0): string => {
          let result = '';
          
          for (const child of Array.from(element.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent?.trim();
              if (text && !inCodeBlock) {
                // Add space only if not at the beginning of a line
                const needsSpace = result.length > 0 && !result.endsWith('\n') && !result.endsWith(' ');
                result += (needsSpace ? ' ' : '') + text;
              } else if (text && inCodeBlock) {
                codeBlockContent += text;
              }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as Element;
              const tagName = el.tagName.toLowerCase();
              
              // Skip if element is hidden or has no visible content
              const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
              if (style && (style.display === 'none' || style.visibility === 'hidden')) {
                continue;
              }
              
              switch (tagName) {
                case 'h1':
                  const h1Text = el.textContent?.trim();
                  if (h1Text && h1Text.length > 0) {
                    result += `\n\n# ${h1Text}\n\n`;
                  }
                  break;
                  
                case 'h2':
                  const h2Text = el.textContent?.trim();
                  if (h2Text && h2Text.length > 0) {
                    result += `\n\n## ${h2Text}\n\n`;
                  }
                  break;
                  
                case 'h3':
                  const h3Text = el.textContent?.trim();
                  if (h3Text && h3Text.length > 0) {
                    result += `\n\n### ${h3Text}\n\n`;
                  }
                  break;
                  
                case 'h4':
                  const h4Text = el.textContent?.trim();
                  if (h4Text && h4Text.length > 0) {
                    result += `\n\n#### ${h4Text}\n\n`;
                  }
                  break;
                  
                case 'h5':
                case 'h6':
                  const hText = el.textContent?.trim();
                  if (hText && hText.length > 0) {
                    result += `\n\n#### ${hText}\n\n`;
                  }
                  break;
                  
                case 'p':
                  const pText = processInlineElements(el);
                  if (pText && pText.trim().length > 0) {
                    result += `${pText}\n\n`;
                  }
                  break;
                  
                case 'ul':
                  result += '\n';
                  const ulItems = el.querySelectorAll(':scope > li');
                  ulItems.forEach((li) => {
                    const liText = processInlineElements(li);
                    if (liText && liText.trim().length > 0) {
                      result += `• ${liText.trim()}\n`;
                    }
                  });
                  result += '\n';
                  break;
                  
                case 'ol':
                  result += '\n';
                  const olItems = el.querySelectorAll(':scope > li');
                  olItems.forEach((li, index) => {
                    const liText = processInlineElements(li);
                    if (liText && liText.trim().length > 0) {
                      result += `${index + 1}. ${liText.trim()}\n`;
                    }
                  });
                  result += '\n';
                  break;
                  
                case 'blockquote':
                  const quoteText = processInlineElements(el);
                  if (quoteText && quoteText.trim().length > 0) {
                    // Handle multi-line blockquotes
                    const lines = quoteText.trim().split('\n');
                    result += '\n';
                    lines.forEach(line => {
                      if (line.trim()) {
                        result += `> ${line.trim()}\n`;
                      }
                    });
                    result += '\n';
                  }
                  break;
                  
                case 'pre':
                  const preText = el.textContent?.trim();
                  if (preText && preText.length > 0) {
                    result += `\n\`\`\`\n${preText}\n\`\`\`\n\n`;
                  }
                  break;
                  
                case 'code':
                  // Handle inline code vs code blocks
                  const parent = el.parentElement;
                  if (parent && parent.tagName.toLowerCase() === 'pre') {
                    // Skip - handled by pre tag
                    break;
                  }
                  const codeText = el.textContent?.trim();
                  if (codeText && codeText.length > 0) {
                    result += `\`${codeText}\``;
                  }
                  break;
                  
                case 'table':
                  // Simple table handling - convert to text format
                  const rows = el.querySelectorAll('tr');
                  if (rows.length > 0) {
                    result += '\n';
                    rows.forEach((row, rowIndex) => {
                      const cells = row.querySelectorAll('td, th');
                      const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
                      if (cellTexts.some(text => text.length > 0)) {
                        result += `| ${cellTexts.join(' | ')} |\n`;
                        if (rowIndex === 0 && row.querySelector('th')) {
                          // Add separator for header row
                          result += `| ${cellTexts.map(() => '---').join(' | ')} |\n`;
                        }
                      }
                    });
                    result += '\n';
                  }
                  break;
                  
                case 'br':
                  result += '\n';
                  break;
                  
                case 'hr':
                  result += '\n---\n\n';
                  break;
                  
                case 'div':
                case 'section':
                case 'article':
                case 'span':
                  // Recursively process container elements
                  const containerContent = processElement(el, depth + 1);
                  if (containerContent.trim()) {
                    result += containerContent;
                  }
                  break;
                  
                default:
                  // For other elements, process inline content
                  const otherContent = processInlineElements(el);
                  if (otherContent && otherContent.trim().length > 0) {
                    result += otherContent;
                  }
                  break;
              }
            }
          }
          
          return result;
        };
        
        // Helper function to process inline elements and preserve formatting
        const processInlineElements = (element: Element): string => {
          let result = '';
          
          for (const child of Array.from(element.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent || '';
              result += text;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as Element;
              const tagName = el.tagName.toLowerCase();
              
              switch (tagName) {
                case 'strong':
                case 'b':
                  const strongText = el.textContent?.trim();
                  if (strongText) {
                    result += `**${strongText}**`;
                  }
                  break;
                  
                case 'em':
                case 'i':
                  const emText = el.textContent?.trim();
                  if (emText) {
                    result += `*${emText}*`;
                  }
                  break;
                  
                case 'code':
                  const codeText = el.textContent?.trim();
                  if (codeText) {
                    result += `\`${codeText}\``;
                  }
                  break;
                  
                case 'a':
                  const linkText = el.textContent?.trim();
                  const href = el.getAttribute('href');
                  if (linkText && href) {
                    // Make relative URLs absolute if possible
                    const fullHref = href.startsWith('http') ? href : 
                                   href.startsWith('/') ? `${window.location.origin}${href}` : href;
                    result += `[${linkText}](${fullHref})`;
                  } else if (linkText) {
                    result += linkText;
                  }
                  break;
                  
                case 'br':
                  result += '\n';
                  break;
                  
                default:
                  // For other inline elements, just get text content
                  const text = el.textContent || '';
                  result += text;
                  break;
              }
            }
          }
          
          return result;
        };
        
        textContent = processElement(mainContent);
        
        // Enhanced text cleanup
        textContent = textContent
          // Normalize whitespace
          .replace(/[ \t]+/g, ' ')
          // Clean up excessive newlines
          .replace(/\n\s*\n\s*\n+/g, '\n\n')
          // Remove trailing spaces from lines
          .split('\n')
          .map(line => line.replace(/\s+$/, ''))
          .join('\n')
          // Clean up spacing around headings
          .replace(/\n\n(#{1,6})/g, '\n\n$1')
          .replace(/(#{1,6}[^\n]+)\n\n\n/g, '$1\n\n')
          // Clean up list spacing
          .replace(/\n\n([•\-\*]|\d+\.)/g, '\n$1')
          .replace(/([•\-\*]|\d+\.)[^\n]+\n\n\n/g, (match) => match.replace(/\n\n\n/, '\n\n'))
          // Clean up blockquote spacing
          .replace(/\n\n>/g, '\n>')
          .replace(/>\s[^\n]+\n\n\n/g, (match) => match.replace(/\n\n\n/, '\n\n'))
          // Remove empty lines at start and end
          .trim();

        // Ensure minimum content length and quality
        if (textContent.length < 100) {
          // Fallback to simple text extraction with basic formatting
          const simpleText = mainContent.textContent?.trim() || '';
          if (simpleText.length > textContent.length) {
            textContent = simpleText
              .replace(/\s+/g, ' ')
              .replace(/(.{80,100})\s/g, '$1\n\n')
              .trim();
          }
        }

        return textContent;
      }

      return "";
    } catch (error) {
      console.error("Error extracting content:", error);
      return "";
    }
  };

  const calculateEstimatedTime = (modules: any[]) => {
    // Estimate based on content type and length
    let totalMinutes = 0;
    if (!modules || !Array.isArray(modules)) {
      return '0m';
    }
    modules.forEach(module => {
      module.lessons?.forEach((lesson: any) => {
        if (lesson.contentType === 'video' && lesson.duration && typeof lesson.duration === 'string') {
          // Parse duration like "10:30" to minutes
          try {
            const parts = lesson.duration.split(':');
            if (parts.length >= 2) {
              totalMinutes += parseInt(parts[0]) + (parseInt(parts[1]) / 60);
            } else {
              totalMinutes += 5; // Default if duration format is unexpected
            }
          } catch (error) {
            totalMinutes += 5; // Default if parsing fails
          }
        } else if (lesson.contentType === 'pdf') {
          totalMinutes += 15; // Estimate 15 minutes per PDF
        } else if (lesson.contentType === 'article') {
          totalMinutes += 10; // Estimate 10 minutes per article
        } else if (lesson.contentType === 'text') {
          // Estimate reading time based on content length (average 200 words per minute)
          if (lesson.content) {
            const wordCount = lesson.content.split(/\s+/).length;
            totalMinutes += Math.max(2, Math.ceil(wordCount / 200)); // Minimum 2 minutes
          } else {
            totalMinutes += 5; // Default if no content
          }
        } else {
          totalMinutes += 5; // Default 5 minutes
        }
      });
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getNextLesson = () => {
    const modules = courseData || [];
    const currentModule = modules[activeModule];
    
    if (!currentModule) return null;
    
    // Try next lesson in current module
    if (activeLesson < (currentModule.lessons?.length || 0) - 1) {
      return {
        moduleIndex: activeModule,
        lessonIndex: activeLesson + 1,
        lesson: currentModule.lessons[activeLesson + 1]
      };
    }
    
    // Try first lesson of next module
    if (activeModule < modules.length - 1) {
      const nextModule = modules[activeModule + 1];
      if (nextModule.lessons && nextModule.lessons.length > 0) {
        return {
          moduleIndex: activeModule + 1,
          lessonIndex: 0,
          lesson: nextModule.lessons[0]
        };
      }
    }
    
    return null;
  };

  const getPreviousLesson = () => {
    const modules = courseData || [];
    
    // Try previous lesson in current module
    if (activeLesson > 0) {
      const currentModule = modules[activeModule];
      return {
        moduleIndex: activeModule,
        lessonIndex: activeLesson - 1,
        lesson: currentModule.lessons[activeLesson - 1]
      };
    }
    
    // Try last lesson of previous module
    if (activeModule > 0) {
      const prevModule = modules[activeModule - 1];
      if (prevModule.lessons && prevModule.lessons.length > 0) {
        return {
          moduleIndex: activeModule - 1,
          lessonIndex: prevModule.lessons.length - 1,
          lesson: prevModule.lessons[prevModule.lessons.length - 1]
        };
      }
    }
    
    return null;
  };

  const markCompleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const res = await authenticatedApiRequest("POST", `/api/protected/courses/${courseId}/lessons/${lessonId}/complete`);
      if (!res.ok) {
        let errorMessage = 'Failed to mark lesson as complete';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          try {
            errorMessage = await res.text() || `HTTP ${res.status}: ${res.statusText}`;
          } catch (textError) {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protected/courses", courseId, "modules"] });
      toast({
        title: "Lesson completed!",
        description: "Great job! Keep up the good work.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark lesson complete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Track time spent in lesson
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Monitor video element changes
  useEffect(() => {
    if (videoRef.current && lesson?.contentType === 'video') {
      const video = videoRef.current;
      console.log('Video element changed/mounted:', {
        src: video.src,
        duration: video.duration,
        currentTime: video.currentTime,
        readyState: video.readyState
      });
      
      // Add a simple test - try to seek to 5 seconds after video loads
      const testSeekAfterLoad = () => {
        if (video.duration && video.duration > 5) {
          console.log('Testing seek to 5 seconds...');
          setTimeout(() => {
            video.currentTime = 5;
            setTimeout(() => {
              console.log('Test seek result - current time:', video.currentTime);
            }, 200);
          }, 1000);
        }
      };
      
      if (video.readyState >= 2) {
        testSeekAfterLoad();
      } else {
        video.addEventListener('loadedmetadata', testSeekAfterLoad, { once: true });
      }
    }
  }, [lesson?.id, lesson?.url]);

  // Keyboard shortcuts for video player
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current || lesson?.contentType !== 'video') return;
      
      // Prevent default behavior when video is focused or when not in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [lesson?.contentType]);

  // Reset session time and PDF viewer when lesson changes
  useEffect(() => {
    setSessionStartTime(Date.now());
    setTimeSpent(0);
    setPdfViewerError(false);
    setPdfPageNumber(1);
    
    // Only reset video state if we're not currently seeking
    if (!isSeeking) {
      console.log('Resetting video state for lesson change');
      setVideoProgress(0);
      setVideoDuration(0);
      setIsPlaying(false);
      setIsSeeking(false);
      setIsVideoLoading(false);
    } else {
      console.log('Skipping video state reset - currently seeking');
    }
  }, [activeModule, activeLesson]);

  // Load notes and bookmarks for current lesson
  useEffect(() => {
    if (lesson?.id) {
      // In a real app, you'd load these from an API
      const savedNotes = localStorage.getItem(`notes_${lesson.id}`);
      const savedBookmarks = localStorage.getItem(`bookmarks_${lesson.id}`);
      
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      } else {
        setNotes([]);
      }
      
      if (savedBookmarks) {
        setBookmarks(JSON.parse(savedBookmarks));
      } else {
        setBookmarks([]);
      }
    }
  }, [lesson?.id]);

  // Save notes and bookmarks to localStorage
  useEffect(() => {
    if (lesson?.id) {
      if (notes.length > 0) {
        localStorage.setItem(`notes_${lesson.id}`, JSON.stringify(notes));
      } else {
        // Clear localStorage if no notes
        localStorage.removeItem(`notes_${lesson.id}`);
      }
    }
  }, [notes, lesson?.id]);

  useEffect(() => {
    if (lesson?.id) {
      if (bookmarks.length > 0) {
        localStorage.setItem(`bookmarks_${lesson.id}`, JSON.stringify(bookmarks));
      } else {
        // Clear localStorage if no bookmarks
        localStorage.removeItem(`bookmarks_${lesson.id}`);
      }
    }
  }, [bookmarks, lesson?.id]);

  // Debug logging
  console.log('Course Learning Debug:', {
    courseId,
    isLoading,
    courseLoading,
    courseData: !!courseData,
    course: !!course,
    modulesError: modulesError?.message,
    courseError: courseError?.message,
    user: user?.role
  });

  // Check if there's an enrollment error
  const isNotEnrolled = modulesError?.message?.includes("Not enrolled in this course");
  
  // Show loading state while either query is loading
  if (isLoading || courseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  // Show error if course details failed to load
  if (courseError) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Course</h3>
            <p className="text-muted-foreground mb-4">{courseError.message}</p>
            <Button onClick={() => setLocation('/courses')}>
              Back to Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show enrollment prompt if student is not enrolled
  if (isNotEnrolled && user?.role === 'student') {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardHeader className="text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="text-2xl mb-2">Enroll to Access Course Content</CardTitle>
            <p className="text-muted-foreground">
              You need to enroll in this course to access its lessons and materials.
            </p>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">{course.title}</h3>
              <p className="text-muted-foreground mb-4">{course.description}</p>
              <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                <span>Subject: {course.subject}</span>
                {course.duration && <span>Duration: {course.duration}</span>}
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button 
                onClick={() => setLocation(`/courses/${courseId}`)}
                variant="outline"
              >
                View Course Details
              </Button>
              <Button 
                onClick={() => enrollMutation.mutate()}
                disabled={enrollMutation.isPending}
              >
                {enrollMutation.isPending ? "Enrolling..." : "Enroll Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error for other types of errors
  if (modulesError && !isNotEnrolled) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Course</h3>
            <p className="text-muted-foreground mb-4">{modulesError.message}</p>
            <Button onClick={() => setLocation('/courses')}>
              Back to Courses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!courseData) return <div>Loading course content...</div>;

  const courseProgress = calculateCourseProgress(modules);
  const nextLesson = getNextLesson();
  const previousLesson = getPreviousLesson();
  const estimatedTime = calculateEstimatedTime(modules || []);

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/courses')}
                className="flex items-center gap-2 hover:bg-muted"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Courses
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-lg font-semibold truncate max-w-md">{course?.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {courseProgress}% Complete
                    </span>
                    <span className="flex items-center gap-1">
                      <BookMarked className="w-3 h-3" />
                      {modules.length} Modules
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {estimatedTime} total
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {formatTime(timeSpent)} this session
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Course Actions */}
              <div className="hidden md:flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Progress
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Course Progress</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary mb-2">{courseProgress}%</div>
                        <Progress value={courseProgress} className="w-full" />
                        <p className="text-sm text-muted-foreground mt-2">
                          {modules.reduce((total, module) => 
                            total + (module.lessons?.filter((l: any) => l.completed)?.length || 0), 0
                          )} of {modules.reduce((total, module) => 
                            total + (module.lessons?.length || 0), 0
                          )} lessons completed
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Time spent this session:</span>
                          <span className="font-medium">{formatTime(timeSpent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Estimated total time:</span>
                          <span className="font-medium">{estimatedTime}</span>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <ShareButton 
                  title={`I'm learning: ${course?.title || 'this course'}`}
                  description={`Check out this amazing course I'm taking! ${course?.description || ''}`}
                  variant="outline"
                  size="sm"
                />
              </div>

              <Progress value={courseProgress} className="w-32 hidden lg:block" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r bg-card`}>
          <div className="p-4 h-[calc(100vh-80px)] overflow-y-auto">
            <div className="space-y-4">
              {modules.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No content available yet</p>
                </div>
              ) : (
                modules.map((module: any, moduleIdx: number) => (
                  <div key={module.id} className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{module.title}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {module.lessons?.length || 0}
                      </Badge>
                    </div>
                    
                    {module.lessons && module.lessons.length > 0 && (
                      <div className="space-y-1 ml-2">
                        {module.lessons.map((lessonItem: any, lessonIdx: number) => {
                          const isActive = moduleIdx === activeModule && lessonIdx === activeLesson;
                          const isCompleted = lessonItem.completed;
                          
                          return (
                            <div
                              key={lessonItem.id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                isActive 
                                  ? 'bg-primary/10 border border-primary/20' 
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => {
                                setActiveModule(moduleIdx);
                                setActiveLesson(lessonIdx);
                              }}
                            >
                              <div className="flex-shrink-0">
                                {isCompleted ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  isActive ? 'text-primary' : 'text-foreground'
                                }`}>
                                  {lessonItem.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {lessonItem.contentType}
                                  </Badge>
                                  {lessonItem.duration && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {lessonItem.duration}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Main Content */}
        <div className="flex-1 min-w-0">
          {!lesson ? (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
              <div className="text-center max-w-md">
                <BookOpen className="w-20 h-20 text-primary mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-3">Welcome to Your Learning Journey</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Ready to dive in? Select a lesson from the sidebar to begin your learning experience. 
                  Track your progress, take notes, and master new skills at your own pace.
                </p>
                {modules.length > 0 && modules[0].lessons && modules[0].lessons.length > 0 && (
                  <div className="space-y-4">
                    <Button 
                      size="lg"
                      onClick={() => {
                        setActiveModule(0);
                        setActiveLesson(0);
                      }}
                      className="flex items-center gap-2"
                    >
                      <PlayCircle className="w-5 h-5" />
                      Start First Lesson
                    </Button>
                    <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookMarked className="w-4 h-4" />
                        {modules.length} Modules
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {estimatedTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        Certificate
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[calc(100vh-80px)] flex flex-col">
              {/* Enhanced Lesson Header */}
              <div className="border-b bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-semibold">{lesson.title}</h2>
                      <Badge variant="outline" className="text-xs">
                        {lesson.contentType}
                      </Badge>
                      {lesson.completed && (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Module {activeModule + 1}: {modules[activeModule]?.title}</span>
                      <span>•</span>
                      <span>Lesson {activeLesson + 1} of {lessons.length}</span>
                      {lesson.duration && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {lesson.duration}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {formatTime(timeSpent)} spent
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Quick Actions */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addBookmark}
                      className="flex items-center gap-1"
                    >
                      <Bookmark className="w-4 h-4" />
                    </Button>
                    
                    <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="flex items-center gap-1">
                          <StickyNote className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Note</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            placeholder="Write your note here..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            rows={4}
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={addNote}>
                              Save Note
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Separator orientation="vertical" className="h-6" />
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (previousLesson) {
                          setActiveModule(previousLesson.moduleIndex);
                          setActiveLesson(previousLesson.lessonIndex);
                          setActiveTab("content");
                        }
                      }}
                      disabled={!previousLesson}
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (nextLesson) {
                          setActiveModule(nextLesson.moduleIndex);
                          setActiveLesson(nextLesson.lessonIndex);
                          setActiveTab("content");
                        }
                      }}
                      disabled={!nextLesson}
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Enhanced Tabbed Content */}
              <div className="flex-1 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <div className="border-b bg-muted/30 px-6 py-2">
                    <TabsList className="grid w-full max-w-md grid-cols-4">
                      <TabsTrigger value="content" className="flex items-center gap-2">
                        <PlayCircle className="w-4 h-4" />
                        Content
                      </TabsTrigger>
                      <TabsTrigger value="notes" className="flex items-center gap-2">
                        <StickyNote className="w-4 h-4" />
                        Notes ({notes.length})
                      </TabsTrigger>
                      <TabsTrigger value="discussion" className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Discussion
                      </TabsTrigger>
                      <TabsTrigger value="resources" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Resources
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="content" className="flex-1 overflow-auto m-0">
                    <div className="max-w-4xl mx-auto p-6">
                      {/* Show message when no lesson is selected */}
                      {!lesson && (
                        <div className="text-center py-12">
                          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-xl font-semibold mb-2">Select a Lesson</h3>
                          <p className="text-muted-foreground">
                            Choose a lesson from the sidebar to view its content.
                          </p>
                        </div>
                      )}

                      {/* Enhanced Video Content */}
                      {lesson?.contentType === "video" && lesson.url && (
                        <div className="mb-8">
                          <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4 group">
                            <video 
                              ref={videoRef}
                              src={lesson.url} 
                              className="w-full h-full"
                              controls
                              preload="metadata"
                              onTimeUpdate={(e) => {
                                const video = e.target as HTMLVideoElement;
                                if (video.duration && !isNaN(video.duration) && !isSeeking) {
                                  const newProgress = (video.currentTime / video.duration) * 100;
                                  setVideoProgress(newProgress);
                                }
                              }}
                              onLoadedMetadata={(e) => {
                                const video = e.target as HTMLVideoElement;
                                if (video.duration && !isNaN(video.duration)) {
                                  setVideoDuration(video.duration);
                                  setIsVideoLoading(false);
                                  setVideoProgress(0); // Reset progress when new video loads
                                }
                              }}
                              onPlay={() => setIsPlaying(true)}
                              onPause={() => setIsPlaying(false)}
                              onSeeking={() => setIsSeeking(true)}
                              onSeeked={() => setIsSeeking(false)}
                            />
                            
                            {/* Loading/Seeking Indicator */}
                            {(isVideoLoading || isSeeking) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <div className="bg-black/70 rounded-lg p-4 flex items-center gap-3 text-white">
                                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span className="text-sm">
                                    {isSeeking ? 'Seeking...' : 'Loading...'}
                                  </span>
                                </div>
                              </div>
                            )}
                            

                          </div>
                          
                          {/* Video Info */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatTime(videoDuration)} duration
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                {Math.round(videoProgress)}% watched
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={addBookmark}
                                className="flex items-center gap-2"
                              >
                                <Bookmark className="w-4 h-4" />
                                Bookmark
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowNoteDialog(true)}
                                className="flex items-center gap-2"
                              >
                                <StickyNote className="w-4 h-4" />
                                Add Note
                              </Button>


                            </div>
                          </div>
                        </div>
                      )}

                  {/* PDF Content */}
                  {lesson?.contentType === "pdf" && lesson.url && (
                <div className="border rounded-lg bg-white mb-4">
                  <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
                    <FileIcon className="w-8 h-8 text-red-500" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {lesson.fileName || lesson.title || 'PDF Document'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        PDF Document
                        {lesson.fileSize && ` • ${(lesson.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                        {lesson.pdfPages && ` • ${lesson.pdfPages} pages`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Switch to PDF viewer tab instead of opening new window
                          setActiveTab("content");
                        }}
                        className="flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = lesson.url;
                          link.download = lesson.fileName || lesson.title || 'document.pdf';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                  
                  {/* Enhanced PDF Viewer with iframe fallback */}
                  <div className="relative">
                    {/* PDF Viewer Controls */}
                    <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPdfPageNumber(Math.max(1, pdfPageNumber - 1))}
                          disabled={pdfPageNumber <= 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {pdfPageNumber} of {pdfNumPages || '?'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPdfPageNumber(Math.min(pdfNumPages || 1, pdfPageNumber + 1))}
                          disabled={pdfPageNumber >= (pdfNumPages || 1)}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPdfScale(Math.max(0.5, pdfScale - 0.1))}
                        >
                          <ZoomOut className="w-3 h-3" />
                        </Button>
                        <span className="text-sm">{Math.round(pdfScale * 100)}%</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPdfScale(Math.min(2.0, pdfScale + 0.1))}
                        >
                          <ZoomIn className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* PDF Viewer with fallback */}
                    <div className="min-h-[600px] bg-gray-100">
                      {!pdfViewerError ? (
                        <Document
                          file={lesson.url}
                          onLoadSuccess={({ numPages }) => {
                            setPdfNumPages(numPages);
                            setPdfPageNumber(1);
                            setPdfViewerError(false);
                          }}
                          onLoadError={(error) => {
                            console.error('PDF load error:', error);
                            setPdfViewerError(true);
                          }}
                          loading={
                            <div className="flex items-center justify-center h-96">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-muted-foreground">Loading PDF...</p>
                              </div>
                            </div>
                          }
                        >
                          <div className="flex justify-center p-4">
                            <Page
                              pageNumber={pdfPageNumber}
                              scale={pdfScale}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              loading={
                                <div className="flex items-center justify-center h-96 w-full bg-gray-50 rounded">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                              }
                              onLoadError={() => setPdfViewerError(true)}
                            />
                          </div>
                        </Document>
                      ) : (
                        /* Iframe fallback when react-pdf fails */
                        <div className="h-[600px] w-full">
                          <iframe
                            src={`${lesson.url}#toolbar=1&navpanes=1&scrollbar=1&page=${pdfPageNumber}&zoom=${Math.round(pdfScale * 100)}`}
                            className="w-full h-full border-0"
                            title={lesson.title || 'PDF Document'}
                            onError={() => {
                              // If iframe also fails, show the error message
                              console.error('Iframe PDF viewer also failed');
                            }}
                          />
                          <div className="p-4 bg-yellow-50 border-t border-yellow-200">
                            <div className="flex items-center gap-2 text-sm text-yellow-800">
                              <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                                <span className="text-xs text-yellow-900">!</span>
                              </div>
                              <span>Using fallback PDF viewer. Some features may be limited.</span>
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => {
                                  setPdfViewerError(false);
                                  setPdfPageNumber(1);
                                }}
                                className="text-yellow-800 underline p-0 h-auto"
                              >
                                Try again
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {lesson?.contentType === "file" && lesson.url && (
                <div className="border rounded-lg p-4 bg-gray-50 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <FileIcon className="w-8 h-8 text-blue-500" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {lesson.fileName || lesson.title || 'File'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        File
                        {lesson.fileSize && ` • ${(lesson.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Always show content in the content tab instead of opening new window
                        setActiveTab("content");
                      }}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View File
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = lesson.url;
                        link.download = lesson.fileName || lesson.title || 'file';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
                  {/* Article Content */}
                  {lesson?.contentType === "article" && (
                    <div className="mb-8">
                      <Card>
                        <CardContent className="p-6">
                          {/* Direct content from course builder */}
                          {lesson.content && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                  <FileText className="w-5 h-5" />
                                  Article Content
                                </h3>
                                {lesson.url && (
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      View Original
                                    </a>
                                  </Button>
                                )}
                              </div>
                              
                              <div className="prose prose-lg max-w-none dark:prose-invert">
                                <div 
                                  className="text-foreground leading-7"
                                  dangerouslySetInnerHTML={{ __html: lesson.content }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Fetched external content */}
                          {!lesson.content && lesson.url && articleContent && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                  <FileText className="w-5 h-5" />
                                  Article Content
                                </h3>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      View Original
                                    </a>
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-200 dark:border-green-800 mb-4">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-green-700 dark:text-green-300">
                                    Content loaded successfully from: <span className="font-mono text-xs break-all">{lesson.url}</span>
                                  </p>
                                </div>
                              </div>
                              
                              <div className="prose prose-lg max-w-none dark:prose-invert">
                                <div className="text-foreground leading-7">
                                  {articleContent.split('\n').map((line, index) => {
                                    // Handle different markdown-style formatting
                                    if (line.startsWith('# ')) {
                                      return (
                                        <h1 key={index} className="text-3xl font-bold mt-8 mb-4 text-foreground border-b pb-2">
                                          {line.substring(2)}
                                        </h1>
                                      );
                                    } else if (line.startsWith('## ')) {
                                      return (
                                        <h2 key={index} className="text-2xl font-bold mt-8 mb-4 text-foreground">
                                          {line.substring(3)}
                                        </h2>
                                      );
                                    } else if (line.startsWith('### ')) {
                                      return (
                                        <h3 key={index} className="text-xl font-semibold mt-6 mb-3 text-foreground">
                                          {line.substring(4)}
                                        </h3>
                                      );
                                    } else if (line.startsWith('#### ')) {
                                      return (
                                        <h4 key={index} className="text-lg font-semibold mt-4 mb-2 text-foreground">
                                          {line.substring(5)}
                                        </h4>
                                      );
                                    } else if (line.startsWith('• ') || line.startsWith('- ')) {
                                      return (
                                        <div key={index} className="flex items-start gap-3 mb-2 ml-4">
                                          <span className="text-primary mt-2 text-lg">•</span>
                                          <span className="flex-1 text-base">{line.substring(2)}</span>
                                        </div>
                                      );
                                    } else if (/^\d+\. /.test(line)) {
                                      const match = line.match(/^(\d+)\. (.+)$/);
                                      if (match) {
                                        return (
                                          <div key={index} className="flex items-start gap-3 mb-2 ml-4">
                                            <span className="text-primary font-semibold text-base min-w-[1.5rem]">{match[1]}.</span>
                                            <span className="flex-1 text-base">{match[2]}</span>
                                          </div>
                                        );
                                      }
                                    } else if (line.startsWith('> ')) {
                                      return (
                                        <blockquote key={index} className="border-l-4 border-primary bg-muted/30 pl-6 py-4 my-6 italic text-muted-foreground text-base rounded-r">
                                          {line.substring(2)}
                                        </blockquote>
                                      );
                                    } else if (line.startsWith('```')) {
                                      return null; // Handle code blocks separately
                                    } else if (line.trim() === '') {
                                      return <div key={index} className="h-4"></div>;
                                    } else {
                                      // Regular paragraph with inline formatting
                                      let formattedLine = line;
                                      
                                      // Handle bold text
                                      formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
                                      
                                      // Handle italic text
                                      formattedLine = formattedLine.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
                                      
                                      // Handle inline code
                                      formattedLine = formattedLine.replace(/`([^`]+)`/g, '<code class="bg-muted px-2 py-1 rounded text-sm font-mono border">$1</code>');
                                      
                                      // Handle links
                                      formattedLine = formattedLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium">$1</a>');
                                      
                                      return (
                                        <p 
                                          key={index} 
                                          className="mb-4 text-base leading-7 text-foreground"
                                          dangerouslySetInnerHTML={{ __html: formattedLine }}
                                        />
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Loading state */}
                          {!lesson.content && lesson.url && articleLoading && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Loading Article Content</h3>
                                <Button variant="outline" size="sm" asChild>
                                  <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    View Original
                                  </a>
                                </Button>
                              </div>
                              
                              <div className="flex items-center justify-center py-12">
                                <div className="flex items-center gap-3">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                  <p className="text-muted-foreground">Fetching article content...</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* External link fallback */}
                          {!lesson.content && lesson.url && !articleLoading && !articleContent && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">External Article</h3>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => fetchArticleContent(lesson.url)}
                                    disabled={articleLoading}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Try Load Content
                                  </Button>
                                  <Button asChild>
                                    <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      Read Article
                                    </a>
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-primary">
                                <div className="flex items-start gap-3">
                                  <Link className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm mb-1">External Resource</p>
                                    <p className="text-xs text-muted-foreground break-all mb-2">{lesson.url}</p>
                                    {lesson.description && (
                                      <p className="text-sm text-muted-foreground">
                                        {lesson.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {articleError && (
                                <div className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                                  <div className="flex items-start gap-2">
                                    <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-yellow-700 dark:text-yellow-300">
                                      {articleError} You can still access the article by clicking "Read Article" above.
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                  <p>
                                    This lesson links to an external article. You can try to load the content directly using "Try Load Content" 
                                    or click "Read Article" to open it in a new tab. Make sure to read through the content and return here to mark the lesson as complete.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No content available */}
                          {!lesson.content && !lesson.url && (
                            <div className="text-center py-8">
                              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                              <p className="text-muted-foreground">No article content or URL provided.</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Quiz Content */}
                  {lesson?.contentType === "quiz" && (
                    <div className="mb-8">
                      <Card>
                        <CardContent className="p-6 text-center">
                          <Award className="w-16 h-16 text-primary mx-auto mb-4" />
                          <h3 className="text-xl font-semibold mb-2">Quiz Coming Soon</h3>
                          <p className="text-muted-foreground">
                            Interactive quizzes are being prepared for this lesson.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Generic File Content */}
                  {lesson?.contentType === "file" && lesson.url && (
                    <div className="mb-8">
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">File Content</h3>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="w-4 h-4 mr-2" />
                                  Open in New Tab
                                </a>
                              </Button>
                              <Button variant="outline" size="sm" asChild>
                                <a href={lesson.url + '/download'} download={lesson.fileName || lesson.title}>
                                  <DownloadIcon className="w-4 h-4 mr-2" />
                                  Download
                                </a>
                              </Button>
                            </div>
                          </div>
                          {/* Embedded iframe for file content */}
                          <div className="border rounded-lg overflow-hidden">
                            <iframe
                              src={lesson.url}
                              className="w-full h-[600px]"
                              title={lesson.title}
                              onError={() => {
                                console.log('File iframe failed to load');
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                      {/* Fallback for lessons without content */}
                      {lesson && !lesson.url && !lesson.contentType && (
                        <div className="mb-8">
                          <Card>
                            <CardContent className="p-8 text-center">
                              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                              <h3 className="text-xl font-semibold mb-2">No Content Available</h3>
                              <p className="text-muted-foreground mb-4">
                                This lesson doesn't have any content uploaded yet. Please check back later or contact your instructor.
                              </p>
                              {lesson.description && (
                                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                                  <h4 className="font-medium mb-2">Lesson Description</h4>
                                  <div 
                                    className="text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
                                    dangerouslySetInnerHTML={{ __html: lesson.description }}
                                  />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Text Content */}
                      {lesson?.contentType === "text" && lesson.content && (
                        <div className="mb-8">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Lesson Content
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                              <div className="prose prose-lg max-w-none dark:prose-invert">
                                <div 
                                  className="text-foreground leading-7"
                                  dangerouslySetInnerHTML={{ __html: lesson.content }}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Fallback for lessons with unrecognized content types */}
                      {lesson && lesson.contentType && !["video", "pdf", "article", "quiz", "file", "text"].includes(lesson.contentType) && (
                        <div className="mb-8">
                          <Card>
                            <CardContent className="p-8 text-center">
                              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                              <h3 className="text-xl font-semibold mb-2">Unsupported Content Type</h3>
                              <p className="text-muted-foreground mb-4">
                                This lesson contains content of type "{lesson.contentType}" which is not yet supported by the viewer.
                              </p>
                              {lesson.url && (
                                <div className="flex gap-2 justify-center">
                                  <Button variant="outline" asChild>
                                    <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                                      <Eye className="w-4 h-4 mr-2" />
                                      Open in New Tab
                                    </a>
                                  </Button>
                                  <Button variant="outline" asChild>
                                    <a href={lesson.url} download>
                                      <Download className="w-4 h-4 mr-2" />
                                      Download
                                    </a>
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Fallback for lessons with content type but no URL */}
                      {lesson && lesson.contentType && ["video", "pdf", "article", "file"].includes(lesson.contentType) && !lesson.url && (
                        <div className="mb-8">
                          <Card>
                            <CardContent className="p-8 text-center">
                              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                              <h3 className="text-xl font-semibold mb-2">Content Not Available</h3>
                              <p className="text-muted-foreground mb-4">
                                This lesson is configured for {lesson.contentType} content, but the file is not available. Please contact your instructor.
                              </p>
                              <Badge variant="secondary" className="text-sm">
                                Content Type: {lesson.contentType}
                              </Badge>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Lesson Description */}
                      {lesson.description && (
                        <div className="mb-8">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">About This Lesson</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div 
                                className="text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                                dangerouslySetInnerHTML={{ __html: lesson.description }}
                              />
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Notes Tab */}
                  <TabsContent value="notes" className="flex-1 overflow-auto m-0">
                    <div className="max-w-4xl mx-auto p-6">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Your Notes</h3>
                          <Button onClick={() => setShowNoteDialog(true)} className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add Note
                          </Button>
                        </div>

                        {notes.length === 0 ? (
                          <div className="text-center py-12">
                            <StickyNote className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <h4 className="text-lg font-medium mb-2">No notes yet</h4>
                            <p className="text-muted-foreground mb-4">
                              Take notes while watching to remember key points and insights.
                            </p>
                            <Button onClick={() => setShowNoteDialog(true)}>
                              Create Your First Note
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {notes.map((note) => (
                              <Card key={note.id}>
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Clock className="w-4 h-4" />
                                      <span>At {formatTime(note.timestamp)}</span>
                                      <span>•</span>
                                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => jumpToBookmark(note.timestamp)}
                                        className="text-xs"
                                      >
                                        Jump to time
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteNote(note.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-sm leading-relaxed">{note.content}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}

                        {/* Bookmarks Section */}
                        {bookmarks.length > 0 && (
                          <div className="mt-8">
                            <h4 className="text-md font-medium mb-4 flex items-center gap-2">
                              <Bookmark className="w-4 h-4" />
                              Bookmarks ({bookmarks.length})
                            </h4>
                            <div className="space-y-2">
                              {bookmarks.map((bookmark) => (
                                <div
                                  key={bookmark.id}
                                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Bookmark className="w-4 h-4 text-primary" />
                                    <div>
                                      <p className="text-sm font-medium">{bookmark.lessonTitle}</p>
                                      <p className="text-xs text-muted-foreground">
                                        At {formatTime(bookmark.timestamp)} • {new Date(bookmark.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => jumpToBookmark(bookmark.timestamp)}
                                    >
                                      Jump to
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteBookmark(bookmark.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Discussion Tab */}
                  <TabsContent value="discussion" className="flex-1 overflow-auto m-0">
                    <div className="max-w-4xl mx-auto p-6">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Discussion</h3>
                          <Button 
                            className="flex items-center gap-2"
                            onClick={() => setShowDiscussionDialog(true)}
                          >
                            <Plus className="w-4 h-4" />
                            Ask Question
                          </Button>
                        </div>

                        <div className="text-center py-12">
                          <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <h4 className="text-lg font-medium mb-2">Start a Discussion</h4>
                          <p className="text-muted-foreground mb-4">
                            Ask questions, share insights, and connect with other learners.
                          </p>
                          <Button onClick={() => setShowDiscussionDialog(true)}>
                            Post Your First Question
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Resources Tab */}
                  <TabsContent value="resources" className="flex-1 overflow-auto m-0">
                    <div className="max-w-4xl mx-auto p-6">
                      <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Course Resources</h3>
                        
                        <div className="grid gap-4">
                          {/* Current Lesson Resources */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-md">This Lesson</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {lesson.url && (
                                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <FileIcon className="w-5 h-5 text-primary" />
                                    <div>
                                      <p className="font-medium">{lesson.title}</p>
                                      <p className="text-sm text-muted-foreground">{lesson.contentType}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => setActiveTab("content")}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                      <a href={lesson.url + '/download'} download={lesson.fileName || lesson.title}>
                                        <DownloadIcon className="w-4 h-4 mr-2" />
                                        Download
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Module Resources */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-md">Module Resources</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {modules[activeModule]?.lessons?.map((lessonItem: any, idx: number) => (
                                  <div
                                    key={lessonItem.id}
                                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                      idx === activeLesson ? 'bg-primary/10' : 'bg-muted/30'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex-shrink-0">
                                        {lessonItem.completed ? (
                                          <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                          <Circle className="w-4 h-4 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">{lessonItem.title}</p>
                                        <p className="text-xs text-muted-foreground">{lessonItem.contentType}</p>
                                      </div>
                                    </div>
                                    {lessonItem.url && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          // Navigate to this lesson and show content
                                          setActiveLesson(idx);
                                          setActiveTab("content");
                                        }}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Course Certificate */}
                          {courseProgress === 100 && (
                            <Card className="border-primary/20 bg-primary/5">
                              <CardContent className="p-6 text-center">
                                <Award className="w-16 h-16 text-primary mx-auto mb-4" />
                                <h4 className="text-lg font-semibold mb-2">Congratulations!</h4>
                                <p className="text-muted-foreground mb-4">
                                  You've completed the course. Download your certificate of completion.
                                </p>
                                <Button className="flex items-center gap-2">
                                  <DownloadIcon className="w-4 h-4" />
                                  Download Certificate
                                </Button>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Enhanced Lesson Footer */}
              <div className="border-t bg-card p-4">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {!lesson.completed && (
                        <Button
                          onClick={() => markCompleteMutation.mutate(lesson.id)}
                          disabled={markCompleteMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {markCompleteMutation.isPending ? "Marking Complete..." : "Mark as Complete"}
                        </Button>
                      )}
                      
                      {lesson.completed && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">Completed</span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(timeSpent)} spent
                        </span>
                        <span className="flex items-center gap-1">
                          <StickyNote className="w-4 h-4" />
                          {notes.length} notes
                        </span>
                        <span className="flex items-center gap-1">
                          <Bookmark className="w-4 h-4" />
                          {bookmarks.length} bookmarks
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (previousLesson) {
                            setActiveModule(previousLesson.moduleIndex);
                            setActiveLesson(previousLesson.lessonIndex);
                          }
                        }}
                        disabled={!previousLesson}
                        className="flex items-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      
                      <Button
                        onClick={() => {
                          if (nextLesson) {
                            setActiveModule(nextLesson.moduleIndex);
                            setActiveLesson(nextLesson.lessonIndex);
                          }
                        }}
                        disabled={!nextLesson}
                        className="flex items-center gap-2"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Lesson {activeLesson + 1} of {lessons.length}</span>
                    <Progress value={((activeLesson + 1) / lessons.length) * 100} className="flex-1 max-w-32" />
                    <span>{Math.round(((activeLesson + 1) / lessons.length) * 100)}% of module</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Discussion Creation Dialog */}
      <Dialog open={showDiscussionDialog} onOpenChange={setShowDiscussionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start New Discussion</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a discussion topic for this course
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateDiscussion} className="space-y-4">
            <div>
              <Label htmlFor="discussion-title">Discussion Title</Label>
              <Input
                id="discussion-title"
                value={newDiscussion.title}
                onChange={(e) => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter discussion title"
                required
              />
            </div>
            <div>
              <Label htmlFor="discussion-description">Description</Label>
              <Textarea
                id="discussion-description"
                value={newDiscussion.description}
                onChange={(e) => setNewDiscussion(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the discussion topic"
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowDiscussionDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createDiscussionMutation.isPending}
              >
                {createDiscussionMutation.isPending ? "Creating..." : "Create Discussion"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
