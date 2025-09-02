@echo off
echo Starting Dreamex Email Service...
echo ================================

cd /d "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

echo Checking if email service is already running...
netstat -an | findstr :3001 > nul
if %errorlevel% equ 0 (
    echo Email service is already running on port 3001
    pause
    exit /b 0
)

echo Starting enhanced email server...
node email-server-enhanced.js

pause
