import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyJWT } from '../lib/auth';
import type { Env, Variables } from '../index';

/**
 * Auth middleware for protected routes
 * Verifies JWT token and attaches user info to context
 * Validates: Requirements 2.3, 2.4
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  // Get Authorization header
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    throw new HTTPException(401, {
      message: 'Authorization header is required',
    });
  }

  // Check Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: 'Invalid authorization format. Use: Bearer <token>',
    });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  if (!token) {
    throw new HTTPException(401, {
      message: 'Token is required',
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
