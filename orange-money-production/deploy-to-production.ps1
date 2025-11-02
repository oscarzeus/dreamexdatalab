# Orange Money Production Deployment Script for Windows/IIS
# Run this script to deploy the Orange Money backend to your production server

Write-Host "Orange Money Production Deployment" -ForegroundColor Green
Write-Host "Target API: api.dreamexdatalab.com (Port 8080)" -ForegroundColor Cyan

# Step 1: Stop existing service if running
Write-Host "1. Stopping existing Orange Money service..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "   Existing processes stopped" -ForegroundColor Green
} catch {
    Write-Host "   No existing processes found" -ForegroundColor Gray
}

# Step 2: Copy production environment
Write-Host "2. Setting up production environment..." -ForegroundColor Yellow
if (Test-Path ".env.production") {
    Copy-Item ".env.production" ".env" -Force
} elseif (Test-Path ".env.production.example") {
    Copy-Item ".env.production.example" ".env" -Force
    Write-Warning "Created .env from example. Please edit it with your secrets."
} else {
    Write-Warning ".env not found. Create one based on .env.production.example"
}
Write-Host "   Production environment configured" -ForegroundColor Green

# Step 3: Install dependencies
Write-Host "3. Installing production dependencies..." -ForegroundColor Yellow
npm install --production --silent
Write-Host "   Dependencies installed" -ForegroundColor Green

# Step 4: Create logs directory
Write-Host "4. Creating logs directory..." -ForegroundColor Yellow
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
}
Write-Host "   Logs directory ready" -ForegroundColor Green

# Step 5: Start the service
Write-Host "5. Starting Orange Money service on port 8080..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$PWD'; `$env:NODE_ENV='production'; node server.js" -WindowStyle Minimized

# Wait a moment for service to start
Start-Sleep -Seconds 3

# Step 6: Test the service
Write-Host "6. Testing service health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
    Write-Host "   Service is running successfully!" -ForegroundColor Green
    Write-Host "   Health check: http://localhost:8080/health" -ForegroundColor Green
    }
} catch {
    Write-Host "   Service health check failed" -ForegroundColor Red
    Write-Host "   Please check the logs for errors" -ForegroundColor Red
}

Write-Host ""
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your Orange Money API is now available at:" -ForegroundColor Cyan
Write-Host "  - https://api.dreamexdatalab.com/api/payments/initiate" -ForegroundColor White
Write-Host "  - https://api.dreamexdatalab.com/health" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test the API from your company registration page" -ForegroundColor White
Write-Host "  2. Verify CORS headers are working" -ForegroundColor White
Write-Host "  3. Test a complete payment flow" -ForegroundColor White
Write-Host ""