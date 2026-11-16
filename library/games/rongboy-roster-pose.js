import {updateActionGear} from './rongboy-action-gear.js';
// Representative model-review poses. Combat state machines remain authoritative in game scenes.
export function poseRosterFigurine(actor,time=0,moving=false){
 actor.reset();actor.tilt.position.y=0;actor.tilt.scale.setScalar(1);actor.world.position.y=0;
 const kind=actor.nativeVariant||actor.kind,part=name=>actor.parts.get(name),add=(name,axis,value)=>{const p=part(name);if(p)p.rotation[axis]+=value;};
 const period=kind==='runner'?8:kind==='heavy'||kind==='boss-warden'?3.6:5,t=time*period;
 const hop=moving?Math.max(0,Math.sin(t)):0;
 for(const name of ['ArmL','ArmR'])add(name,'x',-1.07);
 if(moving){actor.world.position.y=hop*(kind==='heavy'||kind==='boss-warden'?.06:.16);add('LegL','x',Math.sin(t)*.22);add('LegR','x',-Math.sin(t)*.22);add('Head','z',Math.sin(time*2)*.03);}
 if(kind==='runner'){for(const name of ['ArmL','ArmR'])add(name,'x',.45);add('Body','x',.15);if(moving){add('ArmL','x',Math.sin(t)*.20);add('ArmR','x',-Math.sin(t)*.20);}}
 if(kind==='weaver'){actor.tilt.rotation.z=moving?Math.sin(time*3)*.11:-.07;add('ArmL','z',-.10);add('ArmR','z',.10);}
 if(kind==='leaper'){add('ArmL','x',-.20);add('ArmR','x',-.20);if(moving){actor.world.position.y=hop*.35;add('LegL','x',hop*.5);add('LegR','x',hop*.5);}}
 if(kind==='crawler'){actor.world.position.y=moving?Math.abs(Math.sin(t))*.025:0;for(const name of ['ArmL','ArmR'])part(name).rotation.x=actor.rest.get(name).r.x;add('Body','z',moving?Math.sin(t)*.035:0);if(moving){add('ArmL','x',Math.sin(t)*.10);add('ArmR','x',-Math.sin(t)*.10);}}
 if(kind==='shielded'){part('ArmL').rotation.x=actor.rest.get('ArmL').r.x;add('ArmR','x',.12);add('Body','y',-.06);}
 if(kind==='bomber'){part('ArmL').rotation.x=actor.rest.get('ArmL').r.x-.70;part('ArmR').rotation.x=actor.rest.get('ArmR').r.x-(moving?1.1+Math.sin(time*3)*.8:1.0);add('Body','z',moving?Math.sin(time*3)*.07:0);}
 if(kind==='spawner'){actor.world.position.y=0;for(const name of ['ArmL','ArmR'])part(name).rotation.x=actor.rest.get(name).r.x-.20;add('Head','z',moving?Math.sin(time*2)*.045:0);}
 if(kind==='archer'){part('ArmL').rotation.x=actor.rest.get('ArmL').r.x-Math.PI/2;part('ArmR').rotation.x=actor.rest.get('ArmR').r.x-1.0;add('ArmR','y',-.78-(moving?(Math.sin(time*3)*.5+.5)*.25:0));add('Body','y',-.12);}
 if(kind==='boss-warden'){add('ArmL','x',.55);add('ArmR','x',.55);add('Head','y',moving?Math.sin(time)*.10:0);}
 if(kind==='heavy'){add('ArmL','x',.4);add('ArmR','x',.4);}
 if(kind==='boss-leech'){actor.world.position.y=moving?Math.sin(time*2)*.015:0;add('ArmL','z',-.18);add('ArmR','z',.18);add('Head','z',moving?Math.sin(time*1.6)*.04:0);}
 updateActionGear(actor,{draw:kind==='archer'?(moving?(Math.sin(time*3)*.5+.5):.35):0,arrow:true,bomb:true});
}
