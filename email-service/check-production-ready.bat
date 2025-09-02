@echo off
REM Production Readiness Verification Script
REM This script verifies that the email service is production-ready

echo 🔍 DREAMEX EMAIL SERVICE - PRODUCTION READINESS CHECK
echo ====================================================

set CHECKS_PASSED=0
set CHECKS_FAILED=0
set WARNINGS=0

echo.
echo 1️⃣ ENVIRONMENT VERIFICATION
echo --------------------------

REM Check Node.js version
echo Checking Node.js version...
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set MAJOR_VERSION=%%i

if %MAJOR_VERSION% GEQ 16 (
    echo ✅ Node.js v%NODE_VERSION% - Compatible
    set /a CHECKS_PASSED+=1
) else (
    echo ❌ Node.js v%NODE_VERSION% - Requires v16+ for production
    set /a CHECKS_FAILED+=1
)

REM Check npm version
echo Checking npm version...
for /f "tokens=1" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm v%NPM_VERSION%
set /a CHECKS_PASSED+=1

echo.
echo 2️⃣ CONFIGURATION VERIFICATION
echo ----------------------------

REM Check if .env exists
if exist ".env" (
    echo ✅ .env file exists
    set /a CHECKS_PASSED+=1
    
    REM Check critical environment variables
    echo Checking environment variables...
    
    findstr /C:"NODE_ENV=production" .env >nul
    if %errorlevel% equ 0 (
        echo ✅ NODE_ENV set to production
        set /a CHECKS_PASSED+=1
    ) else (
        echo ⚠️  NODE_ENV not set to production
        set /a WARNINGS+=1
    )
    
    findstr /C:"SMTP_USER=" .env | findstr /V "YOUR_EMAIL" >nul
    if %errorlevel% equ 0 (
        echo ✅ SMTP_USER configured
        set /a CHECKS_PASSED+=1
    ) else (
        echo ❌ SMTP_USER not configured or using placeholder
        set /a CHECKS_FAILED+=1
    )
    
    findstr /C:"SMTP_PASS=" .env | findstr /V "YOUR_PASSWORD" >nul
    if %errorlevel% equ 0 (
        echo ✅ SMTP_PASS configured
        set /a CHECKS_PASSED+=1
    ) else (
        echo ❌ SMTP_PASS not configured or using placeholder
        set /a CHECKS_FAILED+=1
    )
    
    findstr /C:"API_KEY=" .env | findstr /V "GENERATE_" | findstr /V "your_" >nul
    if %errorlevel% equ 0 (
        echo ✅ API_KEY configured
        set /a CHECKS_PASSED+=1
    ) else (
        echo ❌ API_KEY not configured or using placeholder
        set /a CHECKS_FAILED+=1
    )
    
    findstr /C:"ALLOWED_ORIGINS=" .env | findstr /C:"https://" >nul
    if %errorlevel% equ 0 (
        echo ✅ ALLOWED_ORIGINS configured with HTTPS
        set /a CHECKS_PASSED+=1
    ) else (
        echo ❌ ALLOWED_ORIGINS not configured with HTTPS domains
        set /a CHECKS_FAILED+=1
    )
    
) else (
    echo ❌ .env file missing
    set /a CHECKS_FAILED+=1
)

echo.
echo 3️⃣ DEPENDENCY VERIFICATION
echo -------------------------

REM Check if node_modules exists
if exist "node_modules" (
    echo ✅ Dependencies installed
    set /a CHECKS_PASSED+=1
) else (
    echo ❌ Dependencies not installed - run 'npm ci --only=production'
    set /a CHECKS_FAILED+=1
)

REM Check package.json
if exist "package.json" (
    echo ✅ package.json exists
    set /a CHECKS_PASSED+=1
) else (
    echo ❌ package.json missing
    set /a CHECKS_FAILED+=1
)

echo.
echo 4️⃣ SECURITY VERIFICATION
echo -----------------------

REM Check for production server file
if exist "email-server-production.js" (
    echo ✅ Production server file exists
    set /a CHECKS_PASSED+=1
) else (
    echo ❌ Production server file missing
    set /a CHECKS_FAILED+=1
)

REM Check PM2 ecosystem config
if exist "ecosystem.config.json" (
    echo ✅ PM2 ecosystem configuration exists
    set /a CHECKS_PASSED+=1
) else (
    echo ⚠️  PM2 ecosystem configuration missing (optional)
    set /a WARNINGS+=1
)

echo.
echo 5️⃣ SMTP CONNECTIVITY TEST
echo ------------------------

if exist ".env" (
    echo Testing SMTP configuration...
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
        console.log('✅ SMTP connection successful');
        process.exit(0);
    }).catch((error) => {
        console.log('❌ SMTP connection failed:', error.message);
        process.exit(1);
    });
    " 2>nul
    
    if %errorlevel% equ 0 (
        set /a CHECKS_PASSED+=1
    ) else (
        echo ❌ SMTP connectivity test failed
        set /a CHECKS_FAILED+=1
    )
) else (
    echo ⚠️  Skipping SMTP test - no .env file
    set /a WARNINGS+=1
)

echo.
echo 6️⃣ LOG DIRECTORY CHECK
echo ---------------------

if exist "logs" (
    echo ✅ Logs directory exists
    set /a CHECKS_PASSED+=1
) else (
    mkdir logs 2>nul
    if exist "logs" (
        echo ✅ Created logs directory
        set /a CHECKS_PASSED+=1
    ) else (
        echo ❌ Could not create logs directory
        set /a CHECKS_FAILED+=1
    )
)

echo.
echo 7️⃣ PM2 AVAILABILITY CHECK
echo ------------------------

where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ PM2 is available
    set /a CHECKS_PASSED+=1
) else (
    echo ⚠️  PM2 not installed - recommend: npm install -g pm2
    set /a WARNINGS+=1
)

echo.
echo ====================================================
echo 📊 PRODUCTION READINESS SUMMARY
echo ====================================================
echo ✅ Checks Passed: %CHECKS_PASSED%
echo ❌ Checks Failed: %CHECKS_FAILED%
echo ⚠️  Warnings: %WARNINGS%

if %CHECKS_FAILED% equ 0 (
    echo.
    echo 🎉 PRODUCTION READY!
    echo Your email service is ready for production deployment.
    echo.
    echo Next steps:
    echo 1. Start service: start-production.bat
    echo 2. Run tests: node test-production.js
    echo 3. Monitor logs: pm2 logs dreamex-email-service
    echo.
    echo For deployment guide, see: PRODUCTION_DEPLOYMENT.md
) else (
    echo.
    echo ❌ NOT PRODUCTION READY
    echo Please fix the failed checks before deploying to production.
    echo.
    echo Common fixes:
    echo - Update .env with real credentials
    echo - Install dependencies: npm ci --only=production  
    echo - Check SMTP server connectivity
    echo - Ensure all configuration placeholders are replaced
)

if %WARNINGS% gtr 0 (
    echo.
    echo ⚠️  Warnings detected - these are not blocking but recommended for production:
    echo - Install PM2 for process management
    echo - Set NODE_ENV=production
    echo - Review security configurations
)

echo.
echo ====================================================

REM Exit with error code if any checks failed
if %CHECKS_FAILED% gtr 0 (
    exit /b 1
) else (
    exit /b 0
)
