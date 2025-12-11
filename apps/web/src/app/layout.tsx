import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Web2APK - Convert Website to Android APK',
  description:
    'Convert your website to Android WebView APK with custom icon and package name. Pay-per-generate Rp35.000 via QRIS.',
  keywords: ['web2apk', 'website to apk', 'android webview', 'convert website'],
  authors: [{ name: 'Web2APK' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        {children}
      </body>
    </html>
  );
}
