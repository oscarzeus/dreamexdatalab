@echo off
echo Starting Dreamex Email Service at system startup...

:: Wait for system to fully load
timeout /t 30 /nobreak >nul

:: Change to email service directory
cd /d "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

:: Start PM2 daemon if not running
pm2 ping >nul 2>&1
if errorlevel 1 (
    echo Starting PM2 daemon...
    pm2 ping
)

:: Resurrect saved processes
pm2 resurrect

:: If no processes, start the email service
pm2 status dreamex-email-service >nul 2>&1
if errorlevel 1 (
    echo Starting email service...
    pm2 start ecosystem.config.json --env production
    pm2 save
)

echo Dreamex Email Service startup completed.
