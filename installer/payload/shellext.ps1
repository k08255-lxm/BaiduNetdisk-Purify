# Remove (or restore) the Baidu Netdisk Explorer integration:
#   - shell-extension COM registrations (YunShellExt*/YunShellCommand64: overlay icons, context menu, "This PC" drive)
#   - every Explorer reference to them (shellex handlers, overlay identifiers, NameSpace entries, Approved list ...)
#   - the Windows 11 sparse package BaiduNetdisk.DesktopSyncClient (new-style context menu)
# Every deleted key is exported to a .reg file and every deleted value / package is recorded in state.json,
# so -Restore puts back exactly what was removed. npYunWebDetect (browser download hand-off) is NOT touched.
# HKLM changes need elevation. Explorer keeps already-loaded DLLs until it restarts / the user signs in again.
# Usage: shellext.ps1 -Check | -Remove | -Restore   [-Root <BaiduNetdisk dir>] [-LogFile <path>]
# Exit codes: 0 ok, 5 not elevated, 1 error.   (ASCII-only source: Windows PowerShell 5.1 reads BOM-less files as ANSI)
param([switch]$Check, [switch]$Remove, [switch]$Restore, [string]$Root, [string]$LogFile)
if ($PSVersionTable.PSEdition -ne 'Core') { $env:PSModulePath = (Join-Path $env:SystemRoot 'system32\WindowsPowerShell\v1.0\Modules') + ';' + (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules') }
$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Join-Path $env:APPDATA 'baidu\BaiduNetdisk' }
$Store = Join-Path $Root 'nd_purify\removed\shellext'
$StateFile = Join-Path $Store 'state.json'
$Utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not $LogFile) { $LogFile = Join-Path $Store 'shellext.log' }
function Write-Log([string]$m) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $m
  Write-Output $line
  try { [void][IO.Directory]::CreateDirectory((Split-Path $LogFile -Parent)); [IO.File]::AppendAllText($LogFile, $line + "`r`n", $Utf8) } catch {}
}

# Baidu's own shell-extension CLSIDs (YunShellExtV164/V1/64.dll and sysres\YunShellCommand64.dll)
$CLSIDS = @(
  '{2433C980-3DAB-43CA-99EB-01D5771054D0}', '{2A6FE247-5DA3-4732-9626-77820518FD77}', '{6D85624F-305A-491D-8848-C1927AA0D790}',
  '{7FAAC51E-19C2-4E2D-B598-A8D32E45BA48}', '{AA931BEA-7353-4F4C-821F-6DC922AA3C77}', '{C568C78A-652C-425B-8E6B-FFA73043302D}',
  '{D8BE1E70-244A-46F0-BC5B-077D5F29EED8}', '{FF895810-293B-464A-93F2-82D11E07EEC8}', '{499C8928-90D7-411D-8DBD-E35B92529123}'
)
$Set = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($c in $CLSIDS) { [void]$Set.Add($c) }
$PKG = 'BaiduNetdisk.DesktopSyncClient'
$HKLM = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
$HKCU = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Registry64)
function Get-Base([string]$hive) { if ($hive -eq 'HKLM') { $HKLM } else { $HKCU } }
function Get-Default($k) { try { [string]$k.GetValue('') } catch { '' } }
function Is-Ours([string]$s) { $s = ([string]$s).Trim(); return ($s -and $Set.Contains($s)) }

function Invoke-Reg([string]$ArgLine) {
  $p = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\reg.exe') -ArgumentList $ArgLine -Wait -PassThru -WindowStyle Hidden
  return $p.ExitCode
}

# ---------- discovery: returns @{Kind='key'|'value'; Hive; Sub; Name} records ----------
function Find-Targets {
  $out = New-Object System.Collections.ArrayList
  $addKey = { param($hive, $sub) [void]$out.Add([pscustomobject]@{ Kind = 'key'; Hive = $hive; Sub = $sub; Name = '' }) }
  $addVal = { param($hive, $sub, $name) [void]$out.Add([pscustomobject]@{ Kind = 'value'; Hive = $hive; Sub = $sub; Name = $name }) }

  # 1) the COM registrations themselves (only if they really point into a Baidu install, or have no server at all)
  foreach ($loc in @(@('HKLM', 'SOFTWARE\Classes\CLSID'), @('HKLM', 'SOFTWARE\WOW6432Node\Classes\CLSID'), @('HKCU', 'Software\Classes\CLSID'),
                     @('HKCU', 'Software\Microsoft\Windows\CurrentVersion\Explorer\CLSID'))) {
    foreach ($c in $CLSIDS) {
      $sub = $loc[1] + '\' + $c
      $k = (Get-Base $loc[0]).OpenSubKey($sub)
      if (-not $k) { continue }
      $srv = ''
      foreach ($s in 'InprocServer32', 'LocalServer32') { $sk = $k.OpenSubKey($s); if ($sk) { $srv += (Get-Default $sk); $sk.Close() } }
      $k.Close()
      if (-not $srv -or $srv -match '(?i)baidu') { & $addKey $loc[0] $sub } else { Write-Log "skip (server not Baidu): $($loc[0])\$sub -> $srv" }
    }
  }

  # 2) shellex handlers under every Classes root (file types, Directory, Drive, Folder, *, SystemFileAssociations\*, ...)
  foreach ($loc in @(@('HKLM', 'SOFTWARE\Classes'), @('HKLM', 'SOFTWARE\WOW6432Node\Classes'), @('HKCU', 'Software\Classes'))) {
    $cls = (Get-Base $loc[0]).OpenSubKey($loc[1])
    if (-not $cls) { continue }
    $roots = New-Object System.Collections.ArrayList
    foreach ($n in $cls.GetSubKeyNames()) {
      if ($n -eq 'CLSID' -or $n -eq 'Interface' -or $n -eq 'TypeLib' -or $n -eq 'AppID' -or $n -eq 'Wow6432Node') { continue }
      [void]$roots.Add($n + '\shellex'); [void]$roots.Add($n + '\Background\shellex')
    }
    $sfa = $cls.OpenSubKey('SystemFileAssociations')
    if ($sfa) { foreach ($n in $sfa.GetSubKeyNames()) { [void]$roots.Add('SystemFileAssociations\' + $n + '\shellex') }; $sfa.Close() }
    foreach ($r in $roots) {
      $sx = $cls.OpenSubKey($r)
      if (-not $sx) { continue }
      foreach ($h in $sx.GetSubKeyNames()) {           # shellex\<HandlerType>  or  shellex\{IID} (default = handler CLSID)
        $hk = $sx.OpenSubKey($h)
        if (-not $hk) { continue }
        if (Is-Ours (Get-Default $hk)) { & $addKey $loc[0] ($loc[1] + '\' + $r + '\' + $h) }
        else {
          foreach ($e in $hk.GetSubKeyNames()) {       # shellex\<HandlerType>\<Name or CLSID>
            $ek = $hk.OpenSubKey($e)
            if (-not $ek) { continue }
            if ((Is-Ours $e) -or (Is-Ours (Get-Default $ek))) { & $addKey $loc[0] ($loc[1] + '\' + $r + '\' + $h + '\' + $e) }
            $ek.Close()
          }
        }
        $hk.Close()
      }
      $sx.Close()
    }
    $cls.Close()
  }

  # 3) Explorer-level references
  $ex = 'Microsoft\Windows\CurrentVersion\Explorer'
  foreach ($loc in @(@('HKLM', 'SOFTWARE\'), @('HKLM', 'SOFTWARE\WOW6432Node\'), @('HKCU', 'Software\'))) {
    $b = Get-Base $loc[0]
    $ov = $b.OpenSubKey($loc[1] + $ex + '\ShellIconOverlayIdentifiers')
    if ($ov) {
      foreach ($n in $ov.GetSubKeyNames()) { $k = $ov.OpenSubKey($n); if ($k -and ((Is-Ours (Get-Default $k)) -or (Is-Ours $n))) { & $addKey $loc[0] ($loc[1] + $ex + '\ShellIconOverlayIdentifiers\' + $n) }; if ($k) { $k.Close() } }
      $ov.Close()
    }
    foreach ($ns in 'MyComputer\NameSpace', 'Desktop\NameSpace', 'Desktop\NameSpace\DelegateFolders', 'MyComputer\NameSpace\DelegateFolders') {
      foreach ($c in $CLSIDS) { $sub = $loc[1] + $ex + '\' + $ns + '\' + $c; $k = $b.OpenSubKey($sub); if ($k) { $k.Close(); & $addKey $loc[0] $sub } }
    }
    foreach ($vk in ($ex + '\HideDesktopIcons\NewStartPanel'), ($ex + '\HideDesktopIcons\ClassicStartMenu'), 'Microsoft\Windows\CurrentVersion\Shell Extensions\Approved') {
      $k = $b.OpenSubKey($loc[1] + $vk)
      if ($k) { foreach ($v in $k.GetValueNames()) { if (Is-Ours $v) { & $addVal $loc[0] ($loc[1] + $vk) $v } }; $k.Close() }
    }
  }
  # de-duplicate, and drop keys nested inside another key that is already being removed
  $seen = @{}; $res = @()
  foreach ($t in ($out | Sort-Object { $_.Hive + '\' + $_.Sub })) {
    $id = $t.Kind + '|' + $t.Hive + '\' + $t.Sub + '|' + $t.Name
    if ($seen.ContainsKey($id)) { continue }
    $nested = $false
    if ($t.Kind -eq 'key') { foreach ($r in $res) { if ($r.Kind -eq 'key' -and ($t.Hive + '\' + $t.Sub).StartsWith($r.Hive + '\' + $r.Sub + '\', [StringComparison]::OrdinalIgnoreCase)) { $nested = $true } } }
    if ($nested) { continue }
    $seen[$id] = 1; $res += $t
  }
  return , $res
}

function Load-State {
  if (Test-Path -LiteralPath $StateFile) {
    $s = [IO.File]::ReadAllText($StateFile, $Utf8) | ConvertFrom-Json
    return @{ keys = @($s.keys | Where-Object { $_ }); values = @($s.values | Where-Object { $_ }); appx = $s.appx }
  }
  return @{ keys = @(); values = @(); appx = $null }
}
function Save-State($st) {
  [void][IO.Directory]::CreateDirectory($Store)
  $json = ConvertTo-Json -InputObject ([pscustomobject]@{ version = 1; root = $Root; keys = @($st.keys); values = @($st.values); appx = $st.appx }) -Depth 6
  [IO.File]::WriteAllText($StateFile, $json, $Utf8)
}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }

try {
  if ($Check -or (-not $Remove -and -not $Restore)) {
    $t = Find-Targets
    Write-Log ("registry references found: {0}" -f $t.Count)
    foreach ($x in $t) { Write-Log ("  {0,-5} {1}\{2} {3}" -f $x.Kind, $x.Hive, $x.Sub, $x.Name) }
    $p = Get-AppxPackage -Name $PKG -ErrorAction SilentlyContinue
    Write-Log ("sparse package: " + $(if ($p) { $p.PackageFullName } else { '(not installed)' }))
    if (Test-Path -LiteralPath $StateFile) { $st = Load-State; Write-Log ("backup state: {0} keys, {1} values, appx={2}" -f $st.keys.Count, $st.values.Count, [bool]$st.appx) }
    exit 0
  }
  if (-not (Test-Admin)) { Write-Log 'ERROR: needs elevation (HKLM)'; exit 5 }

  if ($Remove) {
    $st = Load-State
    $t = Find-Targets
    Write-Log ("remove: {0} registry references" -f $t.Count)
    $regDir = Join-Path $Store 'reg'; [void][IO.Directory]::CreateDirectory($regDir)
    $i = @($st.keys).Count
    foreach ($x in $t) {
      $b = Get-Base $x.Hive
      if ($x.Kind -eq 'key') {
        $i++
        $file = Join-Path $regDir ('{0:D3}.reg' -f $i)
        $rc = Invoke-Reg ('export "{0}\{1}" "{2}" /y /reg:64' -f $x.Hive, $x.Sub, $file)
        if ($rc -ne 0 -or -not (Test-Path -LiteralPath $file)) { throw ("export failed ({0}): {1}\{2}" -f $rc, $x.Hive, $x.Sub) }
        $b.DeleteSubKeyTree($x.Sub, $false)
        $st.keys += [pscustomobject]@{ path = ($x.Hive + '\' + $x.Sub); file = [IO.Path]::GetFileName($file) }
        Write-Log ("  deleted key   {0}\{1}" -f $x.Hive, $x.Sub)
      } else {
        $k = $b.OpenSubKey($x.Sub, $true)
        $kind = $k.GetValueKind($x.Name); $data = $k.GetValue($x.Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        if ($kind -eq [Microsoft.Win32.RegistryValueKind]::Binary) { $data = [Convert]::ToBase64String([byte[]]$data) }
        $st.values += [pscustomobject]@{ hive = $x.Hive; sub = $x.Sub; name = $x.Name; kind = [string]$kind; data = $data }
        $k.DeleteValue($x.Name, $false); $k.Close()
        Write-Log ("  deleted value {0}\{1} [{2}]" -f $x.Hive, $x.Sub, $x.Name)
      }
      Save-State $st      # save after every step: an interruption never loses a backup record
    }
    $p = Get-AppxPackage -Name $PKG -ErrorAction SilentlyContinue
    if ($p) {
      $st.appx = [pscustomobject]@{ name = $p.Name; fullName = $p.PackageFullName; msix = 'sysres\BaiduNetdisk.msix' }
      Save-State $st
      Remove-AppxPackage -Package $p.PackageFullName
      Write-Log ("  removed sparse package {0}" -f $p.PackageFullName)
    }
    Write-Log 'remove: done (Explorer drops the already-loaded DLLs after it restarts or the user signs in again)'
    exit 0
  }

  if ($Restore) {
    if (-not (Test-Path -LiteralPath $StateFile)) { Write-Log 'restore: nothing recorded'; exit 0 }
    $st = Load-State
    foreach ($e in $st.keys) {
      $file = Join-Path (Join-Path $Store 'reg') $e.file
      if (-not (Test-Path -LiteralPath $file)) { Write-Log ("  missing backup {0} for {1}" -f $e.file, $e.path); continue }
      $rc = Invoke-Reg ('import "{0}" /reg:64' -f $file)
      Write-Log ("  import {0} -> {1} (rc={2})" -f $e.file, $e.path, $rc)
    }
    foreach ($v in $st.values) {
      $b = Get-Base $v.hive
      $k = $b.CreateSubKey($v.sub)
      $kind = [Microsoft.Win32.RegistryValueKind]$v.kind
      $data = $v.data
      switch ($kind) {
        'DWord'       { $data = [int]$data }
        'QWord'       { $data = [long]$data }
        'Binary'      { $data = [Convert]::FromBase64String([string]$data) }
        'MultiString' { $data = [string[]]@($data) }
        default       { $data = [string]$data }
      }
      $k.SetValue($v.name, $data, $kind); $k.Close()
      Write-Log ("  restored value {0}\{1} [{2}]" -f $v.hive, $v.sub, $v.name)
    }
    if ($st.appx -and -not (Get-AppxPackage -Name $st.appx.name -ErrorAction SilentlyContinue)) {
      $msix = Join-Path $Root $st.appx.msix
      if (Test-Path -LiteralPath $msix) {
        try { Add-AppxPackage -Path $msix -ExternalLocation $Root; Write-Log ("  re-registered sparse package from {0}" -f $msix) }
        catch { Write-Log ("  WARN sparse package not restored: " + $_.Exception.Message) }
      } else { Write-Log ("  WARN sparse package not restored: {0} missing (restore the files first)" -f $msix) }
    }
    [IO.File]::Move($StateFile, $StateFile + '.restored-' + (Get-Date -Format 'yyyyMMddHHmmss'))
    Write-Log 'restore: done'
    exit 0
  }
} catch {
  Write-Log ('ERROR: ' + $_.Exception.Message)
  exit 1
}
