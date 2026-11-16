// 任务制版本的逻辑检查：关卡数据、寻路、感知、武器数值、弹药、任务结算。
//   node scripts/tests/rongboy-mission.mjs
import assert from 'node:assert/strict';
import houseDef from '../../scenes/rongboy-mission/levels/house.js';
import { compileLevel, clearPath, freePoint, lineOfSight, routeTo, navRadius, roomAt, resolveBody } from '../../scenes/rongboy-mission/level.js';
import { createGame, spawn, fire, beginCharge, releaseCharge, step, consumeEvents, selectWeapon, startReload, emitNoise, ballDamage,
  missionStatus, aliveCount, cameraMove, CONFIG, WEAPONS, ENEMY_TYPES } from '../../scenes/rongboy-mission/game.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const run = (s, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 120); i++) step(s, 1 / 120, input); };
const EAST = Math.PI / 2, WEST = -Math.PI / 2, NORTH = Math.PI, SOUTH = 0;

// 一块空地：没有墙和家具，玩家在西侧朝东。
function flat(extra = {}) {
  return compileLevel({
    id: 'flat', name: 'flat', bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, height: 2.8, wallThickness: 0.2, doorHeight: 2.05,
    player: { x: -2, z: 0 }, mission: { type: 'clear' }, rooms: [{ id: 'room', name: 'room', minX: -10, maxX: 10, minZ: -10, maxZ: 10 }],
    walls: [], furniture: [], enemies: [], pickups: [], ...extra,
  });
}
function game(extra) { const s = createGame({ level: flat(extra) }); s.player.aimX = 1; s.player.aimZ = 0; return s; }
const house = compileLevel(houseDef);

// ---------- 关卡 ----------

test('walls split around doors; lintels stop balls but not bodies', () => {
  const lintels = house.solids.filter(b => b.kind === 'lintel'), walls = house.solids.filter(b => b.kind === 'wall');
  assert.equal(lintels.length, 8);
  assert.ok(walls.length >= 13);
  assert.ok(lintels.every(b => b.minY === 2.05 && !house.blockers.includes(b)));
  assert.ok(clearPath(house, { x: 0, z: 4 }, { x: 0, z: 2 }, 0.455), 'front door is wide enough for the widest zombie');
  assert.equal(clearPath(house, { x: 3, z: 4 }, { x: 3, z: 2 }, 0.3), false, 'facade is solid away from the doors');
});

test('every spawn, pickup and the player start are on free floor inside a named room', () => {
  assert.ok(freePoint(house, house.player.x, house.player.z, CONFIG.playerRadius));
  for (const e of house.enemies) {
    const r = ENEMY_TYPES[e.type].radius;
    assert.ok(freePoint(house, e.x, e.z, r), `${e.type} at ${e.x},${e.z} overlaps something`);
    for (const [x, z] of e.patrol || []) {
      assert.ok(freePoint(house, x, z, r), `patrol point ${x},${z} blocked`);
      assert.ok(clearPath(house, e, { x, z }, r) || e.patrol.some(([a, b]) => clearPath(house, { x: a, z: b }, { x, z }, r)), 'patrol leg is walkable');
    }
    assert.ok(roomAt(house, e.x, e.z));
  }
  for (const k of house.pickups) assert.ok(freePoint(house, k.x, k.z, CONFIG.playerRadius), `pickup at ${k.x},${k.z} blocked`);
  assert.equal(roomAt(house, 0, 10).id, 'garden');
  assert.equal(roomAt(house, -5, 0).id, 'living');
});

test('every zombie and pickup can be reached from the gate, for both body widths', () => {
  for (const e of house.enemies) {
    const r = navRadius(ENEMY_TYPES[e.type].radius);
    assert.ok(routeTo(house, e, house.player, r).length > 0, `${e.type} at ${e.x},${e.z} cannot reach the gate`);
  }
  for (const k of house.pickups) assert.ok(routeTo(house, house.player, k, navRadius(CONFIG.playerRadius)).length > 0);
  // 每个房间至少两个出口：堵住任意一扇门仍然连通（不会被堵在死角）。
  for (const [a, b] of [[{ x: -5, z: 0 }, { x: -3, z: -6 }], [{ x: 5, z: 0 }, { x: 5, z: -6 }], [{ x: 0, z: 0 }, { x: -5, z: 0 }]]) {
    assert.ok(routeTo(house, a, b, 0.455).length > 0);
  }
});

test('no hiding pockets: anywhere the player can stand, a zombie can get close enough to touch', () => {
  const small = navRadius(ENEMY_TYPES.walker.radius), reach = CONFIG.playerRadius + ENEMY_TYPES.walker.radius, step = 0.15;
  const stand = [], walk = [];
  for (let x = house.bounds.minX; x <= house.bounds.maxX; x += step) for (let z = house.bounds.minZ; z <= house.bounds.maxZ; z += step) {
    if (freePoint(house, x, z, small)) walk.push([x, z]);
    else if (freePoint(house, x, z, CONFIG.playerRadius)) stand.push([x, z]);
  }
  const pockets = stand.filter(([x, z]) => !walk.some(([a, b]) => Math.hypot(a - x, b - z) <= reach));
  assert.deepEqual(pockets.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`), []);
});

test('interior walls stop a woolball, an open doorway lets it through, the lintel is solid', () => {
  const shoot = (origin) => {
    const s = createGame({ level: house }); s.enemies = [];
    fire(s, 0, { origin, direction: { x: -1, y: 0, z: 0 } });
    let minX = origin.x;
    for (let i = 0; i < 60; i++) { step(s, 1 / 120); for (const b of s.balls) minX = Math.min(minX, b.x); }
    return minX;
  };
  assert.ok(shoot({ x: 0, y: 1.0, z: -2 }) > -1.5, 'solid wall');
  assert.ok(shoot({ x: 0, y: 1.0, z: -0.15 }) < -3, 'through the living-room door');
  assert.ok(shoot({ x: 0, y: 2.4, z: -0.15 }) > -1.5, 'above the door is solid');
});

test('outdoors a ball that flies up and out simply fades instead of bouncing off the sky', () => {
  const s = createGame({ level: house }); s.enemies = [];
  fire(s, 0, { origin: { x: 0, y: 1.2, z: 6 }, direction: { x: 0, y: 1, z: 0 } });
  run(s, 1);
  const end = consumeEvents(s).find(e => e.type === 'ball-expired');
  assert.equal(end?.reason, 'sky');
});

// ---------- 感知 ----------

test('a sleeping zombie ignores a distant player and wakes only when approached', () => {
  const s = game(); const e = spawn(s, { x: 4, z: 0, state: 'asleep', heading: WEST });
  run(s, 3);
  assert.equal(e.awareness, 'asleep');
  s.player.x = 4 - 1.2; run(s, 0.3);
  assert.equal(e.awareness, 'waking');
  run(s, CONFIG.wakeAsleep + 0.1);
  assert.equal(e.awareness, 'alert');
});

test('an awake zombie sees only what is in front of it, within range, and not through walls', () => {
  const behind = game(); const a = spawn(behind, { x: 3, z: 0, state: 'idle', heading: EAST });   // 背对玩家
  run(behind, 2); assert.equal(a.awareness, 'idle');
  const facing = game(); const b = spawn(facing, { x: 3, z: 0, state: 'idle', heading: WEST });
  run(facing, 0.3); assert.equal(b.awareness, 'waking');
  const far = game(); const c = spawn(far, { x: 7, z: 0, state: 'idle', heading: WEST });        // 9 米外
  run(far, 2); assert.equal(c.awareness, 'idle');
  const wall = { walls: [{ x: 1, z: [-10, 10], doors: [[5, 6.5]] }] };
  const blocked = game(wall); const d = spawn(blocked, { x: 3, z: 0, state: 'idle', heading: WEST });
  run(blocked, 2); assert.equal(d.awareness, 'idle');
  assert.equal(lineOfSight(blocked.level, blocked.player, d), false);
});

test('gunfire carries: full radius in the open, half through a wall', () => {
  const open = game(); const near = spawn(open, { x: 4, z: 0, state: 'asleep' }), distant = spawn(open, { x: 8.5, z: 0, state: 'asleep' });
  emitNoise(open, -2, 0, 7);
  assert.equal(near.awareness, 'waking'); assert.equal(distant.awareness, 'asleep');
  const walled = game({ walls: [{ x: 1, z: [-10, 10], doors: [] }] });
  const close = spawn(walled, { x: 1.2, z: 0, state: 'asleep' }), muffled = spawn(walled, { x: 3, z: 0, state: 'asleep' });
  emitNoise(walled, -2, 0, 7);
  assert.equal(close.awareness, 'waking', 'within half radius'); assert.equal(muffled.awareness, 'asleep', 'beyond half radius behind a wall');
  // 开枪本身就会发出声音，越大的枪传得越远。
  assert.ok(WEAPONS[0].noise < WEAPONS[1].noise && WEAPONS[1].noise < WEAPONS[2].noise);
});

test('an alerted zombie calls nearby friends it can see, after a reaction delay', () => {
  const s = game(); s.player.x = -9;
  const a = spawn(s, { x: 0, z: 0, state: 'asleep' }), friend = spawn(s, { x: 3, z: 0, state: 'asleep' }), loner = spawn(s, { x: 0, z: 8, state: 'asleep' });
  emitNoise(s, 0.5, 0, 1);
  assert.equal(a.awareness, 'waking'); assert.equal(friend.awareness, 'asleep');
  run(s, CONFIG.wakeAsleep + 0.2);
  assert.equal(a.awareness, 'alert'); assert.equal(friend.awareness, 'waking'); assert.equal(loner.awareness, 'asleep');
  assert.ok(consumeEvents(s).some(e => e.type === 'alert' && e.id === a.id));
});

test('only alerted zombies hurt on contact; a sleeper is just a soft obstacle', () => {
  const s = game(); const e = spawn(s, { x: -1.6, z: 0, state: 'asleep' });
  step(s, 1 / 120);
  assert.equal(s.health, CONFIG.maxHealth);
  assert.ok(Math.hypot(s.player.x - e.x, s.player.z - e.z) >= CONFIG.playerRadius + e.radius - 0.05, 'bodies are pushed apart');
  e.awareness = 'alert'; s.player.x = e.x - 0.3; step(s, 1 / 120);
  assert.equal(s.health, CONFIG.maxHealth - 1);
  step(s, 1 / 120); assert.equal(s.health, CONFIG.maxHealth - 1, 'invulnerability window');
});

// ---------- 武器 ----------

const shootAt = (s, e) => { assert.equal(fire(s), true); run(s, 0.6); return e; };
// 警觉的僵尸始终面朝玩家，所以要打它后背得让球从它身后飞来（实战里靠反弹或绕后）。
const shootFromBehind = (s, e) => { assert.equal(fire(s, 0, { origin: { x: e.x + 1.2, y: 0.8, z: e.z }, direction: { x: -1, y: 0, z: 0 } }), true); run(s, 0.6); return e; };

test('weapons deal different damage, and it falls off with distance', () => {
  for (const [index, expected] of [[0, 2], [2, 5]]) {
    const s = game(); selectWeapon(s, index);
    const e = spawn(s, { x: 0.5, z: 0, heading: WEST }); shootAt(s, e);
    assert.equal(e.maxHp - e.hp, expected, WEAPONS[index].id);
  }
  const s = game(); selectWeapon(s, 1);
  const e = spawn(s, { x: -0.6, z: 0, heading: WEST }); shootAt(s, e);
  assert.ok(e.maxHp - e.hp >= 4, 'point-blank scatter lands at least two balls');
  for (const w of WEAPONS) {
    const b = { damage: w.damage, minDamage: w.minDamage, range: w.range };
    assert.equal(ballDamage({ ...b, travel: w.range }), w.damage);
    assert.equal(ballDamage({ ...b, travel: w.range * 2 }), w.minDamage);
    assert.ok(ballDamage({ ...b, travel: w.range * 1.5 }) <= w.damage);
  }
  assert.ok(WEAPONS[1].range < WEAPONS[0].range && WEAPONS[0].range < WEAPONS[2].range, 'scatter is short, cannon is long');
});

test('a ball fades once it has flown past its maximum range', () => {
  const s = createGame({ level: flat({ bounds: { minX: -40, maxX: 40, minZ: -10, maxZ: 10 }, player: { x: -38, z: 0 } }) });
  selectWeapon(s, 1); fire(s, 0, { origin: { x: -38, y: 1.5, z: 0 }, direction: { x: 1, y: 0.12, z: 0 } });
  let reason = null, farthest = -38;
  for (let i = 0; i < 400 && !reason; i++) { step(s, 1 / 120); for (const b of s.balls) farthest = Math.max(farthest, b.x); reason = consumeEvents(s).find(e => e.type === 'ball-expired')?.reason; }
  assert.ok(reason === 'range' || reason === 'bounce-limit');
  assert.ok(farthest + 38 <= WEAPONS[1].maxRange + 0.2);
});

test('a hit from behind doubles, an unaware target doubles again, and they stack', () => {
  const front = game(); const a = spawn(front, { x: 0.5, z: 0, heading: WEST }); shootAt(front, a);
  assert.equal(a.hp, 4);
  const back = game(); const b = spawn(back, { x: 0.5, z: 0, heading: WEST }); shootFromBehind(back, b);
  assert.equal(b.hp, 2); assert.equal(back.backHits, 1);
  const sneak = game(); const c = spawn(sneak, { x: 0.5, z: 0, heading: WEST, state: 'asleep' }); shootAt(sneak, c);
  assert.equal(c.hp, 2); assert.equal(sneak.sneakHits, 1);
  assert.notEqual(c.awareness, 'asleep', 'being shot wakes it');
  const both = game(); const d = spawn(both, { x: 0.5, z: 0, heading: EAST, state: 'idle' }); shootAt(both, d);
  assert.equal(d.alive, false, 'one quiet shot in the back topples a basic zombie');
  assert.ok(consumeEvents(both).some(e => e.type === 'hit' && e.back && e.sneak && e.amount === 6));
});

test('the quilt-armoured zombie shrugs off frontal hits and must be flanked', () => {
  const front = game(); const a = spawn(front, { type: 'heavy', x: 0.6, z: 0, heading: WEST }); shootAt(front, a);
  assert.equal(a.maxHp - a.hp, 1);
  const back = game(); const b = spawn(back, { type: 'heavy', x: 0.6, z: 0, heading: WEST }); shootFromBehind(back, b);
  assert.equal(b.maxHp - b.hp, 4);
  const cannon = game(); selectWeapon(cannon, 2); const c = spawn(cannon, { type: 'heavy', x: 0.6, z: 0, heading: WEST }); shootAt(cannon, c);
  assert.equal(c.maxHp - c.hp, 2);
});

test('each weapon has its own ricochet budget', () => {
  for (const [index, w] of WEAPONS.entries()) {
    const s = createGame({ level: flat({ bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }, player: { x: 0, z: 0 } }) });
    selectWeapon(s, index); fire(s, 0, { origin: { x: 0, y: 1.2, z: 0 }, direction: { x: 1, y: 0, z: 0.3 } });
    let end = null;
    for (let i = 0; i < 600 && !end; i++) { step(s, 1 / 120); end = consumeEvents(s).find(e => e.type === 'ball-expired'); }
    assert.equal(end.reason, 'bounce-limit', w.id);
    assert.equal(end.bounces, w.bounces + 1, `${w.id} rebounds ${w.bounces} times and bursts on the next contact`);
  }
});

test('magazines empty, reload takes time, reserves run out, and the starter gun never does', () => {
  const s = game();
  for (let i = 0; i < 6; i++) { assert.equal(fire(s), true); run(s, WEAPONS[0].cooldown + 0.02); }
  assert.equal(s.ammo[0].mag, 0); assert.equal(s.reloading, true, 'auto reload when empty');
  assert.equal(fire(s), false); assert.equal(beginCharge(s), false);
  run(s, WEAPONS[0].reload + 0.05);
  assert.equal(s.ammo[0].mag, 6); assert.equal(s.ammo[0].reserve, Infinity);

  selectWeapon(s, 2);
  assert.equal(fire(s), true); run(s, WEAPONS[2].cooldown + WEAPONS[2].reload + 0.1);
  assert.deepEqual(s.ammo[2], { mag: 1, reserve: 0 });
  assert.equal(fire(s), true); run(s, 1);
  assert.equal(s.reloading, false); consumeEvents(s);
  assert.equal(fire(s), false);
  assert.ok(consumeEvents(s).some(e => e.type === 'dry'));

  selectWeapon(s, 1); fire(s); run(s, 0.6);
  assert.equal(startReload(s), true); run(s, 0.5); selectWeapon(s, 0);
  assert.equal(s.reloading, false); selectWeapon(s, 1);
  assert.equal(s.ammo[1].mag, 1, 'switching away cancels a reload');
  assert.equal(startReload(s), true); run(s, WEAPONS[1].reload + 0.05);
  assert.deepEqual(s.ammo[1], { mag: 2, reserve: 3 });
});

test('charging still works: one bigger, harder-hitting ball on release', () => {
  const s = game(); const e = spawn(s, { x: 0.5, z: 0, heading: WEST });
  assert.equal(beginCharge(s), true); run(s, 1); assert.equal(s.shots, 0);
  assert.equal(releaseCharge(s), true);
  assert.equal(s.balls.length, 1); assert.ok(s.balls[0].r > 0.2);
  run(s, 0.5);
  assert.equal(e.maxHp - e.hp, WEAPONS[0].damage + WEAPONS[0].chargeDamage);
});

// ---------- 拾取与任务 ----------

test('pickups: ammo goes to the right reserve, a heart is left alone at full health', () => {
  const s = game({ pickups: [{ kind: 'ammo', weapon: 'heavy', amount: 2, x: -2, z: 0 }, { kind: 'heart', amount: 1, x: -2, z: 0.2 }] });
  step(s, 1 / 120);
  assert.equal(s.ammo[2].reserve, 3); assert.equal(s.pickups[0].taken, true); assert.equal(s.pickups[1].taken, false);
  s.health = 1; step(s, 1 / 120);
  assert.equal(s.health, 2); assert.equal(s.pickups[1].taken, true);
});

test('clear mission: ends only when every zombie is down, and nothing ever respawns', () => {
  const s = game();
  const a = spawn(s, { x: 0.5, z: 0, heading: EAST, state: 'idle' }), b = spawn(s, { x: 0.5, z: 9, heading: EAST, state: 'asleep' });
  assert.deepEqual(missionStatus(s), { type: 'clear', alive: 2, total: 2, done: false });
  shootAt(s, a); assert.equal(a.alive, false); assert.equal(s.phase, 'playing');
  run(s, 10); assert.equal(s.phase, 'playing'); assert.equal(s.total, 2);
  b.heading = EAST; s.player.x = b.x - 2.5; s.player.z = b.z; b.awareness = 'asleep'; b.wake = 0;
  run(s, 0.4); shootAt(s, b); assert.equal(b.alive, false);
  run(s, CONFIG.endDelay + 0.2);
  assert.equal(s.phase, 'won'); assert.equal(s.stars, 3);
  const frozen = JSON.stringify({ ...s, level: null }); step(s, 0.05);
  assert.equal(JSON.stringify({ ...s, level: null }), frozen, 'state stops changing after the round ends');
});

test('fetch mission: grab the prize (which raises the alarm) and carry it back to the exit', () => {
  const s = game({
    mission: { type: 'fetch', alarm: true, exit: { minX: -10, maxX: -8, minZ: -1, maxZ: 1 } },
    pickups: [{ kind: 'objective', x: 2, z: 0 }],
  });
  const sleeper = spawn(s, { x: 6, z: 6, state: 'asleep' });
  s.player.x = -9; step(s, 1 / 120);
  assert.equal(missionStatus(s).done, false, 'standing at the exit without the prize does nothing');
  s.player.x = 2; step(s, 1 / 120);
  assert.equal(s.carrying, true); assert.equal(sleeper.awareness, 'waking');
  s.player.x = -9; run(s, CONFIG.endDelay + 0.2);
  assert.equal(s.phase, 'won');
});

test('three hits and the round is lost', () => {
  const s = game(); spawn(s, { x: -1.5, z: 0 });
  run(s, 12);
  assert.equal(s.phase, 'lost'); assert.equal(s.stars, 0); assert.equal(s.health, 0);
});

// ---------- 整关 ----------

test('standing at the gate is safe: nobody notices, nobody spawns', () => {
  const s = createGame({ level: house });
  assert.equal(s.total, 16);
  run(s, 60);
  assert.equal(s.enemies.length, 16); assert.equal(s.health, CONFIG.maxHealth);
  assert.ok(s.enemies.every(e => e.awareness === 'asleep' || e.awareness === 'idle'), 'the gate hedge hides the start');
  const patrol = s.enemies[0];
  assert.ok(Math.abs(patrol.z - 5.5) < 0.2 && patrol.x > -4.8 && patrol.x < 3.8, 'the garden patrol keeps to its beat');
});

test('once roused, the whole house finds its way to the player without getting stuck', () => {
  const s = createGame({ level: house });
  for (const e of s.enemies) e.awareness = 'alert';
  s.health = 1e9;
  run(s, 75);
  const lost = s.enemies.filter(e => Math.hypot(e.x - s.player.x, e.z - s.player.z) > 4.5);
  assert.deepEqual(lost.map(e => `${e.type}@${e.x.toFixed(1)},${e.z.toFixed(1)}`), []);
  for (const e of s.enemies) {
    assert.ok(freePoint(house, e.x, e.z, e.radius - 0.02), `${e.type} ended inside a solid`);
    assert.ok(Number.isFinite(e.x + e.z + e.vx + e.vz));
  }
});

test('view-relative movement is unchanged', () => {
  const m = cameraMove(0, 1, 0); assert.ok(Math.abs(m.x) < 1e-9 && Math.abs(m.z + 1) < 1e-9);
  const body = { x: -1.5, z: -2, vx: 0, vz: 0 }; resolveBody(house, body, 0.3);
  assert.ok(Math.abs(body.x + 1.5) > 0.39, 'a body inside a wall is pushed out');
});

console.log(`${checks} mission checks passed`);
