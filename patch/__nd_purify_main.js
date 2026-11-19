// 百度网盘 去营销补丁 —— 主进程过滤模块
// 由 nd_loader.js 加载；提供 global.__ndPurify 供（内存中）被修补的 fetchApi / onBeforeRequest 调用。
// 原则：只拦截“主动推送的营销/广告/活动”数据；不拦截文件、传输、账号、会员状态查询等功能接口。
'use strict';

const VERSION = '1.1.0';

// 1) 整体拦截的接口（路径前缀，host 为 pan.baidu.com 系）
const BLOCK_PATH_PREFIXES = [
  '/rest/2.0/pcs/adx',                 // 顶栏/侧栏/文字/右下角 广告位（navAd）
  '/rest/2.0/pcs/adv',                 // 原生广告位
  '/buy/ad/get',                       // 广告
  '/act/api/activityentry',            // 活动入口配置
  '/act/v2/bchannel/list',             // 运营 banner 渠道
  '/act/v2/uinfo/get',                 // 活动用户信息
  '/rest/2.0/membership/guide',        // 会员引导（推销）
  '/rest/2.0/membership/proxy/guide',  // 会员引导（推销）
  '/rest/2.0/membership/notify',       // 会员推销通知
  '/api/usercenter/scoreaudiencesstatus', // 营销人群/积分
  '/recommend/query/list',             // 搜索框热词轮播（推荐查询词）
  '/recommend/video/list',             // 推荐视频
  '/recommend/yunyiduo/personal',      // 个性化推荐
  '/feed/hotlist',                     // 搜索框下拉：影视热榜
  '/operation/activitys/',             // 金币/运营活动页
  '/embed/reward-task/',               // 任务中心（领奖励）页面
  '/reward/center/',                   // 任务中心（领奖励）接口：顶栏任务入口/红点/弹窗
  '/ticket/api/trypackage',            // 试用套餐推销
  '/ticket/api/gettrypackinfo',        // 试用套餐推销
  '/buy/workspace/activity/tryout',    // 试用活动
  '/api/enterprise/organization/isorgpotentialuser', // “潜在企业用户”推销判定
  '/aipan/aiunion/',                   // 库库AI（genflow）页面 / AI全网搜
  '/aipan/search',                     // 库库AI“第二大脑”页（主窗口底部隐藏 webview 会在后台预加载）
];

// 2) 整体拦截的域名
const BLOCK_HOSTS = [
  /(^|\.)wan\.baidu\.com$/i,           // 百度游戏
];

// 3) /act/api/conf 中属于营销的 conf_key
const BLOCK_CONF_KEYS = new Set([
  'na_business_pay_rule',
  'nona_365call_tip_material',
  'game_second_title',
  'enterprise_renewal_guide_new',
  'enterprise_header_product_btn',
  'enterprise_header_combo_btn',
  'co_space_invite_incentive',
]);

// 4) /api/getsyscfg (Galaxy/天河配置) 中属于营销的配置键
const BLOCK_SYSCFG_KEYS = new Set([
  'header_gold_coin_area',             // 顶栏金币
  'pan_gold_coin_center',              // 金币中心
  'my_card_saleslot',                  // 个人卡片里的商业销售位
  'offline_download_business_guide_area', // 离线下载商业引导
  'pc_self_start_area_config',         // 反复弹“开机自启”引导
  'enterprise_cert_entrance',          // 企业认证推销入口
  'search_pannel_ai_tools',            // 搜索面板“AI工具”分类
  'home_cloud_add_ai_download_entrance',     // 云添加“添加AI下载任务”（首页）
  'transfer_cloud_add_ai_download_entrance', // 云添加“添加AI下载任务”（传输页）
]);
const BLOCK_SYSCFG_RE = /(gold_?coin|saleslot|sales_?slot|business_guide|coupon|lottery|red_?packet|welfare|reward|game|promot|marketing|(^|_)ads?(_|$)|advert|_adv(_|$)|activity|vip_guide|pay_guide|svip_guide|renew_guide|tryout|trial_guide)/i;

const ROOT = 'https://pan.baidu.com';
const stats = { blocked: 0, rewritten: 0, web: 0 };

let logFile = null;
function log(kind, url) {
  try {
    if (!logFile) {
      const { app } = require('electron');
      logFile = require('path').join(app.getPath('userData'), 'nd_purify.log');
    }
    const fs = require('fs');
    try { if (fs.statSync(logFile).size > 1024 * 1024) fs.truncateSync(logFile, 0); } catch (e) {}
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${kind} ${String(url).slice(0, 300)}\n`);
  } catch (e) { /* 日志失败不影响功能 */ }
}

function parse(url) {
  if (typeof url !== 'string' || !url) return null;
  try { return /^https?:\/\//i.test(url) ? new URL(url) : new URL(url, ROOT); } catch (e) { return null; }
}

function hostBlocked(host) { return BLOCK_HOSTS.some(re => re.test(host)); }
function isPanHost(host) { return /(^|\.)pan\.baidu\.com$/i.test(host) || /(^|\.)yun\.baidu\.com$/i.test(host); }
function pathBlocked(p) {
  return BLOCK_PATH_PREFIXES.some(x => x.endsWith('/') ? (p.startsWith(x) || p === x.slice(0, -1)) : (p === x || p.startsWith(x + '/')));
}
function sysCfgKeyBlocked(k) { return BLOCK_SYSCFG_KEYS.has(k) || BLOCK_SYSCFG_RE.test(k); }

function paramOf(u, params, name) {
  const v = u.searchParams.get(name);
  if (v != null) return v;
  if (params && typeof params === 'object' && params[name] != null) return String(params[name]);
  if (typeof params === 'string') { const m = new RegExp('(?:^|&)' + name + '=([^&]*)').exec(params); if (m) return decodeURIComponent(m[1]); }
  return null;
}

// 过滤 getsyscfg 的 cfg_category_keys：返回 null(不变) / '' (全部被拦) / 新的原始 URL
function rewriteSysCfg(rawUrl) {
  const m = /([?&]cfg_category_keys=)([^&#]*)/.exec(rawUrl);
  if (!m) return null;
  let list;
  try { list = JSON.parse(decodeURIComponent(m[2])); } catch (e) { return null; }
  if (!Array.isArray(list)) return null;
  const kept = list.filter(it => !(it && typeof it.cfg_category_key === 'string' && sysCfgKeyBlocked(it.cfg_category_key)));
  if (kept.length === list.length) return null;
  if (kept.length === 0) return '';
  return rawUrl.slice(0, m.index) + m[1] + encodeURIComponent(JSON.stringify(kept)) + rawUrl.slice(m.index + m[0].length);
}

// 原生 HTTP（fetchApi）过滤：{block:true} | {url:newUrl} | null
function filterApi(url, params) {
  const u = parse(url);
  if (!u) return null;
  if (hostBlocked(u.hostname)) { stats.blocked++; log('BLOCK', url); return { block: true }; }
  if (!isPanHost(u.hostname)) return null;
  if (pathBlocked(u.pathname)) { stats.blocked++; log('BLOCK', url); return { block: true }; }
  if (u.pathname === '/act/api/conf') {
    const k = paramOf(u, params, 'conf_key');
    if (k && BLOCK_CONF_KEYS.has(k)) { stats.blocked++; log('BLOCK conf_key=' + k, url); return { block: true }; }
  }
  if (u.pathname === '/api/getsyscfg') {
    const r = rewriteSysCfg(url);
    if (r === '') { stats.blocked++; log('BLOCK syscfg', url); return { block: true }; }
    if (r) { stats.rewritten++; log('STRIP syscfg', url); return { url: r }; }
  }
  return null;
}

// Chromium 网络栈（webview / iframe / XHR）过滤：{cancel:true} | {redirectURL} | null
function filterWeb(url) {
  if (typeof url !== 'string' || !/^https?:/i.test(url)) return null;
  const r = filterApi(url, null);
  if (!r) return null;
  stats.web++;
  if (r.block) return { cancel: true };
  if (r.url) return { redirectURL: r.url };
  return null;
}

// 主进程 axios 实例（app.$Net，Node http 适配器）既不经过 fetchApi，也不经过 Chromium webRequest，
// 需单独加请求拦截器。被拦请求以“用户手动取消”的形式失败：客户端的响应拦截器会把它当作
// 主动取消静默处理（返回 {ajaxError,requestCancel}），不计入网络错误、不弹“网络异常”。
const CANCEL_MSG = '用户手动取消'; // 用户手动取消（须与 main.js 中的判断完全一致）
function guardAxios(inst) {
  try {
    if (!inst || !inst.interceptors || !inst.interceptors.request || inst.__ndGuarded) return inst;
    Object.defineProperty(inst, '__ndGuarded', { value: true });
    inst.interceptors.request.use(cfg => {
      let r = null;
      try {
        const u = String((cfg && cfg.url) || '');
        const base = String((cfg && cfg.baseURL) || ROOT);
        const full = /^https?:\/\//i.test(u) ? u : base.replace(/\/+$/, '') + '/' + u.replace(/^\/+/, '');
        r = filterApi(full, (cfg && (cfg.params || cfg.data)) || null);
      } catch (e) { r = null; }
      if (r && r.block) { const err = new Error(CANCEL_MSG); err.config = cfg; err.ndPurifyBlocked = true; throw err; }
      if (r && r.url) cfg.url = r.url;
      return cfg;
    });
  } catch (e) {}
  return inst;
}

// 托盘菜单（Windows 主托盘，main.js 中 buildFromTemplate 前调用）：
//  - 去掉 版本升级（会覆盖补丁）/ 一键反馈（依赖已移除的 BugReport）/ 同步空间相关 / 回收站（精简版已移除）
//  - 用户名、网盘空间 两项保留显示，但不再跳转会员购买页
//  - 递归处理子菜单；空子菜单整项去掉；合并连续分隔线、去掉首尾分隔线；出错则原样返回
const TRAY_DROP = new Set(['版本升级', '一键反馈', '打开同步空间', '开启同步', '暂停同步', '进入回收站']);
function trayMenu(items, ctx) {
  try {
    if (!Array.isArray(items)) return items;
    const user = ctx && ctx.user ? String(ctx.user) : '';
    const ws = ctx && ctx.ws ? String(ctx.ws) : '';
    const walk = list => {
      const out = [];
      for (const it of list) {
        if (!it || typeof it !== 'object') continue;
        const sep = it.type === 'separator';
        const label = typeof it.label === 'string' ? it.label : '';
        if (!sep && (TRAY_DROP.has(label) || (ws && label === ws))) continue;
        let x = it;
        if (Array.isArray(it.submenu)) {
          const sub = walk(it.submenu);
          if (!sub.length) continue;
          x = Object.assign({}, it, { submenu: sub });
        }
        if (!sep && ((user && label === user) || label.indexOf('网盘空间') === 0)) { x = Object.assign({}, x); delete x.click; }
        if (sep && (!out.length || out[out.length - 1].type === 'separator')) continue;
        out.push(x);
      }
      while (out.length && out[out.length - 1].type === 'separator') out.pop();
      return out;
    };
    return walk(items);
  } catch (e) { return items; }
}

global.__ndPurify = { version: VERSION, filterApi, filterWeb, guardAxios, trayMenu, stats, log };

// 对 webview 等非默认 session 也装上过滤（默认 session 由 main.js 中被修补的 onBeforeRequest 处理）
try {
  const { app, session } = require('electron');
  app.on('session-created', ses => {
    setImmediate(() => {
      try {
        if (ses === session.defaultSession) return;
        ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, cb) => {
          const r = filterWeb(details.url);
          if (r && r.cancel) return cb({ cancel: true });
          if (r && r.redirectURL) return cb({ cancel: false, redirectURL: r.redirectURL });
          cb({ cancel: false });
        });
      } catch (e) {}
    });
  });
  log('INIT', 'nd_purify ' + VERSION);
} catch (e) {}
