@echo off
echo 🔧 Setting up Dreamex Email Service Auto-Startup...
echo =================================================

:: Check if running as administrator
net session >nul 2>&1
if NOT %errorLevel% == 0 (
    echo ❌ This script requires Administrator privileges
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Step 1: Creating Windows Task for auto-startup...

:: Delete existing task if it exists
schtasks /delete /tn "DreamexEmailServiceStartup" /f >nul 2>&1

:: Create scheduled task to run at startup
schtasks /create /tn "DreamexEmailServiceStartup" ^
    /tr "\"c:\Users\Dreamex Lab\dreamexdatalab\startup-email-service.bat\"" ^
    /sc onstart ^
    /ru "SYSTEM" ^
    /rl highest ^
    /f

if errorlevel 1 (
    echo ❌ Failed to create scheduled task
    pause
    exit /b 1
)

echo Step 2: Testing task creation...
schtasks /query /tn "DreamexEmailServiceStartup"

echo.
echo ✅ Auto-Startup Successfully Configured!
echo.
echo Your email service will now:
echo ✅ Start automatically when Windows boots
echo ✅ Run as SYSTEM user (highest privileges)
echo ✅ Continue running even if you log out
echo ✅ Survive computer restarts and sleep
echo.
echo To test: Restart your computer and check if service starts
echo To verify: Run 'pm2 status' after restart
echo.
pause
