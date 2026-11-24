import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame, consumeEvents, fire, grenades, selectGrenade, spawn, step, throwGrenade, WEAPONS } from '../../scenes/rongboy-mission/game.js';
import { createWeaponFeedback, scopeFieldOfView } from '../../scenes/rongboy-mission/arsenal.js';
import { weaponRange } from '../../scenes/rongboy-mission/levels/weapon-range.js';
import { exitPlayHref } from '../../scenes/rongboy-mission/menu-flow.js';
import { createViewmodel } from '../../scenes/rongboy-mission/viewmodel.js';
import { createRecoil } from '../../scenes/rongboy-shooter-fps/feedback.js';

const level=compileLevel(weaponRange());
const fresh=()=>createGame({level});
const shot={origin:{x:0,y:1.05,z:3.55},direction:{x:0,y:0,z:-1}};
function tick(state,seconds) {
  for(let i=0;i<Math.ceil(seconds*120);i++) step(state,1/120);
  return consumeEvents(state);
}

const route=new URLSearchParams({level:'weapon-range'});
assert.equal(exitPlayHref(route,level.id),'rongboy-mission.html?screen=practice&focus=weapons');
const cannon=fresh();
assert.equal(WEAPONS[cannon.weapon].name,'探照灯炮');
assert.ok(fire(cannon,0,shot));

// CPU-side Three scene check. The canvas stub is only for generating wool/badge textures.
globalThis.document={createElement:()=>({getContext:()=>({
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},strokeText(){},fillText(){},
})})};
const scene=new Scene(), feedback=createWeaponFeedback(scene);
const light=scene.getObjectByName('Spotlight projectile');
feedback.sync(cannon);
assert.ok(light.isPointLight && light.intensity>0);
const from=light.position.clone();
tick(cannon,.20);feedback.sync(cannon);
assert.ok(light.position.distanceTo(from)>1);
assert.equal(light.position.z,cannon.balls.find(b=>b.weapon==='heavy').z);
cannon.balls.length=0;feedback.sync(cannon);
assert.equal(light.intensity,0,'a finished shot leaves no light behind');

const needle=WEAPONS.find(w=>w.id==='needle');
assert.equal(needle.zoom,4);
const scale=fov=>1/Math.tan(fov*Math.PI/360);
assert.ok(Math.abs(scale(scopeFieldOfView(65,needle.zoom))/scale(65)-4)<1e-12);

const displayCamera=new PerspectiveCamera(65,16/9,.035,40);
const viewmodel=createViewmodel(new Group(),new Group(),[]);
displayCamera.add(viewmodel.root);
for(const weapon of WEAPONS.filter(w=>w.kind!=='grenade')) {
  viewmodel.update({weapon:weapon.id,phase:0,speed:0,motion:1,recoil:createRecoil(),reload:0,charge:0,lob:null,invul:0,time:0});
  const projectMuzzle = fov => {
    displayCamera.fov=fov;displayCamera.updateProjectionMatrix();
    viewmodel.project(fov,displayCamera.aspect,true);displayCamera.updateMatrixWorld(true);
    return viewmodel.kit.localToWorld(new Vector3(0,0,.63)).project(displayCamera);
  };
  const idle=projectMuzzle(65), zooming=projectMuzzle(39);
  assert.ok(idle.x>.05 && idle.x<.55 && idle.y<-.25 && idle.y>-.88,`${weapon.id} stays in the lower right`);
  assert.ok(Math.hypot(idle.x-zooming.x,idle.y-zooming.y)<1e-10,`${weapon.id} holds framing while the scene zooms`);
}

// The rendered gun rotates about its visible mouth toward a point on the sightline,
// including portrait framing where the weapon projection scales x and y differently.
for (const aspect of [16/9, 1]) {
  displayCamera.aspect = aspect;
  for (const weapon of WEAPONS.filter(w=>w.kind!=='grenade')) {
    const mouth = new Vector3(0, .02, .63);
    viewmodel.update({weapon:weapon.id,phase:1,speed:.7,motion:1,recoil:createRecoil(),reload:0,charge:0,lob:null,invul:0,time:0});
    viewmodel.project(65,aspect,true);
    const before = viewmodel.kit.localToWorld(mouth.clone());
    const direction = new Vector3(0,0,-3).sub(before).normalize();
    viewmodel.aimMouth(mouth,direction);
    const after = viewmodel.kit.localToWorld(mouth.clone());
    const barrel = viewmodel.kit.localToWorld(mouth.clone().add(new Vector3(0,0,1))).sub(after).normalize();
    assert.ok(before.distanceTo(after)<1e-10,weapon.id+' rotates around its muzzle');
    assert.ok(barrel.dot(direction)>1-1e-10,weapon.id+' points where its shot is aimed');
  }
}

function blast(selected) {
  const state=fresh();
  if(selected==='jack') assert.ok(selectGrenade(state));
  assert.equal(WEAPONS[state.grenade].id,selected);
  const before=grenades(state), side=state.enemies[0];
  assert.ok(throwGrenade(state,0,shot));
  assert.equal(grenades(state),before-1);
  const events=tick(state,1.7);
  const hit=events.find(e=>e.type==='hit' && e.id===side.id && e.source==='blast');
  assert.ok(hit?.amount>0,selected+' causes real damage in the showcase corridor');
  assert.ok(events.some(e=>e.type==='explode' && e.weapon===selected));
  feedback.damage(hit,state.time);
  feedback.sync(state);
  assert.ok(scene.children.some(child=>child.isSprite && child.visible && child.material.map),'damage marker shown');
  return {state,hit};
}
const jack=blast('jack'), steamer=blast('yarn');
assert.ok(jack.hit.impulse>2*steamer.hit.impulse,'the jack hits with a stronger shove');
assert.equal(jack.state.tangleFields.length,0);
const field=steamer.state.tangleFields[0];
assert.ok(field && field.until>steamer.state.time);
const late=spawn(steamer.state,{x:field.x+.24,z:field.z,state:'asleep'});
tick(steamer.state,.04);
assert.ok(late.tangle>0 && late.hp===late.maxHp,'stepping onto the lingering weave slows without a second blast');
feedback.clear();
assert.equal(light.intensity,0);
console.log('PASS showcase loadout, moving scene light, exact scope ratio, both blasts and lingering weave');
