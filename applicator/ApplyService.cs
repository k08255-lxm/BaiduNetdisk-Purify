using System;
using System.IO;
using System.Text;
using System.Threading;

namespace Purify
{
    internal sealed class ApplyService
    {
        private readonly SchemeSource source;
        private readonly Action<string> log;
        private readonly bool configureDesktop;

        internal ApplyService(SchemeSource source, Action<string> log, bool configureDesktop)
        {
            this.source = source;
            this.log = log;
            this.configureDesktop = configureDesktop;
        }

        internal void Apply(ClientDirectory client, bool slim)
        {
            Locked(client, delegate
            {
                var state = new ClientState(client);
                log("已识别客户端 " + client.Version + "，正在从 GitHub 获取签名方案。");
                var scheme = source.Resolve(state.OriginalHash);
                log("签名和文件 SHA-256 校验通过，匹配方案 " + scheme.Entry.name + "。");
                foreach (string path in scheme.Components)
                    client.Under(path);

                string output = Path.Combine(Path.GetTempPath(), "purify-" + Guid.NewGuid().ToString("N") + ".asar");
                try
                {
                    if (state.CurrentHash != scheme.Entry.outputSha256)
                    {
                        AsarPatch.Build(state.Source, output, scheme);
                        log("规则锚点和补丁输出 SHA-256 已校验。");
                    }
                    client.CloseProcesses(log);
                    state.CheckUnchanged();
                    Manifest record = state.PrepareBackup(scheme);
                    if (File.Exists(output))
                        ClientState.SwapCopy(output, client.Core);
                    if (Formats.Sha(client.Core) != scheme.Entry.outputSha256)
                        throw new IOException("应用补丁后重新校验核心文件失败。");
                    record.corePatched = scheme.Entry.outputSha256;
                    record.corePending = null;
                    state.Save(record);
                    state.DisableUpdater(record);
                    if (slim)
                    {
                        if (configureDesktop) OpenWith.Remove(state, record);
                        state.MoveComponents(scheme.Components, log);
                    }
                    if (configureDesktop)
                    {
                        try { NoticeWatcher.Install(client, log); }
                        catch (Exception ex)
                        {
                            throw new IOException("客户端已应用补丁。后台提示处理器启动失败，可重新应用方案或使用还原。", ex);
                        }
                    }
                    log("方案已应用。请正常打开百度网盘。");
                }
                finally { if (File.Exists(output)) File.Delete(output); }
            });
        }

        internal bool Restore(ClientDirectory client)
        {
            bool fullyRestored = true;
            Locked(client, delegate
            {
                var state = new ClientState(client);
                if (state.Record == null)
                    throw new InvalidOperationException("此目录没有可以还原的补丁记录。");
                client.CloseProcesses(log);
                state.CheckUnchanged();
                if (configureDesktop)
                    NoticeWatcher.Uninstall(client);
                if (state.CurrentHash != state.Record.coreOriginal)
                    ClientState.SwapCopy(client.Original, client.Core);
                if (Formats.Sha(client.Core) != state.Record.coreOriginal)
                    throw new IOException("还原后的 core.asar 校验失败。");
                state.RestoreUpdater();
                fullyRestored = state.RestoreComponents(log);
                if (configureDesktop)
                    OpenWith.Restore(state);
                bool legacyShell = File.Exists(client.Under(@"nd_purify\removed\shellext\state.json"));
                if (legacyShell)
                    log("客户端文件已还原。旧版移除的 Windows 资源管理器注册仍需用旧版卸载器恢复。");
                if (fullyRestored && !legacyShell)
                {
                    state.Archive();
                    log("已还原官方客户端。");
                }
                else
                    log("已保留备份记录，方便完成剩余还原。");
                fullyRestored = fullyRestored && !legacyShell;
            });
            return fullyRestored;
        }

        internal static string ClientId(ClientDirectory client)
        {
            var bytes = Encoding.UTF8.GetBytes(client.Root.ToUpperInvariant());
            return Formats.Sha(bytes, 0, bytes.Length).Substring(0, 24);
        }

        private static void Locked(ClientDirectory client, Action operation)
        {
            using (var mutex = new Mutex(false, @"Local\BaiduNetdiskPurify-operation-" + ClientId(client)))
            {
                bool acquired;
                try { acquired = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { acquired = true; }
                if (!acquired)
                    throw new InvalidOperationException("此客户端已有一个补丁操作，请等它结束。");
                try { operation(); }
                finally { mutex.ReleaseMutex(); }
            }
        }
    }
}
