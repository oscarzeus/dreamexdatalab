@echo off
REM Dreamex Email Service - Production Startup Script for Windows

echo 🚀 Starting Dreamex Email Service (Production Mode)...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js LTS version first.
    pause
    exit /b 1
)

REM Check Node.js version (require at least v16)
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set MAJOR_VERSION=%%i

if %MAJOR_VERSION% LSS 16 (
    echo ❌ Node.js version 16 or higher is required for production. Current version: v%NODE_VERSION%
    echo Please upgrade to Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js version: v%NODE_VERSION% (Compatible)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Navigate to email service directory
cd /d "%~dp0"

echo 📂 Working directory: %cd%

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ package.json not found. Please ensure you are in the correct directory.
    pause
    exit /b 1
)

REM Install/update dependencies
echo 📦 Installing production dependencies...
npm ci --only=production --no-audit --no-fund
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Production .env file not found.
    
    if exist ".env.production" (
        echo 📋 Copying from .env.production template...
        copy ".env.production" ".env"
        echo ✅ .env file created from production template.
        echo ⏸️  IMPORTANT: Please edit the .env file with your production settings:
        echo     - SMTP credentials (SMTP_USER, SMTP_PASS)
        echo     - Production domains (ALLOWED_ORIGINS)
        echo     - Secure API key (API_KEY)
        echo     - SSL/TLS settings
        echo.
        echo Press any key to open .env file for editing...
        pause >nul
        notepad .env
        echo.
        echo After editing .env, run this script again to start the service.
        pause
        exit /b 0
    ) else if exist ".env.example" (
        echo 📋 Copying from .env.example...
        copy ".env.example" ".env"
        echo ✅ .env file created. Please update with production settings.
        echo Press any key to open .env file for editing...
        pause >nul
        notepad .env
        echo After editing .env, run this script again to start the service.
        pause
        exit /b 0
    ) else (
        echo ❌ No environment template found. Please create a .env file with your production configuration.
        echo Required environment variables:
        echo   SMTP_HOST=mail.privateemail.com
        echo   SMTP_PORT=587
        echo   SMTP_USER=your_email@domain.com
        echo   SMTP_PASS=your_password
        echo   NODE_ENV=production
        echo   API_KEY=your_secure_api_key
        echo   ALLOWED_ORIGINS=https://yourdomain.com
        pause
        exit /b 1
    )
)

REM Validate critical environment variables
echo 🔍 Validating production configuration...

REM Check if critical variables are set (basic check)
findstr /C:"SMTP_USER=" .env >nul
if %errorlevel% neq 0 (
    echo ❌ SMTP_USER not found in .env file
    set MISSING_CONFIG=1
)

findstr /C:"SMTP_PASS=" .env >nul
if %errorlevel% neq 0 (
    echo ❌ SMTP_PASS not found in .env file
    set MISSING_CONFIG=1
)

findstr /C:"API_KEY=" .env >nul
if %errorlevel% neq 0 (
    echo ❌ API_KEY not found in .env file
    set MISSING_CONFIG=1
)

findstr /C:"NODE_ENV=production" .env >nul
if %errorlevel% neq 0 (
    echo ⚠️  NODE_ENV is not set to 'production' - running in development mode
)

if defined MISSING_CONFIG (
    echo ❌ Critical configuration missing. Please update .env file.
    echo Press any key to open .env file for editing...
    pause >nul
    notepad .env
    echo After editing .env, run this script again.
    pause
    exit /b 1
)

echo ✅ Configuration validation passed

REM Create logs directory if it doesn't exist
if not exist "logs" (
    mkdir logs
    echo 📁 Created logs directory
)

REM Run pre-flight checks
echo 🔍 Running pre-flight checks...

REM Test email configuration
echo 📧 Testing SMTP configuration...
node -e "
require('dotenv').config();
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});
transporter.verify().then(() => {
    console.log('✅ SMTP configuration valid');
    process.exit(0);
}).catch((error) => {
    console.log('❌ SMTP configuration failed:', error.message);
    process.exit(1);
});
" 2>nul

if %errorlevel% neq 0 (
    echo ❌ SMTP configuration test failed
    echo Please check your email settings in the .env file
    echo Common issues:
    echo   - Incorrect SMTP credentials
    echo   - Network connectivity issues
    echo   - SMTP server settings
    pause
    exit /b 1
)

echo ✅ Pre-flight checks passed

REM Check if PM2 is available for production process management
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    echo 🔄 PM2 detected - using PM2 for production deployment
    echo Starting service with PM2...
    
    REM Stop existing PM2 process if running
    pm2 stop dreamex-email-service 2>nul
    pm2 delete dreamex-email-service 2>nul
    
    REM Start with PM2 - Fixed memory limit and restart policy
    pm2 start email-server-production.js --name "dreamex-email-service" --max-memory-restart 2G --error-action restart --max-restarts 1000
    
    if %errorlevel% equ 0 (
        echo ✅ Service started with PM2
        echo.
        echo 📊 Service Management Commands:
        echo   pm2 status dreamex-email-service    - Check status
        echo   pm2 logs dreamex-email-service      - View logs
        echo   pm2 restart dreamex-email-service   - Restart service
        echo   pm2 stop dreamex-email-service      - Stop service
        echo.
        pm2 status dreamex-email-service
    ) else (
        echo ❌ Failed to start with PM2
        echo Falling back to direct Node.js execution...
        goto :direct_start
    )
) else (
    echo 💡 PM2 not found - running directly with Node.js
    echo For production, consider installing PM2: npm install -g pm2
    goto :direct_start
)

echo.
echo 🌐 Email service is running at: http://localhost:%PORT%
echo 🏥 Health check: http://localhost:%PORT%/health
echo 📊 Metrics: http://localhost:%PORT%/metrics
echo.
echo ✅ Dreamex Email Service started successfully in production mode!
echo.
echo Press Ctrl+C to stop the service
goto :end

:direct_start
echo 🚀 Starting email service directly...
set NODE_ENV=production
node email-server-production.js

:end
pause
