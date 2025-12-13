import Link from 'next/link';
import type { Metadata } from 'next';
import { articles } from '@/lib/articles';

export const metadata: Metadata = {
    title: 'Artikel & Panduan Convert Website to APK',
    description:
        'Kumpulan artikel dan panduan lengkap tentang cara convert website to APK Android, website to app converter, dan tips optimasi.',
    keywords: [
        'artikel convert website to apk',
        'panduan website to app',
        'tutorial apk converter',
        'tips convert website android',
    ],
    openGraph: {
        title: 'Artikel & Panduan Convert Website to APK | Web2APK',
        description:
            'Kumpulan artikel dan panduan lengkap tentang cara convert website to APK Android.',
        type: 'website',
    },
};

export default function ArticlesPage() {
    return (
        <main className="min-h-screen flex flex-col">
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
                                className="text-blue-600 font-medium"
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

            {/* Breadcrumb */}
            <nav className="bg-gray-50 py-3 border-b border-gray-200" aria-label="Breadcrumb">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <ol className="flex items-center space-x-2 text-sm text-gray-600">
                        <li>
                            <Link href="/" className="hover:text-blue-600">Home</Link>
                        </li>
                        <li>/</li>
                        <li className="text-gray-900 font-medium">Artikel</li>
                    </ol>
                </div>
            </nav>

            {/* Hero */}
            <section className="bg-gradient-to-b from-blue-50 to-white py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                        Artikel & Panduan
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Pelajari cara convert website to APK Android, tips optimasi, dan
                        panduan lengkap untuk mengubah website menjadi aplikasi mobile.
                    </p>
                </div>
            </section>

            {/* Articles Grid */}
            <section className="py-12 bg-white flex-1">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {articles.map((article) => (
                            <article
                                key={article.slug}
                                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                <div className="p-6">
                                    <div className="flex items-center text-sm text-gray-500 mb-3">
                                        <time dateTime={article.publishedAt}>
                                            {new Date(article.publishedAt).toLocaleDateString('id-ID', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                        </time>
                                        <span className="mx-2">•</span>
                                        <span>{article.readTime} baca</span>
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
                                        <Link
                                            href={`/articles/${article.slug}`}
                                            className="hover:text-blue-600"
                                        >
                                            {article.title}
                                        </Link>
                                    </h2>
                                    <p className="text-gray-600 mb-4 line-clamp-3">
                                        {article.description}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {article.keywords.slice(0, 2).map((keyword) => (
                                            <span
                                                key={keyword}
                                                className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded"
                                            >
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>
                                    <Link
                                        href={`/articles/${article.slug}`}
                                        className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center"
                                    >
                                        Baca Selengkapnya
                                        <svg
                                            className="w-4 h-4 ml-1"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5l7 7-7 7"
                                            />
                                        </svg>
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-12 bg-blue-600">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">
                        Siap Convert Website to APK?
                    </h2>
                    <p className="text-blue-100 mb-6">
                        Setelah membaca artikel, waktunya praktek! Convert website Anda
                        menjadi aplikasi Android dalam 5 menit.
                    </p>
                    <Link
                        href="/register"
                        className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                    >
                        Mulai Sekarang - Rp35.000/APK
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm">
                        &copy; {new Date().getFullYear()} Web2APK - Convert Website to APK
                        Android. All rights reserved.
                    </p>
                </div>
            </footer>
        </main>
    );
}
