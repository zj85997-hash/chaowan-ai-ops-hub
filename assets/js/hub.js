/* 指挥中心：8 个 Agent 卡片、运行台、5 步主演示 */
(function () {
  'use strict';
  var D = window.HUB_DATA, E = window.HubUI.engine(), esc = window.HubUI.esc;
  var $ = function (s) { return document.querySelector(s); };
  var calls = D.KPI.agentCalls, alerts = D.KPI.alerts, current = null, busy = false;

  /* ---------- KPI ---------- */
  function money(n) { return '¥' + (n / 10000).toFixed(1) + ' 万'; }
  function renderKpis() {
    $('#kpis').innerHTML =
      '<div class="kpi glass gx"><span>今日营收</span><b>' + money(D.KPI.revenueToday) + '</b><small>演示数据</small></div>' +
      '<div class="kpi glass gx"><span>活跃用户</span><b>' + D.KPI.activeUsers.toLocaleString('en-US') + '</b><small>今日 DAU</small></div>' +
      '<div class="kpi glass gx"><span>Agent 调用</span><b id="kpi-calls">' + calls.toLocaleString('en-US') + '</b><small>今日累计</small></div>' +
      '<div class="kpi glass gx alert"><span>待处理告警</span><b id="kpi-alerts">' + alerts + '</b><small>需人工确认</small></div>';
    window.HubUI.wire($('#kpis'));
  }
  function bump() { calls++; var el = $('#kpi-calls'); if (el) el.textContent = calls.toLocaleString('en-US'); }

  /* ---------- Agent 卡片 ---------- */
  function renderAgents() {
    $('#agents').innerHTML = D.AGENTS.map(function (a) {
      return '<article class="agent-card glass corners gx reveal" data-agent="' + a.id + '">' +
        '<div class="ac-head"><span class="emoji">' + a.icon + '</span><span class="tier ' + a.tier + '">' + a.tier + ' 档</span></div>' +
        '<h3>' + a.no + ' ' + esc(a.name) + '</h3><p>' + esc(a.desc) + '</p><div class="replace">替代：' + esc(a.replaces) + ' · 知识库 ' + a.kb + '</div>' +
        '<div class="scenes">' + D.SCENES[a.id].map(function (s, i) { return '<button type="button" data-scene="' + i + '">▶ ' + esc(s.label) + '</button>'; }).join('') + '</div></article>';
    }).join('');
    $('#agents').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-scene]');
      if (!b) return;
      var id = b.closest('[data-agent]').getAttribute('data-agent');
      run(id, JSON.parse(JSON.stringify(D.SCENES[id][+b.getAttribute('data-scene')].input)));
    });
    window.HubUI.wire($('#agents'));
  }

  /* ---------- 输入表单 ---------- */
  var USER_OPTS = function (sel, withGuest) {
    return (withGuest ? '<option value="">未登录用户</option>' : '') + Object.keys(D.USERS).map(function (k) {
      return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + k + '（' + D.USERS[k].vip + '）</option>';
    }).join('');
  };
  function field(label, html) { return '<div class="field"><label>' + label + '</label>' + html + '</div>'; }
  function formFor(id, inp) {
    inp = inp || {};
    switch (id) {
      case 'compensation': return field('用户 ID（代码节点精确查询）', '<select name="user_id">' + USER_OPTS(inp.user_id) + '</select>') + field('投诉内容', '<textarea name="complaint">' + esc(inp.complaint || '') + '</textarea>');
      case 'risk_monitor': return field('群消息（每行一条：群名 | 用户 | 内容）', '<textarea name="messages" style="min-height:150px">' + esc((inp.messages || []).map(function (m) { return m.group + ' | ' + m.user + ' | ' + m.text; }).join('\n')) + '</textarea>');
      case 'ops_qa': return field('用自然语言问数', '<textarea name="question">' + esc(inp.question || '') + '</textarea>');
      case 'product_select': return field('品类', '<select name="category">' + ['全部', '潮玩手办', '数码产品', '美妆个护', '零食', '周边文具', '汉服配饰'].map(function (c) { return '<option' + (c === inp.category ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>') + field('选几款', '<input name="count" type="number" min="1" max="12" value="' + (inp.count || 6) + '">');
      case 'product_layout': return field('一箱份数', '<input name="slots" type="number" min="20" max="300" value="' + (inp.slots || 80) + '">') + field('单抽价格（元）', '<input name="price" type="number" min="5" step="1" value="' + (inp.price || 59) + '">') + field('毛利要求（%）', '<input name="margin" type="number" min="0" max="80" value="' + Math.round((inp.margin === undefined ? 0.4 : inp.margin) * 100) + '">');
      case 'collect_calc': return field('当前积分', '<input name="points" type="number" min="0" value="' + (inp.points || 0) + '">') + field('目标商品', '<select name="target">' + D.PRODUCTS.filter(function (p) { return p.trend > -10; }).map(function (p) { return '<option value="' + p.id + '"' + (p.id === inp.target ? ' selected' : '') + '>' + esc(p.name) + '（' + E.redeemPoints(p) + ' 积分）</option>'; }).join('') + '</select>');
      case 'user_profile': return field('用户 ID', '<select name="user_id">' + USER_OPTS(inp.user_id) + '</select>');
      case 'customer_service': return field('用户', '<select name="user_id">' + USER_OPTS(inp.user_id, true) + '</select>') + field('用户的问题', '<textarea name="question">' + esc(inp.question || '') + '</textarea>');
    }
    return '';
  }
  function readForm(id) {
    var f = $('#console-form'), v = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    switch (id) {
      case 'compensation': return { user_id: v('user_id'), complaint: v('complaint') };
      case 'risk_monitor': return { messages: v('messages').split('\n').map(function (l) { var p = l.split('|').map(function (x) { return x.trim(); }); return p.length >= 3 ? { group: p[0], user: p[1], text: p.slice(2).join('|') } : null; }).filter(Boolean) };
      case 'ops_qa': return { question: v('question') };
      case 'product_select': return { category: v('category'), count: +v('count') || 6 };
      case 'product_layout': return { slots: +v('slots'), price: +v('price'), margin: (+v('margin')) / 100 };
      case 'collect_calc': return { points: +v('points'), target: v('target') };
      case 'user_profile': return { user_id: v('user_id') };
      case 'customer_service': return { user_id: v('user_id'), question: v('question') };
    }
    return {};
  }
  function select(id, input) {
    current = id;
    var a = D.AGENTS.filter(function (x) { return x.id === id; })[0];
    document.querySelectorAll('.agent-card').forEach(function (c) { c.classList.toggle('selected', c.getAttribute('data-agent') === id); });
    $('#console-title').textContent = a.no + ' ' + a.name;
    $('#console-hint').textContent = '替代 ' + a.replaces + '。改输入后点「运行」，看它怎么判断。';
    $('#console-form').innerHTML = formFor(id, input);
  }

  /* ---------- 运行 ---------- */
  function run(id, input, opts) {
    if (busy) return Promise.resolve();
    opts = opts || {};
    select(id, input);
    var card = document.querySelector('.agent-card[data-agent="' + id + '"]');
    card.classList.add('running');
    busy = true; bump();
    if (!opts.noScroll) $('#console').scrollIntoView({ behavior: window.HubUI.reduceMotion ? 'auto' : 'smooth', block: 'start' });
    var r = E.run(id, input);
    return window.HubUI.renderResult($('#console-out'), r, {
      onChain: function (act) { busy = false; if (tourStep === 1) { tourStep = 2; renderTour(); } run(act.agent, act.input); },
      onAdopt: function () { if (alerts > 0) { alerts--; $('#kpi-alerts').textContent = alerts; } }
    }).then(function () {
      busy = false; card.classList.remove('running');
      if (id === 'risk_monitor') card.classList.toggle('alerting', r.level === 'high');
      return r;
    });
  }

  /* ---------- 5 步主演示 ---------- */
  var tourStep = -1;
  var TOUR = [
    { t: '打开', d: '8 个 Agent 待命，② 社群风控在持续扫描群消息。状态栏亮绿灯，不用注册、不用登录。' },
    { t: '发现', d: '② 社群风控扫到 VIP 群里有人带节奏，命中「诈骗」「12315」「举报」，卡片跳红告警。', go: function () { return run('risk_monitor', D.SCENES.risk_monitor[0].input); } },
    { t: '转判定', d: '点告警里的「转投诉处理」：① 按 user_id 精确查库、检索补偿 SOP、算金额，思考过程逐条可见。', go: function () { return run('compensation', { user_id: 'U10086', complaint: D.SCENES.risk_monitor[0].input.messages[0].text }); } },
    { t: '出方案', d: '① 给出金额、比例、方式、风险四项结论；⑦ 同步给出用户画像。AI 只出建议，主管点「采纳」才生效，也可以手动改金额。', go: function () { return run('user_profile', { user_id: 'U10086' }); } },
    { t: '收口', d: '话术一键复制发给用户；③ 把这一例计入当日补偿率，看是否还在正常区间。', go: function () { return run('ops_qa', { question: '今天的补偿率是多少？' }); } }
  ];
  function renderTour() {
    $('#tour-steps').innerHTML = TOUR.map(function (s, i) { return '<div class="' + (i === tourStep ? 'on' : i < tourStep ? 'done' : '') + '"><b>' + (i + 1) + ' · ' + s.t + '</b>' + (i === tourStep ? '进行中' : i < tourStep ? '已完成' : '') + '</div>'; }).join('');
    $('#tour-desc').textContent = TOUR[tourStep].d;
    $('#tour-next').textContent = tourStep < TOUR.length - 1 ? '下一步 →' : '重新开始';
  }
  function tourAdvance() {
    tourStep = tourStep < TOUR.length - 1 ? tourStep + 1 : 0;
    renderTour();
    if (TOUR[tourStep].go) TOUR[tourStep].go();
    else $('#tour').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('#tour-start').addEventListener('click', function () {
    $('#tour').classList.add('on'); tourStep = -1; tourAdvance();
  });
  $('#tour-next').addEventListener('click', tourAdvance);
  $('#console-run').addEventListener('click', function () { if (current) run(current, readForm(current), { noScroll: true }); });

  renderKpis();
  renderAgents();
  select('risk_monitor', D.SCENES.risk_monitor[0].input);
  // 深链接：index.html#run=compensation:0 打开就运行这个场景，方便分享
  var deep = location.hash.match(/^#run=([a-z_]+)(?::(\d))?$/);
  if (deep && D.SCENES[deep[1]]) run(deep[1], JSON.parse(JSON.stringify(D.SCENES[deep[1]][+(deep[2] || 0)].input)));
})();
