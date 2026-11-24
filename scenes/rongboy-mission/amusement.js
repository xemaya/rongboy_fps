// 布偶游乐园的规则：十站连成一关。每站路上横一道门，这一站的事办完门才开；最后在马戏帐篷里打嬉笑小丑。
// 设施怎么演、怎么坐，在 park-rides.js；地图的尺寸在 park-tour-layout.js；
// 画面在 park-tour-view.js（布景和设施）和 amusement-view.js（门、机关、帐篷里面、小丑）。这里不依赖 DOM。
// 十站（顺着小径）：0 入口 · 1 旋转木马 · 2 激流勇进 · 3 过山车 · 4 鬼屋 · 5 摩天轮 · 6 游戏摊街 · 7 碰碰车 · 8 镜子迷宫 · 9 马戏帐篷
import { segmentBox } from './level.js';
import { TOUR_PATH, TOUR_STOPS, TENT, TENT_DOOR, GATE as ARCH, CAROUSEL as HORSES } from './park-tour-layout.js';
import { parkPrompt, parkInteract } from './park-rides.js';

export { TENT, TENT_DOOR };
export const PARK_ZONES = TOUR_STOPS.map(({ id, name, en }) => ({ id, name, en }));
export const TENT_ZONE = PARK_ZONES.length - 1;
const zoneOf = id => PARK_ZONES.findIndex(zone => zone.id === id);
const CAROUSEL_ZONE = zoneOf('carousel'), COASTER_ZONE = zoneOf('coaster');

// 门横在小径上：位置、小径在那里的走向（tx, tz 指向下一站）、门洞多宽。第 i 道门隔开第 i 站和第 i+1 站。
function onPath(x, z) {
  let best = 0, near = Infinity;
  TOUR_PATH.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < near) { near = d; best = i; } });
  const p = TOUR_PATH[best], a = TOUR_PATH[Math.max(0, best - 3)], b = TOUR_PATH[Math.min(TOUR_PATH.length - 1, best + 3)], len = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: p.x, z: p.z, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len, width: p.width * 2 };
}
export const GATES = [
  { x: ARCH.x, z: ARCH.z, tx: 0, tz: -1, width: 2 * (ARCH.half - .78) },   // 入口的拱门：门栓就夹在拱门上
  onPath(-33.3, 16.0), onPath(-34.8, -4.8), onPath(-20.3, -22.8), onPath(5.3, -24.3), onPath(30.7, -21.6), onPath(36.15, 1.3), onPath(29.6, 15.9),
  { x: 0, z: TENT_DOOR, tx: 0, tz: -1, width: 3.6 },   // 帐篷的门帘
];
export const GATE_LIFT_SECONDS = .62;
const GATE_STOP = .3;   // 门关着的时候人被挡在门前这么远

// 入口的门栓：夹在拱门的两道金杆上来回滑，比栅门高一点（毛球从栅门上面飞过去打得到）
export const LOCK = { x: ARCH.x, y: 1.78, z: ARCH.z, amp: .85, speed: 2.7 };
// 木马：蒸汽阀在台阶东边、贴着底座；摇了铃，木马转起来，一圈圈气浪从底座往外扫
export const VALVE = { x: -23.9, y: 1.35, z: 19.1 };
export const SWEEP = { from: HORSES.platform, to: 7.4, rate: 1.1, seconds: 8 };
// 过山车的两个轨道靶：都在提升坡的右手边（南边），一前一后、一低一高，靶面朝着北边的小径。
// 坐在车上打得到；下了车站在出站的小径上也打得到（离路 8 米左右，抬头不到 36°）。
export const COASTER_TARGETS = [
  { x: -21.6, y: 5.0, z: -15.2, amp: .9, speed: 2.1 },
  { x: -17.6, y: 7.0, z: -15.0, amp: .6, speed: 2.4 },
];
export const SAFE_PAD = { x: 0, z: TENT_DOOR - 1.4 };
export const FIRST_BOX = { x: 0, z: TENT_DOOR - 3.9, y: 0 };
export const CLOWN = { x: 0, z: TENT_DOOR - 8.95, maskY: 3.03, hp: 46 };
export const MOTOR = { x: 0, y: .66, z: TENT_DOOR - 6.65 };
export const TILE = 2.35;
export const TILES = Array.from({ length: 15 }, (_, i) => ({
  x: (i % 5 - 2) * TILE, z: TENT_DOOR - 3.15 - Math.floor(i / 5) * TILE, index: i,
}));
// 打小丑的时候人能走的范围
const ARENA = { minX: -5.82, maxX: 5.82, minZ: TENT_DOOR - 7.75, maxZ: TENT_DOOR - 1.18 };
export const tileSwitch = tile => ({ x: tile.x + .68, y: .58, z: tile.z + .72 });
export const CLOWN_INTRO_SECONDS = 3.8;
export const VICTORY_CUTSCENE_SECONDS = 4.0;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (x, z, p) => Math.hypot(x - p.x, z - p.z);
const signal = (s, action, extra = {}) => s.events.push({ type: 'amusement', action, ...extra });

export function lockPosition(a) {
  const x = a.lock === 'frozen' ? a.lockFrozenX : LOCK.x + Math.sin(a.lockPhase) * LOCK.amp;
  return { x, y: LOCK.y, z: LOCK.z };
}

export function coasterTargetPosition(a, i) {
  const base = COASTER_TARGETS[i], st = a.targets[i];
  const x = st.lit || st.frozenUntil > 0 && st.frozenX !== null ? (st.frozenX ?? base.x) : base.x + Math.sin(st.phase) * base.amp;
  return { x, y: base.y, z: base.z };
}

// zone：从第几站开始（重来的时候是倒下的那一站）。前面几站算办完了：门开着、灯亮着、机关不用再碰。
export function makeAmusement(zone = 0) {
  const past = id => zone > zoneOf(id);
  return {
    zone,
    opened: GATES.map((_, i) => i < zone ? -GATE_LIFT_SECONDS : null),
    lit: PARK_ZONES.map((_, i) => i < zone),
    lock: past('entrance') ? 'open' : 'closed',
    lockPhase: 0, lockFrozenUntil: 0, lockFrozenX: LOCK.x,
    valveUntil: 0, valveLatched: past('carousel'),
    carousel: { until: 0, used: past('carousel'), struck: new Map(), iceHits: 0, ring: 0 },
    // 坐过、玩过哪些设施（这一站的门认它）；riding：上一步坐在哪个设施上
    done: { rapids: past('rapids'), coaster: past('coaster'), portraits: past('haunt'), wheel: past('wheel'), stall: past('midway'), bumpers: past('bumpers') },
    riding: null,
    targets: COASTER_TARGETS.map((t, i) => ({ lit: past('coaster'), phase: i * 1.7, frozenUntil: 0, frozenX: null })),
    pickedUp: false,
    clownIntroUntil: 0, clownIntroStarted: 0,
    victoryCutsceneUntil: 0, victoryCutsceneStarted: 0,
    clown: { hp: CLOWN.hp, mask: 2, entered: false, defeatedAt: null, round: 0, next: Infinity, flash: 0, x: CLOWN.x, z: CLOWN.z, poseTime: 0, frozenUntil: 0, resistUntil: 0 },
    boxes: [], fireworks: [],
    tiles: TILES.map(() => ({ warn: 0, off: 0, until: 0, frozenUntil: 0 })),
    trap: null, fallUntil: 0, launchUntil: 0, volleys: [], maskHits: 0,
    retry: zone === TENT_ZONE,   // 从帐篷口重来的：登场那段看过了，不再演一遍
  };
}

export function amusementCutscene(s) {
  const a = s.amusement;
  if (!a) return null;
  if (a.clownIntroUntil > s.time) return { kind: 'clown-intro', progress: clamp((s.time - a.clownIntroStarted) / CLOWN_INTRO_SECONDS, 0, 1) };
  if (a.victoryCutsceneUntil > s.time) return { kind: 'victory', progress: clamp((s.time - a.victoryCutsceneStarted) / VICTORY_CUTSCENE_SECONDS, 0, 1) };
  return null;
}

// 小丑战里镜头该往哪看（docs/park-design.md 3.12）。只管俯仰：地上有要躲的东西（要塌的地砖、烟花落点）时低头，
// 被弹簧盒弹起来时对着面具，其余时候不管（返回 null）。转得多快、玩家自己按了怎么办，在 play.js 里。
const EYE = 1.23;   // 眼睛离脚底的高度，和 play.js 里的 EYE 是同一个数
export const GAZE = { down: -.52, rate: Math.PI / 4 };   // 低头 30°：平视时最近只看得到 1.9 米外的地面，低头后是 0.6 米；rate：每秒最多转 45°
export function clownGaze(s) {
  const a = s.amusement, c = a?.clown, p = s.player;
  if (!a || a.zone !== TENT_ZONE || !c.entered || c.defeatedAt !== null || amusementCutscene(s) || a.fallUntil || a.trap) return null;
  if (s.time < a.launchUntil && p.jump > .04)
    return { kind: 'mask', pitch: Math.atan2(CLOWN.maskY - p.jump - EYE, Math.hypot(c.x - p.x, c.z - p.z)) };
  const ground = a.tiles.some(tile => tile.until > s.time) || a.fireworks.some(fire => !fire.spent);
  // 摘了面具以后烟花后面紧跟着塌地砖：中间那一秒多不抬头，一轮只低一次头。小丑被冻住时不算（那是抬头打它的时候）
  const between = !c.mask && c.round % 4 === 1 && c.frozenUntil <= s.time;
  return ground || between ? { kind: 'down', pitch: GAZE.down } : null;
}

export function skipAmusementCutscene(s) {
  const a = s.amusement;
  if (!a) return false;
  if (a.clownIntroUntil > s.time) {
    a.clownIntroUntil = 0;
    a.clown.next = s.time + 2.4;
    signal(s, 'clown-intro-end', CLOWN);
    return true;
  }
  if (a.victoryCutsceneUntil > s.time) {
    a.victoryCutsceneUntil = 0;
    return true;
  }
  return false;
}

// 从第 zone 站重来时人站在哪：上一道门里面一步；帐篷是门里的安全垫
export function checkpointPosition(zone) {
  if (zone === TENT_ZONE) return SAFE_PAD;
  const gate = GATES[zone - 1];
  return gate ? { x: gate.x + gate.tx * 1.3, z: gate.z + gate.tz * 1.3 } : null;
}

// 现在按互动键会发生什么：{ id, kind, zh, en }，没有可按的返回 null。设施的提示来自 park-rides.js，这里只多管两件事：
// 小丑倒下后的马达；木马那一站，蒸汽阀没冻住之前铃摇不动。
export function amusementPrompt(s) {
  const a = s.amusement, p = s.player;
  if (!a || s.phase !== 'playing' || amusementCutscene(s)) return null;
  if (a.clown.defeatedAt !== null && !a.pickedUp && dist(MOTOR.x, MOTOR.z, p) < 1.8) return { id: 'motor', kind: 'amusement', zh: '拾取高压马达', en: 'Collect motor' };
  const ask = parkPrompt(s);
  if (ask?.id === 'carousel' && a.zone === CAROUSEL_ZONE && !(a.valveLatched || a.valveUntil > s.time)) return null;
  return ask;
}

export function useAmusement(s) {
  const ask = amusementPrompt(s), a = s.amusement;
  if (!ask) return false;
  if (ask.id === 'motor') {
    a.pickedUp = true;
    a.lit[TENT_ZONE] = true;
    a.victoryCutsceneStarted = s.time;
    a.victoryCutsceneUntil = s.time + VICTORY_CUTSCENE_SECONDS;
    signal(s, 'motor', MOTOR);
    return true;
  }
  if (ask.id === 'carousel' && a.zone === CAROUSEL_ZONE) {   // 摇铃：木马转起来，气浪扫 8 秒；躲在后面的两只也出来
    a.carousel.until = s.time + SWEEP.seconds; a.carousel.used = true; a.carousel.struck.clear(); a.valveLatched = true;
    for (const e of s.enemies) if (e.zone === CAROUSEL_ZONE && e.alive) e.enabled = true;
    signal(s, 'spin', HORSES);
  }
  return parkInteract(s);
}

export function parkRemaining(s) {
  return s.enemies.filter(e => e.alive && e.zone === s.amusement.zone).length;
}

export function gatePassable(s, i) {
  const opened = s.amusement.opened[i];
  return opened !== null && s.time >= opened + GATE_LIFT_SECONDS;
}

// 这一站的事办完了没有（办完了门才开）
export function zoneReady(s) {
  const a = s.amusement, clear = parkRemaining(s) === 0;
  switch (PARK_ZONES[a.zone].id) {
    case 'entrance': return a.lock === 'open';
    case 'carousel': return a.carousel.used && clear;
    case 'rapids': return a.done.rapids;
    case 'coaster': return a.done.coaster && a.targets.every(t => t.lit) && clear;
    case 'haunt': return a.done.portraits;
    case 'wheel': return a.done.wheel;
    case 'midway': return a.done.stall;
    case 'bumpers': return a.done.bumpers;
    default: return true;   // 镜子迷宫：走出来就是帐篷门口
  }
}

// 坐过、玩过哪些设施：看 park-rides.js 的状态，下车的那一步记一笔
function watchRides(s) {
  const a = s.amusement, park = s.park;
  if (!park) return;
  const riding = park.riding?.id ?? null;
  if (a.riding && a.riding !== riding && a.riding in a.done) {
    a.done[a.riding] = true;
    if (a.riding === 'coaster' && a.zone === COASTER_ZONE) {   // 下了车，守在站台边的僵尸围上来；下车那一下不挨打
      for (const e of s.enemies) if (e.alive && e.zone === COASTER_ZONE) e.enabled = true;
      s.invul = Math.max(s.invul, 1.2);
    }
    signal(s, 'ride-done', { id: a.riding });
  }
  a.riding = riding;
  if (park.running.portraits > 0 && !a.done.portraits) { a.done.portraits = true; signal(s, 'ride-done', { id: 'portraits' }); }
  if (park.stall?.done && park.stall.score > 0 && !a.done.stall) { a.done.stall = true; signal(s, 'ride-done', { id: 'stall' }); }
}

function advanceGates(s) {
  const a = s.amusement, p = s.player, gate = GATES[a.zone];
  if (!gate) return;
  if (a.opened[a.zone] === null && zoneReady(s)) {
    a.opened[a.zone] = s.time;
    a.lit[a.zone] = true;
    signal(s, 'gate-open', { ...gate, zone: a.zone });
  }
  if (s.park?.riding) return;   // 坐在设施上：过山车会从门的上空飞过去，那不算过门
  const dx = p.x - gate.x, dz = p.z - gate.z, along = dx * gate.tx + dz * gate.tz, side = Math.abs(dz * gate.tx - dx * gate.tz);
  if (along < -GATE_STOP || along > 2.5 || side > gate.width / 2 + 1.5) return;
  if (!gatePassable(s, a.zone)) {
    p.x -= gate.tx * (along + GATE_STOP); p.z -= gate.tz * (along + GATE_STOP);
    return;
  }
  if (along < .25) return;
  a.zone++;
  for (const e of s.enemies) if (e.alive && e.zone === a.zone && !e.parkWave) e.enabled = true;
  signal(s, 'zone-enter', { zone: a.zone, x: p.x, z: p.z });
}

export function parkHoleAt(s, x, z) {
  return s.amusement?.tiles.some((tile, i) => tile.off && s.time >= tile.off && s.time < tile.until && !(tile.frozenUntil > s.time)
    && Math.abs(TILES[i].x - x) < TILE * .5 && Math.abs(TILES[i].z - z) < TILE * .5);
}

function tossBoxes(s) {
  const a = s.amusement, p = s.player;
  const points = [[clamp(p.x,-4.7,4.7), clamp(p.z,TENT_DOOR-6.85,TENT_DOOR-2.45)], [-2.55,TENT_DOOR-4.55], [2.55,TENT_DOOR-4.55]];
  const teachingBox = a.boxes.find(box=>box.teaching && !box.used);
  a.boxes = points.map(([x,z],i)=>({x,z,y:0,land:s.time+1.05+i*.19,thrown:s.time,used:false,settled:false}));
  if (teachingBox) a.boxes[0] = teachingBox;
  signal(s,'boxes',CLOWN);
}

function queueVolley(s) {
  const a = s.amusement;
  a.volleys = Array.from({length:3},(_,i)=>({at:s.time+.78+i*.42, group:i}));
  signal(s,'volley-warn',CLOWN);
}

function queueFireworks(s) {
  const p = s.player, a = s.amusement;
  a.fireworks = [[p.x,p.z],[-3.2,TENT_DOOR-3.55],[3.2,TENT_DOOR-3.55],[-3.5,TENT_DOOR-6.65],[3.5,TENT_DOOR-6.65]].map(([x,z],i)=>({
    x:clamp(x,-5.6,5.6), z:clamp(z,TENT_DOOR-8.55,TENT_DOOR-2.05), created:s.time, impact:s.time+1.55+i*.24, spent:false,
  }));
  signal(s,'fireworks',CLOWN);
}

function removeTiles(s) {
  const a = s.amusement;
  for (const [i,tile] of a.tiles.entries()) {
    if (tile.frozenUntil > s.time) continue;
    if ((i + (a.clown.round >> 2)) % 3 === 1 || TILES[i].z > TENT_DOOR-3.55 && Math.abs(TILES[i].x) < 1) continue;   // 门里正中那一块（安全垫前面）从不塌
    Object.assign(tile,{warn:s.time, off:s.time+1.55, until:s.time+3.75, frozenUntil:0});
  }
  signal(s,'trapdoors',CLOWN);
}

function scriptClown(s) {
  const a = s.amusement, c = a.clown;
  if (s.time < c.next || c.defeatedAt !== null) return;
  const pattern = c.mask ? [tossBoxes,queueVolley,tossBoxes] : [queueFireworks,removeTiles,queueVolley,tossBoxes];
  const attack = pattern[c.round % pattern.length];
  attack(s); c.round++;
  c.next = s.time + (attack === tossBoxes ? 5.4 : attack === removeTiles ? 4.4 : 4.05);
}

// 走路之前调。返回 true：这一步人不归自己管（过场、掉进暗坑、被惊喜盒扣住）。
export function moveAmusement(s, hurt) {
  const a = s.amusement, p = s.player;
  if (amusementCutscene(s)) {
    p.vx = p.vz = 0;
    return true;
  }
  if (a.fallUntil) {
    if (s.time >= a.fallUntil) {
      Object.assign(p,{...SAFE_PAD, jump:0, jumpV:0, vx:0, vz:0});
      a.fallUntil = 0;
      s.invul = 0; hurt(s,CLOWN,'park-fall',25);
      s.invul = Math.max(s.invul,1.2);
      signal(s,'return',p);
    }
    return true;
  }
  if (!a.trap) return false;
  const trap = a.trap;
  Object.assign(p,{x:trap.x, z:trap.z, vx:0, vz:0, jump:0, jumpV:0});
  if (s.time >= trap.until) {
    a.trap = null;
    hurt(s,CLOWN,'park-box',13);
    p.jumpV = 5.2;
    signal(s,'box-release',trap);
  }
  return true;
}

export function advanceAmusement(s, dt, {hurt, damage, volley}) {
  const a = s.amusement, p = s.player, c = a.clown;
  // 入口的门栓来回滑；冻住 3.5 秒以后化开
  if (a.lock === 'closed') a.lockPhase += dt * LOCK.speed;
  else if (a.lock === 'frozen' && s.time >= a.lockFrozenUntil) {
    a.lock = 'closed';
    signal(s,'lock-thaw',lockPosition(a));
  }
  // 过山车的轨道靶来回滑；冻住 3.5 秒没人补一发就化开
  for (const [i,t] of a.targets.entries()) {
    if (t.lit) continue;
    if (t.frozenUntil > s.time) continue;
    if (t.frozenUntil > 0 && s.time >= t.frozenUntil) { t.frozenUntil = 0; t.frozenX = null; }
    t.phase += dt * COASTER_TARGETS[i].speed;
  }
  if (amusementCutscene(s)) return;
  watchRides(s);
  advanceGates(s);

  // 木马转着的时候：一圈圈气浪从底座往外扫，扫到的僵尸挨一下往外推；冻着的直接碎
  if (a.zone === CAROUSEL_ZONE && s.time < a.carousel.until) {
    const age = s.time - (a.carousel.until - SWEEP.seconds), ring = SWEEP.from + (age * SWEEP.rate % 1) * (SWEEP.to - SWEEP.from);
    a.carousel.ring = ring;
    for (const e of s.enemies) {
      const d = dist(HORSES.x,HORSES.z,e);
      if (!e.alive || !e.enabled || e.zone !== CAROUSEL_ZONE || Math.abs(d - ring) > .55) continue;
      const ice = e.frozenUntil > s.time;
      if ((a.carousel.struck.get(e.id) || 0) > s.time) continue;
      a.carousel.struck.set(e.id, s.time + .65);
      if (ice) a.carousel.iceHits++;
      damage(s, e, ice ? e.hp : 2, (e.x - HORSES.x)/d, (e.z - HORSES.z)/d, ice ? 4.2 : 1.8, 'carousel', {weapon:'heavy'});
      signal(s, ice ? 'ice-sweep' : 'carousel-hit', {x:e.x, y:e.y + .5, z:e.z});
    }
  } else a.carousel.ring = 0;
  if (a.zone !== TENT_ZONE) return;
  if (!c.entered && p.z < TENT_DOOR - 1.15) {
    c.entered = true;
    for (const enemy of s.enemies) if (enemy.alive) enemy.enabled = false;
    p.x = clamp(p.x,-5.8,5.8);
    a.boxes = [{...FIRST_BOX, land:s.time, thrown:s.time, used:false, settled:true, teaching:true}];
    a.clownIntroStarted = s.time;
    a.clownIntroUntil = s.time + (a.retry ? 0 : CLOWN_INTRO_SECONDS);
    c.next = a.clownIntroUntil + 2.8;
    signal(s,'clown-start',CLOWN);
    return;
  }
  if (!c.entered || c.defeatedAt !== null) return;
  p.x = clamp(p.x,ARENA.minX,ARENA.maxX);
  p.z = clamp(p.z,ARENA.minZ,ARENA.maxZ);
  for (const box of a.boxes) {
    if (box.used || s.time < box.land) continue;
    if (!box.settled) {
      box.settled = true;
      if (!a.trap && !a.fallUntil && p.jump < .65 && dist(box.x,box.z,p) < .72) {
        box.used = true;
        a.trap = {x:box.x, z:box.z, until:s.time + .77};
        signal(s,'box-trap',box);
        continue;
      }
    }
    if (!a.trap && !a.fallUntil && p.jump < .24 && dist(box.x,box.z,p) < .53) {
      box.used = true;
      p.jump = .04; p.jumpV = 5.55;
      a.launchUntil = s.time + 1.4;
      signal(s,'spring',box);
    }
  }
  a.volleys = a.volleys.filter(group=>{
    if (s.time < group.at) return true;
    volley(s,group.group);
    return false;
  });
  for (const fire of a.fireworks) {
    if (fire.spent || s.time < fire.impact) continue;
    fire.spent = true;
    if (p.jump < 1.4 && dist(fire.x,fire.z,p) < 1.26) hurt(s,fire,'park-firework',19);
    signal(s,'firework-impact',fire);
  }
  if (!a.fallUntil && !a.trap && p.jump <= .045 && parkHoleAt(s,p.x,p.z)) {
    a.fallUntil = s.time + .52;
    p.vx = 0; p.vz = 0;
    signal(s,'fall',p);
  }
  if (c.frozenUntil > s.time) c.next += dt;
  else {
    c.poseTime += dt;
    if (!c.mask) c.x = Math.sin(c.poseTime * .9) * 1.15;
    scriptClown(s);
  }
}

const hitBounds = (id,x,y,z,w,h,d) => ({id,minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2});
const valveBox = hitBounds('valve',VALVE.x,VALVE.y,VALVE.z,1.02,.78,.42);
// 关着的门挡毛球：只有入口的拱门和帐篷的门帘（这两道是正东西向的；路上那几道斜着，毛球飞过去也打不到什么）
const portalBoxes = [0, GATES.length - 1].map(i=>({ gate:i, box:hitBounds('gate-'+i,GATES[i].x,.67,GATES[i].z,GATES[i].width,1.34,.25) }));
// 急冻枪打预警的地砖：打整块砖面或角上竖起来的布扣都算
const tileSurfaceBoxes = TILES.map((tile,i)=>hitBounds('tile-'+i,tile.x,.14,tile.z,TILE-.08,.34,TILE-.08));
const tileTabBoxes = TILES.map((tile,i)=>{ const p = tileSwitch(tile); return hitBounds('tile-'+i,p.x,p.y,p.z,.52,.55,.52); });

export function amusementTargets(s, freeze = false) {
  const a = s.amusement, c = a.clown;
  if (amusementCutscene(s)) return [];
  const targets = [];
  if (a.zone === TENT_ZONE) {
    if (!c.entered || c.defeatedAt !== null) return targets;
    const body = hitBounds('clown',c.x,1.23,c.z,2.08,2.36,1.22);
    const head = hitBounds('clown',c.x,CLOWN.maskY,c.z+.04,1.34,1.27,1.1);
    const mask = hitBounds('mask',c.x,CLOWN.maskY,c.z+.64,1.38,1.02,.33);
    targets.push(...(c.mask ? [mask,head,body] : [head,body]));
    if (freeze) {
      for (let i = 0; i < TILES.length; i++) {
        if (a.tiles[i].off > s.time && a.tiles[i].off > 0 && !(a.tiles[i].frozenUntil > s.time)) {
          targets.push(tileSurfaceBoxes[i], tileTabBoxes[i]);
        }
      }
    }
    return targets;
  }
  for (const { gate, box } of portalBoxes) if (gate === a.zone && !gatePassable(s,gate)) targets.push(box);
  if (a.zone === 0 && a.lock !== 'open') {
    const pos = lockPosition(a);
    targets.push(hitBounds('lock',pos.x,pos.y,pos.z,1.18,.95,.4));
  }
  if (a.zone === CAROUSEL_ZONE && !a.valveLatched) targets.push(valveBox);
  if (a.zone === COASTER_ZONE) {
    COASTER_TARGETS.forEach((_,i)=>{
      if (!a.targets[i].lit) {
        const pos = coasterTargetPosition(a,i);
        targets.push(hitBounds('coaster-target-'+i,pos.x,pos.y,pos.z,1.18,1.18,.5));
      }
    });
  }
  return targets;
}

export function amusementContact(s, b, end) {
  let first = null;
  for (const target of amusementTargets(s, b.weapon === 'freeze')) {
    const contact = segmentBox(b, end, target, b.r);
    if (contact && (!first || contact.t < first.t)) first = {...contact, box:target};
  }
  return first;
}

export function hitAmusement(s, b, target) {
  const a = s.amusement, c = a.clown, ice = b.weapon === 'freeze';
  if (target.id === 'lock') {
    const pos = lockPosition(a);
    if (ice && a.lock !== 'open') {
      a.lock = 'frozen';
      a.lockFrozenX = pos.x;
      a.lockFrozenUntil = s.time + 3.5;
      signal(s,'lock-frozen',pos);
    } else if (!ice && a.lock === 'frozen') {
      a.lock = 'open';
      signal(s,'lock-open',pos);
    } else if (!ice) signal(s,'lock-block',pos);
    return;
  }
  if (target.id === 'valve') {
    if (ice) { a.valveUntil = s.time + 5; signal(s,'valve-frozen',VALVE); }
    else signal(s,'valve-block',VALVE);
    return;
  }
  if (target.id.startsWith('coaster-target-')) {
    const i = Number(target.id.slice(15)), st = a.targets[i];
    const pos = coasterTargetPosition(a,i);
    if (st.lit) return;
    if (ice && !(st.frozenUntil > s.time)) {
      st.frozenX = pos.x;
      st.frozenUntil = s.time + 3.5;
      signal(s,'target-frozen',pos);
    } else {
      st.lit = true;
      st.frozenX = pos.x;
      signal(s,'target-lit',pos);
    }
    return;
  }
  if (target.id.startsWith('tile-')) {
    const i = Number(target.id.slice(5)), tile = a.tiles[i];
    if (ice && tile.off > s.time && !(tile.frozenUntil > s.time)) {
      tile.frozenUntil = s.time + 4;
      signal(s,'tile-frozen',{x:TILES[i].x, y:.25, z:TILES[i].z});
    }
    return;
  }
  if (target.id.startsWith('gate-') || b.fuse) return;
  if (ice) {
    if (c.resistUntil <= s.time) {
      c.frozenUntil = s.time + 2.5; c.resistUntil = c.frozenUntil + 5;
      signal(s,'clown-frozen',{x:c.x, y:CLOWN.maskY, z:c.z});
    } else if (c.frozenUntil <= s.time) signal(s,'clown-resist',{x:c.x, y:CLOWN.maskY, z:c.z});
    return;
  }
  if (c.mask) {
    if (target.id !== 'mask' || !b.springShot) { signal(s,'mask-block',b); return; }
    c.mask = Math.max(0, c.mask - (b.power >= .6 ? 2 : 1));
    a.maskHits++; s.hits++; c.flash = s.time + .23;
    signal(s, c.mask ? 'mask-hit' : 'mask-break', b);
    if (!c.mask) { c.round = 0; c.next = s.time + 2.8; a.volleys = []; }
    return;
  }
  c.hp = Math.max(0, c.hp - Math.max(1, b.damage) - (c.frozenUntil > s.time && b.weapon === 'single' ? 2 : 0));
  c.flash = s.time + .15; s.hits++;
  signal(s,'clown-hit',b);
  if (!c.hp) {
    c.defeatedAt = s.time;
    a.fireworks = []; a.volleys = []; a.boxes = []; a.trap = null; a.fallUntil = 0;
    for (const tile of a.tiles) tile.until = 0;
    signal(s,'clown-down',CLOWN);
  }
}
