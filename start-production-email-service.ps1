#!/usr/bin/env pwsh

Write-Host "🚀 Starting Dreamex Datalab Production Email Service..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Yellow

# Change to email-service directory
Set-Location "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if dependencies are installed
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing production dependencies..." -ForegroundColor Yellow
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Set production environment variables
$env:NODE_ENV = "production"
$env:EMAIL_SERVICE_PORT = "3001"

# Display production information
Write-Host ""
Write-Host "🎯 Starting production email server on port 3001..." -ForegroundColor Cyan
Write-Host "📧 NO CORS RESTRICTIONS - Accepts all origins" -ForegroundColor Green
Write-Host "🔗 Service URL: http://localhost:3001" -ForegroundColor Gray
Write-Host "🛡️  Production security headers enabled" -ForegroundColor Blue
Write-Host "⚡ Rate limiting: 100 requests per 15 minutes" -ForegroundColor Magenta
Write-Host "📊 Structured JSON logging enabled" -ForegroundColor DarkCyan
Write-Host "⚠️  Press Ctrl+C to stop the service" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌟 PRODUCTION FEATURES:" -ForegroundColor Cyan
Write-Host "  ✅ Multiple SMTP fallback configurations" -ForegroundColor Green
Write-Host "  ✅ Enhanced error handling and retry logic" -ForegroundColor Green
Write-Host "  ✅ Professional email templates" -ForegroundColor Green
Write-Host "  ✅ Request logging and monitoring" -ForegroundColor Green
Write-Host "  ✅ Health check endpoints" -ForegroundColor Green
Write-Host ""

# Start the production server
try {
    node email-server-production.js
} catch {
    Write-Host "❌ Failed to start production email service" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
