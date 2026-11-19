using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace Purify
{
    internal static class Formats
    {
        internal static readonly Encoding Utf8 = new UTF8Encoding(false, true);

        private static JavaScriptSerializer Json()
        {
            return new JavaScriptSerializer { MaxJsonLength = 32 * 1024 * 1024, RecursionLimit = 256 };
        }

        internal static T Decode<T>(byte[] bytes)
        {
            string text = Utf8.GetString(bytes).TrimStart('\uFEFF');
            return Json().Deserialize<T>(text);
        }

        internal static void WriteJson(string path, object value)
        {
            string temporary = path + ".new";
            try
            {
                File.WriteAllText(temporary, Json().Serialize(value) + "\n", Utf8);
                if (File.Exists(path))
                    File.Replace(temporary, path, null);
                else
                    File.Move(temporary, path);
            }
            finally
            {
                if (File.Exists(temporary))
                    File.Delete(temporary);
            }
        }

        internal static string Sha(string file)
        {
            using (var stream = File.OpenRead(file))
            using (var hash = SHA256.Create())
                return Hex(hash.ComputeHash(stream));
        }

        internal static string Sha(byte[] bytes, int offset, int count)
        {
            using (var hash = SHA256.Create())
                return Hex(hash.ComputeHash(bytes, offset, count));
        }

        internal static string Hex(byte[] bytes)
        {
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }
    }

    public sealed class SchemeIndex
    {
        public int format { get; set; }
        public List<SchemeEntry> schemes { get; set; }
    }

    public sealed class SchemeEntry
    {
        public string name { get; set; }
        public string coreSha256 { get; set; }
        public string outputSha256 { get; set; }
        public Dictionary<string, string> files { get; set; }
    }

    public sealed class PatchSet
    {
        public int format { get; set; }
        public string mark { get; set; }
        public PatchTarget target { get; set; }
        public string expectedOutputSha256 { get; set; }
        public List<string> newFiles { get; set; }
        public List<PatchRule> patches { get; set; }
    }

    public sealed class PatchTarget
    {
        public string appVersion { get; set; }
        public string originalCoreSha256 { get; set; }
    }

    public sealed class PatchRule
    {
        public string file { get; set; }
        public string name { get; set; }
        public string kind { get; set; }
        public string find { get; set; }
        public string repl { get; set; }
        public string pattern { get; set; }
        public int groups { get; set; }
        public string template { get; set; }
    }

    public sealed class ComponentList
    {
        public List<string> components { get; set; }
    }

    public sealed class AsarHeader
    {
        public Dictionary<string, AsarEntry> files { get; set; }
    }

    public sealed class AsarEntry
    {
        public int size { get; set; }
        public string offset { get; set; }
        public AsarIntegrity integrity { get; set; }
    }

    public sealed class AsarIntegrity
    {
        public string hash { get; set; }
    }
}
