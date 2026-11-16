import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const ACTOR_SCALE=.78;
function decode(s){if(s instanceof Uint8Array)return s.buffer.slice(s.byteOffset,s.byteOffset+s.byteLength);const raw=atob(s),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a.buffer;}
const isRig=o=>!!o.userData.part&&!o.isMesh&&!o.name.startsWith('Mesh');
const isMechanism=o=>!!o.userData.mechanism&&!o.isMesh;
const isBatchRoot=o=>isRig(o)||isMechanism(o);
function fuzzMaterial(){
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide,transparent:true,opacity:.48,depthWrite:false,alphaTest:.012});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 woolNormal; varying vec3 vWoolRootNormal;').replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvWoolRootNormal = normalMatrix * woolNormal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWoolRootNormal;').replace('#include <alphatest_fragment>','diffuseColor.a *= smoothstep(0.45, 0.85, 1.0 - abs(dot(normalize(vWoolRootNormal), normalize(vViewPosition))));\n#include <alphatest_fragment>');
 };material.customProgramCacheKey=()=> 'rongboy-short-edge-wool-v2';return material;
}
// Recover growth direction from the narrow root edge of each hair triangle.
function woolNormals(g){const position=g.getAttribute('position'),directions=new Float32Array(position.count*3),points=[new T.Vector3(),new T.Vector3(),new T.Vector3()],direction=new T.Vector3();for(let i=0;i<position.count;i+=3){for(let j=0;j<3;j++)points[j].fromBufferAttribute(position,i+j);const d=[points[0].distanceToSquared(points[1]),points[1].distanceToSquared(points[2]),points[2].distanceToSquared(points[0])];const pair=d.indexOf(Math.min(...d)),a=pair,b=(pair+1)%3,tip=(pair+2)%3;direction.copy(points[tip]).sub(points[a].clone().add(points[b]).multiplyScalar(.5)).normalize();for(let j=0;j<3;j++)direction.toArray(directions,(i+j)*3);}g.setAttribute('woolNormal',new T.BufferAttribute(directions,3));}
const textureKey=t=>t?[t.source?.uuid||t.uuid,t.mapping,t.channel,t.colorSpace,t.wrapS,t.wrapT,t.minFilter,t.magFilter,...t.repeat.toArray(),...t.offset.toArray(),...t.center.toArray(),t.rotation,t.flipY].join(':'):'-';
export function optimizeFigurine(root){root.updateMatrixWorld(true);const nodes=[];root.traverse(o=>{if(isBatchRoot(o))nodes.push(o);});const canon=new Map();const fuzzMat=fuzzMaterial();
 for(const part of nodes){const groups=new Map(),hair=[],gearLabels=new Set(part.userData.gearLabels||[]);const inverse=part.matrixWorld.clone().invert();function visit(o,fuzz=false){if(o!==part&&isBatchRoot(o))return;if(o.userData.gear)gearLabels.add(o.userData.gear);fuzz ||=!!o.userData.fuzz||o.name.startsWith('fuzz');if(o.isMesh){let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const n of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(n))g.deleteAttribute(n);g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
 if(fuzz){g.deleteAttribute('uv');g.deleteAttribute('tangent');const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=o.material.color.r;colors[i+1]=o.material.color.g;colors[i+2]=o.material.color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));woolNormals(g);hair.push(g);}else{const m=o.material,k=[textureKey(m.map),textureKey(m.normalMap),m.normalScale?.toArray().join(','),m.roughness,m.metalness,m.sheen||0,m.sheenRoughness,m.sheenColor?.getHexString(),m.side,m.opacity,m.alphaTest,m.emissive?.getHexString()].join('|');
 // Base colours are exact per vertex. Constant-colour V2 cloth can share a draw call
 // without the coloured UV atlas that made the close-up faces look mottled.
 const existing=g.getAttribute('color'),colors=new Float32Array(g.attributes.position.count*3),base=m.color||new T.Color(0xffffff);
 for(let i=0;i<g.attributes.position.count;i++){colors[i*3]=base.r*(existing?existing.getX(i):1);colors[i*3+1]=base.g*(existing?existing.getY(i):1);colors[i*3+2]=base.b*(existing?existing.getZ(i):1);}g.setAttribute('color',new T.BufferAttribute(colors,3));
 if(!canon.has(k)){const material=m.clone();material.color.setHex(0xffffff);material.vertexColors=true;canon.set(k,material);}if(!groups.has(k))groups.set(k,[]);groups.get(k).push(g);}return;}for(const c of o.children)visit(c,fuzz);}visit(part);part.userData.gearLabels=[...gearLabels];
 const remove=[];function collect(o){if(o!==part&&isBatchRoot(o))return;if(o.isMesh){remove.push(o);return;}for(const c of o.children)collect(c);}collect(part);for(const o of remove)o.removeFromParent();
 for(const [key,gs]of groups){for(const g of gs)g.deleteAttribute('tangent');const g=mergeGeometries(gs,false);if(!g)throw new Error('Native model merge failed');const mesh=new T.Mesh(g,canon.get(key));mesh.castShadow=mesh.receiveShadow=true;part.add(mesh);for(const q of gs)q.dispose();}
 if(hair.length){const g=mergeGeometries(hair,false);const mesh=new T.Mesh(g,fuzzMat);mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.fuzz=true;part.add(mesh);for(const q of hair)q.dispose();}
 }
 return root;
}
// Early walker GLBs lost empty-node pivots during export. Rebase the children without
// changing the bind pose; reaching and knee bends must rotate at the joints, not the floor.
export function repairWalkerRig(root){
 const pivots={Body:[0,.70,0],Head:[0,1.25,.015],ArmL:[-.30,1.23,0],ArmR:[.30,1.23,0],LegL:[-.18,.66,-.02],LegR:[.18,.66,-.02]};
 root.traverse(o=>{const p=pivots[o.userData.part];if(!p||!isRig(o)||o.position.lengthSq()>.000001)return;const shift=new T.Vector3(...p);for(const child of o.children)child.position.sub(shift);o.position.copy(shift);});root.updateMatrixWorld(true);return root;
}
// Native prefab roster; only requested templates are optimized.
export async function loadFigurines(data){
 const loader=new GLTFLoader();const [hero,zombies]=await Promise.all([data.scout?loader.parseAsync(decode(data.scout),''):null,loader.parseAsync(decode(data.zombies||data.walker),'')]);
 const templates={},raw=new Map();if(hero)templates.scout=optimizeFigurine(hero.scene);
 if(data.zombies){for(const root of zombies.scene.children)if(root.userData.zombieType)raw.set(root.userData.zombieType,root);if(!raw.size)throw new Error('Expected native zombie prefabs');}
 else templates.walker=repairWalkerRig(optimizeFigurine(zombies.scene));
 const resolve=kind=>kind==='tank'?'heavy':kind==='runner'||kind==='weaver'?'leaper':kind;
 function template(kind){const id=resolve(kind);if(!templates[id]){const root=raw.get(id);if(!root)throw new Error('Unknown figurine: '+kind);templates[id]=optimizeFigurine(root);}return templates[id];}
 return {templates,kinds:[...(hero?['scout']:[]),...(raw.size?raw.keys():['walker'])],create(kind){
  const id=resolve(kind),model=template(id).clone(true),world=new T.Group(),tilt=new T.Group();world.add(tilt);tilt.add(model);model.scale.setScalar(ACTOR_SCALE);model.position.y=-.017;
  const parts=new Map(),rest=new Map(),materials=new Map(),gear=new Map(),mechanisms=new Map(),mechanismRest=new Map();
  model.traverse(o=>{
   if(isRig(o)){if(parts.has(o.userData.part))throw new Error('Duplicate native pivot: '+o.userData.part);parts.set(o.userData.part,o);for(const name of o.userData.gearLabels||[])gear.set(name,o);rest.set(o.userData.part,{p:o.position.clone(),r:o.rotation.clone(),s:o.scale.clone()});}
   if(o.userData.gear)gear.set(o.userData.gear,o);
   if(isMechanism(o)){mechanisms.set(o.userData.mechanism,o);mechanismRest.set(o.userData.mechanism,{p:o.position.clone(),r:o.rotation.clone(),s:o.scale.clone()});}
   if(o.isMesh){if(!materials.has(o.material.uuid)){const material=o.material.clone();material.onBeforeCompile=o.material.onBeforeCompile;material.customProgramCacheKey=o.material.customProgramCacheKey;materials.set(o.material.uuid,material);}o.material=materials.get(o.material.uuid);o.frustumCulled=false;}
  });
  return {world,tilt,model,parts,rest,gear,mechanisms,mechanismRest,materials:[...materials.values()],kind:id,nativeVariant:raw.has(id)?id:null,
   reset(){for(const [n,o]of parts){const r=rest.get(n);o.position.copy(r.p);o.rotation.copy(r.r);o.scale.copy(r.s);}for(const [n,o]of mechanisms){const r=mechanismRest.get(n);o.position.copy(r.p);o.rotation.copy(r.r);o.scale.copy(r.s);}tilt.quaternion.identity();model.position.y=-.017;},
   dispose(){for(const m of materials.values())m.dispose();this.bowString?.geometry.dispose();this.bowString?.material.dispose();},
   flash(n){for(const m of materials.values())m.emissive?.setRGB(n*.25,n*.15,n*.06);}};
 }};
}
function noiseTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128);let seed=13;for(let i=0;i<im.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=150+(seed>>>26);im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}ctx.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(8,8);return t;}
export function woolMaterial(color){return new T.MeshPhysicalMaterial({color,roughness:.97,sheen:.65,sheenColor:new T.Color(0xffedc9),sheenRoughness:.85,bumpMap:noiseTexture(),bumpScale:.018});}
function stroke(points,material,r=.008){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return new T.Mesh(new T.TubeGeometry(curve,Math.max(6,points.length*3),r,4,false),material);}
export function buildWoolArena(scene){const group=new T.Group();scene.add(group);const felt=woolMaterial(0x657a4d),wood=new T.MeshStandardMaterial({color:0x75543b,roughness:.82}),thread=new T.MeshStandardMaterial({color:0xded0a2,roughness:1});const mesh=(g,m,p)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=o.receiveShadow=true;group.add(o);return o;};mesh(new RoundedBoxGeometry(9.8,.25,7.55,4,.15),wood,[0,-.20,0]);mesh(new RoundedBoxGeometry(9.4,.15,7.2,4,.15),felt,[0,-.075,0]);const floor=new T.MeshStandardMaterial({color:0xc1b59a,roughness:.98});mesh(new T.PlaneGeometry(200,200),floor,[0,-.36,0]).rotation.x=-Math.PI/2;
 for(const sign of [-1,1]){for(let i=0;i<75;i++){const x=-4.35+i*.117;group.add(stroke([[x,.014,sign*3.39],[x+.057,.016,sign*3.39]],thread,.007));}for(let i=0;i<56;i++){const z=-3.22+i*.117;group.add(stroke([[sign*4.49,.014,z],[sign*4.49,.016,z+.057]],thread,.007));}}
 // Thread spools decorate the rim, outside collision bounds.
 const rust=woolMaterial(0xb87752),oat=woolMaterial(0xd7c18b);for(const [x,z,mat]of [[-4.60,-2.6,oat],[4.55,-2.8,rust],[-4.57,2.7,rust]]){mesh(new T.CylinderGeometry(.15,.15,.30,20),mat,[x,.16,z]);for(const y of [.02,.33])mesh(new T.CylinderGeometry(.21,.21,.045,20),wood,[x,y,z]);}
 // Merge all static meshes per material, preserving authoring shape and UV.
 group.updateMatrixWorld(true);const by=new Map();group.traverse(o=>{if(!o.isMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!by.has(o.material))by.set(o.material,[]);by.get(o.material).push(g);});group.clear();for(const [m,gs]of by){const g=mergeGeometries(gs,false),o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;group.add(o);for(const q of gs)q.dispose();}return group;
}
export function createWoolBall(){const g=new T.Group(),mat=woolMaterial(0xf3dfa5),core=new T.Mesh(new T.SphereGeometry(1,16,12),mat);g.add(core);const yarn=new T.MeshStandardMaterial({color:0xe4c989,roughness:1});const points=[];for(let i=0;i<=120;i++){const t=i/120*Math.PI*8,phi=i/120*Math.PI;points.push([Math.cos(t)*Math.sin(phi)*1.015,Math.cos(phi)*1.015,Math.sin(t)*Math.sin(phi)*1.015]);}g.add(stroke(points,yarn,.035));const vertices=[];let seed=41;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);for(let i=0;i<180;i++){const y=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-y*y),p=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r),tip=p.clone().multiplyScalar(1.05+rnd()*.12),side=p.clone().cross(new T.Vector3(.2,.7,.4)).normalize().multiplyScalar(.012);vertices.push(...p.clone().sub(side).toArray(),...p.clone().add(side).toArray(),...tip.toArray());}const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();g.add(new T.Mesh(geo,new T.MeshStandardMaterial({color:0xf5e5bd,roughness:1,side:T.DoubleSide})));return g;}
export function createLauncher(){const group=new T.Group(),cream=woolMaterial(0xd9c88f),rust=woolMaterial(0xad684a),dark=new T.MeshStandardMaterial({color:0x473c2e,roughness:.8}),wood=new T.MeshStandardMaterial({color:0x906641,roughness:.8});const cylinder=(r,len,mat,z)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,len,24),mat);o.rotation.x=Math.PI/2;o.position.z=z;group.add(o);return o;};cylinder(.235,.51,cream,.08);cylinder(.245,.055,rust,.35);cylinder(.18,.04,dark,.384);cylinder(.13,.045,cream,.407);const base=new T.Mesh(new RoundedBoxGeometry(.42,.19,.30,3,.05),wood);base.position.set(0,-.12,-.06);group.add(base);for(const s of [-1,1]){const grip=new T.Mesh(new T.SphereGeometry(.10,10,8),rust);grip.position.set(s*.26,-.04,0);group.add(grip);}group.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});return group;}
