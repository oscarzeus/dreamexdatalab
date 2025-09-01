@echo off
echo Starting Dreamex Datalab Email Service...
echo ========================================

cd /d "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

echo Checking if Node.js is installed...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found. Starting email service...
echo.
echo The service will be available at: http://localhost:3001
echo Press Ctrl+C to stop the service
echo.

node email-server.js

pause
