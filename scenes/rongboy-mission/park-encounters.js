import { isHauntWalkable } from './park-tour-layout.js';

export const PARK_WAVE_COUNT = 3;
export const parkEncounter = () => ({ index: -1, nextAt: null });

const FIRST_WARNING = .85, BETWEEN_WAVES = 1.1, MIN_SPAWN_DISTANCE = 3.2;

function canStart(s, zone, next, taskDone) {
  if (s.park.riding || s.park.stall) return false;
  const { amusement: a, player: p } = s;
  // Leave the arch behind so the first wave cannot pin a player who has just crossed it.
  if (zone === 'carousel') return next === 0 ? p.x < -18.3 : a.carousel.used;
  if (zone === 'haunt') return taskDone && !isHauntWalkable(p.x, p.z);
  return taskDone;
}

export function advanceParkEncounter(s, zone, taskDone, spawn) {
  const a = s.amusement, encounter = a.encounter, next = encounter.index + 1;
  if (next >= PARK_WAVE_COUNT || s.enemies.some(e => e.alive && e.zone === a.zone)) return;
  if (s.enemyShots.length || s.enemyBombs.length || !canStart(s, zone, next, taskDone)) {
    encounter.nextAt = null;
    return;
  }
  const squad = s.dormant.filter(e => e.zone === a.zone && e.wave === next);
  if (!squad.length) return;
  if (encounter.nextAt === null) {
    encounter.nextAt = s.time + (next === 0 ? FIRST_WARNING : BETWEEN_WAVES);
    s.events.push({ type:'amusement', action:'wave-warning', wave:next });
    return;
  }
  if (s.time < encounter.nextAt) return;

  // Keep each authored lane if possible. A player standing on it gets a farther, empty spot in the same zone.
  const p = s.player, used = [], minimum = next === 0 ? 4.5 : MIN_SPAWN_DISTANCE;
  const distance = point => Math.hypot(p.x - point.x, p.z - point.z);
  const spare = s.level.enemies.filter(e => e.zone === a.zone).sort((a,b) => distance(b) - distance(a));
  const unoccupied = point => !used.some(at => Math.hypot(at.x - point.x, at.z - point.z) < 1);
  for (const foe of squad) {
    const at = distance(foe) >= minimum && unoccupied(foe)
      ? foe : spare.find(point => distance(point) >= minimum && unoccupied(point))
        ?? spare.find(unoccupied) ?? foe;
    used.push(at);
    spawn(s, { ...foe, x:at.x, z:at.z, heading:Math.atan2(p.x - at.x, p.z - at.z) });
  }
  s.dormant = s.dormant.filter(e => e.zone !== a.zone || e.wave !== next);
  encounter.index = next;
  encounter.nextAt = null;
  s.events.push({ type:'amusement', action:'wave-start', wave:next, count:squad.length });
}
