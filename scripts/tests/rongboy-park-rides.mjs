// 游乐园设施的检查（docs/park-design.md）：走近才有提示、按一下演一段、坐着不晕的那几条数。
// 门、机关和小丑在 rongboy-amusement.mjs；这里从镜子迷宫那一站开局（前面的门都开着、没有僵尸），只看设施自己。
//   node scripts/tests/rongboy-park-rides.mjs
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/amusement.js';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame, step, consumeEvents, missionStatus } from '../../scenes/rongboy-mission/game.js';
import { PARK_ZONES } from '../../scenes/rongboy-mission/amusement.js';
import { fireStall, stallTarget, STALL_SHOTS } from '../../scenes/rongboy-mission/park-stalls.js';
import { PARK, SPOTS, PLAYER_EYE, parkPrompt, parkInteract } from '../../scenes/rongboy-mission/park-rides.js';
import { TOUR_STOPS, COASTER, RAPIDS, WHEEL, STALLS, RINK, HAUNT, GATE, CAROUSEL, isTourWalkable, isHauntWalkable, constrainTourWalk } from '../../scenes/rongboy-mission/park-tour-layout.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const DT = 1 / 60, L = compileLevel(def);
const game = () => { const s = createGame({ level: L, amusementCheckpoint: PARK_ZONES.findIndex(zone => zone.id === 'mirrors') }); Object.assign(s.player, { x: L.player.x, z: L.player.z }); return s; };
const at = (s, id) => { const q = SPOTS.find(k => k.id === id); s.player.x = q.x; s.player.z = q.z; s.player.y = 0; return q; };
function run(s, seconds, input = {}, each = null) { const log = []; for (let i = 0; i < Math.round(seconds / DT); i++) { step(s, DT, input); log.push(...consumeEvents(s)); each?.(s); } return log; }
// 碰碰车场里没人开的车一直在自己转悠、互相碰（bump），和玩家在干什么无关，这里不看它们
const parks = log => log.filter(e => e.type === 'park' && e.what !== 'bump'), bumps = log => log.filter(e => e.type === 'park' && e.what === 'bump');

test('every place you press the key is on the path, and close to its attraction', () => {
  for (const q of SPOTS) {
    assert.ok(isTourWalkable(q.x, q.z, 0.2) || isHauntWalkable(q.x, q.z), `${q.id} at ${q.x}, ${q.z} is off the path`);   // 鬼屋的小铃在门厅里
    assert.ok(TOUR_STOPS.some(stop => stop.id === q.stop), q.id);
  }
  assert.deepEqual([...new Set(SPOTS.map(q => q.stop)), 'entrance', 'mirrors', 'circus'].sort(), TOUR_STOPS.map(stop => stop.id).sort(), 'every attraction has something to press, except the gate, the mirror maze (you just walk through) and the big top (the clown is waiting)');
});

test('the prompt shows only when you are near, says what will happen, and goes away while the thing is running', () => {
  const s = game();
  assert.equal(parkPrompt(s), null, 'nothing to press at the gate: you just walk in');
  s.player.x = -20.6; s.player.z = 23.2; assert.equal(parkPrompt(s), null, 'between attractions there is nothing to press');
  const q = at(s, 'carousel'); assert.deepEqual(parkPrompt(s), { id: 'carousel', kind: 'look', zh: q.zh, en: q.en });
  s.player.x += PARK.reach + 0.3; assert.equal(parkPrompt(s), null);
  at(s, 'carousel'); assert.equal(parkInteract(s), true); assert.equal(parkPrompt(s), null, 'no prompt while the carousel turns');
  run(s, PARK.carousel.time + 0.2); assert.equal(parkPrompt(s)?.id, 'carousel', 'it can be rung again once it has stopped');
});

test('carousel: one ring and it eases up to speed, turns, eases to a stop', () => {
  const s = game(); at(s, 'carousel'); parkInteract(s);
  run(s, 1); const early = s.park.carouselAngle;
  run(s, 1); const second = s.park.carouselAngle - early;
  assert.ok(early > 0 && second > early * 1.5, 'it is still speeding up in the second second');
  run(s, PARK.carousel.time); const stopped = s.park.carouselAngle;
  run(s, 2); assert.equal(s.park.carouselAngle, stopped); assert.equal(s.park.running.carousel, 0);
  assert.ok(stopped > Math.PI * 2, 'at least one full turn');
});

test('roller coaster: one long lap, slow up the lift and fast down the drop; the view never turns faster than 45 degrees a second; then you are back where you got on', () => {
  const s = game(), q = at(s, 'coaster');
  assert.equal(parkPrompt(s).kind, 'ride'); parkInteract(s);
  assert.equal(s.park.riding.id, 'coaster'); assert.equal(parks(consumeEvents(s))[0].what, 'board');
  const start = COASTER.at(0);
  assert.ok(Math.hypot(s.player.x - start.x, s.player.z - start.z) < 0.01 && Math.abs(s.player.y + PLAYER_EYE - start.y - PARK.coaster.seat) < 0.01, 'seated on the track at the station');
  let fastestTurn = 0, fastest = 0, top = 0, steepest = 0, offSeat = 0, last = { ...s.player };
  const log = run(s, PARK.coaster.time - 0.05, { x: 1, z: 1 }, g => {
    const p = g.player; if (!g.park.riding) return;
    fastest = Math.max(fastest, Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) / DT); top = Math.max(top, p.y + PLAYER_EYE);
    fastestTurn = Math.max(fastestTurn, p.seat.turn); steepest = Math.max(steepest, Math.abs(p.seat.pitch)); last = { ...p };
    const on = COASTER.at(g.park.coasterU); offSeat = Math.max(offSeat, Math.abs((p.x - on.x) * on.tx + (p.y + PLAYER_EYE - on.y) * on.ty + (p.z - on.z) * on.tz));
  });
  assert.ok(offSeat < 0.02, 'the seat tilts with the car: on the steep drop the eye stays over the seat, not inside the seat back');
  assert.equal(parks(log).length, 0, 'nothing else happens mid-ride, and walking keys do nothing');
  assert.ok(fastestTurn <= PARK.coaster.maxTurn + 1e-6 && PARK.coaster.maxTurn <= Math.PI / 4, `turned ${(fastestTurn * 180 / Math.PI).toFixed(0)} deg/s`);
  assert.ok(COASTER.length > 90, `the track is ${COASTER.length.toFixed(0)} m long`);
  assert.ok(fastest > 8.5 && fastest < 10.2, `top speed ${fastest.toFixed(2)} m/s`); assert.ok(top > 10.5, 'it climbs above the big top'); assert.ok(steepest < 0.5, 'pitch stays gentle');
  assert.ok(PARK.coaster.time > 18 && PARK.coaster.time < 28, `a lap takes ${PARK.coaster.time.toFixed(1)} s`);
  assert.equal(parkPrompt(s).kind, 'leave');
  const end = parks(run(s, 0.2));
  assert.deepEqual(end.map(e => e.what), ['alight']); assert.equal(s.park.riding, null);
  assert.deepEqual([s.player.x, s.player.z, s.player.y], [q.x, q.z, 0]); assert.equal(s.player.seat, null); assert.equal(s.park.coasterU, 0);
});

test('the coaster starts and stops gently, crawls up the lift, and is more than twice as fast down the drop', () => {
  const s = game(); at(s, 'coaster'); parkInteract(s);
  const speed = () => { const a = s.park.coasterU; step(s, DT, {}); return (s.park.coasterU - a) * COASTER.length / DT; };   // 车在轨道上的速度（眼睛还会随车身俯仰多动一点，这里不算）
  const v0 = speed(); run(s, 0.25); const v1 = speed();
  assert.ok(v0 < 0.5 && v1 > v0 && v1 < 2.5, [v0, v1].map(v => v.toFixed(2)).join(' '));
  // 一路记下速度和高度：坡顶之前是提升坡，之后是俯冲
  const trace = []; while (s.park.riding && s.park.riding.t < PARK.coaster.time - 0.3) trace.push({ v: speed(), y: COASTER.at(s.park.coasterU).y, t: s.park.riding?.t });
  const crest = trace.reduce((best, q, i) => q.y > trace[best].y ? i : best, 0), lift = Math.max(...trace.slice(0, crest).map(q => q.v)), drop = Math.max(...trace.slice(crest).map(q => q.v));
  assert.ok(lift < 4.6 && drop > lift * 2, `lift ${lift.toFixed(1)} m/s, drop ${drop.toFixed(1)} m/s`);
  for (let i = 1; i < trace.length; i++) assert.ok(Math.abs(trace[i].v - trace[i - 1].v) / DT < 7, `speed jumps at ${trace[i].t?.toFixed(2)} s`);   // 没有一下子的加速或急刹
  assert.ok(speed() < 2, 'slowing into the station');
});

test('pressing the key again mid-ride skips it and puts you back where you got on', () => {
  const s = game(), q = at(s, 'coaster'); parkInteract(s); run(s, 5);
  assert.ok(parkInteract(s));
  const log = parks(consumeEvents(s)); assert.equal(log[0].what, 'alight'); assert.equal(log[0].skipped, true);
  assert.equal(s.park.riding, null); assert.deepEqual([s.player.x, s.player.z], [q.x, q.z]);
});

test('Ferris wheel: you board the car nearest the bottom, rise to the top of the park, and come down after one slow turn', () => {
  const s = game(); run(s, 7.3); at(s, 'wheel'); parkInteract(s);
  const bottom = WHEEL.y - WHEEL.r, eye = () => s.player.y + PLAYER_EYE;
  assert.ok(eye() < bottom + 1.2, `boards low (eye at ${eye().toFixed(2)})`); assert.equal(s.player.z, WHEEL.z);
  let top = 0, fastest = 0, last = { ...s.player };
  run(s, Math.PI * 2 / PARK.wheel.speed - 0.5, { x: 1 }, g => { if (!g.park.riding) return; top = Math.max(top, g.player.y + PLAYER_EYE); fastest = Math.max(fastest, Math.hypot(g.player.x - last.x, g.player.y - last.y) / DT); last = { ...g.player }; });
  assert.ok(top > WHEEL.y + WHEEL.r - 1.0 && top > 10, `reached ${top.toFixed(1)} m`); assert.ok(fastest < 1.0, `moves at ${fastest.toFixed(2)} m/s`);
  assert.equal(s.player.seat.yaw, null, 'the view direction stays the player\'s own'); assert.ok(s.park.riding);
  run(s, 1.0); assert.equal(s.park.riding, null);
});

test('bumper cars: you drive, the padded rim and the other cars bounce you, and you can get out whenever you like', () => {
  const s = game(), q = at(s, 'bumpers'); parkInteract(s);
  assert.equal(s.park.riding.id, 'bumpers'); assert.equal(parkPrompt(s).zh, '下车');
  const inside = c => ((c.x - RINK.x) / RINK.rx) ** 2 + ((c.z - RINK.z) / RINK.rz) ** 2 <= 1.0001;
  const x0 = s.player.x;
  let quickest = 0;
  const log = run(s, 6, { x: 1, z: 0 }, g => { for (const c of g.park.cars) assert.ok(inside(c), 'a car left the rink'); quickest = Math.max(quickest, Math.hypot(g.park.cars[0].vx, g.park.cars[0].vz)); });
  assert.ok(quickest > 5, `flat out it does ${quickest.toFixed(1)} m/s`);
  assert.ok(s.player.x > x0 + 1.5, 'the car goes where you push'); assert.ok(bumps(log).some(e => e.car === 0 && e.wall), 'it bounced off the rim');
  assert.ok(Math.abs(s.player.y + PLAYER_EYE - PARK.bumpers.seat) < 1e-9, 'seated low');
  const more = run(s, 10, { x: -1, z: 0.4 }); assert.ok(bumps([...log, ...more]).some(e => e.car === 0 && !e.wall), 'and bumped another car');
  assert.ok(Math.max(...s.park.cars.map(c => Math.hypot(c.vx, c.vz))) <= PARK.bumpers.top + 1e-6);
  parkInteract(s); assert.equal(s.park.riding, null); assert.deepEqual([s.player.x, s.player.z], [q.x, q.z]);
  at(s, 'bumpers'); parkInteract(s); run(s, PARK.bumpers.time + 0.2); assert.equal(s.park.riding, null, 'the turn ends by itself after half a minute');
});

test('rapids: board at the dock, follow the boat, look freely and return to the dock', () => {
  const s = game(), dock = at(s, 'rapids');
  assert.equal(parkPrompt(s).kind, 'ride');
  assert.ok(parkInteract(s));
  assert.equal(s.player.seat.id, 'rapids');
  let peak = 0;
  const log = run(s, PARK.rapids.time + .05, {}, ({park, player}) => {
    if (!park.riding) return;
    const point = RAPIDS.at(park.boatU);
    assert.ok(Math.hypot(player.x - point.x, player.z - point.z) < 1e-7);
    assert.ok(player.seat.turn <= PARK.rapids.maxTurn + 1e-7);
    peak = Math.max(peak, player.y + PLAYER_EYE);
  });
  assert.ok(peak > 5.5);
  assert.equal(parks(log).filter(e => e.what === 'splash').length, 1);
  assert.equal(s.park.riding, null);
  assert.deepEqual([s.player.x, s.player.z], [dock.x, dock.z]);
  parkInteract(s); run(s, 2); parkInteract(s);
  assert.deepEqual([s.player.x, s.player.z, s.player.seat], [dock.x, dock.z, null]);
  assert.equal(s.park.boatU, 0);
  s.park.watch = true;
  assert.equal(parkPrompt(s).zh, '放船');
  parkInteract(s); run(s, 2);
  assert.ok(s.park.boatU > 0);
  assert.deepEqual([s.player.x, s.player.z, s.player.seat], [dock.x, dock.z, null]);
});

test('game stalls: player aims, misses spend a ball, hits count once, and rounds reset', () => {
  const s = game();
  const shot = (target) => {
    const round = s.park.stall, stall = STALLS.find(stall => stall.id === round.id);
    const origin = { x: s.player.x, y: PLAYER_EYE, z: s.player.z };
    const p = target == null ? { x: origin.x, y: origin.y + 1, z: origin.z } : stallTarget(stall, target, round.time + .24);
    const dx = p.x - origin.x, dy = p.y - origin.y, dz = p.z - origin.z, n = Math.hypot(dx,dy,dz);
    return fireStall(s, { origin, direction: { x:dx/n, y:dy/n, z:dz/n } });
  };
  at(s, 'stall-blocks'); assert.ok(parkInteract(s));
  const standing = [s.player.x, s.player.z];
  run(s, 2, { x: -1 });
  assert.deepEqual([s.player.x, s.player.z], standing, 'a round stays at the shooting line');
  assert.equal(s.park.stall.left, STALL_SHOTS, 'no automatic throws');
  assert.ok(shot(null)); assert.equal(shot(1), false, 'only one woolball in flight');
  run(s, .4); assert.equal(s.park.stall.score, 0);
  assert.equal(s.park.stall.left, STALL_SHOTS - 1);
  assert.ok(shot(1)); run(s, .4);
  assert.ok(s.park.stall.score > 1, 'bottom block topples supported blocks');
  parkInteract(s); assert.equal(s.park.stall, null);
  parkInteract(s); assert.equal(s.park.stall.score, 0, 'replay resets the stack');
  parkInteract(s);
  for (const id of ['ducks', 'balloons']) {
    at(s, 'stall-' + id); parkInteract(s);
    assert.ok(shot(0)); run(s, .4); assert.equal(s.park.stall.score, 1);
    assert.ok(shot(0)); run(s, .4); assert.equal(s.park.stall.score, 1, 'fallen targets do not score twice');
    while (s.park.stall.left) { assert.ok(shot(null)); run(s, .4); }
    assert.ok(s.park.stall.done); assert.equal(shot(1), false);
    parkInteract(s); assert.equal(s.park.stall, null);
  }
});

test('the big top has no movement without input and keeps normal controls while the show plays', () => {
  const s = game();
  // This point overlaps a perimeter collider. The old push-out could displace the stationary player.
  Object.assign(s.player, { x: 1.7, z: 7.6 });
  run(s, 1); assert.deepEqual([s.player.x,s.player.z],[1.7,7.6]);
  Object.assign(s.player, {x:0, z:9});
  run(s, 2, {z:-1}); assert.ok(s.player.z < 5, 'the entrance is walkable');
  const stop = [s.player.x,s.player.z];
  run(s, 1); assert.deepEqual([s.player.x,s.player.z],stop);
});

test('the haunted house: shut until you knock, then you can walk in, ring the bell to bring the ghosts out, and the door never shuts on you', () => {
  const s = game(), inside = { x: HAUNT.door.x, z: HAUNT.door.z + 0.6 }, porch = { x: HAUNT.door.x, z: HAUNT.door.z - 0.7 };
  const walk = (from, to, open) => { const p = { ...to }; constrainTourWalk(p, from.x, from.z, open); return p; };
  assert.deepEqual(walk(porch, inside, false), porch, 'a shut door keeps you on the porch');
  assert.equal(walk(porch, { x: -9, z: -18.4 }, true).z, porch.z, 'even with the door open you cannot walk through the front wall (you slide along it)');
  at(s, 'haunt'); assert.equal(parkPrompt(s).zh, '敲门'); parkInteract(s);
  assert.equal(s.park.running.portraits, 0, 'knocking alone does not bring the ghosts out');
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
  parkInteract(s); assert.ok(s.park.running.portraits > 0, 'the ghosts come out'); assert.equal(parkPrompt(s), null, 'the bell cannot be rung again while the ghosts are out');
  run(s, PARK.haunt.show + 20); assert.equal(s.park.door, 1, 'still open half a minute later, while you are inside'); assert.equal(parkPrompt(s).id, 'portraits', 'and the bell can be rung again');
  at(s, 'carousel'); run(s, 2); assert.equal(s.park.door, 0, 'it shuts once you have walked away');
  at(s, 'haunt'); assert.equal(parkPrompt(s).zh, '敲门', 'and can be knocked on again');
});

test('the gate and the carousel are solid: you go in under the arch, not through a tower, and you stop at the carousel steps', () => {
  for (const q of SPOTS) for (const c of L.furnitureBoxes) assert.ok(!(q.x > c.minX && q.x < c.maxX && q.z > c.minZ && q.z < c.maxZ), `${q.id} is inside ${c.id}`);
  const walk = (x, z, seconds, dx, dz) => { const w = game(); w.player.x = x; w.player.z = z; run(w, seconds, { x: dx, z: dz }); return w.player; };
  const through = walk(L.player.x, L.player.z, 4, 0, -1); assert.ok(through.z < GATE.z - 1, `from the start you walk straight in under the arch (z = ${through.z.toFixed(2)})`);
  for (const side of [-1, 1]) { const p = walk(GATE.x + side * GATE.half, GATE.z + 2.4, 4, 0, -1); assert.ok(p.z > GATE.z + 0.7, `the ${side < 0 ? 'west' : 'east'} tower stops you (z = ${p.z.toFixed(2)})`); }
  const booth = walk(GATE.booth.x, GATE.booth.z + 2.6, 4, 0, -1); assert.ok(booth.z > GATE.booth.z + 1.2, `the ticket booth stops you at its counter (z = ${booth.z.toFixed(2)})`);
  const spot = SPOTS.find(q => q.id === 'carousel'), p = walk(spot.x, spot.z, 5, 0, -1), away = Math.hypot(p.x - CAROUSEL.x, p.z - CAROUSEL.z);
  assert.ok(away > CAROUSEL.platform, `walking at the carousel you stop outside its platform (${away.toFixed(2)} m from the centre)`);
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, x = CAROUSEL.x + Math.sin(a) * (CAROUSEL.platform - 0.25), z = CAROUSEL.z + Math.cos(a) * (CAROUSEL.platform - 0.25);
    assert.ok(L.furnitureBoxes.some(c => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ), 'the round platform is covered all the way round'); }
});

test('playing the rides never ends the level: that takes the clown', () => {
  const s = game();
  for (const id of ['carousel', 'haunt', 'portraits']) { at(s, id); assert.ok(parkInteract(s), id); }
  at(s, 'stall-balloons'); parkInteract(s); parkInteract(s);
  for (const id of ['coaster', 'rapids', 'wheel', 'bumpers']) { at(s, id); parkInteract(s); parkInteract(s); }
  run(s, PARK.carousel.time + 1);
  assert.equal(missionStatus(s).done, false); assert.equal(s.phase, 'playing');
});

console.log(`${checks} park ride checks passed`);
