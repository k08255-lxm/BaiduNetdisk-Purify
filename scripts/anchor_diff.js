// 在两个版本里并排显示同一个标记附近的代码，看锚点漂移的性质。用法: node anchor_diff.js <tools> <a.asar> <b.asar> <file> <marker> [width]
'use strict';
const path = require('path');
const [TOOLS, A, B, file, marker, w = '110'] = process.argv.slice(2);
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));
for (const [n, f] of [['old', A], ['new', B]]) {
  const s = asar.extractFile(f, file).toString('utf8');
  let i = -1, k = 0;
  while ((i = s.indexOf(marker, i + 1)) >= 0 && k++ < 2) console.log(n + ': ' + s.slice(Math.max(0, i - (+w)), i + (+w)).replace(/\s+/g, ' '));
}
