param(
  [Parameter(Mandatory=$true)][string]$RepositoryRoot,
  [switch]$Rollback
)

$ErrorActionPreference = 'Stop'
$Release = 'v6.15.6'
$ToolVersion = '2.0.5'
$OldToolVersion = '2.0.4'
$Marker = '<script id="tal-fa-v205-xlsx-hotfix">'
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadRoot = Join-Path $PackageRoot '_payload'
$BackupRoot = Join-Path $PackageRoot '_backup'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$RepositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot.Trim('"'))

$Targets = @(
  'tools/financial-analysis/index.html',
  'en/tools/financial-analysis/index.html',
  'es/tools/financial-analysis/index.html'
)
$GeneratedDocs = @(
  'ISTRUZIONI-DEPLOY-v6.15.6.md',
  'QA-v6.15.6.json',
  'RELEASE-NOTES-v6.15.6.md'
)

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $Temp = $Path + '.tal-tmp'
  [System.IO.File]::WriteAllText($Temp, $Content, $Utf8NoBom)
  Move-Item -LiteralPath $Temp -Destination $Path -Force
}

function Backup-File([string]$RelativePath) {
  $Source = Join-Path $RepositoryRoot $RelativePath
  $Destination = Join-Path $BackupRoot $RelativePath
  if (Test-Path -LiteralPath $Destination) { return }
  $DestinationDirectory = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Restore-Backup {
  if (-not (Test-Path -LiteralPath $BackupRoot)) {
    throw 'Backup non trovato: rollback automatico non disponibile.'
  }
  $Files = Get-ChildItem -LiteralPath $BackupRoot -File -Recurse
  foreach ($File in $Files) {
    $Relative = $File.FullName.Substring($BackupRoot.Length).TrimStart([char[]]"\/")
    $Destination = Join-Path $RepositoryRoot $Relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $File.FullName -Destination $Destination -Force
  }
  foreach ($Name in ($GeneratedDocs + 'SHA256SUMS-v6.15.6.txt')) {
    $Path = Join-Path $RepositoryRoot $Name
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force }
  }
  Write-Host "Rollback completato. File ripristinati: $($Files.Count)" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot '.git'))) {
  throw 'La cartella indicata non sembra la root del repository: manca .git.'
}

if ($Rollback) {
  Restore-Backup
  exit 0
}

$HotfixPath = Join-Path $PayloadRoot 'financial-analysis-xlsx-hotfix-v2.0.5.js'
$HotfixJs = [System.IO.File]::ReadAllText($HotfixPath, [System.Text.Encoding]::UTF8)
$ScriptTag = $Marker + "`n" + $HotfixJs.TrimEnd() + "`n</script>"

foreach ($RelativePath in $Targets) {
  $Path = Join-Path $RepositoryRoot $RelativePath
  if (-not (Test-Path -LiteralPath $Path)) { throw "File mancante: $RelativePath" }
  Backup-File $RelativePath
  $Content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  if ($Content.Contains($Marker)) {
    if ([regex]::Matches($Content, [regex]::Escape($Marker)).Count -ne 1) {
      throw "Marker hotfix duplicato in $RelativePath"
    }
    Write-Host "Già aggiornato: $RelativePath" -ForegroundColor Yellow
    continue
  }
  if (-not $Content.Contains('tal-fa-v204-result-reconciliation')) {
    throw "$RelativePath non corrisponde alla Financial Analysis v2.0.4 attesa"
  }
  if (-not $Content.Contains('writeWorkbookFile') -or -not $Content.Contains('XLSX.write')) {
    throw "Funzioni XLSX attese non trovate in $RelativePath"
  }
  $Content = $Content -replace 'data-tool-version="2\.0\.4"', 'data-tool-version="2.0.5"'
  $ClosingPattern = '(?is)</body>\s*</html>\s*$'
  if ($Content -notmatch $ClosingPattern) { throw "Chiusura HTML non trovata in $RelativePath" }
  $Evaluator = [System.Text.RegularExpressions.MatchEvaluator]{ param($Match) $ScriptTag + "`n</body></html>`n" }
  $Content = [regex]::Replace($Content, $ClosingPattern, $Evaluator)
  if ([regex]::Matches($Content, [regex]::Escape($Marker)).Count -ne 1) {
    throw "Inserimento hotfix non univoco in $RelativePath"
  }
  Write-Utf8NoBom $Path $Content
  Write-Host "Aggiornato: $RelativePath" -ForegroundColor Green
}

$ManifestRelative = 'tools/manifest.json'
$ManifestPath = Join-Path $RepositoryRoot $ManifestRelative
if (-not (Test-Path -LiteralPath $ManifestPath)) { throw 'tools/manifest.json non trovato' }
Backup-File $ManifestRelative
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Manifest.release = $Release
$Manifest.date = '2026-07-28'
$FinancialAnalysis = $Manifest.tools | Where-Object { $_.slug -eq 'financial-analysis' }
if ($null -eq $FinancialAnalysis) { throw 'Voce financial-analysis non trovata nel manifest' }
$FinancialAnalysis.version = $ToolVersion
Write-Utf8NoBom $ManifestPath (($Manifest | ConvertTo-Json -Depth 20) + "`n")

foreach ($Name in $GeneratedDocs) {
  Copy-Item -LiteralPath (Join-Path $PayloadRoot $Name) -Destination (Join-Path $RepositoryRoot $Name) -Force
}

$ChecksumFiles = @($Targets + $ManifestRelative + $GeneratedDocs)
$ChecksumLines = foreach ($RelativePath in $ChecksumFiles) {
  $Path = Join-Path $RepositoryRoot $RelativePath
  $Hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  "$Hash  $($RelativePath.Replace('\','/'))"
}
Write-Utf8NoBom (Join-Path $RepositoryRoot 'SHA256SUMS-v6.15.6.txt') (($ChecksumLines -join "`n") + "`n")

Write-Host ''
Write-Host 'Hotfix applicata correttamente.' -ForegroundColor Green
Write-Host '- Financial Analysis: v2.0.5'
Write-Host '- Release sito: v6.15.6'
Write-Host "- Backup originali: $BackupRoot"
Write-Host '- Nessun push è stato eseguito automaticamente.'
