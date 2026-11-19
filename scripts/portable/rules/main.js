// Main process (main.js): load the filter module and hook the three network channels; ad windows; game tab.
'use strict';
const { MARK } = require('./index');
const LOAD = 'try{require(require("path").join(__dirname,"__nd_purify_main.js"))}catch(__e){console.error("nd_purify load failed",__e)}';

module.exports = {
  rules: [
    { id: 'main.load-module', legacy: [0], where: 'main.js', name: '加载去营销模块（webpack 4: module.exports=function(e){ / webpack 5: (()=>{ 前）',
      find: /module\.exports=function\(e\)\{|(\/\*! For license information please see main\.js\.LICENSE\.txt \*\/\s*)\(\(\)=>\{/,
      repl: (m, lic) => m.startsWith('module.exports')
        ? MARK + LOAD + m
        : lic + MARK + LOAD + '(()=>{' },

    { id: 'main.fetchApi', legacy: [1], where: 'main.js', name: '原生HTTP出口过滤(fetchApi)',
      find: /fetchApi\(([\w$]+),([\w$]+),([\w$]+),([\w$]+)="post"\)\{/,
      repl: (m, url, params) => m + MARK + `const __p=global.__ndPurify&&global.__ndPurify.filterApi(${url},${params});` +
        `if(__p&&__p.block)return Promise.resolve({httpTask:-1,errNo:-1,ajaxError:!0});if(__p&&__p.url)${url}=__p.url;` },

    { id: 'main.axios-net', legacy: [2], where: 'main.js', name: '主进程axios($Net)过滤',
      find: /(([\w$]+(?:\(\))?)\.app\.\$Net=[\w$]+\([^()]*\)),/,
      repl: (m, assign, obj) => assign + ',' + MARK + `global.__ndPurify&&global.__ndPurify.guardAxios&&global.__ndPurify.guardAxios(${obj}.app.$Net),` },

    { id: 'main.webrequest', legacy: [3], where: 'main.js', name: 'Chromium网络过滤(onBeforeRequest)',
      find: /[\w$]+(?:\(\))?\.session\.defaultSession\.webRequest\.onBeforeRequest\(\(([\w$]+),([\w$]+)\)=>\{/,
      repl: (m, d, cb) => m + MARK + `const __r=global.__ndPurify&&global.__ndPurify.filterWeb(${d}.url);if(__r&&__r.cancel)return ${cb}({cancel:!0});` +
        `if(__r&&__r.redirectURL)return ${cb}({cancel:!1,redirectURL:__r.redirectURL});` },

    { id: 'main.pallet-ad', legacy: [4], where: 'main.js', name: '右下角广告窗(showPalletAdv)',
      find: /[\w$]+(?:\(\))?\.ipcMain\.on\("showPalletAdv",\([\w$]+,[\w$]+\)=>\{/,
      repl: m => m + MARK + 'return;' },

    { id: 'main.linkshare-ad', legacy: [5], where: 'main.js', name: '分享页广告(onShowLinkShareAd)',
      find: /[\w$]+(?:\(\))?\.ipcMain\.on\("onShowLinkShareAd",\([\w$]+(?:,[\w$]+)*\)=>\{/,
      repl: m => m + MARK + 'return;' },

    { id: 'main.game-tab', legacy: [6], where: 'main.js', name: '游戏中心标签页(openGameTab)',
      find: /(\([\w$]+,[\w$]+\)=>\{)((?:var [\w$]+(?:,[\w$]+)*;)?[\w$]+(?:\(\))?\.app\.mainBrowserwindow\.webContents\.send\("openGameTab")/,
      repl: (m, head, rest) => head + MARK + 'return;' + rest },
  ],
  dropped: [],
};
