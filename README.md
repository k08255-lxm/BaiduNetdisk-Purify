# 百度网盘纯净补丁（BaiduNetdisk-Purify）

适用于 **Windows 版百度网盘**的去广告、去营销和精简补丁。保留**浏览、上传、下载、分享与转存**。当前共有 **9 个已适配版本**，其中最新的是 **8.10.3.103 x64**。

> **本项目不包含百度网盘的任何程序文件。** 安装包只有补丁脚本和规则，它在你电脑上已经装好的官方客户端上打补丁；卸载即完整还原为官方原版。
> 个人制作，与百度无关，非官方产品。修改客户端可能违反《百度网盘用户协议》，请自行评估风险。

## 下载与安装

1. 从下表选择并安装对应的官方百度网盘。
2. 等当前上传、下载任务结束后，运行 v1.2.0 补丁安装器。已有 v1.2.0 可以直接使用，安装时会获取对应方案。 [下载 Setup.exe](https://github.com/lastbaigeiapi/BaiduNetdisk-Purify/releases/latest/download/BaiduNetdisk-Purify-Setup.exe) · [发布说明及安装器 SHA-256](https://github.com/lastbaigeiapi/BaiduNetdisk-Purify/releases/tag/v1.2.0)
3. 安装完成后，从开始菜单或桌面图标以普通用户权限打开百度网盘。

系统要求为 64 位 Windows 10 1809 及以上或 Windows 11。更多操作说明见 [使用说明](docs/使用说明.txt)。

### 已支持的百度网盘版本

安装器按客户端原始 `core.asar` 的 SHA-256 匹配方案。同一个版本号可能对应不同构建，请使用表中对应的官方安装包。找不到匹配方案时，安装器会中止并保留当前客户端文件。 [已发布的补丁方案](schemes/)

| 百度网盘版本 | 官方安装包 | 官方安装包 SHA-256 |
|---|---|---|
| 8.10.3.103 x64 | [BaiduNetdisk_8.10.3.103_x64.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/x64/BaiduNetdisk_8.10.3.103_x64.exe) | `0696430053ba455de47ea5e5567354c4eb74e17ea9940ed6f6a9a9f682dad319` |
| 8.9.7.101 | [BaiduNetdisk_8.9.7.101.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.9.7.101.exe) | `3673bd43e98af4c93d69fa7e85cf836fc0ef7791229b10d09127e9b4c3970569` |
| 8.9.2.101 | [BaiduNetdisk_8.9.2.101.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.9.2.101.exe) | `3bb9c6066dee502e8852170ea57cf52b3134c96521dffb6ee3d13d0862fd4086` |
| 8.8.8.101 | [BaiduNetdisk_8.8.8.101.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.8.8.101.exe) | `cd5e4aeff87ca3f178af8ab30b2c6709112f6c5c6dcb976b04e7d7edc3d61867` |
| 8.8.6.102 | [BaiduNetdisk_8.8.6.102.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.8.6.102.exe) | `b04a635dea283a455ada9e5d7d132d23bee6a2fa4df9d3f87efca914d0e57e96` |
| 8.8.3.101 | [BaiduNetdisk_8.8.3.101.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.8.3.101.exe) | `82e8356f63db4bc5ecb2bc3e9fd96cb16efa1f59d149ae49ff1004cecd1fad55` |
| 8.7.9.102 | [BaiduNetdisk_8.7.9.102.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.7.9.102.exe) | `a2f9c3ae9c51678963c9c63b61b588976f9b15761b70192bff259db931d8bb4d` |
| 8.6.8.102 | [BaiduNetdisk_8.6.8.102.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.6.8.102.exe) | `e4f727fa845172a2840254079b6d51f034b5074c2f516de2c0ab4011d27e0811` |
| 8.5.9.102 | [BaiduNetdisk_8.5.9.102.exe](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_8.5.9.102.exe) | `fd777350c1eb91b591a312a85d8c918e87e8216102840946f3a13a0a5311d804` |

表中的 SHA-256 用于核对下载的官方安装包。**8.10.3.103 仅适配文件名带 `_x64` 的安装包**。

**8.9.7.101** 可使用 v1.2.0 随包内置的方案离线安装。**其余 8 个版本**需要安装时能访问 GitHub，下载对应的已签名方案。

### 已验证的操作

- 9 个版本均通过在线方案下载与校验、补丁安装、客户端启动和卸载还原测试。
- 8.9.7.101 已实测上传、下载、创建及取消分享、下载后用系统默认程序打开图片。8.10.3.103 x64 已实测登录后的文件浏览、「我的分享」和「转存和订阅」页面。实际上传、下载和创建分享链接尚未在各版本逐一验证。
- 从 8.9.7.101 降到表中 7 个更早的版本时，官方原版和补丁版均要求重新登录。

### 安装选项（默认都勾选）

| 选项 | 作用 | 还原 |
|---|---|---|
| 精简组件 | 把看图、播放器、AI 引擎、语音、同步引擎和 Office 插件等移到 `nd_purify\removed`。8.9.7.101 实测约 670 MB，体积随客户端版本而异 | 卸载时原样放回 |
| 移除资源管理器集成 | 去掉文件右键菜单里的百度网盘项、同步覆盖图标和 Win11 新右键菜单包。需要管理员权限，会弹出一次系统确认；拒绝则只跳过这一项 | 卸载时再确认一次，从 `.reg` 备份恢复 |

## 去掉了什么

- **广告与推广**：顶栏/侧栏/右下角广告、活动弹窗、福利任务、会员推销与续费引导、游戏中心、金币、搜索框热词、“下载手机客户端”入口
- **头像卡片**：只留昵称、会员到期时间、帮助中心、切换账号
- **办公套件与 AI**：新建笔记 / AI PPT、格式转换、文字提取、转文字、导入在线文档、AI 剪辑 / 总结 / 修图、云打印、库库AI（含后台预加载的隐藏网页）、知识库、搜索栏 AI 工具、AI 下载任务
- **非核心功能入口**：同步空间、消息、工具、回收站、隐藏空间（保险箱）、自动备份、文档历史版本、文件快传、用手机打开
- **在线预览**：双击文件改为“下载后用系统默认程序打开”。只有图片 / 视频 / 音乐 / 文档等类型会被打开；程序、脚本、压缩包只在文件夹中定位，**不会自动运行**
- **托盘菜单**：版本升级、一键反馈、同步与回收站相关项
- **设置页**：与网盘无关的选项
- **自动更新**：关闭（否则更新会覆盖补丁）

## 保留了什么

浏览网盘、上传、下载、分享（创建 / 取消链接）、转存和订阅、云添加（链接 / BT）、新建文件夹、重命名 / 复制 / 移动 / 删除、快捷访问。
删除的文件仍进入网盘回收站，需要找回时用网页版 <https://pan.baidu.com>。会员权益和下载速度由百度服务器决定，补丁不涉及。

## 卸载

设置 → 应用 → 已安装的应用 → “百度网盘纯净补丁（去广告/去营销）” → 卸载。会还原原版 `core.asar`、自动更新、移出的组件、“打开方式”注册和资源管理器集成。

## 常见问题

- **一直显示“应用程序被修改，请重新安装”**：百度网盘内置的完整性检查发现文件被修改后会弹这个框；补丁的后台程序会自动把它隐藏（网盘照常使用）。如果它一直显示，通常是百度网盘被“以管理员身份运行”了，Windows 不允许普通权限的程序操作管理员程序的窗口。正常方式打开即可。**不要点框里的“确定”或关闭按钮**，那会退出百度网盘。
- **提示“暂时还没有适配你的百度网盘版本”**。如果使用上表的版本，请先确认安装时能访问 GitHub，再核对官方安装包的 SHA-256。找不到有效方案时，安装器会保留当前客户端文件。
- **提示“方案校验失败”**：下载到的方案签名或哈希不对（可能被篡改或网络出错），安装器已中止且没有改动任何文件。请重试或下载最新安装器。
- **断网能装吗**：取决于包内是否包含匹配方案。v1.2.0 内置 8.9.7.101，其它表内版本通过 GitHub 获取。
- **提示“没有写入权限”**：百度网盘装在 Program Files 等目录，请右键安装器“以管理员身份运行”。
- **百度网盘装在别的位置（免安装版等）**：先打开百度网盘再运行安装器，安装器会从正在运行的进程找到它。
- **想升级百度网盘**：先卸载补丁，再升级百度网盘，然后重新运行安装器（新版本需要已有对应方案）。
- **日志**：`%LOCALAPPDATA%\BaiduNetdiskPurify-install.log`（安装）、`%APPDATA%\baidunetdisk\nd_purify.log`（被拦截的请求）、`%APPDATA%\baidunetdisk\nd_hide_notice.log`（提示隐藏）

## 工作原理

- 客户端界面是 Electron 应用，界面逻辑位于 `module\BrowserEngine\resources\core.asar`。维护者使用 `scripts/portable/rules/` 为不同构建定位代码并生成精确替换。安装器核对原始文件和输出的 SHA-256，并要求每个方案锚点恰好出现一次。
- 入口尽量在**数据层**移除（菜单 / 工具条 / 导航的数据过滤、开关置 false），而不是只用 CSS 隐藏；CSS 只做兜底。
- 营销请求在三条网络通道上统一过滤：原生 `fetchApi`、Chromium `webRequest`、主进程 axios（`patch/__nd_purify_main.js`）。被拦的 axios 请求以“用户手动取消”的方式失败，客户端不会因此报网络错误。
- 修改 `core.asar` 会触发原生完整性检查的弹窗。`nd_hide_notice.ps1` 作为登录时启动的计划任务在后台运行（经 `conhost --headless` 启动，没有窗口），只用 `ShowWindow(SW_HIDE)` 隐藏这个弹窗，不点任何按钮。
- 安装器使用 Inno Setup，默认按用户安装，在安装向导复制文件前验证方案并运行补丁器。PowerShell 补丁器 `nd_patcher.ps1` 的输出可复现，运行时只需要 Windows PowerShell。

### 补丁方案（schemes）

每个百度网盘版本一份方案，放在 `schemes/<版本>/`：`patchset.json`（补丁规则 + 原版与输出的 SHA-256）、`files/`（注入模块）、`components.json`（精简时移出的组件）。目录名只是给人看的标签，**匹配只看原版 `core.asar` 的 SHA-256**。

- `schemes/index.json` 列出所有方案及其中每个文件的 SHA-256，并用 RSA-3072 签名（`index.json.sig`）。安装器内置公钥 `installer/payload/scheme_pubkey.xml`。
- 安装时先从 GitHub 获取索引并验签，再逐个下载方案文件、核对哈希；任何一步不通过都不会使用该在线方案，而是改用安装器内置的方案（同样验签）。两者都不可用时中止，不改动任何文件。
- 私钥不在仓库里，只保存在维护者电脑上（Windows DPAPI 加密）。

## 目录结构

```
schemes/                      按版本的补丁方案及已签名索引
installer/
  BaiduNetdiskPurify.iss      Inno Setup 脚本
  info_before.txt, lang/      安装须知、简体中文界面
  payload/                    安装包实际内容
    install.ps1 / uninstall.ps1   安装（含方案获取与校验）/ 还原步骤
    nd_patcher.ps1            纯 PowerShell 补丁器（读取方案中的 patchset.json）
    scheme_pubkey.xml         方案签名公钥
    nd_hide_notice.ps1        完整性提示隐藏器
    shellext.ps1              资源管理器集成的移除 / 恢复（带 .reg 备份）
patch/                        注入模块源码（过滤规则、渲染端样式）
loader/purify_renderer.css    渲染端兜底样式（由 gen_renderer.py 生成 patch/__nd_purify_renderer.js）
scripts/                      构建、测试、方案制作与跨版本移植工具
docs/使用说明.txt
```

## 从源码构建

需要 Node.js 18+、Python 3、Windows PowerShell 5.1、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。
原版 `core.asar` 请从**你自己安装的**客户端复制：`%APPDATA%\baidu\BaiduNetdisk\module\BrowserEngine\resources\core.asar`
（8.9.7 build 497 的 SHA-256 为 `280214b601b9dd28b932879c931d7bc9735bfd39b231e99412327aa3ea8c71c2`）。

```powershell
npm install --prefix tools                       # 只需要 @electron/asar
python scripts/gen_renderer.py loader/purify_renderer.css patch/__nd_purify_renderer.js

# Node 构建 + 测试（核对规则、语义测试注入代码）
node scripts/patch.js <原版core.asar> out/core.asar tools patch
node scripts/test_filter.js patch/__nd_purify_main.js
node scripts/test_injected.js out/core.asar tools

# 生成该版本的方案（用 PowerShell 补丁器实测出期望输出哈希），再重建并签名索引（签名需要维护者私钥）
powershell -ExecutionPolicy Bypass -File scripts/make_scheme.ps1 -Name 8.9.7.101 -CoreAsar <原版core.asar> -Components schemes/8.9.7.101/components.json
powershell -ExecutionPolicy Bypass -File scripts/sign_schemes.ps1

ISCC installer/BaiduNetdiskPurify.iss            # 生成 installer/release/BaiduNetdisk-Purify-Setup.exe
```

8.9.7.101 方案的补丁输出（PowerShell 补丁器）SHA-256 为 `5dc81e11b6fdc4490f1161013522c901a77f9a52fa3836b483fcead6b56f6168`。

从源码编译时，Inno Setup 会把当前检出的 `schemes/` 打包为离线后备。GitHub Release 提供的 v1.2.0 安装器在新增 8 个方案前构建，随包内置的是 8.9.7.101 方案。

### 为新版本制作方案

1. 用 7-Zip 从官方安装包中解出 `module\BrowserEngine\resources\core.asar`（**不要运行安装包**）。
2. `node scripts/compat.js <core.asar> tools`：逐条检查现有规则在新版本里是否还能唯一命中；`node scripts/fuzzy_locate.js tools <core.asar> --list`：把变量名通配后看锚点能否重新定位。
3. 在 `scripts/portable/rules/` 调整构建时使用的规则。将解包文件放在 `<样本目录>/<版本>/core/`，用 `node scripts/portable/check.js --cores <样本目录> --tools tools` 检查规则匹配、JS 语法和 8.9.7 回归结果。
4. 运行 `make_scheme.ps1`，指定原版文件、版本和组件清单，用 `-OutputRoot out/scheme-candidates` 保存待测试方案。生成时会调用实际安装器使用的 PowerShell 补丁器，把输出 SHA-256 写入方案。用同一个补丁器重新生成测试文件后，可运行 `test_injected.js` 验证注入函数。
5. 在该版本的独立测试环境中验证启动、登录、文件浏览、上传、下载、分享、转存和卸载还原。测试通过后，将对应方案放入 `schemes/`，运行 `sign_schemes.ps1`，再提交方案和签名索引。

## 许可

本仓库中的代码以 [MIT](LICENSE) 许可发布。“百度网盘”及相关商标归百度所有。若权利人认为本项目不妥，请提 Issue，我会处理。
