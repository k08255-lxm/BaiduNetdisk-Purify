// 把 patchset_def.js 的补丁规则导出为 patchset.json，供无需 Node 的 PowerShell 补丁器使用
// 用法: node gen_patchset.js <out.json> <originalSha256> [expectedOutSha256]
'use strict';
const fs = require('fs');
const { MARK, PATCHES, NEW_FILES } = require('./patchset_def.js');
const [OUT, ORIG, EXPECTED] = process.argv.slice(2);
if (!OUT || !ORIG) { console.error('usage: node gen_patchset.js <out.json> <originalSha256> [expectedOutSha256]'); process.exit(2); }

const PH = n => '\u0000G' + n + '\u0000';  // 分组占位符（模板中由 PowerShell 替换为实际捕获组）
const patches = PATCHES.map(p => {
  if (p.findRe) {
    const groups = new RegExp(p.findRe.source + '|').exec('').length - 1;
    const args = [PH(0)]; for (let i = 1; i <= groups; i++) args.push(PH(i));
    const template = p.replFn(...args);
    return { file: p.file, name: p.name, kind: 'regex', pattern: p.findRe.source, groups, template };
  }
  return { file: p.file, name: p.name, kind: 'literal', find: p.find, repl: p.repl };
});
const doc = {
  format: 1,
  product: 'BaiduNetdisk de-marketing patch',
  target: { appVersion: '8.9.7 / build 497', originalCoreSha256: ORIG.toLowerCase() },
  expectedOutputSha256: (EXPECTED || '').toLowerCase(),
  mark: MARK,
  newFiles: NEW_FILES,
  patches,
};
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1), 'utf8');
console.log('patchset:', patches.length, 'patches (', patches.filter(p => p.kind === 'regex').length, 'regex ) ->', OUT);
