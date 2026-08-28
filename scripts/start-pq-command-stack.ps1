$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeRoot = "C:\Program Files\nodejs"
$nodePath = Join-Path $nodeRoot "node.exe"
$npmPath = Join-Path $nodeRoot "npm.cmd"

if (-not (Test-Path $nodePath)) {
  throw "Node.js was not found at $nodePath"
}

if (-not (Test-Path $npmPath)) {
  throw "npm was not found at $npmPath"
}

$env:Path = "$nodeRoot;$env:Path"
Set-Location $projectRoot

& $npmPath run db:migrate
if ($LASTEXITCODE -ne 0) {
  throw "Database migration failed. PQ COMMAND always-on stack was not started."
}

$serverScript = @"
`$env:Path = '$nodeRoot;' + `$env:Path
Set-Location '$projectRoot'
while (`$true) {
  & '$npmPath' run dev -- --port 3001
  Write-Host '[pq-command] web server exited, restarting in 5 seconds'
  Start-Sleep -Seconds 5
}
"@

$botScript = @"
`$env:Path = '$nodeRoot;' + `$env:Path
Set-Location '$projectRoot'
while (`$true) {
  & '$npmPath' run bot
  Write-Host '[pq-command] sourcing bot exited, restarting in 5 seconds'
  Start-Sleep -Seconds 5
}
"@

Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $serverScript -WindowStyle Minimized
Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $botScript -WindowStyle Minimized

Write-Host 'PQ COMMAND web server and constant sourcing bot started.'
