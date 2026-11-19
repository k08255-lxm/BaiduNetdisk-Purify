# BaiduNetdisk de-marketing -- installer step (run by Setup.exe; also usable standalone)
# Patches the user's OWN official BaiduNetdisk installation in place. Fully reversible via uninstall.ps1.
# Exit codes: 0 ok | 10 BaiduNetdisk not found | 11 unsupported client version | 12 client could not be closed
#             13 patch/verify failed (nothing changed) | 14 access denied (run as administrator) | 1 other error
# Source is ASCII-only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
param(
  [string]$InstallPath,
  [string]$LogFile,
  [switch]$KeepComponentRegistration,
  [switch]$NoTask,
  [switch]$KeepComponents,   # do not move the non-netdisk components (components.json) out of the install
  [switch]$ShellExt          # also remove the Explorer integration (needs a UAC confirmation; skipped if declined)
)
# A child of PowerShell 7 inherits its PSModulePath, which breaks module autoloading in Windows PowerShell 5.1
# (cmdlets such as Get-FileHash / Register-ScheduledTask then appear to be missing). Reset to the 5.1 defaults.
if ($PSVersionTable.PSEdition -ne 'Core') { $env:PSModulePath = (Join-Path $env:SystemRoot 'system32\WindowsPowerShell\v1.0\Modules') + ';' + (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules') }
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = 'BaiduNetdisk-NoMarketing-NoticeHider'
$Utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not $LogFile) { $LogFile = Join-Path $here 'install.log' }
function Write-Log([string]$m) {
  $line = (Get-Date).ToString('s') + ' ' + $m
  Write-Host $line
  try { [System.IO.File]::AppendAllText($LogFile, $line + "`r`n", $Utf8) } catch {}
}
function Exit-With([int]$code, [string]$msg) { Write-Log ("EXIT {0}: {1}" -f $code, $msg); exit $code }
function Sha([string]$p) {
  $fs = [System.IO.File]::OpenRead($p); $h = [System.Security.Cryptography.SHA256]::Create()
  try { return ([System.BitConverter]::ToString($h.ComputeHash($fs)) -replace '-', '').ToLowerInvariant() } finally { $h.Dispose(); $fs.Dispose() }
}
# reg.exe may print to stderr; under PS 5.1 + ErrorActionPreference=Stop that becomes a terminating error.
function Invoke-Reg([string]$ArgLine) {
  $p = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\reg.exe') -ArgumentList $ArgLine -Wait -PassThru -WindowStyle Hidden
  return $p.ExitCode
}
$BaiduName = [string][char]0x767e + [char]0x5ea6 + [char]0x7f51 + [char]0x76d8   # display name of the client

# ---- component store: items are MOVED to <root>\nd_purify\removed\<rel> and recorded in removed.json ----
# (same record format as the dev tool stage_remove.ps1, so uninstall.ps1 restores everything regardless of who moved it)
function Expand-Records($x) {   # PS 5.1 ConvertFrom-Json emits a JSON array as ONE object; flatten
  foreach ($i in @($x)) {
    if ($null -eq $i) { continue }
    if ($i -is [System.Array]) { Expand-Records $i; continue }
    if ($i.PSObject.Properties.Name -contains 'rel') { $i; continue }
    if ($i.PSObject.Properties.Name -contains 'value') { Expand-Records $i.value }
  }
}
function Move-Components([string]$root, $rels, [string]$tag) {
  $store = Join-Path $root 'nd_purify\removed'; $db = Join-Path $store 'removed.json'
  [void][System.IO.Directory]::CreateDirectory($store)
  $list = @(); if (Test-Path -LiteralPath $db) { $list = @(Expand-Records ([System.IO.File]::ReadAllText($db, $Utf8) | ConvertFrom-Json)) }
  $n = 0; $bytes = [int64]0
  foreach ($rel in $rels) {
    $src = Join-Path $root $rel; $dst = Join-Path $store $rel
    if (-not (Test-Path -LiteralPath $src)) { continue }                      # absent or already moved
    if (Test-Path -LiteralPath $dst) { Write-Log "  WARN keep $rel (an older copy is already in the store)"; continue }
    try {
      $isDir = [System.IO.Directory]::Exists($src)
      $size = if ($isDir) { [int64](Get-ChildItem -LiteralPath $src -Recurse -File | Measure-Object Length -Sum).Sum } else { (Get-Item -LiteralPath $src).Length }
      [void][System.IO.Directory]::CreateDirectory((Split-Path $dst -Parent))
      if ($isDir) { [System.IO.Directory]::Move($src, $dst) } else { [System.IO.File]::Move($src, $dst) }
      $list += [pscustomobject]@{ stage = $tag; rel = $rel; bytes = $size }
      $n++; $bytes += $size
    } catch { Write-Log ("  WARN could not move {0}: {1}" -f $rel, $_.Exception.Message) }
  }
  [System.IO.File]::WriteAllText($db, (ConvertTo-Json -InputObject @($list) -Depth 4), $Utf8)
  return @($n, $bytes)
}

function Find-InstallPath {
  if ($InstallPath) { return $InstallPath.TrimEnd('\') }
  foreach ($k in 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*') {
    $p = Get-ItemProperty $k -ErrorAction SilentlyContinue |
         Where-Object { $_.DisplayName -eq $BaiduName -or $_.DisplayName -match '^BaiduNetdisk' } |
         Select-Object -First 1 -ExpandProperty InstallLocation
    if ($p -and (Test-Path -LiteralPath (Join-Path $p 'BaiduNetdisk.exe'))) { return $p.TrimEnd('\') }
  }
  # not registered (portable copy, broken uninstall entry ...): take the location of a running client
  $run = Get-CimInstance Win32_Process -Filter "Name='BaiduNetdisk.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath } | Select-Object -First 1
  if ($run) { return (Split-Path -Parent $run.ExecutablePath) }
  $d = Join-Path $env:APPDATA 'baidu\BaiduNetdisk'
  if (Test-Path -LiteralPath (Join-Path $d 'BaiduNetdisk.exe')) { return $d }
  return $null
}

$stage = 'init'; $replaced = $false; $core = $null; $origBackup = $null
try {
  Write-Log '=== BaiduNetdisk de-marketing: install ==='
  $root = Find-InstallPath
  if (-not $root) { Exit-With 10 'BaiduNetdisk installation not found' }
  $core = Join-Path $root 'module\BrowserEngine\resources\core.asar'
  if (-not (Test-Path -LiteralPath $core)) { Exit-With 10 "core.asar not found under $root" }
  Write-Log "install path: $root"

  $set = [System.IO.File]::ReadAllText((Join-Path $here 'patchset.json'), (New-Object System.Text.UTF8Encoding($false))) | ConvertFrom-Json
  $wantOrig = [string]$set.target.originalCoreSha256
  $wantOut  = [string]$set.expectedOutputSha256
  $purifyDir = Join-Path $root 'nd_purify'
  $backupDir = Join-Path $purifyDir 'backup'
  $manifest  = Join-Path $backupDir 'manifest.json'
  $origBackup = Join-Path $backupDir 'core.asar.orig'
  $cur = Sha $core

  # ---- decide source of the ORIGINAL core.asar ----
  $man = $null
  if (Test-Path -LiteralPath $manifest) {
    $man = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
    if (-not (Test-Path -LiteralPath $origBackup) -or (Sha $origBackup) -ne $wantOrig) {
      Exit-With 11 'existing backup is not the supported original version'
    }
    if ($cur -ne $wantOrig -and $cur -ne [string]$man.corePatched -and $cur -ne $wantOut) {
      Exit-With 11 "installed core.asar ($cur) is neither original nor a known patched build (client updated?)"
    }
    $source = $origBackup; $mode = 'upgrade'
  } else {
    if ($cur -ne $wantOrig) { Exit-With 11 "unsupported client version: core.asar $cur (supported: $($set.target.appVersion))" }
    $source = $core; $mode = 'fresh'
  }
  Write-Log "mode: $mode"

  # ---- close the client ----
  $stage = 'close'
  $names = 'BaiduNetdisk','BaiduNetdiskUnite','baidunetdiskhost','crashpad_handler','YunUtilityService','Autoupdate'
  for ($i = 0; $i -lt 10; $i++) {
    $run = Get-Process -Name $names -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.ToLower().StartsWith($root.ToLower()) }
    if (-not $run) { break }
    if ($i -eq 0) { Write-Log 'closing running client...' }
    $run | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700
  }
  if (Get-Process -Name $names -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.ToLower().StartsWith($root.ToLower()) }) {
    Exit-With 12 'could not close the running client'
  }

  # ---- build patched core.asar next to the original (nothing is replaced yet) ----
  $stage = 'patch'
  $tmpOut = $core + '.nd-new'
  if (Test-Path -LiteralPath $tmpOut) { Remove-Item -LiteralPath $tmpOut -Force }
  & (Join-Path $here 'nd_patcher.ps1') -CoreAsar $source -OutAsar $tmpOut -PatchDir $here 6>&1 | ForEach-Object { Write-Log "  patcher: $_" }
  if (-not (Test-Path -LiteralPath $tmpOut) -or (Sha $tmpOut) -ne $wantOut) { Exit-With 13 'patched output missing or hash mismatch' }

  # ---- backup + replace ----
  $stage = 'replace'
  New-Item -ItemType Directory -Force $backupDir | Out-Null
  if ($mode -eq 'fresh') {
    Copy-Item -LiteralPath $core -Destination $origBackup -Force
    if ((Sha $origBackup) -ne $wantOrig) { Exit-With 13 'backup verification failed' }
    $conf0 = Join-Path $root 'AutoUpdate\config.ini'
    if (Test-Path -LiteralPath $conf0) { Copy-Item -LiteralPath $conf0 -Destination (Join-Path $backupDir 'config.ini.orig') -Force }
    $man = [pscustomobject]@{ installPath = $root; appVersion = [string]$set.target.appVersion; coreOriginal = $wantOrig; corePatched = '';
                              renamedUpdater = $false; updaterConfigPatched = $false; taskName = $TaskName; registryBackedUp = $false;
                              registeredAppValues = [pscustomobject]@{}; installedBy = 'setup' }
  }
  foreach ($p in 'registryBackedUp', 'registeredAppValues', 'renamedUpdater', 'updaterConfigPatched') {
    if (-not ($man.PSObject.Properties.Name -contains $p)) {
      $v = $false; if ($p -eq 'registeredAppValues') { $v = [pscustomobject]@{} }
      $man | Add-Member -NotePropertyName $p -NotePropertyValue $v
    }
  }
  if ($null -eq $man.registeredAppValues) { $man.registeredAppValues = [pscustomobject]@{} }
  Copy-Item -LiteralPath $tmpOut -Destination $core -Force
  $replaced = $true
  Remove-Item -LiteralPath $tmpOut -Force
  if ((Sha $core) -ne $wantOut) { throw 'post-install verification failed' }
  $man.corePatched = $wantOut
  Write-Log 'core.asar: patched'

  # ---- disable auto-update (so the patch is not silently overwritten) ----
  $stage = 'updater'
  $conf = Join-Path $root 'AutoUpdate\config.ini'
  if (Test-Path -LiteralPath $conf) {
    $txt = [System.IO.File]::ReadAllText($conf)
    $new = [regex]::Replace($txt, '(?m)^(IsAutoUpdate\s*=\s*)1\s*$', '${1}0')
    if ($new -ne $txt) { [System.IO.File]::WriteAllText($conf, $new); $man.updaterConfigPatched = $true }
  }
  $upd = Join-Path $root 'AutoUpdate\Autoupdate.exe'; $updOff = $upd + '.nd-disabled'
  if ((Test-Path -LiteralPath $upd) -and -not (Test-Path -LiteralPath $updOff)) { Rename-Item -LiteralPath $upd -NewName (Split-Path $updOff -Leaf); $man.renamedUpdater = $true }
  Write-Log 'auto-update: disabled'

  # ---- unregister external components (smart image viewer / player) from "Open with" (HKCU, backed up) ----
  $stage = 'registry'
  if (-not $KeepComponentRegistration) {
    $regDir = Join-Path $backupDir 'registry'; New-Item -ItemType Directory -Force $regDir | Out-Null
    $ra = 'HKCU:\Software\RegisteredApplications'
    foreach ($v in 'BaiduNetdiskImageViewer', 'BaiduNetdiskPlayer') {
      $val = (Get-ItemProperty $ra -Name $v -ErrorAction SilentlyContinue).$v
      if ($val) {
        if (-not ($man.registeredAppValues.PSObject.Properties.Name -contains $v)) { $man.registeredAppValues | Add-Member -NotePropertyName $v -NotePropertyValue $val -Force }
        Remove-ItemProperty $ra -Name $v -ErrorAction SilentlyContinue
      }
    }
    $n = 0
    foreach ($k in 'HKCU\Software\Baidu\BaiduNetdiskImageViewer', 'HKCU\Software\Baidu\BaiduNetdiskPlayer',
                   'HKCU\Software\Classes\BaiduNetdiskImageViewerAssociations', 'HKCU\Software\Classes\BaiduNetdiskPlayerAssociations',
                   'HKCU\Software\Classes\Applications\BaiduNetdiskPlayer.open') {
      if (Test-Path ('Registry::' + $k)) {
        $file = Join-Path $regDir (($k -replace '[\\ ]', '_') + '.reg')
        if (-not (Test-Path -LiteralPath $file)) {
          $rc = Invoke-Reg ('export "' + $k + '" "' + $file + '" /y')
          if ($rc -ne 0 -or -not (Test-Path -LiteralPath $file)) { throw "registry backup failed for $k" }
        }
        Remove-Item ('Registry::' + $k) -Recurse -Force; $n++
      }
    }
    $man.registryBackedUp = $true
    Write-Log "components: $n registry keys unregistered (backed up)"
  }

  # ---- slim: move the non-netdisk components out of the install (image viewer, players, AI, sync engine, office add-in ...) ----
  $stage = 'components'
  $comp = [System.IO.File]::ReadAllText((Join-Path $here 'components.json'), $Utf8) | ConvertFrom-Json
  if (-not $KeepComponents) {
    $r = Move-Components $root @($comp.components) 'setup'
    Write-Log ("components: moved {0} items ({1:N0} MB) to nd_purify\removed" -f $r[0], ($r[1] / 1MB))
  } else { Write-Log 'components: kept (-KeepComponents)' }

  # ---- optional: Explorer integration (context menu, overlay icons, Win11 sparse package). HKLM -> needs UAC ----
  $stage = 'shellext'
  if ($ShellExt) {
    New-Item -ItemType Directory -Force $purifyDir | Out-Null
    $sx = Join-Path $purifyDir 'shellext.ps1'
    Copy-Item -LiteralPath (Join-Path $here 'shellext.ps1') -Destination $sx -Force
    $psexe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $rc = -1
    try {
      Write-Log 'shell integration: asking for elevation (UAC)...'
      $p = Start-Process -FilePath $psexe -Verb RunAs -WindowStyle Hidden -Wait -PassThru `
             -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -Remove -Root "{1}" -LogFile "{2}"' -f $sx, $root, (Join-Path $purifyDir 'shellext.log'))
      $rc = $p.ExitCode
    } catch { Write-Log ('shell integration: elevation declined or failed: ' + $_.Exception.Message) }
    if ($rc -eq 0) {
      # only now that nothing references them any more are the DLLs moved away (a loaded DLL can still be renamed)
      $r = Move-Components $root @($comp.shellFiles) 'setup-shell'
      Write-Log ("shell integration: removed (registry backed up in nd_purify\removed\shellext; {0} files moved). Takes full effect after Explorer restarts / next sign-in." -f $r[0])
    } else { Write-Log "shell integration: kept (rc=$rc)" }
  }

  # ---- tamper-notice hider: logon task + start now ----
  $stage = 'watcher'
  New-Item -ItemType Directory -Force $purifyDir | Out-Null
  $watcher = Join-Path $purifyDir 'nd_hide_notice.ps1'
  Copy-Item -LiteralPath (Join-Path $here 'nd_hide_notice.ps1') -Destination $watcher -Force
  if (-not $NoTask) {
    $psexe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $arg = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $watcher + '"'   # watcher finds the client at run time
    $exe = $psexe
    # Windows 11 hands every new console to Windows Terminal (default terminal), which ignores -WindowStyle Hidden:
    # the user would get an empty PowerShell window at each logon, and closing it kills the watcher (0xC000013A).
    # conhost --headless (Windows 10 1809+) runs the console with no window and no hand-off.
    $conhost = Join-Path $env:WINDIR 'System32\conhost.exe'
    if ([Environment]::OSVersion.Version.Build -ge 17763 -and (Test-Path -LiteralPath $conhost)) { $exe = $conhost; $arg = '--headless "' + $psexe + '" ' + $arg }
    $act = New-ScheduledTaskAction -Execute $exe -Argument $arg
    $trg = New-ScheduledTaskTrigger -AtLogOn -User ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME)
    $cfg = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
             -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $TaskName -Action $act -Trigger $trg -Settings $cfg -Description 'Hides the BaiduNetdisk tamper-check dialog so the de-marketed core.asar runs.' -Force | Out-Null
    # restart the watcher so the (possibly updated) script runs, always through the task (same path as at logon)
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'nd_hide_notice' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
    Start-ScheduledTask -TaskName $TaskName
    Write-Log ("watcher: logon task '$TaskName' registered and started ({0})" -f $(if ($exe -eq $psexe) { 'powershell' } else { 'conhost --headless' }))
  }

  $man | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifest -Encoding UTF8
  Write-Log 'DONE'
  exit 0
} catch {
  $msg = $_.Exception.Message
  Write-Log "ERROR at stage '$stage': $msg"
  if ($replaced -and $core -and $origBackup -and (Test-Path -LiteralPath $origBackup)) {
    try { Copy-Item -LiteralPath $origBackup -Destination $core -Force; Write-Log 'rolled back core.asar to original' } catch {}
  }
  if ($core -and (Test-Path -LiteralPath ($core + '.nd-new'))) { Remove-Item -LiteralPath ($core + '.nd-new') -Force -ErrorAction SilentlyContinue }
  if ($_.Exception -is [System.UnauthorizedAccessException] -or $msg -match 'denied|UnauthorizedAccess') { exit 14 }
  if ($stage -eq 'patch') { exit 13 }
  exit 1
}
