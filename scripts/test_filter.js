require(require('path').resolve(process.argv[2]));
const P = global.__ndPurify; let bad = 0;
const T = (desc, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', desc, ok ? '' : JSON.stringify(got)); };
const enc = a => encodeURIComponent(JSON.stringify(a.map(k => ({ cfg_category_key: k, cfg_version: 0 }))));
// 应拦截
T('adx', P.filterApi('https://pan.baidu.com/rest/2.0/pcs/adx?m=tab&d=pc'), { block: true });
T('activityentry', P.filterApi('https://pan.baidu.com/act/api/activityentry'), { block: true });
T('relative path', P.filterApi('/rest/2.0/membership/guide?x=1'), { block: true });
T('goldcoin page', P.filterApi('https://pan.baidu.com/operation/activitys/goldcoin?a=1'), { block: true });
T('games host', P.filterApi('http://wan.baidu.com/home?idfrom=10004'), { block: true });
T('conf marketing', P.filterApi('https://pan.baidu.com/act/api/conf?conf_key=game_second_title'), { block: true });
T('conf in params', P.filterApi('https://pan.baidu.com/act/api/conf', { conf_key: 'na_business_pay_rule' }), { block: true });
T('syscfg all-marketing', P.filterApi('https://pan.baidu.com/api/getsyscfg?cfg_category_keys=' + enc(['header_gold_coin_area'])), { block: true });
const mixed = P.filterApi('https://pan.baidu.com/api/getsyscfg?cfg_category_keys=' + enc(['netdisk_docchat_config', 'my_card_saleslot', 'pc_easyprint', 'pan_gold_coin_center']) + '&app_id=250528');
T('syscfg mixed -> keep functional', mixed && JSON.parse(decodeURIComponent(/cfg_category_keys=([^&]*)/.exec(mixed.url)[1])).map(x => x.cfg_category_key), ['netdisk_docchat_config', 'pc_easyprint']);
T('syscfg mixed keeps other params', mixed && mixed.url.endsWith('&app_id=250528'), true);
// 不应拦截（功能接口）
for (const u of ['https://pan.baidu.com/api/list?dir=/', '/api/quota', 'https://pan.baidu.com/rest/2.0/membership/user/info',
  'https://pan.baidu.com/api/user/isHitCrowd', 'https://pan.baidu.com/act/api/conf?conf_key=mac_ai_subtitle_config_417',
  'https://pan.baidu.com/api/getsyscfg?cfg_category_keys=' + enc(['netdisk_docchat_config', 'workspace_pc_config']),
  'https://pan.baidu.com/rest/2.0/pcs/file?method=list', 'https://pan.baidu.com/learn/query/strategy',
  'https://pan.baidu.com/transfer/card', 'https://pan.baidu.com/rest/2.0/membership/advanced', 'https://passport.baidu.com/v3/login/api/auth',
  'https://pan.baidu.com/api/download', 'https://pan.baidu.com/rest/2.0/pcs/adxsomething'])
  T('pass ' + u.slice(0, 70), P.filterApi(u), null);
T('reward center api', P.filterApi('https://pan.baidu.com/reward/center/list?x=1'), { block: true });
T('hotword carousel (recommend/query/list)', P.filterApi('https://pan.baidu.com/recommend/query/list'), { block: true });
T('internat search results NOT blocked (recquery)', P.filterApi('https://pan.baidu.com/richsearch/recquery/get?query=a'), null);
T('search sug still works', P.filterApi('https://pan.baidu.com/aisearch/assearch/querysug?q=a'), null);
T('kuku AI genflow page', P.filterWeb('https://pan.baidu.com/aipan/aiunion/genflow?from=screenshot'), { cancel: true });
T('AI全网搜 page', P.filterApi('https://pan.baidu.com/aipan/aiunion/aisearch'), { block: true });
T('search panel ai tools key stripped', P.filterApi('https://pan.baidu.com/api/getsyscfg?cfg_category_keys=' + enc(['search_pannel_ai_tools'])), { block: true });
T('doc preview NOT blocked', P.filterApi('https://pan.baidu.com/disk/docview?fsid=1'), null);
T('kuku AI second-brain page (aipan/search)', P.filterWeb('https://pan.baidu.com/aipan/search?supportPay=1&from=knowledge&aiClaw=true'), { cancel: true });
T('aipan/searchX is a different path, NOT blocked', P.filterApi('https://pan.baidu.com/aipan/searchx'), null);
T('aipan other paths NOT blocked', P.filterApi('https://pan.baidu.com/aipan/uploadimg?key=a'), null);
// trayMenu：模拟 Windows 主托盘模板
{
  const f = () => 0;
  const N = [{ label: 'me', click: f, icon: 'v' }, { label: '网盘空间 1T/2T', click: f }, { label: '同步空间', enabled: false, click: f }, { type: 'separator' },
    { label: '打开主面板', click: f }, { label: '进入回收站', click: f }, { type: 'separator' }, { label: '开始全部任务', click: f },
    { type: 'separator' }, { label: '打开同步空间', click: f }, { type: 'separator' }, { label: '设置', click: f }, { label: '一键反馈', click: f },
    { type: 'separator' }, { label: '帮助', submenu: [{ label: '400' }, { label: '使用帮助', click: f }, { label: '关于', click: f }, { label: '版本升级', click: f }, { label: '问题反馈', click: f }] },
    { label: '暂停同步', submenu: [{ label: '1小时', click: f }] }, { label: '退出网盘', click: f }, { type: 'separator' }];
  const r = P.trayMenu(N, { user: 'me', ws: '同步空间' });
  T('tray: labels kept', r.map(x => x.label || '-'), ['me', '网盘空间 1T/2T', '-', '打开主面板', '-', '开始全部任务', '-', '设置', '-', '帮助', '退出网盘']);
  T('tray: help submenu', r.find(x => x.label === '帮助').submenu.map(x => x.label), ['400', '使用帮助', '关于', '问题反馈']);
  T('tray: user/space no longer clickable', [r[0].click, r[1].click, r[0].icon], [undefined, undefined, 'v']);
  T('tray: other clicks intact', typeof r.find(x => x.label === '设置').click, 'function');
  T('tray: input not mutated', [N.length, typeof N[0].click, N[14].submenu.length], [18, 'function', 5]);
  T('tray: empty submenu dropped', P.trayMenu([{ label: 'x', submenu: [{ label: '版本升级' }] }, { label: 'y' }]).map(x => x.label), ['y']);
  T('tray: bad input passthrough', P.trayMenu(null), null);
}
// guardAxios：模拟 axios 实例的请求拦截器
{
  const fns = []; const inst = { interceptors: { request: { use: f => fns.push(f) } } };
  P.guardAxios(inst); P.guardAxios(inst); // 幂等：只应注册一次
  T('guardAxios registers once', fns.length, 1);
  const run = cfg => { try { return { ok: fns[0](cfg) }; } catch (e) { return { err: e.message, hasConfig: !!e.config, flag: !!e.ndPurifyBlocked }; } };
  T('axios blocks recommend (abs url)', run({ method: 'post', url: 'https://pan.baidu.com/recommend/query/list', data: {} }),
    { err: '用户手动取消', hasConfig: true, flag: true });
  T('axios blocks relative url + baseURL', run({ url: '/rest/2.0/pcs/adx', baseURL: 'https://pan.baidu.com' }).err, '用户手动取消');
  T('axios blocks conf_key in params', !!run({ url: '/act/api/conf', baseURL: 'https://pan.baidu.com', params: { conf_key: 'game_second_title' } }).err, true);
  const passCfg = { url: '/api/list', baseURL: 'https://pan.baidu.com', params: { dir: '/' } };
  T('axios passes functional', run(passCfg), { ok: passCfg });
  T('guardAxios tolerates bad input', P.guardAxios(null), null);
}
T('web cancel', P.filterWeb('https://pan.baidu.com/embed/reward-task/home'), { cancel: true });
T('web file:// pass', P.filterWeb('file:///C:/x/index.html'), null);
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
