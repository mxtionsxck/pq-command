$projectRoot = Split-Path -Parent $PSScriptRoot
$starterPath = Join-Path $projectRoot 'scripts\start-pq-command-stack.ps1'
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$launcherPath = Join-Path $startupDir 'PQ COMMAND Always On.cmd'
$escapedStarter = $starterPath.Replace('"', '""')
$launcherContents = "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"`"$escapedStarter`"`"`r`n"

if (-not (Test-Path $startupDir)) {
	New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
}

Set-Content -Path $launcherPath -Value $launcherContents -Encoding ASCII

Write-Host "Registered startup launcher: $launcherPath"
Write-Host "It will start the PQ COMMAND web server and constant sourcing bot at logon."
