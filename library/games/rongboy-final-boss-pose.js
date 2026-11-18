// Attack and gallery use the same curves. The floor event occurs at the end of windup.
import {ATTACKS} from '../../scenes/rongboy-mission/attacks.js';

const clamp01=x=>Math.max(0,Math.min(1,x));
function ease(x){const t=clamp01(x);return t*t*(3-2*t);}
export function finalBossPose(a,action,age,clock,recoverFrom=''){
  const warden=a.kind==='boss-warden',body=a.parts.get('Body');
  if(warden){
    const walk=action==='chase'?Math.sin(clock*3.65):0;
    const t=clamp01(age/ATTACKS['boss-warden'].windup);
    const winding=action==='warden-windup';
    const rise=winding?ease(t/.59)*(1-ease((t-.82)/.18)):0;
    const impact=winding?ease((t-.82)/.18):action==='special-recover'&&recoverFrom==='warden-windup'?1-ease(age/.58):0;
    const call=action==='warden-call'?ease(age/.38):0;
    for(const side of [-1,1]){
      const key=side<0?'ArmL':'ArmR',arm=a.parts.get(key),rest=a.rest.get(key);
      arm.rotation.copy(rest.r);
      arm.rotation.x=-.13-2.20*rise+.12*side*walk-.72*call;
      arm.rotation.z+=side*(.06+.12*rise+.40*call);
      arm.position.y-=.365*impact;
      const leg=a.parts.get(side<0?'LegL':'LegR');leg.rotation.x+=side*.12*walk;
    }
    body.position.y-=.17*impact;
    body.rotation.x+=.10*impact-.095*rise;
    body.rotation.z+=.031*walk;
    return;
  }
  const pull=action==='leech-pull',charging=action==='leech-windup';
  const poised=charging?ease(age/ATTACKS['boss-leech'].windup):0;
  const release=action==='special-recover'&&recoverFrom==='leech-pull'?1-ease(age/.48):0;
  const retract=pull?ease(age/.65):release;
  const stretch=poised+(pull?1-.80*retract:0)+release*.20;
  const sway=Math.sin(clock*2.7);
  for(const side of [-1,1]){
    const suffix=side<0?'L':'R',key='Arm'+suffix,arm=a.parts.get(key);
    const elbow=a.mechanisms.get('hoseElbow'+suffix),cup=a.mechanisms.get('suctionCup'+suffix);
    const wave=.105*Math.sin(clock*3.1+side*.8);
    arm.rotation.copy(a.rest.get(key).r);
    arm.rotation.x=-.10-.86*stretch-.43*retract;
    arm.rotation.z=side*(.10+.14*poised+wave);
    arm.scale.y*=1+.21*stretch;
    elbow.rotation.x=-.14-.48*stretch+.35*retract;
    elbow.rotation.z=side*(-.10+.14*sway);
    cup.rotation.x=a.mechanismRest.get('suctionCup'+suffix).r.x-arm.rotation.x-elbow.rotation.x;
    const pulse=pull?.07*Math.sin(age*18):0;
    cup.scale.setScalar(1+.10*stretch+pulse);
  }
  body.rotation.z+=.049*sway;
  body.rotation.x-=.16*retract;
}

export function galleryBossPose(a,time,moving){
  const warden=a.kind==='boss-warden',wind=warden?'warden-windup':'leech-windup';
  const lead=ATTACKS[a.kind].windup,t=time%(warden?3.45:4.05);
  if(!moving||t<.70){finalBossPose(a,'chase',0,moving?time:0);return;}
  const age=t-.70;
  if(age<lead){finalBossPose(a,wind,age,time);return;}
  if(!warden&&age<lead+.65){finalBossPose(a,'leech-pull',age-lead,time);return;}
  finalBossPose(a,'special-recover',age-lead-(warden?0:.65),time,warden?wind:'leech-pull');
}
