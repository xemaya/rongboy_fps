// New enemy attacks. All damage/activation is routed back through the deterministic game API.
// Multi-storey: heights are measured from the enemy's own floor (e.base); S is that floor's storey (walls and
// furniture to path around). Attacks only start when the player stands on the same flat floor (see chase()).
import {ATTACKS,SPECIAL_TYPES,ARROW_SPEED,RANGED_GAP} from './attacks.js';
import {clearPath,freePoint,lineOfSight} from './level.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const still={x:0,z:0,y:0};
const set=(e,action)=>{e.action=action;e.actionAge=0;};
const visible=(s,e,p=s.player)=>lineOfSight(s.level,{x:e.x,y:(e.base||0)+.95,z:e.z},{x:p.x,y:(p===s.player?(p.y||0):(e.base||0))+1,z:p.z});
function recovery(e,cooldown){e.recoverFrom=e.action;set(e,'special-recover');e.actionCooldown=cooldown;}
export function interruptSpecial(e,meta={}){
 const heavy=meta.weapon==='heavy'||meta.charged;
 const vulnerable=['crawler-windup','crawler-strike','archer-aim','bomber-throw'].includes(e.action);
 const strong=['shield-windup','shield-charge','warden-windup','warden-call','leech-windup','leech-pull'].includes(e.action);
 // 打断要打得够疼：1 点的小伤害（小纽扣、6 米外的手枪球）断不了拉弓和举弹，得靠近打，或者用够劲的枪
 if(vulnerable&&!heavy&&(meta.amount??2)<2)return false;
 if(!vulnerable&&!(strong&&heavy))return false;
 recovery(e,e.type==='boss-warden'||e.type==='boss-leech'?2.8:1.8);e.interrupted=true;e.recoverFrom='interrupted';return true;
}
function activateReserve(s,e,api,S=s.level){
 const sealed=s.enemies.find(o=>o.alive&&!o.enabled&&o.reserveOf===e.id);if(!sealed)return false;
 for(let i=0;i<16;i++){const angle=(i+e.id*.37)*Math.PI/8,d=1.0+(i%3)*.25,x=e.x+Math.cos(angle)*d,z=e.z+Math.sin(angle)*d;
  if(Math.hypot(x-s.player.x,z-s.player.z)<1.65||!freePoint(S,x,z,sealed.radius+.04)||!clearPath(S,e,{x,z},sealed.radius+.025))continue;
  if(s.enemies.some(o=>o!==e&&o.enabled&&o.alive&&Math.hypot(o.x-x,o.z-z)<o.radius+sealed.radius+.1))continue;
  sealed.enabled=true;sealed.x=x;sealed.z=z;sealed.base=e.base||0;sealed.y=sealed.base;sealed.hop=0;sealed.vx=sealed.vz=0;sealed.awareness='waking';sealed.wake=.75;sealed.action='chase';sealed.actionAge=0;sealed.age=0;sealed.navIn=0;
  s.events.push({type:'summoned',id:sealed.id,by:e.id,x,z});return true;
 }return false;
}
export function cancelReserves(s,e){let n=0;for(const o of s.enemies)if(o.alive&&!o.enabled&&o.reserveOf===e.id){o.alive=false;o.deathAge=2;n++;}if(n){s.neutralized+=n;s.events.push({type:'sealed',by:e.id,count:n,x:e.x,z:e.z});}return n;}
export function onSpecialDeath(s,e,api){cancelReserves(s,e);}
export function contactAttack(e){if(!SPECIAL_TYPES.has(e.type))return true;return e.type==='crawler'&&e.action==='crawler-strike'||e.type==='shielded'&&e.action==='shield-charge';}
export function advanceSpecial(s,e,dt,api,S=s.level){
 e.actionAge+=dt;e.actionCooldown=Math.max(0,e.actionCooldown-dt);e.moveMultiplier=1;e.sideLean=0;e.guardBroken=Math.max(0,e.guardBroken-dt);
 const p=s.player,dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||1,a=ATTACKS[e.type],los=visible(s,e);
 if(e.action==='special-recover'){const hold=e.recoverFrom==='shield-charge'?1.35:.7;if(e.actionAge<hold)return still;set(e,'chase');}
 if(e.action==='crawler-strike'||e.action==='shield-charge'){
  const duration=e.type==='crawler'?.36:.50;if(e.actionAge>=duration){recovery(e,a.cooldown);return still;}
  const speed=e.type==='crawler'?3.5:5.0;return {x:e.attackX*speed,z:e.attackZ*speed,y:0};
 }
 if(['crawler-windup','shield-windup','bomber-throw','archer-aim','warden-windup','warden-call','leech-windup'].includes(e.action)){
  // Ranged aim tracks briefly, then locks, leaving a visible dodge window.
  // 锁定前一直跟着，并算足提前量：你照原样一直走，箭正好到。提前点被墙挡住就瞄你本人。锁定后不再动：这时换方向、停下都躲得开。
  if(e.action==='archer-aim'&&e.actionAge<a.windup-a.lock){
   // 提前的时间 = 锁定到出手的那一小段 + 箭飞过去的时间（按提前点的距离再算一遍）
   let t=a.lock+d/ARROW_SPEED;t=a.lock+Math.hypot(p.x+(p.mvx||0)*t-e.x,p.z+(p.mvz||0)*t-e.z)/ARROW_SPEED;t*=a.lead;
   const lead={x:p.x+(p.mvx||0)*t,z:p.z+(p.mvz||0)*t},aim=visible(s,e,lead)?lead:p;
   e.aimX=aim.x;e.aimZ=aim.z;e.heading=Math.atan2(aim.x-e.x,aim.z-e.z);
  }
  if(e.actionAge<a.windup)return still;
  if(e.action==='crawler-windup'||e.action==='shield-windup'){
   const target={x:e.aimX,z:e.aimZ};if(!clearPath(S,e,target,e.radius+.025,true)){recovery(e,1.2);return still;}
   const n=Math.hypot(target.x-e.x,target.z-e.z)||1;e.attackX=e.type==='shielded'?Math.sin(e.heading):(target.x-e.x)/n;e.attackZ=e.type==='shielded'?Math.cos(e.heading):(target.z-e.z)/n;set(e,e.type==='crawler'?'crawler-strike':'shield-charge');return still;
  }
  if(e.action==='bomber-throw'){api.bomb(s,e,{x:e.aimX,z:e.aimZ});s.rangedGate=s.time+RANGED_GAP;recovery(e,a.cooldown);return still;}
  if(e.action==='warden-call'){activateReserve(s,e,api,S);recovery(e,a.cooldown);return still;}
  if(e.action==='archer-aim'){
   if(visible(s,e,{x:e.aimX,z:e.aimZ}))api.projectile(s,e,{x:e.aimX,y:(e.base||0)+1.0,z:e.aimZ});s.rangedGate=s.time+RANGED_GAP;recovery(e,a.cooldown);s.events.push({type:'archer-release',id:e.id,x:e.x,z:e.z});return still;
  }
  if(e.action==='warden-windup'){
   s.events.push({type:'ground-slam',id:e.id,x:e.x,z:e.z,base:e.base||0,radius:a.radius});if(d<a.radius&&los)api.hurt(s,e,'ground-slam');e.attackCount++;recovery(e,a.cooldown);return still;
  }
  if(e.action==='leech-windup'){set(e,'leech-pull');return still;}
 }
 if(e.action==='leech-pull'){
  const dot=((e.aimX-e.x)*dx+(e.aimZ-e.z)*dz)/(Math.hypot(e.aimX-e.x,e.aimZ-e.z)*d||1);
  if(e.actionAge>.65||!los||d>a.range+1||dot<a.cone){recovery(e,a.cooldown);return still;}
  // Steering is still available; a wall cancels the tether immediately.
  p.vx-=dx/d*dt*40;p.vz-=dz/d*dt*40;s.pulledUntil=s.time+.08;
  if(d<1.2&&api.hurt(s,e,'leech-drain')){e.hp=Math.min(e.maxHp,e.hp+2);s.events.push({type:'drain',id:e.id,x:e.x,z:e.z});recovery(e,a.cooldown);}return still;
 }
 if(e.hit>0)return null;
 if(los&&e.type!=='shielded')e.heading=Math.atan2(dx,dz);
 const ready=e.actionCooldown<=0;
 // 远程出手要排队：别的弓手或炸弹客正在蓄势、或者上一次出手刚过，就先等着
 const rangedFree=s.time>=(s.rangedGate||0)&&!s.enemies.some(o=>o!==e&&o.alive&&o.enabled&&(o.action==='archer-aim'||o.action==='bomber-throw'));
 const begin=action=>{set(e,action);e.aimX=p.x;e.aimZ=p.z;s.events.push({type:'attack-windup',id:e.id,enemyType:e.type,action,x:e.x,z:e.z});return still;};
 if(e.type==='crawler'&&ready&&d<a.range&&los)return begin('crawler-windup');
 if(e.type==='shielded' && ready && e.guardBroken<=0 && d<a.range && los){
  const fx=Math.sin(e.heading),fz=Math.cos(e.heading);
  if((fx*dx+fz*dz)/d>Math.cos(Math.PI/15)){
   set(e,'shield-windup');
   e.aimX=e.x+fx*d;e.aimZ=e.z+fz*d;
   s.events.push({type:'attack-windup',id:e.id,enemyType:e.type,action:e.action,x:e.x,z:e.z});
   return still;
  }
 }
 if(e.type==='bomber'&&los){if(d<2.8)return {x:-dx/d*.8,z:-dz/d*.8,y:0};if(ready&&rangedFree&&d<a.range)return begin('bomber-throw');if(d<a.range)return still;}
 if(e.type==='archer'&&los){
  if(d<2.5){const tx=e.x-dx/d*.5,tz=e.z-dz/d*.5;if(freePoint(S,tx,tz,e.radius))return {x:-dx/d*.9,z:-dz/d*.9,y:0};}
  if(ready&&rangedFree&&d<a.range)return begin('archer-aim');if(d<a.range)return still;
 }
 if(e.type==='boss-warden'){
  if(ready&&e.attackCount%3===2&&s.enemies.some(o=>o.alive&&!o.enabled&&o.reserveOf===e.id)&&los&&d<10){e.attackCount++;return begin('warden-call');}
  if(ready&&d<a.range&&los)return begin('warden-windup');
 }
 if(e.type==='boss-leech'&&ready&&d<a.range&&los)return begin('leech-windup');
 return null;
}
