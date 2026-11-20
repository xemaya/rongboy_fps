import { poseGroundedGait } from './rongboy-gait.js';
import { applyAttackPose } from '../../scenes/rongboy-mission/attack-pose.js';
import { actionPose } from '../../scenes/rongboy-mission/actions.js';
import { ATTACKS } from '../../scenes/rongboy-mission/attacks.js';

const DEMOS = {
 leaper: ['windup','pounce'],
 crawler: ['crawler-windup','crawler-strike'],
 shielded: ['shield-windup','shield-charge'],
 archer: ['archer-aim'],
 bomber: ['bomber-throw'],
 'boss-warden': ['warden-windup'],
 'boss-leech': ['leech-windup','leech-pull'],
};
const DEMO_SPEED = {leaper:1.70,heavy:.82,shielded:1.05,bomber:1,archer:.95,'boss-warden':.69,'boss-leech':.93};

function sampleAction(type,time) {
  const [prep,strike] = DEMOS[type], spec = ATTACKS[type];
  const wind = spec.windup || 0, active = spec.strike || 0, recovery = spec.recover || .70;
  const moving = 1.45, age = time % (moving+wind+active+recovery) - moving;
  if (age<0) return {action:'chase',actionAge:age+moving};
  if (age<wind) return {action:prep,actionAge:age};
  if (strike && age<wind+active) return {action:strike,actionAge:age-wind};
  return {action:type==='leaper'?'recover':'special-recover',actionAge:age-wind-active,recoverFrom:strike||prep};
}

function leapPose(actor, enemy) {
  const spec = ATTACKS.leaper, pose = actionPose(enemy);
  actor.world.position.y = enemy.action === 'pounce' ? Math.sin(Math.PI*enemy.actionAge/spec.strike)*.65 : 0;
  actor.tilt.scale.set(1,1-pose.crouch,1);
  actor.parts.get('Body').rotation.x += .12+pose.lean;
  for (const side of ['L','R']) {
    actor.parts.get('Arm'+side).rotation.x -= 1.18+pose.reach;
    actor.parts.get('Leg'+side).rotation.x += pose.legTuck;
  }
}

// The turntable uses the same locomotion and attack poses as the mission renderer.
export function poseRosterFigurine(actor,time=0,moving=false,demonstrateAttack=false) {
  actor.reset();actor.tilt.position.set(0,0,0);actor.tilt.scale.setScalar(1);actor.world.position.y=0;
  const type=actor.nativeVariant || actor.kind;
  const action = moving && demonstrateAttack && DEMOS[type] ? sampleAction(type,time) : {action:'chase',actionAge:0};
  if (type === 'walker') {
    const period=(time*5)%(Math.PI*2), hop=moving?Math.max(0,Math.sin(period)):0;
    actor.world.position.y=hop*.16;
    for (const side of ['L','R']) {
      actor.parts.get('Arm'+side).rotation.x-=1.07+hop*.1;
      actor.parts.get('Leg'+side).rotation.x+=hop*.22;
    }
    return;
  }
  const enemy = {type,...action,age:time,awareness:'alert',stepForward:1,stepWeight:moving?1:0,
    stepDistance: time*(DEMO_SPEED[type] || .8),crawlDistance:time*.72,crawlWeight:moving?1:0};
  if (type==='leaper' && enemy.action!=='chase') leapPose(actor,enemy);
  else poseGroundedGait(enemy,actor);
  applyAttackPose(enemy,actor);
}
