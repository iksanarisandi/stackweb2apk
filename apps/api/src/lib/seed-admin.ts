import { hashPassword, generateId } from './auth';

/**
 * Admin seeding utility
 * Creates default admin account from environment variables if not exists
 * Validates: Requirements 9.3
 */

interface SeedAdminParams {
  db: D1Database;
  adminEmail: string;
  adminPassword: string;
}

interface SeedResult {
  success: boolean;
  message: string;
  created: boolean;
}

/**
 * Seed admin user on first run if not exists
 * Reads admin credentials from environment variables
 * @param params - Database and admin credentials
 * @returns Result indicating if admin was created or already exists
 */
export async function seedAdmin(params: SeedAdminParams): Promise<SeedResult> {
  const { db, adminEmail, adminPassword } = params;

  // Validate environment variables are set
  if (!adminEmail || !adminPassword) {
    return {
      success: false,
      message: 'Admin credentials not configured in environment variables',
      created: false,
    };
  }

  try {
    // Check if admin user already exists
    const existingAdmin = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(adminEmail)
      .first();

    if (existingAdmin) {
      return {
        success: true,
        message: 'Admin user already exists',
        created: false,
      };
    }

    // Create admin user with hashed password
    const id = generateId();
    const passwordHash = await hashPassword(adminPassword);

    await db
      .prepare(
        'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)'
      )
      .bind(id, adminEmail, passwordHash, 'admin')
      .run();

    return {
      success: true,
      message: 'Admin user created successfully',
      created: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to seed admin: ${errorMessage}`,
      created: false,
    };
  }
}
