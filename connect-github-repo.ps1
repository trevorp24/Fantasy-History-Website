param(
  [string]$RepoUrl = "https://github.com/trevorp24/Fantasy-History-Website.git"
)

$ErrorActionPreference = "Stop"

function Clear-LocalProxyForGit {
  foreach ($Name in @("HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy")) {
    [Environment]::SetEnvironmentVariable($Name, $null, "Process")
  }
}

function Find-Git {
  $programFilesGit = "C:\Program Files\Git\cmd\git.exe"
  if (Test-Path -LiteralPath $programFilesGit) {
    return $programFilesGit
  }

  $localGit = "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
  if (Test-Path -LiteralPath $localGit) {
    return $localGit
  }

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
$Git = Find-Git
Clear-LocalProxyForGit

Push-Location $ProjectRoot
try {
  Ensure-GitIdentity $Git

  $ExistingRemote = ""
  $RemoteNames = & $Git remote
  if ($RemoteNames -contains "origin") {
    $ExistingRemote = & $Git remote get-url origin
  }

  if ($ExistingRemote) {
    Write-Host "GitHub remote is already connected:"
    Write-Host $ExistingRemote
  } else {
    & $Git remote add origin $RepoUrl
    Write-Host "Connected GitHub remote:"
    Write-Host $RepoUrl
  }

  & $Git branch -M main
  & $Git add docs app lib scripts README.md update-moggate-site.ps1 update-moggate-site.cmd export-moggate-json.ps1 export-moggate-json.cmd export-and-update-moggate-site.cmd reset-espn-cookies-and-export.cmd package.json pnpm-lock.yaml tsconfig.json next.config.ts next-env.d.ts .gitignore

  $Status = & $Git status --short
  if ($Status) {
    & $Git commit -m "Add Moggate site"
  } else {
    Write-Host "No local changes to commit."
  }

  Write-Host ""
  Write-Host "Now pushing to GitHub. If GitHub asks you to sign in, complete the browser prompt."
  & $Git -c http.sslBackend=openssl push -u origin main --force-with-lease
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done."
Read-Host "Press Enter to close"
