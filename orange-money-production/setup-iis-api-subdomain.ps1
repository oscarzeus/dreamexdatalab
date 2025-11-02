Param(
    [string]$SiteName = 'Dreamex API',
    [string]$ApiHost = 'api.dreamexdatalab.com',
    [int]$BackendPort = 8080,
    [string]$PhysicalPath = (Get-Location).Path
)

Write-Host "Configuring IIS site for $ApiHost..." -ForegroundColor Cyan

# If PhysicalPath does not contain a web.config, try parent folder
if (-not (Test-Path (Join-Path $PhysicalPath 'web.config'))) {
    $parent = Split-Path -Path $PhysicalPath -Parent
    if (Test-Path (Join-Path $parent 'web.config')) {
        Write-Host "- No web.config in $PhysicalPath, using parent: $parent" -ForegroundColor Yellow
        $PhysicalPath = $parent
    } else {
        Write-Warning "web.config not found in $PhysicalPath or its parent. Ensure rewrite rules are present."
    }
}

Import-Module WebAdministration

# Ensure required modules are installed (URL Rewrite and ARR must be installed manually if missing)
Write-Host "- Checking IIS modules (URL Rewrite/ARR should be installed separately)" -ForegroundColor Yellow

# Create app pool
if (-not (Test-Path IIS:\AppPools\$SiteName)) {
    New-Item IIS:\AppPools\$SiteName | Out-Null
}
Set-ItemProperty IIS:\AppPools\$SiteName -Name managedPipelineMode -Value Integrated
Set-ItemProperty IIS:\AppPools\$SiteName -Name processModel.identityType -Value ApplicationPoolIdentity

# Create or update site with HTTP binding on port 80 for the host header
if (-not (Test-Path IIS:\Sites\$SiteName)) {
    New-Item IIS:\Sites\$SiteName -bindings @("http/*:80:$ApiHost") -physicalPath $PhysicalPath | Out-Null
} else {
    # Ensure the HTTP binding exists for 80:$ApiHost
    $existingHttp = Get-WebBinding -Name $SiteName -Protocol http -ErrorAction SilentlyContinue | Where-Object { $_.bindingInformation -like "*:80:$ApiHost" }
    if (-not $existingHttp) {
        New-WebBinding -Name $SiteName -Protocol http -Port 80 -HostHeader $ApiHost | Out-Null
    }
}

# Assign app pool and physical path
Set-ItemProperty IIS:\Sites\$SiteName -Name applicationPool -Value $SiteName
Set-ItemProperty IIS:\Sites\$SiteName -Name physicalPath -Value $PhysicalPath

# Create HTTPS binding (requires cert to be installed under LocalMachine\My)
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*CN=$ApiHost*" } | Select-Object -First 1
if ($null -eq $cert) {
    Write-Warning "No certificate found for $ApiHost in LocalMachine\\My. Please install the certificate and bind manually."
} else {
    # Remove existing https bindings for this host if any
    Get-WebBinding -Name $SiteName -Protocol https -ErrorAction SilentlyContinue | Where-Object { $_.bindingInformation -like "*:443:$ApiHost" } | Remove-WebBinding -ErrorAction SilentlyContinue
    New-WebBinding -Name $SiteName -Protocol https -Port 443 -HostHeader $ApiHost | Out-Null
    Push-Location IIS:\SslBindings
    Get-Item cert:\LocalMachine\My\$($cert.Thumbprint) | New-Item 0.0.0.0!443!$ApiHost | Out-Null
    Pop-Location
    Write-Host "- HTTPS binding set for $ApiHost" -ForegroundColor Green
}

# Enable ARR proxy if available
try {
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST'  -filter 'system.webServer/proxy' -name 'enabled' -value 'True' -ErrorAction Stop
    Write-Host "- ARR proxy enabled" -ForegroundColor Green
} catch {
    Write-Warning "ARR proxy config not applied. Ensure Application Request Routing is installed and proxy is enabled."
}

Write-Host "IIS site configuration complete. Ensure web.config is present to proxy /api and callbacks to http://localhost:$BackendPort" -ForegroundColor Cyan
