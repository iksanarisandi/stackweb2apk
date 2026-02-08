# Analisis dan Review Fitur Generate HTML View

## Overview
Fitur "Generate HTML View" memungkinkan pengguna untuk mengunggah file HTML statis (dalam format ZIP) yang akan dikonversi menjadi aplikasi Android offline, berbeda dengan fitur WebView standar yang memuat URL website.

## Status Saat Ini
Fitur ini secara umum **sudah diimplementasikan dengan baik** dan seharusnya berjalan lancar, namun terdapat beberapa catatan teknis dan area yang perlu diperbaiki untuk menjaga kualitas kode dan pengalaman pengguna.

## Detail Analisis

### 1. Backend (`apps/api/src/routes/generate.ts`)
**Kondisi: Baik & Aman**
- **Validasi Input:** Backend melakukan validasi yang ketat dan aman:
  - Memastikan file ZIP valid.
  - Memastikan terdapat `index.html` di root folder ZIP.
  - Membatasi ukuran file (10MB) dan jumlah file (100).
  - Mengecek ekstensi file berbahaya (.exe, .sh, dll).
- **Keamanan:** Dilindungi dengan Turnstile (CAPTCHA) dan Rate Limiting.
- **Database:** Skema database (`migrations/0004_html_view.sql`) sudah mendukung penyimpanan `html_files_key` dan manajemen keystore khusus untuk build ini.

### 2. Frontend (`apps/web/src/app/(dashboard)/dashboard/generate/page.tsx`)
**Kondisi: Fungsional tapi Perlu Perbaikan Maintenance**
- **UI/UX:** Interface sudah cukup jelas membedakan antara WebView dan HTML View, termasuk penyesuaian harga otomatis.
- **Validasi:** Frontend memvalidasi keberadaan file dan tipe file (ZIP) sebelum upload.

## Masalah & Kendala yang Ditemukan

### 1. Hardcoded API URL (High Priority)
Ditemukan penulisan URL API secara hardcoded (langsung ditulis di kode) yang buruk untuk maintenance jangka panjang.
- **Lokasi:** `apps/web/src/app/(dashboard)/dashboard/generate/page.tsx` (Baris 192)
  ```typescript
  fetch('https://web2apk-api.threadsauto.workers.dev/api/generate', ...)
  ```
- **Lokasi:** `apps/web/src/lib/api.ts` (Baris 5)
  ```typescript
  const API_BASE_URL = 'https://web2apk-api.threadsauto.workers.dev';
  ```
- **Risiko:** Jika URL API berubah, aplikasi akan error. Sulit untuk membedakan environment development (localhost) dan production.

### 2. Validasi ZIP Client-Side (UX Improvement)
Saat ini validasi isi ZIP (apakah ada `index.html`) hanya terjadi di backend.
- **Risiko:** Pengguna baru tahu kalau ZIP mereka salah (misal `index.html` ada di dalam subfolder) setelah menunggu proses upload selesai.
- **Saran:** Tambahkan validasi ringan di frontend menggunakan library JS untuk mengecek isi ZIP sebelum dikirim.

### 3. Strict Root Check
Backend mengharuskan `index.html` berada tepat di root ZIP.
- **Potensi Masalah:** Pengguna awam sering men-zip *folder*-nya, bukan *isi file*-nya, sehingga `index.html` terbungkus satu folder lagi. Ini akan menyebabkan error "ZIP must contain index.html at the root level".

## Rekomendasi Perbaikan

Berikut adalah langkah-langkah perbaikan yang disarankan:

1.  **Refactor API URL:**
    - Ganti hardcoded URL di `apps/web/src/lib/api.ts` dan `generate/page.tsx` menggunakan environment variable `process.env.NEXT_PUBLIC_API_URL`.
    - Pastikan `.env.production` dan `.env.local` memiliki variable tersebut.

2.  **Perbaiki `generate/page.tsx`:**
    - Gunakan konstanta URL dari `process.env` atau import dari `@/lib/api`.

3.  **Tingkatkan Pesan Error:**
    - Pastikan pesan error untuk validasi ZIP sangat jelas, misalnya: "Pastikan index.html ada di luar, jangan di dalam folder lain saat membuat ZIP."

## Kesimpulan
Fitur **SIAP DIGUNAKAN** dan **AMAN**. Kendala utama hanya pada **Maintenance Code (Hardcoded URL)** yang sebaiknya diperbaiki sebelum pengembangan lebih lanjut agar tidak menyulitkan di masa depan.
