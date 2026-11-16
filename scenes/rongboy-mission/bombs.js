import {segmentBox,lineOfSight} from './level.js';
const GRAVITY=9.8;
export function launchBomb(s,e,target){
 if(s.enemyBombs.length>=10)return;
 const duration=.85,r=.16,m=e.muzzle||{side:.339,forward:.423,y:.829},x=e.x+Math.cos(e.heading)*m.side+Math.sin(e.heading)*m.forward,z=e.z-Math.sin(e.heading)*m.side+Math.cos(e.heading)*m.forward,y=e.y+m.y;
 const b={id:s.nextId++,owner:e.id,x,y,z,vx:(target.x-x)/duration,vz:(target.z-z)/duration,vy:(r-y+.5*GRAVITY*duration**2)/duration,r,landed:false,fuse:1.15,age:0,radius:2.2,destroyed:false};s.enemyBombs.push(b);s.events.push({type:'bomb-thrown',id:b.id,x,y,z});
}
export function advanceBombs(s,dt,hurt){
 for(const b of s.enemyBombs){
  b.age+=dt;if(b.age>8){b.destroyed=true;continue;}
  if(!b.landed){
   b.vy-=GRAVITY*dt;const end={x:b.x+b.vx*dt,y:b.y+b.vy*dt,z:b.z+b.vz*dt};let t=1,collision=null;
   for(const solid of s.level.solids){const hit=segmentBox(b,end,solid,b.r);if(hit&&hit.t<t){t=hit.t;collision=hit;}}
   b.x+=(end.x-b.x)*t;b.z+=(end.z-b.z)*t;b.y+=(end.y-b.y)*t;if(collision){b.vx=b.vz=0;b.x+=collision.nx*.002;b.z+=collision.nz*.002;if(!collision.ny)b.y=end.y;else if(collision.ny<0)b.vy=0;}
   const B=s.level.bounds;b.x=Math.max(B.minX+b.r,Math.min(B.maxX-b.r,b.x));b.z=Math.max(B.minZ+b.r,Math.min(B.maxZ-b.r,b.z));
   // A bomb rests on the floor or the top of a cover, with its fuse starting there.
   const support=s.level.solids.find(c=>b.x>c.minX-b.r&&b.x<c.maxX+b.r&&b.z>c.minZ-b.r&&b.z<c.maxZ+b.r&&b.y>=c.maxY-.03&&b.y<=c.maxY+b.r+.03);
   const floor=support?.maxY||0;if(b.y<=floor+b.r+.015&&b.vy<=0){b.y=floor+b.r;b.vx=b.vy=b.vz=0;b.landed=true;s.events.push({type:'bomb-land',id:b.id,x:b.x,y:b.y,z:b.z});}
  }else{
   b.fuse-=dt;if(b.fuse>0)continue;b.destroyed=true;s.events.push({type:'yarn-blast',id:b.id,x:b.x,y:b.y,z:b.z,radius:b.radius,harmPlayer:true});
   const visible=p=>lineOfSight(s.level,{x:b.x,y:b.y+.06,z:b.z},{x:p.x,y:.95,z:p.z});
   if(Math.hypot(s.player.x-b.x,s.player.z-b.z)<b.radius&&visible(s.player))hurt(s,{id:b.owner,x:b.x,z:b.z},'bomb-blast');
   for(const e of s.enemies)if(e.enabled&&e.alive&&Math.hypot(e.x-b.x,e.z-b.z)<b.radius&&visible(e)){e.hit=Math.max(e.hit,.5);e.hitDuration=e.hit;}
  }
 }
 s.enemyBombs=s.enemyBombs.filter(b=>!b.destroyed);
}
