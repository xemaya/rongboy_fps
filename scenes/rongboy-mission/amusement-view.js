import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { plush, plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { uiCanvasFont } from './interface-font.js';
import { copy } from './language.js';
import { ridePose, PLATFORM, CAROUSEL, SWITCH, TENT_DOOR, CLOWN, TILES, TILE, GATES, GATE_LIFT_SECONDS, MIDWAY_TARGETS, LEVER } from './amusement.js';

const RED=0xad494b, CREAM=0xf6dfab, BLUE=0x337a84, GOLD=0xf3ac51, COAL=0x34272e, PINK=0xdb7772;
const TAU=2*Math.PI;
const window01=t=>Math.max(0,Math.min(1,t));

export function createAmusementView(cine,world,level) {
  const root=new T.Group(); root.name='Amusement park'; world.root.add(root);
  const M=plushMaterials(world.lib,{lit:m=>world.volume.light(m)});
  const felt=color=>M('felt',color), quilt=color=>M('quilt',color), knit=color=>M('knit',color);
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
  const gates=GATES.map((g,i)=>{
    const panel=group(), k=new PlushKit();
    soft(k,quilt(i%2 ? BLUE : RED),g.width,2.74,.25,0,1.37,0,.075);
    for(const side of [-1,1])soft(k,cream,.17,2.64,.045,side*.97,1.37,.137,.023);
    const arch=new PlushKit();
    for(const side of [-1,1]){
      const x=g.x+side*(g.width/2+.13);
      soft(arch,red,.32,3.23,.48,x,1.61,g.z,.072);
      orb(arch,gold,.14,x,3.31,g.z);
    }
    soft(arch,red,g.width+.52,.20,.44,g.x,3.23,g.z,.057);
    finish(arch,root);
    finish(k,panel,false);
    panel.position.set(g.x,0,g.z);
    const labels=[copy('过山车区','COASTER'),copy('木马广场','CAROUSEL PLAZA'),copy('游戏摊街','MIDWAY'),copy('后台仓库','BACKSTAGE'),copy('马戏帐篷','BIG TOP')];
    sign(labels[i],g.x,3.13,g.z+.26,2.74);
    return panel;
  });
  for (const f of level.furnitureBoxes) {
    const { parkStyle:style,x,z,w,d,h }=f;
    if(style==='divider'){
      const panelColors=[0x638977,0x597c80,0xb76560,0x687a64,0x8b5865];
      const lane=Number(f.id.split('-')[1]);
      const pieces=Math.ceil(w/1.35);
      for(let i=0;i<pieces;i++){
        const span=w/pieces, center=x-w*.5+(i+.5)*span;
        soft(kit,quilt(i%2 ? panelColors[lane] : CREAM),span-.017,h,d,center,h*.5,z,.027);
      }
      continue;
    }
    if(style==='stock'){
      soft(kit,quilt(0x78667b),w,h,d,x,h*.5,z,.08);
      for(let j=0;j<3;j++){
        soft(kit,cream,w-.08,.047,.028,x,.38+j*.47,z+d*.51,.017);
        for(let i=0;i<4;i++)orb(kit,i%2?gold:blue,.126,x-w*.32+i*w*.21,.49+j*.47,z+d*.52,{sz:.40});
      }
      continue;
    }
    if(style!=='ticket'&&style!=='booth')continue;
    const isTicket=style==='ticket', accent=x<0?red:blue;
    soft(kit,accent,w,h,d,x,h*.5,z,.079);
    soft(kit,cream,w+.12,.14,d+.12,x,h-.055,z,.063);
    for(const side of [-1,1])
      soft(kit,accent,.15,1.67,.17,x+side*(w*.49),h+.8,z+d*.43,.034);
    for(let i=0;i<7;i++)
      soft(kit,i%2?accent:cream,w/7+.016,.095,d+.35,x+w*((i+.5)/7-.5),h+1.64,z,.023);
    for(let i=0;i<6;i++)orb(kit,gold,.092,x+w*((i+.6)/6-.5),h+1.55,z+d*.52);
    sign(isTicket?copy('售票亭','TICKETS'):z>10?copy('纽扣靶','BUTTONS'):copy('线团靶','SPOOL TOSS'),x,h+1.57,z+d*.57,Math.min(w*.77,2.8));
  }
  for(const [x,z,w,d,color] of [[0,50,7.3,7.4,0xc18868],[0,41.25,5.5,5.3,BLUE],[.9,26.85,5.7,2.2,BLUE],[1.9,19.2,5.5,8.3,0xcc9078],[0,9.98,7.5,8.0,0x9ea777],[0,-.45,9.8,7.1,0x897a8f]]) {
    soft(kit,quilt(color),w,.043,d,x,.017,z,.015);
  }
  const targets=MIDWAY_TARGETS.map((point,i)=>{
    const g=group();g.position.set(point.x,point.y,point.z);
    const active=new T.MeshBasicMaterial({color:0xffce81});
    const lit=mesh(g,new T.SphereGeometry(.415,20,12),active);lit.scale.z=.29;
    const center=mesh(g,new T.SphereGeometry(.16,14,9),new T.MeshBasicMaterial({color:0xa73e4a}),0,0,.128);center.scale.z=.28;
    return {lit,center,i};
  });
  const lever=group(),stand=new PlushKit(),handle=new PlushKit();
  soft(stand,blue,.55,.91,.52,LEVER.x,.455,LEVER.z,.08);
  soft(handle,gold,.09,.41,.09,0,.20,0,.037);
  orb(handle,red,.16,0,.37,0);
  finish(stand,root);finish(handle,lever,false);
  lever.position.set(LEVER.x,.91,LEVER.z);
  sign(copy('帘闸扳杆','CURTAIN LEVER'),LEVER.x,.67,LEVER.z+.3,1.16);

  // Station, elevated track and its matching seat.
  const station=PLATFORM.z-14.15;
  soft(kit,quilt(BLUE),5.4,.052,4.6,0,.042,15.65+station,.012);
  for(const i of [-1,1]) {
    soft(kit,red,.29,3.6,.28,i*2.55,1.8,15+station);
    orb(kit,gold,.19,i*2.55,3.68,15+station);
    soft(kit,blue,7.1,1.14,.16,i*6.45,.57,12.13+station);
    for(let j=0;j<9;j++)soft(kit,cream,.12,1.21,.13,i*(3.2+j*.78),.64,12.18+station);
  }
  soft(kit,red,5.45,.22,.48,0,3.27,15+station,.075);
  sign(copy('过山车','COASTER'),0,3.32,15.28+station,3.5);
  for(const side of [-1,1]) {
    const points=Array.from({length:49},(_,i)=>{
      const p=ridePose(i/48);
      return new T.Vector3(p.x+Math.cos(p.yaw)*side*.43,p.y,p.z-Math.sin(p.yaw)*side*.43);
    });
    const track=mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(points),62,.071,7,false),raw('felt',side<0?RED:BLUE));
    track.castShadow=true;
  }
  for(let i=0;i<=23;i++) {
    const p=ridePose(i/23);
    kit.soft(cream,1.13,.10,.16,p.x,p.y-.1,p.z,{r:.03,ry:p.yaw});
    if(i%4===1 && p.y>.55) {
      for(const side of [-1,1])soft(kit,blue,.17,p.y,.18,p.x+side*.39,p.y*.5,p.z);
    }
  }
  const cart=group(), seat=new PlushKit();
  soft(seat,red,1.19,.36,1.45,0,.25,0,.13);
  soft(seat,quilt(BLUE),.96,.18,.7,0,.5,.29,.09);
  soft(seat,quilt(BLUE),.96,.6,.23,0,.67,.66,.09);
  soft(seat,gold,1.15,.19,.27,0,.62,-.78,.075);
  for(const side of [-1,1]){
    soft(seat,red,.16,.39,1.34,side*.58,.49,0,.07);
    for(const z of [-.52,.53])seat.cyl(coal,.145,.145,.14,side*.5,.123,z,{seg:10,rz:Math.PI/2});
  }
  finish(seat,cart);

  // Circular sweeper. The four arms align to the four damage sectors.
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
  for(let i=0;i<11;i++){
    const x=-7.5+i*1.5;
    soft(kit,i%2?quilt(BLUE):quilt(RED),1.26,.024,1.16,x,.024,c.z+3.3,.01);
  }

  // Carnival canopy and canvas walls. The entrance is the gap between its two red pillars.
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
  for(const side of [-1,1]) {
    soft(kit,quilt(RED),1.0,.37,1.35,side*4.82,.2,-6.11,.065);
    orb(kit,gold,.13,side*4.82,.52,-6.05);
  }
  finish(kit,root);
  const groundDark=new T.MeshBasicMaterial({color:0x161323});
  const warnMat=new T.MeshBasicMaterial({color:0xffca71});
  const platformShape=new T.BoxGeometry(TILE-.045,.082,TILE-.045);
  const tileRims=TILES.map((point,i)=>{
    const c=i%2?0x779994:0xd6a272;
    const base=mesh(root,platformShape,raw('quilt',c),point.x,.063,point.z);
    const pit=mesh(root,new T.PlaneGeometry(TILE,TILE),groundDark,point.x,.074,point.z);pit.rotation.x=-Math.PI/2;
    const warning=mesh(root,new T.RingGeometry(.58,.69,24),warnMat,point.x,.113,point.z);warning.rotation.x=-Math.PI/2;
    return {base,pit,warning};
  });

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
  const lampShape=new T.SphereGeometry(.11,9,6);
  const lampColors=[0xffbe66,0xff806e,0x9af5e2].map(color=>new T.MeshBasicMaterial({color}));
  for(let i=0;i<=14;i++) {
    const x=(i-7)*.77;
    mesh(bulbs,lampShape,lampColors[i%3],x,3.87+1.05*(1-Math.abs(x)/6),TENT_DOOR+.27);
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
  [cart,carousel,clown,...markers.map(v=>v.g)].forEach(g=>cine.shadows.addDynamic(g));
  cine.shadows.invalidate();

  function update(s) {
    const a=s.park,time=s.time,c=a.clown;
    const pose=ridePose(a.ride.progress);
    cart.position.set(pose.x,pose.y,pose.z);cart.rotation.y=pose.yaw;
    carousel.rotation.y=a.carousel.angle;
    for (const [i,gate] of gates.entries()) {
      const fraction=a.opened[i]?window01((time-a.opened[i])/GATE_LIFT_SECONDS):0;
      gate.position.y=fraction*3;
      gate.visible=fraction<1;
    }
    for (const target of targets) {
      target.lit.material.color.setHex(a.targets[target.i] ? 0x7ed4ab : 0xffce81);
      target.center.visible=!a.targets[target.i];
    }
    lever.rotation.x=a.lever?1.03:-.49;
    bulbs.visible=c.defeatedAt!==null;
    const victory=c.defeatedAt===null?0:window01((time-c.defeatedAt)/1.2);
    clown.rotation.z=-victory*1.34;
    clown.position.set(0,-victory*.72,CLOWN.z);
    const flash=c.flash>time ? .017*Math.sin(time*83) : 0;
    clown.scale.set(1+flash,1-flash,1);
    mask.visible=!!c.mask;
    mask.rotation.z=c.mask===1 ? Math.sin(time*12)*.056 : 0;
    eyeRing.visible=c.entered && !!c.mask && time<a.launchUntil && s.player.jump>.52;
    for(let i=0;i<2;i++){
      const side=i===0?-1:1;
      const handing=!!a.volleys.length||a.boxes.some(b=>time<b.land)||a.fireworks.some(f=>time<f.impact);
      arms[i].rotation.z=side*(handing?.51:.13)+Math.sin(time*2.9+i*.8)*.11;
      arms[i].rotation.x=handing ? -.57+Math.sin(time*8+i*2)*.33 : Math.sin(time*1.9+i)*.12;
    }
    for(let i=0;i<tileRims.length;i++){
      const tile=a.tiles[i],r=tileRims[i],off=tile.off>0&&time>=tile.off&&time<tile.until;
      r.base.visible=!off;r.pit.visible=off;
      r.warning.visible=!off&&tile.off>0&&time>=tile.warn&&time<tile.off;
      r.warning.scale.setScalar(1.02+Math.sin(time*13)*.12);
    }
    for(let i=0;i<markers.length;i++){
      const v=markers[i],b=a.boxes[i];
      v.g.visible=!!b&&!b.used;
      v.landing.visible=!!b&&time<b.land;
      v.ready.visible=!!b&&b.settled&&!b.used;
      if(!b)continue;
      const flight=window01((time-b.thrown)/(b.land-b.thrown));
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
