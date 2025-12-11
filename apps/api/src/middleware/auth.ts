import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyJWT } from '../lib/auth';
import type { Env, Variables } from '../index';

/**
 * Parse cookies from Cookie header
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
}

/**
 * Auth middleware for protected routes
 * Verifies JWT token from Authorization header OR httpOnly cookie
 * Validates: Requirements 2.3, 2.4
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  let token: string | null = null;

  // Try Authorization header first
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback to httpOnly cookie if no header
  if (!token) {
    const cookies = parseCookies(c.req.header('Cookie'));
    token = cookies['web2apk_token'] || null;
  }

  if (!token) {
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }

  // Verify JWT token
  const payload = await verifyJWT(token, c.env.JWT_SECRET);

  if (!payload) {
    // Token is invalid or expired (Requirement 2.4)
    throw new HTTPException(401, {
      message: 'Invalid or expired token',
    });
  }

  // Attach user info to context (Requirement 2.3)
  c.set('userId', payload.user_id);
  c.set('userRole', payload.role as 'user' | 'admin');

  await next();
});
