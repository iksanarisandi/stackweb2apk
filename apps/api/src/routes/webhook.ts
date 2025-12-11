import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env, Variables } from '../index';

const webhook = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Build callback payload from GitHub Actions
 */
interface BuildCallbackPayload {
  generate_id: string;
  status: 'success' | 'failed';
  apk_key?: string;
  error_message?: string;
}

/**
 * POST /api/webhook/build-complete
 * Callback endpoint for GitHub Actions to report build results
 * Validates: Requirements 6.3, 6.4
 * 
 * Property 15: Build Callback Success Handling
 * For any successful build callback with APK key, the generate status SHALL change to "ready" and apk_key SHALL be populated.
 * 
 * Property 16: Build Callback Failure Handling
 * For any failed build callback with error message, the generate status SHALL change to "failed" and error_message SHALL be populated.
 */
webhook.post('/build-complete', async (c) => {
  // Verify webhook secret from header
  const webhookSecret = c.req.header('X-Webhook-Secret');
  
  if (!webhookSecret || webhookSecret !== c.env.WEBHOOK_SECRET) {
    throw new HTTPException(401, {
      message: 'Invalid webhook secret',
    });
  }

  // Parse request body
  const body = await c.req.json<BuildCallbackPayload>();

  // Validate required fields
  if (!body.generate_id) {
    throw new HTTPException(400, {
      message: 'Missing required field: generate_id',
    });
  }

  if (!body.status || !['success', 'failed'].includes(body.status)) {
    throw new HTTPException(400, {
      message: 'Invalid status. Must be "success" or "failed"',
    });
  }

  // Verify generate record exists and is in building status
  const generate = await c.env.DB.prepare(
    `SELECT id, status FROM generates WHERE id = ?`
  )
    .bind(body.generate_id)
    .first<{ id: string; status: string }>();

  if (!generate) {
    throw new HTTPException(404, {
      message: 'Generate record not found',
    });
  }

  // Only allow updates from building status
  if (generate.status !== 'building') {
    throw new HTTPException(400, {
      message: `Cannot update generate. Current status: ${generate.status}. Expected: building`,
    });
  }

  const now = new Date().toISOString();

  if (body.status === 'success') {
    // Property 15: Build Callback Success Handling
    // Update generate status to ready and store APK key
    if (!body.apk_key) {
      throw new HTTPException(400, {
        message: 'Missing required field for success: apk_key',
      });
    }

    await c.env.DB.prepare(
      `UPDATE generates 
       SET status = 'ready', apk_key = ?, completed_at = ?
       WHERE id = ?`
    )
      .bind(body.apk_key, now, body.generate_id)
      .run();

    return c.json({
      message: 'Build completed successfully',
      generate_id: body.generate_id,
      status: 'ready',
    });
  } else {
    // Property 16: Build Callback Failure Handling
    // Update generate status to failed and store error message
    const errorMessage = body.error_message || 'Build failed without error details';

    await c.env.DB.prepare(
      `UPDATE generates 
       SET status = 'failed', error_message = ?, completed_at = ?
       WHERE id = ?`
    )
      .bind(errorMessage, now, body.generate_id)
      .run();

    return c.json({
      message: 'Build failure recorded',
      generate_id: body.generate_id,
      status: 'failed',
    });
  }
});

export default webhook;
