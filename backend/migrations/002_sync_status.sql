-- Sync Status Tracking
-- Created: 2024-02-24

-- Add sync status columns to hotel_review_sources
ALTER TABLE hotel_review_sources 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(20) DEFAULT 'pending', -- 'success', 'failed', 'pending'
ADD COLUMN IF NOT EXISTS sync_error_message TEXT,
ADD COLUMN IF NOT EXISTS sync_error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMP;

-- Sync jobs log table for audit trail
CREATE TABLE IF NOT EXISTS review_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'bulk'
  status VARCHAR(20) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  hotels_total INTEGER DEFAULT 0,
  hotels_success INTEGER DEFAULT 0,
  hotels_failed INTEGER DEFAULT 0,
  triggered_by VARCHAR(255), -- user_id or 'cron'
  error_message TEXT,
  details JSONB -- additional job details
);

-- Sync errors log for debugging
CREATE TABLE IF NOT EXISTS review_sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES review_sync_jobs(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  error_type VARCHAR(100),
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS review_sync_jobs_status_idx ON review_sync_jobs(status);
CREATE INDEX IF NOT EXISTS review_sync_jobs_started_idx ON review_sync_jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS review_sync_errors_job_idx ON review_sync_errors(job_id);
CREATE INDEX IF NOT EXISTS review_sync_errors_hotel_idx ON review_sync_errors(hotel_id);
CREATE INDEX IF NOT EXISTS hotel_review_sources_next_sync_idx ON hotel_review_sources(next_sync_at);
