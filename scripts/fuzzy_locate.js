// 估算移植工作量：把每个字面锚点泛化（短变量名 -> 通配，Object(x.y)( <-> (0,x.Y)(，x.app <-> x().app），
// 在目标版本所有 JS 里搜索，统计能否唯一定位。正则补丁直接按原正则在所有文件里搜。
// 用法: node fuzzy_locate.js <tools> <core.asar> [--list]
'use strict';
const path = require('path');
const [TOOLS, SRC, flag] = process.argv.slice(2);
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));
const { PATCHES } = require('./patchset_def.js');

const keep = new Set(['if', 'in', 'do', 'of', 'to', 'id', 'on', 'ok', 'ai', 'pc', 'js', 'ui', 'na', 'v2', 'h', 'px']);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function generalize(find) {
  const toks = find.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_$][\w$]*|\d+|\s+|[\s\S]/g) || [];
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], prev = toks[i - 1] || '', next = toks[i + 1] || '';
    if (/^["']/.test(t)) { out += esc(t); continue; }                                   // string literals stay exact
    if (t === 'Object' && next === '(') { out += '(?:Object\\(|\\(0,)'; i++; continue; } // webpack4 Object(x.y)  <-> webpack5 (0,x.Y)
    const isIdent = /^[A-Za-z_$][\w$]*$/.test(t);
    const isProp = prev === '.';                                                          // property names are stable (not minified)
    if (isIdent && !isProp && t.length <= 2 && !keep.has(t)) {
      out += '[\\w$]{1,3}' + (next === '.' ? '(?:\\(\\))?' : '');                         // o.app <-> o().app
      continue;
    }
    if (isIdent && isProp && t.length <= 3 && /^[a-zA-Z]+$/.test(t) && /^[\w$]{1,3}$/.test(toks[i - 2] || '') && toks[i - 2].length <= 2) {
      out += '[\\w$]{1,3}'; continue;                                                     // export names: d.a -> u.A, v.b -> x.YJ
    }
    out += esc(t);
  }
  return new RegExp(out, 'g');
}
const files = asar.listPackage(SRC).map(p => p.replace(/^[\\/]/, '').replace(/\\/g, '/')).filter(p => /^[^/]+\.(js|html)$/.test(p));
const text = {}; for (const f of files) text[f] = asar.extractFile(SRC, f).toString('utf8');
const stats = { unique: 0, multi: 0, none: 0 }; const rows = [];
for (const p of PATCHES) {
  const re = p.findRe ? new RegExp(p.findRe.source, 'g') : generalize(p.find);
  const hits = [];
  for (const f of files) { const n = (text[f].match(re) || []).length; if (n) hits.push(f + 'x' + n); }
  const total = hits.reduce((a, h) => a + +h.split('x').pop(), 0);
  const st = total === 1 ? 'unique' : total > 1 ? 'multi' : 'none'; stats[st]++;
  rows.push(`${st.padEnd(6)} ${p.file.padEnd(12)} [${p.name}] ${hits.join(',')}`);
}
console.log(`${SRC}\nfuzzy-locatable: unique ${stats.unique} | multi ${stats.multi} | none ${stats.none}  (of ${PATCHES.length})`);
if (flag === '--list') rows.filter(r => !r.startsWith('unique')).forEach(r => console.log(r));
