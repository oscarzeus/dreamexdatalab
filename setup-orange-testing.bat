@echo off
REM Orange Money Testing Setup with ngrok
REM This script sets up a secure tunnel for local Orange Money testing

echo =====================================================
echo Orange Money Local Testing Setup
echo =====================================================

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ngrok is not installed or not in PATH
    echo Please install ngrok from https://ngrok.com/
    echo After installation, add it to your PATH or place ngrok.exe in this folder
    pause
    exit /b 1
)

echo 1. Starting local server on port 5020...
cd /d "%~dp0orange-webpay"
start /b cmd /c "npm run dev"

echo 2. Waiting for server to start...
timeout /t 3 >nul

echo 3. Starting ngrok tunnel...
REM Start ngrok in background and capture the URL
start /b cmd /c "ngrok http 5020 --log stdout > ngrok.log"

echo 4. Waiting for ngrok to establish tunnel...
timeout /t 5 >nul

echo 5. Getting ngrok URL...
REM Parse ngrok URL from log (this is a simplified approach)
echo Please check the ngrok web interface at http://127.0.0.1:4040
echo Copy the HTTPS forwarding URL (e.g., https://abc123.ngrok.io)
echo.

echo 6. Update your .env.local file with the ngrok URL:
echo    - Replace BASE_URL with your ngrok HTTPS URL
echo    - Replace CORS_ORIGIN with your ngrok HTTPS URL  
echo    - Replace NOTIF_URL with your ngrok HTTPS URL + /api/notify?secret=test123
echo.

echo 7. Restart the server with the updated configuration:
echo    npm run dev
echo.

echo =====================================================
echo Setup complete! 
echo - Visit your ngrok URL to test payments
echo - Orange Money callbacks will work with HTTPS URLs
echo - Check ngrok web interface: http://127.0.0.1:4040
echo =====================================================

pause