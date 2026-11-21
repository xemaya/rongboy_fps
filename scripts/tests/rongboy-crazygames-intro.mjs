import assert from 'node:assert/strict';
import { createGame, fire, step, consumeEvents, missionStatus } from '../../scenes/rongboy-mission/game.js';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { gardenIntroDef, advanceGardenIntro } from '../../scenes/rongboy-mission/levels/garden-intro.js';
import { GARDEN_BOARD } from '../../scenes/rongboy-mission/levels/garden-wall.js';

const state = createGame({ level:compileLevel(gardenIntroDef()) });
const [first, second, shield] = state.enemies;
assert.deepEqual(state.enemies.map(enemy => enemy.enabled), [true,false,false]);
assert.equal(advanceGardenIntro(state),null);
const origin = {x:0,y:1.15,z:10};
function drawShot(power, direction) {
  state.cooldown = 0;
  assert.ok(fire(state,power,{origin,direction}));
  const events = [];
  for (let i = 0; i < 180 && state.phase === 'playing'; i++) {
    step(state,1/120);
    events.push(...consumeEvents(state));
  }
  return events;
}
assert.ok(drawShot(0,{x:0,y:0,z:-1}).some(e=>e.type==='hit' && e.id===first.id));
assert.equal(first.alive,false);
assert.equal(missionStatus(state).done,false);
assert.equal(advanceGardenIntro(state),second);
const bank = drawShot(0,{x:.79,y:.05,z:4.32-origin.z});
assert.ok(bank.some(e=>e.type==='hit' && e.id===second.id && e.afterSurface===GARDEN_BOARD));
assert.equal(second.alive,false);
assert.equal(missionStatus(state).done,false);
assert.equal(advanceGardenIntro(state),shield);
const shieldDx = shield.x-origin.x, shieldDz = shield.z-origin.z;
assert.ok(drawShot(1,{x:shieldDx,y:.01,z:shieldDz}).some(e=>e.type==='guard-break'));
state.invul = 30;
for (let shot = 0; shot < 3 && state.phase === 'playing' && shield.alive; shot++) {
  const current = {x:shield.x-origin.x,y:0,z:shield.z-origin.z};
  drawShot(1,current);
}
assert.equal(shield.alive,false);
for (let tick = 0; tick < 240 && state.phase === 'playing'; tick++) step(state,1/120);
assert.equal(state.phase,'won');
console.log('PASS tutorial waves, real ricochet, charge break and round completion');
