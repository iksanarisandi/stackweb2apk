# Database Migrations

This directory contains SQL migrations for the Web2APK D1 database.

## Migration Files

- `0001_initial_schema.sql` - Initial database schema with users, generates, and payments tables

## Running Migrations

### Local Development

```bash
# Apply migrations to local D1 database
pnpm db:migrate:local
```

### Production

```bash
# Apply migrations to remote D1 database
pnpm db:migrate:remote
```

## Schema Overview

### Tables

1. **users** - User accounts with authentication data
   - `id` - UUID primary key
   - `email` - Unique email address
   - `password_hash` - bcrypt hashed password
   - `role` - 'user' or 'admin'
   - `created_at` - Timestamp

2. **generates** - APK generation requests
   - `id` - UUID primary key
   - `user_id` - Foreign key to users
   - `url` - Website URL to convert
   - `app_name` - Android app name
   - `package_name` - Android package name (com.domain.name)
   - `icon_key` - R2 storage key for icon
   - `apk_key` - R2 storage key for generated APK
   - `status` - pending/confirmed/building/ready/failed
   - `error_message` - Error details if failed
   - `download_count` - Number of downloads
   - `created_at` - Timestamp
   - `completed_at` - Completion timestamp

3. **payments** - Payment records
   - `id` - UUID primary key
   - `user_id` - Foreign key to users
   - `generate_id` - Foreign key to generates
   - `amount` - Payment amount (default: 35000)
   - `status` - pending/confirmed/rejected
   - `confirmed_by` - Admin user who confirmed
   - `created_at` - Timestamp
   - `confirmed_at` - Confirmation timestamp

### Indexes

- `idx_users_email` - Fast email lookups
- `idx_generates_user_id` - User's generates lookup
- `idx_generates_status` - Status filtering
- `idx_payments_status` - Pending payments lookup
- `idx_payments_generate_id` - Payment by generate lookup
- `idx_payments_user_id` - User's payments lookup
