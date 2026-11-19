// Show what a portable rule matches and what it produces, per build (for porting / reviewing).
// Usage: node scripts/portable/show.js --cores <dir> [--tools <dir>] --group <g> [--rule <id>] [--versions a,b] [--width 120]
// Rules are applied in order (like the real build), so later rules see earlier edits of the same group.
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./engine');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const CORES = opt('cores'), TOOLS = opt('tools') || path.join(__dirname, '..', '..', 'tools'), W = +(opt('width') || 120);
const { loadGroups } = require('./rules');
const rules = loadGroups(opt('group') ? opt('group').split(',') : undefined).flatMap(g => g.rules);
let versions = opt('versions') ? opt('versions').split(',') : fs.readdirSync(CORES).filter(v => /^\d+\.\d+\.\d+\.\d+$/.test(v));
versions.sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
const coreOf = v => { const d = path.join(CORES, v, 'core'); return fs.existsSync(d) ? d : path.join(CORES, v, 'module', 'BrowserEngine', 'resources', 'core.asar'); };
const one = s => s.replace(/\s+/g, ' ');
for (const v of versions) {
  const texts = new Map(E.loadCore(coreOf(v), TOOLS));
  console.log(`######## ${v}`);
  for (const rule of E.sortRules(rules)) {
    const before = new Map(texts);
    const r = E.applyRule(rule, texts);
    if (opt('rule') && rule.id !== opt('rule')) continue;
    console.log(`-- ${rule.id} [${r.status}] ${r.detail}`);
    for (const e of r.edits) {
      const s = before.get(e.file);
      const k = s.indexOf(e.find);
      console.log(`   ${e.file}@${k}`);
      console.log(`   before: …${one(s.slice(Math.max(0, k - W), k))}⟦${one(e.find)}⟧${one(s.slice(k + e.find.length, k + e.find.length + W))}…`);
      console.log(`   after:  ⟦${one(e.repl)}⟧`);
    }
  }
}
