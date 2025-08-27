import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertCourseSchema, insertAssessmentSchema, insertQuestionSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware to verify JWT token
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
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

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token, 
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

  app.post("/api/auth/login", async (req, res) => {
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

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token, 
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

  // Protected routes - require authentication
  app.use("/api/protected", authenticateToken);

  // User routes
  app.get("/api/protected/user/profile", async (req: any, res) => {
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

  // Course routes
  app.get("/api/protected/courses", async (req: any, res) => {
    try {
      let courses;
      if (req.user.role === 'teacher') {
        courses = await storage.getCoursesByTeacher(req.user.userId);
      } else if (req.user.role === 'student') {
        courses = await storage.getEnrolledCourses(req.user.userId);
      } else {
        courses = await storage.getCourses();
      }
      res.json(courses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/courses/all", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses", async (req: any, res) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create courses" });
      }

      const courseData = insertCourseSchema.parse({
        ...req.body,
        teacherId: req.user.userId
      });
      
      const course = await storage.createCourse(courseData);
      res.json(course);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses/:id/enroll", async (req: any, res) => {
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

  // Assessment routes
  app.get("/api/protected/courses/:courseId/assessments", async (req, res) => {
    try {
      const assessments = await storage.getAssessments(req.params.courseId);
      res.json(assessments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/protected/assessments/:id", async (req, res) => {
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

  app.get("/api/protected/assessments/:id/questions", async (req, res) => {
    try {
      const questions = await storage.getAssessmentQuestions(req.params.id);
      res.json(questions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses/:courseId/assessments", async (req: any, res) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create assessments" });
      }

      const assessmentData = insertAssessmentSchema.parse({
        ...req.body,
        courseId: req.params.courseId
      });
      
      const assessment = await storage.createAssessment(assessmentData);
      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/protected/assessments/:assessmentId/questions", async (req: any, res) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only teachers can create questions" });
      }

      const questionData = insertQuestionSchema.parse({
        ...req.body,
        assessmentId: req.params.assessmentId
      });
      
      const question = await storage.createQuestion(questionData);
      res.json(question);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Submission routes
  app.post("/api/protected/assessments/:assessmentId/start", async (req: any, res) => {
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

  // Discussion routes
  app.get("/api/protected/courses/:courseId/discussions", async (req, res) => {
    try {
      const discussions = await storage.getDiscussions(req.params.courseId);
      res.json(discussions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Announcement routes
  app.get("/api/protected/courses/:courseId/announcements", async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements(req.params.courseId);
      res.json(announcements);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/protected/courses/:courseId/announcements", async (req: any, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
