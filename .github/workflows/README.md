# GitHub Actions Workflows

## Build APK Workflow

The `build-apk.yml` workflow is triggered via repository dispatch when a payment is confirmed in the Web2APK system.

### Required Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Description | How to Obtain |
|--------|-------------|---------------|
| `KEYSTORE_BASE64` | Base64-encoded Android keystore file for signing APKs | See "Generating Android Keystore" below |
| `KEYSTORE_PASSWORD` | Password for the keystore | Set when creating keystore |
| `KEY_ALIAS` | Alias of the key in the keystore | Set when creating keystore |
| `KEY_PASSWORD` | Password for the key | Set when creating keystore |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key ID | Cloudflare Dashboard → R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret access key | Cloudflare Dashboard → R2 → Manage R2 API Tokens |
| `R2_ENDPOINT` | Cloudflare R2 endpoint URL | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Cloudflare R2 bucket name | Name of your R2 bucket (e.g., `web2apk-storage`) |
| `WEBHOOK_SECRET` | Secret for authenticating webhook callbacks | Generate with `openssl rand -hex 32` |

---

## Step-by-Step Setup Guide

### 1. Generate Android Keystore

Create a new keystore for signing APKs:

```bash
# Generate a new keystore
keytool -genkey -v -keystore release-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias web2apk

# You will be prompted for:
# - Keystore password (save this as KEYSTORE_PASSWORD)
# - Key password (save this as KEY_PASSWORD)
# - Your name, organization, etc.
```

Convert the keystore to Base64:

```bash
# Linux/macOS
base64 -w 0 release-keystore.jks > keystore-base64.txt

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release-keystore.jks")) | Out-File keystore-base64.txt -NoNewline

# Copy the content of keystore-base64.txt as KEYSTORE_BASE64 secret
```

### 2. Create Cloudflare R2 API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → **Manage R2 API Tokens**
3. Click **Create API Token**
4. Select permissions:
   - **Object Read & Write** for your bucket
5. Copy the **Access Key ID** → `R2_ACCESS_KEY_ID`
6. Copy the **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

### 3. Get R2 Endpoint and Bucket Name

1. In Cloudflare Dashboard, go to **R2**
2. Your **Account ID** is in the URL or sidebar
3. R2 Endpoint format: `https://<account_id>.r2.cloudflarestorage.com`
4. Bucket name is the name you created (e.g., `web2apk-storage`)

### 4. Generate Webhook Secret

```bash
# Linux/macOS
openssl rand -hex 32

# Windows (PowerShell)
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Important:** This same secret must be configured in your Cloudflare Workers API as `WEBHOOK_SECRET`.

### 5. Add Secrets to GitHub Repository

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret:

```
KEYSTORE_BASE64      = <content from keystore-base64.txt>
KEYSTORE_PASSWORD    = <your keystore password>
KEY_ALIAS            = web2apk (or your chosen alias)
KEY_PASSWORD         = <your key password>
R2_ACCESS_KEY_ID     = <from Cloudflare R2>
R2_SECRET_ACCESS_KEY = <from Cloudflare R2>
R2_ENDPOINT          = https://<account_id>.r2.cloudflarestorage.com
R2_BUCKET            = web2apk-storage
WEBHOOK_SECRET       = <generated secret>
```

### 6. Configure Cloudflare Workers API

Ensure the API has matching secrets:

```bash
# Set the same webhook secret in Workers
wrangler secret put WEBHOOK_SECRET
# Enter the same value you used for GitHub

# Set GitHub token for triggering workflows
wrangler secret put GITHUB_TOKEN
# Create a GitHub PAT with 'repo' scope
```

---

## Trigger Payload

The workflow expects a `repository_dispatch` event with `event_type: build_apk` and the following `client_payload`:

```json
{
  "generate_id": "uuid-of-generate-record",
  "url": "https://example.com",
  "app_name": "My App",
  "package_name": "com.example.app",
  "icon_url": "https://r2-url/icons/icon.png",
  "callback_url": "https://api.example.com/api/webhook/build-complete"
}
```

---

## Workflow Steps

1. Validates the payload
2. Checks out the template repository
3. Downloads and processes the icon (generates multiple density sizes)
4. Replaces configuration files (MainActivity.kt, strings.xml, build.gradle, AndroidManifest.xml, settings.gradle)
5. Builds the release APK with signing
6. Uploads the APK to R2 storage
7. Calls the callback URL with success/failure status

---

## Verification Checklist

After setup, verify your configuration:

- [ ] All 9 secrets are configured in GitHub repository settings
- [ ] Keystore file is valid and can sign APKs
- [ ] R2 API token has read/write permissions
- [ ] R2 endpoint URL is correct (includes account ID)
- [ ] R2 bucket exists and is accessible
- [ ] Webhook secret matches between GitHub and Cloudflare Workers
- [ ] GitHub token in Workers has `repo` scope for repository_dispatch

---

## Troubleshooting

### Build fails at "Decode keystore"
- Verify `KEYSTORE_BASE64` is properly encoded without line breaks
- Re-encode using `base64 -w 0` flag

### Upload to R2 fails
- Check R2 API token permissions
- Verify R2 endpoint URL format
- Ensure bucket name is correct

### Callback fails
- Verify `WEBHOOK_SECRET` matches in both GitHub and Workers
- Check callback URL is accessible from GitHub Actions

### APK signing fails
- Verify keystore password and key password are correct
- Ensure key alias matches what's in the keystore
