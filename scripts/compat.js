// 只读兼容性检查：把 patchset_def.js 的补丁按真实顺序在内存中应用到另一个版本的 core.asar，统计每处锚点的命中情况。
// 用法: node compat.js <core.asar> <tools目录> [--json out.json]
// 状态: OK = 恰好命中 1 次（可用）; MOVED = 原文件里没有，但在别的 chunk 里恰好 1 次（分块编号变了）;
//       MISSING = 任何文件都没有（代码已变）; MULTI = 命中多次（有歧义）; NOFILE = 目标文件不存在
'use strict';
const path = require('path'), fs = require('fs');
const [SRC, TOOLS, flag, jsonOut] = process.argv.slice(2);
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));
const { PATCHES } = require('./patchset_def.js');

const all = asar.listPackage(SRC).map(p => p.replace(/^[\\/]/, '').replace(/\\/g, '/'));
const jsFiles = all.filter(p => /^[^/]+\.(js|html)$/.test(p));
const cache = {};
const read = f => {
  if (!(f in cache)) { try { cache[f] = asar.extractFile(SRC, f).toString('utf8'); } catch (e) { cache[f] = null; } }
  return cache[f];
};
const count = (s, p) => {
  if (s == null) return -1;
  if (p.findRe) return (s.match(new RegExp(p.findRe.source, 'g')) || []).length;
  return s.split(p.find).length - 1;
};
const results = [];
for (const p of PATCHES) {
  const s = read(p.file);
  const n = count(s, p);
  const r = { file: p.file, name: p.name, status: '', hits: n, elsewhere: [] };
  if (n === 1) {
    r.status = 'OK';
    cache[p.file] = p.findRe ? s.replace(new RegExp(p.findRe.source), (...m) => p.replFn(...m)) : s.replace(p.find, () => p.repl);
  } else {
    for (const f of jsFiles) { if (f === p.file) continue; const k = count(read(f), p); if (k > 0) r.elsewhere.push(f + 'x' + k); }
    if (n === -1) r.status = 'NOFILE';
    else if (n > 1) r.status = 'MULTI';
    else r.status = (r.elsewhere.length === 1 && r.elsewhere[0].endsWith('x1')) ? 'MOVED' : 'MISSING';
    if (!p.findRe && r.status === 'MISSING') {           // 漂移提示：锚点开头 / 结尾片段是否还在
      const head = p.find.slice(0, 40), tail = p.find.slice(-40);
      r.hint = 'head:' + jsFiles.filter(f => (read(f) || '').includes(head)).join(',') + ' tail:' + jsFiles.filter(f => (read(f) || '').includes(tail)).join(',');
    }
  }
  results.push(r);
}
const by = st => results.filter(r => r.status === st);
console.log(`core.asar: ${SRC}`);
console.log(`total ${results.length} | OK ${by('OK').length} | MOVED ${by('MOVED').length} | MISSING ${by('MISSING').length} | MULTI ${by('MULTI').length} | NOFILE ${by('NOFILE').length}`);
for (const r of results.filter(r => r.status !== 'OK'))
  console.log(`${r.status.padEnd(7)} ${r.file.padEnd(12)} [${r.name}] hits=${r.hits}${r.elsewhere.length ? ' elsewhere=' + r.elsewhere.join(',') : ''}${r.hint ? ' ' + r.hint : ''}`);
if (flag === '--json' && jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 1));
