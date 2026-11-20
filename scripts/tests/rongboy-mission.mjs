// 任务制版本的逻辑检查：关卡数据、寻路、感知、武器数值、弹药、任务结算。
//   node scripts/tests/rongboy-mission.mjs
import assert from 'node:assert/strict';
import houseDef from '../../scenes/rongboy-mission/levels/house.js';
import { compileLevel, clearPath, freePoint, lineOfSight, routeTo, navRadius, roomAt, resolveBody, surfaceY, storeyAt, floorIndex, navGoal } from '../../scenes/rongboy-mission/level.js';
import { createGame, spawn, fire, beginCharge, releaseCharge, step, consumeEvents, selectWeapon, startReload, emitNoise, ballDamage,
  missionStatus, aliveCount, cameraMove, CONFIG, WEAPONS, ENEMY_TYPES, PISTOL, GRENADE, secondOf, grenades, swapWeapon, offeredWeapon, exchangeWeapon,
  beginThrow, releaseThrow, throwGrenade, beginJump } from '../../scenes/rongboy-mission/game.js';
import { LEVELS, ORDER } from '../../scenes/rongboy-mission/levels/index.js';
import { ATTACKS } from '../../scenes/rongboy-mission/attacks.js';

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
const SH = house.storeyHeight, FLOORS = house.storeys.length;
const storeyDefs = [houseDef, ...houseDef.upper];

// ---------- 关卡 ----------

test('walls split around doors; lintels stop balls but not bodies', () => {
  const lintels = house.walls.filter(b => b.kind === 'lintel'), walls = house.walls.filter(b => b.kind === 'wall');
  assert.equal(lintels.length, 8);
  assert.ok(walls.length >= 13);
  assert.ok(lintels.every(b => b.minY === 2.05 && !house.blockers.includes(b)));
  for (const S of house.storeys) assert.ok(S.walls.filter(b => b.kind === 'lintel').every(b => Math.abs(b.minY - S.y - 2.05) < 1e-9 && !S.blockers.includes(b)));
  assert.ok(clearPath(house, { x: 0, z: 4 }, { x: 0, z: 2 }, 0.455), 'front door is wide enough for the widest zombie');
  assert.equal(clearPath(house, { x: 3, z: 4 }, { x: 3, z: 2 }, 0.3), false, 'facade is solid away from the doors');
});

test('every spawn, pickup and the player start are on free floor inside a named room', () => {
  assert.ok(freePoint(house, house.player.x, house.player.z, CONFIG.playerRadius));
  for (const e of house.enemies) {
    const r = ENEMY_TYPES[e.type].radius, S = house.storeys[e.floor], where = `floor ${e.floor} ${e.type} at ${e.x},${e.z}`;
    assert.ok(freePoint(S, e.x, e.z, r), `${where} overlaps something`);
    for (const [x, z] of e.patrol || []) {
      assert.ok(freePoint(S, x, z, r), `${where}: patrol point ${x},${z} blocked`);
      assert.ok(clearPath(S, e, { x, z }, r) || e.patrol.some(([a, b]) => clearPath(S, { x: a, z: b }, { x, z }, r)), `${where}: patrol leg is not walkable`);
    }
    assert.ok(roomAt(S, e.x, e.z), where);
  }
  for (const k of house.pickups) assert.ok(freePoint(house.storeys[k.floor], k.x, k.z, CONFIG.playerRadius), `pickup on floor ${k.floor} at ${k.x},${k.z} blocked`);
  assert.equal(roomAt(house, 0, 10).id, 'garden');
  assert.equal(roomAt(house, -5, 0).id, 'living');
  assert.equal(roomAt(storeyAt(house, 2 * SH), 5, 0).id, 'treasure');
});

test('on every floor, every zombie and pickup can be reached from the stair mouth, for both body widths', () => {
  const mouth = { x: 0, z: house.stairs.outZ + 0.6 };
  for (const e of house.enemies) {
    const r = navRadius(ENEMY_TYPES[e.type].radius), from = e.floor ? mouth : house.player;
    assert.ok(routeTo(house.storeys[e.floor], e, from, r).length > 0, `floor ${e.floor} ${e.type} at ${e.x},${e.z} is cut off`);
  }
  for (const k of house.pickups) assert.ok(routeTo(house.storeys[k.floor], k.floor ? mouth : house.player, k, navRadius(CONFIG.playerRadius)).length > 0, `pickup on floor ${k.floor} at ${k.x},${k.z}`);
  // 每个房间至少两个出口：堵住任意一扇门仍然连通（不会被堵在死角）。
  for (const [a, b] of [[{ x: -5, z: 0 }, { x: -3, z: -6 }], [{ x: 5, z: 0 }, { x: 5, z: -6 }], [{ x: 0, z: 0 }, { x: -5, z: 0 }]]) {
    assert.ok(routeTo(house, a, b, 0.455).length > 0);
  }
  storeyDefs.forEach((def, floor) => {
    for (const r of def.rooms.filter(r => !r.outdoor && !r.tower)) {
      let doors = 0;
      for (const w of def.walls) {
        const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, lo = alongZ ? r.minZ : r.minX, hi = alongZ ? r.maxZ : r.maxX;
        if (![alongZ ? r.minX : r.minZ, alongZ ? r.maxX : r.maxZ].includes(line)) continue;
        doors += (w.doors || []).filter(([a, b]) => a >= lo && b <= hi).length;
      }
      assert.ok(doors >= 2, `floor ${floor} ${r.id} has ${doors} door(s)`);
    }
  });
  // 两跑楼梯都够最宽的僵尸走
  const t = house.stairs;
  for (const S of house.storeys) for (const x of [t.xA, t.xB]) {
    if ((S.index === 0 && x === t.xB) || (S.index === FLOORS - 1 && x === t.xA)) continue;   // 楼梯柜和顶层栏杆封住的口
    assert.ok(clearPath(S, { x, z: t.outZ }, { x, z: t.landZ }, 0.455), `floor ${S.index} lane at x=${x}`);
  }
});

test('no hiding pockets: anywhere the player can stand, a zombie can get close enough to touch', () => {
  const small = navRadius(ENEMY_TYPES.walker.radius), reach = CONFIG.playerRadius + ENEMY_TYPES.walker.radius, step = 0.15;
  for (const S of house.storeys) {
    const stand = [], walk = [];
    for (let x = S.bounds.minX; x <= S.bounds.maxX; x += step) for (let z = S.bounds.minZ; z <= S.bounds.maxZ; z += step) {
      if (freePoint(S, x, z, small)) walk.push([x, z]);
      else if (freePoint(S, x, z, CONFIG.playerRadius)) stand.push([x, z]);
    }
    const pockets = stand.filter(([x, z]) => !walk.some(([a, b]) => Math.hypot(a - x, b - z) <= reach));
    assert.deepEqual(pockets.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`), [], `floor ${S.index}`);
  }
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
  assert.equal(close.awareness, 'waking', 'within half radius');
  assert.notEqual(muffled.awareness, 'waking', 'beyond half radius behind a wall: not alerted (it may come to look, see below)');
  // 开枪本身就会发出声音，越大的枪传得越远。
  assert.ok(WEAPONS[0].noise < WEAPONS[1].noise && WEAPONS[1].noise < WEAPONS[2].noise);
});

test('gunfire a little too far to alert draws the awake ones over to look, the sleepers only from close by', () => {
  const s = game(); s.player.x = -9;
  const guard = spawn(s, { x: 9, z: 0, state: 'idle', heading: EAST }), sleeper = spawn(s, { x: 0, z: 6, state: 'asleep' }), deep = spawn(s, { x: 0, z: -9.5, state: 'asleep' });
  emitNoise(s, 0, 0, 5);   // 守卫 9 米、睡着的 6 米和 9.5 米：都超过 5 米，惊动不了；守卫在 2 倍以内，睡着的只有 6 米那只在 1.5 倍以内
  assert.equal(guard.awareness, 'idle'); assert.equal(guard.lure?.kind, 'noise', 'the guard comes to look');
  assert.equal(sleeper.awareness, 'idle', 'the near sleeper is stirred awake'); assert.equal(sleeper.lure?.kind, 'noise');
  assert.equal(deep.awareness, 'asleep'); assert.equal(deep.lure ?? null, null);
  assert.ok(consumeEvents(s).filter(e => e.type === 'search').length === 2);
  const from = Math.hypot(guard.x, guard.z);
  run(s, 9.5);
  assert.ok(Math.hypot(guard.x, guard.z) < 1.2 && from > 8, `walked over to where the shot was (${Math.hypot(guard.x, guard.z).toFixed(2)} m away now)`);
  assert.equal(guard.awareness, 'idle', 'nobody there, so it never noticed anything');
  run(s, 5);
  assert.equal(guard.lure, null, 'after a look round it gives up'); assert.ok(Math.hypot(guard.x, guard.z) < 1.5, 'and stays where it looked, not back at its post');
});

test('a zombie coming to look still has its eyes open, and a clock outranks gunfire', () => {
  const s = game(); s.player.x = -9; s.player.z = 0;
  const e = spawn(s, { x: 9, z: 0, state: 'idle', heading: EAST });
  emitNoise(s, 0, 0, 5);
  run(s, 1); assert.equal(e.lure?.kind, 'noise');
  s.player.x = 3; s.player.z = 0;   // 站到它的路上（它正朝西走过来）
  run(s, 0.6); assert.ok(e.awareness === 'waking' || e.awareness === 'alert', 'sees the player on the way');
  const c = game(); c.player.x = -9;
  const lured = spawn(c, { x: 9, z: 0, state: 'idle' }); lured.lure = { x: 9, z: 3, lookX: 9, lookZ: 4, until: 99, arrived: false };
  emitNoise(c, 0, 0, 5); assert.equal(lured.lure.kind, undefined, 'still watching the clock');
});

test('two chasers coming from the same side: the one behind swings round to the flank instead of queueing', () => {
  const s = game(); s.health = 1e9;
  const front = spawn(s, { x: 1.5, z: 0, state: 'alert', heading: WEST }), back = spawn(s, { x: 5, z: 0.1, state: 'alert', heading: WEST });
  run(s, 1.8);
  assert.ok(Math.abs(front.z) < 0.4, `the front one comes straight on (z ${front.z.toFixed(2)})`);
  assert.ok(Math.abs(back.z) > 0.6, `the one behind has moved off the line to the side (z ${back.z.toFixed(2)})`);
  const alone = game(); alone.health = 1e9; const solo = spawn(alone, { x: 5, z: 0.1, state: 'alert', heading: WEST });
  run(alone, 1.8); assert.ok(Math.abs(solo.z) < 0.4, 'a lone chaser just comes straight on');
});

test('a museum exhibit draws the nearer part of its floor; the last one draws that whole floor', () => {
  const L = compileLevel(LEVELS.museum), exhibits = L.pickups.filter(q => q.kind === 'objective');
  const first = exhibits[0], last = exhibits.at(-1), alarm = L.mission.alarm;
  const s = createGame({ level: L });
  const grab = (state, item) => {
    Object.assign(state.player, { x: item.x, y: item.y, z: item.z });
    step(state, 1 / 120);
  };
  grab(s, first);
  const ground = s.enemies.filter(e => e.floor === first.floor);
  const distance = e => Math.hypot(e.x - first.x, e.z - first.z);
  const ring = ground.filter(e => distance(e) > alarm + 1 && distance(e) < alarm * 2 - 1);
  const beyond = ground.filter(e => distance(e) > alarm * 2 + 1);
  assert.ok(s.collected === 1 && !s.carrying);
  assert.ok(ring.length && ring.every(e => e.lure?.kind === 'noise' && Math.hypot(e.lure.x - first.x, e.lure.z - first.z) < 0.01), 'within twice the alarm, guards come to where the exhibit was');
  assert.ok(beyond.length > 3 && beyond.every(e => !e.lure), 'the far side of the floor carries on as it was');
  assert.ok(s.enemies.filter(e => e.floor !== first.floor).every(e => !e.lure), 'the other floor does not investigate');

  const later = createGame({ level: L });
  later.collected = exhibits.length - 1;
  grab(later, last);
  const far = later.enemies.filter(e => e.floor === last.floor && Math.hypot(e.x - last.x, e.z - last.z) > alarm + 1);
  assert.ok(later.carrying && far.length && far.every(e => e.lure?.kind === 'noise'), 'with all three in hand, even far-away guards on the same floor come looking');
  assert.ok(later.enemies.filter(e => e.floor !== last.floor).every(e => !e.lure), 'the other floor stays out of the search on the way back');
});

test('upstairs gunfire does not send ground-floor zombies wandering', () => {
  const s = createGame({ level: house }), p = s.player;
  const up = s.enemies.find(e => e.floor === 1 && e.awareness === 'idle');
  const before = s.enemies.filter(e => e.floor === 0).map(e => e.lure ?? null);
  emitNoise(s, up.x, up.z, 20, SH + 0.76);
  assert.deepEqual(s.enemies.filter(e => e.floor === 0).map(e => e.lure ?? null), before);
  assert.ok(p);
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
  for (const [index, expected] of [[0, WEAPONS[0].damage], [2, Math.min(ENEMY_TYPES.walker.hp, WEAPONS[2].damage)]]) {   // 棉被炮一炮放倒跳跳
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
  assert.equal(c.maxHp - c.hp, Math.floor(WEAPONS[2].damage * ENEMY_TYPES.heavy.armor));
});

test('each weapon has its own ricochet budget', () => {
  for (const [index, w] of WEAPONS.entries()) {
    if (w.kind) continue;   // 电弧和手雷不是弹跳的毛球
    const s = createGame({ level: flat({ bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }, player: { x: 0, z: 0 } }) });
    s.owned[index] = true; selectWeapon(s, index); fire(s, 0, { origin: { x: 0, y: 1.2, z: 0 }, direction: { x: 1, y: 0, z: 0.3 } });
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

  selectWeapon(s, 2); s.ammo[2] = { mag: 1, reserve: 1 };   // 只剩两发
  assert.equal(fire(s), true); run(s, WEAPONS[2].cooldown + WEAPONS[2].reload + 0.1);
  assert.deepEqual(s.ammo[2], { mag: 1, reserve: 0 });
  consumeEvents(s); assert.equal(fire(s), true); run(s, 1);
  // 特殊枪彻底打空：自动换回手枪，不让人对着空枪按扳机
  assert.equal(s.reloading, false); assert.equal(s.weapon, 0, 'an empty special gun hands back to the pistol');
  assert.ok(consumeEvents(s).some(e => e.type === 'weapon' && e.weapon === 0));
  assert.equal(selectWeapon(s, 2), true); assert.equal(fire(s), false, 'still empty when picked again');
  assert.ok(consumeEvents(s).some(e => e.type === 'dry')); assert.equal(s.weapon, 0);

  s.ammo[1] = { mag: 2, reserve: 4 }; selectWeapon(s, 1); fire(s); run(s, 0.6);
  assert.equal(startReload(s), true); run(s, 0.5); selectWeapon(s, 0);
  assert.equal(s.reloading, false); selectWeapon(s, 1);
  assert.equal(s.ammo[1].mag, 1, 'switching away cancels a reload');
  assert.equal(startReload(s), true); run(s, WEAPONS[1].reload + 0.05);
  assert.deepEqual(s.ammo[1], { mag: 2, reserve: 3 });
});

test('switching to an empty magazine starts a timed reload without granting instant ammunition', () => {
  const s = game(); s.owned[1] = true; s.ammo[1] = { mag: 0, reserve: 3 };
  consumeEvents(s); assert.equal(selectWeapon(s, 1), true);
  assert.equal(s.reloading, true); assert.equal(s.reload, WEAPONS[1].reload);
  assert.deepEqual(s.ammo[1], { mag: 0, reserve: 3 });
  assert.equal(fire(s), false); assert.equal(beginCharge(s), false);
  assert.ok(consumeEvents(s).some(e => e.type === 'reload' && e.weapon === WEAPONS[1].id));
  run(s, WEAPONS[1].reload - .1); assert.equal(s.ammo[1].mag, 0);
  selectWeapon(s, 0); assert.equal(s.reloading, false);
  selectWeapon(s, 1); assert.equal(s.reload, WEAPONS[1].reload, 'switching does not skip reload time');
  run(s, WEAPONS[1].reload + .02); assert.deepEqual(s.ammo[1], { mag: 2, reserve: 1 });
  selectWeapon(s, 0); s.ammo[1].mag = 1; selectWeapon(s, 1);
  assert.equal(s.reloading, false, 'a usable magazine is not forcibly topped up on weapon switch');
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
  assert.equal(s.ammo[2].reserve, WEAPONS[2].reserve + 2); assert.equal(s.pickups[0].taken, true); assert.equal(s.pickups[1].taken, false);
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
  assert.equal(s.total, 36);
  run(s, 60);
  assert.equal(s.enemies.length, 36); assert.equal(s.health, CONFIG.maxHealth);
  assert.ok(s.enemies.every(e => e.awareness === 'asleep' || e.awareness === 'idle'), 'the gate hedge hides the start');
  const patrol = s.enemies[0];
  assert.ok(Math.abs(patrol.z - 5.5) < 0.2 && patrol.x > -4.8 && patrol.x < 3.8, 'the garden patrol keeps to its beat');
});

test('once roused, all three floors find their way down to the player without getting stuck', () => {
  const s = createGame({ level: house });
  for (const e of s.enemies) e.awareness = 'alert';
  s.health = 1e9;
  run(s, 150);
  // 弓手和炸弹客会停在自己的射程里，不贴上来
  const near = e => (e.type === 'archer' || e.type === 'bomber' ? ATTACKS[e.type].range : 6);
  const lost = s.enemies.filter(e => Math.hypot(e.x - s.player.x, e.z - s.player.z) > near(e) || e.base > 0.01);
  assert.deepEqual(lost.map(e => `${e.type}@${e.x.toFixed(1)},${e.base.toFixed(1)},${e.z.toFixed(1)}`), []);
  for (const e of s.enemies) {
    assert.ok(freePoint(house, e.x, e.z, e.radius - 0.02), `${e.type} ended inside a solid`);
    assert.ok(Number.isFinite(e.x + e.z + e.vx + e.vz + e.y));
  }
});

// ---------- 后四把武器 ----------

// 给一局空地加上指定的枪并换到手里。
function armed(id, extra) {
  const s = game(extra), index = WEAPONS.findIndex(w => w.id === id);
  s.owned[index] = true; s.ammo[index] = { mag: WEAPONS[index].mag, reserve: WEAPONS[index].reserve }; selectWeapon(s, index);   // 测试里直接塞到手上
  return s;
}
const aimEast = { origin: { x: -1.4, y: 0.9, z: 0 }, direction: { x: 1, y: 0, z: 0 } };

test('two guns in hand: the pistol stays, the other one is swapped on purpose, and the dropped gun keeps its ammo', () => {
  const s = game({ arsenal: ['single'], pickups: [{ kind: 'weapon', weapon: 'stun', amount: 4, x: 0, z: 0 }, { kind: 'weapon', weapon: 'stun', amount: 2, x: 3, z: 0 }, { kind: 'weapon', weapon: 'needle', amount: 6, x: 6, z: 0 }, { kind: 'ammo', x: 9, z: 0 }] });
  const stun = WEAPONS.findIndex(w => w.id === 'stun'), needle = WEAPONS.findIndex(w => w.id === 'needle');
  assert.equal(secondOf(s), -1); assert.equal(swapWeapon(s), false, 'nothing to swap to yet');
  assert.equal(selectWeapon(s, stun), false, 'not owned yet');
  s.player.x = 0; run(s, 0.1);
  assert.ok(s.owned[stun] && s.weapon === stun, 'the empty second slot takes it straight away');
  assert.deepEqual(s.ammo[stun], { mag: WEAPONS[stun].mag, reserve: 4 });
  assert.equal(swapWeapon(s), true); assert.equal(s.weapon, PISTOL); assert.equal(swapWeapon(s), true); assert.equal(s.weapon, stun);
  s.player.x = 3; run(s, 0.1);
  assert.equal(s.ammo[stun].reserve, 6, 'a second one of the same gun is just ammunition');
  // 另一把枪：走上去不会自动换
  s.player.x = 6; run(s, 0.1);
  assert.equal(secondOf(s), stun); assert.equal(s.pickups[2].taken, false); assert.equal(offeredWeapon(s), s.pickups[2]);
  fire(s, 0, { origin: { x: 6, y: 1.2, z: 5 }, direction: { x: 0, y: 0, z: 1 } }); const left = { ...s.ammo[stun] };
  assert.equal(exchangeWeapon(s), true);
  assert.equal(secondOf(s), needle); assert.equal(s.weapon, needle); assert.equal(s.owned[stun], false);
  assert.deepEqual(s.ammo[needle], { mag: WEAPONS[needle].mag, reserve: 6 });
  assert.deepEqual([s.pickups[2].weapon, s.pickups[2].mag, s.pickups[2].amount, s.pickups[2].taken], ['stun', left.mag, left.reserve, false], 'the old gun lies there with what was left in it');
  assert.equal(exchangeWeapon(s), true, 'and can be taken back');
  assert.deepEqual(s.ammo[stun], left); assert.equal(secondOf(s), stun);
  // 弹药包不记种类：补的是手里那把特殊枪
  s.player.x = 9; run(s, 0.1);
  assert.equal(s.ammo[stun].reserve, left.reserve + WEAPONS[stun].pack); assert.equal(s.pickups[3].taken, true);
  const bare = game({ arsenal: ['single'], pickups: [{ kind: 'ammo', x: 0, z: 0 }] }); bare.player.x = 0; run(bare, 0.1);
  assert.equal(bare.pickups[0].taken, false, 'with only the pistol an ammo pack stays on the floor');
});

test('the yarn grenade has its own key: it is thrown without leaving the gun in hand', () => {
  const s = game({ arsenal: ['single', 'scatter', 'yarn'] }), yarn = WEAPONS[GRENADE];
  assert.equal(grenades(s), yarn.mag + yarn.reserve); assert.equal(secondOf(s), 1);
  const before = grenades(s), mag = s.ammo[0].mag;
  assert.equal(beginThrow(s), true); run(s, 0.05); assert.equal(releaseThrow(s), true);
  assert.equal(s.weapon, 0); assert.equal(s.ammo[0].mag, mag, 'the pistol magazine is untouched');
  assert.equal(grenades(s), before - 1); assert.equal(s.balls.at(-1).weapon, 'yarn');
  assert.equal(beginThrow(s), false, 'a short pause between throws'); run(s, yarn.cooldown + 0.05);
  // 换弹的时候也能扔
  for (let i = 0; i < 6; i++) { fire(s); run(s, WEAPONS[0].cooldown + 0.02); }
  assert.equal(s.reloading, true); assert.equal(throwGrenade(s), true); assert.equal(grenades(s), before - 2);
  run(s, 2); consumeEvents(s);
  assert.equal(beginThrow(s), false); assert.ok(consumeEvents(s).some(e => e.type === 'dry' && e.weapon === 'yarn'));
  const none = game({ arsenal: ['single'], pickups: [{ kind: 'ammo', weapon: 'yarn', amount: 1, x: 0, z: 0 }] });
  assert.equal(grenades(none), 0); none.player.x = 0; run(none, 0.1); assert.equal(grenades(none), 1);
  // 正式地图：开局都是手枪加一把，外加手雷
  for (const id of ORDER) {
    const g = createGame({ level: compileLevel(LEVELS[id]) }), guns = g.owned.map((o, i) => o && WEAPONS[i].id).filter(Boolean);
    assert.deepEqual(guns, ['single', 'scatter', 'yarn', 'jack'], id);
  }
});


test('static gun: a travelling, widening net freezes zombies it crosses and cannot cross cover', () => {
  const s = armed('stun'), w = WEAPONS[s.weapon];
  const a = spawn(s, { x: 2, z: 0 }), b = spawn(s, { x: 3.6, z: 0.8 }), c = spawn(s, { x: 5.2, z: 0 }), far = spawn(s, { x: 9, z: 6 });
  assert.ok(fire(s, 0, aimEast));
  assert.ok(a.stun===0 && s.nets.length===1, 'the projectile must reach the target');
  run(s,.46);
  const zapEvent = consumeEvents(s).find(e => e.type === 'zap');
  assert.deepEqual(zapEvent.struck, [a.id, b.id, c.id], 'one widening net catches three targets');
  assert.ok(a.stun > 2 && b.stun > 2 && c.stun > 2 && far.stun === 0);
  assert.equal(a.hp, a.maxHp - 1, 'barely any damage');
  const before = { x: a.x, z: a.z };
  s.player.x = a.x - 0.5; s.player.z = a.z;
  run(s, 1.5);
  assert.ok(Math.hypot(a.x - before.x, a.z - before.z) < 0.35, 'it stays put while stunned');
  assert.equal(s.health, CONFIG.maxHealth, 'and does not hurt on contact');
  run(s, 2.5);
  assert.ok(a.stun === 0 && s.health < CONFIG.maxHealth, 'the stun wears off');
  // 电弧被墙挡住；棉甲定身时间短；被电住时挨打算偷袭
  const walled = armed('stun', { furniture: [{ id: 'wall', kind: 'cabinet', x: 0, z: 0, w: 0.4, d: 3, h: 2.4 }] });
  const hidden = spawn(walled, { x: 2, z: 0 });
  fire(walled, 0, aimEast);run(walled,.35);
  assert.equal(hidden.stun, 0);
  const t = armed('stun'), heavy = spawn(t, { type: 'heavy', x: 2, z: 0, heading: WEST });
  fire(t, 0, aimEast);run(t,.2);
  assert.ok(heavy.stun > 1 && heavy.stun < w.stun * 0.7);
  selectWeapon(t, 0); run(t, 0.6); consumeEvents(t);   // 等静电枪的冷却过去，棉甲还定着
  assert.ok(heavy.stun > 0.5);
  const hp = heavy.hp; shootAt(t, heavy);
  assert.equal(hp - heavy.hp, 2, 'front armour halves the pistol to 1, the stun doubles it back');
});

test('sewing machine gun: holding the trigger fires a stream until the magazine runs dry', () => {
  const s = armed('sewing'), w = WEAPONS[s.weapon];
  const e = spawn(s, { type: 'walker', x: 3, z: 0, heading: EAST });   // 不用棉甲：小纽扣从正面打不动它（见 rongboy-fun.mjs）
  e.hp = e.maxHp = 99;
  assert.ok(beginCharge(s));
  run(s, 1);
  assert.ok(s.shots >= 10 && s.shots <= 12, `about ${Math.round(1 / w.cooldown)} shots a second (${s.shots})`);
  assert.ok(e.hp < 99 - 6, 'most of them land at three metres');
  releaseCharge(s); const fired = s.shots;
  run(s, 0.5);
  assert.equal(s.shots, fired, 'letting go stops it');
  beginCharge(s); run(s, 4);
  assert.ok(s.shots > w.mag, 'it reloads by itself and carries on');
  assert.ok(s.ammo[s.weapon].reserve < w.reserve);
  const dirs = new Set(s.balls.map(b => b.dz.toFixed(3)));
  assert.ok(dirs.size > 1 || s.balls.length < 2, 'the stream has some spread');
});

test('knitting needle: flies straight, goes through three zombies in a row and stops in the wall', () => {
  const s = armed('needle'), w = WEAPONS[s.weapon];
  const row = [2, 3.2, 4.4, 5.6].map(x => spawn(s, { x, z: 0, state: 'idle', heading: EAST }));
  fire(s, 0, aimEast);
  let y = [];
  for (let i = 0; i < 60; i++) { step(s, 1 / 120); for (const b of s.balls) y.push(b.y); }
  assert.deepEqual(row.map(e => e.maxHp - e.hp > 0), [true, true, true, false], `pierce ${w.pierce} then stop`);
  assert.ok(row[0].alive === false, 'back + unaware: one needle is enough');
  assert.ok(Math.max(...y) - Math.min(...y) < 0.02, 'no drop');
  const t = armed('needle'); spawn(t, { x: 8, z: 8 });
  fire(t, 0, aimEast); run(t, 1);
  const end = consumeEvents(t).filter(e => e.type === 'ball-expired');
  assert.equal(end.length, 1); assert.ok(end[0].x > 9.5, 'it reaches the far wall and stays there');
  // 蓄满（举枪瞄准）伤害更高
  const c = armed('needle'), target = spawn(c, { x: 6, z: 0, heading: WEST });
  target.hp = target.maxHp = 99; c.health = 1e9;
  fire(c, 0, aimEast); run(c, 0.8);
  assert.equal(99 - target.hp, w.damage, 'a quick shot');
  beginCharge(c); run(c, CONFIG.chargeTime + 0.05); releaseCharge(c, aimEast); run(c, 0.3);
  assert.equal(99 - target.hp, w.damage * 2 + w.chargeDamage, 'an aimed one hits harder');
});

test('steamer: bounces, bursts after its fuse, hurts and tangles what it can see', () => {
  const s = game({ arsenal:['single','yarn'], furniture: [{ id: 'wall', kind: 'cabinet', x: 4.0, z: 0, w: 0.4, d: 2, h: 2.4 }] }), w = WEAPONS[GRENADE];
  const near = spawn(s, { x: 2.0, z: 0.9 }), edge = spawn(s, { x: 3.2, z: -1.8 }), hidden = spawn(s, { x: 4.8, z: 0 }), far = spawn(s, { x: 8, z: -6 });
  for (const e of [near, edge, hidden, far]) e.awareness = 'idle';
  throwGrenade(s, 0, { origin: { x: -1.4, y: 1.0, z: 0 }, direction: { x: 1, y: 0.1, z: 0 } });
  run(s, w.fuse - 0.1);
  assert.equal(s.balls.length, 1, 'still rolling');
  assert.ok(s.bounces >= 1);
  run(s, 0.3);
  const boom = consumeEvents(s).find(e => e.type === 'explode');
  assert.ok(boom && s.balls.length === 0);
  assert.ok(Math.hypot(boom.x - near.x, boom.z - near.z) < w.blast);
  assert.ok(near.maxHp - near.hp >= w.minDamage && near.tangle > 3, 'caught in the blast');
  assert.equal(hidden.hp, hidden.maxHp, 'the cabinet shields what is behind it');
  assert.ok(far.hp === far.maxHp && far.tangle === 0);
  // 被缠住的走得慢
  const slow = game(), fast = game();
  const a = spawn(slow, { x: 6, z: 0 }), b = spawn(fast, { x: 6, z: 0 });
  a.tangle = 3; run(slow, 2); run(fast, 2);
  assert.ok(6 - a.x < (6 - b.x) * 0.5, `tangled ${(6 - a.x).toFixed(2)} m vs free ${(6 - b.x).toFixed(2)} m`);
  // 直接砸中：不等引信
  const direct = game({arsenal:['single','yarn']}), hit = spawn(direct, { x: 1.2, z: 0 });
  throwGrenade(direct, 0, aimEast); run(direct, 0.4);
  assert.ok(hit.hp < hit.maxHp && direct.balls.length === 0);
});

// ---------- 楼层与楼梯 ----------

// 沿着折返楼梯把玩家从 from 层走到 to 层，返回用时（秒）；走不到就断言失败。
function climb(s, to) {
  const p = s.player, target = { x: 0, y: to * SH, z: -6 };
  for (let i = 0; i < 120 * 40; i++) {
    if (Math.abs(p.y - target.y) < 0.01 && p.z > house.stairs.mouthZ + 0.3) return i / 120;
    const g = navGoal(house, { x: p.x, z: p.z, base: p.y }, target), dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz) || 1;
    step(s, 1 / 120, { x: dx / d, z: dz / d });
  }
  assert.fail(`player stuck at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} on the way to floor ${to}`);
}

test('the stairs carry the player up floor by floor and back down, height changing smoothly', () => {
  const s = createGame({ level: house }); s.enemies = [];
  const p = s.player; p.x = 0; p.z = -6;
  let last = p.y, jump = 0;
  const watch = (to) => { const t = climb(s, to); return t; };
  const original = step;
  for (const to of [1, 2, 1, 0]) {
    const before = p.y, t = watch(to);
    assert.ok(Math.abs(p.y - to * SH) < 0.01, `arrived on floor ${to}`);
    assert.ok(t > 2 && t < 12, `one storey takes a few seconds (${t.toFixed(1)}s from ${before})`);
  }
  // 高度连续：一步之内不会跳变超过几厘米
  p.x = 0; p.z = -6; p.y = 0;
  for (let i = 0; i < 120 * 12; i++) {
    const g = navGoal(house, { x: p.x, z: p.z, base: p.y }, { x: 0, y: 2 * SH, z: -6 }), dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz) || 1;
    step(s, 1 / 120, { x: dx / d, z: dz / d });
    jump = Math.max(jump, Math.abs(p.y - last)); last = p.y;
  }
  assert.ok(jump < 0.05, `largest height step ${jump.toFixed(3)}`);
  assert.equal(floorIndex(house, p.y), 2);
});

test('the ground-floor cupboard and the attic railing close the two dead-end stair mouths', () => {
  const t = house.stairs, s = createGame({ level: house }); s.enemies = [];
  const p = s.player; p.x = t.xB; p.z = t.outZ; p.y = 0;
  run(s, 2, { x: 0, z: -1 });
  assert.ok(p.z > t.mouthZ && p.y === 0, 'cannot walk in under the upper flight');
  p.x = t.xA; p.z = t.outZ; p.y = 2 * SH;
  run(s, 2, { x: 0, z: -1 });
  assert.ok(p.z > t.mouthZ && Math.abs(p.y - 2 * SH) < 1e-9, 'cannot step off the attic into the stairwell');
  assert.equal(surfaceY(house, 5, 8, 0), 0, 'the garden has no upper floors');
  assert.equal(surfaceY(house, 5, 0, 3.1), SH);
});

test('floors separate what happens on them: no sight, touch, pickup or woolball through a slab', () => {
  const s = createGame({ level: house }); s.enemies = [];
  const p = s.player; p.x = 5; p.z = 0; p.y = 0;
  const above = spawn(s, { x: 5, z: 0.2, state: 'idle', heading: 0, floor: 1 });
  run(s, 3);
  assert.equal(above.awareness, 'idle', 'a zombie directly overhead does not notice');
  above.awareness = 'alert'; run(s, 0.5);
  assert.equal(s.health, CONFIG.maxHealth, 'and cannot touch the player through the floor');
  assert.equal(lineOfSight(house, { x: 5, y: 1.2, z: 0 }, { x: 5, y: SH + 1.2, z: 0 }), false);
  s.enemies = [];
  fire(s, 0, { origin: { x: 5, y: 1.2, z: 0 }, direction: { x: 0, y: 1, z: 0 } });
  let top = 0; for (let i = 0; i < 240; i++) { step(s, 1 / 120); for (const b of s.balls) top = Math.max(top, b.y); }
  assert.ok(top < house.height, `a ball fired at the ceiling stays under it (${top.toFixed(2)})`);
  const prize = s.pickups.find(k => k.kind === 'objective');
  p.x = prize.x; p.z = prize.z; p.y = 0; run(s, 0.2);
  assert.equal(prize.taken, false, 'the prize is two floors up');
  p.y = 2 * SH; run(s, 0.2);
  assert.equal(prize.taken, true);
});

test('gunfire upstairs is muffled downstairs', () => {
  const s = createGame({ level: house });
  s.player.x = 0; s.player.z = 0; s.player.y = 2 * SH;
  const calm = () => s.enemies.filter(e => e.base < 0.5 && e.awareness !== 'asleep' && e.awareness !== 'idle').length;
  emitNoise(s, 0, 0, 12, 2 * SH + 1.2);
  assert.equal(calm(), 0, 'nobody on the ground floor hears a shot fired in the attic');
  assert.ok(s.enemies.some(e => e.base > 5 && e.awareness === 'waking'), 'the attic does');
});

test('a roused zombie from the attic walks down two flights to reach the player in the garden', () => {
  const s = createGame({ level: house }); s.enemies = []; s.health = 1e9;
  const e = spawn(s, { type: 'heavy', x: 6.6, z: -0.8, state: 'alert', floor: 2 });
  let seen = new Set();
  for (let i = 0; i < 120 * 70 && Math.hypot(e.x - s.player.x, e.z - s.player.z) > 1.2; i++) { step(s, 1 / 120); seen.add(floorIndex(house, e.base)); }
  assert.ok(e.base < 0.01 && Math.hypot(e.x - s.player.x, e.z - s.player.z) < 1.3, `ended at ${e.x.toFixed(1)},${e.base.toFixed(1)},${e.z.toFixed(1)}`);
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test('the house mission: carry the yarn basket from the attic back to the gate', () => {
  const s = createGame({ level: house }); s.health = 1e9;
  const p = s.player, prize = s.pickups.find(k => k.kind === 'objective');
  assert.equal(missionStatus(s).type, 'fetch');
  p.x = prize.x; p.z = prize.z; p.y = 2 * SH; run(s, 0.2);
  assert.ok(s.carrying);
  const roused = s.enemies.filter(e => e.awareness !== 'asleep' && e.awareness !== 'idle');
  const attic = roused.filter(e => e.base > SH + 1).length;
  assert.ok(attic >= 6 && roused.length - attic <= 3 && roused.every(e => e.base > 1), `the alarm rouses the attic and a few right underneath, nobody on the ground floor (${attic} + ${roused.length - attic})`);
  p.x = 0; p.z = 2.5; p.y = 2 * SH; run(s, 0.2);
  assert.ok(p.z < 3 && s.phase === 'playing', 'the attic has no way out over the garden');
  p.x = 0; p.z = 10; p.y = 0; run(s, CONFIG.endDelay + 0.3);
  assert.equal(s.phase, 'won');
});

test('view-relative movement is unchanged', () => {
  const m = cameraMove(0, 1, 0); assert.ok(Math.abs(m.x) < 1e-9 && Math.abs(m.z + 1) < 1e-9);
  const body = { x: -1.5, z: -2, vx: 0, vz: 0 }; resolveBody(house, body, 0.3);
  assert.ok(Math.abs(body.x + 1.5) > 0.39, 'a body inside a wall is pushed out');
});

test('jump is a short hop: ~0.4 m up, lands in under 0.7 s, no second jump in mid-air', () => {
  const s = game();
  assert.equal(beginJump(s), true, 'jump from the ground');
  assert.ok(consumeEvents(s).some(e => e.type === 'hop'), 'take-off emits hop');
  let peak = 0;
  for (let i = 0; i < 80; i++) { step(s, 1 / 120, { x: 0, z: 0 }); peak = Math.max(peak, s.player.jump); }
  assert.ok(peak > 0.35 && peak < 0.45, `peak ${peak.toFixed(3)} m`);
  assert.equal(s.player.jump, 0, 'back on the ground');
  assert.ok(consumeEvents(s).some(e => e.type === 'hop-land'), 'landing emits hop-land');
  assert.equal(s.player.y, 0, 'jump does not move the floor under the player');
  // 空中不能二段跳；落地后可以再跳
  beginJump(s); run(s, 0.1);
  assert.equal(beginJump(s), false, 'no mid-air second jump');
  run(s, 0.7);
  assert.equal(beginJump(s), true, 'can jump again after landing');
});

// ---------- 只影响画面的摆设 ----------

test('windows sit in solid wall clear of doors; lamps, rugs and pictures are inside the house', () => {
  const { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } = house.house;
  storeyDefs.forEach((def, floor) => {
    const S = house.storeys[floor];
    for (const w of def.windows) {
      const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, a0 = w.at - w.w / 2, a1 = w.at + w.w / 2, where = `floor ${floor} window at ${w.at}`;
      assert.ok(alongZ ? [x0, x1].includes(line) : [z0, z1].includes(line), `${where} belongs to an outside wall`);
      assert.ok(a0 > (alongZ ? z0 : x0) + 0.3 && a1 < (alongZ ? z1 : x1) - 0.3, `${where} clear of the corners`);
      const wall = def.walls.find(v => (alongZ ? v.x : v.z) === line);
      for (const [d0, d1] of wall?.doors || []) assert.ok(a1 < d0 - 0.2 || a0 > d1 + 0.2, `${where} overlaps a door`);
      for (const v of def.walls) {   // 窗不能正对着一道内墙的端头
        const cross = alongZ ? v.z : v.x, span = alongZ ? v.x : v.z;
        if (typeof cross === 'number' && Array.isArray(span) && span.includes(line)) assert.ok(cross < a0 - 0.15 || cross > a1 + 0.15, `${where} straddles an inner wall`);
      }
      if (!alongZ && line === z0) assert.ok(a1 < house.stairs.minX - 0.2 || a0 > house.stairs.maxX + 0.2, `${where} is where the stair tower joins`);
      assert.ok((w.sill ?? 1.0) >= 0.9 && (w.head ?? 2.1) <= houseDef.height - 0.3);
      // 窗前不能有比窗台高的柜子顶着
      const sill = w.sill ?? 1.0, inside = Math.sign((alongZ ? (x0 + x1) / 2 : (z0 + z1) / 2) - line);
      for (const c of S.furnitureBoxes) {
        const near = alongZ ? (inside > 0 ? c.minX - line : line - c.maxX) : (inside > 0 ? c.minZ - line : line - c.maxZ);
        const overlap = Math.min(a1, alongZ ? c.maxZ : c.maxX) - Math.max(a0, alongZ ? c.minZ : c.minX);
        assert.ok(!(near > -0.05 && near < 0.3 && overlap > 0.2 && c.maxY - S.y > sill + 0.25), `${where} is blocked by ${c.id}`);
      }
    }
    const inside = p => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
    for (const l of def.lamps) {
      assert.ok(inside(l), 'lamp inside the house');
      assert.ok(S.furnitureBoxes.every(c => c.maxY - S.y < 2.0 || l.x < c.minX - 0.35 || l.x > c.maxX + 0.35 || l.z < c.minZ - 0.35 || l.z > c.maxZ + 0.35), `floor ${floor} lamp at ${l.x},${l.z} hits tall furniture`);
    }
    for (const p of def.pictures) assert.ok(p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && p.y > 1.2);
    for (const f of def.furniture) if (f.face) assert.ok('nsew'.includes(f.face));
  });
});

console.log(`${checks} mission checks passed`);
