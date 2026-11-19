# Build the patch scheme for ONE Baidu Netdisk build:  schemes\<Name>\{patchset.json, components.json, files\*}
# Matching is done by the SHA-256 of the original core.asar only; <Name> is just a human-readable folder label.
# The expected output hash is measured by running the real PowerShell patcher (Windows PowerShell 5.1, like on users' PCs).
# Usage: powershell -File scripts\make_scheme.ps1 -Name 8.9.7.101 -CoreAsar <original core.asar> -Components <components.json> [-Def scripts\patchset_def.js]
# Afterwards run scripts\sign_schemes.ps1 to rebuild and sign schemes\index.json.   (ASCII-only source)
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [Parameter(Mandatory = $true)][string]$CoreAsar,
  [Parameter(Mandatory = $true)][string]$Components,
  [string]$Def = 'scripts\patchset_def.js'
)
if ($PSVersionTable.PSEdition -ne 'Core') { $env:PSModulePath = (Join-Path $env:SystemRoot 'system32\WindowsPowerShell\v1.0\Modules') + ';' + (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules') }
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
function Sha([string]$p) { $fs = [IO.File]::OpenRead($p); $h = [Security.Cryptography.SHA256]::Create(); try { ([BitConverter]::ToString($h.ComputeHash($fs)) -replace '-', '').ToLowerInvariant() } finally { $h.Dispose(); $fs.Dispose() } }

$CoreAsar = (Resolve-Path -LiteralPath $CoreAsar).Path
$dir = Join-Path $repo ('schemes\' + $Name)
if (Test-Path -LiteralPath $dir) { [IO.Directory]::Delete($dir, $true) }
[void][IO.Directory]::CreateDirectory((Join-Path $dir 'files'))
$orig = Sha $CoreAsar
Write-Output "scheme $Name  original core.asar $orig"

& node scripts\gen_patchset.js (Join-Path $dir 'patchset.json') $orig '-' $Def $Name   # '-': PS 5.1 drops '' arguments
if ($LASTEXITCODE) { throw 'gen_patchset failed' }
$set = [IO.File]::ReadAllText((Join-Path $dir 'patchset.json')) | ConvertFrom-Json
foreach ($nf in $set.newFiles) { Copy-Item -LiteralPath (Join-Path $repo ('patch\' + $nf)) -Destination (Join-Path $dir ('files\' + $nf)) }
Copy-Item -LiteralPath $Components -Destination (Join-Path $dir 'components.json')

$tmp = Join-Path $env:TEMP ('nd_scheme_' + [guid]::NewGuid().ToString('N') + '.asar')
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
& $ps -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'installer\payload\nd_patcher.ps1') -CoreAsar $CoreAsar -OutAsar $tmp -PatchDir $dir
if ($LASTEXITCODE -or -not (Test-Path -LiteralPath $tmp)) { throw 'nd_patcher failed: the patch definition does not apply to this core.asar' }
$out = Sha $tmp; [IO.File]::Delete($tmp)

& node scripts\gen_patchset.js (Join-Path $dir 'patchset.json') $orig $out $Def $Name
if ($LASTEXITCODE) { throw 'gen_patchset failed' }
Write-Output "scheme $Name  patched output $out"
Write-Output 'next: powershell -File scripts\sign_schemes.ps1'
