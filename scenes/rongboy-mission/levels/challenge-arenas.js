import { gardenWallDef } from './garden-wall.js';
import { trainingDef } from './training.js';

// Short variants of the existing practice yards, with the required targets and loadout ready at spawn.
export function challengeArena(challenge) {
  const { id, name, goal, hint, seconds } = challenge;
  const mission = { type: 'challenge', challenge, title: goal };
  const texts = { short: name, hint, won: '挑战完成' };
  if (id === 'shield-bank') {
    const garden = gardenWallDef();
    return { ...garden, id, name, mission, texts, par: seconds, enemies: garden.enemies.filter(enemy => enemy.type === 'shielded') };
  }
  const yard = trainingDef('archer');
  yard.rooms[0].name = '试战庭院';
  if (id === 'static-followup') {
    return {
      ...yard, id, name, mission, texts, par: seconds, pickups: [],
      player: { x: -.75, z: 4.2, yaw: 0 },
      arsenal: ['single', 'stun'], startWeapon: 'stun',
      enemies: [
        { type: 'leaper', x: -.75, z: .35, state: 'asleep', heading: 0 },
        { type: 'leaper', x: .8, z: -.1, state: 'asleep', heading: 0 },
      ],
    };
  }
  return { ...yard, id, name, mission, texts, par: seconds, arsenal: ['single'], pickups: [] };
}
