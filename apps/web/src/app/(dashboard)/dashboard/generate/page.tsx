'use client';

import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib';
import { generateWhatsAppUrl } from '@web2apk/shared';
import PaymentModal from './PaymentModal';

interface GenerateResponse {
  id: string;
  status: string;
  message: string;
  payment: {
    id: string;
    amount: number;
  };
}

interface FieldErrors {
  url?: string;
  app_name?: string;
  package_name?: string;
  icon?: string;
}

export default function GenerateFormPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [url, setUrl] = useState('');
  const [appName, setAppName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResponse | null>(null);

  // Validate form fields (Requirements 3.2, 3.3, 3.4, 3.5)
  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    // URL validation - must be HTTPS (Requirement 3.2)
    if (!url) {
      errors.url = 'URL wajib diisi';
    } else if (!url.startsWith('https://')) {
      errors.url = 'URL harus menggunakan HTTPS';
    } else {
      try {
        new URL(url);
      } catch {
        errors.url = 'Format URL tidak valid';
      }
    }

    // App name validation
    if (!appName) {
      errors.app_name = 'Nama aplikasi wajib diisi';
    } else if (appName.length > 50) {
      errors.app_name = 'Nama aplikasi maksimal 50 karakter';
    }

    // Package name validation (Requirement 3.3)
    if (!packageName) {
      errors.package_name = 'Package name wajib diisi';
    } else if (!/^com\.[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(packageName)) {
      errors.package_name = 'Format: com.domain.name (huruf kecil dan angka)';
    }

    // Icon validation (Requirements 3.4, 3.5)
    if (!iconFile) {
      errors.icon = 'Icon wajib diupload';
    } else {
      // Check file type
      if (!iconFile.type.includes('png')) {
        errors.icon = 'Icon harus berformat PNG';
      }
      // Check file size - max 1MB (Requirement 3.5)
      if (iconFile.size > 1048576) {
        errors.icon = 'Ukuran icon maksimal 1MB';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle icon file selection with preview
  const handleIconChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIconFile(file);
    setFieldErrors((prev) => ({ ...prev, icon: undefined }));

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Validate icon dimensions (Requirement 3.4)
    const img = new Image();
    img.onload = () => {
      if (img.width !== 512 || img.height !== 512) {
        setFieldErrors((prev) => ({
          ...prev,
          icon: `Icon harus 512x512 pixel (saat ini: ${img.width}x${img.height})`,
        }));
      }
    };
    img.src = URL.createObjectURL(file);
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('url', url);
      formData.append('app_name', appName);
      formData.append('package_name', packageName);
      if (iconFile) {
        formData.append('icon', iconFile);
      }

      const response = await fetch('https://web2apk-api.threadsauto.workers.dev/api/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details?.issues) {
          const serverErrors: FieldErrors = {};
          data.details.issues.forEach((issue: { path: string; message: string }) => {
            serverErrors[issue.path as keyof FieldErrors] = issue.message;
          });
          setFieldErrors(serverErrors);
        } else {
          setError(data.message || 'Terjadi kesalahan');
        }
        return;
      }

      // Success - show payment modal (Requirement 3.6)
      setGenerateResult(data);
      setShowPaymentModal(true);
    } catch {
      setError('Gagal menghubungi server. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle WhatsApp confirmation click
  const handleWhatsAppConfirm = () => {
    if (!generateResult) return;

    const user = getUser();
    const waUrl = generateWhatsAppUrl({
      email: user?.email || '',
      generateId: generateResult.id,
      amount: generateResult.payment.amount,
    });

    window.open(waUrl, '_blank');
  };

  // Close payment modal and redirect to dashboard
  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    router.push('/dashboard');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Generate APK Baru</h1>
        <p className="text-gray-600 mt-1">
          Isi form di bawah untuk mengkonversi website Anda menjadi aplikasi Android
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* URL Input (Requirement 3.1, 3.2) */}
        <div>
          <label htmlFor="url" className="label">
            URL Website <span className="text-red-500">*</span>
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFieldErrors((prev) => ({ ...prev, url: undefined }));
            }}
            className={`input ${fieldErrors.url ? 'input-error' : ''}`}
            placeholder="https://example.com"
          />
          {fieldErrors.url ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.url}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              URL harus menggunakan HTTPS
            </p>
          )}
        </div>

        {/* App Name Input */}
        <div>
          <label htmlFor="app_name" className="label">
            Nama Aplikasi <span className="text-red-500">*</span>
          </label>
          <input
            id="app_name"
            type="text"
            value={appName}
            onChange={(e) => {
              setAppName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, app_name: undefined }));
            }}
            className={`input ${fieldErrors.app_name ? 'input-error' : ''}`}
            placeholder="My Awesome App"
            maxLength={50}
          />
          {fieldErrors.app_name ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.app_name}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              Nama yang akan tampil di Play Store
            </p>
          )}
        </div>

        {/* Package Name Input (Requirement 3.3) */}
        <div>
          <label htmlFor="package_name" className="label">
            Package Name <span className="text-red-500">*</span>
          </label>
          <input
            id="package_name"
            type="text"
            value={packageName}
            onChange={(e) => {
              setPackageName(e.target.value.toLowerCase());
              setFieldErrors((prev) => ({ ...prev, package_name: undefined }));
            }}
            className={`input ${fieldErrors.package_name ? 'input-error' : ''}`}
            placeholder="com.example.myapp"
          />
          {fieldErrors.package_name ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.package_name}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              Format: com.domain.name (contoh: com.mycompany.myapp)
            </p>
          )}
        </div>

        {/* Icon Upload (Requirements 3.4, 3.5) */}
        <div>
          <label className="label">
            Icon Aplikasi <span className="text-red-500">*</span>
          </label>
          
          <div className="flex items-start gap-4">
            {/* Icon Preview */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                fieldErrors.icon
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 hover:border-blue-400 bg-gray-50'
              }`}
            >
              {iconPreview ? (
                <img
                  src={iconPreview}
                  alt="Icon preview"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <UploadIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                onChange={handleIconChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-sm"
              >
                {iconFile ? 'Ganti Icon' : 'Pilih Icon'}
              </button>
              
              {iconFile && (
                <p className="mt-2 text-sm text-gray-600">
                  {iconFile.name} ({(iconFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              
              {fieldErrors.icon ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.icon}</p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  PNG, 512x512 pixel, maksimal 1MB
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Price Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            <InfoIcon className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Biaya Generate: Rp35.000
              </p>
              <p className="text-sm text-blue-700">
                Pembayaran via QRIS setelah submit form
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Memproses...
              </>
            ) : (
              'Lanjut ke Pembayaran'
            )}
          </button>
        </div>
      </form>

      {/* Payment Modal */}
      {showPaymentModal && generateResult && (
        <PaymentModal
          generateId={generateResult.id}
          amount={generateResult.payment.amount}
          onWhatsAppConfirm={handleWhatsAppConfirm}
          onClose={handleClosePaymentModal}
        />
      )}
    </div>
  );
}

// Icon Components
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
