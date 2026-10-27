/* 潮玩电商 AI 运营中台 · 公共界面：主题、动效、引擎实例、统一 JSON 渲染器 */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 主题 ---------- */
  function toggleTheme() {
    var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) {}
  }
  document.querySelectorAll('[data-theme-toggle]').forEach(function (b) { b.addEventListener('click', toggleTheme); });

  /* ---------- 出现动画、卡片高光 ---------- */
  function wire(scope) {
    var els = (scope || document).querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(function (el) { el.classList.add('in'); }); }
    else {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.06 });
      els.forEach(function (el) { io.observe(el); });
    }
    if (!reduceMotion) {
      (scope || document).querySelectorAll('.gx:not([data-gx])').forEach(function (el) {
        el.setAttribute('data-gx', '1');
        var s = document.createElement('span'); s.className = 'spot'; el.insertBefore(s, el.firstChild);
        el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
      });
    }
  }

  /* ---------- 引擎：知识库页面改过的补偿规则会在这里生效 ---------- */
  function engine() {
    var D = window.HUB_DATA;
    try {
      var o = JSON.parse(localStorage.getItem('hub-sop-override') || 'null');
      if (o) {
        if (o.bands) o.bands.forEach(function (r, i) { if (D.COMPENSATION_SOP.bands[i] && isFinite(r)) D.COMPENSATION_SOP.bands[i].ratio = r; });
        if (o.vipBonus) Object.keys(o.vipBonus).forEach(function (k) { if (isFinite(o.vipBonus[k])) D.COMPENSATION_SOP.vipBonus[k] = o.vipBonus[k]; });
      }
    } catch (e) {}
    return window.HubEngine.makeEngine(D);
  }

  /* ---------- 简易 Markdown：### 标题、表格、列表、加粗 ---------- */
  function inline(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); }
  function md(text) {
    var lines = String(text || '').split('\n'), out = [], i = 0;
    while (i < lines.length) {
      var l = lines[i];
      if (/^###\s/.test(l)) { out.push('<h3>' + inline(l.replace(/^###\s*/, '')) + '</h3>'); i++; continue; }
      if (/^\|/.test(l)) {
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var cells = function (r) { return r.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var head = cells(rows[0]), body = rows.slice(2);
        out.push('<div class="tablewrap"><table><thead><tr>' + head.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          body.map(function (r) { return '<tr>' + cells(r).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        continue;
      }
      if (/^-\s/.test(l)) {
        var items = [];
        while (i < lines.length && /^-\s/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^-\s*/, '')) + '</li>'); i++; }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }
      if (l.trim()) out.push('<p>' + inline(l) + '</p>');
      i++;
    }
    return out.join('');
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
    return Promise.resolve();
  }
  function flash(btn, text) { var old = btn.textContent; btn.textContent = text; setTimeout(function () { btn.textContent = old; }, 1400); }

  /* ---------- 统一 JSON 渲染：思考过程逐条出现，然后出结论 ---------- */
  function renderResult(el, r, opts) {
    opts = opts || {};
    var A = (window.HUB_DATA.AGENTS.filter(function (a) { return a.id === r.agent_id; })[0]) || { no: '', name: r.agent_name };
    el.innerHTML = '<div class="out-head"><span class="who">' + esc(A.no + ' ' + A.name) + '</span><span class="echo">输入：' + esc(String(r.input_echo).slice(0, 80)) + '</span></div><ol class="thinking"></ol><div class="out-body"></div>';
    var list = el.querySelector('.thinking'), body = el.querySelector('.out-body');
    var instant = opts.instant || reduceMotion;
    var per = Math.max(160, Math.min(420, r.meta.latency_ms / Math.max(1, r.thinking.length)));
    return new Promise(function (resolve) {
      var k = 0;
      function next() {
        if (k > 0) { var prev = list.lastChild; prev.classList.remove('pending'); }
        if (k >= r.thinking.length) { finish(); return resolve(r); }
        var li = document.createElement('li'); li.textContent = r.thinking[k]; if (!instant) li.className = 'pending';
        list.appendChild(li); k++;
        if (instant) next(); else setTimeout(next, per);
      }
      next();
    });
    function finish() {
      var o = r.output, lv = r.level || 'low';
      var actions = [];
      if (r.agent_id === 'compensation' && r.amount !== undefined) {
        actions.push('<button class="btn sm solid" data-act="adopt">采纳</button>', '<button class="btn sm" data-act="edit">修改金额</button>');
      }
      if (r.script || r.answer) actions.push('<button class="btn sm" data-act="copy">复制话术</button>');
      (r.actions || []).forEach(function (a, i) { actions.push('<button class="btn sm" data-act="chain" data-i="' + i + '">' + esc(a.label) + ' →</button>'); });
      body.innerHTML = '<div class="summary ' + lv + '">' + esc(o.summary) + '</div>' +
        '<div class="m-grid">' + o.metrics.map(function (m) { return '<div><span>' + esc(m.label) + '</span><b>' + esc(m.value) + '</b></div>'; }).join('') + '</div>' +
        '<div class="suggest"><b>建议</b>' + esc(o.suggestion) + '</div>' +
        (actions.length ? '<div class="out-actions">' + actions.join('') + '<span class="adopted" hidden></span></div>' : '') +
        '<div class="md">' + md(o.detail) + '</div>' +
        '<div class="meta-row"><span>耗时 ' + (r.meta.latency_ms / 1000).toFixed(1) + ' 秒</span><span>置信度 ' + r.meta.confidence.toFixed(2) + (r.meta.confidence < 0.8 ? '（低于 0.8，转人工）' : '') + '</span><span>命中知识库 ' + r.meta.kb_hits + ' 条</span><span>' + esc(r.meta.ts) + '</span></div>' +
        '<details class="json"><summary>查看统一 JSON 输出</summary><pre>' + esc(JSON.stringify({ agent_id: r.agent_id, agent_name: r.agent_name, input_echo: r.input_echo, thinking: r.thinking, output: r.output, meta: r.meta }, null, 2)) + '</pre></details>';
      var note = body.querySelector('.adopted');
      body.querySelectorAll('[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-act');
          if (act === 'adopt') { note.hidden = false; note.textContent = '✓ 已采纳，已归档（' + r.meta.ts + '）'; if (opts.onAdopt) opts.onAdopt(r); }
          else if (act === 'edit') {
            var v = window.prompt('人工调整补偿金额（元）', String(r.amount));
            if (v !== null && isFinite(+v) && +v >= 0) { note.hidden = false; note.textContent = '✓ 人工调整为 ¥' + (+v).toLocaleString('en-US') + '，已留痕'; }
          } else if (act === 'copy') { copy(r.script || r.answer || o.suggestion).then(function () { flash(b, '已复制'); }); }
          else if (act === 'chain' && opts.onChain) opts.onChain(r.actions[+b.getAttribute('data-i')]);
        });
      });
      if (opts.onDone) opts.onDone(r);
    }
  }

  window.HubUI = { esc: esc, md: md, engine: engine, renderResult: renderResult, wire: wire, copy: copy, reduceMotion: reduceMotion };
  wire();
})();
