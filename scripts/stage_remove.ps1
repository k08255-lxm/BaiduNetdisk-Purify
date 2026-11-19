# Move (never delete) BaiduNetdisk components into <root>\nd_purify\removed\<relpath>, or restore them.
# Records every move in removed\removed.json so any stage can be rolled back.
# Usage: stage_remove.ps1 -Stage A -Items 'module\ImageViewer;module\AiEngine'      (remove)
#        stage_remove.ps1 -Restore -Stage A                                          (restore one stage)
#        stage_remove.ps1 -Check                                                     (did anything come back?)
param(
  [string]$Stage,
  [string]$Items,
  [switch]$Restore,
  [switch]$Check
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:APPDATA 'baidu\BaiduNetdisk'
$store = Join-Path $root 'nd_purify\removed'
$db = Join-Path $store 'removed.json'
[void][IO.Directory]::CreateDirectory($store)
# PS 5.1: ConvertFrom-Json emits a JSON array as ONE pipeline object, so @(...) would nest it; and an
# earlier buggy save produced {"value":[...],"Count":n} wrappers. Flatten both shapes into plain records.
function Expand-Records($x) {
  foreach ($i in @($x)) {
    if ($null -eq $i) { continue }
    if ($i -is [System.Array]) { Expand-Records $i; continue }
    if ($i.PSObject.Properties.Name -contains 'rel') { $i; continue }
    if ($i.PSObject.Properties.Name -contains 'value') { Expand-Records $i.value }
  }
}
$list = @()
if (Test-Path $db) { $list = @(Expand-Records (Get-Content $db -Raw | ConvertFrom-Json)) }
function Save { ConvertTo-Json -InputObject @($script:list) -Depth 4 | Set-Content -LiteralPath $db -Encoding UTF8 }
function Stop-Client {
  Get-Process -Name 'BaiduNetdisk', 'BaiduNetdiskUnite', 'baidunetdiskhost', 'crashpad_handler', 'BaiduNetdiskImageViewer' -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
function Move-Path([string]$from, [string]$to) {
  [void][IO.Directory]::CreateDirectory((Split-Path $to -Parent))
  if ([IO.Directory]::Exists($from)) { [IO.Directory]::Move($from, $to) } else { [IO.File]::Move($from, $to) }
}

if ($Check) {
  foreach ($e in $list) {
    $src = Join-Path $root $e.rel
    $back = (Test-Path -LiteralPath $src)
    "{0,-3} {1,-60} reappeared={2}" -f $e.stage, $e.rel, $back
  }
  return
}

if ($Restore) {
  Stop-Client
  $keep = @()
  foreach ($e in $list) {
    if ($e.stage -ne $Stage) { $keep += $e; continue }
    $src = Join-Path $root $e.rel; $dst = Join-Path $store $e.rel
    if (Test-Path -LiteralPath $src) { "skip (already present): $($e.rel)"; continue }
    Move-Path $dst $src; "restored: $($e.rel)"
  }
  $script:list = $keep; Save
  return
}

if (-not $Stage -or -not $Items) { throw 'need -Stage and -Items' }
Stop-Client
foreach ($rel in ($Items -split ';' | Where-Object { $_.Trim() })) {
  $rel = $rel.Trim()
  $src = Join-Path $root $rel; $dst = Join-Path $store $rel
  if (-not (Test-Path -LiteralPath $src)) { "missing (skip): $rel"; continue }
  if (Test-Path -LiteralPath $dst) { throw "backup target already exists: $dst" }
  $size = 0
  if ([IO.Directory]::Exists($src)) { $size = (Get-ChildItem -LiteralPath $src -Recurse -File | Measure-Object Length -Sum).Sum } else { $size = (Get-Item -LiteralPath $src).Length }
  Move-Path $src $dst
  $script:list += [pscustomobject]@{ stage = $Stage; rel = $rel; bytes = [int64]$size }
  "removed: {0,-60} {1,8:N1} MB" -f $rel, ($size / 1MB)
}
Save
"stage $Stage total: {0:N1} MB; all stages: {1:N1} MB" -f ((@($script:list | Where-Object { $_.stage -eq $Stage }) | Measure-Object bytes -Sum).Sum / 1MB), ((@($script:list) | Measure-Object bytes -Sum).Sum / 1MB)
