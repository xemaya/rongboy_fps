import {updateActionGear} from '../../library/games/rongboy-action-gear.js';
// These poses read actual attack timers. Equipment stays parented to its native joint.
export function applyAttackPose(e,a){
 const p=n=>a.parts.get(n),rest=n=>a.rest.get(n),x=(n,v)=>{if(p(n))p(n).rotation.x=rest(n).r.x+v;};
 const phase=e.actionAge||0;
 if(e.type==='crawler'){x('LegL',Math.sin(e.age*6)*.06);x('LegR',-Math.sin(e.age*6)*.06);x('ArmL',e.action==='crawler-strike'?-.25:Math.sin(e.age*6)*.07);x('ArmR',e.action==='crawler-strike'?-.25:-Math.sin(e.age*6)*.07);if(p('Body'))p('Body').rotation.z+=Math.sin(e.age*6)*.025;}
 if(e.type==='shielded'){x('ArmL',e.guardBroken>0?-.8:0);if(e.action==='shield-windup'&&p('Body'))p('Body').rotation.x-=.16;if(e.guardBroken>0&&p('Body'))p('Body').rotation.y+=.22;}
 if(e.type==='archer'){x('ArmL',-Math.PI/2);x('ArmR',e.action==='archer-aim'?-1.05:-.75);if(p('ArmR'))p('ArmR').rotation.y-=e.action==='archer-aim'?.78+Math.min(1,phase/.95)*.25:.60;}
 if(e.type==='bomber'){x('ArmL',-.75);x('ArmR',e.action==='bomber-throw'?-1.0-Math.sin(Math.min(1,phase/.95)*Math.PI)*1.15:-.55);if(p('Body')&&e.action==='bomber-throw')p('Body').rotation.y+=Math.sin(phase*3)*.10;}
 if(e.type==='spawner'){x('LegL',0);x('LegR',0);x('ArmL',e.action==='spawner-call'?-.65:-.2);x('ArmR',e.action==='spawner-call'?-.65:-.2);if(p('Head'))p('Head').rotation.z+=Math.sin(phase*9)*.025;}
 if(e.type==='boss-warden'&&(e.action==='warden-windup'||e.action==='warden-call')){x('ArmL',-1.9);x('ArmR',-1.9);if(p('Body'))p('Body').rotation.x-=.12;}
 if(e.type==='boss-leech'){const pull=e.action==='leech-pull';x('ArmL',pull?-1.4+Math.min(1,phase/.65)*.6:e.action==='leech-windup'?-1.5:-1.12);x('ArmR',pull?-1.4+Math.min(1,phase/.65)*.6:e.action==='leech-windup'?-1.5:-1.12);if(p('ArmL'))p('ArmL').rotation.z-=.16;if(p('ArmR'))p('ArmR').rotation.z+=.16;}
 updateActionGear(a,{draw:e.action==='archer-aim'?Math.min(1,phase/.85):0,target:e.type==='archer'?{x:e.aimX??e.x,y:1,z:e.aimZ??e.z+5}:null,arrow:e.action==='archer-aim',bomb:e.action==='bomber-throw'});
}
