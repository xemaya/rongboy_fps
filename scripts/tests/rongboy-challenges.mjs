import assert from 'node:assert/strict';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame, step, fire, selectWeapon, consumeEvents, PISTOL, WEAPONS } from '../../scenes/rongboy-mission/game.js';
import { ATTACKS } from '../../scenes/rongboy-mission/attacks.js';
import { CHALLENGES, hasStamp, saveStamp } from '../../scenes/rongboy-mission/challenges.js';
import { challengeArena } from '../../scenes/rongboy-mission/levels/challenge-arenas.js';

const dt = 1 / 120;
const round = index => createGame({ level: compileLevel(challengeArena(CHALLENGES[index])) });
function advance(state, seconds, input = {}) {
  for (let frame = 0; frame < Math.ceil(seconds / dt) && state.phase === 'playing'; frame++) step(state, dt, input);
  return consumeEvents(state);
}
function shoot(state, yaw) {
  const x = -Math.sin(yaw), z = -Math.cos(yaw);
  assert.ok(fire(state, 0, { origin: { x: state.player.x + x * .63, y: 1.06, z: state.player.z + z * .63 }, direction: { x, y: 0, z } }));
}
function aimAt(state, target) {
  shoot(state, Math.atan2(state.player.x - target.x, state.player.z - target.z));
}

const direct = round(0);
shoot(direct, direct.level.player.yaw);
assert.ok(advance(direct, 1).some(event => event.type === 'blocked'));
assert.equal(direct.challenge.progress, 0);
const bank = round(0);
shoot(bank, bank.level.player.yaw - 9 * Math.PI / 180);
advance(bank, 1.75);
assert.equal(bank.phase, 'won', 'a real bank shot can win without clearing the yard');
assert.equal(bank.challenge.progress, 1);
assert.equal(bank.enemies[0].alive, true);

function zapThenFinishFirst() {
  const state = round(1);
  assert.equal(WEAPONS[state.weapon].id, 'stun');
  aimAt(state, state.enemies[0]);
  assert.equal(advance(state, 0.56).find(event => event.type === 'zap').struck.length, 2);
  assert.equal(state.challenge.progress, 0, 'stun alone is not a follow-up');
  assert.ok(selectWeapon(state, PISTOL));
  aimAt(state, state.enemies[0]);
  advance(state, 0.41);
  assert.equal(state.challenge.progress, 1);
  return state;
}
const combo = zapThenFinishFirst();
aimAt(combo, combo.enemies.find(enemy => enemy.alive));
advance(combo, 0.6);
assert.equal(combo.phase, 'won');
assert.equal(combo.challenge.progress, 2);
const expired = zapThenFinishFirst();
advance(expired, 2.1);
assert.equal(expired.phase, 'lost', 'one knockout followed by an expired stun does not count');

const still = round(2);
advance(still, 2.2);
assert.equal(still.challenge.progress, 0, 'an aiming tell is not a dodge');
advance(still, 4);
assert.equal(still.phase, 'lost');
assert.equal(still.damageTaken, 1);

const dodge = round(2);
const { windup, lock } = ATTACKS.archer;
let side = 1, locked = false, moveUntil = 0, releases = 0;
while (dodge.phase === 'playing') {
  const archer = dodge.enemies[0];
  const red = archer.action === 'archer-aim' && archer.actionAge >= windup - lock;
  if (red && !locked) {
    moveUntil = dodge.time + 0.48;
    side = -side;
  }
  locked = red;
  const events = advance(dodge, dt, { x: dodge.time < moveUntil ? side : 0 });
  releases += events.filter(event => event.type === 'enemy-shot').length;
}
assert.equal(dodge.phase, 'won');
assert.equal(dodge.damageTaken, 0);
assert.equal(dodge.challenge.progress, 3);
assert.equal(releases, 3, 'only resolved arrows counted, once each');

const timeout = round(1);
timeout.time = timeout.challenge.spec.seconds;
advance(timeout, dt);
assert.equal(timeout.phase, 'lost');
assert.match(timeout.challenge.failure, /时间/);

const saved = new Map();
globalThis.localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
for (const { id } of CHALLENGES) assert.equal(hasStamp(id), false);
assert.equal(saveStamp(CHALLENGES[0].id), true);
assert.equal(saveStamp(CHALLENGES[2].id), true);
assert.deepEqual(CHALLENGES.map(({ id }) => hasStamp(id)), [true, false, true]);
console.log('PASS challenge arenas, authentic success/failure, and independent stamps');
