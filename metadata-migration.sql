-- Database migration to add content metadata fields to lessons table
-- Run this SQL script to add comprehensive metadata support

-- Add content metadata fields to lessons table
ALTER TABLE lessons ADD COLUMN file_name TEXT;
ALTER TABLE lessons ADD COLUMN file_size INTEGER;
ALTER TABLE lessons ADD COLUMN mime_type TEXT;

-- Video-specific metadata
ALTER TABLE lessons ADD COLUMN video_width INTEGER;
ALTER TABLE lessons ADD COLUMN video_height INTEGER;
ALTER TABLE lessons ADD COLUMN video_bitrate INTEGER;
ALTER TABLE lessons ADD COLUMN video_codec TEXT;
ALTER TABLE lessons ADD COLUMN audio_codec TEXT;

-- PDF-specific metadata
ALTER TABLE lessons ADD COLUMN pdf_pages INTEGER;
ALTER TABLE lessons ADD COLUMN pdf_version TEXT;

-- Text content metadata
ALTER TABLE lessons ADD COLUMN word_count INTEGER;
ALTER TABLE lessons ADD COLUMN reading_time INTEGER;

-- General file metadata
ALTER TABLE lessons ADD COLUMN uploaded_at INTEGER;
ALTER TABLE lessons ADD COLUMN file_hash TEXT;
ALTER TABLE lessons ADD COLUMN thumbnail_url TEXT;

-- Quiz and additional metadata
ALTER TABLE lessons ADD COLUMN quiz_data TEXT;
ALTER TABLE lessons ADD COLUMN metadata TEXT;

-- These fields are optional, so existing records will have NULL values
-- which is fine for the application