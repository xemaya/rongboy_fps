import assert from 'node:assert/strict';
import {compileLevel} from '../../scenes/rongboy-mission/level.js';
import {createGame,step,fire,consumeEvents,grenades,secondOf} from '../../scenes/rongboy-mission/game.js';
import {gardenWallDef,GARDEN_BOARD} from '../../scenes/rongboy-mission/levels/garden-wall.js';
import {gardenReceipts} from '../../scenes/rongboy-mission/garden-feedback.js';

const level=compileLevel(gardenWallDef());
function shoot(offset,power,delay=0){
  const s=createGame({level}), shield=s.enemies.find(e=>e.type==='shielded');
  assert.equal(s.enemies.length,2);assert.equal(grenades(s),0);assert.equal(secondOf(s),-1);
  const events=[],receipt=gardenReceipts();
  function run(frames){
    for(let i=0;i<frames;i++){
      step(s,1/120,{});
      for(const e of consumeEvents(s)){events.push(e);receipt.event(e,shield.id);}
    }
  }
  run(Math.round(120*delay));
  const yaw=level.player.yaw+offset*Math.PI/180,dx=-Math.sin(yaw),dz=-Math.cos(yaw);
  assert.ok(fire(s,power,{origin:{x:s.player.x+.63*dx,y:1.06,z:s.player.z+.63*dz},direction:{x:dx,y:0,z:dz}}));
  run(210);
  return {counts:receipt.counts,events};
}
assert.equal(shoot(0,0).counts.blocks,1,'centre-line tap meets the shield');
assert.equal(shoot(0,1,.78).counts.breaks,1,'charged centre-line opens the shield');
for(const [delay,offset] of [[0,-9],[.8,-14],[1.8,-15]]){
  const {events,counts}=shoot(offset,0,delay);
  assert.equal(counts.returns,1,'real bank remains playable as the guard approaches');
  assert.ok(events.some(e=>e.type==='hit' && e.afterSurface===GARDEN_BOARD && e.back && e.amount>0));
}
console.log('PASS playable board return, frontal block and charged break from common start');
