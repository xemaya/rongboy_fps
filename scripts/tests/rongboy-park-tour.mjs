import assert from 'node:assert/strict';
import def from '../../scenes/rongboy-mission/levels/amusement-tour.js';
import battle from '../../scenes/rongboy-mission/levels/amusement.js';
import { compileLevel, freePoint } from '../../scenes/rongboy-mission/level.js';
import { createGame, fire, missionStatus, step } from '../../scenes/rongboy-mission/game.js';
import { TOUR_PATH, TOUR_STOPS, TOUR_BRIDGE, TOUR_MAZE, nearbyTourStop } from '../../scenes/rongboy-mission/park-tour-layout.js';

const L=compileLevel(def), s=createGame({level:L});
const p=s.player, distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
assert.equal(s.enemies.length,0);
assert.equal(s.owned.some(Boolean),false);
assert.equal(fire(s),false);
assert.ok(battle.enemies.length>0,'the battle sample stays independently accessible');
const routeLength=TOUR_PATH.slice(1).reduce((n,q,i)=>n+distance(q,TOUR_PATH[i]),0);
assert.ok(routeLength>160);
const visited=new Set();
for(const point of TOUR_PATH){
  assert.ok(freePoint(L,point.x,point.z,.31),`Physical collision at ${point.x.toFixed(1)}, ${point.z.toFixed(1)}`);
  for(let j=0;distance(p,point)>.061;j++){
    assert.ok(j<100,`Walking got stuck before ${point.x.toFixed(2)}, ${point.z.toFixed(2)}`);
    const d=distance(p,point);
    step(s,1/120,{x:(point.x-p.x)/d,z:(point.z-p.z)/d});
  }
  const stop=nearbyTourStop(p.x,p.z);
  if(stop)visited.add(stop.id);
}
assert.deepEqual([...visited],TOUR_STOPS.map(stop=>stop.id));
assert.ok(Math.hypot(p.x,p.z)<4,'the path finishes inside the tent');
assert.equal(s.phase,'playing');
assert.equal(missionStatus(s).done,false,'walking inside the tent keeps the free tour open');
console.log(`PASS walkable ${Math.round(routeLength)} m spiral connects all ten attractions, the bridge and the tent`);

const bridge=TOUR_PATH.find(q=>Math.abs(q.z-TOUR_BRIDGE.z)<.5 && Math.abs(q.x-TOUR_BRIDGE.x)<1);
assert.ok(bridge);
const reset=createGame({level:L});
for(let tick=0;tick<120*12;tick++){
  const p=reset.player,d=Math.hypot(p.x,p.z);
  step(reset,1/120,{x:-p.x/d,z:-p.z/d});
}
assert.ok(Math.hypot(reset.player.x,reset.player.z)>16,'the orchard blocks a direct shortcut from the plaza');
const baffle=TOUR_MAZE[6];
assert.ok(!freePoint(L,baffle.x,baffle.z,.30),'the mirror maze dividers have body collision');
console.log('PASS no shortcut through the orchard, no gunfire, and physical mirrors');
