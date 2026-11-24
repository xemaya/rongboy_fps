// The amusement sample keeps ride motion, hazards and damage on the simulation clock.
import { segmentBox } from './level.js';

export const PARK_BOUNDS = {minX:-17,maxX:17,minZ:-19,maxZ:54};
export const PARK_ZONES = [
  {id:'ticket',name:'售票广场'},
  {id:'ride',name:'过山车区'},
  {id:'carousel',name:'木马广场'},
  {id:'midway',name:'游戏摊街'},
  {id:'backstage',name:'后台仓库'},
  {id:'tent',name:'马戏帐篷'},
];
export const GATES = [
  {x:-3.9,z:44,width:3.6},
  {x:3.15,z:25.35,width:3.6},
  {x:-3.25,z:14.6,width:3.6},
  {x:4.2,z:4.4,width:3.6},
  {x:0,z:-5.45,width:3.6},
];
export const GATE_LIFT_SECONDS = .62;
export const COASTER_SECONDS = 12.5;
export const PLATFORM = {x:0,z:40.65};
export const CAROUSEL = {x:-4.25,z:19.8,radius:2.45};
export const SWITCH = {x:-1.45,z:21.65,y:1.0};
export const MIDWAY_TARGETS = [
  {x:-6.3,z:11.55,y:1.52},
  {x:6.3,z:8.5,y:1.52},
];
export const LEVER = {x:-4.95,z:-.4,y:1.05};
export const TENT_DOOR = GATES.at(-1).z;
export const SAFE_PAD = {x:0,z:-7};
export const CLOWN = {x:0,z:-14.4,maskY:3.03,hp:46};
export const TILE = 2.35;
export const TILES = Array.from({length:15},(_,i)=>({
  x:(i%5-2)*TILE, z:-8.6-Math.floor(i/5)*TILE, index:i,
}));

const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const dist = (x,z,p) => Math.hypot(x-p.x,z-p.z);
const signal = (s,action,extra={}) => s.events.push({type:'amusement',action,...extra});

export function ridePose(t) {
  const a = clamp(t,0,1);
  const x = 2.2 * Math.sin(a*2*Math.PI), z = PLATFORM.z - 13.05*a;
  const y = .10 + 2.65 * Math.sin(Math.PI*a)**1.4;
  const yaw = Math.atan2(-2.2*2*Math.PI*Math.cos(a*2*Math.PI),13.05);
  return { x,y,z,yaw };
}

export function makeAmusement(zone = 0) {
  return {
    zone, opened:GATES.map((_,i)=>i<zone?-GATE_LIFT_SECONDS:0),
    targets:MIDWAY_TARGETS.map(()=>zone>3), lever:zone>4,
    ride:{started:null,progress:zone>1?1:0,finished:zone>1},
    carousel:{until:0,angle:0,used:zone>2,struck:new Set(),hits:0},
    clown:{hp:CLOWN.hp,mask:2,entered:false,defeatedAt:null,round:0,next:Infinity,flash:0,x:CLOWN.x,z:CLOWN.z},
    boxes:[], fireworks:[], tiles:TILES.map(()=>({warn:0,off:0,until:0})),
    trap:null,fallUntil:0,launchUntil:0,volleys:[],maskHits:0,
  };
}

export function amusementPrompt(s) {
  const a=s.park,p=s.player;
  if (!a || s.phase!=='playing' || a.fallUntil || a.trap || a.clown.entered) return null;
  if (a.zone===1 && !a.ride.finished && a.ride.started===null && dist(PLATFORM.x,PLATFORM.z,p)<2.6) return 'board';
  if (a.zone===2 && dist(SWITCH.x,SWITCH.z,p)<2.4 && s.time>=a.carousel.until) return 'spin';
  if (a.zone===4 && !a.lever && dist(LEVER.x,LEVER.z,p)<1.85) return 'lever';
  return null;
}

function spin(s) {
  const c=s.park.carousel;
  if (s.park.zone!==2 || s.time<c.until) return false;
  c.until=s.time+6.2; c.used=true; c.struck.clear();
  signal(s,'spin',CAROUSEL);
  return true;
}

export function useAmusement(s) {
  const prompt=amusementPrompt(s);
  if (prompt==='spin') return spin(s);
  if (prompt==='lever') { s.park.lever=true; signal(s,'lever',LEVER); return true; }
  if (prompt!=='board') return false;
  s.park.ride.started=s.time;
  signal(s,'ride-start',PLATFORM);
  return true;
}

export function parkRemaining(s) {
  return s.enemies.reduce((n,e)=>n+Number(e.alive && e.zone===s.park.zone),0);
}

function gatePassable(s,index) {
  const opened=s.park.opened[index];
  return !!opened && s.time>=opened+GATE_LIFT_SECONDS;
}

function advanceGates(s) {
  const a=s.park,p=s.player,gate=GATES[a.zone];
  if (!gate) return;
  const requirement=[true,a.ride.finished,a.carousel.used,a.targets.every(Boolean),a.lever][a.zone];
  if (!a.opened[a.zone] && requirement && parkRemaining(s)===0) {
    a.opened[a.zone]=s.time;
    signal(s,'gate-open',gate);
  }
  if (a.zone===1 && a.ride.started===null) p.z=Math.max(p.z,PLATFORM.z-1.58);
  if (p.z>=gate.z+.29) return;
  if (!gatePassable(s,a.zone) || Math.abs(p.x-gate.x)>gate.width/2-.33) {
    p.z=gate.z+.29;
    p.vz=Math.max(0,p.vz);
    return;
  }
  if (p.z>gate.z-.23) return;
  a.zone++;
  for (const e of s.enemies) if (e.zone===a.zone && e.alive) e.enabled=true;
  signal(s,'zone-enter',{zone:a.zone,x:p.x,z:p.z});
}

export function parkHoleAt(s,x,z) {
  return s.park?.tiles.some((tile,i)=>tile.off && s.time>=tile.off && s.time<tile.until
    && Math.abs(TILES[i].x-x)<TILE*.5 && Math.abs(TILES[i].z-z)<TILE*.5);
}

function tossBoxes(s,opening) {
  const a=s.park,p=s.player;
  const points=opening ? [[0,-10.3],[-2.9,-9.7],[2.9,-9.7]]
    : [[clamp(p.x,-4.7,4.7),clamp(p.z,-12.3,-7.9)],[-2.55,-10.0],[2.55,-10.0]];
  a.boxes=points.map(([x,z],i)=>({x,z,y:0,land:s.time+1.05+i*.19,thrown:s.time,used:false,settled:false}));
  signal(s,'boxes',CLOWN);
}

function queueVolley(s) {
  const a=s.park;
  a.volleys=Array.from({length:3},(_,i)=>({at:s.time+.78+i*.42,group:i}));
  signal(s,'volley-warn',CLOWN);
}

function queueFireworks(s) {
  const p=s.player, a=s.park;
  a.fireworks=[[p.x,p.z],[-3.2,-9],[3.2,-9],[-3.5,-12.1],[3.5,-12.1]].map(([x,z],i)=>({
    x:clamp(x,-5.6,5.6),z:clamp(z,-14,-7.5),created:s.time,impact:s.time+1.55+i*.24,spent:false,
  }));
  signal(s,'fireworks',CLOWN);
}

function removeTiles(s) {
  const a=s.park;
  for (const [i,tile] of a.tiles.entries()) {
    if ((i+(a.clown.round>>2))%3===1 || TILES[i].z>-9 && Math.abs(TILES[i].x)<1) continue;
    Object.assign(tile,{warn:s.time,off:s.time+1.35,until:s.time+3.55});
  }
  signal(s,'trapdoors',CLOWN);
}

function scriptClown(s) {
  const a=s.park,c=a.clown;
  if (s.time<c.next || c.defeatedAt!==null) return;
  const pattern=c.mask?[tossBoxes,queueVolley,tossBoxes]:[queueFireworks,removeTiles,queueVolley,tossBoxes];
  const attack=pattern[c.round%pattern.length];
  attack(s,false); c.round++;
  c.next=s.time+(attack===tossBoxes?5.4:attack===removeTiles?4.2:4.05);
}

// Called before normal walking. True means this tick's horizontal position is controlled by a ride or hazard.
export function moveAmusement(s, hurt) {
  const a=s.park,p=s.player,ride=a.ride;
  if (ride.started!==null && !ride.finished) {
    ride.progress=clamp((s.time-ride.started)/COASTER_SECONDS,0,1);
    const at=ridePose(ride.progress);
    Object.assign(p,{x:at.x,z:at.z,y:0,jump:at.y+.32,jumpV:0,vx:0,vz:0});
    if (ride.progress<1) return true;
    ride.finished=true;
    Object.assign(p,{x:at.x+.95,z:at.z-.48,jump:0,vx:0,vz:0});
    signal(s,'ride-end',p);
    return true;
  }
  if (a.fallUntil) {
    if (s.time>=a.fallUntil) {
      Object.assign(p,{...SAFE_PAD,jump:0,jumpV:0,vx:0,vz:0});
      a.fallUntil=0;
      s.invul=0; hurt(s,CLOWN,'park-fall',25);
      s.invul=Math.max(s.invul,1.2);
      signal(s,'return',p);
    }
    return true;
  }
  if (!a.trap) return false;
  const trap=a.trap;
  Object.assign(p,{x:trap.x,z:trap.z,vx:0,vz:0,jump:0,jumpV:0});
  if (s.time>=trap.until) {
    a.trap=null;
    hurt(s,CLOWN,'park-box',13);
    p.jumpV=5.2;
    signal(s,'box-release',trap);
  }
  return true;
}

export function advanceAmusement(s,dt,{hurt,damage,volley}) {
  const a=s.park,p=s.player,c=a.clown;
  advanceGates(s);
  if (a.zone===2 && s.time<a.carousel.until) {
    a.carousel.angle+=dt*3.5;
    for (const e of s.enemies) {
      const d=dist(CAROUSEL.x,CAROUSEL.z,e);
      if (!e.alive || !e.enabled || a.carousel.struck.has(e.id) || d>CAROUSEL.radius+.38 || d<.45) continue;
      const heading=Math.atan2(e.x-CAROUSEL.x,e.z-CAROUSEL.z)-a.carousel.angle;
      const blade=Math.cos(heading*4);
      if (blade<.93) continue;
      a.carousel.struck.add(e.id); a.carousel.hits++;
      damage(s,e,10,(e.x-CAROUSEL.x)/d,(e.z-CAROUSEL.z)/d,6.2,'carousel',{weapon:'heavy'});
      signal(s,'carousel-hit',e);
    }
  }
  if (a.zone!==5) return;
  if (!c.entered && p.z<-6.6) {
    c.entered=true;
    for (const enemy of s.enemies) if (enemy.alive) enemy.enabled=false;
    p.x=clamp(p.x,-5.8,5.8);
    tossBoxes(s,true);
    c.next=s.time+5.5;
    c.round=1;
    signal(s,'clown-start',CLOWN);
  }
  if (!c.entered || c.defeatedAt!==null) return;
  p.x=clamp(p.x,-5.82,5.82);
  p.z=clamp(p.z,-13.2,-6.63);
  for (const box of a.boxes) {
    if (box.used || s.time<box.land) continue;
    if (!box.settled) {
      box.settled=true;
      if (!a.trap && !a.fallUntil && p.jump<.65 && dist(box.x,box.z,p)<.72) {
        box.used=true;
        a.trap={x:box.x,z:box.z,until:s.time+.77};
        signal(s,'box-trap',box);
        continue;
      }
    }
    if (!a.trap && !a.fallUntil && p.jump<.24 && dist(box.x,box.z,p)<.53) {
      box.used=true;
      p.jump=.04; p.jumpV=5.55;
      a.launchUntil=s.time+1.4;
      signal(s,'spring',box);
    }
  }
  a.volleys=a.volleys.filter(group=>{
    if (s.time<group.at) return true;
    volley(s,group.group);
    return false;
  });
  for (const fire of a.fireworks) {
    if (fire.spent || s.time<fire.impact) continue;
    fire.spent=true;
    if (p.jump<1.4 && dist(fire.x,fire.z,p)<1.26) hurt(s,fire,'park-firework',19);
    signal(s,'firework-impact',fire);
  }
  if (!a.fallUntil && !a.trap && p.jump<=.045 && parkHoleAt(s,p.x,p.z)) {
    a.fallUntil=s.time+.52;
    p.vx=0;p.vz=0;
    signal(s,'fall',p);
  }
  scriptClown(s);
}

const hitBounds = (id,x,y,z,w,h,d) => ({id,minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2});

const portalBoxes=GATES.map((gate,i)=>hitBounds('gate-'+i,gate.x,1.37,gate.z,gate.width,2.74,.25));
const switchHit=hitBounds('switch',SWITCH.x,SWITCH.y,SWITCH.z,.55,.62,.46);
const leverHit=hitBounds('lever',LEVER.x,LEVER.y,LEVER.z,.55,.70,.55);
const midwayBoxes=MIDWAY_TARGETS.map((point,i)=>hitBounds('target-'+i,point.x,point.y,point.z,.83,.83,.34));
const clownBody=[
  hitBounds('clown',CLOWN.x,CLOWN.maskY,CLOWN.z+.02,1.28,1.28,1.1),
  hitBounds('clown',CLOWN.x,1.2,CLOWN.z,2.18,2.35,1.38),
];
const clownMasked=[hitBounds('mask',CLOWN.x,CLOWN.maskY,CLOWN.z+.64,1.3,.96,.32),...clownBody];
const noTargets=[];

export function amusementTargets(s) {
  const a=s.park,c=a.clown;
  if (a.zone===5) return c.entered && c.defeatedAt===null ? c.mask ? clownMasked : clownBody : noTargets;
  const targets=gatePassable(s,a.zone)?[]:[portalBoxes[a.zone]];
  if (a.zone===2) targets.push(switchHit);
  if (a.zone===3) for (const [i,hit] of midwayBoxes.entries()) if (!a.targets[i]) targets.push(hit);
  if (a.zone===4 && !a.lever) targets.push(leverHit);
  return targets;
}

export function amusementContact(s,b,end) {
  let first=null;
  for (const target of amusementTargets(s)) {
    const contact=segmentBox(b,end,target,b.r);
    if (contact && (!first || contact.t<first.t)) first={...contact,box:target};
  }
  return first;
}

export function hitAmusement(s,b,target) {
  const a=s.park,c=a.clown;
  if (target.id==='switch') { spin(s); return; }
  if (target.id==='lever') { a.lever=true; signal(s,'lever',LEVER); return; }
  if (target.id.startsWith('target-')) {
    const index=Number(target.id.slice(-1));
    a.targets[index]=true;
    signal(s,'booth-target',MIDWAY_TARGETS[index]);
    return;
  }
  if (target.id.startsWith('gate-') || b.fuse) return;
  if (c.mask) {
    if (target.id!=='mask' || !b.springShot) { signal(s,'mask-block',b); return; }
    c.mask=Math.max(0,c.mask-(b.power>=.6?2:1));
    a.maskHits++;
    s.hits++;
    c.flash=s.time+.23;
    signal(s,c.mask?'mask-hit':'mask-break',b);
    if (!c.mask) { c.round=0; c.next=s.time+2.3; a.volleys=[]; }
    return;
  }
  c.hp=Math.max(0,c.hp-Math.max(1,b.damage));
  c.flash=s.time+.15;
  s.hits++;
  signal(s,'clown-hit',b);
  if (!c.hp) {
    c.defeatedAt=s.time;
    a.fireworks=[]; a.volleys=[]; a.boxes=[]; a.trap=null; a.fallUntil=0;
    for (const tile of a.tiles) tile.until=0;
    signal(s,'clown-down',CLOWN);
  }
}
