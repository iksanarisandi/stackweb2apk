-- Migration: Add rate_limits table for API rate limiting
-- Security: Prevents abuse and spam

CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL
);

-- Index for cleanup of expired records
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Add last_generate_at column to users for additional generate rate limiting
ALTER TABLE users ADD COLUMN last_generate_at TEXT;
