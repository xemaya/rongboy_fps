// Close-range felt workshop kit. Metre scale; solid cover envelopes supplied by the level.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {woolMaterial,createLauncher} from './rongboy-runtime.js';
const wood=new T.MeshStandardMaterial({color:0x8b6447,roughness:.86});
const oat=woolMaterial(0xead9b0),seam=new T.MeshStandardMaterial({color:0xdccca3,roughness:1});
function mesh(group,geometry,material,x,y,z){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
function box(g,w,h,d,mat,x,y,z,r=.06){return mesh(g,new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);}
function line(g,points,mat=seam,r=.008){const c=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(g,new T.TubeGeometry(c,Math.max(2,points.length*2),r,4,false),mat,0,0,0);}
function mergeStatic(group){group.updateMatrixWorld(true);const batches=new Map();group.traverse(o=>{if(!o.isMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);});group.clear();for(const [mat,gs]of batches){const merged=mergeGeometries(gs,false),m=new T.Mesh(merged,mat);m.castShadow=m.receiveShadow=true;group.add(m);for(const g of gs)g.dispose();}return group;}
export function createWorkshopCover(c){
 const g=new T.Group(),felt=woolMaterial(c.color);box(g,c.w,c.h,c.d,felt,0,c.h/2,0,.065);
 // The visible solid matches the collision box; edging, piping and stitching stay flush.
 for(const z of [-c.d/2-.006,c.d/2+.006]){
  line(g,[[-c.w/2+.08,.10,z],[-c.w/2+.08,c.h-.08,z],[c.w/2-.08,c.h-.08,z],[c.w/2-.08,.10,z]],seam,.008);
  if(c.kind==='cabinet'){
   box(g,.022,c.h-.23,.015,wood,0,c.h/2,z,.005);
   for(const sign of [-1,1])box(g,.055,.16,.024,oat,sign*.10,c.h*.57,z,.015);
   for(let i=1;i<4;i++)box(g,c.w-.15,.025,.016,seam,0,c.h*i/4,z,.006);
  }else if(c.kind==='crate')for(const sign of [-1,1]){const strap=box(g,.09,c.h-.10,.017,oat,sign*c.w*.28,c.h/2,z,.01);strap.rotation.z=sign*.10;}
  else{for(let i=0;i<Math.floor(c.w/.16);i++){const x=-c.w/2+.10+i*.16;line(g,[[x,.10,z],[x+.045,.14,z]],seam,.006);}}
 }
 if(c.kind==='bench')box(g,c.w-.07,.06,c.d-.07,oat,0,c.h-.04,0,.02);
 if(c.kind==='cushion')for(const x of [-c.w*.22,c.w*.22]){const b=mesh(g,new T.CylinderGeometry(.035,.035,.012,12),wood,x,c.h+.006,0);b.castShadow=false;}
 return g;
}
function signTexture(text,small){const c=document.createElement('canvas');c.width=1024;c.height=256;const a=c.getContext('2d');a.fillStyle='#e6d4ae';a.fillRect(0,0,1024,256);a.strokeStyle='#8b6c49';a.lineWidth=3;a.setLineDash([10,9]);a.strokeRect(14,14,996,228);a.textAlign='center';a.fillStyle='#526b5e';a.font='bold 85px Georgia';a.fillText(text,512,132);a.font='24px Georgia';a.fillText(small,512,194);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
export function buildWoolWorkshop(scene,room,covers){
 const g=new T.Group(),inside=new T.Group();scene.add(g,inside);const floor=woolMaterial(0x718575),wall=woolMaterial(0xc8c09e),teal=woolMaterial(0x799386),rust=woolMaterial(0xb57e60),h=room.height,ceilingMat=oat.clone();
 box(g,room.halfX*2+.45,.28,room.halfZ*2+.45,wood,0,-.24,0,.12);box(g,room.halfX*2,.18,room.halfZ*2,floor,0,-.09,0,.06);
 // Large stitched floor panels and small paired route markings keep the floor legible.
 for(let x=-room.halfX+2.0;x<room.halfX;x+=2.4)line(g,[[x,.006,-room.halfZ+.15],[x,.006,room.halfZ-.15]],seam,.005);
 for(let z=-room.halfZ+1.7;z<room.halfZ;z+=2.2)line(g,[[-room.halfX+.14,.006,z],[room.halfX-.14,.006,z]],seam,.005);
 for(const x of [-5.05,-1.65,1.65,5.05])for(let z=-room.halfZ+.55;z<room.halfZ-.4;z+=.52)box(g,.055,.012,.16,oat,x,.015,z,.005);
 for(const c of covers){const cover=createWorkshopCover(c);cover.position.set(c.x,0,c.z);inside.add(cover);}
 for(const sign of [-1,1]){
  box(inside,room.halfX*2+.24,h,.18,wall,0,h/2,sign*(room.halfZ+.09));
  box(inside,.18,h,room.halfZ*2,wall,sign*(room.halfX+.09),h/2,0);
  box(inside,room.halfX*2,.70,.045,teal,0,.35,sign*(room.halfZ-.02),.01);
  box(inside,.045,.70,room.halfZ*2,teal,sign*(room.halfX-.02),.35,0,.01);
  for(let x=-room.halfX+.5;x<room.halfX;x+=1.8)box(inside,.09,h,.09,wood,x,h/2,sign*(room.halfZ-.055),.015);
  for(let z=-room.halfZ+.6;z<room.halfZ;z+=2.3)box(inside,.09,h,.09,wood,sign*(room.halfX-.055),h/2,z,.015);
  // Fabric sample panels resemble windows, without introducing false walkable openings.
  for(const z of [-5.2,-.5,4.4]){box(inside,.07,1.3,1.5,oat,sign*(room.halfX-.09),2.2,z,.04);for(const dz of [-.45,0,.45])box(inside,.06,1.16,.28,z<0?teal:rust,sign*(room.halfX-.135),2.2,z+dz,.03);}
 }
 box(inside,room.halfX*2+.2,.12,room.halfZ*2+.2,ceilingMat,0,h+.06,0,.015);
 for(const x of [-7.2,-3.6,0,3.6,7.2])box(inside,.13,.13,room.halfZ*2,wood,x,h-.11,0,.015);
 for(const [x,label,caption]of [[-6.3,'CUTTING BAY','01  /  TAKE THE SIDE LANE'],[6.3,'PACKING BAY','02  /  KEEP ON MOVING']]){const sign=mesh(inside,new T.PlaneGeometry(3.0,.75),new T.MeshStandardMaterial({map:signTexture(label,caption),roughness:1}),x,2.9,-room.halfZ+.11);sign.castShadow=false;}
 const board=mesh(inside,new T.PlaneGeometry(3.8,.95),new T.MeshStandardMaterial({map:signTexture('WOOLWORKS','BOUNCE  /  WEAVE  /  REPEAT'),roughness:1}),0,2.92,-room.halfZ+.105);board.castShadow=false;
 // A cream runner behind the central cabinet makes the two side paths visually distinct.
 box(inside,1.1,.018,1.15,rust,-4.8,.01,-3.5,.02);box(inside,1.1,.018,1.15,teal,4.8,.01,3.5,.02);
 mergeStatic(inside);inside.traverse(o=>{if(o.isMesh&&(o.material===wall||o.material===ceilingMat))o.castShadow=false;});return {floor:g,interior:inside};
}
const accessories=new Map();
export function dressWalker(actor,type,scale=1){
 actor.model.scale.multiplyScalar(scale);if(type==='walker')return;
 let template=accessories.get(type);
 if(!template){template=new T.Group();if(type==='runner'){
  const teal=woolMaterial(0x75a9a0),band=mesh(template,new T.TorusGeometry(.385,.046,8,40),teal,0,.59,.015);band.rotation.x=Math.PI/2;band.scale.y=.82;
  for(const sign of [-1,1]){const tail=box(template,.10,.30,.055,teal,sign*.13,.48,-.28,.02);tail.rotation.z=sign*.35;}
 }else if(type==='weaver'){
  const plum=woolMaterial(0xa697b4);const collar=mesh(template,new T.TorusGeometry(.22,.072,8,28),plum,0,.55,0);collar.rotation.x=Math.PI/2;collar.scale.y=.75;
  for(const sign of [-1,1]){const tail=box(template,.12,.43,.055,plum,sign*.08,.34,.23,.025);tail.rotation.z=sign*.28;}
 }else if(type==='leaper'){
  const gold=woolMaterial(0xd7ae60);for(const x of [-.15,.15])box(template,.075,.59,.065,gold,x,.32,.225,.02);
  box(template,.45,.16,.09,gold,0,.47,.23,.04);for(const x of [-.18,.18])box(template,.13,.16,.13,oat,x,.56,.10,.04);
 }else{
  const armor=woolMaterial(0xa56b55);for(const x of [-.17,.17]){box(template,.27,.53,.12,armor,x,.32,.225,.055);for(let j=0;j<3;j++)line(template,[[x-.10,.13+j*.16,.292],[x+.10,.13+j*.16,.292]],seam,.007);}
  for(const sign of [-1,1])box(template,.18,.20,.28,armor,sign*.32,.56,.02,.055);
  box(template,.60,.11,.12,oat,0,.15,.24,.025);
 }
 accessories.set(type,template);}
 const item=template.clone(true);(actor.parts.get(type==='runner'?'Head':'Body')||actor.model).add(item);
}
export function createWeaponKit(){
 const root=new T.Group();for(let index=0;index<3;index++){
  const g=createLauncher();root.add(g);g.visible=index===0;
  if(index===1){const teal=woolMaterial(0x7eaaa0),dark=new T.MeshStandardMaterial({color:0x424e43,roughness:1});for(const [x,y]of [[-.14,-.06],[.14,-.06],[0,.15]]){const pipe=mesh(g,new T.CylinderGeometry(.11,.11,.27,20),teal,x,y,.45);pipe.rotation.x=Math.PI/2;const opening=mesh(g,new T.CylinderGeometry(.075,.075,.015,16),dark,x,y,.595);opening.rotation.x=Math.PI/2;}}
  if(index===2){const rust=woolMaterial(0xad7058);const drum=mesh(g,new T.CylinderGeometry(.30,.30,.40,24),rust,0,-.08,.04);drum.rotation.z=Math.PI/2;for(const x of [-.25,.25]){const ring=mesh(g,new T.TorusGeometry(.30,.025,6,28),oat,x,-.08,.04);ring.rotation.y=Math.PI/2;}const rim=mesh(g,new T.TorusGeometry(.24,.055,8,24),rust,0,0,.43);}
 }
 root.userData.variants=[...root.children];root.userData.muzzleZ=.63;return root;
}
