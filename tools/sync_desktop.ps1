<#
.SYNOPSIS
  Syncs repaired local enza player files from tmp/ into desktop/app/ with SHA256 verification.
  Default mode is -CheckOnly (read-only). Pass -Apply ONLY after Gate G4 approval.
  NEVER touches desktop/dist/ or desktop/release-full/.
#>
[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

$ShinyRoot = Split-Path -Parent $PSScriptRoot
$ForbiddenPrefixes = @(
  [System.IO.Path]::GetFullPath((Join-Path $ShinyRoot 'desktop\dist')),
  [System.IO.Path]::GetFullPath((Join-Path $ShinyRoot 'desktop\release-full')),
  'D:\enza'
)

$Pairs = @(
  @{
    Name   = 'server.js'
    Source = [System.IO.Path]::GetFullPath((Join-Path $ShinyRoot 'tmp\enza-server.js'))
    Target = [System.IO.Path]::GetFullPath((Join-Path $ShinyRoot 'desktop\app\server.js'))
  },
  @{
    Name   = 'player.html'
    Source = [System.IO.Path]::GetFullPath((Join-Path $ShinyRoot 'tmp\enza-player.html'))
    Target = [System.IO.Path]::GetFullPath((Join-Path $ShinyRoot 'desktop\app\player.html'))
  }
)

foreach ($p in $Pairs) {
  foreach ($forb in $ForbiddenPrefixes) {
    if ($p.Target.StartsWith($forb, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "GUARDRAIL VIOLATION: Target $($p.Target) is inside forbidden path $forb"
    }
  }
  if (-not (Test-Path -LiteralPath $p.Source -PathType Leaf)) {
    throw "Missing source file: $($p.Source)"
  }
}

$EffectiveApply = [bool]($Apply -and (-not $CheckOnly))
$ModeLabel = if ($EffectiveApply) { 'APPLY (copy + SHA256 verify)' } else { 'CHECK-ONLY (read-only diff)' }

Write-Host "=== Shiny Colors Desktop App Sync [$ModeLabel] ===" -ForegroundColor Cyan

$DriftCount = 0
$Report = @()

foreach ($p in $Pairs) {
  $srcItem = Get-Item -LiteralPath $p.Source
  $srcHash = (Get-FileHash -LiteralPath $p.Source -Algorithm SHA256).Hash.ToUpperInvariant()

  $dstExists = Test-Path -LiteralPath $p.Target -PathType Leaf
  $dstHash = if ($dstExists) { (Get-FileHash -LiteralPath $p.Target -Algorithm SHA256).Hash.ToUpperInvariant() } else { '<MISSING>' }
  $dstBytes = if ($dstExists) { (Get-Item -LiteralPath $p.Target).Length } else { 0 }

  if ($EffectiveApply -and ($srcHash -ne $dstHash)) {
    $dstDir = Split-Path -Parent $p.Target
    if (-not (Test-Path -LiteralPath $dstDir)) {
      New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $p.Source -Destination $p.Target -Force
    $dstExists = Test-Path -LiteralPath $p.Target -PathType Leaf
    $dstHash = (Get-FileHash -LiteralPath $p.Target -Algorithm SHA256).Hash.ToUpperInvariant()
    $dstBytes = (Get-Item -LiteralPath $p.Target).Length
    if ($srcHash -ne $dstHash) {
      throw "SHA256 verification failed after copying $($p.Name): src=$srcHash dst=$dstHash"
    }
  }

  $inSync = ($srcHash -eq $dstHash)
  if (-not $inSync) { $DriftCount++ }

  $statusText = if ($inSync) { 'IN_SYNC' } else { 'DRIFT' }
  $color = if ($inSync) { 'Green' } else { 'Yellow' }
  Write-Host ("  [{0}] {1}" -f $statusText, $p.Name) -ForegroundColor $color
  Write-Host ("    src: {0} ({1} bytes) [{2}]" -f $srcHash, $srcItem.Length, $p.Source)
  Write-Host ("    dst: {0} ({1} bytes) [{2}]" -f $dstHash, $dstBytes, $p.Target)

  $Report += [pscustomobject]@{
    File        = $p.Name
    Status      = $statusText
    SourceBytes = $srcItem.Length
    TargetBytes = $dstBytes
    SourceSHA   = $srcHash
    TargetSHA   = $dstHash
  }
}

if (-not $EffectiveApply) {
  if ($DriftCount -gt 0) {
    Write-Host "`nResult: $DriftCount file(s) differ between tmp/ and desktop/app/. Run with -Apply after Gate G4 approval to sync." -ForegroundColor Yellow
  } else {
    Write-Host "`nResult: All files in desktop/app/ match tmp/ SHA256." -ForegroundColor Green
  }
} else {
  Write-Host "`nResult: Synced and SHA256-verified all $($Pairs.Count) files into desktop/app/ (desktop/dist untouched)." -ForegroundColor Green
}
