# Dreamex Datalab Email Service Startup Script
# Starts the email notification service

Write-Host "Starting Dreamex Datalab Email Service..." -ForegroundColor Green
Write-Host "========================================"

$emailServicePath = "c:\Users\Dreamex Lab\dreamexdatalab\email-service"

# Check if the directory exists
if (-not (Test-Path $emailServicePath)) {
    Write-Host "ERROR: Email service directory not found at $emailServicePath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to email service directory
Set-Location $emailServicePath

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if email-server.js exists
if (-not (Test-Path "email-server.js")) {
    Write-Host "ERROR: email-server.js not found in the email service directory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting email service..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Service will be available at: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Yellow
Write-Host ""

# Start the email service
try {
    node email-server.js
} catch {
    Write-Host "ERROR: Failed to start email service" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
