#!/usr/bin/env pwsh
# Publish the Windows daemon as ONE self-contained ac-core.exe per architecture.
#
#   scripts/build-windows.ps1                 # both win-x64 and win-arm64
#   scripts/build-windows.ps1 -Rid win-arm64  # one RID
#   scripts/build-windows.ps1 -Stage          # also copy into bin/ac-core-win32-<arch>.exe
#
# The single-file/self-contained settings live in ACCore.csproj (keyed on
# RuntimeIdentifier), so this script only drives `dotnet publish` and checks
# the result really is a single file that runs on its own.
[CmdletBinding()]
param(
  [ValidateSet('win-x64', 'win-arm64')]
  [string[]]$Rid = @('win-x64', 'win-arm64'),
  [switch]$Stage,
  [int]$MaxSizeMB = 20
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$proj = Join-Path $root 'native/windows/ACCore/ACCore.csproj'
$hostRid = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq 'Arm64') { 'win-arm64' } else { 'win-x64' }

foreach ($r in $Rid) {
  $out = Join-Path $root "native/windows/publish-$r"
  if (Test-Path $out) { Remove-Item -Recurse -Force $out }
  Write-Host "==> dotnet publish -r $r"
  dotnet publish $proj -c Release -r $r -o $out --nologo
  if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed for $r" }

  # Must be exactly one file: the release workflow and the npm package ship
  # only ac-core.exe, so anything else here would be left behind.
  $files = Get-ChildItem $out -File
  if ($files.Count -ne 1 -or $files[0].Name -ne 'ac-core.exe') {
    throw "Expected a single ac-core.exe in $out, got: $($files.Name -join ', ')"
  }

  # Size budget: the exe ships inside every npm install and every desktop
  # installer that bundles this package. A trimmed, WPF-free build is ~12 MB;
  # anything near the WindowsDesktop-framework size (~70 MB) is a regression.
  $sizeMB = [math]::Round($files[0].Length / 1MB, 1)
  if ($files[0].Length -gt $MaxSizeMB * 1MB) {
    throw "ac-core.exe ($r) is $sizeMB MB, over the $MaxSizeMB MB budget. Did WPF/WinForms or trimming regress?"
  }
  Write-Host "    size: $sizeMB MB"

  # Run it from an empty directory so a missing ac-core.dll / runtime shows up
  # here instead of as a "Daemon pipe did not become available" at runtime.
  if ($r -eq $hostRid) {
    $tmp = Join-Path ([IO.Path]::GetTempPath()) "ac-core-verify-$r-$PID"
    New-Item -ItemType Directory -Force $tmp | Out-Null
    Copy-Item (Join-Path $out 'ac-core.exe') $tmp
    $ver = & (Join-Path $tmp 'ac-core.exe') --version
    Remove-Item -Recurse -Force $tmp
    if ($LASTEXITCODE -ne 0) { throw "Standalone ac-core.exe ($r) failed to run" }
    Write-Host "    standalone --version: $ver"
  } else {
    Write-Host "    (cannot execute $r on a $hostRid host; skipped run check)"
  }

  if ($Stage) {
    $arch = if ($r -eq 'win-arm64') { 'arm64' } else { 'x64' }
    $dest = Join-Path $root "bin/ac-core-win32-$arch.exe"
    Copy-Item (Join-Path $out 'ac-core.exe') $dest -Force
    Write-Host "    staged -> $dest"
  }
}
