import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["student", "teacher", "admin"]);
export const questionTypeEnum = pgEnum("question_type", ["multiple_choice", "true_false", "short_answer", "fill_blank"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["draft", "published", "closed"]);
export const submissionStatusEnum = pgEnum("submission_status", ["in_progress", "submitted", "graded"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: userRoleEnum("role").notNull().default("student"),
  profileImage: text("profile_image"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  subject: text("subject").notNull(),
  teacherId: varchar("teacher_id").references(() => users.id).notNull(),
  coverImage: text("cover_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const courseEnrollments = pgTable("course_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  studentId: varchar("student_id").references(() => users.id).notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  progress: integer("progress").default(0).notNull(),
});

export const courseMaterials = pgTable("course_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'pdf', 'video', 'document', 'link'
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: assessmentStatusEnum("status").default("draft").notNull(),
  timeLimit: integer("time_limit"), // in minutes
  totalPoints: integer("total_points").default(0).notNull(),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").references(() => assessments.id).notNull(),
  type: questionTypeEnum("type").notNull(),
  questionText: text("question_text").notNull(),
  options: jsonb("options"), // for multiple choice questions
  correctAnswer: text("correct_answer").notNull(),
  points: integer("points").default(1).notNull(),
  order: integer("order").notNull(),
});

export const assessmentSubmissions = pgTable("assessment_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").references(() => assessments.id).notNull(),
  studentId: varchar("student_id").references(() => users.id).notNull(),
  status: submissionStatusEnum("status").default("in_progress").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  score: integer("score"),
  totalPoints: integer("total_points"),
});

export const questionAnswers = pgTable("question_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => assessmentSubmissions.id).notNull(),
  questionId: varchar("question_id").references(() => questions.id).notNull(),
  answer: text("answer").notNull(),
  isCorrect: boolean("is_correct"),
  pointsAwarded: integer("points_awarded").default(0).notNull(),
});

export const discussions = pgTable("discussions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const discussionPosts = pgTable("discussion_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  discussionId: varchar("discussion_id").references(() => discussions.id).notNull(),
  parentId: varchar("parent_id").references(() => discussionPosts.id),
  content: text("content").notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  taughtCourses: many(courses),
  enrollments: many(courseEnrollments),
  submissions: many(assessmentSubmissions),
  discussionPosts: many(discussionPosts),
  announcements: many(announcements),
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
