// 由 scripts/gen_slim.js 自动生成 —— 来源：workflow 分析 + 对抗审查通过的补丁。请勿手改，改生成器。
'use strict';
module.exports = {
 "ui": [
  {
   "id": "ui-tab-safebox",
   "file": "45.js",
   "name": "精简: safebox/hidden space tab",
   "find": "{key:10,text:\"隐藏空间\",index:i(10),subEvt:\"concealEvt\",isShow:t(10),group:2},",
   "repl": "/*nd_purify*/"
  },
  {
   "id": "ui-tab-recycle",
   "file": "45.js",
   "name": "精简: recycle bin tab",
   "find": ",{key:13,text:\"回收站\",index:i(13),subEvt:\"recycleEvt\",isShow:t(13),group:2}",
   "repl": "/*nd_purify*/"
  },
  {
   "id": "ui-safeboxinfo-store",
   "file": "renderer.js",
   "name": "精简: safebox gating (right-click 移入隐藏空间, header-more 移入隐藏空间, move/copy dialog 隐藏空间 row, operateShow)",
   "find": "[k](e,t){e.safeBoxInfo=t}",
   "repl": "[k](e,t){/*nd_purify*/}"
  },
  {
   "id": "ui-route-recycle",
   "file": "renderer.js",
   "name": "精简: recycle bin route",
   "find": "{path:\"/RecycleBin\",name:\"RecycleBin\",component:()=>n.e(178).then(n.bind(null,7128))},",
   "repl": "{path:\"/RecycleBin\",name:\"RecycleBin\",redirect:{name:\"allFile\"}},/*nd_purify*/"
  },
  {
   "id": "ui-route-safebox",
   "file": "renderer.js",
   "name": "精简: safebox route",
   "find": "{path:\"/safebox\",name:\"safebox\",component:()=>Promise.all([n.e(1),n.e(2),n.e(5),n.e(8),n.e(51)]).then(n.bind(null,7065))},",
   "repl": "{path:\"/safebox\",name:\"safebox\",redirect:{name:\"allFile\"}},/*nd_purify*/"
  },
  {
   "id": "ui-backup-guide",
   "file": "45.js",
   "name": "精简: auto-backup guide popup",
   "find": "tryShowBackupGuide:function(){var e=this;this.backupGuideChecked||",
   "repl": "tryShowBackupGuide:function(){/*nd_purify*/return;var e=this;this.backupGuideChecked||"
  },
  {
   "id": "ui-backup-banner-init",
   "file": "45.js",
   "name": "精简: auto-backup banner status polling (tpBackup)",
   "find": "initAutoBackupState:function(){var e=this;return z()(",
   "repl": "initAutoBackupState:function(){/*nd_purify*/return;var e=this;return z()("
  },
  {
   "id": "ui-backup-banner-upload",
   "file": "62.js",
   "name": "精简: upload-page backup banner",
   "find": "visible:function(){return this.visibilityRevision,",
   "repl": "visible:function(){/*nd_purify*/return!1;return this.visibilityRevision,"
  },
  {
   "id": "ui-set-backup-66",
   "file": "66.js",
   "name": "精简: settings: 备份设置 menu",
   "find": "{name:\"备份设置\",logType:\"backupSet\",type:1,order:a.Backup},",
   "repl": "/*nd_purify*/"
  },
  {
   "id": "ui-set-backup-57",
   "file": "57.js",
   "name": "精简: settings: 备份设置 menu (second copy)",
   "find": "{name:\"备份设置\",logType:\"backupSet\",type:1,order:a.Backup},",
   "repl": "/*nd_purify*/"
  },
  {
   "id": "ui-set-backup-46",
   "file": "46.js",
   "name": "精简: settings: 备份设置 menu (third copy)",
   "find": "{name:\"备份设置\",logType:\"backupSet\",type:1,order:M.Backup},",
   "repl": "/*nd_purify*/"
  },
  {
   "id": "ui-set-shortcut-backup",
   "file": "66.js",
   "name": "精简: settings: 快捷键 自动备份 Alt+B",
   "find": "{id:\"backup\",name:\"自动备份\",accelerator:\"Alt+B\",enabled:!0},",
   "repl": "/*nd_purify*/"
  },
  {
   "id": "ui-set-secondpwd",
   "file": "66.js",
   "name": "精简: settings: 安全 > 二级密码 (only used for 隐藏空间)",
   "find": "e(\"section\",{staticClass:\"safety-section safety-secondary-password\"},[",
   "repl": "e(\"section\",{staticClass:\"safety-section safety-secondary-password\",staticStyle:{display:\"none\"}},[/*nd_purify*/"
  },
  {
   "id": "ui-bubble-backup",
   "file": "89.js",
   "name": "精简: floating bubble menu: 自动备份 item",
   "find": "{id:\"backup\",icon:D.a,label:\"自动备份\",shortcut:this.getShortcutLabel(\"backup\")},",
   "repl": "/*nd_purify*/"
  },
  {
   "id": "ui-tray-recycle",
   "file": "main.js",
   "name": "精简: tray menu: 进入回收站 (main process, non-native tray)",
   "find": "{label:\"进入回收站\",click:()=>{const e=i.app.mainBrowserwindow;e&&(Object(O.a)(),e.webContents.send(R,{name:\"RecycleBin\"}))}},",
   "repl": "/*nd_purify*/"
  }
 ],
 "toolbars": [
  {
   "id": "ui-toolbar-right-54",
   "file": "54.js",
   "find": "i=Object(O.a)([t],this.rightAvailableW);return this.hiddenToolbarItems"
  },
  {
   "id": "ui-toolbar-right-72",
   "file": "72.js",
   "find": "i=Object(_.a)([t],this.rightAvailableW);return this.hiddenToolbarItems"
  }
 ],
 "startup": [
  {
   "id": "S01",
   "file": "main.js",
   "name": "后台减负: telemetry/crash reporting (S01)",
   "find": "f.a||m&&m.start({productName:\"baidunetdisk\",companyName:\"baidu\",submitURL:n,uploadToServer:!0})",
   "repl": "/*nd_purify*/0"
  },
  {
   "id": "S02",
   "file": "main.js",
   "name": "后台减负: telemetry (S02)",
   "find": "b&&e&&b.init({dsn:e,release:",
   "repl": "b&&e&&/*nd_purify*/!1&&b.init({dsn:e,release:"
  },
  {
   "id": "S03",
   "file": "main.js",
   "name": "后台减负: telemetry (S03)",
   "find": "const{startMonitorMemory:z}=t(201);if(z(),",
   "repl": "const{startMonitorMemory:z}=t(201);if(/*nd_purify*/0,"
  },
  {
   "id": "S07",
   "file": "45.js",
   "name": "后台减负: AI collect/seston (S07)",
   "find": "G.app.$seston.monitorClipboardChange(KM.b.ECLIPBOARDTYPE_AI_COLLECT),",
   "repl": "/*nd_purify*/0,"
  },
  {
   "id": "S08",
   "file": "45.js",
   "name": "后台减负: sync space (S08)",
   "find": "G.app.$workspace&&G.app.$workspace.initWorkSpaceCallback()",
   "repl": "/*nd_purify*/0"
  },
  {
   "id": "S09",
   "file": "45.js",
   "name": "后台减负: cloud print (S09)",
   "find": "G.app.$cloudPrint.cloudPrintRegister(),",
   "repl": "/*nd_purify*/0,"
  },
  {
   "id": "S10",
   "file": "45.js",
   "name": "后台减负: safebox (S10)",
   "find": "e.getSafeBoxInfo(),",
   "repl": "/*nd_purify*/0,"
  },
  {
   "id": "S11",
   "file": "45.js",
   "name": "后台减负: AI assistant (S11)",
   "find": "startServiceRecommendPolling:function(){var e=this,t=",
   "repl": "startServiceRecommendPolling:function(){/*nd_purify*/return;var e=this,t="
  }
 ]
};
