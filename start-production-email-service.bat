@echo off
echo 🚀 Starting Dreamex Datalab Production Email Service...
echo ==================================================

cd /d "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

:: Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing production dependencies...
    npm install --production
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Set production environment
set NODE_ENV=production
set EMAIL_SERVICE_PORT=3001

:: Start the production email server
echo 🎯 Starting production email server on port 3001...
echo 📧 NO CORS RESTRICTIONS - Accepts all origins
echo 🔗 Service URL: http://localhost:3001
echo 🛡️  Production security headers enabled
echo ⚡ Rate limiting: 100 requests per 15 minutes
echo 📊 Structured JSON logging enabled
echo ⚠️  Press Ctrl+C to stop the service
echo.
echo 🌟 PRODUCTION FEATURES:
echo   ✅ Multiple SMTP fallback configurations
echo   ✅ Enhanced error handling and retry logic
echo   ✅ Professional email templates
echo   ✅ Request logging and monitoring
echo   ✅ Health check endpoints
echo.

node email-server-production.js
