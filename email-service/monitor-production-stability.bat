@echo off
cls
echo ========================================
echo    DREAMEX EMAIL SERVICE - MONITOR
echo    24-Hour Stability Monitoring
echo ========================================
echo.

REM Check if PM2 is available
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PM2 not found. Please install PM2 first.
    pause
    exit /b 1
)

:MONITOR_LOOP
cls
echo ========================================
echo    SERVICE MONITORING - %date% %time%
echo ========================================
echo.

echo 📊 Current Service Status:
pm2 status dreamex-email-service
echo.

echo 💾 Memory Usage Details:
pm2 show dreamex-email-service | findstr "memory\|uptime\|restarts\|status"
echo.

echo 📈 Resource Monitoring:
pm2 monit --lines 5
echo.

echo 📋 Recent Logs (Last 10 lines):
pm2 logs dreamex-email-service --lines 10 --nostream
echo.

echo 🔍 Health Check Summary:
echo   Service Name: dreamex-email-service
echo   Expected Memory Limit: 2GB
echo   Expected Max Restarts: 1000
echo   Memory Cleanup: Every 30 minutes
echo.

echo ⏰ Monitoring Options:
echo   [1] Continue monitoring (refresh every 30 seconds)
echo   [2] Show detailed service info
echo   [3] View full logs
echo   [4] Restart service if needed
echo   [5] Exit monitoring
echo.

set /p choice="Select option (1-5): "

if "%choice%"=="1" (
    echo Refreshing in 30 seconds...
    timeout /t 30 /nobreak >nul
    goto MONITOR_LOOP
)

if "%choice%"=="2" (
    echo.
    echo 📋 Detailed Service Information:
    pm2 show dreamex-email-service
    echo.
    pause
    goto MONITOR_LOOP
)

if "%choice%"=="3" (
    echo.
    echo 📝 Full Service Logs:
    pm2 logs dreamex-email-service
    pause
    goto MONITOR_LOOP
)

if "%choice%"=="4" (
    echo.
    echo 🔄 Restarting service...
    pm2 restart dreamex-email-service
    echo ✅ Service restarted
    echo.
    pause
    goto MONITOR_LOOP
)

if "%choice%"=="5" (
    echo Exiting monitoring...
    exit /b 0
)

echo Invalid choice. Please try again.
pause
goto MONITOR_LOOP
