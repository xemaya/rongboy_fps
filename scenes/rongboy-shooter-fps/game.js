// DOM-free, deterministic woolball combat. X/Z ground plane, metres and seconds.
import {advanceAction,interruptAction} from './enemy-actions.js';
import {FEEL} from './feedback.js';
import {ROOM,COVERS,segmentBox,routeTo,clearPath,freePoint,resolveCover} from './level.js';
export const CONFIG={halfX:ROOM.halfX,halfZ:ROOM.halfZ,playerSpeed:3.15,enemyRadius:.32,playerRadius:.30,chargeTime:.82,maxAlive:14,enemyHp:6,maxBalls:48,maxBounces:3,ballHalfX:ROOM.halfX,ballHalfZ:ROOM.halfZ,ceilingY:ROOM.height,ballLife:5,heavyBallLife:6.5,repeatHitDelay:.18,gravity:.9};
export const ENEMY_TYPES={
 walker:{name:'Hopper',hp:6,radius:.32,height:1.62,scale:1,speed:1.35,hopHeight:.22,hopPeriod:.72,resistance:1},
 leaper:{name:'Springer',hp:5,radius:.30,height:1.56,scale:.96,speed:1.9,hopHeight:.28,hopPeriod:.55,resistance:.9},
 heavy:{name:'Quiltguard',hp:10,radius:.43,height:1.81,scale:1.12,speed:.88,hopHeight:.12,hopPeriod:1.02,resistance:.38},
};
export const WEAPONS=[
 {id:'single',name:'Spool popper',tag:'BALANCED',count:1,push:1.8,chargePush:3.6,cooldown:.20,speed:13,color:0xf3dfa5},
 {id:'scatter',name:'Pom-pom trio',tag:'3 BALL SPREAD',count:3,push:.72,chargePush:.55,cooldown:.62,speed:12,color:0xabc8bd},
 {id:'heavy',name:'Quilt cannon',tag:'HEAVY PUSH',count:1,push:9.2,chargePush:3.6,cooldown:.85,speed:10,color:0xd6a789},
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const length=(x,z)=>Math.hypot(x,z);
function rng(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function createGame({seed=1743,duration=60,covers=COVERS}={}){const s={phase:'playing',seed,time:0,duration,covers,weapon:0,health:3,score:0,kills:0,shots:0,hits:0,bounces:0,repeatHits:0,maxCombo:0,combo:0,lastKill:-10,charge:0,charging:false,cooldown:0,invul:0,spawnIn:2.6,wave:1,nextId:1,enemies:[],balls:[],events:[],player:{x:0,z:5.7,vx:0,vz:0,aimX:0,aimY:0,aimZ:-1}};spawn(s,0,3.0);spawn(s,-1.8,1.7,'runner');spawn(s,1.8,-1.7,'heavy');spawn(s,-4.8,1.8,'weaver');spawn(s,2.2,1.4,'leaper');spawn(s,5.05,-1.0);return s;}
export function spawn(s,x,z,type='walker'){type=type==='runner'||type==='weaver'?'leaper':type;const def=ENEMY_TYPES[type]||ENEMY_TYPES.walker;const e={...def,type,id:s.nextId++,x,y:0,z,vx:0,vz:0,hp:def.hp,maxHp:def.hp,alive:true,hit:0,age:0,deathAge:0,heading:0,fallX:0,fallZ:1,chainCooldown:0,reactionAge:10,reactionStrength:0,reactionWeapon:'single',reactionX:0,reactionZ:1,reactionTwist:0,hitDuration:0,navIn:0,route:[],hopPhase:0,action:'chase',actionAge:0,actionCooldown:1.3+(s.nextId%3)*.25,sideLean:0,moveMultiplier:1};resolveCover(e,e.radius,s.covers);s.enemies.push(e);s.events.push({type:'spawn',id:e.id,x:e.x,z:e.z,enemyType:type});return e;}
export function selectWeapon(s,index){if(s.phase!=='playing'||!WEAPONS[index]||s.weapon===index)return false;s.weapon=index;s.charging=false;s.charge=0;s.events.push({type:'weapon',weapon:index});return true;}
export function beginCharge(s){if(s.phase==='playing'&&!s.charging){s.charging=true;s.charge=0;}}
export function releaseCharge(s,shot=null){if(!s.charging)return false;s.charging=false;const power=clamp((s.charge-.12)/(CONFIG.chargeTime-.12),0,1);s.charge=0;return fire(s,power,shot);}
export function fire(s,power=0,shot=null){
 if(s.phase!=='playing'||s.cooldown>0)return false;power=clamp(power,0,1);const w=WEAPONS[s.weapon],p=s.player,dir=shot?.direction||{x:p.aimX,y:p.aimY||0,z:p.aimZ},m=Math.hypot(dir.x,dir.y,dir.z)||1,dx=dir.x/m,dy=dir.y/m,dz=dir.z/m,origin=shot?.origin||{x:p.x+dx*.63,y:.76,z:p.z+dz*.63};
 const rightLength=Math.hypot(dx,dz)||1,rx=-dz/rightLength,rz=dx/rightLength;
 for(let i=0;i<w.count;i++){
  if(s.balls.length>=CONFIG.maxBalls)expireBall(s,s.balls.shift());
  const offset=w.count===1?0:(i-1)*(.15-power*.07),ax=dx+rx*offset,az=dz+rz*offset,n=Math.hypot(ax,dy,az),speed=w.speed-(w.id==='single'?power*2:0),effective=w.id==='heavy'?.75+power*.25:power;
  const radius=w.id==='scatter'?.085+power*.035:w.id==='heavy'?.22+power*.06:.10+.15*power;
  const b={id:s.nextId++,weapon:w.id,x:origin.x,y:origin.y,z:origin.z,dx:ax/n,dy:dy/n,dz:az/n,speed,r:radius,power:effective,impulse:w.push+power*w.chargePush,stun:FEEL[w.id].stun+power*.035,vx:ax/n*speed,vy:dy/n*speed,vz:az/n*speed,age:0,lifetime:w.id==='heavy'?CONFIG.heavyBallLife:power>=.6?CONFIG.heavyBallLife:CONFIG.ballLife,bounceCount:0,enemyHits:0,hitTimes:{},hitCounts:{},maxBounces:CONFIG.maxBounces,destroyed:false};s.balls.push(b);
 }
 s.shots++;s.cooldown=w.cooldown+(w.id==='single'&&power>=.6?.16:0);s.events.push({type:'shot',x:origin.x,z:origin.z,y:origin.y,dx,dy,dz,power,weapon:w.id});return true;
}
// First intersection parameter along a segment; catches a fast ball between frames.
export function segmentCircle(ax,az,bx,bz,cx,cz,r){const dx=bx-ax,dz=bz-az,fx=ax-cx,fz=az-cz,A=dx*dx+dz*dz,C=fx*fx+fz*fz-r*r;if(C<=0)return 0;if(A<1e-10)return null;const B=2*(fx*dx+fz*dz),disc=B*B-4*A*C;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:null;}
export function cameraMove(side,forward,yaw){return {x:side*Math.cos(yaw)-forward*Math.sin(yaw),z:-side*Math.sin(yaw)-forward*Math.cos(yaw)};}
export function segmentCylinder(ax,ay,az,bx,by,bz,cx,cz,r,minY,maxY){const dx=bx-ax,dz=bz-az,fx=ax-cx,fz=az-cz,A=dx*dx+dz*dz,C=fx*fx+fz*fz-r*r;let lo=0,hi=1;if(A<1e-10){if(C>0)return null;}else{const B=2*(fx*dx+fz*dz),D=B*B-4*A*C;if(D<0)return null;lo=Math.max(0,(-B-Math.sqrt(D))/(2*A));hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));}const dy=by-ay;if(Math.abs(dy)<1e-10){if(ay<minY||ay>maxY)return null;}else{let a=(minY-ay)/dy,b=(maxY-ay)/dy;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}return lo<=hi&&hi>=0&&lo<=1?Math.max(0,lo):null;}
function knockdown(s,e,dx,dz,source='ball'){if(!e.alive)return;e.alive=false;e.deathAge=0;e.fallX=dx;e.fallZ=dz;s.kills++;s.combo=s.time-s.lastKill<1.6?s.combo+1:1;s.lastKill=s.time;s.maxCombo=Math.max(s.maxCombo,s.combo);s.score+=10+(s.combo-1)*5;s.events.push({type:'knockdown',id:e.id,x:e.x,z:e.z,dx,dz,combo:s.combo,source,weapon:e.reactionWeapon,strength:e.reactionStrength});}
function damage(s,e,amount,dx,dz,impulse,source='ball',meta={}){
 if(!e.alive)return;e.hp=Math.max(0,e.hp-amount);e.lastHit=s.time;if(interruptAction(e))s.events.push({type:'interrupted',id:e.id,x:e.x,z:e.z});
 e.vx+=dx*impulse*e.resistance;e.vz+=dz*impulse*e.resistance;
 const weapon=meta.weapon||(impulse>3?'heavy':'single'),feel=FEEL[weapon]||FEEL.single;
 e.hit=Math.max(e.hit,meta.stun??feel.stun);e.hitDuration=e.hit;e.chainCooldown=.16;
 const stacked=e.reactionAge<.055?e.reactionStrength*.22:0;
 e.reactionStrength=Math.min(1.6,feel.impact*Math.sqrt(e.resistance)+stacked);e.reactionAge=0;e.reactionWeapon=weapon;e.reactionX=dx;e.reactionZ=dz;
 const offsetX=(meta.contactX??e.x)-e.x,offsetZ=(meta.contactZ??e.z)-e.z;
 const twist=(offsetX*dz-offsetZ*dx)/e.radius;e.reactionTwist=Math.abs(twist)>.08?Math.max(-1,Math.min(1,twist)):(e.id%2?1:-1)*.7;
 s.events.push({type:'hit',id:e.id,x:e.x,z:e.z,dx,dz,heavy:weapon==='heavy',source,hp:e.hp,maxHp:e.maxHp,impulse:impulse*e.resistance,strength:e.reactionStrength,...meta,weapon});
 if(e.hp<=0)knockdown(s,e,dx,dz,source);
}
function wall(e,r){if(e.x>CONFIG.halfX-r){e.x=CONFIG.halfX-r;e.vx=-Math.abs(e.vx)*.25;}if(e.x<-CONFIG.halfX+r){e.x=-CONFIG.halfX+r;e.vx=Math.abs(e.vx)*.25;}if(e.z>CONFIG.halfZ-r){e.z=CONFIG.halfZ-r;e.vz=-Math.abs(e.vz)*.25;}if(e.z<-CONFIG.halfZ+r){e.z=-CONFIG.halfZ+r;e.vz=Math.abs(e.vz)*.25;}}
function expireBall(s,b,reason='lifetime'){if(b.destroyed)return;b.destroyed=true;s.events.push({type:'ball-expired',id:b.id,x:b.x,y:b.y,z:b.z,reason,bounces:b.bounceCount});}
function syncDirection(b){b.speed=Math.hypot(b.vx,b.vy,b.vz)||1;b.dx=b.vx/b.speed;b.dy=b.vy/b.speed;b.dz=b.vz/b.speed;}
function advanceBall(s,b,dt){
 b.age+=dt;if(b.age>=b.lifetime){expireBall(s,b);return;}
 b.vy-=CONFIG.gravity*dt;
 // Clamp numerical drift only; each following event is swept to its contact point.
 b.x=clamp(b.x,-CONFIG.ballHalfX+b.r,CONFIG.ballHalfX-b.r);b.z=clamp(b.z,-CONFIG.ballHalfZ+b.r,CONFIG.ballHalfZ-b.r);b.y=clamp(b.y,.03+b.r,CONFIG.ceilingY-b.r);
 let left=dt;
 for(let pass=0;pass<6&&left>1e-7&&!b.destroyed;pass++){
  const end={x:b.x+b.vx*left,y:b.y+b.vy*left,z:b.z+b.vz*left};let hit=null;
  const candidate=(t,nx,ny,nz,kind,e=null)=>{if(t>=-1e-8&&t<=1&&(hit===null||t<hit.t-1e-8))hit={t:Math.max(0,t),nx,ny,nz,kind,e};};
  for(const [axis,lo,hi]of [['x',-CONFIG.ballHalfX+b.r,CONFIG.ballHalfX-b.r],['y',.03+b.r,CONFIG.ceilingY-b.r],['z',-CONFIG.ballHalfZ+b.r,CONFIG.ballHalfZ-b.r]]){
   const delta=end[axis]-b[axis];if(delta>1e-10&&end[axis]>=hi){const n={x:0,y:0,z:0};n[axis]=-1;candidate((hi-b[axis])/delta,n.x,n.y,n.z,'wall');}
   else if(delta< -1e-10&&end[axis]<=lo){const n={x:0,y:0,z:0};n[axis]=1;candidate((lo-b[axis])/delta,n.x,n.y,n.z,axis==='y'?'floor':'wall');}
  }
  for(const e of s.enemies){if(!e.alive)continue;const radius=e.radius+b.r,minY=e.y+.04-b.r,maxY=e.y+e.height+b.r;const t=segmentCylinder(b.x,b.y,b.z,end.x,end.y,end.z,e.x,e.z,radius,minY,maxY);if(t===null)continue;
   const cx=b.x+(end.x-b.x)*t,cy=b.y+(end.y-b.y)*t,cz=b.z+(end.z-b.z)*t;let nx=0,ny=0,nz=0;
   if(Math.abs(cy-maxY)<.001&&b.vy<0)ny=1;else if(Math.abs(cy-minY)<.001&&b.vy>0)ny=-1;else{const d=Math.hypot(cx-e.x,cz-e.z);if(d>.0001){nx=(cx-e.x)/d;nz=(cz-e.z)/d;}else{const v=Math.hypot(b.vx,b.vz)||1;nx=-b.vx/v;nz=-b.vz/v;}}
   // Ignore an already separating contact, rather than consuming the whole bounce budget.
   if(b.vx*nx+b.vy*ny+b.vz*nz>=-1e-6)continue;candidate(t,nx,ny,nz,'enemy',e);
  }
  for(const c of s.covers){const h=segmentBox(b,end,c,b.r);if(h&&b.vx*h.nx+b.vy*h.ny+b.vz*h.nz< -1e-6)candidate(h.t,h.nx,h.ny,h.nz,'cover');}
  if(!hit){b.x=end.x;b.y=end.y;b.z=end.z;break;}
  const incoming={x:b.vx,y:b.vy,z:b.vz};b.x+=(end.x-b.x)*hit.t;b.y+=(end.y-b.y)*hit.t;b.z+=(end.z-b.z)*hit.t;left*=1-hit.t;
  if(hit.e){const e=hit.e,last=b.hitTimes[e.id]??-100;
   if(s.time-last>=CONFIG.repeatHitDelay){const n=Math.hypot(incoming.x,incoming.z)||1,repeat=(b.hitCounts[e.id]||0)>0;b.hitTimes[e.id]=s.time;b.hitCounts[e.id]=(b.hitCounts[e.id]||0)+1;b.enemyHits++;s.hits++;if(repeat)s.repeatHits++;damage(s,e,1,incoming.x/n,incoming.z/n,b.impulse,'ball',{ballId:b.id,repeat,weapon:b.weapon,stun:b.stun,contactX:b.x,contactY:b.y,contactZ:b.z});}
   if(hit.ny!==0)b.y=hit.ny>0?e.y+e.height+b.r+.002:e.y+.04-b.r-.002;else{const radius=e.radius+b.r+.002;b.x=e.x+hit.nx*radius;b.z=e.z+hit.nz*radius;}
  }else{b.x+=hit.nx*.002;b.y+=hit.ny*.002;b.z+=hit.nz*.002;}
  const dot=b.vx*hit.nx+b.vy*hit.ny+b.vz*hit.nz;const retain=hit.e?.98:.985;b.vx=(b.vx-2*dot*hit.nx)*retain;b.vy=(b.vy-2*dot*hit.ny)*retain;b.vz=(b.vz-2*dot*hit.nz)*retain;
  if(hit.kind==='floor')b.vy=Math.max(1.05,b.vy*.88);
  b.bounceCount++;s.bounces++;if(s.time-(b.lastBounceEvent??-1)>.04){b.lastBounceEvent=s.time;s.events.push({type:'bounce',id:b.id,x:b.x,y:b.y,z:b.z,kind:hit.kind,count:b.bounceCount});}
  if(b.bounceCount>=b.maxBounces)expireBall(s,b,'bounce-limit');
 }
 syncDirection(b);
}
export function step(s,dt,input={}){if(s.phase!=='playing')return;dt=clamp(dt,0,.05);s.time=Math.min(s.duration,s.time+dt);s.cooldown=Math.max(0,s.cooldown-dt);s.invul=Math.max(0,s.invul-dt);if(s.charging)s.charge=Math.min(CONFIG.chargeTime,s.charge+dt);if(s.time-s.lastKill>1.6)s.combo=0;
 const p=s.player;let mx=input.x||0,mz=input.z||0,m=length(mx,mz);if(m>1){mx/=m;mz/=m;}if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimZ)){const n=Math.hypot(input.aimX,input.aimY||0,input.aimZ);if(n>.01){p.aimX=input.aimX/n;p.aimY=(input.aimY||0)/n;p.aimZ=input.aimZ/n;}}
 p.x+=mx*CONFIG.playerSpeed*dt+p.vx*dt;p.z+=mz*CONFIG.playerSpeed*dt+p.vz*dt;p.vx*=Math.exp(-10*dt);p.vz*=Math.exp(-10*dt);p.x=clamp(p.x,-CONFIG.halfX+.35,CONFIG.halfX-.35);p.z=clamp(p.z,-CONFIG.halfZ+.35,CONFIG.halfZ-.35);
 resolveCover(p,CONFIG.playerRadius,s.covers);
 for(const e of s.enemies){
  const prevPhase=e.hopPhase;e.age+=dt;e.reactionAge+=dt;e.hit=Math.max(0,e.hit-dt);e.chainCooldown=Math.max(0,e.chainCooldown-dt);
  if(!e.alive){e.deathAge+=dt;e.y*=Math.exp(-dt*12);}else{
   const action=advanceAction(e,dt,p,s.covers,s.events);
   e.hopPhase=((e.age+e.id*.137)%e.hopPeriod)/e.hopPeriod;
   const flight=clamp(e.hopPhase/.78,0,1);e.y=action? action.y:Math.sin(flight*Math.PI)*e.hopHeight;
   if(e.hopPhase<prevPhase&&!action)s.events.push({type:'land',id:e.id,x:e.x,z:e.z,enemyType:e.type});
   if(action){if(e.hit<=0){e.x+=action.x*dt;e.z+=action.z*dt;}}
   else{
    e.navIn-=dt;if(e.navIn<=0){e.route=routeTo(e,p,e.radius+.025,s.covers);e.navIn=.4;}
    while(e.route.length&&length(e.x-e.route[0].x,e.z-e.route[0].z)<.04)e.route.shift();
    const next=e.action==='sidestep'?{x:e.flankX,z:e.flankZ}:clearPath(e,p,e.radius+.025,s.covers)?p:e.route[0];
    if(next){const dx=next.x-e.x,dz=next.z-e.z,d=length(dx,dz)||1,speed=e.hit<=0?e.speed*e.moveMultiplier*(.15+1.55*Math.sin(flight*Math.PI)):0;const travel=Math.min(d,speed*dt);e.x+=dx/d*travel;e.z+=dz/d*travel;if(d>.03&&e.hit<=0){const lookX=e.action==='sidestep'?p.x-e.x:dx,lookZ=e.action==='sidestep'?p.z-e.z:dz;e.heading=Math.atan2(lookX,lookZ);}}
   }
  }
  e.x+=e.vx*dt;e.z+=e.vz*dt;e.vx*=Math.exp(-4.3*dt);e.vz*=Math.exp(-4.3*dt);wall(e,e.radius);resolveCover(e,e.radius,s.covers);
 }
 // Separate soft bodies. A fast knocked toy transfers momentum and can topple another.
 for(let i=0;i<s.enemies.length;i++)for(let j=i+1;j<s.enemies.length;j++){const a=s.enemies[i],b=s.enemies[j];if((!a.alive&&a.deathAge>.48)||(!b.alive&&b.deathAge>.48))continue;let dx=b.x-a.x,dz=b.z-a.z,d=length(dx,dz),r=a.radius+b.radius;if(d>=r)continue;if(d<.001){dx=.001;dz=0;d=.001;}const nx=dx/d,nz=dz/d,over=r-Math.min(r,d);a.x-=nx*over*.5;b.x+=nx*over*.5;a.z-=nz*over*.5;b.z+=nz*over*.5;const va=a.vx*nx+a.vz*nz,vb=-(b.vx*nx+b.vz*nz);if(va>2.0&&b.alive&&b.chainCooldown<=0){damage(s,b,1,nx,nz,va*.75,'collision');a.vx*=.55;a.vz*=.55;}else if(vb>2.0&&a.alive&&a.chainCooldown<=0){damage(s,a,1,-nx,-nz,vb*.75,'collision');b.vx*=.55;b.vz*=.55;}}
 for(const e of s.enemies){wall(e,e.radius);resolveCover(e,e.radius,s.covers);}
 for(const ball of s.balls)advanceBall(s,ball,dt);
 s.balls=s.balls.filter(b=>!b.destroyed);s.enemies=s.enemies.filter(e=>e.alive||e.deathAge<1.15);
 if(s.invul<=0){for(const e of s.enemies){if(!e.alive)continue;const dx=p.x-e.x,dz=p.z-e.z,d=length(dx,dz);if(d<CONFIG.playerRadius+e.radius){const n=d||1;p.vx=dx/n*3;p.vz=dz/n*3;e.vx-=dx/n*2;e.vz-=dz/n*2;s.health--;s.invul=1.2;s.events.push({type:'hurt',x:p.x,z:p.z});break;}}}
 // Eye-level controls need solid toy bodies: contact pushes, never walks through them.
 for(const e of s.enemies){if(!e.alive)continue;let dx=p.x-e.x,dz=p.z-e.z,d=length(dx,dz),r=CONFIG.playerRadius+e.radius;if(d>=r)continue;if(d<.001){dx=.001;dz=0;d=.001;}const overlap=r-d,nx=dx/d,nz=dz/d;p.x+=nx*overlap*.85;p.z+=nz*overlap*.85;e.x-=nx*overlap*.15;e.z-=nz*overlap*.15;wall(e,e.radius);resolveCover(e,e.radius,s.covers);}
 p.x=clamp(p.x,-CONFIG.halfX+.35,CONFIG.halfX-.35);p.z=clamp(p.z,-CONFIG.halfZ+.35,CONFIG.halfZ-.35);
 resolveCover(p,CONFIG.playerRadius,s.covers);
 s.spawnIn-=dt;const alive=s.enemies.filter(e=>e.alive).length;
 if(s.spawnIn<=0&&alive<CONFIG.maxAlive&&s.time<s.duration-2){
  let count=0;const amount=Math.min(3,CONFIG.maxAlive-alive);
  for(let group=0;group<amount;group++){
   let point=null;for(let attempt=0;attempt<36;attempt++){const side=Math.floor(rng(s)*4);let x=(rng(s)*2-1)*(CONFIG.halfX-.7),z=(rng(s)*2-1)*(CONFIG.halfZ-.7);if(side<2)x=(side===0?-1:1)*(CONFIG.halfX-.7);else z=(side===2?-1:1)*(CONFIG.halfZ-.7);if(length(x-p.x,z-p.z)>5.5&&freePoint(x,z,.52,s.covers)&&s.enemies.every(e=>!e.alive||length(e.x-x,e.z-z)>1.0)){point={x,z};break;}}
   if(point){const types=['walker','leaper','heavy'],type=types[(s.wave+group+Math.floor(rng(s)*3))%types.length];spawn(s,point.x,point.z,type);count++;}
  }
  if(count){s.wave++;s.events.push({type:'wave',wave:s.wave,count});}s.spawnIn=alive<6?2.3:3.8;
 }
 if(s.health<=0||s.time>=s.duration){s.phase=s.health<=0?'lost':'won';s.charging=false;s.charge=0;s.events.push({type:'round-end',phase:s.phase});}}
export function consumeEvents(s){const e=s.events;s.events=[];return e;}
