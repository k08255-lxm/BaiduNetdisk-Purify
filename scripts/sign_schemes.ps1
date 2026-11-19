# Rebuild schemes\index.json from every schemes\<Name>\ folder and sign it (RSA-3072, SHA-256, PKCS#1 v1.5).
# The setup trusts a scheme only if index.json verifies against installer\payload\scheme_pubkey.xml AND every
# downloaded file matches the SHA-256 listed in the index.
#
# The private key never enters the repository: it is stored outside it, encrypted with Windows DPAPI
# (CurrentUser), so only this Windows account on this PC can sign. Losing it means: run -InitKey again
# (with -Force) and release a new setup with the new public key.
#
# Usage (Windows PowerShell 5.1):
#   powershell -File scripts\sign_schemes.ps1 -InitKey     # once: create key pair, write the public key
#   powershell -File scripts\sign_schemes.ps1              # rebuild + sign schemes\index.json, then self-verify
param(
  [switch]$InitKey,
  [switch]$Force,
  [string]$KeyFile = (Join-Path $env:APPDATA 'BaiduNetdisk-Purify-signing\scheme_signing_key.dpapi')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$repo = Split-Path -Parent $PSScriptRoot
$pubFile = Join-Path $repo 'installer\payload\scheme_pubkey.xml'
$schemes = Join-Path $repo 'schemes'
$utf8 = New-Object Text.UTF8Encoding($false)
$entropy = [Text.Encoding]::UTF8.GetBytes('BaiduNetdisk-Purify scheme signing')
function Sha([byte[]]$b) { $h = [Security.Cryptography.SHA256]::Create(); try { ([BitConverter]::ToString($h.ComputeHash($b)) -replace '-', '').ToLowerInvariant() } finally { $h.Dispose() } }

if ($InitKey) {
  if ((Test-Path -LiteralPath $KeyFile) -and -not $Force) { throw "signing key already exists: $KeyFile (use -Force to replace it; old setups will then reject new schemes)" }
  $rsa = New-Object Security.Cryptography.RSACryptoServiceProvider(3072); $rsa.PersistKeyInCsp = $false
  $enc = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($rsa.ToXmlString($true)), $entropy, 'CurrentUser')
  [void][IO.Directory]::CreateDirectory((Split-Path $KeyFile -Parent))
  [IO.File]::WriteAllBytes($KeyFile, $enc)
  [IO.File]::WriteAllText($pubFile, $rsa.ToXmlString($false), $utf8)
  "private key (DPAPI, this Windows account only): $KeyFile"
  "public key: $pubFile  sha256=" + (Sha ([IO.File]::ReadAllBytes($pubFile)))
  return
}

# ---- rebuild the index ----
$entries = @()
$dirs = @(Get-ChildItem -LiteralPath $schemes -Directory)
if ($dirs.Name -match '^\.(build|previous)-[0-9a-f]{32}$') {
  throw 'scheme staging directories exist; finish or recover the in-progress build before signing'
}
foreach ($d in $dirs | Sort-Object Name) {
  $set = [IO.File]::ReadAllText((Join-Path $d.FullName 'patchset.json')) | ConvertFrom-Json
  if (-not $set.expectedOutputSha256) { throw "$($d.Name): patchset.json has no expectedOutputSha256 (run make_scheme.ps1)" }
  foreach ($req in 'patchset.json', 'components.json') { if (-not (Test-Path -LiteralPath (Join-Path $d.FullName $req))) { throw "$($d.Name): missing $req" } }
  $files = [ordered]@{}
  foreach ($f in Get-ChildItem -LiteralPath $d.FullName -Recurse -File | Sort-Object FullName) {
    $files[$f.FullName.Substring($d.FullName.Length + 1).Replace('\', '/')] = Sha ([IO.File]::ReadAllBytes($f.FullName))
  }
  $entries += [ordered]@{ name = $d.Name; coreSha256 = [string]$set.target.originalCoreSha256; outputSha256 = [string]$set.expectedOutputSha256; files = $files }
}
$dups = $entries | Group-Object { $_.coreSha256 } | Where-Object Count -gt 1
if ($dups) { throw ('two schemes target the same core.asar: ' + ($dups | ForEach-Object { $_.Group.name -join ' & ' })) }
$index = [ordered]@{ format = 1; generated = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); schemes = @($entries) }
$bytes = $utf8.GetBytes((ConvertTo-Json -InputObject $index -Depth 6))
[IO.File]::WriteAllBytes((Join-Path $schemes 'index.json'), $bytes)

# ---- sign ----
if (-not (Test-Path -LiteralPath $KeyFile)) { throw "no signing key at $KeyFile (run with -InitKey first)" }
$priv = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($KeyFile), $entropy, 'CurrentUser'))
$rsa = New-Object Security.Cryptography.RSACryptoServiceProvider; $rsa.PersistKeyInCsp = $false; $rsa.FromXmlString($priv); $priv = $null
$sig = $rsa.SignData($bytes, 'SHA256'); $rsa.Clear()
[IO.File]::WriteAllText((Join-Path $schemes 'index.json.sig'), [Convert]::ToBase64String($sig), $utf8)

# ---- self-check with the PUBLIC key exactly as the setup will do it ----
$pub = New-Object Security.Cryptography.RSACryptoServiceProvider; $pub.PersistKeyInCsp = $false
$pub.FromXmlString([IO.File]::ReadAllText($pubFile))
if (-not $pub.VerifyData([IO.File]::ReadAllBytes((Join-Path $schemes 'index.json')), 'SHA256', [Convert]::FromBase64String([IO.File]::ReadAllText((Join-Path $schemes 'index.json.sig'))))) { throw 'self-verification FAILED' }
"signed index: {0} scheme(s): {1}" -f $entries.Count, (($entries | ForEach-Object { $_.name }) -join ', ')
