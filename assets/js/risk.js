/* 社群风控实时演示台：左边群聊输入，中间五步判定，右边分级输出 */
(function () {
  'use strict';
  var D = window.HUB_DATA, E = window.HubUI.engine(), esc = window.HubUI.esc, md = window.HubUI.md;
  var $ = function (s) { return document.querySelector(s); };
  var PRESETS = [
    { label: 'VIP 群带节奏', messages: D.SCENES.risk_monitor[0].input.messages },
    { label: '多群导流', messages: D.SCENES.risk_monitor[1].input.messages },
    { label: '未成年人', messages: [{ group: '新人交流群', user: '用户F', text: '我是初中生，用我妈手机充了 500，能退吗' }] },
    { label: '跨群串联', messages: [
      { group: 'VIP用户群①', user: '用户G', text: '这个平台就是诈骗' }, { group: 'VIP用户群②', user: '用户G', text: '诈骗平台，我已经报警了' },
      { group: '晒单分享群', user: '用户H', text: '感觉有点坑' }] },
    { label: '正常聊天', messages: [{ group: '晒单分享群', user: '用户I', text: '今天抽到 B 赏啦，开心' }, { group: '晒单分享群', user: '用户J', text: '恭喜恭喜，下期什么时候开箱？' }] }
  ];
  var msgs = JSON.parse(JSON.stringify(PRESETS[0].messages)), timer = null;

  function rows() {
    $('#msgs').innerHTML = msgs.map(function (m, i) {
      return '<div class="msg-row" data-i="' + i + '"><input data-k="group" value="' + esc(m.group) + '" aria-label="群名"><input data-k="user" value="' + esc(m.user) + '" aria-label="用户"><input data-k="text" value="' + esc(m.text) + '" aria-label="消息内容"><button type="button" data-del aria-label="删除这条">×</button></div>';
    }).join('');
  }
  function judge() {
    var r = E.run('risk_monitor', { messages: msgs });
    $('#steps').innerHTML = r.thinking.map(function (t, i) {
      var m = t.match(/^([①②③④⑤])\s*([^：]+)：([\s\S]*)$/);
      return '<li data-n="' + (i + 1) + '"><b>' + esc(m ? m[2] : '步骤 ' + (i + 1)) + '</b>' + esc(m ? m[3] : t) + '</li>';
    }).join('');
    var o = r.output;
    $('#result').innerHTML = '<div class="summary ' + (r.level || 'low') + '">' + esc(o.summary) + '</div>' +
      '<div class="m-grid" style="grid-template-columns:repeat(2,1fr)">' + o.metrics.map(function (x) { return '<div><span>' + esc(x.label) + '</span><b>' + esc(x.value) + '</b></div>'; }).join('') + '</div>' +
      '<div class="suggest"><b>建议</b>' + esc(o.suggestion) + '</div><div class="md">' + md(o.detail) + '</div>' +
      '<div class="meta-row"><span>耗时 ' + (r.meta.latency_ms / 1000).toFixed(1) + ' 秒</span><span>置信度 ' + r.meta.confidence.toFixed(2) + '</span><span>命中 ' + r.meta.kb_hits + ' 条</span></div>' +
      '<details class="json"><summary>查看统一 JSON 输出</summary><pre>' + esc(JSON.stringify({ agent_id: r.agent_id, agent_name: r.agent_name, thinking: r.thinking, output: r.output, meta: r.meta }, null, 2)) + '</pre></details>';
  }
  function later() { clearTimeout(timer); timer = setTimeout(judge, 350); }

  $('#msgs').addEventListener('input', function (e) {
    var row = e.target.closest('.msg-row'); if (!row) return;
    msgs[+row.getAttribute('data-i')][e.target.getAttribute('data-k')] = e.target.value; later();
  });
  $('#msgs').addEventListener('click', function (e) {
    if (!e.target.hasAttribute('data-del')) return;
    msgs.splice(+e.target.closest('.msg-row').getAttribute('data-i'), 1); rows(); judge();
  });
  $('#add').addEventListener('click', function () { msgs.push({ group: msgs.length ? msgs[msgs.length - 1].group : 'VIP用户群①', user: '用户' + String.fromCharCode(65 + msgs.length), text: '' }); rows(); });
  $('#presets').innerHTML = PRESETS.map(function (p, i) { return '<button type="button" class="chip" data-p="' + i + '">' + esc(p.label) + '</button>'; }).join('');
  $('#presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    msgs = JSON.parse(JSON.stringify(PRESETS[+b.getAttribute('data-p')].messages)); rows(); judge();
  });
  rows(); judge();
})();
