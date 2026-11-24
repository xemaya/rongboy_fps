// 几样不认识具体关卡的基建：分段过门（stages.js）、能被急冻枪定住的机关（mech.js）、轨道走向（track.js 的 planTrack）、量开销（debug-cost.js）。
//   node scripts/tests/rongboy-stages.mjs
import assert from 'node:assert/strict';
import { makeMech, mechState, stepMech, mechSlide, hitMech } from '../../scenes/rongboy-mission/mech.js';
import { GATE_LIFT_SECONDS, gateOnPath, makeStages, gatePassable, stageStart, pastGate, advanceStages } from '../../scenes/rongboy-mission/stages.js';
import { planTrack, closedTrack } from '../../scenes/rongboy-mission/track.js';
import { costPoints, createCostSweep } from '../../scenes/rongboy-mission/debug-cost.js';
import { trackReport } from '../track.mjs';
import { checkMap } from '../../scenes/rongboy-mission/mapkit/check.js';
import park from '../../scenes/rongboy-mission/levels/amusement.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }

test('a mechanism slides until frozen, stays where it was caught, and thaws by itself', () => {
  const m = makeMech(); let time = 0;
  const tick = (seconds, speed = 2) => { let thawed = 0; for (let i = 0; i < seconds * 60; i++) { time += 1 / 60; if (stepMech(m, 1 / 60, time, speed)) thawed++; } return thawed; };
  tick(.4); const before = mechSlide(m, 1.5); assert.ok(before > .5 && before <= 1.5);
  assert.equal(hitMech(m, time, true, { hold: 2, amp: 1.5 }), 'frozen'); assert.equal(mechState(m, time), 'frozen');
  assert.equal(tick(1), 0); assert.equal(mechSlide(m, 1.5), before, 'it does not move while frozen');
  assert.equal(tick(1.2), 1, 'thawing is reported once'); assert.equal(mechState(m, time), 'moving'); assert.notEqual(mechSlide(m, 1.5), before);
});

test('what a hit does depends on how the level set the mechanism up', () => {
  const latch = makeMech();   // 门栓：要先冻住
  assert.equal(hitMech(latch, 0, false), 'block'); assert.equal(latch.done, false);
  assert.equal(hitMech(latch, 0, true), 'frozen'); assert.equal(hitMech(latch, 1, true), 'frozen', 'freezing again restarts the clock');
  assert.ok(latch.frozenUntil > 4);
  assert.equal(hitMech(latch, 2, false), 'done'); assert.equal(mechState(latch, 2), 'done'); assert.equal(hitMech(latch, 3, false), null, 'done is done');
  const target = makeMech();   // 靶子：打中就算；车上来不及换枪，急冻枪连打两发也算
  assert.equal(hitMech(target, 0, true, { other: 'always', iceTwice: true }), 'frozen');
  assert.equal(hitMech(target, 1, true, { other: 'always', iceTwice: true }), 'done');
  assert.equal(hitMech(makeMech(), 0, false, { other: 'always' }), 'done');
  const valve = makeMech();   // 阀门：别的枪永远打不动，办成要靠别的（按键）
  assert.equal(hitMech(valve, 0, true, { other: 'never', hold: 5 }), 'frozen');
  assert.equal(hitMech(valve, 1, false, { other: 'never' }), 'block'); assert.equal(valve.done, false);
  const past = makeMech(true); assert.equal(mechState(past, 0), 'done'); assert.equal(stepMech(past, 1, 1, 3), false); assert.equal(past.phase, 0);
});

const path = Array.from({ length: 41 }, (_, i) => ({ x: i, z: 0, width: 1.5 }));   // 一条朝 +x 的直路，半宽 1.5 米
const gates = [gateOnPath(path, 10.2, .4), gateOnPath(path, 25, -1)];

test('a gate sits on the path, facing along it', () => {
  assert.deepEqual(gates[0], { x: 10, z: 0, tx: 1, tz: 0, width: 3 });
  assert.ok(pastGate(gates[0], 8, 0) < 0 && pastGate(gates[0], 12, 0) > 0);
  assert.equal(stageStart(gates, 0), null); assert.deepEqual(stageStart(gates, 1), { x: 11.3, z: 0 });
});

test('a closed gate holds you back; it opens when the stage is done, and walking through moves you to the next stage', () => {
  const st = makeStages(gates), p = { x: 5, z: 0 }; let time = 0, log = [];
  const walk = (seconds, ready = false, carried = false) => { for (let i = 0; i < seconds * 60; i++) { time += 1 / 60; p.x += 3 / 60; const what = advanceStages(st, gates, p, time, { ready, carried }); if (what) log.push(what); } };
  assert.deepEqual(st, { zone: 0, opened: [null, null], lit: [false, false, false] });
  walk(3); assert.ok(p.x < 10 && p.x > 9.5, 'stopped just short of the gate'); assert.equal(st.zone, 0); assert.deepEqual(log, []);
  walk(.2, true); assert.deepEqual(log, ['open']); assert.ok(st.lit[0]); assert.equal(gatePassable(st, 0, time), false, 'the gate takes a moment to swing open'); assert.ok(p.x < 10);
  walk(GATE_LIFT_SECONDS + .5, true); assert.equal(st.zone, 1);
  assert.deepEqual(log, ['open', 'enter', 'open'], 'once through, ready is asked about the stage you are in now');
  const flown = makeStages(gates), q = { x: 9, z: 0 };
  for (let i = 0; i < 120; i++) { q.x += .05; advanceStages(flown, gates, q, i / 60, { ready: false, carried: true }); }
  assert.equal(flown.zone, 0); assert.ok(q.x > 14, 'carried over a closed gate (on a ride) you are neither stopped nor counted through');
  const later = makeStages(gates, 2); assert.equal(later.zone, 2); assert.ok(gatePassable(later, 0, 0) && gatePassable(later, 1, 0) && later.lit[1] && !later.lit[2]);
});

test('a track plan made of lines and arcs comes back to where it started, with evenly spaced points', () => {
  const plan = planTrack({ start: [0, 0], heading: 0, step: 1.2,
    moves: [['line', 6], ['mark', 'a'], ['arc', 3, 90], ['until', 'z', 9], ['arc', 3, 90], ['until', 'x', 3], ['mark', 'b'], ['arc', 3, 90], ['until', 'z', 3], ['arc', 3, 90]],
    heights: (m, total) => [[0, 1], [m.a, 1], [m.b, 4], [total, 1]] });
  assert.ok(Math.hypot(plan.end.x, plan.end.z) < 3.2 && Math.abs((plan.end.heading % 360 + 360) % 360) < 1e-6, 'a rounded rectangle ends heading the way it set out');
  const gaps = plan.points.slice(1).map((p, i) => Math.hypot(p[0] - plan.points[i][0], p[2] - plan.points[i][2]));
  assert.ok(Math.min(...gaps) > .8 && Math.max(...gaps) < 1.7, `control points are evenly spaced (${Math.min(...gaps).toFixed(2)}–${Math.max(...gaps).toFixed(2)} m)`);
  const ys = plan.points.map(p => p[1]); assert.ok(Math.max(...ys) <= 4 && Math.min(...ys) >= 1, 'heights never overshoot their key points');
  assert.ok(Math.abs(closedTrack(plan.points, 6).length - plan.length) < 1.2);
  assert.throws(() => planTrack({ start: [0, 0], heading: 0, moves: [['loop', 3]], heights: () => [[0, 0], [1, 0]] }));
});

test('the park coaster, as planned, clears everything it has to clear', () => {
  const r = trackReport();
  assert.deepEqual(r.problems, []);
  assert.ok(r.length > 90 && r.slope < 40 && r.fastest < 10.2 && r.seconds > 18 && r.seconds < 28);
});

test('the cost sweep stands at every point, looks every way, and can be done in slices', () => {
  const pts = costPoints({}, Array.from({ length: 21 }, (_, i) => ({ x: i, z: 0 })), 4.5);
  assert.deepEqual(pts.map(p => p[0]), [0, 5, 10, 15, 20]);
  const rooms = costPoints({ player: { x: 1, z: 2 }, storeys: [{ rooms: [{ minX: 0, maxX: 4, minZ: 0, maxZ: 2 }] }, { rooms: [{ minX: 0, maxX: 2, minZ: 4, maxZ: 8 }] }] });
  assert.deepEqual(rooms, [[1, 2, 0], [2, 1, 0], [1, 6, 1]]);
  let clock = 0; const seen = [];
  const sweep = createCostSweep({ points: pts, turns: 4, now: () => clock, look: (x, z, yaw) => { clock += 10; seen.push([x, yaw]); return { calls: 100 + x * 2 + (yaw > 3 ? 7 : 0), tris: 1000 - x }; } });
  assert.deepEqual(sweep.step(60), { at: 2, of: 5 }, 'out of time: says how far it got');
  const done = sweep.step(1e6);
  assert.equal(done.views, 20); assert.equal(seen.length, 20);
  assert.deepEqual(done.worstCalls[0], [147, 980, 20, 0, 2]); assert.deepEqual(done.worstTris.slice(0, 3), [100, 1000, 0]);
});

test('the map check knows path maps: the park passes, and each kind of mistake is named', () => {
  const codes = def => checkMap(def).errors.map(e => e.code);
  const report = checkMap(park);
  assert.deepEqual(report.errors, []);
  assert.ok(report.warnings.every(w => w.code === 'enemy-untested'), 'only the crawler playtest advisories remain');
  const withPath = change => ({ ...park, path: { ...park.path, ...change } });
  assert.deepEqual(codes({ ...park, enemies: [...park.enemies, { type: 'walker', x: -10, z: 10, state: 'idle', zone: 1 }] }), ['path-enemy'], 'a zombie on the lawn');
  assert.deepEqual(codes({ ...park, enemies: [{ ...park.enemies[0], zone: 3 }, ...park.enemies.slice(1)] }), ['path-enemy-stage'], 'a zombie counted for a stop it does not stand in');
  assert.deepEqual(codes({ ...park, pickups: [...park.pickups, { kind: 'potion', x: 12, z: -8 }] }), ['path-pickup']);
  assert.deepEqual(codes(withPath({ spots: park.path.spots.map(q => q.id === 'wheel' ? { ...q, stage: 2 } : q) })), ['path-spot']);
  assert.deepEqual(codes(withPath({ targets: [...park.path.targets, { id: 'too high', x: -13.4, y: 11, z: -9.5, stage: 3 }] })), ['path-target'], 'a target 11 m up and 13 m from the path');
  assert.ok(codes(withPath({ gates: park.path.gates.map((g, i) => i === 2 ? { ...g, x: g.x + 9 } : g) })).includes('path-gate'), 'a gate moved off the path');
  const withoutMidway = withPath({ spots: park.path.spots.filter(q => q.stage !== 6) });
  withoutMidway.enemies = park.enemies.filter(e => e.zone !== 6);
  const idle = checkMap(withoutMidway).warnings.filter(w => w.code !== 'enemy-untested');
  assert.deepEqual(idle.map(w => w.code), ['path-idle'], 'a stop with nothing to do');
});

console.log(`${checks} stage, mechanism, track and cost checks passed`);
