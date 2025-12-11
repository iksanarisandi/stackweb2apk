# Design Document: Web2APK

## Overview

Web2APK adalah SaaS platform yang mengkonversi website menjadi Android WebView APK. Sistem terdiri dari 3 komponen utama:
1. **Frontend** - Next.js 15 App Router di Cloudflare Pages untuk UI user dan admin
2. **Backend** - Hono API di Cloudflare Workers untuk business logic dan data management
3. **Build Pipeline** - GitHub Actions untuk automated APK generation

Arsitektur menggunakan full-stack Cloudflare untuk edge computing dengan latency rendah dan auto-scaling.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   Next.js    │────▶│    Hono      │────▶│     D1       │        │
│  │   Pages      │     │   Workers    │     │   Database   │        │
│  │  (Frontend)  │     │  (Backend)   │     │   (SQLite)   │        │
│  └──────────────┘     └──────┬───────┘     └──────────────┘        │
│                              │                                       │
│                              ▼                                       │
│                       ┌──────────────┐                              │
│                       │      R2      │                              │
│                       │   Storage    │                              │
│                       │ (Icons/APKs) │                              │
│                       └──────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ Repository Dispatch
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   Clone      │────▶│   Replace    │────▶│   Build      │        │
│  │   Template   │     │   Config     │     │   APK        │        │
│  └──────────────┘     └──────────────┘     └──────┬───────┘        │
│                                                    │                 │
│                                                    ▼                 │
│                                             ┌──────────────┐        │
│                                             │   Upload     │        │
│                                             │   to R2      │        │
│                                             └──────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Frontend (Next.js 15 - Cloudflare Pages)

**Pages Structure:**
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx
│   ├── page.tsx                 # User dashboard
│   ├── generate/page.tsx        # APK generation form
│   └── admin/
│       └── page.tsx             # Admin panel
├── api/                         # API routes (proxy to Hono)
└── layout.tsx
```

**Key Components:**
- `AuthForm` - Login/register form dengan validation
- `GenerateForm` - Form input URL, app name, package name, icon upload
- `PaymentModal` - Display QRIS dan WA confirmation button
- `GenerateList` - Table history generate dengan status badges
- `AdminPaymentList` - List pending payments untuk admin

### 2. Backend (Hono - Cloudflare Workers)

**API Endpoints:**
```
POST   /api/auth/register     # User registration
POST   /api/auth/login        # User login, return JWT
POST   /api/auth/logout       # Invalidate session
GET    /api/auth/me           # Get current user

POST   /api/generate          # Create new generate request
GET    /api/generate          # List user's generates
GET    /api/generate/:id      # Get generate details
GET    /api/generate/:id/download  # Get download URL

GET    /api/admin/payments    # List pending payments (admin)
POST   /api/admin/payments/:id/confirm  # Confirm payment (admin)
POST   /api/admin/payments/:id/reject   # Reject payment (admin)

POST   /api/webhook/build-complete  # GitHub Actions callback
```

**Middleware:**
- `authMiddleware` - Validate JWT, attach user to context
- `adminMiddleware` - Check user role is admin
- `corsMiddleware` - Handle CORS for API

### 3. Build Pipeline (GitHub Actions)

**Workflow Trigger:** Repository dispatch event dengan payload:
```json
{
  "event_type": "build_apk",
  "client_payload": {
    "generate_id": "uuid",
    "url": "https://example.com",
    "app_name": "My App",
    "package_name": "com.example.app",
    "icon_url": "https://r2.../icon.png",
    "callback_url": "https://api.../webhook/build-complete"
  }
}
```

**Build Steps:**
1. Checkout template repository
2. Download icon from R2
3. Replace configuration files (MainActivity.kt, strings.xml, build.gradle, etc.)
4. Generate keystore atau use existing
5. Run `./gradlew assembleRelease`
6. Upload APK to R2
7. Call callback URL dengan status

## Data Models

### D1 Database Schema

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Generates table
CREATE TABLE generates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  url TEXT NOT NULL,
  app_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  apk_key TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'building', 'ready', 'failed')),
  error_message TEXT,
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Payments table
CREATE TABLE payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  generate_id TEXT NOT NULL REFERENCES generates(id),
  amount INTEGER NOT NULL DEFAULT 35000,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME
);

-- Indexes
CREATE INDEX idx_generates_user_id ON generates(user_id);
CREATE INDEX idx_generates_status ON generates(status);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_generate_id ON payments(generate_id);
```

### TypeScript Interfaces

```typescript
interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
}

interface Generate {
  id: string;
  user_id: string;
  url: string;
  app_name: string;
  package_name: string;
  icon_key: string;
  apk_key: string | null;
  status: 'pending' | 'confirmed' | 'building' | 'ready' | 'failed';
  error_message: string | null;
  download_count: number;
  created_at: string;
  completed_at: string | null;
}

interface Payment {
  id: string;
  user_id: string;
  generate_id: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmed_by: string | null;
  created_at: string;
  confirmed_at: string | null;
}

interface GenerateRequest {
  url: string;
  app_name: string;
  package_name: string;
  icon: File;
}

interface BuildPayload {
  generate_id: string;
  url: string;
  app_name: string;
  package_name: string;
  icon_url: string;
  callback_url: string;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Password Storage Security
*For any* user registration with valid credentials, the stored password_hash SHALL NOT equal the plaintext password and SHALL be verifiable via bcrypt compare.
**Validates: Requirements 1.1**

### Property 2: Email Uniqueness Enforcement
*For any* existing user email in the database, attempting to register with the same email SHALL result in rejection.
**Validates: Requirements 1.2**

### Property 3: Password Length Validation
*For any* password string with length less than 8 characters, registration SHALL be rejected.
**Validates: Requirements 1.3**

### Property 4: Email Format Validation
*For any* string that does not match valid email format (regex pattern), registration SHALL be rejected.
**Validates: Requirements 1.4**

### Property 5: JWT Token Validity
*For any* valid user credentials, authentication SHALL return a JWT token that can be decoded and contains correct user_id and expiry timestamp (24 hours from issuance).
**Validates: Requirements 2.1**

### Property 6: Invalid Credentials Rejection
*For any* combination of email and password where either is incorrect, authentication SHALL return the same generic error message.
**Validates: Requirements 2.2**

### Property 7: JWT Authorization
*For any* valid non-expired JWT token, protected API routes SHALL return 200 status; for any invalid or expired token, routes SHALL return 401 status.
**Validates: Requirements 2.3, 2.4**

### Property 8: URL HTTPS Validation
*For any* URL string that does not start with "https://", APK generation submission SHALL be rejected.
**Validates: Requirements 3.2**

### Property 9: Package Name Format Validation
*For any* package name string that does not match pattern `^com\.[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`, submission SHALL be rejected.
**Validates: Requirements 3.3**

### Property 10: Icon File Size Validation
*For any* uploaded file larger than 1MB (1048576 bytes), submission SHALL be rejected.
**Validates: Requirements 3.5**

### Property 11: WhatsApp Message Generation
*For any* generate record, the generated WhatsApp URL SHALL contain the correct admin phone number (6282347303153), user email, generate ID, and amount (35000).
**Validates: Requirements 4.2**

### Property 12: Payment Initial Status
*For any* newly created payment record, the status SHALL be "pending".
**Validates: Requirements 4.3**

### Property 13: Admin Role Access Control
*For any* user with role "user", accessing admin API routes SHALL return 403 status; for any user with role "admin", accessing admin routes SHALL return 200 status.
**Validates: Requirements 9.1, 9.2**

### Property 14: Payment Confirmation State Transition
*For any* payment confirmation action by admin, the payment status SHALL change from "pending" to "confirmed" and generate status SHALL change to "building".
**Validates: Requirements 5.2**

### Property 15: Build Callback Success Handling
*For any* successful build callback with APK key, the generate status SHALL change to "ready" and apk_key SHALL be populated.
**Validates: Requirements 6.3**

### Property 16: Build Callback Failure Handling
*For any* failed build callback with error message, the generate status SHALL change to "failed" and error_message SHALL be populated.
**Validates: Requirements 6.4**

### Property 17: Download Count Increment
*For any* download action on a ready generate, the download_count SHALL increase by exactly 1.
**Validates: Requirements 7.4**

### Property 18: User Data Isolation
*For any* user querying their generates, the result SHALL only contain records where user_id matches the authenticated user's ID.
**Validates: Requirements 8.1**

### Property 19: Generate Record Round-Trip
*For any* valid generate request data, storing to D1 and then retrieving by ID SHALL return equivalent data (url, app_name, package_name match).
**Validates: Requirements 10.2**

## Error Handling

### API Error Responses

All API errors follow consistent format:
```typescript
interface ApiError {
  error: string;      // Error code
  message: string;    // Human-readable message
  details?: object;   // Optional validation details
}
```

**HTTP Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing JWT)
- `403` - Forbidden (insufficient role)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate email)
- `500` - Internal Server Error

### Validation Errors

Input validation menggunakan Zod schema dengan error messages yang jelas:
```typescript
const generateSchema = z.object({
  url: z.string().url().startsWith('https://'),
  app_name: z.string().min(1).max(50),
  package_name: z.string().regex(/^com\.[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
});
```

### Build Pipeline Errors

GitHub Actions errors di-capture dan dikirim via callback:
- Clone failure → "Failed to clone template repository"
- Config replacement failure → "Failed to apply configuration"
- Gradle build failure → "APK build failed: {gradle_error}"
- Upload failure → "Failed to upload APK to storage"

## Testing Strategy

### Unit Testing

Framework: **Vitest** untuk unit tests

**Test Coverage Areas:**
- Validation functions (email, password, URL, package name)
- JWT token generation dan verification
- Password hashing dan comparison
- WhatsApp URL generation
- Status transition logic

### Property-Based Testing

Framework: **fast-check** untuk property-based tests

**Configuration:**
- Minimum 100 iterations per property
- Seed-based reproducibility untuk debugging

**Test Annotations:**
Setiap property test HARUS di-tag dengan format:
```typescript
// **Feature: web2apk, Property 1: Password Storage Security**
// **Validates: Requirements 1.1**
```

### Integration Testing

- API endpoint tests dengan mock D1/R2
- Authentication flow tests
- Admin workflow tests

### Test File Structure
```
src/
├── lib/
│   ├── validation.ts
│   ├── validation.test.ts
│   ├── auth.ts
│   ├── auth.test.ts
│   └── ...
├── api/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── auth.test.ts
│   │   └── ...
```
