// 玩法准则的检查（docs/fun-design.md 第 6 节）：枪表，和两个机器人。
//   node scripts/tests/rongboy-fun.mjs
// 枪表：每把枪对每种僵尸，从照面到击倒要几秒。断言"手枪什么都能打、什么都不是最快的""每把特殊枪有一件事比手枪快一倍以上"。
// 机器人：偷懒的只会后退加手枪；留神的会看预告（瞄准线变红就换方向、离开红圈、对盾用蓄力球）。
import assert from 'node:assert/strict';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame, spawn, step, fire, beginCharge, releaseCharge, selectWeapon, consumeEvents, aliveCount, CONFIG, WEAPONS, ENEMY_TYPES, PISTOL } from '../../scenes/rongboy-mission/game.js';
import { ATTACKS, attackCue } from '../../scenes/rongboy-mission/attacks.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const DT = 1 / 120, W = id => WEAPONS.findIndex(w => w.id === id);

// 一块空院子，中间几件掩体（留神的机器人不用它们，但箭和炸弹会被挡住，和正式地图一样）
function yard(extra = {}) {
  return compileLevel({
    id: 'fun', name: 'fun', bounds: { minX: -13, maxX: 13, minZ: -13, maxZ: 13 }, height: 3.2, wallThickness: 0.2, doorHeight: 2.3,
    player: { x: 0, z: 0 }, mission: { type: 'clear' }, rooms: [{ id: 'yard', name: 'yard', minX: -13, maxX: 13, minZ: -13, maxZ: 13, outdoor: true }],
    walls: [], furniture: [], enemies: [], pickups: [], arsenal: ['single'], ...extra,
  });
}
function arm(s, id) {
  const i = W(id); s.owned[i] = true; s.ammo[i] = { mag: WEAPONS[i].mag, reserve: id === 'single' ? Infinity : 999 }; selectWeapon(s, i);
}
// 朝一只僵尸的胸口开一枪。charge：按住多久再松（0 就是点射）。返回这一枪有没有打出去。
const aimAt = (s, e) => {
  const p = s.player, o = { x: p.x, y: p.y + 1.05, z: p.z }, t = { x: e.x, y: e.y + e.height * 0.55, z: e.z };
  const d = Math.hypot(t.x - o.x, t.y - o.y, t.z - o.z) || 1, dir = { x: (t.x - o.x) / d, y: (t.y - o.y) / d, z: (t.z - o.z) / d };
  return { origin: { x: o.x + dir.x * 0.5, y: o.y, z: o.z + dir.z * 0.5 }, direction: dir };
};

// ---------- 枪表 ----------

// 每种僵尸在它通常和你照面的距离上量：贴身的 3 米（拐角撞见、扑到跟前），弓手 10 米，炸弹客 7 米。
const MEET = { walker: 3, leaper: 3, heavy: 3, shielded: 3.4, archer: 10, bomber: 7 };
const GUNS = ['single', 'scatter', 'heavy', 'sewing', 'needle'];
// 这把枪该怎么用：缝纫机按住；毛衣针瞄稳了再放；手枪对盾要蓄力；其余点射
const hold = (gun, e) => gun === 'needle' ? CONFIG.chargeTime : gun === 'single' && e.type === 'shielded' && e.guardBroken <= 0 ? 0.56 : 0;
function ttk(gun, type, distance = MEET[type], count = 1) {
  const s = createGame({ level: yard() }); arm(s, gun);
  const foes = Array.from({ length: count }, (_, i) => spawn(s, { type, x: distance + (i % 2) * 0.9, z: (i - (count - 1) / 2) * 1.1, state: 'alert', heading: -Math.PI / 2 }));
  const w = WEAPONS[s.weapon]; let t = 0, held = false;
  s.health = 1e9;
  for (; t < 20 && foes.some(e => e.alive); t += DT) {
    const e = foes.filter(f => f.alive).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];   // 先打最近的
    const input = {};
    if (w.auto) { if (!s.trigger && !s.reloading) beginCharge(s); input.shot = aimAt(s, e); }
    else if (!held && s.cooldown <= 0 && !s.reloading) held = beginCharge(s);
    else if (held && s.charge >= hold(gun, e)) { releaseCharge(s, aimAt(s, e)); held = false; }
    step(s, DT, input);
  }
  return { time: foes.some(e => e.alive) ? Infinity : t, hurt: s.damageTaken };
}

const table = {};
for (const type of Object.keys(MEET)) { table[type] = {}; for (const gun of GUNS) table[type][gun] = ttk(gun, type); }
table.pack = {}; for (const gun of GUNS) table.pack[gun] = ttk(gun, 'walker', 4.5, 4);   // 一群：四只跳跳一起过来
const fmt = r => (r.time === Infinity ? '  打不倒' : r.time.toFixed(1).padStart(5) + ' 秒') + (r.hurt ? ` (挨${r.hurt}下)` : '        ');
console.log('\n从照面到击倒（括号里是这期间挨了几下）');
console.log('僵尸'.padEnd(8) + GUNS.map(g => WEAPONS[W(g)].short.padEnd(13)).join(''));
for (const [type, row] of Object.entries(table)) console.log((type === 'pack' ? '四只跳跳' : ENEMY_TYPES[type].name).padEnd(8) + GUNS.map(g => fmt(row[g]).padEnd(15)).join(''));
console.log('');

test('the pistol can put down every kind of zombie on its own', () => {
  for (const type of Object.keys(MEET)) assert.ok(table[type].single.time < 20, `${type} cannot be beaten with the pistol`);
});
test('the pistol is never the fastest answer to anything', () => {
  for (const [type, row] of Object.entries(table)) {
    const best = GUNS.slice().sort((a, b) => row[a].time - row[b].time)[0];
    assert.notEqual(best, 'single', `the pistol is the fastest gun against ${type}`);
  }
});
test('every special gun has a job at which it is at least twice as fast as the pistol', () => {
  const jobs = { scatter: ['walker', 'leaper'], heavy: ['shielded'], sewing: ['pack'], needle: ['heavy', 'archer'] };
  for (const [gun, types] of Object.entries(jobs)) for (const type of types) {
    assert.ok(table[type][gun].time * 2 <= table[type].single.time, `${gun} vs ${type}: ${table[type][gun].time.toFixed(2)}s, pistol ${table[type].single.time.toFixed(2)}s`);
  }
});
test('quilt armour shrugs off one-point hits from the front; the needle goes straight through', () => {
  const s = createGame({ level: yard() }); arm(s, 'sewing');
  const e = spawn(s, { type: 'heavy', x: 3, z: 0, state: 'alert', heading: -Math.PI / 2 });
  for (let i = 0; i < 60; i++) { if (!s.trigger) beginCharge(s); step(s, DT, { shot: aimAt(s, e) }); }
  assert.equal(e.hp, e.maxHp, 'buttons do not get through quilt armour from the front');
  assert.ok(table.heavy.needle.time < 1.2, 'one steadied needle drops it');
});

// ---------- 弓手 ----------

function archerDuel(move) {
  const s = createGame({ level: yard({ player: { x: 0, z: 0 } }) });
  const e = spawn(s, { type: 'archer', x: 0, z: -8, state: 'alert', heading: 0 }); e.actionCooldown = 0;
  let locked = false, flip = 1;
  for (let t = 0; t < 12; t += DT) {
    const now = !!attackCue(e)?.locked;
    if (now && !locked) flip = -flip;   // 瞄准线刚变红
    locked = now;
    step(s, DT, move(flip, s));
  }
  return s.damageTaken;
}
test('an archer hits someone who keeps walking the same way, and someone who backs straight off', () => {
  assert.ok(archerDuel(() => ({ x: 1, z: 0 })) >= 2, 'steady strafe');
  assert.ok(archerDuel(() => ({ x: 0, z: 1 })) >= 1, 'backing away in a straight line');
  assert.ok(archerDuel(() => ({})) >= 2, 'standing still');
});
test('changing direction when the aim line turns red dodges every arrow', () => {
  assert.equal(archerDuel(flip => ({ x: flip, z: 0 })), 0);
});
test('ranged attacks take turns: with three archers only one draws at a time, and shots are spaced out', () => {
  const s = createGame({ level: yard() });
  const foes = [-3, 0, 3].map(x => { const e = spawn(s, { type: 'archer', x, z: -8, state: 'alert', heading: 0 }); e.actionCooldown = 0; return e; });
  const shots = []; s.health = 1e9;
  for (let t = 0; t < 14; t += DT) {
    step(s, DT, {});
    assert.ok(foes.filter(e => e.action === 'archer-aim').length <= 1, 'two archers drawing at once');
    for (const ev of consumeEvents(s)) if (ev.type === 'enemy-shot') shots.push(s.time);
  }
  assert.ok(shots.length >= 4);
  for (let i = 1; i < shots.length; i++) assert.ok(shots[i] - shots[i - 1] >= 0.9 + ATTACKS.archer.windup - 0.01, `shots ${i - 1} and ${i} are ${(shots[i] - shots[i - 1]).toFixed(2)}s apart`);
});
test('a far-off pistol ball does not break an archer\'s draw; one from close by does', () => {
  const far = createGame({ level: yard() }), a = spawn(far, { type: 'archer', x: 10, z: 0, state: 'alert', heading: -Math.PI / 2 }); a.actionCooldown = 0;
  for (let t = 0; t < 0.4; t += DT) step(far, DT, {});
  assert.equal(a.action, 'archer-aim'); fire(far, 0, aimAt(far, a)); for (let t = 0; t < 0.9; t += DT) step(far, DT, {});
  assert.ok(a.hp < a.maxHp, 'it was hit'); assert.ok(consumeEvents(far).some(e => e.type === 'enemy-shot'), 'but still let fly');
  const near = createGame({ level: yard() }), b = spawn(near, { type: 'archer', x: 4, z: 0, state: 'alert', heading: -Math.PI / 2 }); b.actionCooldown = 0;
  for (let t = 0; t < 0.4; t += DT) step(near, DT, {});
  fire(near, 0, aimAt(near, b)); for (let t = 0; t < 0.9; t += DT) step(near, DT, {});
  assert.ok(consumeEvents(near).some(e => e.type === 'interrupted'));
});

// ---------- 机器人 ----------

// 阵容：都从 9 米外围上来（僵尸一开始就警觉，最不利的情况）
const OLD = ['walker', 'walker', 'walker', 'walker', 'leaper', 'leaper', 'leaper', 'heavy'];                   // 改之前正式地图里只有这三种
const NEW = ['walker', 'walker', 'walker', 'leaper', 'leaper', 'heavy', 'archer', 'archer', 'bomber', 'shielded'];
const COVER = [{ id: 'c1', kind: 'cabinet', x: -5, z: -4, w: 1.0, d: 3.0, h: 1.9 }, { id: 'c2', kind: 'cabinet', x: 5, z: 4, w: 1.0, d: 3.0, h: 1.9 }];
function arena(roster) {
  const s = createGame({ level: yard({ furniture: COVER }) });
  roster.forEach((type, i) => { const a = i / roster.length * Math.PI * 2 + 0.3, r = type === 'archer' ? 10.5 : 9; spawn(s, { type, x: Math.cos(a) * r, z: Math.sin(a) * r, state: 'alert', heading: Math.atan2(-Math.cos(a), -Math.sin(a)) }); });
  return s;
}
// attentive：是不是看预告。两个机器人都只用手枪，瞄得一样准；差别只在"看不看"。
function play(roster, attentive, seconds = 240) {
  const s = arena(roster), p = s.player, B = s.level.bounds;
  let held = false, strafe = 1, wasLocked = false;
  for (let t = 0; t < seconds && s.phase === 'playing'; t += DT) {
    const foes = s.enemies.filter(e => e.alive && e.enabled), near = foes.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    if (!near.length) { step(s, DT, {}); continue; }
    const e = near[0], dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
    // 走位：有贴身僵尸在 5.5 米内就背对着它退；贴到院墙就顺着墙滑
    let mx = 0, mz = 0;
    const melee = near.find(f => f.type !== 'archer' && f.type !== 'bomber');
    if (melee) { const ax = p.x - melee.x, az = p.z - melee.z, ad = Math.hypot(ax, az) || 1; if (ad < 5.5) { mx = ax / ad; mz = az / ad; } }
    const edge = 1.2, wallX = p.x < B.minX + edge ? 1 : p.x > B.maxX - edge ? -1 : 0, wallZ = p.z < B.minZ + edge ? 1 : p.z > B.maxZ - edge ? -1 : 0;
    if (wallX) { mx = Math.max(0, mx * wallX) * wallX; mz += strafe; } if (wallZ) { mz = Math.max(0, mz * wallZ) * wallZ; mx += strafe; }
    if (wallX && wallZ) { mx = wallX; mz = wallZ * 0.2; }
    if (attentive) {
      // 瞄准线变红：换个方向横着走
      const archer = foes.find(f => attackCue(f)?.locked), aiming = foes.find(f => f.action === 'archer-aim');
      if (archer && !wasLocked) strafe = -strafe;
      wasLocked = !!archer;
      const from = archer || aiming || (s.enemyShots.length ? { x: s.enemyShots[0].x, z: s.enemyShots[0].z } : null);
      if (from) { const ax = p.x - from.x, az = p.z - from.z, ad = Math.hypot(ax, az) || 1; mx += -az / ad * strafe * 1.4; mz += ax / ad * strafe * 1.4; }
      // 红圈：往圈外走
      for (const b of s.enemyBombs) { const bx = p.x - b.x, bz = p.z - b.z, bd = Math.hypot(bx, bz) || 1; if (bd < b.radius + 0.6) { mx += bx / bd * 3; mz += bz / bd * 3; } }
      for (const f of foes) { const cue = attackCue(f); if (cue?.kind === 'landing') { const bx = p.x - cue.target.x, bz = p.z - cue.target.z, bd = Math.hypot(bx, bz) || 1; if (bd < cue.radius + 0.6) { mx += bx / bd * 3; mz += bz / bd * 3; } } }
    }
    // 开枪：打最近的。留神的对盾用蓄力球；偷懒的一律点射
    const need = attentive && e.type === 'shielded' && e.guardBroken <= 0 ? 0.56 : 0;
    if (!held && s.cooldown <= 0 && !s.reloading) held = beginCharge(s);
    else if (held && s.charge >= need) { releaseCharge(s, aimAt(s, e)); held = false; }
    step(s, DT, { x: mx, z: mz });
  }
  return { won: s.phase === 'won', hurt: s.damageTaken, left: aliveCount(s), time: s.time };
}
const say = (name, r) => console.log(`  ${name}：${r.won ? '打完了' : r.left ? `倒下了，还剩 ${r.left} 只` : '没打完'} · 挨 ${r.hurt} 下 · ${r.time.toFixed(0)} 秒`);
const lazyOld = play(OLD, false), lazyNew = play(NEW, false), keenNew = play(NEW, true);
console.log('\n机器人（只用手枪）'); say('偷懒的，只有贴身僵尸', lazyOld); say('偷懒的，加上弓手、炸弹客、持盾者', lazyNew); say('留神的，同一个阵容', keenNew); console.log('');

test('backing off with the pistol is enough against touch-only zombies (this is why the old game played itself)', () => {
  assert.ok(lazyOld.won && lazyOld.hurt <= 1, JSON.stringify(lazyOld));
});
test('the same lazy play does not survive archers, bombers and a shield', () => {
  assert.ok(!lazyNew.won, JSON.stringify(lazyNew));
});
test('watching the telegraphs gets through the same fight with the same pistol', () => {
  assert.ok(keenNew.won && keenNew.hurt <= 2, JSON.stringify(keenNew));
});

console.log(`\n${checks} fun checks passed`);
