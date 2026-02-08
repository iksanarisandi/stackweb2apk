'use client';

import { useState, useEffect, useCallback } from 'react';
import { getToken } from '@/lib';

interface KeystoreDownloadModalProps {
  generateId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface KeystoreInfo {
  keystore_url: string;
  password: string;
  alias: string;
  app_name: string;
}

interface ApiError {
  error: string;
  message: string;
}

export default function KeystoreDownloadModal({ generateId, isOpen, onClose }: KeystoreDownloadModalProps) {
  const [keystoreInfo, setKeystoreInfo] = useState<KeystoreInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchKeystoreInfo = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://web2apk-api.threadsauto.workers.dev/api/generate/${generateId}/keystore`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        setError(errorData.message || 'Failed to fetch keystore information');
        return;
      }

      setKeystoreInfo(data as KeystoreInfo);
    } catch {
      setError('Gagal menghubungi server. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [generateId]);

  useEffect(() => {
    if (isOpen && generateId) {
      fetchKeystoreInfo();
    }
  }, [isOpen, generateId, fetchKeystoreInfo]);

  const handleDownloadKeystore = async () => {
    if (!keystoreInfo) return;

    setIsDownloading(true);
    const token = getToken();
    if (!token) {
      alert('Session expired. Silakan login ulang.');
      setIsDownloading(false);
      return;
    }

    try {
      // Download file with authentication
      const response = await fetch(keystoreInfo.keystore_url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download keystore file');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${keystoreInfo.app_name.replace(/[^a-zA-Z0-9-_]/g, '_')}-keystore.jks`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download error:', error);
      alert('Gagal mendownload file keystore. Silakan coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'password' | 'alias') => {
    navigator.clipboard.writeText(text);
    if (type === 'password') {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } else {
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Download Keystore</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {keystoreInfo && (
            <div className="space-y-4">
              {/* Warning message */}
              <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
                <div className="flex items-start gap-3">
                  <WarningIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Simpan Keystore dengan Aman!</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Keystore diperlukan untuk update aplikasi di Play Store. File ini TIDAK dapat dipulihkan jika hilang.
                    </p>
                  </div>
                </div>
              </div>

              {/* App name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Aplikasi
                </label>
                <p className="text-gray-900">{keystoreInfo.app_name}</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password Keystore
                  <span className="text-xs font-normal text-gray-500 ml-2">(digunakan untuk keystore dan key)</span>
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono">
                    {keystoreInfo.password}
                  </code>
                  <button
                    onClick={() => copyToClipboard(keystoreInfo.password, 'password')}
                    className="btn-secondary text-sm"
                  >
                    {copiedPassword ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Alias */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Alias
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono">
                    {keystoreInfo.alias}
                  </code>
                  <button
                    onClick={() => copyToClipboard(keystoreInfo.alias, 'alias')}
                    className="btn-secondary text-sm"
                  >
                    {copiedAlias ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Info about keystore */}
              <div className="rounded-md bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">📋 Yang Anda Dapatkan:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✅ File Keystore (.jks) - untuk signing aplikasi</li>
                  <li>✅ Password - untuk membuka keystore (sama dengan key password)</li>
                  <li>✅ Key Alias - nama kunci di dalam keystore</li>
                </ul>
                <p className="text-sm text-blue-700 mt-3">
                  <strong>Tips:</strong> Simpan ketiga hal di atas di tempat yang aman. Anda akan memerlukannya untuk:
                </p>
                <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
                  <li>Upload update aplikasi ke Play Store</li>
                  <li>Sign versi baru aplikasi</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button onClick={onClose} className="btn-secondary">
            Tutup
          </button>
          {keystoreInfo && (
            <button
              onClick={handleDownloadKeystore}
              disabled={isDownloading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadIcon className="w-5 h-5 mr-2" />
                  Download Keystore
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
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
