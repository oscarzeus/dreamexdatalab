@echo off
REM Dreamex Email Service - Production Hardening Script
REM This script sets up the email service for maximum reliability and uptime

echo ========================================
echo   Dreamex Email Service Production Setup
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Warning: Not running as administrator. Some features may not work.
    echo For full production setup, please run as administrator.
    echo.
)

REM Create logs directory if it doesn't exist
if not exist "logs" (
    mkdir logs
    echo Created logs directory
)

REM Set up environment file if it doesn't exist
if not exist ".env" (
    echo Creating production environment configuration...
    (
        echo NODE_ENV=production
        echo PORT=3001
        echo API_KEY=dreemex_hse_email_service_2025
        echo SMTP_HOST=mail.privateemail.com
        echo SMTP_PORT=587
        echo SMTP_SECURE=false
        echo FROM_NAME=Dreamex Datalab HSE
        echo FROM_EMAIL=no-reply@dreamexdatalab.com
        echo ENABLE_EMAIL_LOGGING=true
        echo EMAIL_RATE_LIMIT=200
        echo HEALTH_CHECK_INTERVAL=300000
        echo ENABLE_METRICS=true
        echo RETRY_ATTEMPTS=5
        echo RETRY_DELAY=3000
        echo LOG_LEVEL=info
    ) > .env
    echo Created .env file with production defaults
)

REM Install production dependencies
echo Installing production dependencies...
npm ci --only=production --silent

REM Install PM2 globally if not present
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing PM2 process manager...
    npm install -g pm2
)

REM Stop any existing instances
echo Stopping any existing service instances...
pm2 stop dreamex-email-service 2>nul
pm2 delete dreamex-email-service 2>nul

REM Start the service with PM2
echo Starting email service with PM2 (production mode)...
pm2 start ecosystem.config.json --env production

REM Save PM2 process list for auto-restart
pm2 save

REM Set up PM2 to start on system boot
echo Setting up auto-start on system boot...
pm2 startup

REM Configure Windows firewall rule for port 3001 (if running as admin)
netsh advfirewall firewall show rule name="Dreamex Email Service" >nul 2>&1
if %errorlevel% neq 0 (
    echo Adding Windows Firewall rule for port 3001...
    netsh advfirewall firewall add rule name="Dreamex Email Service" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1
    if %errorlevel% equ 0 (
        echo Firewall rule added successfully
    ) else (
        echo Note: Could not add firewall rule (requires administrator)
    )
)

REM Create monitoring task (optional)
echo.
echo Setting up service monitoring...
schtasks /query /tn "DreamexEmailServiceMonitor" >nul 2>&1
if %errorlevel% neq 0 (
    echo Creating scheduled task for service monitoring...
    schtasks /create /tn "DreamexEmailServiceMonitor" /tr "powershell.exe -ExecutionPolicy Bypass -File \"%~dp0Monitor-EmailService.ps1\"" /sc minute /mo 5 /ru SYSTEM /f >nul 2>&1
    if %errorlevel% equ 0 (
        echo Service monitoring task created (runs every 5 minutes)
    ) else (
        echo Note: Could not create monitoring task (requires administrator)
    )
)

echo.
echo ========================================
echo   Production Setup Complete!
echo ========================================
echo.

REM Show service status
echo Current service status:
pm2 list

echo.
echo Health check:
curl -f -s http://localhost:3001/health
if %errorlevel% equ 0 (
    echo ✅ Service is healthy and responding
) else (
    echo ⚠️ Service may still be starting... please wait 30 seconds and check again
)

echo.
echo Production Features Enabled:
echo ✅ PM2 Process Manager (auto-restart on crash)
echo ✅ Auto-start on system boot
echo ✅ Memory monitoring (2GB limit with restart)
echo ✅ Health monitoring every 5 minutes
echo ✅ Exponential backoff restart delays
echo ✅ Circuit breaker for SMTP failures
echo ✅ Rate limiting and security
echo ✅ Structured logging
echo ✅ Graceful shutdown handling
echo.
echo Management Commands:
echo   pm2 list                  - Show service status
echo   pm2 logs                  - View real-time logs
echo   pm2 restart dreamex-email-service - Restart service
echo   pm2 stop dreamex-email-service    - Stop service
echo   pm2 monit                 - Process monitoring dashboard
echo.
echo Monitor Script:
echo   Monitor-EmailService.ps1  - Continuous monitoring script
echo.

pause
