# Email Security Monitor for Dreamex Datalab
# Monitors email service for abuse patterns and security violations

param(
    [string]$LogPath = ".\logs",
    [int]$MonitorIntervalMinutes = 5,
    [string]$AlertEmail = $env:ALERT_EMAIL,
    [int]$SuspiciousThreshold = 5
)

# Configuration
$ServiceName = "Dreamex Secure Email Service"
$LogFiles = @(
    "security.log",
    "error.log",
    "warn.log"
)

# Create logs directory if it doesn't exist
if (-not (Test-Path $LogPath)) {
    New-Item -ItemType Directory -Path $LogPath -Force
    Write-Host "Created logs directory: $LogPath" -ForegroundColor Green
}

# Function to send security alert
function Send-SecurityAlert {
    param(
        [string]$Subject,
        [string]$Message,
        [string]$Severity = "WARNING"
    )
    
    $AlertData = @{
        to = $AlertEmail
        subject = "[$Severity] $ServiceName - $Subject"
        text = @"
Security Alert from $ServiceName

Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Severity: $Severity
Subject: $Subject

Details:
$Message

Please review the email service logs and take appropriate action.

---
Automated Security Monitor
Dreamex Datalab Email Service
"@
    } | ConvertTo-Json

    try {
        # Send alert through local email service (if available)
        $response = Invoke-RestMethod -Uri "http://localhost:3001/send/secure" -Method POST -Body $AlertData -ContentType "application/json" -Headers @{"x-api-key" = $env:API_KEY}
        Write-Host "Security alert sent successfully" -ForegroundColor Yellow
    } catch {
        Write-Host "Failed to send security alert: $($_.Exception.Message)" -ForegroundColor Red
        # Log to file as backup
        $alertLog = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - ALERT: $Subject - $Message"
        Add-Content -Path "$LogPath\security-alerts.log" -Value $alertLog
    }
}

# Function to analyze security logs
function Analyze-SecurityLogs {
    $suspiciousActivities = @()
    $now = Get-Date
    $oneHourAgo = $now.AddHours(-1)
    
    foreach ($logFile in $LogFiles) {
        $filePath = Join-Path $LogPath $logFile
        
        if (Test-Path $filePath) {
            try {
                $logEntries = Get-Content $filePath -ErrorAction SilentlyContinue | 
                              Where-Object { $_ -match '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' } |
                              ForEach-Object {
                                  try {
                                      $json = $_ | ConvertFrom-Json
                                      $logTime = [DateTime]::Parse($json.timestamp)
                                      if ($logTime -gt $oneHourAgo) { $json }
                                  } catch {
                                      # Skip malformed JSON lines
                                  }
                              }
                
                # Analyze for suspicious patterns
                $suspiciousIPs = $logEntries | 
                                Where-Object { $_.level -eq "SECURITY" -or $_.level -eq "ERROR" } |
                                Group-Object { $_.data.ip } |
                                Where-Object { $_.Count -gt $SuspiciousThreshold }
                
                foreach ($ipGroup in $suspiciousIPs) {
                    $suspiciousActivities += @{
                        Type = "Suspicious IP Activity"
                        IP = $ipGroup.Name
                        Count = $ipGroup.Count
                        Details = $ipGroup.Group | Select-Object -First 3 | ForEach-Object { $_.message }
                    }
                }
                
                # Check for rate limit violations
                $rateLimitViolations = $logEntries | 
                                      Where-Object { $_.message -like "*rate limit*" -or $_.message -like "*Rate limit*" }
                
                if ($rateLimitViolations.Count -gt 10) {
                    $suspiciousActivities += @{
                        Type = "High Rate Limit Violations"
                        Count = $rateLimitViolations.Count
                        Details = "Multiple rate limit violations detected in the last hour"
                    }
                }
                
                # Check for authentication failures
                $authFailures = $logEntries | 
                               Where-Object { $_.message -like "*Invalid API key*" -or $_.message -like "*authentication*" }
                
                if ($authFailures.Count -gt 20) {
                    $suspiciousActivities += @{
                        Type = "High Authentication Failures"
                        Count = $authFailures.Count
                        Details = "Multiple authentication failures detected"
                    }
                }
                
            } catch {
                Write-Host "Error analyzing log file $logFile`: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    return $suspiciousActivities
}

# Function to check service health
function Check-ServiceHealth {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 10
        if ($response.status -eq "healthy") {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Function to get service statistics
function Get-ServiceStatistics {
    $stats = @{
        LogFilesSizes = @{}
        TotalLogEntries = 0
        RecentErrors = 0
        RecentWarnings = 0
    }
    
    foreach ($logFile in $LogFiles) {
        $filePath = Join-Path $LogPath $logFile
        if (Test-Path $filePath) {
            $fileInfo = Get-Item $filePath
            $stats.LogFilesSizes[$logFile] = [math]::Round($fileInfo.Length / 1KB, 2)
            
            # Count recent entries
            $recentEntries = Get-Content $filePath -Tail 100 | Where-Object { $_ -match (Get-Date).ToString("yyyy-MM-dd") }
            $stats.TotalLogEntries += $recentEntries.Count
            
            if ($logFile -eq "error.log") {
                $stats.RecentErrors = $recentEntries.Count
            } elseif ($logFile -eq "warn.log") {
                $stats.RecentWarnings = $recentEntries.Count
            }
        }
    }
    
    return $stats
}

# Main monitoring loop
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Email Security Monitor Started" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Service: $ServiceName"
Write-Host "Log Path: $LogPath"
Write-Host "Monitor Interval: $MonitorIntervalMinutes minutes"
Write-Host "Alert Email: $AlertEmail"
Write-Host "Suspicious Threshold: $SuspiciousThreshold"
Write-Host ""

$iteration = 0
$lastAlertTime = Get-Date -Date "2000-01-01"

while ($true) {
    $iteration++
    $currentTime = Get-Date
    
    Write-Host "[$($currentTime.ToString('HH:mm:ss'))] Monitoring iteration $iteration" -ForegroundColor Green
    
    # Check service health
    $isHealthy = Check-ServiceHealth
    if (-not $isHealthy) {
        Write-Host "WARNING: Email service appears to be down!" -ForegroundColor Red
        
        # Send alert if we haven't sent one in the last 30 minutes
        if ($currentTime.Subtract($lastAlertTime).TotalMinutes -gt 30) {
            Send-SecurityAlert -Subject "Service Down" -Message "Email service health check failed. Service may be offline." -Severity "CRITICAL"
            $lastAlertTime = $currentTime
        }
    } else {
        Write-Host "Service health: OK" -ForegroundColor Green
    }
    
    # Analyze security logs
    $suspiciousActivities = Analyze-SecurityLogs
    
    if ($suspiciousActivities.Count -gt 0) {
        Write-Host "Found $($suspiciousActivities.Count) suspicious activities:" -ForegroundColor Yellow
        
        foreach ($activity in $suspiciousActivities) {
            Write-Host "  - $($activity.Type): $($activity.Count)" -ForegroundColor Yellow
            
            # Send alert for high-severity activities
            if ($activity.Count -gt ($SuspiciousThreshold * 2)) {
                $alertMessage = @"
High-severity security event detected:

Type: $($activity.Type)
Count: $($activity.Count)
Details: $($activity.Details -join '; ')

Please investigate immediately.
"@
                Send-SecurityAlert -Subject $activity.Type -Message $alertMessage -Severity "HIGH"
                $lastAlertTime = $currentTime
            }
        }
    } else {
        Write-Host "No suspicious activities detected" -ForegroundColor Green
    }
    
    # Display service statistics
    $stats = Get-ServiceStatistics
    Write-Host "Statistics:"
    Write-Host "  Total log entries today: $($stats.TotalLogEntries)"
    Write-Host "  Recent errors: $($stats.RecentErrors)"
    Write-Host "  Recent warnings: $($stats.RecentWarnings)"
    
    foreach ($logFile in $stats.LogFilesSizes.Keys) {
        Write-Host "  $logFile size: $($stats.LogFilesSizes[$logFile]) KB"
    }
    
    Write-Host ""
    Write-Host "Next check in $MonitorIntervalMinutes minutes..." -ForegroundColor Cyan
    Write-Host ""
    
    # Wait for next iteration
    Start-Sleep -Seconds ($MonitorIntervalMinutes * 60)
}

# Cleanup on exit
Write-Host "Email Security Monitor stopped." -ForegroundColor Red
