; 百度网盘纯净补丁 —— Inno Setup 安装脚本
; 安装包从 GitHub 下载并验证补丁方案，再修改本机已安装的官方客户端。
; 打补丁发生在 PrepareToInstall 阶段（复制文件之前）：失败则安装直接中止，不留任何残留。

; 安装器本身的内部版本（只在补丁引擎变化时才需要改）；补丁方案按百度网盘版本另行在线获取，与此无关
#define AppVer "1.3.0"
#define ProjectUrl "https://github.com/lastbaigeiapi/BaiduNetdisk-Purify"

[Setup]
AppId={{9B2E6F4A-3C1D-4E8B-A7F2-5D6C0B1E9A37}
AppName=百度网盘纯净补丁
AppVersion={#AppVer}
AppVerName=百度网盘纯净补丁
AppPublisherURL={#ProjectUrl}
AppSupportURL={#ProjectUrl}
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
OutputBaseFilename=BaiduNetdisk-Purify-Setup
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
           'https://pan.baidu.com/download 安装官方客户端，然后再运行本安装程序。' + #13#10 +
           '已支持的百度网盘版本见项目主页：{#ProjectUrl}' + #13#10#13#10 +
           '如果你的百度网盘装在其它位置（例如免安装版），请先打开百度网盘，再运行本安装程序。',
           mbError, MB_OK);
    Result := False;
    Exit;
  end;
  Result := True;
end;

function ExitCodeMessage(Code: Integer; const ClientVer: String): String;
begin
  case Code of
    10: Result := '未找到百度网盘的安装文件。请确认已安装官方客户端。';
    11: Result := '检测到百度网盘在打补丁之后被更新或改动过。' + #13#10 +
                  '请先在“设置 → 应用 → 已安装的应用”中卸载本补丁，再重新运行本安装程序。没有修改任何文件。';
    15: Result := '暂时还没有适配你的百度网盘版本（' + ClientVer + '）的补丁方案。' + #13#10 +
                  '没有修改任何文件。已支持的版本见项目主页：' + #13#10 + '{#ProjectUrl}';
    16: Result := '补丁方案校验失败（签名或文件哈希不符），为安全起见已中止，没有修改任何文件。' + #13#10 +
                  '请到项目主页下载最新的安装程序：' + #13#10 + '{#ProjectUrl}';
    17: Result := '无法从 GitHub 下载补丁方案。没有修改百度网盘文件。' + #13#10 +
                  '请确认当前网络可访问 raw.githubusercontent.com，再重试。';
    18: Result := '当前安装程序无法读取补丁方案索引。没有修改百度网盘文件。' + #13#10 +
                  '请到项目主页检查是否有新版安装程序：' + #13#10 + '{#ProjectUrl}';
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
  Params, LogFile, ClientVer: String;
begin
  Result := '';
  if not GetVersionNumbersString(GetBaiduExe(''), ClientVer) then ClientVer := '未知版本';
  // ExtractTemporaryFiles 会保留 DestDir 的字面目录名，文件实际位于 {tmp}\{app}\。
  ExtractTemporaryFiles('{app}\*');
  LogFile := ExpandConstant('{localappdata}\BaiduNetdiskPurify-install.log');
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}') + '\{app}\install.ps1"' +
            ' -InstallPath "' + BaiduRoot + '" -LogFile "' + LogFile + '"';
  if not WizardIsTaskSelected('slim') then Params := Params + ' -KeepComponents';
  if WizardIsTaskSelected('shellext') then Params := Params + ' -ShellExt';
  WizardForm.PreparingLabel.Caption := '正在从 GitHub 获取与百度网盘 ' + ClientVer + ' 对应的补丁方案，请稍候……';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, '', SW_HIDE,
              ewWaitUntilTerminated, ResultCode) then
  begin
    Result := '无法启动 Windows PowerShell，安装中止。';
    Exit;
  end;
  if ResultCode <> 0 then
    Result := ExitCodeMessage(ResultCode, ClientVer) + #13#10#13#10 + '详细日志：' + LogFile;
end;
