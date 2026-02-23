-- Migration: 0006_version_tracking
-- Description: Add version tracking for APK builds

-- Add version_code column (integer, auto-incremented on rebuild)
ALTER TABLE generates ADD COLUMN version_code INTEGER DEFAULT 1;

-- Add version_name column (string, e.g., "1.0.0")
ALTER TABLE generates ADD COLUMN version_name TEXT DEFAULT '1.0.0';

-- Add index for version tracking
CREATE INDEX IF NOT EXISTS idx_generates_version_code ON generates(version_code);
