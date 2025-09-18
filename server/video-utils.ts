import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

/**
 * Extract video duration in seconds from a video file
 * @param filePath - Path to the video file
 * @returns Promise<number> - Duration in seconds
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error getting video metadata:', err);
        reject(err);
        return;
      }

      try {
        const duration = metadata.format?.duration;
        if (typeof duration === 'number' && duration > 0) {
          // Round to nearest second
          resolve(Math.round(duration));
        } else {
          console.warn('Could not extract duration from video metadata');
          resolve(0); // Return 0 if duration cannot be determined
        }
      } catch (error) {
        console.error('Error parsing video metadata:', error);
        resolve(0); // Return 0 if there's an error parsing
      }
    });
  });
}

/**
 * Check if a file is a video based on its MIME type
 * @param mimeType - MIME type of the file
 * @returns boolean - True if it's a video file
 */
export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * Format duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns string - Formatted duration (e.g., "5:30", "1:23:45")
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Convert duration string to seconds
 * Supports formats like: "5:30", "1:23:45", "90" (seconds), "5 min", "2 hours"
 * @param durationStr - Duration string
 * @returns number - Duration in seconds, or 0 if cannot parse
 */
export function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  
  const str = durationStr.trim().toLowerCase();
  
  // If it's just a number, treat as seconds
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }
  
  // Handle time format like "5:30" or "1:23:45"
  const timeMatch = str.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (timeMatch) {
    const hours = timeMatch[3] ? parseInt(timeMatch[1], 10) : 0;
    const minutes = timeMatch[3] ? parseInt(timeMatch[2], 10) : parseInt(timeMatch[1], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : parseInt(timeMatch[2], 10);
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // Handle text formats like "5 min", "2 hours", "90 seconds"
  const textMatch = str.match(/^(\d+(?:\.\d+)?)\s*(min|minute|minutes|sec|second|seconds|hour|hours|hr|hrs)s?$/);
  if (textMatch) {
    const value = parseFloat(textMatch[1]);
    const unit = textMatch[2];
    
    switch (unit) {
      case 'sec':
      case 'second':
      case 'seconds':
        return Math.round(value);
      case 'min':
      case 'minute':
      case 'minutes':
        return Math.round(value * 60);
      case 'hour':
      case 'hours':
      case 'hr':
      case 'hrs':
        return Math.round(value * 3600);
      default:
        return 0;
    }
  }
  
  return 0;
}

/**
 * Calculate estimated reading time for text content
 * @param text - Text content (can include HTML)
 * @returns number - Estimated reading time in seconds
 */
export function calculateReadingTime(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  // Remove HTML tags and get plain text
  const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (!plainText) return 0;
  
  // Count words (split by whitespace and filter out empty strings)
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
  
  // Average reading speed: 200-250 words per minute
  // Using 225 words per minute as average
  const wordsPerMinute = 225;
  const readingTimeMinutes = wordCount / wordsPerMinute;
  
  // Convert to seconds and ensure minimum of 30 seconds for any content
  return Math.max(30, Math.round(readingTimeMinutes * 60));
}

/**
 * Automatically calculate duration based on lesson content type and content
 * @param contentType - Type of content (video, pdf, article, quiz, text)
 * @param content - The actual content (text for articles, etc.)
 * @param url - URL if it's a video/pdf file
 * @param filePath - Path to uploaded file (for video duration extraction)
 * @returns Promise<number> - Estimated duration in seconds
 */
export async function calculateAutomaticDuration(
  contentType: string,
  content?: string,
  url?: string,
  filePath?: string
): Promise<number> {
  switch (contentType) {
    case 'video':
      // If we have a file path, extract actual duration
      if (filePath) {
        try {
          const actualDuration = await getVideoDuration(filePath);
          if (actualDuration > 0) return actualDuration;
        } catch (error) {
          console.warn('Could not extract video duration:', error);
        }
      }
      // Default video duration if extraction fails
      return 600; // 10 minutes default
      
    case 'article':
    case 'text':
      // Calculate based on text content
      if (content) {
        return calculateReadingTime(content);
      }
      return 300; // 5 minutes default for empty articles
      
    case 'pdf':
      // Estimate based on typical PDF reading time
      // Could be enhanced to count pages if PDF parsing is available
      return 900; // 15 minutes default
      
    case 'quiz':
      // Estimate based on content length or default
      if (content) {
        // Assume quiz takes longer than reading due to thinking time
        const readingTime = calculateReadingTime(content);
        return Math.max(300, readingTime * 2); // At least 5 minutes, or 2x reading time
      }
      return 600; // 10 minutes default for quizzes
      
    default:
      return 300; // 5 minutes default for unknown types
  }
}

/**
 * Check if content type should have automatic duration calculation
 * @param contentType - Type of content
 * @returns boolean - True if duration should be auto-calculated
 */
export function shouldAutoCalculateDuration(contentType: string): boolean {
  return ['video', 'article', 'text', 'pdf', 'quiz'].includes(contentType);
}

/**
 * Interface for comprehensive content metadata
 */
export interface ContentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  uploadedAt: number;
  
  // Video-specific
  videoWidth?: number;
  videoHeight?: number;
  videoBitrate?: number;
  videoCodec?: string;
  audioCodec?: string;
  
  // PDF-specific
  pdfPages?: number;
  pdfVersion?: string;
  
  // Text content
  wordCount?: number;
  readingTime?: number;
  
  // General
  thumbnailUrl?: string;
  duration?: number;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

/**
 * Calculate file hash for integrity checking and deduplication
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Extract comprehensive video metadata
 */
export async function extractVideoMetadata(filePath: string, fileName: string, mimeType: string): Promise<ContentMetadata> {
  const stats = fs.statSync(filePath);
  const fileHash = await calculateFileHash(filePath);
  
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error extracting video metadata:', err);
        // Return basic metadata even if ffprobe fails
        resolve({
          fileName,
          fileSize: stats.size,
          mimeType,
          fileHash,
          uploadedAt: Date.now(),
          duration: 0
        });
        return;
      }

      try {
        const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
        const duration = metadata.format?.duration ? Math.round(metadata.format.duration) : 0;

        const result: ContentMetadata = {
          fileName,
          fileSize: stats.size,
          mimeType,
          fileHash,
          uploadedAt: Date.now(),
          duration,
          videoWidth: videoStream?.width,
          videoHeight: videoStream?.height,
          videoBitrate: videoStream?.bit_rate ? Math.round(videoStream.bit_rate / 1000) : undefined,
          videoCodec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          metadata: {
            format: metadata.format?.format_name,
            bitRate: metadata.format?.bit_rate,
            tags: metadata.format?.tags
          }
        };

        resolve(result);
      } catch (error) {
        console.error('Error parsing video metadata:', error);
        resolve({
          fileName,
          fileSize: stats.size,
          mimeType,
          fileHash,
          uploadedAt: Date.now(),
          duration: 0
        });
      }
    });
  });
}

/**
 * Extract PDF metadata (basic implementation)
 */
export async function extractPdfMetadata(filePath: string, fileName: string, mimeType: string): Promise<ContentMetadata> {
  const stats = fs.statSync(filePath);
  const fileHash = await calculateFileHash(filePath);
  
  // Basic PDF metadata - could be enhanced with a PDF parsing library
  const result: ContentMetadata = {
    fileName,
    fileSize: stats.size,
    mimeType,
    fileHash,
    uploadedAt: Date.now(),
    duration: 900, // Default 15 minutes for PDFs
    metadata: {
      estimatedReadingTime: 900
    }
  };

  // TODO: Add actual PDF parsing to extract:
  // - Number of pages
  // - PDF version
  // - Text content for better duration estimation
  
  return result;
}

/**
 * Extract text content metadata
 */
export function extractTextMetadata(content: string, fileName?: string): ContentMetadata {
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
  const readingTime = Math.max(30, Math.round((wordCount / 225) * 60)); // 225 WPM

  return {
    fileName: fileName || 'text-content',
    fileSize: Buffer.byteLength(content, 'utf8'),
    mimeType: 'text/html',
    fileHash: crypto.createHash('sha256').update(content).digest('hex'),
    uploadedAt: Date.now(),
    wordCount,
    readingTime,
    duration: readingTime,
    metadata: {
      characterCount: content.length,
      plainTextLength: plainText.length
    }
  };
}

/**
 * Extract comprehensive metadata based on content type
 */
export async function extractContentMetadata(
  filePath: string,
  fileName: string,
  mimeType: string,
  contentType?: string,
  textContent?: string
): Promise<ContentMetadata> {
  try {
    if (isVideoFile(mimeType)) {
      return await extractVideoMetadata(filePath, fileName, mimeType);
    } else if (mimeType.includes('pdf')) {
      return await extractPdfMetadata(filePath, fileName, mimeType);
    } else if (textContent && (contentType === 'article' || contentType === 'text')) {
      return extractTextMetadata(textContent, fileName);
    } else {
      // Generic file metadata
      const stats = fs.statSync(filePath);
      const fileHash = await calculateFileHash(filePath);
      
      return {
        fileName,
        fileSize: stats.size,
        mimeType,
        fileHash,
        uploadedAt: Date.now(),
        duration: await calculateAutomaticDuration(contentType || 'article', textContent)
      };
    }
  } catch (error) {
    console.error('Error extracting content metadata:', error);
    
    // Fallback to basic metadata
    const stats = filePath ? fs.statSync(filePath) : null;
    return {
      fileName,
      fileSize: stats?.size || 0,
      mimeType,
      fileHash: crypto.createHash('sha256').update(fileName + Date.now()).digest('hex'),
      uploadedAt: Date.now(),
      duration: 300 // 5 minutes default
    };
  }
}