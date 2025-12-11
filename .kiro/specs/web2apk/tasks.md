# Implementation Plan

## Phase 1: Project Setup & Core Infrastructure

- [x] 1. Initialize monorepo project structure





  - Create workspace with `apps/web` (Next.js) and `apps/api` (Hono Workers)
  - Setup shared `packages/shared` for TypeScript types
  - Configure pnpm workspace
  - Setup TypeScript, ESLint, Prettier configs
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 2. Setup Cloudflare D1 database schema






  - [x] 2.1 Create D1 database and migration files

    - Write SQL migrations for users, generates, payments tables
    - Setup indexes for performance
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ]* 2.2 Write property test for data round-trip
    - **Property 19: Generate Record Round-Trip**
    - **Validates: Requirements 10.2**

- [x] 3. Setup Hono API base structure





  - [x] 3.1 Initialize Hono app with Cloudflare Workers bindings


    - Configure D1, R2 bindings
    - Setup CORS middleware
    - Setup error handling middleware
    - _Requirements: 10.1_

  - [x] 3.2 Create shared validation schemas with Zod

    - Email validation schema
    - Password validation schema
    - URL validation schema
    - Package name validation schema
    - _Requirements: 1.3, 1.4, 3.2, 3.3_
  - [ ]* 3.3 Write property tests for validation schemas
    - **Property 3: Password Length Validation**
    - **Property 4: Email Format Validation**
    - **Property 8: URL HTTPS Validation**
    - **Property 9: Package Name Format Validation**
    - **Validates: Requirements 1.3, 1.4, 3.2, 3.3**

## Phase 2: Authentication System

- [x] 4. Implement user registration







  - [x] 4.1 Create registration endpoint POST /api/auth/register




    - Validate email format and uniqueness
    - Validate password length (min 8 chars)
    - Hash password with bcrypt
    - Store user in D1
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 4.2 Write property tests for registration
    - **Property 1: Password Storage Security**
    - **Property 2: Email Uniqueness Enforcement**
    - **Validates: Requirements 1.1, 1.2**

- [x] 5. Implement user login and JWT






  - [x] 5.1 Create login endpoint POST /api/auth/login

    - Validate credentials against D1
    - Generate JWT with 24h expiry
    - Return token to client
    - _Requirements: 2.1, 2.2_

  - [x] 5.2 Create auth middleware for protected routes

    - Verify JWT token
    - Attach user to request context
    - Handle expired tokens
    - _Requirements: 2.3, 2.4_
  - [ ]* 5.3 Write property tests for authentication
    - **Property 5: JWT Token Validity**
    - **Property 6: Invalid Credentials Rejection**
    - **Property 7: JWT Authorization**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 6. Implement role-based access control





  - [x] 6.1 Create admin middleware


    - Check user role from JWT
    - Return 403 for non-admin users
    - _Requirements: 9.1, 9.2_

  - [x] 6.2 Create admin seeding script

    - Read admin credentials from environment variables
    - Create admin user on first run if not exists
    - _Requirements: 9.3_
  - [ ]* 6.3 Write property test for RBAC
    - **Property 13: Admin Role Access Control**
    - **Validates: Requirements 9.1, 9.2**

- [x] 7. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: APK Generation Flow

- [x] 8. Implement generate form submission






  - [x] 8.1 Create generate endpoint POST /api/generate

    - Validate URL (HTTPS only)
    - Validate package name format
    - Validate icon file (PNG, 512x512, max 1MB)
    - Upload icon to R2
    - Create generate record in D1 with status pending
    - Create payment record in D1
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3_
  - [ ]* 8.2 Write property tests for generate validation
    - **Property 10: Icon File Size Validation**
    - **Property 12: Payment Initial Status**
    - **Validates: Requirements 3.5, 4.3**

- [x] 9. Implement generate listing





  - [x] 9.1 Create GET /api/generate endpoint


    - Return only current user's generates
    - Include status, dates, download count
    - _Requirements: 8.1_


  - [x] 9.2 Create GET /api/generate/:id endpoint
    - Return single generate details
    - Verify ownership
    - _Requirements: 8.1_
  - [ ]* 9.3 Write property test for data isolation
    - **Property 18: User Data Isolation**
    - **Validates: Requirements 8.1**

- [x] 10. Implement WhatsApp confirmation






  - [x] 10.1 Create WhatsApp URL generator utility

    - Generate pre-filled message with email, generate ID, amount
    - Target phone: 6282347303153
    - _Requirements: 4.2_
  - [ ]* 10.2 Write property test for WA message
    - **Property 11: WhatsApp Message Generation**
    - **Validates: Requirements 4.2**

## Phase 4: Admin Panel & Payment Confirmation

- [x] 11. Implement admin payment management





  - [x] 11.1 Create GET /api/admin/payments endpoint


    - List all pending payments with user and generate details
    - Admin only access
    - _Requirements: 5.1_

  - [x] 11.2 Create POST /api/admin/payments/:id/confirm endpoint
    - Update payment status to confirmed
    - Update generate status to building
    - Trigger GitHub Actions webhook

    - _Requirements: 5.2, 5.4_
  - [x] 11.3 Create POST /api/admin/payments/:id/reject endpoint
    - Update payment status to rejected
    - _Requirements: 5.3_
  - [ ]* 11.4 Write property test for payment confirmation
    - **Property 14: Payment Confirmation State Transition**
    - **Validates: Requirements 5.2**

- [x] 12. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: GitHub Actions Build Pipeline

- [x] 13. Create GitHub Actions workflow






  - [x] 13.1 Create build.yml workflow file

    - Trigger on repository_dispatch event
    - Checkout template repo
    - Download icon from R2
    - Replace configuration files (MainActivity.kt, strings.xml, build.gradle, AndroidManifest.xml, settings.gradle)
    - Run ./gradlew assembleRelease
    - Upload APK to R2
    - Call callback URL with result
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 13.2 Write property test for config replacement
    - **Property: Config values correctly replaced in template files**
    - **Validates: Requirements 6.1**

- [x] 14. Implement build webhook callback






  - [x] 14.1 Create POST /api/webhook/build-complete endpoint

    - Verify webhook secret
    - Update generate status based on result
    - Store APK key or error message
    - _Requirements: 6.3, 6.4_
  - [ ]* 14.2 Write property tests for callback handling
    - **Property 15: Build Callback Success Handling**
    - **Property 16: Build Callback Failure Handling**
    - **Validates: Requirements 6.3, 6.4**

- [x] 15. Implement APK download






  - [x] 15.1 Create GET /api/generate/:id/download endpoint

    - Generate presigned R2 URL (7-day expiry)
    - Increment download count
    - _Requirements: 6.5, 7.1, 7.2, 7.4_
  - [ ]* 15.2 Write property test for download count
    - **Property 17: Download Count Increment**
    - **Validates: Requirements 7.4**

## Phase 6: Frontend Implementation

- [ ] 16. Setup Next.js frontend







  - [ ] 16.1 Initialize Next.js 15 with App Router
    - Configure for Cloudflare Pages
    - Setup Tailwind CSS
    - Create base layout
    - _Requirements: 1.5, 2.5_

- [x] 17. Implement authentication pages






  - [x] 17.1 Create login page

    - Email/password form
    - JWT storage in httpOnly cookie
    - Redirect to dashboard on success
    - _Requirements: 2.1, 2.2_

  - [x] 17.2 Create register page

    - Email/password form with validation
    - Redirect to login on success
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 18. Implement user dashboard





  - [x] 18.1 Create dashboard page


    - List user's generates with status badges
    - Download buttons for ready APKs
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 18.2 Create generate form page

    - URL, app name, package name inputs
    - Icon upload with preview
    - Validation feedback
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 18.3 Create payment modal component

    - Display QRIS image (qris.jpg)
    - WhatsApp confirmation button
    - _Requirements: 4.1, 4.2_

- [x] 19. Implement admin panel






  - [x] 19.1 Create admin page

    - List pending payments
    - Confirm/reject buttons
    - Role-based navigation
    - _Requirements: 5.1, 5.2, 5.3, 9.4_

- [x] 20. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Deployment & Integration

- [x] 21. Configure Cloudflare deployment






  - [x] 21.1 Setup wrangler.toml for Workers

    - Configure D1 binding
    - Configure R2 binding
    - Setup environment variables
    - _Requirements: 10.1, 10.4, 10.5_

  - [x] 21.2 Setup Cloudflare Pages for frontend

    - Configure build command
    - Setup environment variables
    - _Requirements: 1.5_

- [x] 22. Setup GitHub repository secrets






  - [x] 22.1 Configure secrets for GitHub Actions

    - CLOUDFLARE_API_TOKEN
    - R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
    - KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD
    - WEBHOOK_SECRET
    - CALLBACK_URL
    - _Requirements: 6.1, 6.2_


- [x] 23. Final integration testing






  - [x] 23.1 Test complete flow end-to-end





    - Register → Login → Generate → Payment → Admin Confirm → Build → Download
    - _Requirements: All_


- [x] 24. Final Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.
