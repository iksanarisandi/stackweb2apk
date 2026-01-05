# Requirements Document

## Introduction

Web2APK adalah SaaS berbasis Cloudflare yang mengonversi website menjadi Android WebView APK siap rilis Play Store dengan custom icon, nama app, dan package name. Platform ini menggunakan model pay-per-generate Rp35.000 dengan pembayaran manual QRIS dan konfirmasi WhatsApp. Sistem dibangun dengan full-stack Cloudflare (Next.js frontend, Hono backend Workers, D1 database, R2 storage) dan GitHub Actions untuk build pipeline.

## Glossary

- **Web2APK**: Sistem SaaS untuk konversi website ke Android APK
- **APK**: Android Package Kit, format file instalasi aplikasi Android
- **WebView**: Komponen Android untuk menampilkan konten web dalam aplikasi native
- **Package Name**: Identifier unik aplikasi Android (format: com.domain.name)
- **QRIS**: Quick Response Code Indonesian Standard, sistem pembayaran QR nasional
- **D1**: Cloudflare serverless SQL database (SQLite)
- **R2**: Cloudflare object storage (S3-compatible)
- **Hono**: Lightweight web framework untuk Cloudflare Workers
- **GitHub Actions**: CI/CD platform untuk automated build pipeline
- **JWT**: JSON Web Token untuk autentikasi stateless

## Requirements

### Requirement 1: User Registration

**User Story:** As a developer, I want to register an account with email and password, so that I can access the APK generation service.

#### Acceptance Criteria

1. WHEN a user submits registration with valid email and password THEN Web2APK SHALL create a new user account with bcrypt-hashed password and store it in D1 database
2. WHEN a user submits registration with an email that already exists THEN Web2APK SHALL reject the registration and display an error message indicating email is taken
3. WHEN a user submits registration with password less than 8 characters THEN Web2APK SHALL reject the registration and display password length requirement
4. WHEN a user submits registration with invalid email format THEN Web2APK SHALL reject the registration and display email format error
5. WHEN registration is successful THEN Web2APK SHALL redirect user to login page with success notification

### Requirement 2: User Authentication

**User Story:** As a registered user, I want to login with my credentials, so that I can access my dashboard and generate APKs.

#### Acceptance Criteria

1. WHEN a user submits valid email and password THEN Web2APK SHALL authenticate the user and issue a JWT token with 24-hour expiry
2. WHEN a user submits invalid credentials THEN Web2APK SHALL reject login and display authentication error without revealing which field is incorrect
3. WHILE a user has valid JWT token THEN Web2APK SHALL allow access to protected routes
4. WHEN JWT token expires THEN Web2APK SHALL redirect user to login page
5. WHEN a user clicks logout THEN Web2APK SHALL invalidate the session and redirect to login page

### Requirement 3: APK Generation Form

**User Story:** As a logged-in user, I want to submit website details for APK generation, so that I can convert my web app to Android APK.

#### Acceptance Criteria

1. WHEN a user submits APK generation form with valid URL, app name, package name, and icon THEN Web2APK SHALL validate all inputs and create a pending generate record in D1
2. WHEN a user submits URL that is not valid HTTPS format THEN Web2APK SHALL reject submission and display URL format error
3. WHEN a user submits package name not matching pattern com.domain.name THEN Web2APK SHALL reject submission and display package name format guidance
4. WHEN a user uploads icon that is not 512x512 PNG THEN Web2APK SHALL reject submission and display icon dimension requirement
5. WHEN a user uploads icon larger than 1MB THEN Web2APK SHALL reject submission and display file size limit error
6. WHEN form validation passes THEN Web2APK SHALL store icon to R2 and display QRIS payment screen
7. WHEN a user toggles GPS permission checkbox THEN Web2APK SHALL store enable_gps flag in generate record
8. WHEN a user toggles camera permission checkbox THEN Web2APK SHALL store enable_camera flag in generate record

### Requirement 4: Payment Processing

**User Story:** As a user with pending APK generation, I want to complete payment via QRIS, so that my APK can be built.

#### Acceptance Criteria

1. WHEN a user reaches payment screen THEN Web2APK SHALL display static QRIS code for Rp35.000 with unique transaction reference
2. WHEN a user clicks "Kirim Konfirmasi WA" button THEN Web2APK SHALL open WhatsApp with pre-filled message containing email, generate ID, and payment amount to 6282347303153
3. WHEN payment record is created THEN Web2APK SHALL store payment details in D1 with status pending
4. WHILE payment status is pending THEN Web2APK SHALL display waiting for confirmation message on user dashboard

### Requirement 5: Admin Payment Confirmation

**User Story:** As an admin, I want to confirm user payments, so that APK generation can proceed.

#### Acceptance Criteria

1. WHILE user has admin role THEN Web2APK SHALL display admin panel with list of pending payments
2. WHEN admin clicks confirm on a payment THEN Web2APK SHALL update payment status to confirmed and trigger APK build process
3. WHEN admin clicks reject on a payment THEN Web2APK SHALL update payment status to rejected and notify user
4. WHEN payment is confirmed THEN Web2APK SHALL trigger GitHub Actions workflow via repository dispatch webhook

### Requirement 6: APK Build Pipeline

**User Story:** As a system, I want to automatically build APK when payment is confirmed, so that users receive their generated APK.

#### Acceptance Criteria

1. WHEN GitHub Actions receives build trigger THEN Web2APK SHALL clone template repository and replace configuration values (URL, app name, package name, icon)
2. WHEN build configuration is applied THEN Web2APK SHALL execute Gradle assembleRelease with signing configuration
3. WHEN APK build succeeds THEN Web2APK SHALL upload signed APK to R2 storage and update generate record with download URL
4. WHEN APK build fails THEN Web2APK SHALL update generate status to failed and log error details
5. WHEN APK is uploaded to R2 THEN Web2APK SHALL generate presigned download URL with 7-day expiry
6. WHEN enable_gps flag is true THEN Web2APK SHALL add location permissions to AndroidManifest.xml and configure geolocation in MainActivity.kt
7. WHEN enable_camera flag is true THEN Web2APK SHALL add camera permission to AndroidManifest.xml and configure camera/file chooser in MainActivity.kt

### Requirement 7: APK Download

**User Story:** As a user with completed APK generation, I want to download my APK, so that I can install or publish it.

#### Acceptance Criteria

1. WHEN APK generation status is ready THEN Web2APK SHALL display download button on user dashboard
2. WHEN user clicks download THEN Web2APK SHALL serve APK file from R2 via presigned URL
3. WHEN download URL has expired THEN Web2APK SHALL display expiry message and option to request new link
4. WHEN user downloads APK THEN Web2APK SHALL increment download count in generate record

### Requirement 8: User Dashboard

**User Story:** As a logged-in user, I want to view my generation history, so that I can track and download my APKs.

#### Acceptance Criteria

1. WHEN user accesses dashboard THEN Web2APK SHALL display list of all user's APK generations with status, date, and download count
2. WHEN generation status is pending THEN Web2APK SHALL display "Menunggu Pembayaran" indicator
3. WHEN generation status is confirmed THEN Web2APK SHALL display "Sedang Diproses" indicator with estimated time
4. WHEN generation status is ready THEN Web2APK SHALL display download button and APK details
5. WHEN generation status is failed THEN Web2APK SHALL display error message and support contact option

### Requirement 9: Role-Based Access Control

**User Story:** As a system administrator, I want role-based access control, so that admin functions are protected from regular users.

#### Acceptance Criteria

1. WHEN user with role "user" attempts to access admin routes THEN Web2APK SHALL reject access and return 403 forbidden
2. WHEN user with role "admin" accesses admin routes THEN Web2APK SHALL allow access to admin panel
3. WHEN system initializes THEN Web2APK SHALL create default admin account from environment variables if not exists
4. WHILE displaying navigation THEN Web2APK SHALL show admin menu items only to users with admin role

### Requirement 10: Data Persistence

**User Story:** As a system, I want to persist all data reliably, so that user information and generation records are maintained.

#### Acceptance Criteria

1. WHEN storing user data THEN Web2APK SHALL save to D1 database with proper schema (id, email, password_hash, role, created_at)
2. WHEN storing generate data THEN Web2APK SHALL save to D1 with schema (id, user_id, url, app_name, package_name, icon_key, apk_key, status, created_at)
3. WHEN storing payment data THEN Web2APK SHALL save to D1 with schema (id, user_id, generate_id, amount, status, created_at)
4. WHEN storing icon files THEN Web2APK SHALL upload to R2 with unique key based on generate_id
5. WHEN storing APK files THEN Web2APK SHALL upload to R2 with lifecycle policy for 30-day auto-deletion

### Requirement 11: Android Permission Configuration

**User Story:** As a developer building attendance/absensi apps, I want to configure GPS and camera permissions in my generated APK, so that my web app can access device location and camera for attendance features.

#### Acceptance Criteria

1. WHEN a user enables GPS permission option in generate form THEN Web2APK SHALL include ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION permissions in AndroidManifest.xml
2. WHEN a user enables camera permission option in generate form THEN Web2APK SHALL include CAMERA permission in AndroidManifest.xml
3. WHEN GPS permission is enabled THEN Web2APK SHALL configure WebView to allow geolocation access with onGeolocationPermissionsShowPrompt callback
4. WHEN camera permission is enabled THEN Web2APK SHALL configure WebView to allow camera access via WebChromeClient file chooser for photo capture
5. WHEN the APK is launched and web app requests location THEN the generated APK SHALL prompt user for location permission and pass coordinates to WebView
6. WHEN the APK is launched and web app requests camera access THEN the generated APK SHALL prompt user for camera permission and allow photo capture via input file
7. WHEN storing generate data with permissions THEN Web2APK SHALL save permission flags (enable_gps, enable_camera) in D1 generates table
