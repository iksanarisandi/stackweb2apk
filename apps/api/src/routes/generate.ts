import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { generateRequestSchema } from '@web2apk/shared';
import { generateId } from '../lib/auth';
import { authMiddleware, generateRateLimit, generateIpRateLimit, sanitizeUrl, validatePackageName, validateAppName, turnstileMiddleware, downloadRateLimit } from '../middleware';
import type { Env, Variables } from '../index';
import type { ZodIssue } from 'zod';
import * as fflate from 'fflate';

const generate = new Hono<{ Bindings: Env; Variables: Variables }>();

// Constants for icon validation
const MAX_ICON_SIZE = 1048576; // 1MB in bytes
const REQUIRED_ICON_WIDTH = 512;
const REQUIRED_ICON_HEIGHT = 512;

// Constants for pricing
const PAYMENT_AMOUNT_WEBVIEW = 35000; // Rp35.000
const PAYMENT_AMOUNT_HTML = 75000; // Rp75.000

// Constants for HTML ZIP validation
const MAX_HTML_ZIP_SIZE = 10485760; // 10MB
const MAX_HTML_FILE_COUNT = 100;

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
 * Validate HTML ZIP file
 * Checks: file size, format, index.html presence, file count, dangerous files
 */
async function validateHtmlZip(
  file: File
): Promise<{ valid: boolean; error?: string; fileCount?: number }> {
  // Check file size
  if (file.size > MAX_HTML_ZIP_SIZE) {
    return {
      valid: false,
      error: `ZIP file must be less than 10MB. Current: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // Check file type
  if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
    return {
      valid: false,
      error: 'HTML files must be uploaded as a ZIP archive',
    };
  }

  try {
    // Extract and validate ZIP contents using fflate
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Unzip synchronously - fflate works well in Cloudflare Workers
    const entries = fflate.unzipSync(uint8Array);

    const files = Object.keys(entries);

    // Check for index.html
    if (!files.includes('index.html')) {
      return {
        valid: false,
        error: 'ZIP must contain index.html at the root level',
      };
    }

    // Check file count
    if (files.length > MAX_HTML_FILE_COUNT) {
      return {
        valid: false,
        error: `ZIP contains too many files. Maximum: ${MAX_HTML_FILE_COUNT}`,
      };
    }

    // Validate no dangerous files
    const dangerousExtensions = ['.exe', '.bat', '.sh', '.dll', '.so', '.dylib'];
    for (const filename of files) {
      if (dangerousExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
        return {
          valid: false,
          error: `ZIP contains potentially dangerous file: ${filename}`,
        };
      }
    }

    return { valid: true, fileCount: files.length };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to parse ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate a random keystore password
 */
function generateKeystorePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Generate a keystore alias
 */
function generateKeystoreAlias(): string {
  return `release_${Date.now()}`;
}

/**
 * POST /api/generate
 * Create a new APK generation request
 * Rate limited: 5 per hour per user + 10 per hour per IP
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3
 * Turnstile protected: Yes
 */
generate.post('/', authMiddleware, generateRateLimit, generateIpRateLimit, turnstileMiddleware(), async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new HTTPException(401, {
      message: 'Authentication required',
    });
  }

  // Parse multipart form data
  const formData = await c.req.formData();

  const url = formData.get('url') as string | null;
  const buildType = (formData.get('build_type') as string | null) || 'webview';
  const appName = formData.get('app_name') as string | null;
  const packageName = formData.get('package_name') as string | null;
  const iconFile = formData.get('icon') as File | null;
  const htmlZipFile = formData.get('html_files') as File | null;
  const enableGps = formData.get('enable_gps') === 'true' || formData.get('enable_gps') === '1';
  const enableCamera = formData.get('enable_camera') === 'true' || formData.get('enable_camera') === '1';

  // Validate build_type
  if (buildType !== 'webview' && buildType !== 'html') {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Invalid build type',
        details: {
          issues: [{ path: 'build_type', message: 'Build type must be webview or html' }],
        },
      },
      400
    );
  }

  // Determine amount based on build type
  const amount = buildType === 'html' ? PAYMENT_AMOUNT_HTML : PAYMENT_AMOUNT_WEBVIEW;

  // Validate required fields based on build type
  const issues: Array<{ path: string; message: string }> = [];

  if (buildType === 'webview') {
    if (!url) {
      issues.push({ path: 'url', message: 'URL is required for WebView builds' });
    }
  } else {
    if (!htmlZipFile) {
      issues.push({ path: 'html_files', message: 'HTML ZIP file is required for HTML View builds' });
    }
  }

  if (!appName) {
    issues.push({ path: 'app_name', message: 'App name is required' });
  }

  if (!packageName) {
    issues.push({ path: 'package_name', message: 'Package name is required' });
  }

  if (issues.length > 0) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields',
        details: { issues },
      },
      400
    );
  }

  // Validate text fields with Zod schema (Requirements 3.2, 3.3)
  // For HTML builds, URL is optional, so provide a placeholder
  const textValidation = generateRequestSchema.safeParse({
    url: url || 'https://example.com',
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

  // Validate HTML ZIP file for HTML builds
  let htmlFilesKey: string | null = null;
  let htmlFileCount = 0;
  let keystorePassword: string | null = null;
  let keystoreAlias: string | null = null;

  // Generate unique IDs FIRST (before any conditional logic)
  const generateId_ = generateId();
  const paymentId = generateId();

  if (buildType === 'html' && htmlZipFile) {
    const zipValidation = await validateHtmlZip(htmlZipFile);
    if (!zipValidation.valid) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: zipValidation.error,
          details: {
            issues: [{ path: 'html_files', message: zipValidation.error }],
          },
        },
        400
      );
    }
    htmlFileCount = zipValidation.fileCount || 0;

    // Upload HTML ZIP to R2 - use the SAME generateId_
    htmlFilesKey = `html-files/${generateId_}/files.zip`;
    const htmlZipBuffer = await htmlZipFile.arrayBuffer();
    await c.env.STORAGE.put(htmlFilesKey, htmlZipBuffer, {
      httpMetadata: {
        contentType: 'application/zip',
      },
    });

    // Generate keystore credentials for HTML builds
    keystorePassword = generateKeystorePassword();
    keystoreAlias = generateKeystoreAlias();
  }

  // Create icon key for R2 storage - use the SAME generateId_
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
    `INSERT INTO generates (
      id, user_id, url, build_type, app_name, package_name, icon_key, html_files_key,
      keystore_password, keystore_alias, status, enable_gps, enable_camera,
      amount, html_file_count
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  )
    .bind(
      generateId_,
      userId,
      url,
      buildType,
      appName,
      packageName,
      iconKey,
      htmlFilesKey,
      keystorePassword,
      keystoreAlias,
      enableGps ? 1 : 0,
      enableCamera ? 1 : 0,
      amount,
      htmlFileCount
    )
    .run();

  // Create payment record in D1 with status pending (Requirement 4.3)
  await c.env.DB.prepare(
    `INSERT INTO payments (id, user_id, generate_id, amount, status)
     VALUES (?, ?, ?, ?, 'pending')`
  )
    .bind(paymentId, userId, generateId_, amount)
    .run();

  // Return success response
  return c.json(
    {
      id: generateId_,
      status: 'pending',
      message: buildType === 'html'
        ? 'HTML View APK generation request created. Please complete payment to proceed.'
        : 'APK generation request created. Please complete payment to proceed.',
      payment: {
        id: paymentId,
        amount,
      },
      build_type: buildType,
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
    `SELECT id, url, build_type, app_name, package_name, status, error_message, download_count,
      enable_gps, enable_camera, version_code, version_name, created_at, completed_at, amount, aab_key, keystore_alias
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
    `SELECT id, url, build_type, app_name, package_name, icon_key, apk_key, aab_key,
      status, error_message, download_count, enable_gps, enable_camera, version_code, version_name,
      created_at, completed_at, amount, keystore_alias
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
 * Generate a signed download token for APK/AAB files
 * Uses HMAC-SHA256 to create a time-limited signature
 */
async function generateDownloadToken(
  fileKey: string,
  expiresAt: number,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = `${fileKey}:${expiresAt}`;

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
  fileKey: string,
  expiresAt: number,
  token: string,
  secret: string
): Promise<boolean> {
  const expectedToken = await generateDownloadToken(fileKey, expiresAt, secret);
  return token === expectedToken;
}

/**
 * GET /api/generate/:id/download
 * Generate presigned R2 URL for APK/AAB download and increment download count
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
    `SELECT id, apk_key, aab_key, status, download_count, build_type
     FROM generates
     WHERE id = ? AND user_id = ?`
  )
    .bind(generateId, userId)
    .first<{ id: string; apk_key: string | null; aab_key: string | null; status: string; download_count: number; build_type: string }>();

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

  // Generate signed download token for APK
  const token = await generateDownloadToken(result.apk_key, expiresAt, c.env.JWT_SECRET);

  // Create download URL with signed parameters
  const baseUrl = new URL(c.req.url).origin;
  const downloadUrl = `${baseUrl}/api/generate/${generateId}/file?expires=${expiresAt}&token=${token}`;

  const response: {
    download_url: string;
    expires_at: string;
    download_count: number;
    aab_download_url?: string;
  } = {
    download_url: downloadUrl,
    expires_at: new Date(expiresAt * 1000).toISOString(),
    download_count: result.download_count + 1,
  };

  // Add AAB download URL if available (HTML builds)
  if (result.aab_key) {
    const aabToken = await generateDownloadToken(result.aab_key, expiresAt, c.env.JWT_SECRET);
    response.aab_download_url = `${baseUrl}/api/generate/${generateId}/aab?expires=${expiresAt}&token=${aabToken}`;
  }

  // Increment download count (Requirement 7.4, Property 17)
  await c.env.DB.prepare(
    `UPDATE generates SET download_count = download_count + 1 WHERE id = ?`
  )
    .bind(generateId)
    .run();

  return c.json(response);
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

/**
 * GET /api/generate/:id/aab
 * Serve the actual AAB file from R2 storage
 * This endpoint is accessed via the signed URL from /download
 */
generate.get('/:id/aab', async (c) => {
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

  // Get the generate record to find the AAB key
  const result = await c.env.DB.prepare(
    `SELECT aab_key, app_name FROM generates WHERE id = ?`
  )
    .bind(generateId)
    .first<{ aab_key: string | null; app_name: string }>();

  if (!result || !result.aab_key) {
    throw new HTTPException(404, {
      message: 'AAB not found',
    });
  }

  // Verify the token
  const isValid = await verifyDownloadToken(result.aab_key, expiresAt, token, c.env.JWT_SECRET);
  if (!isValid) {
    throw new HTTPException(403, {
      message: 'Invalid download token',
    });
  }

  // Fetch AAB from R2
  const aabObject = await c.env.STORAGE.get(result.aab_key);
  if (!aabObject) {
    return c.json(
      {
        error: 'AAB_NOT_FOUND',
        message: 'AAB file is no longer available. Please contact support.',
      },
      410 // Gone
    );
  }

  // Generate filename from app name
  const sanitizedAppName = result.app_name.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${sanitizedAppName}.aab`;

  // Return the AAB file with appropriate headers
  return new Response(aabObject.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': aabObject.size.toString(),
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

/**
 * GET /api/generate/:id/keystore
 * Download keystore metadata for HTML builds
 */
generate.get('/:id/keystore', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const generateId = c.req.param('id');

  const result = await c.env.DB.prepare(
    `SELECT keystore_key, keystore_password, keystore_alias, build_type, status, app_name
     FROM generates
     WHERE id = ? AND user_id = ?`
  )
    .bind(generateId, userId)
    .first<{
      keystore_key: string | null;
      keystore_password: string | null;
      keystore_alias: string | null;
      build_type: string;
      status: string;
      app_name: string;
    }>();

  if (!result) {
    throw new HTTPException(404, { message: 'Generate not found' });
  }

  if (result.build_type !== 'html') {
    return c.json({
      error: 'KEYSTORE_NOT_AVAILABLE',
      message: 'Keystore is only available for HTML View builds',
    }, 400);
  }

  if (result.status !== 'ready') {
    return c.json({
      error: 'BUILD_NOT_READY',
      message: 'Keystore available only after successful build',
    }, 400);
  }

  if (!result.keystore_key || !result.keystore_password) {
    return c.json({
      error: 'KEYSTORE_NOT_FOUND',
      message: 'Keystore information not found',
    }, 404);
  }

  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    keystore_url: `${baseUrl}/api/generate/${generateId}/keystore-file`,
    password: result.keystore_password,
    alias: result.keystore_alias,
    app_name: result.app_name,
  });
});

/**
 * GET /api/generate/:id/keystore-file
 * Serve actual keystore file
 */
generate.get('/:id/keystore-file', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const generateId = c.req.param('id');

  const result = await c.env.DB.prepare(
    `SELECT keystore_key, app_name FROM generates
     WHERE id = ? AND user_id = ?`
  )
    .bind(generateId, userId)
    .first<{ keystore_key: string | null; app_name: string }>();

  if (!result || !result.keystore_key) {
    throw new HTTPException(404, { message: 'Keystore not found' });
  }

  const keystoreObject = await c.env.STORAGE.get(result.keystore_key);
  if (!keystoreObject) {
    throw new HTTPException(404, { message: 'Keystore file not found in storage' });
  }

  const sanitizedAppName = result.app_name.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${sanitizedAppName}-keystore.jks`;

  return new Response(keystoreObject.body, {
    headers: {
      'Content-Type': 'application/x-java-jce-keystore',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': keystoreObject.size.toString(),
    },
  });
});

generate.post('/:id/increment-version', authMiddleware, async (c) => {
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

  const result = await c.env.DB.prepare(
    `SELECT id, user_id, version_code, version_name, status FROM generates WHERE id = ? AND user_id = ?`
  )
    .bind(generateId, userId)
    .first<{ id: string; user_id: string; version_code: number; version_name: string; status: string }>();

  if (!result) {
    throw new HTTPException(404, {
      message: 'Generate not found',
    });
  }

  const body = await c.req.json<{ version_name?: string }>().catch(() => ({})) as { version_name?: string };

  const currentVersionCode = result.version_code || 1;
  const newVersionCode = currentVersionCode + 1;
  const newVersionName = body.version_name || `${newVersionCode}.0.0`;

  await c.env.DB.prepare(
    `UPDATE generates SET version_code = ?, version_name = ? WHERE id = ?`
  )
    .bind(newVersionCode, newVersionName, generateId)
    .run();

  return c.json({
    message: 'Version incremented',
    generate_id: generateId,
    version_code: newVersionCode,
    version_name: newVersionName,
  });
});

generate.post('/:id/rebuild', authMiddleware, async (c) => {
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

  const generate = await c.env.DB.prepare(
    `SELECT 
      g.id, g.user_id, g.url, g.build_type, g.app_name, g.package_name, 
      g.icon_key, g.html_files_key, g.keystore_password, g.keystore_alias, g.keystore_key,
      g.enable_gps, g.enable_camera, g.version_code, g.version_name, g.status,
      p.status as payment_status
    FROM generates g
    JOIN payments p ON p.generate_id = g.id
    WHERE g.id = ? AND g.user_id = ?`
  )
    .bind(generateId, userId)
    .first<{
      id: string;
      user_id: string;
      url: string | null;
      build_type: string;
      app_name: string;
      package_name: string;
      icon_key: string;
      html_files_key: string | null;
      keystore_password: string | null;
      keystore_alias: string | null;
      keystore_key: string | null;
      enable_gps: number;
      enable_camera: number;
      version_code: number;
      version_name: string;
      status: string;
      payment_status: string;
    }>();

  if (!generate) {
    throw new HTTPException(404, {
      message: 'Generate not found',
    });
  }

  if (generate.payment_status !== 'confirmed') {
    throw new HTTPException(400, {
      message: 'Payment not confirmed. Cannot rebuild.',
    });
  }

  if (generate.status === 'building') {
    throw new HTTPException(400, {
      message: 'Build is already in progress.',
    });
  }

  const body = await c.req.json<{ version_name?: string }>().catch(() => ({})) as { version_name?: string };

  const currentVersionCode = generate.version_code || 1;
  const newVersionCode = currentVersionCode + 1;
  const newVersionName = body.version_name || `${newVersionCode}.0.0`;

  await c.env.DB.prepare(
    `UPDATE generates SET version_code = ?, version_name = ?, status = 'building', error_message = NULL WHERE id = ?`
  )
    .bind(newVersionCode, newVersionName, generateId)
    .run();

  const baseUrl = new URL(c.req.url).origin;

  try {
    const githubResponse = await fetch(
      'https://api.github.com/repos/iksanarisandi/stackweb2apk/dispatches',
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Web2APK-API',
        },
        body: JSON.stringify({
          event_type: 'build_apk',
          client_payload: {
            generate_id: generateId,
            api_url: baseUrl,
            keystore_password: generate.keystore_password,
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      console.error('Failed to trigger rebuild:', await githubResponse.text());
    }
  } catch (error) {
    console.error('Error triggering rebuild:', error);
  }

  return c.json({
    message: 'Rebuild triggered with new version',
    generate_id: generateId,
    version_code: newVersionCode,
    version_name: newVersionName,
    status: 'building',
  });
});

generate.get('/:id/build-config', async (c) => {
  const generateId = c.req.param('id');

  if (!generateId) {
    throw new HTTPException(400, {
      message: 'Generate ID is required',
    });
  }

  const generate = await c.env.DB.prepare(
    `SELECT 
      g.id, g.url, g.build_type, g.app_name, g.package_name,
      g.keystore_alias, g.keystore_key,
      g.enable_gps, g.enable_camera, g.version_code, g.version_name
    FROM generates g
    WHERE g.id = ?`
  )
    .bind(generateId)
    .first<{
      id: string;
      url: string | null;
      build_type: string;
      app_name: string;
      package_name: string;
      keystore_alias: string | null;
      keystore_key: string | null;
      enable_gps: number;
      enable_camera: number;
      version_code: number;
      version_name: string;
    }>();

  if (!generate) {
    throw new HTTPException(404, {
      message: 'Generate not found',
    });
  }

  return c.json({
    id: generate.id,
    url: generate.url,
    build_type: generate.build_type,
    app_name: generate.app_name,
    package_name: generate.package_name,
    keystore_alias: generate.keystore_alias,
    keystore_key: generate.keystore_key,
    enable_gps: Boolean(generate.enable_gps),
    enable_camera: Boolean(generate.enable_camera),
    version_code: generate.version_code || 1,
    version_name: generate.version_name || '1.0.0',
  });
});

export default generate;
