// 从构建好的 core.asar 中取出注入到 45.js 的过滤函数，用模拟数据做语义测试（不执行百度代码）
const path = require('path');
const [ASAR, TOOLS] = process.argv.slice(2);
const asar = require(path.join(path.resolve(TOOLS), 'node_modules', '@electron', 'asar'));
const s = asar.extractFile(ASAR, '45.js').toString('utf8');
let bad = 0;
const T = (d, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', d, ok ? '' : JSON.stringify(got)); };
const grab = (startMarker, endMarker) => {
  const i = s.indexOf(startMarker); if (i < 0) throw new Error('not found: ' + startMarker);
  const j = s.indexOf(endMarker, i); return s.slice(i, j + 2); // 包含 "})"
};
// 1) 左工具条：函数形如 (function(g){/*nd_purify*/var B=[...];return ...})(this.left_toolbarGroups)
const leftSrc = grab('(function(g){/*nd_purify*/', '})(this.left_toolbarGroups)');
const left = eval(leftSrc);
const groups = [{ toolbarKey: 'mainOpList', items: ['upload', 'new_folder', 'new_note', 'add_backup', 'cloud_add', 'record', 'lead_pand', 'lock_safe'].map(k => ({ key: k })) }, { toolbarKey: 'chat-more', items: [{ key: 'chat_more' }] }];
const lr = left(groups);
T('left: keeps core buttons', lr[0].items.map(x => x.key), ['upload', 'new_folder', 'cloud_add']);
T('left: other groups untouched', lr[1].items.map(x => x.key), ['chat_more']);
T('left: input not mutated', groups[0].items.length, 8);
T('left: non-array passthrough', left(undefined), undefined);
// 2) 右工具条：(function(x){/*nd_purify*/...})(a)
const rightSrc = grab('(function(x){/*nd_purify*/', '})(');
const right = eval(rightSrc);
const rg = { toolbarKey: 'right-options', items: ['export_safe', 'share', 'multiple_share', 'download', 'add_to_knowledge', 'ai_summary', 'ai_photo', 'switch_text', 'export_dir', 'batch_rename', 'file_qa', 'delete', 'cloud_print', 'free_board', 'ai_video_edit', 'more'].map(k => ({ key: k })) };
T('right: keeps netdisk ops', right(rg).items.map(x => x.key), ['share', 'multiple_share', 'download', 'export_dir', 'batch_rename', 'delete', 'more']);
// 3) 右键菜单：(function(a){/*nd_purify*/...})(this[e])
const menuSrc = grab('(function(a){/*nd_purify*/', '})(this[e])');
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
const a0 = m.indexOf('o.app.$openImageViewer=function(p){');
const fnSrc = m.slice(a0 + 'o.app.$openImageViewer='.length, m.indexOf('catch(__e){}}', a0) + 'catch(__e){}}'.length);
const calls = [];
const mockRequire = n => (n === 'electron' ? { shell: { openPath: f => calls.push(['open', f]), showItemInFolder: f => calls.push(['reveal', f]) } } : null);
const opener = new Function('require', 'return ' + fnSrc)(mockRequire);
const cases = { 'C:\\d\\photo.JPG': 'open', 'C:\\d\\movie.mkv': 'open', 'C:\\d\\paper.pdf': 'open', 'C:\\d\\report.docx': 'open',
  'C:\\d\\setup.exe': 'reveal', 'C:\\d\\run.bat': 'reveal', 'C:\\d\\a.ps1': 'reveal', 'C:\\d\\x.vbs': 'reveal', 'C:\\d\\pack.zip': 'reveal',
  'C:\\d\\lnk.lnk': 'reveal', 'C:\\d\\b.msi': 'reveal', 'C:\\d\\noext': 'reveal', 'C:\\d\\evil.pdf.exe': 'reveal', 'C:\\d\\page.html': 'reveal' };
for (const [f, want] of Object.entries(cases)) { calls.length = 0; opener('"' + f + '" --netdiskdownload='); T('opener ' + f.split('\\').pop() + ' -> ' + want, calls.map(c => c[0]), [want]); }
calls.length = 0; opener('{"path":"/x.jpg"}'); T('opener ignores cloud JSON arg', calls.length, 0);

// 5) 头像卡片导航白名单：取出 onNav 的守卫语句单独求值
{
  const g0 = s.indexOf('onNav:function(e){/*nd_purify*/');
  const guard = s.slice(g0 + 'onNav:function(e){/*nd_purify*/'.length, s.indexOf('switch(', g0));
  const nav = new Function('e', guard + 'return "passed"');
  T('avatar nav: avatar click ignored', nav({ evt: 'vipBadgeClk' }), undefined);
  T('avatar nav: renew/benefit ignored', [nav({ evt: 'upgradeBtnClick' }), nav({ evt: 'benefitClick' }), nav({ evt: 'userAiPointBuyBtn' }), nav(null)], [undefined, undefined, undefined, undefined]);
  T('avatar nav: help/switch account pass', [nav({ evt: 'helpCenter' }), nav({ evt: 'logout' })], ['passed', 'passed']);
  const nl = s.slice(s.indexOf('o=(e.navList||[]).filter('), s.indexOf(',n=e.benefits&&'));
  const navList = new Function('e', 'var o;' + nl + ';return o');
  T('avatar navList: only help/switch', navList({ navList: [{ text: '个人主页', evt: 'userHome' }, { text: '帮助中心', evt: 'helpCenter' }, { text: '切换账号', evt: 'logout' }] }).map(x => x.evt), ['helpCenter', 'logout']);
}
// 6) 侧栏 / 顶栏 关键数据层补丁存在
T('sidebar bottom emptied', s.includes('bottom:/*nd_purify*/[]'), true);
T('reward task / vip btn / update removed', ['/*nd_purify*/!1&&t.push({key:"headerRewardTask"', '/*nd_purify*/!0||t.push({comp:"headerVipBtn"', 'updateConfig:function(){/*nd_purify*/return[]}'].map(k => s.includes(k)), [true, true, true]);

console.log(bad ? bad + ' FAILED' : 'ALL PASS');
process.exit(bad ? 1 : 0);
