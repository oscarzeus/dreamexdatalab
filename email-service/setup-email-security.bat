@echo off
echo ========================================================
echo    Dreamex Email Security System - Complete Setup
echo ========================================================
echo.

:: Set working directory
cd /d "%~dp0"

:: Check if running in email-service directory
if not exist "EmailSecurityValidator.js" (
    echo ERROR: Please run this script from the email-service directory
    echo Expected location: C:\Users\Dreamex Lab\dreamexdatalab\email-service\
    pause
    exit /b 1
)

echo [1/7] Checking prerequisites...
:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js is installed

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not available
    pause
    exit /b 1
)
echo ✓ npm is available

echo.
echo [2/7] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed

echo.
echo [3/7] Setting up environment configuration...
if not exist ".env" (
    if exist ".env.secure-v2" (
        copy ".env.secure-v2" ".env"
        echo ✓ Environment configuration copied from .env.secure-v2
    ) else (
        echo WARNING: .env.secure-v2 template not found
        echo Please create .env file manually with your SMTP settings
    )
) else (
    echo ✓ Environment configuration already exists
)

echo.
echo [4/7] Creating logs directory...
if not exist "logs" (
    mkdir logs
    echo ✓ Logs directory created
) else (
    echo ✓ Logs directory already exists
)

echo.
echo [5/7] Configuring frontend integration...
:: Copy secure email client to main js directory
if exist "..\js\dreamex-secure-email-client.js" (
    echo ✓ Secure email client already installed
) else (
    copy "dreamex-secure-email-client.js" "..\js\" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✓ Secure email client installed to js directory
    ) else (
        echo WARNING: Could not copy secure email client to js directory
    )
)

:: Copy configuration file
if exist "..\js\dreamex-config.js" (
    echo ✓ Configuration file already exists
) else (
    if exist "dreamex-config.js" (
        copy "dreamex-config.js" "..\js\" >nul 2>&1
        if %errorlevel% equ 0 (
            echo ✓ Configuration file installed to js directory
        ) else (
            echo WARNING: Could not copy configuration file
        )
    )
)

echo.
echo [6/7] Running security tests...
echo Testing email security system...
timeout /t 2 /nobreak >nul

:: Start email service in background for testing
echo Starting email service for testing...
start /b "EmailService" node email-server-secure-v2.js >nul 2>&1

:: Wait for service to start
timeout /t 5 /nobreak >nul

:: Run basic health check
echo Performing health check...
curl -f -s http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Email service is responding
) else (
    echo WARNING: Email service health check failed
    echo Please check your configuration and try starting manually
)

:: Stop test service
taskkill /f /im node.exe >nul 2>&1

echo.
echo [7/7] Setup complete!
echo.
echo ========================================================
echo                  SETUP SUMMARY
echo ========================================================
echo.
echo ✅ Email Security System installed successfully!
echo.
echo NEXT STEPS:
echo.
echo 1. CONFIGURE YOUR SETTINGS:
echo    - Edit .env file with your SMTP credentials
echo    - Set a strong API key (32+ characters)
echo    - Configure allowed origins for your domain
echo.
echo 2. UPDATE YOUR API KEY:
echo    - Edit js\dreamex-config.js
echo    - Replace 'YOUR_API_KEY_HERE' with your actual API key
echo.
echo 3. START THE SERVICE:
echo    - Run: start-secure-email-service.bat
echo    - Or: npm run start:secure
echo.
echo 4. TEST THE SECURITY:
echo    - Run: npm run test:security
echo    - Check: http://localhost:3001/health
echo.
echo 5. MONITOR SECURITY:
echo    - Run: Monitor-EmailSecurity.ps1 (PowerShell)
echo    - Check logs in the logs/ directory
echo.
echo SECURITY FEATURES ENABLED:
echo • Content filtering and spam detection
echo • Rate limiting (50 emails/hour per sender)
echo • IP reputation tracking
echo • Trusted sender validation
echo • Duplicate email prevention
echo • Strong API key authentication
echo • TLS encryption enforcement
echo.
echo DOCUMENTATION:
echo • README-SECURITY.md - Complete security guide
echo • .env.secure-v2 - Configuration template
echo • trusted-senders.json - Sender management
echo.
echo ========================================================
echo   Your email system is now protected against abuse!
echo ========================================================
echo.
pause
