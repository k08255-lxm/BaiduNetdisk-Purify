using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Microsoft.Win32;

namespace Purify
{
    internal sealed class ClientDirectory
    {
        private static readonly string[] ClientProcesses = {
            "BaiduNetdisk", "BaiduNetdiskUnite", "baidunetdiskhost", "crashpad_handler", "Autoupdate", "YunUtilityService"
        };
        private readonly string prefix;
        internal readonly string Root;

        internal ClientDirectory(string root)
        {
            if (string.IsNullOrWhiteSpace(root) || !Path.IsPathRooted(root))
                throw new ArgumentException("请选择已安装的百度网盘目录。");
            Root = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            prefix = Root + Path.DirectorySeparatorChar;
            if (Root == Path.GetPathRoot(prefix).TrimEnd(Path.DirectorySeparatorChar) ||
                !File.Exists(Under("BaiduNetdisk.exe")) || !File.Exists(Core))
                throw new DirectoryNotFoundException("该目录缺少百度网盘客户端或 core.asar。");
        }

        internal string Core { get { return Under(@"module\BrowserEngine\resources\core.asar"); } }
        internal string Backup { get { return Under(@"nd_purify\backup"); } }
        internal string Manifest { get { return Under(@"nd_purify\backup\manifest.json"); } }
        internal string Original { get { return Under(@"nd_purify\backup\core.asar.orig"); } }
        internal string Store { get { return Under(@"nd_purify\removed"); } }
        internal string MoveLog { get { return Under(@"nd_purify\removed\removed.json"); } }
        internal string Version { get { return FileVersionInfo.GetVersionInfo(Under("BaiduNetdisk.exe")).FileVersion ?? "未知版本"; } }

        internal string Under(string relative)
        {
            if (string.IsNullOrWhiteSpace(relative) || Path.IsPathRooted(relative) ||
                relative.IndexOf(':') >= 0 || relative.Split('\\', '/').Any(s => s == ".." || s == "."))
                throw new InvalidDataException("方案包含无效的相对路径。");
            string path = Path.GetFullPath(Path.Combine(Root, relative));
            if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("路径超出百度网盘安装目录。");
            for (string part = path; part.Length > Root.Length; part = Path.GetDirectoryName(part))
            {
                if ((File.Exists(part) || Directory.Exists(part)) && (File.GetAttributes(part) & FileAttributes.ReparsePoint) != 0)
                    throw new IOException("路径包含重分析点：" + part);
            }
            return path;
        }

        internal void CloseProcesses(Action<string> log)
        {
            var workers = new List<Process>();
            try
            {
                foreach (string name in ClientProcesses)
                    foreach (var process in Process.GetProcessesByName(name))
                    {
                        string path = ProcessPath(process);
                        if (path != null && path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                            workers.Add(process);
                        else
                            process.Dispose();
                    }
                if (workers.Count != 0)
                    log("正在关闭该安装目录运行的百度网盘进程。");
                foreach (var process in workers)
                    if (!process.HasExited)
                        process.CloseMainWindow();
                foreach (var process in workers)
                {
                    if (process.WaitForExit(1200))
                        continue;
                    try { process.Kill(); }
                    catch (InvalidOperationException) { if (!process.HasExited) throw; }
                    if (!process.WaitForExit(5000))
                        throw new IOException("无法关闭百度网盘进程，请从系统托盘正常退出后重试。");
                }
            }
            finally
            {
                foreach (var process in workers)
                    process.Dispose();
            }
        }

        private static string ProcessPath(Process process)
        {
            try { return process.MainModule.FileName; }
            catch (System.ComponentModel.Win32Exception) { return null; }
            catch (InvalidOperationException) { return null; }
        }

        internal static ClientDirectory Detect()
        {
            var candidates = new List<string>();
            foreach (var process in Process.GetProcessesByName("BaiduNetdisk"))
                using (process)
                {
                    string path = ProcessPath(process);
                    if (path != null) candidates.Add(Path.GetDirectoryName(path));
                }
            const string Uninstall = @"Software\Microsoft\Windows\CurrentVersion\Uninstall";
            foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
                foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                    using (var root = RegistryKey.OpenBaseKey(hive, view))
                    using (var keys = root.OpenSubKey(Uninstall))
                    {
                        if (keys == null) continue;
                        foreach (string name in keys.GetSubKeyNames())
                            using (var key = keys.OpenSubKey(name))
                            {
                                if (key == null) continue;
                                var title = key.GetValue("DisplayName") as string;
                                if (title == "百度网盘" || (title != null && title.StartsWith("BaiduNetdisk", StringComparison.OrdinalIgnoreCase)))
                                    candidates.Add(key.GetValue("InstallLocation") as string);
                            }
                    }
            candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"baidu\BaiduNetdisk"));
            foreach (string candidate in candidates.Where(path => !string.IsNullOrWhiteSpace(path)).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try { return new ClientDirectory(candidate); }
                catch (IOException) { }
                catch (ArgumentException) { }
                catch (UnauthorizedAccessException) { }
            }
            return null;
        }
    }
}
