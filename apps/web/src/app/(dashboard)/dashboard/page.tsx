'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authApiRequest, getToken } from '@/lib';
import type { Generate, GenerateStatus, BuildType } from '@web2apk/shared';
import KeystoreDownloadModal from './generate/KeystoreDownloadModal';

interface GeneratesResponse {
  generates: Generate[];
}

interface DownloadResponse {
  download_url: string;
  expires_at: string;
  aab_download_url?: string;
}

// Status badge component (Requirements 8.2, 8.3, 8.4, 8.5)
function StatusBadge({ status }: { status: GenerateStatus }) {
  const statusConfig: Record<GenerateStatus, { label: string; className: string }> = {
    pending: { label: 'Menunggu Pembayaran', className: 'badge-pending' },
    confirmed: { label: 'Pembayaran Dikonfirmasi', className: 'badge-confirmed' },
    building: { label: 'Sedang Diproses', className: 'badge-building' },
    ready: { label: 'Siap Download', className: 'badge-ready' },
    failed: { label: 'Gagal', className: 'badge-failed' },
  };

  const config = statusConfig[status];
  return <span className={config.className}>{config.label}</span>;
}

// Build type badge component
function BuildTypeBadge({ buildType }: { buildType: BuildType }) {
  const config = {
    webview: { label: 'WebView', className: 'badge-webview' },
    html: { label: 'HTML View', className: 'badge-html' },
  };
  const typeConfig = config[buildType];
  return <span className={typeConfig.className}>{typeConfig.label}</span>;
}

// Format date to Indonesian locale
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const [generates, setGenerates] = useState<Generate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [keystoreModalId, setKeystoreModalId] = useState<string | null>(null);

  useEffect(() => {
    fetchGenerates();
  }, []);

  const fetchGenerates = async () => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    const { data, error: apiError } = await authApiRequest<GeneratesResponse>(
      '/api/generate',
      token
    );

    setIsLoading(false);

    if (apiError) {
      setError(apiError.message);
      return;
    }

    if (data) {
      setGenerates(data.generates);
    }
  };

  // Handle APK/AAB download (Requirement 7.1, 7.2)
  const handleDownload = async (generateId: string, type: 'apk' | 'aab' = 'apk') => {
    const token = getToken();
    if (!token) return;

    setDownloadingId(generateId);

    const { data, error: apiError } = await authApiRequest<DownloadResponse>(
      `/api/generate/${generateId}/download`,
      token
    );

    setDownloadingId(null);

    if (apiError) {
      // Requirement 7.3: Handle expired download URL
      alert(apiError.message);
      return;
    }

    if (data) {
      // Open download URL in new tab based on type
      const url = type === 'aab' ? data.aab_download_url : data.download_url;
      
      if (url) {
        window.open(url, '_blank');
        // Refresh to update download count
        fetchGenerates();
      } else {
        alert('Download URL not available for this file type');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Kelola APK yang sudah Anda generate</p>
        </div>
        <Link href="/dashboard/generate" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Generate APK Baru
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {generates.length === 0 ? (
        <div className="card text-center py-12">
          <EmptyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Belum ada APK yang di-generate
          </h3>
          <p className="text-gray-600 mb-6">
            Mulai convert website Anda menjadi aplikasi Android
          </p>
          <Link href="/dashboard/generate" className="btn-primary">
            Generate APK Pertama
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {generates.map((generate) => (
            <GenerateCard
              key={generate.id}
              generate={generate}
              onDownload={handleDownload}
              isDownloading={downloadingId === generate.id}
              onKeystoreDownload={(id) => setKeystoreModalId(id)}
            />
          ))}
        </div>
      )}

      {/* Keystore Download Modal */}
      {keystoreModalId && (
        <KeystoreDownloadModal
          generateId={keystoreModalId}
          isOpen={!!keystoreModalId}
          onClose={() => setKeystoreModalId(null)}
        />
      )}
    </div>
  );
}


// Generate card component (Requirement 8.1)
function GenerateCard({
  generate,
  onDownload,
  isDownloading,
  onKeystoreDownload,
}: {
  generate: Generate;
  onDownload: (id: string, type: 'apk' | 'aab') => void;
  isDownloading: boolean;
  onKeystoreDownload: (id: string) => void;
}) {
  // Type assertion for extended fields that may exist on Generate from API
  const buildType = (generate as { build_type?: BuildType }).build_type;
  const aabKey = (generate as { aab_key?: string | null }).aab_key;
  const keystoreAlias = (generate as { keystore_alias?: string | null }).keystore_alias;
  const amount = (generate as { amount?: number }).amount;
  const versionCode = (generate as { version_code?: number }).version_code;
  const versionName = (generate as { version_name?: string }).version_name;

  const isHtmlView = buildType === 'html';
  const hasAab = !!aabKey;
  const hasKeystore = !!keystoreAlias;

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {generate.app_name}
            </h3>
            <StatusBadge status={generate.status} />
            {buildType && (
              <BuildTypeBadge buildType={buildType} />
            )}
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            {generate.url && (
              <p className="truncate">
                <span className="font-medium">URL:</span> {generate.url}
              </p>
            )}
            <p>
              <span className="font-medium">Package:</span> {generate.package_name}
            </p>
            <p>
              <span className="font-medium">Dibuat:</span> {formatDate(generate.created_at)}
            </p>
            {generate.download_count > 0 && (
              <p>
                <span className="font-medium">Download:</span> {generate.download_count}x
              </p>
            )}
            {isHtmlView && amount && (
               <p>
                 <span className="font-medium">Biaya:</span> Rp{amount.toLocaleString('id-ID')}
               </p>
             )}
            {versionCode && versionName && (
              <p>
                <span className="font-medium">Versi:</span> {versionName} (build {versionCode})
              </p>
            )}
          </div>

          {/* Build specific info */}
          {generate.status === 'ready' && (
            <div className="mt-3 p-3 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-900 mb-1">
                Build Ready - Download Tersedia:
              </p>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• APK untuk instalasi manual</li>
                <li>• AAB untuk Google Play Store</li>
                <li>• Keystore unik untuk update aplikasi</li>
              </ul>
            </div>
          )}

          {/* Error message for failed builds (Requirement 8.5) */}
          {generate.status === 'failed' && generate.error_message && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                <span className="font-medium">Error:</span> {generate.error_message}
              </p>
              <p className="text-sm text-red-600 mt-1">
                Hubungi support jika masalah berlanjut.
              </p>
            </div>
          )}

          {/* Building status with estimated time (Requirement 8.3) */}
          {generate.status === 'building' && (
            <div className="mt-3 p-3 bg-purple-50 rounded-lg flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-3"></div>
              <p className="text-sm text-purple-700">
                APK sedang di-build. Estimasi waktu: 3-5 menit
              </p>
            </div>
          )}

          {/* Pending payment status (Requirement 8.2) */}
          {generate.status === 'pending' && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">
                Menunggu konfirmasi pembayaran. Silakan selesaikan pembayaran via QRIS.
              </p>
            </div>
          )}
        </div>

        {/* Download buttons for ready APKs (Requirement 8.4) */}
        <div className="flex-shrink-0 flex flex-col gap-2 w-full sm:w-auto">
          {generate.status === 'ready' && (
            <>
              <button
                onClick={() => onDownload(generate.id, 'apk')}
                disabled={isDownloading}
                className="btn-success w-full sm:w-auto"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Memproses...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="w-5 h-5 mr-2" />
                    Download APK
                  </>
                )}
              </button>

              {/* AAB download button for HTML View */}
              {hasAab && (
                <button
                  onClick={() => onDownload(generate.id, 'aab')}
                  disabled={isDownloading}
                  className="btn-secondary w-full sm:w-auto border-purple-500 text-purple-700 hover:bg-purple-50"
                >
                  <DownloadIcon className="w-5 h-5 mr-2" />
                  Download AAB
                </button>
              )}

              {/* Keystore download button for HTML View */}
              {hasKeystore && (
                <button
                  onClick={() => onKeystoreDownload(generate.id)}
                  className="btn-secondary w-full sm:w-auto border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                >
                  <KeyIcon className="w-5 h-5 mr-2" />
                  Download Keystore
                </button>
              )}

              {/* Rebuild button - opens generate form in revision mode */}
              <Link
                href={`/dashboard/generate?revision=${generate.id}`}
                className="btn-secondary w-full sm:w-auto border-blue-500 text-blue-700 hover:bg-blue-50 flex items-center justify-center"
              >
                <RefreshIcon className="w-5 h-5 mr-2" />
                Rebuild / Edit
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Icon Components
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
