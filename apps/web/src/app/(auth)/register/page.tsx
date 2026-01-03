'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, Turnstile, useTurnstile } from '@/lib';

interface RegisterResponse {
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface ValidationError {
  path: string;
  message: string;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { token: turnstileToken, handleVerify, handleError, handleExpire } = useTurnstile();

  // Check for success message from redirect
  const success = searchParams.get('success');

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Email validation (Requirement 1.4)
    if (!email) {
      errors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Format email tidak valid';
    }

    // Password validation (Requirement 1.3)
    if (!password) {
      errors.password = 'Password wajib diisi';
    } else if (password.length < 8) {
      errors.password = 'Password minimal 8 karakter';
    }

    // Confirm password
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Password tidak cocok';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    if (!turnstileToken) {
      setError('Silakan selesaikan verifikasi CAPTCHA');
      return;
    }

    setIsLoading(true);

    const { data, error: apiError } = await apiRequest<RegisterResponse>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, turnstile_token: turnstileToken }),
      }
    );

    setIsLoading(false);

    if (apiError) {
      // Handle validation errors from server
      if (apiError.details?.issues) {
        const serverErrors: Record<string, string> = {};
        apiError.details.issues.forEach((issue: ValidationError) => {
          serverErrors[issue.path] = issue.message;
        });
        setFieldErrors(serverErrors);
      } else {
        // Requirement 1.2: Display error for duplicate email
        setError(apiError.message);
      }
      return;
    }

    if (data) {
      // Requirement 1.5: Redirect to login page with success notification
      router.push('/login?registered=true');
    }
  };

  return (
    <>
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Registrasi berhasil! Silakan masuk.
              </p>
            </div>
          </div>
        </div>
      )}

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: '' }));
                }
              }}
              className={`input ${fieldErrors.email ? 'input-error' : ''}`}
              placeholder="nama@email.com"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }
              }}
              className={`input ${fieldErrors.password ? 'input-error' : ''}`}
              placeholder="Minimal 8 karakter"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">
              Konfirmasi Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }
              }}
              className={`input ${fieldErrors.confirmPassword ? 'input-error' : ''}`}
              placeholder="Ulangi password"
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        {/* Turnstile CAPTCHA */}
        <Turnstile
          onVerify={handleVerify}
          onError={handleError}
          onExpire={handleExpire}
        />

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Memproses...
              </span>
            ) : (
              'Daftar'
            )}
          </button>
        </div>

        <p className="text-xs text-center text-gray-500">
          Dengan mendaftar, Anda menyetujui{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Syarat & Ketentuan
          </a>{' '}
          dan{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Kebijakan Privasi
          </a>{' '}
          kami.
        </p>
      </form>
    </>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link href="/" className="block text-center">
            <span className="text-3xl font-bold text-blue-600">Web2APK</span>
          </Link>
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
            Buat akun baru
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sudah punya akun?{' '}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Masuk di sini
            </Link>
          </p>
        </div>

        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
