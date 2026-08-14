<#
.SYNOPSIS
  Engangsoppsett: lagrer passordet til updater-signeringsnokkelen kryptert
  (Windows DPAPI, kun lesbart av din Windows-konto pa denne maskinen), slik
  at release.ps1 ikke lenger trenger a sporre om det hver gang.

.DESCRIPTION
  OBS: Passordet du blir spurt om her er IKKE selve nokkelfil-innholdet
  (klasseplass-updater.key) - det er den separate passfrasen du (forhapentligvis)
  satte da nokkelparet ble generert med `tauri signer generate` / `rsign generate`.
  Har du ingen passfrase (nokkelen ble generert uten passord), trykk bare Enter.

.EXAMPLE
  ./scripts/setup-signing-key.ps1
#>

$ErrorActionPreference = 'Stop'

$KeyDir = Join-Path $HOME '.tauri-keys'
$PwFile = Join-Path $KeyDir 'klasseplass-updater.key.pw'

if (-not (Test-Path $KeyDir)) {
  throw "Fant ikke $KeyDir - forventer at klasseplass-updater.key allerede ligger der."
}

$securePw = Read-Host -AsSecureString 'Passord (passfrase) for signeringsnokkelen (Enter hvis ingen)'
$encrypted = ConvertFrom-SecureString $securePw
Set-Content -Path $PwFile -Value $encrypted -Encoding utf8

Write-Host "Passord lagret kryptert i $PwFile (kun lesbart av denne Windows-kontoen)." -ForegroundColor Green
Write-Host "release.ps1 vil na hente det automatisk - du trenger ikke taste det igjen." -ForegroundColor Green
