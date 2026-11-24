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
import { createChallengeRun, recordChallengeZap, recordChallengeHit, recordChallengeArrow, challengeOutcome } from './challenge-run.js';
import { travelPace, strideTravel } from './locomotion.js';
import { advanceWaves } from './encounter-waves.js';
import { constrainTourWalk } from './park-tour-layout.js';
import { createPark, stepPark } from './park-rides.js';

import { makeAmusement, checkpointPosition, advanceAmusement, moveAmusement, amusementContact, hitAmusement, amusementCutscene } from './amusement.js';

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
  leaper: { name: '跃行者', hp: 5, radius: 0.30, height: 1.56, scale: 0.96, speed: 1.9, hopHeight: 0.65, resistance: 0.9 },
  crawler: {name:'爬行者',hp:4,radius:.37,height:1.02,scale:1,speed:.85,resistance:1},
  shielded: {name:'持盾者',hp:7,radius:.36,height:1.71,scale:1,speed:1.15,resistance:.65},
  bomber: {name:'炸弹客',hp:5,radius:.40,height:1.58,scale:1,speed:1.15,resistance:.9,muzzle:{y:0.857034,forward:0.545857,side:0.329657}},
  archer: {name:'弓手',hp:5,radius:.30,height:1.74,scale:1,speed:1.05,resistance:1.1,muzzle:{y:0.955520,forward:0.595485,side:-0.117760}},
  'boss-warden': {name:'守墓巨像',hp:24,radius:.62,height:2.03,scale:1,speed:.75,resistance:.20,armor:.65,reserves:2},
  'boss-leech': {name:'噬连兽',hp:20,radius:.42,height:2.07,scale:1,speed:1.05,resistance:.5},
  // 棉甲正面只吃一半伤害，要绕到背后打。
  heavy: { name: '棉甲', hp: 8, radius: 0.43, height: 1.81, scale: 1.12, speed: 0.9, resistance: 0.38, armor: 0.5 },
};

// damage 在 range 以内是全额，之后线性衰减，到 2×range 降为 minDamage；飞过 maxRange 就散掉。
// noise 是开枪声能惊动僵尸的距离（隔墙减半）。reserve 为 Infinity 表示备弹无限。pack 是捡一个弹药包补多少备弹。
export const WEAPONS = [
  { id: 'single', short: '手枪', name: '线轴手枪', tag: '兜底 · 备弹无限', count: 1, damage: 2, chargeDamage: 1, range: 6, minDamage: 1, maxRange: 22,
    mag: 6, reserve: Infinity, reload: 1.15, cooldown: 0.36, speed: 13, bounces: 2, noise: 5.5, push: 1.8, chargePush: 3.6, color: 0xf3dfa5 },
  { id: 'scatter', short: '霰弹', name: '绒球霰弹', tag: '贴脸 · 一枪倒', count: 3, fan: 0.11, damage: 2, chargeDamage: 0, range: 4, minDamage: 1, maxRange: 11,
    mag: 2, reserve: 6, pack: 4, reload: 1.7, cooldown: 0.55, speed: 12, bounces: 1, noise: 8, push: 0.72, chargePush: 0.55, color: 0xabc8bd },
  { id: 'heavy', short: '探照灯炮', name: '探照灯炮', tag: '发光重弹 · 破盾', count: 1, damage: 7, chargeDamage: 0, range: 12, minDamage: 4, maxRange: 24,
    mag: 1, reserve: 3, pack: 2, reload: 2.0, cooldown: 0.5, speed: 10, bounces: 3, noise: 12, push: 9.2, chargePush: 3.6, color: 0xd6a789 },
  // 以下四把要在关卡里捡到（或者关卡的 arsenal 里写上）。feel：后坐力和受击手感借用前三把里的哪一把。
  // 静电枪发射会张开的飞网，飞行中扫到的僵尸才会被定住。
  { id: 'stun', short: '静电枪', name: '静电枪', tag: '飞网 · 定住一小群', kind: 'zap', feel: 'single', count: 1, damage: 1, minDamage: 1, range: 7.5, speed: 18, stun: 2.6, targets: 3,
    mag: 4, reserve: 4, pack: 4, reload: 1.8, cooldown: 0.55, noise: 3.5, color: 0x8fd8f0 },
  // 缝纫机枪：按住连发的小纽扣，单发伤害低、有散布、不反弹。
  { id: 'sewing', short: '订书机', name: '订书机枪', tag: '纽扣连发 · 清一群', auto: true, feel: 'single', count: 1, damage: 1, chargeDamage: 0, range: 7, minDamage: 1, maxRange: 15,
    mag: 32, reserve: 64, pack: 32, reload: 1.7, cooldown: 0.085, speed: 19, bounces: 0, spread: 0.05, radius: 0.055, noise: 6, push: 0.45, chargePush: 0, color: 0xe7836f },
  // 毛衣针：又直又快，一针能穿过 pierce 只僵尸再扎进墙里。按住是举枪瞄准（镜头拉近），蓄满伤害更高。
  { id: 'needle', short: '毛衣针', name: '毛衣针', tag: '4× 瞄准 · 扎穿棉甲', zoom: 4, feel: 'heavy', count: 1, damage: 4, chargeDamage: 4, range: 22, minDamage: 3, maxRange: 40,
    mag: 3, reserve: 6, pack: 3, reload: 2.1, cooldown: 0.7, speed: 34, bounces: 0, pierce: 2, pierceArmor: true, straight: true, radius: 0.05, noise: 7, push: 2.2, chargePush: 1.4, color: 0xcfd6d8 },
  // 保留 yarn 的补给标识，旧的地图和暗格仍然补这个投掷物。
  { id: 'yarn', short: '蒸笼', name: '折叠蒸笼', tag: '范围伤害 · 留下绒网', kind: 'grenade', feel: 'scatter', count: 1, damage: 4, chargeDamage: 0, range: 30, minDamage: 2, maxRange: 60,
    blast: 2.6, tangle: 4, fuse: 1.5, mag: 1, reserve: 1, reload: 1.3, cooldown: 0.6, speed: 4.2, bounces: 99, radius: 0.19, noise: 14, push: 3, chargePush: 0, color: 0xb994ce },
  { id: 'jack', short: '小丑盒', name: '弹簧小丑盒', tag: '范围伤害 · 强力击退', kind: 'grenade', feel: 'scatter', count: 1, damage: 5, chargeDamage: 0, range: 30, minDamage: 2, maxRange: 60,
    blast: 2.25, tangle: 0, fuse: 1.1, mag: 1, reserve: 0, reload: 1.3, cooldown: 0.6, speed: 4.2, bounces: 99, radius: 0.2, noise: 14, push: 11, chargePush: 0, color: 0xd89968 },
  { id: 'freeze', short: '急冻枪', name: '急冻射线枪', tag: '冻结敌人和机关', kind: 'ray', feel: 'single', count: 1,
    damage: 1, minDamage: 1, chargeDamage: 0, range: 16, maxRange: 16, straight: true, speed: 38, radius: .085,
    mag: 3, reserve: Infinity, reload: 2, cooldown: .45, bounces: 0, noise: 2, push: 0, chargePush: 0, color: 0x95e8fc },
];
export const TANGLE_SPEED = 0.35;   // 被毛线缠住时的移动速度倍率
const weaponIndex = id => WEAPONS.findIndex(w => w.id === id);
// 手里两把：手枪固定（PISTOL），另一把可换（secondOf）；手雷不占手，单独一个键扔（GRENADE）。准则见 docs/fun-design.md 第 3 节。
export const PISTOL = 0, GRENADE = weaponIndex('yarn');
export const GRENADE_TYPES = WEAPONS.flatMap((w, index) => w.kind === 'grenade' ? [index] : []);
export const secondOf = s => s.owned.findIndex((own, i) => own && i !== PISTOL && WEAPONS[i].kind !== 'grenade');
export const grenades = (s, index = s.grenade) => s.ammo[index].mag + s.ammo[index].reserve;
export const netRadius = distance => 0.24 + Math.min(1, distance / 3.0) * 1.24;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const length = (x, z) => Math.hypot(x, z);
const enemyMovementScale = (s,e) => e.tangle > 0 ? TANGLE_SPEED : e.frostSlowUntil > s.time ? .7 : 1;

export function createGame({ level, amusementCheckpoint = 0 } = {}) {
  if (!level) throw new Error('createGame 需要一个编译好的关卡');
  const amusement = level.mission?.type === 'amusement' ? makeAmusement(amusementCheckpoint) : null;
  const maxHealth = amusement ? 100 : CONFIG.maxHealth;
  const s = {
    phase: 'playing', level, amusement, maxHealth, time: 0, weapon: 0,
    ammo: WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve })), stowedReload: WEAPONS.map(() => 0), reloading: false, reload: 0, trigger: false,
    // 开局带哪些枪：关卡的 arsenal（武器 id 列表），不写就是最早的三把。其余的要捡。
    owned: WEAPONS.map(w => (level.arsenal || ['single', 'scatter', 'heavy']).includes(w.id)),
    health: maxHealth, damageTaken: 0, kills: 0, total: 0, shots: 0, hits: 0, bounces: 0, backHits: 0, sneakHits: 0,
    charge: 0, charging: false, cooldown: 0, invul: 0, lob: 0, lobbing: false, lobCooldown: 0, rangedGate: 0, nextId: 1, endIn: null, stars: 0, carrying: false,
    // 取物任务可以有好几件目标：collected 是已经拿到的件数，全部拿到（carrying）才能去出口交差
    collected: 0, objectives: (level.pickups || []).filter(k => k.kind === 'objective').length,
    enemies: [], balls: [], nets: [], tangleFields: [], enemyShots: [], enemyBombs: [], events: [], neutralized: 0, slowUntil: 0, pulledUntil: 0,
    dormant: [],   // 还没出场的（关卡里写了 dormant: true）：任务物品拿齐的那一刻才出现
    // 藏在拉链暗格里的（stash）开局看不见、捡不到，打开拉链才掉出来
    pickups: (level.pickups || []).map((p, i) => ({ ...p, id: i + 1, taken: false, hidden: !!p.stash })),
    gadgets: (level.gadgets || []).map(g => ({ ...g, used: false, until: 0 })),
    player: { x: level.player.x, y: 0, z: level.player.z, vx: 0, vz: 0, mvx: 0, mvz: 0, jump: 0, jumpV: 0, aimX: 0, aimY: 0, aimZ: -1 },
  };
  const startWeapon = WEAPONS.findIndex((w, i) => w.id === level.startWeapon && s.owned[i]);
  if (startWeapon >= 0) s.weapon = startWeapon;
  s.challenge = level.mission?.type === 'challenge' ? createChallengeRun(level.mission.challenge) : null;
  s.wave = level.waves ? { index:0, nextAt:null } : null;
  for (const index of GRENADE_TYPES) if (!s.owned[index]) s.ammo[index] = { mag: 0, reserve: 0 };
  s.grenade = GRENADE_TYPES.find(index => s.owned[index]) ?? GRENADE;
  if (level.tour) s.park = createPark();
  if (amusementCheckpoint && amusement) Object.assign(s.player, checkpointPosition(amusementCheckpoint));
  for (const e of level.enemies || []) {
    if (amusement && e.zone < amusementCheckpoint) continue;
    if (e.dormant) s.dormant.push({ ...e });
    else spawn(s, amusementCheckpoint && amusement
      ? { ...e, enabled: e.zone === amusementCheckpoint && !e.parkWave }
      : e);
  }
  return s;
}

// state: 'asleep' | 'idle' | 'alert'。patrol 是 [[x,z],...] 巡逻点。
export function spawn(s, { type = 'walker', x, z, state = 'alert', heading = 0, patrol = null, floor = 0, enabled = true, reserveOf = null, encounter, wave, zone, parkWave }) {
  type = type === 'runner' || type === 'weaver' ? 'leaper' : type;
  const roster = ENEMY_TYPES[type] || ENEMY_TYPES.walker, base = floor * s.level.storeyHeight;
  const attic = type === 'boss-warden' && encounter === 'attic';
  const def = attic ? { ...roster, hp: 44, speed: 1.58, resistance: .12, armor: .55 } : roster;
  const e = {
    ...def, type, encounter: attic ? encounter : undefined, enabled, reserveOf, wave, zone, parkWave, floor, guardBroken: 0, attackCount: 0, exploded: false, id: s.nextId++, x, y: base, base, hop: 0, z, vx: 0, vz: 0, hp: def.hp, maxHp: def.hp, alive: true, heading,
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
  if (s.phase !== 'playing' || !WEAPONS[index] || WEAPONS[index].kind === 'grenade' || !s.owned[index] || s.weapon === index) return false;
  const previous = s.weapon, magazine = s.ammo[previous];
  if (s.amusement && magazine.mag === 0 && magazine.reserve > 0)
    s.stowedReload[previous] = s.reloading ? s.reload : reloadTime(s,previous);
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

export const reloadTime = (s,index) => s.amusement && index===PISTOL ? .8 : WEAPONS[index].reload;

export function startReload(s) {
  const w = WEAPONS[s.weapon], a = s.ammo[s.weapon];
  if (s.phase !== 'playing' || s.reloading || a.mag >= w.mag || a.reserve <= 0) return false;
  s.reloading = true; s.reload = s.stowedReload[s.weapon] || reloadTime(s,s.weapon); s.charging = false; s.charge = 0;
  s.stowedReload[s.weapon]=0;
  s.events.push({ type: 'reload', weapon: w.id, duration: s.reload });
  return true;
}

function fillMagazine(s,index) {
  const a=s.ammo[index], take=Math.min(WEAPONS[index].mag-a.mag,a.reserve);
  a.mag+=take; a.reserve-=take;
}
function finishReload(s) {
  fillMagazine(s,s.weapon);
  const w=WEAPONS[s.weapon];
  s.reloading = false; s.reload = 0;
  s.events.push({ type: 'reloaded', weapon: w.id });
}

function canShoot(s) {
  if (s.level.tour || s.phase !== 'playing' || s.reloading || s.amusement?.trap || s.amusement?.fallUntil || amusementCutscene(s)) return false;
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
  return { origin: shot?.origin || { x: p.x + dx * 0.63, y: p.y + (s.amusement ? p.jump : 0) + 0.76, z: p.z + dz * 0.63 }, dx, dy, dz };
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
      id: s.nextId++, weapon: w.id, x: origin.x, y: origin.y, z: origin.z, originX: origin.x, originY: origin.y, originZ: origin.z, r: radius, power: effective,
      vx: ax / n * speed, vy: ay / n * speed + (w.kind === 'grenade' ? 2.2 : 0), vz: az / n * speed, dx: ax / n, dy: ay / n, dz: az / n, speed,
      damage: w.damage + (power >= 0.6 ? w.chargeDamage : 0), minDamage: w.minDamage, range: w.range, maxRange: w.maxRange,
      impulse: w.push + power * w.chargePush, stun: FEEL[w.feel || w.id].stun + power * 0.035,
      pierce: w.pierce || 0, pierceArmor: !!w.pierceArmor, passed: {}, straight: !!w.straight, fuse: w.fuse || 0,
      springShot: !!s.amusement && s.time<s.amusement.launchUntil && s.player.jump>.65,
      age: 0, travel: 0, lifetime: CONFIG.ballLife, bounceCount: 0, maxBounces: w.bounces, enemyHits: 0, hitTimes: {}, destroyed: false, quiet,
    });
  }
}

export function fire(s, power = 0, shot = null) {
  if (s.cooldown > 0 || !canShoot(s)) return false;
  power = clamp(power, 0, 1);
  const w = WEAPONS[s.weapon], { origin, dx, dy, dz } = muzzle(s, shot);
  if (w.kind === 'zap') s.nets.push({ id: s.nextId++, ...origin, origin, dx, dy, dz, travel: 0, radius: netRadius(0), struck: [], points: [], until: Infinity });
  else launch(s, w, power, origin, dx, dy, dz);
  s.ammo[s.weapon].mag--;
  s.shots++;
  s.cooldown = w.cooldown + (w.id === 'single' && power >= 0.6 ? 0.16 : 0);
  s.events.push({ type: 'shot', x: origin.x, y: origin.y, z: origin.z, dx, dy, dz, power, weapon: w.id });
  emitNoise(s, origin.x, origin.z, w.noise, origin.y);
  return true;
}

export function selectGrenade(s) {
  if (s.phase !== 'playing' || s.lobbing) return false;
  const next = GRENADE_TYPES.find(index => index !== s.grenade && s.owned[index]);
  if (next === undefined) return false;
  s.grenade = next;
  return true;
}

// 手雷：不占手，按 E 直接扔（按住扔得更远）。手里拿着哪把枪、是不是在换弹都不影响。
export function beginThrow(s) {
  if (s.phase !== 'playing' || s.lobbing || s.lobCooldown > 0) return false;
  if (grenades(s) <= 0) { s.events.push({ type: 'dry', weapon: WEAPONS[s.grenade].id }); return false; }
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
  const w = WEAPONS[s.grenade], a = s.ammo[s.grenade];
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

// The leading plane of a free-flying net opens as it travels. Walls stop the center;
// each caught zombie also needs an unoccluded path from the shot.
const NET_WEAPON = WEAPONS[weaponIndex('stun')];
function advanceNet(s, net, dt) {
  if (net.until !== Infinity) return;
  const w = NET_WEAPON, { dx, dy, dz, origin } = net;
  const span = Math.min(w.range - net.travel, w.speed * dt);
  const at = { x: net.x + dx * span, y: net.y + dy * span, z: net.z + dz * span };
  let fraction = 1;
  for (const solid of s.level.solids) {
    const hit = segmentBox(net, at, solid);
    if (hit && hit.t < fraction) fraction = hit.t;
  }
  const reach = net.travel + span * fraction;
  const radius = netRadius(reach);
  for (const enemy of s.enemies) {
    if (net.struck.length >= w.targets) break;
    if (!enemy.alive || !enemy.enabled || net.struck.includes(enemy.id)) continue;
    const point = { x: enemy.x, y: clamp(net.y, enemy.y + .1, enemy.y + enemy.height), z: enemy.z };
    const x = point.x - origin.x, y = point.y - origin.y, z = point.z - origin.z;
    const along = x * dx + y * dy + z * dz;
    if (along < Math.max(0, net.travel - enemy.radius) || along > reach + enemy.radius) continue;
    const across = Math.hypot(x - along * dx, y - along * dy, z - along * dz);
    if (across > radius + enemy.radius || !lineOfSight(s.level, origin, point)) continue;
    const stun = w.stun * (enemy.armor ? .6 : 1);
    net.firstExpiry = Math.min(net.firstExpiry ?? Infinity, s.time + stun);
    enemy.stun = Math.max(enemy.stun, stun);
    net.struck.push(enemy.id); net.points.push(point); s.hits++;
    damage(s, enemy, w.damage, dx, dz, .4, 'zap', { weapon: w.id, stun: .12, contactX: point.x, contactY: point.y, contactZ: point.z });
    s.events.push({ type: 'net-contact', ...point });
  }
  net.travel = reach; net.radius = radius;
  net.x = origin.x + reach * dx; net.y = origin.y + reach * dy; net.z = origin.z + reach * dz;
  const bounds = s.level.bounds;
  if (reach < w.range - 1e-6 && fraction === 1 && net.y > .035 && net.y <= s.level.top &&
      net.x >= bounds.minX && net.x <= bounds.maxX && net.z >= bounds.minZ && net.z <= bounds.maxZ) return;
  net.until = s.time + .16;
  s.events.push({ type: 'zap', x: net.x, y: net.y, z: net.z, points: net.points, struck: net.struck, weapon: w.id });
  if (s.challenge) {
    const targets = net.struck.filter(id => s.enemies.some(enemy => enemy.id === id && enemy.alive && enemy.stun > 0));
    recordChallengeZap(s.challenge, targets, s.nextId, net.firstExpiry);
  }
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
// 再远一圈（到 SEARCH.reach 倍）的、醒着但还没发现你的（站岗、巡逻），不会直接扑过来，而是走到响的地方去看一眼（docs/fun-design.md 2.6）。
// 睡着的只有离得比较近（SEARCH.stir 倍）才被吵醒过来看。僵尸数不变，变的是它们在哪：开过枪的地方会有人来。
// reach：站岗、巡逻的听多远（开枪声 noise 的几倍）；stir：睡着的听多远（比 1 大才会被远处的枪声吵醒）
// alarm：拿到任务物品（还没拿齐）时，警报范围几倍以内的过来看；拿齐了是整层
// travel：最多走多少秒（走不到就算了）；look：到了以后张望多少秒；pace：走得比追人慢多少；arrive：离那个点多近算到了
// 取值见 docs/fun-design.md 第 7 节 2026-11-20：reach 2 / 3 和 stir 1.5 / 2 用机器人比过。
export const SEARCH = { reach: 3, stir: 1.5, alarm: 2, travel: 15, look: 4, pace: 0.9, arrive: 1.0 };
export function emitNoise(s, x, z, radius, y = 1.2) {
  const floor = storeyAt(s.level, y - 1).y, S = storeyAt(s.level, floor);
  let spot = null;
  for (const e of s.enemies) {
    if (!e.alive || !e.enabled || !unaware(e)) continue;
    const d = Math.hypot(e.x - x, e.base + 1.2 - y, e.z - z);
    const heard = (r) => d < r && (d < r * 0.5 || lineOfSight(s.level, { x, y, z }, feet(e)));
    if (heard(radius)) { notice(s, e, d / 14, 'noise'); continue; }
    // 过来看：只有同一层的、没被闹钟引住的；已经在过来的路上就改去新响的地方
    if ((e.lure && e.lure.kind !== 'noise') || Math.abs(e.base - floor) > 1 || !heard(radius * (e.awareness === 'asleep' ? SEARCH.stir : SEARCH.reach))) continue;
    spot ??= freePoint(S, x, z, 0.45) ? { x, z } : false;   // 响在家具里（手雷贴着柜子炸）：没地方站，不过来看，但上面的惊动照常
    if (spot) search(s, e, spot);
  }
}
// 让一只还没发现你的僵尸到 spot 去看一眼。睡着的先被吵醒（变成站岗的，睁着眼）。
function search(s, e, spot) {
  // 已经在往差不多的地方走（缝纫机枪一秒十几声）：路不用重找，到了以后再看一轮
  const t = e.lure;
  if (t?.kind === 'noise' && length(t.x - spot.x, t.z - spot.z) < 1.5) { if (t.arrived) t.until = Math.max(t.until, s.time + SEARCH.look); return; }
  e.awareness = 'idle'; e.patrol = null; e.navIn = 0; e.route = [];
  e.lure = { kind: 'noise', x: spot.x, z: spot.z, lookX: spot.x, lookZ: spot.z, until: s.time + SEARCH.travel, arrived: false };
  s.events.push({ type: 'search', id: e.id, ...at(e), toX: spot.x, toZ: spot.z });
}

function sense(s, e, dt) {
  const p = s.player, dx = p.x - e.x, dz = p.z - e.z, flat = length(dx, dz) || 1, d = Math.hypot(flat, p.y - e.base);
  if (e.awareness === 'waking') {
    e.wake -= dt;
    let turn = Math.atan2(dx, dz) - e.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (e.type === 'shielded') steerTravel(e, dx, dz, dt, d);
    else e.heading += clamp(turn, -dt * 5, dt * 5);
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
  if (e.lure && e.lure.kind !== 'noise') return;   // 被闹钟引住的只盯着闹钟：贴到跟前、开枪或者打中它才回过神；听到枪声过来看的照样睁着眼
  if (d < CONFIG.sightRange) {
    const facing = (Math.sin(e.heading) * dx + Math.cos(e.heading) * dz) / flat;
    if (facing > CONFIG.sightCos && sees()) notice(s, e, 0, 'sight');
  }
}

// The shield, the visible rig and the damage cone share this heading.
function steerTravel(e, dx, dz, dt, distance) {
  const desired = Math.atan2(dx, dz);
  if (e.type !== 'shielded') { e.heading = desired; return 1; }
  const delta = Math.atan2(Math.sin(desired-e.heading), Math.cos(desired-e.heading));
  const rate = .72 + 1.65 * clamp((distance - 3) / 2, 0, 1);
  const step = clamp(delta, -rate*dt, rate*dt);
  e.heading += step;
  // When the waypoint is behind the guard, plant its feet and turn first.
  return clamp(Math.cos(delta-step)*1.5, 0, 1);
}

// 没发现玩家时，睡着的不动，巡逻的按兵种步态走过几个点。
function idleMove(s, e, dt) {
  e.hop = 0; e.hopPhase = 0;
  if (e.awareness !== 'idle' || !e.patrol || e.hit > 0) return;
  if (e.patrolWait > 0) { e.patrolWait -= dt; return; }
  const [tx, tz] = e.patrol[e.patrolIndex], dx = tx - e.x, dz = tz - e.z, d = length(dx, dz);
  if (d < 0.12) { e.patrolIndex = (e.patrolIndex + 1) % e.patrol.length; e.patrolWait = 1.4; return; }
  const alignment = steerTravel(e, dx, dz, dt, d);
  const pace = travelPace(e, 1.5, .5);
  const travel = Math.min(d, alignment * e.speed * .42 * pace * enemyMovementScale(s,e) * dt);
  e.x += dx / d * travel; e.z += dz / d * travel;
}

// 包抄（docs/fun-design.md 2.7）：贴身的僵尸好几只从同一边追过来时，后面那只不排队，绕到玩家侧面再扑。
// 只有直线走得过去的时候才绕（不为此找路）；离玩家 close 米以内就不绕了，直接追。
export const FLANK = { types: new Set(['walker', 'leaper', 'crawler', 'heavy', 'shielded']), far: 9, close: 2.4, cos: Math.cos(0.75), angle: 1.25, radius: 2.6, every: 0.3 };
function flankPoint(s, e, S) {
  const p = s.player, dx = e.x - p.x, dz = e.z - p.z, d = length(dx, dz);
  if (!FLANK.types.has(e.type) || d < FLANK.close + 0.6 || d > FLANK.far) return null;
  const bx = dx / d, bz = dz / d;
  // 同一边（夹角 43° 以内）有一只离玩家更近、也在追的：自己就是排在后面的那只
  const behind = s.enemies.some(o => o !== e && o.alive && o.enabled && o.awareness === 'alert' && Math.abs(o.base - e.base) < 0.5 && FLANK.types.has(o.type)
    && length(o.x - p.x, o.z - p.z) < d && ((o.x - p.x) * bx + (o.z - p.z) * bz) / (length(o.x - p.x, o.z - p.z) || 1) > FLANK.cos);
  if (!behind) return null;
  // 屋里家具多：两边、两个角度、两个距离挨个试，挑第一个直线走得到、站得下的点
  const r = navRadius(e.radius), sides = e.id % 2 ? [1, -1] : [-1, 1];
  for (const k of [1, 0.65]) for (const reach of [Math.min(d * 0.75, FLANK.radius), 1.8]) for (const side of sides) {
    const a = FLANK.angle * k * side, c = Math.cos(a), sn = Math.sin(a);
    const t = { x: p.x + (bx * c - bz * sn) * reach, z: p.z + (bx * sn + bz * c) * reach };
    if (freePoint(S, t.x, t.z, e.radius + 0.06) && clearPath(S, e, t, r, true)) return t;
  }
  return null;
}

const ROUTES_PER_STEP = 3;
// 这一步还能不能找路（见 step 开头）；不经过 step 直接调的（测试）不限
const routeTurn = (s) => s.routeBudget === undefined || s.routeBudget-- > 0;
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
  if (action) {
    e.hopPhase = 0;
    e.hop = action.y;
    if (e.hit <= 0) { const slow = enemyMovementScale(s,e); e.x += action.x * slow * dt; e.z += action.z * slow * dt; }
    return;
  }
  const goal = navGoal(L, e, p);
  if (level) { e.flankIn = (e.flankIn ?? 0) - dt; if (e.flankIn <= 0) { e.flankIn = FLANK.every; e.flank = flankPoint(s, e, S); } }
  else e.flank = null;
  if (e.flank && e.action !== 'sidestep') {
    // 包抄：直接朝旁边那个点走；到了、或者已经贴近玩家，就回到正常的追
    if (length(e.flank.x - e.x, e.flank.z - e.z) < 0.35 || length(p.x - e.x, p.z - e.z) < FLANK.close) { e.flank = null; e.flankIn = FLANK.every * 3; }
  }
  e.navIn -= dt;
  if (goal.direct) e.route = [];
  else if (e.navIn <= 0 && routeTurn(s)) { e.route = routeTo(S, e, goal, r); e.navIn = 0.4; }
  while (e.route.length && length(e.x - e.route[0].x, e.z - e.route[0].z) < 0.04) e.route.shift();
  const next = e.action === 'sidestep' ? { x: e.flankX, z: e.flankZ } : e.flank ? e.flank : goal.direct || clearPath(S, e, goal, r, true) ? goal : e.route[0];
  if (!next || e.hit > 0) { e.hop *= Math.exp(-dt * 14); return; }
  const dx = next.x - e.x, dz = next.z - e.z, d = length(dx, dz) || 1;
  const pace = travelPace(e, 1, 1, e.id * .137);
  const speed = e.speed * e.moveMultiplier * pace * enemyMovementScale(s,e);
  if (e.type === 'walker' && e.hopPhase < prevPhase) s.events.push({ type: 'land', id: e.id, ...at(e), enemyType: e.type });
  const facesPlayer = e.action === 'sidestep' || (e.type === 'shielded' && level &&
    lineOfSight(S, {x:e.x,y:e.base+.95,z:e.z}, {x:p.x,y:p.y+1,z:p.z}));
  const alignment = d > .03 && e.hit <= 0
    ? steerTravel(e, facesPlayer ? p.x-e.x : dx, facesPlayer ? p.z-e.z : dz, dt, Math.hypot(p.x-e.x,p.z-e.z))
    : 1;
  const travel = Math.min(d, alignment * speed * dt);
  e.x += dx / d * travel; e.z += dz / d * travel;
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
  const hit = { type: 'hit', id: e.id, ...at(e), dx, dz, heavy: weapon === 'heavy', source, amount, hp: e.hp, maxHp: e.maxHp,
    impulse: impulse * e.resistance, strength: e.reactionStrength, ...meta, weapon };
  s.events.push(hit);
  if (s.challenge) recordChallengeHit(s.challenge, hit, e, s.time);
  if (e.hp <= 0) knockdown(s, e, dx, dz, source);
}

// 毛球打中僵尸：算射程衰减、正面护甲，以及背后和偷袭的加成（各 +100%，可叠加）。
function ballHit(s, b, e, incoming) {
  const n = Math.hypot(incoming.x, incoming.z) || 1, dx = incoming.x / n, dz = incoming.z / n;
  const back = dx * Math.sin(e.heading) + dz * Math.cos(e.heading) > CONFIG.backCos;
  // 偷袭：它没发现你（按开枪那一刻算），或者正被电得动不了
  const frozen=e.frozenUntil>s.time;
  const sneak = unaware(e) || (e.awareness === 'waking' && b.quiet.includes(e.id)) || e.stun > 0;
  // 持盾者正面挡得住普通毛球：要绕后，或者用棉被炮 / 蓄力球破防
  const frontal = dx * Math.sin(e.heading) + dz * Math.cos(e.heading) < -0.55;
  if (e.type === 'shielded' && e.guardBroken <= 0 && frontal && !frozen && !(e.stun > 0)) {
    b.hitTimes[e.id] = s.time; b.enemyHits++;
    if (b.weapon !== 'heavy' && b.power < 0.6) { if (unaware(e)) notice(s, e, 0, 'hit'); s.events.push({ type: 'blocked', id: e.id, x: b.x, y: b.y, z: b.z, base: e.base }); return; }
    e.guardBroken = 1.8; interruptSpecial(e, { weapon: 'heavy' }); s.events.push({ type: 'guard-break', id: e.id, ...at(e) });
  }
  let amount = ballDamage(b) + (frozen && b.weapon==='single'?2:0);
  if (e.armor && !back && !b.pierceArmor) amount = Math.floor(amount * e.armor);   // 正面减半、向下取整：小纽扣和飞远了的手枪球（1 点）打不动；毛衣针扎得穿
  amount *= 1 + (back ? 1 : 0) + (sneak ? 1 : 0);
  b.hitTimes[e.id] = s.time; b.enemyHits++;
  s.hits++; if (back) s.backHits++; if (sneak) s.sneakHits++;
  damage(s, e, amount, dx, dz, b.impulse, 'ball', { ballId: b.id, afterSurface: b.lastSurfaceId, weapon: b.weapon, stun: b.stun, charged:b.power>=.6, back, sneak, armored: !!e.armor && !back && !b.pierceArmor, contactX: b.x, contactY: b.y, contactZ: b.z });
}

// ---------- 毛球 ----------

function expireBall(s, b, reason = 'lifetime') {
  if (b.destroyed) return;
  b.destroyed = true;
  if (b.weapon === 'freeze') s.events.push({ type: 'freeze-beam', x0: b.originX, y0: b.originY, z0: b.originZ, x1: b.x, y1: b.y, z1: b.z });
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

// 毛绒玩具蹦一下：只是离地，不替代现有的枪和走位，也不给无敌帧。
// p.jump 是离地高度（p.y 仍是脚下的地面）；落地、起跳各发一个事件给表现层。
export function beginJump(s) {
  const p = s.player;
  if (s.phase !== 'playing' || p.jump > 0 || p.jumpV > 0 || s.amusement?.trap || s.amusement?.fallUntil || (s.amusement?.ride?.started != null && !s.amusement.ride.finished) || amusementCutscene(s)) return false;
  p.jump = 0.001; p.jumpV = 2.6;
  s.events.push({ type: 'hop' });
  return true;
}

// All attack sources share the same heart/iframe path.
export function hurtPlayer(s,enemy,source='contact',amount=s.amusement ? (source==='contact'?9:12) : 1){
 if(s.phase!=='playing'||s.invul>0||s.endIn!==null||amusementCutscene(s)||(!s.amusement&&s.total>0&&aliveCount(s)===0))return false;
 const dx=s.player.x-enemy.x,dz=s.player.z-enemy.z,n=Math.hypot(dx,dz)||1;
 s.health=Math.max(0,s.health-amount);s.damageTaken++;s.invul=s.amusement ? .78 : CONFIG.invulnerable;if(source!=='contact'){s.player.vx+=dx/n*2;s.player.vz+=dz/n*2;}
 if(source==='contact'&&enemy.type==='crawler')s.slowUntil=Math.max(s.slowUntil,s.time+1.3);
 s.events.push({type:'hurt',x:s.player.x,z:s.player.z,base:s.player.y,by:enemy.id,source,fromX:enemy.x,fromZ:enemy.z,health:s.health});return true;
}
function launchEnemyProjectile(s,e,target){
 if(s.enemyShots.length>=32)s.enemyShots.shift();const muzzle=e.muzzle||{y:Math.min(1.15,e.height*.63),forward:.46,side:-.22},y=e.y+muzzle.y;
 const b={id:s.nextId++,owner:e.id,x:e.x+Math.sin(e.heading)*muzzle.forward+Math.cos(e.heading)*muzzle.side,y,z:e.z+Math.cos(e.heading)*muzzle.forward-Math.sin(e.heading)*muzzle.side,r:.085,age:0,life:2.8,destroyed:false};const mx=target.x-b.x,my=target.y-b.y,mz=target.z-b.z,m=Math.hypot(mx,my,mz)||1;b.vx=mx/m*ARROW_SPEED;b.vy=my/m*ARROW_SPEED;b.vz=mz/m*ARROW_SPEED;s.enemyShots.push(b);s.events.push({type:'enemy-shot',id:b.id,x:b.x,y,z:b.z});
}
const attackApi={hurt:hurtPlayer,knockdown,projectile:launchEnemyProjectile,bomb:launchBomb};
function settleEnemyShot(s,b,impact){
 b.destroyed=true;
 if(s.challenge)recordChallengeArrow(s.challenge,impact);
}
function advanceEnemyShot(s,b,dt){
 b.age+=dt;if(b.age>b.life){settleEnemyShot(s,b,'expired');return;}
 const end={x:b.x+b.vx*dt,y:b.y+b.vy*dt,z:b.z+b.vz*dt};let t=1,kind=null,enemy=null;
 for(const solid of s.level.solids){const h=segmentBox(b,end,solid,b.r);if(h&&h.t<=t){t=h.t;kind='wall';}}
 const feet=s.player.y+(s.amusement?s.player.jump:0);
 const playerHit=segmentCylinder(b.x,b.y,b.z,end.x,end.y,end.z,s.player.x,s.player.z,CONFIG.playerRadius+b.r,feet+.05,feet+1.7);
 if(playerHit!==null&&playerHit<t){t=playerHit;kind='player';}
 for(const e of s.enemies){if(!e.enabled||!e.alive||e.id===b.owner)continue;const h=segmentCylinder(b.x,b.y,b.z,end.x,end.y,end.z,e.x,e.z,e.radius+b.r,e.y+.04,e.y+e.height);if(h!==null&&h<t){t=h;kind='enemy';enemy=e;}}
 b.x+=(end.x-b.x)*t;b.y+=(end.y-b.y)*t;b.z+=(end.z-b.z)*t;
 if(kind){settleEnemyShot(s,b,kind);if(kind==='player')hurtPlayer(s,s.enemies.find(e=>e.id===b.owner)||{id:b.owner,x:b.x-b.vx,z:b.z-b.vz},'arrow');else if(kind==='enemy'){const n=Math.hypot(b.vx,b.vz)||1;damage(s,enemy,1,b.vx/n,b.vz/n,.7,'enemy-arrow',{weapon:'single'});}s.events.push({type:'enemy-shot-impact',id:b.id,x:b.x,y:b.y,z:b.z});}
 else {const B=s.level.bounds;if(b.x<B.minX||b.x>B.maxX||b.z<B.minZ||b.z>B.maxZ)settleEnemyShot(s,b,'bounds');}
}

function clownVolley(s,group){
  const p=s.player,c=s.amusement.clown;
  const x=c.x+(group-1)*.82, y=1.04+(group%2)*.47, z=c.z+.92;
  const angle=Math.atan2(p.x-x,p.z-z), speed=7.3;
  for (const offset of [-.24,-.12,0,.12,.24]) {
    if (s.enemyShots.length>=32) s.enemyShots.shift();
    const direction=angle+offset;
    s.enemyShots.push({id:s.nextId++,owner:-2,style:'juggle',x,y,z,
      vx:Math.sin(direction)*speed,vy:0,vz:Math.cos(direction)*speed,r:.14,age:0,life:2.1,destroyed:false});
  }
  s.events.push({type:'amusement',action:'volley',x,y,z});
}

function freezeEnemy(s,b,e) {
  if (!(e.freezeResistUntil>s.time)) {
    e.frozenUntil=s.time+3; e.freezeResistUntil=e.frozenUntil+1.5;
    e.vx=e.vz=0;
    s.events.push({type:'enemy-frozen',id:e.id,x:b.x,y:b.y,z:b.z});
  } else if (!(e.frozenUntil>s.time)) e.frostSlowUntil=s.time+.65;
  s.hits++;
  damage(s,e,1,b.dx,b.dz,0,'ball',{weapon:'freeze',stun:0,contactX:b.x,contactY:b.y,contactZ:b.z});
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
      if (c.gadget === 'quilt' && s.gadgets.some(g => g.id === c.id && g.used)) continue;
      const h = segmentBox(b, end, c, b.r);
      // 楼板和踏步的顶面算地面：和落在底层地面上一样弹
      if (h && b.vx * h.nx + b.vy * h.ny + b.vz * h.nz < -1e-6) candidate(h.t, h.nx, h.ny, h.nz, h.ny > 0.5 && (c.kind === 'slab' || c.kind === 'stair') ? 'floor' : 'solid', null, c);
    }
    const parkHit=s.amusement && amusementContact(s,b,end);
    if (parkHit) candidate(parkHit.t,parkHit.nx,parkHit.ny,parkHit.nz,'amusement',null,parkHit.box);
    const t = hit ? hit.t : 1;
    // 动态布景只吃到障碍物之前飞过的那一段，快球也不会漏掉薄相框。
    for (const egg of L.easterEggs || []) {
      if (b.eggHits?.has(egg.id)) continue;
      const touch = segmentBox(b, end, egg, b.r);
      if (!touch || touch.t > t) continue;
      (b.eggHits ??= new Set()).add(egg.id);
      const x = b.x + (end.x-b.x)*touch.t, y = b.y + (end.y-b.y)*touch.t, z = b.z + (end.z-b.z)*touch.t;
      s.events.push({ type:'easter-egg', id:egg.id, x,y,z, base:egg.floorY, side:Math.sign(x-egg.x) || 1 });
    }
    b.travel += Math.hypot(end.x - b.x, end.y - b.y, end.z - b.z) * t;
    b.x += (end.x - b.x) * t; b.y += (end.y - b.y) * t; b.z += (end.z - b.z) * t;
    if (b.travel >= b.maxRange) { expireBall(s, b, 'range'); break; }
    if (!hit) break;
    left *= 1 - hit.t;
    // 户外没有天花板，也没有高过围篱的墙：飞出去的球直接散掉。
    if ((hit.kind === 'ceiling' || (hit.kind === 'edge' && b.y > 2.3)) && isOutdoor(L, b.x, b.z)) { expireBall(s, b, 'sky'); break; }
    const incoming = { x: b.vx, y: b.vy, z: b.vz };
    if (hit.kind==='amusement') { hitAmusement(s,b,hit.box); expireBall(s,b,'contact'); break; }
    if (b.weapon==='freeze' && hit.e) { freezeEnemy(s,b,hit.e); expireBall(s,b,'contact'); break; }
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
    b.lastSurfaceId = hit.box?.id; // Actual previous contact, independent of throttled visual bounce events.
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
  const w = WEAPONS[weaponIndex(b.weapon)];
  blast(s, b.x, b.y, b.z, w);
  if (w.tangle) {
    const y = surfaceY(s.level, b.x, b.z, b.y) + .035;
    s.tangleFields.push({ id: b.id, x: b.x, y, z: b.z, radius: w.blast, start: s.time, until: s.time + w.tangle });
  }
  expireBall(s, b, 'explode');
}

function advanceTangleFields(s) {
  s.tangleFields = s.tangleFields.filter(field => field.until > s.time);
  for (const field of s.tangleFields) for (const e of s.enemies) {
    if (!e.alive || !e.enabled || Math.abs(e.base - field.y) > .45 || Math.hypot(e.x - field.x, e.z - field.z) > field.radius) continue;
    const origin = { x: field.x, y: field.y + .16, z: field.z };
    if (lineOfSight(s.level, origin, { x: e.x, y: e.base + .25, z: e.z })) e.tangle = Math.max(e.tangle, .22);
  }
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
  const L = s.level, G = GADGETS[g.kind], S = L.storeys[g.floor], top = { x: g.x, y: g.y + (G.lightY ?? G.h + 0.35), z: g.z }, hit = [];   // 声音和灯光从机关顶上发出来（在它自己的盒子外面）
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
    for (const e of s.enemies) if (hit.includes(e.id)) e.paintUntil = s.time + WEAPONS[GRENADE].tangle;
  } else if (g.kind === 'spot') {
    for (const e of s.enemies) {
      if (!here(e)) continue;
      const dx = e.x-g.x, dz = e.z-g.z, distance = Math.hypot(dx,dz);
      const reach = Math.min(e.radius*.66,distance), edge = 1-reach/(distance || 1);
      const lit = [0.16,0.42,0.68].some(height => {
        const y = e.y + e.height*height, beamRadius = G.radius*(top.y-y)/G.lightY;
        return distance-reach <= beamRadius &&
          lineOfSight(L,top,{x:g.x+dx*edge,y,z:g.z+dz*edge},1.2,g.id);
      });
      if (!lit) continue;
      const duration = G.stun * (e.armor ? 0.6 : 1);
      e.stun = Math.max(e.stun, duration);
      e.spotUntil = s.time + duration;
      hit.push(e.id);
    }
  } else if (g.kind === 'quilt') {
    g.until = s.time + G.fall;
  }
  s.events.push({ type: 'gadget', id: g.id, kind: g.kind, x: g.x, y: g.y, z: g.z, base: g.y, radius: G.radius, struck: hit });
}

function landQuilt(s, g) {
  g.until = 0;
  const G = GADGETS.quilt, hit = [];
  for (const e of s.enemies) {
    if (!e.alive || !e.enabled || Math.abs(e.base - g.y) > 0.25 || e.y > g.y + G.minY) continue;
    if (Math.abs(e.x - g.x) > G.w / 2 || Math.abs(e.z - g.z) > G.depth / 2) continue;
    e.stun = Math.max(e.stun, G.stun);
    e.quiltUntil = s.time + G.stun;
    hit.push(e.id);
  }
  s.events.push({ type: 'quilt-land', id: g.id, x: g.x, y: g.y, z: g.z, struck: hit });
}

// 被闹钟引过去的僵尸：走到分给它的空位，面朝闹钟站着，响完为止。路上照样会看见玩家（那就变成追）。
// 听到枪声过来看的（lure.kind === 'noise'）：走到开枪的地方附近，左右张望，看够了就留在那儿站岗（不回原位）。
function investigate(s, e, dt) {
  const S = storeyAt(s.level, e.base), t = e.lure, r = navRadius(e.radius), noise = t.kind === 'noise';
  if (s.time > t.until) { e.lure = null; e.hop = 0; return; }
  const far = length(t.x - e.x, t.z - e.z);
  if (t.arrived || far < (noise ? SEARCH.arrive : 0.15)) {
    if (!t.arrived && noise) { t.lookAt = s.time; t.until = s.time + SEARCH.look; }
    t.arrived = true; e.hop *= Math.exp(-dt * 12);
    // 张望：以来的方向为中心左右各转约 80°
    const heading = noise ? (t.face ??= e.heading) + Math.sin((s.time - t.lookAt) * 1.4) * 1.4 : Math.atan2(t.lookX - e.x, t.lookZ - e.z);
    const turn = Math.atan2(Math.sin(heading - e.heading), Math.cos(heading - e.heading));
    if (e.type === 'shielded') steerTravel(e, Math.sin(heading), Math.cos(heading), dt, far);
    else e.heading += clamp(turn, -dt * 4, dt * 4);
    return;
  }
  e.navIn -= dt;
  if (e.navIn <= 0 && routeTurn(s)) { e.route = routeTo(S, e, t, r); e.navIn = 0.5; }
  while (e.route.length && length(e.x - e.route[0].x, e.z - e.route[0].z) < 0.04) e.route.shift();
  const next = clearPath(S, e, t, r, true) ? t : e.route[0];
  if (!next) return;
  const pace = travelPace(e, 1.2, .7), dx = next.x - e.x, dz = next.z - e.z, d = length(dx, dz) || 1;
  const alignment = d > .03 && e.hit <= 0 ? steerTravel(e,dx,dz,dt,d) : 1;
  const travel = Math.min(d, (e.hit <= 0 ? alignment * e.speed * (noise ? SEARCH.pace : .75) * pace * enemyMovementScale(s,e) : 0) * dt);
  e.x += dx / d * travel; e.z += dz / d * travel;

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
      if (s.health >= s.maxHealth) continue;
      s.health = Math.min(s.maxHealth, s.health + k.amount);
    } else if (k.kind === 'ammo') {
      // 弹药包不记种类：补的是手里那把特殊枪（没带特殊枪就先留在地上）。写了 weapon 的是指定给那把枪的；手雷是加一颗。
      const index = k.weapon ? weaponIndex(k.weapon) : secondOf(s);
      if (index < 0) continue;
      got = { weapon: WEAPONS[index].id, amount: k.amount ?? WEAPONS[index].pack ?? WEAPONS[index].mag };
      s.ammo[index].reserve += got.amount;
      if (WEAPONS[index].kind === 'grenade') {
        if (!s.owned[s.grenade]) s.grenade = index;
        s.owned[index] = true;
      }
    } else if (k.kind === 'weapon') {
      const index = weaponIndex(k.weapon), w = WEAPONS[index], second = secondOf(s);
      if (index < 0) continue;
      if (w.kind === 'grenade') {
        if (!s.owned[s.grenade]) s.grenade = index;
        s.ammo[index].reserve += k.amount ?? 1; s.owned[index] = true;
      }
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
        // 更远的、同一层还没发现你的，都朝拿东西的地方找过来：回去的路不会是空的（docs/fun-design.md 2.6）
        // 别的楼层不来：试过让下一层的聚到楼梯口，一层十来只全堵在楼梯里，身后又有首领，休闲玩家下不去（2026-11-20）
        // 还没拿齐的时候只招警报两倍以内的：博物馆三件展品，第一件就把全馆招过来的话，后面就只剩一场大混战了
        else if (e.alive && e.enabled && unaware(e) && !(e.lure && e.lure.kind !== 'noise') && Math.abs(e.base - p.y) < 1
          && (s.carrying || alarm === true || d < alarm * SEARCH.alarm)) search(s, e, { x: p.x, z: p.z });
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
    if (index < 0 || WEAPONS[index].kind === 'grenade' || s.owned[index] || d > nearest) continue;
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
  if (s.challenge) return { type: 'challenge', alive, total: s.total, done: s.phase === 'won' };
  if (s.amusement) return { type:'amusement', alive, total:s.total, done:s.amusement.pickedUp && !(s.amusement.victoryCutsceneUntil > s.time) };
  if (s.level.tour) return { type: 'explore', alive, total: s.total, done: s.park.done && !s.park.riding };
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
  // 找路一步最多算这么多只：一群僵尸同时警觉的话，它们的 0.4 秒找路计时会对齐，每 0.4 秒挤在同一帧里一起算
  // （家里 17 只在 M 系列上一帧 7 毫秒，慢 CPU 上就是每 0.4 秒卡一下）。轮不到的下一步再算，头一轮 0.1 秒内全部找完，之后自然错开。
  s.routeBudget = ROUTES_PER_STEP;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.invul = Math.max(0, s.invul - dt);
  s.lobCooldown = Math.max(0, s.lobCooldown - dt);
  // 蹦一下：重力把 p.jump 落回 0；最高约 0.4 米、整段约 0.6 秒。
  if (p.jump > 0 || p.jumpV > 0) {
    p.jumpV -= 8.5 * dt;
    p.jump += p.jumpV * dt;
    if (p.jump <= 0) { p.jump = 0; p.jumpV = 0; s.events.push({ type: 'hop-land' }); }
  }
  if (s.charging) s.charge = Math.min(CONFIG.chargeTime, s.charge + dt);
  if (s.lobbing) s.lob = Math.min(CONFIG.chargeTime, s.lob + dt);
  if (s.amusement) s.stowedReload.forEach((remaining,index)=>{
    if (remaining<=0) return;
    s.stowedReload[index]=Math.max(0,remaining-dt);
    if (!s.stowedReload[index]) fillMagazine(s,index);
  });
  if (s.reloading) { s.reload -= dt; if (s.reload <= 0) finishReload(s); }
  else if (s.ammo[s.weapon].mag === 0 && s.cooldown <= 0 && !startReload(s)) backToPistol(s);   // 打空自动换弹；彻底没弹药就换回手枪

  // 游乐园：设施往前演；坐在设施上的时候人由座位带着走，不走路
  if (L.tour && stepPark(s, dt, input)) return;
  let mx = input.x || 0, mz = input.z || 0;
  const m = length(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimZ)) {
    const n = Math.hypot(input.aimX, input.aimY || 0, input.aimZ);
    if (n > 0.01) { p.aimX = input.aimX / n; p.aimY = (input.aimY || 0) / n; p.aimZ = input.aimZ / n; }
  }
  const moveSpeed=CONFIG.playerSpeed*(s.slowUntil>s.time?.62:1);
  const fromX = p.x, fromZ = p.z;
  const controlled=s.amusement && moveAmusement(s,hurtPlayer);
  if (L.tour) {
    // Test the requested displacement at the path and wall together, so wall correction cannot move an idle player.
    if (m) {
      const floor = storeyAt(L, p.y);
      p.x += mx * moveSpeed * dt; p.z += mz * moveSpeed * dt;
      constrainTourWalk(p, fromX, fromZ, s.park.door > .9, (x,z) => freePoint(floor, x, z, CONFIG.playerRadius));
    }
  } else if (!controlled) {
    p.x += mx * moveSpeed * dt + p.vx * dt; p.z += mz * moveSpeed * dt + p.vz * dt;
    p.vx *= Math.exp(-10 * dt); p.vz *= Math.exp(-10 * dt);
    resolveBody(storeyAt(L, p.y), p, CONFIG.playerRadius);
    p.y = surfaceY(L, p.x, p.z, p.y);
  }
  if (s.amusement) advanceAmusement(s,dt,{hurt:hurtPlayer,damage,volley:clownVolley});
  // 连发枪：扳机按着、冷却到了就出一发；弹匣空了交给上面的自动换弹，彻底没弹药就松开扳机
  if (s.trigger && WEAPONS[s.weapon].auto && s.cooldown <= 0 && !s.reloading) {
    if (!fire(s, 0, input.shot || null) && s.ammo[s.weapon].mag === 0 && s.ammo[s.weapon].reserve === 0) s.trigger = false;
  }

  for (const e of s.enemies) {
    if(!e.enabled)continue;
    if (e.alive && e.frozenUntil>s.time) { e.vx=e.vz=0; continue; }
    const startX=e.x, startZ=e.z, startHeading=e.heading;
    e.age += dt; e.reactionAge += dt;
    e.hit = Math.max(0, e.hit - dt); e.chainCooldown = Math.max(0, e.chainCooldown - dt);
    e.stun = Math.max(0, e.stun - dt); e.tangle = Math.max(0, e.tangle - dt);
    if (!e.alive) { e.deathAge += dt; e.hop *= Math.exp(-dt * 12); }
    else if (e.stun > 0) e.hop *= Math.exp(-dt * 14);   // 被电住：站在原地发抖，不追、不看、不咬
    else if (e.awareness === 'alert') chase(s, e, dt);
    else { sense(s, e, dt); if (e.awareness === 'alert' || e.awareness === 'waking') e.lure = null; else if (e.lure) investigate(s, e, dt); else idleMove(s, e, dt); }
    const wantedX = e.x - startX, wantedZ = e.z - startZ;
    e.x += e.vx * dt; e.z += e.vz * dt;
    e.vx *= Math.exp(-4.3 * dt); e.vz *= Math.exp(-4.3 * dt);
    resolveBody(storeyAt(L, e.base), e, e.radius);
    e.base = surfaceY(L, e.x, e.z, e.base); e.y = e.base + e.hop;
    if (strideTravel(e, startX, startZ, wantedX, wantedZ, startHeading, dt)) {
      s.events.push({ type: 'footstep', id: e.id, ...at(e), enemyType: e.type });
    }
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
  for (const e of s.enemies) if (e.enabled && !(e.frozenUntil>s.time)) resolveBody(storeyAt(L, e.base), e, e.radius);

  if (s.nets.length) {
    for (const net of s.nets) advanceNet(s, net, dt);
    s.nets = s.nets.filter(net => s.time < net.until);
  }
  if (s.tangleFields.length) advanceTangleFields(s);
  for (const ball of s.balls) advanceBall(s, ball, dt);
  s.balls = s.balls.filter(b => !b.destroyed);
  for (const g of s.gadgets) if (g.kind === 'quilt' && g.until > 0 && s.time >= g.until) landQuilt(s, g);
  advanceBombs(s,dt,hurtPlayer);for(const b of s.enemyShots)advanceEnemyShot(s,b,dt);s.enemyShots=s.enemyShots.filter(b=>!b.destroyed);
  s.enemies = s.enemies.filter(e => e.alive || e.deathAge < 1.15);

  // 只有已经警觉的僵尸碰到你才会扣心。
  if (s.invul <= 0) for (const e of s.enemies) {
    if (!e.alive || !e.enabled || e.awareness !== 'alert' || e.stun > 0 || e.frozenUntil>s.time || !contactAttack(e) || Math.abs(e.base - p.y) > CONFIG.sameLevel) continue;
    if (s.amusement && (p.jump > 0.9 || (s.amusement.ride.started !== null && !s.amusement.ride.finished))) continue;   // 游乐场：人坐在过山车上（躲不了）、或被惊喜盒弹到半空时，地上的僵尸够不着
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
    p.x += nx * overlap * 0.85; p.z += nz * overlap * 0.85; if (!(e.frozenUntil>s.time)) { e.x -= nx * overlap * .15; e.z -= nz * overlap * .15; }
    if (!(e.frozenUntil>s.time)) resolveBody(storeyAt(L, e.base), e, e.radius);
  }
  if (!L.tour) {
    resolveBody(storeyAt(L, p.y), p, CONFIG.playerRadius);
    p.y = surfaceY(L, p.x, p.z, p.y);
  }

  // 这一步实际挪了多少（撞墙、被顶开都算在内）：弓手按它算提前量
  if (dt > 0) { const k = Math.min(1, dt * 12); p.mvx += ((p.x - fromX) / dt - p.mvx) * k; p.mvz += ((p.z - fromZ) / dt - p.mvz) * k; }

  collect(s);

  if (s.challenge) {
    const phase = challengeOutcome(s.challenge, s);
    if (phase) finish(s, phase);
    return;
  }
  if (s.health <= 0) { finish(s, 'lost'); return; }
  if (s.wave) advanceWaves(s);
  if (s.endIn !== null) { s.endIn -= dt; if (s.endIn <= 0) finish(s, 'won'); }
  else if (missionStatus(s).done) { s.enemyShots=[];s.enemyBombs=[];s.endIn = CONFIG.endDelay; s.events.push({ type: 'mission-complete' }); }
}

export function consumeEvents(s) { const e = s.events; s.events = []; return e; }
