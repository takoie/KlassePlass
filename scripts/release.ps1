<#
.SYNOPSIS
  Bygger KlassePlass lokalt, signerer updater-artifacts, og publiserer en
  GitHub Release (via `gh`) knyttet til en git-tag. Ingen GitHub Actions
  involvert — alt kjores lokalt pa denne maskinen.

.DESCRIPTION
  1. Leser versjon fra package.json.
  2. Setter opp signeringsnokkel-miljovariabler (TAURI_SIGNING_PRIVATE_KEY /
     _PASSWORD) fra ~/.tauri-keys/klasseplass-updater.key, slik at
     `tauri build` genererer .sig-filer for updateren.
  3. Kjorer `npm run build` (= `tauri build`).
  4. Finner NSIS-installeren + tilhorende .sig i bundle-mappen.
  5. Bygger latest.json (Tauri updater-manifest) som peker pa
     github.com/takoie/KlassePlass sitt kommende release-tag.
  6. Oppretter og pusher git-tag vX.Y.Z.
  7. Oppretter GitHub Release med `gh release create` og laster opp
     installer + latest.json.

.PARAMETER Notes
  Valgfri fritekst for release-notater. Standard: generer fra commits.

.EXAMPLE
  ./scripts/release.ps1
  ./scripts/release.ps1 -Notes "Fikset auto-oppdatering, nytt kortdesign"
#>

param(
  [string]$Notes = ''
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$KeyPath = Join-Path $HOME '.tauri-keys/klasseplass-updater.key'
$RepoSlug = 'takoie/KlassePlass'

if (-not (Test-Path $KeyPath)) {
  throw "Fant ikke signeringsnokkel: $KeyPath"
}

# --- 1. Versjon ---
$pkg = Get-Content (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json
$Version = $pkg.version
$Tag = "v$Version"
Write-Host "Bygger release $Tag ..." -ForegroundColor Cyan

# --- 2. Sjekk at working tree er ren ---
$status = git -C $RepoRoot status --porcelain
if ($status) {
  throw "Working tree er ikke ren. Commit eller stash endringer for du kjorer release-skriptet."
}

# --- 3. Sjekk at tag ikke allerede finnes ---
$existingTag = git -C $RepoRoot tag --list $Tag
if ($existingTag) {
  throw "Tag $Tag finnes allerede. Bump versjonen i package.json forst."
}

# --- 4. Signeringsnokkel ---
$env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path $KeyPath).Path
$PwCacheFile = Join-Path (Split-Path $KeyPath) 'klasseplass-updater.key.pw'
if ($null -eq $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  if (Test-Path $PwCacheFile) {
    # Hentet fra DPAPI-kryptert cache laget av scripts/setup-signing-key.ps1 -
    # kun dekrypterbar av denne Windows-kontoen pa denne maskinen.
    $cachedSecure = Get-Content $PwCacheFile -Raw | ConvertTo-SecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cachedSecure)
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Write-Host "Bruker lagret signeringspassord fra $PwCacheFile" -ForegroundColor DarkGray
  } else {
    Write-Host "Ingen passordcache funnet ($PwCacheFile) - bruker tom passfrase." -ForegroundColor DarkGray
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
  }
}

# --- 5. Bygg ---
$bundleDir = Join-Path $RepoRoot 'src-tauri/target/release/bundle/nsis'
# Rydd gamle bundle-artifacts forst - ellers kan et stale installer-.exe fra
# en tidligere versjon (uten .sig, siden signeringsnokkelen kan ha endret seg
# siden da) bli plukket opp ved en feiltakelse i steg 6.
if (Test-Path $bundleDir) {
  Remove-Item (Join-Path $bundleDir '*') -Recurse -Force -ErrorAction SilentlyContinue
}

Push-Location $RepoRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build feilet (exit $LASTEXITCODE)" }
} finally {
  Pop-Location
}

# --- 6. Finn artifacts ---
$installer = Get-ChildItem $bundleDir -Filter "*_${Version}_*-setup.exe" | Select-Object -First 1
if (-not $installer) {
  throw "Fant ingen NSIS-installer for versjon $Version i $bundleDir"
}
$sigFile = "$($installer.FullName).sig"
if (-not (Test-Path $sigFile)) {
  throw "Fant ingen .sig-fil for installeren ($sigFile) - sjekk at signeringsnokkelen er riktig."
}
$signature = Get-Content $sigFile -Raw

Write-Host "Fant installer: $($installer.Name)" -ForegroundColor Green

# --- 7. Bygg latest.json ---
$pubDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$downloadUrl = "https://github.com/$RepoSlug/releases/download/$Tag/$($installer.Name)"

$latestJson = [ordered]@{
  version   = $Version
  notes     = if ($Notes) { $Notes } else { "Se release-notater pa GitHub for detaljer." }
  pub_date  = $pubDate
  platforms = [ordered]@{
    'windows-x86_64' = [ordered]@{
      signature = $signature.Trim()
      url       = $downloadUrl
    }
  }
} | ConvertTo-Json -Depth 5

$latestJsonPath = Join-Path $bundleDir 'latest.json'
Set-Content -Path $latestJsonPath -Value $latestJson -Encoding utf8

# --- 8. Git tag + push ---
git -C $RepoRoot tag -a $Tag -m "Release $Tag"
git -C $RepoRoot push origin $Tag

# --- 9. GitHub Release ---
$ghArgs = @('release', 'create', $Tag, $installer.FullName, $latestJsonPath, '--title', "KlassePlass $Tag")
if ($Notes) {
  $ghArgs += @('--notes', $Notes)
} else {
  $ghArgs += '--generate-notes'
}

& gh @ghArgs
if ($LASTEXITCODE -ne 0) { throw "gh release create feilet (exit $LASTEXITCODE)" }

Write-Host "Release $Tag publisert pa https://github.com/$RepoSlug/releases/tag/$Tag" -ForegroundColor Green
