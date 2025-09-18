import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileIcon, 
  Video, 
  FileText, 
  Clock, 
  Monitor, 
  HardDrive,
  Hash,
  Calendar,
  BookOpen,
  Type
} from "lucide-react";

interface ContentMetadataProps {
  lesson: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: string | number; // Allow both string and number
    durationSeconds?: number;
    videoWidth?: number;
    videoHeight?: number;
    videoBitrate?: number;
    videoCodec?: string;
    audioCodec?: string;
    pdfPages?: number;
    pdfVersion?: string;
    wordCount?: number;
    readingTime?: number;
    uploadedAt?: number;
    fileHash?: string;
    thumbnailUrl?: string;
    contentType: string;
  };
}

export function ContentMetadata({ lesson }: ContentMetadataProps) {
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (duration?: string | number): string => {
    if (!duration) return 'Unknown';
    
    // If it's already a string (like "10:30"), return it
    if (typeof duration === 'string') {
      return duration;
    }
    
    // If it's a number (seconds), format it
    const seconds = duration;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString();
  };

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'pdf': return <FileIcon className="w-4 h-4" />;
      case 'article':
      case 'text': return <FileText className="w-4 h-4" />;
      default: return <FileIcon className="w-4 h-4" />;
    }
  };

  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'video': return 'bg-blue-100 text-blue-800';
      case 'pdf': return 'bg-red-100 text-red-800';
      case 'article':
      case 'text': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {getContentTypeIcon(lesson.contentType)}
          Content Metadata
        </CardTitle>
        <CardDescription>
          Technical details about this lesson's content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={getContentTypeColor(lesson.contentType)}>
                {lesson.contentType.toUpperCase()}
              </Badge>
              {lesson.mimeType && (
                <Badge variant="outline" className="text-xs">
                  {lesson.mimeType}
                </Badge>
              )}
            </div>
            
            {lesson.fileName && (
              <div className="flex items-center gap-2 text-sm">
                <FileIcon className="w-3 h-3 text-muted-foreground" />
                <span className="truncate">{lesson.fileName}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            {lesson.fileSize && (
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="w-3 h-3 text-muted-foreground" />
                <span>{formatFileSize(lesson.fileSize)}</span>
              </div>
            )}
            
            {(lesson.durationSeconds || lesson.duration) && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span>{formatDuration(lesson.durationSeconds || lesson.duration)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Video-specific metadata */}
        {lesson.contentType === 'video' && (lesson.videoWidth || lesson.videoCodec) && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Video className="w-3 h-3" />
              Video Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {lesson.videoWidth && lesson.videoHeight && (
                <div className="flex items-center gap-2">
                  <Monitor className="w-3 h-3 text-muted-foreground" />
                  <span>{lesson.videoWidth} × {lesson.videoHeight}</span>
                </div>
              )}
              
              {lesson.videoBitrate && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Bitrate:</span>
                  <span>{lesson.videoBitrate} kbps</span>
                </div>
              )}
              
              {lesson.videoCodec && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Video:</span>
                  <Badge variant="outline" className="text-xs">{lesson.videoCodec}</Badge>
                </div>
              )}
              
              {lesson.audioCodec && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Audio:</span>
                  <Badge variant="outline" className="text-xs">{lesson.audioCodec}</Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDF-specific metadata */}
        {lesson.contentType === 'pdf' && (lesson.pdfPages || lesson.pdfVersion) && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <FileIcon className="w-3 h-3" />
              PDF Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {lesson.pdfPages && (
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3 h-3 text-muted-foreground" />
                  <span>{lesson.pdfPages} pages</span>
                </div>
              )}
              
              {lesson.pdfVersion && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Version:</span>
                  <Badge variant="outline" className="text-xs">{lesson.pdfVersion}</Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text content metadata */}
        {(lesson.contentType === 'article' || lesson.contentType === 'text') && (lesson.wordCount || lesson.readingTime) && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Type className="w-3 h-3" />
              Text Analysis
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {lesson.wordCount && (
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <span>{lesson.wordCount.toLocaleString()} words</span>
                </div>
              )}
              
              {lesson.readingTime && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span>{formatDuration(lesson.readingTime)} read time</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* General metadata */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-2">General Info</h4>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            {lesson.uploadedAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Uploaded {formatDate(lesson.uploadedAt)}</span>
              </div>
            )}
            
            {lesson.fileHash && (
              <div className="flex items-center gap-2">
                <Hash className="w-3 h-3" />
                <span className="font-mono text-xs">{lesson.fileHash.substring(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}