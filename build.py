#!/usr/bin/env python3
"""生成演示站的 5 个页面（共用导航和页脚）。只用 Python 标准库。

    python3 build.py

页面里的数据和交互都在 assets/js/ 里：data.js 是知识库和演示数据，engine.js 是 8 个 Agent 的规则引擎。
"""
import html
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = 'https://github.com/zj85997-hash/chaowan-ai-ops-hub'
HOME = 'https://zj85997-hash.github.io/'

ICONS = {
    'grid': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    'shield': '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    'box': '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    'book': '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
    'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    'moon': '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    'sparkle': '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
    'terminal': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><path d="M12.5 15H17"/>',
    'layers': '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    'pen': '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    'code': '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>',
    'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    'list': '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
}
GITHUB = ('<svg class="i fill" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>')
BOOT = ("(function(){var d=document.documentElement;d.classList.remove('no-js');try{var t=localStorage.getItem('theme');"
        "if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}"
        "d.setAttribute('data-theme',t)}catch(e){}})();")
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%2317171a'/%3E"
           "%3Ctext x='16' y='22' font-size='16' text-anchor='middle' fill='%23fafafa'%3E8%3C/text%3E%3C/svg%3E")


def icon(name, cls=''):
    return '<svg class="i%s" viewBox="0 0 24 24" aria-hidden="true">%s</svg>' % ((' ' + cls) if cls else '', ICONS[name])


def eyebrow(num, ic, label):
    return '<div class="eyebrow"><span class="num">%s</span><span class="sep">/</span>%s<span>%s</span></div>' % (num, icon(ic), label)


NAV = [('index.html', 'grid', '指挥中心'), ('risk.html', 'shield', '风控演示台'), ('box.html', 'box', '组箱定价'), ('kb.html', 'book', '知识库'), ('about.html', 'info', '关于')]


def page(fname, title, desc, body, scripts):
    links = ''.join('<a href="%s"%s>%s<span>%s</span></a>' % (h, ' class="active" aria-current="page"' if h == fname else '', icon(ic), t) for h, ic, t in NAV)
    js = ''.join('<script src="assets/js/%s"></script>\n' % s for s in ['data.js', 'engine.js', 'ui.js'] + scripts)
    return '''<!DOCTYPE html>
<html lang="zh-CN" class="no-js" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s · 潮玩电商 AI 运营中台</title>
<meta name="description" content="%(desc)s">
<link rel="icon" href="%(fav)s">
<script>%(boot)s</script>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="assets/css/hub.css">
</head>
<body>
<header class="site-nav"><div class="container wide"><div class="bar">
<a class="brand" href="index.html"><span class="brand-dot"></span>潮玩 AI 运营中台</a>
<nav class="nav-links" aria-label="主导航">%(links)s</nav>
<div class="nav-tools"><span class="status-pill"><span class="led"></span>8 Agent 运行中 · 离线演示</span>
<a class="icon-btn" href="%(repo)s" target="_blank" rel="noopener" aria-label="GitHub">%(gh)s</a>
<button class="icon-btn theme-btn" type="button" data-theme-toggle aria-label="切换深浅色">%(moon)s%(sun)s</button></div>
</div></div></header>
<main class="container wide">
%(body)s
</main>
<footer class="site-foot"><div class="container wide">
<span class="left"><span class="brand-dot"></span>潮玩电商 AI 运营中台 · 演示站</span>
<span class="right">数据全部虚构 · <a href="%(home)s">付钟浩 Alex</a> · MIT</span>
</div></footer>
%(js)s</body>
</html>
''' % {'title': html.escape(title), 'desc': html.escape(desc), 'fav': FAVICON, 'boot': BOOT, 'links': links, 'repo': REPO, 'gh': GITHUB,
       'moon': icon('moon', 'moon'), 'sun': icon('sun', 'sun'), 'body': body, 'home': HOME, 'js': js}


def back():
    return '<a class="back" href="index.html">%s返回指挥中心</a>' % icon('arrow-left')


INDEX = '''
<section class="intro glass corners gx reveal">
  <span class="kicker">%(sparkle)s AIY 黑客松 · 扣子 Coze 赛道铜奖 · 纯前端复刻</span>
  <h1>潮玩电商 AI 运营中台</h1>
  <p class="lead">潮玩电商的运营每天要干 16 件事，这里把其中 8 件交给了 AI。8 个 Agent 的判断都在你的浏览器里完成：规则写在知识库里，算数交给代码。数据全部虚构，断网也能用。</p>
  <div class="actions"><button class="btn solid" id="tour-start" type="button">▶ 开始 5 步主演示</button><a class="btn" href="risk.html">社群风控演示台</a><a class="btn" href="box.html">组箱定价</a><a class="btn ghost" href="about.html">这是什么项目</a></div>
</section>
<div class="kpis" id="kpis"></div>
<section class="tour glass" id="tour" aria-live="polite"><div class="tour-steps" id="tour-steps"></div><div class="tour-text"><p id="tour-desc"></p><button class="btn solid sm" id="tour-next" type="button">下一步 →</button></div></section>
<section class="section" id="agents-sec">%(e1)s<h2>8 个 Agent</h2><p class="desc">每个 Agent 有两个演示场景，点一下就跑。卡片上写着它替代的人力和用到的知识库。</p><div class="agents" id="agents"></div></section>
<section class="section" id="console">%(e2)s<h2>运行台</h2><p class="desc">左边改输入，右边看 AI 一步步怎么判断。8 个 Agent 输出同一种 JSON 结构，前端只需要一个渲染器。</p>
<div class="console"><div class="console-input glass corners"><h3 id="console-title"></h3><p class="hint" id="console-hint"></p><div id="console-form"></div><button class="btn solid" id="console-run" type="button">运行</button></div>
<div class="console-out glass" id="console-out"><div class="empty"><b>选一个 Agent 场景，或者点「开始 5 步主演示」</b>判断过程会在这里逐条出现。</div></div></div></section>
''' % {'sparkle': icon('sparkle'), 'e1': eyebrow('01', 'grid', 'Agents'), 'e2': eyebrow('02', 'terminal', 'Console')}

RISK = '''
<div class="page-head">%(back)s<h1>社群风控实时演示台</h1><p class="desc">左边改群消息，中间看五步判定，右边看分级结果。68 个敏感词分四级，外加跨群串联检测；改一个字，结果马上变。</p></div>
<div class="risk-board">
<div class="col glass corners"><h3>💬 群聊输入</h3><p class="hint">群名 / 用户 / 内容，改完自动重新判定。</p><div id="msgs"></div><button class="btn sm" id="add" type="button">＋ 添加一条</button><div class="preset-row" id="presets"></div></div>
<div class="col glass corners"><h3>🧠 AI 处理 · 五步判定</h3><p class="hint">过程对运营可见：不可见就不可信，运营不敢用。</p><ol class="steps5" id="steps"></ol></div>
<div class="col glass corners"><h3>📋 分级输出</h3><p class="hint">统一 JSON 契约：summary、metrics、detail、suggestion、meta。</p><div id="result"></div></div>
</div>
''' % {'back': back()}

BOX = '''
<div class="page-head">%(back)s<h1>组箱定价</h1><p class="desc">一箱 80 份、单抽 59 元、毛利守住 40%%，商品成本就不能超过 2,832 元。在这个夹缝里配出六个赏级，是一道有标准答案的数学题。</p></div>
<div class="box-layout">
<div class="console-input glass corners"><h3>输入三个数</h3><p class="hint">改任何一个，右边马上重算。</p>
<div class="field"><label for="slots">一箱份数</label><input id="slots" type="number" min="20" max="300" value="80"></div>
<div class="field"><label for="price">单抽价格（元）</label><input id="price" type="number" min="5" value="59"></div>
<div class="field"><label for="margin">毛利要求（%%）</label><input id="margin" type="number" min="0" max="80" value="40"></div>
<div class="chips"><button class="chip" type="button" data-preset="80,59,40">80 份 · 59 元</button><button class="chip" type="button" data-preset="120,39,40">120 份 · 39 元</button><button class="chip" type="button" data-preset="60,99,45">60 份 · 99 元 · 45%%</button></div></div>
<div class="console-out glass"><div id="verdict"></div><ol class="thinking" id="thinking"></ol><div class="md" id="detail"></div></div>
</div>
<section class="section">%(e1)s<h2>商品库</h2><p class="desc">50 款虚构商品，6 个品类；组箱只从这里选。</p><div class="field" style="max-width:220px"><select id="cat" aria-label="品类"></select></div><div class="md" id="lib"></div></section>
''' % {'back': back(), 'e1': eyebrow('01', 'layers', 'Library')}

KB = '''
<div class="page-head">%(back)s<h1>知识库</h1><p class="desc">规矩交给知识库记，算数交给代码算。下面是 8 个 Agent 依据的全部规则和数据；补偿规则可以现场改，改完马上生效。</p></div>
<div class="tabs" role="tablist"><button class="on" type="button" data-pane="pane-words">敏感词库 68</button><button type="button" data-pane="pane-faq">FAQ 31</button><button type="button" data-pane="pane-esc">转人工规则</button><button type="button" data-pane="pane-sop">补偿规则（可改）</button><button type="button" data-pane="pane-products">商品库 50</button><button type="button" data-pane="pane-ops">运营与用户数据</button></div>
<div class="kb-pane on" id="pane-words"></div>
<div class="kb-pane" id="pane-faq"></div>
<div class="kb-pane" id="pane-esc"></div>
<div class="kb-pane" id="pane-sop"><div class="kb-card glass"><h3>补偿分层标准</h3><p class="hint">改一个数字，点保存，指挥中心里的 ① 立刻按新规则算。以前改一次补偿尺度要改代码、重新上线。</p><div class="sop-form" id="sop-form"></div>
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn solid sm" id="sop-save" type="button">保存并生效</button><button class="btn sm" id="sop-reset" type="button">恢复默认</button><span class="hint" id="sop-note"></span></div>
<div id="sop-preview" style="margin-top:16px"></div></div><div id="pane-sop-static"></div></div>
<div class="kb-pane" id="pane-products"></div>
<div class="kb-pane" id="pane-ops"></div>
''' % {'back': back()}

TASKS = [
    ('选品', '2–3 人 · 4–6 小时', 'AI', '④'), ('组箱', '2 人 · 2–3 小时', 'AI', '⑤'), ('定价与出货率', '1–2 人 · 1–2 小时', 'AI', '⑤'),
    ('素材与上架', '1–2 人 · 2–3 小时', '人工保留', '—'), ('找潮玩主播推广', '3–4 人 · 每周', '人工保留', '—'), ('投放与内容复盘', '2 人 · 每周', '人机配合', '—'),
    ('引导加微信进群', '2–3 人 · 每日', '人机配合', '—'), ('社群运营', '8–12 人 · 7×24 轮班', 'AI', '②'), ('处理群里的负面消息', '要求 15 分钟内', 'AI', '②'),
    ('常规客服', '7–8 人 · 每日 8–10 小时', 'AI', '⑧'), ('数据监控', '1–2 人 · 每日 2 小时', 'AI', '③'), ('区分老客新客', '2 人 · 每日', 'AI', '⑦'),
    ('投诉分级', '30 分钟 / 例', '人机配合', '⑧ → ①'), ('大额亏损投诉处理', '主管 · 2 小时 / 例', 'AI', '①'), ('发货与供应链', '3–4 人 · 每日', '人工保留', '—'),
    ('积分兑换测算', '1–2 人 · 每日', 'AI', '⑥'),
]

ABOUT = '''
<div class="page-head">%(back)s<h1>这是什么项目</h1><p class="desc">AIY 黑客松扣子 Coze 赛道铜奖作品，原版跑在扣子平台上。这个演示站把同一套逻辑用纯前端重写了一遍，谁都能直接打开试。</p></div>
<section class="section">%(e1)s<h2>背景</h2>
<div class="story-card glass corners"><p>目标用户是中小型潮玩电商平台的运营主管和客服主管。每天晚上 9 点到凌晨 1 点是流水最高峰，也是客诉最高峰：大额投诉赔多少全靠主管拍脑袋，社群要 8–12 个人轮班盯着还是会漏，开一期新活动的选品组箱定价要 7–11 小时，算错一次整箱亏。</p>
<p>原版在扣子平台上用 8 个 Bot、8 条 Workflow、4 个知识库和 Python 代码节点实现，外挂指挥中心看板、社群风控演示台和移动端对话页。团队作品，我负责统筹和路演主讲：把业务拆成智能体施工图纸、带队按时交付、上台路演。</p>
<p>这个演示站是赛后重写的纯前端版本：8 个 Agent 的判断逻辑都在浏览器里跑，不依赖扣子、不需要账号，用测试保证和原版文档里的算例结果一致。</p></div></section>
<section class="section">%(e2)s<h2>三层结构</h2>
<pre class="arch">展示层   指挥中心 · 社群风控演示台 · 组箱定价 · 知识库
            │  统一 JSON 输出契约
智能体层 ①补偿决策 ②社群风控 ③数据问答 ④智能选品
         ⑤智能组箱 ⑥积分兑换 ⑦用户画像 ⑧智能客服
            │  规则（语义） / 数据（精确查询）
数据层   补偿 SOP · 敏感词 68 + FAQ 31 · 运营与用户数据 · 商品库 50</pre>
<p class="desc" style="margin-top:14px">一条最重要的设计：<b>规矩交给知识库记，算数交给代码算。</b>补偿规则、敏感词、FAQ 放知识库，改一句话立刻生效；按 user_id 查消费记录、组箱成本验算、同环比计算放代码，100%% 准确，不会查错人、赔错钱。</p></section>
<section class="section">%(e3)s<h2>16 件事里交给 AI 的 8 件</h2>
<div class="md"><div class="tablewrap"><table class="task-table"><thead><tr><th>运营环节</th><th>原来的人力 / 耗时</th><th>归属</th><th>Agent</th></tr></thead><tbody>%(tasks)s</tbody></table></div></div>
<p class="desc" style="margin-top:12px">绿色正好压在最耗人的几条上：砍的不是好做的，是最费人的。素材审美、主播谈判、供应链和最终拍板，主动留给人。</p></section>
<section class="section">%(e4)s<h2>统一输出契约</h2>
<pre class="arch">{
  "agent_id": "risk_monitor",
  "agent_name": "社群风控监控",
  "thinking": ["① 敏感词匹配……", "② 情感分析……", "③ 风险分级……"],
  "output": {
    "summary": "🔴一级高危，建议 15 分钟内响应",
    "metrics": [{"label": "风险等级", "value": "🔴一级高危"}],
    "detail": "### 风险概览 ……",
    "suggestion": "客服主管 15 分钟内在群内回应……"
  },
  "meta": {"latency_ms": 1800, "confidence": 0.95, "kb_hits": 5}
}</pre>
<div class="md" style="margin-top:12px"><ul><li><b>thinking</b>：让判断过程对运营可见，不可见就不可信。</li><li><b>metrics</b>：固定 2–4 个关键指标，一眼看结论。</li><li><b>confidence</b>：低于 0.8 一律转人工，是安全阀不是装饰。</li><li><b>kb_hits</b>：命中了几条知识库规则，证明结论有出处、不是编的。</li></ul></div></section>
<section class="section">%(e5)s<h2>安全与合规边界</h2>
<div class="grid c2">
<div class="story-card glass"><p><b>AI 不做的四件事</b></p><ul class="dash-list"><li>按 user_id 查数据不走语义检索，避免查错人、赔错钱。</li><li>置信度低于 0.8 强制转人工，不编答案。</li><li>AI 只出建议，涉及钱的决定由人点「采纳」才生效。</li><li>判定只看后台客观数据，不看用户投诉写得好不好。</li></ul></div>
<div class="story-card glass"><p><b>业务侧</b></p><ul class="dash-list"><li>出货概率在活动页公示；平台仅向 18 岁以上用户提供服务。</li><li>涉及未成年人消费：最高优先级转人工，AI 不给金额。</li><li>补偿优先线上补货，实际发货并留存物流记录。</li><li>回收、转卖、收益类问题不作答：平台不参与、不担保任何私下交易。</li></ul></div>
</div></section>
<section class="section">%(e6)s<h2>这个演示站怎么做的</h2>
<div class="story-card glass corners"><p>纯静态网站，零依赖：<code>assets/js/data.js</code> 是知识库和演示数据，<code>assets/js/engine.js</code> 是 8 个 Agent 的规则引擎，页面只负责展示。</p>
<p>用 Node 自带的测试框架写了 13 个测试，原版文档里的三个算例一字不差：VIP 大额亏损补偿 ¥32,800、高频投诉劝退结算 ¥480、80 份组箱成本 ¥2,831 / 毛利 40.02%%。</p>
<p>所有用户、商品、运营数字都是虚构的，不对应任何真实平台或品牌。源码在 <a href="%(repo)s">GitHub</a>，MIT 许可。作者：<a href="%(home)s">付钟浩（Alex）</a>。</p></div></section>
''' % {'back': back(), 'e1': eyebrow('01', 'pen', 'Story'), 'e2': eyebrow('02', 'layers', 'Architecture'), 'e3': eyebrow('03', 'list', 'Tasks'),
       'e4': eyebrow('04', 'code', 'Contract'), 'e5': eyebrow('05', 'lock', 'Safety'), 'e6': eyebrow('06', 'terminal', 'How'),
       'tasks': ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (a, b, {'AI': '🟢 AI', '人机配合': '🟡 人机配合', '人工保留': '⬜ 人工保留'}[c], d) for a, b, c, d in TASKS),
       'repo': REPO, 'home': HOME}

PAGES = [
    ('index.html', '指挥中心', '潮玩电商 AI 运营中台演示站：8 个 Agent 的指挥中心，含 5 步主演示。纯前端、数据虚构、断网可用。', INDEX, ['hub.js']),
    ('risk.html', '社群风控演示台', '三栏演示：群聊输入、五步判定、分级输出。68 个敏感词分四级，跨群串联检测。', RISK, ['risk.js']),
    ('box.html', '组箱定价', '输入份数、单价和毛利线，实时配出六个赏级并验算成本上限。', BOX, ['box.js']),
    ('kb.html', '知识库', '8 个 Agent 依据的全部规则和数据，补偿规则可以现场修改。', KB, ['kb.js']),
    ('about.html', '关于这个项目', 'AIY 黑客松扣子 Coze 赛道铜奖作品的纯前端复刻：背景、架构、统一输出契约、安全与合规边界。', ABOUT, []),
]


def main():
    for fname, title, desc, body, scripts in PAGES:
        with open(os.path.join(ROOT, fname), 'w', encoding='utf-8') as f:
            f.write(page(fname, title, desc, body, scripts))
        print('  ' + fname)
    open(os.path.join(ROOT, '.nojekyll'), 'w').close()


if __name__ == '__main__':
    main()
