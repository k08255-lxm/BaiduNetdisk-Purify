using System;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Purify
{
    internal sealed class MainWindow : Form
    {
        private readonly TextBox installPath = new TextBox { Dock = DockStyle.Fill, AccessibleName = "百度网盘安装目录" };
        private readonly TextBox details = new TextBox {
            Dock = DockStyle.Fill, Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, AccessibleName = "操作日志"
        };
        private readonly CheckBox slim = new CheckBox {
            Text = "把方案列出的非网盘组件移入本机备份", AutoSize = true, Checked = true
        };
        private readonly Button browse = new Button { Text = "浏览…", AutoSize = true };
        private readonly Button apply = new Button { Text = "应用方案", AutoSize = true };
        private readonly Button restore = new Button { Text = "还原客户端", AutoSize = true };
        private bool busy;

        internal MainWindow()
        {
            Text = "百度网盘纯净补丁";
            Font = SystemFonts.MessageBoxFont;
            AutoScaleMode = AutoScaleMode.Font;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(655, 396);
            MinimumSize = new Size(555, 340);

            var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(20), ColumnCount = 1, RowCount = 6 };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            for (int row = 0; row < 5; row++) layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            Controls.Add(layout);

            layout.Controls.Add(new Label {
                Text = "百度网盘纯净补丁", Font = new Font(Font.FontFamily, 17, FontStyle.Bold), AutoSize = true,
                Margin = new Padding(0, 0, 0, 8)
            }, 0, 0);
            layout.Controls.Add(new Label {
                Text = "百度网盘安装目录", AutoSize = true, Margin = new Padding(0, 4, 0, 4)
            }, 0, 1);
            var pathRow = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, ColumnCount = 2, Margin = new Padding(0, 0, 0, 8) };
            pathRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            pathRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            pathRow.Controls.Add(installPath, 0, 0);
            pathRow.Controls.Add(browse, 1, 0);
            layout.Controls.Add(pathRow, 0, 2);
            layout.Controls.Add(slim, 0, 3);
            var actions = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, Margin = new Padding(0, 8, 0, 10) };
            actions.Controls.Add(apply);
            actions.Controls.Add(restore);
            layout.Controls.Add(actions, 0, 4);
            layout.Controls.Add(details, 0, 5);

            browse.Click += ChooseDirectory;
            apply.Click += async (sender, e) => await Execute(false);
            restore.Click += async (sender, e) => await Execute(true);
            FormClosing += (sender, e) => { if (busy) e.Cancel = true; };
            Shown += DetectClient;
        }

        private void DetectClient(object sender, EventArgs e)
        {
            try
            {
                var detected = ClientDirectory.Detect();
                if (detected != null)
                {
                    installPath.Text = detected.Root;
                    Report("已找到百度网盘 " + detected.Version + "。应用方案需要连接 GitHub。");
                }
                else Report("请选择官方百度网盘的安装目录。");
            }
            catch (Exception ex)
            {
                Program.Log(ex.ToString());
                Report("未能自动识别安装目录，请手动选择。");
            }
        }

        private void ChooseDirectory(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog {
                Description = "选择包含 BaiduNetdisk.exe 的目录", ShowNewFolderButton = false, SelectedPath = installPath.Text
            })
                if (dialog.ShowDialog(this) == DialogResult.OK)
                    installPath.Text = dialog.SelectedPath;
        }

        private async Task Execute(bool restoring)
        {
            ClientDirectory client;
            try { client = new ClientDirectory(installPath.Text.Trim().Trim('"')); }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            string action = restoring ? "还原客户端" : "从 GitHub 获取并应用方案";
            if (MessageBox.Show(this, "操作时会关闭此目录运行的百度网盘。请先完成上传和下载。\n\n是否继续" + action + "？",
                action, MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK)
                return;

            bool move = slim.Checked;
            SetBusy(true);
            var progress = new Progress<string>(Report);
            var ui = (IProgress<string>)progress;
            try
            {
                await Task.Run(delegate
                {
                    var service = new ApplyService(new SchemeSource(), message =>
                    {
                        Program.Log(message);
                        ui.Report(message);
                    }, true);
                    if (restoring) service.Restore(client);
                    else service.Apply(client, move);
                });
            }
            catch (Exception ex)
            {
                Program.Log(ex.ToString());
                Report("操作中止：" + ex.Message);
                MessageBox.Show(this, ex.Message + "\n\n日志位于 " + Program.LogFile, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally { SetBusy(false); }
        }

        private void Report(string message)
        {
            details.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + message + Environment.NewLine);
        }

        private void SetBusy(bool value)
        {
            busy = value;
            installPath.ReadOnly = value;
            browse.Enabled = apply.Enabled = restore.Enabled = slim.Enabled = !value;
            UseWaitCursor = value;
        }
    }
}
