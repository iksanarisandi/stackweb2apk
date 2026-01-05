import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { registerSchema, loginSchema } from '@web2apk/shared';
import { hashPassword, verifyPassword, generateJWT, generateId } from '../lib/auth';
import { authMiddleware, authRateLimit, registrationRateLimit, turnstileMiddleware } from '../middleware';
import type { Env, Variables } from '../index';
import type { ZodIssue } from 'zod';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Check if the current environment is production
 * Used for setting Secure cookie flag
 */
function isProductionEnv(url: string): boolean {
  return url.includes('workers.dev') ||
    url.includes('pages.dev') ||
    url.includes('2apk.de');
}

/**
 * POST /api/auth/register
 * Register a new user account
 * Rate limited: 3 registrations per hour per IP
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 * Turnstile protected: Yes
 */
auth.post('/register', registrationRateLimit, turnstileMiddleware(), async (c) => {
  // Parse and validate request body
  const body = await c.req.json();
  const result = registerSchema.safeParse(body);

  if (!result.success) {
    // Validation failed - return 400 with details
    // This handles Requirements 1.3 (password length) and 1.4 (email format)
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Invalid registration data',
        details: {
          issues: result.error.issues.map((issue: ZodIssue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      400
    );
  }

  const { email, password } = result.data;

  // Check if email already exists (Requirement 1.2)
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first();

  if (existingUser) {
    throw new HTTPException(409, {
      message: 'Email is already registered',
    });
  }

  // Hash password with PBKDF2 (Requirement 1.1 - bcrypt-like security)
  const passwordHash = await hashPassword(password);

  // Generate unique user ID
  const userId = generateId();

  // Store user in D1 database (Requirement 1.1)
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)'
  )
    .bind(userId, email.toLowerCase(), passwordHash, 'user')
    .run();

  // Return success response (Requirement 1.5 - redirect handled by frontend)
  return c.json(
    {
      message: 'Registration successful',
      user: {
        id: userId,
        email: email.toLowerCase(),
        role: 'user',
      },
    },
    201
  );
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 * Rate limited: 10 attempts per 15 minutes (brute force protection)
 * Validates: Requirements 2.1, 2.2
 * Turnstile protected: Yes
 */
auth.post('/login', authRateLimit, turnstileMiddleware(), async (c) => {
  // Parse and validate request body
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Invalid login data',
        details: {
          issues: result.error.issues.map((issue: ZodIssue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      400
    );
  }

  const { email, password } = result.data;

  // Find user by email
  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, role FROM users WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first<{ id: string; email: string; password_hash: string; role: string }>();

  // Generic error message for invalid credentials (Requirement 2.2)
  // Don't reveal whether email or password is incorrect
  const invalidCredentialsError = {
    error: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  };

  if (!user) {
    throw new HTTPException(401, {
      message: invalidCredentialsError.message,
    });
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.password_hash);

  if (!passwordValid) {
    throw new HTTPException(401, {
      message: invalidCredentialsError.message,
    });
  }

  // Generate JWT with 24h expiry (Requirement 2.1)
  const token = await generateJWT(
    { user_id: user.id, role: user.role },
    c.env.JWT_SECRET,
    24 // 24 hours
  );

  // Set httpOnly cookie for secure token storage (XSS protection)
  const isProduction = isProductionEnv(c.req.url);

  // Create response with cookie
  const response = c.json({
    message: 'Login successful',
    token, // Still return token for backward compatibility
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });

  // Set secure httpOnly cookie
  response.headers.set(
    'Set-Cookie',
    `web2apk_token=${token}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${24 * 60 * 60}`
  );

  return response;
});

/**
 * POST /api/auth/logout
 * Clear authentication cookie
 * Requires authentication to prevent spam
 * Validates: Requirements 2.5
 */
auth.post('/logout', authMiddleware, (c) => {
  const isProduction = isProductionEnv(c.req.url);

  const response = c.json({ message: 'Logged out successfully' });

  // Clear the cookie by setting it to expire immediately
  response.headers.set(
    'Set-Cookie',
    `web2apk_token=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`
  );

  return response;
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Protected route - requires valid JWT
 * Validates: Requirements 2.3
 */
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Fetch user details from database
  const user = await c.env.DB.prepare(
    'SELECT id, email, role, created_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first<{ id: string; email: string; role: string; created_at: string }>();

  if (!user) {
    throw new HTTPException(404, {
      message: 'User not found',
    });
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    },
  });
});

export default auth;
