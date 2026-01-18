'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApiRequest, getToken, isAdmin } from '@/lib';
import type { PaymentStatus } from '@web2apk/shared';

// Payment with joined user and generate details (from admin API)
interface AdminPayment {
  id: string;
  user_id: string;
  generate_id: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
  user_email: string;
  generate_url: string;
  generate_app_name: string;
  generate_package_name: string;
  generate_status: string;
}

interface PaymentsResponse {
  payments: AdminPayment[];
}

interface ConfirmResponse {
  message: string;
  payment_id: string;
  generate_id: string;
  status: string;
}

interface RejectResponse {
  message: string;
  payment_id: string;
  status: string;
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

// Format currency to Indonesian Rupiah
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}


export default function AdminPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [failedPayments, setFailedPayments] = useState<AdminPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is admin (Requirement 9.4)
    if (!isAdmin()) {
      router.push('/dashboard');
      return;
    }
    fetchPayments();
    fetchFailedPayments();
  }, [router]);

  const fetchPayments = async () => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    setError(null);

    const { data, error: apiError } = await authApiRequest<PaymentsResponse>(
      '/api/admin/payments',
      token
    );

    setIsLoading(false);

    if (apiError) {
      setError(apiError.message);
      return;
    }

    if (data) {
      setPayments(data.payments);
    }
  };

  const fetchFailedPayments = async () => {
    const token = getToken();
    if (!token) return;

    setError(null);

    const { data, error: apiError } = await authApiRequest<PaymentsResponse>(
      '/api/admin/payments/failed-builds',
      token
    );

    if (apiError) {
      setError(apiError.message);
      return;
    }

    if (data) {
      setFailedPayments(data.payments);
    }
  };

  // Handle payment confirmation (Requirement 5.2)
  const handleConfirm = async (paymentId: string) => {
    const token = getToken();
    if (!token) return;

    if (!confirm('Konfirmasi pembayaran ini? APK build akan dimulai.')) {
      return;
    }

    setProcessingId(paymentId);
    setError(null);

    const { data, error: apiError } = await authApiRequest<ConfirmResponse>(
      `/api/admin/payments/${paymentId}/confirm`,
      token,
      { method: 'POST' }
    );

    setProcessingId(null);

    if (apiError) {
      setError(apiError.message);
      return;
    }

    if (data) {
      // Remove confirmed payment from list
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    }
  };

  // Handle payment rejection (Requirement 5.3)
  const handleReject = async (paymentId: string) => {
    const token = getToken();
    if (!token) return;

    if (!confirm('Tolak pembayaran ini? User akan diberitahu.')) {
      return;
    }

    setProcessingId(paymentId);
    setError(null);

    const { data, error: apiError } = await authApiRequest<RejectResponse>(
      `/api/admin/payments/${paymentId}/reject`,
      token,
      { method: 'POST' }
    );

    setProcessingId(null);

    if (apiError) {
      setError(apiError.message);
      return;
    }

    if (data) {
      // Remove rejected payment from list
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    }
  };

  const handleRetryBuild = async (paymentId: string) => {
    const token = getToken();
    if (!token) return;

    if (!confirm('Trigger ulang build APK untuk pembayaran ini?')) {
      return;
    }

    setProcessingId(paymentId);
    setError(null);

    const { data, error: apiError } = await authApiRequest<ConfirmResponse>(
      `/api/admin/payments/${paymentId}/retry-build`,
      token,
      { method: 'POST' }
    );

    setProcessingId(null);

    if (apiError) {
      setError(apiError.message);
      return;
    }

    if (data) {
      setFailedPayments((prev) => prev.filter((p) => p.id !== paymentId));
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-600 mt-1">
          Kelola pembayaran dan konfirmasi generate APK
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Pending Payments Section (Requirement 5.1) */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Pembayaran Pending
          </h2>
          <button
            onClick={fetchPayments}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            <RefreshIcon className="w-4 h-4 inline mr-1" />
            Refresh
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-8">
            <EmptyIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Tidak ada pembayaran pending</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    App Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    isProcessing={processingId === payment.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Generate Bermasalah
          </h2>
          <button
            onClick={fetchFailedPayments}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            <RefreshIcon className="w-4 h-4 inline mr-1" />
            Refresh
          </button>
        </div>

        {failedPayments.length === 0 ? (
          <div className="text-center py-8">
            <EmptyIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              Tidak ada generate yang gagal atau tertahan
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    App Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {failedPayments.map((payment) => (
                  <FailedPaymentRow
                    key={payment.id}
                    payment={payment}
                    onRetry={handleRetryBuild}
                    isProcessing={processingId === payment.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// Payment row component
function PaymentRow({
  payment,
  onConfirm,
  onReject,
  isProcessing,
}: {
  payment: AdminPayment;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
}) {
  return (
    <tr className={isProcessing ? 'opacity-50' : ''}>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {payment.user_email}
        </div>
        <div className="text-xs text-gray-500">ID: {payment.user_id.slice(0, 8)}...</div>
      </td>
      <td className="px-4 py-4">
        <div className="text-sm font-medium text-gray-900">
          {payment.generate_app_name}
        </div>
        <div className="text-xs text-gray-500 truncate max-w-xs">
          {payment.generate_url}
        </div>
        <div className="text-xs text-gray-400">
          {payment.generate_package_name}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm font-semibold text-green-600">
          {formatCurrency(payment.amount)}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {formatDate(payment.created_at)}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-right">
        <div className="flex justify-end space-x-2">
          {/* Confirm button (Requirement 5.2) */}
          <button
            onClick={() => onConfirm(payment.id)}
            disabled={isProcessing}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
            ) : (
              <CheckIcon className="w-4 h-4 mr-1" />
            )}
            Confirm
          </button>
          {/* Reject button (Requirement 5.3) */}
          <button
            onClick={() => onReject(payment.id)}
            disabled={isProcessing}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XIcon className="w-4 h-4 mr-1" />
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}

function FailedPaymentRow({
  payment,
  onRetry,
  isProcessing,
}: {
  payment: AdminPayment;
  onRetry: (id: string) => void;
  isProcessing: boolean;
}) {
  const statusLabel =
    payment.generate_status === 'failed' ? 'Gagal' : 'Sedang dibuild';
  const statusClass =
    payment.generate_status === 'failed'
      ? 'bg-red-100 text-red-800'
      : 'bg-purple-100 text-purple-800';

  return (
    <tr className={isProcessing ? 'opacity-50' : ''}>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {payment.user_email}
        </div>
        <div className="text-xs text-gray-500">
          ID: {payment.user_id.slice(0, 8)}...
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="text-sm font-medium text-gray-900">
          {payment.generate_app_name}
        </div>
        <div className="text-xs text-gray-500 truncate max-w-xs">
          {payment.generate_url}
        </div>
        <div className="text-xs text-gray-400">
          {payment.generate_package_name}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm font-semibold text-green-600">
          {formatCurrency(payment.amount)}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {formatDate(payment.created_at)}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onRetry(payment.id)}
          disabled={isProcessing}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
          ) : (
            <RefreshIcon className="w-4 h-4 mr-1" />
          )}
          Retry Build
        </button>
      </td>
    </tr>
  );
}


// Icon Components
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
