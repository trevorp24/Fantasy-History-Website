param(
  [string]$SourceFolder = "$env:USERPROFILE\Downloads",
  [switch]$Push,
  [switch]$SkipJsonCopy
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Find-Node {
  $bundledNode = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path -LiteralPath $bundledNode) {
    return $bundledNode
  }

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    return $nodeCommand.Source
  }

  throw "Node.js was not found. Install Node.js or run this from Codex where the bundled Node runtime is available."
}

function Find-Git {
  $bundledGit = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
  if (Test-Path -LiteralPath $bundledGit) {
    return $bundledGit
  }

  $gitCommand = Get-Command git -ErrorAction SilentlyContinue
  if ($gitCommand) {
    return $gitCommand.Source
  }

  throw "Git was not found. Install Git for Windows or run this from Codex where the bundled Git runtime is available."
}

function Ensure-GitIdentity($Git) {
  $Name = & $Git config --get user.name
  $Email = & $Git config --get user.email

  if (-not $Name) {
    & $Git config user.name "trevorp24"
  }

  if (-not $Email) {
    & $Git config user.email "trevorp24@users.noreply.github.com"
  }
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RawDataFolder = Join-Path $ProjectRoot "data\raw"
$OutputFolder = Join-Path $ProjectRoot "outputs\moggate-preview-pages"
$DocsFolder = Join-Path $ProjectRoot "docs"
$Node = Find-Node
$Git = Find-Git

Write-Host "Moggate weekly update" -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Looking for ESPN exports in: $SourceFolder"

if (-not (Test-Path -LiteralPath $SourceFolder)) {
  throw "Source folder does not exist: $SourceFolder"
}

if ($SkipJsonCopy) {
  Write-Step "Using existing 2026 ESPN JSON export"
  Write-Host "Using data\raw\moggate_2026.json"
} else {
  Write-Step "Copying latest 2026 ESPN JSON export"
  $Copied = 0
  $SourceFile = Join-Path $SourceFolder "moggate_2026.json"
  $TargetFile = Join-Path $RawDataFolder "moggate_2026.json"

  if (Test-Path -LiteralPath $SourceFile) {
    Copy-Item -LiteralPath $SourceFile -Destination $TargetFile -Force
    Write-Host "Updated moggate_2026.json"
    $Copied++
  } else {
    Write-Host "Skipped moggate_2026.json - not found in source folder" -ForegroundColor DarkYellow
  }

  if ($Copied -eq 0) {
    Write-Host "No new 2026 ESPN JSON file was found. The site will rebuild from the existing data." -ForegroundColor DarkYellow
  }
}

Write-Step "Rebuilding website files"
Push-Location $ProjectRoot
try {
  Ensure-GitIdentity $Git

  & $Node "work\generate-preview-pages.mjs"
  if ($LASTEXITCODE -ne 0) {
    throw "Website rebuild failed."
  }

  if (-not (Test-Path -LiteralPath $OutputFolder)) {
    throw "Build output folder was not created: $OutputFolder"
  }

  Copy-Item -Path (Join-Path $OutputFolder "*") -Destination $DocsFolder -Recurse -Force

  Write-Step "Checking season data"
  & $Node "scripts\validate-data.mjs"
  if ($LASTEXITCODE -ne 0) {
    throw "Data validation failed."
  }

  Write-Step "Checking Git changes"
  $Status = & $Git status --short
  if (-not $Status) {
    Write-Host "No changes to commit."
  } else {
    & $Git add docs app lib scripts README.md update-moggate-site.ps1 update-moggate-site.cmd export-moggate-json.ps1 export-moggate-json.cmd export-and-update-moggate-site.cmd reset-espn-cookies-and-export.cmd package.json pnpm-lock.yaml tsconfig.json next.config.ts next-env.d.ts .gitignore
    & $Git commit -m "Update Moggate league site"

    if ($Push) {
      $Remote = & $Git remote
      if ($Remote) {
        Write-Step "Pushing to GitHub"
        & $Git push
      } else {
        Write-Host "Local commit created, but no GitHub remote is connected for this folder." -ForegroundColor DarkYellow
        Write-Host "Open this folder in GitHub Desktop or connect a remote before pushing."
      }
    } else {
      Write-Host "Local commit created. Run this with -Push when the GitHub remote is connected."
    }
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done. Open docs\index.html to preview the updated site." -ForegroundColor Green
Read-Host "Press Enter to close"
