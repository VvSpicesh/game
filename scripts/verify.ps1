# Nocturne Games verify wrapper (Windows PowerShell)
# Usage: pwsh -File scripts/verify.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
py -3 .\scripts\verify.py
exit $LASTEXITCODE
