/* 组箱定价：输入份数、单价、毛利线，实时配出六个赏级并验算 */
(function () {
  'use strict';
  var D = window.HUB_DATA, E = window.HubUI.engine(), esc = window.HubUI.esc, md = window.HubUI.md;
  var $ = function (s) { return document.querySelector(s); };
  function calc() {
    var input = { slots: +$('#slots').value || 80, price: +$('#price').value || 59, margin: (+$('#margin').value || 40) / 100 };
    var r = E.run('product_layout', input), L = r.layout;
    var used = Math.min(100, L.total / L.cap * 100);
    $('#verdict').className = 'verdict ' + (L.ok ? 'ok' : 'bad');
    $('#verdict').innerHTML = esc(r.output.summary) + '<small>成本上限 ' + E.money(L.cap) + '，实际 ' + E.money(L.total) + '，余量 ' + E.money(L.cap - L.total) + '</small>' +
      '<div class="bar"><i style="width:' + used.toFixed(1) + '%"></i></div><small>预算用掉 ' + used.toFixed(2) + '%</small>';
    $('#thinking').innerHTML = r.thinking.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    $('#detail').innerHTML = md(r.output.detail) + '<div class="suggest" style="margin-top:12px"><b>建议</b>' + esc(r.output.suggestion) + '</div>';
  }
  ['slots', 'price', 'margin'].forEach(function (id) { $('#' + id).addEventListener('input', calc); });
  document.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () { var p = b.getAttribute('data-preset').split(','); $('#slots').value = p[0]; $('#price').value = p[1]; $('#margin').value = p[2]; calc(); });
  });
  // 商品库
  var cats = ['全部'].concat(D.PRODUCTS.map(function (p) { return p.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
  $('#cat').innerHTML = cats.map(function (c) { return '<option>' + c + '</option>'; }).join('');
  function lib() {
    var c = $('#cat').value;
    var list = D.PRODUCTS.filter(function (p) { return c === '全部' || p.cat === c; });
    $('#lib').innerHTML = '<div class="tablewrap"><table><thead><tr><th>编号</th><th>商品（虚构）</th><th>品类</th><th>官方价</th><th>采购价</th><th>二手热度</th><th>趋势</th><th>稀有度</th><th>售罄率</th></tr></thead><tbody>' +
      list.map(function (p) { return '<tr' + (p.trend <= -10 ? ' class="anomaly"' : '') + '><td>' + p.id + '</td><td>' + esc(p.name) + '</td><td>' + p.cat + '</td><td>' + E.money(p.official) + '</td><td>' + E.money(p.cost) + '</td><td>' + p.heat + '</td><td>' + (p.trend > 0 ? '+' : '') + p.trend + '%</td><td>' + p.rarity + '</td><td>' + p.sell + '%</td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint" style="margin-top:8px">红底的是二手热度下滑超过 10% 的掉价风险款，选品和组箱都不会用。</p>';
  }
  $('#cat').addEventListener('change', lib);
  calc(); lib();
})();
