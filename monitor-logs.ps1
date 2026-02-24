# Script untuk monitor Cloudflare Worker logs real-time
# Jalankan script ini, lalu kirim command /check ke Telegram bot

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Monitoring Web2APK Worker Logs" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "1. Script ini akan menampilkan logs real-time dari worker" -ForegroundColor White
Write-Host "2. Buka Telegram dan kirim command: /check" -ForegroundColor White
Write-Host "3. Lihat output di terminal ini untuk detail" -ForegroundColor White
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Memulai monitoring..." -ForegroundColor Green
Write-Host "Teksa Ctrl+C untuk berhenti" -ForegroundColor Gray
Write-Host ""

Push-Location "D:\Dari Desktop\Kiro\stackweb2apk\apps\api"
wrangler tail --env production --format pretty
Pop-Location
