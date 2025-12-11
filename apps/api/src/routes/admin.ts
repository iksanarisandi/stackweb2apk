import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, adminMiddleware } from '../middleware';
import type { Env, Variables } from '../index';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth and admin middleware to all admin routes
admin.use('*', authMiddleware);
admin.use('*', adminMiddleware);

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
      g.app_name,
      g.package_name,
      g.icon_key,
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
      url: string;
      app_name: string;
      package_name: string;
      icon_key: string;
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

  // Generate presigned URL for icon (for GitHub Actions to download)
  // Note: R2 presigned URLs require additional setup, using direct key for now
  const iconUrl = `https://${c.env.STORAGE}.r2.cloudflarestorage.com/${payment.icon_key}`;

  // Trigger GitHub Actions workflow via repository dispatch (Requirement 5.4)
  // The callback URL will be called by GitHub Actions when build completes
  const callbackUrl = new URL('/api/webhook/build-complete', c.req.url).toString();

  try {
    const githubResponse = await fetch(
      'https://api.github.com/repos/AcidOP/web2apk-builder/dispatches',
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
            url: payment.url,
            app_name: payment.app_name,
            package_name: payment.package_name,
            icon_url: iconUrl,
            callback_url: callbackUrl,
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

export default admin;
