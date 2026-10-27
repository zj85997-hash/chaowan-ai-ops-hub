/* 知识库：把 4 个知识库摊开给人看；补偿规则可以现场改，改完立刻生效 */
(function () {
  'use strict';
  var D = window.HUB_DATA, esc = window.HubUI.esc;
  var $ = function (s) { return document.querySelector(s); };
  var E = window.HubUI.engine();
  function tbl(head, rows, rowCls) {
    return '<div class="md"><div class="tablewrap"><table><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r, i) { return '<tr' + (rowCls && rowCls(i) ? ' class="' + rowCls(i) + '"' : '') + '>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
  }
  // 敏感词
  $('#pane-words').innerHTML = [1, 2, 3, 4].map(function (lv) {
    var L = D.LEVELS[lv], ws = D.SENSITIVE.filter(function (w) { return w.level === lv; });
    return '<div class="kb-card glass"><h3>' + L.icon + ' ' + L.name + ' · ' + L.tag + '（' + ws.length + ' 个）</h3><p class="hint">处置：' + esc(L.action) + '，' + L.respond + '内响应。</p><div class="word-chips">' +
      ws.map(function (w) { return '<span title="变体：' + esc(w.variants.join('、') || '无') + '">' + esc(w.word) + '<small>' + w.severity + '</small></span>'; }).join('') + '</div></div>';
  }).join('') + '<div class="kb-card glass"><h3>跨群串联检测规则</h3>' + tbl(['规则', '触发条件', '动作'], D.CROSS_RULES.map(function (r) { return [r.id, esc(r.rule), esc(r.action)]; })) +
    '<p class="hint">用户累计风险分窗口 ' + D.RISK_ACCUMULATION.windowHours + ' 小时，阈值 ' + D.RISK_ACCUMULATION.threshold + ' 分。</p></div>';
  // FAQ
  $('#pane-faq').innerHTML = D.INTENT_WHITELIST.map(function (c) {
    var fs = D.FAQ.filter(function (f) { return f.cat === c; });
    return '<div class="kb-card glass"><h3>' + c + '（' + fs.length + ' 条）</h3>' + tbl(['问题', '回答', '关键词'], fs.map(function (f) { return [esc(f.q), esc(f.a), esc(f.kw.join('、'))]; })) + '</div>';
  }).join('') + '<div class="kb-card glass"><h3>白名单外的话题</h3><p>出现「' + esc(D.BLOCKED_TOPICS.words.join('、')) + '」时不作答，固定回复：' + esc(D.BLOCKED_TOPICS.reply) + '</p></div>';
  // 转人工
  $('#pane-esc').innerHTML = '<div class="kb-card glass"><h3>转人工规则（6 条）</h3>' + tbl(['规则', '触发条件', '转给'], D.ESCALATION.map(function (e) { return [e.id, esc(e.rule), esc(e.to)]; })) +
    '<p class="hint">置信度 = 关键词匹配 40% + 语义相似 35% + 上下文 15% + 用户画像 10%，低于 0.8 一律转人工。</p></div>';
  // 商品
  $('#pane-products').innerHTML = '<div class="kb-card glass"><h3>商品库（50 款，名称均为虚构）</h3>' + tbl(['编号', '商品', '品类', '官方价', '采购价', '二手热度', '趋势', '稀有度', '售罄率', '吸引力'],
    D.PRODUCTS.map(function (p) { return [p.id, esc(p.name), p.cat, E.money(p.official), E.money(p.cost), p.heat, (p.trend > 0 ? '+' : '') + p.trend + '%', p.rarity, p.sell + '%', p.attract]; }),
    function (i) { return D.PRODUCTS[i].trend <= -10 ? 'anomaly' : ''; }) + '</div>';
  // 运营数据
  var anomalyRow = function (i) { var d = D.OPS_DAYS[i]; return d.payout > 0.66 || d.complaints / d.orders > 0.018 ? 'anomaly' : ''; };
  $('#pane-ops').innerHTML = '<div class="kb-card glass"><h3>7 天运营数据</h3>' + tbl(['日期', '流水', '订单', 'DAU', '付费用户', '出货率', '3 日发货率', '客诉', '客诉率', '补偿', '毛利率'],
    D.OPS_DAYS.map(function (d) { return [d.date, E.money(d.gmv), d.orders, d.dau, d.payers, E.pct(d.payout, 1), E.pct(d.ship3d, 1), d.complaints, E.pct(d.complaints / d.orders, 2), E.money(d.compensation), E.pct(d.margin, 1)]; }), anomalyRow) +
    '<p class="hint">红底两天是故意保留的异常点：10-25 出货率偏离基准、10-26 客诉率冲高。没有异常的数据，③ 的预警功能就没有东西可演示。</p></div>' +
    '<div class="kb-card glass"><h3>用户数据（虚构，按 user_id 精确查询）</h3>' + tbl(['用户', 'VIP', '累计消费', '今日亏损', '最后一笔', '30 天投诉', '30 天退款', '注册天数', '提货率'],
    Object.keys(D.USERS).map(function (k) { var u = D.USERS[k]; return [k + (u.minorFlag ? '（疑似未成年）' : ''), u.vip, E.money(u.total), E.money(u.todayLoss), E.money(u.lastOrder), u.complaints30d, u.refunds30d, u.regDays, E.pct(u.pickupRate)]; })) + '</div>';
  // 补偿规则：可编辑
  var SOP = D.COMPENSATION_SOP;
  function sopForm() {
    $('#sop-form').innerHTML = SOP.bands.map(function (b, i) { return '<div class="field"><label>' + esc(b.label) + '（基准 %）</label><input type="number" min="0" max="70" step="1" data-band="' + i + '" value="' + Math.round(b.ratio * 100) + '"></div>'; }).join('') +
      ['钻石', '黄金', '白银'].map(function (k) { return '<div class="field"><label>VIP ' + k + ' 加成（%）</label><input type="number" min="0" max="40" step="1" data-vip="' + k + '" value="' + Math.round(SOP.vipBonus[k] * 100) + '"></div>'; }).join('');
  }
  function preview() {
    var e2 = window.HubUI.engine();
    var r = e2.run('compensation', D.SCENES.compensation[0].input);
    $('#sop-preview').innerHTML = '<div class="summary ' + (r.level || 'low') + '">用户 U10086 现在会得到：' + esc(r.output.summary) + '</div><ol class="thinking">' + r.thinking.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
  }
  $('#sop-save').addEventListener('click', function () {
    var o = { bands: [], vipBonus: {} };
    document.querySelectorAll('[data-band]').forEach(function (el) { o.bands[+el.getAttribute('data-band')] = Math.min(0.7, Math.max(0, (+el.value) / 100)); });
    document.querySelectorAll('[data-vip]').forEach(function (el) { o.vipBonus[el.getAttribute('data-vip')] = Math.min(0.4, Math.max(0, (+el.value) / 100)); });
    try { localStorage.setItem('hub-sop-override', JSON.stringify(o)); } catch (e) {}
    o.bands.forEach(function (r, i) { SOP.bands[i].ratio = r; });
    Object.keys(o.vipBonus).forEach(function (k) { SOP.vipBonus[k] = o.vipBonus[k]; });
    preview();
    $('#sop-note').textContent = '已保存。指挥中心里 ① 补偿决策会马上按新规则算，不用改代码。';
  });
  $('#sop-reset').addEventListener('click', function () {
    try { localStorage.removeItem('hub-sop-override'); } catch (e) {}
    location.reload();
  });
  sopForm(); preview();
  $('#pane-sop-static').innerHTML = '<div class="kb-card glass"><h3>其他规则</h3><ul class="dash-list"><li>补偿上限 ' + E.pct(D.CONSTRAINTS.compensationCap) + '，任何情况都不突破。</li><li>近 30 天投诉 ≥ ' + D.CONSTRAINTS.banComplaints + ' 次：封号劝退，按最后一笔的 ' + E.pct(SOP.banSettleRatio) + ' 结算。</li><li>单日亏损 ≥ ' + E.money(D.CONSTRAINTS.bigLoss) + ' 算大额：' + esc(SOP.methods.big) + '。</li><li>' + esc(SOP.whyGoods) + '</li><li>涉及未成年人：最高优先级转人工，AI 不给金额。</li></ul></div>';
  // 标签切换
  var tabs = document.querySelectorAll('.tabs button');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('.kb-pane').forEach(function (p) { p.classList.toggle('on', p.id === b.getAttribute('data-pane')); });
      history.replaceState(null, '', '#' + b.getAttribute('data-pane').replace('pane-', ''));
    });
  });
  var h = location.hash.replace('#', '');
  if (h) { var t = document.querySelector('.tabs button[data-pane="pane-' + h + '"]'); if (t) t.click(); }
})();
