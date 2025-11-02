# Windows Service Setup for Orange Money Backend
# This script sets up the Orange Money backend as a Windows service

Write-Host "🔧 Setting up Orange Money as Windows Service" -ForegroundColor Green

# Install PM2 if not already installed
Write-Host "1. Installing PM2 globally..." -ForegroundColor Yellow
npm install -g pm2 pm2-windows-service
Write-Host "   ✅ PM2 installed" -ForegroundColor Green

# Setup PM2 as Windows service
Write-Host "2. Setting up PM2 as Windows service..." -ForegroundColor Yellow
pm2-service-install -n "PM2"
Write-Host "   ✅ PM2 service installed" -ForegroundColor Green

# Create ecosystem configuration
Write-Host "3. Creating PM2 ecosystem configuration..." -ForegroundColor Yellow
$ecosystemConfig = @"
module.exports = {
  apps: [{
    name: 'orange-money-backend',
    script: 'server.js',
    cwd: 'C:\\Users\\Dreamex Lab\\dreamexdatalab\\orange-money-production',
    env: {
      NODE_ENV: 'production',
      PORT: '8080'
    },
    instances: 1,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
"@

$ecosystemConfig | Out-File -FilePath "ecosystem.config.js" -Encoding utf8
Write-Host "   ✅ Ecosystem configuration created" -ForegroundColor Green

# Start the application with PM2
Write-Host "4. Starting Orange Money backend with PM2..." -ForegroundColor Yellow
pm2 start ecosystem.config.js
pm2 save
Write-Host "   ✅ Application started and saved" -ForegroundColor Green

# Show status
Write-Host "5. Application status:" -ForegroundColor Yellow
pm2 status

Write-Host ""
Write-Host "🎉 Windows Service Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "The Orange Money backend will now:" -ForegroundColor Cyan
Write-Host "  • Start automatically on system boot" -ForegroundColor White
Write-Host "  • Restart automatically if it crashes" -ForegroundColor White
Write-Host "  • Run on port 8080 (configured in web.config)" -ForegroundColor White
Write-Host ""
Write-Host "Useful PM2 commands:" -ForegroundColor Yellow
Write-Host "  pm2 status          - Show application status" -ForegroundColor White
Write-Host "  pm2 logs            - View application logs" -ForegroundColor White
Write-Host "  pm2 restart all     - Restart the application" -ForegroundColor White
Write-Host "  pm2 stop all        - Stop the application" -ForegroundColor White
Write-Host ""