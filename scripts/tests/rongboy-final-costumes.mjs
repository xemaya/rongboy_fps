import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadFigurines} from '../../library/games/rongboy-runtime.js';
import {applyAttackPose} from '../../scenes/rongboy-mission/attack-pose.js';
import {updateActionGear} from '../../library/games/rongboy-action-gear.js';
import {ATTACKS} from '../../scenes/rongboy-mission/attacks.js';
import {ENEMY_TYPES} from '../../scenes/rongboy-mission/game.js';
import {geometryOnlyGlb} from './helpers/gltf-geometry.mjs';

const dir=new URL('../../assets/rongboy/final-trio/',import.meta.url);
const bank=await loadFigurines({zombies:geometryOnlyGlb(await readFile(new URL('final-trio.glb',dir)))});
for(const kind of ['archer','boss-warden','boss-leech']){
  const target=await readFile(new URL('design/'+kind+'.png',dir));
  assert.equal(bank.create(kind).model.userData.target_sha256,createHash('sha256').update(target).digest('hex'));
}
assert.ok(bank.kinds.includes('walker'),'warden reserves can be displayed');
function pose(actor,action,age){
  actor.reset();
  applyAttackPose({type:actor.kind,action,actionAge:age,age},actor);
  actor.world.updateMatrixWorld(true);
}
const warden=bank.create('boss-warden');
const fist=()=>new T.Box3().setFromObject(warden.parts.get('ArmL'),true).min.y;
pose(warden,'warden-windup',.8);
const raised=fist();
pose(warden,'warden-windup',1.02);
assert.ok(Math.abs(fist()-raised)<.015,'hold above ground');
pose(warden,'warden-windup',ATTACKS['boss-warden'].windup);
assert.ok(raised>1 && Math.abs(fist())<.025,'land at the damage event');
const leech=bank.create('boss-leech');
const cup=()=>leech.mechanisms.get('suctionCupL').getWorldPosition(new T.Vector3());
pose(leech,'leech-windup',0);
const start=cup();
pose(leech,'leech-windup',ATTACKS['boss-leech'].windup);
const extended=cup();
pose(leech,'leech-pull',.65);
assert.ok(extended.z-start.z>.35 && extended.z-cup().z>.10,'extend before suction, then retract');
// The face detail joint follows the same continuous skin throughout the attack.
for(const [actor,actions] of [[warden,['chase','warden-windup','warden-call','special-recover']],
                              [leech,['chase','leech-windup','leech-pull','special-recover']]]){
  const head=actor.parts.get('Head'),body=actor.parts.get('Body');
  assert.equal(head.parent,body,actor.kind+' neck hierarchy');
  assert.equal(actor.model.userData.continuous_neck,true);
  for(const action of actions) for(let i=0;i<=32;i++){
    actor.reset();
    applyAttackPose({type:actor.kind,action,age:i/20,actionAge:i/24,
      recoverFrom:actor===warden?'warden-windup':'leech-pull'},actor);
    assert.ok(head.position.distanceTo(actor.rest.get('Head').p)<1e-6);
    assert.ok(Math.abs(head.rotation.x-actor.rest.get('Head').r.x)+Math.abs(head.rotation.z-actor.rest.get('Head').r.z)<1e-6);
  }
}
const archer=bank.create('archer'),worldPoint=k=>archer.mechanisms.get(k).getWorldPosition(new T.Vector3());
for(let i=0;i<=12;i++){
  pose(archer,'archer-aim',i/12);
  updateActionGear(archer,{draw:i/12});archer.world.updateMatrixWorld(true);
  assert.ok(worldPoint('drawHand').distanceTo(worldPoint('bowNock'))<.004);
}
const m=ENEMY_TYPES.archer.muzzle;
assert.ok(worldPoint('bowUpper').add(worldPoint('bowLower')).multiplyScalar(.5).distanceTo(new T.Vector3(m.side,m.y,m.forward))<.004);
console.log('PASS three target hashes, warden reserve, slam hold/contact, suction reach/retraction, archer string/release');
