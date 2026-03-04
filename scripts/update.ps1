# Stop Python and KlassePlass so git pull / updater can replace files.
# Run this before pulling updates (e.g. git pull).
# Usage: .\scripts\update.ps1

Write-Host "Stopping Python processes..."
Get-Process -Name python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name pythonw -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Stopping KlassePlass..."
Get-Process -Name KlassePlass -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Waiting 2 seconds for processes to exit..."
Start-Sleep -Seconds 2

Write-Host "Running git pull..."
Set-Location $PSScriptRoot\..
git pull

Write-Host "Done."
