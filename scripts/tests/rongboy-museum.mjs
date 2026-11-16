// 博物馆关卡的检查：布局站得住（出生点、连通、没有死角、每间至少两扇门）、开局安全、三件展品的任务走得通。
//   node scripts/tests/rongboy-museum.mjs
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/museum.js';
import { LEVELS, ORDER } from '../../scenes/rongboy-mission/levels/index.js';
import { compileLevel, clearPath, freePoint, routeTo, navRadius, roomAt, lineOfSight } from '../../scenes/rongboy-mission/level.js';
import { createGame, step, fire, consumeEvents, missionStatus, CONFIG, WEAPONS, ENEMY_TYPES } from '../../scenes/rongboy-mission/game.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const run = (s, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 120); i++) step(s, 1 / 120, input); };
const L = compileLevel(def), S = L.storeys[0];

test('the level table lists every map and each one compiles', () => {
  assert.deepEqual(ORDER, ['house', 'museum', 'school']);
  for (const id of ORDER) { const c = compileLevel(LEVELS[id]); assert.equal(c.id, id); assert.ok(c.texts.short && c.texts.intro && c.look); }
});

test('one tall storey, nine named rooms, no outdoors', () => {
  assert.equal(L.storeys.length, 1); assert.equal(L.rooms.length, 9); assert.equal(L.outdoor.length, 0);
  assert.equal(roomAt(L, 0, 0).id, 'hall'); assert.equal(roomAt(L, -9, 0).id, 'egypt'); assert.equal(roomAt(L, 9, -8).id, 'vault');
  assert.ok(L.solids.some(c => c.kind === 'slab' && Math.abs(c.minY - def.height) < 1e-9), 'a ceiling slab stops woolballs');
});

test('every spawn, patrol point and pickup is on free floor and can be reached from the entrance', () => {
  assert.ok(freePoint(L, L.player.x, L.player.z, CONFIG.playerRadius));
  for (const e of L.enemies) {
    const r = ENEMY_TYPES[e.type].radius, where = `${e.type} at ${e.x},${e.z}`;
    assert.ok(freePoint(L, e.x, e.z, r), `${where} overlaps something`);
    assert.ok(roomAt(L, e.x, e.z), where);
    for (const [x, z] of e.patrol || []) {
      assert.ok(freePoint(L, x, z, r), `${where}: patrol point ${x},${z} blocked`);
      assert.ok(clearPath(L, e, { x, z }, r) || e.patrol.some(([a, b]) => clearPath(L, { x: a, z: b }, { x, z }, r)), `${where}: patrol leg is not walkable`);
    }
    assert.ok(routeTo(L, e, L.player, navRadius(r)).length > 0, `${where} is cut off`);
  }
  for (const k of L.pickups) {
    assert.ok(freePoint(L, k.x, k.z, CONFIG.playerRadius), `pickup at ${k.x},${k.z} blocked`);
    assert.ok(routeTo(L, L.player, k, navRadius(CONFIG.playerRadius)).length > 0, `pickup at ${k.x},${k.z} unreachable`);
    if (k.weapon) assert.ok(WEAPONS.some(w => w.id === k.weapon), k.weapon);
  }
});

test('every room has at least two doorways, and the widest zombie fits through all of them', () => {
  for (const r of def.rooms) {
    let doors = 0;
    for (const w of def.walls) {
      const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, lo = alongZ ? r.minZ : r.minX, hi = alongZ ? r.maxZ : r.maxX;
      if (![alongZ ? r.minX : r.minZ, alongZ ? r.maxX : r.maxZ].includes(line)) continue;
      doors += (w.doors || []).filter(([a, b]) => a >= lo && b <= hi).length;
    }
    assert.ok(doors >= 2, `${r.id} has ${doors} door(s)`);
  }
  for (const w of def.walls) for (const [a, b] of w.doors || []) {
    const alongZ = typeof w.x === 'number', mid = (a + b) / 2, line = alongZ ? w.x : w.z;
    const p = alongZ ? { x: line - 0.8, z: mid } : { x: mid, z: line - 0.8 }, q = alongZ ? { x: line + 0.8, z: mid } : { x: mid, z: line + 0.8 };
    assert.ok(clearPath(L, p, q, 0.455), `door at ${alongZ ? 'x' : 'z'}=${line}, ${a}..${b}`);
  }
});

test('no hiding pockets: anywhere the player can stand, a zombie can get close enough to touch', () => {
  const small = navRadius(ENEMY_TYPES.walker.radius), reach = CONFIG.playerRadius + ENEMY_TYPES.walker.radius, d = 0.15;
  const stand = [], walk = [];
  for (let x = S.bounds.minX; x <= S.bounds.maxX; x += d) for (let z = S.bounds.minZ; z <= S.bounds.maxZ; z += d) {
    if (freePoint(S, x, z, small)) walk.push([x, z]);
    else if (freePoint(S, x, z, CONFIG.playerRadius)) stand.push([x, z]);
  }
  const pockets = stand.filter(([x, z]) => !walk.some(([a, b]) => Math.hypot(a - x, b - z) <= reach));
  assert.deepEqual(pockets.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`), []);
});

test('windows, skylights, lamps and pictures sit where they can be built', () => {
  const B = def.bounds;
  for (const w of def.windows) {
    const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, a0 = w.at - w.w / 2, a1 = w.at + w.w / 2, where = `window at ${alongZ ? 'x' : 'z'}=${line}, ${w.at}`;
    assert.ok(alongZ ? [B.minX, B.maxX].includes(line) : [B.minZ, B.maxZ].includes(line), `${where} belongs to an outside wall`);
    assert.ok(a0 > (alongZ ? B.minZ : B.minX) + 0.4 && a1 < (alongZ ? B.maxZ : B.maxX) - 0.4, `${where} clear of the corners`);
    for (const v of def.walls) {   // 不骑在内墙的端头上
      const cross = alongZ ? v.z : v.x, span = alongZ ? v.x : v.z;
      if (typeof cross === 'number' && Array.isArray(span) && span.includes(line)) assert.ok(cross < a0 - 0.25 || cross > a1 + 0.25, `${where} straddles an inner wall`);
    }
    assert.ok(w.sill >= 1 && w.head <= def.height - 0.5 && w.head > w.sill + 0.8, where);
    const inside = Math.sign(0 - line);
    for (const c of S.furnitureBoxes) {   // 窗前不能顶着比窗台高的柜子
      const near = alongZ ? (inside > 0 ? c.minX - line : line - c.maxX) : (inside > 0 ? c.minZ - line : line - c.maxZ);
      const overlap = Math.min(a1, alongZ ? c.maxZ : c.maxX) - Math.max(a0, alongZ ? c.minZ : c.minX);
      assert.ok(!(near > -0.05 && near < 0.3 && overlap > 0.2 && c.maxY > w.sill + 0.25), `${where} is blocked by ${c.id}`);
    }
  }
  for (const k of def.skylights) {
    const room = def.rooms.find(r => k.x - k.w / 2 > r.minX + 0.4 && k.x + k.w / 2 < r.maxX - 0.4 && k.z - k.d / 2 > r.minZ + 0.4 && k.z + k.d / 2 < r.maxZ - 0.4);
    assert.ok(room, `skylight at ${k.x},${k.z} lies inside one room`);
  }
  for (const l of def.lamps) assert.ok(roomAt(L, l.x, l.z) && S.furnitureBoxes.every(c => c.maxY < def.height - 1.2 || l.x < c.minX - 0.3 || l.x > c.maxX + 0.3 || l.z < c.minZ - 0.3 || l.z > c.maxZ + 0.3), `lamp at ${l.x},${l.z}`);
  for (const p of def.pictures) {
    assert.ok(p.y - (p.h ?? 0.45) / 2 > 1.2 && p.y + (p.h ?? 0.45) / 2 < def.height - 0.3, `picture at ${p.x},${p.z}`);
    const half = (p.w ?? 0.6) / 2 + 0.1, alongX = p.normal[0] === 0;
    for (const w of def.walls) for (const [a, b] of w.doors || []) {   // 画不挂在门洞上
      const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z;
      if (alongZ === alongX || Math.abs((alongZ ? p.x : p.z) - line) > 0.3) continue;
      const at = alongZ ? p.z : p.x;
      assert.ok(at + half < a || at - half > b, `picture at ${p.x},${p.z} hangs over a doorway`);
    }
  }
});

test('the entrance is safe: a minute at the door and nobody has noticed', () => {
  const s = createGame({ level: L });
  assert.equal(s.total, 27); assert.equal(s.objectives, 3);
  run(s, 60);
  assert.equal(s.health, CONFIG.maxHealth);
  assert.deepEqual(s.enemies.filter(e => e.awareness !== 'asleep' && e.awareness !== 'idle').map(e => `${e.type}@${e.x.toFixed(1)},${e.z.toFixed(1)}`), []);
});

test('the mission: all three exhibits, then back to the dinosaur', () => {
  const s = createGame({ level: L }); s.health = 1e9;
  const p = s.player, prizes = s.pickups.filter(k => k.kind === 'objective');
  assert.deepEqual(prizes.map(k => k.name), ['黄金面具', '恐龙蛋', '蓝宝石']);
  const exit = def.mission.exit, home = { x: (exit.minX + exit.maxX) / 2, z: (exit.minZ + exit.maxZ) / 2 };
  assert.ok(freePoint(L, home.x, home.z, CONFIG.playerRadius), 'the drop-off spot is open floor');
  p.x = home.x; p.z = home.z; run(s, 0.2);
  assert.equal(missionStatus(s).done, false, 'empty-handed does not count');
  prizes.slice(0, 2).forEach((k, i) => {
    p.x = k.x; p.z = k.z; run(s, 0.2);
    const got = consumeEvents(s).find(e => e.type === 'pickup' && e.kind === 'objective');
    assert.equal(got.collected, i + 1); assert.equal(got.needed, 3); assert.equal(got.name, k.name);
  });
  p.x = home.x; p.z = home.z; run(s, 0.2);
  assert.ok(!s.carrying && s.phase === 'playing', 'two out of three is not enough');
  p.x = prizes[2].x; p.z = prizes[2].z; run(s, 0.2);
  assert.ok(s.carrying);
  p.x = home.x; p.z = home.z; run(s, CONFIG.endDelay + 0.3);
  assert.equal(s.phase, 'won');
});

test('picking up an exhibit rouses that room, not the whole museum', () => {
  const s = createGame({ level: L }); s.health = 1e9;
  const mask = s.pickups.find(k => k.name === '黄金面具');
  s.player.x = mask.x; s.player.z = mask.z; run(s, 0.2);
  const roused = s.enemies.filter(e => e.awareness !== 'asleep' && e.awareness !== 'idle');
  assert.ok(roused.length >= 2 && roused.length <= 8, `${roused.length} roused`);
  assert.ok(roused.every(e => Math.hypot(e.x - mask.x, e.z - mask.z) < def.mission.alarm + 0.5));
});

test('once roused, everyone finds the player in the central hall', () => {
  const s = createGame({ level: L }); s.health = 1e9;
  s.player.x = 0; s.player.z = 5.0;
  for (const e of s.enemies) e.awareness = 'alert';
  run(s, 90);
  const lost = s.enemies.filter(e => Math.hypot(e.x - s.player.x, e.z - s.player.z) > 6.5);
  assert.deepEqual(lost.map(e => `${e.type}@${e.x.toFixed(1)},${e.z.toFixed(1)}`), []);
  for (const e of s.enemies) assert.ok(freePoint(L, e.x, e.z, e.radius - 0.02) && Number.isFinite(e.x + e.z + e.y), `${e.type} ended inside a solid`);
});

test('a ball fired at a display case or the ceiling bounces; sight is blocked by the tall cases', () => {
  const s = createGame({ level: L }); s.enemies = [];
  fire(s, 0, { origin: { x: 8.5, y: 1.2, z: -5.0 }, direction: { x: 0, y: 0, z: -1 } });
  let minZ = 0; for (let i = 0; i < 60; i++) { step(s, 1 / 120); for (const b of s.balls) minZ = Math.min(minZ, b.z); }
  assert.ok(minZ > -7.5, 'the gem case is solid');
  assert.equal(lineOfSight(L, { x: 8.5, y: 1.2, z: -6.0 }, { x: 8.5, y: 1.2, z: -10.0 }), false);
  assert.equal(lineOfSight(L, { x: 0, y: 1.2, z: 5.0 }, { x: 0, y: 1.2, z: -3.5 }), true, 'the dinosaur plinth is low: you can see across the hall');
});

console.log(`${checks} museum checks passed`);
