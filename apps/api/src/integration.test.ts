/**
 * End-to-End Integration Test
 * Tests the complete flow: Register → Login → Generate → Payment → Admin Confirm → Build → Download
 * Validates: All Requirements
 *
 * **Feature: web2apk, Task 23.1: Test complete flow end-to-end**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './index';

// Mock D1 Database
interface MockD1Result {
  results: Record<string, unknown>[];
  success: boolean;
}

interface MockD1Statement {
  bind: (...args: unknown[]) => MockD1Statement;
  first: <T>() => Promise<T | null>;
  all: () => Promise<MockD1Result>;
  run: () => Promise<{ success: boolean }>;
}

// In-memory storage for mock database
const mockUsers: Map<string, Record<string, unknown>> = new Map();
const mockGenerates: Map<string, Record<string, unknown>> = new Map();
const mockPayments: Map<string, Record<string, unknown>> = new Map();

// In-memory storage for mock R2
const mockR2Objects: Map<string, ArrayBuffer> = new Map();

function createMockD1(): D1Database {
  const createStatement = (sql: string): MockD1Statement => {
    let boundParams: unknown[] = [];

    const statement: MockD1Statement = {
      bind: (...args: unknown[]) => {
        boundParams = args;
        return statement;
      },
      first: async <T>(): Promise<T | null> => {
        // Handle SELECT queries
        if (sql.includes('SELECT') && sql.includes('FROM users')) {
          if (sql.includes('WHERE email =')) {
            const email = boundParams[0] as string;
            for (const user of mockUsers.values()) {
              if (user.email === email) {
                return user as T;
              }
            }
            return null;
          }
          if (sql.includes('WHERE id =')) {
            const id = boundParams[0] as string;
            const user = mockUsers.get(id);
            return (user as T) || null;
          }
        }
        if (sql.includes('SELECT') && sql.includes('FROM generates')) {
          if (sql.includes('WHERE id = ? AND user_id = ?')) {
            const [id, userId] = boundParams as [string, string];
            const gen = mockGenerates.get(id);
            if (gen && gen.user_id === userId) {
              // Return a copy to avoid mutation issues
              return { ...gen } as T;
            }
            return null;
          }
          if (sql.includes('WHERE id = ?')) {
            const id = boundParams[0] as string;
            const gen = mockGenerates.get(id);
            // Return a copy to avoid mutation issues
            return gen ? ({ ...gen } as T) : null;
          }
        }
        if (sql.includes('SELECT') && sql.includes('FROM payments')) {
          // Admin query with joins (uses p.id)
          if (sql.includes('WHERE p.id = ?') || (sql.includes('JOIN generates') && sql.includes('WHERE'))) {
            const id = boundParams[0] as string;
            const payment = mockPayments.get(id);
            if (payment) {
              const gen = mockGenerates.get(payment.generate_id as string);
              const user = mockUsers.get(payment.user_id as string);
              return {
                ...payment,
                url: gen?.url,
                app_name: gen?.app_name,
                package_name: gen?.package_name,
                icon_key: gen?.icon_key,
                user_email: user?.email,
              } as T;
            }
            return null;
          }
          // Simple payment query (no joins)
          if (sql.includes('WHERE id = ?') && !sql.includes('JOIN')) {
            const id = boundParams[0] as string;
            const payment = mockPayments.get(id);
            return (payment as T) || null;
          }
        }
        return null;
      },
      all: async (): Promise<MockD1Result> => {
        // Handle SELECT all queries
        if (sql.includes('FROM generates') && sql.includes('WHERE user_id = ?')) {
          const userId = boundParams[0] as string;
          const results: Record<string, unknown>[] = [];
          for (const gen of mockGenerates.values()) {
            if (gen.user_id === userId) {
              results.push(gen);
            }
          }
          return { results, success: true };
        }
        if (sql.includes('FROM payments') && sql.includes("WHERE p.status = 'pending'")) {
          const results: Record<string, unknown>[] = [];
          for (const payment of mockPayments.values()) {
            if (payment.status === 'pending') {
              const gen = mockGenerates.get(payment.generate_id as string);
              const user = mockUsers.get(payment.user_id as string);
              results.push({
                ...payment,
                user_email: user?.email,
                generate_url: gen?.url,
                generate_app_name: gen?.app_name,
                generate_package_name: gen?.package_name,
                generate_status: gen?.status,
              });
            }
          }
          return { results, success: true };
        }
        return { results: [], success: true };
      },
      run: async (): Promise<{ success: boolean }> => {
        // Handle INSERT queries
        if (sql.includes('INSERT INTO users')) {
          const [id, email, passwordHash, role] = boundParams as [string, string, string, string];
          mockUsers.set(id, {
            id,
            email,
            password_hash: passwordHash,
            role,
            created_at: new Date().toISOString(),
          });
          return { success: true };
        }
        if (sql.includes('INSERT INTO generates')) {
          const [id, userId, url, appName, packageName, iconKey] = boundParams as string[];
          mockGenerates.set(id, {
            id,
            user_id: userId,
            url,
            app_name: appName,
            package_name: packageName,
            icon_key: iconKey,
            status: 'pending',
            download_count: 0,
            created_at: new Date().toISOString(),
          });
          return { success: true };
        }
        if (sql.includes('INSERT INTO payments')) {
          const [id, userId, generateId, amount] = boundParams as [string, string, string, number];
          mockPayments.set(id, {
            id,
            user_id: userId,
            generate_id: generateId,
            amount,
            status: 'pending',
            created_at: new Date().toISOString(),
          });
          return { success: true };
        }
        // Handle UPDATE queries
        if (sql.includes('UPDATE payments') && sql.includes("status = 'confirmed'")) {
          const [confirmedBy, confirmedAt, id] = boundParams as [string, string, string];
          const payment = mockPayments.get(id);
          if (payment) {
            payment.status = 'confirmed';
            payment.confirmed_by = confirmedBy;
            payment.confirmed_at = confirmedAt;
          }
          return { success: true };
        }
        if (sql.includes('UPDATE payments') && sql.includes("status = 'rejected'")) {
          const [confirmedBy, confirmedAt, id] = boundParams as [string, string, string];
          const payment = mockPayments.get(id);
          if (payment) {
            payment.status = 'rejected';
            payment.confirmed_by = confirmedBy;
            payment.confirmed_at = confirmedAt;
          }
          return { success: true };
        }
        if (sql.includes('UPDATE generates') && sql.includes("status = 'building'")) {
          const id = boundParams[0] as string;
          const gen = mockGenerates.get(id);
          if (gen) {
            gen.status = 'building';
          }
          return { success: true };
        }
        if (sql.includes('UPDATE generates') && sql.includes("status = 'ready'")) {
          const [apkKey, completedAt, id] = boundParams as [string, string, string];
          const gen = mockGenerates.get(id);
          if (gen) {
            gen.status = 'ready';
            gen.apk_key = apkKey;
            gen.completed_at = completedAt;
          }
          return { success: true };
        }
        if (sql.includes('UPDATE generates') && sql.includes("status = 'failed'")) {
          const [errorMessage, completedAt, id] = boundParams as [string, string, string];
          const gen = mockGenerates.get(id);
          if (gen) {
            gen.status = 'failed';
            gen.error_message = errorMessage;
            gen.completed_at = completedAt;
          }
          return { success: true };
        }
        if (sql.includes('UPDATE generates') && sql.includes('download_count = download_count + 1')) {
          const id = boundParams[0] as string;
          const gen = mockGenerates.get(id);
          if (gen) {
            // Note: The API returns download_count + 1 after the update
            // So we increment here to match the database behavior
            gen.download_count = ((gen.download_count as number) || 0) + 1;
          }
          return { success: true };
        }
        return { success: true };
      },
    };
    return statement;
  };

  return {
    prepare: (sql: string) => createStatement(sql),
    dump: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;
}

function createMockR2(): R2Bucket {
  return {
    put: async (key: string, value: ArrayBuffer | ReadableStream | string) => {
      if (value instanceof ArrayBuffer) {
        mockR2Objects.set(key, value);
      }
      return {} as R2Object;
    },
    get: async (key: string) => {
      const data = mockR2Objects.get(key);
      if (!data) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(data));
            controller.close();
          },
        }),
        size: data.byteLength,
      } as R2ObjectBody;
    },
    head: async (key: string) => {
      const data = mockR2Objects.get(key);
      if (!data) return null;
      return { size: data.byteLength } as R2Object;
    },
    delete: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

// Create a valid 512x512 PNG file (minimal valid PNG)
function createValidPngIcon(): ArrayBuffer {
  // PNG signature + IHDR chunk for 512x512 image
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  // IHDR chunk: length (13), type (IHDR), width (512), height (512), bit depth, color type, etc.
  const ihdrLength = [0, 0, 0, 13]; // 13 bytes
  const ihdrType = [73, 72, 68, 82]; // "IHDR"
  const width = [0, 0, 2, 0]; // 512 in big-endian
  const height = [0, 0, 2, 0]; // 512 in big-endian
  const ihdrData = [8, 6, 0, 0, 0]; // bit depth 8, color type 6 (RGBA), compression, filter, interlace
  const ihdrCrc = [0, 0, 0, 0]; // Placeholder CRC (not validated in our test)
  // IEND chunk
  const iendLength = [0, 0, 0, 0];
  const iendType = [73, 69, 78, 68]; // "IEND"
  const iendCrc = [174, 66, 96, 130]; // Correct CRC for IEND

  const bytes = new Uint8Array([
    ...pngSignature,
    ...ihdrLength,
    ...ihdrType,
    ...width,
    ...height,
    ...ihdrData,
    ...ihdrCrc,
    ...iendLength,
    ...iendType,
    ...iendCrc,
  ]);

  return bytes.buffer;
}

describe('End-to-End Integration Test', () => {
  let mockEnv: {
    DB: D1Database;
    STORAGE: R2Bucket;
    JWT_SECRET: string;
    ADMIN_EMAIL: string;
    ADMIN_PASSWORD: string;
    GITHUB_TOKEN: string;
    WEBHOOK_SECRET: string;
  };

  beforeEach(() => {
    // Clear mock storage
    mockUsers.clear();
    mockGenerates.clear();
    mockPayments.clear();
    mockR2Objects.clear();

    // Setup mock environment
    mockEnv = {
      DB: createMockD1(),
      STORAGE: createMockR2(),
      JWT_SECRET: 'test-jwt-secret-key-12345',
      ADMIN_EMAIL: 'admin@test.com',
      ADMIN_PASSWORD: 'adminpassword123',
      GITHUB_TOKEN: 'test-github-token',
      WEBHOOK_SECRET: 'test-webhook-secret',
    };

    // Mock fetch for GitHub API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it('should complete the full flow: Register → Login → Generate → Payment → Admin Confirm → Build → Download', async () => {
    // ============================================
    // STEP 1: User Registration
    // Validates: Requirements 1.1, 1.2, 1.3, 1.4
    // ============================================
    const registerResponse = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'securepassword123',
        }),
      },
      mockEnv
    );

    expect(registerResponse.status).toBe(201);
    const registerData = await registerResponse.json();
    expect(registerData.message).toBe('Registration successful');
    expect(registerData.user.email).toBe('user@example.com');
    expect(registerData.user.role).toBe('user');
    const userId = registerData.user.id;

    // ============================================
    // STEP 2: User Login
    // Validates: Requirements 2.1, 2.2
    // ============================================
    const loginResponse = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'securepassword123',
        }),
      },
      mockEnv
    );

    expect(loginResponse.status).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData.message).toBe('Login successful');
    expect(loginData.token).toBeDefined();
    const userToken = loginData.token;

    // ============================================
    // STEP 3: Create APK Generation Request
    // Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3
    // ============================================
    const iconBuffer = createValidPngIcon();
    const iconBlob = new Blob([iconBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('url', 'https://example.com');
    formData.append('app_name', 'Test App');
    formData.append('package_name', 'com.example.testapp');
    formData.append('icon', iconBlob, 'icon.png');

    const generateResponse = await app.request(
      '/api/generate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        body: formData,
      },
      mockEnv
    );

    expect(generateResponse.status).toBe(201);
    const generateData = await generateResponse.json();
    expect(generateData.status).toBe('pending');
    expect(generateData.payment.amount).toBe(35000);
    const generateId = generateData.id;
    const paymentId = generateData.payment.id;

    // Verify generate record was created
    const listResponse = await app.request(
      '/api/generate',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
      mockEnv
    );

    expect(listResponse.status).toBe(200);
    const listData = await listResponse.json();
    expect(listData.generates).toHaveLength(1);
    expect(listData.generates[0].id).toBe(generateId);
    expect(listData.generates[0].status).toBe('pending');

    // ============================================
    // STEP 4: Admin Registration and Login
    // Validates: Requirements 9.1, 9.2, 9.3
    // ============================================
    const adminRegisterResponse = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'adminpassword123',
        }),
      },
      mockEnv
    );

    expect(adminRegisterResponse.status).toBe(201);
    const adminRegisterData = await adminRegisterResponse.json();
    const adminId = adminRegisterData.user.id;

    // Manually set admin role (simulating seed-admin)
    const adminUser = mockUsers.get(adminId);
    if (adminUser) {
      adminUser.role = 'admin';
    }

    const adminLoginResponse = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'adminpassword123',
        }),
      },
      mockEnv
    );

    expect(adminLoginResponse.status).toBe(200);
    const adminLoginData = await adminLoginResponse.json();
    const adminToken = adminLoginData.token;

    // ============================================
    // STEP 5: Admin Views Pending Payments
    // Validates: Requirements 5.1
    // ============================================
    const paymentsResponse = await app.request(
      '/api/admin/payments',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
      mockEnv
    );

    expect(paymentsResponse.status).toBe(200);
    const paymentsData = await paymentsResponse.json();
    expect(paymentsData.payments).toHaveLength(1);
    expect(paymentsData.payments[0].id).toBe(paymentId);
    expect(paymentsData.payments[0].status).toBe('pending');

    // ============================================
    // STEP 6: Admin Confirms Payment
    // Validates: Requirements 5.2, 5.4
    // ============================================
    const confirmResponse = await app.request(
      `/api/admin/payments/${paymentId}/confirm`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
      mockEnv
    );

    expect(confirmResponse.status).toBe(200);
    const confirmData = await confirmResponse.json();
    expect(confirmData.message).toBe('Payment confirmed and build triggered');
    expect(confirmData.status).toBe('building');

    // Verify generate status changed to building
    const genAfterConfirm = mockGenerates.get(generateId);
    expect(genAfterConfirm?.status).toBe('building');

    // Verify payment status changed to confirmed
    const paymentAfterConfirm = mockPayments.get(paymentId);
    expect(paymentAfterConfirm?.status).toBe('confirmed');

    // ============================================
    // STEP 7: Build Webhook Callback (Success)
    // Validates: Requirements 6.3
    // ============================================
    const apkKey = `apks/${generateId}/app.apk`;
    // Store mock APK in R2
    mockR2Objects.set(apkKey, new ArrayBuffer(1024));

    const webhookResponse = await app.request(
      '/api/webhook/build-complete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': mockEnv.WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          generate_id: generateId,
          status: 'success',
          apk_key: apkKey,
        }),
      },
      mockEnv
    );

    expect(webhookResponse.status).toBe(200);
    const webhookData = await webhookResponse.json();
    expect(webhookData.status).toBe('ready');

    // Verify generate status changed to ready
    const genAfterBuild = mockGenerates.get(generateId);
    expect(genAfterBuild?.status).toBe('ready');
    expect(genAfterBuild?.apk_key).toBe(apkKey);

    // ============================================
    // STEP 8: User Downloads APK
    // Validates: Requirements 6.5, 7.1, 7.2, 7.4
    // ============================================
    const downloadResponse = await app.request(
      `/api/generate/${generateId}/download`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
      mockEnv
    );

    expect(downloadResponse.status).toBe(200);
    const downloadData = await downloadResponse.json();
    expect(downloadData.download_url).toBeDefined();
    expect(downloadData.download_url).toContain(`/api/generate/${generateId}/file`);
    expect(downloadData.download_count).toBe(1);

    // Verify download count was incremented
    const genAfterDownload = mockGenerates.get(generateId);
    expect(genAfterDownload?.download_count).toBe(1);

    // ============================================
    // VERIFICATION: Complete Flow Success
    // ============================================
    console.log('✅ Complete flow test passed:');
    console.log('  1. User registered successfully');
    console.log('  2. User logged in and received JWT');
    console.log('  3. APK generation request created with pending status');
    console.log('  4. Admin registered and logged in');
    console.log('  5. Admin viewed pending payments');
    console.log('  6. Admin confirmed payment, status changed to building');
    console.log('  7. Build webhook received, status changed to ready');
    console.log('  8. User downloaded APK, download count incremented');
  });

  it('should reject registration with duplicate email', async () => {
    // Register first user
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'duplicate@example.com',
          password: 'password123',
        }),
      },
      mockEnv
    );

    // Try to register with same email
    const duplicateResponse = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'duplicate@example.com',
          password: 'differentpassword',
        }),
      },
      mockEnv
    );

    expect(duplicateResponse.status).toBe(409);
  });

  it('should reject login with invalid credentials', async () => {
    // Register user
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'correctpassword',
        }),
      },
      mockEnv
    );

    // Try to login with wrong password
    const loginResponse = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      },
      mockEnv
    );

    expect(loginResponse.status).toBe(401);
  });

  it('should reject non-admin access to admin routes', async () => {
    // Register regular user
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'regular@example.com',
          password: 'password123',
        }),
      },
      mockEnv
    );

    // Login as regular user
    const loginResponse = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'regular@example.com',
          password: 'password123',
        }),
      },
      mockEnv
    );

    const { token } = await loginResponse.json();

    // Try to access admin route
    const adminResponse = await app.request(
      '/api/admin/payments',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      mockEnv
    );

    expect(adminResponse.status).toBe(403);
  });

  it('should handle build failure correctly', async () => {
    // Setup: Create user, generate request, and confirm payment
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'failtest@example.com',
          password: 'password123',
        }),
      },
      mockEnv
    );

    const loginResponse = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'failtest@example.com',
          password: 'password123',
        }),
      },
      mockEnv
    );

    const { token: userToken } = await loginResponse.json();

    const iconBuffer = createValidPngIcon();
    const iconBlob = new Blob([iconBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('url', 'https://failtest.com');
    formData.append('app_name', 'Fail Test App');
    formData.append('package_name', 'com.fail.testapp');
    formData.append('icon', iconBlob, 'icon.png');

    const generateResponse = await app.request(
      '/api/generate',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: formData,
      },
      mockEnv
    );

    const { id: generateId, payment } = await generateResponse.json();

    // Create admin and confirm payment
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin2@example.com',
          password: 'adminpassword123',
        }),
      },
      mockEnv
    );

    // Set admin role
    for (const user of mockUsers.values()) {
      if (user.email === 'admin2@example.com') {
        user.role = 'admin';
        break;
      }
    }

    const adminLoginResponse = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin2@example.com',
          password: 'adminpassword123',
        }),
      },
      mockEnv
    );

    const { token: adminToken } = await adminLoginResponse.json();

    await app.request(
      `/api/admin/payments/${payment.id}/confirm`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      mockEnv
    );

    // Send failure webhook
    const webhookResponse = await app.request(
      '/api/webhook/build-complete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': mockEnv.WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          generate_id: generateId,
          status: 'failed',
          error_message: 'Gradle build failed: compilation error',
        }),
      },
      mockEnv
    );

    expect(webhookResponse.status).toBe(200);
    const webhookData = await webhookResponse.json();
    expect(webhookData.status).toBe('failed');

    // Verify generate status changed to failed
    const genAfterFail = mockGenerates.get(generateId);
    expect(genAfterFail?.status).toBe('failed');
    expect(genAfterFail?.error_message).toBe('Gradle build failed: compilation error');
  });
});
