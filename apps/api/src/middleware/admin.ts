import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Env, Variables } from '../index';

/**
 * Admin middleware for admin-only routes
 * Checks user role from JWT and returns 403 for non-admin users
 * Validates: Requirements 9.1, 9.2
 *
 * IMPORTANT: This middleware must be used AFTER authMiddleware
 * as it relies on userRole being set in context
 */
export const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const userRole = c.get('userRole');

  // Check if user role is available (authMiddleware should have set this)
  if (!userRole) {
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }

  // Requirement 9.1: Reject non-admin users with 403 Forbidden
  if (userRole !== 'admin') {
    throw new HTTPException(403, {
      message: 'Admin access required',
    });
  }

  // Requirement 9.2: Allow admin users to proceed
  await next();
});
