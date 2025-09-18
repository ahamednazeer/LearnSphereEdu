-- Add feedback column to assessment_submissions table
-- This migration adds the missing feedback column that is referenced in the code

ALTER TABLE assessment_submissions ADD COLUMN feedback TEXT;