import { Context, Next } from 'hono';
import type { Env, Variables } from '../index';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Prefix for rate limit key
}

/**
 * Rate limit store using D1 database
 * Stores: key, count, expires_at
 */
async function getRateLimitCount(
  db: D1Database,
  key: string,
  windowMs: number
): Promise<{ count: number; resetAt: number }> {
  const now = Date.now();
  const resetAt = now + windowMs;

  // Get current rate limit record
  const record = await db
    .prepare('SELECT count, expires_at FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; expires_at: number }>();

  if (!record || record.expires_at < now) {
    // No record or expired - create new
    await db
      .prepare(
        'INSERT OR REPLACE INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)'
      )
      .bind(key, resetAt)
      .run();
    return { count: 1, resetAt };
  }

  // Increment count
  const newCount = record.count + 1;
  await db
    .prepare('UPDATE rate_limits SET count = ? WHERE key = ?')
    .bind(newCount, key)
    .run();

  return { count: newCount, resetAt: record.expires_at };
}

/**
 * Generic rate limiter middleware factory
 */
export function rateLimiter(config: RateLimitConfig) {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    // Get client identifier (IP or user ID)
    const clientIp = c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0] ||
      'unknown';
    const userId = c.get('userId');

    // Use user ID if authenticated, otherwise IP
    const identifier = userId || clientIp;
    const key = `${config.keyPrefix}:${identifier}`;

    try {
      const { count, resetAt } = await getRateLimitCount(
        c.env.DB,
        key,
        config.windowMs
      );

      // Set rate limit headers
      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count).toString());
      c.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());

      if (count > config.maxRequests) {
        return c.json(
          {
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
            retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
          },
          429
        );
      }
    } catch (error) {
      // If rate limiting fails, allow request but log error
      console.error('Rate limit error:', error);
    }

    await next();
  };
}

/**
 * Pre-configured rate limiters for different endpoints
 */

// General API rate limit: 100 requests per minute
export const generalRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'rl:general',
});

// Auth rate limit: 10 attempts per 15 minutes (prevent brute force)
export const authRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  keyPrefix: 'rl:auth',
});

// Registration rate limit: 3 registrations per hour per IP
export const registrationRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyPrefix: 'rl:register',
});

// Generate APK rate limit: 5 per hour per user
// Combined with Turnstile CAPTCHA and payment requirement for abuse prevention
export const generateRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  keyPrefix: 'rl:generate',
});

// Generate APK rate limit by IP: 10 per hour per IP
// Additional layer to prevent abuse from multiple accounts on same IP
export const generateIpRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyPrefix: 'rl:generate:ip',
});

// Icon download rate limit: 30 per minute (prevent abuse)
export const iconRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  keyPrefix: 'rl:icon',
});

// Admin rate limit: 50 requests per minute
export const adminRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50,
  keyPrefix: 'rl:admin',
});

// Webhook rate limit: 20 requests per minute (from GitHub Actions)
export const webhookRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  keyPrefix: 'rl:webhook',
});

// Download rate limit: 20 downloads per minute per user
export const downloadRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  keyPrefix: 'rl:download',
});
