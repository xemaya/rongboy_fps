import { lineOfSight } from './level.js';

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
  const p = s.player, eye = { x:p.x, y:p.y + 1.2, z:p.z };
  const preferred = waves.entries[(next - 1) % waves.entries.length];
  let entry = preferred, bestCost = Infinity, bestDistance = -Infinity;
  for (const points of [preferred, ...waves.entries.filter(points => points !== preferred)]) {
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
  squad.forEach((enemy,i) => {
    const [x,z] = entry[i];
    enemy.x = x; enemy.z = z;
    enemy.heading = Math.atan2(p.x - x, p.z - z);
    enemy.enabled = true;
  });
  wave.index = next;
  wave.nextAt = null;
  s.events.push({ type:'wave-start', index:next });
}
