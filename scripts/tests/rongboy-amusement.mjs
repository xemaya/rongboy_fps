// 布偶游乐园的检查：十站从入口一路办到马戏帐篷，每站的门等这一站的事办完才开，最后打小丑。
//   node scripts/tests/rongboy-amusement.mjs
// 设施自己的规则（走近才有提示、坐着不晕的那几条数）在 rongboy-park-rides.mjs，小径在 rongboy-park-tour.mjs。
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/amusement.js';
import { LEVELS, EXTRAS } from '../../scenes/rongboy-mission/levels/index.js';
import { compileLevel, freePoint, lineOfSight, segmentBox } from '../../scenes/rongboy-mission/level.js';
import { CONFIG, ENEMY_TYPES, WEAPONS, createGame, spawn, fire, hurtPlayer, selectWeapon, step, consumeEvents, missionStatus, checkpointCarry, drinkPotion } from '../../scenes/rongboy-mission/game.js';
import {
  PARK_ZONES, TENT_ZONE, GATES, parkGateAllows, VALVE, SWEEP, SAFE_PAD, FIRST_BOX, CLOWN, MOTOR, TILES, COASTER_TARGETS, TENT_DOOR,
  CLOWN_INTRO_SECONDS, VICTORY_CUTSCENE_SECONDS,
  lockPosition, coasterTargetPosition, parkHoleAt, useAmusement, amusementPrompt, gatePassable, zoneReady, parkRemaining,
  amusementCutscene, skipAmusementCutscene, checkpointPosition, clownGaze, GAZE,
} from '../../scenes/rongboy-mission/amusement.js';
import { SPOTS, PARK } from '../../scenes/rongboy-mission/park-rides.js';
import { fireStall, stallTarget } from '../../scenes/rongboy-mission/park-stalls.js';
import { CAROUSEL, STALLS, HAUNT, isTourWalkable, isHauntWalkable } from '../../scenes/rongboy-mission/park-tour-layout.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const level = compileLevel(def), pistol = 0, freeze = WEAPONS.findIndex(w => w.id === 'freeze');
const zoneOf = id => PARK_ZONES.findIndex(zone => zone.id === id);
const fresh = (amusementCheckpoint = 0, carry = null) => createGame({ level, amusementCheckpoint, carry });
const atBoss = () => createGame({ level, amusementCheckpoint:TENT_ZONE, bossCheckpoint:true });
const run = (s, time, input = {}) => { const log = []; for (let i = 0; i < Math.ceil(time * 120); i++) { step(s, 1 / 120, input); log.push(...consumeEvents(s)); } return log; };
const at = (s, x, z) => Object.assign(s.player, { x, z, vx: 0, vz: 0 });
const spot = id => SPOTS.find(q => q.id === id);
function shot(s, { x, y, z }, power = 0) {
  if (s.reloading || !s.ammo[s.weapon].mag) run(s, 2.2);
  if (s.cooldown > 0) run(s, s.cooldown + .05);
  const origin = { x: s.player.x, y: s.player.y + s.player.jump + 1.23, z: s.player.z };
  assert.ok(fire(s, power, { origin, direction: { x: x - origin.x, y: y - origin.y, z: z - origin.z } }), 'a shot was fired');
}
// 走过第 i 道门：站到门前一步，顺着小径走
function through(s, i) {
  const g = GATES[i];
  at(s, g.x - g.tx * .9, g.z - g.tz * .9); run(s, .8, { x: g.tx, z: g.tz });
  assert.equal(s.amusement.zone, i + 1, `walked through gate ${i}`);
}
// 门关着：顺着小径走也过不去
function blocked(s, i) {
  const g = GATES[i];
  at(s, g.x - g.tx * .9, g.z - g.tz * .9); run(s, 1, { x: g.tx, z: g.tz });
  assert.equal(s.amusement.zone, i, `gate ${i} holds`);
  assert.ok((s.player.x - g.x) * g.tx + (s.player.z - g.z) * g.tz < 0, 'and you are still on this side of it');
}
const activeGuards = s => s.enemies.filter(e => e.zone === s.amusement.zone && e.alive && e.enabled);
function clearZone(s) {
  const zone = s.amusement.zone;
  for (let wave = 0; wave < 3 && parkRemaining(s); wave++) {
    for (let tick = 0; tick < 10 && !activeGuards(s).length; tick++) run(s, .5);
    const guards = activeGuards(s);
    assert.ok(guards.length > 0 && guards.length <= 4, `station ${zone} releases one squad at a time`);
    for (const e of guards) {
      for (let tries = 0; e.alive && tries < 16; tries++) {
        const stand = [[1.7,0],[0,1.7],[-1.7,0],[0,-1.7],[1.13,1.13],[-1.13,-1.13]].map(([dx,dz])=>({x:e.x+dx,z:e.z+dz}))
          .find(p => isTourWalkable(p.x,p.z) && freePoint(level.storeys[0],p.x,p.z,CONFIG.playerRadius)
            && lineOfSight(level,{...p,y:1.23},{x:e.x,y:.9,z:e.z}));
        assert.ok(stand, `${e.type} at ${e.x}, ${e.z} is reachable from a clear firing position`);
        at(s,stand.x,stand.z); s.health = s.maxHealth; s.invul = 5;
        if (e.type === 'shielded' && tries % 3 === 0) { selectWeapon(s, freeze); shot(s, { x:e.x, y:.9, z:e.z }); run(s,.32); }
        selectWeapon(s,pistol); shot(s, { x:e.x, y:.9, z:e.z }, .75); run(s,.61);
      }
      assert.equal(e.alive, false, `${e.type} goes down`);
    }
  }
  assert.equal(parkRemaining(s),0,`station ${zone} is completely cleared`);
}

test('one park level: the old addresses open it, and it is the only park in the list', () => {
  assert.equal(def.name, '布偶游乐园'); assert.equal(LEVELS['amusement-tour'], LEVELS.amusement); assert.equal(LEVELS['amusement-whitebox'], LEVELS.amusement);
  assert.deepEqual(EXTRAS, ['amusement']);
  assert.equal(PARK_ZONES.length, 10); assert.equal(GATES.length, 9, 'a gate after every stop but the last');
});

test('every gate sits across the path, and everything placed in the park is where feet can reach', () => {
  for (const [i, g] of GATES.entries()) {
    assert.ok(Math.abs(Math.hypot(g.tx, g.tz) - 1) < 1e-9);
    assert.ok(isTourWalkable(g.x - g.tx, g.z - g.tz, .3) && isTourWalkable(g.x + g.tx, g.z + g.tz, .3), `gate ${i} has path on both sides`);
    const back = checkpointPosition(i + 1);
    assert.ok(isTourWalkable(back.x, back.z), `retrying stop ${i + 1} puts you on walkable ground`);
  }
  for (const e of def.enemies) {
    const radius=ENEMY_TYPES[e.type].radius + .06;
    assert.ok(isTourWalkable(e.x, e.z, -.3), `${e.type} at ${e.x}, ${e.z} stands on the path`);
    assert.ok(freePoint(level.storeys[0],e.x,e.z,radius), 'the authored spawn clears scenery');
  }
  for (let zone=1;zone<=TENT_ZONE;zone++) {
    const roster=def.enemies.filter(e=>e.zone===zone);
    assert.deepEqual([0,1,2].map(wave=>roster.filter(e=>e.wave===wave).length),[3,3,4]);
  }
  for (const k of def.pickups) assert.ok(isTourWalkable(k.x, k.z, -.3), `pickup at ${k.x}, ${k.z} lies on the path`);
  // 每一站要按的地方都在这一站的两道门之间：门没开的时候够不着下一站的设施
  const along = (g, q) => (q.x - g.x) * g.tx + (q.z - g.z) * g.tz;
  for (const q of SPOTS) {
    const zone = zoneOf(q.stop); assert.ok(zone > 0, q.id);
    assert.ok(along(GATES[zone - 1], q) > 0 && along(GATES[zone], q) < 0, `${q.id} lies between the gates of its stop`);
  }
  assert.ok(Math.hypot(VALVE.x - CAROUSEL.x, VALVE.z - CAROUSEL.z) > CAROUSEL.platform, 'the steam valve stands outside the carousel platform');
});

// --- 从头走到尾 ---
const s = fresh();
test('0 entrance: the latch slides on the arch; freeze it, then shatter it with the pistol', () => {
  assert.equal(s.maxHealth, 100); assert.equal(s.weapon, freeze);
  assert.deepEqual(s.owned.flatMap((v, i) => v ? [WEAPONS[i].id] : []), ['single', 'freeze']);
  assert.equal(s.enemies.filter(e => e.enabled).length, 0, 'nobody is awake before you are through the arch');
  blocked(s, 0);
  at(s, level.player.x, level.player.z);
  shot(s, lockPosition(s.amusement)); run(s, .4);
  assert.equal(s.amusement.lock, 'frozen');
  run(s, 3.6); assert.equal(s.amusement.lock, 'closed', 'it thaws after 3.5 s');
  selectWeapon(s, pistol); shot(s, lockPosition(s.amusement), 0); run(s, .4);
  assert.equal(s.amusement.lock, 'closed', 'a pistol ball bounces off the sliding latch');
  selectWeapon(s, freeze);
  for (let tries = 0; s.amusement.lock !== 'frozen' && tries < 6; tries++) { shot(s, lockPosition(s.amusement)); run(s, .4); }
  selectWeapon(s, pistol); shot(s, lockPosition(s.amusement), 0); run(s, .5);
  assert.equal(s.amusement.lock, 'open');
  run(s, .8); assert.ok(s.amusement.lit[0] && gatePassable(s, 0));
  through(s, 0);
});

test('1 carousel: the bell will not ring until the steam valve is frozen; the shockwaves shatter frozen zombies', () => {
  at(s,-18.9,24.2); run(s,1.05);
  const awake = activeGuards(s);
  assert.equal(awake.length,3); assert.equal(parkRemaining(s),10);
  blocked(s, 1);
  const bell = spot('carousel'); at(s, bell.x, bell.z);
  assert.equal(amusementPrompt(s), null, 'live steam: nothing to press');
  at(s, VALVE.x, VALVE.z + 2.5); selectWeapon(s, freeze); shot(s, VALVE); run(s, .45);
  at(s, bell.x, bell.z); assert.equal(amusementPrompt(s).id, 'carousel');
  assert.ok(useAmusement(s));
  assert.ok(s.amusement.valveLatched && s.amusement.carousel.used && s.park.running.carousel > 0, 'the carousel itself starts turning');
  assert.equal(activeGuards(s).length,3, 'the bell does not stack the second wave onto a live squad');
  // 没冻住的挨一下不死；冻住的被气浪扫到直接碎
  const walker = s.enemies.find(e => e.zone === 1 && e.type === 'walker' && e.alive);
  const park = (e, r) => { e.x = CAROUSEL.x; e.z = CAROUSEL.z + r; e.vx = e.vz = 0; };
  walker.hp = 6; s.invul = 99;
  for (let t = 0; t < 1.2 && walker.hp === 6; t += .1) { park(walker, 5.6); run(s, .1); }
  assert.ok(walker.alive && walker.hp < 6, 'a shockwave grazes an unfrozen walker');
  walker.hp = 30;   // 往下要它活着等到被冻住：30 点血，只有"冻住的直接碎"才打得死
  selectWeapon(s, freeze); if (s.reloading || !s.ammo[freeze].mag || s.cooldown > 0) run(s, 2.3);   // 先等枪好了再摆位置
  park(walker, 5.6); at(s, walker.x + 2.4, walker.z + .4);   // 30 点血：只有"冻住的直接碎"才打得死
  shot(s, { x: walker.x, y: .9, z: walker.z }); run(s, .3);
  assert.ok(walker.frozenUntil > s.time, 'the walker is frozen');
  run(s, 1.2);
  assert.equal(walker.alive, false, 'frozen in the path of the wave, it shatters'); assert.ok(s.amusement.carousel.iceHits >= 1);
  assert.equal(zoneReady(s), false, 'the gate waits for the rest of them');
  run(s, SWEEP.seconds); clearZone(s); run(s, .8);
  assert.ok(gatePassable(s, 1)); through(s, 1);
});

// 坐一趟设施：走到提示的地方按键，坐到自己下来
function ride(s, id, seconds) {
  const q = spot(id); at(s, q.x, q.z);
  assert.equal(amusementPrompt(s)?.id, id, `${id} can be boarded`); assert.ok(useAmusement(s));
  assert.equal(s.park.riding?.id, id);
  return run(s, seconds);
}

test('carousel reinforcements wait for the bell, even if the path guards are already down', () => {
  const game = fresh(1);
  run(game,1.5);
  assert.equal(activeGuards(game).length,0,'the checkpoint is safe until the player leaves the arch');
  at(game,-18.9,24.2); run(game,1);
  const first = activeGuards(game);
  assert.equal(first.length,3);
  first.forEach(e=>{e.alive=false;});
  run(game,2.5);
  assert.equal(game.amusement.encounter.index,0);
  assert.equal(activeGuards(game).length,0);
  assert.equal(parkRemaining(game),7);
});

test('2 rapids: the raft returns before the dock guards appear', () => {
  blocked(s, 2);
  ride(s, 'rapids', PARK.rapids.time + .5);
  assert.equal(s.park.riding, null); assert.ok(s.amusement.done.rapids);
  assert.equal(activeGuards(s).length,0,'a short warning follows disembarking');
  assert.equal(zoneReady(s),false);
  clearZone(s); run(s, .8); through(s, 2);
});

test('3 coaster: two track targets to light, from the car or from the path, and three waves after getting off', () => {
  blocked(s, 3);
  assert.equal(parkRemaining(s),10); assert.equal(activeGuards(s).length,0,'they wait until you are back off the ride');
  const q = spot('coaster'); at(s, q.x, q.z); useAmusement(s);
  // 车上：提升坡上经过第一个靶，冻住再点亮（坐着也能开枪）
  run(s, 3.2); selectWeapon(s, freeze);
  shot(s, coasterTargetPosition(s.amusement, 0)); run(s, .3);
  assert.ok(s.amusement.targets[0].frozenUntil > s.time, 'frozen from the moving car');
  selectWeapon(s, pistol); shot(s, coasterTargetPosition(s.amusement, 0)); run(s, .5);
  assert.ok(s.amusement.targets[0].lit, 'and lit from the car');
  const health = s.health; assert.equal(hurtPlayer(s, {x:s.player.x,z:s.player.z}, 'contact'), false, 'nothing hurts you while you ride'); assert.equal(s.health, health);
  run(s, PARK.coaster.time);
  assert.equal(s.park.riding, null); assert.ok(s.amusement.done.coaster);
  assert.equal(activeGuards(s).length,3,'getting off starts the first squad after the warning');
  assert.equal(zoneReady(s), false);
  // 剩下的那个在路上打：站在出站的小径上，够得着
  at(s, -21.4, -22.8); s.invul = 99;
  const far = coasterTargetPosition(s.amusement, 1), pitch = Math.atan2(far.y - 1.23, Math.hypot(far.x - s.player.x, far.z - s.player.z));
  assert.ok(pitch < .72, `the high target is within the pitch limit from the path (${(pitch * 57.3).toFixed(0)} degrees)`);
  for (let tries = 0; !s.amusement.targets[1].lit && tries < 8; tries++) { shot(s, coasterTargetPosition(s.amusement, 1), .5); run(s, 1.1); }
  assert.ok(s.amusement.targets[1].lit, 'the second target is lit from the path');
  clearZone(s); run(s, .8);
  assert.ok(gatePassable(s, 3)); through(s, 3);
});

test('reduced motion: watching the raft and coaster from the path also unlocks progression', () => {
  for (const id of ['rapids', 'coaster']) {
    const zone = zoneOf(id), q = spot(id);
    const game = createGame({ level, amusementCheckpoint: zone, reducedMotion: true });
    at(game, q.x, q.z);
    assert.equal(game.park.watch, true, 'the setting survives initial and checkpoint game creation');
    assert.equal(amusementPrompt(game)?.kind, 'look');
    assert.ok(useAmusement(game));
    run(game, PARK[id].time - .2);
    assert.equal(game.amusement.done[id], false, 'starting the show alone gives no credit');
    assert.equal(game.park.riding, null);
    assert.equal(game.player.jump, 0);
    assert.deepEqual([game.player.x, game.player.z], [q.x, q.z], 'the player stays on the path');
    run(game, .25);
    assert.equal(game.park.running[id], 0);
    assert.equal(game.amusement.done[id], true);
    if (id === 'coaster') {
      run(game,1);
      assert.equal(activeGuards(game).length,3,'the first guards wake after the empty train returns');
      assert.equal(zoneReady(game), false, 'the targets and guards still count');
    }
    clearZone(game);
    if (id === 'coaster') {
      for (const [i, x, z] of [[0,-26.7,-20.4],[1,-21.4,-22.8]]) {
        at(game,x,z); game.invul=99;
        for (let tries=0; !game.amusement.targets[i].lit && tries<8; tries++) {
          selectWeapon(game,freeze); shot(game,coasterTargetPosition(game.amusement,i)); run(game,.49);
          if (game.amusement.targets[i].lit) break;
          selectWeapon(game,pistol); shot(game,coasterTargetPosition(game.amusement,i),.55); run(game,.94);
        }
        assert.ok(game.amusement.targets[i].lit, `target ${i+1} is hittable from the path`);
      }
    }
    run(game, .8);
    assert.ok(gatePassable(game, zone));
    through(game, zone);
  }
});

test('4 haunted house: knock, go in, ring the bell', () => {
  blocked(s, 4);
  const door = spot('haunt'); at(s, door.x, door.z); assert.ok(useAmusement(s)); run(s, 1.6);
  assert.ok(s.park.door > .9); assert.equal(zoneReady(s), false, 'knocking is not enough');
  const bell = spot('portraits'); at(s, bell.x, bell.z); assert.ok(isHauntWalkable(bell.x, bell.z));
  assert.equal(amusementPrompt(s).id, 'portraits'); assert.ok(useAmusement(s)); run(s, .2);
  assert.ok(s.amusement.done.portraits);
  run(s,1.5); assert.equal(activeGuards(s).length,0,'the ghost foyer stays clear');
  at(s,door.x,door.z);
  clearZone(s); run(s, .8); through(s, 4);
});

test('5 ferris wheel: once round', () => {
  blocked(s, 5);
  ride(s, 'wheel', Math.PI * 2 / PARK.wheel.speed + 1);
  assert.equal(s.park.riding, null); assert.ok(s.amusement.done.wheel);
  clearZone(s); run(s, .8); through(s, 5);
});

test('6 midway: one hit at any stall wins; walking up to a stall is not enough', () => {
  blocked(s, 6);
  const stall = STALLS.find(k => k.id === 'blocks'), q = spot('stall-blocks'); at(s, q.x, q.z);
  assert.ok(useAmusement(s)); assert.ok(s.park.stall); run(s, .3);
  assert.equal(fire(s, 0), false, 'the gun is put away at a stall: the fire key throws the stall ball');
  assert.equal(zoneReady(s), false);
  const origin = { x: s.player.x, y: 1.23, z: s.player.z }, t = stallTarget(stall, 0, s.park.stall.time + .24);
  const d = { x: t.x - origin.x, y: t.y - origin.y, z: t.z - origin.z }, n = Math.hypot(d.x, d.y, d.z);
  assert.ok(fireStall(s, { origin, direction: { x: d.x / n, y: d.y / n, z: d.z / n } })); run(s, .5);
  assert.ok(s.park.stall.score > 0);
  assert.equal(s.park.stall.done, false, 'the round still has throws left');
  assert.ok(s.amusement.done.stall, 'one hit immediately earns credit');
  run(s,1.5); assert.equal(activeGuards(s).length,0,'the minigame does not spawn guards');
  assert.ok(useAmusement(s), 'the same key leaves the stall'); assert.equal(s.park.stall, null);
  clearZone(s); run(s, .8);
  assert.ok(gatePassable(s, 6), 'the earned credit survives leaving before the round ends');
  through(s, 6);
});

test('7 bumper cars and 8 mirror maze each need a clear before the next gate', () => {
  blocked(s, 7);
  const q = spot('bumpers'); at(s, q.x, q.z); assert.ok(useAmusement(s));
  run(s, 2, { x: 1 }); assert.equal(zoneReady(s), false, 'not until you are out of the car');
  assert.ok(useAmusement(s), 'the same key gets you out'); run(s, .1);
  assert.ok(s.amusement.done.bumpers);
  clearZone(s); run(s, .8); through(s, 7);
  assert.equal(PARK_ZONES[s.amusement.zone].id, 'mirrors');
  blocked(s,8);
  clearZone(s); run(s, .8); assert.ok(gatePassable(s, 8), 'the tent curtain opens after the mirror lane is clear');
});

test('9 big top: walking in brings the clown on; mask, trapdoors, motor, and the park lights up', () => {
  at(s, 0, TENT_DOOR + .9); run(s, 1.2, { z: -1 });
  assert.equal(s.amusement.zone, TENT_ZONE);
  const boss = s.amusement.clown;
  assert.equal(boss.entered,false,'the entrance waits for all ten guards');
  clearZone(s);
  at(s, SAFE_PAD.x, SAFE_PAD.z); run(s,.1);
  assert.ok(boss.entered && amusementCutscene(s)?.kind === 'clown-intro');
  assert.ok(skipAmusementCutscene(s)); assert.equal(amusementCutscene(s), null);
  at(s, SAFE_PAD.x, SAFE_PAD.z); selectWeapon(s, pistol);
  shot(s, { x: boss.x, y: CLOWN.maskY, z: boss.z + .8 }, .85); run(s, .7);
  assert.equal(boss.mask, 2, 'a shot from the ground bounces off the mask');
  selectWeapon(s, freeze); shot(s, { x: boss.x, y: CLOWN.maskY, z: boss.z + .8 }); run(s, .45);
  assert.ok(boss.frozenUntil > s.time, 'the clown can be frozen');
  selectWeapon(s, pistol); at(s, FIRST_BOX.x, FIRST_BOX.z); run(s, .64);
  assert.ok(s.player.jump > 1.3);
  shot(s, { x: boss.x, y: CLOWN.maskY, z: boss.z + .8 }, .85); run(s, .75);
  assert.equal(boss.mask, 0, 'a charged shot from the top of the spring breaks the mask');
  // 急冻枪打预警的地砖（打砖面就算），它就不塌
  const tile = s.amusement.tiles[7], point = TILES[7];
  at(s, point.x, point.z + 1.5); selectWeapon(s, freeze);
  if (s.reloading || !s.ammo[freeze].mag) run(s, 2.2);
  Object.assign(tile, { warn: s.time, off: s.time + 1.6, until: s.time + 3.4, frozenUntil: 0 });
  shot(s, { x: point.x, y: .12, z: point.z }); run(s, 1.8);
  assert.ok(tile.frozenUntil > s.time && !parkHoleAt(s, point.x, point.z));
  // 人出不了场地
  at(s, 0, SAFE_PAD.z); s.health = 100; s.invul = 99; run(s, 1.5, { z: 1 });
  assert.ok(s.player.z < TENT_DOOR - 1, 'the fight keeps you inside the ring');
  selectWeapon(s, pistol);
  for (let i = 0; i < 40 && boss.hp > 0; i++) {
    if (!s.ammo[pistol].mag) run(s, 1.2);
    s.health = 100;
    if (s.amusement.fallUntil || s.amusement.trap) run(s, 1);
    at(s, boss.x, SAFE_PAD.z - 5.4);
    shot(s, { x: boss.x, y: 1.2, z: boss.z + .4 }, .85); run(s, .6);
  }
  assert.equal(boss.hp, 0);
  at(s, MOTOR.x, MOTOR.z); assert.equal(amusementPrompt(s).id, 'motor'); assert.ok(useAmusement(s));
  assert.equal(amusementCutscene(s)?.kind, 'victory'); assert.equal(s.phase, 'playing', 'the level waits for the cutscene');
  run(s, VICTORY_CUTSCENE_SECONDS + CONFIG.endDelay + .3);
  assert.equal(s.phase, 'won'); assert.ok(missionStatus(s).done && s.amusement.lit.every(Boolean), 'every stop is lit');
  assert.equal(s.kills,90,'all 90 guards were defeated along the full route');
});

test('the five-second entrance cues play once, and skipping joins the same playable state', () => {
  function enter() {
    const game = atBoss();
    game.amusement.retry = false;
    run(game, 1 / 120);
    assert.equal(amusementCutscene(game)?.kind, 'clown-intro');
    return game;
  }

  const full = enter(), skipped = enter(), during = [];
  const position = { ...full.player };
  for (let index = 0; index < CLOWN_INTRO_SECONDS * 120 - 1; index++) {
    during.push(...run(full, 1 / 120, { x: 1, z: -1 }));
    assert.equal(full.player.x, position.x);
    assert.equal(full.player.z, position.z);
    assert.equal(fire(full), false, 'the performance does not spend ammo');
  }
  assert.equal(CLOWN_INTRO_SECONDS, 5);
  assert.deepEqual(during.filter(e => e.type === 'amusement').map(e => e.action),
    ['clown-spot', 'clown-crank', 'clown-pop', 'clown-settle', 'clown-salute']);
  const finish = run(full, .025, { x: 1, z: -1 });
  assert.equal(finish.filter(e => e.action === 'clown-intro-end').length, 1);
  assert.equal(amusementCutscene(full), null);
  assert.ok(skipAmusementCutscene(skipped));
  assert.equal(amusementCutscene(skipped), null);
  assert.equal(full.amusement.clown.mask, skipped.amusement.clown.mask);
  assert.equal(full.amusement.boxes[0].teaching, true);
  assert.equal(skipped.amusement.boxes[0].teaching, true);
  assert.ok(full.amusement.clown.next - full.time > 2.7);
  assert.ok(skipped.amusement.clown.next - skipped.time > 2.7);
  assert.equal(full.shots, 0);
  assert.equal(skipped.shots, 0);
});

test('retry: you start again at the gate of the stop you fell in, earlier stops stay done, potions come back as they were', () => {
  for (let zone = 1; zone <= TENT_ZONE; zone++) {
    const r = fresh(zone), back = checkpointPosition(zone);
    assert.deepEqual([r.player.x, r.player.z], [back.x, back.z]);
    assert.equal(r.health, 100); assert.equal(r.amusement.zone, zone);
    for (let i = 0; i < zone; i++) assert.ok(gatePassable(r, i) && r.amusement.lit[i]);
    assert.equal(r.enemies.filter(e => e.zone < zone).length, 0, 'the zombies of earlier stops do not come back');
    run(r, .3); assert.equal(r.amusement.zone, zone, 'standing at the checkpoint does not push you through anything');
  }
  const again = fresh(zoneOf('coaster'));
  assert.ok(again.enemies.filter(e => e.zone === 3).every(e => !e.enabled), 'the coaster guards wait for the ride again');
  assert.ok(again.amusement.targets.every(t => !t.lit) && !again.amusement.done.coaster && again.amusement.done.rapids);
  // 血瓶：进这一站时身上有两瓶、地上第一瓶已经捡走；重来时照这个摆
  const first = fresh(zoneOf('rapids')); at(first, def.pickups[0].x, def.pickups[0].z); run(first, .1);
  assert.equal(first.potions, 1); first.potions = 2;
  const carry = checkpointCarry(first); first.health = 20; assert.ok(drinkPotion(first)); assert.equal(first.health, 95); assert.equal(first.potions, 1);
  const second = fresh(zoneOf('rapids'), carry);
  assert.equal(second.potions, 2); assert.equal(second.pickups[0].taken, true, 'the bottle picked up before the checkpoint is not on the floor again');
  const front = fresh(TENT_ZONE); run(front, 1); assert.equal(activeGuards(front).length, 3);
  const tent = atBoss(); run(tent, .1);
  assert.ok(tent.amusement.clown.entered && amusementCutscene(tent) === null, 'retrying from the tent door does not replay the entrance');
  assert.equal(CLOWN_INTRO_SECONDS > 0, true);
});

test('the pistol can shatter immediately after a freeze shot, but swapping cannot erase either cooldown', () => {
  const game = fresh();
  shot(game, lockPosition(game.amusement));
  run(game, .14);
  assert.equal(game.amusement.lock, 'frozen');
  assert.ok(game.cooldown > 0, 'the freeze ray still has time to cool');
  assert.ok(selectWeapon(game, pistol));
  const origin = { x: game.player.x, y: 1.23, z: game.player.z }, latch = lockPosition(game.amusement);
  const shotAtLatch = { origin, direction: { x: latch.x - origin.x, y: latch.y - origin.y, z: latch.z - origin.z } };
  assert.ok(fire(game, 0, shotAtLatch), 'the pistol can fire without waiting on the freeze ray');
  selectWeapon(game, freeze);
  assert.equal(fire(game), false, 'switching back retains the freeze cooldown');
  selectWeapon(game, pistol);
  assert.equal(fire(game), false, 'switching back retains the pistol cooldown');
  run(game, .5);
  assert.equal(game.amusement.lock, 'open');
});

test('freeze gun: a holstered one recharges; the pistol does extra to a frozen zombie', () => {
  const g = fresh(1); at(g, -18.9, 24.2); g.invul = 99;
  for (let i = 0; i < 3; i++) { shot(g, { x: -17, y: 6, z: 20 }); run(g, .48); }
  assert.equal(g.ammo[freeze].mag, 0); selectWeapon(g, pistol); run(g, 2.1);
  assert.equal(g.ammo[freeze].mag, 3);
  const leaper = g.enemies.find(e => e.type === 'leaper' && e.enabled);
  for (const e of g.enemies) if (e !== leaper) e.enabled = false;
  Object.assign(leaper,{x:-22.6,z:22.8,y:0,hop:0,action:'chase',actionCooldown:2,vx:0,vz:0});
  at(g, leaper.x + 2.2, leaper.z + 1.2); selectWeapon(g, freeze); consumeEvents(g);
  shot(g, { x: leaper.x, y: .9, z: leaper.z });
  assert.ok(run(g, .35).some(e => e.type === 'freeze-beam')); assert.ok(leaper.alive && leaper.frozenUntil > g.time);
  const hp = leaper.hp; selectWeapon(g, pistol); shot(g, { x: leaper.x, y: .95, z: leaper.z }, 0); run(g, .45);
  assert.ok(!leaper.alive || leaper.hp <= hp - 4);
});

test('zombies keep to the paths like you do', () => {
  const g = fresh(1); g.invul = 999;
  selectWeapon(g, pistol); shot(g, { x: -19.6, y: 3, z: 24 });   // 进门开一枪：听见的都追过来。人再绕到路的另一头，它们得拐着弯追
  let off = 0;
  for (let i = 0; i < 120 * 10; i++) {
    if (i === 240) at(g, -30.5, 19.2);
    step(g, 1 / 120); for (const e of g.enemies) if (e.enabled && e.alive && !isTourWalkable(e.x, e.z, .25)) off++;
  }
  assert.equal(off, 0);
  assert.ok(g.enemies.some(e => e.enabled && e.awareness === 'alert'), 'and they do come for you');
});

test('crowding neither pushes the player into a mirror divider nor through a closed park gate', () => {
  const mirror = fresh(zoneOf('mirrors'));
  at(mirror,20.41,18.59); mirror.invul=10;
  const walker = spawn(mirror,{type:'walker',state:'asleep',x:20.87,z:18.59,zone:8});
  walker.senseIn=10;
  assert.ok(freePoint(level.storeys[0],mirror.player.x,mirror.player.z,CONFIG.playerRadius));
  run(mirror,1/120);
  assert.ok(freePoint(level.storeys[0],mirror.player.x,mirror.player.z,CONFIG.playerRadius));
  const gap=Math.hypot(mirror.player.x-walker.x,mirror.player.z-walker.z);
  assert.ok(gap >= CONFIG.playerRadius+walker.radius-1e-6,'the walker slides away when the player is pinned');

  const gate = fresh(zoneOf('carousel')), g = GATES[gate.amusement.zone];
  const onPath = along => ({ x:g.x+g.tx*along, z:g.z+g.tz*along });
  Object.assign(gate.player,onPath(-.32)); gate.invul=10;
  const guard=spawn(gate,{...onPath(-.76),type:'walker',state:'asleep',zone:1});
  guard.senseIn=10;
  run(gate,1/120);
  assert.equal(gatePassable(gate,1),false);
  assert.ok(parkGateAllows(gate,gate.player.x,gate.player.z),'crowd pressure stops short of the gate');
});

test('the haunted house wall is solid and only the open doorway admits a chasing guard', () => {
  const game=fresh(zoneOf('haunt'));
  at(game,-8.2,-16.8);
  Object.assign(game.park,{door:1,knocked:true});
  const guard=spawn(game,{type:'walker',state:'alert',x:-8.2,z:-21.75,zone:4});
  const facade=level.solids.filter(e=>e.id.startsWith('haunt-front'));
  assert.ok(facade.some(e=>segmentBox({x:-8.2,y:.9,z:-21},{x:-8.2,y:.9,z:-16},e)));
  assert.ok(!facade.some(e=>segmentBox({x:HAUNT.door.x,y:.9,z:-21},{x:HAUNT.door.x,y:.9,z:-17},e)));
  for(let tick=0;tick<120*4;tick++){
    run(game,1/120);
    const b=HAUNT.block, inside=guard.x>=b.minX && guard.x<=b.maxX && guard.z>=b.minZ && guard.z<=b.maxZ;
    assert.ok(!inside || isHauntWalkable(guard.x,guard.z),'no entry through the facade');
    assert.ok(freePoint(level.storeys[0],guard.x,guard.z,guard.radius));
  }
});

test('the clown fight camera: look down while there is something on the floor to dodge, level with the mask off a spring, otherwise left alone', () => {
  const look = atBoss(); run(look, .1);
  const lc = look.amusement.clown;
  assert.equal(clownGaze(look), null);
  Object.assign(lc, { mask: 0, round: 0, next: look.time });   // 摘了面具：烟花、塌地砖、齐射、扔盒子
  at(look, 4.6, SAFE_PAD.z - .35); run(look, .05);
  assert.deepEqual(clownGaze(look), { kind: 'down', pitch: GAZE.down });
  const downs = [];
  for (let t = 0; t < 9; t += .1) { at(look, 0, SAFE_PAD.z); look.health = 100; run(look, .1); downs.push(clownGaze(look)?.kind === 'down'); }
  assert.equal(downs.filter((v, i) => i && v !== downs[i - 1]).length, 1, 'fireworks then trapdoors is one look down and one look back up, not two');
  assert.ok(downs.slice(0, 70).every(Boolean) && !downs.at(-1), 'the camera stays down until the floor is whole again');
  look.amusement.boxes = [{ ...FIRST_BOX, land: look.time, thrown: look.time, used: false, settled: true }];
  at(look, FIRST_BOX.x, FIRST_BOX.z); run(look, .02);
  const lift = clownGaze(look);
  assert.equal(lift.kind, 'mask'); assert.ok(lift.pitch > .2, 'just off the ground the mask is still above eye level');
  run(look, .62);
  assert.ok(Math.abs(clownGaze(look).pitch) < .03, 'at the top of the spring the mask is level with the eye');
  assert.ok(GAZE.rate <= Math.PI / 4 + 1e-9, 'never faster than 45 degrees a second');
});

console.log(`布偶游乐园：${checks} 项检查通过`);
