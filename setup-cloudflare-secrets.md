# Setup Cloudflare Pages Deployment

## Masalah
GitHub Actions workflow `deploy-web.yml` gagal karena secrets berikut belum diset:
- `CLOUDFLARE_API_TOKEN` - API Token untuk deploy ke Cloudflare Pages
- `CLOUDFLARE_ACCOUNT_ID` - ID akun Cloudflare

## Solusi

### Langkah 1: Dapatkan Cloudflare Account ID

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pilih domain/konfigurasi apapun
3. Di sidebar kanan, scroll ke bawah ke bagian "API"
4. Copy **Account ID** (format: 32 karakter hex)

### Langkah 2: Buat API Token untuk Cloudflare Pages

1. Kunjungi: https://dash.cloudflare.com/profile/api-tokens
2. Klik **"Create Token"**
3. Pilih template **"Edit Cloudflare Workers"** atau buat custom dengan permission:
   - **Account** > **Cloudflare Pages** > **Edit**
4. Klik **"Continue to summary"** > **"Create Token"**
5. **Copy token** yang muncul (hanya muncul sekali!)

### Langkah 3: Set Secrets di GitHub

Via GitHub CLI:
```bash
# Set Account ID
gh secret set CLOUDFLARE_ACCOUNT_ID --body "YOUR_ACCOUNT_ID_HERE"

# Set API Token
gh secret set CLOUDFLARE_API_TOKEN --body "YOUR_API_TOKEN_HERE"
```

Atau via GitHub Web:
1. Buka: https://github.com/iksanarisandi/stackweb2apk/settings/secrets/actions
2. Klik **"New repository secret"**
3. Name: `CLOUDFLARE_ACCOUNT_ID`, Value: paste Account ID
4. Klik **"Add secret"**
5. Ulangi untuk `CLOUDFLARE_API_TOKEN`

### Langkah 4: Re-run Workflow

Setelah secrets diset:
```bash
gh workflow run deploy-web.yml
```

Atau buka: https://github.com/iksanarisandi/stackweb2apk/actions/workflows/deploy-web.yml
Klik **"Run workflow"**

## Cek Status Deploy

Setelah berhasil:
- Frontend akan di-deploy ke Cloudflare Pages
- URL: https://web2apk-web.pages.dev
- Custom domain: https://2apk.de

## Troubleshooting

### Error: "Input required and not supplied: apiToken"
→ `CLOUDFLARE_API_TOKEN` belum diset

### Error: "Invalid API Token"
→ Token tidak memiliki permission yang cukup. Pastikan token memiliki permission **Cloudflare Pages > Edit**

### Error: "Account not found"
→ `CLOUDFLARE_ACCOUNT_ID` salah. Cek lagi di dashboard Cloudflare
