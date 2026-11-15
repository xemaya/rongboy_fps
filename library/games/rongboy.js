import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Candidate miniature kit. Cell = 1 m. Puppets ~0.8 m; intended for high tactical camera.
export const pos=(p,y=.28)=>new T.Vector3(p.c-3.5,y,p.r-3.5);
export function feltTexture(){
 const a=new Uint8Array(128*128*4);let s=17;for(let i=0;i<a.length;i+=4){s=(s*1664525+1013904223)>>>0;const v=165+(s>>>26);a[i]=a[i+1]=a[i+2]=v;a[i+3]=255;}
 const tx=new T.DataTexture(a,128,128,T.RGBAFormat);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.repeat.set(4,4);tx.needsUpdate=true;return tx;
}
const tex=feltTexture();
export const mat=(color)=>new T.MeshStandardMaterial({color,roughness:.97,map:tex,bumpMap:tex,bumpScale:.026});
const M={cream:mat('#eee0b7'),dark:mat('#252b1b'),wood:mat('#674530'),green:mat('#7e9962'),moss:mat('#465a36'),yellow:mat('#e8b34d'),rust:mat('#ad4935'),skin:mat('#c49a72'),zombie:mat('#8c9e69'),hat:mat('#b48a55'),leather:mat('#65442d')};
function mesh(g,m,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
const sphere=new T.SphereGeometry(1,18,12),box=new T.BoxGeometry(1,1,1);
function ball(parent,m,x,y,z,sx,sy=sx,sz=sx){return mesh(sphere,m,parent,x,y,z,sx,sy,sz);}
export function puppet(type='scout',ghost=false){
 const g=new T.Group(),body=new T.Group();g.add(body);g.userData.body=body;g.userData.type=type;
 const scout=type==='scout',tank=type==='tank',runner=type==='runner',crawler=type==='crawler';
 const skin=scout?M.skin:M.zombie,shirt=scout?M.hat:tank?M.moss:runner?M.rust:M.wood;
 ball(body,shirt,0,.36,0,tank?.26:.16,tank?.27:.22,.15);
 const head=ball(body,skin,0,.67,.015,tank?.23:.18,.19,.165);
 for(const side of [-1,1]){ball(body,M.leather,side*.095,.065,.06,.088,.068,.13);ball(body,shirt,side*.105,.17,0,.065,.14,.07);const arm=new T.Group();arm.position.set(side*(tank?.25:.17),.45,0);body.add(arm);ball(arm,shirt,0,-.08,0,.065,.16,.065);ball(arm,skin,0,-.21,.015,.065);g.userData[side<0?'left':'right']=arm;
 ball(body,M.dark,side*.067,.707,.157,.027,.034,.016);ball(body,M.cream,side*.073,.719,.172,.008);}
 ball(body,M.dark,0,.614,.167,.055,.024,.014);
 if(scout){mesh(new T.CylinderGeometry(.235,.235,.035,24),M.hat,body,0,.82,0);mesh(new T.CylinderGeometry(.16,.20,.13,24),M.hat,body,0,.895,0);ball(body,M.yellow,0,.51,.14,.12,.055,.035);mesh(box,M.yellow,body,.035,.43,.16,.06,.15,.035);ball(body,M.leather,0,.40,-.17,.12,.15,.07);}
 if(runner){for(let i=0;i<7;i++){const tuft=mesh(new T.ConeGeometry(.04,.19,6),M.rust,body,(i-3)*.04,.885,-.025);tuft.rotation.z=-.5;}}
 if(tank){mesh(new T.CylinderGeometry(.24,.25,.07,20),M.yellow,body,0,.845,0);for(let i=0;i<2;i++)ball(body,M.cream,(i-.5)*.11,.38,.165,.038,.038,.018);}
 if(crawler){body.rotation.x=-.8;body.scale.set(.95,.6,1.25);body.position.y=-.02;}
 if(ghost)g.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.30;o.material.depthWrite=false;o.castShadow=false;}});
 return g;
}
export function makeStage(scene){
 const root=new T.Group();scene.add(root);mesh(box,M.wood,root,0,-.02,0,8.65,.44,8.65);mesh(box,M.dark,root,0,-.27,0,8.9,.12,8.9);
 const tiles=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){
 const tile=new T.Group();tile.position.copy(pos({r,c},.22));root.add(tile);
 // Soft padded form, rounded in all three axes.
 const shape=new T.Shape();const h=.475,k=.09;shape.moveTo(-h+k,-h);shape.lineTo(h-k,-h);shape.quadraticCurveTo(h,-h,h,-h+k);shape.lineTo(h,h-k);shape.quadraticCurveTo(h,h,h-k,h);shape.lineTo(-h+k,h);shape.quadraticCurveTo(-h,h,-h,h-k);shape.lineTo(-h,-h+k);shape.quadraticCurveTo(-h,-h,-h+k,-h);
 const geom=new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.018,bevelThickness:.025});geom.rotateX(-Math.PI/2);mesh(geom,(r+c)%2?M.moss:M.green,tile);
 const stitches=[];for(let e=0;e<4;e++)for(let j=0;j<8;j++){const u=-.39+j*.11;const a=e<2?[u,.12,e===0?-.43:.43]:[e===2?-.43:.43,.12,u];const b=[...a];b[e<2?0:2]+=.04;stitches.push(...a,...b);}
 const lines=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(stitches,3)),new T.LineBasicMaterial({color:'#bdad75',transparent:true,opacity:.45}));tile.add(lines);tiles.push(tile);
 }
 mesh(box,M.moss,root,0,-.42,0,30,.2,30);
 let seed=93;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<58;i++){let x=(rand()-.5)*19,z=(rand()-.5)*17;if(Math.abs(x)<4.9&&Math.abs(z)<4.9)continue;const tree=new T.Group();tree.position.set(x,-.3,z);root.add(tree);let h=1.0+rand()*2.3;mesh(new T.CylinderGeometry(.09,.15,h,9),M.wood,tree,0,h/2,0);for(let j=0;j<7;j++){const a=j*2.4,rr=h*.17;ball(tree,j%2?M.green:M.moss,Math.cos(a)*rr,h*(.48+(j%3)*.19),Math.sin(a)*rr,h*.28,h*.32,h*.27);}
 for(let j=0;j<3;j++)ball(root,M.moss,x+rand()-.5,-.05,z+rand()-.5,.3+rand()*.2,.18,.3);}
 for(let i=0;i<36;i++){let x=(rand()-.5)*12,z=(rand()-.5)*12;if(Math.abs(x)<4.6&&Math.abs(z)<4.6)continue;const g=new T.Group();g.position.set(x,-.1,z);root.add(g);mesh(new T.CylinderGeometry(.035,.06,.24,8),M.cream,g,0,.12,0);ball(g,i%3?M.rust:M.yellow,0,.27,0,.18,.10,.18);for(let j=0;j<3;j++)ball(g,M.cream,(rand()-.5)*.2,.35,(rand()-.5)*.2,.025,.012,.025);}
 root.updateMatrixWorld(true);const groups=new Map(),seams=[];root.traverse(o=>{if(o.isMesh){const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);}else if(o.isLineSegments)seams.push(o.geometry.clone().applyMatrix4(o.matrixWorld));});root.clear();for(const [m,gs]of groups){const merged=mergeGeometries(gs);if(merged){const o=new T.Mesh(merged,m);o.castShadow=o.receiveShadow=true;root.add(o);}for(const g of gs)g.dispose();}if(seams.length){root.add(new T.LineSegments(mergeGeometries(seams),new T.LineBasicMaterial({color:'#bdad75',transparent:true,opacity:.5})));for(const g of seams)g.dispose();}
 return {root,tiles};
}
