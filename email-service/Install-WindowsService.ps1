# Dreamex Email Service - Windows Service Installation Script
# This script creates a Windows Service that will auto-start and stay running

param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status
)

$ServiceName = "DreamexEmailService"
$ServiceDisplayName = "Dreamex Email Service"
$ServiceDescription = "Production email notification service for Dreamex Datalab HSE System"
$ServicePath = Join-Path $PSScriptRoot "email-server-production.js"
$NodePath = (Get-Command node).Source

function Install-EmailService {
    Write-Host "Installing Dreamex Email Service as Windows Service..." -ForegroundColor Green
    
    # Check if service already exists
    $ExistingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($ExistingService) {
        Write-Host "Service already exists. Stopping and removing first..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force
        & sc.exe delete $ServiceName
        Start-Sleep -Seconds 3
    }
    
    # Install using node-windows package
    try {
        # Check if node-windows is installed
        $NodeWindows = & npm list -g node-windows 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Installing node-windows globally..." -ForegroundColor Cyan
            & npm install -g node-windows
        }
        
        # Create service installation script
        $InstallScript = @"
const Service = require('node-windows').Service;

// Create a new service object
const svc = new Service({
  name: '$ServiceName',
  description: '$ServiceDescription',
  script: '$ServicePath',
  nodeOptions: [
    '--max-old-space-size=2048'
  ],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    },
    {
      name: 'PORT', 
      value: '3001'
    }
  ]
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', function(){
  console.log('✅ Dreamex Email Service installed successfully');
  svc.start();
});

svc.on('alreadyinstalled', function(){
  console.log('⚠️ Service already installed');
});

svc.on('start', function(){
  console.log('🚀 Dreamex Email Service started');
});

// Install the service
svc.install();
"@
        
        $TempScript = Join-Path $env:TEMP "install-email-service.js"
        $InstallScript | Out-File -FilePath $TempScript -Encoding UTF8
        
        Write-Host "Creating Windows Service..." -ForegroundColor Cyan
        & node $TempScript
        
        Remove-Item $TempScript -Force
        
        Start-Sleep -Seconds 5
        
        # Verify installation
        $NewService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($NewService) {
            Write-Host "✅ Service installed successfully!" -ForegroundColor Green
            Write-Host "   Service Name: $ServiceName" -ForegroundColor Cyan
            Write-Host "   Status: $($NewService.Status)" -ForegroundColor Cyan
        } else {
            Write-Host "❌ Service installation failed" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ Error installing service: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Uninstall-EmailService {
    Write-Host "Uninstalling Dreamex Email Service..." -ForegroundColor Yellow
    
    try {
        # Create service uninstallation script
        $UninstallScript = @"
const Service = require('node-windows').Service;

const svc = new Service({
  name: '$ServiceName',
  script: '$ServicePath'
});

svc.on('uninstall', function(){
  console.log('✅ Dreamex Email Service uninstalled successfully');
});

svc.uninstall();
"@
        
        $TempScript = Join-Path $env:TEMP "uninstall-email-service.js"
        $UninstallScript | Out-File -FilePath $TempScript -Encoding UTF8
        
        & node $TempScript
        Remove-Item $TempScript -Force
        
        Start-Sleep -Seconds 5
        Write-Host "✅ Service uninstalled successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error uninstalling service: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-ServiceStatus {
    $Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    
    if ($Service) {
        Write-Host "📊 Dreamex Email Service Status:" -ForegroundColor Cyan
        Write-Host "   Name: $($Service.Name)" -ForegroundColor White
        Write-Host "   Display Name: $($Service.DisplayName)" -ForegroundColor White
        Write-Host "   Status: $($Service.Status)" -ForegroundColor $(if ($Service.Status -eq 'Running') { 'Green' } else { 'Red' })
        Write-Host "   Start Type: $($Service.StartType)" -ForegroundColor White
        
        # Test service endpoint
        try {
            $Response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -UseBasicParsing
            if ($Response.StatusCode -eq 200) {
                Write-Host "   Health Check: ✅ HEALTHY" -ForegroundColor Green
            } else {
                Write-Host "   Health Check: ❌ UNHEALTHY (HTTP $($Response.StatusCode))" -ForegroundColor Red
            }
        }
        catch {
            Write-Host "   Health Check: ❌ UNREACHABLE" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Dreamex Email Service is not installed" -ForegroundColor Red
    }
}

# Main execution
if ($Install) {
    Install-EmailService
} elseif ($Uninstall) {
    Uninstall-EmailService
} elseif ($Status) {
    Show-ServiceStatus
} else {
    Write-Host "Dreamex Email Service - Windows Service Manager" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Cyan
    Write-Host "  .\Install-WindowsService.ps1 -Install    # Install as Windows Service"
    Write-Host "  .\Install-WindowsService.ps1 -Uninstall  # Remove Windows Service" 
    Write-Host "  .\Install-WindowsService.ps1 -Status     # Check service status"
    Write-Host ""
    Write-Host "Note: Run as Administrator for installation/uninstallation" -ForegroundColor Yellow
}
