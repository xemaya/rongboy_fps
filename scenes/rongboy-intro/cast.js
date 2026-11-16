import * as T from 'three';
import {loadFigurines,createWoolBall} from '../../library/games/rongboy-runtime.js';
import {createWeaponKit} from '../../library/games/rongboy-workshop.js';
import {updateActionGear} from '../../library/games/rongboy-action-gear.js';
import scout from '../../assets/rongboy/runtime-v2/scout.glb';
import zombies from '../../assets/rongboy/zombies-v5/zombie-roster.glb';
import {HERO,HERO_HEADING,FINAL_HEADING,WALKER,SIT,BALL_PATH,HIT_TIME,SHOT_TIME,smooth,lerp,mix3} from './timeline.js';
const v=new T.Vector3(),target=new T.Vector3();
const scalar=(a,name,axis,value)=>{const p=a.parts.get(name);if(p)p.rotation[axis]+=value;};
function attachWeapon(a){const gun=createWeaponKit();gun.position.set(0,.24,.40);a.parts.get('CTRL / body').add(gun);const loaded=createWoolBall();loaded.position.z=.65;loaded.scale.setScalar(.14);gun.add(loaded);a.gun=gun;loaded.children[0].material.color.setHex(0xe7c567);loaded.children[1].material.color.setHex(0xbc8b45);a.loaded=loaded;return gun;}
function holdWeapon(a){ a.world.updateWorldMatrix(true,true);for(const sign of [-1,1]){const arm=a.parts.get('CTRL / arm '+sign),rest=a.rest.get('CTRL / arm '+sign),palm=new T.Vector3(sign*.121,-.427,.075),grip=a.gun.localToWorld(new T.Vector3(sign*.26,-.04,0)),direction=arm.parent.worldToLocal(grip).sub(arm.position);arm.quaternion.setFromUnitVectors(palm.clone().normalize(),direction.clone().normalize());arm.scale.copy(rest.s).multiplyScalar(Math.max(.85,Math.min(1.35,direction.length()/palm.length())));}}
// Cinematic-only ankle pivots preserve every existing triangle and material. This
// lets a soft toy sit with its slippers flat instead of rotating the whole boot.
function splitLower(parent,cut,offset){const pivot=new T.Group();pivot.position.fromArray(offset);parent.add(pivot);for(const mesh of parent.children.filter(o=>o.isMesh)){const src=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,ids=[[],[]],pos=src.attributes.position;for(let i=0;i<pos.count;i+=3){const y=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3;ids[y<cut?1:0].push(i,i+1,i+2);}for(let side=0;side<2;side++){if(!ids[side].length)continue;const g=new T.BufferGeometry();for(const [key,attr]of Object.entries(src.attributes)){const arr=new Float32Array(ids[side].length*attr.itemSize);for(let j=0;j<ids[side].length;j++)for(let c=0;c<attr.itemSize;c++)arr[j*attr.itemSize+c]=attr.array[ids[side][j]*attr.itemSize+c];g.setAttribute(key,new T.BufferAttribute(arr,attr.itemSize));}if(side)g.translate(-offset[0],-offset[1],-offset[2]);const piece=mesh.clone();piece.geometry=g;(side?pivot:parent).add(piece);}mesh.removeFromParent();}return pivot;}
function ankles(a){return ['LegL','LegR'].map(name=>{const leg=a.parts.get(name),source=leg.children.find(m=>m.isMesh&&!m.userData.fuzz),cloth=source.material.clone();cloth.vertexColors=false;cloth.color.setHex(0x6e6470);a.materials.push(cloth);const knee=splitLower(leg,-.27,[0,-.27,0]),ankle=splitLower(knee,-.115,[0,-.15,.04]),caps=[];for(const [pivot,r]of [[knee,.16],[ankle,.13]]){const cap=new T.Mesh(new T.SphereGeometry(r,24,16),cloth);cap.castShadow=cap.receiveShadow=true;pivot.add(cap);caps.push(cap);}return{knee,ankle,caps};});}
export async function createIntroCast(scene){
 const factory=await loadFigurines({scout,zombies}),hero=factory.create('scout'),walker=factory.create('walker'),bomber=factory.create('bomber'),archer=factory.create('archer'),hands=factory.create('scout');
 for(const a of [hero,walker,bomber,archer])scene.add(a.world);attachWeapon(hero);attachWeapon(hands);
 hands.model.traverse(o=>{if(!o.isMesh)return;let n=o,arm=false,weapon=false;while(n&&n!==hands.model){arm ||=n.userData.part?.startsWith('CTRL / arm ');weapon ||=n===hands.gun;n=n.parent;}o.visible=arm||weapon;o.castShadow=false;});
 const footPivots=ankles(walker),ball=createWoolBall();ball.scale.setScalar(.15);ball.children[0].material.color.setHex(0xe7c567);ball.children[1].material.color.setHex(0xbc8b45);ball.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(ball);
 const puffGeo=new T.SphereGeometry(1,6,4),puffMat=new T.MeshStandardMaterial({color:0xe5d5b2,roughness:1,transparent:true,opacity:.8}),puffs=new T.InstancedMesh(puffGeo,puffMat,22),dummy=new T.Object3D();puffs.frustumCulled=false;scene.add(puffs);
 function poseHero(s){hero.reset();hero.world.position.fromArray(HERO);hero.world.rotation.y=lerp(HERO_HEADING,FINAL_HEADING,s.ready);scalar(hero,'CTRL / head','y',-.70-s.startle*.38+s.ready*.38);scalar(hero,'CTRL / head','x',.10*(1-s.startle)+s.startle*-.06);
  for(const sign of [-1,1]){scalar(hero,'CTRL / arm '+sign,'x',-1.05-s.recoil*.12);scalar(hero,'CTRL / arm '+sign,'z',-sign*.43);}
  scalar(hero,'CTRL / body','z',s.startle*-.025*(1-smooth(11.8,12.1,s.t))+s.recoil*.035);scalar(hero,'CTRL / head','z',s.startle*.06);hero.gun.position.set(0,.24+s.recoil*.018,.40-s.recoil*.035);
  hero.gun.position.set(0,.24+.26*s.ready+s.recoil*.018,.40+.15*s.ready-s.recoil*.035);hero.gun.rotation.set(.0082*s.ready-s.recoil*.04,0,0);
  holdWeapon(hero);
  hero.loaded.visible=s.t<SHOT_TIME;hero.loaded.scale.setScalar(.14);hero.loaded.scale.z*=1-.18*s.load;hero.loaded.position.z=.49+.21*(1-s.load);hero.loaded.rotation.y=s.t*.7;
  // A gentle squeeze while loading, followed by a restrained nervous recovery.
  scalar(hero,'CTRL / arm -1','x',Math.sin(s.load*Math.PI)*.15);hero.world.position.y=Math.sin(s.t*2.2)*.004*(1-s.ready);
 }
 function poseWalker(s){walker.reset();walker.world.position.fromArray(s.walker);const toward=Math.atan2(HERO[0]-s.walker[0],HERO[2]-s.walker[2]);walker.world.rotation.y=lerp(toward,0,s.sit);walker.world.visible=s.t>6.2;const walk=s.t<9.4&&s.t>6.35?Math.sin((s.t-6.35)*Math.PI/.65):0;
  for(const [i,name]of ['ArmL','ArmR'].entries()){scalar(walker,name,'x',lerp(-1.00-s.reach*.28,-.65,s.sit)+walk*(i?.06:-.06));scalar(walker,name,'z',(i?1:-1)*(.05+s.reach*.08));scalar(walker,i?'LegR':'LegL','x',walk*(i?-.15:.15)-s.sit*.95);footPivots[i].knee.rotation.x=s.sit*.95;footPivots[i].ankle.rotation.x=0;for(const cap of footPivots[i].caps)cap.visible=s.sit>.02;}
  scalar(walker,'Head','x',-.10*(1-s.sit)+.18*s.sit);scalar(walker,'Head','z',s.reach*.08+s.sit*Math.sin((s.t-14.25)*11)*Math.exp(-Math.max(0,s.t-15.0)*2)*.06);
  const impact=s.t>HIT_TIME?Math.exp(-(s.t-HIT_TIME)*4)*Math.sin((s.t-HIT_TIME)*16):0;walker.tilt.rotation.z=impact*.16;walker.tilt.scale.set(1+impact*.025,1-impact*.04,1+impact*.025);
 }
 function poseEnemies(s){bomber.reset();archer.reset();bomber.world.position.set(1.78,0,-2.54);bomber.world.rotation.y=-.23;archer.world.position.set(-2.17,0,-2.90);archer.world.rotation.y=.12;bomber.world.visible=archer.world.visible=s.t>=20.5;
  const lift=s.threat;scalar(bomber,'ArmL','x',-.55-lift*.2);scalar(bomber,'ArmR','x',-.70-lift*.85);scalar(bomber,'Body','z',Math.sin(s.t*2)*.025*lift);scalar(bomber,'Head','z',-.06*lift);updateActionGear(bomber,{bomb:true});
  scalar(archer,'ArmL','x',-Math.PI/2);scalar(archer,'Head','y',.10*s.bow);updateActionGear(archer,{draw:s.bow,arrow:true,target:{x:HERO[0],y:1.18,z:HERO[2]}});
 }
 function update(s){poseHero(s);poseWalker(s);poseEnemies(s);ball.position.fromArray(s.ball);ball.visible=s.t>=SHOT_TIME;ball.rotation.set(s.t*3.1,0,s.t*2.3);
  const age=s.t-HIT_TIME;puffs.visible=age>=0&&age<.75;puffs.count=22;
  if(puffs.visible){puffMat.opacity=.85*(1-age/.75);for(let i=0;i<22;i++){const a=i*2.399,r=.3+((i*47)%17)/17*.65;dummy.position.set(WALKER[0]+Math.cos(a)*age*r,1.0+age*(.4+i%4*.18)-age*age*1.8,WALKER[2]+Math.sin(a)*age*r);dummy.scale.setScalar((.012+i%3*.006)*(1-age/.85));dummy.updateMatrix();puffs.setMatrixAt(i,dummy.matrix);}puffs.instanceMatrix.needsUpdate=true;}
  hero.world.visible=!s.pov;
 }
 function firstPerson(camera,s){hands.world.visible=s.pov;if(hands.world.parent!==camera)camera.add(hands.world);hands.reset();hands.world.position.set(0,-1.23,0);hands.model.rotation.y=Math.PI;for(const sign of [-1,1]){scalar(hands,'CTRL / arm '+sign,'x',-1.05);scalar(hands,'CTRL / arm '+sign,'z',-sign*.43);}hands.loaded.visible=false;hands.gun.position.set(0,.50,.55);hands.gun.rotation.set(0,0,0);holdWeapon(hands);}
 const probe=name=>{const s=last;return name==='walker.head'?[s.walker[0],s.walker[1]+1.25,s.walker[2]]:name==='walker.chest'?[s.walker[0],s.walker[1]+1.05,s.walker[2]]:[...HERO];};let last;
 return {hero,walker,bomber,archer,hands,ball,probe,update(s){last=s;update(s);},firstPerson};
}
