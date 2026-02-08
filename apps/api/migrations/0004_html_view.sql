-- Migration: 0004_html_view
-- Description: Add HTML View feature support

-- 1. Add build_type column (webview = URL-based, html = HTML file upload)
ALTER TABLE generates ADD COLUMN build_type TEXT DEFAULT 'webview' CHECK (build_type IN ('webview', 'html'));

-- 2. Add html_files_key column for ZIP file storage in R2
ALTER TABLE generates ADD COLUMN html_files_key TEXT;

-- 3. Add keystore management columns (for HTML builds)
ALTER TABLE generates ADD COLUMN keystore_key TEXT;
ALTER TABLE generates ADD COLUMN keystore_password TEXT;
ALTER TABLE generates ADD COLUMN keystore_alias TEXT;

-- 4. Add AAB file key (Play Store bundle)
ALTER TABLE generates ADD COLUMN aab_key TEXT;

-- 5. Add amount column to generates table (for flexible pricing)
ALTER TABLE generates ADD COLUMN amount INTEGER DEFAULT 35000;

-- 6. Add html_file_count for tracking
ALTER TABLE generates ADD COLUMN html_file_count INTEGER DEFAULT 0;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_generates_build_type ON generates(build_type);
CREATE INDEX IF NOT EXISTS idx_generates_keystore ON generates(keystore_key);
