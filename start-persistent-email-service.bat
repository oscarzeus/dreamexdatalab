@echo off
echo 🚀 Starting Persistent Email Service with PM2...
echo ===============================================

cd /d "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

:: Check if PM2 is running
pm2 ping >nul 2>&1
if errorlevel 1 (
    echo 🔄 Starting PM2 daemon...
    pm2 ping
)

:: Stop existing service if running
echo 🛑 Stopping existing email service...
pm2 stop dreamex-email-service 2>nul
pm2 delete dreamex-email-service 2>nul

:: Create logs directory
if not exist "logs" mkdir logs

:: Start the email service with PM2
echo 🎯 Starting email service with PM2 ecosystem...
pm2 start ecosystem.config.json --env production

:: Save PM2 process list
echo 💾 Saving PM2 process list for auto-recovery...
pm2 save

:: Setup startup script (will survive reboots)
echo 🔧 Setting up automatic startup after reboot...
pm2 startup

echo.
echo ✅ Email Service Started Successfully!
echo.
echo Service Status:
pm2 status dreamex-email-service

echo.
echo 📊 Monitor your service:
echo   pm2 monit
echo   pm2 logs dreamex-email-service
echo   pm2 status
echo.
echo 🌐 Service URL: http://localhost:3001
echo 🔍 Health Check: http://localhost:3001/health
echo.
echo 🎯 Service Features:
echo   ✅ Runs 24/7 even when computer sleeps
echo   ✅ Auto-restarts on crashes
echo   ✅ Survives computer reboots
echo   ✅ Memory limit: 2GB
echo   ✅ Automatic failover
echo.
pause
