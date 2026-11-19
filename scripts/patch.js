// 百度网盘 core.asar 去营销补丁器
// 用法: node patch.js <原始core.asar> <输出core.asar> <tools目录> <patch目录>
// 总是从“原始(未修改)”的 core.asar 重新生成，可重复执行；任何锚点不唯一即中止，不产出半成品。
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const [SRC, OUT, TOOLS, PATCHDIR] = process.argv.slice(2);
if (!SRC || !OUT || !TOOLS || !PATCHDIR) { console.error('usage: node patch.js <src.asar> <out.asar> <toolsDir> <patchDir>'); process.exit(2); }
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));

const { MARK, PATCHES, NEW_FILES } = require('./patchset_def.js');

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nd_purify_'));
  const dir = path.join(work, 'core');
  console.log('extract ->', dir);
  asar.extractAll(SRC, dir);

  const cache = {};
  const read = f => (cache[f] ??= fs.readFileSync(path.join(dir, f), 'utf8'));
  let failed = 0;
  for (const p of PATCHES) {
    const s = read(p.file);
    if (s.includes(MARK) && p.file === 'main.js' && p.name === '加载去营销模块') { console.error('源文件已被修补过，请使用原始 core.asar'); process.exit(3); }
    if (p.findRe) {
      // 正则补丁：同一逻辑在不同 chunk 中压缩变量名不同；要求恰好命中 1 次
      const re = new RegExp(p.findRe.source, 'g');
      const hits = s.match(re) || [];
      if (hits.length !== 1) { console.error(`✗ ${p.file} [${p.name}] 正则命中 ${hits.length} 次（应为 1）`); failed++; continue; }
      cache[p.file] = s.replace(new RegExp(p.findRe.source), (...m) => p.replFn(...m));
      console.log(`✓ ${p.file} [${p.name}]`);
      continue;
    }
    const n = s.split(p.find).length - 1;
    if (n !== 1) { console.error(`✗ ${p.file} [${p.name}] 锚点出现 ${n} 次（应为 1）`); failed++; continue; }
    cache[p.file] = s.replace(p.find, () => p.repl);
    console.log(`✓ ${p.file} [${p.name}]`);
  }
  if (failed) { console.error(`${failed} 处补丁失败，已中止，未输出文件`); fs.rmSync(work, { recursive: true, force: true }); process.exit(1); }
  for (const [f, s] of Object.entries(cache)) fs.writeFileSync(path.join(dir, f), s, 'utf8');
  for (const f of NEW_FILES) fs.copyFileSync(path.join(PATCHDIR, f), path.join(dir, f));

  // 语法自检（不执行）：确保修补后的 JS 仍能解析
  const vm = require('vm');
  for (const f of [...new Set([...Object.keys(cache).filter(x => x.endsWith('.js')), ...NEW_FILES])]) {
    try { new vm.Script(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }); console.log('syntax ok', f); }
    catch (e) { console.error('语法错误', f, e.message); process.exit(4); }
  }

  await asar.createPackage(dir, OUT);
  fs.rmSync(work, { recursive: true, force: true });
  console.log('written', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });
