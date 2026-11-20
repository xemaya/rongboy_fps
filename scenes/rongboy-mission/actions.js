// 警觉后的僵尸动作状态（蓄势、扑击、回收、侧跳、冲刺）。
// 状态机与工坊版一致，只是碰撞查询改为针对传入的关卡；姿态函数直接复用工坊版。
import { clearPath, freePoint } from './level.js';
import { ATTACKS } from './attacks.js';
export { actionPose } from '../rongboy-shooter-fps/enemy-actions.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const { windup: WINDUP, strike: POUNCE, recover: RECOVER } = ATTACKS.leaper;

function setAction(e, action) { e.action = action; e.actionAge = 0; }

// 蓄势或腾空时被打中会被打断。
export function interruptAction(e) {
  if (e.action !== 'windup' && e.action !== 'pounce') return false;
  setAction(e, 'recover');
  e.actionCooldown = Math.max(e.actionCooldown, 1.8);
  return true;
}

// 返回 {x,z,y}（本帧由动作接管的速度和离地高度），或 null（交给普通追击）。
export function advanceAction(level, e, dt, player, events) {
  e.actionAge += dt;
  e.actionCooldown = Math.max(0, e.actionCooldown - dt);
  e.moveMultiplier = 1;
  e.sideLean = 0;
  const dx = player.x - e.x, dz = player.z - e.z, distance = Math.hypot(dx, dz) || 1;
  const still = { x: 0, z: 0, y: 0 };
  if (e.hit > 0) { e.actionCooldown = Math.max(e.actionCooldown, 0.3); return null; }

  if (e.action === 'windup') {
    e.heading = Math.atan2(dx, dz);
    if (e.actionAge < WINDUP) return still;
    if (!clearPath(level, e, player, e.radius + 0.045)) { setAction(e, 'recover'); e.actionCooldown = 1.4; return still; }
    e.pounceX = dx / distance; e.pounceZ = dz / distance;
    e.pounceDistance = clamp(distance - 0.55, 1.4, 3.8);
    setAction(e, 'pounce');
    events.push({ type: 'pounce', id: e.id, x: e.x, z: e.z, base: e.base });
  }
  if (e.action === 'pounce') {
    if (e.actionAge >= POUNCE) {
      setAction(e, 'recover'); e.actionCooldown = 2.5;
      events.push({ type: 'land', id: e.id, x: e.x, z: e.z, base: e.base, enemyType: e.type, pounce: true });
      return still;
    }
    const t = e.actionAge / POUNCE;
    return { x: e.pounceX * e.pounceDistance / POUNCE, z: e.pounceZ * e.pounceDistance / POUNCE, y: Math.sin(t * Math.PI) * 0.65 };
  }
  if (e.action === 'recover') {
    if (e.actionAge < RECOVER) return still;
    setAction(e, 'chase');
  }

  if (e.type === 'leaper' && e.actionCooldown <= 0 && distance > 2.3 && distance < 5.4 && clearPath(level, e, player, e.radius + 0.045)) {
    setAction(e, 'windup');
    events.push({ type: 'windup', id: e.id, x: e.x, z: e.z, base: e.base });
    return still;
  }
  if (e.type === 'weaver' && distance < 8 && distance > 1.15 && clearPath(level, e, player, e.radius + 0.06)) {
    const direction = Math.sin(e.age * 3.0 + e.id) > 0 ? 1 : -1;
    const sideX = dz / distance * direction, sideZ = -dx / distance * direction;
    const tx = e.x + sideX * 0.8 + dx / distance * 0.4, tz = e.z + sideZ * 0.8 + dz / distance * 0.4;
    if (freePoint(level, tx, tz, e.radius + 0.06) && clearPath(level, e, { x: tx, z: tz }, e.radius + 0.025)) {
      if (e.action !== 'sidestep') setAction(e, 'sidestep');
      e.sideLean = direction; e.moveMultiplier = 1.05; e.flankX = tx; e.flankZ = tz;
      return null;
    }
  }
  if (e.type === 'runner' && Math.floor((e.age + e.id * 0.11) / 1.9) % 3 === 1) { e.action = 'rush'; e.moveMultiplier = 1.25; }
  else if (e.action !== 'chase') setAction(e, 'chase');
  return null;
}
