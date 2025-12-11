import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { ApiError } from '@web2apk/shared';

/**
 * Global error handling middleware
 * Catches all errors and returns consistent API error responses
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('API Error:', error);

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const zodError = error as ZodError<unknown>;
      const apiError: ApiError = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          issues: zodError.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      };
      return c.json(apiError, 400);
    }

    // Handle Hono HTTP exceptions
    if (error instanceof HTTPException) {
      const apiError: ApiError = {
        error: getErrorCode(error.status),
        message: error.message || getDefaultMessage(error.status),
      };
      return c.json(apiError, error.status);
    }

    // Handle generic errors
    const apiError: ApiError = {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
    return c.json(apiError, 500);
  }
}

function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return 'INTERNAL_ERROR';
  }
}

function getDefaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Authentication required';
    case 403:
      return 'Access forbidden';
    case 404:
      return 'Resource not found';
    case 409:
      return 'Resource conflict';
    default:
      return 'An error occurred';
  }
}
