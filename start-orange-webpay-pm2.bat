@echo off
setlocal enabledelayedexpansion

rem Start Orange WebPay backend via PM2 on Windows
rem - Runs in production mode on port 8080
rem - Expects a configured .env.prod in orange-webpay folder

set SRV_DIR=%~dp0orange-webpay
if not exist "%SRV_DIR%" (
  echo ERROR: orange-webpay folder not found at %SRV_DIR%
  exit /b 1
)

cd /d "%SRV_DIR%"

rem Ensure dependencies are installed
if not exist node_modules (
  call npm ci || goto :error
)

rem Use ecosystem.config.js to set env and port
rem Ensure PORT is 8080 and NODE_ENV=production inside ecosystem or env file

call pm2 start ecosystem.config.js --only orange-webpay --env production || goto :error
call pm2 save
echo.
echo Orange WebPay started under PM2.
call pm2 status orange-webpay
exit /b 0

:error
echo.
echo Failed to start Orange WebPay with PM2.
exit /b 1
