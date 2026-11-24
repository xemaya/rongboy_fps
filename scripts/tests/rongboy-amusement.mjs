import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/amusement.js';
import { compileLevel, routeTo } from '../../scenes/rongboy-mission/level.js';
import { createGame, step, fire, consumeEvents } from '../../scenes/rongboy-mission/game.js';
import { useAmusement, COASTER_SECONDS, CLOWN, TILES, SAFE_PAD, parkHoleAt, GATES, PLATFORM, SWITCH, MIDWAY_TARGETS, LEVER } from '../../scenes/rongboy-mission/amusement.js';

const level=compileLevel(def);
function run(s,seconds,input={}) {
  for(let i=0;i<Math.round(seconds*120);i++)step(s,1/120,input);
}
const fresh=()=>createGame({level});
function fight() {
  const s=createGame({level,parkCheckpoint:5});
  run(s,.02);
  assert.ok(s.park.clown.entered);
  return s;
}
function shoot(s,y=CLOWN.maskY,charge=0) {
  const origin={x:s.player.x,y:1.23+s.player.jump,z:s.player.z-.18};
  const dx=-origin.x,dz=CLOWN.z+.68-origin.z;
  return fire(s,charge,{origin,direction:{x:dx,y:y-origin.y+.045,z:dz}});
}

function walk(s,x,z) {
  const target={x,z};
  const path=routeTo(level,s.player,target,.345);
  assert.ok(path.length,`there is a path to ${x}, ${z}`);
  for (const w of path) for (let frame=0;frame<1200;frame++) {
    const dx=w.x-s.player.x,dz=w.z-s.player.z,dist=Math.hypot(dx,dz);
    if (dist<.08)break;
    assert.ok(frame<1199,`stuck at ${s.player.x.toFixed(2)},${s.player.z.toFixed(2)} moving to ${w.x},${w.z}`);
    step(s,1/120,{x:dx/dist,z:dz/dist});
  }
}
function clearSector(s) {
  for (const enemy of s.enemies) if (enemy.enabled) enemy.alive=false;
  run(s,.70);
}
function through(s,i) {
  const gate=GATES[i];
  walk(s,gate.x,gate.z+.85);
  walk(s,gate.x,gate.z-.88);
  assert.equal(s.park.zone,i+1);
  assert.ok(s.enemies.every(e=>e.zone<=s.park.zone||!e.enabled));
}
function hitTarget(s,t) {
  const origin={x:s.player.x,y:t.y,z:s.player.z};
  assert.ok(fire(s,0,{origin,direction:{x:t.x-origin.x,y:.06,z:t.z-origin.z}}));
  run(s,.66);
}

{
  const s=fresh();
  assert.equal(s.health,100);
  assert.equal(s.enemies.filter(e=>e.enabled).length,3);
  assert.equal(useAmusement(s),false);
  walk(s,GATES[0].x,GATES[0].z+.77);
  run(s,1.4,{z:-1});
  assert.equal(s.park.zone,0,'walking cannot bypass the occupied plaza');
  assert.ok(s.player.z>GATES[0].z);
  clearSector(s); through(s,0);
  walk(s,PLATFORM.x,PLATFORM.z+1);
  assert.equal(useAmusement(s),true);
  run(s,3,{x:1,z:1});
  assert.ok(s.player.z<PLATFORM.z-2 && s.player.jump>1,'walking input does not steer a seated player');
  assert.ok(fire(s,0,{origin:{x:s.player.x,y:s.player.jump+1.08,z:s.player.z},direction:{x:0,y:-.7,z:-1}}));
  const shot=s.balls[0];run(s,.2);
  assert.ok(shot.z<s.player.z && s.shots===1,'the normal projectile was fired while seated');
  run(s,COASTER_SECONDS-3.05);
  assert.ok(s.park.ride.finished && s.player.jump===0);
  assert.ok(!s.park.opened[1],'arrival alone does not clear the rail guards');
  clearSector(s); through(s,1);
  walk(s,SWITCH.x+.8,SWITCH.z+.45);
  assert.ok(useAmusement(s));
  run(s,1.05);
  assert.ok(s.park.carousel.hits>=2,'the rotating arms hit at least two enemies');
  assert.ok(s.park.carousel.struck.size===s.park.carousel.hits);
  clearSector(s); through(s,2);
  clearSector(s);
  assert.ok(!s.park.opened[3],'both booths still need to be hit even with no enemies');
  for (const t of MIDWAY_TARGETS) {
    walk(s,t.x,t.z+1.8);
    hitTarget(s,t);
  }
  assert.ok(s.park.targets.every(Boolean));
  through(s,3);
  clearSector(s);
  assert.ok(!s.park.opened[4],'the backstage exit needs the lever too');
  walk(s,LEVER.x,LEVER.z);
  assert.ok(useAmusement(s));
  run(s,.7);
  through(s,4);
  walk(s,SAFE_PAD.x,SAFE_PAD.z);
  assert.ok(s.park.clown.entered,'the walking route leads through all five gates to the boss');
}
console.log('PASS five gates and objectives, seated shot, real carousel hits, real booth targets and boss arrival');

{
  const s=createGame({level,parkCheckpoint:3});
  assert.equal(s.park.zone,3);
  assert.ok(s.park.opened.slice(0,3).every(Boolean));
  assert.ok(!s.park.opened[3]);
  assert.equal(s.enemies.filter(e=>e.enabled).length,4);
  assert.ok(s.enemies.every(e=>e.zone>=3));
}
console.log('PASS area retry keeps earlier gates clear and later enemies dormant');

{
  const s=fight();
  assert.ok(shoot(s,1.45)); run(s,1.12);
  assert.equal(s.park.clown.hp,CLOWN.hp);
  assert.equal(s.park.clown.mask,2);
  const box=s.park.boxes[0];
  Object.assign(s.player,{x:box.x,z:box.z+.74});
  run(s,.08,{z:-1});
  assert.ok(s.player.jumpV>4.9);
  run(s,.4);
  assert.ok(shoot(s,1.23+s.player.jump,.75));
  run(s,.54);
  assert.equal(s.park.clown.mask,0);
  assert.equal(s.park.clown.hp,CLOWN.hp,'the spring shot breaks the mask, not the HP');
  const breakEvent=consumeEvents(s).find(e=>e.action==='mask-break');
  assert.ok(breakEvent && breakEvent.y>2.5);
  s.invul=100;
  run(s,2.1);
  assert.ok(s.park.fireworks.length>0);
  run(s,4.1);
  const tile=s.park.tiles.findIndex(t=>t.off && t.until>s.time);
  assert.ok(tile>=0);
  Object.assign(s.player,{...TILES[tile],jump:0,jumpV:0});
  while(s.time<s.park.tiles[tile].off-.001)step(s,1/120);
  run(s,.1);
  assert.ok(parkHoleAt(s,s.player.x,s.player.z) && s.park.fallUntil);
  const oldHealth=s.health;
  run(s,.54);
  assert.equal(s.health,oldHealth-25);
  assert.deepEqual({x:s.player.x,z:s.player.z},SAFE_PAD);
  s.invul=100;
  run(s,.9,{z:-1});
  for(let i=0;i<30 && s.park.clown.hp>0;i++) {
    shoot(s,1.6,1);
    run(s,.62);
  }
  run(s,1.75);
  assert.equal(s.phase,'won');
}
console.log('PASS airborne real projectile breaks mask, fireworks, trapdoor fall, damage and victory');

{
  const s=fight(), box=s.park.boxes[0];
  Object.assign(s.player,{x:box.x,z:box.z});
  run(s,1.17);
  assert.ok(s.park.trap);
  assert.equal(shoot(s),false,'shut inside the box');
  run(s,.8,{x:1,z:1});
  assert.equal(s.park.trap,null);
  assert.equal(s.health,87);
  assert.equal(s.park.clown.mask,2);
  run(s,5.35);
  assert.equal(consumeEvents(s).filter(e=>e.action==='volley').length,3);
}
console.log('PASS active trap, delayed damage, and three volleys');
