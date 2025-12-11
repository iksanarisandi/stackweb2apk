'use client';

import { useEffect } from 'react';
import Image from 'next/image';

interface PaymentModalProps {
  generateId: string;
  amount: number;
  onWhatsAppConfirm: () => void;
  onClose: () => void;
}

/**
 * Payment Modal Component
 * Displays QRIS code and WhatsApp confirmation button
 * Requirements: 4.1, 4.2
 */
export default function PaymentModal({
  generateId,
  amount,
  onWhatsAppConfirm,
  onClose,
}: PaymentModalProps) {
  // Format amount to Indonesian currency
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform transition-all">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <CloseIcon className="w-6 h-6" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Generate Berhasil Dibuat!
            </h2>
            <p className="text-gray-600 mt-1">
              Silakan selesaikan pembayaran untuk memulai proses build APK
            </p>
          </div>

          {/* Payment Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">ID Generate</span>
              <span className="text-sm font-mono text-gray-900">{generateId.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Pembayaran</span>
              <span className="text-lg font-bold text-gray-900">{formattedAmount}</span>
            </div>
          </div>

          {/* QRIS Code (Requirement 4.1) */}
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Scan QRIS untuk pembayaran
            </p>
            <div className="relative w-48 h-48 mx-auto bg-white border border-gray-200 rounded-lg overflow-hidden">
              <Image
                src="/qris.jpg"
                alt="QRIS Payment Code"
                fill
                className="object-contain p-2"
                priority
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Gunakan aplikasi e-wallet atau mobile banking
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              Langkah Pembayaran:
            </h3>
            <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
              <li>Scan QRIS di atas dengan aplikasi pembayaran</li>
              <li>Bayar sejumlah {formattedAmount}</li>
              <li>Klik tombol &quot;Kirim Konfirmasi WA&quot; di bawah</li>
              <li>Tunggu konfirmasi dari admin (maks 1x24 jam)</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* WhatsApp Confirmation Button (Requirement 4.2) */}
            <button
              onClick={onWhatsAppConfirm}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Kirim Konfirmasi WA
            </button>

            <button
              onClick={onClose}
              className="w-full btn-secondary py-3"
            >
              Kembali ke Dashboard
            </button>
          </div>

          {/* Note */}
          <p className="text-xs text-center text-gray-500 mt-4">
            APK akan diproses setelah pembayaran dikonfirmasi oleh admin
          </p>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
