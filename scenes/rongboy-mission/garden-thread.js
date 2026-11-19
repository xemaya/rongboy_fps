import * as T from 'three';

// Draw a short length of wool along the simulated ball path, including the corner
// of each rebound. The visual has no collision or aiming privileges.
export function gardenThread(scene, reduced){
  const capacity=96, life=reduced?.12:.22;
  const mesh=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,6),new T.MeshBasicMaterial({color:0xffffff}),capacity);
  mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);
  const last=new Map(),segments=Array(capacity),dummy=new T.Object3D(),up=new T.Vector3(0,1,0),dir=new T.Vector3();
  const incoming=new T.Color(0xe3be76),outgoing=new T.Color(0xaaf4dd);
  let cursor=0;
  function sample(id,p,now,turn=false){
    const prior=last.get(id),end=new T.Vector3(p.x,p.y,p.z);
    if(prior && prior.pt.distanceToSquared(end)>.000015){
      segments[cursor]={a:prior.pt,b:end,born:now,rebound:prior.rebound};
      cursor=(cursor+1)%capacity;
    }
    last.set(id,{pt:end,rebound:turn||!!prior?.rebound});
  }
  return {
    event(e,now){
      if(e.type==='bounce')sample(e.id,e,now,e.kind==='solid' || e.kind==='edge');
      if(e.type==='ball-expired'){sample(e.id,e,now);last.delete(e.id);}
    },
    update(balls,now){
      for(const b of balls)if(!b.destroyed)sample(b.id,b,now);
      let n=0;
      for(const seg of segments){
        if(!seg)continue;
        const fade=1-(now-seg.born)/life;
        if(fade<=0)continue;
        dir.subVectors(seg.b,seg.a);const length=dir.length();
        dummy.position.lerpVectors(seg.a,seg.b,.5);dummy.quaternion.setFromUnitVectors(up,dir.normalize());
        const radius=(seg.rebound?.027:.015)*fade;
        dummy.scale.set(radius,length,radius);dummy.updateMatrix();
        mesh.setMatrixAt(n,dummy.matrix);mesh.setColorAt(n++,seg.rebound?outgoing:incoming);
      }
      mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    },
    reset(){last.clear();segments.fill(null);cursor=0;mesh.count=0;},
  };
}
