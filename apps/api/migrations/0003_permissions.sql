-- Migration: 0003_permissions
-- Description: Add permission columns for GPS and Camera to generates table
-- Requirements: 3.7, 3.8, 11.7

-- Add enable_gps column to generates table
ALTER TABLE generates ADD COLUMN enable_gps INTEGER DEFAULT 0;

-- Add enable_camera column to generates table
ALTER TABLE generates ADD COLUMN enable_camera INTEGER DEFAULT 0;
