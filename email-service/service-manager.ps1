#!/usr/bin/env pwsh
# Production Email Service Manager for Dreamex Datalab
# PowerShell script for robust service management

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "status", "install", "uninstall", "logs")]
    [string]$Action = "status"
)

$SERVICE_NAME = "dreamex-email-service"
$SERVICE_PATH = "c:\Users\Dreamex Lab\dreamexdatalab\email-service"
$PORT = 3001

# Colors for output
$COLOR_GREEN = "`e[32m"
$COLOR_RED = "`e[31m"
$COLOR_YELLOW = "`e[33m"
$COLOR_BLUE = "`e[34m"
$COLOR_RESET = "`e[0m"

function Write-ColoredOutput {
    param($Message, $Color = $COLOR_RESET)
    Write-Host "$Color$Message$COLOR_RESET"
}

function Test-Port {
    param($Port)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return $connection.TcpTestSucceeded
    } catch {
        return $false
    }
}

function Get-ServiceStatus {
    $isRunning = Test-Port -Port $PORT
    $processes = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" }
    
    Write-ColoredOutput "🔍 Dreamex Email Service Status Check" $COLOR_BLUE
    Write-ColoredOutput "=====================================" $COLOR_BLUE
    Write-ColoredOutput "Service Port ($PORT): $(if($isRunning) { '✅ LISTENING' } else { '❌ NOT LISTENING' })" $(if($isRunning) { $COLOR_GREEN } else { $COLOR_RED })
    Write-ColoredOutput "Node.js Processes: $($processes.Count) running" $(if($processes.Count -gt 0) { $COLOR_GREEN } else { $COLOR_YELLOW })
    
    if ($isRunning) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$PORT/health" -UseBasicParsing -TimeoutSec 5
            $healthData = $response.Content | ConvertFrom-Json
            Write-ColoredOutput "Health Check: ✅ $($healthData.status)" $COLOR_GREEN
            Write-ColoredOutput "SMTP Ready: $(if($healthData.smtpReady) { '✅ YES' } else { '❌ NO' })" $(if($healthData.smtpReady) { $COLOR_GREEN } else { $COLOR_RED })
        } catch {
            Write-ColoredOutput "Health Check: ❌ Service not responding" $COLOR_RED
        }
    }
    
    return $isRunning
}

function Start-EmailService {
    Write-ColoredOutput "🚀 Starting Dreamex Email Service..." $COLOR_BLUE
    
    # Check if already running
    if (Test-Port -Port $PORT) {
        Write-ColoredOutput "⚠️ Service already running on port $PORT" $COLOR_YELLOW
        return
    }
    
    # Navigate to service directory
    Push-Location $SERVICE_PATH
    
    try {
        # Check dependencies
        if (!(Test-Path "node_modules")) {
            Write-ColoredOutput "📦 Installing dependencies..." $COLOR_YELLOW
            npm install --production
        }
        
        # Start service in background
        Write-ColoredOutput "🎯 Starting email service..." $COLOR_GREEN
        Start-Process powershell -ArgumentList "-Command", "cd '$SERVICE_PATH'; npm start" -WindowStyle Hidden
        
        # Wait for service to start
        $timeout = 30
        $elapsed = 0
        while ($elapsed -lt $timeout) {
            Start-Sleep -Seconds 1
            $elapsed++
            if (Test-Port -Port $PORT) {
                Write-ColoredOutput "✅ Email service started successfully!" $COLOR_GREEN
                Get-ServiceStatus
                return
            }
        }
        
        Write-ColoredOutput "❌ Service failed to start within $timeout seconds" $COLOR_RED
        
    } finally {
        Pop-Location
    }
}

function Stop-EmailService {
    Write-ColoredOutput "🛑 Stopping Dreamex Email Service..." $COLOR_BLUE
    
    # Find and stop Node.js processes
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-ColoredOutput "🔄 Stopping $($nodeProcesses.Count) Node.js process(es)..." $COLOR_YELLOW
        $nodeProcesses | Stop-Process -Force
        Start-Sleep -Seconds 2
        Write-ColoredOutput "✅ Email service stopped" $COLOR_GREEN
    } else {
        Write-ColoredOutput "ℹ️ No Node.js processes found" $COLOR_YELLOW
    }
}

function Restart-EmailService {
    Write-ColoredOutput "🔄 Restarting Dreamex Email Service..." $COLOR_BLUE
    Stop-EmailService
    Start-Sleep -Seconds 3
    Start-EmailService
}

function Install-ServiceAsWindowsService {
    Write-ColoredOutput "📋 Installing as Windows Service..." $COLOR_BLUE
    
    # Check if nssm is available
    try {
        $nssmPath = Get-Command nssm -ErrorAction Stop
        Write-ColoredOutput "✅ NSSM found: $($nssmPath.Source)" $COLOR_GREEN
    } catch {
        Write-ColoredOutput "❌ NSSM not found. Please install NSSM first:" $COLOR_RED
        Write-ColoredOutput "   1. Download from: https://nssm.cc/download" $COLOR_YELLOW
        Write-ColoredOutput "   2. Extract and add to PATH" $COLOR_YELLOW
        return
    }
    
    # Install service
    Push-Location $SERVICE_PATH
    try {
        nssm install $SERVICE_NAME node email-server.js
        nssm set $SERVICE_NAME AppDirectory $SERVICE_PATH
        nssm set $SERVICE_NAME DisplayName "Dreamex Email Service"
        nssm set $SERVICE_NAME Description "Production email notification service for Dreamex Datalab HSE System"
        nssm set $SERVICE_NAME Start SERVICE_AUTO_START
        nssm set $SERVICE_NAME AppRotateFiles 1
        nssm set $SERVICE_NAME AppRotateOnline 1
        nssm set $SERVICE_NAME AppRotateBytes 1048576
        
        Write-ColoredOutput "✅ Windows service installed successfully!" $COLOR_GREEN
        Write-ColoredOutput "   Service Name: $SERVICE_NAME" $COLOR_BLUE
        Write-ColoredOutput "   Start Service: sc start $SERVICE_NAME" $COLOR_BLUE
        Write-ColoredOutput "   Stop Service: sc stop $SERVICE_NAME" $COLOR_BLUE
        
    } finally {
        Pop-Location
    }
}

function Uninstall-WindowsService {
    Write-ColoredOutput "🗑️ Uninstalling Windows Service..." $COLOR_BLUE
    
    try {
        sc.exe stop $SERVICE_NAME
        Start-Sleep -Seconds 3
        nssm remove $SERVICE_NAME confirm
        Write-ColoredOutput "✅ Windows service uninstalled successfully!" $COLOR_GREEN
    } catch {
        Write-ColoredOutput "❌ Failed to uninstall service: $_" $COLOR_RED
    }
}

function Show-Logs {
    Write-ColoredOutput "📋 Email Service Logs" $COLOR_BLUE
    Write-ColoredOutput "=====================" $COLOR_BLUE
    
    $logPath = Join-Path $SERVICE_PATH "logs\email.log"
    if (Test-Path $logPath) {
        Get-Content $logPath -Tail 50
    } else {
        Write-ColoredOutput "⚠️ No log file found at $logPath" $COLOR_YELLOW
        Write-ColoredOutput "ℹ️ Checking for running processes and recent output..." $COLOR_BLUE
        
        # Try to get recent output from running processes
        $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-ColoredOutput "✅ Found $($nodeProcesses.Count) Node.js process(es) running" $COLOR_GREEN
        } else {
            Write-ColoredOutput "❌ No Node.js processes currently running" $COLOR_RED
        }
    }
}

# Main execution
Clear-Host
Write-ColoredOutput "🔧 Dreamex Email Service Manager" $COLOR_BLUE
Write-ColoredOutput "=================================" $COLOR_BLUE
Write-ColoredOutput "Action: $Action" $COLOR_YELLOW
Write-ColoredOutput ""

switch ($Action.ToLower()) {
    "start" { Start-EmailService }
    "stop" { Stop-EmailService }
    "restart" { Restart-EmailService }
    "status" { Get-ServiceStatus }
    "install" { Install-ServiceAsWindowsService }
    "uninstall" { Uninstall-WindowsService }
    "logs" { Show-Logs }
    default { 
        Write-ColoredOutput "❌ Invalid action: $Action" $COLOR_RED
        Write-ColoredOutput "Valid actions: start, stop, restart, status, install, uninstall, logs" $COLOR_YELLOW
    }
}

Write-ColoredOutput ""
Write-ColoredOutput "💡 Usage Examples:" $COLOR_BLUE
Write-ColoredOutput "   .\service-manager.ps1 start     - Start the email service" $COLOR_YELLOW
Write-ColoredOutput "   .\service-manager.ps1 stop      - Stop the email service" $COLOR_YELLOW  
Write-ColoredOutput "   .\service-manager.ps1 restart   - Restart the email service" $COLOR_YELLOW
Write-ColoredOutput "   .\service-manager.ps1 status    - Check service status" $COLOR_YELLOW
Write-ColoredOutput "   .\service-manager.ps1 logs      - View recent logs" $COLOR_YELLOW
