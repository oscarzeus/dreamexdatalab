#!/usr/bin/env pwsh

Write-Host "🚀 Starting Dreamex Datalab Email Service..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Yellow

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

# Check if package.json exists
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found in email-service directory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Start the enhanced email server
Write-Host "🎯 Starting enhanced email server on port 3001..." -ForegroundColor Cyan
Write-Host "📧 Email service will handle staff reminder notifications" -ForegroundColor Gray
Write-Host "🔗 Service URL: http://localhost:3001" -ForegroundColor Gray
Write-Host "⚡ Press Ctrl+C to stop the service" -ForegroundColor Yellow
Write-Host "" 

# Start the server
node email-server-enhanced.js
