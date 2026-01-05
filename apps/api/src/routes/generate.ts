import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { generateRequestSchema } from '@web2apk/shared';
import { generateId } from '../lib/auth';
import { authMiddleware, generateRateLimit, sanitizeUrl, validatePackageName, validateAppName, turnstileMiddleware, downloadRateLimit } from '../middleware';
import type { Env, Variables } from '../index';
import type { ZodIssue } from 'zod';

const generate = new Hono<{ Bindings: Env; Variables: Variables }>();

// Constants for icon validation
const MAX_ICON_SIZE = 1048576; // 1MB in bytes
const REQUIRED_ICON_WIDTH = 512;
const REQUIRED_ICON_HEIGHT = 512;
const PAYMENT_AMOUNT = 35000; // Rp35.000
const GENERATE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown

/**
 * Validate PNG file header and dimensions
 * PNG files start with signature: 137 80 78 71 13 10 26 10
 * IHDR chunk contains width (4 bytes) and height (4 bytes) at offset 16
 */
async function validatePngIcon(
  file: File
): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> {
  // Check file size (Requirement 3.5)
  if (file.size > MAX_ICON_SIZE) {
    return {
      valid: false,
      error: `Icon file size must be less than 1MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check PNG signature (first 8 bytes)
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== pngSignature[i]) {
      return {
        valid: false,
        error: 'Icon must be a valid PNG file',
      };
    }
  }

  // Read IHDR chunk dimensions (width at offset 16, height at offset 20)
  // Each is 4 bytes, big-endian
  const width =
    (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height =
    (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];

  // Check dimensions (Requirement 3.4)
  if (width !== REQUIRED_ICON_WIDTH || height !== REQUIRED_ICON_HEIGHT) {
    return {
      valid: false,
      error: `Icon must be ${REQUIRED_ICON_WIDTH}x${REQUIRED_ICON_HEIGHT} pixels. Current dimensions: ${width}x${height}`,
      width,
      height,
    };
  }

  return { valid: true, width, height };
}

/**
 * POST /api/generate
 * Create a new APK generation request
 * Rate limited: 1 per hour per user
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3
 * Turnstile protected: Yes
 */
generate.post('/', authMiddleware, generateRateLimit, turnstileMiddleware(), async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }

  // Check user's last generate time (additional rate limit check)
  const user = await c.env.DB.prepare(
    'SELECT last_generate_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first<{ last_generate_at: string | null }>();

  if (user?.last_generate_at) {
    const lastGenerate = new Date(user.last_generate_at).getTime();
    const now = Date.now();
    if (now - lastGenerate < GENERATE_COOLDOWN_MS) {
      const remainingMs = GENERATE_COOLDOWN_MS - (now - lastGenerate);
      const remainingMins = Math.ceil(remainingMs / 60000);
      return c.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Anda hanya dapat generate 1 APK per jam. Silakan tunggu ${remainingMins} menit lagi.`,
          retryAfter: Math.ceil(remainingMs / 1000),
        },
        429
      );
    }
  }

  // Parse multipart form data
  const formData = await c.req.formData();

  const url = formData.get('url') as string | null;
  const appName = formData.get('app_name') as string | null;
  const packageName = formData.get('package_name') as string | null;
  const iconFile = formData.get('icon') as File | null;
  const enableGps = formData.get('enable_gps') === 'true' || formData.get('enable_gps') === '1';
  const enableCamera = formData.get('enable_camera') === 'true' || formData.get('enable_camera') === '1';

  // Validate required fields exist
  if (!url || !appName || !packageName) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields',
        details: {
          issues: [
            !url && { path: 'url', message: 'URL is required' },
            !appName && { path: 'app_name', message: 'App name is required' },
            !packageName && { path: 'package_name', message: 'Package name is required' },
          ].filter(Boolean),
        },
      },
      400
    );
  }

  // Validate text fields with Zod schema (Requirements 3.2, 3.3)
  const textValidation = generateRequestSchema.safeParse({
    url,
    app_name: appName,
    package_name: packageName,
  });

  if (!textValidation.success) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Invalid form data',
        details: {
          issues: textValidation.error.issues.map((issue: ZodIssue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      400
    );
  }

  // Validate icon file exists
  if (!iconFile || !(iconFile instanceof File)) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Icon file is required',
        details: {
          issues: [{ path: 'icon', message: 'Icon file is required' }],
        },
      },
      400
    );
  }

  // Validate icon file (PNG, 512x512, max 1MB) - Requirements 3.4, 3.5
  const iconValidation = await validatePngIcon(iconFile);
  if (!iconValidation.valid) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: iconValidation.error,
        details: {
          issues: [{ path: 'icon', message: iconValidation.error }],
        },
      },
      400
    );
  }

  // Generate unique IDs
  const generateId_ = generateId();
  const paymentId = generateId();

  // Create icon key for R2 storage
  const iconKey = `icons/${generateId_}/icon.png`;

  // Upload icon to R2 (Requirement 3.6)
  const iconBuffer = await iconFile.arrayBuffer();
  await c.env.STORAGE.put(iconKey, iconBuffer, {
    httpMetadata: {
      contentType: 'image/png',
    },
  });

  // Create generate record in D1 with status pending (Requirement 3.1, 3.7, 3.8)
  await c.env.DB.prepare(
    `INSERT INTO generates (id, user_id, url, app_name, package_name, icon_key, status, enable_gps, enable_camera)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  )
    .bind(generateId_, userId, url, appName, packageName, iconKey, enableGps ? 1 : 0, enableCamera ? 1 : 0)
    .run();

  // Create payment record in D1 with status pending (Requirement 4.3)
  await c.env.DB.prepare(
    `INSERT INTO payments (id, user_id, generate_id, amount, status)
     VALUES (?, ?, ?, ?, 'pending')`
  )
    .bind(paymentId, userId, generateId_, PAYMENT_AMOUNT)
    .run();

  // Update user's last_generate_at for rate limiting
  await c.env.DB.prepare(
    'UPDATE users SET last_generate_at = ? WHERE id = ?'
  )
    .bind(new Date().toISOString(), userId)
    .run();

  // Return success response
  return c.json(
    {
      id: generateId_,
      status: 'pending',
      message: 'APK generation request created. Please complete payment to proceed.',
      payment: {
        id: paymentId,
        amount: PAYMENT_AMOUNT,
      },
    },
    201
  );
});

/**
 * GET /api/generate
 * List all generates for the current user
 * Validates: Requirements 8.1
 */
generate.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }

  // Query only current user's generates (Property 18: User Data Isolation)
  const result = await c.env.DB.prepare(
    `SELECT id, url, app_name, package_name, status, error_message, download_count, enable_gps, enable_camera, created_at, completed_at
     FROM generates
     WHERE user_id = ?
     ORDER BY created_at DESC`
  )
    .bind(userId)
    .all();

  // Convert integer flags to boolean
  const generates = (result.results || []).map((g: Record<string, unknown>) => ({
    ...g,
    enable_gps: Boolean(g.enable_gps),
    enable_camera: Boolean(g.enable_camera),
  }));

  return c.json({
    generates,
  });
});

/**
 * GET /api/generate/:id
 * Get single generate details with ownership verification
 * Validates: Requirements 8.1
 */
generate.get('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const generateId = c.req.param('id');

  if (!userId) {
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }

  if (!generateId) {
    throw new HTTPException(400, {
      message: 'Generate ID is required',
    });
  }

  // Query generate with ownership verification (Property 18: User Data Isolation)
  const result = await c.env.DB.prepare(
    `SELECT id, url, app_name, package_name, icon_key, apk_key, status, error_message, download_count, enable_gps, enable_camera, created_at, completed_at
     FROM generates
     WHERE id = ? AND user_id = ?`
  )
    .bind(generateId, userId)
    .first();

  if (!result) {
    throw new HTTPException(404, {
      message: 'Generate not found',
    });
  }

  // Convert integer flags to boolean
  const generate = {
    ...result,
    enable_gps: Boolean(result.enable_gps),
    enable_camera: Boolean(result.enable_camera),
  };

  return c.json({
    generate,
  });
});

// Constants for download URL
const DOWNLOAD_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Generate a signed download token for APK files
 * Uses HMAC-SHA256 to create a time-limited signature
 */
async function generateDownloadToken(
  apkKey: string,
  expiresAt: number,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = `${apkKey}:${expiresAt}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return signatureHex;
}

/**
 * Verify a download token
 */
async function verifyDownloadToken(
  apkKey: string,
  expiresAt: number,
  token: string,
  secret: string
): Promise<boolean> {
  const expectedToken = await generateDownloadToken(apkKey, expiresAt, secret);
  return token === expectedToken;
}

/**
 * GET /api/generate/:id/download
 * Generate presigned R2 URL for APK download and increment download count
 * Validates: Requirements 6.5, 7.1, 7.2, 7.4
 * Rate limited: 10 downloads per minute per user
 */
generate.get('/:id/download', authMiddleware, downloadRateLimit, async (c) => {
  const userId = c.get('userId');
  const generateId = c.req.param('id');

  if (!userId) {
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }

  if (!generateId) {
    throw new HTTPException(400, {
      message: 'Generate ID is required',
    });
  }

  // Query generate with ownership verification (Property 18: User Data Isolation)
  const result = await c.env.DB.prepare(
    `SELECT id, apk_key, status, download_count
     FROM generates
     WHERE id = ? AND user_id = ?`
  )
    .bind(generateId, userId)
    .first<{ id: string; apk_key: string | null; status: string; download_count: number }>();

  if (!result) {
    throw new HTTPException(404, {
      message: 'Generate not found',
    });
  }

  // Check if APK is ready for download (Requirement 7.1)
  if (result.status !== 'ready') {
    return c.json(
      {
        error: 'APK_NOT_READY',
        message: `APK is not ready for download. Current status: ${result.status}`,
        status: result.status,
      },
      400
    );
  }

  // Check if APK key exists
  if (!result.apk_key) {
    throw new HTTPException(500, {
      message: 'APK file not found in storage',
    });
  }

  // Verify APK exists in R2
  const apkObject = await c.env.STORAGE.head(result.apk_key);
  if (!apkObject) {
    return c.json(
      {
        error: 'APK_EXPIRED',
        message: 'Download URL has expired or APK file is no longer available. Please contact support for a new link.',
      },
      410 // Gone
    );
  }

  // Generate expiry timestamp (7 days from now) - Requirement 6.5
  const expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_URL_EXPIRY_SECONDS;

  // Generate signed download token
  const token = await generateDownloadToken(result.apk_key, expiresAt, c.env.JWT_SECRET);

  // Create download URL with signed parameters
  const baseUrl = new URL(c.req.url).origin;
  const downloadUrl = `${baseUrl}/api/generate/${generateId}/file?expires=${expiresAt}&token=${token}`;

  // Increment download count (Requirement 7.4, Property 17)
  await c.env.DB.prepare(
    `UPDATE generates SET download_count = download_count + 1 WHERE id = ?`
  )
    .bind(generateId)
    .run();

  return c.json({
    download_url: downloadUrl,
    expires_at: new Date(expiresAt * 1000).toISOString(),
    download_count: result.download_count + 1,
  });
});

/**
 * GET /api/generate/:id/file
 * Serve the actual APK file from R2 storage
 * This endpoint is accessed via the signed URL from /download
 */
generate.get('/:id/file', async (c) => {
  const generateId = c.req.param('id');
  const expiresParam = c.req.query('expires');
  const token = c.req.query('token');

  if (!generateId || !expiresParam || !token) {
    throw new HTTPException(400, {
      message: 'Invalid download link',
    });
  }

  const expiresAt = parseInt(expiresParam, 10);

  // Check if link has expired
  if (isNaN(expiresAt) || Date.now() / 1000 > expiresAt) {
    return c.json(
      {
        error: 'LINK_EXPIRED',
        message: 'Download link has expired. Please request a new download link.',
      },
      410 // Gone
    );
  }

  // Get the generate record to find the APK key
  const result = await c.env.DB.prepare(
    `SELECT apk_key, app_name FROM generates WHERE id = ?`
  )
    .bind(generateId)
    .first<{ apk_key: string | null; app_name: string }>();

  if (!result || !result.apk_key) {
    throw new HTTPException(404, {
      message: 'APK not found',
    });
  }

  // Verify the token
  const isValid = await verifyDownloadToken(result.apk_key, expiresAt, token, c.env.JWT_SECRET);
  if (!isValid) {
    throw new HTTPException(403, {
      message: 'Invalid download token',
    });
  }

  // Fetch APK from R2
  const apkObject = await c.env.STORAGE.get(result.apk_key);
  if (!apkObject) {
    return c.json(
      {
        error: 'APK_NOT_FOUND',
        message: 'APK file is no longer available. Please contact support.',
      },
      410 // Gone
    );
  }

  // Generate filename from app name
  const sanitizedAppName = result.app_name.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${sanitizedAppName}.apk`;

  // Return the APK file with appropriate headers
  return new Response(apkObject.body, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': apkObject.size.toString(),
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

export default generate;
