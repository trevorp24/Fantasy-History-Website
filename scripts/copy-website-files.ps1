function Copy-WebsiteFiles {
  param(
    [Parameter(Mandatory = $true)][string]$SourceFolder,
    [Parameter(Mandatory = $true)][string]$DestinationFolder,
    [ValidateRange(1, 20)][int]$MaxAttempts = 5,
    [ValidateRange(0, 5000)][int]$RetryDelayMs = 500
  )

  $SourceRoot = (Get-Item -LiteralPath $SourceFolder -ErrorAction Stop).FullName.TrimEnd('\') + '\'
  $DestinationRoot = [System.IO.Path]::GetFullPath($DestinationFolder)
  [System.IO.Directory]::CreateDirectory($DestinationRoot) | Out-Null

  foreach ($Source in Get-ChildItem -LiteralPath $SourceRoot -File -Recurse -Force) {
    $RelativePath = $Source.FullName.Substring($SourceRoot.Length)
    $Destination = Join-Path $DestinationRoot $RelativePath
    $ParentFolder = [System.IO.Path]::GetDirectoryName($Destination)
    [System.IO.Directory]::CreateDirectory($ParentFolder) | Out-Null
    $StagedFile = Join-Path $ParentFolder ('.' + $Source.Name + '.' + [guid]::NewGuid().ToString('N') + '.tmp')

    try {
      [System.IO.File]::Copy($Source.FullName, $StagedFile)
      for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
        try {
          # Replacing the directory entry avoids truncating a file that is memory-mapped.
          if ([System.IO.File]::Exists($Destination)) {
            [System.IO.File]::Replace($StagedFile, $Destination, [System.Management.Automation.Language.NullString]::Value)
          } else {
            [System.IO.File]::Move($StagedFile, $Destination)
          }
          break
        } catch [System.IO.IOException], [System.UnauthorizedAccessException] {
          if ($Attempt -eq $MaxAttempts) {
            throw "Could not replace website file '$Destination' after $MaxAttempts attempts. Close any app holding this file open and retry the update. Windows reported: $($_.Exception.Message)"
          }
          Start-Sleep -Milliseconds $RetryDelayMs
        }
      }
    } finally {
      if ([System.IO.File]::Exists($StagedFile)) {
        [System.IO.File]::Delete($StagedFile)
      }
    }
  }
}
