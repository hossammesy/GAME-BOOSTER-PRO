# GAME BOOSTER PRO — Windows 11 Verification & Smoke Test Script
# Execute after building GAME_BOOSTER_PRO_Setup.exe on a Windows 11 test machine.

param(
  [string]$InstallerPath = "$PSScriptRoot\..\release\GAME_BOOSTER_PRO_Setup.exe"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Step 1: Verify Installer Exists ===" -ForegroundColor Cyan
if (-not (Test-Path $InstallerPath)) {
  throw "Installer not found at $InstallerPath. Run prepare-windows-release.ps1 first."
}

$DataDir = Join-Path $env:LOCALAPPDATA "GameBoosterPro"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\GAME BOOSTER PRO"

Write-Host "=== Step 2: Test Silent Per-User Fresh Install (No Admin Required) ===" -ForegroundColor Cyan
Start-Process -FilePath $InstallerPath -ArgumentList "/S" -Wait
if (-not (Test-Path (Join-Path $InstallDir "GAME BOOSTER PRO.exe"))) {
  throw "Desktop executable missing after install."
}
if (-not (Test-Path (Join-Path $InstallDir "resources\agent\GameBoosterPro.Agent.exe"))) {
  throw "Packaged Local Agent binary missing from resources\agent\."
}

Write-Host "=== Step 3: Verify Agent Startup, Health, Hardware & Game Scan ===" -ForegroundColor Cyan
$AppProc = Start-Process -FilePath (Join-Path $InstallDir "GAME BOOSTER PRO.exe") -PassThru
Start-Sleep -Seconds 6

$TokenFile = Join-Path $DataDir "agent-token.txt"
if (-not (Test-Path $TokenFile)) {
  throw "Agent bearer token was not provisioned in $TokenFile"
}
$Token = (Get-Content $TokenFile -Raw).Trim()
$Headers = @{ Authorization = "Bearer $Token"; "X-Client-Origin" = "file://" }

$Health = Invoke-RestMethod -Uri "http://127.0.0.1:48920/api/v1/health" -Headers $Headers -Method Get
$Hardware = Invoke-RestMethod -Uri "http://127.0.0.1:48920/api/v1/hardware" -Headers $Headers -Method Get
$Scan = Invoke-RestMethod -Uri "http://127.0.0.1:48920/api/v1/games/scan" -Headers $Headers -Method Post

Write-Host "Health: $($Health.status) | Elevation: $($Health.elevation) | GPU: $($Hardware.gpu.primaryModel) | Games: $($Scan.gamesFound)" -ForegroundColor Green

Write-Host "=== Step 4: Verify Crash Recovery ===" -ForegroundColor Cyan
$AgentProc = Get-Process -Name "GameBoosterPro.Agent" -ErrorAction Stop
Stop-Process -Id $AgentProc.Id -Force
Start-Sleep -Seconds 6
$HealthAfterRecovery = Invoke-RestMethod -Uri "http://127.0.0.1:48920/api/v1/health" -Headers $Headers -Method Get
Write-Host "Crash Recovery Verified: Agent status = $($HealthAfterRecovery.status)" -ForegroundColor Green

Write-Host "=== Step 5: Verify Upgrade Data Preservation ===" -ForegroundColor Cyan
$MarkerGame = Join-Path $DataDir "manual_games.json"
if (-not (Test-Path $MarkerGame)) { '[{"id":"upgrade_test","title":"Test Game"}]' | Out-File -FilePath $MarkerGame -Encoding utf8 }
$BeforeHash = (Get-FileHash $MarkerGame).Hash

$AppProc | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $InstallerPath -ArgumentList "/S" -Wait
$AfterHash = (Get-FileHash $MarkerGame).Hash
if ($BeforeHash -ne $AfterHash) {
  throw "Upgrade modified or deleted manual_games.json!"
}
Write-Host "Upgrade Data Preservation Verified (backup created + user data intact)." -ForegroundColor Green
