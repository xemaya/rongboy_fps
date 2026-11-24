// 布偶游乐场（正式关卡）的规则：四段，一段打完才开下一段的门。画面在 amusement-view.js，这里不依赖 DOM。
// Simulation for the four-stage park:
// 0 Ticket Gate (oscillating latch + freeze/shatter intro)
// 1 Carousel Plaza (steam valve + ice-sweep carousel + drawbridge)
// 2 Coaster Flyover (elevated track across stitched river + track targets + enemies)
// 3 Big Top (Giggles intro cutscene + freeze/spring Boss fight + full-park victory cutscene)
import { segmentBox } from './level.js';

export const PARK_BOUNDS = { minX:-9.5, maxX:9.5, minZ:-19, maxZ:41 };
export const PARK_ZONES = [
  {id:'ticket', name:'售票口', en:'Ticket gate'},
  {id:'carousel', name:'旋转木马', en:'Carousel'},
  {id:'coaster', name:'过山车飞跃', en:'Coaster flyover'},
  {id:'tent', name:'马戏帐篷', en:'Big top'},
];
export const GATES = [
  {x:1.5, z:27.5, width:3.6},
  {x:0,   z:11.5, width:3.6},
  {x:0,   z:-5.45, width:3.6},
];
export const GATE_LIFT_SECONDS = .62;
export const LOCK = {x:0, y:1.32, z:31.8, amp:1.85, speed:2.7};
export const CAROUSEL = {x:-2.25, z:19.2, radius:2.45};
export const VALVE = {x:1.55, y:1.35, z:23.6};
export const SWITCH = {x:1.55, y:1.08, z:22.25};
export const RIVER = {minZ:0.4, maxZ:6.8};
export const PLATFORM = {x:0, z:9.4};
export const COASTER_SECONDS = 11.5;
export const COASTER_TARGETS = [
  {x:-4.0, y:2.25, z:2.0, amp:.9, speed:2.1},
  {x:4.0,  y:2.05, z:-0.4, amp:.9, speed:2.4},
];
export const BALLOONS = [
  {x:4.8, y:2.1, z:35.2, zone:0},
  {x:-5.6, y:2.1, z:21.5, zone:1},
  {x:-5.0, y:2.0, z:-2.4, zone:2},
];
export const TENT_DOOR = GATES[2].z;
// 大帐篷的外形：一个圆角的长方形（超椭圆 |x/a|^n + |z/b|^n = 1），门开在正南。布景和碰撞盒都照它摆。
export const TENT = { x:0, z:TENT_DOOR-5.95, a:7.6, b:5.95, n:5, wall:3.85 };
export const SAFE_PAD = {x:0, z:-6.85};
export const FIRST_BOX = {x:0, z:-9.35, y:0};
export const CLOWN = {x:0, z:-14.4, maskY:3.03, hp:46};
export const TILE = 2.35;
export const TILES = Array.from({length:15},(_,i)=>({
  x:(i%5-2)*TILE, z:-8.6-Math.floor(i/5)*TILE, index:i,
}));
export const tileSwitch = tile => ({x:tile.x+.68, y:.58, z:tile.z+.72});
export const CLOWN_INTRO_SECONDS = 3.8;
export const VICTORY_CUTSCENE_SECONDS = 4.0;

const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const dist = (x,z,p) => Math.hypot(x-p.x,z-p.z);
const signal = (s,action,extra={}) => s.events.push({type:'amusement',action,...extra});

// Smooth anti-motion-sickness coaster curve (gentle heading rate <= 45 deg/s, zero roll).
export function ridePose(t) {
  const a = clamp(t,0,1);
  // Smooth start/stop ease over first & last 12%
  const ease = a < .12 ? (a/.12)*(a/.12)*.12
    : a > .88 ? 1 - ((1-a)/.12)*((1-a)/.12)*.12
    : a;
  const x = 2.1 * Math.sin(ease * Math.PI * 1.5);
  const z = PLATFORM.z - 13.0 * ease;
  const y = .12 + 2.95 * Math.sin(Math.PI * ease) ** 1.35;
  const dx = 2.1 * Math.PI * 1.5 * Math.cos(ease * Math.PI * 1.5);
  const dz = -13.0;
  const yaw = Math.atan2(-dx, -dz);
  return { x, y, z, yaw };
}

export function lockPosition(a, time) {
  const x = a.lock === 'frozen' ? a.lockFrozenX : Math.sin(a.lockPhase) * LOCK.amp;
  return { x, y: LOCK.y, z: LOCK.z };
}

export function coasterTargetPosition(a, i) {
  const base = COASTER_TARGETS[i], st = a.targets[i];
  const x = st.lit || st.frozenUntil > 0 && st.frozenX !== null ? (st.frozenX ?? base.x) : base.x + Math.sin(st.phase) * base.amp;
  return { x, y: base.y, z: base.z };
}

export function makeAmusement(zone = 0) {
  return {
    zone,
    opened: GATES.map((_,i)=>i<zone ? -GATE_LIFT_SECONDS : null),
    lit: [zone>0, zone>1, zone>2, false],
    lock: zone>0 ? 'open' : 'closed',
    lockPhase: 0, lockFrozenUntil: 0, lockFrozenX: 0,
    valveUntil: 0, valveLatched: zone>1,
    carousel: {until:0, angle:0, used:zone>1, struck:new Map(), iceHits:0},
    ride: {started:null, progress:zone>2 ? 1 : 0, finished:zone>2},
    targets: COASTER_TARGETS.map((t,i)=>({lit:zone>2, phase:i*1.7, frozenUntil:0, frozenX:null})),
    balloons: BALLOONS.map(()=>true),
    pickedUp: false,
    clownIntroUntil: 0, clownIntroStarted: 0,
    victoryCutsceneUntil: 0, victoryCutsceneStarted: 0,
    clown: {hp:CLOWN.hp, mask:2, entered:false, defeatedAt:null, round:0, next:Infinity, flash:0, x:CLOWN.x, z:CLOWN.z, poseTime:0, frozenUntil:0, resistUntil:0},
    boxes: [], fireworks: [],
    tiles: TILES.map(()=>({warn:0, off:0, until:0, frozenUntil:0})),
    trap: null, fallUntil: 0, launchUntil: 0, volleys: [], maskHits: 0,
    retry: zone === 3,   // 从帐篷口重来的：登场那段看过了，不再演一遍
  };
}

export function amusementCutscene(s) {
  const a = s.amusement;
  if (!a) return null;
  if (a.clownIntroUntil > s.time) return { kind:'clown-intro', progress: clamp((s.time - a.clownIntroStarted) / CLOWN_INTRO_SECONDS, 0, 1) };
  if (a.victoryCutsceneUntil > s.time) return { kind:'victory', progress: clamp((s.time - a.victoryCutsceneStarted) / VICTORY_CUTSCENE_SECONDS, 0, 1) };
  return null;
}

export function skipAmusementCutscene(s) {
  const a = s.amusement;
  if (!a) return false;
  if (a.clownIntroUntil > s.time) {
    a.clownIntroUntil = 0;
    a.clown.next = s.time + 2.4;
    signal(s,'clown-intro-end',CLOWN);
    return true;
  }
  if (a.victoryCutsceneUntil > s.time) {
    a.victoryCutsceneUntil = 0;
    return true;
  }
  return false;
}

export function checkpointPosition(zone) {
  if (zone === 3) return SAFE_PAD;
  if (zone === 2) return {x:GATES[1].x, z:GATES[1].z - 1.1};
  if (zone === 1) return {x:GATES[0].x, z:GATES[0].z - 1.3};
  return null;
}

export function amusementPrompt(s) {
  const a = s.amusement, p = s.player;
  if (!a || s.phase !== 'playing' || amusementCutscene(s)) return null;
  if (a.zone === 1 && (a.valveLatched || a.valveUntil > s.time) && dist(SWITCH.x,SWITCH.z,p) < 2.1 && s.time >= a.carousel.until) return 'spin';
  if (a.zone === 2 && !a.ride.finished && a.ride.started === null && dist(PLATFORM.x,PLATFORM.z,p) < 2.6) return 'board';
  if (a.clown.defeatedAt !== null && !a.pickedUp && dist(CLOWN.x,-12.1,p) < 1.8) return 'motor';
  return null;
}

export function useAmusement(s) {
  const prompt = amusementPrompt(s), a = s.amusement;
  if (prompt === 'spin') {
    a.carousel.until = s.time + 8; a.carousel.used = true; a.carousel.struck.clear(); a.valveLatched = true;
    for (const e of s.enemies) if (e.zone === 1 && e.alive) e.enabled = true;
    signal(s,'spin',SWITCH);
    return true;
  }
  if (prompt === 'board') {
    a.ride.started = s.time;
    signal(s,'ride-start',PLATFORM);
    return true;
  }
  if (prompt === 'motor') {
    a.pickedUp = true;
    a.lit[3] = true;
    a.victoryCutsceneStarted = s.time;
    a.victoryCutsceneUntil = s.time + VICTORY_CUTSCENE_SECONDS;
    signal(s,'motor',{x:CLOWN.x,y:.66,z:-12.1});
    return true;
  }
  return false;
}

export function parkRemaining(s) {
  return s.enemies.filter(e=>e.alive && e.zone === s.amusement.zone).length;
}

export function gatePassable(s,i) {
  const opened = s.amusement.opened[i];
  return opened !== null && s.time >= opened + GATE_LIFT_SECONDS;
}

function advanceGates(s) {
  const a = s.amusement, p = s.player, gate = GATES[a.zone];
  if (!gate) return;
  const ready = a.zone === 0 ? a.lock === 'open'
    : a.zone === 1 ? a.carousel.used
    : a.ride.finished && a.targets.every(t=>t.lit);
  if (ready && a.opened[a.zone] === null && parkRemaining(s) === 0) {
    a.opened[a.zone] = s.time;
    a.lit[a.zone] = true;
    signal(s,'gate-open',{...gate, zone:a.zone});
  }
  // Zone 2 stitched river channel blocks walking south->north until coaster completes
  if (a.zone === 2 && !a.ride.finished && a.ride.started === null && p.z < RIVER.maxZ + .35) {
    p.z = RIVER.maxZ + .35; p.vz = Math.max(0, p.vz);
  }
  if (a.zone === 2 && a.ride.finished && p.z > RIVER.minZ - .35) {
    p.z = RIVER.minZ - .35; p.vz = Math.min(0, p.vz);
  }
  if (p.z >= gate.z + .30) return;
  if (!gatePassable(s,a.zone) || Math.abs(p.x - gate.x) > gate.width/2 - .3) {
    p.z = gate.z + .30; p.vz = Math.max(0, p.vz);
    return;
  }
  if (p.z > gate.z - .24) return;
  a.zone++;
  if (a.zone === 1) for (const e of s.enemies) if (e.alive && e.zone === 1 && !e.parkWave) e.enabled = true;
  signal(s,'zone-enter',{zone:a.zone, x:p.x, z:p.z});
}

export function parkHoleAt(s,x,z) {
  return s.amusement?.tiles.some((tile,i)=>tile.off && s.time >= tile.off && s.time < tile.until && !(tile.frozenUntil > s.time)
    && Math.abs(TILES[i].x - x) < TILE * .5 && Math.abs(TILES[i].z - z) < TILE * .5);
}

function tossBoxes(s) {
  const a = s.amusement, p = s.player;
  const points = [[clamp(p.x,-4.7,4.7), clamp(p.z,-12.3,-7.9)], [-2.55,-10.0], [2.55,-10.0]];
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
  a.fireworks = [[p.x,p.z],[-3.2,-9],[3.2,-9],[-3.5,-12.1],[3.5,-12.1]].map(([x,z],i)=>({
    x:clamp(x,-5.6,5.6), z:clamp(z,-14,-7.5), created:s.time, impact:s.time+1.55+i*.24, spent:false,
  }));
  signal(s,'fireworks',CLOWN);
}

function removeTiles(s) {
  const a = s.amusement;
  for (const [i,tile] of a.tiles.entries()) {
    if (tile.frozenUntil > s.time) continue;
    if ((i + (a.clown.round >> 2)) % 3 === 1 || TILES[i].z > -9 && Math.abs(TILES[i].x) < 1) continue;
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

// Called before normal walking. True means horizontal position is controlled by a ride, cutscene, or hazard.
export function moveAmusement(s, hurt) {
  const a = s.amusement, p = s.player, ride = a.ride;
  if (amusementCutscene(s)) {
    p.vx = p.vz = 0;
    return true;
  }
  if (ride.started !== null && !ride.finished) {
    ride.progress = clamp((s.time - ride.started) / COASTER_SECONDS, 0, 1);
    if (ride.progress >= .42) for (const e of s.enemies) if (e.zone === 2 && e.alive) e.enabled = true;
    const at = ridePose(ride.progress);
    Object.assign(p,{x:at.x, z:at.z, y:0, jump:at.y + .34, jumpV:0, vx:0, vz:0});
    if (ride.progress < 1) return true;
    ride.finished = true;
    Object.assign(p,{x:0, z:-3.8, jump:0, vx:0, vz:0});
    s.invul = Math.max(s.invul, 1.2);   // 下车那一下不挨打：对岸的僵尸可能已经等在车挡旁边
    signal(s,'ride-end',p);
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
  // Advance oscillating gate latch in zone 0 (thaws cleanly after 3.5s)
  if (a.lock === 'closed') a.lockPhase += dt * LOCK.speed;
  else if (a.lock === 'frozen' && s.time >= a.lockFrozenUntil) {
    a.lock = 'closed';
    signal(s,'lock-thaw',lockPosition(a,s.time));
  }
  // Advance coaster targets in zone 2 (thaw after 3.5s if not hit)
  for (const [i,t] of a.targets.entries()) {
    if (t.lit) continue;
    if (t.frozenUntil > s.time) continue;
    if (t.frozenUntil > 0 && s.time >= t.frozenUntil) { t.frozenUntil = 0; t.frozenX = null; }
    t.phase += dt * COASTER_TARGETS[i].speed;
  }
  if (amusementCutscene(s)) return;
  advanceGates(s);

  // Carousel sweeping (fixed: per-enemy cooldown + frozen enemies always trigger instant ice-sweep!)
  if (a.zone === 1 && s.time < a.carousel.until) {
    a.carousel.angle += dt * 3.5;
    for (const e of s.enemies) {
      const d = dist(CAROUSEL.x,CAROUSEL.z,e);
      if (!e.alive || !e.enabled || e.zone !== 1 || d > CAROUSEL.radius + .62 || d < .45) continue;
      const ice = e.frozenUntil > s.time;
      const nextHitAt = a.carousel.struck.get(e.id) || 0;
      if (!ice && nextHitAt > s.time) continue;
      const heading = Math.atan2(e.x - CAROUSEL.x, e.z - CAROUSEL.z) - a.carousel.angle;
      if (Math.cos(heading * 4) < .92) continue;
      a.carousel.struck.set(e.id, s.time + .65);
      if (ice) a.carousel.iceHits++;
      damage(s, e, ice ? e.hp : 2, (e.x - CAROUSEL.x)/d, (e.z - CAROUSEL.z)/d, ice ? 4.2 : 1.8, 'carousel', {weapon:'heavy'});
      signal(s, ice ? 'ice-sweep' : 'carousel-hit', {x:e.x, y:e.y + .5, z:e.z});
    }
  }
  if (a.zone !== 3) return;
  if (!c.entered && p.z < -6.6) {
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
  p.x = clamp(p.x,-5.82,5.82);
  p.z = clamp(p.z,-13.2,-6.63);
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
const portalBoxes = GATES.map((gate,i)=>hitBounds('gate-'+i,gate.x,.67,gate.z,gate.width,1.34,.25));
// Fixed: freeze shots can hit EITHER the full glowing 2.35x2.35 warning tile top surface OR its raised corner crystal!
const tileSurfaceBoxes = TILES.map((tile,i)=>hitBounds('tile-'+i,tile.x,.14,tile.z,TILE-.08,.34,TILE-.08));
const tileTabBoxes = TILES.map((tile,i)=>{ const p = tileSwitch(tile); return hitBounds('tile-'+i,p.x,p.y,p.z,.52,.55,.52); });

export function amusementTargets(s, freeze = false) {
  const a = s.amusement, c = a.clown;
  if (amusementCutscene(s)) return [];
  const targets = [];
  // Poppable roadside balloons in current zone
  BALLOONS.forEach((b,i)=>{
    if (a.balloons[i] && b.zone === a.zone) targets.push(hitBounds('balloon-'+i,b.x,b.y,b.z,.95,.95,.95));
  });
  if (a.zone === 3) {
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
  if (!gatePassable(s,a.zone)) targets.push(portalBoxes[a.zone]);
  if (a.zone === 0 && a.lock !== 'open') {
    const pos = lockPosition(a,s.time);
    targets.push(hitBounds('lock',pos.x,pos.y,pos.z,1.18,.95,.4));
  }
  if (a.zone === 1 && !a.valveLatched) targets.push(valveBox);
  if (a.zone === 2) {
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
  if (target.id.startsWith('balloon-')) {
    const i = Number(target.id.slice(8));
    if (a.balloons[i]) {
      a.balloons[i] = false;
      signal(s,'balloon-pop',BALLOONS[i]);
    }
    return;
  }
  if (target.id === 'lock') {
    const pos = lockPosition(a,s.time);
    if (ice && a.lock !== 'open') {
      a.lock = 'frozen';
      a.lockFrozenX = pos.x;
      a.lockFrozenUntil = s.time + 3.5;
      signal(s,'lock-frozen',pos);
    } else if (!ice && a.lock === 'frozen') {
      a.lock = 'open';
      for (const e of s.enemies) if (e.alive && e.zone === 0) e.enabled = true;
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
