# Web2APK API Deployment Guide

This guide explains how to deploy the Web2APK API to Cloudflare Workers.

## Prerequisites

1. [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
3. Authenticated with Cloudflare: `wrangler login`

## Step 1: Create D1 Database

```bash
# Create the database
wrangler d1 create web2apk-db

# Note the database_id from the output and update wrangler.toml
```

Update `wrangler.toml` with the actual database ID:
```toml
[[d1_databases]]
database_id = "YOUR_ACTUAL_DATABASE_ID"
```

### Run Migrations

```bash
# Apply migrations to local database (for development)
wrangler d1 migrations apply web2apk-db --local

# Apply migrations to remote database (for production)
wrangler d1 migrations apply web2apk-db --remote
```

## Step 2: Create R2 Bucket

```bash
# Create the storage bucket
wrangler r2 bucket create web2apk-storage
```

## Step 3: Configure Secrets

Set the required secrets using Wrangler CLI:

```bash
# JWT secret for token signing (generate a strong random string)
wrangler secret put JWT_SECRET

# Admin credentials for initial setup
wrangler secret put ADMIN_EMAIL
wrangler secret put ADMIN_PASSWORD

# GitHub Personal Access Token for triggering Actions
# Required scopes: repo (for repository_dispatch)
wrangler secret put GITHUB_TOKEN

# Webhook secret for build callback verification
# Generate a strong random string
wrangler secret put WEBHOOK_SECRET
```

### Generating Secure Secrets

```bash
# Generate a secure random string (Linux/macOS)
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Deploy

```bash
# Deploy to development (default)
wrangler deploy

# Deploy to production
wrangler deploy --env production

# Deploy to staging
wrangler deploy --env staging
```

## Step 5: Initialize Admin User

After deployment, call the init endpoint to create the admin user:

```bash
curl https://your-worker-url.workers.dev/api/init
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT token signing | Yes |
| `ADMIN_EMAIL` | Default admin account email | Yes |
| `ADMIN_PASSWORD` | Default admin account password | Yes |
| `GITHUB_TOKEN` | GitHub PAT for triggering Actions | Yes |
| `WEBHOOK_SECRET` | Secret for build callback verification | Yes |

## Bindings Reference

| Binding | Type | Description |
|---------|------|-------------|
| `DB` | D1 Database | SQLite database for users, generates, payments |
| `STORAGE` | R2 Bucket | Object storage for icons and APK files |

## GitHub Actions Setup

The APK build pipeline runs on GitHub Actions. You must configure repository secrets for the build workflow to function.

See [.github/workflows/README.md](../../.github/workflows/README.md) for detailed setup instructions.

### Required GitHub Repository Secrets

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Base64-encoded Android keystore |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias in keystore |
| `KEY_PASSWORD` | Key password |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_ENDPOINT` | R2 endpoint URL |
| `R2_BUCKET` | R2 bucket name |
| `WEBHOOK_SECRET` | Must match Workers secret |

### Important

The `WEBHOOK_SECRET` must be identical in both:
1. GitHub repository secrets (for callback authentication)
2. Cloudflare Workers secrets (for webhook verification)

## Production Checklist

- [ ] Create production D1 database
- [ ] Create production R2 bucket
- [ ] Update `wrangler.toml` with production database IDs
- [ ] Set all secrets for production environment
- [ ] Run migrations on production database
- [ ] Deploy to production
- [ ] Initialize admin user
- [ ] Configure GitHub repository secrets (see above)
- [ ] Test API endpoints
- [ ] Test APK build pipeline end-to-end

## Troubleshooting

### Database not found
Ensure the `database_id` in `wrangler.toml` matches the actual D1 database ID.

### R2 bucket not found
Ensure the `bucket_name` in `wrangler.toml` matches the actual R2 bucket name.

### Secrets not working
Secrets are environment-specific. Make sure to set secrets for each environment:
```bash
wrangler secret put JWT_SECRET --env production
```

### CORS issues
The API is configured to allow all origins. If you need to restrict origins, update the CORS middleware in `src/index.ts`.
