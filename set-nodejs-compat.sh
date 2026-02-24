#!/bin/bash
# Script untuk set nodejs_compat flag di Cloudflare Pages

# Ganti dengan nilai Anda
CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID_HERE"
CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN_HERE"
PROJECT_NAME="web2apk-web"

echo "Updating Cloudflare Pages project compatibility flags..."

curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "production_environment": {
      "compatibility_flags": ["nodejs_compat"],
      "compatibility_date": "2024-01-01"
    },
    "preview_environment": {
      "compatibility_flags": ["nodejs_compat"],
      "compatibility_date": "2024-01-01"
    }
  }'

echo ""
echo "Done! Please check https://2apk.de after a few seconds."
