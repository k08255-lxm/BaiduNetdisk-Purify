// File-list toolbars, context menu and image-preview buttons: drop office / AI / safebox / marketing entries.
'use strict';
const { MARK } = require('./index');
const { IMPORT, ID } = require('../engine');
const { TOOLBAR_LEFT_DROP, TOOLBAR_RIGHT_DROP, CONTEXT_MENU_DROP } = require('../../patchset_def.js');

// webpack 4: Object(H.b)   webpack 5: (0,P.T)   -> captured whole, re-emitted verbatim
const CALL = '(' + IMPORT(`${ID}\\.${ID}`) + ')';
const SEARCH_DROP = [...new Set([...TOOLBAR_LEFT_DROP, ...TOOLBAR_RIGHT_DROP])];
const id = '[\\w$]+';

// the item-array filters (identical text to the 1.x edits)
const leftFilter = () => '(function(g){' + MARK +
  'var B=' + JSON.stringify(TOOLBAR_LEFT_DROP) + ';return Array.isArray(g)?g.map(function(x){return x&&Array.isArray(x.items)?Object.assign({},x,{items:x.items.filter(function(i){return!i||B.indexOf(i.key)<0})}):x}):g})';
const rightFilter = list => '(function(x){' + MARK +
  'var B=' + JSON.stringify(list) + ';return x&&Array.isArray(x.items)?Object.assign({},x,{items:x.items.filter(function(i){return!i||B.indexOf(i.key)<0})}):x})';

// the main list header (mainHeaderOperate): visible condition ends with "...chatVisible&&!x&&y,className:"toggleOperateMenu ..."
const MAIN_TAIL = String.raw`(?<=this\.showInSearch&&!this\.chatVisible&&!${id}&&${id},className:"toggleOperateMenu "[^{}]{0,80}\}\]\},)`;
// the search-page right toolbar: no extra condition before className
const SEARCH_TAIL = String.raw`(?<=this\.showInSearch&&!this\.chatVisible,className:"toggleOperateMenu "[^{}]{0,80}\}\]\},)`;

module.exports = {
  rules: [
    // ---- left toolbar (60-65) --------------------------------------------------------------------------------
    // 8.9.7 / 8.10.3: computed renderedLeftGroups wraps left_toolbarGroups. Older builds: the template binds
    // left_toolbarGroups directly (leftOperateRef header), so the same filter is wrapped around that binding.
    { id: 'toolbar_menu.left-toolbar', legacy: [60, 61, 62, 63, 64, 65], mode: 'each', min: 1,
      name: '工具条(左): 去办公/AI',
      find: new RegExp(String.raw`renderedLeftGroups:function\(\)\{return( ?${IMPORT(`${ID}\\.${ID}`)})\(this\.left_toolbarGroups,this\.leftAvailableW\)\}` +
        '|' + String.raw`(ref:"leftOperateRef",staticClass:"commonBtnsWrap left-operator"\},\[${id}\("operate-toolbar",\{attrs:\{groups:)(${id}\.left_toolbarGroups)(?=,variant:"left")`),
      repl: (m, call, pre, bind) => m.startsWith('renderedLeftGroups')
        ? 'renderedLeftGroups:function(){return' + call + '(' + leftFilter() + '(this.left_toolbarGroups),this.leftAvailableW)}'
        : pre + leftFilter() + '(' + bind + ')' },

    // ---- right toolbar, main list (66-71) ---------------------------------------------------------------------
    // 8.9.7+: the call carries a 3rd argument ({guaranteedKeys}); older builds: the call ends right after rightAvailableW
    { id: 'toolbar_menu.right-toolbar', legacy: [66, 67, 68, 69, 70, 71], mode: 'each', min: 1,
      name: '工具条(右): 去办公/AI',
      find: new RegExp(MAIN_TAIL + String.raw`(${id})=${CALL}\(\[(${id})\],this\.rightAvailableW([,)])`),
      repl: (m, o, call, a, term) => o + '=' + call + '([' + rightFilter(TOOLBAR_RIGHT_DROP) + '(' + a + ')],this.rightAvailableW' + term },

    // ---- right toolbar, search page (110, 111) ----------------------------------------------------------------
    { id: 'toolbar_menu.search-right-toolbar', legacy: [110, 111], mode: 'each', min: 1,
      name: '工具条(右,搜索页): 去保险箱/备份/办公/AI',
      find: new RegExp(SEARCH_TAIL + String.raw`(${id})=${CALL}\(\[(${id})\],this\.rightAvailableW\);return this\.hiddenToolbarItems`),
      repl: (m, o, call, a) => o + '=' + call + '([' + rightFilter(SEARCH_DROP) + '(' + a + ')],this.rightAvailableW);return this.hiddenToolbarItems' },

    // ---- context menu (72-75) ---------------------------------------------------------------------------------
    { id: 'toolbar_menu.context-menu', legacy: [72, 73, 74, 75], mode: 'each', min: 1,
      name: '右键菜单: 去办公/AI/推销项',
      find: new RegExp(String.raw`this\.operateList=this\[(${id})\]`),
      repl: (m, e) => 'this.operateList=(function(a){' + MARK + 'var B=' + JSON.stringify(CONTEXT_MENU_DROP) +
        ';if(!Array.isArray(a))return a;var o=[];a.forEach(function(x){if(x&&B.indexOf(x.name)>=0)return;' +
        'if(x&&"line"===x.type){var p=o[o.length-1];if(!o.length||p&&"line"===p.type)return}o.push(x)});' +
        'while(o.length&&o[o.length-1]&&"line"===o[o.length-1].type)o.pop();return o})(this[' + e + '])' },

    // ---- image preview (76) -----------------------------------------------------------------------------------
    // 8.9.7+: hiddenBtnNames computed ends with r.concat(this.excludeBtnNames||[]) -> append the AI / convert button types
    { id: 'toolbar_menu.image-preview-hidden-btns', legacy: [76], mode: 'one', where: { contains: 'excludeBtnNames||[]' },
      name: '图片预览: 去AI/格式转换按钮',
      feature: 'excludeBtnNames',
      find: new RegExp(String.raw`(?<=(${id})\.BUTTON_TYPE\.SAVE\]\)\),)${id}\.concat\(this\.excludeBtnNames\|\|\[\]\)`),
      repl: (m, P) => m.slice(0, -1) + ',' + MARK + '[' + ['AI_GENFLOW', 'AI_PHOTO', 'OCR', 'IMG_CONVERT', 'IMG_TO_WORD', 'IMG_TO_EXCEL', 'IMG_TO_PDF']
        .map(k => P + '.BUTTON_TYPE.' + k).join(',') + '].filter(Boolean))' },

    // 8.5.9 .. 8.9.2 (no hiddenBtnNames yet): the bottom button groups are built in the bottomButtons computed from
    // static groups to which created() pushes the OCR ("ocr"), AI修图 and 图片转换 buttons. Filter them out at render time.
    { id: 'toolbar_menu.image-preview-old-bottom-btns', seq: 76.1, mode: 'each', min: 1,
      name: '图片预览(旧版): 去AI修图/文字提取/格式转换按钮',
      feature: 'bottomButton[1].push({text:"文字提取",name:"ocr"',
      find: new RegExp(String.raw`bottomButtons:function\(\)\{return (${id}\.imgContainer\.fileList&&[^{}]{0,200}?this\.imgContainer\.bottomButton\.slice\(0,1\):this\.imgContainer\.bottomButton)\}`.replace(String.raw`(${id}\.imgContainer`, String.raw`(this\.imgContainer`)),
      repl: (m, cond, ctx) => {
        let P = null, re = new RegExp(String.raw`(${id})\.BUTTON_TYPE\.IMG_CONVERT`, 'g'), x;
        while ((x = re.exec(ctx.text)) && x.index < ctx.index) P = x[1];
        if (!P) throw new Error('BUTTON_TYPE module variable not found');
        return 'bottomButtons:function(){return(function(g){' + MARK + 'var B=[' + P + '.BUTTON_TYPE.AI_PHOTO,' + P + '.BUTTON_TYPE.IMG_CONVERT,"ocr"].filter(Boolean);' +
          'return Array.isArray(g)?g.map(function(r){return Array.isArray(r)?r.filter(function(b){return!b||B.indexOf(b.name)<0}):r}).filter(function(r){return!Array.isArray(r)||r.length>0}):g})(' + cond + ')}';
      } },

    // 8.7.9 .. 8.9.2: right-hand vertical AI list (库库AI + AI滤镜/智能消除/裁剪/AI美颜) -> always empty
    { id: 'toolbar_menu.image-preview-old-ai-nav', seq: 76.2, mode: 'each', min: 1,
      name: '图片预览(旧版): 去右侧库库AI/AI编辑竖条',
      feature: 'icon:"ai-genflow"',
      find: new RegExp(String.raw`(${id})=function\(e\)\{var ${id}=e\?${id}:\[\];return[^{}]{0,200}enable_genflow_penetrate_v2"\)\?${id}:\[${id}\]\.concat\(${id}\)\}`),
      repl: (m, fn) => fn + '=function(e){' + MARK + 'return[]}' },

    // 8.5.9 / 8.6.8: same vertical AI-edit list, but a static array (no genflow entry / Le() function yet)
    { id: 'toolbar_menu.image-preview-old-ai-nav-static', seq: 76.3, mode: 'all', min: 2, max: 2, where: { contains: 'bottomButton[1].push({text:"文字提取"' },
      name: '图片预览(旧版静态): 去右侧AI编辑竖条',
      feature: /navRightBtnList:[\w$]+,downloadAndEditBtn:/,
      find: new RegExp(String.raw`navRightBtnList:${id}(?=,downloadAndEditBtn:)|this\.navRightBtnList=this\.shouldUseDownloadAndEdit\(\)\?${id}:\[\]`),
      repl: m => m.startsWith('navRightBtnList:') ? 'navRightBtnList:' + MARK + '[]' : 'this.navRightBtnList=' + MARK + '[]' },
  ],
  dropped: [],
};
