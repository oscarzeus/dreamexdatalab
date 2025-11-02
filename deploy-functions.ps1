# Firebase Functions Deployment Script for Windows
# This script automates the deployment process

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Firebase Functions Deployment Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI installation..." -ForegroundColor Yellow
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue

if (-not $firebaseInstalled) {
    Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
    Write-Host "Installing Firebase CLI..." -ForegroundColor Yellow
    npm install -g firebase-tools
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Firebase CLI" -ForegroundColor Red
        Write-Host "Please install manually: npm install -g firebase-tools" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✅ Firebase CLI is installed" -ForegroundColor Green
}

# Check if logged in
Write-Host ""
Write-Host "Checking Firebase authentication..." -ForegroundColor Yellow
firebase login --non-interactive 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in to Firebase" -ForegroundColor Yellow
    Write-Host "Opening Firebase login..." -ForegroundColor Yellow
    firebase login
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to login to Firebase" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Authenticated with Firebase" -ForegroundColor Green

# Navigate to functions directory
Write-Host ""
Write-Host "Installing function dependencies..." -ForegroundColor Yellow
Set-Location -Path "functions"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Set-Location -Path ".."
        exit 1
    }
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

Set-Location -Path ".."

# Deploy functions
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Deploying Firebase Functions..." -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

firebase deploy --only functions

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "✅ Deployment Successful!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your scheduled reports will now be sent automatically!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Monitor your functions:" -ForegroundColor Yellow
    Write-Host "   firebase functions:log" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 View in Console:" -ForegroundColor Yellow
    Write-Host "   https://console.firebase.google.com/project/users-8be65/functions" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "❌ Deployment Failed!" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check the error messages above and try again." -ForegroundColor Yellow
    Write-Host "For help, see: FIREBASE_FUNCTIONS_SETUP.md" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
