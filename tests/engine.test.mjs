// 规则引擎测试：node --test tests/
// 文档里的三个算例必须一字不差：¥32,800、¥480、¥2,831 / 40.02%
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const D = require('../assets/js/data.js');
const { makeEngine } = require('../assets/js/engine.js');
const E = makeEngine(D, { now: () => new Date('2026-10-27T21:13:07') });
const run = (id, input) => E.run(id, input);
const metric = (r, label) => (r.output.metrics.find((m) => m.label === label) || {}).value;

test('统一输出契约：8 个 Agent 结构一致', () => {
  for (const a of D.AGENTS) {
    for (const s of D.SCENES[a.id]) {
      const r = run(a.id, s.input);
      assert.equal(r.agent_id, a.id);
      assert.ok(Array.isArray(r.thinking) && r.thinking.length >= 2, a.id + ' thinking');
      assert.ok(r.output.summary && r.output.detail && r.output.suggestion, a.id + ' output');
      assert.ok(r.output.metrics.length >= 2 && r.output.metrics.length <= 4, a.id + ' metrics 2–4 个');
      assert.ok(r.meta.confidence > 0 && r.meta.confidence <= 1);
      assert.equal(r.meta.ts, '2026-10-27 21:13:07');
    }
  }
});

test('知识库规模：敏感词 68 个（13/26/21/8），FAQ 31 条，商品 50 款', () => {
  const by = (lv) => D.SENSITIVE.filter((w) => w.level === lv).length;
  assert.deepEqual([D.SENSITIVE.length, by(1), by(2), by(3), by(4)], [68, 13, 26, 21, 8]);
  assert.equal(D.FAQ.length, 31);
  assert.equal(D.PRODUCTS.length, 50);
});

test('① VIP 钻石大额亏损：¥82,000 × 40% = ¥32,800，线上补货', () => {
  const r = run('compensation', { user_id: 'U10086', complaint: '连抽30次没出最终赏，你们这是不是黑箱？我要退钱' });
  assert.equal(r.amount, 32800);
  assert.equal(metric(r, '补偿比例'), '40%');
  assert.equal(metric(r, '方式'), '线上补货');
  assert.equal(metric(r, '风险等级'), '低');
});

test('① 高频投诉用户：封号劝退，按最后一笔 60% 结算 ¥480', () => {
  const r = run('compensation', { user_id: 'U20355', complaint: '又没中，你们平台就是骗钱的，我要去12315举报' });
  assert.equal(r.amount, 480);
  assert.match(r.output.summary, /封号劝退/);
  assert.equal(metric(r, '风险等级'), '高');
});

test('① 补偿不超过 70% 上限，未成年人一律转人工，查不到用户不编答案', () => {
  const big = run('compensation', { user_id: 'U60520', complaint: '亏了' });
  assert.ok(big.amount <= 150000 * 0.7);
  assert.match(run('compensation', { user_id: 'U50999', complaint: '我儿子偷用我手机充的' }).output.summary, /未成年/);
  assert.match(run('compensation', { user_id: 'U99999', complaint: '退钱' }).output.summary, /转人工/);
});

test('② 社群风控：VIP 群带节奏 → 一级高危，15 分钟，1 人激进 + 2 人关注，可转投诉处理', () => {
  const r = run('risk_monitor', D.SCENES.risk_monitor[0].input);
  assert.match(r.output.summary, /一级高危/);
  assert.equal(metric(r, '建议响应时限'), '15 分钟');
  assert.equal(metric(r, '涉及人数'), '1 人激进 + 2 人关注');
  for (const w of ['诈骗', '12315', '举报', '概率不对']) assert.ok(metric(r, '命中敏感词').includes(w), w);
  assert.equal(r.actions[0].input.user_id, 'U10086');
});

test('② 跨群导流：同一用户在 2 个群发导流信息 → cross_4', () => {
  const r = run('risk_monitor', D.SCENES.risk_monitor[1].input);
  assert.match(r.output.summary, /四级监控/);
  assert.match(r.output.detail, /cross_4/);
});

test('③ 数据问答：找出 10-25 出货率 +8.3 个百分点和 10-26 客诉率 2.10%', () => {
  const r = run('ops_qa', { question: '这 7 天出货率和毛利率有没有异常？' });
  assert.match(r.output.detail, /10-25\*\*：出货率 69\.8%，高于基准 61\.5%（\+8\.3 个百分点）/);
  assert.match(r.output.detail, /10-26\*\*：客诉率冲到 2\.10%/);
});

test('⑤ 组箱定价：80 份 × ¥59，毛利 40% → 成本 ¥2,831，毛利 40.02%', () => {
  const L = E.layout(80, 59, 0.4);
  assert.equal(L.cap, 2832);
  assert.deepEqual(L.rows.map((r) => r.count), [1, 2, 5, 12, 20, 40]);
  assert.deepEqual(L.rows.map((r) => r.cost), [335, 278, 100, 36, 25, 12.7]);
  assert.equal(L.total, 2831);
  assert.equal((L.margin * 100).toFixed(2), '40.02');
  assert.ok(L.ok);
});

test('⑤ 换一个规格也守得住毛利线：120 份 × ¥39', () => {
  const L = E.layout(120, 39, 0.4);
  assert.ok(L.ok);
  assert.ok(L.total <= L.cap);
  assert.equal(L.rows.reduce((s, r) => s + r.count, 0), 120);
});

test('⑥ 积分兑换：620 积分换 ¥36 的商品还差 180 积分，再抽 4 次', () => {
  const r = run('collect_calc', { points: 620, target: 'T06' });
  assert.equal(metric(r, '目标所需'), '800 积分');
  assert.equal(metric(r, '还差'), '180 积分');
  assert.match(metric(r, '建议补抽'), /^4 次/);
});

test('⑦ 用户画像：高价值用户风险 5，高频投诉新用户风险 90', () => {
  assert.equal(E.profileOf(D.USERS.U10086).risk, 5);
  assert.ok(E.profileOf(D.USERS.U10086).value >= 90);
  assert.equal(E.profileOf(D.USERS.U20355).risk, 90);
});

test('⑧ 智能客服：普通问题直接答；提到 12315 带着补偿方案转人工；白名单外不作答', () => {
  const a = run('customer_service', { user_id: 'U70001', question: '我抽到的东西怎么提货？多久能发货？' });
  assert.ok(a.meta.confidence >= 0.8);
  assert.match(a.output.summary, /已回答/);
  const b = run('customer_service', { user_id: 'U30777', question: '你们再不处理我就去12315投诉，我要退款！' });
  assert.deepEqual(b.esc.sort(), ['esc_1', 'esc_3', 'esc_4']);
  assert.match(b.output.detail, /建议补偿 ¥3,750/);
  assert.match(run('customer_service', { user_id: 'U70001', question: '这个能高价回收吗' }).output.suggestion, /不参与、不担保/);
  assert.match(run('customer_service', { user_id: 'U70001', question: '今天天气怎么样' }).output.summary, /esc_2/);
});
