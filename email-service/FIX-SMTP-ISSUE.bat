@echo off
echo ===============================================
echo Dreamex Datalab Email Service - SMTP Fix Tool
echo ===============================================
echo.

cd /d "%~dp0"

echo Step 1: Checking Node.js and dependencies...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

echo.
echo Step 2: Installing/updating dependencies...
npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo Step 3: Running comprehensive SMTP diagnostic...
node fix-smtp-complete.js
if %errorlevel% neq 0 (
    echo WARNING: SMTP diagnostic completed with issues.
)

echo.
echo Step 4: Testing SMTP connection...
node smtp-diagnostic.js
if %errorlevel% neq 0 (
    echo ERROR: SMTP connection test failed.
    echo.
    echo Troubleshooting suggestions:
    echo 1. Check your .env file configuration
    echo 2. Verify email credentials are correct
    echo 3. Check network connectivity
    echo 4. Ensure firewall allows SMTP ports (587, 465)
    echo.
    pause
    exit /b 1
)

echo.
echo Step 5: Starting enhanced email service...
echo You can now use the enhanced email server with:
echo   node email-server-enhanced.js
echo.
echo Or use the original server with fixes applied:
echo   npm start
echo.
echo ===========================================
echo SMTP FIX COMPLETED SUCCESSFULLY!
echo ===========================================
echo.
echo The email service should now work correctly.
echo Test it by visiting: http://localhost:3001/health
echo.
pause
