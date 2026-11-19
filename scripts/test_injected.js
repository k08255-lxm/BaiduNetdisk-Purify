// 从构建好的 core.asar 中取出补丁注入的函数，用模拟数据验证。
const path = require('path');
const [ASAR, TOOLS] = process.argv.slice(2);
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));
const chunks = asar.listPackage(ASAR)
  .map(name => name.replace(/^[\\/]/, ''))
  .filter(name => /^\d+\.js$/.test(name))
  .map(name => asar.extractFile(ASAR, name).toString('utf8'));
let bad = 0;
const T = (d, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', d, ok ? '' : JSON.stringify(got)); };
const grab = (param, firstItem, end) => {
  const start = '(function(' + param + '){/*nd_purify*/var B=[' + JSON.stringify(firstItem);
  const chunk = chunks.find(s => s.includes(start));
  if (!chunk) throw new Error('not found: ' + start);
  const i = chunk.indexOf(start);
  const j = chunk.indexOf(end, i);
  if (j < 0) throw new Error('missing terminator: ' + start);
  return chunk.slice(i, j + 2); // includes "})"
};
// 1) 左工具条：函数形如 (function(g){/*nd_purify*/var B=[...];return ...})(this.left_toolbarGroups)
const leftSrc = grab('g', 'new_note', '})(');
const left = eval(leftSrc);
const groups = [{ toolbarKey: 'mainOpList', items: ['upload', 'new_folder', 'new_note', 'add_backup', 'cloud_add', 'record', 'lead_pand', 'lock_safe'].map(k => ({ key: k })) }, { toolbarKey: 'chat-more', items: [{ key: 'chat_more' }] }];
const lr = left(groups);
T('left: keeps core buttons', lr[0].items.map(x => x.key), ['upload', 'new_folder', 'cloud_add']);
T('left: other groups untouched', lr[1].items.map(x => x.key), ['chat_more']);
T('left: input not mutated', groups[0].items.length, 8);
T('left: non-array passthrough', left(undefined), undefined);
// 2) 右工具条：(function(x){/*nd_purify*/...})(a)
const rightSrc = grab('x', 'add_to_knowledge', '})(');
const right = eval(rightSrc);
const rg = { toolbarKey: 'right-options', items: ['export_safe', 'share', 'multiple_share', 'download', 'add_to_knowledge', 'ai_summary', 'ai_photo', 'switch_text', 'export_dir', 'batch_rename', 'file_qa', 'delete', 'cloud_print', 'free_board', 'ai_video_edit', 'more'].map(k => ({ key: k })) };
T('right: keeps netdisk ops', right(rg).items.map(x => x.key), ['share', 'multiple_share', 'download', 'export_dir', 'batch_rename', 'delete', 'more']);
// 3) 右键菜单：(function(a){/*nd_purify*/...})(this[e])
const menuSrc = grab('a', 'AI知识库', '})(this[');
const menu = eval(menuSrc);
const items = ['打开', '下载', '分享', '新建笔记', 'AI PPT', '转word', '重命名', 'AI剪辑', '图片精修', '成为超级会员', '添加到我的知识库', '复制到', '删除', '转文字', '本地编辑', '用手机打开'].map(n => ({ type: 'operate', name: n }));
T('menu: keeps netdisk items', menu(items).map(x => x.name), ['打开', '下载', '分享', '重命名', '复制到', '删除', '本地编辑']);
const L = { type: 'line' };
T('menu: collapses separators left by removed items', menu([{ name: '打开' }, L, { name: '文档历史版本' }, L, { name: '下载' }, L, { name: '复制到同步空间' }, L]).map(x => x.name || '-'), ['打开', '-', '下载']);
T('menu: no leading separator', menu([L, { name: '用手机打开' }, L, { name: '删除' }]).map(x => x.name || '-'), ['删除']);
T('menu: tolerates separators/undefined', menu([{ type: 'separator' }, null, { name: '下载' }]).length, 3);
T('menu: non-array passthrough', menu(null), null);
T('menu: drops safebox items', menu(['移入隐藏空间', '移出隐藏空间', '下载'].map(n => ({ name: n }))).map(x => x.name), ['下载']);

// 4) 主进程“下载后打开”函数的安全闸门：注入模拟的 electron.shell，检查每种类型走 openPath 还是 showItemInFolder
const m = asar.extractFile(ASAR, 'main.js').toString('utf8');
const openerAssignment = '.app.$openImageViewer=';
const a0 = m.indexOf(openerAssignment + 'function(p){/*nd_purify*/');
const a1 = m.indexOf('catch(__e){}}', a0);
if (a0 < 0 || a1 < 0) throw new Error('patched file opener not found');
const fnSrc = m.slice(a0 + openerAssignment.length, a1 + 'catch(__e){}}'.length);
const calls = [];
const mockRequire = n => (n === 'electron' ? { shell: { openPath: f => calls.push(['open', f]), showItemInFolder: f => calls.push(['reveal', f]) } } : null);
const opener = new Function('require', 'return ' + fnSrc)(mockRequire);
const cases = { 'C:\\d\\photo.JPG': 'open', 'C:\\d\\movie.mkv': 'open', 'C:\\d\\paper.pdf': 'open', 'C:\\d\\report.docx': 'open',
  'C:\\d\\setup.exe': 'reveal', 'C:\\d\\run.bat': 'reveal', 'C:\\d\\a.ps1': 'reveal', 'C:\\d\\x.vbs': 'reveal', 'C:\\d\\pack.zip': 'reveal',
  'C:\\d\\lnk.lnk': 'reveal', 'C:\\d\\b.msi': 'reveal', 'C:\\d\\noext': 'reveal', 'C:\\d\\evil.pdf.exe': 'reveal', 'C:\\d\\page.html': 'reveal' };
for (const [f, want] of Object.entries(cases)) { calls.length = 0; opener('"' + f + '" --netdiskdownload='); T('opener ' + f.split('\\').pop() + ' -> ' + want, calls.map(c => c[0]), [want]); }
calls.length = 0; opener('{"path":"/x.jpg"}'); T('opener ignores cloud JSON arg', calls.length, 0);

// 5) 头像卡片导航白名单：取出 onNav 的守卫语句单独求值
const s = chunks.find(chunk => chunk.includes('bottom:/*nd_purify*/[]'));
if (!s) throw new Error('patched sidebar not found');
if (s.includes('user-info-popover-adapter')) {
  const guardedNav = /onNav:function\(([\w$]+)\)\{\/\*nd_purify\*\/(if\(!\1\|\|\["helpCenter","logout"\]\.indexOf\(\1\.evt\)<0\)return;)/.exec(s);
  if (!guardedNav) throw new Error('patched avatar navigation not found');
  const [, event, guard] = guardedNav;
  const nav = new Function(event, guard + 'return "passed"');
  T('avatar nav: avatar click ignored', nav({ evt: 'vipBadgeClk' }), undefined);
  T('avatar nav: renew/benefit ignored', [nav({ evt: 'upgradeBtnClick' }), nav({ evt: 'benefitClick' }), nav({ evt: 'userAiPointBuyBtn' }), nav(null)], [undefined, undefined, undefined, undefined]);
  T('avatar nav: help/switch account pass', [nav({ evt: 'helpCenter' }), nav({ evt: 'logout' })], ['passed', 'passed']);
  const navAssignment = /\/\*nd_purify\*\/[\w$]+=\[\],([\w$]+)=\(([\w$]+)\.navList\|\|\[\]\)(\.filter\(function\(x\)\{return x&&\["helpCenter","logout"\]\.indexOf\(x\.evt\)>=0\}\))/.exec(s);
  if (!navAssignment) throw new Error('patched avatar menu list not found');
  const [, , menuData, filter] = navAssignment;
  const navList = new Function(menuData, 'return (' + menuData + '.navList||[])' + filter);
  T('avatar navList: only help/switch', navList({ navList: [{ text: '个人主页', evt: 'userHome' }, { text: '帮助中心', evt: 'helpCenter' }, { text: '切换账号', evt: 'logout' }] }).map(x => x.evt), ['helpCenter', 'logout']);
}
// 6) 侧栏 / 顶栏 关键数据层补丁存在
T('sidebar bottom emptied', s.includes('bottom:/*nd_purify*/[]'), true);
if (s.includes('headerRewardTask')) {
  T('reward task removed', /\/\*nd_purify\*\/!1&&[\w$]+\.push\(\{key:"headerRewardTask"/.test(s), true);
}
T('vip btn removed', /\/\*nd_purify\*\/!0\|\|[\w$]+\.push\(\{comp:"headerVipBtn"/.test(s), true);
T('update removed', s.includes('updateConfig:function(){/*nd_purify*/return[]}'), true);

console.log(bad ? bad + ' FAILED' : 'ALL PASS');
process.exit(bad ? 1 : 0);
