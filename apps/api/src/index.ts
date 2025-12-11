import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware';
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

// CORS middleware - allow specific origins for API access
app.use(
  '*',
  cors({
    origin: ['https://web2apk-web.pages.dev', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
);

// Health check endpoint
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'web2apk-api' });
});

// API health check
app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Admin seeding endpoint - seeds admin user on first run
// Requirement 9.3: Create default admin account from environment variables if not exists
app.get('/api/init', async (c) => {
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
app.get('/api/icon/:generateId', async (c) => {
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
