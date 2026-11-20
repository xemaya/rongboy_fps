import * as T from 'three';
import { GAITS } from '../../scenes/rongboy-mission/locomotion.js';
import { forEachPartGeometry } from './rongboy-rig-geometry.js';

const feet = new WeakMap();
const clamp = (v, low, high) => Math.max(low,Math.min(high,v));
const wrap = n => n - Math.floor(n);
const sample = new T.Vector3();
const posedContact = new T.Vector3();
const fraction = n => clamp(n,0,1);

function supportProfile(actor, name, leg, rest) {
  if (feet.has(leg)) return feet.get(leg);
  const vertices = [];
  let low = Infinity;
  forEachPartGeometry(actor, name, (geometry, matrix) => {
    const positions = geometry.getAttribute('position');
    for (let i=0; i<positions.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(positions,i);
      if (matrix) v.applyMatrix4(matrix);
      vertices.push(v); low = Math.min(low,v.y);
    }
  });
  // A small support hull is enough for sole height as the foot rolls over the toe.
  const cells = new Map(), bounds = new T.Box3();
  for (const v of vertices) {
    if (v.y > low + .24) continue;
    if (v.y < low + .048) bounds.expandByPoint(v);
    const key = Math.round(v.x * 42) + ':' + Math.round(v.z * 42);
    if (!cells.has(key) || cells.get(key).y > v.y) cells.set(key,v);
  }
  const points = [...cells.values()], anchor = bounds.getCenter(new T.Vector3());
  const rotation = new T.Quaternion().setFromEuler(rest.r);
  const contact = anchor.clone().multiply(rest.s).applyQuaternion(rotation);
  let baseline = 0;
  if (points.length) {
    baseline = Infinity;
    for (const point of points) baseline = Math.min(baseline,sample.copy(point).multiply(rest.s).applyQuaternion(rotation).y);
  }
  const profile = { points, anchor, contact, baseline };
  feet.set(leg,profile);
  return profile;
}

function gaitFoot(actor, name, x, z, lift, stance, stride) {
  const leg = actor.parts.get(name), rest = actor.rest.get(name);
  if (!leg || !rest) return;
  const foot = supportProfile(actor,name,leg,rest);
  const angle = clamp(z / stride * .50, -.27, .27);
  leg.rotation.x -= angle;
  leg.rotation.z += clamp(x / stride * .36, -.20, .20);
  const scale = actor.model.scale;
  posedContact.copy(foot.anchor).multiply(leg.scale).applyQuaternion(leg.quaternion);
  // Let the foot roll, then compensate the origin to keep the stance sole down and anchored.
  leg.position.x += x / scale.x + foot.contact.x - posedContact.x;
  leg.position.z += z / scale.z + foot.contact.z - posedContact.z;
  let bottom = Infinity;
  for (const point of foot.points) bottom = Math.min(bottom,sample.copy(point).multiply(leg.scale).applyQuaternion(leg.quaternion).y);
  leg.position.y += lift / scale.y + (foot.points.length ? foot.baseline-bottom : 0);
  // Stance is retained for the review tests, and never affects simulation collision.
  leg.userData.planted = stance;
}

// Grounded rigs have a shared planting calculation and different weight, rhythms, silhouettes and carries.
export function poseGroundedGait(enemy, actor) {
  const gait = GAITS[enemy.type];
  if (!gait) return;
  const type = enemy.type, body = actor.parts.get('Body');
  const head = actor.model.userData.continuous_neck ? null : actor.parts.get('Head');
  const asleep = enemy.awareness === 'asleep';
  const locomotion = (enemy.action === 'chase' || enemy.action === 'shield-charge') && !asleep;
  const weight = locomotion ? enemy.stepWeight || 0 : 0;
  const cycle = (enemy.stepDistance || 0) / gait.stride;
  const sway = Math.sin(cycle * Math.PI * 2) * weight;
  const bob = Math.exp(-Math.min(wrap(cycle),wrap(cycle+.5))*12) * weight;
  const backward = Math.max(0, -(enemy.stepForward ?? 1));
  const typeLean = gait.lean * (enemy.awareness === 'alert' ? 1 : .48);
  if (body) {
    body.rotation.x += typeLean * (1-backward*.78) + bob*.057;
    body.rotation.z += sway * (type === 'boss-leech' ? .155 : type === 'shielded' ? .039 : .096);
    body.position.x += sway * gait.sway / actor.model.scale.x;
    body.position.y -= bob * gait.drop / actor.model.scale.y;
    if (type === 'bomber' && !asleep) body.rotation.z -= .105;
  }
  if (head) {
    head.position.x += sway * gait.sway * .64 / actor.model.scale.x;
    head.position.y -= bob * gait.drop * .54 / actor.model.scale.y;
    head.rotation.z -= sway * .036;
  }

  for (const [side, sign] of [['L',-1],['R',1]]) {
    const offset = sign < 0 ? 0 : type === 'boss-leech' ? .64 : type === 'bomber' ? .56 : .5;
    const phase = wrap(cycle+offset), duty = gait.stance;
    const flight = Math.max(0,(phase-duty)/(1-duty));
    const swing = flight*flight*(3-2*flight);
    const fore = (duty*.5-phase+swing) * gait.stride * weight;
    const lift = Math.sin(Math.PI*flight)**2 * gait.lift * weight * (type === 'boss-leech' && side === 'R' ? .44 : 1);
    const pivot = (enemy.stepPivot || 0) * sign;
    gaitFoot(actor,'Leg'+side,fore*(enemy.stepSide || 0),fore*((enemy.stepForward ?? 1)+pivot),lift,phase<duty || weight<.01,gait.stride);

    const arm = actor.parts.get('Arm'+side);
    if (!arm || !locomotion) continue;
    const lag = type === 'boss-warden' ? .72 : .10;
    const swingArm = Math.sin((cycle+offset)*Math.PI*2-lag) * gait.armSwing * weight;
    // Keep the shoulder seated as the torso settles into the planted step.
    if (arm.parent !== body) {
      arm.position.x += sway * gait.sway * .73 / actor.model.scale.x;
      arm.position.y -= bob * gait.drop * .72 / actor.model.scale.y;
    }
    if (type === 'shielded' && side === 'L') continue; // The shield stays on its authored guard joint.
    arm.rotation.x += (asleep ? 0 : gait.arms) + swingArm;
    arm.rotation.z += sign * (type === 'boss-leech' ? .17 + sway*.14 : .045*weight);
    if (type === 'boss-leech' && actor.mechanisms.has('hoseElbow'+side)) {
      const elbow = actor.mechanisms.get('hoseElbow'+side), cup = actor.mechanisms.get('suctionCup'+side);
      elbow.rotation.x -= .10 + swingArm*.41;
      if (cup) cup.rotation.x -= swingArm*.46;
    }
  }
}
