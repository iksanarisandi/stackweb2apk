-- Migration: 0005_nullable_url
-- Description: Make url column nullable for HTML View support

-- Since SQLite doesn't support ALTER COLUMN directly,
-- we need to recreate the table

-- 1. Create new table with nullable url
CREATE TABLE generates_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  url TEXT,
  app_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  apk_key TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  enable_gps INTEGER DEFAULT 0,
  enable_camera INTEGER DEFAULT 0,
  build_type TEXT DEFAULT 'webview' CHECK (build_type IN ('webview', 'html')),
  html_files_key TEXT,
  keystore_key TEXT,
  keystore_password TEXT,
  keystore_alias TEXT,
  aab_key TEXT,
  amount INTEGER DEFAULT 35000,
  html_file_count INTEGER DEFAULT 0
);

-- 2. Copy existing data
INSERT INTO generates_new SELECT * FROM generates;

-- 3. Drop old table
DROP TABLE generates;

-- 4. Rename new table
ALTER TABLE generates_new RENAME TO generates;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_generates_user_id ON generates(user_id);
CREATE INDEX IF NOT EXISTS idx_generates_status ON generates(status);
CREATE INDEX IF NOT EXISTS idx_generates_build_type ON generates(build_type);
CREATE INDEX IF NOT EXISTS idx_generates_keystore ON generates(keystore_key);
