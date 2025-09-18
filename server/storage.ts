import { 
  users, courses, courseEnrollments, courseMaterials, assessments, questions, 
  assessmentSubmissions, questionAnswers, discussions, discussionPosts, announcements,
  modules, lessons, lessonProgress, certificates, assignments,
  type User, type InsertUser, type Course, type InsertCourse, type Assessment, 
  type InsertAssessment, type Question, type InsertQuestion, type Discussion,
  type InsertDiscussion, type Announcement, type InsertAnnouncement, type CourseEnrollment,
  type AssessmentSubmission, type DiscussionPost, type Module, type InsertModule,
  type Lesson, type InsertLesson, type LessonProgress, type Certificate, type InsertCertificate,
  type Assignment, type InsertAssignment, type EnhancedInsertCourse
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, avg, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  
  // Course methods
  getCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  getCourseById(id: string): Promise<Course | undefined>;
  getCoursesByTeacher(teacherId: string): Promise<Course[]>;
  getCoursesForStudent(studentId: string): Promise<any[]>;
  getEnrolledCourses(studentId: string): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined>;
  
  // Enrollment methods
  enrollStudent(courseId: string, studentId: string): Promise<CourseEnrollment>;
  getEnrollment(courseId: string, studentId: string): Promise<CourseEnrollment | undefined>;
  
  // Assessment methods
  getAssessments(courseId: string): Promise<Assessment[]>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  updateAssessment(id: string, updates: Partial<InsertAssessment>): Promise<Assessment | undefined>;
  getAssessmentQuestions(assessmentId: string): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: string): Promise<boolean>;
  
  // Submission methods
  createSubmission(assessmentId: string, studentId: string): Promise<AssessmentSubmission>;
  getSubmission(assessmentId: string, studentId: string): Promise<AssessmentSubmission | undefined>;
  getSubmissionAnswers(submissionId: string): Promise<any[]>;
  submitAssessment(submissionId: string): Promise<AssessmentSubmission | undefined>;
  createSubmissionAnswer(submissionId: string, questionId: string, answer: string): Promise<any>;
  
  // Grade methods
  getRecentGradesForStudent(studentId: string, limit: number): Promise<any[]>;
  getAllGradesForStudent(studentId: string): Promise<any[]>;
  getRecentActivityForTeacher(teacherId: string, limit: number): Promise<any[]>;
  
  // Discussion methods
  getDiscussions(courseId: string): Promise<Discussion[]>;
  getDiscussion(discussionId: string): Promise<Discussion | undefined>;
  createDiscussion(discussion: InsertDiscussion): Promise<Discussion>;
  getDiscussionPosts(discussionId: string): Promise<DiscussionPost[]>;
  createDiscussionPost(discussionId: string, userId: string, content: string): Promise<DiscussionPost>;
  
  // Announcement methods
  getAnnouncements(courseId: string): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  
  // Enhanced course methods
  createEnhancedCourse(course: EnhancedInsertCourse): Promise<Course>;
  
  // Enrollment methods

  
  // Module methods
  createModule(module: InsertModule): Promise<Module>;
  getModules(courseId: string): Promise<Module[]>;
  getCourseModulesWithLessons(courseId: string, userId?: string): Promise<any[]>;
  updateModule(id: string, module: Partial<InsertModule>): Promise<Module | undefined>;
  
  // Lesson methods
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  getLessons(moduleId: string): Promise<Lesson[]>;
  updateLesson(id: string, lesson: Partial<InsertLesson>): Promise<Lesson | undefined>;
  updateLessonUrl(id: string, url: string, mimeType: string, originalName: string, duration?: number, metadata?: any): Promise<Lesson | undefined>;
  
  // Lesson progress methods
  markLessonComplete(userId: string, courseId: string, lessonId: string): Promise<LessonProgress>;
  getCourseProgress(courseId: string, userId: string): Promise<any>;
  getLessonProgress(userId: string, courseId: string, lessonId: string): Promise<LessonProgress | undefined>;
  countLessonsInCourse(courseId: string): Promise<number>;
  countCompletedLessons(userId: string, courseId: string): Promise<number>;
  updateCourseProgress(userId: string, courseId: string, progress: number): Promise<void>;
  
  // Certificate methods
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  
  // Assignment methods
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(desc(courses.createdAt));
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async getCourseById(id: string): Promise<Course | undefined> {
    return this.getCourse(id);
  }

  async getCoursesByTeacher(teacherId: string): Promise<Course[]> {
    return await db.select().from(courses)
      .where(eq(courses.teacherId, teacherId))
      .orderBy(desc(courses.createdAt));
  }

  async getCoursesForStudent(studentId: string): Promise<any[]> {
    // Get all published courses with enrollment status
    const allCourses = await db.select().from(courses).where(eq(courses.status, 'published'));
    
    // Get student's enrollments
    const enrollments = await db.select().from(courseEnrollments)
      .where(eq(courseEnrollments.studentId, studentId));
    
    // Map courses with enrollment status
    return allCourses.map(course => {
      const enrollment = enrollments.find(e => e.courseId === course.id);
      return {
        ...course,
        isEnrolled: !!enrollment,
        enrollment: enrollment || null
      };
    });
  }

  async getEnrolledCourses(studentId: string): Promise<Course[]> {
    return await db.select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      subject: courses.subject,
      teacherId: courses.teacherId,
      coverImage: courses.coverImage,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .innerJoin(courseEnrollments, eq(courses.id, courseEnrollments.courseId))
    .where(eq(courseEnrollments.studentId, studentId))
    .orderBy(desc(courses.createdAt));
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined> {
    const [updatedCourse] = await db.update(courses)
      .set({ ...course, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return updatedCourse || undefined;
  }

  async enrollStudent(courseId: string, studentId: string): Promise<CourseEnrollment> {
    const [enrollment] = await db.insert(courseEnrollments)
      .values({ courseId, studentId })
      .returning();
    return enrollment;
  }

  async getEnrollment(courseId: string, studentId: string): Promise<CourseEnrollment | undefined> {
    const [enrollment] = await db.select().from(courseEnrollments)
      .where(and(
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.studentId, studentId)
      ));
    return enrollment || undefined;
  }

  async getAssessments(courseId: string): Promise<Assessment[]> {
    return await db.select().from(assessments)
      .where(eq(assessments.courseId, courseId))
      .orderBy(desc(assessments.createdAt));
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    return assessment || undefined;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [newAssessment] = await db.insert(assessments).values(assessment).returning();
    return newAssessment;
  }

  async getAssessmentQuestions(assessmentId: string): Promise<Question[]> {
    return await db.select().from(questions)
      .where(eq(questions.assessmentId, assessmentId))
      .orderBy(asc(questions.order));
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    const [question] = await db.select().from(questions)
      .where(eq(questions.id, id));
    return question || undefined;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async createSubmission(assessmentId: string, studentId: string): Promise<AssessmentSubmission> {
    const [submission] = await db.insert(assessmentSubmissions)
      .values({ assessmentId, studentId })
      .returning();
    return submission;
  }

  async getSubmission(assessmentId: string, studentId: string): Promise<AssessmentSubmission | undefined> {
    const [submission] = await db.select().from(assessmentSubmissions)
      .where(and(
        eq(assessmentSubmissions.assessmentId, assessmentId),
        eq(assessmentSubmissions.studentId, studentId)
      ));
    return submission || undefined;
  }

  async getSubmissionAnswers(submissionId: string): Promise<any[]> {
    const answers = await db.select().from(questionAnswers)
      .where(eq(questionAnswers.submissionId, submissionId));
    return answers;
  }

  async submitAssessment(submissionId: string): Promise<AssessmentSubmission | undefined> {
    // Get the submission to find the assessment
    const [currentSubmission] = await db.select()
      .from(assessmentSubmissions)
      .where(eq(assessmentSubmissions.id, submissionId));
    
    if (!currentSubmission) {
      return undefined;
    }

    // Get all answers for this submission
    const answers = await db.select({
      questionId: questionAnswers.questionId,
      answer: questionAnswers.answer
    })
    .from(questionAnswers)
    .where(eq(questionAnswers.submissionId, submissionId));

    // Get all questions for the assessment with their correct answers and points
    const questionsData = await db.select({
      id: questions.id,
      correctAnswer: questions.correctAnswer,
      points: questions.points
    })
    .from(questions)
    .where(eq(questions.assessmentId, currentSubmission.assessmentId));

    // Calculate score
    let totalScore = 0;
    let totalPoints = 0;

    for (const question of questionsData) {
      totalPoints += question.points;
      const studentAnswer = answers.find(a => a.questionId === question.id);
      
      if (studentAnswer && studentAnswer.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()) {
        totalScore += question.points;
      }
    }

    // Update submission with calculated score
    const [submission] = await db.update(assessmentSubmissions)
      .set({ 
        status: "submitted", 
        submittedAt: new Date(),
        score: totalScore,
        totalPoints: totalPoints
      })
      .where(eq(assessmentSubmissions.id, submissionId))
      .returning();
    
    return submission || undefined;
  }

  async createSubmissionAnswer(submissionId: string, questionId: string, answer: string): Promise<any> {
    const [newAnswer] = await db.insert(questionAnswers).values({
      // Let the schema generate the ID using its default function
      submissionId,
      questionId,
      answer
    }).returning();
    return newAnswer;
  }

  async getDiscussions(courseId: string): Promise<Discussion[]> {
    return await db.select().from(discussions)
      .where(eq(discussions.courseId, courseId))
      .orderBy(desc(discussions.createdAt));
  }

  async getDiscussion(discussionId: string): Promise<Discussion | undefined> {
    const [discussion] = await db.select({
      id: discussions.id,
      courseId: discussions.courseId,
      title: discussions.title,
      description: discussions.description,
      createdBy: discussions.createdBy,
      createdByUsername: users.username,
      createdAt: discussions.createdAt,
    }).from(discussions)
      .leftJoin(users, eq(discussions.createdBy, users.id))
      .where(eq(discussions.id, discussionId))
      .limit(1);
    return discussion;
  }

  async createDiscussion(discussion: InsertDiscussion): Promise<Discussion> {
    const [newDiscussion] = await db.insert(discussions).values(discussion).returning();
    return newDiscussion;
  }

  async getDiscussionPosts(discussionId: string): Promise<DiscussionPost[]> {
    return await db.select({
      id: discussionPosts.id,
      discussionId: discussionPosts.discussionId,
      parentId: discussionPosts.parentId,
      content: discussionPosts.content,
      authorId: discussionPosts.authorId,
      authorUsername: users.username,
      createdAt: discussionPosts.createdAt,
    }).from(discussionPosts)
      .leftJoin(users, eq(discussionPosts.authorId, users.id))
      .where(eq(discussionPosts.discussionId, discussionId))
      .orderBy(asc(discussionPosts.createdAt));
  }

  async createDiscussionPost(discussionId: string, userId: string, content: string): Promise<DiscussionPost> {
    const [newPost] = await db.insert(discussionPosts).values({
      // Let the schema generate the ID using its default function
      discussionId,
      authorId: userId,
      content
    }).returning();
    return newPost;
  }

  async getAnnouncements(courseId: string): Promise<Announcement[]> {
    return await db.select().from(announcements)
      .where(eq(announcements.courseId, courseId))
      .orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [newAnnouncement] = await db.insert(announcements).values(announcement).returning();
    return newAnnouncement;
  }

  // Enhanced course methods
  async createEnhancedCourse(course: EnhancedInsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }



  // Module methods
  async createModule(module: InsertModule): Promise<Module> {
    const [newModule] = await db.insert(modules).values(module).returning();
    return newModule;
  }

  async getModules(courseId: string): Promise<Module[]> {
    return await db.select().from(modules)
      .where(eq(modules.courseId, courseId))
      .orderBy(asc(modules.order));
  }

  async getCourseModulesWithLessons(courseId: string, userId?: string): Promise<any[]> {
    const modulesList = await this.getModules(courseId);
    const result = [];
    
    for (const module of modulesList) {
      const lessonsList = await this.getLessons(module.id);
      const lessonsWithProgress = [];
      
      for (const lesson of lessonsList) {
        let completed = false;
        if (userId) {
          const progress = await this.getLessonProgress(userId, courseId, lesson.id);
          completed = !!progress;
        }
        // Map contentUrl to url for frontend compatibility
        const mappedLesson = { 
          ...lesson, 
          completed,
          url: lesson.contentUrl // Add url field for frontend compatibility
        };
        lessonsWithProgress.push(mappedLesson);
      }
      
      result.push({ ...module, lessons: lessonsWithProgress });
    }
    
    return result;
  }

  async updateModule(id: string, module: Partial<InsertModule>): Promise<Module | undefined> {
    const [updatedModule] = await db.update(modules)
      .set({ ...module, updatedAt: new Date() })
      .where(eq(modules.id, id))
      .returning();
    return updatedModule || undefined;
  }

  // Lesson methods
  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [newLesson] = await db.insert(lessons).values(lesson).returning();
    return newLesson;
  }

  async getLessons(moduleId: string): Promise<Lesson[]> {
    return await db.select().from(lessons)
      .where(eq(lessons.moduleId, moduleId))
      .orderBy(asc(lessons.order));
  }

  async updateLesson(id: string, lesson: Partial<InsertLesson>): Promise<Lesson | undefined> {
    const [updatedLesson] = await db.update(lessons)
      .set({ ...lesson, updatedAt: new Date() })
      .where(eq(lessons.id, id))
      .returning();
    return updatedLesson || undefined;
  }

  async updateLessonUrl(id: string, url: string, mimeType: string, originalName: string, duration?: number, metadata?: any): Promise<Lesson | undefined> {
    // Determine content type based on mime type
    let contentType = 'text';
    if (mimeType.startsWith('video/')) {
      contentType = 'video';
    } else if (mimeType === 'application/pdf') {
      contentType = 'pdf';
    } else if (mimeType.startsWith('image/')) {
      contentType = 'image';
    }

    const updateData: Partial<InsertLesson> = {
      contentUrl: url,
      contentType,
      fileName: originalName,
      mimeType: mimeType,
      uploadedAt: Date.now(),
      updatedAt: new Date()
    };

    // Add duration if provided
    if (duration) {
      updateData.duration = Math.floor(duration).toString();
      updateData.durationSeconds = Math.floor(duration);
    }

    // Add metadata fields if provided
    if (metadata) {
      if (metadata.fileSize) updateData.fileSize = metadata.fileSize;
      if (metadata.fileHash) updateData.fileHash = metadata.fileHash;
      
      // Video metadata
      if (metadata.videoWidth) updateData.videoWidth = metadata.videoWidth;
      if (metadata.videoHeight) updateData.videoHeight = metadata.videoHeight;
      if (metadata.videoBitrate) updateData.videoBitrate = metadata.videoBitrate;
      if (metadata.videoCodec) updateData.videoCodec = metadata.videoCodec;
      if (metadata.audioCodec) updateData.audioCodec = metadata.audioCodec;
      
      // PDF metadata
      if (metadata.pdfPages) updateData.pdfPages = metadata.pdfPages;
      if (metadata.pdfVersion) updateData.pdfVersion = metadata.pdfVersion;
      
      // Text metadata
      if (metadata.wordCount) updateData.wordCount = metadata.wordCount;
      if (metadata.readingTime) updateData.readingTime = metadata.readingTime;
      
      // Thumbnail
      if (metadata.thumbnailUrl) updateData.thumbnailUrl = metadata.thumbnailUrl;
    }

    const [updatedLesson] = await db.update(lessons)
      .set(updateData)
      .where(eq(lessons.id, id))
      .returning();
    return updatedLesson || undefined;
  }

  // Lesson progress methods
  async markLessonComplete(userId: string, courseId: string, lessonId: string): Promise<LessonProgress> {
    const [progress] = await db.insert(lessonProgress)
      .values({ userId, courseId, lessonId })
      .returning();
    return progress;
  }

  async getCourseProgress(courseId: string, userId: string): Promise<any> {
    const totalLessons = await this.countLessonsInCourse(courseId);
    const completedLessons = await this.countCompletedLessons(userId, courseId);
    const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    
    return {
      courseId,
      userId,
      totalLessons,
      completedLessons,
      progress: Math.round(progress)
    };
  }

  async getLessonProgress(userId: string, courseId: string, lessonId: string): Promise<LessonProgress | undefined> {
    const [progress] = await db.select().from(lessonProgress)
      .where(and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.courseId, courseId),
        eq(lessonProgress.lessonId, lessonId)
      ));
    return progress || undefined;
  }

  async countLessonsInCourse(courseId: string): Promise<number> {
    const modulesList = await this.getModules(courseId);
    let totalLessons = 0;
    for (const module of modulesList) {
      const lessonsList = await this.getLessons(module.id);
      totalLessons += lessonsList.length;
    }
    return totalLessons;
  }

  async countCompletedLessons(userId: string, courseId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(lessonProgress)
      .where(and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.courseId, courseId)
      ));
    return result.count;
  }

  async updateCourseProgress(userId: string, courseId: string, progress: number): Promise<void> {
    await db.update(courseEnrollments)
      .set({ progress: Math.round(progress) })
      .where(and(
        eq(courseEnrollments.studentId, userId),
        eq(courseEnrollments.courseId, courseId)
      ));
  }

  // Assessment update methods
  async updateAssessment(id: string, updates: Partial<InsertAssessment>): Promise<Assessment | undefined> {
    const [updated] = await db.update(assessments)
      .set(updates)
      .where(eq(assessments.id, id))
      .returning();
    return updated || undefined;
  }

  async updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question | undefined> {
    const [updated] = await db.update(questions)
      .set(updates)
      .where(eq(questions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const result = await db.delete(questions)
      .where(eq(questions.id, id));
    return result.rowCount > 0;
  }

  // Submission management methods
  async getAssessmentSubmissions(assessmentId: string): Promise<any[]> {
    try {
      // Get submissions with user information
      const submissionsList = await db.select({
        id: assessmentSubmissions.id,
        userId: assessmentSubmissions.studentId,
        assessmentId: assessmentSubmissions.assessmentId,
        status: assessmentSubmissions.status,
        score: assessmentSubmissions.score,
        totalPoints: assessmentSubmissions.totalPoints,
        startedAt: assessmentSubmissions.startedAt,
        submittedAt: assessmentSubmissions.submittedAt,
        feedback: assessmentSubmissions.feedback,
        // Include user information
        userName: sql`COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')`.as('userName'),
        userEmail: users.email
      })
      .from(assessmentSubmissions)
      .leftJoin(users, eq(assessmentSubmissions.studentId, users.id))
      .where(eq(assessmentSubmissions.assessmentId, assessmentId))
      .orderBy(desc(assessmentSubmissions.submittedAt));

      return submissionsList || [];
    } catch (error) {
      console.error('Error getting assessment submissions:', error);
      // Fallback to basic query if the join fails
      const basicSubmissions = await db.select()
        .from(assessmentSubmissions)
        .where(eq(assessmentSubmissions.assessmentId, assessmentId));
      return basicSubmissions || [];
    }
  }

  async getSubmissionById(submissionId: string): Promise<any | undefined> {
    const [submission] = await db.select({
      id: assessmentSubmissions.id,
      userId: assessmentSubmissions.studentId,
      assessmentId: assessmentSubmissions.assessmentId,
      status: assessmentSubmissions.status,
      score: assessmentSubmissions.score,
      totalPoints: assessmentSubmissions.totalPoints,
      startedAt: assessmentSubmissions.startedAt,
      submittedAt: assessmentSubmissions.submittedAt,
      feedback: assessmentSubmissions.feedback,
      // Include user information
      userName: sql`COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')`.as('userName'),
      userEmail: users.email
    })
    .from(assessmentSubmissions)
    .leftJoin(users, eq(assessmentSubmissions.studentId, users.id))
    .where(eq(assessmentSubmissions.id, submissionId));

    return submission || undefined;
  }

  async updateSubmission(submissionId: string, updates: { score?: number; feedback?: string }): Promise<any | undefined> {
    const [updated] = await db.update(assessmentSubmissions)
      .set(updates)
      .where(eq(assessmentSubmissions.id, submissionId))
      .returning();
    return updated || undefined;
  }

  // Certificate methods
  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const [newCertificate] = await db.insert(certificates).values(certificate).returning();
    return newCertificate;
  }

  // Assignment methods
  async createAssignment(assignment: InsertAssignment): Promise<Assignment> {
    const [newAssignment] = await db.insert(assignments).values(assignment).returning();
    return newAssignment;
  }

  // Grade methods
  async getRecentGradesForStudent(studentId: string, limit: number): Promise<any[]> {
    try {
      const grades = await db.select({
        id: assessmentSubmissions.id,
        assessmentTitle: assessments.title,
        courseTitle: courses.title,
        score: assessmentSubmissions.score,
        totalPoints: assessmentSubmissions.totalPoints,
        percentage: sql<number>`ROUND((CAST(${assessmentSubmissions.score} AS REAL) / CAST(${assessmentSubmissions.totalPoints} AS REAL)) * 100, 1)`.as('percentage'),
        submittedAt: assessmentSubmissions.submittedAt,
        feedback: assessmentSubmissions.feedback,
        status: assessmentSubmissions.status
      })
      .from(assessmentSubmissions)
      .leftJoin(assessments, eq(assessmentSubmissions.assessmentId, assessments.id))
      .leftJoin(courses, eq(assessments.courseId, courses.id))
      .where(and(
        eq(assessmentSubmissions.studentId, studentId),
        eq(assessmentSubmissions.status, "submitted")
      ))
      .orderBy(desc(assessmentSubmissions.submittedAt))
      .limit(limit);

      return grades || [];
    } catch (error) {
      console.error('Error getting recent grades for student:', error);
      return [];
    }
  }

  async getAllGradesForStudent(studentId: string): Promise<any[]> {
    try {
      const grades = await db.select({
        id: assessmentSubmissions.id,
        assessmentTitle: assessments.title,
        courseTitle: courses.title,
        score: assessmentSubmissions.score,
        totalPoints: assessmentSubmissions.totalPoints,
        percentage: sql<number>`ROUND((CAST(${assessmentSubmissions.score} AS REAL) / CAST(${assessmentSubmissions.totalPoints} AS REAL)) * 100, 1)`.as('percentage'),
        submittedAt: assessmentSubmissions.submittedAt,
        feedback: assessmentSubmissions.feedback,
        status: assessmentSubmissions.status
      })
      .from(assessmentSubmissions)
      .leftJoin(assessments, eq(assessmentSubmissions.assessmentId, assessments.id))
      .leftJoin(courses, eq(assessments.courseId, courses.id))
      .where(and(
        eq(assessmentSubmissions.studentId, studentId),
        eq(assessmentSubmissions.status, "submitted")
      ))
      .orderBy(desc(assessmentSubmissions.submittedAt));

      return grades || [];
    } catch (error) {
      console.error('Error getting all grades for student:', error);
      return [];
    }
  }

  async getRecentActivityForTeacher(teacherId: string, limit: number): Promise<any[]> {
    try {
      const activity = await db.select({
        id: assessmentSubmissions.id,
        studentName: sql`COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')`.as('studentName'),
        assessmentTitle: assessments.title,
        courseTitle: courses.title,
        score: assessmentSubmissions.score,
        totalPoints: assessmentSubmissions.totalPoints,
        percentage: sql<number>`ROUND((CAST(${assessmentSubmissions.score} AS REAL) / CAST(${assessmentSubmissions.totalPoints} AS REAL)) * 100, 1)`.as('percentage'),
        submittedAt: assessmentSubmissions.submittedAt,
        status: assessmentSubmissions.status
      })
      .from(assessmentSubmissions)
      .leftJoin(assessments, eq(assessmentSubmissions.assessmentId, assessments.id))
      .leftJoin(courses, eq(assessments.courseId, courses.id))
      .leftJoin(users, eq(assessmentSubmissions.studentId, users.id))
      .where(and(
        eq(courses.teacherId, teacherId),
        eq(assessmentSubmissions.status, "submitted")
      ))
      .orderBy(desc(assessmentSubmissions.submittedAt))
      .limit(limit);

      return activity || [];
    } catch (error) {
      console.error('Error getting recent activity for teacher:', error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
