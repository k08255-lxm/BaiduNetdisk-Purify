// 对比多个版本 core.asar 的结构与关键标记。用法: node asar_overview.js <tools目录> <名称=core.asar> ...
'use strict';
const path = require('path');
const [TOOLS, ...specs] = process.argv.slice(2);
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));
const marks = ['fetchApi(', 'onBeforeRequest(', '$Net=', 'showPalletAdv', 'onShowLinkShareAd', 'openGameTab', '$openImageViewer',
  'pc_na_trans_switch', 'imageViewerExist', 'buildFromTemplate', 'webpackJsonp', 'webpackChunk', 'sourceMappingURL'];
for (const spec of specs) {
  const [name, file] = spec.split('=');
  const L = asar.listPackage(file).map(p => p.replace(/^[\\/]/, '').replace(/\\/g, '/'));
  const js = L.filter(p => /^[^/]+\.js$/.test(p));
  const get = f => { try { return asar.extractFile(file, f).toString('utf8'); } catch (e) { return ''; } };
  const main = get('main.js'), ren = get('renderer.js');
  console.log(`== ${name}: ${L.length} entries, ${js.length} top-level js; main.js ${(main.length / 1e6).toFixed(2)} MB, renderer.js ${(ren.length / 1e6).toFixed(2)} MB`);
  console.log('   sample chunks: ' + js.filter(x => !/^(main|renderer)\.js$/.test(x)).slice(0, 10).join(' '));
  console.log('   main.js:     ' + marks.map(m => m + '=' + (main.split(m).length - 1)).join('  '));
  console.log('   renderer.js: ' + marks.map(m => m + '=' + (ren.split(m).length - 1)).join('  '));
}
