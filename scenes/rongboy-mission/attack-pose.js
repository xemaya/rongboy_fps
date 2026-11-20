import { finalBossPose } from '../../library/games/rongboy-final-boss-pose.js';
import { poseCrawl } from '../../library/games/rongboy-crawl.js';
import { updateActionGear } from '../../library/games/rongboy-action-gear.js';
import { ATTACKS } from './attacks.js';
import { Vector3 } from 'three';

const bound = x => Math.max(0, Math.min(1, x));
const leapAxis = new Vector3();

// These poses read actual attack timers. Props remain attached to their native joints.
export function applyAttackPose(enemy, actor) {
  const {type,action,recoverFrom}=enemy, phase=enemy.actionAge || 0;
  const part = name => actor.parts.get(name), body = part('Body');
  const armL = part('ArmL'), armR = part('ArmR');
  const setArm = (name, pitch) => {
    const arm = part(name);
    if (arm) arm.rotation.x = actor.rest.get(name).r.x + pitch;
  };
  const recovered = action === 'special-recover';
  if (actor.model?.userData.final_costume && type.startsWith('boss-')) {
    if (action !== 'chase') finalBossPose(actor,action,phase,enemy.age || 0,recoverFrom);
    return;
  }
  if (type === 'crawler') {
    const stride = action === 'chase' ? enemy.crawlWeight || 0 : 0;
    poseCrawl(actor,enemy.crawlDistance || 0,stride,action,phase);
    if (action === 'crawler-windup') body.position.z -= .043 * bound(phase/.41);
    return;
  }
  if (type === 'leaper' && action === 'pounce') {
    const reach = Math.sin(Math.PI*bound(phase/ATTACKS.leaper.strike));
    const pitch = .43*reach, heading = enemy.heading || 0;
    const center = .80;
    // Pitch around the middle of the toy so the jump reads as a dive, with the feet trailing.
    actor.tilt.rotateOnAxis(leapAxis.set(Math.cos(heading),0,-Math.sin(heading)),pitch);
    actor.tilt.position.x -= Math.sin(heading)*center*Math.sin(pitch);
    actor.tilt.position.z -= Math.cos(heading)*center*Math.sin(pitch);
    actor.tilt.position.y += center*(1-Math.cos(pitch));
    setArm('ArmL',-1.24);setArm('ArmR',-1.08);
    if (part('LegL')) part('LegL').rotation.x -= .27*reach;
    if (part('LegR')) part('LegR').rotation.x += .15*reach;
    return;
  }
  if (type === 'leaper' && action === 'recover') {
    // One hand braces the landing before the body lifts into the run again.
    const brace = 1 - bound(phase/.29);
    setArm('ArmL',-1.26 * brace);
    if (armL) armL.rotation.z -= .11 * brace;
    if (body) body.rotation.x += .18 * brace;
    return;
  }
  if (type === 'shielded') {
    const primed = action === 'shield-windup' ? bound(phase/.65) : 0;
    const charging = action === 'shield-charge' ? 1 : 0;
    const braking = recovered && recoverFrom === 'shield-charge' ? 1-bound(phase/.91) : 0;
    setArm('ArmL',enemy.guardBroken > 0 ? -.8 : .15*primed - .13*charging + .18*braking);
    if (body) {
      body.rotation.x += -.11*primed + .27*charging + .19*braking;
      body.rotation.y += .22*braking + (enemy.guardBroken>0?.22:0);
    }
    if (armL) armL.rotation.z += .18*braking;
    if (armR) armR.rotation.x += .26*charging - .31*braking;
    return;
  }
  if (type === 'archer') {
    const aiming = action === 'archer-aim', lock = ATTACKS.archer.windup-ATTACKS.archer.lock;
    const draw = aiming ? bound(phase/lock) : 0;
    const release = recovered && recoverFrom === 'archer-aim' ? .70*(1-bound(phase/.29)) : 0;
    setArm('ArmL', aiming ? -1.14 : -1.14 + .27*(enemy.stepWeight || 0) - .08*release);
    setArm('ArmR', aiming ? -1.05 : -.75);
    updateActionGear(actor,{draw,release,arrow:aiming,
      target:aiming?{x:enemy.aimX??enemy.x,y:(enemy.base??0)+1,z:enemy.aimZ??enemy.z+5}:null});
    return;
  }
  if (type === 'bomber') {
    const throwing = action === 'bomber-throw', after = recovered && recoverFrom === 'bomber-throw';
    const lift = throwing ? Math.sin(Math.PI*bound(phase/ATTACKS.bomber.windup)) : 0;
    const follow = after ? 1-bound(phase/.42) : 0;
    setArm('ArmL',-.72 + .22*follow);
    setArm('ArmR',throwing ? -1-1.15*lift : -.79+.25*follow);
    if (body) {body.rotation.y += .20*lift - .25*follow; body.rotation.x += .20*follow;}
    updateActionGear(actor,{bomb:!after || phase>.47});
    return;
  }
  if (type === 'boss-warden') {
    const windup = action === 'warden-windup', call = action === 'warden-call';
    const progress = bound(phase/ATTACKS[type].windup);
    const raise = windup ? bound(progress/.56)*(1-bound((progress-.81)/.19)) : 0;
    const press = windup ? bound((progress-.81)/.19) : recovered && recoverFrom === 'warden-windup' ? 1-bound(phase/.59) : 0;
    if (windup || call || press>0) {
      setArm('ArmL',-.16-2.00*raise-.70*call);
      setArm('ArmR',-.16-2.00*raise-.70*call);
      if (armL) armL.position.y -= .22*press;
      if (armR) armR.position.y -= .22*press;
      if (body) {body.rotation.x += .23*press-.075*raise; body.position.y-=.12*press;}
    }
    return;
  }
  if (type === 'boss-leech' && action !== 'chase') {
    const pull = action === 'leech-pull', loading = action === 'leech-windup';
    const open = loading ? bound(phase/ATTACKS[type].windup) : pull ? 1-bound(phase/.65) : 0;
    const retract = pull ? bound(phase/.65) : recovered && recoverFrom==='leech-pull' ? 1-bound(phase/.43) : 0;
    for (const [name,side] of [['ArmL',-1],['ArmR',1]]) {
      const arm=part(name);
      setArm(name,-.65-1.02*open-.38*retract);
      if (arm) {arm.rotation.z += side*(.12+.29*open); arm.scale.y *= 1+.14*open;}
    }
    if (body) body.rotation.x += .15*open-.26*retract;
  }
}
