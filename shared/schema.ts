import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, blob, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("student"), // 'student', 'teacher', 'admin'
  profileImage: text("profile_image"),
  bio: text("bio"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull(),
  subject: text("subject").notNull(),
  teacherId: text("teacher_id").references(() => users.id).notNull(),
  coverImage: text("cover_image"),
  status: text("status").default("draft").notNull(), // 'draft', 'published', 'archived'
  price: integer("price").default(0).notNull(), // Price in cents
  estimatedHours: integer("estimated_hours").default(1).notNull(),
  duration: text("duration"), // Duration as string
  level: text("level"), // 'beginner', 'intermediate', 'advanced'
  language: text("language").default("en").notNull(),
  prerequisites: text("prerequisites"),
  learningObjectives: text("learning_objectives"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const courseEnrollments = sqliteTable("course_enrollments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  studentId: text("student_id").references(() => users.id).notNull(),
  enrolledAt: integer("enrolled_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  progress: integer("progress").default(0).notNull(),
});

export const courseMaterials = sqliteTable("course_materials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'pdf', 'video', 'document', 'link'
  url: text("url").notNull(),
  uploadedAt: integer("uploaded_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("draft").notNull(), // 'draft', 'published', 'closed'
  timeLimit: integer("time_limit"), // in minutes
  totalPoints: integer("total_points").default(0).notNull(),
  dueDate: integer("due_date", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text("assessment_id").references(() => assessments.id).notNull(),
  type: text("type").notNull(), // 'multiple_choice', 'true_false', 'short_answer', 'fill_blank'
  questionText: text("question_text").notNull(),
  options: text("options"), // JSON string for multiple choice questions
  correctAnswer: text("correct_answer").notNull(),
  points: integer("points").default(1).notNull(),
  order: integer("order").notNull(),
});

export const assessmentSubmissions = sqliteTable("assessment_submissions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text("assessment_id").references(() => assessments.id).notNull(),
  studentId: text("student_id").references(() => users.id).notNull(),
  status: text("status").default("in_progress").notNull(), // 'in_progress', 'submitted', 'graded'
  startedAt: integer("started_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  submittedAt: integer("submitted_at", { mode: 'timestamp' }),
  score: integer("score"),
  totalPoints: integer("total_points"),
  feedback: text("feedback"),
});

export const questionAnswers = sqliteTable("question_answers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  submissionId: text("submission_id").references(() => assessmentSubmissions.id).notNull(),
  questionId: text("question_id").references(() => questions.id).notNull(),
  answer: text("answer").notNull(),
  isCorrect: integer("is_correct", { mode: 'boolean' }),
  pointsAwarded: integer("points_awarded").default(0).notNull(),
});

export const discussions = sqliteTable("discussions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdBy: text("created_by").references(() => users.id).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const discussionPosts = sqliteTable("discussion_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  discussionId: text("discussion_id").references(() => discussions.id).notNull(),
  parentId: text("parent_id").references(() => discussionPosts.id),
  content: text("content").notNull(),
  authorId: text("author_id").references(() => users.id).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: text("author_id").references(() => users.id).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const modules = sqliteTable("modules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  moduleId: text("module_id").references(() => modules.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  contentType: text("content_type").notNull().default("text"), // 'text', 'video', 'pdf', 'link'
  contentUrl: text("content_url"),
  duration: text("duration"), // Duration as string (e.g., "10:30")
  order: integer("order").notNull().default(0),
  
  // Content metadata fields
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  fileHash: text("file_hash"),
  uploadedAt: integer("uploaded_at"),
  durationSeconds: integer("duration_seconds"), // Numeric duration for calculations
  
  // Video-specific metadata
  videoWidth: integer("video_width"),
  videoHeight: integer("video_height"),
  videoBitrate: integer("video_bitrate"),
  videoCodec: text("video_codec"),
  audioCodec: text("audio_codec"),
  
  // PDF-specific metadata
  pdfPages: integer("pdf_pages"),
  pdfVersion: text("pdf_version"),
  
  // Text content metadata
  wordCount: integer("word_count"),
  readingTime: integer("reading_time"), // in seconds
  
  // General
  thumbnailUrl: text("thumbnail_url"),
  quiz: text("quiz", { mode: 'json' }), // Store quiz as JSON
  
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const lessonProgress = sqliteTable("lesson_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id).notNull(),
  courseId: text("course_id").references(() => courses.id).notNull(),
  lessonId: text("lesson_id").references(() => lessons.id).notNull(),
  completedAt: integer("completed_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  studentId: text("student_id").references(() => users.id).notNull(),
  issuedAt: integer("issued_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  certificateUrl: text("certificate_url"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const assignments = sqliteTable("assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  courseId: text("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: integer("due_date", { mode: 'timestamp' }),
  maxPoints: integer("max_points").default(100).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  taughtCourses: many(courses),
  enrollments: many(courseEnrollments),
  submissions: many(assessmentSubmissions),
  discussionPosts: many(discussionPosts),
  announcements: many(announcements),
  lessonProgress: many(lessonProgress),
  certificates: many(certificates),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  teacher: one(users, {
    fields: [courses.teacherId],
    references: [users.id],
  }),
  enrollments: many(courseEnrollments),
  materials: many(courseMaterials),
  assessments: many(assessments),
  discussions: many(discussions),
  announcements: many(announcements),
  modules: many(modules),
  certificates: many(certificates),
  assignments: many(assignments),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, {
    fields: [modules.courseId],
    references: [courses.id],
  }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  module: one(modules, {
    fields: [lessons.moduleId],
    references: [modules.id],
  }),
  progress: many(lessonProgress),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, {
    fields: [lessonProgress.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [lessonProgress.courseId],
    references: [courses.id],
  }),
  lesson: one(lessons, {
    fields: [lessonProgress.lessonId],
    references: [lessons.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  course: one(courses, {
    fields: [certificates.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [certificates.studentId],
    references: [users.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  course: one(courses, {
    fields: [assignments.courseId],
    references: [courses.id],
  }),
}));

export const courseEnrollmentsRelations = relations(courseEnrollments, ({ one }) => ({
  course: one(courses, {
    fields: [courseEnrollments.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [courseEnrollments.studentId],
    references: [users.id],
  }),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  course: one(courses, {
    fields: [assessments.courseId],
    references: [courses.id],
  }),
  questions: many(questions),
  submissions: many(assessmentSubmissions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  assessment: one(assessments, {
    fields: [questions.assessmentId],
    references: [assessments.id],
  }),
  answers: many(questionAnswers),
}));

export const assessmentSubmissionsRelations = relations(assessmentSubmissions, ({ one, many }) => ({
  assessment: one(assessments, {
    fields: [assessmentSubmissions.assessmentId],
    references: [assessments.id],
  }),
  student: one(users, {
    fields: [assessmentSubmissions.studentId],
    references: [users.id],
  }),
  answers: many(questionAnswers),
}));

export const discussionsRelations = relations(discussions, ({ one, many }) => ({
  course: one(courses, {
    fields: [discussions.courseId],
    references: [courses.id],
  }),
  creator: one(users, {
    fields: [discussions.createdBy],
    references: [users.id],
  }),
  posts: many(discussionPosts),
}));

export const discussionPostsRelations = relations(discussionPosts, ({ one }) => ({
  discussion: one(discussions, {
    fields: [discussionPosts.discussionId],
    references: [discussions.id],
  }),
  author: one(users, {
    fields: [discussionPosts.authorId],
    references: [users.id],
  }),
  parent: one(discussionPosts, {
    fields: [discussionPosts.parentId],
    references: [discussionPosts.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
});

export const insertDiscussionSchema = createInsertSchema(discussions).omit({
  id: true,
  createdAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});

export const createInsertModuleSchema = createInsertSchema(modules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createInsertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  createdAt: true,
});

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Enhanced course schema with additional fields
export const enhancedInsertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;
export type CourseMaterial = typeof courseMaterials.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;
export type AssessmentSubmission = typeof assessmentSubmissions.$inferSelect;
export type QuestionAnswer = typeof questionAnswers.$inferSelect;
export type InsertDiscussion = z.infer<typeof insertDiscussionSchema>;
export type Discussion = typeof discussions.$inferSelect;
export type DiscussionPost = typeof discussionPosts.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertModule = z.infer<typeof createInsertModuleSchema>;
export type Module = typeof modules.$inferSelect;
export type InsertLesson = z.infer<typeof createInsertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificates.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignments.$inferSelect;
export type EnhancedInsertCourse = z.infer<typeof enhancedInsertCourseSchema>;
