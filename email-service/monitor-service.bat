@echo off
REM Dreamex Email Service - Continuous Monitoring and Auto-Restart Script
REM This script ensures the email service never stays down for more than 30 seconds

echo Starting Email Service Monitor...
echo This script will continuously monitor and restart the email service if needed.
echo Press Ctrl+C to stop monitoring.
echo.

:MONITOR_LOOP
    REM Check if the email service is running
    curl -f -s http://localhost:3001/health >nul 2>&1
    
    if %errorlevel% neq 0 (
        echo [%date% %time%] Email service is DOWN! Attempting restart...
        
        REM Try to restart with PM2 first
        pm2 restart dreamex-email-service >nul 2>&1
        if %errorlevel% equ 0 (
            echo [%date% %time%] Restarted with PM2
        ) else (
            echo [%date% %time%] PM2 restart failed, starting manually...
            
            REM Kill any existing processes
            taskkill /f /im node.exe /fi "WINDOWTITLE eq email-server*" >nul 2>&1
            
            REM Start the service manually
            start /b "" node email-server-production.js
            echo [%date% %time%] Started manually
        )
        
        REM Wait for service to start
        timeout /t 10 /nobreak >nul
        
        REM Verify it's running
        curl -f -s http://localhost:3001/health >nul 2>&1
        if %errorlevel% equ 0 (
            echo [%date% %time%] Email service is now ONLINE
        ) else (
            echo [%date% %time%] Failed to restart email service - check logs
        )
    ) else (
        echo [%date% %time%] Email service is ONLINE
    )
    
    REM Wait 30 seconds before next check
    timeout /t 30 /nobreak >nul
    
goto MONITOR_LOOP
