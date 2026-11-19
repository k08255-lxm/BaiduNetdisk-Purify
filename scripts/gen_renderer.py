# 由 purify_renderer.css 生成 patch/__nd_purify_renderer.js（index.html 以 <script src> 注入，所有窗口共用）
import json, sys
css_path, out_path = sys.argv[1], sys.argv[2]
css = open(css_path, encoding='utf-8').read()
js = (
    '// 百度网盘 去营销 —— 渲染端隐藏样式注入（由 index.html 加载，所有窗口共用）\n'
    '(function(){"use strict";\n'
    '  if(document.getElementById("nd-purify-style"))return;\n'
    '  var css=' + json.dumps(css) + ';\n'
    '  function inject(){if(document.getElementById("nd-purify-style"))return;'
    'var s=document.createElement("style");s.id="nd-purify-style";s.textContent=css;'
    '(document.head||document.documentElement).appendChild(s);}\n'
    '  if(document.head)inject();else document.addEventListener("DOMContentLoaded",inject);\n'
    '})();\n'
)
open(out_path, 'w', encoding='utf-8').write(js)
print('renderer inject bytes', len(js))
