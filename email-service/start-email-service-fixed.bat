@echo off
echo 🚀 Starting Dreamex Datalab Email Service...
echo =====================================

cd /d "%~dp0"

:: Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Check if .env file exists
if not exist ".env" (
    echo ❌ Error: .env file not found
    echo Please create a .env file with your SMTP configuration
    pause
    exit /b 1
)

echo ✅ Starting email service on port 3001...
echo 📧 Press Ctrl+C to stop the service
echo.

node email-server.js
