# Parse-check PowerShell scripts with the real parser (no execution). Exit 1 if any file has errors.
param([Parameter(Mandatory = $true)][string[]]$Paths)
$bad = 0
foreach ($p in $Paths) {
  $tokens = $null; $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path -LiteralPath $p).Path, [ref]$tokens, [ref]$errors)
  if ($errors -and $errors.Count) {
    $bad++
    Write-Output ("PARSE ERRORS in {0}: {1}" -f $p, $errors.Count)
    $errors | Select-Object -First 5 | ForEach-Object { Write-Output ("  line {0}: {1}" -f $_.Extent.StartLineNumber, $_.Message) }
  } else {
    Write-Output ("parse ok  {0}  ({1} tokens)" -f (Split-Path $p -Leaf), $tokens.Count)
  }
}
Write-Output ("PowerShell {0}" -f $PSVersionTable.PSVersion)
if ($bad) { exit 1 } else { exit 0 }
