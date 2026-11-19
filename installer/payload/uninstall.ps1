# BaiduNetdisk de-marketing -- uninstall step (run by the uninstaller; also usable standalone)
# Restores the original core.asar, AutoUpdate settings and component registrations; removes the
# logon task and the notice hider. Exits 0 when there is nothing to restore.
# Source is ASCII-only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
param(
  [string]$InstallPath,
  [string]$LogFile,
  [switch]$NoTask   # Match install.ps1 -NoTask for a standalone test install.
)
# A child of PowerShell 7 inherits its PSModulePath, which breaks module autoloading in Windows PowerShell 5.1
# (cmdlets such as Get-FileHash / Register-ScheduledTask then appear to be missing). Reset to the 5.1 defaults.
if ($PSVersionTable.PSEdition -ne 'Core') { $env:PSModulePath = (Join-Path $env:SystemRoot 'system32\WindowsPowerShell\v1.0\Modules') + ';' + (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules') }
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = 'BaiduNetdisk-NoMarketing-NoticeHider'
$Utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not $LogFile) { $LogFile = Join-Path $env:TEMP 'BaiduNetdiskPurify-uninstall.log' }
function Write-Log([string]$m) {
  $line = (Get-Date).ToString('s') + ' ' + $m
  Write-Host $line
  try { [System.IO.File]::AppendAllText($LogFile, $line + "`r`n", $Utf8) } catch {}
}
function Sha([string]$p) {
  $fs = [System.IO.File]::OpenRead($p); $h = [System.Security.Cryptography.SHA256]::Create()
  try { return ([System.BitConverter]::ToString($h.ComputeHash($fs)) -replace '-', '').ToLowerInvariant() } finally { $h.Dispose(); $fs.Dispose() }
}
# reg.exe prints its success message to stderr; under PS 5.1 + ErrorActionPreference=Stop that would be
# treated as a terminating error. Run it out-of-process and judge by exit code only.
function Invoke-Reg([string]$ArgLine) {
  $p = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\reg.exe') -ArgumentList $ArgLine -Wait -PassThru -WindowStyle Hidden
  return $p.ExitCode
}
$BaiduName = [string][char]0x767e + [char]0x5ea6 + [char]0x7f51 + [char]0x76d8
function Expand-Records($x) {   # PS 5.1 ConvertFrom-Json emits a JSON array as ONE object; flatten
  foreach ($i in @($x)) {
    if ($null -eq $i) { continue }
    if ($i -is [System.Array]) { Expand-Records $i; continue }
    if ($i.PSObject.Properties.Name -contains 'rel') { $i; continue }
    if ($i.PSObject.Properties.Name -contains 'value') { Expand-Records $i.value }
  }
}

function Find-InstallPath {
  if ($InstallPath) { return $InstallPath.TrimEnd('\') }
  foreach ($k in 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*') {
    $p = Get-ItemProperty $k -ErrorAction SilentlyContinue |
         Where-Object { $_.DisplayName -eq $BaiduName -or $_.DisplayName -match '^BaiduNetdisk' } |
         Select-Object -First 1 -ExpandProperty InstallLocation
    if ($p -and (Test-Path -LiteralPath $p)) { return $p.TrimEnd('\') }
  }
  $run = Get-CimInstance Win32_Process -Filter "Name='BaiduNetdisk.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath } | Select-Object -First 1
  if ($run) { return (Split-Path -Parent $run.ExecutablePath) }
  $d = Join-Path $env:APPDATA 'baidu\BaiduNetdisk'
  if (Test-Path -LiteralPath $d) { return $d }
  return $null
}

try {
  Write-Log '=== BaiduNetdisk de-marketing: uninstall ==='
  if (-not $NoTask) {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match 'nd_hide_notice' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Log 'watcher + logon task removed'
  }

  $root = Find-InstallPath
  if (-not $root) { Write-Log 'BaiduNetdisk not found; nothing else to restore'; exit 0 }
  $core = Join-Path $root 'module\BrowserEngine\resources\core.asar'
  $backupDir = Join-Path $root 'nd_purify\backup'
  $manifest = Join-Path $backupDir 'manifest.json'
  if (-not (Test-Path -LiteralPath $manifest)) { Write-Log 'no active patch manifest; nothing to restore'; exit 0 }
  $man = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json

  $run = Get-Process -Name 'BaiduNetdisk','BaiduNetdiskUnite','baidunetdiskhost','crashpad_handler' -ErrorAction SilentlyContinue |
         Where-Object { $_.Path -and $_.Path.ToLower().StartsWith($root.ToLower()) }
  if ($run) { Write-Log 'closing running client...'; $run | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep 2 }

  $orig = Join-Path $backupDir 'core.asar.orig'
  if (Test-Path -LiteralPath $orig) {
    if ((Sha $orig) -ne [string]$man.coreOriginal) { throw 'backup core.asar hash mismatch; refusing to restore automatically' }
    if (Test-Path -LiteralPath $core) {
      $cur = Sha $core
      if ($cur -ne [string]$man.corePatched -and $cur -ne [string]$man.coreOriginal) {
        Write-Log "core.asar was changed by something else ($cur); leaving it untouched"
      } else { Copy-Item -LiteralPath $orig -Destination $core -Force; Write-Log 'core.asar restored to original' }
    }
  }

  if ($man.updaterConfigPatched) {
    $cb = Join-Path $backupDir 'config.ini.orig'
    if (Test-Path -LiteralPath $cb) { Copy-Item -LiteralPath $cb -Destination (Join-Path $root 'AutoUpdate\config.ini') -Force }
  }
  if ($man.renamedUpdater) {
    $upd = Join-Path $root 'AutoUpdate\Autoupdate.exe'; $off = $upd + '.nd-disabled'
    if ((Test-Path -LiteralPath $off) -and -not (Test-Path -LiteralPath $upd)) { Rename-Item -LiteralPath $off -NewName 'Autoupdate.exe' }
  }
  Write-Log 'auto-update: re-enabled'

  $regDir = Join-Path $backupDir 'registry'
  if (Test-Path -LiteralPath $regDir) {
    Get-ChildItem -LiteralPath $regDir -Filter *.reg | ForEach-Object {
      $rc = Invoke-Reg ('import "' + $_.FullName + '"')
      if ($rc -ne 0) { Write-Log ("reg import failed ({0}): {1}" -f $rc, $_.Name) }
    }
    if ($man.registeredAppValues) {
      $man.registeredAppValues.PSObject.Properties | ForEach-Object {
        New-ItemProperty 'HKCU:\Software\RegisteredApplications' -Name $_.Name -Value $_.Value -PropertyType String -Force | Out-Null
      }
    }
    Write-Log 'component registrations restored'
  }

  # ---- moved components: put every recorded item back (files first: the shell restore needs sysres\*.msix) ----
  $store = Join-Path $root 'nd_purify\removed'; $db = Join-Path $store 'removed.json'
  if (Test-Path -LiteralPath $db) {
    $recs = @(Expand-Records ([System.IO.File]::ReadAllText($db, $Utf8) | ConvertFrom-Json))
    $left = @(); $n = 0
    foreach ($e in $recs) {
      $src = Join-Path $root $e.rel; $dst = Join-Path $store $e.rel
      if (-not (Test-Path -LiteralPath $dst)) { continue }                      # nothing to put back
      if (Test-Path -LiteralPath $src) { Write-Log "  keep store copy of $($e.rel) (the client has its own copy again)"; $left += $e; continue }
      try {
        [void][System.IO.Directory]::CreateDirectory((Split-Path $src -Parent))
        if ([System.IO.Directory]::Exists($dst)) { [System.IO.Directory]::Move($dst, $src) } else { [System.IO.File]::Move($dst, $src) }
        $n++
      } catch { Write-Log ("  WARN could not restore {0}: {1}" -f $e.rel, $_.Exception.Message); $left += $e }
    }
    [System.IO.File]::WriteAllText($db, (ConvertTo-Json -InputObject @($left) -Depth 4), $Utf8)
    Write-Log ("components: {0} items restored, {1} left in store" -f $n, $left.Count)
  }

  # ---- Explorer integration (only if it was removed): elevated restore from the recorded backup ----
  $sxState = Join-Path $store 'shellext\state.json'
  if (Test-Path -LiteralPath $sxState) {
    $sx = Join-Path $root 'nd_purify\shellext.ps1'
    if (-not (Test-Path -LiteralPath $sx)) { $sx = Join-Path $here 'shellext.ps1' }
    $psexe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $rc = -1
    try {
      Write-Log 'shell integration: asking for elevation (UAC) to restore...'
      $p = Start-Process -FilePath $psexe -Verb RunAs -WindowStyle Hidden -Wait -PassThru `
             -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -Restore -Root "{1}" -LogFile "{2}"' -f $sx, $root, (Join-Path $root 'nd_purify\shellext.log'))
      $rc = $p.ExitCode
    } catch { Write-Log ('shell integration: elevation declined or failed: ' + $_.Exception.Message) }
    if ($rc -eq 0) { Write-Log 'shell integration: restored' }
    else { Write-Log ("shell integration: NOT restored (rc={0}). Later, run as administrator: powershell -ExecutionPolicy Bypass -File `"{1}`" -Restore" -f $rc, $sx) }
  }

  # timestamped: a previous install/uninstall cycle may already have left a manifest.restored*.json
  Rename-Item -LiteralPath $manifest -NewName ('manifest.restored-{0}.json' -f (Get-Date -Format 'yyyyMMddHHmmss'))
  Remove-Item -LiteralPath (Join-Path $root 'nd_purify\nd_hide_notice.ps1') -Force -ErrorAction SilentlyContinue
  Write-Log 'DONE (backups kept in nd_purify\backup)'
  exit 0
} catch {
  Write-Log ("ERROR: " + $_.Exception.Message)
  exit 1
}
