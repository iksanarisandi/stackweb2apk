# Setup Script for Web2APK Production Deployment (Windows PowerShell)
# Run this after deploying the worker to configure Telegram integration

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Web2APK Production Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$WORKER_URL = "https://web2apk-api.threadsauto.workers.dev"
$WEBHOOK_ENDPOINT = "$WORKER_URL/api/telegram/webhook"
$BOT_TOKEN = "8556257852:AAGzMjV_HB2zrLiGtoQs7zImy8QefFsKDG4"
$ADMIN_ID = "5787181924"
$WEBHOOK_SECRET = "8beb39c147978cff73c0aa6c8b374e9572e6bd67b000488af88847b180595710"

Write-Host "Step 1: Setting Wrangler Secrets..." -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow

# Note: Wrangler secret put requires interactive input
# You'll need to enter these manually when prompted
Write-Host "Please set the following secrets manually (wrangler requires interactive input):" -ForegroundColor Red
Write-Host ""
Write-Host "1. TELEGRAM_BOT_TOKEN:" -ForegroundColor White
Write-Host "   wrangler secret put TELEGRAM_BOT_TOKEN --env production" -ForegroundColor Gray
Write-Host "   Enter: $BOT_TOKEN" -ForegroundColor Green
Write-Host ""
Write-Host "2. TELEGRAM_ADMIN_ID:" -ForegroundColor White
Write-Host "   wrangler secret put TELEGRAM_ADMIN_ID --env production" -ForegroundColor Gray
Write-Host "   Enter: $ADMIN_ID" -ForegroundColor Green
Write-Host ""
Write-Host "3. TELEGRAM_WEBHOOK_SECRET:" -ForegroundColor White
Write-Host "   wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production" -ForegroundColor Gray
Write-Host "   Enter: $WEBHOOK_SECRET" -ForegroundColor Green
Write-Host ""

$continue = Read-Host "Have you set all the secrets? (y/n)"
if ($continue -ne "y") {
    Write-Host "Please set the secrets first, then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Setting Telegram Webhook..." -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow

# Set webhook via Telegram API
$webhookPayload = @{
    url = $WEBHOOK_ENDPOINT
    secret_token = $WEBHOOK_SECRET
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" `
        -Method Post `
        -ContentType "application/json" `
        -Body $webhookPayload

    Write-Host "Webhook set response:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Error setting webhook: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verifying Webhook..." -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow

try {
    $webhookInfo = Invoke-RestMethod `
        -Uri "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"

    Write-Host "Current webhook status:" -ForegroundColor Green
    Write-Host ($webhookInfo | ConvertTo-Json -Depth 10)

    if ($webhookInfo.result.url -eq $WEBHOOK_ENDPOINT) {
        Write-Host ""
        Write-Host "✓ Webhook successfully configured!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Webhook URL doesn't match. Please check the configuration." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error verifying webhook: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 4: Testing API Health..." -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "$WORKER_URL/api/health"
    Write-Host "API Health Status:" -ForegroundColor Green
    Write-Host ($health | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Error checking health: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test the bot by sending /start to @myweb2apk_bot" -ForegroundColor White
Write-Host "2. Initialize admin user:" -ForegroundColor White
Write-Host "   curl -X POST '$WORKER_URL/api/init' `" -ForegroundColor Gray
Write-Host "     -H 'Content-Type: application/json' `" -ForegroundColor Gray
Write-Host "     -H 'X-Init-Secret: <YOUR_ADMIN_PASSWORD>'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Monitor logs:" -ForegroundColor White
Write-Host "   wrangler tail --env production" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test Telegram commands:" -ForegroundColor White
Write-Host "   /start - Show available commands" -ForegroundColor Gray
Write-Host "   /pending - List pending payments" -ForegroundColor Gray
Write-Host "   /confirm <id> - Confirm payment" -ForegroundColor Gray
Write-Host "   /retry <id> - Retry failed build" -ForegroundColor Gray
Write-Host ""
