// Deterministic, cover-aware action states; presentation reads the same timers as combat.
import {clearPath,freePoint} from './level.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function setAction(e,action){e.action=action;e.actionAge=0;}
export function interruptAction(e){if(e.action==='windup'||e.action==='pounce'){setAction(e,'recover');e.actionCooldown=Math.max(e.actionCooldown,1.8);return true;}return false;}
export function advanceAction(e,dt,player,covers,events){
 e.actionAge+=dt;e.actionCooldown=Math.max(0,e.actionCooldown-dt);e.moveMultiplier=1;e.sideLean=0;
 const dx=player.x-e.x,dz=player.z-e.z,distance=Math.hypot(dx,dz)||1;
 if(e.hit>0){e.actionCooldown=Math.max(e.actionCooldown,.3);return null;}
 if(e.action==='windup'){
  e.heading=Math.atan2(dx,dz);if(e.actionAge<.48)return {x:0,z:0,y:0};
  if(!clearPath(e,player,e.radius+.045,covers)){setAction(e,'recover');e.actionCooldown=1.4;return {x:0,z:0,y:0};}
  e.pounceX=dx/distance;e.pounceZ=dz/distance;e.pounceDistance=clamp(distance-.55,1.4,3.8);setAction(e,'pounce');events.push({type:'pounce',id:e.id,x:e.x,z:e.z});
 }
 if(e.action==='pounce'){
  if(e.actionAge>=.54){setAction(e,'recover');e.actionCooldown=2.5;events.push({type:'land',id:e.id,x:e.x,z:e.z,enemyType:e.type,pounce:true});return {x:0,z:0,y:0};}
  const t=e.actionAge/.54;return {x:e.pounceX*e.pounceDistance/.54,z:e.pounceZ*e.pounceDistance/.54,y:Math.sin(t*Math.PI)*.65};
 }
 if(e.action==='recover'){
  if(e.actionAge<.34)return {x:0,z:0,y:0};setAction(e,'chase');
 }
 if(e.type==='leaper'&&e.actionCooldown<=0&&distance>2.3&&distance<5.4&&clearPath(e,player,e.radius+.045,covers)){
  setAction(e,'windup');events.push({type:'windup',id:e.id,x:e.x,z:e.z});return {x:0,z:0,y:0};
 }
 if(e.type==='weaver'&&distance<8&&distance>1.15&&clearPath(e,player,e.radius+.06,covers)){
  const direction=Math.sin(e.age*3.0+e.id)>0?1:-1,sideX=dz/distance*direction,sideZ=-dx/distance*direction;
  const tx=e.x+sideX*.8+dx/distance*.4,tz=e.z+sideZ*.8+dz/distance*.4;
  if(freePoint(tx,tz,e.radius+.06,covers)&&clearPath(e,{x:tx,z:tz},e.radius+.025,covers)){
   if(e.action!=='sidestep')setAction(e,'sidestep');e.sideLean=direction;e.moveMultiplier=1.05;e.flankX=tx;e.flankZ=tz;return null;
  }
 }
 if(e.type==='runner'&&Math.floor((e.age+e.id*.11)/1.9)%3===1){e.action='rush';e.moveMultiplier=1.25;}
 else if(e.action!=='chase')setAction(e,'chase');
 return null;
}
// Rig offsets for anticipation, flight and landing. Ground position is owned by combat.
export function actionPose(e){
 const t=e.actionAge||0,pose={crouch:0,lean:0,reach:0,spread:0,legTuck:0,roll:0,head:0};
 if(e.action==='windup'){const a=clamp(t/.48,0,1);pose.crouch=Math.sin(a*Math.PI*.7)*.11;pose.lean=.20*a;pose.reach=-.45*a;pose.spread=.20*a;pose.head=-.16*a;}
 else if(e.action==='pounce'){const a=clamp(t/.54,0,1);pose.lean=.24;pose.reach=.32;pose.spread=.12;pose.legTuck=Math.sin(a*Math.PI)*.65;pose.head=-.12;}
 else if(e.action==='recover'){const a=1-clamp(t/.34,0,1);pose.crouch=a*.12;pose.lean=.18*a;pose.spread=.22*a;pose.legTuck=-.18*a;}
 else if(e.action==='sidestep'){pose.roll=-(e.sideLean||0)*.12;pose.spread=.14;pose.lean=.05;}
 else if(e.action==='rush'){pose.lean=.17;pose.reach=-.18;pose.legTuck=Math.sin(e.age*18)*.13;}
 return pose;
}
