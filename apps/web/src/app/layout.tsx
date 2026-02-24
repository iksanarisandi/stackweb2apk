import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = 'https://web2apk.pages.dev';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Web2APK - Convert Website to APK Android | Tanpa Coding',
    template: '%s | Web2APK',
  },
  description:
    'Convert website to APK Android dalam 5 menit tanpa coding. Website to app converter terbaik dengan harga Rp35.000. Ubah website jadi aplikasi Android dengan mudah dan cepat.',
  keywords: [
    'convert website to apk android',
    'convert website to app without coding',
    'convert website to apk in 5 minutes',
    'website to apk',
    'convert website apk fast online',
    'website to android apk converter free',
    'convert website to app android easy',
    'website to app android',
    'make website into app android',
    'one click website to apk converter',
    'instant website to app android',
    'website to apk converter no code needed',
    'convert website to apk no coding',
    'website to apk builder online',
    'how to convert website to android app',
    'best website to apk converter',
    'how to make android app from website',
    'how to convert website to app android free',
    'convert html website to android app',
    'how long does it take to convert website to apk',
    'how to make apk from website url',
    'can i convert website to android app',
    'how to convert responsive website to android app',
    'web2apk',
    'website to apk converter',
    'website to android app',
    'convert web to apk',
    'ubah website jadi apk',
    'konversi website ke android',
  ],
  authors: [{ name: 'Web2APK', url: siteUrl }],
  creator: 'Web2APK',
  publisher: 'Web2APK',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: '/icon.webp',
    apple: '/icon.webp',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: siteUrl,
    siteName: 'Web2APK',
    title: 'Web2APK - Convert Website to APK Android | Tanpa Coding',
    description:
      'Convert website to APK Android dalam 5 menit tanpa coding. Website to app converter terbaik dengan harga Rp35.000.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Web2APK - Convert Website to Android APK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Web2APK - Convert Website to APK Android',
    description:
      'Convert website to APK Android dalam 5 menit tanpa coding. Harga hanya Rp35.000 per APK.',
    images: [`${siteUrl}/og-image.png`],
    creator: '@web2apk',
  },
  category: 'technology',
  classification: 'Web Application Converter',
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
      <head>
        <link rel="icon" href="/icon.webp" type="image/webp" sizes="any" />
        <link rel="apple-touch-icon" href="/icon.webp" />
      </head>
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        {children}
      </body>
    </html>
  );
}
