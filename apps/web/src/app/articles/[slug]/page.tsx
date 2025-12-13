import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articles, getArticleBySlug, getAllArticleSlugs } from '@/lib/articles';

interface PageProps {
    params: Promise<{ slug: string }>;
}

// Generate static params for all articles
export async function generateStaticParams() {
    return getAllArticleSlugs().map((slug) => ({ slug }));
}

// Generate metadata for each article
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const article = getArticleBySlug(slug);

    if (!article) {
        return {
            title: 'Artikel Tidak Ditemukan',
        };
    }

    return {
        title: article.title,
        description: article.description,
        keywords: article.keywords,
        authors: [{ name: article.author }],
        openGraph: {
            title: article.title,
            description: article.description,
            type: 'article',
            publishedTime: article.publishedAt,
            modifiedTime: article.updatedAt,
            authors: [article.author],
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.description,
        },
    };
}

export default async function ArticlePage({ params }: PageProps) {
    const { slug } = await params;
    const article = getArticleBySlug(slug);

    if (!article) {
        notFound();
    }

    // JSON-LD for article
    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.description,
        author: {
            '@type': 'Organization',
            name: article.author,
        },
        publisher: {
            '@type': 'Organization',
            name: 'Web2APK',
            logo: {
                '@type': 'ImageObject',
                url: 'https://web2apk.pages.dev/logo.png',
            },
        },
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://web2apk.pages.dev/articles/${article.slug}`,
        },
        keywords: article.keywords.join(', '),
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
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Artikel',
                item: 'https://web2apk.pages.dev/articles',
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: article.title,
                item: `https://web2apk.pages.dev/articles/${article.slug}`,
            },
        ],
    };

    // Get related articles (excluding current)
    const relatedArticles = articles
        .filter((a) => a.slug !== article.slug)
        .slice(0, 3);

    return (
        <main className="min-h-screen flex flex-col">
            {/* JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
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

            {/* Breadcrumb */}
            <nav
                className="bg-gray-50 py-3 border-b border-gray-200"
                aria-label="Breadcrumb"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <ol className="flex items-center space-x-2 text-sm text-gray-600">
                        <li>
                            <Link href="/" className="hover:text-blue-600">
                                Home
                            </Link>
                        </li>
                        <li>/</li>
                        <li>
                            <Link href="/articles" className="hover:text-blue-600">
                                Artikel
                            </Link>
                        </li>
                        <li>/</li>
                        <li className="text-gray-900 font-medium truncate max-w-xs">
                            {article.title}
                        </li>
                    </ol>
                </div>
            </nav>

            {/* Article Content */}
            <article className="py-12 bg-white flex-1">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Article Header */}
                    <header className="mb-8">
                        <div className="flex items-center text-sm text-gray-500 mb-4">
                            <time dateTime={article.publishedAt}>
                                {new Date(article.publishedAt).toLocaleDateString('id-ID', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </time>
                            <span className="mx-2">•</span>
                            <span>{article.readTime} baca</span>
                            <span className="mx-2">•</span>
                            <span>Oleh {article.author}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                            {article.title}
                        </h1>
                        <p className="text-xl text-gray-600">{article.description}</p>
                        <div className="flex flex-wrap gap-2 mt-4">
                            {article.keywords.map((keyword) => (
                                <span
                                    key={keyword}
                                    className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full"
                                >
                                    {keyword}
                                </span>
                            ))}
                        </div>
                    </header>

                    {/* Article Body */}
                    <div
                        className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-blue-600 prose-strong:text-gray-900"
                        dangerouslySetInnerHTML={{ __html: formatContent(article.content) }}
                    />

                    {/* CTA Box */}
                    <div className="mt-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-center">
                        <h2 className="text-2xl font-bold text-white mb-3">
                            Siap Convert Website to APK?
                        </h2>
                        <p className="text-blue-100 mb-6">
                            Sekarang Anda sudah tahu caranya. Waktunya mengubah website Anda
                            menjadi aplikasi Android!
                        </p>
                        <Link
                            href="/register"
                            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                        >
                            Mulai Sekarang - Rp35.000/APK
                        </Link>
                    </div>
                </div>
            </article>

            {/* Related Articles */}
            <section className="py-12 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">
                        Artikel Terkait
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        {relatedArticles.map((relatedArticle) => (
                            <article
                                key={relatedArticle.slug}
                                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                            >
                                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                                    <Link
                                        href={`/articles/${relatedArticle.slug}`}
                                        className="hover:text-blue-600"
                                    >
                                        {relatedArticle.title}
                                    </Link>
                                </h3>
                                <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                                    {relatedArticle.description}
                                </p>
                                <Link
                                    href={`/articles/${relatedArticle.slug}`}
                                    className="text-blue-600 text-sm font-medium hover:text-blue-700"
                                >
                                    Baca →
                                </Link>
                            </article>
                        ))}
                    </div>
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

// Helper function to convert markdown-like content to HTML
function formatContent(content: string): string {
    return content
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Links with register path
        .replace(
            /\[(.*?)\]\(\/register\)/g,
            '<a href="/register" class="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors no-underline mt-4">$1</a>'
        )
        // Regular links
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        // Unordered lists
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
        // Checkmarks
        .replace(/^- ✅ (.*$)/gim, '<li class="flex items-start"><span class="text-green-500 mr-2">✅</span>$1</li>')
        .replace(/^- ❌ (.*$)/gim, '<li class="flex items-start"><span class="text-red-500 mr-2">❌</span>$1</li>')
        .replace(/^- ⚠️ (.*$)/gim, '<li class="flex items-start"><span class="text-yellow-500 mr-2">⚠️</span>$1</li>')
        // Code blocks
        .replace(/```html([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto"><code>$1</code></pre>')
        .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto"><code>$1</code></pre>')
        // Inline code
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
        // Tables
        .replace(
            /\|(.+)\|\n\|[-|]+\|\n((?:\|.+\|\n?)+)/g,
            (_, header, body) => {
                const headers = header.split('|').filter(Boolean).map((h: string) => `<th class="border px-4 py-2 bg-gray-100">${h.trim()}</th>`).join('');
                const rows = body.trim().split('\n').map((row: string) => {
                    const cells = row.split('|').filter(Boolean).map((cell: string) => `<td class="border px-4 py-2">${cell.trim()}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');
                return `<table class="w-full border-collapse my-4"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
            }
        )
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br />');
}
