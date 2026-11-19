import argparse
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
REFERENCES = [
    "Microsoft.CSharp.dll",
    "System.Drawing.dll",
    "System.Management.dll",
    "System.Web.Extensions.dll",
    "System.Windows.Forms.dll",
]


def main():
    parser = argparse.ArgumentParser(description="Build the BaiduNetdisk Purify Windows applicator.")
    parser.add_argument("--output", type=Path, default=ROOT / "out" / "applicator")
    parser.add_argument("--compiler", type=Path, default=Path(os.environ.get("WINDIR", r"C:\Windows")) /
                        "Microsoft.NET/Framework64/v4.0.30319/csc.exe")
    args = parser.parse_args()
    output = args.output.resolve() / "BaiduNetdisk-Purify-Setup.exe"
    output.parent.mkdir(parents=True, exist_ok=True)
    files = sorted((ROOT / "applicator").glob("*.cs"))
    key = ROOT / "installer" / "payload" / "scheme_pubkey.xml"
    command = [
        str(args.compiler),
        "/nologo", "/utf8output", "/codepage:65001", "/langversion:5", "/target:winexe", "/platform:x64", "/optimize+",
        "/out:" + str(output),
        "/resource:" + str(key) + ",SchemePublicKey",
        *("/reference:" + item for item in REFERENCES),
        *(str(item) for item in files),
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    print(output)


if __name__ == "__main__":
    main()
