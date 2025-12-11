/**
 * WhatsApp URL Generator Utility
 * Generates pre-filled WhatsApp message URLs for payment confirmation
 *
 * Validates: Requirements 4.2
 */

// Admin WhatsApp phone number (Indonesian format without +)
export const ADMIN_PHONE_NUMBER = '6282347303153';

// Default payment amount in IDR
export const PAYMENT_AMOUNT = 35000;

export interface WhatsAppMessageParams {
  email: string;
  generateId: string;
  amount?: number;
}

/**
 * Generates a WhatsApp URL with pre-filled message for payment confirmation
 *
 * Property 11: WhatsApp Message Generation
 * For any generate record, the generated WhatsApp URL SHALL contain:
 * - Correct admin phone number (6282347303153)
 * - User email
 * - Generate ID
 * - Amount (35000)
 *
 * @param params - Message parameters including email, generateId, and optional amount
 * @returns WhatsApp URL string with pre-filled message
 */
export function generateWhatsAppUrl(params: WhatsAppMessageParams): string {
  const { email, generateId, amount = PAYMENT_AMOUNT } = params;

  // Format the confirmation message
  const message = formatWhatsAppMessage({ email, generateId, amount });

  // Encode the message for URL
  const encodedMessage = encodeURIComponent(message);

  // Generate WhatsApp URL with phone number and pre-filled message
  return `https://wa.me/${ADMIN_PHONE_NUMBER}?text=${encodedMessage}`;
}

/**
 * Formats the WhatsApp message content
 *
 * @param params - Message parameters
 * @returns Formatted message string
 */
export function formatWhatsAppMessage(params: WhatsAppMessageParams): string {
  const { email, generateId, amount = PAYMENT_AMOUNT } = params;

  // Format amount with Indonesian locale (Rp35.000)
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return `Konfirmasi Pembayaran Web2APK

Email: ${email}
ID Generate: ${generateId}
Jumlah: ${formattedAmount}

Saya sudah melakukan pembayaran untuk generate APK. Mohon dikonfirmasi.`;
}

/**
 * Validates that a WhatsApp URL contains all required components
 * Useful for testing purposes
 *
 * @param url - WhatsApp URL to validate
 * @param params - Expected parameters
 * @returns Validation result
 */
export function validateWhatsAppUrl(
  url: string,
  params: WhatsAppMessageParams
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { email, generateId, amount = PAYMENT_AMOUNT } = params;

  // Check base URL format
  if (!url.startsWith(`https://wa.me/${ADMIN_PHONE_NUMBER}`)) {
    errors.push(`URL must target admin phone number ${ADMIN_PHONE_NUMBER}`);
  }

  // Decode the message from URL
  const decodedUrl = decodeURIComponent(url);

  // Check for required components
  if (!decodedUrl.includes(email)) {
    errors.push('URL must contain user email');
  }

  if (!decodedUrl.includes(generateId)) {
    errors.push('URL must contain generate ID');
  }

  // Check for amount (formatted or raw)
  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  if (!decodedUrl.includes(formattedAmount) && !decodedUrl.includes(amount.toString())) {
    errors.push(`URL must contain payment amount ${amount}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
