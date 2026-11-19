import assert from 'node:assert/strict';
import {gardenWallDef} from '../../scenes/rongboy-mission/levels/garden-wall.js';
import {compileLevel,lineOfSight} from '../../scenes/rongboy-mission/level.js';
import {createGame,step,consumeEvents,fire} from '../../scenes/rongboy-mission/game.js';
import {trainingDef} from '../../scenes/rongboy-mission/levels/training.js';
const level=compileLevel(trainingDef('shielded')),s=createGame({level});
const e=s.enemies[0],p=s.player;const dt=1/120;
let aim=Math.atan2(e.x-p.x,e.z-p.z),locked=null,back=false,wound=false,backWindow=0;
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
for(let i=0;i<1500;i++){
 const prev=e.heading,previous=e.action;
 const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
 const target=Math.atan2(dx,dz);aim+=Math.max(-1.15*dt,Math.min(1.15*dt,angle(target-aim)));
 const facing=(Math.sin(e.heading)*dx+Math.cos(e.heading)*dz)/d;
 if(wound && facing>.5)backWindow+=dt;
 if(wound && facing>.6 && Math.abs(angle(target-aim))<.025 && !s.shots){
  fire(s,0,{origin:{x:p.x,y:.9,z:p.z},direction:{x:Math.sin(aim),y:0,z:Math.cos(aim)}});
 }
 // Advance from the default spawn. On the tell, sidestep and continue past the charging guard.
 const input=!wound?{}:p.x<1.4?{x:1,z:0}:p.z>-.1?{x:0,z:-1}:{};
 step(s,dt,input);
 if(e.action==='shield-windup' && previous!=='shield-windup'){locked=e.heading;wound=true;}
 if(wound && (e.action==='shield-windup'||e.action==='shield-charge'||(e.action==='special-recover'&&e.recoverFrom==='shield-charge')))assert.ok(Math.abs(angle(e.heading-locked))<1e-6);
 assert.ok(Math.abs(angle(e.heading-prev))<=2.38*dt);
 for(const ev of consumeEvents(s)){if(ev.type==='hit'&&ev.back&&ev.amount>0)back=true;}
 if(back)break;
}

assert.ok(wound&&back&&backWindow>.35 && s.health===3,'sidestep the locked line, turn at keyboard speed and hit the exposed back');

// From the garden gate the sleeper has an exposed head above solid cover.
const garden=compileLevel(gardenWallDef()), walker=garden.enemies.find(e=>e.type==='walker');
const eye={x:garden.player.x,y:1.23,z:garden.player.z};
assert.ok(lineOfSight(garden,eye,{x:walker.x,y:1.45,z:walker.z}));
assert.ok(!lineOfSight(garden,eye,{x:walker.x,y:.27,z:walker.z}));
console.log('PASS locked shield line, bounded turn, earned rear hit and garden hedge sightlines');
