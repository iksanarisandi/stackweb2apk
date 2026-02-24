import Link from 'next/link';

// JSON-LD Schema for SEO
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Web2APK',
  url: 'https://web2apk.pages.dev',
  logo: 'https://web2apk.pages.dev/logo.png',
  description:
    'Convert website to APK Android dalam 5 menit tanpa coding. Website to app converter terbaik.',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: ['Indonesian', 'English'],
  },
};

const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Web2APK',
  url: 'https://web2apk.pages.dev',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '150000',
    priceCurrency: 'IDR',
    description: 'Convert website to APK Android dengan AAB untuk Play Store',
  },
  featureList: [
    'Convert website to APK Android',
    'No coding required',
    'Custom icon and branding',
    'Fast 3-5 minutes processing',
    'Signed APK ready to install',
  ],
  screenshot: 'https://web2apk.pages.dev/screenshot.png',
  softwareVersion: '1.0',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '150',
    bestRating: '5',
    worstRating: '1',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Apa itu Web2APK?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Web2APK adalah layanan online untuk convert website to APK Android tanpa coding. Cukup masukkan URL website Anda, dan dalam 5 menit APK siap didownload dan diinstal di smartphone Android.',
      },
    },
    {
      '@type': 'Question',
      name: 'Berapa lama proses convert website to APK?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Proses convert website to APK hanya membutuhkan waktu 3-5 menit. Setelah Anda memasukkan URL dan mengatur kustomisasi, sistem kami akan memproses dan APK siap didownload.',
      },
    },
    {
      '@type': 'Question',
      name: 'Apakah perlu kemampuan coding untuk convert website to app?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Tidak perlu kemampuan coding sama sekali! Web2APK dirancang untuk siapa saja yang ingin convert website to app android easy. Cukup masukkan URL, upload icon, dan APK Anda siap.',
      },
    },
    {
      '@type': 'Question',
      name: 'Website apa saja yang bisa dikonversi menjadi APK?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Semua website yang responsif bisa dikonversi menjadi APK, termasuk website HTML, WordPress, web app, PWA, dan platform lainnya. Website akan ditampilkan dalam WebView Android.',
      },
    },
    {
      '@type': 'Question',
      name: 'Berapa biaya untuk convert website to APK?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Biaya untuk convert website to APK android adalah Rp150.000 per APK (diskon 50% dari Rp300.000). Termasuk AAB untuk Play Store, keystore unik, API Level 35, dan fitur update versi. Pembayaran mudah via QRIS.',
      },
    },
    {
      '@type': 'Question',
      name: 'Apakah APK hasil konversi bisa dipublish ke Google Play Store?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ya! Setiap build sudah termasuk file AAB (Android App Bundle) yang siap diupload ke Google Play Store, plus keystore unik untuk update aplikasi di masa depan. Menggunakan API Level 35 terbaru.',
      },
    },
    {
      '@type': 'Question',
      name: 'Bagaimana cara kustomisasi icon aplikasi?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Anda bisa upload icon PNG dengan ukuran 512x512 pixel untuk tampilan profesional di HP pengguna. Icon ini akan muncul di home screen dan app drawer.',
      },
    },
    {
      '@type': 'Question',
      name: 'Apakah APK sudah di-sign dan siap instal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ya, semua APK yang dihasilkan Web2APK sudah ditandatangani (signed) dengan keystore kami, sehingga siap diinstal langsung di HP Android tanpa perlu proses tambahan.',
      },
    },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://web2apk.pages.dev',
    },
  ],
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* JSON-LD Schema Scripts */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <nav
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          aria-label="Main navigation"
        >
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" aria-label="Web2APK Home">
                <span className="text-xl font-bold text-blue-600">Web2APK</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/articles"
                className="text-gray-600 hover:text-gray-900"
              >
                Artikel
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-gray-900">
                Login
              </Link>
              <Link href="/register" className="btn-primary">
                Daftar Gratis
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section
        className="flex-1 flex items-center justify-center bg-gradient-to-b from-blue-50 to-white"
        aria-labelledby="hero-heading"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mb-6">
            ✨ Tanpa coding, tanpa ribet
          </div>
          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6"
          >
            Convert Website to APK Android{' '}
            <span className="text-blue-600">dalam Hitungan Menit</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Punya website atau web app? Convert website to app android easy
            dengan Web2APK. Cukup masukkan URL, upload icon, dan APK siap
            didownload! Website to apk converter terbaik tanpa coding.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              href="/register"
              className="btn-primary px-8 py-3 text-base w-full sm:w-auto"
            >
              Buat APK Sekarang
            </Link>
            <Link
              href="/login"
              className="btn-secondary px-8 py-3 text-base w-full sm:w-auto"
            >
              Sudah Punya Akun
            </Link>
          </div>

          {/* Price Badge */}
          <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="line-through text-green-600 mr-2">Rp300.000</span>
            <span className="font-bold">Rp150.000</span> per APK
          </div>

          {/* Demo Link */}
          <div className="mt-6">
            <a
              href="https://s.id/ePm87"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Lihat contoh APK hasil Web2APK
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        className="py-16 bg-gray-50"
        aria-labelledby="how-it-works-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-bold text-center text-gray-900 mb-4"
          >
            Convert Website to APK dalam 3 Langkah
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-xl mx-auto">
            Tidak perlu Android Studio, tidak perlu coding. Website to app
            converter yang instant dan mudah.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <article className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Masukkan URL Website
              </h3>
              <p className="text-gray-600">
                Cukup paste URL website atau web app yang ingin dijadikan APK
                Android
              </p>
            </article>

            <article className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Kustomisasi Aplikasi
              </h3>
              <p className="text-gray-600">
                Tentukan nama app, upload icon 512x512, dan atur package name
                sesuai keinginan
              </p>
            </article>

            <article className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Download &amp; Bagikan
              </h3>
              <p className="text-gray-600">
                Proses convert website to apk in 5 minutes, APK siap didownload
                dan dibagikan
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="features-heading"
            className="text-2xl font-bold text-center text-gray-900 mb-4"
          >
            Kenapa Pilih Web2APK sebagai Website to APK Converter?
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-xl mx-auto">
            Solusi tercepat untuk convert website to app android tanpa coding
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <article className="card text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Custom Icon &amp; Branding
              </h3>
              <p className="text-gray-600">
                Upload icon 512x512 PNG untuk tampilan profesional di HP
                pengguna Android
              </p>
            </article>

            <article className="card text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Proses Super Cepat
              </h3>
              <p className="text-gray-600">
                Convert website apk fast online hanya 3-5 menit, langsung siap
                download dan share
              </p>
            </article>

            <article className="card text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                APK Sudah Di-sign
              </h3>
              <p className="text-gray-600">
                APK sudah ditandatangani, siap diinstal langsung di HP Android
                manapun
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-16 bg-gray-50" aria-labelledby="more-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="more-features"
            className="text-2xl font-bold text-center text-gray-900 mb-12"
          >
            Fitur Lengkap Website to Android APK Converter
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                One Click Converter
              </h3>
              <p className="text-sm text-gray-600">
                One click website to apk converter yang instant dan mudah
                digunakan
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">💻</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                No Code Needed
              </h3>
              <p className="text-sm text-gray-600">
                Website to apk converter no code needed - tanpa kemampuan
                programming
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">🌐</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Support All Website
              </h3>
              <p className="text-sm text-gray-600">
                Convert HTML website to android app, WordPress, dan platform
                lainnya
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Responsive Ready
              </h3>
              <p className="text-sm text-gray-600">
                Convert responsive website to android app dengan tampilan
                optimal
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white" aria-labelledby="faq-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="faq-heading"
            className="text-2xl font-bold text-center text-gray-900 mb-4"
          >
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-center text-gray-600 mb-12">
            Semua yang perlu Anda ketahui tentang convert website to APK Android
          </p>

          <div className="space-y-6">
            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Apa itu Web2APK?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Web2APK adalah layanan online untuk convert website to APK
                Android tanpa coding. Cukup masukkan URL website Anda, dan dalam
                5 menit APK siap didownload dan diinstal di smartphone Android.
                Ini adalah website to apk converter terbaik dan tercepat di
                Indonesia.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Berapa lama proses convert website to APK?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Proses convert website to apk in 5 minutes atau kurang. Setelah
                Anda memasukkan URL dan mengatur kustomisasi, sistem kami akan
                memproses dengan cepat dan APK siap didownload. Ini adalah
                convert website apk fast online yang paling efisien.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Apakah perlu kemampuan coding?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Tidak perlu kemampuan coding sama sekali! Web2APK adalah convert
                website to app without coding. Dirancang untuk siapa saja yang
                ingin convert website to app android easy. Cukup masukkan URL,
                upload icon, dan APK Anda siap.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Website apa saja yang bisa dikonversi?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Semua website yang responsif bisa dikonversi! Anda bisa convert
                HTML website to android app, WordPress, Wix, Shopify, web app,
                PWA, dan platform lainnya. Website akan ditampilkan dalam
                WebView Android dengan performa optimal.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Berapa biaya untuk convert website to APK?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Biaya untuk convert website to APK android adalah Rp150.000 per
                APK (diskon 50% dari Rp300.000). Termasuk AAB untuk Play Store,
                keystore unik, API Level 35, dan fitur update versi. Pembayaran
                mudah via QRIS.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Apakah APK bisa dipublish ke Play Store?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Ya! APK yang dihasilkan sudah di-sign dan siap diinstal. Setiap
                build juga menyertakan file AAB (Android App Bundle) yang siap
                diupload ke Google Play Store, plus keystore unik untuk update
                aplikasi di masa depan. Menggunakan API Level 35 terbaru.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Bagaimana cara kustomisasi icon aplikasi?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Anda bisa upload icon PNG dengan ukuran 512x512 pixel untuk
                tampilan profesional. Icon ini akan muncul di home screen dan
                app drawer Android. Pastikan icon memiliki background
                transparan atau solid untuk hasil terbaik.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-lg">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-semibold text-gray-900">
                <span>Apakah APK sudah di-sign dan siap instal?</span>
                <svg
                  className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                Ya, semua APK yang dihasilkan Web2APK sudah ditandatangani
                (signed) dengan keystore kami. APK siap diinstal langsung di HP
                Android tanpa perlu proses tambahan. Make website into app
                android jadi sangat mudah!
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Features Available Section */}
      <section
        className="py-12 bg-gradient-to-r from-green-600 to-green-700"
        aria-labelledby="features-available-heading"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
            ✅ Tersedia Sekarang
          </div>
          <h2
            id="features-available-heading"
            className="text-2xl font-bold text-white mb-3"
          >
            Siap Upload ke Play Store dengan AAB
          </h2>
          <p className="text-green-100 max-w-xl mx-auto">
            Setiap build sudah termasuk file AAB (Android App Bundle) yang siap
            diupload ke Google Play Store, keystore unik untuk update aplikasi,
            dan menggunakan API Level 35 terbaru.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-50" aria-labelledby="cta-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="cta-heading" className="text-2xl font-bold text-gray-900 mb-4">
            Siap Convert Website to APK Android?
          </h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Daftar sekarang dan convert website to app tanpa coding. Best
            website to apk converter dengan harga terjangkau!
          </p>
          <Link
            href="/register"
            className="btn-primary px-8 py-3 text-base inline-block"
          >
            Daftar Gratis Sekarang
          </Link>
        </div>
      </section>

      {/* Articles Preview */}
      <section className="py-16 bg-white" aria-labelledby="articles-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="articles-heading"
            className="text-2xl font-bold text-center text-gray-900 mb-4"
          >
            Pelajari Lebih Lanjut
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Baca artikel panduan lengkap tentang convert website to android app
          </p>
          <div className="text-center">
            <Link
              href="/articles"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              Lihat Semua Artikel
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-semibold mb-4">Web2APK</h3>
              <p className="text-sm">
                Convert website to APK Android dalam 5 menit. Website to app
                converter terbaik tanpa coding.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/articles" className="hover:text-white">
                    Artikel
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white">
                    Daftar
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white">
                    Login
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Keyword</h3>
              <p className="text-sm">
                convert website to apk android, website to app, website to apk
                converter, make website into app android
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-sm">
              &copy; {new Date().getFullYear()} Web2APK - Convert Website to APK
              Android. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
