// Measurements for the winding park. +Z is toward the gate and -Z toward the north.
export const TOUR_BOUNDS = {minX:-41,maxX:41,minZ:-33,maxZ:33};
export const TOUR_STOPS = [
  {id:'entrance',en:'Entrance plaza',name:'入口广场',x:-15,z:28,sign:[-12.4,26,-1.28]},
  {id:'carousel',en:'Carousel',name:'旋转木马',x:-25.8,z:15.2,sign:[-27.1,19.15,.2]},
  {id:'rapids',en:'River rapids',name:'激流勇进',x:-26.5,z:3.3,sign:[-33.9,10.95,-.95]},
  {id:'coaster',en:'Roller coaster',name:'过山车',x:-23.8,z:-12.7,sign:[-29.0,-16.4,-.95]},
  {id:'haunt',en:'Haunted house',name:'鬼屋',x:-6.5,z:-15.7,sign:[-5.9,-20.2,Math.PI]},
  {id:'wheel',en:'Ferris wheel',name:'摩天轮',x:18.5,z:-19.1,sign:[17.0,-23.25,Math.PI]},
  {id:'midway',en:'Midway',name:'游戏摊街',x:29.3,z:-7.2,sign:[32.8,-10.4,Math.PI/2]},
  {id:'bumpers',en:'Bumper cars',name:'碰碰车',x:28.9,z:8.2,sign:[34.05,11.5,2.12]},
  {id:'mirrors',en:'Mirror maze',name:'镜子迷宫',x:13,z:17.4,sign:[21.75,17.95,.82]},
  {id:'circus',en:'Big top',name:'马戏团',x:0,z:0,sign:[3.95,9.65,-.70]},
];

const trail = [
  [-15.7,29.2,3.3],[-16.2,25.8,3.0],[-20.6,23.2,2.45],[-26.1,21.3,3.15],
  [-31.5,18.5,2.3],[-35.0,13.7,2.05],[-36.5,8.0,1.78],[-36.5,4.0,1.68],
  [-36.1,-1.6,2.2],[-33.15,-8.45,2.4],[-31.9,-12.7,2.42],[-28.65,-18.7,2.49],
  [-23.5,-22.3,3],[-17.1,-23.1,2.35],[-10.6,-22.6,2.55],[-4.1,-21.1,3.05],
  [2.0,-23.0,2.45],[8.6,-25.55,2.3],[15.1,-26.2,2.8],[21.4,-25.55,2.65],
  [27.9,-23.4,2.7],[33.5,-19.7,2.3],[35.55,-13.0,2.62],[35.7,-7.5,3.01],
  [35.9,-1.4,2.5],[36.4,4.0,2.35],[35.3,10.2,2.65],[31.9,14.8,3.0],
  [27.3,17.0,2.65],[23.0,19.4,2.2],[20.1,20.18,1.55],[17.8,20.05,1.35],
  [16.35,18.45,1.43],[14.8,15.58,1.3],[11.9,15.53,1.4],[10.23,17.45,1.3],
  [9.65,20.20,1.3],[7.6,20.35,1.45],[5.6,20.2,1.7],[3.0,17.45,2.25],
  [2.15,13.6,2.3],[1.45,10.3,2.45],[.15,7.35,2.15],[0,4.0,2.5],[0,.2,3.4],[0,-2.75,3.1],
];

const mix = (a,b,t)=>a+(b-a)*t;
function spline(a,b,c,d,t) {
  const m=(c-a)*.44,n=(d-b)*.44;
  return (2*t**3-3*t*t+1)*b+(t**3-2*t*t+t)*m+(-2*t**3+3*t*t)*c+(t**3-t*t)*n;
}

export const TOUR_PATH = trail.flatMap((b,i)=>{
  const c=trail[i+1];
  if (!c) return [{x:b[0],z:b[1],width:b[2]}];
  const a=trail[i-1]??b,d=trail[i+2]??c;
  const count=Math.max(4,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/.66));
  return Array.from({length:count},(_,j)=>{
    const t=j/count;
    return {x:spline(a[0],b[0],c[0],d[0],t),z:spline(a[1],b[1],c[1],d[1],t),width:mix(b[2],c[2],t)};
  });
});

export const TOUR_TENT = {x:0,z:0,radius:7.8};
export const TOUR_MAZE = [
  {x:13,z:13,w:14,d:.18}, {x:13,z:22,w:14,d:.18},
  {x:20,z:16.045,w:.18,d:5.91}, {x:20,z:21.805,w:.18,d:.21},
  {x:6,z:15.695,w:.18,d:5.21}, {x:6,z:21.85,w:.18,d:.12},
  {x:17.35,z:15.345,w:.18,d:4.51},
  {x:13.05,z:19.935,w:.18,d:3.95},
  {x:9.28,z:15.945,w:.18,d:5.71},
];
export const TOUR_BRIDGE = {x:-36.48,z:6.05,w:3.9,d:5.44};
export const TOUR_CHANNEL = {x:-31.7,z:5.9,w:17.3,d:3.18};

const segments = TOUR_PATH.slice(1).map((p,i)=>{
  const q=TOUR_PATH[i],dx=p.x-q.x,dz=p.z-q.z;
  return {p,q,dx,dz,len:dx*dx+dz*dz,reach:Math.max(p.width,q.width)};
});

function testSegment({p,q,dx,dz,len,reach},x,z,tolerance) {
  if (Math.abs(q.x-x)>reach+Math.abs(dx)+tolerance || Math.abs(q.z-z)>reach+Math.abs(dz)+tolerance) return false;
  const t=Math.max(0,Math.min(1,((x-q.x)*dx+(z-q.z)*dz)/len));
  const px=q.x+dx*t,pz=q.z+dz*t;
  return (x-px)**2+(z-pz)**2<=(mix(q.width,p.width,t)+tolerance)**2;
}

export function isTourWalkable(x,z,tolerance=0) {
  const r=TOUR_TENT.radius-.78;
  return x*x+z*z<(r+tolerance)**2 || segments.some(segment=>testSegment(segment,x,z,tolerance));
}

export function constrainTourWalk(p,oldX,oldZ) {
  if (isTourWalkable(p.x,p.z,.2)) return;
  if (isTourWalkable(p.x,oldZ,.2)) p.z=oldZ;
  else if (isTourWalkable(oldX,p.z,.2)) p.x=oldX;
  else {p.x=oldX;p.z=oldZ;}
}

const mapStop=(index,x,z)=>({index,x,z});
const stopEntries = [
  mapStop(0,-16.1,26.0),mapStop(1,-26,21),mapStop(2,-36.4,6.6),
  mapStop(3,-27.7,-20),mapStop(4,-6.8,-21.7),mapStop(5,18.5,-26),
  mapStop(6,35.55,-7.5),mapStop(7,35.4,10),mapStop(8,14.8,15.5),mapStop(9,0,4.2),
];

export function nearbyTourStop(x,z) {
  let closest=null, best=64;
  for (const stop of stopEntries) {
    const d=(x-stop.x)**2+(z-stop.z)**2;
    if (d<best) {best=d;closest=stop;}
  }
  return closest ? TOUR_STOPS[closest.index] : null;
}
