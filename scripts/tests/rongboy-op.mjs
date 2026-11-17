// 开场片的分镜数据和走位：不渲染，用假的舞台把全片从头到尾摆一遍。
//   node scripts/tests/rongboy-op.mjs
// 查的是：镜头首尾相接、没有太短的镜头、每一刻都摆得出来（不抛错、位置都是有限数）、
// 关键动作落在配乐的拍点上、该响的音效都响了、往回跳再放结果一样。
import assert from 'node:assert/strict';
import * as T from 'three';
import { createFilm, DURATION, BEAT, beat, bar } from '../../scenes/rongboy-op/film.js';

const CAST = {
  house: ['hero', 'v', 'h1', 'h2', 'h3', 'd1', 'd2', 'boss'], museum: ['hero', 'a', 'b', 'c'], school: ['hero', 'a', 'b', 'c', 'd'],
};
const HERO_PARTS = ['CTRL / body', 'CTRL / head', 'CTRL / hat', 'CTRL / backpack', 'CTRL / arm -1', 'CTRL / arm 1', 'CTRL / leg -1', 'CTRL / leg 1'];
const ZOMBIE_PARTS = ['Body', 'Head', 'ArmL', 'ArmR', 'LegL', 'LegR'];
function actor(name) {
  const world = new T.Group(), tilt = new T.Group(), model = new T.Group(), parts = new Map();
  world.add(tilt); tilt.add(model);
  for (const n of name === 'hero' ? HERO_PARTS : ZOMBIE_PARTS) { const o = new T.Group(); model.add(o); parts.set(n, o); }
  const a = { name, world, tilt, model, parts, materials: [], height: 1.6, radius: 0.3, moods: [], flash() {},
    reset() { for (const o of parts.values()) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); } tilt.quaternion.identity(); } };
  if (name === 'hero') {
    a.gun = new T.Group(); a.gun.userData = { variants: Array.from({ length: 7 }, () => new T.Group()), muzzleZ: 0.63 }; parts.get('CTRL / body').add(a.gun);
    a.loaded = new T.Group(); a.gun.add(a.loaded);
  }
  return a;
}
function fakeStage() {
  const sets = {}, log = { sounds: [], bursts: 0, uses: [] };
  for (const [id, names] of Object.entries(CAST)) {
    const balls = new Map();
    sets[id] = { id, cast: Object.fromEntries(names.map(n => [n, actor(n)])), props: { tower: Object.assign(new T.Group(), { blocks: Array.from({ length: 7 }, () => new T.Group()) }), dark: new T.Group(), glow: new T.PointLight(), eyes: [0, 1].map(() => new T.Sprite()) },
      basket: Object.assign(new T.Group(), { userData: { body: new T.Group(), baseY: 6.3 } }),
      ball(i, w) { const k = i + w; if (!balls.has(k)) balls.set(k, Object.assign(new T.Group(), { userData: { trail: 0 } })); return balls.get(k); }, balls };
  }
  let current = null;
  const fx = new Proxy({}, { get: () => () => {} });
  return { log, sets, cine: { camera: new T.PerspectiveCamera(40, 16 / 9, 0.1, 100), post: {} }, effects: fx,
    use(id, floor) { current = sets[id]; log.uses.push(id + ':' + floor); return current; },
    clearFrame() { for (const a of Object.values(current.cast)) a.world.visible = false; for (const b of current.balls.values()) b.visible = false; },
    clearFx() {}, step() {}, burst() { log.bursts++; }, burstTrail() {}, curls() {}, tangle() {}, layoutMoods() {}, get current() { return current; } };
}

const stage = fakeStage(), cues = [];
let now = 0;
const film = createFilm(stage, { sound: (kind, opts) => cues.push({ T: now, kind, opts }) });
const S = film.SHOTS;

// ---- 镜头表
assert.equal(S[0].T0, 0, '第一个镜头从 0 秒开始');
assert.ok(Math.abs(S.at(-1).T1 - DURATION) < 1e-6, '最后一个镜头到片尾');
for (let i = 1; i < S.length; i++) assert.ok(Math.abs(S[i].T0 - S[i - 1].T1) < 1e-6, `${S[i - 1].name} 和 ${S[i].name} 首尾相接`);
for (const sh of S) {
  assert.ok(sh.T1 - sh.T0 >= 0.6, `${sh.name} 不短于 0.6 秒`);
  assert.ok(['house', 'museum', 'school'].includes(sh.set), `${sh.name} 在三张地图之一`);
  for (const k of ['from', 'to']) for (const v of [...sh.cam[k].p, ...sh.cam[k].at, sh.cam[k].fov]) assert.ok(Number.isFinite(v), `${sh.name} 的机位是数`);
}
// 运镜的镜头不超过四个，其余都是固定机位（有东西在动时镜头不动）
const moving = S.filter(sh => sh.cam.from.p.some((v, i) => v !== sh.cam.to.p[i]) || sh.cam.from.fov !== sh.cam.to.fov);
assert.ok(moving.length <= 4, '运镜的镜头不超过四个：' + moving.map(sh => sh.name).join('、'));
// 三张地图都出现
assert.deepEqual([...new Set(S.map(sh => sh.set))].sort(), ['house', 'museum', 'school']);

// ---- 全片摆一遍
const finite = o => [o.position.x, o.position.y, o.position.z].every(Number.isFinite);
const seen = new Set();
for (let t = 0; t < DURATION; t += 1 / 30) {
  now = t;
  const sh = film.evaluate(t, 1 / 30);
  for (const a of Object.values(stage.current.cast)) { assert.ok(finite(a.world), `${sh.name} ${t.toFixed(2)} 秒 ${a.name} 的位置`); if (a.world.visible) seen.add(sh.set + '.' + a.name); }
  assert.ok(finite(stage.cine.camera), `${sh.name} ${t.toFixed(2)} 秒的机位`);
}
// 每个演员都上过场
for (const [id, names] of Object.entries(CAST)) for (const n of names) assert.ok(seen.has(id + '.' + n), `${id} 的 ${n} 上过场`);
// 阁楼的彩蛋在三层
assert.ok(stage.log.uses.includes('house:2'), '彩蛋在阁楼');

// ---- 声音：每把枪都响过，关键的几下落在拍点上
const kinds = new Set(cues.map(c => c.kind));
for (const k of ['snore', 'shh', 'shot', 'hit', 'bounce', 'knock', 'crash', 'pop', 'squeak', 'zap', 'needle', 'thunk', 'throw', 'boom']) assert.ok(kinds.has(k), '有 ' + k + ' 的声音');
const first = (kind, pred = () => true) => cues.find(c => c.kind === kind && pred(c))?.T;
const near = (t, target, what) => assert.ok(Math.abs(t - target) < 0.05, `${what} 在 ${target.toFixed(2)} 秒（实际 ${t?.toFixed(2)}）`);
near(first('shot'), beat(48), '第一枪落在第 12 小节的第一拍');
near(first('crash'), beat(79), '积木落地在第 79 拍');
near(first('zap'), bar(24), '电弧在第 24 小节');
near(first('boom'), beat(110), '手雷在第 110 拍炸');
near(first('shot', c => c.opts?.weapon === 'heavy'), beat(114), '棉被炮在第 114 拍');
// 绒仔是走路的，不是蹦的：他在走的那几段，离地最多两三厘米（僵尸蹦一下有十几厘米）
for (const [t0, t1, base] of [[12.4, 15.2, 0], [26.0, 27.7, 0], [55.0, 57.6, 6]]) for (let t = t0; t < t1; t += 0.05) {
  film.evaluate(t, 1 / 30);
  const hero = stage.current.cast.hero, lift = hero.world.position.y - base;
  assert.ok(lift >= -1e-6 && lift < 0.04, `${t.toFixed(2)} 秒绒仔在走路，脚不离地（离地 ${lift.toFixed(3)} 米）`);
  assert.ok(Math.abs(hero.parts.get('CTRL / leg -1').rotation.x + hero.parts.get('CTRL / leg 1').rotation.x) < 1e-6, `${t.toFixed(2)} 秒两条腿一前一后`);
}
// 音乐全停的那一段（34.4–38.3 秒）里只有感叹号、一声吱、咽口水和掏枪，没有枪声
for (const c of cues) if (c.T > 34.5 && c.T < 38.2) assert.ok(['pop', 'squeak', 'gulp', 'weapon'].includes(c.kind), `停顿里不该有 ${c.kind}（${c.T.toFixed(2)} 秒）`);
assert.ok(Math.abs(BEAT - 60 / 138.05) < 1e-9);

// ---- 往回跳再放，结果一样（任何一刻都只由时间决定）
const snap = t => { film.evaluate(t, 1 / 30); return Object.values(stage.current.cast).filter(a => a.world.visible).map(a => [a.name, ...a.world.position.toArray().map(v => v.toFixed(4))].join(',')).join('|'); };
for (const t of [6.5, 14.2, 21.3, 26.0, 36.5, 39.4, 47.9, 57.6]) { const a = snap(t); snap(Math.max(0, t - 3)); assert.equal(snap(t), a, `${t} 秒重放一致`); }

console.log(`ok：${S.length} 个镜头，${DURATION} 秒，${cues.length} 处音效，${moving.length} 个运镜镜头`);
