// 逐文件比较两个 asar 的内容（Node 构建 vs PowerShell 补丁器），并检查 PS 输出的 integrity 字段
const path = require('path'); const crypto = require('crypto');
const [A, B, TOOLS] = process.argv.slice(2);
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));
const la = asar.listPackage(A).filter(p => { try { return !asar.statFile(A, p.replace(/^[\\/]/, '')).files; } catch { return false; } });
const lb = asar.listPackage(B).filter(p => { try { return !asar.statFile(B, p.replace(/^[\\/]/, '')).files; } catch { return false; } });
const norm = l => l.map(p => p.replace(/\\/g, '/')).sort();
const na = norm(la), nb = norm(lb);
let bad = 0;
if (JSON.stringify(na) !== JSON.stringify(nb)) { bad++; console.log('FILE LIST DIFFERS', na.length, nb.length, na.filter(x => !nb.includes(x)).slice(0, 5), nb.filter(x => !na.includes(x)).slice(0, 5)); }
for (const p of na) {
  const rel = p.replace(/^\//, '').split('/').join(path.sep);
  const x = asar.extractFile(A, rel), y = asar.extractFile(B, rel);
  if (!x.equals(y)) { bad++; if (bad < 10) console.log('CONTENT DIFFERS:', rel, x.length, y.length); continue; }
  const st = asar.statFile(B, rel);
  if (st.integrity) {
    const h = crypto.createHash('sha256').update(y).digest('hex');
    if (h !== st.integrity.hash) { bad++; console.log('INTEGRITY HASH WRONG:', rel); }
  }
}
console.log(bad ? `${bad} problems` : `IDENTICAL: ${na.length} files have identical content; integrity hashes valid`);
process.exit(bad ? 1 : 0);
