// 任务制毛球战斗。确定性、不依赖 DOM；地面是 X/Z 平面，单位为米和秒。
// 楼可以有好几层：身体各自记着脚下的高度（玩家 p.y，僵尸 e.base，e.y = base + 跳起的高度），
// 走路、碰撞、寻路按所在那一层的平面做，毛球和视线在三维里算。
// 与工坊版的区别：僵尸数量固定且默认没发现你；武器有伤害、射程、弹匣和噪音；通关靠完成任务。
import { FEEL } from '../rongboy-shooter-fps/feedback.js';
import { segmentBox, clearPath, lineOfSight, resolveBody, routeTo, navRadius, isOutdoor, storeyAt, surfaceY, navGoal, inStairs, freePoint } from './level.js';
import { advanceAction, interruptAction } from './actions.js';
import {SPECIAL_TYPES,ARROW_SPEED} from './attacks.js';
import {launchBomb,advanceBombs} from './bombs.js';
import {advanceSpecial,interruptSpecial,contactAttack,onSpecialDeath} from './special-enemies.js';
import { GADGETS, STASH } from './gadgets.js';

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
  sameLevel: 1.1,      // 两个身体脚下高度差在这以内才碰得到、推得动对方
};

export const ENEMY_TYPES = {
  walker: { name: '跳跳', hp: 6, radius: 0.32, height: 1.62, scale: 1, speed: 1.45, hopHeight: 0.22, hopPeriod: 0.72, resistance: 1 },
  leaper: { name: '跃行者', hp: 5, radius: 0.30, height: 1.56, scale: 0.96, speed: 1.9, hopHeight: 0.28, hopPeriod: 0.55, resistance: 0.9 },
  crawler: {name:'爬行者',hp:4,radius:.37,height:1.02,scale:1,speed:.85,hopHeight:0,hopPeriod:1.1,resistance:1},
  shielded: {name:'持盾者',hp:7,radius:.36,height:1.71,scale:1,speed:1.15,hopHeight:.12,hopPeriod:.90,resistance:.65},
  bomber: {name:'炸弹客',hp:5,radius:.40,height:1.58,scale:1,speed:1.15,hopHeight:.16,hopPeriod:.90,resistance:.9,muzzle:{y:0.857034,forward:0.545857,side:0.329657}},
  archer: {name:'弓手',hp:5,radius:.30,height:1.74,scale:1,speed:1.05,hopHeight:.10,hopPeriod:.9,resistance:1.1,muzzle:{y:0.955520,forward:0.595485,side:-0.117760}},
  'boss-warden': {name:'守墓巨像',hp:24,radius:.62,height:2.24,scale:1,speed:.75,hopHeight:.06,hopPeriod:1.2,resistance:.20,armor:.65,reserves:2},
  'boss-leech': {name:'噬连兽',hp:20,radius:.42,height:1.93,scale:1,speed:1.05,hopHeight:.10,hopPeriod:1.1,resistance:.5},
  // 棉甲正面只吃一半伤害，要绕到背后打。
  heavy: { name: '棉甲', hp: 8, radius: 0.43, height: 1.81, scale: 1.12, speed: 0.9, hopHeight: 0.12, hopPeriod: 1.02, resistance: 0.38, armor: 0.5 },
};

// damage 在 range 以内是全额，之后线性衰减，到 2×range 降为 minDamage；飞过 maxRange 就散掉。
// noise 是开枪声能惊动僵尸的距离（隔墙减半）。reserve 为 Infinity 表示备弹无限。pack 是捡一个弹药包补多少备弹。
export const WEAPONS = [
  { id: 'single', short: '手枪', name: '线轴手枪', tag: '兜底 · 备弹无限', count: 1, damage: 2, chargeDamage: 1, range: 6, minDamage: 1, maxRange: 22,
    mag: 6, reserve: Infinity, reload: 1.15, cooldown: 0.36, speed: 13, bounces: 2, noise: 5.5, push: 1.8, chargePush: 3.6, color: 0xf3dfa5 },
  { id: 'scatter', short: '霰弹', name: '绒球霰弹', tag: '贴脸 · 一枪倒', count: 3, fan: 0.11, damage: 2, chargeDamage: 0, range: 4, minDamage: 1, maxRange: 11,
    mag: 2, reserve: 6, pack: 4, reload: 1.7, cooldown: 0.55, speed: 12, bounces: 1, noise: 8, push: 0.72, chargePush: 0.55, color: 0xabc8bd },
  { id: 'heavy', short: '棉被炮', name: '棉被炮', tag: '一炮一个 · 破盾', count: 1, damage: 7, chargeDamage: 0, range: 12, minDamage: 4, maxRange: 24,
    mag: 1, reserve: 3, pack: 2, reload: 2.0, cooldown: 0.5, speed: 10, bounces: 3, noise: 12, push: 9.2, chargePush: 3.6, color: 0xd6a789 },
  // 以下四把要在关卡里捡到（或者关卡的 arsenal 里写上）。feel：后坐力和受击手感借用前三把里的哪一把。
  // 静电枪：一道电弧，打中就把僵尸定住 stun 秒，还会跳到 chainRange 米内的另外 chain 只身上。几乎不伤血，很安静。
  { id: 'stun', short: '静电枪', name: '静电枪', tag: '定住一小群', kind: 'zap', feel: 'single', count: 1, damage: 1, minDamage: 1, range: 7.5, stun: 2.6, chain: 2, chainRange: 2.8,
    mag: 4, reserve: 4, pack: 4, reload: 1.8, cooldown: 0.55, noise: 3.5, color: 0x8fd8f0 },
  // 缝纫机枪：按住连发的小纽扣，单发伤害低、有散布、不反弹。
  { id: 'sewing', short: '缝纫机', name: '缝纫机枪', tag: '按住扫射 · 清一群', auto: true, feel: 'single', count: 1, damage: 1, chargeDamage: 0, range: 7, minDamage: 1, maxRange: 15,
    mag: 32, reserve: 64, pack: 32, reload: 1.7, cooldown: 0.085, speed: 19, bounces: 0, spread: 0.05, radius: 0.055, noise: 6, push: 0.45, chargePush: 0, color: 0xe7836f },
  // 毛衣针：又直又快，一针能穿过 pierce 只僵尸再扎进墙里。按住是举枪瞄准（镜头拉近），蓄满伤害更高。
  { id: 'needle', short: '毛衣针', name: '毛衣针', tag: '打远处 · 扎穿棉甲', zoom: true, feel: 'heavy', count: 1, damage: 4, chargeDamage: 4, range: 22, minDamage: 3, maxRange: 40,
    mag: 3, reserve: 6, pack: 3, reload: 2.1, cooldown: 0.7, speed: 34, bounces: 0, pierce: 2, pierceArmor: true, straight: true, radius: 0.05, noise: 7, push: 2.2, chargePush: 1.4, color: 0xcfd6d8 },
  // 毛线团手雷：抛出去弹几下，fuse 秒后（或者直接砸中僵尸时）炸开：blast 米内掉血、被推开，并被毛线缠住 tangle 秒走不快。按住扔得更远。
  { id: 'yarn', short: '毛线团', name: '毛线团手雷', tag: '炸开 · 缠住一片', kind: 'grenade', feel: 'scatter', count: 1, damage: 4, chargeDamage: 0, range: 30, minDamage: 2, maxRange: 60,
    blast: 2.6, tangle: 4, fuse: 1.5, mag: 1, reserve: 1, reload: 1.3, cooldown: 0.6, speed: 4.2, bounces: 99, radius: 0.16, noise: 14, push: 5, chargePush: 0, color: 0xd9a6e0 },
];
export const TANGLE_SPEED = 0.35;   // 被毛线缠住时的移动速度倍率
const weaponIndex = id => WEAPONS.findIndex(w => w.id === id);
// 手里两把：手枪固定（PISTOL），另一把可换（secondOf）；手雷不占手，单独一个键扔（GRENADE）。准则见 docs/fun-design.md 第 3 节。
export const PISTOL = 0, GRENADE = weaponIndex('yarn');
export const secondOf = s => s.owned.findIndex((own, i) => own && i !== PISTOL && i !== GRENADE);
export const grenades = s => s.ammo[GRENADE].mag + s.ammo[GRENADE].reserve;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const length = (x, z) => Math.hypot(x, z);

export function createGame({ level } = {}) {
  if (!level) throw new Error('createGame 需要一个编译好的关卡');
  const s = {
    phase: 'playing', level, time: 0, weapon: 0,
    ammo: WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve })), reloading: false, reload: 0, trigger: false,
    // 开局带哪些枪：关卡的 arsenal（武器 id 列表），不写就是最早的三把。其余的要捡。
    owned: WEAPONS.map(w => (level.arsenal || ['single', 'scatter', 'heavy']).includes(w.id)),
    health: CONFIG.maxHealth, damageTaken: 0, kills: 0, total: 0, shots: 0, hits: 0, bounces: 0, backHits: 0, sneakHits: 0,
    charge: 0, charging: false, cooldown: 0, invul: 0, lob: 0, lobbing: false, lobCooldown: 0, rangedGate: 0, nextId: 1, endIn: null, stars: 0, carrying: false,
    // 取物任务可以有好几件目标：collected 是已经拿到的件数，全部拿到（carrying）才能去出口交差
    collected: 0, objectives: (level.pickups || []).filter(k => k.kind === 'objective').length,
    enemies: [], balls: [], enemyShots: [], enemyBombs: [], events: [], neutralized: 0, slowUntil: 0, pulledUntil: 0,
    dormant: [],   // 还没出场的（关卡里写了 dormant: true）：任务物品拿齐的那一刻才出现
    // 藏在拉链暗格里的（stash）开局看不见、捡不到，打开拉链才掉出来
    pickups: (level.pickups || []).map((p, i) => ({ ...p, id: i + 1, taken: false, hidden: !!p.stash })),
    gadgets: (level.gadgets || []).map(g => ({ ...g, used: false, until: 0 })),
    player: { x: level.player.x, y: 0, z: level.player.z, vx: 0, vz: 0, mvx: 0, mvz: 0, aimX: 0, aimY: 0, aimZ: -1 },
  };
  if (!s.owned[GRENADE]) s.ammo[GRENADE] = { mag: 0, reserve: 0 };   // 关卡没给手雷：一颗都没有，捡到才有
  for (const e of level.enemies || []) { if (e.dormant) s.dormant.push({ ...e }); else spawn(s, e); }
  return s;
}

// state: 'asleep' | 'idle' | 'alert'。patrol 是 [[x,z],...] 巡逻点。
export function spawn(s, { type = 'walker', x, z, state = 'alert', heading = 0, patrol = null, floor = 0, enabled = true, reserveOf = null }) {
  type = type === 'runner' || type === 'weaver' ? 'leaper' : type;
  const def = ENEMY_TYPES[type] || ENEMY_TYPES.walker, base = floor * s.level.storeyHeight;
  const e = {
    ...def, type, enabled, reserveOf, floor, guardBroken: 0, attackCount: 0, exploded: false, id: s.nextId++, x, y: base, base, hop: 0, z, vx: 0, vz: 0, hp: def.hp, maxHp: def.hp, alive: true, heading,
    awareness: state, wake: 0, senseIn: 0, patrol, patrolIndex: 0, patrolWait: 0,
    hit: 0, hitDuration: 0, age: 0, deathAge: 0, fallX: 0, fallZ: 1, chainCooldown: 0, stun: 0, tangle: 0,
    reactionAge: 10, reactionStrength: 0, reactionWeapon: 'single', reactionX: 0, reactionZ: 1, reactionTwist: 0,
    navIn: 0, route: [], hopPhase: 0, action: 'chase', actionAge: 0, actionCooldown: 1.3, sideLean: 0, moveMultiplier: 1,
  };
  e.actionCooldown += (e.id % 3) * 0.25;
  resolveBody(storeyAt(s.level, e.base), e, e.radius);
  s.enemies.push(e);
  s.total++;
  if(enabled&&def.reserves)for(let i=0;i<def.reserves;i++)spawn(s,{type:'walker',x,z,state:'asleep',heading,floor,enabled:false,reserveOf:e.id});
  return e;
}

export const aliveCount = s => s.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);

// ---------- 武器 ----------

export function selectWeapon(s, index) {
  if (s.phase !== 'playing' || !WEAPONS[index] || !s.owned[index] || s.weapon === index) return false;
  s.weapon = index; s.charging = false; s.charge = 0; s.reloading = false; s.reload = 0; s.trigger = false;
  s.events.push({ type: 'weapon', weapon: index });
  if (s.ammo[index].mag === 0 && s.ammo[index].reserve > 0) startReload(s);
  return true;
}

// Q：在手枪和另一把之间来回换
export function swapWeapon(s) {
  const second = secondOf(s);
  if (second < 0) return false;
  return selectWeapon(s, s.weapon === PISTOL ? second : PISTOL);
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
  if (!startReload(s)) { s.events.push({ type: 'dry', weapon: WEAPONS[s.weapon].id }); backToPistol(s); }
  return false;
}

// 特殊枪彻底打空了：自动换回手枪，不让人对着空枪按扳机
function backToPistol(s) {
  const a = s.ammo[s.weapon];
  if (s.weapon === PISTOL || !s.owned[PISTOL] || a.mag > 0 || a.reserve > 0) return false;
  return selectWeapon(s, PISTOL);
}

// 按下扳机。连发枪按住就一直打（在 step 里出弹）；其余的是开始蓄力，松开才发射。
export function beginCharge(s) {
  if (WEAPONS[s.weapon].auto) { s.trigger = canShoot(s); return s.trigger; }
  if (s.charging || !canShoot(s)) return false;
  s.charging = true; s.charge = 0;
  return true;
}

export function releaseCharge(s, shot = null) {
  s.trigger = false;
  if (!s.charging) return false;
  s.charging = false;
  const power = clamp((s.charge - 0.12) / (CONFIG.chargeTime - 0.12), 0, 1);
  s.charge = 0;
  return fire(s, power, shot);
}

// shot 可以给出实际枪口位置和方向（表现层算出来的）；不给就按玩家朝向从身前发射。
function muzzle(s, shot) {
  const p = s.player, dir = shot?.direction || { x: p.aimX, y: p.aimY || 0, z: p.aimZ };
  const m = Math.hypot(dir.x, dir.y, dir.z) || 1, dx = dir.x / m, dy = dir.y / m, dz = dir.z / m;
  return { origin: shot?.origin || { x: p.x + dx * 0.63, y: p.y + 0.76, z: p.z + dz * 0.63 }, dx, dy, dz };
}

// 把 w 这把枪的一次发射变成飞出去的毛球（不管弹药和冷却）
function launch(s, w, power, origin, dx, dy, dz) {
  const flat = Math.hypot(dx, dz) || 1, rx = -dz / flat, rz = dx / flat;
  // 开枪声会立刻惊动目标，所以"偷袭"按开枪那一刻算：当时还没察觉的僵尸，这一枪打中它仍有加成。
  const quiet = s.enemies.filter(e => e.alive && e.enabled && unaware(e)).map(e => e.id);
  for (let i = 0; i < w.count; i++) {
    if (s.balls.length >= CONFIG.maxBalls) expireBall(s, s.balls.shift());
    // 散布：霰弹是固定的扇形；连发枪每发朝左右、上下各偏一点（由发数决定，不用随机数，结果可重现）
    const jitter = w.spread ? [Math.sin(s.shots * 12.9898) * 43758.5453, Math.sin(s.shots * 78.233) * 12543.123].map(v => (v - Math.floor(v) - 0.5) * 2 * w.spread) : [0, 0];
    const offset = (w.count === 1 ? 0 : (i - (w.count - 1) / 2) * ((w.fan ?? 0.15) - power * 0.07)) + jitter[0];
    const ax = dx + rx * offset, ay = dy + jitter[1], az = dz + rz * offset, n = Math.hypot(ax, ay, az);
    const speed = w.speed - (w.id === 'single' ? power * 2 : 0) + (w.kind === 'grenade' ? power * 4.5 : 0);
    const effective = w.id === 'heavy' ? 0.75 + power * 0.25 : power;
    const radius = w.radius ?? (w.id === 'scatter' ? 0.085 + power * 0.035 : w.id === 'heavy' ? 0.22 + power * 0.06 : 0.10 + 0.15 * power);
    s.balls.push({
      id: s.nextId++, weapon: w.id, x: origin.x, y: origin.y, z: origin.z, r: radius, power: effective,
      vx: ax / n * speed, vy: ay / n * speed + (w.kind === 'grenade' ? 2.2 : 0), vz: az / n * speed, dx: ax / n, dy: ay / n, dz: az / n, speed,
      damage: w.damage + (power >= 0.6 ? w.chargeDamage : 0), minDamage: w.minDamage, range: w.range, maxRange: w.maxRange,
      impulse: w.push + power * w.chargePush, stun: FEEL[w.feel || w.id].stun + power * 0.035,
      pierce: w.pierce || 0, pierceArmor: !!w.pierceArmor, passed: {}, straight: !!w.straight, fuse: w.fuse || 0,
      age: 0, travel: 0, lifetime: CONFIG.ballLife, bounceCount: 0, maxBounces: w.bounces, enemyHits: 0, hitTimes: {}, destroyed: false, quiet,
    });
  }
}

export function fire(s, power = 0, shot = null) {
  if (s.cooldown > 0 || !canShoot(s)) return false;
  power = clamp(power, 0, 1);
  const w = WEAPONS[s.weapon], { origin, dx, dy, dz } = muzzle(s, shot);
  if (w.kind === 'zap') return zap(s, w, origin, { x: dx, y: dy, z: dz }, power);
  launch(s, w, power, origin, dx, dy, dz);
  s.ammo[s.weapon].mag--;
  s.shots++;
  s.cooldown = w.cooldown + (w.id === 'single' && power >= 0.6 ? 0.16 : 0);
  s.events.push({ type: 'shot', x: origin.x, y: origin.y, z: origin.z, dx, dy, dz, power, weapon: w.id });
  emitNoise(s, origin.x, origin.z, w.noise, origin.y);
  return true;
}

// 手雷：不占手，按 E 直接扔（按住扔得更远）。手里拿着哪把枪、是不是在换弹都不影响。
export function beginThrow(s) {
  if (s.phase !== 'playing' || s.lobbing || s.lobCooldown > 0) return false;
  if (grenades(s) <= 0) { s.events.push({ type: 'dry', weapon: 'yarn' }); return false; }
  s.lobbing = true; s.lob = 0;
  return true;
}
export function releaseThrow(s, shot = null) {
  if (!s.lobbing) return false;
  s.lobbing = false;
  const power = clamp((s.lob - 0.12) / (CONFIG.chargeTime - 0.12), 0, 1);
  s.lob = 0;
  return throwGrenade(s, power, shot);
}
export function throwGrenade(s, power = 0, shot = null) {
  const w = WEAPONS[GRENADE], a = s.ammo[GRENADE];
  if (s.phase !== 'playing' || s.lobCooldown > 0 || grenades(s) <= 0) return false;
  const { origin, dx, dy, dz } = muzzle(s, shot);
  launch(s, w, clamp(power, 0, 1), origin, dx, dy, dz);
  if (a.reserve > 0) a.reserve--; else a.mag--;
  s.shots++; s.lobCooldown = w.cooldown;
  s.events.push({ type: 'shot', x: origin.x, y: origin.y, z: origin.z, dx, dy, dz, power, weapon: w.id, thrown: true });
  emitNoise(s, origin.x, origin.z, w.noise, origin.y);
  return true;
}

export function ballDamage(b) {
  if (b.travel <= b.range) return b.damage;
  const t = clamp((b.travel - b.range) / b.range, 0, 1);
  return Math.max(b.minDamage, Math.round(b.damage + (b.minDamage - b.damage) * t));
}

// 静电枪：沿准星打出一道电弧，命中第一只僵尸后再跳到附近的几只身上。被电到的定在原地 stun 秒（棉甲只有六成）。
function zap(s, w, origin, dir, power) {
  const L = s.level, end = { x: origin.x + dir.x * w.range, y: origin.y + dir.y * w.range, z: origin.z + dir.z * w.range };
  let best = 1, first = null;
  for (const c of L.solids) { const h = segmentBox(origin, end, c); if (h && h.t < best) best = h.t; }
  for (const e of s.enemies) {
    if (!e.alive || !e.enabled) continue;
    const t = segmentCylinder(origin.x, origin.y, origin.z, end.x, end.y, end.z, e.x, e.z, e.radius + 0.06, e.y + 0.04, e.y + e.height);
    if (t !== null && t < best) { best = t; first = e; }
  }
  const tip = { x: origin.x + (end.x - origin.x) * best, y: origin.y + (end.y - origin.y) * best, z: origin.z + (end.z - origin.z) * best };
  const points = [{ ...origin }, tip], struck = [];
  const mid = e => ({ x: e.x, y: e.y + e.height * 0.6, z: e.z });
  const shock = (e, from) => {
    const dx = e.x - from.x, dz = e.z - from.z, n = Math.hypot(dx, dz) || 1;
    struck.push(e.id); s.hits++;
    e.stun = Math.max(e.stun, w.stun * (e.armor ? 0.6 : 1));
    damage(s, e, w.damage, dx / n, dz / n, 0.4, 'zap', { weapon: w.id, stun: 0.12, contactX: e.x, contactY: e.y + e.height * 0.6, contactZ: e.z });
  };
  if (first) {
    shock(first, origin);
    let from = first;
    for (let hop = 0; hop < w.chain; hop++) {
      let next = null, nearest = w.chainRange;
      for (const e of s.enemies) {
        if (!e.alive || !e.enabled || struck.includes(e.id)) continue;
        const d = Math.hypot(e.x - from.x, e.base - from.base, e.z - from.z);
        if (d < nearest && lineOfSight(L, mid(from), mid(e))) { nearest = d; next = e; }
      }
      if (!next) break;
      points.push(mid(next)); shock(next, from); from = next;
    }
  }
  s.ammo[s.weapon].mag--; s.shots++; s.cooldown = w.cooldown;
  s.events.push({ type: 'shot', x: origin.x, y: origin.y, z: origin.z, dx: dir.x, dy: dir.y, dz: dir.z, power, weapon: w.id });
  s.events.push({ type: 'zap', points, struck, weapon: w.id });
  emitNoise(s, origin.x, origin.z, w.noise, origin.y);
  return true;
}

// ---------- 感知 ----------

const unaware = e => e.awareness === 'asleep' || e.awareness === 'idle';
const at = e => ({ x: e.x, z: e.z, base: e.base });
// 视线两端：僵尸从脚边算起（矮家具会挡住它），玩家按眼睛高度。
const feet = e => ({ x: e.x, y: e.y, z: e.z });
const eyes = p => ({ x: p.x, y: p.y + 1.2, z: p.z });

// 僵尸察觉到异常，过一小段反应时间后才会警觉。
function notice(s, e, delay, reason) {
  if (!e.alive || !e.enabled || !unaware(e)) return;
  const base = reason === 'hit' ? CONFIG.wakeHit : e.awareness === 'asleep' ? CONFIG.wakeAsleep : CONFIG.wakeIdle;
  e.awareness = 'waking'; e.wake = base + delay; e.patrol = null;
  s.events.push({ type: 'notice', id: e.id, ...at(e), reason });
}

function becomeAlert(s, e) {
  e.awareness = 'alert'; e.action = 'chase'; e.actionAge = 0; e.navIn = 0;
  s.events.push({ type: 'alert', id: e.id, ...at(e), enemyType: e.type });
  for (const o of s.enemies) {
    if (o === e || !o.alive || !o.enabled || !unaware(o)) continue;
    const d = Math.hypot(o.x - e.x, o.base - e.base, o.z - e.z);
    if (d < CONFIG.callRadius && lineOfSight(s.level, feet(e), feet(o))) notice(s, o, 0.25 + d / 10, 'call');
  }
}

// 声音：看得见声源的在 radius 内都会被惊动，隔着墙或楼板只有一半距离。y 是声源的高度。
export function emitNoise(s, x, z, radius, y = 1.2) {
  for (const e of s.enemies) {
    if (!e.alive || !e.enabled || !unaware(e)) continue;
    const d = Math.hypot(e.x - x, e.base + 1.2 - y, e.z - z);
    if (d >= radius) continue;
    if (d < radius * 0.5 || lineOfSight(s.level, { x, y, z }, feet(e))) notice(s, e, d / 14, 'noise');
  }
}

function sense(s, e, dt) {
  const p = s.player, dx = p.x - e.x, dz = p.z - e.z, flat = length(dx, dz) || 1, d = Math.hypot(flat, p.y - e.base);
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
  const sees = () => lineOfSight(s.level, feet(e), eyes(p));
  if (e.awareness === 'asleep') {
    if (d < CONFIG.hearRadius && sees()) notice(s, e, 0, 'near');
    return;
  }
  if (d < CONFIG.closeRange && sees()) { notice(s, e, 0, 'near'); return; }
  if (e.lure) return;   // 被闹钟引住的只盯着闹钟：贴到跟前、开枪或者打中它才回过神
  if (d < CONFIG.sightRange) {
    const facing = (Math.sin(e.heading) * dx + Math.cos(e.heading) * dz) / flat;
    if (facing > CONFIG.sightCos && sees()) notice(s, e, 0, 'sight');
  }
}

// 没发现玩家时：睡着的不动，巡逻的在几个点之间慢慢蹦。
function idleMove(s, e, dt) {
  e.hop = 0; e.hopPhase = 0;
  if (e.awareness !== 'idle' || !e.patrol || e.hit > 0) return;
  if (e.patrolWait > 0) { e.patrolWait -= dt; return; }
  const [tx, tz] = e.patrol[e.patrolIndex], dx = tx - e.x, dz = tz - e.z, d = length(dx, dz);
  if (d < 0.12) { e.patrolIndex = (e.patrolIndex + 1) % e.patrol.length; e.patrolWait = 1.4; return; }
  const period = e.hopPeriod * 1.5;
  e.hopPhase = e.type === 'crawler' ? 0 : (e.age % period) / period;
  const flight = clamp(e.hopPhase / 0.78, 0, 1), lift = Math.sin(flight * Math.PI);
  e.hop = lift * e.hopHeight * 0.5;
  const travel = Math.min(d, e.speed * 0.42 * (e.type === 'crawler' ? .92 : 0.15 + 1.55 * lift) * (e.tangle > 0 ? TANGLE_SPEED : 1) * dt);
  e.x += dx / d * travel; e.z += dz / d * travel;
  e.heading = Math.atan2(dx, dz);
}

// 警觉后：绕开家具追玩家，按兵种穿插扑击、侧跳、冲刺。玩家在别的楼层时先去走楼梯。
function chase(s, e, dt) {
  const L = s.level, p = s.player, S = storeyAt(L, e.base), prevPhase = e.hopPhase, r = navRadius(e.radius);
  // 扑击、侧跳、盾冲、投弹这些动作只在和玩家站在同一块平地上时才做；在楼梯上或隔着楼层就老实追
  const level = Math.abs(p.y - e.base) < 0.3 && !inStairs(L, e) && !inStairs(L, p);
  if (!level) { e.action = 'chase'; e.moveMultiplier = 1; e.sideLean = 0; }
  // 身体比楼梯宽的（首领）下不了楼：玩家不在这一层，它就守在原地，朝楼梯口转过去
  if (L.stairs && navRadius(e.radius) * 2 > L.stairs.lane && (Math.abs(p.y - e.base) >= 0.3 || inStairs(L, p))) {
    e.hop *= Math.exp(-dt * 10);
    let turn = Math.atan2(-e.x, L.stairs.mouthZ - e.z) - e.heading; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    e.heading += clamp(turn, -dt * 2, dt * 2);
    return;
  }
  const action = !level ? null : SPECIAL_TYPES.has(e.type) ? advanceSpecial(s, e, dt, attackApi, S) : advanceAction(S, e, dt, p, s.events);
  e.hopPhase = e.type === 'crawler' ? 0 : ((e.age + e.id * 0.137) % e.hopPeriod) / e.hopPeriod;
  const flight = clamp(e.hopPhase / 0.78, 0, 1), lift = Math.sin(flight * Math.PI);
  e.hop = action ? action.y : lift * e.hopHeight;
  if (e.hopPhase < prevPhase && !action) s.events.push({ type: 'land', id: e.id, ...at(e), enemyType: e.type });
  if (action) {
    if (e.hit <= 0) { const slow = e.tangle > 0 ? TANGLE_SPEED : 1; e.x += action.x * slow * dt; e.z += action.z * slow * dt; }
    return;
  }
  const goal = navGoal(L, e, p);
  e.navIn -= dt;
  if (goal.direct) e.route = [];
  else if (e.navIn <= 0) { e.route = routeTo(S, e, goal, r); e.navIn = 0.4; }
  while (e.route.length && length(e.x - e.route[0].x, e.z - e.route[0].z) < 0.04) e.route.shift();
  const next = e.action === 'sidestep' ? { x: e.flankX, z: e.flankZ } : goal.direct || clearPath(S, e, goal, r, true) ? goal : e.route[0];
  if (!next) return;
  const dx = next.x - e.x, dz = next.z - e.z, d = length(dx, dz) || 1;
  const speed = e.hit <= 0 ? e.speed * e.moveMultiplier * (e.type === 'crawler' ? .92 : 0.15 + 1.55 * lift) * (e.tangle > 0 ? TANGLE_SPEED : 1) : 0;
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
  onSpecialDeath(s, e, attackApi);
  s.events.push({ type: 'knockdown', id: e.id, ...at(e), dx, dz, source, weapon: e.reactionWeapon, strength: e.reactionStrength, left: aliveCount(s) });
}

function damage(s, e, amount, dx, dz, impulse, source = 'ball', meta = {}) {
  if (!e.alive || !e.enabled) return;
  e.hp = Math.max(0, e.hp - amount);
  if (SPECIAL_TYPES.has(e.type) ? interruptSpecial(e, { ...meta, amount }) : interruptAction(e)) s.events.push({ type: 'interrupted', id: e.id, ...at(e), enemyType: e.type });
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
  s.events.push({ type: 'hit', id: e.id, ...at(e), dx, dz, heavy: weapon === 'heavy', source, amount, hp: e.hp, maxHp: e.maxHp,
    impulse: impulse * e.resistance, strength: e.reactionStrength, ...meta, weapon });
  if (e.hp <= 0) knockdown(s, e, dx, dz, source);
}

// 毛球打中僵尸：算射程衰减、正面护甲，以及背后和偷袭的加成（各 +100%，可叠加）。
function ballHit(s, b, e, incoming) {
  const n = Math.hypot(incoming.x, incoming.z) || 1, dx = incoming.x / n, dz = incoming.z / n;
  const back = dx * Math.sin(e.heading) + dz * Math.cos(e.heading) > CONFIG.backCos;
  // 偷袭：它没发现你（按开枪那一刻算），或者正被电得动不了
  const sneak = unaware(e) || (e.awareness === 'waking' && b.quiet.includes(e.id)) || e.stun > 0;
  // 持盾者正面挡得住普通毛球：要绕后，或者用棉被炮 / 蓄力球破防
  const frontal = dx * Math.sin(e.heading) + dz * Math.cos(e.heading) < -0.55;
  if (e.type === 'shielded' && e.guardBroken <= 0 && frontal && !(e.stun > 0)) {
    b.hitTimes[e.id] = s.time; b.enemyHits++;
    if (b.weapon !== 'heavy' && b.power < 0.6) { if (unaware(e)) notice(s, e, 0, 'hit'); s.events.push({ type: 'blocked', id: e.id, x: b.x, y: b.y, z: b.z, base: e.base }); return; }
    e.guardBroken = 1.8; interruptSpecial(e, { weapon: 'heavy' }); s.events.push({ type: 'guard-break', id: e.id, ...at(e) });
  }
  let amount = ballDamage(b);
  if (e.armor && !back && !b.pierceArmor) amount = Math.floor(amount * e.armor);   // 正面减半、向下取整：小纽扣和飞远了的手枪球（1 点）打不动；毛衣针扎得穿
  amount *= 1 + (back ? 1 : 0) + (sneak ? 1 : 0);
  b.hitTimes[e.id] = s.time; b.enemyHits++;
  s.hits++; if (back) s.backHits++; if (sneak) s.sneakHits++;
  damage(s, e, amount, dx, dz, b.impulse, 'ball', { ballId: b.id, weapon: b.weapon, stun: b.stun, charged:b.power>=.6, back, sneak, armored: !!e.armor && !back && !b.pierceArmor, contactX: b.x, contactY: b.y, contactZ: b.z });
}

// ---------- 毛球 ----------

function expireBall(s, b, reason = 'lifetime') {
  if (b.destroyed) return;
  b.destroyed = true;
  s.events.push({ type: 'ball-expired', id: b.id, x: b.x, y: b.y, z: b.z, reason, bounces: b.bounceCount, weapon: b.weapon, dx: b.dx, dy: b.dy, dz: b.dz, normal: b.lastNormal || null });
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

// All attack sources share the same heart/iframe path.
export function hurtPlayer(s,enemy,source='contact'){
 if(s.phase!=='playing'||s.invul>0||s.endIn!==null||(s.total>0&&aliveCount(s)===0))return false;
 const dx=s.player.x-enemy.x,dz=s.player.z-enemy.z,n=Math.hypot(dx,dz)||1;
 s.health=Math.max(0,s.health-1);s.damageTaken++;s.invul=CONFIG.invulnerable;if(source!=='contact'){s.player.vx+=dx/n*2;s.player.vz+=dz/n*2;}
 if(source==='contact'&&enemy.type==='crawler')s.slowUntil=Math.max(s.slowUntil,s.time+1.3);
 s.events.push({type:'hurt',x:s.player.x,z:s.player.z,base:s.player.y,by:enemy.id,source,fromX:enemy.x,fromZ:enemy.z,health:s.health});return true;
}
function launchEnemyProjectile(s,e,target){
 if(s.enemyShots.length>=32)s.enemyShots.shift();const muzzle=e.muzzle||{y:Math.min(1.15,e.height*.63),forward:.46,side:-.22},y=e.y+muzzle.y;
 const b={id:s.nextId++,owner:e.id,x:e.x+Math.sin(e.heading)*muzzle.forward+Math.cos(e.heading)*muzzle.side,y,z:e.z+Math.cos(e.heading)*muzzle.forward-Math.sin(e.heading)*muzzle.side,r:.085,age:0,life:2.8,destroyed:false};const mx=target.x-b.x,my=target.y-b.y,mz=target.z-b.z,m=Math.hypot(mx,my,mz)||1;b.vx=mx/m*ARROW_SPEED;b.vy=my/m*ARROW_SPEED;b.vz=mz/m*ARROW_SPEED;s.enemyShots.push(b);s.events.push({type:'enemy-shot',id:b.id,x:b.x,y,z:b.z});
}
const attackApi={hurt:hurtPlayer,knockdown,projectile:launchEnemyProjectile,bomb:launchBomb};
function advanceEnemyShot(s,b,dt){
 b.age+=dt;if(b.age>b.life){b.destroyed=true;return;}
 const end={x:b.x+b.vx*dt,y:b.y+b.vy*dt,z:b.z+b.vz*dt};let t=1,kind=null,enemy=null;
 for(const solid of s.level.solids){const h=segmentBox(b,end,solid,b.r);if(h&&h.t<=t){t=h.t;kind='wall';}}
 const playerHit=segmentCylinder(b.x,b.y,b.z,end.x,end.y,end.z,s.player.x,s.player.z,CONFIG.playerRadius+b.r,s.player.y+.05,s.player.y+1.7);
 if(playerHit!==null&&playerHit<t){t=playerHit;kind='player';}
 for(const e of s.enemies){if(!e.enabled||!e.alive||e.id===b.owner)continue;const h=segmentCylinder(b.x,b.y,b.z,end.x,end.y,end.z,e.x,e.z,e.radius+b.r,e.y+.04,e.y+e.height);if(h!==null&&h<t){t=h;kind='enemy';enemy=e;}}
 b.x+=(end.x-b.x)*t;b.y+=(end.y-b.y)*t;b.z+=(end.z-b.z)*t;
 if(kind){b.destroyed=true;if(kind==='player')hurtPlayer(s,s.enemies.find(e=>e.id===b.owner)||{id:b.owner,x:b.x-b.vx,z:b.z-b.vz},'arrow');else if(kind==='enemy'){const n=Math.hypot(b.vx,b.vz)||1;damage(s,enemy,1,b.vx/n,b.vz/n,.7,'enemy-arrow',{weapon:'single'});}s.events.push({type:'enemy-shot-impact',id:b.id,x:b.x,y:b.y,z:b.z});}
 const B=s.level.bounds;if(b.x<B.minX||b.x>B.maxX||b.z<B.minZ||b.z>B.maxZ)b.destroyed=true;
}

// 一帧内逐段扫掠：每次推进到最近的接触点，反弹后用剩余时间继续，快球不会穿过薄墙。
function advanceBall(s, b, dt) {
  const L = s.level, B = L.bounds;
  b.age += dt;
  if (b.age >= b.lifetime) { expireBall(s, b); return; }
  b.vy -= (b.straight ? 0 : b.fuse ? 9 : CONFIG.gravity) * dt;
  if (b.fuse && b.age >= b.fuse) { explode(s, b); return; }
  const limits = [['x', B.minX + b.r, B.maxX - b.r], ['y', 0.03 + b.r, L.top - b.r], ['z', B.minZ + b.r, B.maxZ - b.r]];
  for (const [axis, lo, hi] of limits) b[axis] = clamp(b[axis], lo, hi);
  let left = dt;
  for (let pass = 0; pass < 6 && left > 1e-7 && !b.destroyed; pass++) {
    const end = { x: b.x + b.vx * left, y: b.y + b.vy * left, z: b.z + b.vz * left };
    let hit = null;
    const candidate = (t, nx, ny, nz, kind, e = null, box = null) => {
      if (t >= -1e-8 && t <= 1 && (hit === null || t < hit.t - 1e-8)) hit = { t: Math.max(0, t), nx, ny, nz, kind, e, box };
    };
    for (const [axis, lo, hi] of limits) {
      const delta = end[axis] - b[axis], n = { x: 0, y: 0, z: 0 };
      if (delta > 1e-10 && end[axis] >= hi) { n[axis] = -1; candidate((hi - b[axis]) / delta, n.x, n.y, n.z, axis === 'y' ? 'ceiling' : 'edge'); }
      else if (delta < -1e-10 && end[axis] <= lo) { n[axis] = 1; candidate((lo - b[axis]) / delta, n.x, n.y, n.z, axis === 'y' ? 'floor' : 'edge'); }
    }
    for (const e of s.enemies) {
      if (!e.alive || !e.enabled || b.passed[e.id]) continue;
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
      // 楼板和踏步的顶面算地面：和落在底层地面上一样弹
      if (h && b.vx * h.nx + b.vy * h.ny + b.vz * h.nz < -1e-6) candidate(h.t, h.nx, h.ny, h.nz, h.ny > 0.5 && (c.kind === 'slab' || c.kind === 'stair') ? 'floor' : 'solid', null, c);
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
    if (hit.box) struck(s, b, hit.box);                // 打中机关、拉链
    else if (hit.kind === 'edge') struck(s, b, { kind: 'edge', floorY: storeyAt(L, b.y - 1).y });   // 房子的外墙就是地图边界
    if (b.fuse && hit.e) { explode(s, b); break; }   // 手雷直接砸中僵尸：当场炸开
    if (hit.e && b.pierce > 0) {                      // 毛衣针：扎穿过去，不反弹，接着飞
      ballHit(s, b, hit.e, incoming); b.pierce--; b.passed[hit.e.id] = true;
      continue;
    }
    if (hit.e) {
      const e = hit.e;
      if (s.time - (b.hitTimes[e.id] ?? -100) >= CONFIG.repeatHitDelay) ballHit(s, b, e, incoming);
      if (hit.ny !== 0) b.y = hit.ny > 0 ? e.y + e.height + b.r + 0.002 : e.y + 0.04 - b.r - 0.002;
      else { const radius = e.radius + b.r + 0.002; b.x = e.x + hit.nx * radius; b.z = e.z + hit.nz * radius; }
    } else { b.x += hit.nx * 0.002; b.y += hit.ny * 0.002; b.z += hit.nz * 0.002; }
    const dot = b.vx * hit.nx + b.vy * hit.ny + b.vz * hit.nz, retain = b.fuse ? 0.5 : hit.e ? 0.98 : 0.985;
    b.vx = (b.vx - 2 * dot * hit.nx) * retain; b.vy = (b.vy - 2 * dot * hit.ny) * retain; b.vz = (b.vz - 2 * dot * hit.nz) * retain;
    if (hit.kind === 'floor') b.vy = b.fuse ? b.vy * 0.7 : Math.max(1.05, b.vy * 0.88);
    b.bounceCount++; s.bounces++;
    b.lastNormal = { x: hit.nx, y: hit.ny, z: hit.nz };
    if (s.time - (b.lastBounceEvent ?? -1) > 0.04) {
      b.lastBounceEvent = s.time;
      // solid：打在了哪件东西上（画面按它的材质和颜色给反应）
      const c = hit.box;
      s.events.push({ type: 'bounce', id: b.id, x: b.x, y: b.y, z: b.z, kind: hit.kind, count: b.bounceCount, weapon: b.weapon,
        nx: hit.nx, ny: hit.ny, nz: hit.nz, ...(c ? { solid: { id: c.id, kind: c.kind, look: c.look, item: c.item, color: c.color } } : {}) });
    }
    if (b.bounceCount > b.maxBounces) expireBall(s, b, 'bounce-limit');
  }
  b.speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
  b.dx = b.vx / b.speed; b.dy = b.vy / b.speed; b.dz = b.vz / b.speed;
}

// 毛线团炸开：blast 米内、没被墙挡住的僵尸掉血（越近越多）、被推开，并被毛线缠住。玩家站太近只会被推一下。
function explode(s, b) {
  blast(s, b.x, b.y, b.z, WEAPONS[weaponIndex(b.weapon)]);
  expireBall(s, b, 'explode');
}
// 在 (x, y, z) 炸开一团毛线：手雷和颜料桶共用。
function blast(s, x, y, z, w, source = null) {
  const L = s.level, at = { x, y: y + 0.15, z }, struck = [];
  for (const e of s.enemies) {
    if (!e.alive || !e.enabled) continue;
    const cy = e.y + e.height * 0.5, d = Math.hypot(e.x - x, cy - y, e.z - z);
    if (d > w.blast + e.radius || !lineOfSight(L, at, { x: e.x, y: cy, z: e.z })) continue;
    const k = clamp(d / w.blast, 0, 1), dx = e.x - x, dz = e.z - z, n = Math.hypot(dx, dz) || 1;
    struck.push(e.id); s.hits++;
    e.tangle = Math.max(e.tangle, w.tangle);
    damage(s, e, Math.round(w.damage + (w.minDamage - w.damage) * k), dx / n, dz / n, w.push * (1 - 0.5 * k), 'blast', { weapon: w.id, stun: 0.3, contactX: e.x, contactY: cy, contactZ: e.z });
  }
  const p = s.player, pd = Math.hypot(p.x - x, p.y + 0.8 - y, p.z - z);
  if (pd < w.blast * 0.7) { const n = Math.hypot(p.x - x, p.z - z) || 1; p.vx += (p.x - x) / n * 3.5; p.vz += (p.z - z) / n * 3.5; }
  s.events.push({ type: 'explode', x, y, z, radius: w.blast, struck, weapon: w.id, ...(source ? { source } : {}) });
  emitNoise(s, x, z, w.noise, y);
  return struck;
}

// ---------- 机关和拉链暗格（docs/fun-design.md 第 9 节）----------

// 毛球打在一件实心的东西上：是机关就触发；是墙，而且旁边有一条没拉开的拉链，就拉开。
function struck(s, b, box) {
  if (box.kind === 'gadget') { const g = s.gadgets.find(q => q.id === box.id); if (g && !g.used) trigger(s, g); return; }
  for (const k of s.pickups) {
    if (!k.hidden || !k.stash || Math.abs((k.y ?? 0) - (box.floorY ?? 0)) > 0.5) continue;
    const h = b.y - (k.y ?? 0);
    if (Math.hypot(k.stash.x - b.x, k.stash.z - b.z) > STASH.reach || h < STASH.lo || h > STASH.hi) continue;
    k.hidden = false;
    s.events.push({ type: 'stash', id: k.id, kind: k.kind, weapon: k.weapon, x: k.x, z: k.z, base: k.y ?? 0, sx: k.stash.x, sz: k.stash.z });
  }
}

function trigger(s, g) {
  const L = s.level, G = GADGETS[g.kind], S = L.storeys[g.floor], top = { x: g.x, y: g.y + G.h + 0.35, z: g.z }, hit = [];   // 声音和灯光从机关顶上发出来（在它自己的盒子外面）
  g.used = true;
  const here = e => e.alive && e.enabled && Math.abs(e.base - g.y) < 1;
  if (g.kind === 'clock') {
    // 还没发现玩家的（睡着的会被吵醒）走过去围着看。每只占闹钟周围的一个空位，近的先挑。
    g.until = s.time + G.time;
    const taken = [];
    // 刚被惊动、还在反应的（waking）也算：打闹钟的那一枪本身有声音，离得近会先惊动它们，闹钟得盖过去
    const heard = s.enemies.filter(e => here(e) && (unaware(e) || e.awareness === 'waking')).map(e => ({ e, d: Math.hypot(e.x - g.x, e.z - g.z) }))
      .filter(({ e, d }) => d < G.radius && (d < G.radius * 0.5 || lineOfSight(L, top, feet(e)))).sort((a, b) => a.d - b.d);
    for (const { e } of heard) {
      const ring = Math.max(G.w, G.d) * 0.71 + e.radius + 0.4, r = navRadius(e.radius);
      const spot = Array.from({ length: 12 }, (_, i) => ({ x: g.x + Math.cos(i * Math.PI / 6) * ring, z: g.z + Math.sin(i * Math.PI / 6) * ring }))
        .filter(q => freePoint(S, q.x, q.z, e.radius) && taken.every(t => Math.hypot(t.x - q.x, t.z - q.z) > e.radius + t.r + 0.1))
        .sort((p, q) => Math.hypot(p.x - e.x, p.z - e.z) - Math.hypot(q.x - e.x, q.z - e.z))
        .find(q => clearPath(S, e, q, r, true) || routeTo(S, e, q, r).length > 0);
      if (!spot) continue;
      taken.push({ ...spot, r: e.radius });
      e.awareness = 'idle'; e.patrol = null; e.navIn = 0; e.route = [];
      e.lure = { x: spot.x, z: spot.z, lookX: g.x, lookZ: g.z, until: g.until, arrived: false };
      hit.push(e.id);
    }
  } else if (g.kind === 'bucket') {
    hit.push(...blast(s, g.x, top.y, g.z, WEAPONS[GRENADE], 'bucket'));
  } else if (g.kind === 'spot') {
    for (const e of s.enemies) {
      if (!here(e) || Math.hypot(e.x - g.x, e.z - g.z) > G.radius + e.radius || !lineOfSight(L, top, { x: e.x, y: e.y + e.height * 0.6, z: e.z })) continue;
      e.stun = Math.max(e.stun, G.stun * (e.armor ? 0.6 : 1));
      hit.push(e.id);
    }
  }
  s.events.push({ type: 'gadget', id: g.id, kind: g.kind, x: g.x, y: g.y, z: g.z, base: g.y, radius: G.radius, struck: hit });
}

// 被闹钟引过去的僵尸：走到分给它的空位，面朝闹钟站着，响完为止。路上照样会看见玩家（那就变成追）。
function investigate(s, e, dt) {
  const S = storeyAt(s.level, e.base), t = e.lure, r = navRadius(e.radius);
  if (s.time > t.until) { e.lure = null; e.hop = 0; return; }
  const far = length(t.x - e.x, t.z - e.z);
  if (t.arrived || far < 0.15) {
    t.arrived = true; e.hop *= Math.exp(-dt * 12);
    let turn = Math.atan2(t.lookX - e.x, t.lookZ - e.z) - e.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    e.heading += clamp(turn, -dt * 4, dt * 4);
    return;
  }
  e.navIn -= dt;
  if (e.navIn <= 0) { e.route = routeTo(S, e, t, r); e.navIn = 0.5; }
  while (e.route.length && length(e.x - e.route[0].x, e.z - e.route[0].z) < 0.04) e.route.shift();
  const next = clearPath(S, e, t, r, true) ? t : e.route[0];
  if (!next) return;
  const period = e.hopPeriod * 1.2;
  e.hopPhase = e.type === 'crawler' ? 0 : (e.age % period) / period;
  const lift = Math.sin(clamp(e.hopPhase / 0.78, 0, 1) * Math.PI), dx = next.x - e.x, dz = next.z - e.z, d = length(dx, dz) || 1;
  e.hop = lift * e.hopHeight * 0.7;
  const travel = Math.min(d, (e.hit <= 0 ? e.speed * 0.75 * (e.type === 'crawler' ? .92 : 0.15 + 1.55 * lift) * (e.tangle > 0 ? TANGLE_SPEED : 1) : 0) * dt);
  e.x += dx / d * travel; e.z += dz / d * travel;
  if (d > 0.03 && e.hit <= 0) e.heading = Math.atan2(dx, dz);
}

// 任务物品拿齐了：没出场的（守墓巨像）现在出现。先愣 wake 秒（画面上是先亮眼睛、再现身），然后开始追。
// 出场之前它不在场上：打不到、不算数、也不会被看见；出场时才带上它的援兵。
const EMERGE = 1.8;
function emerge(s) {
  const p = s.player;
  for (const d of s.dormant.splice(0)) {
    const e = spawn(s, { ...d, state: 'idle', heading: Math.atan2(p.x - d.x, p.z - d.z) });
    e.awareness = 'waking'; e.wake = EMERGE; e.patrol = null;
    s.events.push({ type: 'emerge', id: e.id, enemyType: e.type, x: e.x, z: e.z, base: e.base, time: EMERGE });
  }
}

// ---------- 拾取与任务 ----------

function collect(s) {
  const p = s.player;
  for (const k of s.pickups) {
    if (k.taken || k.hidden || length(k.x - p.x, k.z - p.z) > CONFIG.pickupRadius || Math.abs((k.y ?? 0) - p.y) > 1) continue;
    let got = null;   // 弹药包：实际补给了哪把枪、多少（界面提示用）
    if (k.kind === 'heart') {
      if (s.health >= CONFIG.maxHealth) continue;
      s.health = Math.min(CONFIG.maxHealth, s.health + k.amount);
    } else if (k.kind === 'ammo') {
      // 弹药包不记种类：补的是手里那把特殊枪（没带特殊枪就先留在地上）。写了 weapon 的是指定给那把枪的；手雷是加一颗。
      const index = k.weapon ? weaponIndex(k.weapon) : secondOf(s);
      if (index < 0) continue;
      got = { weapon: WEAPONS[index].id, amount: k.amount ?? WEAPONS[index].pack ?? WEAPONS[index].mag };
      s.ammo[index].reserve += got.amount;
      if (index === GRENADE) s.owned[GRENADE] = true;
    } else if (k.kind === 'weapon') {
      const index = weaponIndex(k.weapon), w = WEAPONS[index], second = secondOf(s);
      if (index < 0) continue;
      if (index === GRENADE) { s.ammo[index].reserve += k.amount ?? 1; s.owned[index] = true; }
      else if (s.owned[index]) s.ammo[index].reserve += (k.amount ?? w.reserve) + (k.mag ?? 0);   // 已经有这把：只加备弹
      else if (second < 0) { s.owned[index] = true; s.ammo[index] = { mag: k.mag ?? w.mag, reserve: k.amount ?? w.reserve }; selectWeapon(s, index); }   // 第二把还空着：直接装备
      else continue;   // 手里已经有另一把：留在地上，走近了按键才换（exchangeWeapon）
    } else if (k.kind === 'objective') {
      s.collected++; s.carrying = s.collected >= s.objectives;
      // 拿到东西会惊动周围：alarm 是 true 就是全图，是数字就是这么多米以内（按三维距离，隔着楼板减半）
      const alarm = s.level.mission.alarm;
      if (alarm) for (const e of s.enemies) {
        const d = Math.hypot(e.x - p.x, e.base - p.y, e.z - p.z);
        if (alarm === true || d < alarm * (Math.abs(e.base - p.y) > 1.5 ? 0.5 : 1)) notice(s, e, d / 14, 'alarm');
      }
    }
    k.taken = true;
    s.events.push({ type: 'pickup', id: k.id, kind: k.kind, weapon: got?.weapon ?? k.weapon, amount: got?.amount ?? k.amount, name: k.name, collected: s.collected, needed: s.objectives, x: k.x, z: k.z, base: k.y ?? 0 });
    if (k.kind === 'objective' && s.carrying) emerge(s);   // 放在"捡到了"之后：它的提示要盖过"拿到了"
  }
}

// 脚边有没有一把可以换的枪（手里已经有另一把特殊枪时，捡枪要按键确认）
export function offeredWeapon(s) {
  const p = s.player, second = secondOf(s);
  if (s.phase !== 'playing' || second < 0) return null;
  let best = null, nearest = CONFIG.pickupRadius * 1.25;
  for (const k of s.pickups) {
    if (k.taken || k.hidden || k.kind !== 'weapon' || Math.abs((k.y ?? 0) - p.y) > 1) continue;
    const index = weaponIndex(k.weapon), d = length(k.x - p.x, k.z - p.z);
    if (index < 0 || index === GRENADE || s.owned[index] || d > nearest) continue;
    nearest = d; best = k;
  }
  return best;
}
// 换枪：手里的特殊枪连同剩下的弹药放在原地，拿起地上那把。放下的那把还能再换回来。
export function exchangeWeapon(s) {
  const k = offeredWeapon(s);
  if (!k) return false;
  const old = secondOf(s), index = weaponIndex(k.weapon), w = WEAPONS[index], left = s.ammo[old];
  s.owned[old] = false; s.owned[index] = true;
  s.ammo[index] = { mag: k.mag ?? w.mag, reserve: k.amount ?? w.reserve };
  k.weapon = WEAPONS[old].id; k.mag = left.mag; k.amount = left.reserve;
  s.ammo[old] = { mag: 0, reserve: 0 };
  if (s.weapon === old) s.weapon = PISTOL;   // 先回到手枪，再换到新枪（selectWeapon 会清掉蓄力和换弹）
  selectWeapon(s, index);
  s.events.push({ type: 'exchange', id: k.id, weapon: w.id, dropped: k.weapon, x: k.x, z: k.z, base: k.y ?? 0 });   // 排在"换到手里"之后：界面上留下的是这一条提示
  return true;
}

// 任务：clear = 清空所有僵尸；fetch = 拿到目标物后回到出口区域。
export function missionStatus(s) {
  const m = s.level.mission, alive = aliveCount(s);
  if (m.type === 'fetch') {
    const exit = m.exit, p = s.player;
    const atExit = p.y < 1 && p.x >= exit.minX && p.x <= exit.maxX && p.z >= exit.minZ && p.z <= exit.maxZ;
    return { type: 'fetch', carrying: s.carrying, collected: s.collected, needed: s.objectives, atExit, alive, total: s.total, done: s.carrying && atExit };
  }
  return { type: 'clear', alive, total: s.total, done: s.total > 0 && alive === 0 };
}

function finish(s, phase) {
  s.phase = phase; s.charging = false; s.charge = 0; s.lobbing = false; s.lob = 0;
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
  s.lobCooldown = Math.max(0, s.lobCooldown - dt);
  if (s.charging) s.charge = Math.min(CONFIG.chargeTime, s.charge + dt);
  if (s.lobbing) s.lob = Math.min(CONFIG.chargeTime, s.lob + dt);
  if (s.reloading) { s.reload -= dt; if (s.reload <= 0) finishReload(s); }
  else if (s.ammo[s.weapon].mag === 0 && s.cooldown <= 0 && !startReload(s)) backToPistol(s);   // 打空自动换弹；彻底没弹药就换回手枪

  let mx = input.x || 0, mz = input.z || 0;
  const m = length(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimZ)) {
    const n = Math.hypot(input.aimX, input.aimY || 0, input.aimZ);
    if (n > 0.01) { p.aimX = input.aimX / n; p.aimY = (input.aimY || 0) / n; p.aimZ = input.aimZ / n; }
  }
  const moveSpeed=CONFIG.playerSpeed*(s.slowUntil>s.time?.62:1);
  const fromX = p.x, fromZ = p.z;
  p.x += mx * moveSpeed * dt + p.vx * dt; p.z += mz * moveSpeed * dt + p.vz * dt;
  p.vx *= Math.exp(-10 * dt); p.vz *= Math.exp(-10 * dt);
  resolveBody(storeyAt(L, p.y), p, CONFIG.playerRadius);
  p.y = surfaceY(L, p.x, p.z, p.y);
  // 连发枪：扳机按着、冷却到了就出一发；弹匣空了交给上面的自动换弹，彻底没弹药就松开扳机
  if (s.trigger && WEAPONS[s.weapon].auto && s.cooldown <= 0 && !s.reloading) {
    if (!fire(s, 0, input.shot || null) && s.ammo[s.weapon].mag === 0 && s.ammo[s.weapon].reserve === 0) s.trigger = false;
  }

  for (const e of s.enemies) {
    if(!e.enabled)continue;
    const startX=e.x, startZ=e.z;
    e.age += dt; e.reactionAge += dt;
    e.hit = Math.max(0, e.hit - dt); e.chainCooldown = Math.max(0, e.chainCooldown - dt);
    e.stun = Math.max(0, e.stun - dt); e.tangle = Math.max(0, e.tangle - dt);
    if (!e.alive) { e.deathAge += dt; e.hop *= Math.exp(-dt * 12); }
    else if (e.stun > 0) e.hop *= Math.exp(-dt * 14);   // 被电住：站在原地发抖，不追、不看、不咬
    else if (e.awareness === 'alert') chase(s, e, dt);
    else { sense(s, e, dt); if (e.awareness === 'alert' || e.awareness === 'waking') e.lure = null; else if (e.lure) investigate(s, e, dt); else idleMove(s, e, dt); }
    const selfTravel = e.type === 'crawler' ? Math.hypot(e.x-startX,e.z-startZ) : 0;
    e.x += e.vx * dt; e.z += e.vz * dt;
    e.vx *= Math.exp(-4.3 * dt); e.vz *= Math.exp(-4.3 * dt);
    resolveBody(storeyAt(L, e.base), e, e.radius);
    if (e.type === 'crawler') {
      const travel = Math.min(selfTravel, Math.hypot(e.x-startX,e.z-startZ));
      e.crawlDistance = (e.crawlDistance || 0) + travel;
      const stepping = travel > .00001 ? 1 : 0;
      e.crawlWeight = stepping + ((e.crawlWeight || 0)-stepping)*Math.exp(-18*dt);
    }
    e.base = surfaceY(L, e.x, e.z, e.base); e.y = e.base + e.hop;
  }

  // 软身体互相推开；被打飞的僵尸撞到同伴会传递冲量并造成 1 点伤害。
  for (let i = 0; i < s.enemies.length; i++) for (let j = i + 1; j < s.enemies.length; j++) {
    const a = s.enemies[i], b = s.enemies[j];
    if (!a.enabled || !b.enabled) continue;
    if ((!a.alive && a.deathAge > 0.48) || (!b.alive && b.deathAge > 0.48) || Math.abs(a.base - b.base) > CONFIG.sameLevel) continue;
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
  for (const e of s.enemies) if (e.enabled) resolveBody(storeyAt(L, e.base), e, e.radius);

  for (const ball of s.balls) advanceBall(s, ball, dt);
  s.balls = s.balls.filter(b => !b.destroyed);
  advanceBombs(s,dt,hurtPlayer);for(const b of s.enemyShots)advanceEnemyShot(s,b,dt);s.enemyShots=s.enemyShots.filter(b=>!b.destroyed);
  s.enemies = s.enemies.filter(e => e.alive || e.deathAge < 1.15);

  // 只有已经警觉的僵尸碰到你才会扣心。
  if (s.invul <= 0) for (const e of s.enemies) {
    if (!e.alive || !e.enabled || e.awareness !== 'alert' || e.stun > 0 || !contactAttack(e) || Math.abs(e.base - p.y) > CONFIG.sameLevel) continue;
    const dx = p.x - e.x, dz = p.z - e.z, d = length(dx, dz);
    if (d >= CONFIG.playerRadius + e.radius) continue;
    const n = d || 1;
    p.vx = dx / n * 3; p.vz = dz / n * 3; e.vx -= dx / n * 2; e.vz -= dz / n * 2;
    hurtPlayer(s, e, 'contact');
    break;
  }
  // 身体是实心的：贴上去会互相顶开，不会穿过。
  for (const e of s.enemies) {
    if (!e.alive || !e.enabled || Math.abs(e.base - p.y) > CONFIG.sameLevel) continue;
    let dx = p.x - e.x, dz = p.z - e.z, d = length(dx, dz);
    const r = CONFIG.playerRadius + e.radius;
    if (d >= r) continue;
    if (d < 0.001) { dx = 0.001; dz = 0; d = 0.001; }
    const overlap = r - d, nx = dx / d, nz = dz / d;
    p.x += nx * overlap * 0.85; p.z += nz * overlap * 0.85; e.x -= nx * overlap * 0.15; e.z -= nz * overlap * 0.15;
    resolveBody(storeyAt(L, e.base), e, e.radius);
  }
  resolveBody(storeyAt(L, p.y), p, CONFIG.playerRadius);
  p.y = surfaceY(L, p.x, p.z, p.y);

  // 这一步实际挪了多少（撞墙、被顶开都算在内）：弓手按它算提前量
  if (dt > 0) { const k = Math.min(1, dt * 12); p.mvx += ((p.x - fromX) / dt - p.mvx) * k; p.mvz += ((p.z - fromZ) / dt - p.mvz) * k; }

  collect(s);

  if (s.health <= 0) { finish(s, 'lost'); return; }
  if (s.endIn !== null) { s.endIn -= dt; if (s.endIn <= 0) finish(s, 'won'); }
  else if (missionStatus(s).done) { s.enemyShots=[];s.enemyBombs=[];s.endIn = CONFIG.endDelay; s.events.push({ type: 'mission-complete' }); }
}

export function consumeEvents(s) { const e = s.events; s.events = []; return e; }
