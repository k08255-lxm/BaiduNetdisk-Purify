// Settings window (8.9.7: 66.js / 57.js / 46.js) + floating bubble menu: remove marketing / AI / non-core entries.
'use strict';
const { MARK } = require('./index');

// 8.9.7 embeds the same settings-menu config module in 46/57/62/66.js. The 1.x patch only touched a subset of the
// copies (privacy: 57+66, backup: 46+57+66); to stay byte-identical with it, 62.js (and 46.js for privacy) are left alone.
// Other builds never have files with those names that contain the menu config, so the exclusion is harmless there.
const NOT_62 = /^(?!62\.js$)[^/\\]+\.js$/;
const NOT_62_46 = /^(?!62\.js$|46\.js$)[^/\\]+\.js$/;

// Guard leading identifiers against retries at each offset inside long base64 runs.
module.exports = {
  rules: [
    { id: 'settings.quick-transfer-section', legacy: [45], name: '设置: 去「文件快传 / 快传位置」',
      // >= 8.8.3: <section class="transfer-section transfer-quick-path">;  <= 8.7.9: <div class="setProxy"><div class="desc">文件快传</div>...
      find: /(?<![\w$.])[\w$]+\.isWin(\?[\w$]+\("(?:section",\{staticClass:"transfer-section transfer-quick-path"\}|div",\{staticClass:"setProxy"\},\[[\w$]+\("div",\{staticClass:"desc"\},\[[\w$]+\._v\("文件快传"\)))/,
      repl: (m, rest) => MARK + '!1' + rest },

    { id: 'settings.hotkey-ai', legacy: [80], name: '设置: 去「库库AI」快捷键项',
      feature: 'name:"库库AI",accelerator:"Alt+Space"',
      find: '{id:"ai",name:"库库AI",accelerator:"Alt+Space",enabled:!0},',
      repl: MARK },

    { id: 'settings.sidebar-setting-list', legacy: [81], name: '设置: 去「展示知识库/展示AI助手」',
      feature: '展示知识库',
      find: /sidebarSettingList:\[\{label:"展示知识库",value:!0,confKey:[\w$]+\.[\w$]+\.IS_SHOW_KNOWLEDGE\},\{label:"展示AI助手",value:!0,confKey:[\w$]+\.[\w$]+\.IS_SHOW_AI_ASSISTANT\}\]/,
      repl: 'sidebarSettingList:' + MARK + '[]' },

    { id: 'settings.ai-img-previewer', legacy: [88], name: '设置: 隐藏「智能看图」两项',
      find: /aiImgPreviewer:function\(\)\{return/,
      repl: 'aiImgPreviewer:function(){' + MARK + 'return!1;return' },

    { id: 'settings.seston-svip-style', legacy: [89], name: '设置: 隐藏「会员样式」',
      feature: 'showSestonSvipStyleSection',
      find: /showSestonSvipStyleSection:function\(\)\{return/,
      repl: 'showSestonSvipStyleSection:function(){' + MARK + 'return!1;return' },

    { id: 'settings.media-default-player', legacy: [90], name: '设置: 隐藏「智能播放器设为默认」',
      feature: 'mediaDefaultPlayer',
      find: /(?<![\w$.])[\w$]+\.isWin(\?[\w$]+\("check-box",\{staticStyle:\{"margin-top":"10px"\},attrs:\{checked:[\w$]+\.mediaDefaultPlayer)/,
      repl: (m, rest) => MARK + '!1' + rest },

    { id: 'settings.menu-privacy', legacy: [91, 92], name: '设置: 移除「隐私设置」菜单（每份菜单配置）',
      where: NOT_62_46, mode: 'each', min: 1,
      find: /\{name:"隐私设置",logType:"privacySet",type:1,order:[\w$]+\.Privacy\},/,
      repl: MARK },

    { id: 'settings.menu-backup', legacy: [103, 104, 105], name: '精简: 设置「备份设置」菜单（每份菜单配置）',
      where: NOT_62, mode: 'each', min: 1,
      // the entry is the last array element in <= 8.8.8 (no trailing comma; `[..,]` stays valid JS)
      find: /\{name:"备份设置",logType:"backupSet",type:1,order:[\w$]+\.Backup\},?/,
      repl: MARK },

    { id: 'settings.hotkey-backup', legacy: [106], name: '精简: 快捷键「自动备份」Alt+B',
      feature: 'accelerator:"Alt+B"',
      find: '{id:"backup",name:"自动备份",accelerator:"Alt+B",enabled:!0},',
      repl: MARK },

    { id: 'settings.secondary-password', legacy: [107], name: '精简: 安全 > 二级密码（仅用于隐藏空间）',
      // >= 8.8.3: section.safety-section;  <= 8.7.9: div.safety-item
      find: /(?<![\w$.])([\w$]+\("(?:section",\{staticClass:"safety-section|div",\{staticClass:"safety-item) safety-secondary-password")\},\[/,
      repl: (m, head) => head + ',staticStyle:{display:"none"}},[' + MARK },

    { id: 'settings.bubble-backup', legacy: [108], name: '精简: 悬浮球菜单「自动备份」项',
      find: /\{id:"backup",icon:(?:[\w$]+\.a|"[^"]*"),label:"(?:文件夹)?自动备份"(?:,shortcut:this\.getShortcutLabel\("backup"\))?\},/,
      repl: MARK },
  ],
  dropped: [],
};
