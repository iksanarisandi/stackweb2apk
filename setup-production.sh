#!/bin/bash
# Setup Script for Web2APK Production Deployment
# Run this after deploying the worker to configure Telegram integration

set -e

echo "================================"
echo "Web2APK Production Setup"
echo "================================"
echo ""

# Configuration
WORKER_URL="https://web2apk-api.threadsauto.workers.dev"
WEBHOOK_ENDPOINT="${WORKER_URL}/api/telegram/webhook"
BOT_TOKEN="8556257852:AAGzMjV_HB2zrLiGtoQs7zImy8QefFsKDG4"
ADMIN_ID="5787181924"
WEBHOOK_SECRET="8beb39c147978cff73c0aa6c8b374e9572e6bd67b000488af88847b180595710"

echo "Step 1: Setting Wrangler Secrets..."
echo "-----------------------------------"

# Set Telegram Bot Token
echo "Setting TELEGRAM_BOT_TOKEN..."
echo "$BOT_TOKEN" | wrangler secret put TELEGRAM_BOT_TOKEN --env production

# Set Telegram Admin ID
echo "Setting TELEGRAM_ADMIN_ID..."
echo "$ADMIN_ID" | wrangler secret put TELEGRAM_ADMIN_ID --env production

# Set Webhook Secret
echo "Setting TELEGRAM_WEBHOOK_SECRET..."
echo "$WEBHOOK_SECRET" | wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production

echo ""
echo "Step 2: Verifying Secrets..."
echo "----------------------------"
wrangler secret list --env production

echo ""
echo "Step 3: Setting Telegram Webhook..."
echo "-----------------------------------"

# Set webhook via Telegram API
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_ENDPOINT}\",
    \"secret_token\": \"${WEBHOOK_SECRET}\"
  }"

echo ""
echo ""
echo "Step 4: Verifying Webhook..."
echo "----------------------------"

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq '.'

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Next Steps:"
echo "1. Test the bot by sending /start to @myweb2apk_bot"
echo "2. Initialize admin user:"
echo "   curl -X POST '${WORKER_URL}/api/init' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'X-Init-Secret: <YOUR_ADMIN_PASSWORD>'"
echo ""
echo "3. Monitor logs:"
echo "   wrangler tail --env production"
echo ""
