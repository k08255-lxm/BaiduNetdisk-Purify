# BaiduNetdisk de-marketing -- tamper-notice auto hider (polling, ASCII-only source)
# After core.asar is modified, the native integrity check pops a standard dialog
#   (class #32770, title U+63D0 U+793A, child Static containing U+5E94.. "app was modified",
#    owned by BaiduNetdiskUnite.exe). This watcher hides it (ShowWindow SW_HIDE) WITHOUT clicking
#   any button (clicking OK/close quits the app). The app stays fully usable once hidden.
# All CJK text is built via (char)0xXXXX arrays so matching is correct regardless of file encoding.
# No install path is needed: the dialog is recognised by its own features (class, title, owning process, text).
# The client's real location is read at run time from the dialog's process and only written to the log.
param(
  [string]$InstallPath = '',   # obsolete, ignored (kept so tasks registered by 1.0/1.1 still start)
  [int]$IntervalMs = 60,
  [switch]$DebugScan
)
# A child of PowerShell 7 inherits its PSModulePath, which breaks module autoloading in Windows PowerShell 5.1
# (cmdlets such as Get-FileHash / Register-ScheduledTask then appear to be missing). Reset to the 5.1 defaults.
if ($PSVersionTable.PSEdition -ne 'Core') { $env:PSModulePath = (Join-Path $env:SystemRoot 'system32\WindowsPowerShell\v1.0\Modules') + ';' + (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules') }
$ErrorActionPreference = 'SilentlyContinue'

$cs = @'
using System;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class NdHider {
  const int SW_HIDE = 0;
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageNameW(IntPtr p, int flags, StringBuilder s, ref int n);
  delegate bool EnumProc(IntPtr h, IntPtr l);

  // full path of the process that owns the window, read at run time (PROCESS_QUERY_LIMITED_INFORMATION)
  static string ExePath(IntPtr h){
    uint pid; GetWindowThreadProcessId(h, out pid);
    IntPtr p = OpenProcess(0x1000, false, pid); if(p==IntPtr.Zero) return "?";
    try { var s=new StringBuilder(1024); int n=s.Capacity; return QueryFullProcessImageNameW(p,0,s,ref n) ? s.ToString() : "?"; }
    finally { CloseHandle(p); }
  }

  static readonly string TITLE   = new string(new char[]{ (char)0x63d0, (char)0x793a });
  static readonly string MARK    = new string(new char[]{ (char)0x5e94,(char)0x7528,(char)0x7a0b,(char)0x5e8f,(char)0x88ab,(char)0x4fee,(char)0x6539 });
  static readonly string EXENAME = "baidunetdiskunite.exe";
  static EnumProc _topCb, _childCb;
  static bool _hasMark;
  public static int Count = 0;
  public static bool Debug = false;
  public static Action<string> OnHide;
  public static Action<string> OnDebug;

  static string Cls(IntPtr h){ var s=new StringBuilder(64); GetClassNameW(h,s,64); return s.ToString(); }
  static string Txt(IntPtr h){ var s=new StringBuilder(512); GetWindowTextW(h,s,512); return s.ToString(); }
  static string Cp(string s){ var b=new StringBuilder(); foreach(char c in s){ b.Append(((int)c).ToString("x4")); b.Append(' '); } return b.ToString().Trim(); }

  static bool ChildCb(IntPtr h, IntPtr l){ if(Cls(h)=="Static" && Txt(h).IndexOf(MARK)>=0){ _hasMark=true; return false; } return true; }

  static bool Match(IntPtr h){
    if(!IsWindowVisible(h)) return false;
    if(Cls(h)!="#32770") return false;
    string txt = Txt(h);
    uint pid; GetWindowThreadProcessId(h, out pid);
    string pn=null; try{ pn = Process.GetProcessById((int)pid).ProcessName; }catch{}
    if(Debug && OnDebug!=null) OnDebug("seen #32770 proc="+(pn??"?")+" titleCp=["+Cp(txt)+"] wantCp=["+Cp(TITLE)+"]");
    if(txt!=TITLE) return false;
    if(pn==null || !string.Equals(pn+".exe", EXENAME, StringComparison.OrdinalIgnoreCase)) return false;
    _hasMark=false;
    EnumChildWindows(h, _childCb, IntPtr.Zero);
    if(Debug && OnDebug!=null) OnDebug("  matched title+proc; hasMark="+_hasMark);
    return _hasMark;
  }

  // Log each dialog once. ShowWindow on another thread's window is synchronous, so if the dialog is still
  // visible right after the call the hide was refused -- normally because BaiduNetdisk runs with higher
  // privileges than this watcher ("run as administrator"; Windows UIPI). Report that once, keep retrying silently.
  static System.Collections.Generic.HashSet<IntPtr> _logged = new System.Collections.Generic.HashSet<IntPtr>();
  static System.Collections.Generic.HashSet<IntPtr> _failed = new System.Collections.Generic.HashSet<IntPtr>();
  static bool TopCb(IntPtr h, IntPtr l){
    if(Match(h)){
      ShowWindow(h, SW_HIDE); Count++;
      if(IsWindowVisible(h)){
        if(_failed.Add(h) && OnHide!=null) OnHide("CANNOT hide hwnd="+h+": BaiduNetdisk runs with higher privileges than this watcher (started as administrator?); retrying silently");
      } else if(_logged.Add(h) && OnHide!=null) OnHide("hid hwnd="+h+" total="+Count+" client="+ExePath(h));
    }
    return true;
  }

  public static void Init(){ _topCb=new EnumProc(TopCb); _childCb=new EnumProc(ChildCb); }
  public static void Scan(){ EnumWindows(_topCb, IntPtr.Zero); }
}
'@

Add-Type -TypeDefinition $cs -Language CSharp

$logDir = Join-Path $env:APPDATA 'baidunetdisk'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }
$logPath = Join-Path $logDir 'nd_hide_notice.log'
function Write-Log([string]$m) { try { Add-Content -Path $logPath -Value ((Get-Date).ToString('s') + ' ' + $m) } catch {} }

[NdHider]::OnHide  = [Action[string]]{ param($m) Write-Log $m }
if ($DebugScan) { [NdHider]::Debug = $true; [NdHider]::OnDebug = [Action[string]]{ param($m) Write-Log ('DBG ' + $m) } }
[NdHider]::Init()
Write-Log ("watcher started (poll " + $IntervalMs + "ms) debug=" + [bool]$DebugScan + " pid=" + $PID)

# single-instance guard (session-local; Global\ needs a privilege normal users lack)
$mutex = $null
try { $created = $false; $mutex = New-Object System.Threading.Mutex($true, 'nd_hide_notice_singleton', [ref]$created); if (-not $created) { Write-Log 'another instance running; exiting'; return } } catch { Write-Log ('mutex skipped: ' + $_.Exception.Message) }

while ($true) { [NdHider]::Scan(); Start-Sleep -Milliseconds $IntervalMs }
