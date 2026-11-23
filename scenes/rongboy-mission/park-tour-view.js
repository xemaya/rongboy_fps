import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { plush, plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { mulberry32 } from '../../cine-engine/engine/noise.js';
import { uiCanvasFont } from './interface-font.js';
import { copy } from './language.js';
import { TOUR_PATH, TOUR_STOPS, TOUR_BOUNDS, TOUR_TENT, TOUR_MAZE, TOUR_BRIDGE, TOUR_CHANNEL, isTourWalkable } from './park-tour-layout.js';

const TAU=2*Math.PI;
const RED=0xb85652, CREAM=0xf1ddb0, TEAL=0x3b8590, GOLD=0xe3af55, INK=0x3e3640;
const FOREST=0x657b4d, MOSS=0x94a163, PINE=0x386951;

export function createParkTour(cine,world,{reduced=false}={}) {
  const root=new T.Group(); root.name='Stitched amusement park'; world.root.add(root);
  const M=plushMaterials(world.lib,{lit:m=>world.volume.light(m)});
  const felt=c=>M('felt',c), quilt=c=>M('quilt',c), wood=M('toy_wood');
  const cream=felt(CREAM),red=felt(RED),teal=felt(TEAL),gold=felt(GOLD),ink=felt(INK);
  const raw=(id,color)=>world.volume.light(plush(world.lib,id,color));
  const k=new PlushKit(), lighting=[];
  const rand=mulberry32(231123);
  const box=(kit,m,w,h,d,x,y,z,r=.045)=>kit.soft(m,w,h,d,x,y,z,{r});
  const puff=(kit,m,r,x,y,z,o={})=>kit.sphere(m,r,x,y,z,{seg:10,rings:7,...o});
  const finish=(kit,parent=root,cast=true)=>parent.add(...kit.build({cast}));
  const group=(parent=root)=>{const g=new T.Group();parent.add(g);return g;};
  const obj=(parent,geo,mat,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };

  function sign(text,x,y,z,w,yaw=0) {
    const canvas=document.createElement('canvas');canvas.width=544;canvas.height=144;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f5dfac';ctx.beginPath();ctx.roundRect(4,4,536,136,28);ctx.fill();
    ctx.strokeStyle='#99704d';ctx.lineWidth=4;ctx.setLineDash([12,8]);ctx.strokeRect(19,16,506,111);
    ctx.fillStyle='#2e4c3e';ctx.font=uiCanvasFont(56);ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(text,272,74,490);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    const panel=obj(root,new T.PlaneGeometry(w,w*144/544),new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide}),x,y,z);
    panel.rotation.y=yaw;
  }
  function landmark(stop) {
    const [x,z,yaw]=stop.sign;
    for(const side of [-1,1])box(k,wood,.14,1.95,.14,x+Math.cos(yaw)*side*1.1,.975,z-Math.sin(yaw)*side*1.1,.035);
    sign(copy(stop.name,stop.en),x,1.72,z,2.93,yaw);
  }
  for(const stop of TOUR_STOPS)landmark(stop);

  // Keep the indicated trail and the walkable edges in the same coordinates.
  function throat(i,offset) {
    const p=TOUR_PATH[i], a=TOUR_PATH[Math.max(0,i-1)],b=TOUR_PATH[Math.min(TOUR_PATH.length-1,i+1)];
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||1;
    return [p.x-dz/d*p.width*offset,.041,p.z+dx/d*p.width*offset];
  }
  // Rasterize the union of rounded trail sections to avoid folds at tight turns.
  const pathCanvas=document.createElement('canvas');
  const bounds=TOUR_BOUNDS,mw=bounds.maxX-bounds.minX,md=bounds.maxZ-bounds.minZ;
  const pxPerM=24;
  pathCanvas.width=mw*pxPerM; pathCanvas.height=md*pxPerM;
  const pathCtx=pathCanvas.getContext('2d');
  const xPixel=x=>(x-bounds.minX)*pxPerM,zPixel=z=>(z-bounds.minZ)*pxPerM;
  pathCtx.lineCap='round'; pathCtx.lineJoin='round';
  function strokePath(fn) {
    for(let i=1;i<TOUR_PATH.length;i++) {
      const a=TOUR_PATH[i-1],b=TOUR_PATH[i];
      fn(a,b);
      pathCtx.beginPath();pathCtx.moveTo(xPixel(a.x),zPixel(a.z));pathCtx.lineTo(xPixel(b.x),zPixel(b.z));pathCtx.stroke();
    }
  }
  strokePath((a,b)=>{pathCtx.strokeStyle='#ae916d';pathCtx.lineWidth=(a.width+b.width+.07)*pxPerM;});
  strokePath((a,b)=>{pathCtx.strokeStyle='#e3c999';pathCtx.lineWidth=(a.width+b.width-.04)*pxPerM;});
  pathCtx.save();pathCtx.globalCompositeOperation='source-atop';
  pathCtx.fillStyle='#b8c9b9';pathCtx.fillRect(xPixel(6),zPixel(13),14*pxPerM,9*pxPerM);
  pathCtx.lineWidth=.8;pathCtx.strokeStyle='#7f674e38';
  for(let y=0;y<pathCanvas.height;y+=8){
    pathCtx.beginPath();pathCtx.moveTo(0,y);pathCtx.lineTo(pathCanvas.width,y);pathCtx.stroke();
  }
  pathCtx.strokeStyle='#f8e4ad79';
  for(let x=0;x<pathCanvas.width;x+=9){
    pathCtx.beginPath();pathCtx.moveTo(x,0);pathCtx.lineTo(x,pathCanvas.height);pathCtx.stroke();
  }
  pathCtx.restore();
  pathCtx.strokeStyle='#62705a';pathCtx.lineWidth=2.25;pathCtx.setLineDash([11,8]);
  pathCtx.beginPath();
  for(const [i,point] of TOUR_PATH.entries()) {
    if(i===0)pathCtx.moveTo(xPixel(point.x),zPixel(point.z));
    else pathCtx.lineTo(xPixel(point.x),zPixel(point.z));
  }
  pathCtx.stroke();
  const trailTexture=new T.CanvasTexture(pathCanvas);trailTexture.colorSpace=T.SRGBColorSpace;
  trailTexture.anisotropy=4;
  const trailMesh=obj(root,new T.PlaneGeometry(mw,md),
    world.volume.light(new T.MeshStandardMaterial({map:trailTexture,roughness:1,alphaTest:.45,transparent:true})),
    (bounds.minX+bounds.maxX)/2,.031,(bounds.minZ+bounds.maxZ)/2);
  trailMesh.rotation.x=-Math.PI/2;

  function tree(x,z,size=1,orange=false) {
    box(k,M('knit',0x926844),.39*size,1.9*size,.43*size,x,.95*size,z,.11);
    const c=orange?0xb1914d:rand()>.58?FOREST:PINE;
    puff(k,M('leaves',c),1.23*size,x,2.63*size,z,{sy:1.12});
    for(const [dx,dz] of [[-.63,.12],[.69,.29],[.18,-.65]])
      puff(k,M('leaves',orange?0xc7a65c:MOSS),.62*size,x+dx*size,2.5*size,z+dz*size,{sy:1.12});
  }
  function stone(x,y,z,r) {
    puff(k,quilt(0x918d82),r,x,y,z,{sx:1.2,sy:.70,sz:.91});
  }
  function bush(x,z,r) {
    puff(k,M('leaves',rand()<.48?MOSS:FOREST),r,x,r*.48,z,{sx:1.15,sy:.72});
  }

  // The stitched verge is backed by real-looking embankments and shrubs.
  for(let i=8;i<TOUR_PATH.length-5;i+=5){
    for(const side of [-1,1]) {
      const [x,,z]=throat(i,side*1.19);
      if(isTourWalkable(x,z,.15)||x< -34&&z>3.2&&z<8.95||x>5.5&&x<20.45&&z>12.7&&z<22.6||Math.hypot(x,z)<8.9)continue;
      if(rand()<.36)stone(x,.23,z,.48);
      else if(rand()<.82)bush(x,z,.45+rand()*.38);
      else {
        for(let j=0;j<4;j++)puff(k,felt(j%2?GOLD:0xd98583),.11,x+rand()*.61,.14+rand()*.12,z+rand()*.55,{sy:.65});
      }
    }
  }
  const trees=[
    [-11,23,1.1],[-7,25,1.35],[-22,27.2,.98],[-29,26,1.12],[-34,23,1.15],
    [-27,10,.92],[-21,11.9,1.27],[-17.2,15,1.05],[-13.5,18.0,1.3],
    [-19.6,1.0,1.06],[-16.5,-4.2,1.34],[-18.0,-8.5,1.07],[-11.7,-6.1,1.1],
    [-37.9,-12.6,1.08],[-34.2,-22.3,1.22],[-28.2,-26.8,1.33],[-21.0,-27,1.18],
    [-13.6,-26.8,1.0],[-1.7,-27.9,1.03],[5.6,-29.7,1.42],[12.1,-30.4,1.19],
    [26.5,-28.5,1.32],[34.8,-26.4,1.27],[38.0,-23.6,1.12],
    [5.4,-17.8,1.3],[9.3,-16,1.1],[12.0,-12.6,1.21],[17.8,-11.3,.96],[24.5,-13.1,1.24],
    [26.7,-1.6,1.05],[19.4,-4.6,1.29],[19.7,1,1.12],[17.3,6.9,1.1],
    [10.3,6.1,1.19],[8.1,10.5,1.11],[-8.4,11.8,1.16],[-9.7,16.3,1.08],[-5.9,21.6,1.1],
    [14.2,27.8,1.35],[20.3,26.1,1.02],[28.2,23.25,1.24],[33.7,21.2,1.2],[37.5,17,1.2]
  ];
  trees.forEach(([x,z,r],i)=>tree(x,z,r,i%6===0));
  const orchardC=felt(0xba644c);
  for(const [x,z] of [[-12,-13],[4,-13.2],[10.8,-9],[-11.8,5.3],[-8,7.7],[11.1,1.4]]){
    tree(x,z,1.04);
    for(let j=0;j<5;j++){const a=j*TAU/5;puff(k,orchardC,.14,x+Math.cos(a)*.83,2.35+rand()*.84,z+Math.sin(a)*.84);}
  }

  // Entry arcade
  for(const side of [-1,1]){
    const x=-16.2+side*2.02;
    box(k,red,.57,3.38,.57,x,1.69,26.68,.13);
    box(k,cream,.69,.49,.64,x,3.10,26.68,.08);
    puff(k,gold,.20,x,3.58,26.68);
  }
  k.tube(red,Array.from({length:19},(_,i)=>{const a=Math.PI*i/18;return [-16.2+2.05*Math.cos(a),3.13+.95*Math.sin(a),26.68];}),.18,{radial:8});
  sign(copy('布偶游乐园','PLUSHWOOD PARK'),-16.2,3.50,26.91,3.5);
  box(k,wood,1.85,1.26,1.5,-12.4,.63,27.9,.11);
  boothRoof(-12.4,27.9,2.08,2.1,.86,red);

  function stripedRoof(kit,x,z,r,rim,peak,colors,sectors=24,inside=false) {
    const profile=[[r,rim],[r*.83,rim+(peak-rim)*.28],[r*.50,rim+(peak-rim)*.64],[r*.19,rim+(peak-rim)*.87],[.035,peak]];
    for(let i=0;i<sectors;i++){
      const a=i*TAU/sectors,b=(i+1)*TAU/sectors;
      for(let j=1;j<profile.length;j++) {
        const [r0,y0]=profile[j-1],[r1,y1]=profile[j];
        const p=(theta,radius,y)=>[x+Math.sin(theta)*radius,y,z+Math.cos(theta)*radius];
        const uv=[[0,0],[1,0],[1,1],[0,1]];
        kit.quad(colors[i%colors.length],p(a,r0,y0),p(b,r0,y0),p(b,r1,y1),p(a,r1,y1),uv,1,[0,1,0]);
        if(inside)kit.quad(colors[i%colors.length],p(a,r0,y0-.023),p(b,r0,y0-.023),p(b,r1,y1-.023),p(a,r1,y1-.023),uv,.47,[0,-1,0]);
      }
    }
  }
  function boothRoof(x,z,y,w,d,accent){
    for(let i=0;i<7;i++)box(k,i%2?cream:accent,w/7+.014,.13,d,x+w*((i+.5)/7-.5),y,z,.03);
  }

  // Carousel, on a circular wood plinth.
  const car=TOUR_STOPS[1],carTop=new PlushKit();
  k.cyl(teal,3.60,3.69,.29,car.x,.145,car.z,{seg:32});
  k.cyl(cream,3.53,3.53,.12,car.x,.34,car.z,{seg:32});
  k.cyl(gold,.21,.29,4.18,car.x,2.25,car.z,{seg:15});
  stripedRoof(k,car.x,car.z,3.55,3.67,4.9,[teal,gold]);
  k.cyl(gold,3.59,3.59,.17,car.x,3.61,car.z,{seg:40});
  puff(k,gold,.23,car.x,5.04,car.z);
  const horses=group();horses.position.set(car.x,0,car.z);
  for(let i=0;i<6;i++){
    const angle=i*TAU/6,x=Math.sin(angle)*2.32,z=Math.cos(angle)*2.32;
    carTop.cyl(gold,.055,.055,2.97,x,2.03,z,{seg:8});
    const body=felt([0xd48178,0x6cb7af,0xedcb88][i%3]);
    puff(carTop,body,.24,x,1.53,z+.29,{sy:1.3});
    box(carTop,body,.47,.48,.81,x,1.21,z,.15);
    puff(carTop,cream,.145,x,1.4,z+.47);
    puff(carTop,ink,.037,x+.12,1.62,z+.46);
    for(const sx of [-1,1])for(const sz of [-1,1])box(carTop,body,.12,.41,.13,x+sx*.16,.86,z+sz*.23,.043);
    box(carTop,red,.50,.11,.37,x,1.47,z-.08,.037);
  }
  finish(carTop,horses,false);

  // Rapids, a wooden crossing on the trail and a taller looping channel behind it.
  const w=TOUR_CHANNEL,b=TOUR_BRIDGE;
  box(k,quilt(0x4a9c9e),w.w,.07,w.d,w.x,.054,w.z,.025);
  box(k,quilt(0x62aeb3),w.w*.98,.031,w.d*.78,w.x,.091,w.z,.013);
  const plankCount=12,n=b.d/plankCount;
  for(let i=0;i<plankCount;i++) box(k,i%3?wood:felt(0xb78354),b.w,.12,n-.022,b.x,.13,b.z-b.d*.5+(i+.5)*n,.022);
  for(const side of [-1,1]){
    const x=b.x+side*b.w*.50;
    box(k,wood,.11,.13,b.d,x,.87,b.z,.024);
    for(const dz of [-2.55,-.98,.98,2.55])box(k,wood,.17,.98,.17,x,.52,b.z+dz,.036);
  }
  const rapidsCurve=new T.CatmullRomCurve3([
    [-30.7,.42,4.8],[-33.6,.7,1.38],[-31.8,1.63,-1.1],[-27.8,4.28,-2.37],
    [-23.15,5.08,-.64],[-21.6,3.0,3.12],[-24.9,.85,6.2],[-28.3,.51,6.18],
  ].map(v=>new T.Vector3(...v)),true,'centripetal');
  const wet=quilt(0x509eac),bank=quilt(0x2b727e);
  const waterPts=rapidsCurve.getPoints(55), edges=[[],[]];
  for(let i=0;i<waterPts.length;i++){
    const p=waterPts[i], t=rapidsCurve.getTangent(i/(waterPts.length-1));
    const n=Math.hypot(t.x,t.z)||1;
    edges[0].push([p.x+t.z/n*.77,p.y-.13,p.z-t.x/n*.77]);
    edges[1].push([p.x-t.z/n*.77,p.y-.13,p.z+t.x/n*.77]);
    if(i>0)k.quad(wet,edges[0][i-1],edges[0][i],edges[1][i],edges[1][i-1],[[0,i-1],[0,i],[1.6,i],[1.6,i-1]],1,[0,1,0]);
    if(i%8===0&&p.y>1)box(k,wood,.21,p.y,.21,p.x,p.y*.5,p.z,.04);
  }
  for(const edge of edges)k.tube(bank,edge,.16,{straight:true});
  for(const [x,z,r] of [[-31.3,.9,1.3],[-30.7,-.5,1.62],[-28.9,-.34,1.35],[-30.7,2.5,.96],[-19.8,4.6,.92]])stone(x,r*.57,z,r);
  for(let i=0;i<6;i++){
    const x=-30.6+(i-2.5)*.21;
    k.tube(felt(i%2?0xaeefde:0x71c5c8),[[x,3.62,-.07],[x,3.1,.09],[x,2.2,.24],[x,.68,.56]],.105,{straight:true});
  }
  const boats=[0,.51].map(()=>{
    const g=group(),bk=new PlushKit();
    puff(bk,felt(0xba7450),.47,0,.075,0,{sx:.62,sy:.31,sz:1.41});
    box(bk,cream,.44,.075,.32,0,.20,.06,.035);
    finish(bk,g,false);return g;
  });

  // Coaster with a separate pair of rails, support lattice and one little train.
  const coaster=new T.CatmullRomCurve3([
    [-29.6,1.73,-12.5],[-28.8,2.08,-17.36],[-25.7,6.7,-18.7],[-20.9,7.72,-17.0],
    [-18.6,2.55,-13.4],[-21.9,4.01,-9.9],[-25.0,5.88,-10.3],[-28.9,2.19,-9.22],
  ].map(p=>new T.Vector3(...p)),true,'centripetal');
  const pair=[[],[]];
  for(let i=0;i<=64;i++){
    const t=i/64,p=coaster.getPoint(t),v=coaster.getTangent(t),n=Math.hypot(v.x,v.z)||1;
    for(let side=0;side<2;side++)pair[side].push([p.x+(side*2-1)*v.z/n*.49,p.y,p.z-(side*2-1)*v.x/n*.49]);
    if(i%2===0)k.tube(wood,[pair[0][i],pair[1][i]],.087,{straight:true});
    if(i%6===1) {
      box(k,wood,.18,p.y,.19,p.x,p.y*.5,p.z,.034);
      k.tube(wood,[[p.x-.83,.11,p.z],[p.x,p.y*.73,p.z]],.095,{straight:true});
    }
  }
  pair.forEach((path,i)=>k.tube(i?gold:red,path,.085,{straight:true}));
  box(k,wood,3.04,.57,2.17,-29.9,.28,-17.3,.08);
  boothRoof(-30,-17.3,2.48,3.53,2.5,red);
  const train=group(),trainKit=new PlushKit();
  for(const d of [-.54,.69]){
    box(trainKit,d<0?red:gold,.76,.4,.83,0,.31,d,.12);
    box(trainKit,teal,.59,.33,.15,0,.62,d-.29,.041);
  }
  finish(trainKit,train,false);

  // Haunted timber house and its garden on the north arc.
  const h=TOUR_STOPS[4];
  box(k,quilt(0x716477),8.6,4.73,7.1,h.x,2.36,h.z,.10);
  for(const side of [-1,1])for(let j=0;j<6;j++){
    const x=h.x+side*(j+.5)*.71,pitch=.58;
    k.soft(felt(j%2?0x55485d:0x674b66),.87,.26,7.72,x,4.76+(4.35-Math.abs(x-h.x))*.63,h.z,{r:.06,rz:-side*pitch});
  }
  for(const side of [-1,1]){
    const z=h.z+side*3.62, timber=felt(0x55455b);
    for(let i=0;i<11;i++){
      const x=h.x+(i-5)*.76, height=2.51-Math.abs(x-h.x)*.56;
      box(k,timber,.77,height,.18,x,4.62+height*.50,z,.027);
    }
    box(k,gold,.64,.61,.087,h.x,5.49,z+side*.09,.075);
    box(k,ink,.07,.65,.10,h.x,5.49,z+side*.14,.024);
  }
  for(const side of [-1,1])for(const offset of [-2.23,0,2.21]){
    const x=h.x+side*4.35,z=h.z+offset;
    box(k,ink,.088,.83,.55,x,2.63,z,.056);
    box(k,side>0?quilt(0xa77d58):gold,.10,.64,.38,x+side*.046,2.63,z,.049);
  }
  box(k,ink,1.58,2.2,.079,h.x,1.1,h.z-3.58,.083);
  box(k,wood,2.42,.23,1.14,h.x,.115,h.z-3.92,.076);
  for(const x of [-2.75,-1.54,1.62,2.65]){
    const z=h.z-3.6;
    box(k,ink,.64,.95,.089,h.x+x,2.65,z,.062);
    box(k,gold,.45,.77,.09,h.x+x,2.65,z-.036,.025);
    box(k,ink,.047,.83,.11,h.x+x,2.65,z-.071,.015);
  }
  box(k,ink,.69,1.73,.59,h.x+2.57,5.5,h.z+.50,.08);
  for(const [x,z,r] of [[-11.1,-20.2,.44],[-2.15,-19.3,.36],[-1.47,-20.16,.27]]){
    puff(k,felt(0xdf8b4d),r,x,r*.71,z,{sx:1.12,sy:.81});
    box(k,felt(PINE),.12,.18,.14,x,r*1.49,z,.036);
  }

  // Ferris wheel with upright gondolas.
  const f=TOUR_STOPS[5],wheel=group(),wkit=new PlushKit();
  const ferrisR=4.66;
  wheel.position.set(f.x,5.915,f.z);
  const ring=obj(wheel,new T.TorusGeometry(ferrisR,.126,8,56),raw('felt',GOLD));ring.castShadow=false;
  for(let i=0;i<10;i++){
    const a=i*TAU/10;
    wkit.tube(gold,[[0,0,0],[ferrisR*Math.cos(a),ferrisR*Math.sin(a),0]],.071,{straight:true});
  }
  puff(wkit,red,.43,0,0,.031,{sz:.5});finish(wkit,wheel,false);
  for(const side of [-1,1]) {
    k.tube(wood,[[f.x+side*3.25,.34,f.z-.44],[f.x,5.93,f.z-.47]],.171,{straight:true});
    k.tube(wood,[[f.x+side*2.85,.34,f.z+1.13],[f.x,5.93,f.z+.37]],.126,{straight:true});
  }
  box(k,quilt(TEAL),8,1,4,f.x,.5,f.z,.10);
  const gondolas=Array.from({length:10},(_,i)=>{
    const g=group(wheel),kit=new PlushKit(),a=i*TAU/10;
    g.position.set(Math.cos(a)*ferrisR,Math.sin(a)*ferrisR,0);
    box(kit,[teal,red,gold][i%3],.77,.36,.65,0,-.43,.06,.125);
    box(kit,cream,.80,.105,.73,0,.04,.065,.057);
    for(const side of [-1,1])box(kit,cream,.045,.40,.046,side*.34,-.2,.17,.012);
    finish(kit,g,false);return g;
  });

  // At the east edge, three separate stalls and a padded bumper-car rink.
  const prizes=[0xf5bf55,0x72aba0,0xe4a294];
  for(let i=0;i<3;i++){
    const x=30.2,z=-12.5+i*4.12,accent=[red,teal,gold][i];
    box(k,wood,2.41,.89,2.86,x,.445,z,.08);
    for(const side of [-1,1])box(k,accent,.13,2.37,.15,x+.93,1.2,z+side*1.28,.037);
    for(let j=0;j<7;j++)box(k,j%2?cream:accent,2.9,.115,.455,x,2.3,z+(j-3)*.439,.045);
    for(let j=0;j<6;j++) puff(k,felt(prizes[i]),.22,x-.09,1.06,z+(j-2.5)*.388,{sy:.86});
    sign([copy('套圈','RING TOSS'),copy('绒鸭','DUCK POND'),copy('积木靶','KNOCKDOWN')][i],x+1.44,2.17,z,2.34,Math.PI/2);
  }
  const d=TOUR_STOPS[7];
  const rink=obj(root,new T.CylinderGeometry(5.03,5.06,.27,40),raw('quilt',0x68939f),d.x,.15,d.z);
  rink.scale.z=.67;
  const bumperBank=Array.from({length:41},(_,i)=>{const a=i*TAU/40;return [d.x+Math.cos(a)*5,.31,d.z+Math.sin(a)*3.38];});
  k.tube(cream,bumperBank,.145,{straight:true});
  const bumpers=Array.from({length:3},(_,i)=>{
    const g=group(),bk=new PlushKit();
    puff(bk,ink,.62,0,.04,0,{sx:.72,sy:.18,sz:1.2});
    box(bk,[red,teal,gold][i],.77,.23,.96,0,.23,0,.123);
    box(bk,cream,.51,.37,.22,0,.44,.25,.096);
    for(const side of [-1,1])puff(bk,cream,.061,side*.22,.26,-.46);
    finish(bk,g,false);return g;
  });

  // Actual walk-through mirror maze. The opaque frames and collider extents agree.
  for(const wall of TOUR_MAZE){
    const length=Math.max(wall.w,wall.d),wide=wall.w>wall.d;
    const cols=Math.max(1,Math.round(length/1.3));
    for(let i=0;i<cols;i++){
      const delta=length*((i+.5)/cols-.5),x=wall.x+(wide?delta:0),z=wall.z+(wide?0:delta);
      box(k,cream,wide?length/cols+.017:.18,2.2,wide?.18:length/cols+.017,x,1.10,z,.047);
      for(const side of [-1,1]){
        box(k,felt(i%2?0x9edbdd:0x83bac9),wide?length/cols-.14:.065,1.88,wide?.065:length/cols-.14,
          x+(wide?0:side*.105),1.12,z+(wide?side*.105:0),.027);
      }
    }
  }

  // Red-and-cream circus in the middle. The south entrance remains open.
  const tnt=TOUR_TENT,N=28;
  k.cyl(quilt(0xc49972),tnt.radius-.16,tnt.radius-.16,.09,0,.04,0,{seg:48});
  k.cyl(quilt(0x916f76),3.9,3.9,.022,0,.096,-1.5,{seg:40});
  for(let i=0;i<N;i++){
    const a=(i-.5)*TAU/N,b=(i+.5)*TAU/N;
    if(i===0||i===1||i===N-1)continue;
    const at=(theta,y,r=tnt.radius)=>[Math.sin(theta)*r,y,Math.cos(theta)*r];
    k.quad(i%2?red:cream,at(b,.017),at(a,.017),at(a,3.85),at(b,3.85),[[0,0],[1,0],[1,3.2],[0,3.2]],1,[Math.sin((a+b)/2),0,Math.cos((a+b)/2)]);
    const aa=(a+b)/2;
    k.quad(i%2?quilt(0xa05151):quilt(0xc9aa82),at(b,.017,tnt.radius-.045),at(a,.017,tnt.radius-.045),at(a,3.85,tnt.radius-.045),at(b,3.85,tnt.radius-.045),[[0,0],[1,0],[1,3.2],[0,3.2]],.52,[-Math.sin(aa),0,-Math.cos(aa)]);
    puff(k,gold,.23,Math.sin(aa)*tnt.radius,3.63,Math.cos(aa)*tnt.radius,{sx:1.4,sy:.65});
  }
  stripedRoof(k,0,0,tnt.radius+.38,3.82,9.2,[red,cream],N,true);
  for(const side of [-1,1]){
    const x=side*2.02;
    box(k,red,.44,4.11,.46,x,2.05,7.40,.10);
    puff(k,gold,.18,x,3.98,7.64);
    box(k,quilt(RED),.92,2.87,.17,x+side*.12,1.53,7.54,.068);
  }
  box(k,red,4.4,.35,.40,0,3.87,7.54,.073);
  sign(copy('马戏团','BIG TOP'),0,3.74,7.78,3.61);
  k.cyl(wood,.063,.075,1.43,0,9.77,0,{seg:10});
  k.quad(red,[.05,10.31,0],[1.45,10.15,.12],[1.31,9.69,.28],[.05,9.74,0],[[0,1],[1,1],[1,0],[0,0]],1,[0,0,1]);
  const orbMat=new T.MeshBasicMaterial({color:0xffd884});
  for(let i=0;i<15;i++){
    const a=i*TAU/15;
    obj(root,new T.SphereGeometry(.099,8,5),orbMat,Math.cos(a)*6.75,3.0,Math.sin(a)*6.75);
  }
  box(k,wood,3.2,.35,2.6,0,.18,-4.8,.073);
  k.cyl(gold,1.95,2.0,.15,0,.44,-4.8,{seg:24});

  finish(k);
  cine.shadows.invalidate();
  const velocity=new T.Vector3();
  const clockScale=reduced?.52:1;
  function follow(group,curve,t,offset=0) {
    const phase=(t%1+1)%1,p=curve.getPointAt(phase),v=curve.getTangentAt(phase);
    group.position.copy(p);group.position.y+=offset;
    velocity.copy(p).add(v);velocity.y=p.y;
    group.lookAt(velocity);
  }
  function update(time){
    time*=clockScale;
    horses.rotation.y=time*.37;
    wheel.rotation.z=time*.25;
    gondolas.forEach(g=>{g.rotation.z=-wheel.rotation.z;});
    follow(train,coaster,time*.082);
    boats.forEach((g,i)=>follow(g,rapidsCurve,time*.057+i*.51,.05));
    bumpers.forEach((g,i)=>{
      const angle=time*(.48+i*.038)+i*TAU/3;
      g.position.set(d.x+Math.sin(angle)*(2.65+i*.22),.28,d.z+Math.cos(angle)*(1.7+i*.13));
      g.rotation.y=angle+Math.PI*.54;
    });
  }
  update(0);
  return {update};
}
