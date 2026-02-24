# PowerShell Script untuk set nodejs_compat flag di Cloudflare Pages

# Ganti dengan nilai Anda
$CLOUDFLARE_ACCOUNT_ID = "YOUR_ACCOUNT_ID_HERE"
$CLOUDFLARE_API_TOKEN = "YOUR_API_TOKEN_HERE"
$PROJECT_NAME = "web2apk-web"

Write-Host "Updating Cloudflare Pages project compatibility flags..." -ForegroundColor Cyan

$body = @{
    production_environment = @{
        compatibility_flags = @("nodejs_compat")
        compatibility_date = "2024-01-01"
    }
    preview_environment = @{
        compatibility_flags = @("nodejs_compat")
        compatibility_date = "2024-01-01"
    }
} | ConvertTo-Json

$url = "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT_NAME"

try {
    $response = Invoke-RestMethod -Uri $url -Method Patch -Headers @{
        "Authorization" = "Bearer $CLOUDFLARE_API_TOKEN"
        "Content-Type" = "application/json"
    } -Body $body

    Write-Host "Success! Compatibility flags updated." -ForegroundColor Green
    Write-Host "Please check https://2apk.de after a few seconds." -ForegroundColor Yellow
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}
