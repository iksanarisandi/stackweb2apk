#!/bin/bash
# Script untuk monitor Cloudflare Worker logs real-time
# Jalankan script ini, lalu kirim command /check ke Telegram bot

echo "=================================="
echo "Monitoring Web2APK Worker Logs"
echo "=================================="
echo ""
echo "Instructions:"
echo "1. Script ini akan menampilkan logs real-time dari worker"
echo "2. Buka Telegram dan kirim command: /check"
echo "3. Lihat output di terminal ini untuk detail"
echo ""
echo "=================================="
echo ""

cd "D:\Dari Desktop\Kiro\stackweb2apk\apps\api"
wrangler tail --env production --format pretty
