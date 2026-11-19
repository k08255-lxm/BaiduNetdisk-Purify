// Main window shell (45.js on 8.9.7): sidebar, header right nav, avatar card, AI (库库AI) chat entry.
'use strict';
const { MARK } = require('./index');
const { CAP, IMPORT, R } = require('../engine');

// Start leading identifier captures once per token to avoid retrying every suffix of a long run.
const IDENTIFIER_START = '(?<![\\w$])';

const DROP_SIDE = '["conversationEvt","utilEvt","workspace","autoBackupEvt","aIAssistantEvt","aiKnowledgeEvt","coSpaceEvt"]';
const KEEP_NAV = '["helpCenter","logout"]';
// the main shell chunk (header + sidebar + user card legacy component) contains this marker
const SHELL = { contains: 'headerVipBtn' };

module.exports = {
  rules: [
    { id: 'header.sidebar-filter', legacy: [18], where: SHELL, name: '移除侧栏 同步/消息/工具/库库AI/知识库',
      find: R`return ${CAP}.top=this.addMainItemTip(${'\\1'}.top),${'\\1'}}`,
      repl: (m, i) => `return ${i}.top=this.addMainItemTip(${i}.top.filter(function(x){${MARK}var ev=x&&(x.evt||(x.list&&x.list[0]&&x.list[0].evt));return ${DROP_SIDE}.indexOf(ev)<0;})),${i}}` },

    { id: 'header.sidebar-download-entry', legacy: [19], where: SHELL, name: '侧栏底部: 去「下载手机/各平台客户端」入口',
      find: new RegExp(`bottom:${IMPORT('[\\w$]+\\.[\\w$]+')}\\(\\)\\|\\|this\\.comMasAble\\?\\[\\]:\\[\\{img:[\\w$]+,classStr:"wp-aside-nav__main-utils",uri:${IMPORT('[\\w$]+\\.[\\w$]+')}\\([\\w$]+\\.[\\w$]+\\)\\}\\]`),
      repl: () => 'bottom:' + MARK + '[]' },

    { id: 'header.reward-task', legacy: [20], where: SHELL, name: '顶栏: 去「福利任务」(🎁)',
      feature: 'headerRewardTask',
      find: R`!this.isCoSpaceRoute&&this.isShowRewardTask&&${CAP}.push({key:"headerRewardTask",comp:"headerRewardTask"})`,
      repl: (m, t) => `${MARK}!1&&${t}.push({key:"headerRewardTask",comp:"headerRewardTask"})` },

    { id: 'header.vip-btn', legacy: [21], where: SHELL, name: '顶栏: 去「会员中心」按钮',
      find: R`this.isCoSpaceRoute||${CAP}.push({comp:"headerVipBtn",evt:"vipCenterEvt"})`,
      repl: (m, t) => `${MARK}!0||${t}.push({comp:"headerVipBtn",evt:"vipCenterEvt"})` },

    { id: 'header.game', legacy: [22], where: SHELL, name: '顶栏: 去「游戏中心」',
      find: R`${IDENTIFIER_START}${CAP}=[].concat(${'[\\w$]+'}()(${'\\1'}),[{comp:"headerGame",evt:"gameEvt",icon:"icon-game"}])`,
      repl: (m, t) => `${MARK}${t}=${t}` },

    { id: 'header.gold-coin', legacy: [23], where: SHELL, name: '顶栏: 去「金币」',
      find: R`this.isShowGoldCoinIcon&&${CAP}.push({comp:"headerGoldCoin",evt:"goldCoinCenter",icon:"gold-coin"})`,
      repl: (m, t) => `${MARK}!1&&${t}.push({comp:"headerGoldCoin",evt:"goldCoinCenter",icon:"gold-coin"})` },

    { id: 'header.menu-update', legacy: [24], where: SHELL, name: '「≡」菜单: 去「版本升级」(自动更新会覆盖补丁)',
      find: /updateConfig:function\(\)\{return this\.comMasAble\?(?:\{\}|\[\]):\[\{icon:"icon-update",title:"版本升级",name:"update",evt:"versionUpdateEvt"\}\]\}/,
      repl: () => 'updateConfig:function(){' + MARK + 'return[]}' },

    // ---- avatar card adapter (UserInfoPopoverAdapter; exists from 8.7.9) ----
    { id: 'header.card-keep-nav', legacy: [25], where: SHELL, name: '头像卡片: 只保留 帮助中心/切换账号',
      feature: 'user-info-popover-adapter',
      find: R`${IDENTIFIER_START}${CAP}=${CAP}.channelList||[],${CAP}=${'\\2'}.navList||[],${CAP}=${'\\2'}.benefits&&`,
      repl: (m, a, e, o, n) => `${MARK}${a}=[],${o}=(${e}.navList||[]).filter(function(x){return x&&${KEEP_NAV}.indexOf(x.evt)>=0}),${n}=${e}.benefits&&` },

    { id: 'header.card-no-ai-member', legacy: [26], where: SHELL, name: '头像卡片: 去 AI点数 / 会员卡片 / 推广频道',
      feature: 'user-info-popover-adapter',
      find: R`"ai-credit":${CAP}.aiCredit,"membership-card":${'\\1'}.membershipCard,"channel-list":${'\\1'}.channelList,`,
      repl: () => MARK + '"ai-credit":null,"membership-card":null,"channel-list":[],' },

    { id: 'header.card-nav-whitelist', legacy: [27], where: SHELL, name: '头像卡片: 导航事件白名单(头像点击不再打开会员中心)',
      feature: 'user-info-popover-adapter',
      find: R`onNav:function(${CAP}){${'(?=(?:switch\\(\\1&&\\1\\.evt\\|\\|""\\)\\{case"upgradeSystemClk"|var [\\w$]+=\\1&&\\1\\.evt\\|\\|"";"upgradeSystemClk"))'}`,
      repl: (m, e) => `onNav:function(${e}){${MARK}if(!${e}||${KEEP_NAV}.indexOf(${e}.evt)<0)return;` },

    // user-vip-tip bubble: replace the h function by one returning this._e() (this = the render's `var e=this`)
    { id: 'header.user-vip-tip', legacy: [28], where: /^(?!renderer\.js$).*\.js$/, name: '头像: 去会员到期/续费气泡 (attrs:{userHref:)',
      find: R`${'(?<=([\\w$]+)\\._v\\(" "\\),)'}${ID_()}("user-vip-tip",{staticClass:"wp-header-user__tooltip",attrs:{userHref:`,
      repl: (m, self) => `${MARK}(function(){return ${self}._e()})("user-vip-tip",{staticClass:"wp-header-user__tooltip",attrs:{userHref:` },

    { id: 'header.user-vip-tip-adapter', legacy: [29], where: SHELL, name: '头像: 去会员到期/续费气泡 (attrs:{"user-href":)',
      feature: 'user-info-popover-adapter',
      find: R`${'(?<=([\\w$]+)\\._v\\(" "\\),)'}${ID_()}("user-vip-tip",{staticClass:"wp-header-user__tooltip",attrs:{"user-href":`,
      repl: (m, self) => `${MARK}(function(){return ${self}._e()})("user-vip-tip",{staticClass:"wp-header-user__tooltip",attrs:{"user-href":` },

    // UserInfoPopover (shared component chunk): AI credit area only when data present
    { id: 'header.popover-ai-area', legacy: [30], where: { contains: 'emitAiPointNav' }, name: '头像卡片: AI点数区 仅在有数据时渲染(适配层已传 null)',
      feature: 'emitAiPointNav',
      find: R`${IDENTIFIER_START}${CAP}("svg",{attrs:{width:"1",height:"10",viewBox:"0 0 1 10",fill:"none",xmlns:"http://www.w3.org/2000/svg"}},[${'\\1'}("line",{attrs:{x1:"0.25",y1:"1.09279e-08",x2:"0.25",y2:"10",stroke:"#ebeef5","stroke-width":"0.5"}})]),${'\\1'}("div",{staticClass:"uip-ai-area",on:{click:${CAP}.emitAiPointNav}}`,
      repl: function (m, v, P, ctx) {
        // `this` var of the render function: ... var f=this,v=f._self._c ...
        const head = ctx.text.slice(Math.max(0, ctx.index - 2000), ctx.index);
        let f = null; const re = new RegExp(`var ([\\w$]+)=this,${v.replace(/\$/g, '\\$')}=\\1\\._self\\._c`, 'g'); let mm;
        while ((mm = re.exec(head))) f = mm[1];
        if (!f) throw new Error('render this-variable not found');
        const g = `(${f}.aiCredit?${v}:function(){return ${f}._e()})`;
        const line = `${v}("line",{attrs:{x1:"0.25",y1:"1.09279e-08",x2:"0.25",y2:"10",stroke:"#ebeef5","stroke-width":"0.5"}})`;
        return `${MARK}${g}("svg",{attrs:{width:"1",height:"10",viewBox:"0 0 1 10",fill:"none",xmlns:"http://www.w3.org/2000/svg"}},[${line}]),${g}("div",{staticClass:"uip-ai-area",on:{click:${P}.emitAiPointNav}}`;
      } },

    { id: 'header.chat-webview', legacy: [31], where: SHELL, name: '库库AI: 底部隐藏 webview 不加载',
      find: /loadUrl\(\)\{let [\w$]+=new URL\("http:\/\/not\.exists"\);(?:if\("bottom"===this\.position\)\{|(?=if\("bottom"!==this\.position\)))/,
      repl: m => m.endsWith('{') ? m + MARK + 'return;' : m + MARK + 'if("bottom"===this.position)return;' },

    { id: 'header.chat-background-quota', seq: 31.1, where: SHELL, name: '库库AI: 底部面板挂载时跳过配额查询',
      // The logged-in smoke test exercised this on the webpack 5 client. Keep published webpack 4 behavior unchanged.
      feature: 'global.webpackChunkbaidunetdisk',
      find: 'mounted(){this.getKnowledgeQuotaLimit(),',
      repl: 'mounted(){' + MARK + 'if("bottom"!==this.position)this.getKnowledgeQuotaLimit();' },

    { id: 'header.chat-visible', legacy: [59], where: SHELL, name: '库库AI: 禁用对话面板开关',
      find: 'case"changeChatVisible":if(',
      repl: 'case"changeChatVisible":' + MARK + 'break;if(' },
  ],
  dropped: [],
};

function ID_() { return '[\\w$]+'; }
