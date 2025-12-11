'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authApiRequest, getToken } from '@/lib';
import type { Generate, GenerateStatus } from '@web2apk/shared';

interface GeneratesResponse {
  generates: Generate[];
}

interface DownloadResponse {
  download_url: string;
  expires_at: string;
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

  // Handle APK download (Requirement 7.1, 7.2)
  const handleDownload = async (generateId: string) => {
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
      // Open download URL in new tab
      window.open(data.download_url, '_blank');
      // Refresh to update download count
      fetchGenerates();
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
            />
          ))}
        </div>
      )}
    </div>
  );
}


// Generate card component (Requirement 8.1)
function GenerateCard({
  generate,
  onDownload,
  isDownloading,
}: {
  generate: Generate;
  onDownload: (id: string) => void;
  isDownloading: boolean;
}) {
  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {generate.app_name}
            </h3>
            <StatusBadge status={generate.status} />
          </div>
          
          <div className="space-y-1 text-sm text-gray-600">
            <p className="truncate">
              <span className="font-medium">URL:</span> {generate.url}
            </p>
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
          </div>

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

        {/* Download button for ready APKs (Requirement 8.4) */}
        <div className="flex-shrink-0">
          {generate.status === 'ready' && (
            <button
              onClick={() => onDownload(generate.id)}
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
