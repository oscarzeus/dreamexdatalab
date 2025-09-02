@echo off
echo 🔧 Installing PM2 as Windows Service...
echo =========================================

:: Check if running as administrator
net session >nul 2>&1
if NOT %errorLevel% == 0 (
    echo ❌ This script requires Administrator privileges
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Step 1: Installing PM2 Windows Service module...
npm install -g pm2-windows-service

echo Step 2: Setting up PM2 Windows Service...
pm2-service-install -n "DreamexEmailPM2"

echo Step 3: Starting PM2 service...
sc start "DreamexEmailPM2"

echo Step 4: Setting service to auto-start...
sc config "DreamexEmailPM2" start= auto

echo.
echo ✅ PM2 Windows Service Installation Complete!
echo.
echo Service Details:
echo - Service Name: DreamexEmailPM2
echo - Startup Type: Automatic
echo - Status: Running
echo.
echo Your PM2 processes will now:
echo ✅ Start automatically when Windows boots
echo ✅ Run even when you're not logged in
echo ✅ Survive computer restarts
echo ✅ Continue running when you sleep/hibernate
echo.
echo Next step: Start your email service with PM2
pause
