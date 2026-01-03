import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler, securityHeaders, generalRateLimit, iconRateLimit } from './middleware';
import { authRoutes, generateRoutes, adminRoutes, webhookRoutes } from './routes';
import { seedAdmin } from './lib/seed-admin';

/**
 * Environment bindings for Cloudflare Workers
 */
export interface Env {
  // D1 Database binding
  DB: D1Database;
  // R2 Storage binding for icons and APKs
  STORAGE: R2Bucket;
  // JWT secret for token signing
  JWT_SECRET: string;
  // Admin credentials for initial setup
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  // GitHub token for triggering Actions
  GITHUB_TOKEN: string;
  // Webhook secret for build callbacks
  WEBHOOK_SECRET: string;
  // Allowed CORS origins (comma-separated), e.g. "https://2apk.de,https://example.com"
  ALLOWED_ORIGINS?: string;
}

/**
 * Custom context variables available in route handlers
 */
export interface Variables {
  userId?: string;
  userRole?: 'user' | 'admin';
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global error handling middleware
app.use('*', errorHandler);

// Security headers middleware
app.use('*', securityHeaders);

// General rate limiting (100 req/min)
app.use('*', generalRateLimit);

// CORS middleware - allow specific origins for API access
// Supports dynamic origins via ALLOWED_ORIGINS environment variable
app.use('*', async (c, next) => {
  // Default origins that are always allowed
  const defaultOrigins = ['https://web2apk-web.pages.dev', 'http://localhost:3000'];

  // Parse additional origins from environment variable (comma-separated)
  const envOrigins = c.env.ALLOWED_ORIGINS
    ? c.env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim()).filter(Boolean)
    : [];

  // Combine all allowed origins (deduplicated)
  const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

  // Apply CORS with dynamic origins
  const corsMiddleware = cors({
    origin: (origin) => {
      // If no origin (same-origin request) or origin is in allowed list
      if (!origin || allowedOrigins.includes(origin)) {
        return origin || allowedOrigins[0];
      }
      return null; // Block other origins
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  });

  return corsMiddleware(c, next);
});

// Health check endpoint
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'web2apk-api' });
});

// API health check
app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Admin seeding endpoint - seeds admin user on first run
// SECURED: Requires ADMIN_PASSWORD as X-Init-Secret header
// Requirement 9.3: Create default admin account from environment variables if not exists
app.post('/api/init', async (c) => {
  // Verify init secret (use ADMIN_PASSWORD as the secret)
  const initSecret = c.req.header('X-Init-Secret');

  if (!initSecret || initSecret !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await seedAdmin({
    db: c.env.DB,
    adminEmail: c.env.ADMIN_EMAIL,
    adminPassword: c.env.ADMIN_PASSWORD,
  });

  return c.json(result);
});

// Mount auth routes
app.route('/api/auth', authRoutes);

// Mount generate routes
app.route('/api/generate', generateRoutes);

// Public icon endpoint for GitHub Actions to download during APK build
// No auth required - accessed by GitHub Actions workflow
// Rate limited to prevent abuse
app.get('/api/icon/:generateId', iconRateLimit, async (c) => {
  const generateId = c.req.param('generateId');

  if (!generateId) {
    return c.json({ error: 'Generate ID is required' }, 400);
  }

  // Get the generate record to find the icon key
  const result = await c.env.DB.prepare(
    `SELECT icon_key FROM generates WHERE id = ?`
  )
    .bind(generateId)
    .first<{ icon_key: string | null }>();

  if (!result || !result.icon_key) {
    return c.json({ error: 'Icon not found' }, 404);
  }

  // Fetch icon from R2
  const iconObject = await c.env.STORAGE.get(result.icon_key);
  if (!iconObject) {
    return c.json({ error: 'Icon file not found in storage' }, 404);
  }

  // Return the icon file
  return new Response(iconObject.body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': iconObject.size.toString(),
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// Mount admin routes
app.route('/api/admin', adminRoutes);

// Mount webhook routes
app.route('/api/webhook', webhookRoutes);

export default app;
