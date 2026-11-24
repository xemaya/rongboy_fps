// 游乐园的小径：从入口绕外圈一圈、穿过镜子迷宫到帐篷门口，十站都路过；草地抄不了近路。
// 从镜子迷宫那一站开局（前面的门都开着）、拿掉迷宫里埋伏的僵尸，再站回入口，只看路本身；门和机关在 rongboy-amusement.mjs。
import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/amusement.js';
import house from '../../scenes/rongboy-mission/levels/house.js';
import { compileLevel, freePoint } from '../../scenes/rongboy-mission/level.js';
import { createGame, step } from '../../scenes/rongboy-mission/game.js';
import { PARK_ZONES, TENT_ZONE, TENT_DOOR, amusementCutscene } from '../../scenes/rongboy-mission/amusement.js';
import { TOUR_PATH, TOUR_STOPS, TOUR_BRIDGE, TOUR_MAZE, nearbyTourStop } from '../../scenes/rongboy-mission/park-tour-layout.js';

const L=compileLevel(def), open=()=>{ const s=createGame({level:L,amusementCheckpoint:PARK_ZONES.findIndex(zone=>zone.id==='mirrors')}); s.enemies=[]; Object.assign(s.player,{x:L.player.x,z:L.player.z}); return s; };
const s=open(), p=s.player, distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
assert.ok(house.enemies.length>0,'the house keeps its combat roster');
const routeLength=TOUR_PATH.slice(1).reduce((n,q,i)=>n+distance(q,TOUR_PATH[i]),0);
assert.ok(routeLength>160);
const visited=new Set();
for(const point of TOUR_PATH){
  assert.ok(freePoint(L,point.x,point.z,.31),`Physical collision at ${point.x.toFixed(1)}, ${point.z.toFixed(1)}`);
  if(point.z<TENT_DOOR+.4&&Math.abs(point.x)<3&&visited.has('mirrors')) break;   // 帐篷门里是小丑的场地：走进去他就登场了（见下面）
  for(let j=0;distance(p,point)>.061;j++){
    assert.ok(j<100,`Walking got stuck before ${point.x.toFixed(2)}, ${point.z.toFixed(2)}`);
    const d=distance(p,point);
    step(s,1/120,{x:(point.x-p.x)/d,z:(point.z-p.z)/d});
  }
  const stop=nearbyTourStop(p.x,p.z);
  if(stop)visited.add(stop.id);
}
assert.deepEqual([...visited],TOUR_STOPS.map(stop=>stop.id));
assert.equal(s.phase,'playing');
for(let tick=0;tick<120*3;tick++) step(s,1/120,{z:-1});
assert.equal(s.amusement.zone,TENT_ZONE); assert.ok(s.amusement.clown.entered&&amusementCutscene(s)?.kind==='clown-intro','walking in through the tent door brings the clown on');
console.log(`PASS walkable ${Math.round(routeLength)} m spiral connects all ten attractions, the bridge and the tent door`);

const bridge=TOUR_PATH.find(q=>Math.abs(q.z-TOUR_BRIDGE.z)<.5 && Math.abs(q.x-TOUR_BRIDGE.x)<1);
assert.ok(bridge);
const reset=open();
for(let tick=0;tick<120*12;tick++){
  const p=reset.player,d=Math.hypot(p.x,p.z);
  step(reset,1/120,{x:-p.x/d,z:-p.z/d});
}
assert.ok(Math.hypot(reset.player.x,reset.player.z)>16,'the orchard blocks a direct shortcut from the plaza');
const baffle=TOUR_MAZE[6];
assert.ok(!freePoint(L,baffle.x,baffle.z,.30),'the mirror maze dividers have body collision');
console.log('PASS no shortcut through the orchard, and physical mirrors');
