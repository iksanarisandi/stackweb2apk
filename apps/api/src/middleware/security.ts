import { Context, Next } from 'hono';
import type { Env, Variables } from '../index';

/**
 * Security headers middleware
 * Adds essential security headers to all responses
 */
export async function securityHeaders(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  await next();

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  c.header('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy for API
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  
  // Permissions Policy
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

/**
 * Input sanitization helpers
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }
  
  return sanitized;
}

/**
 * Validate and sanitize URL input
 */
export function sanitizeUrl(input: string): { valid: boolean; url: string; error?: string } {
  const sanitized = sanitizeString(input);
  
  if (!sanitized) {
    return { valid: false, url: '', error: 'URL is required' };
  }
  
  // Must be HTTPS
  if (!sanitized.startsWith('https://')) {
    return { valid: false, url: '', error: 'URL must use HTTPS' };
  }
  
  try {
    const url = new URL(sanitized);
    
    // Block localhost and private IPs (SSRF prevention)
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return { valid: false, url: '', error: 'Private/local URLs are not allowed' };
    }
    
    // Block common internal services
    if (
      hostname.includes('metadata.google') ||
      hostname.includes('169.254.') ||
      hostname.includes('metadata.aws')
    ) {
      return { valid: false, url: '', error: 'Internal service URLs are not allowed' };
    }
    
    return { valid: true, url: url.toString() };
  } catch {
    return { valid: false, url: '', error: 'Invalid URL format' };
  }
}

/**
 * Validate package name format
 */
export function validatePackageName(input: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeString(input).toLowerCase();
  
  if (!sanitized) {
    return { valid: false, error: 'Package name is required' };
  }
  
  // Must match Android package name format
  const packageRegex = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/;
  if (!packageRegex.test(sanitized)) {
    return { valid: false, error: 'Invalid package name format (e.g., com.example.app)' };
  }
  
  // Block reserved package names
  const reserved = ['com.android', 'com.google', 'android.', 'java.', 'javax.'];
  for (const prefix of reserved) {
    if (sanitized.startsWith(prefix)) {
      return { valid: false, error: 'Reserved package name prefix' };
    }
  }
  
  // Max length
  if (sanitized.length > 150) {
    return { valid: false, error: 'Package name too long (max 150 characters)' };
  }
  
  return { valid: true };
}

/**
 * Validate app name
 */
export function validateAppName(input: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeString(input);
  
  if (!sanitized) {
    return { valid: false, error: 'App name is required' };
  }
  
  if (sanitized.length > 50) {
    return { valid: false, error: 'App name too long (max 50 characters)' };
  }
  
  if (sanitized.length < 2) {
    return { valid: false, error: 'App name too short (min 2 characters)' };
  }
  
  // Block potentially malicious characters
  if (/[<>\"\'\\]/.test(sanitized)) {
    return { valid: false, error: 'App name contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Validate file upload
 */
export function validateIconFile(file: File): { valid: boolean; error?: string } {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'Icon file is required' };
  }
  
  // Check MIME type
  if (file.type !== 'image/png') {
    return { valid: false, error: 'Icon must be PNG format' };
  }
  
  // Check file size (max 1MB)
  const maxSize = 1 * 1024 * 1024; // 1MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Icon file too large (max 1MB)' };
  }
  
  // Check minimum size (prevent empty files)
  if (file.size < 100) {
    return { valid: false, error: 'Icon file too small' };
  }
  
  return { valid: true };
}
