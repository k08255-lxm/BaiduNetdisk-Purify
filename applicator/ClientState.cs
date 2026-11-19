using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Purify
{
    public sealed class Manifest
    {
        public string installPath { get; set; }
        public string appVersion { get; set; }
        public string coreOriginal { get; set; }
        public string corePatched { get; set; }
        public string corePending { get; set; }
        public bool renamedUpdater { get; set; }
        public bool updaterConfigPatched { get; set; }
        public bool registryBackedUp { get; set; }
        public Dictionary<string, string> registeredAppValues { get; set; }
        public string scheme { get; set; }
        public string schemeFrom { get; set; }
        public string installedBy { get; set; }

        internal bool Matches(string hash)
        {
            return hash == coreOriginal || hash == corePatched || hash == corePending;
        }
    }

    public sealed class RemovedItem
    {
        public string rel { get; set; }
        public long bytes { get; set; }
        public string stage { get; set; }
    }

    internal sealed class ClientState
    {
        internal readonly ClientDirectory Client;
        internal readonly Manifest Record;
        internal readonly string CurrentHash;

        internal ClientState(ClientDirectory client)
        {
            Client = client;
            CurrentHash = Formats.Sha(client.Core);
            if (!File.Exists(client.Manifest))
                return;
            Record = Formats.Decode<Manifest>(File.ReadAllBytes(client.Manifest));
            if (Record == null || !Record.Matches(CurrentHash))
                throw new InvalidDataException("目前的 core.asar 与本机补丁记录不符。为避免把旧组件混入新客户端，请先检查官方客户端和备份。");
            if (!File.Exists(client.Original) || Formats.Sha(client.Original) != Record.coreOriginal)
                throw new InvalidDataException("原版 core.asar 备份缺失或 SHA-256 校验失败。");
        }

        internal string OriginalHash { get { return Record == null ? CurrentHash : Record.coreOriginal; } }
        internal string Source { get { return Record == null ? Client.Core : Client.Original; } }

        internal void CheckUnchanged()
        {
            if (Formats.Sha(Client.Core) != CurrentHash)
                throw new IOException("百度网盘文件在准备过程中发生变化，请重新打开工具后重试。");
        }

        internal Manifest PrepareBackup(Scheme scheme)
        {
            var record = Record ?? new Manifest { installPath = Client.Root, coreOriginal = CurrentHash, installedBy = "applicator" };
            Directory.CreateDirectory(Client.Backup);
            if (Record == null && (!File.Exists(Client.Original) || Formats.Sha(Client.Original) != CurrentHash))
                SwapCopy(Client.Core, Client.Original);
            if (Formats.Sha(Client.Original) != record.coreOriginal)
                throw new IOException("原版文件备份验证失败。");
            record.appVersion = scheme.Rules.target.appVersion;
            record.scheme = scheme.Entry.name;
            record.schemeFrom = "online";
            record.corePending = scheme.Entry.outputSha256;
            Save(record);
            return record;
        }

        internal void Save(Manifest record)
        {
            Formats.WriteJson(Client.Manifest, record);
        }

        internal void Archive()
        {
            File.Move(Client.Manifest, Client.Manifest + ".restored-" + Guid.NewGuid().ToString("N"));
        }

        internal void DisableUpdater(Manifest record)
        {
            string config = Client.Under(@"AutoUpdate\config.ini");
            if (File.Exists(config))
            {
                string content = File.ReadAllText(config);
                string changed = Regex.Replace(content, @"(?m)^(IsAutoUpdate[ \t]*=[ \t]*)1(?=[ \t]*\r?$)",
                    match => match.Groups[1].Value + "0");
                if (content != changed)
                {
                    string backup = Client.Under(@"nd_purify\backup\config.ini.orig");
                    if (!record.updaterConfigPatched || !File.Exists(backup))
                        SwapCopy(config, backup);
                    record.updaterConfigPatched = true;
                    Save(record);
                    string staged = config + ".purify-" + Guid.NewGuid().ToString("N");
                    try
                    {
                        File.WriteAllText(staged, changed, Formats.Utf8);
                        File.Replace(staged, config, null);
                    }
                    finally { if (File.Exists(staged)) File.Delete(staged); }
                }
            }
            string executable = Client.Under(@"AutoUpdate\Autoupdate.exe");
            string disabled = Client.Under(@"AutoUpdate\Autoupdate.exe.nd-disabled");
            if (File.Exists(executable) && !File.Exists(disabled))
            {
                record.renamedUpdater = true;
                Save(record);
                File.Move(executable, disabled);
            }
        }

        internal void RestoreUpdater()
        {
            string config = Client.Under(@"nd_purify\backup\config.ini.orig");
            if (Record.updaterConfigPatched && File.Exists(config))
                SwapCopy(config, Client.Under(@"AutoUpdate\config.ini"));
            string active = Client.Under(@"AutoUpdate\Autoupdate.exe");
            string disabled = Client.Under(@"AutoUpdate\Autoupdate.exe.nd-disabled");
            if (Record.renamedUpdater && File.Exists(disabled) && !File.Exists(active))
                File.Move(disabled, active);
        }

        internal static void SwapCopy(string source, string target)
        {
            string staged = target + ".purify-" + Guid.NewGuid().ToString("N");
            try
            {
                File.Copy(source, staged);
                if (File.Exists(target))
                    File.Replace(staged, target, null);
                else
                    File.Move(staged, target);
            }
            finally { if (File.Exists(staged)) File.Delete(staged); }
        }

        internal void MoveComponents(IEnumerable<string> paths, Action<string> log)
        {
            var moves = ReadMoves();
            foreach (string relative in paths)
            {
                string source = Client.Under(relative);
                string target = Client.Under(@"nd_purify\removed\" + relative);
                if ((!File.Exists(source) && !Directory.Exists(source)) || File.Exists(target) || Directory.Exists(target))
                    continue;
                if (!moves.Any(entry => string.Equals(entry.rel, relative, StringComparison.OrdinalIgnoreCase)))
                {
                    moves.Add(new RemovedItem { rel = relative, stage = "applicator", bytes = File.Exists(source) ? new FileInfo(source).Length : 0 });
                    Directory.CreateDirectory(Client.Store);
                    Formats.WriteJson(Client.MoveLog, moves);
                }
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                try
                {
                    if (Directory.Exists(source))
                        Directory.Move(source, target);
                    else
                        File.Move(source, target);
                    log("已移出组件：" + relative);
                }
                catch (IOException ex) { log("组件仍在使用，已保留：" + relative + " (" + ex.Message + ")"); }
                catch (UnauthorizedAccessException ex) { log("无法移动，已保留：" + relative + " (" + ex.Message + ")"); }
            }
        }

        internal bool RestoreComponents(Action<string> log)
        {
            var remaining = new List<RemovedItem>();
            foreach (var move in ReadMoves())
            {
                string target = Client.Under(move.rel);
                string source = Client.Under(@"nd_purify\removed\" + move.rel);
                if (!Directory.Exists(source) && !File.Exists(source))
                    continue;
                if (Directory.Exists(target) || File.Exists(target))
                {
                    remaining.Add(move);
                    log("当前位置已有同名文件，备份已保留：" + move.rel);
                    continue;
                }
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                if (Directory.Exists(source))
                    Directory.Move(source, target);
                else
                    File.Move(source, target);
                log("已还原组件：" + move.rel);
            }
            if (File.Exists(Client.MoveLog))
                Formats.WriteJson(Client.MoveLog, remaining);
            return remaining.Count == 0;
        }

        private List<RemovedItem> ReadMoves()
        {
            var moves = new List<RemovedItem>();
            if (File.Exists(Client.MoveLog))
                AddMoves(Formats.Decode<object>(File.ReadAllBytes(Client.MoveLog)), moves);
            return moves.GroupBy(move => move.rel, StringComparer.OrdinalIgnoreCase).Select(group => group.First()).ToList();
        }

        private static void AddMoves(object parsed, List<RemovedItem> moves)
        {
            var array = parsed as object[];
            if (array != null)
                foreach (object item in array) AddMoves(item, moves);
            var map = parsed as Dictionary<string, object>;
            if (map == null)
                return;
            object value;
            if (map.TryGetValue("rel", out value) && value is string)
            {
                object bytes, stage;
                map.TryGetValue("bytes", out bytes);
                map.TryGetValue("stage", out stage);
                moves.Add(new RemovedItem { rel = (string)value, bytes = Convert.ToInt64(bytes), stage = stage as string });
            }
            else if (map.TryGetValue("value", out value))
                AddMoves(value, moves);
        }
    }
}
