# Dreamex Email Service - Production Monitoring and Auto-Recovery Script
# This PowerShell script ensures the email service stays online 24/7

param(
    [int]$CheckInterval = 30,  # Check every 30 seconds
    [int]$MaxRestarts = 1000,  # Maximum restarts per session
    [string]$LogFile = "monitor.log"
)

$ServiceUrl = "http://localhost:3001/health"
$ServiceName = "dreamex-email-service"
$RestartCount = 0

Write-Host "🔍 Starting Email Service Monitor" -ForegroundColor Green
Write-Host "   Service URL: $ServiceUrl" -ForegroundColor Cyan
Write-Host "   Check Interval: $CheckInterval seconds" -ForegroundColor Cyan
Write-Host "   Log File: $LogFile" -ForegroundColor Cyan
Write-Host "   Press Ctrl+C to stop monitoring`n" -ForegroundColor Yellow

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "[$Timestamp] [$Level] $Message"
    
    # Console output with colors
    switch ($Level) {
        "ERROR" { Write-Host $LogEntry -ForegroundColor Red }
        "WARN"  { Write-Host $LogEntry -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $LogEntry -ForegroundColor Green }
        default { Write-Host $LogEntry -ForegroundColor White }
    }
    
    # File logging
    Add-Content -Path $LogFile -Value $LogEntry
}

function Test-EmailService {
    try {
        $Response = Invoke-WebRequest -Uri $ServiceUrl -TimeoutSec 5 -UseBasicParsing
        return $Response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Restart-EmailService {
    Write-Log "Attempting to restart email service..." "WARN"
    
    # Method 1: Try PM2 restart
    try {
        $PM2Result = & pm2 restart $ServiceName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Successfully restarted with PM2" "SUCCESS"
            return $true
        }
    }
    catch {
        Write-Log "PM2 restart failed: $($_.Exception.Message)" "ERROR"
    }
    
    # Method 2: Kill and start manually
    try {
        Write-Log "Trying manual restart..." "WARN"
        
        # Kill existing Node.js processes for email service
        Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*email-server*" } | Stop-Process -Force
        
        Start-Sleep -Seconds 3
        
        # Start the service
        $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
        $ProcessInfo.FileName = "node"
        $ProcessInfo.Arguments = "email-server-production.js"
        $ProcessInfo.WindowStyle = "Hidden"
        $ProcessInfo.CreateNoWindow = $true
        $ProcessInfo.WorkingDirectory = $PSScriptRoot
        
        [System.Diagnostics.Process]::Start($ProcessInfo)
        
        Write-Log "Started email service manually" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Manual restart failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Get-ServiceStatus {
    if (Test-EmailService) {
        return @{
            Status = "ONLINE"
            Color = "Green"
            Level = "SUCCESS"
        }
    } else {
        return @{
            Status = "OFFLINE"
            Color = "Red" 
            Level = "ERROR"
        }
    }
}

# Main monitoring loop
Write-Log "Email service monitoring started" "SUCCESS"

while ($RestartCount -lt $MaxRestarts) {
    $Status = Get-ServiceStatus
    
    if ($Status.Status -eq "ONLINE") {
        Write-Log "Email service is $($Status.Status)" $Status.Level
    } else {
        Write-Log "Email service is $($Status.Status) - Restart attempt #$($RestartCount + 1)" $Status.Level
        
        if (Restart-EmailService) {
            $RestartCount++
            
            # Wait for service to fully start
            Start-Sleep -Seconds 10
            
            # Verify restart was successful
            $NewStatus = Get-ServiceStatus
            if ($NewStatus.Status -eq "ONLINE") {
                Write-Log "Service successfully recovered" "SUCCESS"
            } else {
                Write-Log "Service restart failed - will retry on next check" "ERROR"
            }
        } else {
            Write-Log "All restart methods failed" "ERROR"
        }
    }
    
    # Memory cleanup
    [System.GC]::Collect()
    
    # Wait before next check
    Start-Sleep -Seconds $CheckInterval
}

Write-Log "Maximum restart attempts reached ($MaxRestarts). Stopping monitor." "ERROR"
