import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/amusement-whitebox.js';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { CONFIG, WEAPONS, createGame, fire, hurtPlayer, selectWeapon, step, consumeEvents } from '../../scenes/rongboy-mission/game.js';
import {
  VALVE, SWITCH, CAROUSEL, GATES, PLATFORM, RIVER, SAFE_PAD, FIRST_BOX, CLOWN, TILES, BALLOONS,
  COASTER_SECONDS, CLOWN_INTRO_SECONDS, VICTORY_CUTSCENE_SECONDS,
  lockPosition, coasterTargetPosition, parkHoleAt, useAmusement, amusementPrompt, gatePassable,
  amusementCutscene, skipAmusementCutscene,
} from '../../scenes/rongboy-mission/amusement.js';

const level = compileLevel(def), pistol = 0, freeze = WEAPONS.findIndex(w => w.id === 'freeze');
const fresh = (amusementCheckpoint = 0) => createGame({ level, amusementCheckpoint });
const run = (s, time, input = {}) => { for (let i = 0; i < Math.ceil(time * 120); i++) step(s, 1 / 120, input); };
const at = (s, x, z) => Object.assign(s.player, { x, z, vx: 0, vz: 0 });
function shot(s, { x, y, z }, power = 0) {
  if (s.reloading || !s.ammo[s.weapon].mag) run(s, 2.2);
  if (s.cooldown > 0) run(s, s.cooldown + .05);
  const origin = { x: s.player.x, y: s.player.y + s.player.jump + 1.23, z: s.player.z };
  assert.ok(fire(s, power, { origin, direction: { x: x - origin.x, y: y - origin.y, z: z - origin.z } }), 'a shot was fired');
}
function through(s, i) {
  const gate = GATES[i];
  at(s, gate.x, gate.z + .92); run(s, .65, { z: -1 });
  assert.equal(s.amusement.zone, i + 1);
}

// --- Zone 0: Oscillating latch (freeze -> thaw -> freeze -> shatter), balloon pop, freeze+shatter bonus ---
const s = fresh();
assert.equal(s.maxHealth, 100);
assert.equal(s.weapon, freeze);
assert.deepEqual(s.owned.flatMap((v, i) => v ? [WEAPONS[i].id] : []), ['single', 'freeze']);

// Closed gate blocks walking
at(s, GATES[0].x, GATES[0].z + .6); run(s, 1, { z: -1 });
assert.equal(s.amusement.zone, 0, 'closed passage blocks walking');

// Pop a roadside balloon
at(s, 3.0, 37.0);
shot(s, BALLOONS[0]); run(s, .4);
assert.equal(s.amusement.balloons[0], false, 'roadside balloon pops when shot');

// Verify latch oscillates, freezes for 3.5s, thaws back to closed, and then shatters with pistol
at(s, 0, 35.8);
const xBefore = lockPosition(s.amusement, s.time).x;
run(s, .45);
assert.notEqual(lockPosition(s.amusement, s.time).x, xBefore, 'gate latch oscillates before being frozen');
shot(s, lockPosition(s.amusement, s.time)); run(s, .35);
assert.equal(s.amusement.lock, 'frozen', 'freeze ray locks the moving latch');
const frozenX = lockPosition(s.amusement, s.time).x;
run(s, .6);
assert.equal(lockPosition(s.amusement, s.time).x, frozenX, 'frozen latch holds still');
run(s, 3.4);
assert.equal(s.amusement.lock, 'closed', 'latch thaws back after 3.5s if not shattered');

// Re-freeze and shatter with pistol
shot(s, lockPosition(s.amusement, s.time)); run(s, .35);
assert.equal(s.amusement.lock, 'frozen');
selectWeapon(s, pistol);
shot(s, lockPosition(s.amusement, s.time)); run(s, .5);
assert.equal(s.amusement.lock, 'open', 'pistol shatters frozen latch');

// Verify freeze ray emits freeze-beam event AND pistol deals shatter bonus (not penalized!)
const leaper = s.enemies.find(e => e.zone === 0 && e.type === 'leaper');
assert.ok(leaper.enabled);
at(s, leaper.x, leaper.z + 3.2);
selectWeapon(s, freeze);
if (s.reloading || !s.ammo[freeze].mag) run(s, 2.1);
consumeEvents(s);
shot(s, { x: leaper.x, y: .9, z: leaper.z }); run(s, .35);
assert.ok(consumeEvents(s).some(e => e.type === 'freeze-beam'), 'freeze ray emits beam visual event');
assert.ok(leaper.alive && leaper.frozenUntil > s.time);
const hpAfterFreeze = leaper.hp;
selectWeapon(s, pistol);
shot(s, { x: leaper.x, y: .95, z: leaper.z }, 0); run(s, .45);
assert.ok(!leaper.alive || leaper.hp <= hpAfterFreeze - 4, 'pistol deals crisp shatter bonus to frozen enemy');

// Clear remaining Zone 0 enemies & pass Gate 0
for (const e of s.enemies.filter(e => e.zone === 0 && e.alive)) {
  at(s, e.x, e.z + 2.2);
  for (let tries = 0; e.alive && tries < 8; tries++) {
    if (!s.ammo[pistol].mag) run(s, 1.0);
    shot(s, { x: e.x, y: .9, z: e.z }, .75); run(s, .65);
  }
}
run(s, .8);
assert.ok(s.amusement.lit[0], 'Zone 0 lights turn on when cleared');
assert.ok(gatePassable(s, 0));
through(s, 0);

// --- Zone 1: Steam valve + Carousel graze-then-freeze shatter regression check ---
at(s, SWITCH.x, SWITCH.z + 1.05);
assert.equal(amusementPrompt(s), null, 'live steam blocks switch');
selectWeapon(s, freeze); shot(s, VALVE); run(s, .45);
assert.equal(amusementPrompt(s), 'spin');
assert.ok(useAmusement(s));
assert.ok(s.amusement.valveLatched && s.amusement.carousel.used);
assert.ok(s.enemies.some(e => e.parkWave && e.enabled));

// Put a walker inside carousel sweep, let it get grazed once unfrozen, THEN freeze it — verify ice-sweep STILL shatters it!
const walker = s.enemies.find(e => e.zone === 1 && e.type === 'walker' && e.alive);
walker.x = CAROUSEL.x + 2.1; walker.z = CAROUSEL.z; walker.hp = 6;
run(s, .9);
assert.ok(walker.alive && walker.hp < 6, 'unfrozen walker takes non-lethal graze');
// Walker walks back into carousel sweep range, then gets frozen
walker.x = CAROUSEL.x + 2.1; walker.z = CAROUSEL.z;
at(s, walker.x, walker.z + 2.8);
selectWeapon(s, freeze);
shot(s, { x: walker.x, y: .9, z: walker.z }); run(s, 1.35);
assert.equal(walker.alive, false, 'previously grazed enemy is STILL shattered when frozen into carousel sweep');
assert.ok(s.amusement.carousel.iceHits >= 1);

// Clear remaining Zone 1 enemies (including shielded) & pass Gate 1
selectWeapon(s, pistol);
for (const e of s.enemies.filter(e => e.zone === 1 && e.alive)) {
  at(s, e.x, e.z + 2.2);
  if (e.type === 'shielded') {
    selectWeapon(s, freeze); shot(s, { x: e.x, y: .9, z: e.z }); run(s, .45);
    selectWeapon(s, pistol);
  }
  for (let tries = 0; e.alive && tries < 10; tries++) {
    if (!s.ammo[pistol].mag) run(s, 1.0);
    shot(s, { x: e.x, y: .9, z: e.z }, .75); run(s, .65);
  }
  assert.equal(e.alive, false);
}
run(s, .8);
assert.ok(s.amusement.lit[1], 'Zone 1 lights turn on');
assert.ok(gatePassable(s, 1));
through(s, 1);

// --- Zone 2: Stitched river blocks walking -> Coaster ride -> Moving targets & shore enemies ---
at(s, 0, RIVER.maxZ + .45); run(s, .6, { z: -1 });
assert.ok(s.player.z >= RIVER.maxZ + .3, 'river blocks walking without boarding coaster');
at(s, PLATFORM.x, PLATFORM.z);
assert.equal(amusementPrompt(s), 'board');
assert.ok(useAmusement(s));
run(s, COASTER_SECONDS * .5);
assert.ok(s.player.jump > 2.2, 'coaster lifts player high above the park');
run(s, COASTER_SECONDS * .6);
assert.equal(s.amusement.ride.finished, true, 'coaster completes cleanly on northern landing deck');
assert.ok(s.player.z < RIVER.minZ, 'player dismounts across the river');

// Clear Zone 2 shore enemies first (closest first), then freeze & light both moving coaster targets
for (const e of s.enemies.filter(e => e.zone === 2 && e.alive).sort((a, b) => Math.hypot(a.x, a.z + 3.6) - Math.hypot(b.x, b.z + 3.6))) {
  at(s, e.x > 0 ? e.x - 1.8 : e.x + 1.8, e.z);
  selectWeapon(s, freeze);
  shot(s, { x: e.x, y: .9, z: e.z }); run(s, .45);
  selectWeapon(s, pistol);
  for (let tries = 0; e.alive && tries < 10; tries++) {
    at(s, e.x > 0 ? e.x - 1.8 : e.x + 1.8, e.z);
    if (!s.ammo[pistol].mag) run(s, 1.0);
    shot(s, { x: e.x, y: .9, z: e.z }, .75); run(s, .65);
  }
  assert.equal(e.alive, false);
}
at(s, 0, -1.8);
for (let i = 0; i < 2; i++) {
  selectWeapon(s, freeze);
  shot(s, coasterTargetPosition(s.amusement, i)); run(s, .45);
  selectWeapon(s, pistol);
  shot(s, coasterTargetPosition(s.amusement, i)); run(s, .95);
  assert.equal(s.amusement.targets[i].lit, true, `coaster target ${i} lit`);
}
run(s, .8);
assert.ok(s.amusement.lit[2], 'Zone 2 lights turn on');
assert.ok(gatePassable(s, 2));
through(s, 2);
run(s, .2, { z: -1 });

// --- Zone 3: Boss Intro Cutscene (skippable) -> Freeze Clown -> Spring mask break -> Direct tile-surface freeze -> Victory crane cutscene ---
const boss = s.amusement.clown;
assert.ok(boss.entered && amusementCutscene(s)?.kind === 'clown-intro', 'entering Big Top starts Clown intro cutscene');
assert.ok(skipAmusementCutscene(s), 'intro cutscene can be skipped cleanly');
assert.equal(amusementCutscene(s), null);

// Ground shot bounces off mask, freeze ray freezes Clown, spring shot shatters mask
at(s, SAFE_PAD.x, SAFE_PAD.z);
selectWeapon(s, pistol);
shot(s, { x: boss.x, y: CLOWN.maskY, z: boss.z + .8 }, .85); run(s, .7);
assert.equal(boss.mask, 2, 'ground shot bounces off mask');
selectWeapon(s, freeze);
shot(s, { x: boss.x, y: CLOWN.maskY, z: boss.z + .8 }); run(s, .45);
assert.ok(boss.frozenUntil > s.time, 'Clown can be frozen');
selectWeapon(s, pistol);
at(s, FIRST_BOX.x, FIRST_BOX.z); run(s, .64);
assert.ok(s.player.jump > 1.3);
shot(s, { x: boss.x, y: CLOWN.maskY, z: boss.z + .8 }, .85); run(s, .75);
assert.equal(boss.mask, 0, 'charged spring shot breaks mask');

// Direct tile-surface freeze (shooting center of warning tile floor, NOT just tiny corner post!)
const tile = s.amusement.tiles[7], tilePoint = TILES[7];
at(s, tilePoint.x, tilePoint.z + 1.5);
selectWeapon(s, freeze);
if (s.reloading || !s.ammo[freeze].mag) run(s, 2.2);
Object.assign(tile, { warn: s.time, off: s.time + 1.6, until: s.time + 3.4, frozenUntil: 0 });
shot(s, { x: tilePoint.x, y: .12, z: tilePoint.z }); run(s, 1.8);
assert.ok(tile.frozenUntil > s.time && !parkHoleAt(s, tilePoint.x, tilePoint.z), 'shooting the warning tile surface directly freezes it solid');

// Defeat Clown -> Pickup Motor -> Victory Cutscene -> Win
selectWeapon(s, pistol);
for (let i = 0; i < 36 && boss.hp > 0; i++) {
  if (!s.ammo[pistol].mag) run(s, 1.2);
  if (s.health < 40) s.health = 100;
  if (s.amusement.fallUntil || s.amusement.trap) run(s, 1);
  at(s, boss.x, -12.3);
  shot(s, { x: boss.x, y: 1.2, z: boss.z + .4 }, .85); run(s, .6);
}
assert.equal(boss.hp, 0);
at(s, 0, -12.1);
assert.equal(amusementPrompt(s), 'motor');
assert.ok(useAmusement(s));
assert.equal(amusementCutscene(s)?.kind, 'victory', 'picking up motor starts full-park victory cutscene');
assert.equal(s.phase, 'playing', 'victory waits for cutscene to finish');
run(s, VICTORY_CUTSCENE_SECONDS + CONFIG.endDelay + .3);
assert.equal(s.phase, 'won', 'level wins cleanly after victory crane cutscene');

// --- Checkpoints 0..3 & holstered freeze gun recharge ---
const empty = fresh();
for (let i = 0; i < 3; i++) { shot(empty, { x: 2, y: 2, z: 32 }); run(empty, .48); }
assert.equal(empty.ammo[freeze].mag, 0);
selectWeapon(empty, pistol); run(empty, 2.1);
assert.equal(empty.ammo[freeze].mag, 3, 'holstered freeze gun recharges automatically');

const retry = fresh(3); run(retry, .1);
retry.health = 1;
skipAmusementCutscene(retry);
assert.ok(hurtPlayer(retry, CLOWN, 'test', 10));
run(retry, .1);
assert.equal(retry.phase, 'lost');
const restored = fresh(retry.amusement.zone);
assert.equal(restored.health, 100);
assert.equal(restored.ammo[freeze].mag, 3);
assert.ok(gatePassable(restored, 0) && gatePassable(restored, 1) && gatePassable(restored, 2));
assert.deepEqual([restored.player.x, restored.player.z], [SAFE_PAD.x, SAFE_PAD.z]);
console.log('4-zone whitebox (oscillating latch, carousel graze+freeze, coaster flyover, direct tile freeze, cutscenes & checkpoints) PASS');
