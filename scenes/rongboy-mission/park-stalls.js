import { STALLS } from './park-tour-layout.js';

export const STALL_SHOTS = 5;
const FLIGHT_TIME = .24;
const HIT_RADIUS = { blocks: .235, ducks: .28, balloons: .24 };

export function stallTarget(stall, index, time) {
  const [dy, dz] = stall.targets[index];
  const x = stall.x - (stall.id === 'balloons' ? 1.06 : .95);
  const y = 1.19 + dy, z = stall.z + dz;
  if (stall.id === 'ducks') return { x, y: y + .05 * Math.sin(time * 4 + index), z: z + .26 * Math.sin(time * 2.2 + index) };
  if (stall.id === 'balloons') return { x, y: y + .06 * Math.sin(time * 2.6 + index), z: z + .07 * Math.sin(time * 2 + index) };
  return { x, y, z };
}

export function startStall(s, id) {
  const stall = STALLS.find(stall => stall.id === id);
  s.park.stall = { id, time: 0, left: STALL_SHOTS, score: 0, hitAt: stall.targets.map(() => null), flight: null, last: null, done: false };
  s.player.vx = s.player.vz = s.player.jump = s.player.jumpV = 0;
  s.events.push({ type: 'park', what: 'stall-start', id });
}

export function leaveStall(s) {
  const { id } = s.park.stall;
  s.park.stall = null;
  s.events.push({ type: 'park', what: 'stall-leave', id });
}

export function fireStall(s, aim) {
  const round = s.park?.stall;
  if (s.phase !== 'playing' || !round || !round.left || round.flight || round.done) return false;
  const stall = STALLS.find(stall => stall.id === round.id);
  const { x, y, z } = aim.origin, { x: dx, y: dy, z: dz } = aim.direction;
  // Capture the aim once. Judge moving targets at arrival so their visuals and hitboxes agree.
  let length = 9, target = -1;
  for (let i = 0; i < stall.targets.length; i++) {
    if (round.hitAt[i] !== null) continue;
    const at = stallTarget(stall, i, round.time + FLIGHT_TIME);
    const ox = at.x - x, oy = at.y - y, oz = at.z - z;
    const along = ox * dx + oy * dy + oz * dz;
    const wide = ox * ox + oy * oy + oz * oz - along * along;
    const r = HIT_RADIUS[stall.id];
    if (along <= 0 || along >= length || wide > r * r) continue;
    length = along;
    target = i;
  }
  if (target < 0 && dx < -.01) length = Math.min(length, Math.max(.6, (stall.x - 1.27 - x) / dx));
  round.left--;
  round.flight = {
    start: round.time, end: round.time + FLIGHT_TIME, target,
    from: { x: x + dx * .48, y: y + dy * .48 - .19, z: z + dz * .48 - .16 },
    to: { x: x + dx * length, y: y + dy * length, z: z + dz * length },
  };
  s.events.push({ type: 'park', what: 'stall-shot', id: stall.id });
  return true;
}

export function stepStall(s, dt) {
  const round = s.park.stall;
  round.time += dt;
  const shot = round.flight;
  if (!shot || round.time < shot.end) return;
  round.flight = null;
  const stall = STALLS.find(stall => stall.id === round.id);
  const hits = shot.target < 0 ? [] : [shot.target];
  if (hits.length && stall.id === 'blocks') {
    const [baseY, baseZ] = stall.targets[shot.target];
    stall.targets.forEach(([y, z], i) => {
      if (round.hitAt[i] === null && y > baseY && Math.abs(z - baseZ) < .4) hits.push(i);
    });
  }
  for (const i of hits) round.hitAt[i] = round.time;
  round.score += hits.length;
  round.last = { at: round.time, count: hits.length };
  round.done = !round.left || round.score === stall.targets.length;
  s.events.push({ type: 'park', what: hits.length ? 'stall-hit' : 'stall-miss', id: stall.id });
}
