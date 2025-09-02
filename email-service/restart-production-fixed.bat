@echo off
cls
echo ========================================
echo    DREAMEX EMAIL SERVICE - RESTART
echo    Production Service Manager
echo ========================================
echo.

REM Check if PM2 is available
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PM2 not found. Please install PM2 first:
    echo npm install -g pm2
    pause
    exit /b 1
)

echo 🔄 Stopping existing service...
pm2 stop dreamex-email-service 2>nul
pm2 delete dreamex-email-service 2>nul

echo 🧹 Clearing PM2 logs...
pm2 flush dreamex-email-service 2>nul

echo 🚀 Starting service with optimized configuration...
pm2 start ecosystem.config.json --env production

if %errorlevel% equ 0 (
    echo ✅ Service restarted successfully!
    echo.
    echo 📊 Service Status:
    pm2 status dreamex-email-service
    echo.
    echo 📋 Service Management Commands:
    echo   pm2 status dreamex-email-service    - Check status
    echo   pm2 logs dreamex-email-service      - View logs
    echo   pm2 restart dreamex-email-service   - Restart service
    echo   pm2 stop dreamex-email-service      - Stop service
    echo   pm2 monit                           - Monitor resources
    echo.
    echo 🔍 Memory Usage Monitoring:
    echo   pm2 show dreamex-email-service      - Detailed info
    echo.
    echo ✅ Email service is now running with:
    echo   - Memory limit: 2GB (was 500MB)
    echo   - Max restarts: 1000 (was 10)
    echo   - Memory cleanup: Every 30 minutes
    echo   - Graceful shutdown: Enabled
    echo.
    echo 📝 Fixed Issues:
    echo   ✓ Increased memory limit to prevent premature restarts
    echo   ✓ Increased max restart count for production stability
    echo   ✓ Added periodic memory cleanup to prevent leaks
    echo   ✓ Improved graceful shutdown handling
    echo   ✓ Enhanced process monitoring and logging
    echo.
    echo 🚨 The service should no longer deactivate after 24 hours!
) else (
    echo ❌ Failed to start service
    echo Check the logs: pm2 logs dreamex-email-service
)

echo.
echo Press any key to exit...
pause >nul
