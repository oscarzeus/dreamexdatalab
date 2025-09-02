@echo off
REM Dreamex Email Service Startup Script for Windows

echo 🚀 Starting Dreamex Email Service...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Navigate to email service directory
cd /d "%~dp0"

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  .env file not found. Copying from .env.example...
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo ✅ .env file created. Please update the email credentials.
        echo ⏸️  Please edit the .env file with your email settings and run this script again.
        pause
        exit /b 0
    ) else (
        echo ❌ .env.example file not found. Please create a .env file with your email configuration.
        pause
        exit /b 1
    )
)

REM Start the email service
echo 📧 Starting email service on port 3001...
echo 🔗 Service will be available at: http://localhost:3001
echo 📊 Health check: http://localhost:3001/health
echo 🛑 Press Ctrl+C to stop the service
echo.

REM Check if running in dev mode
if "%1"=="dev" (
    echo 🔧 Running in development mode with auto-restart...
    npm run dev
) else (
    echo 🚀 Running in production mode...
    npm start
)

pause
