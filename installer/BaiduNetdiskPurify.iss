; 百度网盘纯净补丁 —— Inno Setup 安装脚本
; 安装包只包含补丁器与补丁规则（不含任何百度网盘程序文件），在用户本机的正版客户端上打补丁。
; 打补丁发生在 PrepareToInstall 阶段（复制文件之前）：失败则安装直接中止，不留任何残留。

#define AppVer "1.1.0"

[Setup]
AppId={{9B2E6F4A-3C1D-4E8B-A7F2-5D6C0B1E9A37}
AppName=百度网盘纯净补丁
AppVersion={#AppVer}
AppVerName=百度网盘纯净补丁 {#AppVer}（适配百度网盘 8.9.7）
AppPublisher=个人制作（非百度官方）
DefaultDirName={localappdata}\Programs\BaiduNetdiskPurify
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=no
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
InfoBeforeFile=info_before.txt
OutputDir=release
OutputBaseFilename=BaiduNetdisk-Purify-Setup-{#AppVer}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=百度网盘纯净补丁（去广告/去营销）
SetupLogging=yes
CloseApplications=no

[Languages]
Name: "zh"; MessagesFile: "lang\ChineseSimplified.isl"

[Tasks]
Name: "slim"; Description: "精简：移出看图/播放器/AI/同步/办公插件等非网盘组件（约 670 MB，卸载时原样放回）"
Name: "shellext"; Description: "移除资源管理器里的百度网盘右键菜单与同步覆盖图标（会弹出一次管理员确认；拒绝则跳过；卸载时恢复）"

[Files]
Source: "payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Run]
Filename: "{code:GetBaiduExe}"; Description: "立即启动百度网盘"; Flags: postinstall nowait skipifsilent; Check: HasBaiduExe

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall.ps1"" -LogFile ""{localappdata}\BaiduNetdiskPurify-uninstall.log"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "RestoreBaiduNetdisk"

[UninstallDelete]
Type: files; Name: "{app}\install.log"

[Code]
var
  BaiduRoot: String;

function BaiduDisplayName(): String;
begin
  Result := '百度网盘';
end;

// 在卸载信息中查找百度网盘的安装目录（HKCU 与 HKLM 32/64 位视图）
function FindInUninstall(RootKey: Integer; const Path: String): String;
var
  Names: TArrayOfString;
  I: Integer;
  DisplayName, Loc: String;
begin
  Result := '';
  if not RegGetSubkeyNames(RootKey, Path, Names) then Exit;
  for I := 0 to GetArrayLength(Names) - 1 do
  begin
    if RegQueryStringValue(RootKey, Path + '\' + Names[I], 'DisplayName', DisplayName) then
      if (DisplayName = BaiduDisplayName()) or (Pos('BaiduNetdisk', DisplayName) = 1) then
        if RegQueryStringValue(RootKey, Path + '\' + Names[I], 'InstallLocation', Loc) then
          if FileExists(AddBackslash(Loc) + 'BaiduNetdisk.exe') then
          begin
            Result := RemoveBackslashUnlessRoot(Loc);
            Exit;
          end;
  end;
end;

// 注册表里找不到时（免安装版、卸载信息缺失等），取正在运行的百度网盘的实际位置
function FindRunningBaidu(): String;
var
  Locator, Service, Procs, P, V: Variant;
  Path: String;
begin
  Result := '';
  try
    Locator := CreateOleObject('WbemScripting.SWbemLocator');
    Service := Locator.ConnectServer('.', 'root\CIMV2');
    Procs := Service.ExecQuery('SELECT ExecutablePath FROM Win32_Process WHERE Name = ''BaiduNetdisk.exe''');
    if Procs.Count > 0 then
    begin
      P := Procs.ItemIndex(0);
      // 标准写法 Properties_.Item(...).Value（动态属性 P.ExecutablePath 并非所有 COM 客户端都支持）
      V := P.Properties_.Item('ExecutablePath').Value;
      if not VarIsNull(V) then
      begin
        Path := V;
        if FileExists(Path) then Result := ExtractFileDir(Path);
      end;
    end;
  except
    Result := '';
  end;
end;

function FindBaidu(): String;
var
  U: String;
begin
  U := 'Software\Microsoft\Windows\CurrentVersion\Uninstall';
  Result := FindInUninstall(HKCU, U);
  if Result = '' then Result := FindInUninstall(HKLM64, U);
  if Result = '' then Result := FindInUninstall(HKLM32, U);
  if Result = '' then Result := FindRunningBaidu();
  if (Result = '') and FileExists(ExpandConstant('{userappdata}\baidu\BaiduNetdisk\BaiduNetdisk.exe')) then
    Result := ExpandConstant('{userappdata}\baidu\BaiduNetdisk');
end;

function GetBaiduExe(Param: String): String;
begin
  Result := AddBackslash(BaiduRoot) + 'BaiduNetdisk.exe';
end;

function HasBaiduExe(): Boolean;
begin
  Result := (BaiduRoot <> '') and FileExists(GetBaiduExe(''));
end;

function InitializeSetup(): Boolean;
begin
  BaiduRoot := FindBaidu();
  if BaiduRoot = '' then
  begin
    MsgBox('未检测到百度网盘。' + #13#10#13#10 +
           '本程序只是补丁，不包含百度网盘本体。请先从百度网盘官网' + #13#10 +
           'https://pan.baidu.com/download 安装官方客户端（8.9.7 版本），然后再运行本安装程序。' + #13#10#13#10 +
           '如果你的百度网盘装在其它位置（例如免安装版），请先打开百度网盘，再运行本安装程序。',
           mbError, MB_OK);
    Result := False;
    Exit;
  end;
  Result := True;
end;

function ExitCodeMessage(Code: Integer): String;
begin
  case Code of
    10: Result := '未找到百度网盘的安装文件。请确认已安装官方客户端。';
    11: Result := '你安装的百度网盘版本与本补丁不匹配（本补丁只适配 8.9.7 / build 497）。' + #13#10 +
                  '为安全起见没有修改任何文件。';
    12: Result := '无法关闭正在运行的百度网盘。请从任务栏托盘彻底退出百度网盘后重试。';
    13: Result := '补丁生成或校验失败，已中止，没有修改任何文件。';
    14: Result := '没有写入百度网盘安装目录的权限。请右键本安装程序，选择“以管理员身份运行”。';
  else
    Result := '安装过程中出现未知错误（代码 ' + IntToStr(Code) + '）。';
  end;
end;

// 在复制任何文件之前完成打补丁；失败则返回错误信息，安装程序随即中止且不留残留
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  Params, LogFile: String;
begin
  Result := '';
  // 注意：ExtractTemporaryFiles 会保留 DestDir 的字面目录名，文件实际位于 {tmp}\{app}\ 下（含子目录 files\）
  ExtractTemporaryFiles('{app}\*');
  LogFile := ExpandConstant('{localappdata}\BaiduNetdiskPurify-install.log');
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}') + '\{app}\install.ps1"' +
            ' -InstallPath "' + BaiduRoot + '" -LogFile "' + LogFile + '"';
  if not WizardIsTaskSelected('slim') then Params := Params + ' -KeepComponents';
  if WizardIsTaskSelected('shellext') then Params := Params + ' -ShellExt';
  WizardForm.PreparingLabel.Caption := '正在为百度网盘打补丁，请稍候（约 10~30 秒）……';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, '', SW_HIDE,
              ewWaitUntilTerminated, ResultCode) then
  begin
    Result := '无法启动 Windows PowerShell，安装中止。';
    Exit;
  end;
  if ResultCode <> 0 then
    Result := ExitCodeMessage(ResultCode) + #13#10#13#10 + '详细日志：' + LogFile;
end;
