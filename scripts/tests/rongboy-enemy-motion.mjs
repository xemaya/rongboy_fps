import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { loadFigurines } from '../../library/games/rongboy-runtime.js';
import { poseGroundedGait } from '../../library/games/rongboy-gait.js';
import { poseRosterFigurine } from '../../library/games/rongboy-roster-pose.js';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame, ENEMY_TYPES, step, consumeEvents } from '../../scenes/rongboy-mission/game.js';
import { GAITS } from '../../scenes/rongboy-mission/locomotion.js';
import { ATTACKS } from '../../scenes/rongboy-mission/attacks.js';
import { geometryOnlyGlb } from './helpers/gltf-geometry.mjs';

const DT = 1 / 120;
const range = { minX:-12, maxX:12, minZ:-18, maxZ:18 };
function arena(type, distance) {
  const s = createGame({level:compileLevel({
    id:'gait-test', name:'gait-test', bounds:range, height:3.2, wallThickness:.2, doorHeight:2.3,
    rooms:[{id:'yard',...range,outdoor:true}], player:{x:0,z:0}, mission:{type:'clear'},
    enemies:[{type,x:0,z:-distance,heading:0,state:'alert'}], walls:[], furniture:[],
  })});
  s.health=99;
  return s;
}
const advance = (state, frames) => {for(let i=0;i<frames;i++) step(state,DT);return consumeEvents(state);};

for (const type of Object.keys(ENEMY_TYPES)) {
  const s = arena(type,15), enemy = s.enemies[0];
  enemy.actionCooldown=10;
  let apex=0;
  for(let i=0;i<240;i++){step(s,DT);apex=Math.max(apex,enemy.y-enemy.base);}
  assert.ok(enemy.z>-14,type+' advances');
  const notices = consumeEvents(s);
  if (type==='walker') {
    assert.ok(apex>.16 && notices.some(event=>event.type==='land'));
  } else {
    assert.equal(apex,0,type+' stays grounded outside special actions');
    assert.ok(!notices.some(event=>event.type==='land'),type+' does not use landing FX while walking');
    if (type!=='crawler') assert.ok(notices.some(event=>event.type==='footstep'),type+' has real step contacts');
  }
  const travel = enemy.stepDistance ?? enemy.crawlDistance, before = enemy.z;
  enemy.stun=.7;advance(s,60);
  assert.equal(enemy.z,before,type+' stops moving when frozen');
  assert.equal(enemy.stepDistance ?? enemy.crawlDistance,travel,type+' animation phase stops when frozen');
}

const pounce = arena('leaper',4), leaper = pounce.enemies[0];
leaper.actionCooldown=0;
advance(pounce,1);
assert.equal(leaper.action,'windup');
const takeoff = leaper.z;
advance(pounce,Math.floor(ATTACKS.leaper.windup/DT)-1);
assert.equal(leaper.z,takeoff,'warning stops the run');
advance(pounce,28);
assert.equal(leaper.action,'pounce');
assert.ok(leaper.y-leaper.base>.5);
assert.ok(leaper.z>takeoff+1);
advance(pounce,60);
assert.equal(leaper.y,leaper.base);

const poses = [
  ['zombies-v7/zombie-roster.glb',Object.keys(GAITS)],
  ['walker-trio/walker-trio.glb',['leaper','heavy']],
  ['second-trio/second-trio.glb',['shielded','bomber']],
  ['final-trio/final-trio.glb',['archer','boss-warden','boss-leech']],
];
const probe=new T.Vector3();
function sole(leg){
  let y=Infinity;
  leg.traverse(mesh=>{
    if (!mesh.isMesh || mesh.userData.fuzz) return;
    const pos=mesh.geometry.attributes.position;
    for (let i=0;i<pos.count;i++) y=Math.min(y,probe.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).y);
  });
  return y;
}

for (const [file,types] of poses) {
  const data = await readFile(new URL('../../assets/rongboy/'+file,import.meta.url));
  const bank = await loadFigurines({zombies:geometryOnlyGlb(data)});
  for (const type of types){
    const actor=bank.create(type), feet=['LegL','LegR'].map(name=>actor.parts.get(name));
    actor.world.updateMatrixWorld(true);
    const rest=feet.map(sole), gait=GAITS[type];
    let peak=0;
    for(let i=0;i<40;i++){
      actor.reset();
      poseGroundedGait({type,action:'chase',awareness:'alert',stepDistance:i*gait.stride/40,stepWeight:1,stepForward:1},actor);
      actor.world.updateMatrixWorld(true);
      const heights=feet.map((leg,index)=>sole(leg)-rest[index]);
      assert.ok(Math.min(...heights)>-.010, file+' '+type+' stays above the ground');
      assert.ok(Math.min(...heights)<.009, file+' '+type+' has at least one planted foot');
      peak=Math.max(peak,...heights);
    }
    assert.ok(peak>gait.lift*.71 && peak<gait.lift+.012, file+' '+type+' matches its lift envelope');
    for(let i=0;i<28;i++){
      poseRosterFigurine(actor,i*.14,true,true);
      actor.world.updateMatrixWorld(true);
      actor.world.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),type+' preview remains finite'));
    }
    if (type === 'leaper') {
      poseRosterFigurine(actor,2.1,true,true);
      const pounce = actor.tilt.position.clone();
      for (let i=0; i<12; i++) poseRosterFigurine(actor,2.1,true,true);
      assert.ok(actor.tilt.position.distanceTo(pounce)<1e-7,'diving torso pivot does not crawl backward on repeated renders');
      assert.ok(actor.world.position.y>.4 && Math.abs(pounce.z)<.38,'the body stays near the pounce hitbox');
    }
  }
}
console.log('PASS nine locomotion states, frozen phase, crouch/pounce, planted soles and native rehearsals');
