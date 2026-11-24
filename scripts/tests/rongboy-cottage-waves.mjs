import assert from 'node:assert/strict';
import { cottageStudyDef } from '../../scenes/rongboy-mission/levels/cottage-study.js';
import orchard from '../../scenes/rongboy-mission/levels/cottage.js';
import { compileLevel, freePoint, navRadius, routeTo } from '../../scenes/rongboy-mission/level.js';
import { consumeEvents, createGame, missionStatus, step } from '../../scenes/rongboy-mission/game.js';
import { advanceWaves } from '../../scenes/rongboy-mission/encounter-waves.js';

const level = compileLevel(cottageStudyDef('waves'));
const single = compileLevel(cottageStudyDef('all-at-once'));
const s = createGame({ level });
const simultaneous = createGame({ level:single });
const active = state => state.enemies.filter(enemy => enemy.alive && enemy.enabled);
const advance = (state, seconds) => {
  for (let tick = 0; tick < Math.round(seconds * 120); tick++) step(state,1/120);
};
const knockOutWave = state => { for (const enemy of active(state)) enemy.alive = false; };

assert.equal(s.total, 9);
assert.equal(simultaneous.wave, null);
assert.equal(active(simultaneous).length, 9);
assert.equal(active(s).length, 2);
for (const key of ['player','walls','furnitureBoxes','gadgets','pickups','arsenal']) assert.deepEqual(level[key],single[key]);
assert.deepEqual(level.enemies.map(({enabled,...enemy}) => enemy),single.enemies.map(({enabled,...enemy}) => enemy));

const ground = level.storeys[0];
for (const [x,z] of level.waves.entries.flat()) {
  const r = navRadius(.32);
  assert.ok(freePoint(ground,x,z,r) && routeTo(ground,{x,z},level.player,r).length, `arrival at ${x},${z} is walkable`);
}

knockOutWave(s);
assert.equal(missionStatus(s).done, false);
s.enemyShots.push({});
advanceWaves(s);
assert.equal(s.wave.nextAt,null,'wait for hostile projectiles before the intermission');
s.enemyShots.length = 0;
advance(s,.05);
assert.equal(active(s).length,0);
assert.ok(s.wave.nextAt > s.time + 2.9);

// Standing inside the first side entrance should send the next wave elsewhere.
const [x,z] = level.waves.entries[0][0];
Object.assign(s.player, { x,z });
advance(s, 2.9);
assert.equal(active(s).length, 0);
assert.equal(s.wave.index, 0);
advance(s, .12);
assert.equal(active(s).length,3);
assert.equal(s.wave.index,1);
assert.equal(consumeEvents(s).filter(event => event.type === 'wave-start').length,1);
assert.ok(active(s).every(enemy => Math.hypot(enemy.x - x,enemy.z - z) > 3.5));

knockOutWave(s);
advance(s,3.06);
assert.equal(active(s).length,4);
assert.equal(s.wave.index,2);
assert.equal(consumeEvents(s).filter(event => event.type === 'wave-start').length,1);
knockOutWave(s);
advance(s,1.5);
assert.equal(s.phase,'won');
assert.equal(active(createGame({level})).length,2);
console.log('PASS cottage wave trial: matched roster, reload windows, safe alternate entry, clear and restart');


// The campaign uses the same intermission but activates defenders in their
// authored zones, rather than moving them into the courtyard test entrances.
const farm=compileLevel(orchard), defense=createGame({level:farm});
assert.equal(farm.storeys.length,1);
assert.equal(defense.total,24);
assert.deepEqual([0,1,2].map(wave=>defense.enemies.filter(e=>e.wave===wave).length),[8,8,8]);
assert.ok(defense.enemies.filter(e=>e.enabled).every(e=>e.wave===0));
for(const stage of [1,2]) {
  for(const e of defense.enemies.filter(e=>e.enabled))e.alive=false;
  const waiting=defense.enemies.filter(e=>e.wave===stage);
  const positions=waiting.map(e=>[e.x,e.z]);
  step(defense,1/120);
  assert.ok(defense.wave.nextAt>defense.time);
  for(let i=0;i<Math.ceil(farm.waves.breakSeconds*60)+1;i++)step(defense,1/60);
  assert.equal(defense.wave.index,stage);
  assert.ok(waiting.every(e=>e.enabled));
  assert.ok(waiting.every((e,i)=>Math.hypot(e.x-positions[i][0],e.z-positions[i][1])<.18));
}
assert.ok(defense.enemies.some(e=>e.enabled&&e.alive&&e.type==='boss-leech'));
for(const e of defense.enemies)e.alive=false;
for(let i=0;i<120;i++)step(defense,1/60);
assert.equal(defense.phase,'won');
console.log('PASS orchard: three different zones, authored entry, final boss and clear');
