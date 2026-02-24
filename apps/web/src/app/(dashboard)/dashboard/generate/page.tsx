'use client';

import { useState, useRef, FormEvent, ChangeEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken, getUser, Turnstile, useTurnstile, API_BASE_URL, authApiRequest } from '@/lib';
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
  build_type: string;
}

interface FieldErrors {
  url?: string;
  app_name?: string;
  package_name?: string;
  icon?: string;
  html_files?: string;
}

interface ExistingGenerate {
  id: string;
  url: string | null;
  build_type: string;
  app_name: string;
  package_name: string;
  enable_gps: boolean;
  enable_camera: boolean;
  version_code: number;
  version_name: string;
}

export default function GenerateFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Revision mode state
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [existingData, setExistingData] = useState<ExistingGenerate | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Form state
  const [buildType, setBuildType] = useState<'webview' | 'html'>('webview');
  const [url, setUrl] = useState('');
  const [appName, setAppName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [htmlZipFile, setHtmlZipFile] = useState<File | null>(null);
  const [htmlZipName, setHtmlZipName] = useState<string>('');
  const [enableGps, setEnableGps] = useState(false);
  const [enableCamera, setEnableCamera] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Turnstile state
  const { token: turnstileToken, handleVerify, handleError: handleTurnstileError, handleExpire } = useTurnstile();

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResponse | null>(null);

  // Check for revision mode on mount
  useEffect(() => {
    const revisionParam = searchParams.get('revision');
    if (revisionParam) {
      setIsRevisionMode(true);
      setRevisionId(revisionParam);
      fetchExistingGenerate(revisionParam);
    }
  }, [searchParams]);

  // Fetch existing generate data for revision
  const fetchExistingGenerate = async (generateId: string) => {
    const token = getToken();
    if (!token) return;

    setIsLoadingData(true);
    const { data, error: apiError } = await authApiRequest<{ generate: ExistingGenerate }>(
      `/api/generate/${generateId}`,
      token
    );

    setIsLoadingData(false);

    if (apiError) {
      setError(apiError.message);
      return;
    }

    if (data?.generate) {
      const g = data.generate;
      setExistingData(g);
      setBuildType(g.build_type as 'webview' | 'html');
      setUrl(g.url || '');
      setAppName(g.app_name);
      setPackageName(g.package_name);
      setEnableGps(g.enable_gps);
      setEnableCamera(g.enable_camera);
    }
  };

  // Validate form fields (Requirements 3.2, 3.3, 3.4, 3.5)
  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    // URL validation - required for WebView (Requirement 3.2)
    if (buildType === 'webview') {
      if (!url) {
        errors.url = 'URL wajib diisi untuk WebView';
      } else if (!url.startsWith('https://')) {
        errors.url = 'URL harus menggunakan HTTPS';
      } else {
        try {
          new URL(url);
        } catch {
          errors.url = 'Format URL tidak valid';
        }
      }
    }

    // HTML ZIP validation - required for HTML View, but optional in revision mode
    if (buildType === 'html' && !isRevisionMode && !htmlZipFile) {
      errors.html_files = 'File HTML (ZIP) wajib diupload untuk HTML View';
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

  // Handle HTML ZIP file selection
  const handleHtmlZipChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setHtmlZipFile(file);
    setHtmlZipName(file.name);
    setFieldErrors((prev) => ({ ...prev, html_files: undefined }));
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log('Form submitted!', { isRevisionMode, revisionId, buildType });

    setError(null);

    if (!validateForm()) {
      console.log('Validation failed');
      return;
    }

    // Turnstile validation only required in create mode
    if (!isRevisionMode && !turnstileToken) {
      console.log('Turnstile token missing');
      setError('Silakan selesaikan verifikasi CAPTCHA');
      return;
    }

    console.log('Validation passed, proceeding...');

    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('build_type', buildType);
      if (buildType === 'webview') {
        formData.append('url', url);
      }
      formData.append('app_name', appName);
      formData.append('package_name', packageName);
      formData.append('enable_gps', enableGps ? 'true' : 'false');
      formData.append('enable_camera', enableCamera ? 'true' : 'false');
      if (iconFile) {
        formData.append('icon', iconFile);
      }
      if (buildType === 'html' && htmlZipFile) {
        formData.append('html_files', htmlZipFile);
      }

      // In revision mode, use rebuild endpoint; otherwise use create endpoint
      const endpoint = isRevisionMode && revisionId
        ? `${API_BASE_URL}/api/generate/${revisionId}/rebuild`
        : `${API_BASE_URL}/api/generate`;

      // Only add turnstile_token in create mode
      if (!isRevisionMode && turnstileToken) {
        formData.append('turnstile_token', turnstileToken);
      }

      const response = await fetch(endpoint, {
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

      // Success handling
      if (isRevisionMode) {
        // Revision mode: redirect to dashboard with success message
        router.push('/dashboard?rebuild=success');
      } else {
        // Create mode: show payment modal (Requirement 3.6)
        setGenerateResult(data);
        setShowPaymentModal(true);
      }
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
      {/* Loading state for revision mode */}
      {isLoadingData && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Memuat data revisi...</span>
        </div>
      )}

      {!isLoadingData && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {isRevisionMode ? 'Rebuild / Edit APK' : 'Generate APK Baru'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isRevisionMode
                ? `Edit file HTML untuk rebuild. Versi akan naik otomatis dari ${existingData?.version_code || 1} (${existingData?.version_name || '1.0.0'}).`
                : 'Isi form di bawah untuk mengkonversi website Anda menjadi aplikasi Android'
              }
            </p>
            {isRevisionMode && (
              <div className="mt-3 rounded-md bg-purple-50 p-3">
                <p className="text-sm text-purple-800">
                  <span className="font-medium">Info Revisi:</span> Keystore yang sama akan digunakan untuk mempertahankan signature aplikasi.
                  Upload file HTML baru jika ingin mengupdate konten aplikasi.
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="card space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Build Type Selection - Hidden in revision mode */}
            {!isRevisionMode && (
              <div>
                <label className="label">
                  Tipe Build <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {/* WebView Option */}
                  <label className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-colors
                    ${buildType === 'webview' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                    <input type="radio" name="build_type" value="webview" checked={buildType === 'webview'}
                      onChange={() => setBuildType('webview')} className="sr-only" />
                    <div className="flex items-center gap-3">
                      <GlobeIcon className="w-6 h-6 text-blue-600" />
                      <div>
                        <div className="font-semibold">WebView</div>
                        <div className="text-sm text-gray-500">Muat website dari URL</div>
                      </div>
                    </div>
                    {buildType === 'webview' && <div className="mt-3 text-sm font-medium text-blue-600">Rp150.000</div>}
                  </label>

                  {/* HTML View Option */}
                  <label className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-colors
                    ${buildType === 'html' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                    <input type="radio" name="build_type" value="html" checked={buildType === 'html'}
                      onChange={() => setBuildType('html')} className="sr-only" />
                    <div className="flex items-center gap-3">
                      <CodeIcon className="w-6 h-6 text-purple-600" />
                      <div>
                        <div className="font-semibold">HTML View</div>
                        <div className="text-sm text-gray-500">Upload file HTML sendiri</div>
                      </div>
                    </div>
                    {buildType === 'html' && <div className="mt-3 text-sm font-medium text-purple-600">Rp150.000</div>}
                  </label>
                </div>
              </div>
            )}

            {/* Show build type badge in revision mode */}
            {isRevisionMode && (
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="text-sm font-medium text-gray-700">Tipe Build: </span>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  buildType === 'html' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {buildType === 'html' ? 'HTML View' : 'WebView'}
                </span>
              </div>
            )}

        {/* URL Input (only for WebView) */}
        {buildType === 'webview' && (
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
        )}

        {/* HTML ZIP Upload (only for HTML View) */}
        {buildType === 'html' && (
          <div>
            <label className="label">
              File HTML (ZIP) {!isRevisionMode && <span className="text-red-500">*</span>}
            </label>
            {isRevisionMode && (
              <p className="text-xs text-gray-500 mb-2">
                Opsional - Upload hanya jika ingin mengupdate file HTML. Kosongkan untuk menggunakan file yang sama.
              </p>
            )}
            <input ref={zipInputRef} type="file" accept=".zip" onChange={handleHtmlZipChange} className="hidden" />
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors"
              onClick={() => zipInputRef.current?.click()}>
              <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                {htmlZipName ? 'Ganti file ZIP' : 'Klik untuk upload file ZIP'}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Maksimal 10MB, harus mengandung index.html di root
              </p>
              {htmlZipName && (
                <p className="text-sm font-medium text-purple-600">
                  {htmlZipName}
                </p>
              )}
            </div>
            {fieldErrors.html_files && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.html_files}</p>
            )}
            {buildType === 'html' && !fieldErrors.html_files && !isRevisionMode && (
              <p className="mt-2 text-sm text-gray-500">
                ZIP akan diekstrak ke assets. Pastikan index.html berada di root level.
              </p>
            )}
          </div>
        )}

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
            className={`input ${fieldErrors.app_name ? 'input-error' : ''} ${isRevisionMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            placeholder="My Awesome App"
            maxLength={50}
            readOnly={isRevisionMode}
          />
          {fieldErrors.app_name ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.app_name}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              {isRevisionMode ? 'Nama aplikasi tidak dapat diubah dalam mode revisi' : 'Nama yang akan tampil di Play Store'}
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
            className={`input ${fieldErrors.package_name ? 'input-error' : ''} ${isRevisionMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            placeholder="com.example.myapp"
            readOnly={isRevisionMode}
          />
          {fieldErrors.package_name ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.package_name}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              {isRevisionMode ? 'Package name tidak dapat diubah dalam mode revisi' : 'Format: com.domain.name (contoh: com.mycompany.myapp)'}
            </p>
          )}
        </div>

        {/* Icon Upload (Requirements 3.4, 3.5) - Hidden in revision mode */}
        {!isRevisionMode && (
          <div>
            <label className="label">
              Icon Aplikasi <span className="text-red-500">*</span>
            </label>

            <div className="flex items-start gap-4">
              {/* Icon Preview */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${fieldErrors.icon
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
        )}

        {/* Permission Options (Requirements 3.7, 3.8, 11.1-11.6) - Hidden in revision mode */}
        {!isRevisionMode && (
          <div>
            <label className="label">
              Izin Aplikasi (Opsional)
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Pilih izin yang dibutuhkan aplikasi Anda. Cocok untuk aplikasi absensi atau yang membutuhkan akses kamera.
            </p>

            <div className="space-y-3">
              {/* GPS Permission Toggle */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={enableGps}
                  onChange={(e) => setEnableGps(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <LocationIcon className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Izin Lokasi (GPS)</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Memungkinkan aplikasi mengakses lokasi perangkat. Cocok untuk fitur absensi berbasis lokasi.
                </p>
              </div>
            </label>

            {/* Camera Permission Toggle */}
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={enableCamera}
                onChange={(e) => setEnableCamera(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CameraIcon className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-900">Izin Kamera</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Memungkinkan aplikasi mengakses kamera untuk foto. Cocok untuk upload foto atau selfie absensi.
                </p>
              </div>
            </label>
          </div>
        </div>
        )}

        {/* Price Info */}
        <div className={`rounded-lg p-4 ${buildType === 'html' ? 'bg-purple-50' : 'bg-blue-50'}`}>
          <div className="flex items-center">
            <InfoIcon className={`w-5 h-5 mr-3 flex-shrink-0 ${buildType === 'html' ? 'text-purple-600' : 'text-blue-600'}`} />
            <div>
              {isRevisionMode ? (
                <>
                  <p className={`text-sm ${buildType === 'html' ? 'text-purple-700' : 'text-blue-700'}`}>
                    <span className={`font-medium ${buildType === 'html' ? 'text-purple-900' : 'text-blue-900'}`}>Mode Revisi:</span>
                    <span className={`font-bold ${buildType === 'html' ? 'text-purple-900' : 'text-blue-900'} ml-2`}>Gratis</span>
                  </p>
                  <p className={`text-sm ${buildType === 'html' ? 'text-purple-700' : 'text-blue-700'}`}>
                    Tidak ada biaya tambahan untuk rebuild. Keystore yang sama akan digunakan.
                  </p>
                  <p className={`text-sm ${buildType === 'html' ? 'text-purple-600' : 'text-blue-600'} mt-1`}>
                    ✅ Versi naik otomatis • Signature sama • Bisa update aplikasi
                  </p>
                </>
              ) : (
                <>
                  <p className={`text-sm ${buildType === 'html' ? 'text-purple-700' : 'text-blue-700'}`}>
                    <span className={`font-medium ${buildType === 'html' ? 'text-purple-900' : 'text-blue-900'}`}>Biaya Generate:</span>
                    <span className="line-through text-gray-500 mr-2">Rp300.000</span>
                    <span className={`font-bold ${buildType === 'html' ? 'text-purple-900' : 'text-blue-900'}`}>Rp150.000</span>
                  </p>
                  <p className={`text-sm ${buildType === 'html' ? 'text-purple-700' : 'text-blue-700'}`}>
                    Pembayaran via QRIS setelah submit form
                  </p>
                  <p className={`text-sm ${buildType === 'html' ? 'text-purple-600' : 'text-blue-600'} mt-1`}>
                    ✅ AAB untuk Play Store • Keystore Unik • API Level 35 • Bisa Update Versi
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Turnstile CAPTCHA - Hidden in revision mode */}
        {!isRevisionMode && (
          <Turnstile
            onVerify={handleVerify}
            onError={handleTurnstileError}
            onExpire={handleExpire}
          />
        )}

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
              isRevisionMode ? 'Rebuild APK' : 'Lanjut ke Pembayaran'
            )}
          </button>
        </div>
      </form>

      {/* Payment Modal - Only show in create mode */}
      {!isRevisionMode && showPaymentModal && generateResult && (
        <PaymentModal
          generateId={generateResult.id}
          amount={generateResult.payment.amount}
          onWhatsAppConfirm={handleWhatsAppConfirm}
          onClose={handleClosePaymentModal}
        />
      )}
    </>
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

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
