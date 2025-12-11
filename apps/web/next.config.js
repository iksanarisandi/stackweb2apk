import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

// Setup Cloudflare bindings in development
if (process.env.NODE_ENV === 'development') {
  setupDevPlatform();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@web2apk/shared'],
  // Static export for Cloudflare Pages
  output: 'export',
  // Cloudflare Pages handles image optimization differently
  images: {
    unoptimized: true,
  },
  // Disable experimental features that may cause issues
  experimental: {
    // Enable edge runtime for Cloudflare compatibility
  },
};

export default nextConfig;
