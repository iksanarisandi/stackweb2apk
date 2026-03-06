import { z } from 'zod';

/**
 * Email validation schema
 * Validates proper email format
 * Validates: Requirements 1.4
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format');

/**
 * Password validation schema
 * Minimum 8 characters required
 * Validates: Requirements 1.3
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');

/**
 * URL validation schema
 * Must be valid HTTPS URL
 * Validates: Requirements 3.2
 */
export const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .url('Invalid URL format')
  .refine((url) => url.startsWith('https://'), {
    message: 'URL must use HTTPS protocol',
  });

/**
 * Package name validation schema
 * Must match Android package name format: com.domain.name
 * Cannot contain Kotlin reserved keywords as package segments
 * Validates: Requirements 3.3
 */
const KOTLIN_RESERVED_KEYWORDS = [
  'in', 'is', 'as', 'if', 'else', 'for', 'while', 'do', 'when', 'return',
  'break', 'continue', 'object', 'package', 'import', 'class', 'interface',
  'enum', 'open', 'override', 'public', 'private', 'protected', 'internal',
  'abstract', 'final', 'companion', 'init', 'this', 'super', 'true', 'false',
  'null', 'it', 'typealias', 'val', 'var', 'fun', 'try', 'catch', 'finally',
  'throw', 'volatile', 'transient', 'constructor', 'suspend', 'tailrec',
  'operator', 'infix', 'out', 'reified', 'vararg', 'crossinline', 'lateinit'
];

export const packageNameSchema = z
  .string()
  .min(1, 'Package name is required')
  .regex(
    /^com\.[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/,
    'Package name must follow format: com.domain.name (lowercase letters and numbers only)'
  )
  .refine((packageName) => {
    const segments = packageName.split('.');
    return !segments.some(segment => KOTLIN_RESERVED_KEYWORDS.includes(segment));
  }, {
    message: `Package name cannot contain Kotlin reserved keywords: ${KOTLIN_RESERVED_KEYWORDS.join(', ')}`
  });

/**
 * App name validation schema
 */
export const appNameSchema = z
  .string()
  .min(1, 'App name is required')
  .max(50, 'App name must be 50 characters or less');

/**
 * Registration request schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Generate request schema (without file - file validated separately)
 */
export const generateRequestSchema = z.object({
  url: urlSchema,
  app_name: appNameSchema,
  package_name: packageNameSchema,
});

// Type exports inferred from schemas
export type EmailInput = z.infer<typeof emailSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type UrlInput = z.infer<typeof urlSchema>;
export type PackageNameInput = z.infer<typeof packageNameSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;
