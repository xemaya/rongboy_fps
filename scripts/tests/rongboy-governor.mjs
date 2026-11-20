// 清晰度调节器：用一个假的"显卡"模拟（一帧的开销 = 固定开销 + 每百万像素的开销，按 60 赫兹的屏幕刷新取整），
// 查它在几种机器、几种画面下最后停在哪。数是在 Radeon Pro 5300M 上量的（2026-11 性能这一轮之前）：重的画面 13 + 13.4/百万像素，轻的 7.7 + 7.2/百万像素（毫秒）。
// 规矩（见 governor.js）：先争 60 帧；最低一档也到不了 60 帧的机器改保 30 帧，停在 30 帧撑得住的最好看的设置。
//   node scripts/tests/rongboy-governor.mjs
import assert from 'node:assert/strict';
import { createGovernor } from '../../scenes/rongboy-mission/governor.js';

const LOOKS = [{ min: 0.55e6, max: 3.6e6 }, { min: 0.4e6, max: 1.0e6 }, { min: 0.25e6, max: 1.0e6 }];
const LOOK_COST = [1, 0.8, 0.55];   // 光影差一档，每个像素便宜多少
const NATIVE = 3.6e6, VSYNC = 1000 / 60;
const HEAVY = { fixed: 13, perMP: 13.4 }, LIGHT = { fixed: 7.7, perMP: 7.2 };

// 跑 seconds 秒；view(t) 给出这一刻的画面；speed：机器比这台慢几倍；hitch：每帧有多大概率卡一下 400 毫秒
function run(gov, seconds, view, { speed = 1, hitch = 0, js = 5, t0 = 0 } = {}) {
  let t = t0, seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const frames = [];
  while (t < t0 + seconds * 1000) {
    const v = view(t), p = Math.min(gov.pixels, NATIVE) / 1e6;
    let cost = (v.fixed + v.perMP * p * LOOK_COST[gov.tier]) * speed + js;
    if (rnd() < hitch) cost += 400;
    const interval = Math.ceil(cost / VSYNC) * VSYNC;
    t += interval; frames.push({ t, interval, tier: gov.tier, pixels: gov.pixels });
    gov.feed(t, interval, NATIVE);
  }
  return frames;
}
const tail = (frames, ms) => frames.filter(f => f.t > frames.at(-1).t - ms);
const fps = fr => 1000 * fr.length / fr.reduce((a, f) => a + f.interval, 0);
const report = (name, fr, gov) => console.log(`${name}：最后停在第 ${gov.tier} 档 ${(gov.pixels / 1e6).toFixed(2)} 百万像素，目标 ${gov.target} 帧，末 10 秒 ${fps(tail(fr, 10000)).toFixed(1)} 帧，一共改了 ${gov.log.length} 次`);
const gaveUp = gov => gov.log.find(l => l.why.includes('改保'));

// 一、5300M、重的画面：60 帧怎么都到不了 → 改保 30 帧，回到第 0 档（光影不降）
{
  const g = createGovernor(LOOKS), fr = run(g, 60, () => HEAVY);
  report('重的画面', fr, g);
  assert.equal(g.target, 30, '改保 30 帧');
  const t = gaveUp(g).t; assert.ok(t < 20000, '20 秒内认清到不了 60 帧');
  assert.equal(g.tier, 0, '光影不降');
  assert.ok(fr.filter(f => f.t > t + 2000).every(f => f.tier === 0), '改保 30 帧以后没降过档');
  assert.ok(fps(tail(fr, 10000)) >= 28, '末 10 秒有 30 帧');
  assert.ok(g.pixels >= 0.55e6 && g.pixels <= 1.5e6, '像素数在 55 万到 150 万之间');
}
// 二、5300M、轻的画面：60 帧，光影不降，分辨率让一让
{
  const g = createGovernor(LOOKS), fr = run(g, 90, () => LIGHT);
  report('轻的画面', fr, g);
  assert.equal(g.target, 60); assert.equal(g.tier, 0);
  assert.ok(fps(tail(fr, 10000)) >= 55, '末 10 秒 60 帧');
}
// 三、快四倍的机器：60 帧，像素一直加到 60 帧撑不住为止（200 万以上），然后基本不动
{
  const g = createGovernor(LOOKS), fr = run(g, 60, () => HEAVY, { speed: 0.25 });
  report('快四倍的机器', fr, g);
  assert.equal(g.target, 60); assert.equal(g.tier, 0); assert.ok(g.pixels >= 2.0e6, '200 万像素以上');
  assert.ok(fps(tail(fr, 10000)) >= 55);
}
// 四、开局卡顿：每帧 3% 的概率卡 400 毫秒，不该因此降档或减像素
{
  const g = createGovernor(LOOKS, { start: 0.8e6, targets: [30] }), fr = run(g, 60, () => HEAVY, { hitch: 0.03 });
  report('老是卡一下（30 帧目标）', fr, g);
  assert.equal(g.tier, 0); assert.ok(g.pixels >= 0.7e6, '卡顿不把像素数拉下去');
  const g60 = createGovernor(LOOKS, { start: 1.6e6 }), fr60 = run(g60, 60, () => HEAVY, { speed: 0.25, hitch: 0.03 });
  report('老是卡一下（60 帧目标，快机器）', fr60, g60);
  assert.equal(g60.target, 60, '偶尔卡一下不至于放弃 60 帧'); assert.equal(g60.tier, 0);
}
// 五、画面从重变轻：像素数自己加回去；再变重：减下来，但不降档
{
  const g = createGovernor(LOOKS);
  run(g, 40, () => HEAVY); const low = g.pixels;
  run(g, 90, () => LIGHT, { t0: 40000 }); const high = g.pixels;
  const fr = run(g, 30, () => HEAVY, { t0: 130000 });
  report('重 → 轻 → 重', fr, g);
  assert.ok(high > low * 1.5, '画面轻了像素数加回去');
  assert.equal(g.tier, 0); assert.ok(fps(tail(fr, 10000)) >= 28);
}
// 六、慢三倍的机器：光影只能降，但要一档一档来，到底以后不来回抖，也不为了 30 帧再从头试一遍
{
  const g = createGovernor(LOOKS), fr = run(g, 180, () => HEAVY, { speed: 3 });
  report('慢三倍的机器', fr, g);
  assert.equal(g.tier, 2, '降到最后一档');
  assert.ok(fr.every(f => f.pixels >= 0.25e6), '像素数不低于最后一档的下限');
  assert.ok(fr.filter(f => f.t > gaveUp(g).t).every(f => f.tier === 2), '改保 30 帧以后不回头从第 0 档再试');
  assert.ok(g.log.filter(l => l.t > 120000).length <= 4, '后一分钟改动不超过四次');
}
// 七、慢 1.6 倍的机器：60 帧到不了，30 帧能在第 1 档撑住 → 停在第 1 档，不在第 2 档
{
  const g = createGovernor(LOOKS), fr = run(g, 90, () => HEAVY, { speed: 1.6 });
  report('慢 1.6 倍的机器', fr, g);
  assert.equal(g.target, 30); assert.ok(g.tier <= 1, '退回 30 帧撑得住的较好的档');
  assert.ok(fps(tail(fr, 10000)) >= 28);
}
// 八、快 1.7 倍的机器：60 帧在第 1 档撑得住 → 60 帧、第 1 档
{
  const g = createGovernor(LOOKS), fr = run(g, 90, () => HEAVY, { speed: 0.6 });
  report('快 1.7 倍的机器', fr, g);
  assert.equal(g.target, 60); assert.equal(g.tier, 1);
  assert.ok(fps(tail(fr, 10000)) >= 55);
}
// 九、上次已经知道这台机器到不了 60 帧（play.js 记在本机），这次直接按 30 帧、从上次的设置起步：一开局就不来回试
{
  const g = createGovernor(LOOKS, { targets: [30], start: 1.0e6 }), fr = run(g, 30, () => HEAVY);
  report('记得上次的结果', fr, g);
  assert.ok(fr.every(f => f.tier === 0), '一直在第 0 档');
  assert.ok(fps(fr) >= 28, '从头到尾 30 帧');
}
// 十、切到别的窗口再回来（一帧隔了几秒）：不算数
{
  const g = createGovernor(LOOKS, { start: 0.8e6 });
  run(g, 20, () => HEAVY); const before = g.pixels;
  for (let i = 0; i < 30; i++) g.feed(20000 + i * 1000, 1000, NATIVE);
  assert.equal(g.pixels, before, '后台那种一秒一帧不触发调节');
}
console.log('ok');
