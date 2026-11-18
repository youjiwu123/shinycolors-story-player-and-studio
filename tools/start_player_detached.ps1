<#
.SYNOPSIS
  Launches, checks, or stops the local Shiny Colors enza player server on port 18899,
  detached from parent shell / DSH Job Objects via Win32_Process (B7 fix).
#>
[CmdletBinding()]
param(
  [int]$Port = 18899,
  [string]$BindHost = '0.0.0.0',
  [switch]$Stop,
  [switch]$Status,
  [switch]$Restart
)

$ErrorActionPreference = 'Stop'

$ShinyRoot = Split-Path -Parent $PSScriptRoot
$ServerScript = [System.IO.Path]::GetFullPath((Join-Path $ShinyRoot 'tmp\enza-server.js'))
$SafeTempDir = if ($env:LOCALAPPDATA -and (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'Temp'))) {
  Join-Path $env:LOCALAPPDATA 'Temp'
} else {
  [System.IO.Path]::Combine($ShinyRoot, 'tests')
}
$PidFile = Join-Path $SafeTempDir ("enza-player-{0}.pid.json" -f $Port)

function Get-PortListenerPid {
  param([int]$TargetPort)
  try {
    $conn = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn -and $conn.OwningProcess -gt 0) {
      return [int]$conn.OwningProcess
    }
  } catch {}
  return 0
}

function Test-PlayerHealth {
  param([int]$TargetPort)
  try {
    $resp = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/api/progress" -f $TargetPort) -UseBasicParsing -TimeoutSec 3
    if ($resp.StatusCode -eq 200) {
      $json = $resp.Content | ConvertFrom-Json
      return [pscustomobject]@{
        Healthy = [bool]$json.ok
        Workers = if ($json.workers) { $json.workers.Count } else { 0 }
      }
    }
  } catch {}
  return [pscustomobject]@{ Healthy = $false; Workers = 0 }
}

function Stop-DetachedPlayer {
  $listenPid = Get-PortListenerPid -TargetPort $Port
  $recordedPid = 0
  if (Test-Path -LiteralPath $PidFile) {
    try {
      $meta = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
      $recordedPid = [int]$meta.pid
    } catch {}
  }
  $pids = @($listenPid, $recordedPid) | Where-Object { $_ -gt 0 } | Select-Object -Unique
  if (-not $pids -or $pids.Count -eq 0) {
    Write-Host "No detached enza player process listening on port $Port." -ForegroundColor Yellow
  } else {
    foreach ($targetPid in $pids) {
      $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -match '^node') {
        Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped node.exe PID $targetPid on port $Port." -ForegroundColor Green
      }
    }
  }
  if (Test-Path -LiteralPath $PidFile) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  }
}

if ($Stop) {
  Stop-DetachedPlayer
  exit 0
}

if ($Status) {
  $listenPid = Get-PortListenerPid -TargetPort $Port
  $health = Test-PlayerHealth -TargetPort $Port
  if ($listenPid -gt 0 -and $health.Healthy) {
    Write-Host ("RUNNING: PID={0} http://127.0.0.1:{1}/ (progress workers={2})" -f $listenPid, $Port, $health.Workers) -ForegroundColor Green
    exit 0
  } elseif ($listenPid -gt 0) {
    Write-Host ("LISTENING (unhealthy / legacy): PID={0} on port {1}" -f $listenPid, $Port) -ForegroundColor Yellow
    exit 1
  } else {
    Write-Host ("STOPPED: nothing listening on port {0}" -f $Port) -ForegroundColor DarkGray
    exit 1
  }
}

if ($Restart) {
  Stop-DetachedPlayer
  Start-Sleep -Milliseconds 400
}

$existingPid = Get-PortListenerPid -TargetPort $Port
if ($existingPid -gt 0) {
  $health = Test-PlayerHealth -TargetPort $Port
  $isStale = $false
  if ($health.Healthy) {
    try {
      if (Test-Path -LiteralPath $PidFile) {
        $meta = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
        $startedUtc = [DateTimeOffset]::Parse($meta.startedAt).UtcDateTime
        $scriptUtc = (Get-Item -LiteralPath $ServerScript).LastWriteTimeUtc
        $playerHtmlPath = Join-Path (Split-Path -Parent $ServerScript) 'enza-player.html'
        $playerHtmlUtc = if (Test-Path -LiteralPath $playerHtmlPath) { (Get-Item -LiteralPath $playerHtmlPath).LastWriteTimeUtc } else { [DateTime]::MinValue }
        if ($scriptUtc -gt $startedUtc -or $playerHtmlUtc -gt $startedUtc) { $isStale = $true }
      }
      $remuxCheck = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/api/video-remux/status" -f $Port) -UseBasicParsing -TimeoutSec 2
      if ($remuxCheck.StatusCode -ne 200) { $isStale = $true }
    } catch {
      $isStale = $true
    }
    if (-not $isStale) {
      Write-Host ("enza-server already running & healthy: PID={0} -> http://127.0.0.1:{1}/progress" -f $existingPid, $Port) -ForegroundColor Green
      exit 0
    }
    Write-Host ("Detected updated server code on disk (stale PID={0}); restarting on port {1}..." -f $existingPid, $Port) -ForegroundColor Yellow
    Stop-DetachedPlayer
    Start-Sleep -Milliseconds 400
  } else {
    Write-Host ("Port {0} held by unhealthy/legacy PID {1}; restarting cleanly..." -f $Port, $existingPid) -ForegroundColor Yellow
    Stop-DetachedPlayer
    Start-Sleep -Milliseconds 400
  }
}

if (-not (Test-Path -LiteralPath $ServerScript -PathType Leaf)) {
  throw "Missing server script: $ServerScript"
}

$NodeExe = (Get-Command node -ErrorAction Stop).Source
$CmdLine = ('"{0}" "{1}" --host={2} --port={3}' -f $NodeExe, $ServerScript, $BindHost, $Port)

# Launch via WMI Win32_Process.Create with SW_HIDE (0) so node.exe is completely outside DSH Job Object
$SpawnedPid = 0
$LaunchMode = 'Start-Process'
try {
  $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
  $cimRes = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine               = $CmdLine
    CurrentDirectory          = $ShinyRoot
    ProcessStartupInformation = $startup
  }
  if ($cimRes.ReturnValue -eq 0 -and $cimRes.ProcessId -gt 0) {
    $SpawnedPid = [int]$cimRes.ProcessId
    $LaunchMode = 'Win32_Process (Detached)'
  }
} catch {
  $SpawnedPid = 0
}

if ($SpawnedPid -le 0) {
  $proc = Start-Process -FilePath $NodeExe -ArgumentList @($ServerScript, "--host=$BindHost", "--port=$Port") -WorkingDirectory $ShinyRoot -WindowStyle Hidden -PassThru
  $SpawnedPid = [int]$proc.Id
}

# Poll health check up to 12 seconds (catalog + zh index warm-up takes ~1-2s)
$Deadline = (Get-Date).AddSeconds(12)
$Ready = $false
$LivePid = $SpawnedPid
while ((Get-Date) -lt $Deadline) {
  $h = Test-PlayerHealth -TargetPort $Port
  if ($h.Healthy) {
    $Ready = $true
    $detected = Get-PortListenerPid -TargetPort $Port
    if ($detected -gt 0) { $LivePid = $detected }
    break
  }
  Start-Sleep -Milliseconds 300
}

if (-not $Ready) {
  throw "Detached enza-server (PID $SpawnedPid) failed health check on http://127.0.0.1:$Port/api/progress within 12s."
}

$Record = @{
  pid       = $LivePid
  port      = $Port
  host      = $BindHost
  script    = $ServerScript
  startedAt = (Get-Date).ToString('o')
} | ConvertTo-Json
Set-Content -LiteralPath $PidFile -Value $Record -Encoding UTF8

Write-Host ("STARTED DETACHED: PID={0} [{1}]" -f $LivePid, $LaunchMode) -ForegroundColor Green
Write-Host ("  Player    : http://127.0.0.1:{0}/" -f $Port)
Write-Host ("  Dashboard : http://127.0.0.1:{0}/progress" -f $Port)
Write-Host ("  PID File  : {0}" -f $PidFile)
