# Web2APK - SaaS Website to APK Converter

Web2APK adalah platform SaaS berbasis Cloudflare yang mengubah website menjadi aplikasi Android (APK/AAB) siap rilis ke Play Store. Dengan custom icon, nama app, package name, dan permissions standar.

## 📋 Fitur Utama

- ✅ Konversi website ke Android WebView APK/AAB
- 🎨 Custom icon (512x512 PNG) dan nama aplikasi
- 📦 Signed APK/AAB siap upload ke Play Store
- 🔐 Sistem autentikasi user dengan JWT
- 💳 Pembayaran QRIS Rp35.000 per generate
- 🤖 Telegram Bot untuk admin management
- 🚀 Full stack Cloudflare (Workers + D1 + R2)
- ⚡ Rate limiting dan security headers

## 🏗️ Arsitektur Teknis

### Stack Teknologi

- **Frontend**: Next.js 15 (App Router) → Cloudflare Pages
- **Backend**: Hono (Workers) → Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (APK & Icons)
- **Auth**: JWT + bcrypt
- **Build**: GitHub Actions (Android build pipeline)
- **Bot**: Telegram Bot API

### Monorepo Structure

```
web2apk/
├── apps/
│   ├── api/           # Cloudflare Workers API (Hono)
│   └── web/           # Next.js Frontend
├── packages/
│   └── shared/        # Shared utilities & types
├── .github/
│   └── workflows/     # GitHub Actions (APK build pipeline)
├── web2apk-release.jks # Android signing keystore
└── pnpm-workspace.yaml
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.10.0
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare Account (Workers + D1 + R2)
- GitHub Account (untuk build pipeline)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd stackweb2apk

# Install dependencies
pnpm install

# Setup environment variables
cp apps/api/.dev.example apps/api/.dev
```

### Local Development

```bash
# Terminal 1: Start API (Cloudflare Workers)
cd apps/api
wrangler dev

# Terminal 2: Start Web Frontend
cd apps/web
pnpm dev

# Visit http://localhost:3000
```

## 📦 Deployment

### 1. Cloudflare Workers (API)

```bash
# Login ke Cloudflare
npx wrangler login

# Deploy ke production
cd apps/api
pnpm deploy

# Atau deploy ke environment spesifik
wrangler deploy --env production
```

**Environment Variables:**

Set via Wrangler CLI atau Dashboard:

```bash
# Required Secrets
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_EMAIL
wrangler secret put ADMIN_PASSWORD
wrangler secret put GITHUB_TOKEN
wrangler secret put WEBHOOK_SECRET
wrangler secret put TURNSTILE_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_ADMIN_ID
wrangler secret put TELEGRAM_WEBHOOK_SECRET

# Environment Variables (via wrangler.toml)
ENVIRONMENT = "production"
ALLOWED_ORIGINS = "https://2apk.de"
```

### 2. Database Migrations

```bash
# Local development
cd apps/api
wrangler d1 migrations apply web2apk-db --local

# Production
wrangler d1 migrations apply web2apk-db --remote
```

**Schema:**

- `users`: User accounts & authentication
- `generates`: APK generation requests
- `payments`: Payment records

### 3. Cloudflare Pages (Frontend)

```bash
# Build untuk Cloudflare Pages
cd apps/web
pnpm build

# Build output ke .vercel/output/static
# Deploy via Dashboard atau Wrangler:
npx wrangler pages deploy .vercel/output/static
```

### 4. GitHub Actions Setup

**Required Secrets di GitHub Repository:**

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Base64-encoded Android keystore |
| `KEYSTORE_PASSWORD` | Password keystore |
| `KEY_ALIAS` | Alias key dalam keystore |
| `KEY_PASSWORD` | Password key |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_ENDPOINT` | R2 endpoint URL |
| `R2_BUCKET` | Nama R2 bucket |
| `WEBHOOK_SECRET` | Webhook authentication secret |

**Generate Keystore:**

```bash
# Buat keystore baru
keytool -genkey -v -keystore web2apk-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias web2apk

# Encode ke Base64
base64 -w 0 web2apk-release.jks > keystore-base64.txt

# Copy content sebagai KEYSTORE_BASE64 secret
```

## 🔧 Konfigurasi

### API Endpoints

**Public:**
- `GET /` - Service status
- `GET /api/health` - Health check

**Authentication:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

**Generate APK:**
- `POST /api/generate` - Create APK generation request
- `GET /api/generate` - List user's generations
- `GET /api/generate/:id` - Get generation details
- `GET /api/generate/:id/download` - Get download link
- `GET /api/generate/:id/file` - Download APK file

**Admin:**
- `GET /api/admin/payments` - List all payments
- `GET /api/admin/payments/pending` - List pending payments
- `POST /api/admin/payments/:id/confirm` - Confirm payment
- `GET /api/admin/generates` - List all generations
- `GET /api/admin/generates/failed` - List failed builds
- `POST /api/admin/generates/:id/retry` - Retry failed build

**Telegram Bot:**
- `POST /api/telegram/webhook` - Telegram webhook endpoint

**Webhook:**
- `POST /api/webhook/build-complete` - GitHub Actions callback

### Telegram Bot Commands

Setelah webhook aktif, admin dapat menggunakan:

- `/start` - Tampilkan semua command
- `/pending` - List pending payments
- `/check` - List payments sukses tapi build gagal/stuck
- `/confirm <payment_id>` - Konfirmasi pembayaran & mulai build
- `/retry <payment_id>` - Retry failed build

### Rate Limiting

- **General**: 100 requests per 15 menit per IP
- **Generate**: 5 requests per jam per user, 10 per jam per IP
- **Download**: 20 requests per menit per IP
- **Init**: 3 requests per jam per IP
- **Health**: 60 requests per menit per IP

## 🔐 Security

- JWT authentication dengan 24h expiry
- Password hashing dengan bcrypt
- CORS untuk domain spesifik
- Rate limiting multi-tier
- Security headers (HSTS, X-Frame-Options, CSP)
- CAPTCHA verification (Cloudflare Turnstile)
- Input validation dengan Zod

## 📊 Monitoring

### View Worker Logs

```bash
# Real-time logs
wrangler tail --env production

# Logs spesifik
wrangler tail --format pretty
```

### Database Management

```bash
# Query database
wrangler d1 execute web2apk-db --remote --command "SELECT * FROM users"

# Backup database
wrangler d1 export web2apk-db --remote --output=backup.sql
```

## 🛠️ Troubleshooting

### Webhook Tidak Aktif

```bash
# Verifikasi secrets
wrangler secret list --env production

# Check bot token
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Set webhook ulang
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://web2apk-api.threadsauto.workers.dev/api/telegram/webhook"}'
```

### Build Gagal

- Check GitHub Actions logs
- Verify R2 credentials
- Validate keystore password
- Check webhook secret match

### Database Migration Error

```bash
# Reset database (WARNING: akan delete semua data)
wrangler d1 execute web2apk-db --remote --command "DROP TABLE IF EXISTS users, generates, payments"

# Re-run migrations
wrangler d1 migrations apply web2apk-db --remote
```

## 📝 Setup Production

Untuk setup lengkap production, gunakan script yang sudah disediakan:

**Linux/macOS:**
```bash
bash setup-production.sh
```

**Windows PowerShell:**
```powershell
.\setup-production.ps1
```

Script ini akan:
1. Set semua required secrets
2. Activate Telegram webhook
3. Initialize admin user
4. Verifikasi deployment

**Production URL:**
- API: `https://web2apk-api.threadsauto.workers.dev`
- Frontend: `https://2apk.de`

## 🧪 Testing

```bash
# Run semua tests
pnpm test

# Test specific package
cd apps/api
pnpm test

cd apps/web
pnpm test
```

## 📄 Licensing & Pricing

- **Harga**: Rp35.000 per generate
- **Payment**: QRIS manual + konfirmasi WhatsApp
- **Support**: WhatsApp ke +6282347303153

## 🤝 Contributing

1. Fork repository
2. Buat feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

Untuk pertanyaan atau issues:
- WhatsApp: +6282347303153
- Email: support@web2apk.de
- Telegram: @myweb2apk_bot

## 🗺️ Roadmap

- [ ] Auto-payment gateway integration
- [ ] Custom splash screen (Rp10.000 upsell)
- [ ] Package name availability checker
- [ ] Build queue monitoring dashboard
- [ ] Multi-language support
- [ ] White-label solution for agencies

---

**Built with ❤️ using Cloudflare Workers + Next.js**
