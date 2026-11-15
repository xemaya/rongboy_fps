// Presentation only: closed-form springs keep the same recoil at 30/60/120 Hz.
export const FEEL={
 single:{omega:30,back:.105,up:.018,side:.006,pitch:.055,roll:.018,camera:.007,fov:.15,impact:.68,twist:.20,stun:.14},
 scatter:{omega:20,back:.22,up:.035,side:-.042,pitch:.105,roll:-.095,camera:.013,fov:.32,impact:.42,twist:.95,stun:.10},
 heavy:{omega:13,back:.39,up:.065,side:.018,pitch:.23,roll:.06,camera:.027,fov:.70,impact:1.28,twist:.35,stun:.27},
};
const channels=['back','up','side','pitch','roll','camera','fov'];
export function createRecoil(){return {omega:30,weapon:'single',...Object.fromEntries(channels.map(k=>[k,{x:0,v:0}]))};}
export function kickRecoil(s,weapon='single',power=0){const p=FEEL[weapon]||FEEL.single;s.omega=p.omega;s.weapon=weapon;const charge=1+power*.28;for(const k of channels){const a=p[k]*charge,sign=Math.sign(a);s[k].v+=a*p.omega*2.4;s[k].v=Math.max(-Math.abs(a)*p.omega*4,Math.min(Math.abs(a)*p.omega*4,s[k].v));if(Math.abs(s[k].x)>Math.abs(a)*1.7)s[k].x=sign*Math.abs(a)*1.7;}}
export function stepRecoil(s,dt){const w=s.omega,decay=Math.exp(-w*dt);for(const k of channels){const c=s[k],j=c.v+w*c.x;c.x=(c.x+j*dt)*decay;c.v=(c.v-w*j*dt)*decay;if(Math.abs(c.x)+Math.abs(c.v)<1e-6)c.x=c.v=0;}return s;}
export function enemyReaction(e){
 const age=e.reactionAge??10,strength=e.reactionStrength||0,p=FEEL[e.reactionWeapon]||FEEL.single;
 // Fast compression, a large directional bend, then a smaller spring-back. Never a flattened toy.
 const attack=1-Math.exp(-age*105),decay=Math.exp(-age*(e.reactionWeapon==='heavy'?5.4:10.5));
 const bend=attack*decay*Math.cos(age*(e.reactionWeapon==='heavy'?9:13))*strength,wobble=Math.sin(age*23)*Math.exp(-age*9)*strength;
 return {bend,twist:(e.reactionTwist||.3)*attack*decay*p.twist*strength,headLag:Math.sin(age*17)*Math.exp(-age*7.5)*strength,flail:attack*Math.exp(-age*7)*strength,compression:Math.max(0,Math.sin(age*32))*Math.exp(-age*15)*strength,flash:Math.exp(-age*25)*strength,lift:Math.max(0,Math.sin(age*14))*Math.exp(-age*9)*strength*.08,wobble};
}
