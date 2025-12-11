-- Migration: 0001_initial_schema
-- Description: Create initial database schema for Web2APK
-- Tables: users, generates, payments

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Generates table
CREATE TABLE IF NOT EXISTS generates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  app_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  apk_key TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'building', 'ready', 'failed')),
  error_message TEXT,
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  generate_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 35000,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (generate_id) REFERENCES generates(id),
  FOREIGN KEY (confirmed_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_generates_user_id ON generates(user_id);
CREATE INDEX IF NOT EXISTS idx_generates_status ON generates(status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_generate_id ON payments(generate_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
