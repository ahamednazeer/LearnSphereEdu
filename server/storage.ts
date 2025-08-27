import { 
  users, courses, courseEnrollments, courseMaterials, assessments, questions, 
  assessmentSubmissions, questionAnswers, discussions, discussionPosts, announcements,
  type User, type InsertUser, type Course, type InsertCourse, type Assessment, 
  type InsertAssessment, type Question, type InsertQuestion, type Discussion,
  type InsertDiscussion, type Announcement, type InsertAnnouncement, type CourseEnrollment,
  type AssessmentSubmission, type DiscussionPost
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, avg } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Course methods
  getCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  getCoursesByTeacher(teacherId: string): Promise<Course[]>;
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
  getAssessmentQuestions(assessmentId: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  
  // Submission methods
  createSubmission(assessmentId: string, studentId: string): Promise<AssessmentSubmission>;
  getSubmission(assessmentId: string, studentId: string): Promise<AssessmentSubmission | undefined>;
  submitAssessment(submissionId: string): Promise<AssessmentSubmission | undefined>;
  
  // Discussion methods
  getDiscussions(courseId: string): Promise<Discussion[]>;
  createDiscussion(discussion: InsertDiscussion): Promise<Discussion>;
  getDiscussionPosts(discussionId: string): Promise<DiscussionPost[]>;
  
  // Announcement methods
  getAnnouncements(courseId: string): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
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

  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(desc(courses.createdAt));
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async getCoursesByTeacher(teacherId: string): Promise<Course[]> {
    return await db.select().from(courses)
      .where(eq(courses.teacherId, teacherId))
      .orderBy(desc(courses.createdAt));
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

  async submitAssessment(submissionId: string): Promise<AssessmentSubmission | undefined> {
    const [submission] = await db.update(assessmentSubmissions)
      .set({ 
        status: "submitted", 
        submittedAt: new Date() 
      })
      .where(eq(assessmentSubmissions.id, submissionId))
      .returning();
    return submission || undefined;
  }

  async getDiscussions(courseId: string): Promise<Discussion[]> {
    return await db.select().from(discussions)
      .where(eq(discussions.courseId, courseId))
      .orderBy(desc(discussions.createdAt));
  }

  async createDiscussion(discussion: InsertDiscussion): Promise<Discussion> {
    const [newDiscussion] = await db.insert(discussions).values(discussion).returning();
    return newDiscussion;
  }

  async getDiscussionPosts(discussionId: string): Promise<DiscussionPost[]> {
    return await db.select().from(discussionPosts)
      .where(eq(discussionPosts.discussionId, discussionId))
      .orderBy(asc(discussionPosts.createdAt));
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
}

export const storage = new DatabaseStorage();
