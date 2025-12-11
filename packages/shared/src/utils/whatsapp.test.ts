import { describe, it, expect } from 'vitest';
import {
  generateWhatsAppUrl,
  formatWhatsAppMessage,
  validateWhatsAppUrl,
  ADMIN_PHONE_NUMBER,
  PAYMENT_AMOUNT,
} from './whatsapp';

describe('WhatsApp URL Generator', () => {
  const testParams = {
    email: 'test@example.com',
    generateId: 'abc123def456',
    amount: 35000,
  };

  describe('generateWhatsAppUrl', () => {
    it('should generate URL with correct admin phone number', () => {
      const url = generateWhatsAppUrl(testParams);
      expect(url).toContain(`https://wa.me/${ADMIN_PHONE_NUMBER}`);
    });

    it('should include encoded message with email', () => {
      const url = generateWhatsAppUrl(testParams);
      const decodedUrl = decodeURIComponent(url);
      expect(decodedUrl).toContain(testParams.email);
    });

    it('should include encoded message with generate ID', () => {
      const url = generateWhatsAppUrl(testParams);
      const decodedUrl = decodeURIComponent(url);
      expect(decodedUrl).toContain(testParams.generateId);
    });

    it('should use default amount when not provided', () => {
      const url = generateWhatsAppUrl({
        email: 'test@example.com',
        generateId: 'abc123',
      });
      const decodedUrl = decodeURIComponent(url);
      // Check for formatted amount (Rp35.000)
      expect(decodedUrl).toContain('Rp');
      expect(decodedUrl).toContain('35');
    });
  });

  describe('formatWhatsAppMessage', () => {
    it('should format message with all required fields', () => {
      const message = formatWhatsAppMessage(testParams);
      expect(message).toContain('Email: test@example.com');
      expect(message).toContain('ID Generate: abc123def456');
      expect(message).toContain('Konfirmasi Pembayaran Web2APK');
    });

    it('should format amount in Indonesian currency format', () => {
      const message = formatWhatsAppMessage(testParams);
      // Indonesian format: Rp35.000
      expect(message).toMatch(/Rp\s*35[.,]000/);
    });
  });

  describe('validateWhatsAppUrl', () => {
    it('should validate correct URL as valid', () => {
      const url = generateWhatsAppUrl(testParams);
      const result = validateWhatsAppUrl(url, testParams);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing email', () => {
      const url = `https://wa.me/${ADMIN_PHONE_NUMBER}?text=test`;
      const result = validateWhatsAppUrl(url, testParams);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URL must contain user email');
    });

    it('should detect wrong phone number', () => {
      const url = `https://wa.me/1234567890?text=${encodeURIComponent(formatWhatsAppMessage(testParams))}`;
      const result = validateWhatsAppUrl(url, testParams);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('admin phone number'))).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have correct admin phone number', () => {
      expect(ADMIN_PHONE_NUMBER).toBe('6282347303153');
    });

    it('should have correct payment amount', () => {
      expect(PAYMENT_AMOUNT).toBe(35000);
    });
  });
});
