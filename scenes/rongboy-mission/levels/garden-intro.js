import { gardenWallDef } from './garden-wall.js';

export function gardenIntroDef() {
  const garden = gardenWallDef();
  return {
    ...garden, id: 'garden-intro', name: '花园首战', par: 140,
    player: { ...garden.player, yaw: 0 },
    mission: { type: 'clear', title: '清空花园' },
    texts: { short: '花园首战', won: '花园清理完毕！' },
    enemies: [
      { type: 'walker', x: 0, z: 7.4, state: 'asleep', heading: Math.PI },
      { type: 'walker', x: 1, z: 6.9, state: 'asleep', heading: Math.PI, enabled: false },
      { ...garden.enemies[0], state: 'idle', enabled: false },
    ],
  };
}

// Disabled waves still count toward the clear objective. Enable the next one
// only after the previous encounter ends so the start never becomes a mob.
export function advanceGardenIntro(state) {
  if (state.enemies.some(enemy => enemy.alive && enemy.enabled)) return null;
  const next = state.enemies.find(enemy => enemy.alive && !enemy.enabled);
  if (next) next.enabled = true;
  return next ?? null;
}
