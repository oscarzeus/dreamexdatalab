@echo off
cls
echo ========================================
echo    DREAMEX EMAIL SERVICE - QUICK START
echo    Fixed SMTP Service with Dependencies
echo ========================================
echo.

echo 🔍 Checking for existing email service...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3001') do (
    echo 🛑 Stopping existing service on port 3001...
    taskkill /f /pid %%i 2>nul
)

echo 📧 Starting Dreamex Email Service...
cd /d "%~dp0"

echo 📦 Installing dependencies (if needed)...
npm install --silent

echo 🚀 Starting email service...
start /min cmd /c "node email-server.js"

timeout /t 3 /nobreak >nul

echo 🔍 Checking service status...
netstat -ano | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo ✅ Email service started successfully on port 3001
    echo.
    echo 📧 Service Details:
    echo   - URL: http://localhost:3001
    echo   - Health Check: http://localhost:3001/health
    echo   - SMTP: mail.privateemail.com:587
    echo   - From: info@dreamexdatalab.com
    echo.
    echo 🎯 The service is now ready for staff.html notifications!
    echo.
    echo 📝 Next Steps:
    echo   1. Open staff.html in your browser
    echo   2. Test the email notifications
    echo   3. Monitor service with: netstat -ano ^| findstr :3001
    echo.
    echo 🚨 Note: Service is running in background!
    echo Press any key to close this window (service will continue)...
) else (
    echo ❌ Failed to start email service
    echo Check for errors and try again
    pause
)

pause >nul
