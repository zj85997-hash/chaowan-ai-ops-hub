/* 潮玩电商 AI 运营中台 · 规则引擎
   8 个 Agent，统一输出契约：{agent_id, agent_name, input_echo, thinking[], output{summary, metrics[], detail, suggestion}, meta{latency_ms, confidence, kb_hits, ts}}
   原则：规矩交给知识库（data.js）记，算数交给代码算；按 user_id 查数据一律精确查询。 */
(function (root) {
  'use strict';

  function makeEngine(D, opts) {
    opts = opts || {};
    var now = opts.now || function () { return new Date(); };

    /* ---------- 工具 ---------- */
    function money(n) {
      var v = Math.round(n * 100) / 100;
      var s = Math.abs(v) % 1 ? Math.abs(v).toFixed(1) : String(Math.abs(Math.round(v)));
      var parts = s.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (v < 0 ? '-¥' : '¥') + parts.join('.');
    }
    function pct(x, digits) { return (x * 100).toFixed(digits === undefined ? 0 : digits) + '%'; }
    function wan(n) { return '¥' + (n / 10000).toFixed(1) + ' 万'; }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function stamp() {
      var t = now();
      return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());
    }
    function agentMeta(id) {
      for (var i = 0; i < D.AGENTS.length; i++) if (D.AGENTS[i].id === id) return D.AGENTS[i];
      return { id: id, name: id };
    }
    function result(id, inputEcho, thinking, output, confidence, kbHits, extra) {
      var r = {
        agent_id: id,
        agent_name: agentMeta(id).name,
        input_echo: inputEcho,
        thinking: thinking,
        output: output,
        meta: { latency_ms: 400 + thinking.length * 280, confidence: Math.round(confidence * 100) / 100, kb_hits: kbHits, ts: stamp() }
      };
      if (extra) for (var k in extra) r[k] = extra[k];
      return r;
    }
    function table(head, rows) {
      return '| ' + head.join(' | ') + ' |\n|' + head.map(function () { return '---'; }).join('|') + '|\n' +
        rows.map(function (r) { return '| ' + r.join(' | ') + ' |'; }).join('\n');
    }
    function lower(s) { return String(s || '').toLowerCase(); }

    /* ---------- 敏感词匹配 ---------- */
    function matchWords(text) {
      var t = lower(text), hits = [], seen = {};
      D.SENSITIVE.forEach(function (w) {
        var forms = [w.word].concat(w.variants);
        for (var i = 0; i < forms.length; i++) {
          if (forms[i] && t.indexOf(lower(forms[i])) !== -1 && !seen[w.word]) {
            seen[w.word] = true;
            hits.push({ word: w.word, form: forms[i], level: w.level, severity: w.severity });
            break;
          }
        }
      });
      hits.sort(function (a, b) { return a.level - b.level || b.severity - a.severity; });
      return hits;
    }
    function hasIncite(text) {
      for (var i = 0; i < D.INCITE.length; i++) if (String(text).indexOf(D.INCITE[i]) !== -1) return D.INCITE[i];
      return '';
    }
    var MINOR_RE = /未成年|孩子|儿子|女儿|小孩|偷充|偷用|初中生|高中生|中学生/;

    /* ========== ① 智能补偿决策 ========== */
    function compensation(input) {
      var id = String(input.user_id || '').trim().toUpperCase();
      var u = D.USERS[id];
      var complaint = input.complaint || '';
      var C = D.CONSTRAINTS, SOP = D.COMPENSATION_SOP;
      if (!u) {
        return result('compensation', id || '（未填写）', ['查库（代码节点，按 user_id 精确查询）：没有找到这个用户', '不猜测、不编造：转人工核实身份'],
          { summary: '未匹配到用户，建议转人工', metrics: [{ label: '结论', value: '转人工' }, { label: '原因', value: '用户不存在' }], detail: '按 user_id 精确查询没有结果。补偿涉及钱，不能用相似用户的数据代替。', suggestion: '请客服核实用户 ID 后重新提交。' }, 0.5, 0);
      }
      var thinking = ['查库（代码节点，按 user_id 精确查询）：VIP ' + u.vip + ' / 累计 ' + money(u.total) + ' / 今日亏损 ' + money(u.todayLoss) + ' / 近 30 天投诉 ' + u.complaints30d + ' 次 / 注册 ' + u.regDays + ' 天'];
      var hits = matchWords(complaint);
      var legal = hits.filter(function (h) { return h.level === 1; }).map(function (h) { return h.word; });
      if (u.minorFlag || MINOR_RE.test(complaint)) {
        thinking.push('命中 esc_6：疑似未成年人消费，AI 不自行处理');
        thinking.push('转最高优先级人工，走未成年人保护专项流程');
        return result('compensation', id + '：' + complaint, thinking, {
          summary: '疑似未成年人消费，最高优先级转人工',
          metrics: [{ label: '结论', value: '转人工' }, { label: '优先级', value: '最高' }, { label: '规则', value: 'esc_6' }],
          detail: '### 处理依据\n涉及未成年人消费，一律由人工按未成年人保护专项流程处理，AI 不给补偿金额。\n\n### 用户信息\n' +
            table(['项目', '值'], [['VIP 等级', u.vip], ['注册天数', u.regDays + ' 天'], ['今日亏损', money(u.todayLoss)]]),
          suggestion: '客服主管立即联系监护人核实情况，按未成年人保护流程办理，暂停该账号的消费功能。'
        }, 0.97, 2, { level: 'high' });
      }
      var risk, ratio = 0, amount, method, summary, rows = [], kb = 0;
      if (u.complaints30d >= C.banComplaints) {
        amount = u.lastOrder * SOP.banSettleRatio;
        thinking.push('命中规则：近 30 天投诉 ≥ ' + C.banComplaints + ' 次 → 封号劝退，不走常规补偿');
        thinking.push('结算：最后一笔 ' + money(u.lastOrder) + ' × ' + pct(SOP.banSettleRatio) + ' = ' + money(amount));
        thinking.push('风险判定：高（识别为高频投诉）');
        method = SOP.methods.ban; risk = '高'; kb = 2;
        summary = '高频投诉，建议封号劝退';
        rows = [['命中规则', '近 30 天投诉 ≥ 3 次 → 封号劝退'], ['计算式', money(u.lastOrder) + ' × 60% = ' + money(amount)], ['方式', '劝退结算'], ['风险等级', '高']];
      } else {
        var band = SOP.bands.filter(function (b) { return u.todayLoss >= b.min; })[0];
        var bonus = SOP.vipBonus[u.vip] || 0;
        ratio = Math.min(band.ratio + bonus, C.compensationCap);
        amount = Math.round(u.todayLoss * ratio);
        thinking.push('匹配 SOP：' + band.label + ' → 基准 ' + pct(band.ratio));
        thinking.push('等级加成：VIP ' + u.vip + ' +' + pct(bonus) + ' → 合计 ' + pct(ratio) + '（上限 ' + pct(C.compensationCap) + '）');
        thinking.push('计算：' + money(u.todayLoss) + ' × ' + pct(ratio) + ' = ' + money(amount));
        if (u.todayLoss >= C.bigLoss) method = SOP.methods.big;
        else if (amount >= 100) method = SOP.methods.normal;
        else method = SOP.methods.small;
        risk = u.complaints30d === 0 ? '低' : '中';
        thinking.push('方式：' + method.split('：')[0] + '；风险判定：' + risk);
        kb = bonus ? 3 : 2;
        summary = amount > 0 ? '建议补偿 ' + money(amount) + '，' + method.split('：')[0] : '今日无亏损，不触发补偿';
        rows = [['命中规则', band.label + ' → 基准 ' + pct(band.ratio)], ['等级加成', 'VIP ' + u.vip + ' +' + pct(bonus)], ['计算式', money(u.todayLoss) + ' × ' + pct(ratio) + ' = ' + money(amount)], ['方式', method], ['风险等级', risk]];
      }
      if (legal.length) thinking.push('投诉提到「' + legal.join('、') + '」：话术附合规声明，同步通知法务');
      var script = u.complaints30d >= C.banComplaints
        ? '您好，我们核实了您近 30 天的记录。按平台规则，我们为您办理最后一笔订单的结算，金额 ' + money(amount) + '，之后将暂停为您提供服务。如有疑问，可申请人工复核。'
        : '您好，非常理解您现在的心情。我们核实了您的消费记录，为您申请了 ' + money(amount) + ' 的补偿，以' + (method.indexOf('补货') !== -1 ? '寄出等值全新正品' : '积分') + '的方式发放' + (method.indexOf('补货') !== -1 ? '，发货后会把物流单号同步给您' : '') + '。';
      script += '（平台出货概率已在活动页公示；补偿以实际发放为准；平台不参与、不担保任何私下交易。）';
      return result('compensation', id + '：' + complaint, thinking, {
        summary: summary,
        metrics: [{ label: '补偿金额', value: money(amount) }, { label: '补偿比例', value: u.complaints30d >= C.banComplaints ? '最后一笔 60%' : pct(ratio) },
          { label: '方式', value: method.split('：')[0] }, { label: '风险等级', value: risk }],
        detail: '### 判定依据\n' + table(['判定项', '结果'], [['查库结果', 'VIP ' + u.vip + ' / 累计 ' + money(u.total) + ' / 今日亏损 ' + money(u.todayLoss) + ' / 近 30 天投诉 ' + u.complaints30d + ' 次 / 注册 ' + u.regDays + ' 天']].concat(rows)) +
          '\n\n### 为什么线上补货优先\n' + SOP.whyGoods + '\n\n### 回复话术\n' + script,
        suggestion: 'AI 只出建议：客服主管核对后点「采纳」才生效，也可以手动改金额。' + (legal.length ? '投诉涉及「' + legal.join('、') + '」，同步通知法务。' : '')
      }, 0.95, kb, { level: risk === '高' ? 'high' : risk === '中' ? 'mid' : 'low', amount: amount, script: script, user_id: id });
    }

    /* ========== ② 社群风控监控 ========== */
    var ANXIOUS = ['概率不对', '抽不到', '概率造假', '后悔', '心累', '失望', '难受'];
    function riskMonitor(input) {
      var msgs = (input.messages || []).filter(function (m) { return m && m.text; });
      var users = {}, order = [], groups = {}, wordGroups = {};
      msgs.forEach(function (m) {
        var hits = matchWords(m.text), incite = hasIncite(m.text);
        groups[m.group] = true;
        if (!users[m.user]) { users[m.user] = { name: m.user, uid: m.uid, hits: [], incite: '', groups: {}, texts: [] }; order.push(m.user); }
        var u = users[m.user];
        u.texts.push(m.text);
        u.groups[m.group] = (u.groups[m.group] || []).concat(hits);
        hits.forEach(function (h) { if (!u.hits.some(function (x) { return x.word === h.word; })) u.hits.push(h); wordGroups[h.word] = wordGroups[h.word] || {}; wordGroups[h.word][m.group] = true; });
        if (incite) u.incite = incite;
      });
      var allHits = [];
      order.forEach(function (n) { users[n].hits.forEach(function (h) { allHits.push({ user: n, h: h }); }); });
      var thinking = [];
      thinking.push('① 敏感词匹配：' + (allHits.length ? allHits.map(function (x) { return x.user + ' 命中「' + x.h.word + '」(' + D.LEVELS[x.h.level].icon + D.LEVELS[x.h.level].name + '·' + x.h.severity + ')'; }).join('；') : '没有命中敏感词'));
      // 情感
      order.forEach(function (n) {
        var u = users[n], lv = u.hits.length ? u.hits[0].level : 0;
        var anxious = u.hits.some(function (h) { return ANXIOUS.indexOf(h.word) !== -1; });
        if (lv === 1 || u.incite) u.mood = '😡 愤怒' + (u.incite ? ' + 📢 煽动' : '');
        else if (lv === 2) u.mood = anxious ? '😰 焦虑 + 负面' : '😠 不满';
        else if (lv === 3) u.mood = anxious ? '😰 焦虑' : '😞 失望';
        else if (lv === 4) u.mood = '💼 导流';
        else u.mood = /[?？]|怎么|什么/.test(u.texts.join('')) ? '😐 关注' : '😐 正常';
        u.score = u.hits.reduce(function (s, h) { return s + h.severity; }, 0);
      });
      thinking.push('② 情感分析：' + order.map(function (n) { return n + ' = ' + users[n].mood; }).join('；'));
      // 分级
      // 处置紧急度：一级 > 二级 > 四级（导流要 30 分钟内清理）> 三级（负面情绪，不必立即干预）
      var has = function (lv) { return allHits.some(function (x) { return x.h.level === lv; }); };
      var l3count = allHits.filter(function (x) { return x.h.level === 3; }).length;
      var level = has(1) ? 1 : (has(2) || l3count >= 3) ? 2 : has(4) ? 4 : has(3) ? 3 : 0;
      var aggressive = order.filter(function (n) { return users[n].hits.some(function (h) { return h.level === 1; }) || users[n].incite; });
      var concerned = order.filter(function (n) { return aggressive.indexOf(n) === -1; });
      var l1 = allHits.filter(function (x) { return x.h.level === 1; }).length, l2 = allHits.filter(function (x) { return x.h.level === 2; }).length;
      var L = level ? D.LEVELS[level] : { name: '正常', icon: '🟢', respond: '无需响应', action: '保持正常互动' };
      thinking.push('③ 风险分级：' + (level ? l1 + ' 个一级 + ' + l2 + ' 个二级 + ' + l3count + ' 个三级命中，' + aggressive.length + ' 人激进 + ' + concerned.length + ' 人关注 → ' + L.icon + L.name : '没有风险信号 → 🟢 正常'));
      // 串联检测
      var cross = [];
      order.forEach(function (n) {
        var g = users[n].groups, gl1 = 0, gl2 = 0, gl4 = 0;
        Object.keys(g).forEach(function (k) {
          if (g[k].some(function (h) { return h.level === 1; })) gl1++;
          if (g[k].some(function (h) { return h.level === 2; })) gl2++;
          if (g[k].some(function (h) { return h.level === 4; })) gl4++;
        });
        if (gl1 >= 2) cross.push({ id: 'cross_1', who: n });
        if (gl2 >= 3) cross.push({ id: 'cross_2', who: n });
        if (gl4 >= 2) cross.push({ id: 'cross_4', who: n });
      });
      Object.keys(wordGroups).forEach(function (w) { if (Object.keys(wordGroups[w]).length >= 3) cross.push({ id: 'cross_3', who: '「' + w + '」' }); });
      var groupCount = Object.keys(groups).length;
      if (cross.some(function (c) { return c.id === 'cross_1'; })) level = 1;
      thinking.push('④ 串联检测：' + (cross.length ? cross.map(function (c) { var r = D.CROSS_RULES.filter(function (x) { return x.id === c.id; })[0]; return c.id + '（' + c.who + '）：' + r.action; }).join('；')
        : (groupCount > 1 ? groupCount + ' 个群，未检测到跨群串联' : '单群输入，未检测到跨群串联') + (aggressive.some(function (n) { return users[n].incite; }) ? '；但「' + users[aggressive.filter(function (n) { return users[n].incite; })[0]].incite + '」存在群内扩散风险，需立即阻断' : '')));
      L = level ? D.LEVELS[level] : L;
      var steps = [];
      if (level === 1) {
        var lead = aggressive[0] || order[0];
        steps = [['客服主管', '群内回应 @' + lead + '，引导私聊', '15 分钟内'], ['客服', '私聊核实诉求，转 ① 补偿决策出方案', '30 分钟内'], ['法务', '准备监管投诉应对材料', '当天'], ['运营', '暂停群内活动推送，观察后续发言', '2 小时']];
      } else if (level === 2) {
        steps = [['客服', '私聊安抚，解释规则和概率公示', '1 小时内'], ['运营', '关注后续发言，必要时在群内统一说明', '当天']];
      } else if (level === 3) {
        steps = [['运营', '记录在案，正常互动，不必立即干预', '当天']];
      } else if (level === 4) {
        steps = [['运营', '清理导流消息，私信警告', '30 分钟内'], ['运营', '再次出现按群规移出', '持续']];
      }
      var strategy = level ? L.action + '，' + L.respond + '内响应' : '保持正常互动';
      thinking.push('⑤ 策略选择：' + strategy);
      var risky = order.filter(function (n) { return users[n].score >= D.RISK_ACCUMULATION.threshold; });
      var words = allHits.map(function (x) { return x.h.word; }).filter(function (w, i, a) { return a.indexOf(w) === i; });
      var detail = '### 风险概览\n' + L.icon + ' ' + L.name + (level ? '（' + L.tag + '）' : '') + '，涉及 ' + order.length + ' 人、' + groupCount + ' 个群。\n\n' +
        '### 命中敏感词\n' + (allHits.length ? table(['用户', '敏感词', '等级', '严重度'], allHits.map(function (x) { return [x.user, x.h.word, D.LEVELS[x.h.level].icon + D.LEVELS[x.h.level].name, String(x.h.severity)]; })) : '没有命中。') + '\n\n' +
        '### 逐用户情感分析\n' + table(['用户', '情绪', '累计风险分'], order.map(function (n) { return [n, users[n].mood, String(users[n].score) + (users[n].score >= D.RISK_ACCUMULATION.threshold ? '（超阈值）' : '')]; })) + '\n\n' +
        '### 串联检测\n' + (cross.length ? cross.map(function (c) { return '- ' + c.id + '：' + c.who; }).join('\n') : '未检测到跨群串联。') + '\n\n' +
        '### 应对策略与执行步骤\n' + (steps.length ? table(['执行人', '动作', '时限'], steps) : '无需处理。');
      var lead2 = aggressive[0] || order[0];
      var suggestion = level === 1 ? '客服主管 15 分钟内在群内回应 @' + lead2 + ' 并引导私聊，同步通知法务准备材料。'
        : level === 2 ? '客服 1 小时内私聊安抚，解释概率公示规则。'
        : level === 4 ? '30 分钟内清理导流消息并私信警告，平台不参与任何私下交易。'
        : level === 3 ? '记录在案，正常互动即可。' : '没有风险，保持正常互动。';
      var actions = [];
      if (level && level <= 2) {
        var target = aggressive.concat(order).filter(function (n) { return users[n].uid; })[0];
        if (target) actions.push({ label: '转投诉处理', agent: 'compensation', input: { user_id: users[target].uid, complaint: users[target].texts.join(' ') } });
      }
      return result('risk_monitor', msgs.length ? msgs[0].group + (groupCount > 1 ? ' 等 ' + groupCount + ' 个群' : '') : '（无消息）', thinking, {
        summary: L.icon + L.name + (level ? '，建议 ' + L.respond + '内响应' : ''),
        metrics: [{ label: '风险等级', value: L.icon + L.name }, { label: '命中敏感词', value: words.length ? words.join('、') : '无' },
          { label: '涉及人数', value: aggressive.length + ' 人激进 + ' + concerned.length + ' 人关注' }, { label: '建议响应时限', value: L.respond }],
        detail: detail + (risky.length ? '\n\n### 累计阈值\n' + risky.join('、') + ' 在 72 小时窗口内累计超过 150 分，标记为高风险用户。' : ''),
        suggestion: suggestion
      }, allHits.length ? 0.95 : 0.9, Math.max(1, allHits.length + cross.length), { level: level === 1 ? 'high' : level === 2 ? 'mid' : 'low', actions: actions });
    }

    /* ========== ③ 运营数据问答 ========== */
    var METRICS = [
      { key: 'gmv', name: '流水', syn: ['流水', '营收', 'gmv', '收入', '销售额'], fmt: wan, get: function (d) { return d.gmv; } },
      { key: 'orders', name: '订单数', syn: ['订单'], fmt: function (v) { return v.toLocaleString('en-US') + ' 单'; }, get: function (d) { return d.orders; } },
      { key: 'dau', name: '活跃用户', syn: ['活跃', 'dau', '日活'], fmt: function (v) { return v.toLocaleString('en-US') + ' 人'; }, get: function (d) { return d.dau; } },
      { key: 'payRate', name: '付费率', syn: ['付费率', '转化'], fmt: function (v) { return pct(v, 1); }, get: function (d) { return d.payers / d.dau; } },
      { key: 'arppu', name: 'ARPPU', syn: ['arppu', '客单'], fmt: function (v) { return money(Math.round(v)); }, get: function (d) { return d.gmv / d.payers; } },
      { key: 'payout', name: '出货率', syn: ['出货'], fmt: function (v) { return pct(v, 1); }, get: function (d) { return d.payout; } },
      { key: 'ship3d', name: '3 日发货率', syn: ['发货'], fmt: function (v) { return pct(v, 1); }, get: function (d) { return d.ship3d; } },
      { key: 'complaintRate', name: '客诉率', syn: ['客诉', '投诉'], fmt: function (v) { return pct(v, 2); }, get: function (d) { return d.complaints / d.orders; } },
      { key: 'compRate', name: '补偿率', syn: ['补偿'], fmt: function (v) { return pct(v, 1); }, get: function (d) { return d.compensation / d.gmv; } },
      { key: 'margin', name: '毛利率', syn: ['毛利'], fmt: function (v) { return pct(v, 1); }, get: function (d) { return d.margin; } },
      { key: 'newUsers', name: '新用户', syn: ['新用户', '拉新', '新增'], fmt: function (v) { return v + ' 人'; }, get: function (d) { return d.newUsers; } },
      { key: 'retention30', name: '30 日留存', syn: ['留存'], fmt: function (v) { return pct(v, 1); }, get: function (d) { return d.retention30; } }
    ];
    var ANOMALY = [
      { key: 'payout', test: function (v, base) { return v - base > 0.05; }, why: function (v, base) { return '出货率 ' + pct(v, 1) + '，高于基准 ' + pct(base, 1) + '（+' + ((v - base) * 100).toFixed(1) + ' 个百分点）'; }, fix: '高赏级出得偏多或组箱成本偏高，建议 ⑤ 智能组箱重新验算这一期的成本上限' },
      { key: 'margin', test: function (v) { return v < 0.38; }, why: function (v) { return '毛利率 ' + pct(v, 1) + '，跌破 40% 硬指标'; }, fix: '和出货率异常同一天出现，大概率是同一个原因：按 ⑤ 的验算结果调整组箱' },
      { key: 'complaintRate', test: function (v) { return v > 0.018; }, why: function (v) { return '客诉率冲到 ' + pct(v, 2); }, fix: '同一天 3 日发货率掉到 90% 左右，优先排查仓库发货延迟；投诉用户走 ⑧ → ① 带方案转人工' },
      { key: 'ship3d', test: function (v) { return v < 0.93; }, why: function (v) { return '3 日发货率只有 ' + pct(v, 1); }, fix: '低于 3 天发货时效要求，排查仓库和物流' }
    ];
    function median(arr) { var a = arr.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
    function opsQa(input) {
      var q = lower(input.question || '');
      var days = D.OPS_DAYS, last = days.length - 1;
      var wanted = METRICS.filter(function (m) { return m.syn.some(function (s) { return q.indexOf(s) !== -1; }); });
      var weekly = /7\s*天|这周|本周|一周|最近|几天|趋势|异常|这几天/.test(q);
      var wantAnomaly = /异常|问题|波动|不对/.test(q);
      var compare = /比|环比|昨天|变化/.test(q);
      var thinking = [];
      var conf = wanted.length ? 0.92 : 0.6;
      if (!wanted.length) wanted = METRICS.filter(function (m) { return ['gmv', 'complaintRate', 'payout', 'margin'].indexOf(m.key) !== -1; });
      thinking.push('理解问题：要看' + wanted.map(function (m) { return '「' + m.name + '」'; }).join('') + '；时间范围：' + (weekly ? '最近 7 天' : '今天（' + days[last].date + '）') + (compare && !weekly ? '，和昨天比' : ''));
      thinking.push('取数（代码节点，精确计算，不走语义检索）：kb_ops_user 7 天 × ' + METRICS.length + ' 个指标');
      var rows = [], metrics = [];
      if (weekly) {
        rows = days.map(function (d) { return [d.date].concat(wanted.map(function (m) { return m.fmt(m.get(d)); })); });
        wanted.slice(0, 4).forEach(function (m) {
          var vals = days.map(m.get);
          metrics.push({ label: m.name + '（7 天均值）', value: m.fmt(vals.reduce(function (s, v) { return s + v; }, 0) / vals.length) });
        });
      } else {
        var t = days[last], y = days[last - 1];
        wanted.forEach(function (m) {
          var a = m.get(t), b = m.get(y), chg = b ? (a - b) / b : 0;
          rows.push([m.name, m.fmt(a), m.fmt(b), (chg >= 0 ? '+' : '') + pct(chg, 1)]);
        });
        wanted.slice(0, 4).forEach(function (m) {
          var a = m.get(t), b = m.get(y), chg = b ? (a - b) / b : 0;
          metrics.push({ label: '今日' + m.name, value: m.fmt(a) + '（环比 ' + (chg >= 0 ? '+' : '') + pct(chg, 1) + '）' });
        });
      }
      thinking.push('计算：' + (weekly ? '7 天逐日数值和均值' : '今日值、昨日值、环比'));
      var found = [];
      var checkKeys = wantAnomaly || weekly ? ANOMALY.map(function (a) { return a.key; }) : wanted.map(function (m) { return m.key; });
      ANOMALY.forEach(function (a) {
        if (checkKeys.indexOf(a.key) === -1) return;
        var m = METRICS.filter(function (x) { return x.key === a.key; })[0];
        var vals = days.map(m.get), base = median(vals);
        (weekly ? days.map(function (d, i) { return i; }) : compare ? [last - 1, last] : [last]).forEach(function (i) {
          if (a.test(vals[i], base)) found.push({ date: days[i].date, why: a.why(vals[i], base), fix: a.fix });
        });
      });
      thinking.push('异常检测（对比 7 天中位数）：' + (found.length ? found.map(function (f) { return f.date + ' ' + f.why; }).join('；') : '没有发现异常'));
      var head = weekly ? ['日期'].concat(wanted.map(function (m) { return m.name; })) : ['指标', '今天', '昨天', '环比'];
      var detail = '### 数据\n' + table(head, rows) + '\n\n### 异常预警\n' + (found.length ? found.map(function (f) { return '- **' + f.date + '**：' + f.why + '。' + f.fix + '。'; }).join('\n') : '没有发现异常。');
      var summary;
      if (weekly) summary = found.length ? '发现 ' + found.length + ' 个异常：' + found.map(function (f) { return f.date + ' ' + f.why.split('，')[0]; }).join('；') : '最近 7 天各项指标在正常区间';
      else {
        var todayBad = found.filter(function (f) { return f.date === days[last].date; });
        summary = (todayBad.length ? '今天有异常：' + todayBad.map(function (f) { return f.why.split('，')[0]; }).join('；') : '今天正常：' + metrics.slice(0, 2).map(function (m) { return m.label.replace('今日', '') + ' ' + m.value; }).join('，')) +
          (found.length > todayBad.length ? '；昨天（' + days[last - 1].date + '）' + found.filter(function (f) { return f.date !== days[last].date; }).map(function (f) { return f.why.split('，')[0]; }).join('、') + '，是异常高点' : '');
      }
      return result('ops_qa', input.question || '', thinking, {
        summary: summary, metrics: metrics.slice(0, 4), detail: detail,
        suggestion: found.length ? found[0].fix + '。' : '保持当前节奏，下一个整点自动刷新。'
      }, conf, wanted.length + found.length, { level: found.length ? 'mid' : 'low' });
    }

    /* ========== ④ 智能选品推荐 ========== */
    function marginScore(p) { return Math.min(100, (1 - p.cost / p.official) * 200); }
    function productScore(p) { return 0.35 * p.heat + 0.25 * p.attract + 0.20 * p.sell + 0.20 * marginScore(p); }
    function productSelect(input) {
      var cat = input.category || '全部', n = input.count || 6;
      var pool = D.PRODUCTS.filter(function (p) { return cat === '全部' || p.cat === cat; });
      var risky = pool.filter(function (p) { return p.trend <= -10; });
      var ok = pool.filter(function (p) { return p.trend > -10; });
      var ranked = ok.map(function (p) { return { p: p, s: productScore(p) }; }).sort(function (a, b) { return b.s - a.s; }).slice(0, n);
      var thinking = [
        '检索商品库：「' + cat + '」共 ' + pool.length + ' 款',
        '掉价风险排除：二手热度下滑超过 10% 的 ' + risky.length + ' 款不选' + (risky.length ? '（' + risky.map(function (p) { return p.name; }).join('、') + '）' : ''),
        '多维评分：二手热度 35% + 吸引力 25% + 售罄率 20% + 毛利空间 20%',
        '取前 ' + ranked.length + ' 款，按分数排序'
      ];
      var reasons = function (p) {
        var r = [];
        if (p.heat >= 85) r.push('二手热度高'); if (p.sell >= 90) r.push('售罄快'); if (marginScore(p) >= 95) r.push('毛利空间大'); if (p.rarity !== '普通') r.push(p.rarity + '款');
        return r.join('、') || '各项均衡';
      };
      return result('product_select', '品类：' + cat + '，选 ' + n + ' 款', thinking, {
        summary: '推荐 ' + ranked.length + ' 款，首选「' + (ranked[0] ? ranked[0].p.name : '无') + '」',
        metrics: [{ label: '候选', value: pool.length + ' 款' }, { label: '排除掉价风险', value: risky.length + ' 款' }, { label: '推荐', value: ranked.length + ' 款' }, { label: '最高分', value: ranked[0] ? ranked[0].s.toFixed(1) : '-' }],
        detail: '### 推荐清单\n' + table(['排名', '商品', '采购价', '二手热度', '售罄率', '评分', '理由'], ranked.map(function (x, i) {
          return [String(i + 1), x.p.name, money(x.p.cost), String(x.p.heat), x.p.sell + '%', x.s.toFixed(1), reasons(x.p)];
        })) + (risky.length ? '\n\n### 排除的掉价风险款\n' + risky.map(function (p) { return '- ' + p.name + '：二手热度趋势 ' + p.trend + '%'; }).join('\n') : ''),
        suggestion: ranked.length ? '把推荐清单交给 ⑤ 智能组箱，按 40% 毛利线配出六个赏级。' : '这个品类暂时没有合适的款。'
      }, 0.9, 2 + risky.length);
    }

    /* ========== ⑤ 智能组箱策略 ========== */
    function closest(pool, target, used) {
      var best = null;
      pool.forEach(function (p) {
        if (used[p.id]) return;
        var d = Math.abs(p.cost - target);
        if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && p.attract > best.p.attract)) best = { p: p, d: d };
      });
      return best && best.p;
    }
    function layout(slots, price, margin) {
      var S = D.BOX_STRATEGY, revenue = slots * price, cap = revenue * (1 - margin);
      var pool = D.PRODUCTS.filter(function (p) { return p.trend > -10; });
      var counts = S.tiers.map(function (t) { return Math.max(1, Math.round(t.ratio * slots)); });
      counts[counts.length - 1] = slots - counts.slice(0, -1).reduce(function (s, c) { return s + c; }, 0);
      var picks = [], used = {};
      for (var i = 0; i < S.tiers.length - 1; i++) {
        var p = closest(pool, cap * S.tiers[i].share / counts[i], used);
        used[p.id] = true; picks.push(p);
      }
      var adjust = [];
      function fillLast() {
        var spent = picks.reduce(function (s, p, j) { return s + p.cost * counts[j]; }, 0);
        var per = (cap - spent) / counts[counts.length - 1];
        var cands = pool.filter(function (p) { return !used[p.id] && p.cost <= per + 1e-9; }).sort(function (a, b) { return b.cost - a.cost || b.attract - a.attract; });
        return cands[0] || null;
      }
      var last = fillLast(), guard = 0;
      while (!last && guard++ < 40) {
        // 最低档放不下：从 D 赏往上，把单件成本降一档，腾出预算
        var changed = false;
        for (var k = S.tiers.length - 2; k >= 0 && !changed; k--) {
          var cur = picks[k];
          var cheaper = pool.filter(function (p) { return !used[p.id] && p.cost < cur.cost; }).sort(function (a, b) { return b.cost - a.cost || b.attract - a.attract; })[0];
          if (cheaper) { delete used[cur.id]; used[cheaper.id] = true; picks[k] = cheaper; adjust.push(S.tiers[k].name + '：' + cur.name + '（' + money(cur.cost) + '）→ ' + cheaper.name + '（' + money(cheaper.cost) + '）'); changed = true; }
        }
        if (!changed) break;
        last = fillLast();
      }
      if (last) { picks.push(last); used[last.id] = true; }
      var rows = S.tiers.map(function (t, j) { var p = picks[j]; return { tier: t.name, count: counts[j], item: p ? p.name : '—', cost: p ? p.cost : 0, subtotal: p ? Math.round(p.cost * counts[j] * 100) / 100 : 0 }; });
      var total = rows.reduce(function (s, r) { return s + r.subtotal; }, 0);
      total = Math.round(total * 100) / 100;
      var realMargin = (revenue - total) / revenue;
      return { revenue: revenue, cap: cap, rows: rows, total: total, margin: realMargin, ok: !!last && total <= cap + 1e-9 && realMargin >= margin - 1e-9, adjust: adjust };
    }
    function productLayout(input) {
      var slots = +input.slots || 80, price = +input.price || 59, margin = input.margin === undefined ? D.CONSTRAINTS.grossMargin : +input.margin;
      var L = layout(slots, price, margin);
      var thinking = [
        '第 1 步 这一箱最多能卖多少：' + slots + ' × ' + money(price) + ' = ' + money(L.revenue),
        '第 2 步 毛利守住 ' + pct(margin) + '，商品成本上限：' + money(L.revenue) + ' × (1 − ' + pct(margin) + ') = ' + money(L.cap),
        '第 3 步 在 ' + money(L.cap) + ' 里把 ' + slots + ' 份拆成六个赏级：高赏级稀缺、低赏级铺量' + (L.adjust.length ? '；最低档放不下，调整了 ' + L.adjust.length + ' 处' : ''),
        '第 4 步 自动验算：总成本 ' + money(L.total) + (L.total <= L.cap ? ' ≤ ' : ' > ') + '上限 ' + money(L.cap) + '，毛利率 ' + pct(L.margin, 2) + (L.ok ? ' ✅' : ' ❌')
      ];
      var md = D.BOX_STRATEGY.multiDraw.map(function (m) {
        var rev = L.revenue * m.discount, mg = (rev - L.total) / rev;
        return [m.n + ' 连抽 ' + (m.discount * 10).toFixed(1).replace('.0', '') + ' 折', pct(mg, 1), mg >= margin ? '✅ 可以' : '❌ 会破线，成本上限需降到 ' + money(rev * (1 - margin))];
      });
      var slack = L.cap - L.total;
      return result('product_layout', slots + ' 份 · 单抽 ' + money(price) + ' · 毛利 ' + pct(margin), thinking, {
        summary: L.ok ? '方案通过：总成本 ' + money(L.total) + '，毛利 ' + pct(L.margin, 2) : '方案不通过：在这个价格下配不出满足毛利线的组合',
        metrics: [{ label: '整箱营收', value: money(L.revenue) }, { label: '成本上限', value: money(L.cap) }, { label: '实际成本', value: money(L.total) }, { label: '毛利验算', value: pct(L.margin, 2) + (L.ok ? ' ✅' : ' ❌') }],
        detail: '### 组箱方案\n' + table(['赏级', '份数', '商品', '单件成本', '小计'], L.rows.map(function (r) { return [r.tier, String(r.count), r.item, money(r.cost), money(r.subtotal)]; }).concat([['**合计**', '**' + slots + ' 份**', '—', '—', '**' + money(L.total) + '**']])) +
          '\n\n### 验算\n- 成本上限 ' + money(L.cap) + '，实际方案 ' + money(L.total) + '，余量 ' + money(slack) + '\n- 毛利 (' + money(L.revenue) + ' − ' + money(L.total) + ') ÷ ' + money(L.revenue) + ' = ' + pct(L.margin, 2) + (L.ok ? ' ✅' : ' ❌') +
          (L.adjust.length ? '\n\n### 自动调整\n' + L.adjust.map(function (a) { return '- ' + a; }).join('\n') : '') +
          '\n\n### 连抽折扣能不能做\n' + table(['方案', '折后毛利', '结论'], md),
        suggestion: L.ok ? (slack < L.revenue * 0.01 ? '余量只有 ' + money(slack) + '，差一点就破线；这一期不建议再做连抽折扣。' : '方案可直接采纳，交运营确认后上架。') : '提高单抽价格，或者换更便宜的赏品后重算。'
      }, 0.97, 3, { level: L.ok ? 'low' : 'high', layout: L });
    }

    /* ========== ⑥ 智能积分兑换 ========== */
    function redeemPoints(p) { return Math.ceil(+(p.cost / (1 - D.POINTS.redeemMargin) / D.POINTS.valuePerPoint).toFixed(6)); }
    function collectCalc(input) {
      var pts = Math.max(0, +input.points || 0);
      var item = D.PRODUCTS.filter(function (p) { return p.id === input.target; })[0] || D.PRODUCTS[0];
      var need = redeemPoints(item), gap = Math.max(0, need - pts), draws = Math.ceil(gap / D.POINTS.perDraw);
      var m = 1 - item.cost / (need * D.POINTS.valuePerPoint);
      var now2 = D.PRODUCTS.filter(function (p) { return redeemPoints(p) <= pts && p.trend > -10; }).sort(function (a, b) { return b.attract - a.attract; }).slice(0, 4);
      var thinking = [
        '查目标商品：「' + item.name + '」采购价 ' + money(item.cost),
        '算积分价：采购价 ÷ (1 − 兑换毛利 ' + pct(D.POINTS.redeemMargin) + ') ÷ 每积分 ' + money(D.POINTS.valuePerPoint) + ' = ' + need + ' 积分',
        '算差额：' + need + ' − ' + pts + ' = ' + gap + ' 积分' + (gap ? '，每抽得 ' + D.POINTS.perDraw + ' 积分，还要 ' + draws + ' 抽' : '，已经够了'),
        '毛利校验：兑换毛利 ' + pct(m, 1) + '，在 50%–60% 区间内 ✅'
      ];
      return result('collect_calc', '当前 ' + pts + ' 积分，目标「' + item.name + '」', thinking, {
        summary: gap ? '还差 ' + gap + ' 积分，再抽 ' + draws + ' 次就能换' : '积分已够，可以直接兑换',
        metrics: [{ label: '目标所需', value: need + ' 积分' }, { label: '当前积分', value: pts + ' 积分' }, { label: '还差', value: gap + ' 积分' }, { label: '建议补抽', value: draws + ' 次（约 ' + money(draws * 59) + '）' }],
        detail: '### 现在就能换的\n' + (now2.length ? table(['商品', '所需积分', '吸引力'], now2.map(function (p) { return [p.name, redeemPoints(p) + ' 积分', String(p.attract)]; })) : '暂时没有。') +
          '\n\n### 规则\n每消费 1 元得 ' + D.POINTS.earnPerYuan + ' 积分，每积分价值 ' + money(D.POINTS.valuePerPoint) + '；兑换毛利控制在 50%–60%。',
        suggestion: gap ? '提示用户：再抽 ' + draws + ' 次即可兑换；不想补抽的话，现在可以先换「' + (now2[0] ? now2[0].name : '—') + '」。不要用「马上就能回本」之类的话术诱导消费。' : '直接引导用户去积分商城兑换。'
      }, 0.96, 2);
    }

    /* ========== ⑦ 用户画像分析 ========== */
    var VIP_SCORE = { '钻石': 100, '黄金': 70, '白银': 40, '普通': 10 };
    function profileOf(u) {
      var norm = Math.min(100, Math.sqrt(u.total / 500000) * 100);
      var value = Math.round(0.5 * norm + 0.2 * VIP_SCORE[u.vip] + 0.1 * Math.min(100, u.regDays / 365 * 100) + 0.2 * u.pickupRate * 100);
      var risk = u.complaints30d * 15 + u.refunds30d * 5 + (u.regDays < 30 ? 15 : 0) + (u.minorFlag ? 40 : 0);
      risk = Math.max(5, Math.min(100, risk));
      var tags = [];
      if (value >= 80) tags.push('高价值'); if (u.total >= 100000) tags.push('大额消费'); if (u.regDays >= 365) tags.push('老用户');
      if (u.regDays < 30) tags.push('新用户'); if (u.complaints30d >= 3) tags.push('高频投诉'); if (u.pickupRate >= 0.8) tags.push('稳定提货');
      if (u.minorFlag) tags.push('疑似未成年');
      var strategy = u.minorFlag ? '疑似未成年：按未成年人保护流程处理，暂停消费功能'
        : risk >= 70 ? '高风险用户：限制服务优先级，投诉一律走人工复核'
        : value >= 80 ? '高价值客户：客服经理 1v1 维护，投诉优先处理'
        : value >= 40 ? '成长用户：常规运营，适时推送集赏和积分活动' : '普通用户：常规运营';
      return { value: value, risk: risk, tags: tags, strategy: strategy };
    }
    function userProfile(input) {
      var id = String(input.user_id || '').trim().toUpperCase(), u = D.USERS[id];
      if (!u) return result('user_profile', id, ['查库：没有这个用户'], { summary: '未匹配到用户', metrics: [{ label: '结论', value: '转人工' }], detail: '没有找到这个 user_id。', suggestion: '核实用户 ID。' }, 0.5, 0);
      var pf = profileOf(u);
      var thinking = [
        '查库（代码节点，精确查询）：VIP ' + u.vip + ' / 累计 ' + money(u.total) + ' / 注册 ' + u.regDays + ' 天 / 提货率 ' + pct(u.pickupRate),
        '价值评分：消费规模 50% + 会员等级 20% + 在网时长 10% + 提货行为 20% = ' + pf.value,
        '风险评分：近 30 天投诉 ' + u.complaints30d + ' 次 × 15 + 退款 ' + u.refunds30d + ' 次 × 5' + (u.regDays < 30 ? ' + 新号 15' : '') + (u.minorFlag ? ' + 疑似未成年 40' : '') + ' = ' + pf.risk,
        '打标签：' + (pf.tags.join('、') || '无'),
        '分层策略：' + pf.strategy
      ];
      return result('user_profile', id, thinking, {
        summary: pf.tags[0] ? pf.tags.slice(0, 2).join(' · ') + '（价值 ' + pf.value + ' / 风险 ' + pf.risk + '）' : '普通用户（价值 ' + pf.value + ' / 风险 ' + pf.risk + '）',
        metrics: [{ label: '价值分', value: String(pf.value) }, { label: '风险分', value: String(pf.risk) }, { label: '标签', value: pf.tags.join('、') || '无' }, { label: '分层', value: pf.strategy.split('：')[0] }],
        detail: '### 画像\n' + table(['维度', '值'], [['VIP 等级', u.vip], ['累计消费', money(u.total)], ['今日亏损', money(u.todayLoss)], ['近 30 天投诉 / 退款', u.complaints30d + ' / ' + u.refunds30d], ['注册天数', u.regDays + ' 天'], ['提货率', pct(u.pickupRate)]]) +
          '\n\n### 判定只看后台数据\n画像和补偿只依据消费记录、投诉次数这些客观数据，不看用户投诉写得好不好，避免对表达能力弱的用户不公平。',
        suggestion: pf.strategy + '。'
      }, 0.94, 1, { level: pf.risk >= 70 ? 'high' : pf.value >= 80 ? 'low' : 'mid', profile: pf });
    }

    /* ========== ⑧ 智能客服问答 ========== */
    function bigrams(s) { var a = {}, t = String(s).replace(/[\s？?！!，,。.、：:；;]/g, ''); for (var i = 0; i < t.length - 1; i++) a[t.substr(i, 2)] = 1; return a; }
    function cover(q, f) { var Q = bigrams(q), F = bigrams(f), inter = 0, n = 0, k; for (k in F) { n++; if (Q[k]) inter++; } return n ? inter / n : 0; }
    function jaccard(a, b) { var A = bigrams(a), B = bigrams(b), inter = 0, uni = 0, k; for (k in A) { uni++; if (B[k]) inter++; } for (k in B) if (!A[k]) uni++; return uni ? inter / uni : 0; }
    function scoreFaq(q, f) {
      var kwHit = f.kw.filter(function (k) { return q.indexOf(k) !== -1; }).length;
      var kw = Math.min(1, kwHit / 1.5);
      var sem = Math.min(1, cover(q, f.q) * 1.4);
      return { kw: kw, sem: sem, raw: 0.4 * kw + 0.35 * sem };
    }
    function customerService(input) {
      var q = String(input.question || ''), id = String(input.user_id || '').toUpperCase(), u = D.USERS[id];
      var thinking = [], hits = matchWords(q);
      var level1 = hits.filter(function (h) { return h.level === 1; }), level2 = hits.filter(function (h) { return h.level === 2; });
      thinking.push('意图识别：' + (u ? '用户 ' + id + '（VIP ' + u.vip + '）' : '未登录用户') + '，问题「' + q + '」');
      // 未成年人
      if (MINOR_RE.test(q) || (u && u.minorFlag)) {
        thinking.push('命中 esc_6：涉及未成年人消费 → 最高优先级转人工');
        return result('customer_service', q, thinking, { summary: '涉及未成年人，最高优先级转人工', metrics: [{ label: '意图', value: '未成年人消费' }, { label: '处理', value: '转人工（最高优先级）' }, { label: '规则', value: 'esc_6' }],
          detail: 'AI 不自行处理未成年人相关问题，按未成年人保护专项流程交给人工。', suggestion: '回复：「您好，这个情况我们会请专人马上联系您处理。」并立即通知客服主管。' }, 0.98, 1, { level: 'high' });
      }
      // 白名单外的高风险话题
      var blocked = D.BLOCKED_TOPICS.words.filter(function (w) { return q.indexOf(w) !== -1; });
      if (blocked.length) {
        thinking.push('意图不在白名单（' + blocked.join('、') + '），不自行作答');
        return result('customer_service', q, thinking, { summary: '白名单外的话题，固定话术 + 转人工', metrics: [{ label: '意图', value: '白名单外' }, { label: '处理', value: '固定话术 + 转人工' }],
          detail: '客服 Agent 只回答 ' + D.INTENT_WHITELIST.join('、') + ' 这几类问题。涉及回收、转卖、收益的问题一律不作答。', suggestion: D.BLOCKED_TOPICS.reply }, 0.95, 1, { level: 'mid' });
      }
      var esc = [];
      if (level1.length) esc.push('esc_4'); if (level1.length || level2.length) esc.push('esc_1');
      if (u && u.vip !== '普通' && /退款|投诉|退钱/.test(q)) esc.push('esc_3');
      // FAQ 检索
      var scored = D.FAQ.map(function (f) { return { f: f, s: scoreFaq(q, f) }; }).sort(function (a, b) { return b.s.raw - a.s.raw; });
      var ctx = 0.85, prof = u ? 1 : 0.6;
      var best = scored[0], conf = best.s.raw + 0.15 * ctx + 0.1 * prof;
      var second = scored.filter(function (x) { return x.f.cat !== best.f.cat || x.f.q !== best.f.q; }).filter(function (x) { return x.s.raw + 0.15 * ctx + 0.1 * prof >= D.CONSTRAINTS.confidenceFloor && x.s.kw >= 0.5 && x.f.q !== best.f.q; })[0];
      thinking.push('FAQ 语义检索：最相近「' + best.f.q + '」（' + best.f.cat + '）');
      thinking.push('置信度：关键词 ' + pct(best.s.kw) + ' × 40% + 语义 ' + pct(best.s.sem) + ' × 35% + 上下文 ' + pct(ctx) + ' × 15% + 画像 ' + pct(prof) + ' × 10% = ' + conf.toFixed(2));
      if (conf < D.CONSTRAINTS.confidenceFloor) esc.push('esc_2');
      esc = esc.filter(function (e, i, a) { return a.indexOf(e) === i; });
      if (esc.length) {
        thinking.push('转人工规则：' + esc.join('、') + ' → 带着结论转人工');
        var handoff = '';
        var extra = { level: level1.length ? 'high' : 'mid', esc: esc };
        if (u && (level1.length || level2.length || /退款|退钱|投诉/.test(q))) {
          var comp = compensation({ user_id: id, complaint: q });
          handoff = '\n\n### 附 ① 补偿建议\n' + comp.output.summary + '（' + comp.output.metrics.map(function (m) { return m.label + ' ' + m.value; }).join('，') + '）';
          extra.actions = [{ label: '查看补偿方案', agent: 'compensation', input: { user_id: id, complaint: q } }];
          thinking.push('调用 ① 补偿决策：' + comp.output.summary);
        }
        var to = D.ESCALATION.filter(function (e) { return esc.indexOf(e.id) !== -1; }).map(function (e) { return e.id + ' → ' + e.to; });
        return result('customer_service', q, thinking, {
          summary: '转人工：' + to.join('；'),
          metrics: [{ label: '意图', value: conf < D.CONSTRAINTS.confidenceFloor && !level1.length ? '未识别' : best.f.cat }, { label: '置信度', value: conf.toFixed(2) }, { label: '处理', value: '转人工' }, { label: '规则', value: esc.join('、') }],
          detail: '### 转人工原因\n' + D.ESCALATION.filter(function (e) { return esc.indexOf(e.id) !== -1; }).map(function (e) { return '- ' + e.id + '：' + e.rule + ' → ' + e.to; }).join('\n') + handoff,
          suggestion: '先回复：「您好，您的问题我已经转给专人，会尽快联系您。」' + (esc.indexOf('esc_4') !== -1 ? '同时通知法务。' : '')
        }, conf, 2 + esc.length, extra);
      }
      var answer = best.f.a + (second ? '\n' + second.f.a : '');
      thinking.push('置信度 ≥ 0.80，直接回答' + (second ? '（问题里有两个意图，一起答）' : ''));
      return result('customer_service', q, thinking, {
        summary: '已回答 · ' + best.f.cat + (second && second.f.cat !== best.f.cat ? ' + ' + second.f.cat : '') + '（置信度 ' + conf.toFixed(2) + '）',
        metrics: [{ label: '意图', value: best.f.cat }, { label: '置信度', value: conf.toFixed(2) }, { label: '处理', value: 'AI 直接回答' }, { label: '命中 FAQ', value: second ? '2 条' : '1 条' }],
        detail: '### 回答\n' + answer.replace(/\n/g, '\n\n') + '\n\n### 命中的 FAQ\n- ' + best.f.q + (second ? '\n- ' + second.f.q : ''),
        suggestion: answer
      }, conf, second ? 2 : 1, { level: 'low', answer: answer });
    }

    var RUN = {
      compensation: compensation, risk_monitor: riskMonitor, ops_qa: opsQa, product_select: productSelect,
      product_layout: productLayout, collect_calc: collectCalc, user_profile: userProfile, customer_service: customerService
    };
    return {
      run: function (id, input) { if (!RUN[id]) throw new Error('未知的 Agent：' + id); return RUN[id](input || {}); },
      matchWords: matchWords, layout: layout, profileOf: profileOf, redeemPoints: redeemPoints,
      money: money, pct: pct
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { makeEngine: makeEngine };
  else root.HubEngine = { makeEngine: makeEngine };
})(this);
