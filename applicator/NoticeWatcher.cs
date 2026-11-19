using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace Purify
{
    internal static class NoticeWatcher
    {
        private const string LegacyShortcut = "BaiduNetdisk Purify Notice Hider.lnk";
        private const string WatcherName = "BaiduNetdiskPurify";

        private delegate bool WindowVisitor(IntPtr window, IntPtr data);
        [DllImport("user32.dll")] private static extern bool EnumWindows(WindowVisitor visitor, IntPtr data);
        [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr window, WindowVisitor visitor, IntPtr data);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder text, int count);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
        [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);

        internal static void Install(ClientDirectory client, Action<string> log)
        {
            string source = Assembly.GetExecutingAssembly().Location;
            string runtime = Path.Combine(Program.DataDirectory, "runtime");
            Directory.CreateDirectory(runtime);
            string hash = Formats.Sha(source);
            string exe = Path.Combine(runtime, WatcherName + "-" + hash.Substring(0, 16) + ".exe");
            if (!File.Exists(exe) || Formats.Sha(exe) != hash)
                ClientState.SwapCopy(source, exe);

            string arguments = "--watch \"" + client.Root + "\"";
            Stop(client);
            using (var process = Process.Start(new ProcessStartInfo(exe, arguments) { UseShellExecute = false, CreateNoWindow = true }))
            {
                for (int tries = 0; tries < 50 && !IsRunning(client) && !process.HasExited; tries++)
                    Thread.Sleep(100);
                if (!IsRunning(client))
                    throw new IOException("后台提示处理器未启动，请查看工具日志。");
            }
            string path = Shortcut(client);
            dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            dynamic shortcut = shell.CreateShortcut(path);
            shortcut.TargetPath = exe;
            shortcut.Arguments = arguments;
            shortcut.WorkingDirectory = runtime;
            shortcut.Save();
            if (!File.Exists(path))
                throw new IOException("当前用户的「启动」快捷方式创建失败。");
            RetireLegacy(client, shell, log);
            log("后台提示处理器已运行，使用当前用户的「启动」快捷方式。");
        }

        private static void RetireLegacy(ClientDirectory client, dynamic shell, Action<string> log)
        {
            try
            {
                string oldPath = client.Under(@"nd_purify\nd_hide_notice.ps1");
                StopLegacyProcess(oldPath, log);
                string oldShortcut = Path.Combine(StartupDirectory(), LegacyShortcut);
                if (File.Exists(oldShortcut))
                {
                    dynamic shortcut = shell.CreateShortcut(oldShortcut);
                    string arguments = shortcut.Arguments;
                    if (arguments.IndexOf("\"" + oldPath + "\"", StringComparison.OrdinalIgnoreCase) >= 0)
                        File.Delete(oldShortcut);
                }
                string destination = client.Under(@"nd_purify\backup\legacy-notice.ps1");
                if (File.Exists(oldPath) && !File.Exists(destination))
                    File.Move(oldPath, destination);
            }
            catch (IOException ex) { log("已保留旧版提示脚本备份：" + ex.Message); }
            catch (UnauthorizedAccessException ex) { log("当前权限无法清理旧版提示脚本：" + ex.Message); }
            catch (COMException ex) { log("当前权限无法检查旧版启动快捷方式：" + ex.Message); }
        }

        private static void StopLegacyProcess(string script, Action<string> log)
        {
            // Only the previous project watcher for this exact installation and current Windows session.
            string path = Regex.Escape(script);
            var invocation = new Regex("(?:^|\\s)-File\\s+(?:\"" + path + "\"|" + path + ")(?:\\s|$)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            try
            {
                int session;
                using (var current = Process.GetCurrentProcess()) session = current.SessionId;
                using (var query = new ManagementObjectSearcher(
                    "SELECT ProcessId, SessionId, CommandLine FROM Win32_Process WHERE Name='powershell.exe'"))
                using (var results = query.Get())
                    foreach (ManagementObject item in results)
                    {
                        using (item)
                        {
                            var command = item["CommandLine"] as string;
                            if (command == null || Convert.ToInt32(item["SessionId"]) != session || !invocation.IsMatch(command))
                                continue;
                            try
                            {
                                using (var process = Process.GetProcessById(Convert.ToInt32(item["ProcessId"])))
                                {
                                    process.Kill();
                                    process.WaitForExit(2000);
                                }
                                log("已停止此目录的旧版 PowerShell 提示处理进程。");
                            }
                            catch (ArgumentException) { }
                            catch (InvalidOperationException) { }
                            catch (System.ComponentModel.Win32Exception ex) { log("当前权限无法停止旧版提示处理进程：" + ex.Message); }
                        }
                    }
            }
            catch (ManagementException ex) { log("无法检查旧版提示处理进程：" + ex.Message); }
        }

        internal static void Uninstall(ClientDirectory client)
        {
            string shortcut = Shortcut(client);
            if (File.Exists(shortcut))
                File.Delete(shortcut);
            Stop(client);
        }

        private static void Stop(ClientDirectory client)
        {
            string name = EventName(client);
            EventWaitHandle stop;
            if (!EventWaitHandle.TryOpenExisting(name, out stop))
                return;
            using (stop) stop.Set();
            for (int tries = 0; tries < 30; tries++)
            {
                if (!EventWaitHandle.TryOpenExisting(name, out stop))
                    return;
                stop.Dispose();
                Thread.Sleep(100);
            }
            throw new IOException("后台提示处理器仍在退出，请稍候重试。");
        }

        private static string EventName(ClientDirectory client)
        {
            return @"Local\BaiduNetdiskPurify-watcher-stop-" + ApplyService.ClientId(client);
        }

        private static bool IsRunning(ClientDirectory client)
        {
            EventWaitHandle existing;
            if (!EventWaitHandle.TryOpenExisting(EventName(client), out existing))
                return false;
            using (existing) return !existing.WaitOne(0);
        }

        private static string StartupDirectory()
        {
            return Environment.GetFolderPath(Environment.SpecialFolder.Startup, Environment.SpecialFolderOption.Create);
        }

        private static string Shortcut(ClientDirectory client)
        {
            return Path.Combine(StartupDirectory(), "BaiduNetdisk Purify " + ApplyService.ClientId(client) + ".lnk");
        }

        internal static void Run(ClientDirectory client)
        {
            if (!File.Exists(client.Manifest))
                return;
            var state = new ClientState(client);
            if (state.CurrentHash == state.OriginalHash)
                return;
            string executable = client.Under(@"module\BrowserEngine\BaiduNetdiskUnite.exe");
            bool created;
            using (var stop = new EventWaitHandle(false, EventResetMode.ManualReset, EventName(client), out created))
            {
                if (!created) return;
                WindowVisitor visitor = (window, data) => CheckWindow(window, executable);
                while (!stop.WaitOne(180))
                    EnumWindows(visitor, IntPtr.Zero);
            }
        }

        private static bool CheckWindow(IntPtr window, string executable)
        {
            if (!IsWindowVisible(window) || Class(window) != "#32770" || Text(window) != "提示")
                return true;
            uint id;
            GetWindowThreadProcessId(window, out id);
            try
            {
                using (var process = Process.GetProcessById((int)id))
                {
                    if (!string.Equals(process.ProcessName, "BaiduNetdiskUnite", StringComparison.OrdinalIgnoreCase) ||
                        !string.Equals(process.MainModule.FileName, executable, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
            }
            catch (ArgumentException) { return true; }
            catch (InvalidOperationException) { return true; }
            catch (System.ComponentModel.Win32Exception) { return true; }
            bool found = false;
            EnumChildWindows(window, delegate(IntPtr child, IntPtr unused)
            {
                found = Class(child) == "Static" && Text(child).Contains("应用程序被修改");
                return !found;
            }, IntPtr.Zero);
            if (found && ShowWindowAsync(window, 0))
                Program.Log("已隐藏百度网盘客户端的应用程序被修改提示。");
            return true;
        }

        private static string Class(IntPtr window)
        {
            var text = new StringBuilder(64);
            GetClassName(window, text, text.Capacity);
            return text.ToString();
        }

        private static string Text(IntPtr window)
        {
            var text = new StringBuilder(512);
            GetWindowText(window, text, text.Capacity);
            return text.ToString();
        }
    }
}
