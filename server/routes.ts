import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { createInsertModuleSchema, createInsertLessonSchema } from "@shared/schema";
import { getVideoDuration, isVideoFile, formatDuration, parseDurationToSeconds, calculateAutomaticDuration, shouldAutoCalculateDuration, extractContentMetadata, extractTextMetadata, type ContentMetadata } from "./video-utils";

import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertCourseSchema, insertAssessmentSchema, insertQuestionSchema, insertDiscussionSchema, enhancedInsertCourseSchema, insertCertificateSchema, insertAssignmentSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { sessionManager } from "./sessionManager";
import { authenticateToken, requireRole, extractClientInfo, optionalAuth } from "./authMiddleware";

export async function registerRoutes(app: express.Express): Promise<Server> {
  // Multer setup for uploads
  const uploadDir = path.join(process.cwd(), "uploads/materials");
  const thumbnailDir = path.join(process.cwd(), "uploads/thumbnails");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(thumbnailDir)) fs.mkdirSync(thumbnailDir, { recursive: true });
  const upload = multer({ dest: uploadDir, limits: { fileSize: 1024 * 1024 * 500 } }); // 500MB max
  const thumbnailUpload = multer({ dest: thumbnailDir, limits: { fileSize: 1024 * 1024 * 5 } }); // 5MB max

  // Custom file serving route for inline viewing with range request support
  app.get("/uploads/materials/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename;
    
    // Security check: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: "Invalid filename" });
    }
    
    const filePath = path.join(uploadDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Get file stats for range requests
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // Get file extension to determine content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    // Set appropriate content type for inline viewing
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.webm':
        contentType = 'video/webm';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.html':
      case '.htm':
        contentType = 'text/html';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.json':
        contentType = 'application/json';
        break;
    }
    
    // Handle range requests for video files (crucial for seeking)
    const range = req.headers.range;
    if (range && (ext === '.mp4' || ext === '.webm' || ext === '.avi' || ext === '.mov')) {
      console.log('Range request for video:', filename, 'Range:', range);
      
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      // Ensure valid range
      const validStart = Math.max(0, Math.min(start, fileSize - 1));
      const validEnd = Math.max(validStart, Math.min(end, fileSize - 1));
      const chunksize = (validEnd - validStart) + 1;
      
      console.log('Video range:', { start: validStart, end: validEnd, chunksize, fileSize });
      
      const fileStream = fs.createReadStream(filePath, { start: validStart, end: validEnd });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${validStart}-${validEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Content-Disposition': 'inline; filename="' + filename + '"',
        'Cache-Control': 'public, max-age=31536000',
        'Connection': 'keep-alive'
      });
      
      fileStream.on('error', (err) => {
        console.error('Video stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error reading video file" });
        }
      });
      
      fileStream.pipe(res);
    } else {
      // Regular file serving for non-video files or non-range requests
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Content-Length', fileSize);
      
      // For video files, always support range requests
      if (ext === '.mp4' || ext === '.webm' || ext === '.avi' || ext === '.mov') {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => {
        console.error('File stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error reading file" });
        }
      });
      fileStream.pipe(res);
    }
  });
  
  // Download route for explicit downloads
  app.get("/uploads/materials/:filename/download", (req: Request, res: Response) => {
    const filename = req.params.filename;
    
    // Security check: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: "Invalid filename" });
    }
    
    const filePath = path.join(uploadDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Set headers for download
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    
    // Stream the file with error handling
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error reading file" });
      }
    });
    fileStream.pipe(res);
  });
  
  // Serve thumbnails statically (these can remain as downloads)
  app.use("/uploads/thumbnails", express.static(thumbnailDir));
  
  // Extract client info for all requests
  app.use(extractClientInfo);
  
  // Protected routes - require authentication (ensure this is registered BEFORE any /api/protected routes)
  app.use("/api/protected", authenticateToken);
  
  // Enhanced course creation endpoint
  app.post("/api/protected/courses/enhanced", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create courses" });
      }
      
      // Filter out undefined values from request body to prevent overriding defaults
      const requestBody = Object.fromEntries(
        Object.entries(req.body).filter(([_, value]) => value !== undefined)
      );
      
      // Ensure proper types for validation
      const processedBody = { ...requestBody };
      
      // Convert estimatedHours to number if it's a string
      if (processedBody.estimatedHours && typeof processedBody.estimatedHours === 'string') {
        const hours = parseInt(processedBody.estimatedHours);
        processedBody.estimatedHours = !isNaN(hours) ? hours : undefined;
      }
      
      // Convert price to number if it's a string
      if (processedBody.price && typeof processedBody.price === 'string') {
        const priceNum = parseFloat(processedBody.price);
        processedBody.price = !isNaN(priceNum) ? priceNum : undefined;
      }
      
      // Ensure duration is a string (it should be, but just to be safe)
      if (processedBody.duration && typeof processedBody.duration !== 'string') {
        processedBody.duration = String(processedBody.duration);
      }
      
      console.log("Enhanced course creation - processed body:", processedBody);
      
      const courseData = enhancedInsertCourseSchema.parse({
        ...processedBody,
        // Set defaults after request body to ensure they're not overridden
        status: processedBody.status || "draft",
        price: processedBody.price ?? 0,
        estimatedHours: processedBody.estimatedHours ?? 1,
        teacherId: req.user.userId,
        // Let the schema generate the ID using its default function
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const course = await storage.createEnhancedCourse(courseData);
      res.json(course);
    } catch (error: any) {
      console.error("Enhanced course creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });
  
  // Certificate management endpoints
  app.post("/api/protected/certificates", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create certificates" });
      }
      
      const certificateData = insertCertificateSchema.parse({
        ...req.body,
        // Let the schema generate the ID using its default function
        createdAt: new Date(),
      });
      
      const certificate = await storage.createCertificate(certificateData);
      res.json(certificate);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // Assignment management endpoints
  app.post("/api/protected/assignments", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create assignments" });
      }
      
      // Process the request body to handle date conversion
      const processedBody = { ...req.body };
      
      // Convert dueDate from ISO string to Date object if provided
      if (processedBody.dueDate && typeof processedBody.dueDate === 'string') {
        processedBody.dueDate = new Date(processedBody.dueDate);
      }
      
      const assignmentData = insertAssignmentSchema.parse({
        ...processedBody,
        // Let the schema generate the ID using its default function
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const assignment = await storage.createAssignment(assignmentData);
      res.json(assignment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // Upload course thumbnail
  app.post("/api/protected/courses/:courseId/thumbnail", thumbnailUpload.single("thumbnail"), async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can upload thumbnails" });
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Get the course
      const course = await storage.getCourse(req.params.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Verify the teacher owns this course
      if (course.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "You can only upload thumbnails for your own courses" });
      }
      
      // Save thumbnail URL to course
      const thumbnailUrl = `/uploads/thumbnails/${file.filename}`;
      const updatedCourse = await storage.updateCourse(req.params.courseId, { 
        coverImage: thumbnailUrl 
      });
      
      res.json({ url: thumbnailUrl, course: updatedCourse });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark lesson as completed for a student
  app.post("/api/protected/courses/:courseId/lessons/:lessonId/complete", async (req: Request, res: Response) => {
    try {
      const { courseId, lessonId } = req.params;
      const userId = req.user.userId;
      // Only students can mark complete
      if (req.user.role !== "student") return res.status(403).json({ message: "Only students can mark lessons complete" });
      // Save progress if not already marked
      const already = await storage.getLessonProgress(userId, courseId, lessonId);
      let lessonProgress;
      if (!already) {
        lessonProgress = await storage.markLessonComplete(userId, courseId, lessonId);
      } else {
        lessonProgress = already;
      }
      // Optionally, update course progress percentage
      const totalLessons = await storage.countLessonsInCourse(courseId);
      const completedLessons = await storage.countCompletedLessons(userId, courseId);
      const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
      await storage.updateCourseProgress(userId, courseId, progress);
      res.json(lessonProgress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Module & Lesson CRUD ---
  app.post("/api/protected/courses/:courseId/modules", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can add modules" });
      }
      const moduleData = createInsertModuleSchema.parse({
        ...req.body,
        courseId: req.params.courseId,
        // Let the schema generate the ID using its default function
      });
      const module = await storage.createModule(moduleData);
      res.json(module);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get course modules with lessons
  app.get("/api/protected/courses/:courseId/modules", async (req: Request, res: Response) => {
    try {
      const { courseId } = req.params;
      
      // Check if user has access to this course
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // For teachers, check if they own the course
      if (req.user.role === 'teacher' && course.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // For students, check if they're enrolled
      if (req.user.role === 'student') {
        const enrollment = await storage.getEnrollment(courseId, req.user.userId);
        if (!enrollment) {
          return res.status(403).json({ message: "Not enrolled in this course" });
        }
      }
      
      const modules = await storage.getCourseModulesWithLessons(courseId, req.user?.userId);
      res.json(modules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/modules/:moduleId/lessons", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can add lessons" });
      }
      
      // Convert duration from string to number if provided
      const requestData = { ...req.body };
      
      // Handle duration field
      let finalDuration: number | null = null;
      
      if (requestData.duration !== undefined && typeof requestData.duration === 'string') {
        if (requestData.duration.trim() === '') {
          // Empty string - will auto-calculate below
          finalDuration = null;
        } else {
          const durationInSeconds = parseDurationToSeconds(requestData.duration);
          finalDuration = durationInSeconds > 0 ? durationInSeconds : null;
        }
      }
      
      // Extract content metadata for text content
      let contentMetadata: Partial<ContentMetadata> = {};
      if (requestData.content && (requestData.contentType === 'article' || requestData.contentType === 'text')) {
        console.log("Extracting text content metadata...");
        const textMeta = extractTextMetadata(requestData.content);
        contentMetadata = {
          wordCount: textMeta.wordCount,
          readingTime: textMeta.readingTime,
          fileSize: textMeta.fileSize,
          fileHash: textMeta.fileHash,
          mimeType: textMeta.mimeType,
          uploadedAt: textMeta.uploadedAt
        };
        
        // Use calculated reading time as duration if not provided
        if (finalDuration === null) {
          finalDuration = textMeta.duration;
          console.log("Using calculated reading time as duration:", finalDuration, "seconds");
        }
      }
      
      // Auto-calculate duration if not provided or empty
      if (finalDuration === null && shouldAutoCalculateDuration(requestData.contentType)) {
        console.log("Auto-calculating duration for content type:", requestData.contentType);
        finalDuration = await calculateAutomaticDuration(
          requestData.contentType,
          requestData.content,
          requestData.url
        );
        console.log("Auto-calculated duration:", finalDuration, "seconds");
      }
      
      // Merge all data
      Object.assign(requestData, {
        duration: finalDuration ? String(finalDuration) : null,
        ...contentMetadata
      });
      
      console.log("Creating lesson with data:", requestData);
      
      const lessonData = createInsertLessonSchema.parse({
        ...requestData,
        moduleId: req.params.moduleId,
        // Let the schema generate the ID using its default function
      });
      
      console.log("Parsed lesson data:", lessonData);
      const lesson = await storage.createLesson(lessonData);
      res.json(lesson);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update module
  app.put("/api/protected/modules/:moduleId", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can update modules" });
      }
      const moduleData = {
        ...req.body,
        id: req.params.moduleId,
      };
      const module = await storage.updateModule(req.params.moduleId, moduleData);
      res.json(module);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update lesson
  app.put("/api/protected/lessons/:lessonId", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can update lessons" });
      }
      
      // Convert duration from string to number if provided
      const requestData = { ...req.body };
      
      // Handle duration field
      let finalDuration: number | null = null;
      
      if (requestData.duration !== undefined && typeof requestData.duration === 'string') {
        if (requestData.duration.trim() === '') {
          // Empty string - will auto-calculate below
          finalDuration = null;
        } else {
          const durationInSeconds = parseDurationToSeconds(requestData.duration);
          finalDuration = durationInSeconds > 0 ? durationInSeconds : null;
        }
      }
      
      // Extract content metadata for text content
      let contentMetadata: Partial<ContentMetadata> = {};
      if (requestData.content && (requestData.contentType === 'article' || requestData.contentType === 'text')) {
        console.log("Extracting text content metadata for update...");
        const textMeta = extractTextMetadata(requestData.content);
        contentMetadata = {
          wordCount: textMeta.wordCount,
          readingTime: textMeta.readingTime,
          fileSize: textMeta.fileSize,
          fileHash: textMeta.fileHash,
          mimeType: textMeta.mimeType,
          uploadedAt: textMeta.uploadedAt
        };
        
        // Use calculated reading time as duration if not provided
        if (finalDuration === null) {
          finalDuration = textMeta.duration;
          console.log("Using calculated reading time as duration:", finalDuration, "seconds");
        }
      }
      
      // Auto-calculate duration if not provided or empty
      if (finalDuration === null && shouldAutoCalculateDuration(requestData.contentType)) {
        console.log("Auto-calculating duration for content type:", requestData.contentType);
        finalDuration = await calculateAutomaticDuration(
          requestData.contentType,
          requestData.content,
          requestData.url
        );
        console.log("Auto-calculated duration:", finalDuration, "seconds");
      }
      
      // Merge all data
      Object.assign(requestData, {
        duration: finalDuration ? String(finalDuration) : null,
        ...contentMetadata
      });
      
      console.log("Updating lesson with data:", requestData);
      
      const lessonData = {
        ...requestData,
        id: req.params.lessonId,
      };
      
      console.log("Final lesson update data:", lessonData);
      const lesson = await storage.updateLesson(req.params.lessonId, lessonData);
      res.json(lesson);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Upload content for a lesson (video, PDF, etc.)
  app.post("/api/protected/lessons/:lessonId/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      console.log("[UPLOAD] Endpoint hit for lesson:", req.params.lessonId, "by user:", req.user?.userId);
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        console.log("[UPLOAD] Forbidden: role is", req.user.role);
        return res.status(403).json({ message: "Only teachers can upload content" });
      }
      const file = req.file;
      if (!file) {
        console.log("[UPLOAD] No file uploaded");
        return res.status(400).json({ message: "No file uploaded" });
      }
      console.log("[UPLOAD] File received:", file.originalname, file.mimetype, file.size, "->", file.path);
      
      // Save file info to lesson and extract comprehensive metadata
      const url = `/uploads/materials/${file.filename}`;
      
      console.log("[UPLOAD] Extracting comprehensive metadata...");
      const metadata = await extractContentMetadata(
        file.path,
        file.originalname,
        file.mimetype
      );
      
      console.log("[UPLOAD] Extracted metadata:", {
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        mimeType: metadata.mimeType,
        duration: metadata.duration,
        videoWidth: metadata.videoWidth,
        videoHeight: metadata.videoHeight,
        videoBitrate: metadata.videoBitrate,
        videoCodec: metadata.videoCodec,
        audioCodec: metadata.audioCodec,
        pdfPages: metadata.pdfPages,
        fileHash: metadata.fileHash?.substring(0, 16) + "..." // Log partial hash
      });
      
      const lesson = await storage.updateLessonUrl(
        req.params.lessonId, 
        url, 
        file.mimetype, 
        file.originalname, 
        metadata.duration,
        metadata
      );
      
      res.json({ 
        url, 
        lesson,
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        mimeType: metadata.mimeType,
        uploadedAt: Date.now(),
        metadata: {
          fileName: metadata.fileName,
          fileSize: metadata.fileSize,
          mimeType: metadata.mimeType,
          duration: metadata.duration ? {
            seconds: metadata.duration,
            formatted: formatDuration(metadata.duration)
          } : null,
          videoInfo: metadata.videoWidth ? {
            width: metadata.videoWidth,
            height: metadata.videoHeight,
            bitrate: metadata.videoBitrate,
            videoCodec: metadata.videoCodec,
            audioCodec: metadata.audioCodec
          } : null,
          pdfInfo: metadata.pdfPages ? {
            pages: metadata.pdfPages,
            version: metadata.pdfVersion
          } : null,
          textInfo: metadata.wordCount ? {
            wordCount: metadata.wordCount,
            readingTime: {
              seconds: metadata.readingTime,
              formatted: formatDuration(metadata.readingTime || 0)
            }
          } : null,
          fileHash: metadata.fileHash?.substring(0, 16) + "...", // Partial hash for security
          uploadedAt: new Date(metadata.uploadedAt).toISOString()
        }
      });
    } catch (error: any) {
      console.error("[UPLOAD] Error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Course preview endpoint
  app.get("/api/protected/courses/:id/preview", async (req: Request, res: Response) => {
    try {
      const course = await storage.getCourse(req.params.id);
      const modules = await storage.getModules(req.params.id);
      for (const mod of modules) {
        const lessons = await storage.getLessons(mod.id);
        // Map contentUrl to url for frontend compatibility
        (mod as any).lessons = lessons.map(lesson => ({
          ...lesson,
          url: lesson.contentUrl
        }));
      }
      res.json({ ...course, modules });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recent grades for student
  app.get("/api/protected/user/recent-grades", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== "student") {
        return res.status(403).json({ message: "Only students can view recent grades" });
      }
      // Get last 5 submissions with scores for this student
      const grades = await storage.getRecentGradesForStudent(req.user.userId, 5);
      res.json(grades);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // All grades for student
  app.get("/api/protected/user/grades", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== "student") {
        return res.status(403).json({ message: "Only students can view grades" });
      }
      // Get all submissions with scores for this student
      const grades = await storage.getAllGradesForStudent(req.user.userId);
      res.json(grades);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recent activity for teacher
  app.get("/api/protected/user/recent-activity", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== "teacher") {
        return res.status(403).json({ message: "Only teachers can view recent activity" });
      }
      // Get last 5 submissions to any of this teacher's courses
      const activity = await storage.getRecentActivityForTeacher(req.user.userId, 5);
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Instructor dashboard
  app.get("/api/protected/instructor/dashboard", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== "teacher") {
        return res.status(403).json({ message: "Only teachers can access instructor dashboard" });
      }
      
      // Get teacher's courses
      const courses = await storage.getCoursesByTeacher(req.user.userId);
      
      // Get recent activity
      const recentActivity = await storage.getRecentActivityForTeacher(req.user.userId, 10);
      
      res.json({
        courses,
        recentActivity,
        totalCourses: courses.length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  // Auth routes
  app.post("/api/auth/register", async (req: express.Request, res: express.Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      // Create session using session manager (same as login)
      const deviceInfo = (req as any).deviceInfo;
      const ipAddress = (req as any).ipAddress;
      
      const tokens = await sessionManager.createSession(
        user.id,
        user.email,
        user.role,
        deviceInfo,
        ipAddress
      );

      res.json({ 
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName,
          role: user.role 
        } 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req: express.Request, res: express.Response) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create session using session manager
      const deviceInfo = (req as any).deviceInfo;
      const ipAddress = (req as any).ipAddress;
      
      const tokens = await sessionManager.createSession(
        user.id,
        user.email,
        user.role,
        deviceInfo,
        ipAddress
      );

      res.json({ 
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName,
          role: user.role 
        } 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Session management routes
  app.post("/api/auth/refresh", async (req: express.Request, res: express.Response) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }

      const tokens = await sessionManager.refreshSession(refreshToken);
      
      if (!tokens) {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = req.user?.sessionId;
      
      if (sessionId) {
        await sessionManager.destroySession(sessionId);
      }

      res.json({ message: "Logged out successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout-all", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      
      if (userId) {
        const destroyedCount = await sessionManager.destroyAllUserSessions(userId);
        res.json({ 
          message: "Logged out from all devices successfully",
          sessionsDestroyed: destroyedCount
        });
      } else {
        res.json({ message: "No active sessions found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User routes
  app.get("/api/protected/user/profile", async (req: express.Request, res: express.Response) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Session management routes for users
  app.get("/api/protected/user/sessions", async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const sessions = await sessionManager.getUserSessions(userId);
      
      // Remove sensitive data before sending to client
      const safeSessions = sessions.map(session => ({
        sessionId: session.sessionId,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        isCurrent: session.sessionId === req.user?.sessionId
      }));

      res.json(safeSessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/protected/user/sessions/:sessionId", async (req: express.Request, res: express.Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify the session belongs to the user
      const userSessions = await sessionManager.getUserSessions(userId);
      const sessionExists = userSessions.some(s => s.sessionId === sessionId);
      
      if (!sessionExists) {
        return res.status(404).json({ message: "Session not found" });
      }

      const destroyed = await sessionManager.destroySession(sessionId);
      
      if (destroyed) {
        res.json({ message: "Session terminated successfully" });
      } else {
        res.status(404).json({ message: "Session not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user profile
  app.put("/api/protected/user/profile", async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { firstName, lastName, bio, profileImage } = req.body;
      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName,
        bio,
        profileImage
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Change user password
  app.put("/api/protected/user/password", async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const bcrypt = await import("bcryptjs");
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      await storage.updateUser(userId, { password: hashedNewPassword });
      
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update notification settings
  app.put("/api/protected/user/notifications", async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // For now, just return success - in a real app, you'd store these in the database
      res.json({ message: "Notification settings updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update privacy settings
  app.put("/api/protected/user/privacy", async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // For now, just return success - in a real app, you'd store these in the database
      res.json({ message: "Privacy settings updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update appearance settings
  app.put("/api/protected/user/appearance", async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // For now, just return success - in a real app, you'd store these in the database
      res.json({ message: "Appearance settings updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export user data
  app.get("/api/protected/user/export", async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's courses and progress
      let courses = [];
      if (user.role === 'teacher') {
        courses = await storage.getCoursesByTeacher(userId);
      } else if (user.role === 'student') {
        courses = await storage.getEnrolledCourses(userId);
      }

      const { password, ...userWithoutPassword } = user;
      const exportData = {
        user: userWithoutPassword,
        courses,
        exportedAt: new Date().toISOString()
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${user.firstName}_${user.lastName}_data.json"`);
      res.json(exportData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin route to view session statistics
  app.get("/api/protected/admin/session-stats", requireRole(['admin']), async (req: express.Request, res: express.Response) => {
    try {
      const stats = sessionManager.getSessionStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student enrollments with progress
  app.get("/api/protected/enrollments", async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Only students can view enrollments" });
      }
      
      const courses = await storage.getEnrolledCourses(req.user.userId);
      const enrollmentsWithProgress = await Promise.all(
        courses.map(async (course) => {
          const progress = await storage.getCourseProgress(req.user.userId, course.id);
          return {
            ...course,
            progress: progress?.progress || 0,
            completedLessons: progress?.completedLessons || 0,
            totalLessons: progress?.totalLessons || 0,
            enrolledAt: progress?.enrolledAt
          };
        })
      );
      
      res.json(enrollmentsWithProgress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Course routes
  app.get("/api/protected/courses", async (req: express.Request, res: express.Response) => {
    try {
      let courses;
      if (req.user.role === 'teacher') {
        courses = await storage.getCoursesByTeacher(req.user.userId);
      } else if (req.user.role === 'student') {
        // For students, get all published courses with enrollment status
        courses = await storage.getCoursesForStudent(req.user.userId);
      } else {
        courses = await storage.getCourses();
      }
      res.json(courses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/courses/all", async (req: express.Request, res: express.Response) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/courses/:id", async (req: express.Request, res: express.Response) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Add enrollment information for students
      let courseWithEnrollment = { ...course };
      if (req.user.role === 'student') {
        const enrollment = await storage.getEnrollment(req.params.id, req.user.userId);
        courseWithEnrollment.isEnrolled = !!enrollment;
        if (enrollment) {
          courseWithEnrollment.enrollment = enrollment;
        }
      }
      
      res.json(courseWithEnrollment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses", async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create courses" });
      }

      const courseData = insertCourseSchema.parse({
        ...req.body,
        teacherId: req.user.userId,
        status: "published" // Auto-publish courses so students can see them
      });
      
      const course = await storage.createCourse(courseData);
      res.json(course);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses/:id/enroll", async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Only students can enroll in courses" });
      }

      // Check if already enrolled
      const existingEnrollment = await storage.getEnrollment(req.params.id, req.user.userId);
      if (existingEnrollment) {
        return res.status(400).json({ message: "Already enrolled in this course" });
      }

      const enrollment = await storage.enrollStudent(req.params.id, req.user.userId);
      res.json(enrollment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Course publish endpoint
  app.post("/api/protected/courses/:id/publish", async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can publish courses" });
      }
      
      // Get the course
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Verify the teacher owns this course
      if (course.teacherId !== req.user.userId) {
        return res.status(403).json({ message: "You can only publish your own courses" });
      }
      
      // Update course status (if you have a status field, otherwise this is just a placeholder)
      // You might want to add a 'status' field to your courses table
      const updatedCourse = await storage.updateCourse(req.params.id, { 
        status: "published" 
      });
      
      res.json({ success: true, course: updatedCourse });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update course endpoint
  app.put("/api/protected/courses/:id", async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can update courses" });
      }
      
      // Get the course
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Verify the teacher owns this course
      if (course.teacherId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You can only update your own courses" });
      }
      
      const { title, description, subject, objectives, category, targetAudience, duration } = req.body;
      
      console.log("Course update request body:", req.body);
      console.log("Duration field - type:", typeof duration, "value:", duration);
      
      // Ensure duration is a string (course duration should be text like "10 hours", "6 weeks")
      const updateData = {
        title,
        description,
        subject,
        objectives,
        category,
        targetAudience,
        duration: duration ? String(duration) : undefined
      };
      
      // Filter out undefined values
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );
      
      console.log("Update data after processing:", filteredUpdateData);
      
      const updatedCourse = await storage.updateCourse(req.params.id, filteredUpdateData);
      
      res.json(updatedCourse);
    } catch (error: any) {
      console.error("Course update error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete course endpoint
  app.delete("/api/protected/courses/:id", async (req: express.Request, res: express.Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can delete courses" });
      }
      
      // Get the course
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Verify the teacher owns this course
      if (course.teacherId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You can only delete your own courses" });
      }
      
      // Check if course has enrollments
      const enrollments = await storage.getCourseEnrollments(req.params.id);
      if (enrollments && enrollments.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete course with active enrollments. Please contact an administrator." 
        });
      }
      
      await storage.deleteCourse(req.params.id);
      res.json({ success: true, message: "Course deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Progress tracking
  app.get("/api/protected/courses/:courseId/progress", async (req: express.Request, res: express.Response) => {
    try {
      const progress = await storage.getCourseProgress(req.user.userId, req.params.courseId);
      if (!progress) {
        return res.status(404).json({ message: "Not enrolled in this course" });
      }
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assessment routes
  app.get("/api/protected/courses/:courseId/assessments", async (req: express.Request, res: express.Response) => {
    try {
      const assessments = await storage.getAssessments(req.params.courseId);
      res.json(assessments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/assessments/:id", async (req: express.Request, res: express.Response) => {
    try {
      const assessment = await storage.getAssessment(req.params.id);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      res.json(assessment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/assessments/:id/questions", async (req: Request, res: Response) => {
    try {
      const questions = await storage.getAssessmentQuestions(req.params.id);
      
      // Convert options JSON string back to array for frontend
      const processedQuestions = questions.map(question => {
        let options = null;
        if (question.options) {
          try {
            options = JSON.parse(question.options);
          } catch (parseError) {
            console.error('Error parsing question options:', parseError);
            // If parsing fails, treat as null
            options = null;
          }
        }
        
        // Security: Hide correct answers from students
        const questionData = {
          ...question,
          options
        };
        
        // Only teachers and admins should see correct answers
        if (req.user.role === 'student') {
          delete questionData.correctAnswer;
        }
        
        return questionData;
      });
      
      res.json(processedQuestions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses/:courseId/assessments", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create assessments" });
      }

      // Validate required fields
      if (!req.body.title || req.body.title.trim() === '') {
        return res.status(400).json({ message: "Assessment title is required" });
      }

      // Process the request body to handle date conversion
      const processedBody = { ...req.body };
      
      // Convert dueDate from ISO string to Date object if provided
      if (processedBody.dueDate && typeof processedBody.dueDate === 'string') {
        processedBody.dueDate = new Date(processedBody.dueDate);
      }

      const assessmentData = insertAssessmentSchema.parse({
        ...processedBody,
        courseId: req.params.courseId,
        // Let the schema generate the ID using its default function
        createdAt: new Date(),
      });
      
      const assessment = await storage.createAssessment(assessmentData);
      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/protected/assessments/:assessmentId/questions", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create questions" });
      }

      // Process the request body to handle options conversion
      const processedBody = { ...req.body };
      
      // Convert options array to JSON string if it's an array
      if (processedBody.options && Array.isArray(processedBody.options)) {
        processedBody.options = JSON.stringify(processedBody.options);
      }

      const questionData = insertQuestionSchema.parse({
        ...processedBody,
        assessmentId: req.params.assessmentId
      });
      
      const question = await storage.createQuestion(questionData);
      
      // Update assessment total points
      const questions = await storage.getAssessmentQuestions(req.params.assessmentId);
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
      await storage.updateAssessment(req.params.assessmentId, { totalPoints });
      
      res.json(question);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update assessment
  app.put("/api/protected/assessments/:id", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can update assessments" });
      }

      // Process the request body to handle date conversion
      const processedBody = { ...req.body };
      
      // Convert dueDate from ISO string to Date object if provided
      if (processedBody.dueDate && typeof processedBody.dueDate === 'string') {
        processedBody.dueDate = new Date(processedBody.dueDate);
      }

      const assessment = await storage.updateAssessment(req.params.id, processedBody);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update question
  app.put("/api/protected/questions/:id", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can update questions" });
      }

      // Get the question first to find its assessmentId
      const existingQuestion = await storage.getQuestion(req.params.id);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Process the request body to handle options conversion
      const processedBody = { ...req.body };
      
      // Convert options array to JSON string if it's an array
      if (processedBody.options && Array.isArray(processedBody.options)) {
        processedBody.options = JSON.stringify(processedBody.options);
      }

      const question = await storage.updateQuestion(req.params.id, processedBody);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Update assessment total points
      const questions = await storage.getAssessmentQuestions(existingQuestion.assessmentId);
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
      await storage.updateAssessment(existingQuestion.assessmentId, { totalPoints });

      res.json(question);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete question
  app.delete("/api/protected/questions/:id", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can delete questions" });
      }

      // Get the question first to find its assessmentId
      const existingQuestion = await storage.getQuestion(req.params.id);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      const success = await storage.deleteQuestion(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Update assessment total points after deletion
      const questions = await storage.getAssessmentQuestions(existingQuestion.assessmentId);
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
      await storage.updateAssessment(existingQuestion.assessmentId, { totalPoints });

      res.json({ message: "Question deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Publish/Unpublish assessment
  app.post("/api/protected/assessments/:id/publish", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can publish assessments" });
      }

      const assessment = await storage.getAssessment(req.params.id);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Toggle status between draft and published
      const newStatus = assessment.status === 'published' ? 'draft' : 'published';
      const updatedAssessment = await storage.updateAssessment(req.params.id, { status: newStatus });

      res.json(updatedAssessment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Preview assessment (for teachers - includes submission statistics)
  app.get("/api/protected/assessments/:id/preview", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can preview assessments" });
      }

      const assessment = await storage.getAssessment(req.params.id);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const questions = await storage.getAssessmentQuestions(req.params.id);
      
      // Get submission statistics
      const submissions = await storage.getAssessmentSubmissions(req.params.id);
      
      // Calculate statistics
      const totalSubmissions = submissions.length;
      const completedSubmissions = submissions.filter(s => s.status === 'submitted').length;
      const inProgressSubmissions = submissions.filter(s => s.status === 'in_progress').length;
      
      // Calculate average score for completed submissions
      const completedWithScores = submissions.filter(s => s.status === 'submitted' && s.score !== null);
      const averageScore = completedWithScores.length > 0 
        ? completedWithScores.reduce((sum, s) => sum + (s.score || 0), 0) / completedWithScores.length 
        : 0;
      
      // Get max possible score
      const maxScore = questions.reduce((sum, q) => sum + (q.points || 0), 0);
      
      res.json({
        assessment,
        questions: questions.map(q => ({
          ...q,
          options: q.options ? JSON.parse(q.options) : null
        })),
        statistics: {
          totalSubmissions,
          completedSubmissions,
          inProgressSubmissions,
          averageScore: Math.round(averageScore * 100) / 100,
          maxScore,
          averagePercentage: maxScore > 0 ? Math.round((averageScore / maxScore) * 100) : 0
        },
        submissions: submissions.map(s => ({
          id: s.id,
          studentId: s.studentId,
          studentName: s.studentName || 'Unknown Student',
          status: s.status,
          score: s.score,
          maxScore: s.totalPoints || maxScore,
          percentage: s.totalPoints && s.score ? Math.round((s.score / s.totalPoints) * 100) : null,
          startedAt: s.startedAt,
          submittedAt: s.submittedAt,
          timeTaken: s.timeTaken
        }))
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get assessment submissions (for teachers)
  app.get("/api/protected/assessments/:assessmentId/submissions", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can view submissions" });
      }

      const submissions = await storage.getAssessmentSubmissions(req.params.assessmentId);
      res.json(submissions);
    } catch (error: any) {
      console.error('Error in submissions route:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get specific submission details
  app.get("/api/protected/submissions/:submissionId", async (req: Request, res: Response) => {
    try {
      const submission = await storage.getSubmissionById(req.params.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Check permissions
      if (req.user.role === 'student' && submission.userId !== req.user.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get submission answers
      const answers = await storage.getSubmissionAnswers(submission.id);
      
      res.json({
        ...submission,
        answers
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update submission (for grading)
  app.put("/api/protected/submissions/:submissionId", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can grade submissions" });
      }

      const submission = await storage.updateSubmission(req.params.submissionId, req.body);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      res.json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Submission routes
  app.get("/api/protected/assessments/:assessmentId/submission", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Only students can view their submissions" });
      }

      const submission = await storage.getSubmission(req.params.assessmentId, req.user.userId);
      if (!submission) {
        return res.status(404).json({ message: "No submission found" });
      }

      // Get submission answers
      const answers = await storage.getSubmissionAnswers(submission.id);
      
      res.json({
        ...submission,
        answers
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/assessments/:assessmentId/start", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Only students can take assessments" });
      }

      // Check if already has a submission
      const existingSubmission = await storage.getSubmission(req.params.assessmentId, req.user.userId);
      if (existingSubmission) {
        return res.json(existingSubmission);
      }

      const submission = await storage.createSubmission(req.params.assessmentId, req.user.userId);
      res.json(submission);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/submissions/:submissionId/answers", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Only students can submit answers" });
      }

      const { questionId, answer } = req.body;
      if (!questionId || !answer) {
        return res.status(400).json({ message: "Question ID and answer are required" });
      }

      const submissionAnswer = await storage.createSubmissionAnswer(
        req.params.submissionId,
        questionId,
        answer
      );
      res.json(submissionAnswer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/protected/submissions/:submissionId/submit", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Only students can submit assessments" });
      }

      const result = await storage.submitAssessment(req.params.submissionId);
      if (!result) {
        return res.status(404).json({ message: "Submission not found" });
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get assessment review with correct answers (only for completed submissions)
  app.get("/api/protected/assessments/:assessmentId/review", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Only students can view assessment previews" });
      }

      // Get the student's submission for this assessment
      const submission = await storage.getSubmission(req.params.assessmentId, req.user.userId);
      if (!submission) {
        return res.status(404).json({ message: "No submission found for this assessment" });
      }

      // Only allow preview if the assessment has been submitted
      if (!submission.submittedAt) {
        return res.status(403).json({ message: "Assessment must be submitted before viewing preview" });
      }

      // Get assessment details
      const assessment = await storage.getAssessment(req.params.assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Get all questions with correct answers (since this is a preview after submission)
      const questions = await storage.getAssessmentQuestions(req.params.assessmentId);
      
      // Get student's answers
      const studentAnswers = await storage.getSubmissionAnswers(submission.id);
      
      // Process questions to include options and correct answers
      const processedQuestions = questions.map(question => {
        let options = null;
        if (question.options) {
          try {
            options = JSON.parse(question.options);
          } catch (parseError) {
            console.error('Error parsing question options:', parseError);
            options = null;
          }
        }

        // Find student's answer for this question
        const studentAnswer = studentAnswers.find(answer => answer.questionId === question.id);
        
        return {
          ...question,
          options,
          studentAnswer: studentAnswer?.answer || null,
          isCorrect: studentAnswer ? studentAnswer.answer === question.correctAnswer : false
        };
      });

      res.json({
        assessment,
        submission,
        questions: processedQuestions,
        totalScore: submission.score || 0,
        maxScore: submission.maxScore || 0
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Discussion routes
  app.get("/api/protected/courses/:courseId/discussions", async (req: Request, res: Response) => {
    try {
      const discussions = await storage.getDiscussions(req.params.courseId);
      res.json(discussions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses/:courseId/discussions", async (req: Request, res: Response) => {
    try {
      console.log(`Creating discussion for course ${req.params.courseId} by user ${req.user.userId} (${req.user.role})`);
      console.log('Request body:', req.body);
      
      // Allow both students and teachers to create discussions
      // Students should be enrolled in the course, teachers should own it
      const courseId = req.params.courseId;
      
      // Check if user has access to this course
      if (req.user.role === 'student') {
        const enrollment = await storage.getEnrollment(courseId, req.user.userId);
        console.log('Student enrollment check:', enrollment);
        if (!enrollment) {
          console.log('Student not enrolled in course');
          return res.status(403).json({ message: "You must be enrolled in this course to create discussions" });
        }
      } else if (req.user.role === 'teacher') {
        const course = await storage.getCourse(courseId);
        console.log('Teacher course check:', course);
        if (!course || course.teacherId !== req.user.userId) {
          console.log('Teacher does not own course');
          return res.status(403).json({ message: "You can only create discussions in your own courses" });
        }
      } else if (req.user.role !== 'admin') {
        console.log('User does not have permission');
        return res.status(403).json({ message: "You don't have permission to create discussions" });
      }

      const discussionData = insertDiscussionSchema.parse({
        ...req.body,
        courseId: req.params.courseId,
        createdBy: req.user.userId
      });
      
      console.log('Creating discussion with data:', discussionData);
      const discussion = await storage.createDiscussion(discussionData);
      console.log('Discussion created:', discussion);
      res.json(discussion);
    } catch (error: any) {
      console.error('Error creating discussion:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/protected/discussions/:discussionId", async (req: Request, res: Response) => {
    try {
      const discussion = await storage.getDiscussion(req.params.discussionId);
      if (!discussion) {
        return res.status(404).json({ message: "Discussion not found" });
      }
      res.json(discussion);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/discussions/:discussionId/posts", async (req: Request, res: Response) => {
    try {
      const posts = await storage.getDiscussionPosts(req.params.discussionId);
      res.json(posts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/discussions/:discussionId/posts", async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      const post = await storage.createDiscussionPost(
        req.params.discussionId,
        req.user.userId,
        content
      );
      res.json(post);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Announcement routes
  app.get("/api/protected/courses/:courseId/announcements", async (req: Request, res: Response) => {
    try {
      const announcements = await storage.getAnnouncements(req.params.courseId);
      res.json(announcements);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses/:courseId/announcements", async (req: Request, res: Response) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create announcements" });
      }

      const announcement = await storage.createAnnouncement({
        ...req.body,
        courseId: req.params.courseId,
        authorId: req.user.userId
      });
      res.json(announcement);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Ensure course routes are handled by the React app, not as file downloads
  app.get("/courses/:id", (req: Request, res: Response, next: NextFunction) => {
    // This should be handled by the React app's client-side routing
    // Let it fall through to the Vite middleware
    next();
  });

  const httpServer = createServer(app);
  return httpServer;
}
