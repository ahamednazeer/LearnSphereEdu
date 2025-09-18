-- Migration to add metadata fields to lessons table
-- Run this to add the missing metadata columns

-- Add content metadata fields
ALTER TABLE lessons ADD COLUMN file_name TEXT;
ALTER TABLE lessons ADD COLUMN file_size INTEGER;
ALTER TABLE lessons ADD COLUMN mime_type TEXT;
ALTER TABLE lessons ADD COLUMN file_hash TEXT;
ALTER TABLE lessons ADD COLUMN uploaded_at INTEGER;
ALTER TABLE lessons ADD COLUMN duration_seconds INTEGER;

-- Add video-specific metadata
ALTER TABLE lessons ADD COLUMN video_width INTEGER;
ALTER TABLE lessons ADD COLUMN video_height INTEGER;
ALTER TABLE lessons ADD COLUMN video_bitrate INTEGER;
ALTER TABLE lessons ADD COLUMN video_codec TEXT;
ALTER TABLE lessons ADD COLUMN audio_codec TEXT;

-- Add PDF-specific metadata
ALTER TABLE lessons ADD COLUMN pdf_pages INTEGER;
ALTER TABLE lessons ADD COLUMN pdf_version TEXT;

-- Add text content metadata
ALTER TABLE lessons ADD COLUMN word_count INTEGER;
ALTER TABLE lessons ADD COLUMN reading_time INTEGER;

-- Add general fields
ALTER TABLE lessons ADD COLUMN thumbnail_url TEXT;
ALTER TABLE lessons ADD COLUMN quiz TEXT; -- JSON field for quiz data