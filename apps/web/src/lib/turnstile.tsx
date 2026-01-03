'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = '0x4AAAAAACKWi3_z-19LNbAc';

// Declare turnstile global interface
declare global {
    interface Window {
        turnstile?: {
            render: (
                container: string | HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'error-callback'?: () => void;
                    'expired-callback'?: () => void;
                    theme?: 'light' | 'dark' | 'auto';
                    size?: 'normal' | 'compact';
                }
            ) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
        onTurnstileLoad?: () => void;
    }
}

interface TurnstileProps {
    onVerify: (token: string) => void;
    onError?: () => void;
    onExpire?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
}

/**
 * Cloudflare Turnstile CAPTCHA Component
 * 
 * Usage:
 * ```tsx
 * const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
 * 
 * <Turnstile onVerify={setTurnstileToken} />
 * ```
 */
export function Turnstile({
    onVerify,
    onError,
    onExpire,
    theme = 'auto',
    size = 'normal'
}: TurnstileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const renderWidget = useCallback(() => {
        if (!containerRef.current || !window.turnstile) return;

        // Remove existing widget if any
        if (widgetIdRef.current) {
            try {
                window.turnstile.remove(widgetIdRef.current);
            } catch (e) {
                // Widget may already be removed
            }
        }

        // Clear container
        containerRef.current.innerHTML = '';

        // Render new widget
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token: string) => {
                setIsLoading(false);
                onVerify(token);
            },
            'error-callback': () => {
                setIsLoading(false);
                onError?.();
            },
            'expired-callback': () => {
                onExpire?.();
                // Reset the widget when token expires
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current);
                }
            },
            theme,
            size,
        });

        setIsLoading(false);
    }, [onVerify, onError, onExpire, theme, size]);

    useEffect(() => {
        // Check if turnstile script is already loaded
        if (window.turnstile) {
            renderWidget();
            return;
        }

        // Check if script is already in DOM
        const existingScript = document.querySelector('script[src*="turnstile"]');
        if (existingScript) {
            // Wait for it to load
            window.onTurnstileLoad = renderWidget;
            return;
        }

        // Load Turnstile script
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
        script.async = true;
        script.defer = true;

        window.onTurnstileLoad = renderWidget;

        document.head.appendChild(script);

        return () => {
            // Cleanup widget on unmount
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [renderWidget]);

    return (
        <div className="flex justify-center my-4">
            <div ref={containerRef} />
            {isLoading && (
                <div className="flex items-center justify-center p-4 text-gray-500 text-sm">
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Memuat verifikasi...
                </div>
            )}
        </div>
    );
}

/**
 * Hook to manage Turnstile token state
 */
export function useTurnstile() {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = (newToken: string) => {
        setToken(newToken);
        setError(null);
    };

    const handleError = () => {
        setToken(null);
        setError('Verifikasi gagal. Silakan coba lagi.');
    };

    const handleExpire = () => {
        setToken(null);
    };

    const reset = () => {
        setToken(null);
        setError(null);
    };

    return {
        token,
        error,
        isVerified: !!token,
        handleVerify,
        handleError,
        handleExpire,
        reset,
    };
}
