using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.Versioning;
using System.Windows.Forms;

[assembly: AssemblyTitle("BaiduNetdisk Purify")]
[assembly: AssemblyDescription("Apply a signed BaiduNetdisk Purify scheme to a locally installed client.")]
[assembly: AssemblyProduct("BaiduNetdisk Purify")]
[assembly: AssemblyVersion("2.0.0.0")]
[assembly: AssemblyFileVersion("2.0.0.0")]
[assembly: TargetFramework(".NETFramework,Version=v4.7.2", FrameworkDisplayName = ".NET Framework 4.7.2")]

namespace Purify
{
    internal static class Program
    {
        internal static readonly string DataDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BaiduNetdiskPurify");
        internal static readonly string LogFile = Path.Combine(DataDirectory, "applicator.log");
        private static readonly object LogLock = new object();

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                if (args.Length == 2 && args[0] == "--watch")
                {
                    NoticeWatcher.Run(new ClientDirectory(args[1]));
                    return 0;
                }
                if (args.Length != 0)
                    return 2;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainWindow());
                return 0;
            }
            catch (Exception ex)
            {
                Log(ex.ToString());
                if (args.Length == 0)
                    MessageBox.Show(ex.Message, "百度网盘纯净补丁", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        internal static void Log(string message)
        {
            try
            {
                lock (LogLock)
                {
                    Directory.CreateDirectory(DataDirectory);
                    File.AppendAllText(LogFile, DateTime.Now.ToString("s") + " " + message + Environment.NewLine, Formats.Utf8);
                }
            }
            catch (IOException ex) { Debug.WriteLine(ex); }
            catch (UnauthorizedAccessException ex) { Debug.WriteLine(ex); }
        }
    }
}
