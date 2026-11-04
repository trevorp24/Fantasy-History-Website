$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'copy-website-files.ps1')

function Assert-Equal($Actual, $Expected, $Label) {
  if ($Actual -ne $Expected) { throw "$Label - expected '$Expected', got '$Actual'" }
}

$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('chudgate-copy-' + [guid]::NewGuid().ToString('N'))
$SourceFolder = Join-Path $TestRoot 'source'
$DestinationFolder = Join-Path $TestRoot 'docs'
$Mapping = $null
$View = $null
$Stream = $null
$LockedStream = $null

try {
  [System.IO.Directory]::CreateDirectory((Join-Path $SourceFolder 'nested')) | Out-Null
  [System.IO.Directory]::CreateDirectory($DestinationFolder) | Out-Null
  $SourceFile = Join-Path $SourceFolder 'index.html'
  $DestinationFile = Join-Path $DestinationFolder 'index.html'
  [System.IO.File]::WriteAllText($SourceFile, 'new page')
  [System.IO.File]::WriteAllText($DestinationFile, 'old page')
  [System.IO.File]::WriteAllText((Join-Path $SourceFolder 'nested\page.html'), 'nested page')
  Copy-WebsiteFiles $SourceFolder $DestinationFolder
  Assert-Equal ([System.IO.File]::ReadAllText($DestinationFile)) 'new page' 'Existing file replaced'
  Assert-Equal ([System.IO.File]::ReadAllText((Join-Path $DestinationFolder 'nested\page.html'))) 'nested page' 'New nested file copied'
  Write-Output 'PASS: new, nested, and existing pages'

  [System.IO.File]::WriteAllText($DestinationFile, 'old page')
  $Share = [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
  $Stream = [System.IO.File]::Open($DestinationFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, $Share)
  $Mapping = [System.IO.MemoryMappedFiles.MemoryMappedFile]::CreateFromFile($Stream, ('chudgate-test-' + [guid]::NewGuid().ToString('N')), 0, [System.IO.MemoryMappedFiles.MemoryMappedFileAccess]::ReadWrite, [System.IO.HandleInheritability]::None, $true)
  $View = $Mapping.CreateViewAccessor()
  $OverwriteFailed = $false
  try { Copy-Item -LiteralPath $SourceFile -Destination $DestinationFile -Force -ErrorAction Stop } catch [System.IO.IOException] { $OverwriteFailed = $true }
  Assert-Equal $OverwriteFailed $true 'Reproduced mapped-file overwrite failure'
  Copy-WebsiteFiles $SourceFolder $DestinationFolder
  Assert-Equal ([System.IO.File]::ReadAllText($DestinationFile)) 'new page' 'Mapped destination replaced'
  Assert-Equal ($View.ReadByte(0)) ([byte][char]'o') 'Open mapping still reads original file'
  Write-Output 'PASS: reproduced Copy-Item error and replaced the mapped page'
  $View.Dispose(); $View = $null
  $Mapping.Dispose(); $Mapping = $null
  $Stream.Dispose(); $Stream = $null

  [System.IO.File]::WriteAllText($DestinationFile, 'keep page')
  $LockedStream = [System.IO.File]::Open($DestinationFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
  $FailureMessage = ''
  try { Copy-WebsiteFiles $SourceFolder $DestinationFolder -MaxAttempts 2 -RetryDelayMs 10 } catch { $FailureMessage = $_.Exception.Message }
  if (-not $FailureMessage.Contains($DestinationFile) -or -not $FailureMessage.Contains('after 2 attempts')) {
    throw "Expected a useful error naming the locked page: $FailureMessage"
  }
  $LockedStream.Dispose(); $LockedStream = $null
  Assert-Equal ([System.IO.File]::ReadAllText($DestinationFile)) 'keep page' 'Locked original preserved'
  Assert-Equal (@(Get-ChildItem -LiteralPath $DestinationFolder -Filter '*.tmp' -Recurse -Force).Count) 0 'Staging files cleaned up'
  Write-Output 'PASS: persistent lock retries, clear error, original preserved, staging cleaned'
} finally {
  foreach ($Handle in @($LockedStream, $View, $Mapping, $Stream)) {
    if ($null -ne $Handle) { $Handle.Dispose() }
  }
  if (Test-Path -LiteralPath $TestRoot) {
    Remove-Item -LiteralPath $TestRoot -Recurse -Force
  }
}
