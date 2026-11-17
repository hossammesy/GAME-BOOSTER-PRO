# GAME BOOSTER PRO — Windows 11 x64 Release Build Script
# Run this script on Windows 11 (x64) with Node.js 20+ and .NET 8 SDK installed.

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "=== 1/4 Building React + TypeScript Frontend ===" -ForegroundColor Cyan
Push-Location $RepoRoot
if (Test-Path "package-lock.json") { npm ci } else { npm install }
npm run build
Pop-Location

Write-Host "=== 2/4 Testing & Publishing Windows 11 Local Agent (.NET 8 win-x64) ===" -ForegroundColor Cyan
$AgentSln = Join-Path $RepoRoot "WindowsAgent\GameBoosterPro.sln"
$AgentProj = Join-Path $RepoRoot "WindowsAgent\src\GameBoosterPro.Agent\GameBoosterPro.Agent.csproj"
$PublishOut = Join-Path $RepoRoot "WindowsAgent\publish-win-x64"

dotnet test $AgentSln --configuration Release
if (Test-Path $PublishOut) { Remove-Item -Recurse -Force $PublishOut }
dotnet publish $AgentProj `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=false `
  -o $PublishOut

Write-Host "=== 3/4 Building Desktop Wrapper & Running Unit Tests ===" -ForegroundColor Cyan
$DesktopDir = Join-Path $RepoRoot "desktop"
Push-Location $DesktopDir
if (Test-Path "package-lock.json") { npm ci } else { npm install }
npm run build
npm test

Write-Host "=== 4/4 Packaging Windows x64 NSIS Installer (GAME_BOOSTER_PRO_Setup.exe) ===" -ForegroundColor Cyan
npx electron-builder --config electron-builder.yml --win nsis --x64
Pop-Location

$SetupExe = Join-Path $DesktopDir "release\GAME_BOOSTER_PRO_Setup.exe"
if (Test-Path $SetupExe) {
  Write-Host "SUCCESS: Installer created at $SetupExe" -ForegroundColor Green
} else {
  throw "Expected installer not found at $SetupExe"
}
