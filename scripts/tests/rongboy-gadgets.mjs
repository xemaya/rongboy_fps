// 机关和拉链暗格的检查（docs/fun-design.md 第 9 节）：打一球触发、只能用一次、效果是已有的那几种、只帮玩家。
//   node scripts/tests/rongboy-gadgets.mjs
import assert from 'node:assert/strict';
import { compileLevel, freePoint } from '../../scenes/rongboy-mission/level.js';
import { createGame, spawn, step, fire, throwGrenade, consumeEvents, CONFIG, WEAPONS, ENEMY_TYPES, GRENADE } from '../../scenes/rongboy-mission/game.js';
import { GADGETS } from '../../scenes/rongboy-mission/gadgets.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const DT = 1 / 120;
// 一块空地，机关在 (0, -8)，玩家在 (0, 6)，相距 14 米（枪声 5.5 米，惊动不到机关旁边的僵尸）
function arena(kind, extra = {}) {
  return createGame({ level: compileLevel({
    id: 'gadget-test', name: 'test', bounds: { minX: -16, maxX: 16, minZ: -16, maxZ: 16 }, height: 3.2, wallThickness: 0.2, doorHeight: 2.3,
    player: { x: 0, z: 6 }, mission: { type: 'clear' }, rooms: [{ id: 'yard', name: 'yard', minX: -16, maxX: 16, minZ: -16, maxZ: 16, outdoor: true }],
    walls: [], furniture: [], enemies: [], pickups: [], arsenal: ['single', 'yarn'], gadgets: kind ? [{ kind, x: 0, z: -8 }] : [], ...extra,
  }) });
}
// 朝一个点开一枪（抬一点枪口，抵掉这段距离上的下坠）
function shootAt(s, x, z, y = 0.9) {
  const p = s.player, o = { x: p.x, y: p.y + 1.05, z: p.z }, flat = Math.hypot(x - o.x, z - o.z), t = flat / WEAPONS[0].speed, ty = y + 0.5 * CONFIG.gravity * t * t;
  const d = Math.hypot(x - o.x, ty - o.y, z - o.z), dir = { x: (x - o.x) / d, y: (ty - o.y) / d, z: (z - o.z) / d };
  s.cooldown = 0; s.reloading = false; s.ammo[0].mag = 6;
  assert.ok(fire(s, 0, { origin: o, direction: dir }));
}
function run(s, seconds, log = []) { for (let i = 0; i < Math.round(seconds * 120); i++) { step(s, DT, {}); log.push(...consumeEvents(s)); } return log; }
const facing = (e, x, z) => Math.cos(Math.atan2(x - e.x, z - e.z) - e.heading);

test('a gadget is a solid thing at chest height: bodies walk round it, a level lists it', () => {
  const s = arena('clock'), L = s.level;
  assert.deepEqual(L.gadgets.map(g => [g.kind, g.x, g.z, g.floor]), [['clock', 0, -8, 0]]);
  assert.equal(freePoint(L, 0, -8, 0.3), false); assert.equal(freePoint(L, 1.2, -8, 0.3), true);
  for (const G of Object.values(GADGETS)) assert.ok(G.h >= 1.2, 'tall enough to hit with a level shot');
  assert.equal(s.gadgets[0].used, false);
});

test('alarm clock: one ball sets it off; zombies that have not noticed you walk over and stand looking at it', () => {
  const s = arena('clock');
  const sleeper = spawn(s, { type: 'walker', x: -4, z: -9, state: 'asleep' }), idler = spawn(s, { type: 'leaper', x: 5, z: -7, state: 'idle', heading: 0 });
  const distant = spawn(s, { type: 'walker', x: -12, z: -14, state: 'asleep' }), hunter = spawn(s, { type: 'walker', x: 9, z: 4, state: 'alert' });
  shootAt(s, 0, -8);
  const log = run(s, 1.4), rang = log.filter(e => e.type === 'gadget');
  assert.equal(rang.length, 1); assert.equal(rang[0].kind, 'clock'); assert.deepEqual(rang[0].struck.sort(), [sleeper.id, idler.id].sort());
  assert.equal(sleeper.awareness, 'idle', 'the ringing wakes a sleeper, but it does not know where you are');
  s.health = 1e9; run(s, 9);
  for (const e of [sleeper, idler]) {
    assert.ok(Math.hypot(e.x, e.z + 8) < 1.5, `${e.type} is ${Math.hypot(e.x, e.z + 8).toFixed(2)} m from the clock`);
    assert.ok(facing(e, 0, -8) > 0.9, 'facing the clock'); assert.equal(e.awareness, 'idle');
  }
  assert.ok(Math.hypot(sleeper.x - idler.x, sleeper.z - idler.z) > 0.6, 'each takes its own spot');
  assert.deepEqual([distant.x, distant.z, distant.awareness], [-12, -14, 'asleep'], 'beyond 9 m nobody hears it');
  assert.equal(hunter.awareness, 'alert'); assert.equal(hunter.lure, undefined, 'one already chasing you is not distracted');
  run(s, 6);
  assert.equal(sleeper.lure, null); assert.ok(Math.hypot(sleeper.x, sleeper.z + 8) < 1.5, 'when it stops ringing they stay where they are');
});

test('a lured zombie has its back to the way you come from: the sneak and back bonuses both apply', () => {
  const s = arena('clock'), e = spawn(s, { type: 'heavy', x: 3, z: -3.5, state: 'idle', heading: 0 });
  shootAt(s, 0, -8); s.health = 1e9; run(s, 11);
  assert.ok(e.lure?.arrived && e.z > -8, 'it stopped on the near side of the clock, facing away from the player');
  s.player.x = e.x; s.player.z = e.z + 5.8; shootAt(s, e.x, e.z, e.height * 0.55);   // 5.8 米：在枪声惊动它的距离（5.5 米）之外
  const hit = run(s, 0.6).find(q => q.type === 'hit');
  assert.ok(hit.back && hit.sneak, JSON.stringify(hit)); assert.equal(hit.amount, WEAPONS[0].damage * 3);   // 背后和偷袭叠起来是 ×3
});

test('the shot that sets the clock off does not spoil it: a zombie the gunfire has just startled is still drawn to the clock', () => {
  const s = arena('clock'), e = spawn(s, { type: 'walker', x: 2.5, z: -6, state: 'asleep' });
  s.player.x = 0; s.player.z = -3;   // 离僵尸 3.9 米：在手枪声惊动它的 5.5 米以内
  shootAt(s, 0, -8);
  const log = run(s, 0.5);
  assert.ok(log.some(q => q.type === 'notice' && q.id === e.id), 'the gunshot startles it first');
  assert.deepEqual(log.find(q => q.type === 'gadget').struck, [e.id]);
  s.health = 1e9; run(s, 5);   // 玩家就站在 4 米外没动：被引住的只盯着闹钟
  assert.equal(e.awareness, 'idle'); assert.ok(e.lure && Math.hypot(e.x, e.z + 8) < 1.6);
  s.player.x = e.x; s.player.z = e.z + 1.0; run(s, 1.5);
  assert.equal(e.awareness, 'alert', 'walk right up to it and it snaps out of it');
});

test('a gadget works once', () => {
  const s = arena('clock'); spawn(s, { type: 'walker', x: 3, z: -8, state: 'asleep' });
  shootAt(s, 0, -8); assert.equal(run(s, 1.4).filter(e => e.type === 'gadget').length, 1);
  assert.equal(s.gadgets[0].used, true);
  shootAt(s, 0, -8); assert.equal(run(s, 1.4).filter(e => e.type === 'gadget').length, 0);
});

test('ringing carries like gunfire: full range in the open, half through a wall', () => {
  const wall = { id: 'wall', kind: 'cabinet', x: 0, z: -11, w: 12, d: 0.4, h: 2.2 };
  const s = arena('clock', { furniture: [wall] });
  const near = spawn(s, { type: 'walker', x: 0, z: -12, state: 'asleep' }), far = spawn(s, { type: 'walker', x: 0, z: -14.5, state: 'asleep' });
  shootAt(s, 0, -8);
  const rang = run(s, 1.4).find(e => e.type === 'gadget');
  assert.deepEqual(rang.struck, [near.id]); assert.equal(far.awareness, 'asleep');
});

test('paint bucket: bursts exactly like a yarn grenade, where it stands', () => {
  const w = WEAPONS[GRENADE], s = arena('bucket');
  const close = spawn(s, { type: 'walker', x: 1.3, z: -8, state: 'asleep' }), away = spawn(s, { type: 'walker', x: 5, z: -8, state: 'asleep' });
  shootAt(s, 0, -8);
  const log = run(s, 1.4), boom = log.find(e => e.type === 'explode');
  assert.equal(boom.source, 'bucket'); assert.equal(boom.radius, w.blast); assert.deepEqual(boom.struck, [close.id]);
  assert.ok(close.hp < close.maxHp && close.tangle > w.tangle - 1.5); assert.equal(away.hp, away.maxHp); assert.equal(away.tangle, 0);
  // 同一个位置扔一颗手雷，掉的血一样
  const g = arena(null), twin = spawn(g, { type: 'walker', x: 1.3, z: -8, state: 'asleep' });
  g.balls.push({ ...throwBall(g), x: 0, y: GADGETS.bucket.h + 0.35, z: -8, vx: 0, vy: 0, vz: 0, age: 1.49 }); run(g, 0.2);
  assert.equal(twin.hp, close.hp);
  assert.equal(s.health, CONFIG.maxHealth, 'the player is never hurt by a gadget');
});
function throwBall(g) { assert.ok(throwGrenade(g, 0, { origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: -1 } })); return g.balls.pop(); }

test('spotlight: everything in its circle of light freezes, unhurt and none the wiser; cover and distance protect', () => {
  const G = GADGETS.spot, cover = { id: 'case', kind: 'case', x: -2, z: -8, w: 0.5, d: 2.0, h: 1.9 };
  const s = arena('spot', { furniture: [cover] });
  const lit = spawn(s, { type: 'walker', x: 2, z: -8, state: 'idle', heading: 0 }), armoured = spawn(s, { type: 'heavy', x: 0, z: -10.4, state: 'asleep' });
  const shaded = spawn(s, { type: 'walker', x: -3, z: -8, state: 'asleep' }), outside = spawn(s, { type: 'walker', x: 5, z: -8, state: 'asleep' });
  shootAt(s, 0, -8, 1.2);
  const flash = run(s, 1.4).find(e => e.type === 'gadget');
  assert.equal(flash.kind, 'spot'); assert.deepEqual(flash.struck.sort(), [lit.id, armoured.id].sort());
  assert.ok(lit.stun > G.stun - 1.5 && lit.stun <= G.stun); assert.ok(armoured.stun > 0 && armoured.stun <= G.stun * 0.6);
  assert.equal(shaded.stun, 0); assert.equal(outside.stun, 0);
  assert.equal(lit.hp, lit.maxHp); assert.equal(lit.awareness, 'idle'); assert.equal(armoured.awareness, 'asleep');
});

test('zipper stash: what is inside cannot be seen or taken until a ball opens the zip; then it lies at the foot of the wall', () => {
  const wall = { id: 'wall', kind: 'cabinet', x: 0, z: -3, w: 8, d: 0.4, h: 2.4 };
  const heart = { kind: 'heart', amount: 1, x: 2, z: -2.2, stash: { x: 2, z: -2.8 } };
  const s = arena(null, { furniture: [wall], pickups: [heart] });
  s.health = 2; s.player.x = 2; s.player.z = -2.2; run(s, 0.3);
  assert.equal(s.health, 2, 'standing on the spot does not pick up what is still zipped in'); assert.equal(s.pickups[0].hidden, true);
  s.player.x = -3; s.player.z = 3; shootAt(s, -2, -2.8, 1.1);
  assert.equal(run(s, 1.2).filter(e => e.type === 'stash').length, 0, 'a ball two metres along the wall does not open it');
  s.player.x = 2; shootAt(s, 2, -2.8, 1.1);
  const opened = run(s, 1.2).filter(e => e.type === 'stash');
  assert.equal(opened.length, 1); assert.deepEqual([opened[0].kind, opened[0].x, opened[0].z], ['heart', 2, -2.2]); assert.equal(s.pickups[0].hidden, false);
  s.player.z = -2.2; run(s, 0.3);
  assert.equal(s.health, 3); assert.equal(s.pickups[0].taken, true);
});

test('a bounce reports what the ball struck, so the scenery can react', () => {
  const sofa = { id: 'sofa', kind: 'sofa', x: 0, z: -2, w: 2.2, d: 1.0, h: 0.85, color: 0xb79c77 };
  const s = arena(null, { furniture: [sofa] });
  shootAt(s, 0, -1.5, 0.5);
  const bounce = run(s, 1).find(e => e.type === 'bounce' && e.solid);
  assert.deepEqual(bounce.solid, { id: 'sofa', kind: 'sofa', look: undefined, item: undefined, color: 0xb79c77 });
  assert.ok(Math.abs(bounce.nx) + Math.abs(bounce.ny) + Math.abs(bounce.nz) === 1);
});

test('no zombie type is left out of the lure and the freeze', () => {
  for (const type of Object.keys(ENEMY_TYPES)) {
    const a = arena('clock'), e = spawn(a, { type, x: 3, z: -6, state: 'idle', heading: 0 });
    shootAt(a, 0, -8); run(a, 1.4); assert.ok(e.lure, `${type} is lured`);
    const b = arena('spot'), f = spawn(b, { type, x: 2, z: -8, state: 'idle', heading: 0 });
    shootAt(b, 0, -8, 1.2); run(b, 1.4); assert.ok(f.stun > 0, `${type} is frozen`);
  }
});

console.log(`${checks} gadget checks passed`);
