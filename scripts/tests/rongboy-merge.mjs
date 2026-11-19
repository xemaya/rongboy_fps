// 两条线合并后的检查：九类僵尸的攻击（箭、炸弹、震地、增援、盾）接到多层楼上是否正确，
// 以及它们和后加的武器（静电枪、毛线手雷）是否互相认得。
//   node scripts/tests/rongboy-merge.mjs
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/house.js';
import museum from '../../scenes/rongboy-mission/levels/museum.js';
import school from '../../scenes/rongboy-mission/levels/school.js';
import { compileLevel, freePoint, storeyAt, lineOfSight } from '../../scenes/rongboy-mission/level.js';
import { createGame, spawn, step, fire, selectWeapon, consumeEvents, ENEMY_TYPES, WEAPONS, CONFIG } from '../../scenes/rongboy-mission/game.js';
import { trainingDef } from '../../scenes/rongboy-mission/levels/training.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const L = compileLevel(def), SH = L.storeyHeight;
const run = (s, seconds, input = {}) => { const all = []; for (let i = 0; i < Math.round(seconds * 120); i++) { step(s, 1 / 120, input); all.push(...consumeEvents(s)); } return all; };
// an empty house with the player standing in the first-floor hall
function upstairs(px = 0, pz = 1.5, floor = 1) {
  const s = createGame({ level: L });
  s.enemies = []; s.total = 0; s.health = 99;
  s.player.x = px; s.player.z = pz; s.player.y = floor * SH;
  return s;
}
const place = (s, type, x, z, floor) => { assert.ok(freePoint(storeyAt(L, floor * SH), x, z, ENEMY_TYPES[type].radius), `${type} at ${x},${z} floor ${floor} is blocked`); return spawn(s, { type, x, z, floor, state: 'alert', heading: 0 }); };

test('every level only uses enemy types that still exist; the retired fast and side-step types are gone from the data', () => {
  for (const d of [def, museum, school, trainingDef()]) {
    const C = compileLevel(d);
    for (const e of C.enemies) { assert.ok(ENEMY_TYPES[e.type], `${d.id}: unknown type ${e.type}`); assert.ok(e.type !== 'runner' && e.type !== 'weaver'); }
  }
});

test('an archer on the first floor aims, shoots at chest height of that floor and hits the player there', () => {
  const s = upstairs(), a = place(s, 'archer', 0, -4.5, 1), before = s.health;
  const ev = run(s, 4);
  const shot = ev.find(e => e.type === 'enemy-shot');
  assert.ok(shot, 'no arrow was shot');
  assert.ok(shot.y > SH + 0.8 && shot.y < SH + 1.8, 'arrow leaves at ' + shot.y);
  assert.ok(ev.some(e => e.type === 'hurt' && e.source === 'arrow'), 'the arrow never hit');
  assert.ok(s.health < before);
  assert.equal(a.base, SH);
});

test('an archer one floor below does nothing to a player standing above it', () => {
  const s = upstairs(), a = place(s, 'archer', 0, 1.5, 0), before = s.health;
  const ev = run(s, 5);
  assert.ok(!ev.some(e => e.type === 'attack-windup' || e.type === 'enemy-shot'), 'it attacked through the floor');
  assert.equal(s.health, before);
  assert.equal(a.base, 0);
});

test('a bomb thrown upstairs comes to rest on that floor; its blast hurts there and not on the floor below', () => {
  const s = upstairs(0, 1.5, 1); place(s, 'bomber', 0, -3.5, 1);
  const ev = run(s, 6), land = ev.find(e => e.type === 'bomb-land'), blast = ev.find(e => e.type === 'yarn-blast');
  assert.ok(land && blast, 'no bomb was thrown');
  assert.ok(land.y > SH && land.y < SH + 1.2, 'it landed at ' + land.y);
  assert.ok(Math.abs(blast.base - (land.y - 0.16)) < 0.02);
  // the same blast with the player directly underneath
  const t = upstairs(0, 1.5, 1); place(t, 'bomber', 0, -3.5, 1); t.health = 99;
  let moved = false;
  for (let i = 0; i < 6 * 120; i++) {
    step(t, 1 / 120, {});
    for (const e of consumeEvents(t)) if (e.type === 'bomb-land' && !moved) { t.player.x = e.x; t.player.z = e.z; t.player.y = 0; moved = true; }
  }
  assert.ok(moved); assert.equal(t.health, 99, 'the blast reached through the floor');
});

test('a warden upstairs slams on its own floor and calls its reserves onto that floor', () => {
  const s = upstairs(0, 0.5, 1), w = place(s, 'boss-warden', 0, -1.6, 1);
  assert.equal(s.enemies.filter(e => e.reserveOf === w.id && !e.enabled).length, 2);
  assert.ok(s.enemies.every(e => e.base === SH), 'reserves are sealed on the warden\'s floor');
  const ev = run(s, 16);
  const slam = ev.find(e => e.type === 'ground-slam'); assert.ok(slam, 'no slam'); assert.equal(slam.base, SH);
  const called = ev.filter(e => e.type === 'summoned'); assert.ok(called.length >= 1, 'no reserve came out');
  for (const e of s.enemies.filter(o => o.reserveOf === w.id && o.enabled)) { assert.equal(e.base, SH); assert.ok(Math.abs(e.y - SH) < 0.6, 'reserve stands at ' + e.y); }
});

test('a flying net hits the warden on its floor and ignores sealed reserves', () => {
  const s = upstairs(0, 2.2, 1), w = place(s, 'boss-warden', 0, 0, 1), sealed = s.enemies.filter(e => !e.enabled);
  const stun = WEAPONS.findIndex(x => x.id === 'stun'); s.owned[stun] = true; s.ammo[stun] = { mag: 5, reserve: 5 }; selectWeapon(s, stun);
  s.player.aimX = 0; s.player.aimY = 0; s.player.aimZ = -1;
  fire(s, 0); const zap = run(s,.52).find(e => e.type === 'zap');
  assert.ok(zap && zap.struck.includes(w.id), 'the net missed the warden');
  for (const r of sealed) { assert.ok(!zap.struck.includes(r.id)); assert.equal(r.stun, 0); assert.equal(r.hp, r.maxHp); }
});

test('a stunned shield-bearer cannot block a plain ball from the front', () => {
  const s = upstairs(0, 2.2, 1), e = place(s, 'shielded', 0, -0.4, 1); e.heading = 0;   // facing +z, toward the player
  s.player.aimX = 0; s.player.aimY = 0; s.player.aimZ = -1;
  fire(s, 0); let ev = run(s, 0.6);
  assert.ok(ev.some(x => x.type === 'blocked'), 'a plain ball from the front should be blocked'); assert.equal(e.hp, e.maxHp);
  e.stun = 2; s.cooldown = 0; fire(s, 0); ev = run(s, 0.5);
  assert.ok(e.hp < e.maxHp, 'the stunned shield-bearer still blocked');
});

test('special attacks wait until the player is on the same flat floor: on the stairs they just chase', () => {
  const t = L.stairs, s = upstairs(t.xA, (t.mouthZ + t.landingZ) / 2, 0); s.player.y = 0.8;   // part-way up the first flight
  const a = place(s, 'archer', 0, -3, 0);
  const ev = run(s, 3);
  assert.ok(!ev.some(e => e.type === 'attack-windup' && e.id === a.id), 'it aimed at a player on the stairs');
});

console.log(`\n${checks} merge checks passed`);
