# Web2APK Frontend Deployment Guide

This guide explains how to deploy the Web2APK frontend to Cloudflare Pages.

## Prerequisites

1. [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
3. Authenticated with Cloudflare: `wrangler login`
4. Node.js 18+ and pnpm installed

## Build Commands

```bash
# Install dependencies (from workspace root)
pnpm install

# Build for Cloudflare Pages
pnpm --filter @web2apk/web build:cf

# Preview locally
pnpm --filter @web2apk/web preview

# Deploy to Cloudflare Pages
pnpm --filter @web2apk/web deploy
```

## Cloudflare Pages Setup

### Option 1: Connect to Git Repository (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Click "Create a project" → "Connect to Git"
3. Select your repository
4. Configure build settings:
   - **Framework preset**: None
   - **Build command**: `pnpm install && pnpm --filter @web2apk/web build:cf`
   - **Build output directory**: `apps/web/.vercel/output/static`
   - **Root directory**: `/` (workspace root)

### Option 2: Direct Upload

```bash
# Build the project
cd apps/web
pnpm run build:cf

# Deploy using Wrangler
wrangler pages deploy .vercel/output/static --project-name=web2apk-web
```

## Environment Variables

Set these in Cloudflare Pages dashboard under Settings → Environment variables:

### Production Environment

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api.web2apk.com` | Production API URL |
| `NEXT_PUBLIC_ENVIRONMENT` | `production` | Environment identifier |

### Preview Environment

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://web2apk-api-staging.workers.dev` | Staging API URL |
| `NEXT_PUBLIC_ENVIRONMENT` | `preview` | Environment identifier |

## Custom Domain Setup

1. Go to Cloudflare Pages → Your project → Custom domains
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `web2apk.com`)
4. Follow DNS configuration instructions

## Build Configuration Reference

### package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:cf": "npx @cloudflare/next-on-pages",
    "preview": "npx wrangler pages dev .vercel/output/static",
    "deploy": "npx wrangler pages deploy .vercel/output/static"
  }
}
```

### wrangler.toml Settings

```toml
name = "web2apk-web"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"
```

## Production Checklist

- [ ] Set up Cloudflare Pages project
- [ ] Configure environment variables for production
- [ ] Configure environment variables for preview
- [ ] Set up custom domain (optional)
- [ ] Configure SSL/TLS settings
- [ ] Test production deployment
- [ ] Verify API connectivity

## Troubleshooting

### Build fails with "Module not found"

Ensure all dependencies are installed:
```bash
pnpm install
```

### API requests fail with CORS errors

Verify the `NEXT_PUBLIC_API_URL` environment variable is set correctly and the API has CORS configured.

### Images not loading

The frontend uses `images.unoptimized: true` in `next.config.js` for Cloudflare compatibility. Ensure images are in the `public` directory.

### Edge runtime errors

Some Next.js features may not be compatible with Cloudflare Pages. Check the [@cloudflare/next-on-pages documentation](https://github.com/cloudflare/next-on-pages) for compatibility information.

## Local Development

```bash
# Start the development server
pnpm --filter @web2apk/web dev

# The frontend will be available at http://localhost:3000
# Make sure the API is running at http://localhost:8787
```

## CI/CD Integration

For GitHub Actions, add these secrets:
- `CLOUDFLARE_API_TOKEN` - API token with Pages edit permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

Example workflow:
```yaml
- name: Deploy to Cloudflare Pages
  uses: cloudflare/pages-action@v1
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    projectName: web2apk-web
    directory: apps/web/.vercel/output/static
```
