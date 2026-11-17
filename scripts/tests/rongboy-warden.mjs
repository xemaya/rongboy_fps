// 守墓巨像进了"家"的阁楼（开场片结尾的兑现）：拿起毛线篮它才出现；不用打倒，跑得掉；它下不了楼。
//   node scripts/tests/rongboy-warden.mjs
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/house.js';
import { compileLevel, navGoal, routeTo, storeyAt, navRadius, inStairs, freePoint, clearPath } from '../../scenes/rongboy-mission/level.js';
import { createGame, step, consumeEvents, missionStatus, CONFIG, ENEMY_TYPES } from '../../scenes/rongboy-mission/game.js';
import { ATTACKS } from '../../scenes/rongboy-mission/attacks.js';
import { checkMap } from '../../scenes/rongboy-mission/mapkit/check.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const DT = 1 / 120, L = compileLevel(def), SH = L.storeyHeight, basket = L.pickups.find(k => k.kind === 'objective'), PR = navRadius(CONFIG.playerRadius);
const warden = s => s.enemies.find(e => e.type === 'boss-warden');
// 站到毛线篮上把它捡起来
function grab(s) {
  s.health = 1e9; s.player.x = basket.x; s.player.z = basket.z; s.player.y = basket.y;
  const log = []; for (let i = 0; i < 12; i++) { step(s, DT, {}); log.push(...consumeEvents(s)); }
  return log;
}
// 朝 target（带高度）走 seconds 秒：同一层按寻路走，换层走楼梯。返回这段时间里的事件。
function walk(s, target, seconds, log = []) {
  const p = s.player;
  for (let t = 0; t < seconds; t += DT) {
    const goal = navGoal(L, { x: p.x, z: p.z, y: p.y }, target), S = storeyAt(L, p.y);
    const next = goal.direct || clearPath(S, p, goal, PR, true) ? goal : routeTo(S, p, goal, PR)[0] || goal;
    const dx = next.x - p.x, dz = next.z - p.z, d = Math.hypot(dx, dz) || 1;
    step(s, DT, { x: dx / d, z: dz / d }); log.push(...consumeEvents(s));
  }
  return log;
}

test('before the basket is taken the warden is simply not there', () => {
  const s = createGame({ level: L });
  assert.equal(s.total, 36); assert.equal(warden(s), undefined); assert.equal(s.dormant.length, 1);
  assert.equal(L.enemies.filter(e => e.dormant).length, 1);
  for (let i = 0; i < 240; i++) step(s, DT, {});
  assert.equal(s.enemies.length, 36);
});

test('taking the basket brings it out: first a pause while it shows itself, then it comes for you', () => {
  const s = createGame({ level: L }), log = grab(s), out = log.find(e => e.type === 'emerge'), w = warden(s);
  assert.ok(missionStatus(s).carrying); assert.ok(out && out.enemyType === 'boss-warden');
  assert.ok(log.indexOf(out) > log.findIndex(e => e.type === 'pickup'), 'its notice comes after "picked up", so it is the one left on screen');
  assert.equal(s.dormant.length, 0); assert.ok(w.enabled && w.alive); assert.equal(w.awareness, 'waking'); assert.equal(w.floor, 2);
  assert.equal(s.total, 39, 'it brings its two reserves, which are not on the floor yet'); assert.equal(s.enemies.filter(e => e.reserveOf === w.id && !e.enabled).length, 2);
  assert.ok(Math.hypot(w.x - basket.x, w.z - basket.z) > ATTACKS['boss-warden'].range + 1, 'it appears well outside its own reach');
  const x0 = w.x, z0 = w.z;
  for (let i = 0; i < 1.5 * 120; i++) step(s, DT, {});
  assert.equal(w.awareness, 'waking'); assert.ok(Math.hypot(w.x - x0, w.z - z0) < 0.05, 'it stands still while it shows itself');
  for (let i = 0; i < 0.6 * 120; i++) step(s, DT, {});
  assert.equal(w.awareness, 'alert');
  grab(s); assert.equal(s.enemies.filter(e => e.type === 'boss-warden').length, 1, 'it only happens once');
});

test('you do not have to fight it: walking the shortest way out of the attic, it never lands a blow', () => {
  const s = createGame({ level: L }); grab(s);
  const w = warden(s), p = s.player, gate = { x: L.player.x, z: L.player.z, y: 0 };
  let nearest = Infinity; const log = [];
  for (let t = 0; t < 16 && p.y > SH + 0.05; t += 0.25) { walk(s, gate, 0.25, log); if (p.y > 1.5 * SH) nearest = Math.min(nearest, Math.hypot(w.x - p.x, w.z - p.z)); }
  assert.ok(p.y <= SH + 0.05, `reached the second floor (height ${p.y.toFixed(2)})`);
  // 它会朝你走过来，可能刚好走进它够得着的距离（2.65 米）；但它蓄势要 1.3 秒，人早走了。所以看的是：没贴上来，也没打着
  assert.ok(nearest > 1.5, `closest it got was ${nearest.toFixed(2)} m`);
  assert.deepEqual(log.filter(e => e.type === 'hurt' && (e.by === w.id || e.source === 'ground-slam')), []);
});

test('it is too wide for the stairs: once you are off its floor it stays up there and keeps out of the stairwell', () => {
  assert.ok(navRadius(ENEMY_TYPES['boss-warden'].radius) * 2 > L.stairs.lane);
  const s = createGame({ level: L }); grab(s);
  const w = warden(s), gate = { x: L.player.x, z: L.player.z, y: 0 };
  walk(s, gate, 45);
  assert.ok(s.player.y < 0.2, 'the player is back in the garden');
  assert.equal(w.base, 2 * SH); assert.equal(inStairs(L, w), false); assert.ok(w.alive);
  assert.ok(freePoint(storeyAt(L, w.base), w.x, w.z, w.radius - 0.05), 'and it is not wedged into anything');
  walk(s, gate, 3);
  assert.equal(s.phase, 'won', 'carrying the basket to the gate still ends the mission, warden or no warden');
});

test('the house still passes the map checks with the warden written in', () => {
  const r = checkMap(def, { play: false });
  assert.deepEqual(r.errors.map(e => e.msg), []);
});

console.log(`${checks} warden checks passed`);
