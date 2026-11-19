# Dev helper: install a built core.asar into the live client, keep the uninstall manifest consistent,
# relaunch, and report health (visible windows, processes, tamper-notice hider, purify filter).
param(
  [string]$Core,                 # built core.asar to install (omit to keep current)
  [int]$WaitSeconds = 25,
  [switch]$NoLaunch
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:APPDATA 'baidu\BaiduNetdisk'
$dst = Join-Path $root 'module\BrowserEngine\resources\core.asar'
$manifest = Join-Path $root 'nd_purify\backup\manifest.json'
function Sha([string]$p) { $fs = [IO.File]::OpenRead($p); $h = [Security.Cryptography.SHA256]::Create(); try { ([BitConverter]::ToString($h.ComputeHash($fs)) -replace '-', '').ToLowerInvariant() } finally { $h.Dispose(); $fs.Dispose() } }

$names = 'BaiduNetdisk', 'BaiduNetdiskUnite', 'baidunetdiskhost', 'crashpad_handler'
Get-Process -Name $names -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

if ($Core) {
  [IO.File]::Copy($Core, $dst, $true)
  $h = Sha $dst
  if (Test-Path $manifest) {
    $m = Get-Content $manifest -Raw | ConvertFrom-Json
    $m.corePatched = $h
    $m | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifest -Encoding UTF8
  }
  "installed core.asar sha256=$($h.Substring(0,16))"
}
if ($NoLaunch) { return }

$plog = Join-Path $env:APPDATA 'baidunetdisk\nd_purify.log'
$hlog = Join-Path $env:APPDATA 'baidunetdisk\nd_hide_notice.log'
if (Test-Path $plog) { [IO.File]::WriteAllText($plog, '') }
$hBefore = 0; if (Test-Path $hlog) { $hBefore = @(Get-Content $hlog).Count }
$dbg = Join-Path $root 'module\BrowserEngine\debug.log'
$dBefore = 0; if (Test-Path $dbg) { $dBefore = @(Get-Content $dbg).Count }

# Launch through explorer so the client runs at the user's normal (Medium) integrity even from an elevated shell;
# an elevated client cannot be touched by the (Medium) tamper-notice watcher -- not a real-world setup.
Start-Process (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList ('"' + (Join-Path $root 'BaiduNetdisk.exe') + '"')
Start-Sleep -Seconds $WaitSeconds

Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class WinList {
  [DllImport("user32.dll")] static extern bool EnumWindows(P f, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  delegate bool P(IntPtr h, IntPtr l);
  public static List<string> Rows = new List<string>();
  public static HashSet<uint> Pids = new HashSet<uint>();
  static bool Cb(IntPtr h, IntPtr l) {
    if (!IsWindowVisible(h)) return true;
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (!Pids.Contains(pid)) return true;
    var t = new StringBuilder(256); GetWindowTextW(h, t, 256);
    var c = new StringBuilder(128); GetClassNameW(h, c, 128);
    if (t.Length == 0) return true;
    Rows.Add(pid + " | " + c + " | " + t);
    return true;
  }
  public static void Scan() { Rows.Clear(); EnumWindows(new P(Cb), IntPtr.Zero); }
}
'@
$procs = Get-Process -Name $names -ErrorAction SilentlyContinue
foreach ($p in $procs) { [void][WinList]::Pids.Add([uint32]$p.Id) }
[WinList]::Scan()
"--- visible windows of the client (pid | class | title):"
if ([WinList]::Rows.Count) { [WinList]::Rows } else { '  (none)' }
"--- processes: " + (($procs | Group-Object Name | ForEach-Object { "$($_.Name)x$($_.Count)" }) -join ', ')
"--- tamper notice hidden this run: " + (@(Get-Content $hlog -ErrorAction SilentlyContinue | Select-Object -Skip $hBefore) -join ' / ')
$pl = @(Get-Content $plog -ErrorAction SilentlyContinue)
"--- purify: " + (($pl | Select-String 'INIT').Line) + " | blocked/stripped=" + (($pl | Select-String 'BLOCK|STRIP').Count)
"--- new debug.log lines: " + (@(Get-Content $dbg -ErrorAction SilentlyContinue).Count - $dBefore)
@(Get-Content $dbg -ErrorAction SilentlyContinue | Select-Object -Skip $dBefore) | Where-Object { $_ -notmatch 'p2pServer|VALIDATION_ERROR_UNKNOWN_ENUM_VALUE' } | Select-Object -Last 8
