// 游乐园互动的检查（docs/park-design.md）：走近才有提示、按一下演一段、坐着不晕的那几条数、十个章集满就结束。
//   node scripts/tests/rongboy-park-rides.mjs
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/amusement-tour.js';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame, step, consumeEvents, missionStatus, CONFIG } from '../../scenes/rongboy-mission/game.js';
import { PARK, SPOTS, PLAYER_EYE, parkPrompt, parkInteract } from '../../scenes/rongboy-mission/park-rides.js';
import { TOUR_STOPS, COASTER, WHEEL, RINK, HAUNT, isTourWalkable, isHauntWalkable, constrainTourWalk } from '../../scenes/rongboy-mission/park-tour-layout.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const DT = 1 / 60, L = compileLevel(def);
const game = () => createGame({ level: L });
const at = (s, id) => { const q = SPOTS.find(k => k.id === id); s.player.x = q.x; s.player.z = q.z; s.player.y = 0; return q; };
function run(s, seconds, input = {}, each = null) { const log = []; for (let i = 0; i < Math.round(seconds / DT); i++) { step(s, DT, input); log.push(...consumeEvents(s)); each?.(s); } return log; }
// 碰碰车场里没人开的车一直在自己转悠、互相碰（bump），和玩家在干什么无关，这里不看它们
const parks = log => log.filter(e => e.type === 'park' && e.what !== 'bump'), bumps = log => log.filter(e => e.type === 'park' && e.what === 'bump');

test('every place you press the key is on the path, and close to its attraction', () => {
  for (const q of SPOTS) {
    assert.ok(isTourWalkable(q.x, q.z, 0.2) || isHauntWalkable(q.x, q.z), `${q.id} at ${q.x}, ${q.z} is off the path`);   // 鬼屋的小铃在门厅里
    assert.ok(TOUR_STOPS.some(stop => stop.id === q.stop), q.id);
  }
  assert.deepEqual([...new Set(SPOTS.map(q => q.stop)), 'mirrors'].sort(), TOUR_STOPS.map(stop => stop.id).sort(), 'every attraction can earn its stamp');
});

test('the prompt shows only when you are near, says what will happen, and goes away while the thing is running', () => {
  const s = game();
  assert.equal(parkPrompt(s)?.id, 'entrance', 'you start beside the ticket booth');
  s.player.x = -20.6; s.player.z = 23.2; assert.equal(parkPrompt(s), null, 'between attractions there is nothing to press');
  const q = at(s, 'carousel'); assert.deepEqual(parkPrompt(s), { id: 'carousel', kind: 'look', zh: q.zh, en: q.en });
  s.player.x += PARK.reach + 0.3; assert.equal(parkPrompt(s), null);
  at(s, 'carousel'); assert.equal(parkInteract(s), true); assert.equal(parkPrompt(s), null, 'no prompt while the carousel turns');
  run(s, PARK.carousel.time + 0.2); assert.equal(parkPrompt(s)?.id, 'carousel', 'it can be rung again once it has stopped');
});

test('the park card: taken once at the booth, and that is the first stamp', () => {
  const s = game(); at(s, 'entrance');
  assert.ok(parkInteract(s));
  const log = parks(consumeEvents(s)); assert.deepEqual(log.map(e => e.what), ['stamp', 'card']); assert.equal(log[0].count, 1);
  assert.equal(parkPrompt(s), null); assert.equal(parkInteract(s), false); assert.deepEqual(s.park.stamps, ['entrance']);
});

test('carousel: one ring and it eases up to speed, turns, eases to a stop; the stamp comes with the ring', () => {
  const s = game(); at(s, 'carousel'); parkInteract(s);
  assert.deepEqual(s.park.stamps, ['carousel']);
  run(s, 1); const early = s.park.carouselAngle;
  run(s, 1); const second = s.park.carouselAngle - early;
  assert.ok(early > 0 && second > early * 1.5, 'it is still speeding up in the second second');
  run(s, PARK.carousel.time); const stopped = s.park.carouselAngle;
  run(s, 2); assert.equal(s.park.carouselAngle, stopped); assert.equal(s.park.running.carousel, 0);
  assert.ok(stopped > Math.PI * 2, 'at least one full turn');
});

test('roller coaster: you are carried one lap at child-train pace, the view never turns faster than 45 degrees a second, then you are back where you got on', () => {
  const s = game(), q = at(s, 'coaster');
  assert.equal(parkPrompt(s).kind, 'ride'); parkInteract(s);
  assert.equal(s.park.riding.id, 'coaster'); assert.equal(parks(consumeEvents(s))[0].what, 'board');
  const start = COASTER.at(0);
  assert.ok(Math.hypot(s.player.x - start.x, s.player.z - start.z) < 0.01 && Math.abs(s.player.y + PLAYER_EYE - start.y - PARK.coaster.seat) < 0.01, 'seated on the track at the station');
  let fastestTurn = 0, fastest = 0, top = 0, steepest = 0, last = { ...s.player };
  const log = run(s, PARK.coaster.time - 0.05, { x: 1, z: 1 }, g => {
    const p = g.player; if (!g.park.riding) return;
    fastest = Math.max(fastest, Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) / DT); top = Math.max(top, p.y + PLAYER_EYE);
    fastestTurn = Math.max(fastestTurn, p.seat.turn); steepest = Math.max(steepest, Math.abs(p.seat.pitch)); last = { ...p };
  });
  assert.equal(parks(log).length, 0, 'nothing else happens mid-ride, and walking keys do nothing');
  assert.ok(fastestTurn <= PARK.coaster.maxTurn + 1e-6 && PARK.coaster.maxTurn <= Math.PI / 4, `turned ${(fastestTurn * 180 / Math.PI).toFixed(0)} deg/s`);
  assert.ok(fastest < 3.2, `top speed ${fastest.toFixed(2)} m/s`); assert.ok(top > 7, 'it does climb'); assert.ok(steepest < 0.5, 'pitch stays gentle');
  assert.equal(parkPrompt(s).kind, 'leave');
  const end = parks(run(s, 0.2));
  assert.deepEqual(end.map(e => e.what), ['alight', 'stamp']); assert.equal(s.park.riding, null);
  assert.deepEqual([s.player.x, s.player.z, s.player.y], [q.x, q.z, 0]); assert.equal(s.player.seat, null); assert.equal(s.park.coasterU, 0);
});

test('the coaster starts and stops gently', () => {
  const s = game(); at(s, 'coaster'); parkInteract(s);
  const speed = () => { const a = { ...s.player }; step(s, DT, {}); return Math.hypot(s.player.x - a.x, s.player.y - a.y, s.player.z - a.z) / DT; };
  const v0 = speed(); run(s, 1); const v1 = speed(); run(s, 3); const cruise = speed();
  assert.ok(v0 < 0.1 && v1 > v0 && v1 < cruise * 0.6 && cruise > 1.2, [v0, v1, cruise].map(v => v.toFixed(2)).join(' '));
  run(s, PARK.coaster.time - 5.0); assert.ok(speed() < cruise * 0.5, 'slowing into the station');
});

test('pressing the key again mid-ride skips it, and the stamp still counts', () => {
  const s = game(), q = at(s, 'coaster'); parkInteract(s); run(s, 5);
  assert.ok(parkInteract(s));
  const log = parks(consumeEvents(s)); assert.equal(log[0].what, 'alight'); assert.equal(log[0].skipped, true);
  assert.deepEqual(s.park.stamps, ['coaster']); assert.deepEqual([s.player.x, s.player.z], [q.x, q.z]);
});

test('Ferris wheel: you board the car nearest the bottom, rise to the top of the park, and come down after one slow turn', () => {
  const s = game(); run(s, 7.3); at(s, 'wheel'); parkInteract(s);
  const bottom = WHEEL.y - WHEEL.r, eye = () => s.player.y + PLAYER_EYE;
  assert.ok(eye() < bottom + 1.2, `boards low (eye at ${eye().toFixed(2)})`); assert.equal(s.player.z, WHEEL.z);
  let top = 0, fastest = 0, last = { ...s.player };
  run(s, Math.PI * 2 / PARK.wheel.speed - 0.5, { x: 1 }, g => { if (!g.park.riding) return; top = Math.max(top, g.player.y + PLAYER_EYE); fastest = Math.max(fastest, Math.hypot(g.player.x - last.x, g.player.y - last.y) / DT); last = { ...g.player }; });
  assert.ok(top > WHEEL.y + WHEEL.r - 1.0 && top > 10, `reached ${top.toFixed(1)} m`); assert.ok(fastest < 1.0, `moves at ${fastest.toFixed(2)} m/s`);
  assert.equal(s.player.seat.yaw, null, 'the view direction stays the player\'s own'); assert.ok(s.park.riding);
  run(s, 1.0); assert.equal(s.park.riding, null); assert.deepEqual(s.park.stamps, ['wheel']);
});

test('bumper cars: you drive, the padded rim and the other cars bounce you, and you can get out whenever you like', () => {
  const s = game(), q = at(s, 'bumpers'); parkInteract(s);
  assert.equal(s.park.riding.id, 'bumpers'); assert.equal(parkPrompt(s).zh, '下车');
  const inside = c => ((c.x - RINK.x) / RINK.rx) ** 2 + ((c.z - RINK.z) / RINK.rz) ** 2 <= 1.0001;
  const x0 = s.player.x;
  const log = run(s, 6, { x: 1, z: 0 }, g => { for (const c of g.park.cars) assert.ok(inside(c), 'a car left the rink'); });
  assert.ok(s.player.x > x0 + 1.5, 'the car goes where you push'); assert.ok(bumps(log).some(e => e.car === 0 && e.wall), 'it bounced off the rim');
  assert.ok(Math.abs(s.player.y + PLAYER_EYE - PARK.bumpers.seat) < 1e-9, 'seated low');
  const more = run(s, 10, { x: -1, z: 0.4 }); assert.ok(bumps([...log, ...more]).some(e => e.car === 0 && !e.wall), 'and bumped another car');
  assert.ok(Math.max(...s.park.cars.map(c => Math.hypot(c.vx, c.vz))) <= PARK.bumpers.top + 1e-6);
  parkInteract(s); assert.equal(s.park.riding, null); assert.deepEqual([s.player.x, s.player.z], [q.x, q.z]); assert.deepEqual(s.park.stamps, ['bumpers']);
  at(s, 'bumpers'); parkInteract(s); run(s, PARK.bumpers.time + 0.2); assert.equal(s.park.riding, null, 'the turn ends by itself after half a minute');
});

test('game stalls: one press is a round of three throws; any stall stamps the midway once', () => {
  const s = game(); at(s, 'stall-ducks'); parkInteract(s);
  const log = parks(run(s, PARK.stall.time + 0.1));
  assert.deepEqual(log.filter(e => e.what === 'throw').map(e => [e.id, e.n]), [['stall-ducks', 0], ['stall-ducks', 1], ['stall-ducks', 2]]);
  at(s, 'stall-blocks'); parkInteract(s); run(s, PARK.stall.time + 0.1);
  assert.deepEqual(s.park.stamps, ['midway']);
});

test('the haunted house: shut until you knock, then you can walk in, ring the bell for the stamp, and the door never shuts on you', () => {
  const s = game(), inside = { x: HAUNT.door.x, z: HAUNT.door.z + 0.6 }, porch = { x: HAUNT.door.x, z: HAUNT.door.z - 0.7 };
  const walk = (from, to, open) => { const p = { ...to }; constrainTourWalk(p, from.x, from.z, open); return p; };
  assert.deepEqual(walk(porch, inside, false), porch, 'a shut door keeps you on the porch');
  assert.equal(walk(porch, { x: -9, z: -18.4 }, true).z, porch.z, 'even with the door open you cannot walk through the front wall (you slide along it)');
  at(s, 'haunt'); assert.equal(parkPrompt(s).zh, '敲门'); parkInteract(s);
  assert.deepEqual(s.park.stamps, [], 'knocking alone earns nothing');
  assert.equal(parkPrompt(s), null, 'nothing more to press on the porch while the door is open');
  run(s, 1.5); assert.equal(s.park.door, 1);
  assert.deepEqual(walk(porch, inside, s.park.door > 0.9), inside, 'the open door lets you in');
  for (const r of HAUNT.walk) for (const [x, z] of [[r.minX, r.minZ], [r.maxX, r.maxZ]]) assert.ok(Math.hypot(x - HAUNT.door.x, z - HAUNT.door.z) < PARK.haunt.keep - 1, 'everywhere inside is close enough to hold the door open');
  {   // 真的走一遍：门关着走不进去；敲开以后一路走到头，停在小桌前，没穿墙
    const w = game(), go = (seconds, x, z) => run(w, seconds, { x, z });
    w.player.x = HAUNT.door.x; w.player.z = -21.5; go(3, 0, 1); assert.ok(w.player.z < HAUNT.door.z - 0.4, `stopped outside a shut door (z = ${w.player.z.toFixed(2)})`);
    at(w, 'haunt'); parkInteract(w); w.player.x = HAUNT.door.x; go(1.5, 0, 0); go(6, 0, 1);
    assert.ok(Math.abs(w.player.z - HAUNT.walk[1].maxZ) < 0.05 && isHauntWalkable(w.player.x, w.player.z), `walked to the far end of the foyer (z = ${w.player.z.toFixed(2)})`);
    assert.equal(parkPrompt(w)?.id, 'portraits', 'the bell is within reach there');
    go(4, -1, 0); assert.ok(Math.abs(w.player.x - HAUNT.walk[2].minX) < 0.05, `stopped short of the west wall (x = ${w.player.x.toFixed(2)})`);
    w.player.x = HAUNT.door.x; go(8, 0, -1); assert.ok(w.player.z < HAUNT.door.z - 0.4 && isTourWalkable(w.player.x, w.player.z, 0.2), 'and walked back out onto the path');
  }
  at(s, 'portraits'); assert.ok(isHauntWalkable(s.player.x, s.player.z)); assert.equal(parkPrompt(s).id, 'portraits');
  parkInteract(s); assert.deepEqual(s.park.stamps, ['haunt']); assert.equal(parkPrompt(s), null, 'the bell cannot be rung again while the ghosts are out');
  run(s, PARK.haunt.show + 20); assert.equal(s.park.door, 1, 'still open half a minute later, while you are inside'); assert.equal(parkPrompt(s).id, 'portraits', 'and the bell can be rung again');
  at(s, 'carousel'); run(s, 2); assert.equal(s.park.door, 0, 'it shuts once you have walked away');
  at(s, 'haunt'); assert.equal(parkPrompt(s).zh, '敲门', 'and can be knocked on again');
  const acts = [];
  for (let i = 0; i < 4; i++) { at(s, 'circus'); parkInteract(s); acts.push(s.park.act); run(s, PARK.circus.time + 0.1); }
  assert.deepEqual(acts, [1, 2, 3, 1]);
});

test('ten stamps finish the visit: not before, and not while something is still playing', () => {
  const s = game();
  for (const id of ['entrance', 'carousel', 'rapids', 'haunt', 'portraits', 'stall-balloons', 'circus']) { at(s, id); assert.ok(parkInteract(s), id); }
  for (const id of ['coaster', 'wheel', 'bumpers']) { at(s, id); parkInteract(s); parkInteract(s); }
  assert.equal(s.park.stamps.length, 9); run(s, PARK.carousel.time + 1); assert.equal(missionStatus(s).done, false);
  at(s, 'rapids'); parkInteract(s);   // 再放一次船：还在演
  s.player.x = PARK.mirrorsExit.x; s.player.z = PARK.mirrorsExit.z;
  const log = run(s, 1);
  assert.equal(s.park.stamps.length, 10); assert.equal(missionStatus(s).done, false, 'the boat is still running');
  assert.equal(parks(log).filter(e => e.what === 'complete').length, 0);
  const rest = run(s, PARK.rapids.time + CONFIG.endDelay + 0.5);
  assert.equal(parks(rest).filter(e => e.what === 'complete').length, 1); assert.equal(s.phase, 'won');
  assert.deepEqual([...s.park.stamps].sort(), TOUR_STOPS.map(stop => stop.id).sort());
});

console.log(`${checks} park ride checks passed`);
