// 任务制毛球战斗。确定性、不依赖 DOM；地面是 X/Z 平面，单位为米和秒。
// 与工坊版的区别：僵尸数量固定且默认没发现你；武器有伤害、射程、弹匣和噪音；通关靠完成任务。
import { FEEL } from '../rongboy-shooter-fps/feedback.js';
import { segmentBox, clearPath, lineOfSight, resolveBody, routeTo, navRadius, isOutdoor } from './level.js';
import { advanceAction, interruptAction } from './actions.js';

export const CONFIG = {
  playerSpeed: 3.15, playerRadius: 0.30, maxHealth: 3, invulnerable: 1.2,
  chargeTime: 0.82, maxBalls: 48, ballLife: 5, repeatHitDelay: 0.18, gravity: 0.9,
  // 感知
  hearRadius: 1.5,     // 睡着的僵尸：你走到这么近才会醒
  closeRange: 1.3,     // 醒着的僵尸：这么近时不看朝向也会发现你
  sightRange: 8, sightCos: 0.34,   // 醒着的僵尸：视距，以及正前方约 ±70° 的视野
  wakeAsleep: 1.1, wakeIdle: 0.45, wakeHit: 0.35,   // 从察觉到真正扑过来的反应时间
  callRadius: 4.5,     // 一只警觉后会叫醒这么近、且看得见的同伴
  backCos: 0.35,       // 毛球飞行方向与僵尸朝向的夹角小于约 70° 算打中后背
  endDelay: 1.3, pickupRadius: 0.75,
};

export const ENEMY_TYPES = {
  walker: { name: '跳跳', hp: 6, radius: 0.32, height: 1.62, scale: 1, speed: 1.45, hopHeight: 0.22, hopPeriod: 0.72, resistance: 1 },
  runner: { name: '快跳', hp: 4, radius: 0.28, height: 1.43, scale: 0.88, speed: 2.4, hopHeight: 0.32, hopPeriod: 0.43, resistance: 1.2 },
  weaver: { name: '侧跳', hp: 5, radius: 0.30, height: 1.54, scale: 0.95, speed: 1.5, hopHeight: 0.26, hopPeriod: 0.60, resistance: 1.05 },
  leaper: { name: '扑扑', hp: 5, radius: 0.30, height: 1.56, scale: 0.96, speed: 1.5, hopHeight: 0.23, hopPeriod: 0.70, resistance: 0.9 },
  // 棉甲正面只吃一半伤害，要绕到背后打。
  heavy: { name: '棉甲', hp: 8, radius: 0.43, height: 1.81, scale: 1.12, speed: 0.9, hopHeight: 0.12, hopPeriod: 1.02, resistance: 0.38, armor: 0.5 },
};

// damage 在 range 以内是全额，之后线性衰减，到 2×range 降为 minDamage；飞过 maxRange 就散掉。
// noise 是开枪声能惊动僵尸的距离（隔墙减半）。reserve 为 Infinity 表示备弹无限。
export const WEAPONS = [
  { id: 'single', name: '线轴手枪', tag: '均衡 · 备弹无限', count: 1, damage: 2, chargeDamage: 1, range: 9, minDamage: 1, maxRange: 22,
    mag: 6, reserve: Infinity, reload: 1.15, cooldown: 0.26, speed: 13, bounces: 2, noise: 5.5, push: 1.8, chargePush: 3.6, color: 0xf3dfa5 },
  { id: 'scatter', name: '绒球霰弹', tag: '近战 · 三球齐发', count: 3, damage: 2, chargeDamage: 0, range: 4, minDamage: 1, maxRange: 11,
    mag: 2, reserve: 4, reload: 1.7, cooldown: 0.55, speed: 12, bounces: 1, noise: 8, push: 0.72, chargePush: 0.55, color: 0xabc8bd },
  { id: 'heavy', name: '棉被炮', tag: '重击 · 弹药稀少', count: 1, damage: 5, chargeDamage: 0, range: 12, minDamage: 3, maxRange: 24,
    mag: 1, reserve: 1, reload: 2.0, cooldown: 0.5, speed: 10, bounces: 3, noise: 12, push: 9.2, chargePush: 3.6, color: 0xd6a789 },
];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const length = (x, z) => Math.hypot(x, z);

export function createGame({ level } = {}) {
  if (!level) throw new Error('createGame 需要一个编译好的关卡');
  const s = {
    phase: 'playing', level, time: 0, weapon: 0,
    ammo: WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve })), reloading: false, reload: 0,
    health: CONFIG.maxHealth, damageTaken: 0, kills: 0, total: 0, shots: 0, hits: 0, bounces: 0, backHits: 0, sneakHits: 0,
    charge: 0, charging: false, cooldown: 0, invul: 0, nextId: 1, endIn: null, stars: 0, carrying: false,
    enemies: [], balls: [], events: [],
    pickups: (level.pickups || []).map((p, i) => ({ ...p, id: i + 1, taken: false })),
    player: { x: level.player.x, z: level.player.z, vx: 0, vz: 0, aimX: 0, aimY: 0, aimZ: -1 },
  };
  for (const e of level.enemies || []) spawn(s, e);
  return s;
}

// state: 'asleep' | 'idle' | 'alert'。patrol 是 [[x,z],...] 巡逻点。
export function spawn(s, { type = 'walker', x, z, state = 'alert', heading = 0, patrol = null }) {
  const def = ENEMY_TYPES[type] || ENEMY_TYPES.walker;
  const e = {
    ...def, type, id: s.nextId++, x, y: 0, z, vx: 0, vz: 0, hp: def.hp, maxHp: def.hp, alive: true, heading,
    awareness: state, wake: 0, senseIn: 0, patrol, patrolIndex: 0, patrolWait: 0,
    hit: 0, hitDuration: 0, age: 0, deathAge: 0, fallX: 0, fallZ: 1, chainCooldown: 0,
    reactionAge: 10, reactionStrength: 0, reactionWeapon: 'single', reactionX: 0, reactionZ: 1, reactionTwist: 0,
    navIn: 0, route: [], hopPhase: 0, action: 'chase', actionAge: 0, actionCooldown: 1.3, sideLean: 0, moveMultiplier: 1,
  };
  e.actionCooldown += (e.id % 3) * 0.25;
  resolveBody(s.level, e, e.radius);
  s.enemies.push(e);
  s.total++;
  return e;
}

export const aliveCount = s => s.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);

// ---------- 武器 ----------

export function selectWeapon(s, index) {
  if (s.phase !== 'playing' || !WEAPONS[index] || s.weapon === index) return false;
  s.weapon = index; s.charging = false; s.charge = 0; s.reloading = false; s.reload = 0;
  s.events.push({ type: 'weapon', weapon: index });
  return true;
}

export function startReload(s) {
  const w = WEAPONS[s.weapon], a = s.ammo[s.weapon];
  if (s.phase !== 'playing' || s.reloading || a.mag >= w.mag || a.reserve <= 0) return false;
  s.reloading = true; s.reload = w.reload; s.charging = false; s.charge = 0;
  s.events.push({ type: 'reload', weapon: w.id, duration: w.reload });
  return true;
}

function finishReload(s) {
  const w = WEAPONS[s.weapon], a = s.ammo[s.weapon], take = Math.min(w.mag - a.mag, a.reserve);
  a.mag += take; a.reserve -= take;   // Infinity - n 仍是 Infinity
  s.reloading = false; s.reload = 0;
  s.events.push({ type: 'reloaded', weapon: w.id });
}

function canShoot(s) {
  if (s.phase !== 'playing' || s.reloading) return false;
  if (s.ammo[s.weapon].mag > 0) return true;
  if (!startReload(s)) s.events.push({ type: 'dry', weapon: WEAPONS[s.weapon].id });
  return false;
}

export function beginCharge(s) {
  if (s.charging || !canShoot(s)) return false;
  s.charging = true; s.charge = 0;
  return true;
}

export function releaseCharge(s, shot = null) {
  if (!s.charging) return false;
  s.charging = false;
  const power = clamp((s.charge - 0.12) / (CONFIG.chargeTime - 0.12), 0, 1);
  s.charge = 0;
  return fire(s, power, shot);
}

// shot 可以给出实际枪口位置和方向（表现层算出来的）；不给就按玩家朝向从身前发射。
export function fire(s, power = 0, shot = null) {
  if (s.cooldown > 0 || !canShoot(s)) return false;
  power = clamp(power, 0, 1);
  const w = WEAPONS[s.weapon], p = s.player;
  const dir = shot?.direction || { x: p.aimX, y: p.aimY || 0, z: p.aimZ };
  const m = Math.hypot(dir.x, dir.y, dir.z) || 1, dx = dir.x / m, dy = dir.y / m, dz = dir.z / m;
  const origin = shot?.origin || { x: p.x + dx * 0.63, y: 0.76, z: p.z + dz * 0.63 };
  const flat = Math.hypot(dx, dz) || 1, rx = -dz / flat, rz = dx / flat;
  // 开枪声会立刻惊动目标，所以"偷袭"按开枪那一刻算：当时还没察觉的僵尸，这一枪打中它仍有加成。
  const quiet = s.enemies.filter(e => e.alive && unaware(e)).map(e => e.id);
  for (let i = 0; i < w.count; i++) {
    if (s.balls.length >= CONFIG.maxBalls) expireBall(s, s.balls.shift());
    const offset = w.count === 1 ? 0 : (i - (w.count - 1) / 2) * (0.15 - power * 0.07);
    const ax = dx + rx * offset, az = dz + rz * offset, n = Math.hypot(ax, dy, az);
    const speed = w.speed - (w.id === 'single' ? power * 2 : 0);
    const effective = w.id === 'heavy' ? 0.75 + power * 0.25 : power;
    const radius = w.id === 'scatter' ? 0.085 + power * 0.035 : w.id === 'heavy' ? 0.22 + power * 0.06 : 0.10 + 0.15 * power;
    s.balls.push({
      id: s.nextId++, weapon: w.id, x: origin.x, y: origin.y, z: origin.z, r: radius, power: effective,
      vx: ax / n * speed, vy: dy / n * speed, vz: az / n * speed, dx: ax / n, dy: dy / n, dz: az / n, speed,
      damage: w.damage + (power >= 0.6 ? w.chargeDamage : 0), minDamage: w.minDamage, range: w.range, maxRange: w.maxRange,
      impulse: w.push + power * w.chargePush, stun: FEEL[w.id].stun + power * 0.035,
      age: 0, travel: 0, lifetime: CONFIG.ballLife, bounceCount: 0, maxBounces: w.bounces, enemyHits: 0, hitTimes: {}, destroyed: false, quiet,
    });
  }
  s.ammo[s.weapon].mag--;
  s.shots++;
  s.cooldown = w.cooldown + (w.id === 'single' && power >= 0.6 ? 0.16 : 0);
  s.events.push({ type: 'shot', x: origin.x, y: origin.y, z: origin.z, dx, dy, dz, power, weapon: w.id });
  emitNoise(s, origin.x, origin.z, w.noise);
  return true;
}

export function ballDamage(b) {
  if (b.travel <= b.range) return b.damage;
  const t = clamp((b.travel - b.range) / b.range, 0, 1);
  return Math.max(b.minDamage, Math.round(b.damage + (b.minDamage - b.damage) * t));
}

// ---------- 感知 ----------

const unaware = e => e.awareness === 'asleep' || e.awareness === 'idle';

// 僵尸察觉到异常，过一小段反应时间后才会警觉。
function notice(s, e, delay, reason) {
  if (!e.alive || !unaware(e)) return;
  const base = reason === 'hit' ? CONFIG.wakeHit : e.awareness === 'asleep' ? CONFIG.wakeAsleep : CONFIG.wakeIdle;
  e.awareness = 'waking'; e.wake = base + delay; e.patrol = null;
  s.events.push({ type: 'notice', id: e.id, x: e.x, z: e.z, reason });
}

function becomeAlert(s, e) {
  e.awareness = 'alert'; e.action = 'chase'; e.actionAge = 0; e.navIn = 0;
  s.events.push({ type: 'alert', id: e.id, x: e.x, z: e.z, enemyType: e.type });
  for (const o of s.enemies) {
    if (o === e || !o.alive || !unaware(o)) continue;
    const d = length(o.x - e.x, o.z - e.z);
    if (d < CONFIG.callRadius && lineOfSight(s.level, e, o)) notice(s, o, 0.25 + d / 10, 'call');
  }
}

// 声音：看得见声源的在 radius 内都会被惊动，隔着墙只有一半距离。
export function emitNoise(s, x, z, radius) {
  for (const e of s.enemies) {
    if (!e.alive || !unaware(e)) continue;
    const d = length(e.x - x, e.z - z);
    if (d >= radius) continue;
    if (d < radius * 0.5 || lineOfSight(s.level, { x, z }, e)) notice(s, e, d / 14, 'noise');
  }
}

function sense(s, e, dt) {
  const p = s.player, dx = p.x - e.x, dz = p.z - e.z, d = length(dx, dz) || 1;
  if (e.awareness === 'waking') {
    e.wake -= dt;
    let turn = Math.atan2(dx, dz) - e.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    e.heading += clamp(turn, -dt * 5, dt * 5);
    if (e.wake <= 0) becomeAlert(s, e);
    return;
  }
  e.senseIn -= dt;
  if (e.senseIn > 0) return;
  e.senseIn = 0.1;
  if (e.awareness === 'asleep') {
    if (d < CONFIG.hearRadius && lineOfSight(s.level, e, p)) notice(s, e, 0, 'near');
    return;
  }
  if (d < CONFIG.closeRange && lineOfSight(s.level, e, p)) { notice(s, e, 0, 'near'); return; }
  if (d < CONFIG.sightRange) {
    const facing = (Math.sin(e.heading) * dx + Math.cos(e.heading) * dz) / d;
    if (facing > CONFIG.sightCos && lineOfSight(s.level, e, p)) notice(s, e, 0, 'sight');
  }
}

// 没发现玩家时：睡着的不动，巡逻的在几个点之间慢慢蹦。
function idleMove(s, e, dt) {
  e.y = 0; e.hopPhase = 0;
  if (e.awareness !== 'idle' || !e.patrol || e.hit > 0) return;
  if (e.patrolWait > 0) { e.patrolWait -= dt; return; }
  const [tx, tz] = e.patrol[e.patrolIndex], dx = tx - e.x, dz = tz - e.z, d = length(dx, dz);
  if (d < 0.12) { e.patrolIndex = (e.patrolIndex + 1) % e.patrol.length; e.patrolWait = 1.4; return; }
  const period = e.hopPeriod * 1.5;
  e.hopPhase = (e.age % period) / period;
  const flight = clamp(e.hopPhase / 0.78, 0, 1), lift = Math.sin(flight * Math.PI);
  e.y = lift * e.hopHeight * 0.5;
  const travel = Math.min(d, e.speed * 0.42 * (0.15 + 1.55 * lift) * dt);
  e.x += dx / d * travel; e.z += dz / d * travel;
  e.heading = Math.atan2(dx, dz);
}

// 警觉后：绕开家具追玩家，按兵种穿插扑击、侧跳、冲刺。
function chase(s, e, dt) {
  const L = s.level, p = s.player, prevPhase = e.hopPhase, r = navRadius(e.radius);
  const action = advanceAction(L, e, dt, p, s.events);
  e.hopPhase = ((e.age + e.id * 0.137) % e.hopPeriod) / e.hopPeriod;
  const flight = clamp(e.hopPhase / 0.78, 0, 1), lift = Math.sin(flight * Math.PI);
  e.y = action ? action.y : lift * e.hopHeight;
  if (e.hopPhase < prevPhase && !action) s.events.push({ type: 'land', id: e.id, x: e.x, z: e.z, enemyType: e.type });
  if (action) {
    if (e.hit <= 0) { e.x += action.x * dt; e.z += action.z * dt; }
    return;
  }
  e.navIn -= dt;
  if (e.navIn <= 0) { e.route = routeTo(L, e, p, r); e.navIn = 0.4; }
  while (e.route.length && length(e.x - e.route[0].x, e.z - e.route[0].z) < 0.04) e.route.shift();
  const next = e.action === 'sidestep' ? { x: e.flankX, z: e.flankZ } : clearPath(L, e, p, r, true) ? p : e.route[0];
  if (!next) return;
  const dx = next.x - e.x, dz = next.z - e.z, d = length(dx, dz) || 1;
  const speed = e.hit <= 0 ? e.speed * e.moveMultiplier * (0.15 + 1.55 * lift) : 0;
  const travel = Math.min(d, speed * dt);
  e.x += dx / d * travel; e.z += dz / d * travel;
  if (d > 0.03 && e.hit <= 0) {
    const sidestep = e.action === 'sidestep';
    e.heading = Math.atan2(sidestep ? p.x - e.x : dx, sidestep ? p.z - e.z : dz);
  }
}

// ---------- 伤害 ----------

function knockdown(s, e, dx, dz, source) {
  if (!e.alive) return;
  e.alive = false; e.deathAge = 0; e.fallX = dx; e.fallZ = dz;
  s.kills++;
  s.events.push({ type: 'knockdown', id: e.id, x: e.x, z: e.z, dx, dz, source, weapon: e.reactionWeapon, strength: e.reactionStrength, left: aliveCount(s) });
}

function damage(s, e, amount, dx, dz, impulse, source = 'ball', meta = {}) {
  if (!e.alive) return;
  e.hp = Math.max(0, e.hp - amount);
  if (interruptAction(e)) s.events.push({ type: 'interrupted', id: e.id, x: e.x, z: e.z });
  if (unaware(e)) notice(s, e, 0, 'hit');
  else if (e.awareness === 'waking') e.wake = Math.min(e.wake, CONFIG.wakeHit);
  e.vx += dx * impulse * e.resistance; e.vz += dz * impulse * e.resistance;
  const weapon = meta.weapon || (impulse > 3 ? 'heavy' : 'single'), feel = FEEL[weapon] || FEEL.single;
  e.hit = Math.max(e.hit, meta.stun ?? feel.stun); e.hitDuration = e.hit; e.chainCooldown = 0.16;
  const stacked = e.reactionAge < 0.055 ? e.reactionStrength * 0.22 : 0;
  e.reactionStrength = Math.min(1.6, feel.impact * Math.sqrt(e.resistance) + stacked);
  e.reactionAge = 0; e.reactionWeapon = weapon; e.reactionX = dx; e.reactionZ = dz;
  const offsetX = (meta.contactX ?? e.x) - e.x, offsetZ = (meta.contactZ ?? e.z) - e.z;
  const twist = (offsetX * dz - offsetZ * dx) / e.radius;
  e.reactionTwist = Math.abs(twist) > 0.08 ? clamp(twist, -1, 1) : (e.id % 2 ? 1 : -1) * 0.7;
  s.events.push({ type: 'hit', id: e.id, x: e.x, z: e.z, dx, dz, heavy: weapon === 'heavy', source, amount, hp: e.hp, maxHp: e.maxHp,
    impulse: impulse * e.resistance, strength: e.reactionStrength, ...meta, weapon });
  if (e.hp <= 0) knockdown(s, e, dx, dz, source);
}

// 毛球打中僵尸：算射程衰减、正面护甲，以及背后和偷袭的加成（各 +100%，可叠加）。
function ballHit(s, b, e, incoming) {
  const n = Math.hypot(incoming.x, incoming.z) || 1, dx = incoming.x / n, dz = incoming.z / n;
  const back = dx * Math.sin(e.heading) + dz * Math.cos(e.heading) > CONFIG.backCos;
  const sneak = unaware(e) || (e.awareness === 'waking' && b.quiet.includes(e.id));
  let amount = ballDamage(b);
  if (e.armor && !back) amount = Math.max(1, Math.floor(amount * e.armor));
  amount *= 1 + (back ? 1 : 0) + (sneak ? 1 : 0);
  b.hitTimes[e.id] = s.time; b.enemyHits++;
  s.hits++; if (back) s.backHits++; if (sneak) s.sneakHits++;
  damage(s, e, amount, dx, dz, b.impulse, 'ball', { ballId: b.id, weapon: b.weapon, stun: b.stun, back, sneak, armored: !!e.armor && !back, contactX: b.x, contactY: b.y, contactZ: b.z });
}

// ---------- 毛球 ----------

function expireBall(s, b, reason = 'lifetime') {
  if (b.destroyed) return;
  b.destroyed = true;
  s.events.push({ type: 'ball-expired', id: b.id, x: b.x, y: b.y, z: b.z, reason, bounces: b.bounceCount });
}

// 线段与竖直圆柱（僵尸身体）求交，返回首个交点参数。
export function segmentCylinder(ax, ay, az, bx, by, bz, cx, cz, r, minY, maxY) {
  const dx = bx - ax, dz = bz - az, fx = ax - cx, fz = az - cz, A = dx * dx + dz * dz, C = fx * fx + fz * fz - r * r;
  let lo = 0, hi = 1;
  if (A < 1e-10) { if (C > 0) return null; }
  else {
    const B = 2 * (fx * dx + fz * dz), D = B * B - 4 * A * C;
    if (D < 0) return null;
    lo = Math.max(0, (-B - Math.sqrt(D)) / (2 * A)); hi = Math.min(1, (-B + Math.sqrt(D)) / (2 * A));
  }
  const dy = by - ay;
  if (Math.abs(dy) < 1e-10) { if (ay < minY || ay > maxY) return null; }
  else { let a = (minY - ay) / dy, b = (maxY - ay) / dy; if (a > b) [a, b] = [b, a]; lo = Math.max(lo, a); hi = Math.min(hi, b); }
  return lo <= hi && hi >= 0 && lo <= 1 ? Math.max(0, lo) : null;
}

// 镜头朝向 yaw 下，把左右/前后输入换成地面方向。
export function cameraMove(side, forward, yaw) {
  return { x: side * Math.cos(yaw) - forward * Math.sin(yaw), z: -side * Math.sin(yaw) - forward * Math.cos(yaw) };
}

// 一帧内逐段扫掠：每次推进到最近的接触点，反弹后用剩余时间继续，快球不会穿过薄墙。
function advanceBall(s, b, dt) {
  const L = s.level, B = L.bounds;
  b.age += dt;
  if (b.age >= b.lifetime) { expireBall(s, b); return; }
  b.vy -= CONFIG.gravity * dt;
  const limits = [['x', B.minX + b.r, B.maxX - b.r], ['y', 0.03 + b.r, L.height - b.r], ['z', B.minZ + b.r, B.maxZ - b.r]];
  for (const [axis, lo, hi] of limits) b[axis] = clamp(b[axis], lo, hi);
  let left = dt;
  for (let pass = 0; pass < 6 && left > 1e-7 && !b.destroyed; pass++) {
    const end = { x: b.x + b.vx * left, y: b.y + b.vy * left, z: b.z + b.vz * left };
    let hit = null;
    const candidate = (t, nx, ny, nz, kind, e = null) => {
      if (t >= -1e-8 && t <= 1 && (hit === null || t < hit.t - 1e-8)) hit = { t: Math.max(0, t), nx, ny, nz, kind, e };
    };
    for (const [axis, lo, hi] of limits) {
      const delta = end[axis] - b[axis], n = { x: 0, y: 0, z: 0 };
      if (delta > 1e-10 && end[axis] >= hi) { n[axis] = -1; candidate((hi - b[axis]) / delta, n.x, n.y, n.z, axis === 'y' ? 'ceiling' : 'edge'); }
      else if (delta < -1e-10 && end[axis] <= lo) { n[axis] = 1; candidate((lo - b[axis]) / delta, n.x, n.y, n.z, axis === 'y' ? 'floor' : 'edge'); }
    }
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const radius = e.radius + b.r, minY = e.y + 0.04 - b.r, maxY = e.y + e.height + b.r;
      const t = segmentCylinder(b.x, b.y, b.z, end.x, end.y, end.z, e.x, e.z, radius, minY, maxY);
      if (t === null) continue;
      const cx = b.x + (end.x - b.x) * t, cy = b.y + (end.y - b.y) * t, cz = b.z + (end.z - b.z) * t;
      let nx = 0, ny = 0, nz = 0;
      if (Math.abs(cy - maxY) < 0.001 && b.vy < 0) ny = 1;
      else if (Math.abs(cy - minY) < 0.001 && b.vy > 0) ny = -1;
      else {
        const d = Math.hypot(cx - e.x, cz - e.z);
        if (d > 0.0001) { nx = (cx - e.x) / d; nz = (cz - e.z) / d; }
        else { const v = Math.hypot(b.vx, b.vz) || 1; nx = -b.vx / v; nz = -b.vz / v; }
      }
      if (b.vx * nx + b.vy * ny + b.vz * nz >= -1e-6) continue;   // 已经在分离的接触不算
      candidate(t, nx, ny, nz, 'enemy', e);
    }
    for (const c of L.solids) {
      const h = segmentBox(b, end, c, b.r);
      if (h && b.vx * h.nx + b.vy * h.ny + b.vz * h.nz < -1e-6) candidate(h.t, h.nx, h.ny, h.nz, 'solid');
    }
    const t = hit ? hit.t : 1;
    b.travel += Math.hypot(end.x - b.x, end.y - b.y, end.z - b.z) * t;
    b.x += (end.x - b.x) * t; b.y += (end.y - b.y) * t; b.z += (end.z - b.z) * t;
    if (b.travel >= b.maxRange) { expireBall(s, b, 'range'); break; }
    if (!hit) break;
    left *= 1 - hit.t;
    // 户外没有天花板，也没有高过围篱的墙：飞出去的球直接散掉。
    if ((hit.kind === 'ceiling' || (hit.kind === 'edge' && b.y > 2.3)) && isOutdoor(L, b.x, b.z)) { expireBall(s, b, 'sky'); break; }
    const incoming = { x: b.vx, y: b.vy, z: b.vz };
    if (hit.e) {
      const e = hit.e;
      if (s.time - (b.hitTimes[e.id] ?? -100) >= CONFIG.repeatHitDelay) ballHit(s, b, e, incoming);
      if (hit.ny !== 0) b.y = hit.ny > 0 ? e.y + e.height + b.r + 0.002 : e.y + 0.04 - b.r - 0.002;
      else { const radius = e.radius + b.r + 0.002; b.x = e.x + hit.nx * radius; b.z = e.z + hit.nz * radius; }
    } else { b.x += hit.nx * 0.002; b.y += hit.ny * 0.002; b.z += hit.nz * 0.002; }
    const dot = b.vx * hit.nx + b.vy * hit.ny + b.vz * hit.nz, retain = hit.e ? 0.98 : 0.985;
    b.vx = (b.vx - 2 * dot * hit.nx) * retain; b.vy = (b.vy - 2 * dot * hit.ny) * retain; b.vz = (b.vz - 2 * dot * hit.nz) * retain;
    if (hit.kind === 'floor') b.vy = Math.max(1.05, b.vy * 0.88);
    b.bounceCount++; s.bounces++;
    if (s.time - (b.lastBounceEvent ?? -1) > 0.04) {
      b.lastBounceEvent = s.time;
      s.events.push({ type: 'bounce', id: b.id, x: b.x, y: b.y, z: b.z, kind: hit.kind, count: b.bounceCount, weapon: b.weapon });
    }
    if (b.bounceCount > b.maxBounces) expireBall(s, b, 'bounce-limit');
  }
  b.speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
  b.dx = b.vx / b.speed; b.dy = b.vy / b.speed; b.dz = b.vz / b.speed;
}

// ---------- 拾取与任务 ----------

function collect(s) {
  const p = s.player;
  for (const k of s.pickups) {
    if (k.taken || length(k.x - p.x, k.z - p.z) > CONFIG.pickupRadius) continue;
    if (k.kind === 'heart') {
      if (s.health >= CONFIG.maxHealth) continue;
      s.health = Math.min(CONFIG.maxHealth, s.health + k.amount);
    } else if (k.kind === 'ammo') {
      const index = WEAPONS.findIndex(w => w.id === k.weapon);
      if (index < 0) continue;
      s.ammo[index].reserve += k.amount;
    } else if (k.kind === 'objective') {
      s.carrying = true;
      if (s.level.mission.alarm) for (const e of s.enemies) notice(s, e, length(e.x - p.x, e.z - p.z) / 14, 'alarm');
    }
    k.taken = true;
    s.events.push({ type: 'pickup', id: k.id, kind: k.kind, weapon: k.weapon, amount: k.amount, x: k.x, z: k.z });
  }
}

// 任务：clear = 清空所有僵尸；fetch = 拿到目标物后回到出口区域。
export function missionStatus(s) {
  const m = s.level.mission, alive = aliveCount(s);
  if (m.type === 'fetch') {
    const exit = m.exit, p = s.player;
    const atExit = p.x >= exit.minX && p.x <= exit.maxX && p.z >= exit.minZ && p.z <= exit.maxZ;
    return { type: 'fetch', carrying: s.carrying, atExit, alive, total: s.total, done: s.carrying && atExit };
  }
  return { type: 'clear', alive, total: s.total, done: s.total > 0 && alive === 0 };
}

function finish(s, phase) {
  s.phase = phase; s.charging = false; s.charge = 0;
  // 一星通关，受伤不超过一次再加一星，在标准时间内完成再加一星。
  s.stars = phase === 'won' ? 1 + (s.damageTaken <= 1 ? 1 : 0) + (s.time <= (s.level.par ?? Infinity) ? 1 : 0) : 0;
  s.events.push({ type: 'round-end', phase, stars: s.stars });
}

// ---------- 主循环 ----------

export function step(s, dt, input = {}) {
  if (s.phase !== 'playing') return;
  dt = clamp(dt, 0, 0.05);
  const L = s.level, p = s.player;
  s.time += dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.invul = Math.max(0, s.invul - dt);
  if (s.charging) s.charge = Math.min(CONFIG.chargeTime, s.charge + dt);
  if (s.reloading) { s.reload -= dt; if (s.reload <= 0) finishReload(s); }
  else if (s.ammo[s.weapon].mag === 0 && s.cooldown <= 0) startReload(s);   // 打空自动换弹

  let mx = input.x || 0, mz = input.z || 0;
  const m = length(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimZ)) {
    const n = Math.hypot(input.aimX, input.aimY || 0, input.aimZ);
    if (n > 0.01) { p.aimX = input.aimX / n; p.aimY = (input.aimY || 0) / n; p.aimZ = input.aimZ / n; }
  }
  p.x += mx * CONFIG.playerSpeed * dt + p.vx * dt; p.z += mz * CONFIG.playerSpeed * dt + p.vz * dt;
  p.vx *= Math.exp(-10 * dt); p.vz *= Math.exp(-10 * dt);
  resolveBody(L, p, CONFIG.playerRadius);

  for (const e of s.enemies) {
    e.age += dt; e.reactionAge += dt;
    e.hit = Math.max(0, e.hit - dt); e.chainCooldown = Math.max(0, e.chainCooldown - dt);
    if (!e.alive) { e.deathAge += dt; e.y *= Math.exp(-dt * 12); }
    else if (e.awareness === 'alert') chase(s, e, dt);
    else { sense(s, e, dt); if (e.awareness !== 'alert') idleMove(s, e, dt); }
    e.x += e.vx * dt; e.z += e.vz * dt;
    e.vx *= Math.exp(-4.3 * dt); e.vz *= Math.exp(-4.3 * dt);
    resolveBody(L, e, e.radius);
  }

  // 软身体互相推开；被打飞的僵尸撞到同伴会传递冲量并造成 1 点伤害。
  for (let i = 0; i < s.enemies.length; i++) for (let j = i + 1; j < s.enemies.length; j++) {
    const a = s.enemies[i], b = s.enemies[j];
    if ((!a.alive && a.deathAge > 0.48) || (!b.alive && b.deathAge > 0.48)) continue;
    let dx = b.x - a.x, dz = b.z - a.z, d = length(dx, dz);
    const r = a.radius + b.radius;
    if (d >= r) continue;
    if (d < 0.001) { dx = 0.001; dz = 0; d = 0.001; }
    const nx = dx / d, nz = dz / d, over = r - d;
    a.x -= nx * over * 0.5; b.x += nx * over * 0.5; a.z -= nz * over * 0.5; b.z += nz * over * 0.5;
    const va = a.vx * nx + a.vz * nz, vb = -(b.vx * nx + b.vz * nz);
    if (va > 2.0 && b.alive && b.chainCooldown <= 0) { damage(s, b, 1, nx, nz, va * 0.75, 'collision'); a.vx *= 0.55; a.vz *= 0.55; }
    else if (vb > 2.0 && a.alive && a.chainCooldown <= 0) { damage(s, a, 1, -nx, -nz, vb * 0.75, 'collision'); b.vx *= 0.55; b.vz *= 0.55; }
  }
  for (const e of s.enemies) resolveBody(L, e, e.radius);

  for (const ball of s.balls) advanceBall(s, ball, dt);
  s.balls = s.balls.filter(b => !b.destroyed);
  s.enemies = s.enemies.filter(e => e.alive || e.deathAge < 1.15);

  // 只有已经警觉的僵尸碰到你才会扣心。
  if (s.invul <= 0) for (const e of s.enemies) {
    if (!e.alive || e.awareness !== 'alert') continue;
    const dx = p.x - e.x, dz = p.z - e.z, d = length(dx, dz);
    if (d >= CONFIG.playerRadius + e.radius) continue;
    const n = d || 1;
    p.vx = dx / n * 3; p.vz = dz / n * 3; e.vx -= dx / n * 2; e.vz -= dz / n * 2;
    s.health--; s.damageTaken++; s.invul = CONFIG.invulnerable;
    s.events.push({ type: 'hurt', x: p.x, z: p.z, by: e.id });
    break;
  }
  // 身体是实心的：贴上去会互相顶开，不会穿过。
  for (const e of s.enemies) {
    if (!e.alive) continue;
    let dx = p.x - e.x, dz = p.z - e.z, d = length(dx, dz);
    const r = CONFIG.playerRadius + e.radius;
    if (d >= r) continue;
    if (d < 0.001) { dx = 0.001; dz = 0; d = 0.001; }
    const overlap = r - d, nx = dx / d, nz = dz / d;
    p.x += nx * overlap * 0.85; p.z += nz * overlap * 0.85; e.x -= nx * overlap * 0.15; e.z -= nz * overlap * 0.15;
    resolveBody(L, e, e.radius);
  }
  resolveBody(L, p, CONFIG.playerRadius);

  collect(s);

  if (s.health <= 0) { finish(s, 'lost'); return; }
  if (s.endIn !== null) { s.endIn -= dt; if (s.endIn <= 0) finish(s, 'won'); }
  else if (missionStatus(s).done) { s.endIn = CONFIG.endDelay; s.events.push({ type: 'mission-complete' }); }
}

export function consumeEvents(s) { const e = s.events; s.events = []; return e; }
