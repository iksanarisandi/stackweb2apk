'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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

// Track if script is being loaded globally
let scriptLoading = false;
let scriptLoaded = false;

/**
 * Cloudflare Turnstile CAPTCHA Component
 * Fixed version that prevents re-rendering issues
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
    const mountedRef = useRef(true);
    const renderedRef = useRef(false);

    // Store callbacks in refs to avoid re-renders
    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    // Update refs when callbacks change
    useEffect(() => {
        onVerifyRef.current = onVerify;
        onErrorRef.current = onError;
        onExpireRef.current = onExpire;
    }, [onVerify, onError, onExpire]);

    const renderWidget = useCallback(() => {
        // Prevent multiple renders
        if (!containerRef.current || !window.turnstile || !mountedRef.current || renderedRef.current) {
            return;
        }

        // Mark as rendered to prevent duplicate renders
        renderedRef.current = true;

        // Render widget
        try {
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: TURNSTILE_SITE_KEY,
                callback: (token: string) => {
                    if (mountedRef.current) {
                        onVerifyRef.current(token);
                    }
                },
                'error-callback': () => {
                    if (mountedRef.current) {
                        onErrorRef.current?.();
                    }
                },
                'expired-callback': () => {
                    if (mountedRef.current) {
                        onExpireRef.current?.();
                        // Reset the widget when token expires
                        if (widgetIdRef.current && window.turnstile) {
                            window.turnstile.reset(widgetIdRef.current);
                        }
                    }
                },
                theme,
                size,
            });
        } catch {
            // Widget render failed, allow retry
            renderedRef.current = false;
        }
    }, [theme, size]); // Only depend on static props

    useEffect(() => {
        mountedRef.current = true;
        renderedRef.current = false;

        // If turnstile is already loaded, render immediately
        if (scriptLoaded && window.turnstile) {
            renderWidget();
            return;
        }

        // If script is being loaded, wait for it
        if (scriptLoading) {
            const originalCallback = window.onTurnstileLoad;
            window.onTurnstileLoad = () => {
                originalCallback?.();
                scriptLoaded = true;
                renderWidget();
            };
            return;
        }

        // Check if script already exists in DOM
        const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
        if (existingScript) {
            // Script exists, wait for it or it's already loaded
            if (window.turnstile) {
                scriptLoaded = true;
                renderWidget();
            } else {
                window.onTurnstileLoad = () => {
                    scriptLoaded = true;
                    renderWidget();
                };
            }
            return;
        }

        // Load Turnstile script
        scriptLoading = true;
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
        script.async = true;
        script.defer = true;

        window.onTurnstileLoad = () => {
            scriptLoaded = true;
            scriptLoading = false;
            renderWidget();
        };

        document.head.appendChild(script);

        return () => {
            // Cleanup on unmount
            mountedRef.current = false;
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Ignore cleanup errors
                }
                widgetIdRef.current = null;
            }
            renderedRef.current = false;
        };
    }, [renderWidget]);

    return (
        <div className="flex justify-center my-4">
            <div ref={containerRef} />
        </div>
    );
}

/**
 * Hook to manage Turnstile token state
 */
export function useTurnstile() {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = useCallback((newToken: string) => {
        setToken(newToken);
        setError(null);
    }, []);

    const handleError = useCallback(() => {
        setToken(null);
        setError('Verifikasi gagal. Silakan coba lagi.');
    }, []);

    const handleExpire = useCallback(() => {
        setToken(null);
    }, []);

    const reset = useCallback(() => {
        setToken(null);
        setError(null);
    }, []);

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
