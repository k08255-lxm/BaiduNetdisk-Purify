// Main process remainder: $pcNaTransSwitch, 文件快传 menu JSON, tray menu hook, global hotkeys, $openImageViewer gate,
// tray 进入回收站, telemetry S01-S03.
'use strict';
const { MARK } = require('./index');
const { ID, CAP, IMPORT, R } = require('../engine');

// the exact extension list of the 1.x SAFE_OPEN_EXT gate (keep identical)
const OPEN_VIEWER = 'function(p){' + MARK + 'try{var s=String(p||"").trim();if(!s||s.charAt(0)==="{")return;var m=/^"([^"]+)"/.exec(s);var f=m?m[1]:s;if(!f)return;var sh=require("electron").shell;' +
  'if(/\\.(jpe?g|png|gif|bmp|webp|heic|heif|tiff?|svg|ico|mp4|mkv|avi|mov|wmv|flv|webm|m4v|ts|rmvb|rm|3gp|mp3|wav|flac|aac|ogg|m4a|wma|ape|pdf|docx?|xlsx?|pptx?|wps|et|dps|txt|md|csv|rtf|epub|json|xml|log)$/i.test(f))sh.openPath(f);else sh.showItemInFolder(f)}catch(__e){}}';

const FILE_TRANSFER = ',{"type":"fileTransfer","value":"文件快传","active":0,"icon":"menu_fileTransfer","router":"fileTransfer"}';

module.exports = {
  rules: [
    { id: 'main_extra.pc-na-trans-switch', legacy: [42], where: 'main.js', name: '关闭「用手机打开」总开关(右键/更多菜单/预览)',
      find: /([\w$]+(?:\(\))?)\.app\.\$pcNaTransSwitch="0"!==\(\1\.app\.\$getAppConfByKey\("application","pc_na_trans_switch"\)\|\|"0"\)/,
      repl: (m, obj) => `${obj}.app.$pcNaTransSwitch=${MARK}!1` },

    // the JSON module with the transfer-page side menu lives in both renderer.js and main.js
    { id: 'main_extra.file-transfer-menu', legacy: [43, 44], where: ['renderer.js', 'main.js'], name: '传输页: 去「文件快传」(renderer.js + main.js)',
      find: FILE_TRANSFER, repl: '', mode: 'each', min: 2, max: 2, feature: '"icon":"menu_fileTransfer"' },

    { id: 'main_extra.tray-menu-hook', legacy: [58], where: 'main.js', name: '托盘菜单: 去版本升级/一键反馈/同步/回收站，用户名与空间不跳购买页',
      // the Windows tray builder; the match is only its final return (followed by the lock-screen menu builder)
      find: new RegExp(`return (${ID})\\.Menu\\.buildFromTemplate\\((${ID})\\)\\},${ID}=\\(\\)=>\\{(?=const e=\\[\\{label:"解除锁定")`),
      repl(m, menu, tpl, ctx) {
        const head = ctx.text.slice(0, ctx.index);
        const ws = /workspaceLabel:([\w$]+)/g, us = /userName:([\w$]+)/g;
        let a, w, u;
        while ((a = ws.exec(head))) w = a[1];
        while ((a = us.exec(head))) u = a[1];
        if (!w || !u) throw new Error('tray builder destructuring (workspaceLabel/userName) not found');
        const tail = m.slice(m.indexOf('},') );
        return `return ${menu}.Menu.buildFromTemplate(${MARK}global.__ndPurify&&global.__ndPurify.trayMenu?global.__ndPurify.trayMenu(${tpl},{user:${u},ws:${w}}):${tpl})${tail}`;
      } },

    // global hotkeys (库库AI Alt+Space / 自动备份 Alt+B / 录音 Alt+R) only exist from 8.9.7 on (globalShortcutConfig)
    { id: 'main_extra.global-hotkey-skip', legacy: [79], where: 'main.js', name: '不注册全局快捷键: 库库AI(Alt+Space)/自动备份(Alt+B)/录音(Alt+R)',
      feature: 'globalShortcutConfig',
      find: /([\w$]+)\.forEach\(([\w$]+)=>\{if\("screenshot"===\2\.id\)return;if\(!\2\.enabled/,
      repl: (m, arr, e) => `${arr}.forEach(${e}=>{if("screenshot"===${e}.id||${MARK}["ai","backup","record"].indexOf(${e}.id)>=0)return;if(!${e}.enabled` },

    { id: 'main_extra.open-image-viewer', legacy: [87], where: 'main.js', name: '下载后打开: 系统默认程序 + 安全类型闸门',
      find: /([\w$]+(?:\(\))?\.app\.\$openImageViewer=)[\w$]+(?=,)/,
      repl: (m, lhs) => lhs + OPEN_VIEWER },

    { id: 'main_extra.tray-recycle-bin', legacy: [109], where: 'main.js', name: '精简: tray menu: 进入回收站 (main process, non-native tray)',
      find: new RegExp(`\\{label:"进入回收站",click:\\(\\)=>\\{const e=${ID}\\.app\\.mainBrowserwindow;e&&\\(${IMPORT(`${ID}\\.${ID}`)}\\(\\),e\\.webContents\\.send\\(${ID},\\{name:"RecycleBin"\\}\\)\\)\\}\\},`),
      repl: MARK },

    { id: 'main_extra.telemetry-crash', legacy: [112], where: 'main.js', name: '后台减负: telemetry/crash reporting (S01)',
      // 8.9.x: f.a||m&&m.start(...)   8.5-8.8: !g.a&&h&&h.start(...)   8.10: w&&w.start(...)
      find: new RegExp(`(?:${ID}\\.a\\|\\||!${ID}\\.a&&)?(${ID})&&\\1\\.start\\(\\{productName:"baidunetdisk",companyName:"baidu",submitURL:${ID},uploadToServer:!0\\}\\)`),
      repl: MARK + '0' },

    { id: 'main_extra.telemetry-sentry', legacy: [113], where: 'main.js', name: '后台减负: telemetry (S02)',
      find: new RegExp(`(${ID})&&(${ID})&&\\1\\.init\\(\\{dsn:\\2,release:`),
      repl: (m, s, dsn) => `${s}&&${dsn}&&${MARK}!1&&${s}.init({dsn:${dsn},release:` },

    { id: 'main_extra.telemetry-memory', legacy: [114], where: 'main.js', name: '后台减负: telemetry (S03)',
      find: new RegExp(`(const\\{startMonitorMemory:(${ID})\\}=${ID}\\((?:\\d+)?\\);if\\()\\2\\(\\),`),
      repl: (m, head) => head + MARK + '0,' },
  ],
  dropped: [],
};
