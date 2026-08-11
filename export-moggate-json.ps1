param(
  [int]$Season = 2026,
  [int]$LeagueId = 69640845,
  [string]$OutputFile = "",
  [switch]$ResetCookies
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function ConvertFrom-SecureStringPlainText($SecureValue) {
  if (-not $SecureValue) {
    return ""
  }

  $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
  }
}

function Read-EnvFile($Path) {
  $Values = @{}
  if (Test-Path -LiteralPath $Path) {
    foreach ($Line in Get-Content -LiteralPath $Path) {
      if ($Line -match '^\s*([^#][^=]+?)\s*=\s*(.*)\s*$') {
        $Values[$Matches[1].Trim()] = $Matches[2].Trim()
      }
    }
  }
  return $Values
}

function Save-EnvFile($Path, $Swid, $EspnS2) {
  @(
    "ESPN_SWID=$Swid",
    "ESPN_S2=$EspnS2"
  ) | Set-Content -LiteralPath $Path -Encoding UTF8
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

function Get-CookieValue($CookieText, $Name) {
  if (-not $CookieText) {
    return ""
  }

  $Pattern = "$([regex]::Escape($Name))\s*=\s*([^;\r\n]+)"
  $Match = [regex]::Match($CookieText, $Pattern)
  if ($Match.Success) {
    return $Match.Groups[1].Value.Trim()
  }

  return ""
}

function Request-EspnCookies($Path) {
  $CookieFile = Join-Path (Split-Path -Parent $Path) "espn-cookie.txt"
  $CookieHeader = ""
  if (Test-Path -LiteralPath $CookieFile) {
    $CookieHeader = (Get-Content -LiteralPath $CookieFile -Raw).Trim()
    if ($CookieHeader -like "Paste the full ESPN Cookie header here*") {
      $CookieHeader = ""
    }
  }

  $NewSwid = Get-CookieValue $CookieHeader "SWID"
  $NewEspnS2 = Get-CookieValue $CookieHeader "espn_s2"

  if ($NewSwid -and $NewEspnS2) {
    Write-Host "Found SWID and espn_s2 in espn-cookie.txt."
  }

  Write-Host "ESPN cookies are needed for private leagues." -ForegroundColor Yellow

  if (-not $NewSwid -or -not $NewEspnS2) {
    if ($CookieHeader) {
      Write-Host "Could not find both SWID and espn_s2 in that Cookie header. Asking separately now." -ForegroundColor Yellow
    } else {
      Write-Host "Best option: paste the full Cookie header from an ESPN Fantasy request into espn-cookie.txt."
      Write-Host "It should include both SWID=... and espn_s2=..."
      Write-Host ""
      Write-Host "Easiest method:"
      Write-Host "  1. Open espn-cookie.txt in this folder."
      Write-Host "  2. Paste the full Cookie value into it."
      Write-Host "  3. Save the file."
      Write-Host "  4. Run this exporter again."
      Write-Host ""

      if (-not (Test-Path -LiteralPath $CookieFile)) {
        Set-Content -LiteralPath $CookieFile -Value "Paste the full ESPN Cookie header here, then save this file." -Encoding UTF8
      }
    }

    $NewSwid = Read-Host "Paste SWID"
    $SecureEspnS2 = Read-Host "Paste espn_s2" -AsSecureString
    $NewEspnS2 = ConvertFrom-SecureStringPlainText $SecureEspnS2
  }

  if ($NewSwid.StartsWith("SWID=")) {
    $NewSwid = $NewSwid.Substring(5)
  }

  if ($NewEspnS2.StartsWith("espn_s2=")) {
    $NewEspnS2 = $NewEspnS2.Substring(8)
  }

  if (-not $NewSwid -or -not $NewEspnS2) {
    throw "Both SWID and espn_s2 are required."
  }

  Save-EnvFile $Path $NewSwid $NewEspnS2
  Write-Host "Saved cookies locally in .env.local. Do not upload this file." -ForegroundColor Yellow
  if (Test-Path -LiteralPath $CookieFile) {
    Remove-Item -LiteralPath $CookieFile -Force
  }

  return @{
    Swid = $NewSwid
    EspnS2 = $NewEspnS2
  }
}

function Get-EspnHeaders($Swid, $EspnS2) {
  $Headers = @{
    "Accept" = "application/json"
    "User-Agent" = "Mozilla/5.0"
  }

if ($Swid -and $EspnS2) {
  $Headers["Cookie"] = "SWID=$Swid; espn_s2=$EspnS2"
}

  return $Headers
}

function Invoke-EspnDownload($Url, $Headers, $Season) {
  Write-Host "Downloading Moggate $Season JSON..."
  $NodeScript = Join-Path $ProjectRoot "scripts\export-espn-json.mjs"
  if (Test-Path -LiteralPath $NodeScript) {
    & $Node $NodeScript "--season=$Season" "--leagueId=$LeagueId" "--output=$OutputFile"
    if ($LASTEXITCODE -ne 0) {
      throw "Node ESPN download failed."
    }

    return @{
      StatusCode = 200
      Content = Get-Content -LiteralPath $OutputFile -Raw
    }
  }

  $Curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($Curl) {
    $TempFile = New-TemporaryFile
    $StatusFile = New-TemporaryFile
    try {
      $CookieHeader = $Headers["Cookie"]
      $CurlArgs = @(
        "--silent",
        "--show-error",
        "--location",
        "--noproxy", "*",
        "--ssl-no-revoke",
        "--output", $TempFile.FullName,
        "--write-out", "%{http_code}",
        "--header", "Accept: application/json",
        "--header", "User-Agent: Mozilla/5.0"
      )

      if ($CookieHeader) {
        $CurlArgs += @("--header", "Cookie: $CookieHeader")
      }

      $CurlArgs += $Url
      $StatusCodeText = & $Curl.Source @CurlArgs
      if ($LASTEXITCODE -ne 0) {
        throw "curl failed while downloading from ESPN."
      }

      $StatusCode = [int]$StatusCodeText
      return @{
        StatusCode = $StatusCode
        Content = Get-Content -LiteralPath $TempFile.FullName -Raw
      }
    }
    finally {
      Remove-Item -LiteralPath $TempFile.FullName -Force -ErrorAction SilentlyContinue
      Remove-Item -LiteralPath $StatusFile.FullName -Force -ErrorAction SilentlyContinue
    }
  }

  return Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = Find-Node
$EnvFile = Join-Path $ProjectRoot ".env.local"
if (-not $OutputFile) {
  $OutputFile = Join-Path $ProjectRoot "data\raw\moggate_$Season.json"
}

$CookieValues = $null
if ($ResetCookies -and (Test-Path -LiteralPath $EnvFile)) {
  Remove-Item -LiteralPath $EnvFile -Force
}

$EnvValues = Read-EnvFile $EnvFile
$Swid = $EnvValues["ESPN_SWID"]
$EspnS2 = $EnvValues["ESPN_S2"]

if (-not $Swid -or -not $EspnS2) {
  $CookieValues = Request-EspnCookies $EnvFile
  $Swid = $CookieValues.Swid
  $EspnS2 = $CookieValues.EspnS2
}

$Views = @(
  "mDraftDetail",
  "mSettings",
  "mTeam",
  "mRoster",
  "mMatchup",
  "mMatchupScore",
  "mSchedule",
  "mStandings",
  "mStatus",
  "kona_player_info"
)

$ViewQuery = ($Views | ForEach-Object { "view=$_" }) -join "&"
$Url = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/$Season/segments/0/leagues/$LeagueId`?$ViewQuery"
$Headers = Get-EspnHeaders $Swid $EspnS2
Write-Host "Using SWID length $($Swid.Length), espn_s2 length $($EspnS2.Length)."

try {
  $Response = Invoke-EspnDownload $Url $Headers $Season
}
catch {
  $StatusCode = $_.Exception.Response.StatusCode.value__
  if ($StatusCode -eq 401 -or $StatusCode -eq 403) {
    Write-Host ""
    Write-Host "ESPN rejected the saved cookies. They may be expired, incomplete, or copied from the wrong site." -ForegroundColor Yellow
    Write-Host "Please copy fresh SWID and espn_s2 values from fantasy.espn.com while you are signed in."
    Write-Host ""
    $CookieValues = Request-EspnCookies $EnvFile
    $Headers = Get-EspnHeaders $CookieValues.Swid $CookieValues.EspnS2
    Write-Host "Using SWID length $($CookieValues.Swid.Length), espn_s2 length $($CookieValues.EspnS2.Length)."
    $Response = Invoke-EspnDownload $Url $Headers $Season
  } else {
    throw
  }
}

if ($Response.StatusCode -lt 200 -or $Response.StatusCode -ge 300) {
  throw "ESPN request failed with status code $($Response.StatusCode)."
}

$Json = $Response.Content | ConvertFrom-Json
if ($Json.id -ne $LeagueId -or $Json.seasonId -ne $Season) {
  throw "The downloaded file did not match league $LeagueId season $Season."
}

$CleanJson = $Json | ConvertTo-Json -Depth 100
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputFile, $CleanJson, $Utf8NoBom)
Write-Host "Saved $OutputFile" -ForegroundColor Green
