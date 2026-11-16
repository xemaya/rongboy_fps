// 学校关卡的检查：布局站得住（出生点、连通、没有死角、每间至少两扇门）、开局安全、清场任务走得通。
//   node scripts/tests/rongboy-school.mjs
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/school.js';
import { compileLevel, clearPath, freePoint, routeTo, navRadius, roomAt, lineOfSight } from '../../scenes/rongboy-mission/level.js';
import { createGame, step, fire, consumeEvents, missionStatus, CONFIG, WEAPONS, ENEMY_TYPES } from '../../scenes/rongboy-mission/game.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const run = (s, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 120); i++) step(s, 1 / 120, input); };
const L = compileLevel(def), S = L.storeys[0];

test('a one-storey school: three classrooms, a corridor, and a playground outdoors', () => {
  assert.equal(L.storeys.length, 1); assert.equal(L.rooms.length, 5); assert.equal(L.outdoor.length, 1);
  assert.equal(roomAt(L, 0, 6).id, 'yard'); assert.equal(roomAt(L, -8, -6).id, 'class'); assert.equal(roomAt(L, 0, -6).id, 'art'); assert.equal(roomAt(L, 8, -6).id, 'lab'); assert.equal(roomAt(L, 0, -1).id, 'corridor');
  assert.equal(L.rooms.filter(r => /教室/.test(r.name)).length, 3);
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
  for (const r of def.rooms.filter(r => !r.outdoor)) {
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

test('windows, lamps and pictures sit where they can be built', () => {
  const B = L.house;
  for (const w of def.windows) {
    const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, a0 = w.at - w.w / 2, a1 = w.at + w.w / 2, where = `window at ${alongZ ? 'x' : 'z'}=${line}, ${w.at}`;
    assert.ok(alongZ ? [B.minX, B.maxX].includes(line) : [B.minZ, B.maxZ].includes(line), `${where} belongs to an outside wall`);
    assert.ok(a0 > (alongZ ? B.minZ : B.minX) + 0.4 && a1 < (alongZ ? B.maxZ : B.maxX) - 0.4, `${where} clear of the corners`);
    for (const v of def.walls) {   // 不骑在内墙的端头上
      const cross = alongZ ? v.z : v.x, span = alongZ ? v.x : v.z;
      if (typeof cross === 'number' && Array.isArray(span) && span.includes(line)) assert.ok(cross < a0 - 0.25 || cross > a1 + 0.25, `${where} straddles an inner wall`);
    }
    const sill = w.sill ?? 1.0, head = w.head ?? 2.1;
    assert.ok(sill >= 1 && head <= def.height - 0.5 && head > sill + 0.8, where);
    const inside = Math.sign((alongZ ? (B.minX + B.maxX) / 2 : (B.minZ + B.maxZ) / 2) - line);
    for (const c of S.furnitureBoxes) {   // 窗前不能顶着比窗台高的柜子
      const near = alongZ ? (inside > 0 ? c.minX - line : line - c.maxX) : (inside > 0 ? c.minZ - line : line - c.maxZ);
      const overlap = Math.min(a1, alongZ ? c.maxZ : c.maxX) - Math.max(a0, alongZ ? c.minZ : c.minX);
      assert.ok(!(near > -0.05 && near < 0.3 && overlap > 0.2 && c.maxY > sill + 0.25), `${where} is blocked by ${c.id}`);
    }
  }
  for (const l of def.lamps) assert.ok(roomAt(L, l.x, l.z) && S.furnitureBoxes.every(c => c.maxY < def.height - 1.2 || l.x < c.minX - 0.3 || l.x > c.maxX + 0.3 || l.z < c.minZ - 0.3 || l.z > c.maxZ + 0.3), `lamp at ${l.x},${l.z}`);
  for (const p of def.pictures) {
    assert.ok(p.y - (p.h ?? 0.45) / 2 > 1.0 && p.y + (p.h ?? 0.45) / 2 < def.height - 0.3, `picture at ${p.x},${p.z}`);
    const half = (p.w ?? 0.6) / 2 + 0.1, alongX = p.normal[0] === 0;
    for (const w of def.walls) for (const [a, b] of w.doors || []) {   // 画不挂在门洞上
      const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z;
      if (alongZ === alongX || Math.abs((alongZ ? p.x : p.z) - line) > 0.3) continue;
      const at = alongZ ? p.z : p.x;
      assert.ok(at + half < a || at - half > b, `picture at ${p.x},${p.z} hangs over a doorway`);
    }
  }
});

test('the gate is safe: a minute behind the block wall and nobody has noticed', () => {
  const s = createGame({ level: L });
  assert.equal(s.total, 20); assert.equal(missionStatus(s).type, 'clear');
  run(s, 60);
  assert.equal(s.health, CONFIG.maxHealth);
  assert.deepEqual(s.enemies.filter(e => e.awareness !== 'asleep' && e.awareness !== 'idle').map(e => `${e.type}@${e.x.toFixed(1)},${e.z.toFixed(1)}`), []);
});

test('the mission: the round ends when the last zombie is down, not before', () => {
  const s = createGame({ level: L }); s.health = 1e9;
  for (const e of s.enemies.slice(1)) e.alive = false;
  run(s, 1);
  assert.equal(s.phase, 'playing');
  s.enemies[0].alive = false; run(s, CONFIG.endDelay + 0.3);
  assert.equal(s.phase, 'won');
});

test('once roused, everyone finds the player in the middle of the playground', () => {
  const s = createGame({ level: L }); s.health = 1e9;
  s.player.x = 0; s.player.z = 6.6;
  for (const e of s.enemies) e.awareness = 'alert';
  run(s, 75);
  const lost = s.enemies.filter(e => Math.hypot(e.x - s.player.x, e.z - s.player.z) > 6);
  assert.deepEqual(lost.map(e => `${e.type}@${e.x.toFixed(1)},${e.z.toFixed(1)}`), []);
  for (const e of s.enemies) assert.ok(freePoint(L, e.x, e.z, e.radius - 0.02) && Number.isFinite(e.x + e.z + e.y), `${e.type} ended inside a solid`);
});

test('the block wall hides the gate; desks are low enough to shoot over', () => {
  assert.equal(lineOfSight(L, { x: 0, y: 1.2, z: 11.2 }, { x: 0, y: 1.2, z: 4.0 }), false);
  assert.equal(lineOfSight(L, { x: -10, y: 1.2, z: -5.75 }, { x: -5, y: 1.2, z: -5.75 }), true);
});

console.log(`${checks} school checks passed`);
