# Deploy Redirect Files to Live Site
# This script copies the payment redirect files to prepare for production deployment

Write-Host "🚀 Deploying Orange Money Redirect Files" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Create deployment directory
$deployDir = ".\deploy-package"
if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Copy redirect files
Write-Host "📦 Copying redirect files..." -ForegroundColor Yellow

# Copy payment redirect files
$paymentDir = "$deployDir\payment"
New-Item -ItemType Directory -Path $paymentDir -Force | Out-Null

Copy-Item ".\payment\success.html" -Destination $paymentDir
Copy-Item ".\payment\cancel.html" -Destination $paymentDir

# Copy 404.html
Copy-Item ".\404.html" -Destination $deployDir

Write-Host "✅ Files copied to deploy-package:" -ForegroundColor Green
Write-Host "   - deploy-package\payment\success.html"
Write-Host "   - deploy-package\payment\cancel.html" 
Write-Host "   - deploy-package\404.html"

# Test redirect files locally
Write-Host "`n🧪 Testing redirect files..." -ForegroundColor Yellow

$testUrl = "file:///$PWD/payment/success.html?order_id=TEST-123"
Write-Host "Test URL: $testUrl"

# Display file contents for verification
Write-Host "`n📄 Success file content preview:" -ForegroundColor Cyan
Get-Content ".\payment\success.html" | Select-Object -First 15
Write-Host "... (truncated)"

Write-Host "`n📄 Cancel file content preview:" -ForegroundColor Cyan  
Get-Content ".\payment\cancel.html" | Select-Object -First 10
Write-Host "... (truncated)"

Write-Host "`n📋 DEPLOYMENT INSTRUCTIONS:" -ForegroundColor Magenta
Write-Host "================================" -ForegroundColor Magenta
Write-Host "1. Upload these files to your live site root:" -ForegroundColor White
Write-Host "   • payment/success.html" -ForegroundColor Gray
Write-Host "   • payment/cancel.html" -ForegroundColor Gray  
Write-Host "   • 404.html" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If using GitHub Pages:" -ForegroundColor White
Write-Host "   • Copy files from deploy-package/ to your GitHub Pages branch" -ForegroundColor Gray
Write-Host "   • Commit and push to trigger deployment" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test after deployment:" -ForegroundColor White
Write-Host "   • https://dreamexdatalab.com/payment/success.html?order_id=TEST-123" -ForegroundColor Gray
Write-Host "   • Should redirect to: /company-complete-registration.html?payment=success&order_id=TEST-123" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Update Orange Money Portal with NEW URLs:" -ForegroundColor White
Write-Host "   • Success: https://dreamexdatalab.com/company-complete-registration.html?payment=success" -ForegroundColor Gray
Write-Host "   • Cancel:  https://dreamexdatalab.com/company-complete-registration.html?payment=cancel" -ForegroundColor Gray
Write-Host ""

# Open deployment directory
if (Get-Command "explorer" -ErrorAction SilentlyContinue) {
    Write-Host "Opening deploy-package folder..." -ForegroundColor Green
    explorer $deployDir
}

Write-Host "🎯 CRITICAL: The Orange Money return button will work correctly" -ForegroundColor Yellow
Write-Host "   after you update the Orange Money portal Success URL as shown above." -ForegroundColor Yellow

Write-Host "`n✅ Deployment package ready!" -ForegroundColor Green