import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { plush, plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { uiCanvasFont } from './interface-font.js';
import { copy } from './language.js';
import {
  CAROUSEL, SWITCH, TENT_DOOR, CLOWN, TILES, TILE, GATES, GATE_LIFT_SECONDS,
  LOCK, VALVE, RIVER, PLATFORM, COASTER_TARGETS, BALLOONS,
  tileSwitch, ridePose, lockPosition, coasterTargetPosition,
} from './amusement.js';

const RED=0xad494b, CREAM=0xf6dfab, BLUE=0x337a84, GOLD=0xf3ac51, COAL=0x34272e, PINK=0xdb7772;
const TAU=2*Math.PI;
const window01=t=>Math.max(0,Math.min(1,t));

export function createAmusementView(cine,world) {
  const root=new T.Group(); root.name='Amusement park'; world.root.add(root);
  const M=plushMaterials(world.lib,{lit:m=>world.volume.light(m)});
  const felt=color=>M('felt',color), quilt=color=>M('quilt',color);
  const rawCache=new Map();
  function raw(id,color) {
    const key=id+color;
    if(!rawCache.has(key))rawCache.set(key,world.volume.light(plush(world.lib,id,color)));
    return rawCache.get(key);
  }
  const cream=felt(CREAM), red=felt(RED), blue=felt(BLUE), gold=felt(GOLD), coal=felt(COAL);
  const kit=new PlushKit();
  const group=(parent=root)=>{ const g=new T.Group(); parent.add(g); return g; };
  const mesh=(parent,g,m,x=0,y=0,z=0)=>{
    const o=new T.Mesh(g,m); o.position.set(x,y,z); o.receiveShadow=true; parent.add(o); return o;
  };
  function finish(k,parent,cast=true) { parent.add(...k.build({cast})); }
  function soft(k,m,w,h,d,x,y,z,r=.04) { k.soft(m,w,h,d,x,y,z,{r}); }
  function orb(k,m,r,x,y,z,scale={}) { k.sphere(m,r,x,y,z,{seg:13,rings:10,...scale}); }
  function sign(text,x,y,z,w,heading=0) {
    const c=document.createElement('canvas'); c.width=640;c.height=160;
    const g=c.getContext('2d');g.fillStyle='#fcdfa6';g.beginPath();g.roundRect(6,6,628,148,29);g.fill();
    g.strokeStyle='#8f5340';g.lineWidth=3;g.setLineDash([12,7]);g.strokeRect(23,20,594,120);
    g.fillStyle='#532b31';g.font=uiCanvasFont(62);g.textAlign='center';g.textBaseline='middle';g.fillText(text,320,83,570);
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
    const plaque=mesh(root,new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map,transparent:true}),x,y,z);plaque.rotation.y=heading;
  }

  // Three low archway gates (leaving Big Top canopy visible from entrance!)
  const gateLabels = [copy('木马广场','CAROUSEL PLAZA'), copy('过山车区','COASTER'), copy('马戏帐篷','BIG TOP')];
  const gates=GATES.map((g,i)=>{
    const panel=group(), fabric=new PlushKit();
    soft(fabric,quilt(i%2?RED:BLUE),g.width,1.34,.25,0,.67,0,.075);
    finish(fabric,panel,false);
    panel.position.set(g.x,0,g.z);
    for (const side of [-1,1]) {
      soft(kit,red,.36,2.95,.38,g.x+side*(g.width/2+.14),1.47,g.z,.06);
      orb(kit,gold,.13,g.x+side*(g.width/2+.14),3.02,g.z);
    }
    sign(gateLabels[i],g.x,2.72,g.z+.30,2.75);
    return panel;
  });

  // Stitched cream walkway tiles across all zones
  for (const [x,z,wide,len] of [
    [0,38,5,4.2],[.4,34,4.2,4.2],[1.2,29.5,3.4,4.5],
    [1.5,24.5,3.2,4.5],[1.6,19.5,3.4,5.5],[.8,14.5,3.4,4.8],
    [0,9.5,4.4,3.8],[0,-3.2,4.8,4.2],
  ]) {
    soft(kit,quilt(0xd6bf88),wide,.037,len,x,.021,z,.019);
  }

  // Zone 0: Oscillating mechanical latch on a horizontal brass rail
  soft(kit,blue,4.5,.14,.14,0,LOCK.y,LOCK.z-.18,.04);
  for (const side of [-1,1]) soft(kit,blue,.18,1.38,.18,side*2.25,.69,LOCK.z-.18,.04);
  const lock=group();
  const lockKit=new PlushKit();
  soft(lockKit,blue,.95,.75,.27,0,0,0,.13);
  lockKit.cyl(gold,.21,.21,.075,0,0,.16,{seg:24,rx:Math.PI/2});
  lock.position.set(LOCK.x,LOCK.y,LOCK.z);
  finish(lockKit,lock,false);
  const lockLamp=mesh(lock,new T.SphereGeometry(.17,14,10),new T.MeshBasicMaterial({color:0xffcf72}),0,0,.19);
  const lockFrost=mesh(lock,new T.IcosahedronGeometry(.66,0),new T.MeshBasicMaterial({color:0x96e9ff,transparent:true,opacity:.45,depthWrite:false}),0,0,0);
  lockFrost.visible=false;

  // Zone 1: Steam valve & vapor
  const valveLamp=mesh(root,new T.SphereGeometry(.30,18,12),new T.MeshBasicMaterial({color:0xf2a367}),VALVE.x,VALVE.y,VALVE.z);
  kit.cyl(blue,.16,.19,1.38,VALVE.x,.69,VALVE.z,{seg:12});
  sign(copy('蒸汽阀','STEAM VALVE'),VALVE.x,2.05,VALVE.z+.10,1.7);
  const vapor=Array.from({length:6},()=>mesh(root,new T.SphereGeometry(.32,10,7),
    new T.MeshBasicMaterial({color:0xeadecd,transparent:true,depthWrite:false})));

  // Zone 2: Stitched blue river trench + elevated coaster track + cart + 2 moving targets
  const riverZ=(RIVER.minZ+RIVER.maxZ)/2, riverD=RIVER.maxZ-RIVER.minZ;
  soft(kit,quilt(0x4c8ca0),18.4,.05,riverD,0,.025,riverZ,.02);
  for (let i=0;i<7;i++) soft(kit,cream,2.0,.04,.16,-6.5+i*2.15,.055,riverZ+(i%2?.9:-.9),.02);
  for (const edge of [RIVER.minZ,RIVER.maxZ]) soft(kit,felt(0x886c52),18.6,.22,.32,0,.11,edge,.06);
  // Boarding station & northern deck
  soft(kit,quilt(BLUE),5.2,.06,3.4,0,.04,PLATFORM.z,.02);
  for (const side of [-1,1]) {
    soft(kit,red,.26,3.1,.26,side*2.45,1.55,PLATFORM.z+.5,.05);
    orb(kit,gold,.16,side*2.45,3.18,PLATFORM.z+.5);
  }
  soft(kit,red,5.2,.20,.38,0,2.95,PLATFORM.z+.5,.06);
  sign(copy('过山车','COASTER'),0,3.02,PLATFORM.z+.74,3.1);
  // Elevated track rails & sleepers
  for (const side of [-1,1]) {
    const pts=Array.from({length:45},(_,i)=>{
      const p=ridePose(i/44);
      return new T.Vector3(p.x+Math.cos(p.yaw)*side*.42,p.y,p.z-Math.sin(p.yaw)*side*.42);
    });
    const rail=mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts),56,.07,7,false),raw('felt',side<0?RED:BLUE));
    rail.castShadow=true;
  }
  for (let i=0;i<=22;i++) {
    const p=ridePose(i/22);
    kit.soft(cream,1.12,.09,.15,p.x,p.y-.09,p.z,{r:.03,ry:p.yaw});
    if (i%4===1 && p.y>.5) {
      for (const side of [-1,1]) soft(kit,blue,.15,p.y,.15,p.x+side*.38,p.y*.5,p.z);
    }
  }
  const cart=group(), seat=new PlushKit();
  soft(seat,red,1.16,.34,1.4,0,.24,0,.12);
  soft(seat,quilt(BLUE),.94,.16,.68,0,.48,.28,.08);
  soft(seat,gold,1.14,.18,.24,0,.64,-.72,.07);
  for (const side of [-1,1]) soft(seat,red,.14,.36,1.28,side*.56,.46,0,.06);
  finish(seat,cart);

  // Two moving coaster targets
  const coasterTargets=COASTER_TARGETS.map((t,i)=>{
    const g=group(); g.position.set(t.x,t.y,t.z);
    const mat=new T.MeshBasicMaterial({color:0xffca72});
    const disc=mesh(g,new T.SphereGeometry(.46,18,12),mat); disc.scale.z=.32;
    const core=mesh(g,new T.SphereGeometry(.19,14,10),new T.MeshBasicMaterial({color:0xa83c48}),0,0,.14); core.scale.z=.28;
    const frostShell=mesh(g,new T.IcosahedronGeometry(.58,0),new T.MeshBasicMaterial({color:0x96e9ff,transparent:true,opacity:.45,depthWrite:false}));
    frostShell.visible=false;
    return {g,mat,core,frostShell,i};
  });

  // Poppable roadside balloons
  const balloonColors=[0xe86e66,0xf4be59,0x6dc7c4];
  const balloons=BALLOONS.map((b,i)=>{
    const g=group(); g.position.set(b.x,b.y,b.z);
    const k=new PlushKit();
    k.cyl(cream,.025,.025,1.25,0,-.72,0,{seg:6});
    for (let j=0;j<3;j++) {
      const ox=(j-1)*.26, oy=(j===1?.18:0), oz=(j%2?.12:-.1);
      orb(k,felt(balloonColors[(i+j)%3]),.24,ox,oy,oz,{sy:1.18});
    }
    finish(k,g,false);
    return g;
  });

  // Real zone light-up garlands + 3 ground power cables leading to Big Top archway!
  const dimBulbMat=new T.MeshBasicMaterial({color:0x59525e});
  const litBulbMats=[0xffce6b,0xff8272,0x8ef2dc].map(c=>new T.MeshBasicMaterial({color:c}));
  const dimCableMat=new T.MeshBasicMaterial({color:0x605a65});
  const litCableMat=new T.MeshBasicMaterial({color:0xffd36e});
  const bulbGeo=new T.SphereGeometry(.115,9,6);

  const cordMat=felt(0x4a3d42);
  const zoneGarlands=[
    {z:33.5, y:3.35},
    {z:19.2, y:3.75},
    {z:-1.0, y:3.45},
  ].map(({z,y})=>{
    const list=[], pts=[];
    for (const side of [-1,1]) {
      soft(kit,red,.18,y+.1,.18,side*7.2,(y+.1)*.5,z,.04);
      orb(kit,gold,.11,side*7.2,y+.15,z);
    }
    for (let i=0;i<=8;i++) {
      const x=(i-4)*1.8;
      const sag=Math.cos((i-4)/4*Math.PI*.5)*.52;
      pts.push(new T.Vector3(x,y-sag,z));
      list.push(mesh(root,bulbGeo,dimBulbMat,x,y-sag-.09,z));
    }
    mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.024,6,false),cordMat);
    return list;
  });
  // 3 thick ground power cables running visibly to Big Top archway + 3 archway beacon bulbs
  const cableConfigs=[
    {x:-6.8, z0:31.5, z1:TENT_DOOR+.4, archX:-1.1},
    {x:6.8,  z0:19.2, z1:TENT_DOOR+.4, archX:0},
    {x:-6.2, z0:6.8,  z1:TENT_DOOR+.4, archX:1.1},
  ];
  const powerCables=cableConfigs.map(cfg=>{
    const pts=[
      new T.Vector3(cfg.x,.08,cfg.z0),
      new T.Vector3(cfg.x,.08,cfg.z1+2.2),
      new T.Vector3(cfg.archX,.08,cfg.z1+.4),
      new T.Vector3(cfg.archX,3.62,TENT_DOOR+.26),
    ];
    const tube=mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts),32,.07,6,false),dimCableMat);
    const beacon=mesh(root,new T.SphereGeometry(.20,12,8),dimBulbMat,cfg.archX,3.65,TENT_DOOR+.30);
    return {tube,beacon};
  });

  // Frost shell for Clown (solid translucent crystal + bright rim wireframe)
  const iceMat=new T.MeshBasicMaterial({color:0x97e8ff,transparent:true,opacity:.85});
  const clownFrost=group();
  mesh(clownFrost,new T.IcosahedronGeometry(1.12,0),new T.MeshBasicMaterial({color:0x8ce5ff,transparent:true,opacity:.38,depthWrite:false,flatShading:true}));
  mesh(clownFrost,new T.IcosahedronGeometry(1.16,0),new T.MeshBasicMaterial({color:0xd8f8ff,transparent:true,opacity:.55,wireframe:true,depthWrite:false}));
  clownFrost.visible=false;

  // High-Voltage Motor reward
  const motor=group(), motorKit=new PlushKit();
  motor.position.set(0,.66,-12.1);
  soft(motorKit,blue,.45,.45,.55,0,0,0,.095);
  motorKit.cyl(gold,.19,.19,.38,0,0,.24,{seg:16,rx:Math.PI/2});
  orb(motorKit,felt(0x9de3f4),.14,0,.25,0);
  finish(motorKit,motor,false);
  motor.visible=false;

  // Zone 1: Circular carousel sweeper
  const c=CAROUSEL;
  kit.cyl(blue,2.75,2.87,.27,c.x,.13,c.z,{seg:36});
  kit.cyl(cream,2.7,2.7,.075,c.x,.3,c.z,{seg:36});
  kit.cyl(red,.19,.24,3.48,c.x,1.78,c.z,{seg:15});
  kit.cyl(red,.12,2.78,.87,c.x,3.88,c.z,{seg:40,r:0});
  kit.cyl(cream,2.78,2.78,.15,c.x,3.39,c.z,{seg:40});
  orb(kit,gold,.19,c.x,4.39,c.z);
  const carousel=group();carousel.position.set(c.x,0,c.z);
  const horseKit=new PlushKit();
  for(let i=0;i<4;i++){
    const a=i*TAU/4, x=Math.sin(a)*1.72,z=Math.cos(a)*1.72;
    const local=group(carousel);local.position.set(x,0,z);local.rotation.y=a;
    const h=new PlushKit(),body=i%2?quilt(BLUE):quilt(PINK);
    h.cyl(gold,.055,.055,2.85,0,1.8,0,{seg:9});
    soft(h,body,.59,.59,.96,0,.95,0,.2);
    orb(h,body,.285,0,1.33,.37,{sy:1.19});
    orb(h,cream,.15,0,1.22,.59,{sx:1.16});
    orb(h,coal,.034,-.207,1.423,.47);
    orb(h,coal,.034,.207,1.423,.47);
    for(const side of [-1,1]){
      orb(h,body,.105,side*.13,1.59,.37,{sy:1.46});
      soft(h,body,.14,.39,.16,side*.19,.61,.24,.039);
      soft(h,body,.13,.34,.15,side*.19,.61,-.30,.038);
    }
    soft(h,gold,.45,.13,.52,0,1.28,-.15,.05);
    finish(h,local);
    const armX=Math.sin(a)*1.17,armZ=Math.cos(a)*1.17;
    horseKit.soft(quilt(RED),.27,.28,2.45,armX,.46,armZ,{r:.10,ry:a});
  }
  finish(horseKit,carousel);
  soft(kit,blue,.42,.76,.42,SWITCH.x,.38,SWITCH.z,.07);
  orb(kit,gold,.23,SWITCH.x,.94,SWITCH.z,{sy:.8});
  sign(copy('旋转木马','CAROUSEL'),c.x,3.29,c.z+2.85,3.35);

  // Zone 3: Big Top canopy & canvas walls
  for(const side of [-1,1]) {
    for(let i=0;i<9;i++){
      const z=-6.25-1.22*i;
      soft(kit,i%2?quilt(CREAM):quilt(RED),.21,3.8,1.23,side*6.28,1.9,z,.032);
    }
    for(let i=0;i<4;i++){
      const x=side*(2.21+i*1.13);
      soft(kit,i%2?quilt(CREAM):quilt(RED),1.15,3.8,.22,x,1.9,TENT_DOOR,.033);
      soft(kit,i%2?quilt(RED):quilt(CREAM),1.21,3.72,.21,x,1.86,-16.5,.037);
    }
    soft(kit,red,.34,4.05,.37,side*1.61,2.03,TENT_DOOR,.075);
    orb(kit,gold,.22,side*1.61,3.83,TENT_DOOR+.15);
  }
  soft(kit,red,3.6,.9,.29,0,3.55,TENT_DOOR,.16);
  soft(kit,quilt(BLUE),3.4,.035,3.35,0,.024,-6.12,.013);
  for (const side of [-1,1]) soft(kit,quilt(CREAM),1.62,3.8,.22,side*.8,1.9,-16.5,.03);
  for(let i=0;i<8;i++) {
    const x=-5.52+i*1.58;
    const fill=1.6*(1-Math.abs(x)/6.45)+.13;
    for(const edge of [TENT_DOOR,-16.5])soft(kit,i%2?cream:red,1.60,fill,.19,x,3.78+fill*.5,edge,.014);
    const cloth=mesh(root,new T.PlaneGeometry(1.60,11.32,1,1),
      raw('felt',i%2?CREAM:RED),x,3.79,-11);
    cloth.material.side=T.DoubleSide; cloth.rotation.x=-Math.PI/2;
    const v=cloth.geometry.attributes.position;
    for(let k=0;k<v.count;k++) {
      const height=1.6*(1-Math.min(1,Math.abs(x+v.getX(k))/6.4));
      v.setZ(k,height);
    }
    cloth.geometry.computeVertexNormals();
  }
  for(let i=0;i<12;i++) {
    const a=i*TAU/12,x=Math.sin(a)*5.4,z=-11.12+Math.cos(a)*5.04;
    orb(kit,felt(i%2?GOLD:0xf59076),.09,x,3.64,z);
  }
  finish(kit,root);

  const groundDark=new T.MeshBasicMaterial({color:0x161323});
  const warnMat=new T.MeshBasicMaterial({color:0xffca71});
  const frostTileMat=new T.MeshBasicMaterial({color:0x8ae6ff,transparent:true,opacity:.52,depthWrite:false});
  const platformShape=new T.BoxGeometry(TILE-.045,.082,TILE-.045);
  const tileRims=TILES.map((point,i)=>{
    const c=i%2?0x779994:0xd6a272;
    const base=mesh(root,platformShape,raw('quilt',c),point.x,.063,point.z);
    const pit=mesh(root,new T.PlaneGeometry(TILE,TILE),groundDark,point.x,.074,point.z);pit.rotation.x=-Math.PI/2;
    const warning=mesh(root,new T.RingGeometry(.58,.72,24),warnMat,point.x,.115,point.z);warning.rotation.x=-Math.PI/2;
    const frostPlate=mesh(root,new T.PlaneGeometry(TILE-.12,TILE-.12),frostTileMat,point.x,.118,point.z);frostPlate.rotation.x=-Math.PI/2;frostPlate.visible=false;
    const at=tileSwitch(point);
    const tab=mesh(root,new T.CylinderGeometry(.18,.22,.28,10),new T.MeshBasicMaterial({color:0xff8d62}),at.x,at.y,at.z);
    return {base,pit,warning,frostPlate,tab};
  });

  // Giggles the Clown Boss
  const clown=group();clown.position.set(CLOWN.x,0,CLOWN.z);
  const body=new PlushKit(), face=new PlushKit();
  orb(body,quilt(0x694461),.83,0,1.53,0,{sx:1.04,sy:1.26,sz:.73});
  for(const side of [-1,1]){
    orb(body,blue,.36,side*.38,.67,.03,{sx:.9,sy:1.62,sz:1.04});
    orb(body,red,.34,side*.43,.28,.26,{sx:1.12,sy:.66,sz:1.56});
    soft(body,quilt(GOLD),.135,1.02,.097,side*.37,1.43,.57,.038);
    for(let i=0;i<3;i++)orb(face,i%2?red:blue,.185,side*(.59+i*.043),2.9+(i-1)*.21,-.13,{sy:1.08});
  }
  for(let i=0;i<10;i++){
    const a=i*TAU/10;
    orb(body,i%2?cream:gold,.19,Math.cos(a)*.62,2.26,Math.sin(a)*.43,{sx:1.16,sy:.66});
  }
  for(let i=0;i<3;i++)orb(body,gold,.09,0,1.1+i*.3,.666);
  orb(face,felt(0x788665),.65,0,2.96,.04,{sx:1.08,sy:1.04,sz:.77});
  for(const side of [-1,1]){
    orb(face,coal,.14,side*.25,3.04,.497,{sz:.26});
    orb(face,cream,.061,side*.25,3.04,.539,{sz:.33});
  }
  orb(face,red,.137,0,2.89,.56);
  ovalMouth(face,coal,cream,.38,2.69,.497);
  face.cyl(blue,.26,.42,.45,0,3.62,-.01,{seg:14});
  face.cyl(red,.49,.49,.083,0,3.41,-.01,{seg:19});
  orb(face,gold,.115,0,3.883,-.008);
  const arms=[-1,1].map(side=>{
    const arm=group(clown), k=new PlushKit();
    arm.position.set(side*.67,2.04,0);
    orb(k,side>0?red:blue,.29,side*.23,-.15,.04,{sx:1.3,sy:1.24});
    orb(k,quilt(0xb58470),.237,side*.4,-.43,.12,{sy:1.52});
    orb(k,cream,.246,side*.47,-.72,.23,{sx:1.05,sy:1.13});
    finish(k,arm);
    return arm;
  });
  finish(body,clown);finish(face,clown);
  const mask=group(clown), m=new PlushKit();
  orb(m,cream,.62,0,3.02,.59,{sx:1.02,sy:.84,sz:.25});
  orb(m,red,.137,0,2.94,.791);
  for(const side of [-1,1]){
    orb(m,coal,.16,side*.24,3.11,.717,{sx:.82,sy:1.1,sz:.23});
    orb(m,blue,.081,side*.29,2.99,.748,{sx:.89,sy:1.43,sz:.23});
    soft(m,red,.25,.054,.04,side*.25,3.3,.709,.02);
  }
  ovalMouth(m,red,cream,.405,2.78,.738);
  finish(m,mask);
  const bulbs=group();
  for(let i=0;i<=14;i++) {
    const x=(i-7)*.77;
    mesh(bulbs,bulbGeo,litBulbMats[i%3],x,3.87+1.05*(1-Math.abs(x)/6),TENT_DOOR+.27);
  }
  const eyeRing=mesh(root,new T.RingGeometry(.74,.77,36),new T.MeshBasicMaterial({color:0xffd982,transparent:true,opacity:.76,side:T.DoubleSide}),0,3.03,CLOWN.z+.92);

  function ovalMouth(k,dark,tooth,w,y,z) {
    orb(k,dark,w,0,y,z,{sy:.30,sz:.16});
    for(let i=0;i<3;i++)soft(k,tooth,.086,.055,.035,(i-1)*.1,y+.029,z+.051,.013);
  }

  const ring=new T.RingGeometry(.76,.86,32); ring.rotateX(-Math.PI/2);
  const springRings=new T.RingGeometry(.72,.77,32);springRings.rotateX(-Math.PI/2);
  const markers=Array.from({length:3},(_,i)=>{
    const g=group(),k=new PlushKit();
    const color=i===0?BLUE:RED;
    soft(k,quilt(color),1.06,.60,1.06,0,.30,0,.09);
    soft(k,quilt(GOLD),1.16,.12,1.16,0,.63,0,.045);
    for(const side of [-1,1]) {
      soft(k,cream,.11,.53,.037,side*.28,.32,.539,.015);
      soft(k,cream,.037,.53,.11,side*.539,.32,0,.014);
    }
    orb(k,red,.12,0,.33,.569,{sz:.3});
    finish(k,g);
    const landing=mesh(root,springRings,new T.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.85}));
    const ready=mesh(root,springRings,new T.MeshBasicMaterial({color:0x91f0dd,transparent:true,opacity:.85}));
    return {g,landing,ready};
  });
  const fiery=new T.SphereGeometry(.13,10,7);
  const fireworks=Array.from({length:5},()=>{
    const glow=mesh(root,fiery,new T.MeshBasicMaterial({color:0xffc565}));
    const disc=mesh(root,ring,new T.MeshBasicMaterial({color:0xffaa6a,transparent:true,opacity:.75}));
    const burst=mesh(root,new T.SphereGeometry(1,11,7),new T.MeshBasicMaterial({color:0xffcf83,transparent:true,opacity:.58,depthWrite:false}));
    return {glow,disc,burst};
  });
  [carousel,cart,clown,...markers.map(v=>v.g)].forEach(g=>cine.shadows.addDynamic(g));
  cine.shadows.invalidate();

  function update(s) {
    const a=s.amusement,time=s.time,c=a.clown;
    // Carousel gently idles when zone 1 is lit, or spins fast during active sweep
    carousel.rotation.y = a.carousel.until > time ? a.carousel.angle : a.lit[1] ? a.carousel.angle + time * .75 : a.carousel.angle;
    // Coaster cart pose
    const pose = ridePose(a.ride.progress);
    cart.position.set(pose.x, pose.y, pose.z);
    cart.rotation.y = pose.yaw;

    for (const [i,gate] of gates.entries()) {
      const fraction=a.opened[i]!==null?window01((time-a.opened[i])/GATE_LIFT_SECONDS):0;
      gate.position.y=fraction*1.6;
      gate.visible=fraction<1;
    }
    // Zone garlands & ground power cables light up per zone!
    for (let z=0; z<3; z++) {
      const isLit = a.lit[z] || a.lit[3];
      zoneGarlands[z].forEach((b,idx)=>{ b.material = isLit ? litBulbMats[(idx+z)%3] : dimBulbMat; });
      powerCables[z].tube.material = isLit ? litCableMat : dimCableMat;
      powerCables[z].beacon.material = isLit ? litBulbMats[z%3] : dimBulbMat;
    }

    // Oscillating gate latch
    lock.visible=a.lock!=='open';
    const lp=lockPosition(a,time);
    lock.position.set(lp.x,lp.y,lp.z);
    lockLamp.material.color.setHex(a.lock==='frozen'?0x9feaff:0xffcf72);
    lockFrost.visible=a.lock==='frozen';

    // Coaster moving targets
    coasterTargets.forEach((t,i)=>{
      const st=a.targets[i], pos=coasterTargetPosition(a,i);
      t.g.position.set(pos.x,pos.y,pos.z);
      const frozen=st.frozenUntil>time && !st.lit;
      t.mat.color.setHex(st.lit?0x8cf4ba:frozen?0x96e9ff:0xffca72);
      t.core.material.color.setHex(st.lit?0xffffff:0xa83c48);
      t.frostShell.visible=frozen;
    });

    // Roadside balloons
    balloons.forEach((b,i)=>{
      b.visible=!!a.balloons[i];
      if (b.visible) b.position.y=BALLOONS[i].y+Math.sin(time*2.3+i)*.14;
    });

    valveLamp.material.color.setHex(a.valveLatched?0xa4f89d:a.valveUntil>time?0x9feaff:0xf2a367);
    const venting=a.zone===1 && !a.valveLatched && a.valveUntil<=time;
    vapor.forEach((m,i)=>{
      const phase=(time*1.45+i*.19)%1;
      m.visible=venting; m.scale.setScalar(.45+phase*.8);
      m.position.set(VALVE.x+Math.sin(phase*5+i)*.24,VALVE.y+.21+phase*1.18,VALVE.z);
      m.material.opacity=(1-phase)*.42;
    });
    motor.visible=c.defeatedAt!==null && !a.pickedUp;
    motor.rotation.y=time*1.55;
    clownFrost.visible=c.frozenUntil>time;
    clownFrost.position.set(c.x,2.45,c.z+.16);
    bulbs.visible=a.lit[2] || c.defeatedAt!==null;
    const victory=c.defeatedAt===null?0:window01((time-c.defeatedAt)/1.2);
    // Clown pop-up bounce during intro cutscene
    const introHop = a.clownIntroUntil > time ? Math.abs(Math.sin((time - a.clownIntroStarted) * 4.5)) * .45 : 0;
    clown.rotation.z=-victory*1.34;
    clown.position.set(c.x,-victory*.72 + introHop,c.z);
    eyeRing.position.x=c.x;
    const flash=c.flash>time ? .017*Math.sin(time*83) : 0;
    clown.scale.set(1+flash,1-flash,1);
    mask.visible=!!c.mask;
    mask.rotation.z=c.mask===1 ? Math.sin(time*12)*.056 : 0;
    eyeRing.visible=c.entered && !!c.mask && time<a.launchUntil && s.player.jump>.52;
    for(let i=0;i<2;i++){
      const side=i===0?-1:1;
      const handing=a.clownIntroUntil>time||!!a.volleys.length||a.boxes.some(b=>time<b.land)||a.fireworks.some(f=>time<f.impact);
      arms[i].rotation.z=side*(handing?.55:.13)+Math.sin((c.poseTime+time*.5)*2.9+i*.8)*.11;
      arms[i].rotation.x=handing ? -.60+Math.sin((c.poseTime+time)*8+i*2)*.35 : Math.sin(c.poseTime*1.9+i)*.12;
    }
    for(let i=0;i<tileRims.length;i++){
      const tile=a.tiles[i],r=tileRims[i],off=tile.off>0&&time>=tile.off&&time<tile.until&&!(tile.frozenUntil>time);
      r.base.visible=!off;r.pit.visible=off;
      const frozen=tile.frozenUntil>time;
      const warn=!off&&tile.off>0&&time>=tile.warn&&time<tile.off;
      r.warning.visible=frozen||warn;
      r.warning.material = frozen ? iceMat : warnMat;
      r.frostPlate.visible=frozen;
      r.tab.visible=r.warning.visible;
      r.tab.material.color.setHex(frozen?0x90e6ff:0xff8d62);
      r.warning.scale.setScalar(1.02+Math.sin(time*13)*.12);
    }
    for(let i=0;i<markers.length;i++){
      const v=markers[i],b=a.boxes[i];
      v.g.visible=!!b&&!b.used;
      v.landing.visible=!!b&&time<b.land;
      v.ready.visible=!!b&&b.settled&&!b.used;
      if(!b)continue;
      const flight=b.settled?1:window01((time-b.thrown)/(b.land-b.thrown));
      v.g.position.set(CLOWN.x+(b.x-CLOWN.x)*flight,2.15*(1-flight)+3.0*Math.sin(Math.PI*flight),CLOWN.z+(b.z-CLOWN.z)*flight);
      v.g.rotation.set((1-flight)*Math.sin(time*8),i*.45,(1-flight)*Math.sin(time*7+i));
      v.landing.position.set(b.x,.131,b.z);
      v.ready.position.set(b.x,.133,b.z);
      v.ready.scale.setScalar(.92+Math.sin(time*5)*.09);
    }
    for(let i=0;i<fireworks.length;i++){
      const v=fireworks[i],f=a.fireworks[i];
      v.glow.visible=v.disc.visible=!!f&&!f.spent;
      v.burst.visible=!!f&&f.spent&&time<f.impact+.33;
      if(!f)continue;
      const t=window01((time-f.created)/(f.impact-f.created));
      v.glow.position.set(CLOWN.x+(f.x-CLOWN.x)*t,1.35*(1-t)+5.5*Math.sin(Math.PI*t),CLOWN.z+(f.z-CLOWN.z)*t);
      v.disc.position.set(f.x,.137,f.z);v.disc.scale.setScalar(.8+t*.7);
      const age=window01((time-f.impact)/.34);
      v.burst.position.set(f.x,.59,f.z);v.burst.scale.setScalar(.35+age*1.65);
      v.burst.material.opacity=(1-age)*.65;
    }
  }
  return {update};
}
