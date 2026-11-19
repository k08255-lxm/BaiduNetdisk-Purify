// 百度网盘 去营销补丁 —— 补丁规则定义（唯一来源）
// 被 patch.js（Node 构建）与 gen_patchset.js（导出给 PowerShell 补丁器）共同使用
'use strict';
const MARK = '/*nd_purify*/';

// 文件操作工具条要移除的项（按 key）
const TOOLBAR_LEFT_DROP = [
  'new_note',   // 新建文件 ▾（新建笔记 / AI PPT）
  'record',     // 实时录音（录音纪要）
  'lead_pand',  // 导入在线文档
  'export_safe', 'move_to_safe', 'lock_safe', // 保险箱 / 隐藏空间
  'add_backup', // 自动备份
];
const TOOLBAR_RIGHT_DROP = [
  'add_to_knowledge', // 添加到(我的)知识库
  'ai_summary',       // AI总结
  'ai_photo',         // 图片精修
  'switch_text',      // 转文字
  'file_qa',          // 文件问答
  'cloud_print',      // 云打印
  'free_board',       // 自由画布
  'ai_video_edit',    // AI剪辑 ▾
  'export_safe',      // 保险箱导出
];
// 右键菜单要移除的项（菜单项无 key，只能按显示名称）
const CONTEXT_MENU_DROP = [
  'AI知识库', '以该文件夹新建知识库', '添加到我的知识库',            // 知识库 / 库库AI
  '导入在线文档', '新建笔记', 'AI PPT', '转word', '转Word',            // 办公套件
  'PDF工具', '格式转换', '文字提取', '文字识别', '转文字', '导入自由画布', '简单学习',
  'AI总结', '文件问答', '云打印',
  'AI剪辑', 'AI剪素材', 'AI视频高光', '在线剪辑', '图片精修',          // AI 剪辑/修图
  '移入隐藏空间', '移出隐藏空间', '移入网盘文件',                      // 保险箱 / 隐藏空间
  '成为超级会员',                                                       // 藏在右键菜单里的推销
  '文档历史版本',                                                       // SVIP 推销（未开通时弹开通会员）
  '复制到同步空间',                                                     // 同步空间已移除
  '用手机打开',                                                         // 手机 App 推广（主开关另在 main.js 关闭）
];
// 双击/下载后自动打开时允许的文件类型（其余类型只在资源管理器中定位，绝不自动运行）
const SAFE_OPEN_EXT = 'jpe?g|png|gif|bmp|webp|heic|heif|tiff?|svg|ico|mp4|mkv|avi|mov|wmv|flv|webm|m4v|ts|rmvb|rm|3gp|' +
  'mp3|wav|flac|aac|ogg|m4a|wma|ape|pdf|docx?|xlsx?|pptx?|wps|et|dps|txt|md|csv|rtf|epub|json|xml|log';
const SLIM = require('./patchset_slim.js');
// 自己网盘里的普通文件（排除他人分享、订阅、共享目录、聊天文件）
const OWN_PATH_RE = '/^\\/_pcs_\\.(knowledge_subscribe|sharedir_receive)/';

const PATCHES = [
  // ---------- main.js（主进程）----------
  { file: 'main.js', name: '加载去营销模块',
    find: 'module.exports=function(e){',
    repl: MARK + 'try{require(require("path").join(__dirname,"__nd_purify_main.js"))}catch(__e){console.error("nd_purify load failed",__e)}module.exports=function(e){' },
  { file: 'main.js', name: '原生HTTP出口过滤(fetchApi)',
    find: 'fetchApi(e,n,t,o="post"){let d=y(),E=d.cookie;',
    repl: 'fetchApi(e,n,t,o="post"){' + MARK + 'const __p=global.__ndPurify&&global.__ndPurify.filterApi(e,n);if(__p&&__p.block)return Promise.resolve({httpTask:-1,errNo:-1,ajaxError:!0});if(__p&&__p.url)e=__p.url;let d=y(),E=d.cookie;' },
  { file: 'main.js', name: '主进程axios($Net)过滤',
    find: 'o.app.$Net=x(y,C),',
    repl: 'o.app.$Net=x(y,C),' + MARK + 'global.__ndPurify&&global.__ndPurify.guardAxios&&global.__ndPurify.guardAxios(o.app.$Net),' },
  { file: 'main.js', name: 'Chromium网络过滤(onBeforeRequest)',
    find: 'i.session.defaultSession.webRequest.onBeforeRequest((e,n)=>{',
    repl: 'i.session.defaultSession.webRequest.onBeforeRequest((e,n)=>{' + MARK + 'const __r=global.__ndPurify&&global.__ndPurify.filterWeb(e.url);if(__r&&__r.cancel)return n({cancel:!0});if(__r&&__r.redirectURL)return n({cancel:!1,redirectURL:__r.redirectURL});' },
  { file: 'main.js', name: '右下角广告窗(showPalletAdv)',
    find: 'i.ipcMain.on("showPalletAdv",(e,n)=>{',
    repl: 'i.ipcMain.on("showPalletAdv",(e,n)=>{' + MARK + 'return;' },
  { file: 'main.js', name: '分享页广告(onShowLinkShareAd)',
    find: 'i.ipcMain.on("onShowLinkShareAd",(n,t,i)=>{',
    repl: 'i.ipcMain.on("onShowLinkShareAd",(n,t,i)=>{' + MARK + 'return;' },
  { file: 'main.js', name: '游戏中心标签页(openGameTab)',
    find: 'gt=(e,n)=>{var t,r;i.app.mainBrowserwindow.webContents.send("openGameTab"',
    repl: 'gt=(e,n)=>{' + MARK + 'return;var t,r;i.app.mainBrowserwindow.webContents.send("openGameTab"' },

  // ---------- renderer.js（广告 vuex store：所有广告位状态保持为空）----------
  ...[
    ['setMemberChannel', 'memberChannel'], ['setHeaderAd', 'headerAd'], ['setAsideAd', 'asideAd'],
    ['setTextAd', 'textAd'], ['setActivityConfig', 'activityConfig'], ['setSideActivityVisible', 'sideActivityVisible'],
    ['setTransferAd', 'transferAd'], ['setTransferAdNative', 'transferAdNative'], ['setPalletAd', 'palletAd'],
    ['setLinkShareAdNative', 'linkShareAdNative'], ['setLinkShareDetailAdNative', 'linkShareDetailAdNative'],
  ].map(([m, f]) => ({ file: 'renderer.js', name: '广告状态置空 ' + m,
    find: `${m}(e,t){e.${f}=t}`, repl: `${m}(e,t){${MARK}}` })),

  // ---------- 45.js（主窗口左侧导航：移除 同步 / 消息 / 工具 入口）----------
  { file: '45.js', name: '移除侧栏 同步/消息/工具/库库AI/知识库',
    find: 'return i.top=this.addMainItemTip(i.top),i}',
    repl: 'return i.top=this.addMainItemTip(i.top.filter(function(x){' + MARK +
          'var ev=x&&(x.evt||(x.list&&x.list[0]&&x.list[0].evt));' +
          'return ["conversationEvt","utilEvt","workspace","autoBackupEvt","aIAssistantEvt","aiKnowledgeEvt","coSpaceEvt"].indexOf(ev)<0;})),i}' },
  { file: '45.js', name: '侧栏底部: 去「下载手机/各平台客户端」入口',
    find: 'bottom:Object(jo.e)()||this.comMasAble?[]:[{img:dr,classStr:"wp-aside-nav__main-utils",uri:Object(K.zi)(K.Fc)}]',
    repl: 'bottom:' + MARK + '[]' },

  // ---------- 45.js 顶栏右侧：福利任务 / 会员按钮 / 游戏 / 金币；“≡”菜单的 版本升级 ----------
  { file: '45.js', name: '顶栏: 去「福利任务」(🎁)',
    find: '!this.isCoSpaceRoute&&this.isShowRewardTask&&t.push({key:"headerRewardTask",comp:"headerRewardTask"})',
    repl: MARK + '!1&&t.push({key:"headerRewardTask",comp:"headerRewardTask"})' },
  { file: '45.js', name: '顶栏: 去「会员中心」按钮',
    find: 'this.isCoSpaceRoute||t.push({comp:"headerVipBtn",evt:"vipCenterEvt"})',
    repl: MARK + '!0||t.push({comp:"headerVipBtn",evt:"vipCenterEvt"})' },
  { file: '45.js', name: '顶栏: 去「游戏中心」',
    find: 't=[].concat(I()(t),[{comp:"headerGame",evt:"gameEvt",icon:"icon-game"}])',
    repl: MARK + 't=t' },
  { file: '45.js', name: '顶栏: 去「金币」',
    find: 'this.isShowGoldCoinIcon&&t.push({comp:"headerGoldCoin",evt:"goldCoinCenter",icon:"gold-coin"})',
    repl: MARK + '!1&&t.push({comp:"headerGoldCoin",evt:"goldCoinCenter",icon:"gold-coin"})' },
  { file: '45.js', name: '「≡」菜单: 去「版本升级」(自动更新会覆盖补丁)',
    find: 'updateConfig:function(){return this.comMasAble?{}:[{icon:"icon-update",title:"版本升级",name:"update",evt:"versionUpdateEvt"}]}',
    repl: 'updateConfig:function(){' + MARK + 'return[]}' },

  // ---------- 头像卡片（新版 UserInfoPopover，适配层在 45.js）----------
  // 只保留 帮助中心 / 切换账号；去掉 AI点数、会员卡片(权益/立即续费/等级福利二维码)、推广频道、到期续费气泡；
  // 点击头像/会员徽章/续费等所有其它导航事件一律忽略（原来会打开“会员中心”售卖页）
  { file: '45.js', name: '头像卡片: 只保留 帮助中心/切换账号',
    find: 'a=e.channelList||[],o=e.navList||[],n=e.benefits&&',
    repl: MARK + 'a=[],o=(e.navList||[]).filter(function(x){return x&&["helpCenter","logout"].indexOf(x.evt)>=0}),n=e.benefits&&' },
  { file: '45.js', name: '头像卡片: 去 AI点数 / 会员卡片 / 推广频道',
    find: '"ai-credit":e.aiCredit,"membership-card":e.membershipCard,"channel-list":e.channelList,',
    repl: MARK + '"ai-credit":null,"membership-card":null,"channel-list":[],' },
  { file: '45.js', name: '头像卡片: 导航事件白名单(头像点击不再打开会员中心)',
    find: 'onNav:function(e){switch(e&&e.evt||""){case"upgradeSystemClk"',
    repl: 'onNav:function(e){' + MARK + 'if(!e||["helpCenter","logout"].indexOf(e.evt)<0)return;switch(e&&e.evt||""){case"upgradeSystemClk"' },
  ...['attrs:{userHref:', 'attrs:{"user-href":'].map(k => ({ file: '45.js', name: '头像: 去会员到期/续费气泡 (' + k + ')',
    find: 't("user-vip-tip",{staticClass:"wp-header-user__tooltip",' + k,
    repl: MARK + '(function(){return e._e()})("user-vip-tip",{staticClass:"wp-header-user__tooltip",' + k })),
  { file: '107.js', name: '头像卡片: AI点数区 仅在有数据时渲染(适配层已传 null)',
    find: 'v("svg",{attrs:{width:"1",height:"10",viewBox:"0 0 1 10",fill:"none",xmlns:"http://www.w3.org/2000/svg"}},[v("line",{attrs:{x1:"0.25",y1:"1.09279e-08",x2:"0.25",y2:"10",stroke:"#ebeef5","stroke-width":"0.5"}})]),v("div",{staticClass:"uip-ai-area",on:{click:P.emitAiPointNav}}',
    repl: MARK + '(f.aiCredit?v:function(){return f._e()})("svg",{attrs:{width:"1",height:"10",viewBox:"0 0 1 10",fill:"none",xmlns:"http://www.w3.org/2000/svg"}},[v("line",{attrs:{x1:"0.25",y1:"1.09279e-08",x2:"0.25",y2:"10",stroke:"#ebeef5","stroke-width":"0.5"}})]),(f.aiCredit?v:function(){return f._e()})("div",{staticClass:"uip-ai-area",on:{click:P.emitAiPointNav}}' },

  // ---------- 库库AI“第二大脑”：主窗口底部隐藏 webview 不再加载（网络层另有 /aipan/search 拦截兜底）----------
  { file: '45.js', name: '库库AI: 底部隐藏 webview 不加载',
    find: 'loadUrl(){let e=new URL("http://not.exists");if("bottom"===this.position){',
    repl: 'loadUrl(){let e=new URL("http://not.exists");if("bottom"===this.position){' + MARK + 'return;' },

  // ---------- 行内悬停按钮：去「添加到我的知识库」「AI总结」（文件列表/搜索/最近 等 5 个列表组件）----------
  ...['47.js', '51.js', '52.js', '71.js', '77.js'].flatMap(f => [
    { file: f, name: '行内按钮: 去知识库', find: 'canShowKnowledgeIcon:function(){return!(',
      repl: 'canShowKnowledgeIcon:function(){' + MARK + 'return!1;return!(' },
    { file: f, name: '行内按钮: 去AI总结', find: 'canShowAiSummaryIcon:function(){var e=this;return',
      repl: 'canShowAiSummaryIcon:function(){' + MARK + 'return!1;var e=this;return' },
  ]),

  // ---------- 文件快传（手机→电脑，已被“用手机打开”取代）/ 用手机打开 ----------
  { file: 'main.js', name: '关闭「用手机打开」总开关(右键/更多菜单/预览)',
    find: 'o.app.$pcNaTransSwitch="0"!==(o.app.$getAppConfByKey("application","pc_na_trans_switch")||"0")',
    repl: 'o.app.$pcNaTransSwitch=' + MARK + '!1' },
  ...['renderer.js', 'main.js'].map(f => ({ file: f, name: '传输页: 去「文件快传」',
    find: ',{"type":"fileTransfer","value":"文件快传","active":0,"icon":"menu_fileTransfer","router":"fileTransfer"}',
    repl: '' })),
  { file: '66.js', name: '设置: 去「文件快传 / 快传位置」',
    find: 't.isWin?e("section",{staticClass:"transfer-section transfer-quick-path"}',
    repl: MARK + '!1?e("section",{staticClass:"transfer-section transfer-quick-path"}' },

  // ---------- 云添加：去「添加AI下载任务」（天河配置开关；网络层另剥离对应配置键）----------
  ...['q', 'af'].map(v => ({ file: '45.js', name: '云添加: 去「添加AI下载任务」(' + v + ')',
    find: 'e.aiDownloadEntranceVisible=Object(' + v + '.d)(t)', repl: 'e.aiDownloadEntranceVisible=' + MARK + '!1' })),
  ...['47.js', '51.js', '52.js', '57.js', '62.js', 'renderer.js'].map(f => ({ file: f, name: '云添加: 去「添加AI下载任务」',
    findRe: /e\.aiDownloadEntranceVisible=Object\(([\w$]+)\.d\)\(t\)/,
    replFn: () => 'e.aiDownloadEntranceVisible=' + MARK + '!1' })),

  // ---------- 传输列表(已完成)：去「云打印」行内按钮与右键项 ----------
  ...['57.js', '62.js'].flatMap(f => [
    { file: f, name: '传输列表: 去「云打印」按钮',
      find: 'e.comMasAble||i.row.cowork_id?e._e():t("u-tooltip",{attrs:{effect:"dark","popper-class":"bubble-tip",content:"云打印"',
      repl: MARK + '!0?e._e():t("u-tooltip",{attrs:{effect:"dark","popper-class":"bubble-tip",content:"云打印"' },
    { file: f, name: '传输列表: 去右键「云打印」',
      findRe: /Object\(([\w$]+)\.b\)\(e\.server_path\)&&i\.push\(\{name:"云打印"/,
      replFn: () => MARK + '!1&&i.push({name:"云打印"' },
  ]),

  // ---------- 托盘菜单（Windows 主托盘）：交给 __nd_purify_main.js 的 trayMenu 过滤 ----------
  { file: 'main.js', name: '托盘菜单: 去版本升级/一键反馈/同步/回收站，用户名与空间不跳购买页',
    find: 'return i.Menu.buildFromTemplate(N)},$=()=>{',
    repl: 'return i.Menu.buildFromTemplate(' + MARK + 'global.__ndPurify&&global.__ndPurify.trayMenu?global.__ndPurify.trayMenu(N,{user:h,ws:s}):N)},$=()=>{' },
  { file: '45.js', name: '库库AI: 禁用对话面板开关',
    find: 'case"changeChatVisible":if(',
    repl: 'case"changeChatVisible":' + MARK + 'break;if(' },

  // ---------- 文件操作工具条 / 右键菜单：去除办公套件与 AI 项 ----------
  // 左侧操作栏：新建文件(笔记/AI PPT)、实时录音、导入在线文档
  ...['45.js', '47.js', '51.js', '52.js', '57.js', '62.js'].map(f => ({ file: f, name: '工具条(左): 去办公/AI',
    findRe: /renderedLeftGroups:function\(\)\{return Object\((\w+)\.b\)\(this\.left_toolbarGroups,this\.leftAvailableW\)\}/,
    replFn: (m, H) => 'renderedLeftGroups:function(){return Object(' + H + '.b)((function(g){' + MARK +
      'var B=' + JSON.stringify(TOOLBAR_LEFT_DROP) + ';return Array.isArray(g)?g.map(function(x){return x&&Array.isArray(x.items)?Object.assign({},x,{items:x.items.filter(function(i){return!i||B.indexOf(i.key)<0})}):x}):g})(this.left_toolbarGroups),this.leftAvailableW)}' })),
  // 选中文件后的右侧工具条：知识库/AI总结/图片精修/转文字/文件问答/云打印/自由画布/AI剪辑
  ...['45.js', '47.js', '51.js', '52.js', '57.js', '62.js'].map(f => ({ file: f, name: '工具条(右): 去办公/AI',
    findRe: /(\w)=Object\((\w+)\.a\)\(\[(\w)\],this\.rightAvailableW,/,
    replFn: (m, o, H, a) => o + '=Object(' + H + '.a)([(function(x){' + MARK +
      'var B=' + JSON.stringify(TOOLBAR_RIGHT_DROP) + ';return x&&Array.isArray(x.items)?Object.assign({},x,{items:x.items.filter(function(i){return!i||B.indexOf(i.key)<0})}):x})(' + a + ')],this.rightAvailableW,' })),
  // 右键菜单（按菜单项名称过滤；45=文件列表 67=最近/搜索 50/53=其它列表）
  ...['45.js', '50.js', '53.js', '67.js'].map(f => ({ file: f, name: '右键菜单: 去办公/AI/推销项',
    findRe: /this\.operateList=this\[e\]/,
    // 去掉项后合并连续分隔线（type:"line"），并去掉首尾分隔线（如“文档历史版本”前后各带一条分隔线）
    replFn: () => 'this.operateList=(function(a){' + MARK + 'var B=' + JSON.stringify(CONTEXT_MENU_DROP) +
      ';if(!Array.isArray(a))return a;var o=[];a.forEach(function(x){if(x&&B.indexOf(x.name)>=0)return;' +
      'if(x&&"line"===x.type){var p=o[o.length-1];if(!o.length||p&&"line"===p.type)return}o.push(x)});' +
      'while(o.length&&o[o.length-1]&&"line"===o[o.length-1].type)o.pop();return o})(this[e])' })),
  // 图片预览底栏：库库AI/AI修图/文字提取/格式转换/转Word/转Excel/转PDF
  { file: '128.js', name: '图片预览: 去AI/格式转换按钮',
    find: 'r.concat(this.excludeBtnNames||[])',
    repl: 'r.concat(this.excludeBtnNames||[],' + MARK + '[P.BUTTON_TYPE.AI_GENFLOW,P.BUTTON_TYPE.AI_PHOTO,P.BUTTON_TYPE.OCR,P.BUTTON_TYPE.IMG_CONVERT,P.BUTTON_TYPE.IMG_TO_WORD,P.BUTTON_TYPE.IMG_TO_EXCEL,P.BUTTON_TYPE.IMG_TO_PDF].filter(Boolean))' },

  // ---------- 搜索栏：去 AI 工具分类 / AI全网搜 ----------
  { file: 'renderer.js', name: '搜索栏: 去「AI工具」分类',
    find: 'e.isNewVersion?t("ai-tools",',
    repl: MARK + '!1?t("ai-tools",' },
  { file: 'renderer.js', name: '搜索栏: 去「AI全网搜」范围',
    find: 'this.rangeList.unshift({type:"range",name:"AI全网搜",key:"AISearch"},{type:"line"}),',
    repl: MARK },

  // ---------- 库库AI：全局快捷键(Alt+Space，归还给系统窗口菜单) 与设置项 ----------
  { file: 'main.js', name: '不注册全局快捷键: 库库AI(Alt+Space)/自动备份(Alt+B)/录音(Alt+R)',
    find: 'e.forEach(e=>{if("screenshot"===e.id)return;if(!e.enabled',
    repl: 'e.forEach(e=>{if("screenshot"===e.id||' + MARK + '["ai","backup","record"].indexOf(e.id)>=0)return;if(!e.enabled' },
  { file: '66.js', name: '设置: 去「库库AI」快捷键项',
    find: '{id:"ai",name:"库库AI",accelerator:"Alt+Space",enabled:!0},',
    repl: MARK },
  { file: '66.js', name: '设置: 去「展示知识库/展示AI助手」',
    find: 'sidebarSettingList:[{label:"展示知识库",value:!0,confKey:j.hg.IS_SHOW_KNOWLEDGE},{label:"展示AI助手",value:!0,confKey:j.hg.IS_SHOW_AI_ASSISTANT}]',
    repl: 'sidebarSettingList:' + MARK + '[]' },

  // ---------- 外置组件：智能看图 ----------
  // 1) 客户端认为“智能看图未安装” → 预览/下载并打开 均回到内置预览或系统默认程序
  { file: 'renderer.js', name: '智能看图: imageViewerExist=false',
    find: 'imageViewerExist:"1"===A.$getSystemParamById(m.b.APP_PARAM_ID_IMAGE_VIEWER_EXIST)',
    repl: 'imageViewerExist:' + MARK + '!1' },
  // 2) 云端图片预览不再由服务器配置切到外置智能看图（该路径绕过 imageViewerExist）
  ...['15.js', '45.js', '50.js', '73.js'].map(f => ({ file: f, name: '智能看图: 禁用新版外置预览器',
    find: 'isSupportNewPreviewer(e,t){if(!t||!e)return!1;',
    repl: 'isSupportNewPreviewer(e,t){' + MARK + 'return!1;if(!t||!e)return!1;' })),
  // 3) 兜底：主进程启动智能看图的函数改为“用系统默认程序打开本地文件”，其余调用(云端JSON参数)直接忽略。
  //    安全闸门：只有 SAFE_OPEN_EXT 中的类型才会被打开；可执行文件/脚本/压缩包等只在资源管理器中定位，绝不自动运行。
  //    “下载并打开”、双击文件下载后打开 等所有路径都经过这里。
  { file: 'main.js', name: '下载后打开: 系统默认程序 + 安全类型闸门',
    find: 'o.app.$openImageViewer=Ga',
    repl: 'o.app.$openImageViewer=function(p){' + MARK + 'try{var s=String(p||"").trim();if(!s||s.charAt(0)==="{")return;' +
          'var m=/^"([^"]+)"/.exec(s);var f=m?m[1]:s;if(!f)return;var sh=require("electron").shell;' +
          'if(/\\.(' + SAFE_OPEN_EXT + ')$/i.test(f))sh.openPath(f);else sh.showItemInFolder(f)}catch(__e){}}' },

  // ---------- 设置页：去除与网盘无关的设置项 ----------
  { file: '66.js', name: '设置: 隐藏「智能看图」两项',
    find: 'aiImgPreviewer:function(){return',
    repl: 'aiImgPreviewer:function(){' + MARK + 'return!1;return' },
  { file: '66.js', name: '设置: 隐藏「会员样式」',
    find: 'showSestonSvipStyleSection:function(){return',
    repl: 'showSestonSvipStyleSection:function(){' + MARK + 'return!1;return' },
  { file: '66.js', name: '设置: 隐藏「智能播放器设为默认」',
    find: 't.isWin?e("check-box",{staticStyle:{"margin-top":"10px"},attrs:{checked:t.mediaDefaultPlayer',
    repl: MARK + '!1?e("check-box",{staticStyle:{"margin-top":"10px"},attrs:{checked:t.mediaDefaultPlayer' },
  // 「隐私设置」只含 好友验证/商品推荐/智能化功能授权，整栏移除（两处菜单定义都改）
  ...['57.js', '66.js'].map(f => ({ file: f, name: '设置: 移除「隐私设置」菜单',
    find: '{name:"隐私设置",logType:"privacySet",type:1,order:a.Privacy},',
    repl: MARK })),

  // ---------- 精简：在线预览 → 下载后用系统程序打开 ----------
  // 自己网盘里的文件：若本地已下载过则直接打开，否则加入下载（下载完成由客户端自带的“下载并打开”流程触发打开）。
  // 查询下载历史 1.5 秒无回调则直接下载，避免双击无反应。他人分享/订阅/聊天文件保持原逻辑（转存前无法下载）。
  // 1) 主窗口：双击 / 回车 / 右键“打开”（openOrPreview 的普通文件分支）
  { file: '45.js', name: '精简: 双击文件 = 下载后打开（主窗口）',
    find: 'case 24:if(navigator.onLine||G.app.$networkOnline||',
    repl: 'case 24:' + MARK + 'if(s.path&&"/"===s.path.charAt(0)&&!' + OWN_PATH_RE + '.test(s.path)){(function(){var __d=!1,__go=function(){if(__d)return;__d=!0;' +
          'i.addDownloadTask([{md5:s.md5||"",size:s.size,is_dir:0,server_path:s.path,from_manual:1,downloadAndEditSwitch:!0}])};' +
          'try{G.app.$getLocalPathFromDownloadHistory(s.path,function(e,t){if(__d)return;if(0===e&&t&&Ib.existsSync(t)){__d=!0;G.app.$openImageViewer(\'"\'+t+\'"\');return}__go()})}catch(__e){}' +
          'setTimeout(__go,1500)})();return n.abrupt("return")}if(navigator.onLine||G.app.$networkOnline||' },
  // 2) 其余调用方（最近文件、搜索结果、时间线等直接调用 PreviewManager.preview 的地方）
  { file: 'renderer.js', name: '精简: 预览总入口 = 下载后打开（其它窗口/列表）',
    find: 'preview(e,t){e.previewStartTime=Date.now();',
    repl: 'preview(e,t){' + MARK + 'try{var __p=e&&(e.server_path||e.path),__f=t&&t.from;' +
          'if(__p&&"/"===String(__p).charAt(0)&&!' + OWN_PATH_RE + '.test(String(__p))&&!e.from_uk&&!e.fromUk&&!e.shareInfo&&!e.share_info&&!e.sender&&!e.fileUrl&&!e.isChat&&(!__f||(__f!==p.Ae&&"conversation"!==__f))){' +
          'var __d=!1,__go=function(){if(__d)return;__d=!0;ne.default.dispatch("downloading/addDownloadTask",[{md5:e.md5||"",size:e.size,is_dir:0,server_path:String(__p),from_manual:1,downloadAndEditSwitch:!0}])};' +
          'try{se.$getLocalPathFromDownloadHistory(String(__p),function(c,l){if(__d)return;if(0===c&&l&&window.require&&window.require("fs").existsSync(l)){__d=!0;se.$openImageViewer(\'"\'+l+\'"\');return}__go()})}catch(__e){}' +
          'setTimeout(__go,1500);return Promise.resolve({fs_id:e.fs_id})}}catch(__e){}e.previewStartTime=Date.now();' },

  // ---------- 精简：回收站 / 保险箱 / 备份 的入口与后台（workflow 分析 + 对抗审查通过，见 patchset_slim.js）----------
  ...SLIM.ui.map(p => ({ file: p.file, name: p.name, find: p.find, repl: p.repl })),
  // 搜索页 / 聊天搜索页 的右侧工具条（上面的正则补丁匹配不到这两处）
  ...SLIM.toolbars.map(t => ({ file: t.file, name: '工具条(右,' + t.file + '): 去保险箱/备份/办公/AI',
    find: t.find,
    repl: t.find.replace(/\(\[t\],this\.rightAvailableW\)/, '([(function(x){' + MARK + 'var B=' +
      JSON.stringify([...new Set([...TOOLBAR_LEFT_DROP, ...TOOLBAR_RIGHT_DROP])]) +
      ';return x&&Array.isArray(x.items)?Object.assign({},x,{items:x.items.filter(function(i){return!i||B.indexOf(i.key)<0})}):x})(t)],this.rightAvailableW)') })),
  ...SLIM.startup.map(p => ({ file: p.file, name: p.name, find: p.find, repl: p.repl })),

  // ---------- index.html（所有窗口加载渲染端隐藏样式）----------
  { file: 'index.html', name: '注入渲染端样式',
    find: '</head>', repl: '<script src=./__nd_purify_renderer.js></script></head>' },
];
const NEW_FILES = ['__nd_purify_main.js', '__nd_purify_renderer.js'];

module.exports = { MARK, PATCHES, NEW_FILES, TOOLBAR_LEFT_DROP, TOOLBAR_RIGHT_DROP, CONTEXT_MENU_DROP };
