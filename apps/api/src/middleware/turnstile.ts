import { Context, Next } from 'hono';
import type { Env, Variables } from '../index';

/**
 * Turnstile verification response from Cloudflare
 */
interface TurnstileVerifyResponse {
    success: boolean;
    'error-codes'?: string[];
    challenge_ts?: string;
    hostname?: string;
}

/**
 * Verify Turnstile token with Cloudflare
 * @param token - Turnstile response token from client
 * @param ip - Client IP address
 * @param secret - Turnstile secret key
 * @returns true if verification passes
 */
export async function verifyTurnstile(
    token: string,
    ip: string,
    secret: string
): Promise<{ success: boolean; error?: string }> {
    if (!token) {
        return { success: false, error: 'Turnstile token is required' };
    }

    try {
        const response = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    secret: secret,
                    response: token,
                    remoteip: ip,
                }),
            }
        );

        const data = await response.json<TurnstileVerifyResponse>();

        if (!data.success) {
            const errorCodes = data['error-codes']?.join(', ') || 'unknown';
            return { success: false, error: `Verification failed: ${errorCodes}` };
        }

        return { success: true };
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return { success: false, error: 'Verification service unavailable' };
    }
}

/**
 * Middleware to verify Turnstile token
 * Expects 'turnstile_token' in request body
 */
export function turnstileMiddleware() {
    return async (
        c: Context<{ Bindings: Env; Variables: Variables }>,
        next: Next
    ) => {
        // Get client IP
        const clientIp =
            c.req.header('cf-connecting-ip') ||
            c.req.header('x-forwarded-for')?.split(',')[0] ||
            'unknown';

        // Clone request to read body without consuming it
        const clonedReq = c.req.raw.clone();

        try {
            let turnstileToken: string | undefined;

            // Try to get token from JSON body
            const contentType = c.req.header('content-type') || '';

            if (contentType.includes('application/json')) {
                const body = await clonedReq.json() as { turnstile_token?: string };
                turnstileToken = body.turnstile_token;
            } else if (contentType.includes('multipart/form-data')) {
                const formData = await clonedReq.formData();
                turnstileToken = formData.get('turnstile_token') as string | null || undefined;
            }

            if (!turnstileToken) {
                return c.json(
                    {
                        error: 'CAPTCHA_REQUIRED',
                        message: 'Silakan selesaikan verifikasi CAPTCHA',
                    },
                    400
                );
            }

            const result = await verifyTurnstile(turnstileToken, clientIp, c.env.TURNSTILE_SECRET);

            if (!result.success) {
                return c.json(
                    {
                        error: 'CAPTCHA_FAILED',
                        message: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.',
                        details: result.error,
                    },
                    400
                );
            }

            await next();
        } catch (error) {
            console.error('Turnstile middleware error:', error);
            return c.json(
                {
                    error: 'VERIFICATION_ERROR',
                    message: 'Gagal memverifikasi CAPTCHA',
                },
                500
            );
        }
    };
}
