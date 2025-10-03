-- Database migration to add Assignment Submission and Notice Board features
-- Run this SQL script to update your existing database

-- 1. Update assignments table with new fields for file upload support
ALTER TABLE assignments ADD COLUMN allowed_file_types TEXT DEFAULT 'pdf,doc,docx' NOT NULL;
ALTER TABLE assignments ADD COLUMN max_file_size INTEGER DEFAULT 10485760 NOT NULL; -- 10MB in bytes
ALTER TABLE assignments ADD COLUMN instructions TEXT;
ALTER TABLE assignments ADD COLUMN status TEXT DEFAULT 'draft' NOT NULL; -- 'draft', 'published', 'closed'

-- 2. Create assignment_submissions table for file uploads and feedback
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES assignments(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    status TEXT DEFAULT 'submitted' NOT NULL, -- 'submitted', 'graded', 'returned'
    submitted_at INTEGER NOT NULL,
    grade INTEGER, -- Points awarded
    feedback TEXT, -- Faculty feedback
    graded_at INTEGER,
    graded_by TEXT REFERENCES users(id)
);

-- 3. Create notice_board table for enhanced announcements
CREATE TABLE IF NOT EXISTS notice_board (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id),
    course_id TEXT REFERENCES courses(id), -- Optional - for course-specific notices
    priority TEXT DEFAULT 'normal' NOT NULL, -- 'low', 'normal', 'high', 'urgent'
    target_audience TEXT DEFAULT 'all' NOT NULL, -- 'all', 'students', 'teachers', 'course_specific'
    is_active INTEGER DEFAULT 1 NOT NULL,
    expires_at INTEGER, -- Optional expiration timestamp
    attachment_url TEXT, -- Optional file attachment
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_submitted_at ON assignment_submissions(submitted_at);

CREATE INDEX IF NOT EXISTS idx_notice_board_author_id ON notice_board(author_id);
CREATE INDEX IF NOT EXISTS idx_notice_board_course_id ON notice_board(course_id);
CREATE INDEX IF NOT EXISTS idx_notice_board_priority ON notice_board(priority);
CREATE INDEX IF NOT EXISTS idx_notice_board_target_audience ON notice_board(target_audience);
CREATE INDEX IF NOT EXISTS idx_notice_board_is_active ON notice_board(is_active);
CREATE INDEX IF NOT EXISTS idx_notice_board_created_at ON notice_board(created_at);
CREATE INDEX IF NOT EXISTS idx_notice_board_expires_at ON notice_board(expires_at);

-- 5. Create uploads directory structure (this will be handled by the application)
-- The application will create:
-- - uploads/assignments/ for assignment submissions
-- - uploads/notices/ for notice board attachments

-- Migration completed successfully
-- New features added:
-- 1. Assignment Submission System with file upload support
-- 2. Enhanced Feedback System for faculty grading and comments
-- 3. Notice Board Module with priority levels and targeting options