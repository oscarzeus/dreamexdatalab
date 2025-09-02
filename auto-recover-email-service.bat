@echo off
title Dreamex Email Service Auto-Recovery

:recovery_loop
echo [%date% %time%] Checking email service...

:: Test if service is responding
curl -f http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Service is down - Initiating recovery...
    
    :: Try PM2 restart first
    pm2 restart dreamex-email-service
    timeout /t 10 >nul
    
    :: Test again
    curl -f http://localhost:3001/health >nul 2>&1
    if errorlevel 1 (
        echo 🔄 PM2 restart failed - Full recovery...
        pm2 stop dreamex-email-service
        pm2 delete dreamex-email-service
        cd /d "c:\Users\Dreamex Lab\dreamexdatalab\email-service"
        pm2 start ecosystem.config.json --env production
        pm2 save
    )
    
    echo ✅ Recovery completed
) else (
    echo ✅ Service is healthy
)

:: Wait 5 minutes before next check
timeout /t 300 >nul
goto recovery_loop
