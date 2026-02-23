import { Hono } from 'hono';
import { webhookRateLimit } from '../middleware';
import type { Env, Variables } from '../index';

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

const telegram = new Hono<{ Bindings: Env; Variables: Variables }>();

async function sendTelegramMessage(env: Env, chatId: number, text: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[TELEGRAM] BOT_TOKEN not found in environment');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    console.log('[TELEGRAM] Sending message to chat_id:', chatId);
    console.log('[TELEGRAM] Message text:', text.substring(0, 100) + '...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    const result = await response.json();
    console.log('[TELEGRAM] Response:', result);

    if (!result.ok) {
      console.error('[TELEGRAM] Failed to send message:', result);
    }
  } catch (error) {
    console.error('[TELEGRAM] Error sending message:', error);
  }
}

telegram.post('/webhook', webhookRateLimit, async (c) => {
  const secret = c.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token');

  if (secret && headerSecret !== secret) {
    return c.json({ ok: false }, 401);
  }

  let update: TelegramUpdate;

  try {
    update = await c.req.json<TelegramUpdate>();
  } catch {
    return c.json({ ok: true });
  }

  const message = update.message;
  const text = message?.text?.trim();
  const fromId = message?.from?.id;
  const chatId = message?.chat.id;

  if (!message || !text || !fromId || !chatId) {
    return c.json({ ok: true });
  }

  const adminId = c.env.TELEGRAM_ADMIN_ID;

  if (!adminId || fromId.toString() !== adminId.toString()) {
    await sendTelegramMessage(c.env, chatId, 'Tidak diizinkan.');
    return c.json({ ok: true });
  }

  const lower = text.toLowerCase().trim();

  if (lower === '/start') {
    await sendTelegramMessage(
      c.env,
      chatId,
      'Halo Admin.\n\nPerintah tersedia:\n/pending - daftar pembayaran pending\n/check - daftar pembayaran sukses tapi build gagal/belum selesai\n/confirm <id> - konfirmasi pembayaran dan mulai build\n/retry <id> - ulangi build untuk pembayaran yang gagal'
    );
    return c.json({ ok: true });
  }

  if (lower === '/pending' || lower === '/pending ') {
    const result = await c.env.DB.prepare(
      `SELECT
        p.id,
        p.amount,
        p.created_at,
        u.email as user_email,
        g.url as generate_url,
        g.app_name as app_name
      FROM payments p
      JOIN users u ON p.user_id = u.id
      JOIN generates g ON p.generate_id = g.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
      LIMIT 10`
    ).all();

    const payments =
      (result.results as Array<{
        id: string;
        amount: number;
        created_at: string;
        user_email: string;
        generate_url: string;
        app_name: string;
      }>) || [];

    if (!payments.length) {
      await sendTelegramMessage(c.env, chatId, 'Tidak ada pembayaran pending.');
      return c.json({ ok: true });
    }

    const lines = payments.map((p, index) => {
      return `${index + 1}. ID: \`${p.id}\`\n   User: ${p.user_email}\n   App: ${p.app_name}\n   URL: ${p.generate_url}\n   Amount: ${p.amount}`;
    });

    await sendTelegramMessage(
      c.env,
      chatId,
      `Pembayaran pending (maks 10):\n\n${lines.join('\n\n')}`
    );

    return c.json({ ok: true });
  }

  if (lower === '/check' || lower === '/check ') {
    console.log('[TELEGRAM] /check command received');

    const result = await c.env.DB.prepare(
      `SELECT
        p.id,
        p.amount,
        p.confirmed_at,
        u.email as user_email,
        g.id as generate_id,
        g.url as generate_url,
        g.app_name as app_name,
        g.status as generate_status,
        g.error_message,
        g.created_at
      FROM payments p
      JOIN users u ON p.user_id = u.id
      JOIN generates g ON p.generate_id = g.id
      WHERE p.status IN ('confirmed', 'paid')
        AND g.status NOT IN ('ready', 'pending')
      ORDER BY p.created_at DESC
      LIMIT 20`
    ).all();

    const payments =
      (result.results as Array<{
        id: string;
        amount: number;
        confirmed_at: string | null;
        user_email: string;
        generate_id: string;
        generate_url: string;
        app_name: string;
        generate_status: string;
        error_message: string | null;
        created_at: string;
      }>) || [];

    console.log('[TELEGRAM] /check: Found', payments.length, 'problematic payments');

    if (!payments.length) {
      await sendTelegramMessage(c.env, chatId, '✅ Tidak ada pembayaran yang bermasalah. Semua build berjalan lancar!');
      return c.json({ ok: true });
    }

    const lines = payments.map((p, index) => {
      const statusEmoji = p.generate_status === 'failed' ? '❌' : '⚠️';
      const errorInfo = p.error_message ? `\n   Error: ${p.error_message.substring(0, 50)}...` : '';
      return `${statusEmoji} ${index + 1}. Payment ID: ${p.id}\n   User: ${p.user_email}\n   App: ${p.app_name}\n   Status: ${p.generate_status}${errorInfo}\n   Generate ID: ${p.generate_id}\n   Confirmed: ${p.confirmed_at ? new Date(p.confirmed_at).toLocaleString('id-ID') : 'N/A'}`;
    });

    await sendTelegramMessage(
      c.env,
      chatId,
      `⚠️ Pembayaran sukses tapi build bermasalah (${payments.length} item):\n\n${lines.join('\n\n')}\n\n💡 Gunakan /retry <payment_id> untuk mencoba ulang build.`
    );

    return c.json({ ok: true });
  }

  if (lower.startsWith('/confirm')) {
    const parts = text.split(' ').filter(Boolean);
    const paymentId = parts[1];

    if (!paymentId) {
      await sendTelegramMessage(c.env, chatId, 'Gunakan format: /confirm <payment_id>.');
      return c.json({ ok: true });
    }

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
        g.build_type,
        g.html_files_key,
        g.keystore_password,
        g.keystore_alias,
        g.enable_gps,
        g.enable_camera,
        g.version_code,
        g.version_name
      FROM payments p
      JOIN generates g ON p.generate_id = g.id
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
        build_type: string;
        html_files_key: string | null;
        keystore_password: string | null;
        keystore_alias: string | null;
        enable_gps: number;
        enable_camera: number;
        version_code: number;
        version_name: string;
      }>();

    if (!payment) {
      await sendTelegramMessage(c.env, chatId, `Pembayaran dengan ID ${paymentId} tidak ditemukan.`);
      return c.json({ ok: true });
    }

    if (payment.status !== 'pending') {
      await sendTelegramMessage(
        c.env,
        chatId,
        `Status pembayaran saat ini: ${payment.status}. Hanya bisa konfirmasi jika status pending.`
      );
      return c.json({ ok: true });
    }

    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `UPDATE payments 
       SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?
       WHERE id = ?`
    )
      .bind(null, now, paymentId)
      .run();

    await c.env.DB.prepare(
      `UPDATE generates 
       SET status = 'building'
       WHERE id = ?`
    )
      .bind(payment.generate_id)
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
              generate_id: payment.generate_id,
              api_url: baseUrl,
              url: payment.url,
              build_type: payment.build_type,
              app_name: payment.app_name,
              package_name: payment.package_name,
              keystore_password: payment.keystore_password,
              keystore_alias: payment.keystore_alias,
              enable_gps: Boolean(payment.enable_gps),
              enable_camera: Boolean(payment.enable_camera),
              version_code: payment.version_code || 1,
              version_name: payment.version_name || '1.0.0',
            },
          }),
        }
      );

      if (!githubResponse.ok) {
        console.error('Failed to trigger GitHub Actions from Telegram:', await githubResponse.text());
      }
    } catch (error) {
      console.error('Error triggering GitHub Actions from Telegram:', error);
    }

    await sendTelegramMessage(
      c.env,
      chatId,
      `Pembayaran ${paymentId} dikonfirmasi.\nGenerate ID: ${payment.generate_id}\nStatus: building.\nBuild APK sedang diproses di GitHub Actions.`
    );

    return c.json({ ok: true });
  }

  if (lower.startsWith('/retry')) {
    const parts = text.split(' ').filter(Boolean);
    const paymentId = parts[1];

    if (!paymentId) {
      await sendTelegramMessage(c.env, chatId, 'Gunakan format: /retry <payment_id>.');
      return c.json({ ok: true });
    }

    const payment = await c.env.DB.prepare(
      `SELECT 
        p.id,
        p.user_id,
        p.generate_id,
        p.status as payment_status,
        g.url,
        g.app_name,
        g.package_name,
        g.icon_key,
        g.build_type,
        g.html_files_key,
        g.keystore_password,
        g.keystore_alias,
        g.enable_gps,
        g.enable_camera,
        g.version_code,
        g.version_name,
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
        url: string;
        app_name: string;
        package_name: string;
        icon_key: string;
        build_type: string;
        html_files_key: string | null;
        keystore_password: string | null;
        keystore_alias: string | null;
        enable_gps: number;
        enable_camera: number;
        version_code: number;
        version_name: string;
        generate_status: string;
      }>();

    if (!payment) {
      await sendTelegramMessage(c.env, chatId, `Pembayaran dengan ID ${paymentId} tidak ditemukan.`);
      return c.json({ ok: true });
    }

    if (payment.payment_status !== 'confirmed') {
      await sendTelegramMessage(
        c.env,
        chatId,
        `Pembayaran belum dikonfirmasi. Status saat ini: ${payment.payment_status}.`
      );
      return c.json({ ok: true });
    }

    if (payment.generate_status === 'ready') {
      await sendTelegramMessage(c.env, chatId, 'Generate sudah selesai. Tidak bisa retry build.');
      return c.json({ ok: true });
    }

    await c.env.DB.prepare(
      `UPDATE generates 
       SET status = 'building', error_message = NULL
       WHERE id = ?`
    )
      .bind(payment.generate_id)
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
              generate_id: payment.generate_id,
              api_url: baseUrl,
              url: payment.url,
              build_type: payment.build_type,
              app_name: payment.app_name,
              package_name: payment.package_name,
              keystore_password: payment.keystore_password,
              keystore_alias: payment.keystore_alias,
              enable_gps: Boolean(payment.enable_gps),
              enable_camera: Boolean(payment.enable_camera),
              version_code: payment.version_code || 1,
              version_name: payment.version_name || '1.0.0',
            },
          }),
        }
      );

      if (!githubResponse.ok) {
        console.error('Failed to retry GitHub Actions build from Telegram:', await githubResponse.text());
      }
    } catch (error) {
      console.error('Error retrying GitHub Actions build from Telegram:', error);
    }

    await sendTelegramMessage(
      c.env,
      chatId,
      `Build untuk pembayaran ${paymentId} diulang.\nGenerate ID: ${payment.generate_id}\nStatus: building.`
    );

    return c.json({ ok: true });
  }

  await sendTelegramMessage(
    c.env,
    chatId,
    'Perintah tidak dikenali. Gunakan /start untuk melihat daftar perintah.'
  );

  return c.json({ ok: true });
});

export default telegram;

