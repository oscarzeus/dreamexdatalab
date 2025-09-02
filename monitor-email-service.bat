@echo off
echo 🔍 Dreamex Email Service Health Monitor
echo =====================================

:monitor_loop
cls
echo [%date% %time%] Checking email service health...
echo.

:: Check PM2 status
echo 📊 PM2 Status:
pm2 status dreamex-email-service

echo.
echo 🌐 Service Health Check:
curl -f http://localhost:3001/health 2>nul
if errorlevel 1 (
    echo ❌ Health check failed - Service may be down
    echo 🔄 Attempting to restart service...
    pm2 restart dreamex-email-service
) else (
    echo ✅ Service is healthy and responding
)

echo.
echo 📈 Memory Usage:
pm2 show dreamex-email-service | findstr "memory"

echo.
echo 📊 Recent Activity:
pm2 logs dreamex-email-service --lines 5 --nostream

echo.
echo ⏰ Next check in 60 seconds... (Press Ctrl+C to stop)
timeout /t 60 /nobreak >nul
goto monitor_loop
