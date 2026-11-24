import { lineOfSight } from './level.js';

function alternateEntry(s, squad, entries, next) {
  const p = s.player, eye = { x:p.x, y:p.y + 1.2, z:p.z };
  const preferred = entries[(next - 1) % entries.length];
  let entry = preferred, bestCost = Infinity, bestDistance = -Infinity;
  for (const points of [preferred, ...entries.filter(points => points !== preferred)]) {
    let exposed = 0, nearest = Infinity;
    for (let i = 0; i < squad.length; i++) {
      const [x,z] = points[i];
      nearest = Math.min(nearest, Math.hypot(x - p.x, z - p.z));
      if (lineOfSight(s.level, eye, { x, y:squad[i].base + .9, z })) exposed++;
    }
    // A player on top of one entrance should get the other group in front of them.
    const cost = exposed + (nearest < 3.5 ? squad.length + 1 : 0);
    if (cost < bestCost || (cost === bestCost && cost >= squad.length + 1 && nearest > bestDistance)) {
      entry = points;
      bestCost = cost;
      bestDistance = nearest;
    }
  }
  return entry;
}

export function advanceWaves(s) {
  const { waves } = s.level, wave = s.wave;
  const next = wave.index + 1;
  if (next >= waves.count || s.enemies.some(enemy => enemy.enabled && enemy.alive)) return;
  // Let any attack already in flight finish before starting the reload window.
  if (s.enemyShots.length || s.enemyBombs.length) return;
  if (wave.nextAt === null) {
    wave.nextAt = s.time + waves.breakSeconds;
    return;
  }
  if (s.time < wave.nextAt) return;

  const squad = s.enemies.filter(enemy => enemy.wave === next && enemy.alive);
  const p = s.player;
  const entry = waves.entries?.length ? alternateEntry(s, squad, waves.entries, next) : null;
  squad.forEach((enemy,i) => {
    if (entry) [enemy.x,enemy.z]=entry[i];
    enemy.heading = Math.atan2(p.x-enemy.x,p.z-enemy.z);
    enemy.enabled = true;
  });
  wave.index = next;
  wave.nextAt = null;
  s.events.push({ type:'wave-start', index:next });
}
