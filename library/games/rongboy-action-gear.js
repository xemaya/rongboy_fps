import * as T from 'three';
const p=new T.Vector3(),upper=new T.Vector3(),lower=new T.Vector3(),nockPoint=new T.Vector3();
// Mechanical props remain native editable nodes, independent of the six body joints.
export function updateActionGear(a,{draw=0,target=null,arrow=true,bomb=true}={}){
 const m=a.mechanisms;if(!m)return;
 if(m.has('heldBomb'))m.get('heldBomb').visible=bomb;
 const nock=m.get('bowNock'),up=m.get('bowUpper'),low=m.get('bowLower');if(!nock||!up||!low)return;
 const rest=a.mechanismRest.get('bowNock').p,back=m.get('bowBack');nock.position.copy(rest);if(back)nock.position.lerp(back.position,draw);
 // Determine the draw axis from the authored bow plane, rather than camera axes.
 a.world.updateMatrixWorld(true);up.getWorldPosition(upper);low.getWorldPosition(lower);nock.getWorldPosition(nockPoint);
 const hand=m.get('drawHand'),right=a.parts.get('ArmR');
 if(hand&&right){
  const desired=right.parent.worldToLocal(nockPoint.clone()).sub(right.position),base=a.mechanismRest.get('drawHand').p,restScale=a.rest.get('ArmR').s;
  right.quaternion.setFromUnitVectors(base.clone().normalize(),desired.clone().normalize());right.scale.copy(restScale).multiplyScalar(Math.max(.85,Math.min(1.35,desired.length()/(base.length()*restScale.x))));a.world.updateMatrixWorld(true);
 }
 if(!a.bowString){const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(9),3));a.bowString=new T.Line(g,new T.LineBasicMaterial({color:0xe8d9b7}));a.model.add(a.bowString);}
 if(m.has('nativeString'))m.get('nativeString').visible=false;
 const position=a.bowString.geometry.attributes.position;for(const [i,q]of [lower,nockPoint,upper].entries()){p.copy(q);a.model.worldToLocal(p);position.setXYZ(i,p.x,p.y,p.z);}position.needsUpdate=true;a.bowString.geometry.computeBoundingSphere();
 const held=m.get('heldArrow');if(held){held.visible=arrow;held.position.copy(nock.position);if(target&&Number.isFinite(target.x)&&Number.isFinite(target.z)){const localTarget=held.parent.worldToLocal(new T.Vector3(target.x,Number.isFinite(target.y)?target.y:1,target.z)).sub(held.position).normalize();held.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),localTarget);}}
}
