@echo off
echo ========================================
echo Starting Dreamex Secure Email Service
echo ========================================

:: Set the working directory
cd /d "%~dp0"

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if required environment file exists
if not exist ".env.secure-v2" (
    echo ERROR: .env.secure-v2 file not found
    echo Please copy .env.secure-v2 and configure your settings
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Check required dependencies
echo Checking security dependencies...
npm ls express nodemailer cors helmet express-rate-limit >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing missing dependencies...
    npm install express nodemailer cors helmet express-rate-limit dotenv
)

:: Set environment to use secure configuration
set NODE_ENV=production
copy ".env.secure-v2" ".env" >nul 2>&1

:: Create logs directory
if not exist "logs" mkdir logs

:: Start the secure email service
echo.
echo Starting secure email service...
echo Security features: Content filtering, Rate limiting, IP reputation, Trusted senders
echo.
echo Service will be available at: http://localhost:3001
echo Health check: http://localhost:3001/health
echo Security status: http://localhost:3001/security/status
echo.
echo Press Ctrl+C to stop the service
echo.

:: Start with enhanced logging
node email-server-secure-v2.js

:: If the service stops, show error message
echo.
echo ========================================
echo Service stopped. Check logs for errors.
echo ========================================
pause
