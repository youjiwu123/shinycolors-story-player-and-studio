param(
  [int]$Port = 18898,
  [switch]$Restart
)

$ErrorActionPreference = 'Stop'
$ShinyRoot = Split-Path -Parent $PSScriptRoot
$TargetScript = Join-Path $PSScriptRoot 'studio_portable_server.js'

function Get-ListeningPid([int]$TargetPort) {
  $conn = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) { return [int]$conn.OwningProcess }
  return 0
}

function Test-StudioHealth([int]$TargetPort) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$TargetPort/proto/" -TimeoutSec 3
    if ($resp.StatusCode -ne 200) { return $false }
    $proj = Invoke-RestMethod -Uri "http://127.0.0.1:$TargetPort/api/studio/projects" -TimeoutSec 3
    if ($proj -and $proj.ok -eq $true) { return $true }
  } catch {}
  return $false
}

$existingPid = Get-ListeningPid -TargetPort $Port
if ($existingPid -gt 0 -and -not $Restart) {
  if (Test-StudioHealth -TargetPort $Port) {
    Write-Output "ALREADY_RUNNING PID=$existingPid PORT=$Port"
    exit 0
  }
}

if ($existingPid -gt 0 -and $Restart) {
  Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
}

$nodeCmd = (Get-Command node -ErrorAction Stop).Source
$cmdLine = "`"$nodeCmd`" `"$TargetScript`" --port $Port"
$wmi = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine = $cmdLine
  CurrentDirectory = $ShinyRoot
}

if ($wmi.ReturnValue -ne 0) {
  throw "Win32_Process.Create failed with code $($wmi.ReturnValue)"
}

$spawnedPid = [int]$wmi.ProcessId
for ($i = 0; $i -lt 24; $i++) {
  Start-Sleep -Milliseconds 350
  if (Test-StudioHealth -TargetPort $Port) {
    Write-Output "STARTED_DETACHED PID=$spawnedPid PORT=$Port"
    exit 0
  }
}

throw "Studio server started (PID=$spawnedPid) but failed health check on port $Port"
