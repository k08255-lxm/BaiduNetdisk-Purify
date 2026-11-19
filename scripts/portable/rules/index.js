// Portable rule groups. Each file in this folder (except index.js) exports
//   { name, rules: [...], dropped: [{ legacy: <1.x index>, reason }] }
'use strict';
const fs = require('fs'), path = require('path');
function loadGroups(only) {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'index.js').sort();
  return files.map(f => Object.assign({ name: f.replace(/\.js$/, '') }, require(path.join(__dirname, f))))
              .filter(g => !only || only.includes(g.name));
}
const NEW_FILES = ['__nd_purify_main.js', '__nd_purify_renderer.js'];
const MARK = '/*nd_purify*/';
module.exports = { loadGroups, NEW_FILES, MARK };
