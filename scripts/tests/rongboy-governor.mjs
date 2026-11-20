// 清晰度调节器：用一个假的"显卡"模拟（一帧的开销 = 固定开销 + 每百万像素的开销，按 60 赫兹的屏幕刷新取整），
// 查它在几种机器、几种画面下最后停在哪。数是在 Radeon Pro 5300M 上量的：重的画面 13 + 13.4/百万像素，轻的 7.7 + 7.2/百万像素（毫秒）。
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
const report = (name, fr, gov) => console.log(`${name}：最后停在第 ${gov.tier} 档 ${(gov.pixels / 1e6).toFixed(2)} 百万像素，末 10 秒 ${fps(tail(fr, 10000)).toFixed(1)} 帧，一共改了 ${gov.log.length} 次`);

// 一、这台机器、重的画面：停在第 0 档（光影不降），30 帧
{
  const g = createGovernor(LOOKS), fr = run(g, 60, () => HEAVY);
  report('重的画面', fr, g);
  assert.equal(g.tier, 0, '光影不降档');
  assert.ok(fr.every(f => f.tier === 0), '中途也没降过档');
  assert.ok(fps(tail(fr, 10000)) >= 28, '末 10 秒有 30 帧');
  assert.ok(g.pixels >= 0.55e6 && g.pixels <= 1.5e6, '像素数在 55 万到 150 万之间');
}
// 二、轻的画面：还是 30 帧，像素数比重的画面高
{
  const g = createGovernor(LOOKS), fr = run(g, 90, () => LIGHT);
  report('轻的画面', fr, g);
  assert.equal(g.tier, 0);
  assert.ok(fps(tail(fr, 10000)) >= 28);
  assert.ok(g.pixels >= 1.9e6, '轻的画面能到 190 万像素以上');
}
// 三、快四倍的机器：一直加到屏幕原生分辨率，然后不再动
{
  const g = createGovernor(LOOKS), fr = run(g, 40, () => HEAVY, { speed: 0.25 });
  report('快四倍的机器', fr, g);
  assert.equal(g.tier, 0); assert.ok(g.pixels >= NATIVE * 0.97, '加到原生分辨率');
  assert.ok(g.log.at(-1).t < 30000, '30 秒内到位，之后不再改');
}
// 四、开局卡顿：每帧 3% 的概率卡 400 毫秒，不该因此降档或减像素
{
  const g = createGovernor(LOOKS, { start: 0.8e6 }), fr = run(g, 60, () => HEAVY, { hitch: 0.03 });
  report('老是卡一下', fr, g);
  assert.equal(g.tier, 0); assert.ok(g.pixels >= 0.7e6, '卡顿不把像素数拉下去');
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
// 六、慢三倍的机器：光影只能降，但要一档一档来，而且到底以后不来回抖
{
  const g = createGovernor(LOOKS), fr = run(g, 180, () => HEAVY, { speed: 3 });
  report('慢三倍的机器', fr, g);
  assert.equal(g.tier, 2, '降到最后一档');
  assert.ok(g.log.filter(l => l.t > 120000).length <= 4, '后一分钟改动不超过四次');
}
// 七、切到别的窗口再回来（一帧隔了几秒）：不算数
{
  const g = createGovernor(LOOKS, { start: 0.8e6 });
  run(g, 20, () => HEAVY); const before = g.pixels;
  for (let i = 0; i < 30; i++) g.feed(20000 + i * 1000, 1000, NATIVE);
  assert.equal(g.pixels, before, '后台那种一秒一帧不触发调节');
}
// Startup protects against quality increases without blocking a slow machine from scaling down.
{
  const fast = createGovernor(LOOKS);
  fast.deferUpscale(6500);
  run(fast, 6, () => LIGHT, { speed: 0.25 });
  assert.equal(fast.log.length, 0);
  run(fast, 4, () => LIGHT, { speed: 0.25, t0: 6000 });
  assert.ok(fast.log.some(entry => entry.t >= 6500 && entry.pixels > 1.6e6));

  const slow = createGovernor(LOOKS);
  slow.deferUpscale(6500);
  run(slow, 5, () => HEAVY, { speed: 2 });
  assert.ok(slow.log.some(entry => entry.t < 6500 && entry.pixels < 1.6e6));
}
console.log('ok');
