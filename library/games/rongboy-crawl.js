// One low, four-beat gait for the gameplay actor and its turntable.
// Phase advances in metres travelled; a resting paw sweeps backwards at ground speed.
const STRIDE = .50;
const STANCE = .72;
const LIMBS = [['ArmL',0], ['LegR',.25], ['ArmR',.5], ['LegL',.75]];
const floorProfiles = new WeakMap();
const MAX_ANGLE = .68, SAMPLES = 32;

function groundProfile(geometry) {
  if (floorProfiles.has(geometry)) return floorProfiles.get(geometry);
  // Batching has already expressed these vertices in the joint's local frame.
  // Sample the sole as it rolls, rather than treating a long mitten as a point.
  const positions = geometry.getAttribute('position');
  const floor = new Float32Array(SAMPLES+1);
  for (let i=0; i<=SAMPLES; i++) {
    const angle = (2*i/SAMPLES-1)*MAX_ANGLE;
    const cs=Math.cos(angle), sn=Math.sin(angle);
    let lowest=Infinity;
    for (let j=0; j<positions.count; j++) {
      lowest=Math.min(lowest,cs*positions.getY(j)-sn*positions.getZ(j));
    }
    floor[i]=lowest;
  }
  floorProfiles.set(geometry,floor);
  return floor;
}

function bottomAt(profiles, angle) {
  const index=(angle/MAX_ANGLE+1)*SAMPLES/2;
  const i=Math.min(SAMPLES-1,Math.floor(index)), t=index-i;
  let floor=Infinity;
  for (const values of profiles) floor=Math.min(floor,values[i]*(1-t)+values[i+1]*t);
  return floor;
}

export function poseCrawl(actor, distance=0, weight=1, action='chase', age=0) {
  const cycle=distance/STRIDE;
  const windup=action==='crawler-windup' ? Math.min(1,age/.3) : 0;
  const swipe=action==='crawler-strike' ? Math.sin(Math.PI*Math.min(1,age/.36)) : 0;
  const yaw=Math.sin(cycle*Math.PI*2)*weight;
  const body=actor.parts.get('Body'), head=actor.parts.get('Head');
  body.rotation.y+=.09*yaw;
  body.position.x+=.034*yaw;
  head.rotation.y-=.08*yaw;
  head.position.z+=.052*swipe-.028*windup;
  body.position.y-=.025*windup;
  for (const [name,offset] of LIMBS) {
    const part=actor.parts.get(name), rest=actor.rest.get(name);
    const phase=(cycle+offset)%1;
    const swing=Math.max(0,(phase-STANCE)/(1-STANCE));
    const forward=(STANCE/2-phase+swing*swing*(3-2*swing))*STRIDE*weight;
    const lift=.067*Math.sin(Math.PI*swing)**2*weight;
    const profiles=part.children.filter(o=>o.isMesh&&!o.userData.fuzz).map(o=>groundProfile(o.geometry));
    if (!profiles.length) continue;
    const bottom=bottomAt(profiles,0);
    const reach=forward/actor.model.scale.z+(name==='ArmR'?.14*swipe:0);
    const angle=Math.max(-MAX_ANGLE,Math.min(MAX_ANGLE,-Math.asin(Math.min(.93,Math.max(-.93,reach/(-bottom*rest.s.y))))));
    part.rotation.copy(rest.r); part.rotation.x+=angle;
    part.position.copy(rest.p);
    part.position.y+=(bottom-bottomAt(profiles,angle))*rest.s.y+lift/actor.model.scale.y;
  }
}
