// Slim UI and startup: sidebar tabs, auto-backup guide/banner, background tasks, renderer script injection.
'use strict';
const { MARK } = require('./index');

module.exports = {
  rules: [
    { id: 'slim.safebox-tab', legacy: [95], name: '精简: 隐藏空间(保险箱)标签',
      find: /\{key:10,text:"隐藏空间",index:[\w$]+\(10\),subEvt:"concealEvt",isShow:[\w$]+\(10\),group:2\},/,
      repl: MARK },

    { id: 'slim.recycle-tab', legacy: [96], name: '精简: 回收站标签',
      find: /,\{key:13,text:"回收站",index:[\w$]+\(13\),subEvt:"recycleEvt",isShow:[\w$]+\(13\),group:2\}/,
      repl: MARK },

    { id: 'slim.backup-guide', legacy: [100], name: '精简: 自动备份引导弹窗(tryShowBackupGuide)',
      find: /tryShowBackupGuide:function\(\)\{/,
      repl: m => m + MARK + 'return;' },

    // initAutoBackupState (banner status polling) was introduced together with the upload-page backup banner (8.7.x)
    { id: 'slim.backup-banner-poll', legacy: [101], name: '精简: 自动备份横幅状态轮询(tpBackup)',
      feature: /initAutoBackupState/,
      find: /initAutoBackupState:function\(\)\{/,
      repl: m => m + MARK + 'return;' },

    { id: 'slim.upload-backup-banner', legacy: [102], name: '精简: 上传页备份横幅',
      feature: 'upload-backup-banner',
      where: { contains: 'visibilityRevision' },
      find: /visible:function\(\)\{(?=return this\.visibilityRevision,)/,
      repl: m => m + MARK + 'return!1;' },

    { id: 'slim.bg-ai-collect', legacy: [115], name: '后台减负: AI收藏/seston剪贴板监听 (S07)',
      where: { contains: 'ECLIPBOARDTYPE_AI_COLLECT' },
      find: /(?<![\w$])[\w$]+(?:\(\))?\.app\.\$seston\.monitorClipboardChange\([\w$]+(?:\.[\w$]+)*\.ECLIPBOARDTYPE_AI_COLLECT\),/,
      repl: MARK + '0,' },

    { id: 'slim.bg-workspace', legacy: [116], name: '后台减负: 同步空间初始化 (S08)',
      where: { contains: 'initWorkSpaceCallback' },
      find: /(?<![\w$])([\w$]+(?:\(\))?)\.app\.\$workspace&&\1\.app\.\$workspace\.initWorkSpaceCallback\(\)/,
      repl: MARK + '0' },

    { id: 'slim.bg-cloudprint', legacy: [117], name: '后台减负: 云打印注册 (S09)',
      feature: 'cloudPrintRegister',
      where: { contains: 'cloudPrintRegister' },
      find: /(?<![\w$])[\w$]+(?:\(\))?\.app\.\$cloudPrint\.cloudPrintRegister\(\),/,
      repl: MARK + '0,' },

    // the call directly after setUserConf(...userIdentify:X.getUserIdentify})) ; anchored on the preceding text so that it is
    // independent of the S07 edit that follows it
    { id: 'slim.bg-safebox', legacy: [118], name: '后台减负: 保险箱信息查询 (S10)',
      find: /(?<=userIdentify:([\w$]+)\.getUserIdentify\}\)\),)\1\.getSafeBoxInfo\(\),/,
      repl: MARK + '0,' },

    { id: 'slim.bg-ai-assistant', legacy: [119], name: '后台减负: AI助手服务推荐轮询 (S11)',
      feature: 'startServiceRecommendPolling',
      find: /startServiceRecommendPolling:function\(\)\{/,
      repl: m => m + MARK + 'return;' },

    { id: 'slim.renderer-script', legacy: [120], name: '注入渲染端样式脚本(index.html)',
      where: 'index.html',
      find: '</head>',
      repl: '<script src=./__nd_purify_renderer.js></script></head>' },
  ],
  dropped: [],
};
