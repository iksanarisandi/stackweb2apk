import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler, securityHeaders, generalRateLimit, iconRateLimit, initRateLimit, healthRateLimit } from './middleware';
import { authRoutes, generateRoutes, adminRoutes, webhookRoutes, telegramRoutes } from './routes';
import { seedAdmin } from './lib/seed-admin';

export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  GITHUB_TOKEN: string;
  WEBHOOK_SECRET: string;
  ALLOWED_ORIGINS?: string;
  TURNSTILE_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_ID: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

export interface Variables {
  userId?: string;
  userRole?: 'user' | 'admin';
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', errorHandler);

app.use('*', securityHeaders);

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

// Health check endpoint - rate limited
app.get('/', healthRateLimit, (c) => {
  return c.json({ status: 'ok', service: 'web2apk-api' });
});

app.get('/api/health', healthRateLimit, (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Admin seeding endpoint - seeds admin user on first run
// SECURED: Requires ADMIN_PASSWORD as X-Init-Secret header
// Rate limited: 3 per hour per IP (prevent brute force)
// Requirement 9.3: Create default admin account from environment variables if not exists
app.post('/api/init', initRateLimit, async (c) => {
  // Verify init secret (use ADMIN_PASSWORD as the secret)
  const initSecret = c.req.header('X-Init-Secret');

  if (!initSecret || initSecret !== c.env.ADMIN_PASSWORD) {
    // Use constant-time comparison to prevent timing attacks
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await seedAdmin({
    db: c.env.DB,
    adminEmail: c.env.ADMIN_EMAIL,
    adminPassword: c.env.ADMIN_PASSWORD,
  });

  return c.json(result);
});

app.route('/api/auth', authRoutes);

app.route('/api/generate', generateRoutes);

app.get('/api/icon/:generateId', iconRateLimit, async (c) => {
  const generateId = c.req.param('generateId');

  if (!generateId) {
    return c.json({ error: 'Generate ID is required' }, 400);
  }

  const uuidRegex = /^[0-9a-f]{32}$/i;
  if (!uuidRegex.test(generateId)) {
    return c.json({ error: 'Invalid generate ID format' }, 400);
  }

  const result = await c.env.DB.prepare(
    `SELECT icon_key, status FROM generates WHERE id = ?`
  )
    .bind(generateId)
    .first<{ icon_key: string | null; status: string }>();

  if (!result || !result.icon_key) {
    return c.json({ error: 'Icon not found' }, 404);
  }

  if (result.status !== 'building') {
    return c.json({ error: 'Icon access not allowed' }, 403);
  }

  const iconObject = await c.env.STORAGE.get(result.icon_key);
  if (!iconObject) {
    return c.json({ error: 'Icon file not found in storage' }, 404);
  }

  return new Response(iconObject.body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': iconObject.size.toString(),
      'Cache-Control': 'private, no-store', // Don't cache - security sensitive
    },
  });
});

// HTML files endpoint for GitHub Actions
app.get('/api/html-files/:generateId', iconRateLimit, async (c) => {
  const generateId = c.req.param('generateId');

  if (!generateId) {
    return c.json({ error: 'Generate ID is required' }, 400);
  }

  const uuidRegex = /^[0-9a-f]{32}$/i;
  if (!uuidRegex.test(generateId)) {
    return c.json({ error: 'Invalid generate ID format' }, 400);
  }

  const result = await c.env.DB.prepare(
    `SELECT html_files_key, status, build_type FROM generates WHERE id = ?`
  )
    .bind(generateId)
    .first<{ html_files_key: string | null; status: string; build_type: string }>();

  if (!result || !result.html_files_key) {
    return c.json({ error: 'HTML files not found' }, 404);
  }

  if (result.status !== 'building') {
    return c.json({ error: 'HTML files access not allowed' }, 403);
  }

  if (result.build_type !== 'html') {
    return c.json({ error: 'HTML files only available for HTML View builds' }, 400);
  }

  const htmlFilesObject = await c.env.STORAGE.get(result.html_files_key);
  if (!htmlFilesObject) {
    return c.json({ error: 'HTML files not found in storage' }, 404);
  }

  return new Response(htmlFilesObject.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': htmlFilesObject.size.toString(),
      'Cache-Control': 'private, no-store',
    },
  });
});

app.route('/api/admin', adminRoutes);

app.route('/api/webhook', webhookRoutes);

app.route('/api/telegram', telegramRoutes);

export default app;
