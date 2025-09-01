@echo off
echo 🚀 Starting Dreamex Datalab Email Service...
echo =====================================

cd /d "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

:: Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if package.json exists
if not exist "package.json" (
    echo ❌ Error: package.json not found in email-service directory
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Start the enhanced email server
echo 🎯 Starting enhanced email server on port 3001...
echo 📧 Email service will handle staff reminder notifications
echo 🔗 Service URL: http://localhost:3001
echo ⚡ Press Ctrl+C to stop the service
echo.

node email-server-enhanced.js
