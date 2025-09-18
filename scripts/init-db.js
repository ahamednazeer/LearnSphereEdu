#!/usr/bin/env node

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// Parse DATABASE_URL to handle file:// URLs
function parseDatabaseUrl(url) {
  if (url.startsWith('file:')) {
    return url.replace('file:', '');
  }
  return url;
}

const dbFile = parseDatabaseUrl(process.env.DATABASE_URL || './db.sqlite');

console.log(`[INFO] Initializing database schema at: ${dbFile}`);

// Ensure the directory exists
const dbDir = dirname(dbFile);
try {
  mkdirSync(dbDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore error
}

try {
  const sqlite = new Database(dbFile);

  // Create all tables by running the schema SQL
  // This is a simple approach - we'll create the tables manually
  
  const createTablesSQL = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      profile_image TEXT,
      bio TEXT,
      created_at INTEGER NOT NULL
    );

    -- Courses table
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'technology',
      level TEXT NOT NULL DEFAULT 'beginner',
      teacher_id TEXT NOT NULL,
      cover_image TEXT,
      objectives TEXT,
      target_audience TEXT,
      duration TEXT,
      estimated_hours INTEGER,
      prerequisites TEXT,
      tags TEXT,
      language TEXT DEFAULT 'en',
      status TEXT DEFAULT 'draft',
      published_at INTEGER,
      price INTEGER DEFAULT 0,
      enrollment_count INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Modules table
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      sequence_order INTEGER NOT NULL
    );

    -- Lessons table
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_type TEXT NOT NULL,
      url TEXT,
      content TEXT,
      description TEXT,
      sequence_order INTEGER NOT NULL,
      duration INTEGER,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      video_width INTEGER,
      video_height INTEGER,
      video_bitrate INTEGER,
      video_codec TEXT,
      audio_codec TEXT,
      pdf_pages INTEGER,
      pdf_version TEXT,
      word_count INTEGER,
      reading_time INTEGER,
      uploaded_at INTEGER,
      file_hash TEXT,
      thumbnail_url TEXT,
      quiz_data TEXT,
      metadata TEXT
    );

    -- Course enrollments table
    CREATE TABLE IF NOT EXISTS course_enrollments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      enrolled_at INTEGER NOT NULL,
      progress INTEGER DEFAULT 0 NOT NULL
    );

    -- Lesson progress table
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      completed_at INTEGER NOT NULL
    );

    -- Course materials table
    CREATE TABLE IF NOT EXISTS course_materials (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL
    );

    -- Assessments table
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft' NOT NULL,
      time_limit INTEGER,
      total_points INTEGER DEFAULT 0 NOT NULL,
      due_date INTEGER,
      created_at INTEGER NOT NULL
    );

    -- Questions table
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT NOT NULL,
      points INTEGER DEFAULT 1 NOT NULL,
      "order" INTEGER NOT NULL
    );

    -- Assessment submissions table
    CREATE TABLE IF NOT EXISTS assessment_submissions (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress' NOT NULL,
      started_at INTEGER NOT NULL,
      submitted_at INTEGER,
      score INTEGER,
      total_points INTEGER
    );

    -- Question answers table
    CREATE TABLE IF NOT EXISTS question_answers (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_correct INTEGER,
      points_awarded INTEGER DEFAULT 0 NOT NULL
    );

    -- Discussions table
    CREATE TABLE IF NOT EXISTS discussions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Discussion posts table
    CREATE TABLE IF NOT EXISTS discussion_posts (
      id TEXT PRIMARY KEY,
      discussion_id TEXT NOT NULL,
      parent_id TEXT,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Announcements table
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Certificates table
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'completion',
      title TEXT NOT NULL,
      description TEXT,
      requirements TEXT,
      template TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    -- Student certificates table
    CREATE TABLE IF NOT EXISTS student_certificates (
      id TEXT PRIMARY KEY,
      certificate_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      verification_code TEXT NOT NULL,
      grade INTEGER
    );

    -- Assignments table
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      module_id TEXT,
      lesson_id TEXT,
      type TEXT NOT NULL DEFAULT 'quiz',
      title TEXT NOT NULL,
      description TEXT,
      instructions TEXT,
      max_score INTEGER DEFAULT 100,
      time_limit INTEGER,
      attempts INTEGER DEFAULT 1,
      due_date INTEGER,
      is_peer_review INTEGER DEFAULT 0,
      peer_review_count INTEGER DEFAULT 3,
      rubric TEXT,
      status TEXT DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Assignment submissions table
    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      content TEXT,
      file_url TEXT,
      submitted_at INTEGER NOT NULL,
      score INTEGER,
      feedback TEXT,
      status TEXT DEFAULT 'submitted',
      attempt INTEGER DEFAULT 1
    );

    -- Peer reviews table
    CREATE TABLE IF NOT EXISTS peer_reviews (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      score INTEGER,
      feedback TEXT,
      rubric_scores TEXT,
      submitted_at INTEGER NOT NULL,
      is_complete INTEGER DEFAULT 0
    );

    -- Course reviews table
    CREATE TABLE IF NOT EXISTS course_reviews (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review TEXT,
      is_recommended INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `;

  // Execute the SQL to create tables
  sqlite.exec(createTablesSQL);
  
  console.log('[INFO] Database schema initialized successfully');
  
  sqlite.close();
} catch (error) {
  console.error('[ERROR] Failed to initialize database schema:', error);
  process.exit(1);
}