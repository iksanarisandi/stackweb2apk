import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, adminMiddleware, adminRateLimit } from '../middleware';
import type { Env, Variables } from '../index';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth, admin, and rate limit middleware to all admin routes
admin.use('*', authMiddleware);
admin.use('*', adminMiddleware);
admin.use('*', adminRateLimit);

/**
 * GET /api/admin/payments
 * List all pending payments with user and generate details
 * Admin only access
 * Validates: Requirements 5.1
 */
admin.get('/payments', async (c) => {
  // Query all pending payments with user and generate details
  const result = await c.env.DB.prepare(
    `SELECT 
      p.id,
      p.user_id,
      p.generate_id,
      p.amount,
      p.status,
      p.created_at,
      u.email as user_email,
      g.url as generate_url,
      g.app_name as generate_app_name,
      g.package_name as generate_package_name,
      g.status as generate_status
    FROM payments p
    JOIN users u ON p.user_id = u.id
    JOIN generates g ON p.generate_id = g.id
    WHERE p.status = 'pending'
    ORDER BY p.created_at ASC`
  ).all();

  return c.json({
    payments: result.results || [],
  });
});


/**
 * POST /api/admin/payments/:id/confirm
 * Confirm a payment and trigger APK build
 * Updates payment status to confirmed, generate status to building
 * Triggers GitHub Actions webhook
 * Validates: Requirements 5.2, 5.4
 */
admin.post('/payments/:id/confirm', async (c) => {
  const paymentId = c.req.param('id');
  const adminUserId = c.get('userId');

  if (!paymentId) {
    throw new HTTPException(400, {
      message: 'Payment ID is required',
    });
  }

  // Get payment with generate details
  const payment = await c.env.DB.prepare(
    `SELECT
      p.id,
      p.user_id,
      p.generate_id,
      p.status,
      g.url,
      g.build_type,
      g.app_name,
      g.package_name,
      g.icon_key,
      g.html_files_key,
      g.keystore_password,
      g.keystore_alias,
      g.enable_gps,
      g.enable_camera,
      u.email as user_email
    FROM payments p
    JOIN generates g ON p.generate_id = g.id
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ?`
  )
    .bind(paymentId)
    .first<{
      id: string;
      user_id: string;
      generate_id: string;
      status: string;
      url: string | null;
      build_type: string;
      app_name: string;
      package_name: string;
      icon_key: string;
      html_files_key: string | null;
      keystore_password: string | null;
      keystore_alias: string | null;
      enable_gps: number;
      enable_camera: number;
      user_email: string;
    }>();

  if (!payment) {
    throw new HTTPException(404, {
      message: 'Payment not found',
    });
  }

  if (payment.status !== 'pending') {
    throw new HTTPException(400, {
      message: `Payment cannot be confirmed. Current status: ${payment.status}`,
    });
  }

  const now = new Date().toISOString();

  // Update payment status to confirmed (Property 14: Payment Confirmation State Transition)
  await c.env.DB.prepare(
    `UPDATE payments 
     SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?
     WHERE id = ?`
  )
    .bind(adminUserId, now, paymentId)
    .run();

  // Update generate status to building (Property 14: Payment Confirmation State Transition)
  await c.env.DB.prepare(
    `UPDATE generates 
     SET status = 'building'
     WHERE id = ?`
  )
    .bind(payment.generate_id)
    .run();

  // Generate API URLs for GitHub Actions
  const baseUrl = new URL(c.req.url).origin;

  // Trigger GitHub Actions workflow via repository dispatch (Requirement 5.4)
  // The callback URL will be called by GitHub Actions when build completes
  const callbackUrl = new URL('/api/webhook/build-complete', c.req.url).toString();

  try {
    const githubResponse = await fetch(
      'https://api.github.com/repos/iksanarisandi/stackweb2apk/dispatches',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${c.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Web2APK-API',
        },
        body: JSON.stringify({
          event_type: 'build_apk',
          client_payload: {
            generate_id: payment.generate_id,
            api_url: baseUrl,
            url: payment.url,
            build_type: payment.build_type,
            app_name: payment.app_name,
            package_name: payment.package_name,
            keystore_password: payment.keystore_password,
            keystore_alias: payment.keystore_alias,
            callback_url: callbackUrl,
            enable_gps: Boolean(payment.enable_gps),
            enable_camera: Boolean(payment.enable_camera),
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      // Log error but don't fail - payment is already confirmed
      console.error('Failed to trigger GitHub Actions:', await githubResponse.text());
    }
  } catch (error) {
    // Log error but don't fail - payment is already confirmed
    console.error('Error triggering GitHub Actions:', error);
  }

  return c.json({
    message: 'Payment confirmed and build triggered',
    payment_id: paymentId,
    generate_id: payment.generate_id,
    status: 'building',
  });
});

/**
 * POST /api/admin/payments/:id/reject
 * Reject a payment
 * Updates payment status to rejected
 * Validates: Requirements 5.3
 */
admin.post('/payments/:id/reject', async (c) => {
  const paymentId = c.req.param('id');
  const adminUserId = c.get('userId');

  if (!paymentId) {
    throw new HTTPException(400, {
      message: 'Payment ID is required',
    });
  }

  // Get payment to verify it exists and is pending
  const payment = await c.env.DB.prepare(
    `SELECT id, status FROM payments WHERE id = ?`
  )
    .bind(paymentId)
    .first<{ id: string; status: string }>();

  if (!payment) {
    throw new HTTPException(404, {
      message: 'Payment not found',
    });
  }

  if (payment.status !== 'pending') {
    throw new HTTPException(400, {
      message: `Payment cannot be rejected. Current status: ${payment.status}`,
    });
  }

  const now = new Date().toISOString();

  // Update payment status to rejected
  await c.env.DB.prepare(
    `UPDATE payments 
     SET status = 'rejected', confirmed_by = ?, confirmed_at = ?
     WHERE id = ?`
  )
    .bind(adminUserId, now, paymentId)
    .run();

  return c.json({
    message: 'Payment rejected',
    payment_id: paymentId,
    status: 'rejected',
  });
});

admin.get('/payments/failed-builds', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT 
      p.id,
      p.user_id,
      p.generate_id,
      p.amount,
      p.status,
      p.created_at,
      u.email as user_email,
      g.url as generate_url,
      g.app_name as generate_app_name,
      g.package_name as generate_package_name,
      g.status as generate_status
    FROM payments p
    JOIN users u ON p.user_id = u.id
    JOIN generates g ON p.generate_id = g.id
    WHERE p.status = 'confirmed'
      AND g.status IN ('building', 'failed')
    ORDER BY p.created_at ASC`
  ).all();

  return c.json({
    payments: result.results || [],
  });
});

admin.post('/payments/:id/retry-build', async (c) => {
  const paymentId = c.req.param('id');

  if (!paymentId) {
    throw new HTTPException(400, {
      message: 'Payment ID is required',
    });
  }

  const payment = await c.env.DB.prepare(
    `SELECT
      p.id,
      p.user_id,
      p.generate_id,
      p.status as payment_status,
      g.url,
      g.build_type,
      g.app_name,
      g.package_name,
      g.icon_key,
      g.html_files_key,
      g.keystore_password,
      g.keystore_alias,
      g.enable_gps,
      g.enable_camera,
      g.status as generate_status
    FROM payments p
    JOIN generates g ON p.generate_id = g.id
    WHERE p.id = ?`
  )
    .bind(paymentId)
    .first<{
      id: string;
      user_id: string;
      generate_id: string;
      payment_status: string;
      url: string | null;
      build_type: string;
      app_name: string;
      package_name: string;
      icon_key: string;
      html_files_key: string | null;
      keystore_password: string | null;
      keystore_alias: string | null;
      enable_gps: number;
      enable_camera: number;
      generate_status: string;
    }>();

  if (!payment) {
    throw new HTTPException(404, {
      message: 'Payment not found',
    });
  }

  if (payment.payment_status !== 'confirmed') {
    throw new HTTPException(400, {
      message: `Payment is not confirmed. Current status: ${payment.payment_status}`,
    });
  }

  if (payment.generate_status === 'ready') {
    throw new HTTPException(400, {
      message: 'Generate is already completed',
    });
  }

  await c.env.DB.prepare(
    `UPDATE generates 
     SET status = 'building', error_message = NULL
     WHERE id = ?`
  )
    .bind(payment.generate_id)
    .run();

  const baseUrl = new URL(c.req.url).origin;
  const callbackUrl = new URL('/api/webhook/build-complete', c.req.url).toString();

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
            generate_id: payment.generate_id,
            api_url: baseUrl,
            url: payment.url,
            build_type: payment.build_type,
            app_name: payment.app_name,
            package_name: payment.package_name,
            keystore_password: payment.keystore_password,
            keystore_alias: payment.keystore_alias,
            callback_url: callbackUrl,
            enable_gps: Boolean(payment.enable_gps),
            enable_camera: Boolean(payment.enable_camera),
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      console.error('Failed to retry GitHub Actions build:', await githubResponse.text());
    }
  } catch (error) {
    console.error('Error retrying GitHub Actions build:', error);
  }

  return c.json({
    message: 'Build retriggered',
    payment_id: paymentId,
    generate_id: payment.generate_id,
    status: 'building',
  });
});

export default admin;
