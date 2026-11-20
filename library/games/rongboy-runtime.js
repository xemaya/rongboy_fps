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
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 woolNormal; attribute float woolSurface; varying vec3 vWoolRootNormal; varying float vWoolSurface;').replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvec3 woolN = woolNormal;\n#ifdef USE_SKINNING\nwoolN = (skinMatrix * vec4(woolN, 0.0)).xyz;\n#endif\nvWoolRootNormal = normalMatrix * woolN; vWoolSurface=woolSurface;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWoolRootNormal; varying float vWoolSurface;').replace('#include <alphatest_fragment>','float woolRim=smoothstep(0.45, 0.85, 1.0 - abs(dot(normalize(vWoolRootNormal), normalize(vViewPosition)))); diffuseColor.a *= mix(woolRim, 1.35+.25*woolRim, vWoolSurface);\n#include <alphatest_fragment>');
 };material.customProgramCacheKey=()=> 'rongboy-curved-surface-wool-v3';return material;
}
// Recover growth direction from the narrow root edge of each hair triangle.
function woolNormals(g,surface=false){if(surface){g.setAttribute('woolNormal',g.getAttribute('normal').clone());return;}const position=g.getAttribute('position'),directions=new Float32Array(position.count*3),points=[new T.Vector3(),new T.Vector3(),new T.Vector3()],direction=new T.Vector3();for(let i=0;i<position.count;i+=3){for(let j=0;j<3;j++)points[j].fromBufferAttribute(position,i+j);const d=[points[0].distanceToSquared(points[1]),points[1].distanceToSquared(points[2]),points[2].distanceToSquared(points[0])];const pair=d.indexOf(Math.min(...d)),a=pair,b=(pair+1)%3,tip=(pair+2)%3;direction.copy(points[tip]).sub(points[a].clone().add(points[b]).multiplyScalar(.5)).normalize();for(let j=0;j<3;j++)direction.toArray(directions,(i+j)*3);}g.setAttribute('woolNormal',new T.BufferAttribute(directions,3));}
const textureKey=t=>t?[t.source?.uuid||t.uuid,t.mapping,t.channel,t.colorSpace,t.wrapS,t.wrapT,t.minFilter,t.magFilter,...t.repeat.toArray(),...t.offset.toArray(),...t.center.toArray(),t.rotation,t.flipY].join(':'):'-';
function feltFibreFinish(material){
 if(!material.normalMap)return;
 const prior=material.onBeforeCompile,oldKey=material.customProgramCacheKey(),fiberGain=material.userData.rongboy_felt_finish===2?'.65 + ':'';
 material.onBeforeCompile=(shader,renderer)=>{
  prior.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   #ifdef USE_NORMALMAP
    diffuseColor.rgb *= ${fiberGain}texture2D(normalMap,vNormalMapUv).a;
   #endif`);
 };
 material.customProgramCacheKey=()=>oldKey+'|rongboy-neutral-fibre-luminance-v7-'+(material.userData.rongboy_felt_finish||0);
}
export function optimizeFigurine(root,{skin=false}={}){root.updateMatrixWorld(true);const nodes=[];root.traverse(o=>{if(isBatchRoot(o))nodes.push(o);});const canon=new Map();const fuzzMat=fuzzMaterial();
 for(const part of nodes){const groups=new Map(),hair=[],gearLabels=new Set(part.userData.gearLabels||[]);const inverse=part.matrixWorld.clone().invert();function visit(o,fuzz=false){if(o!==part&&isBatchRoot(o))return;if(o.userData.gear)gearLabels.add(o.userData.gear);fuzz ||=!!o.userData.fuzz||o.name.startsWith('fuzz');if(o.isMesh){let g=fuzz?(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()):o.geometry.clone();if(!fuzz&&!g.index)g.setIndex([...Array(g.attributes.position.count).keys()]);for(const n of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(n))g.deleteAttribute(n);g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
 if(fuzz){g.deleteAttribute('uv');g.deleteAttribute('tangent');const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){const n=i/3,c=g.getAttribute('color');colors[i]=o.material.color.r*(c?c.getX(n):1);colors[i+1]=o.material.color.g*(c?c.getY(n):1);colors[i+2]=o.material.color.b*(c?c.getZ(n):1);}g.setAttribute('color',new T.BufferAttribute(colors,3));const surface=o.userData.wool_profile==='curled_surface';woolNormals(g,surface);g.setAttribute('woolSurface',new T.BufferAttribute(new Float32Array(g.attributes.position.count).fill(surface?1:0),1));hair.push(g);}else{const m=o.material,k=[textureKey(m.map),textureKey(m.normalMap),m.normalScale?.toArray().join(','),m.userData.rongboy_felt_finish||0,m.roughness,m.metalness,m.sheen||0,m.sheenRoughness,m.sheenColor?.getHexString(),m.side,m.opacity,m.alphaTest,m.emissive?.getHexString()].join('|');
 // Base colours are exact per vertex. Constant-colour V2 cloth can share a draw call
 // without the coloured UV atlas that made the close-up faces look mottled.
 const existing=g.getAttribute('color'),colors=new Float32Array(g.attributes.position.count*3),base=m.color||new T.Color(0xffffff);
 for(let i=0;i<g.attributes.position.count;i++){colors[i*3]=base.r*(existing?existing.getX(i):1);colors[i*3+1]=base.g*(existing?existing.getY(i):1);colors[i*3+2]=base.b*(existing?existing.getZ(i):1);}g.setAttribute('color',new T.BufferAttribute(colors,3));
 if(!canon.has(k)){const material=m.clone();material.color.setHex(0xffffff);material.vertexColors=true;feltFibreFinish(material);canon.set(k,material);}if(!groups.has(k))groups.set(k,[]);groups.get(k).push(g);}return;}for(const c of o.children)visit(c,fuzz);}visit(part);part.userData.gearLabels=[...gearLabels];
 const remove=[];function collect(o){if(o!==part&&isBatchRoot(o))return;if(o.isMesh){remove.push(o);return;}for(const c of o.children)collect(c);}collect(part);for(const o of remove)o.removeFromParent();
 for(const [key,gs]of groups){for(const g of gs)g.deleteAttribute('tangent');const g=mergeGeometries(gs,false);if(!g)throw new Error('Native model merge failed');const mesh=new T.Mesh(g,canon.get(key));mesh.castShadow=mesh.receiveShadow=true;part.add(mesh);for(const q of gs)q.dispose();}
 if(hair.length){const g=mergeGeometries(hair,false);const mesh=new T.Mesh(g,fuzzMat);mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.fuzz=true;part.add(mesh);for(const q of hair)q.dispose();}
 }
 if(skin)skinFigurine(root,nodes.filter(isRig));
 return root;
}
// 游戏里同屏十几只僵尸：每只 6 个关节 × 3 种布料 + 6 团绒毛 = 16 次绘制，影子再来一遍，差一点的机器光是提交绘制就吃掉一帧。
// 关节都是硬的（布偶的胳膊腿整块转），所以把同一种布料跨关节并成一块"刚性蒙皮"网格：每个顶点只跟一个关节，权重 1。
// 关节节点原样留着当骨头，所有摆姿势、攻击、爬行的代码照旧改 part.rotation/position，画出来一样，一只只剩 4 次绘制。
// 会单独显隐的机关（炸弹、箭、弓弦）不并。贴地爬行要的每个关节的底面轮廓另存在 root.rigGround 里。
function skinFigurine(root,rigs){
 if(!rigs.length)return;
 root.updateMatrixWorld(true);const rootInv=root.matrixWorld.clone().invert();
 const boneInverses=rigs.map(p=>new T.Matrix4().multiplyMatrices(rootInv,p.matrixWorld).invert());
 const byMaterial=new Map(),ground=new Map(),owners=new Map();
 rigs.forEach((part,bone)=>{
  const rel=boneInverses[bone].clone().invert(),normal=new T.Matrix3().getNormalMatrix(rel);
  for(const mesh of part.children.filter(o=>o.isMesh&&!o.isSkinnedMesh)){
   if(!mesh.userData.fuzz){const g=new T.BufferGeometry();g.setAttribute('position',mesh.geometry.getAttribute('position'));if(!ground.has(part.userData.part))ground.set(part.userData.part,[]);ground.get(part.userData.part).push(g);}
   const g=mesh.geometry.clone();g.applyMatrix4(rel);g.getAttribute('woolNormal')?.applyNormalMatrix(normal);
   const n=g.attributes.position.count,index=new Uint16Array(n*4),weight=new Float32Array(n*4);for(let i=0;i<n;i++){index[i*4]=bone;weight[i*4]=1;}
   g.setAttribute('skinIndex',new T.Uint16BufferAttribute(index,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weight,4));
   if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);byMaterial.get(mesh.material).push(g);
   if(!owners.has(mesh.material))owners.set(mesh.material,[]);owners.get(mesh.material).push(mesh);
  }
 });
 const skeleton=new T.Skeleton(rigs,boneInverses);
 for(const [material,gs]of byMaterial){
  const g=mergeGeometries(gs,false);if(!g){for(const q of gs)q.dispose();continue;}   // 属性对不上就保持原样（不并）
  const first=owners.get(material)[0],mesh=new T.SkinnedMesh(g,material);
  mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;if(first.userData.fuzz)mesh.userData.fuzz=true;
  mesh.bind(skeleton,new T.Matrix4());
  g.computeBoundingSphere();mesh.boundingSphere=g.boundingSphere.clone();mesh.boundingSphere.radius*=1.3;   // 按站姿算的，抬手迈腿留点余量
  for(const o of owners.get(material)){o.removeFromParent();o.geometry.dispose();}
  for(const q of gs)q.dispose();root.add(mesh);
 }
 root.rigSkin={boneInverses};root.rigGround=ground;
}
// Early walker GLBs lost empty-node pivots during export. Rebase the children without
// changing the bind pose; reaching and knee bends must rotate at the joints, not the floor.
export function repairWalkerRig(root){
 const pivots={Body:[0,.70,0],Head:[0,1.25,.015],ArmL:[-.30,1.23,0],ArmR:[.30,1.23,0],LegL:[-.18,.66,-.02],LegR:[.18,.66,-.02]};
 root.traverse(o=>{const p=pivots[o.userData.part];if(!p||!isRig(o)||o.position.lengthSq()>.000001)return;const shift=new T.Vector3(...p);for(const child of o.children)child.position.sub(shift);o.position.copy(shift);});root.updateMatrixWorld(true);return root;
}
// Native prefab roster; only requested templates are optimized.
// skin：僵尸并成刚性蒙皮（见 skinFigurine），只给游戏用；主角的第一人称手臂要按部件显隐，不并。
export async function loadFigurines(data,{skin=false}={}){
 const loader=new GLTFLoader();const [hero,zombies]=await Promise.all([data.scout?loader.parseAsync(decode(data.scout),''):null,loader.parseAsync(decode(data.zombies||data.walker),'')]);
 const templates={},raw=new Map();if(hero)templates.scout=optimizeFigurine(hero.scene);
 if(data.zombies){for(const root of zombies.scene.children)if(root.userData.zombieType)raw.set(root.userData.zombieType,root);if(!raw.size)throw new Error('Expected native zombie prefabs');}
 else templates.walker=repairWalkerRig(optimizeFigurine(zombies.scene));
 const resolve=kind=>kind==='tank'?'heavy':kind==='runner'||kind==='weaver'?'leaper':kind;
 function template(kind){const id=resolve(kind);if(!templates[id]){const root=raw.get(id);if(!root)throw new Error('Unknown figurine: '+kind);templates[id]=optimizeFigurine(root,{skin});}return templates[id];}
 return {templates,kinds:[...(hero?['scout']:[]),...(raw.size?raw.keys():['walker'])],prepare(kind){template(kind);},create(kind){
  const id=resolve(kind),source=template(id),model=source.clone(true),world=new T.Group(),tilt=new T.Group();world.add(tilt);tilt.add(model);model.scale.multiplyScalar(ACTOR_SCALE);model.position.y=-.017;
  // 复制出来的蒙皮网格还指着模板的骨头：换成这一只自己的关节（顺序和模板一样）
  let skeleton;
  if(source.rigSkin){const bones=[];model.traverse(o=>{if(isRig(o))bones.push(o);});skeleton=new T.Skeleton(bones,source.rigSkin.boneInverses);model.traverse(o=>{if(o.isSkinnedMesh)o.bind(skeleton,new T.Matrix4());});}
  const parts=new Map(),rest=new Map(),materials=new Map(),gear=new Map(),mechanisms=new Map(),mechanismRest=new Map();
  model.traverse(o=>{
   if(isRig(o)){if(parts.has(o.userData.part))throw new Error('Duplicate native pivot: '+o.userData.part);parts.set(o.userData.part,o);for(const name of o.userData.gearLabels||[])gear.set(name,o);rest.set(o.userData.part,{p:o.position.clone(),r:o.rotation.clone(),s:o.scale.clone()});}
   if(o.userData.gear)gear.set(o.userData.gear,o);
   if(isMechanism(o)){mechanisms.set(o.userData.mechanism,o);mechanismRest.set(o.userData.mechanism,{p:o.position.clone(),r:o.rotation.clone(),s:o.scale.clone()});}
   if(o.isMesh){if(!materials.has(o.material.uuid)){const material=o.material.clone();material.onBeforeCompile=o.material.onBeforeCompile;material.customProgramCacheKey=o.material.customProgramCacheKey;materials.set(o.material.uuid,material);}o.material=materials.get(o.material.uuid);o.frustumCulled=false;}
  });
  return {world,tilt,model,parts,rest,gear,mechanisms,mechanismRest,materials:[...materials.values()],kind:id,ground:source.rigGround||null,nativeVariant:raw.has(id)?id:null,
   reset(){for(const [n,o]of parts){const r=rest.get(n);o.position.copy(r.p);o.rotation.copy(r.r);o.scale.copy(r.s);}for(const [n,o]of mechanisms){const r=mechanismRest.get(n);o.position.copy(r.p);o.rotation.copy(r.r);o.scale.copy(r.s);}tilt.quaternion.identity();model.position.y=-.017;},
   dispose(){for(const m of materials.values())m.dispose();skeleton?.dispose();this.bowString?.geometry.dispose();this.bowString?.material.dispose();},
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
// 毛线团：一颗球，表面是一层压一层的毛线（一张算出来的贴图：颜色 + 法线），最上面那一把线和一截松开的线头是真的几何体，所以轮廓不是光溜溜的圆。
// 贴图是浅灰色的，换颜色只改材质的 color（游戏里每把枪的球颜色不同）。旧版是"球 + 一圈螺旋线 + 180 根突刺"，远看像个刺球。
const YARN_SW=.112;   // 一股线的宽度（弧度）
let yarnCache=null;
function yarnLayers(){
 let seed=20261116;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const layers=[];
 for(let k=0;k<13;k++){
  const y=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-y*y),ax=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
  if(k===12)ax.set(.38,.55,.74).normalize();   // 最上面那一把：固定朝向，和真几何体的那几圈对上
  const b=new T.Vector3(.31,.87,.38).cross(ax).normalize(),c=ax.clone().cross(b);
  const n=k===0?Math.ceil(Math.PI/YARN_SW):k===12?4:3+Math.floor(rnd()*4);   // 这一把有几股；最底下那层铺满整颗球
  layers.push({ax,b,c,n,w:n*YARN_SW/2,off:k===0?0:k===12?.06:(rnd()-.5)*.5,tw:(rnd()<.5?-1:1)*(40+Math.floor(rnd()*8)),tone:.94+rnd()*.12});
 }
 return layers;
}
function yarnTextures(){
 if(yarnCache)return yarnCache;
 const W=1024,H=512,L=yarnLayers(),K=L.length,height=new Float32Array(W*H),shade=new Float32Array(W*H);
 const hash=(a,b)=>{let h=(Math.imul(a+1,374761393)^Math.imul(b+7,668265263))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return(h>>>8)/16777216;};
 for(let j=0;j<H;j++){
  const phi=(j+.5)/H*Math.PI,sy=Math.cos(phi),sr=Math.sin(phi);
  for(let i=0;i<W;i++){
   const th=(i+.5)/W*Math.PI*2,dx=-Math.cos(th)*sr,dz=Math.sin(th)*sr;
   let k=0,tt=0,ao=1;
   for(let q=K-1;q>=0;q--){
    const l=L[q],t=Math.asin(Math.max(-1,Math.min(1,dx*l.ax.x+sy*l.ax.y+dz*l.ax.z)))-l.off,e=Math.abs(t)-l.w;
    if(e<0){k=q;tt=t;break;}
    if(e<.075)ao*=.5+.5*(e/.075);   // 被上面那一把压着的边：暗一点
   }
   const l=L[k],s=(tt+l.w)/YARN_SW,n=Math.floor(s),u=(s-n)*2-1,prof=Math.sqrt(Math.max(0,1-u*u));
   const along=Math.atan2(dx*l.b.x+sy*l.b.y+dz*l.b.z,dx*l.c.x+sy*l.c.y+dz*l.c.z),ply=.5+.5*Math.sin(along*l.tw+u*2.6);   // 每股线自己拧的那道斜纹
   height[j*W+i]=k/K*.55+prof*.45+ply*.035;
   shade[j*W+i]=(.56+.44*Math.pow(prof,.7))*(.9+.1*ply)*(.8+.2*k/(K-1))*l.tone*(.95+.1*hash(k,n))*ao;
  }
 }
 const mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
 const cc=mk(),cx=cc.getContext('2d'),ci=cx.createImageData(W,H),nc=mk(),nx=nc.getContext('2d'),ni=nx.createImageData(W,H);
 const AMP=5.5;   // 法线的夸张程度：一股线看着大约是半圆
 for(let j=0;j<H;j++){
  const sr=Math.max(.06,Math.sin((j+.5)/H*Math.PI)),jn=Math.max(0,j-1),js=Math.min(H-1,j+1);
  for(let i=0;i<W;i++){
   const o=(j*W+i)*4,v=Math.max(0,Math.min(255,shade[j*W+i]*262));
   ci.data[o]=ci.data[o+1]=ci.data[o+2]=v;ci.data[o+3]=255;
   const de=(height[j*W+(i+1)%W]-height[j*W+(i+W-1)%W])/(2*(Math.PI*2/W)*sr),dn=(height[jn*W+i]-height[js*W+i])/((js-jn)*Math.PI/H);
   let gx=-de*YARN_SW*AMP*.5,gy=-dn*YARN_SW*AMP*.5;const g=Math.hypot(gx,gy);if(g>1.6){gx*=1.6/g;gy*=1.6/g;}
   const inv=1/Math.hypot(gx,gy,1);
   ni.data[o]=(gx*inv*.5+.5)*255;ni.data[o+1]=(gy*inv*.5+.5)*255;ni.data[o+2]=(inv*.5+.5)*255;ni.data[o+3]=255;
  }
 }
 cx.putImageData(ci,0,0);nx.putImageData(ni,0,0);
 const map=new T.CanvasTexture(cc);map.colorSpace=T.SRGBColorSpace;map.wrapS=T.RepeatWrapping;map.anisotropy=4;
 const normalMap=new T.CanvasTexture(nc);normalMap.wrapS=T.RepeatWrapping;normalMap.anisotropy=4;
 // 真几何体那几圈线用的小贴图：一道道斜纹，顺着线拧
 const pc=document.createElement('canvas');pc.width=pc.height=64;const px=pc.getContext('2d');px.fillStyle='#fff';px.fillRect(0,0,64,64);
 px.strokeStyle='rgba(120,112,100,.3)';px.lineWidth=9;for(let d=-64;d<128;d+=32){px.beginPath();px.moveTo(d,0);px.lineTo(d+64,64);px.stroke();}
 const ply=new T.CanvasTexture(pc);ply.colorSpace=T.SRGBColorSpace;ply.wrapS=ply.wrapT=T.RepeatWrapping;ply.repeat.set(16,1);
 return yarnCache={map,normalMap,ply,top:L[K-1]};
}
export function createWoolBall(){
 const g=new T.Group(),tex=yarnTextures(),top=tex.top;
 const mat=woolMaterial(0xf3dfa5);mat.map=tex.map;mat.bumpMap=null;mat.normalMap=tex.normalMap;mat.normalScale=new T.Vector2(1,1);
 g.add(new T.Mesh(new T.SphereGeometry(1,36,22),mat));
 // 最上面那一把线：五圈真的圆环，贴着球面，和贴图里最上层那一把是同一个位置
 const parts=[],q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),top.ax),R=1.004,tube=YARN_SW*.56;
 for(let n=0;n<top.n;n++){
  const a=top.off-top.w+(n+.5)*YARN_SW,ring=new T.TorusGeometry(Math.cos(a)*R,tube,5,30);
  ring.translate(0,0,Math.sin(a)*R);ring.applyQuaternion(q);parts.push(ring);
 }
 // 松开的线头：从最上面那一把的边上翘起来，打半个卷
 const tail=[],e0=top.off+top.w+YARN_SW*.2;
 for(let i=0;i<=9;i++){const k=i/9,ang=1.1+k*1.5,lift=1+Math.sin(k*Math.PI*.9)*.2+k*.1,a=e0+k*.16;tail.push(new T.Vector3(Math.cos(ang)*Math.cos(a)*lift,Math.sin(ang)*Math.cos(a)*lift,Math.sin(a)*lift).applyQuaternion(q));}
 const tg=new T.TubeGeometry(new T.CatmullRomCurve3(tail),18,tube*.9,5,false),uv=tg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*.3);parts.push(tg);
 const yarn=woolMaterial(0xf3dfa5);yarn.map=tex.ply;yarn.bumpMap=tex.ply;yarn.bumpScale=.004;
 g.add(new T.Mesh(mergeGeometries(parts),yarn));
 return g;
}
export function createLauncher(){const group=new T.Group(),cream=woolMaterial(0xd9c88f),rust=woolMaterial(0xad684a),dark=new T.MeshStandardMaterial({color:0x473c2e,roughness:.8}),wood=new T.MeshStandardMaterial({color:0x906641,roughness:.8});const cylinder=(r,len,mat,z)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,len,24),mat);o.rotation.x=Math.PI/2;o.position.z=z;group.add(o);return o;};cylinder(.235,.51,cream,.08);cylinder(.245,.055,rust,.35);cylinder(.18,.04,dark,.384);cylinder(.13,.045,cream,.407);const base=new T.Mesh(new RoundedBoxGeometry(.42,.19,.30,3,.05),wood);base.position.set(0,-.12,-.06);group.add(base);for(const s of [-1,1]){const grip=new T.Mesh(new T.SphereGeometry(.10,10,8),rust);grip.position.set(s*.26,-.04,0);group.add(grip);}group.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});return group;}

// 绒仔帽子底下的头发。原模型的头发只有露在帽檐外面的那一圈，帽子压着的头顶是肤色的——帽子一弹起来（开场片里他靠帽子做表情）就露出光头。
// 这里在头顶补一块发顶：比头骨略大的半个椭球，下沿埋进原来那圈头发里；表面有几道浅浅的发绺。颜色和材质取自头本身，光照和毛绒质感一致。
export function addScoutHair(actor){
 const head=actor.parts&&actor.parts.get('CTRL / head');if(!head||head.userData.hairCap)return null;
 const base=head.children.find(m=>m.isMesh&&!m.userData.fuzz&&m.geometry.attributes.color);if(!base)return null;
 const src=base.geometry.attributes.color;let dark=0,lum=9;   // 头上最深的顶点色就是头发
 for(let i=0;i<src.count;i+=7){const l=src.getX(i)+src.getY(i)+src.getZ(i);if(l<lum){lum=l;dark=i;}}
 const hair=[src.getX(dark),src.getY(dark),src.getZ(dark)];
 const g=new T.SphereGeometry(1,36,12,0,Math.PI*2,0,Math.PI*.42),p=g.attributes.position,c=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),rim=1-y;   // 越靠近下沿发绺越明显，头顶是平的
  const s=1+.035*rim*Math.sin(a*7+y*4)+.02*rim*Math.sin(a*13+1.7);
  p.setXYZ(i,x*.545*s,.28+y*.47+.012*rim*Math.sin(a*7+y*4),-.035+z*.42*s);
  const k=.86+.14*Math.sin(a*7+y*4+1.2)*rim;c[i*3]=hair[0]*k;c[i*3+1]=hair[1]*k;c[i*3+2]=hair[2]*k;
 }
 g.setAttribute('color',new T.BufferAttribute(c,3));g.computeVertexNormals();
 const cap=new T.Mesh(g,base.material);cap.castShadow=base.castShadow;cap.receiveShadow=base.receiveShadow;cap.name='hair-cap';
 head.add(cap);head.userData.hairCap=cap;return cap;
}
