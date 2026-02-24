# Fix Node.js Compatibility Error di Cloudflare Pages

## Masalah
Error: "no nodejs_compat compatibility flag set"

## Solusi via Cloudflare Dashboard

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Pilih **Workers & Pages**
3. Klik project **web2apk-web**
4. Pilih tab **Settings**
5. Scroll ke **Compatibility Flags**
6. Klik **Add flag** dan tambahkan:
   - **Name**: `nodejs_compat`
   - Value: `true`
7. Pilih **Production** dan **Preview** environments
8. Klik **Save**

## Solusi via Wrangler CLI

```bash
# Set nodejs_compat flag untuk production
npx wrangler pages deployment create --project-name=web2apk-web --branch=production \
  --compatibility-flag=nodejs_compat --compatibility-date=2024-01-01

# Atau set di project settings
npx wrangler pages project settings --project-name=web2apk-web \
  --compatibility-flags=nodejs_compat
```

## Solusi via API

```bash
# Get project settings
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/web2apk-web" \
  -H "Authorization: Bearer {API_TOKEN}"

# Update with nodejs_compat flag
curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/web2apk-web" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "production_environment": {
      "compatibility_flags": ["nodejs_compat"]
    },
    "preview_environment": {
      "compatibility_flags": ["nodejs_compat"]
    }
  }'
```

## Verifikasi

Setelah mengatur flag:
1. Clear browser cache
2. Refresh website: https://2apk.de
3. Error seharusnya hilang

## Alternatif: Tambahkan ke _headers file

Jika tidak bisa ubah settings, buat file `apps/web/public/_headers`:

```
/*
  X-Cloudflare-Compatibility-Flag: nodejs_compat
```

Lalu deploy ulang.
