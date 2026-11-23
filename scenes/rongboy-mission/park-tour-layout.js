// Measurements for the winding park. +Z is toward the gate and -Z toward the north.
export const TOUR_BOUNDS = {minX:-41,maxX:41,minZ:-33,maxZ:33};
export const TOUR_STOPS = [
  {id:'entrance',en:'Entrance plaza',name:'入口广场',x:-15,z:28,sign:[-12.4,26,-1.28]},
  {id:'carousel',en:'Carousel',name:'旋转木马',x:-25.8,z:15.2,sign:[-22.3,19.3,.5]},
  {id:'rapids',en:'River rapids',name:'激流勇进',x:-26.5,z:3.3,sign:[-33.9,10.95,-.95]},
  {id:'coaster',en:'Roller coaster',name:'过山车',x:-23.8,z:-12.7,sign:[-29.0,-16.4,-.95]},
  {id:'haunt',en:'Haunted house',name:'鬼屋',x:-6.5,z:-15.7,sign:[-10.9,-19.7,Math.PI]},
  {id:'wheel',en:'Ferris wheel',name:'摩天轮',x:18.5,z:-19.1,sign:[17.0,-23.25,Math.PI]},
  {id:'midway',en:'Midway',name:'游戏摊街',x:29.3,z:-7.2,sign:[32.7,-15.3,Math.PI/2]},
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

// ---------- 设施的尺寸和轨道（规则层和画面共用同一份，坐上去的位置和看到的轨道才对得上）----------

// 过一串点的闭合曲线（Catmull-Rom），按弧长取点。at(u)：u 是 0–1 的一圈，返回位置和切线方向。
export function closedTrack(points, perSegment = 14) {
  const n = points.length, pts = [];
  const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n], b = points[i], c = points[(i + 1) % n], d = points[(i + 2) % n];
    for (let j = 0; j < perSegment; j++) { const t = j / perSegment; pts.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)]); }
  }
  const lengths = [0];
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; lengths.push(lengths[i] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])); }
  const total = lengths[pts.length];
  function spot(s) {
    s = ((s % total) + total) % total;
    let lo = 0, hi = pts.length;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lengths[mid] <= s) lo = mid; else hi = mid; }
    const p = pts[lo], q = pts[(lo + 1) % pts.length], t = (s - lengths[lo]) / (lengths[lo + 1] - lengths[lo] || 1);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  }
  // 切线取前后各 0.4 米两点的连线：折线每一小段的方向是跳变的，直接用会让车头一顿一顿地转
  function at(u) {
    const s = ((u % 1) + 1) % 1 * total, p = spot(s), a = spot(s - 0.4), b = spot(s + 0.4);
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1;
    return { x: p[0], y: p[1], z: p[2], tx: dx / d, ty: dy / d, tz: dz / d };
  }
  return { points: pts, length: total, at };
}

// 过山车：一圈闭合的轨道。站台在 u = 0 那一点旁边。
// 是给人坐的，所以坡缓（不超过约 25°）、弯大（半径 4 米上下）：出站向北，往东爬到 7 米，在东头掉头，一路缓降绕回来。
export const COASTER = closedTrack([
  [-26.4, 1.6, -12.5], [-26.2, 1.7, -15.2], [-24.2, 2.5, -17.0], [-20.6, 4.4, -17.5],
  [-17.0, 6.4, -17.3], [-14.2, 7.2, -14.8], [-14.2, 6.5, -11.4], [-16.2, 4.8, -8.2],
  [-19.8, 3.4, -6.4], [-23.4, 3.2, -6.6], [-25.8, 2.4, -8.0], [-26.6, 1.8, -10.2],
]);
// 激流勇进的水道：船顺着它漂一圈（爬到石头山顶，再冲下来）
export const RAPIDS = closedTrack([
  [-30.7, .42, 4.8], [-33.6, .7, 1.38], [-31.8, 1.63, -1.1], [-27.8, 4.28, -2.37],
  [-23.15, 5.08, -.64], [-21.6, 3.0, 3.12], [-24.9, .85, 6.2], [-28.3, .51, 6.18],
]);
// 摩天轮：轮心、半径、吊舱数。轮面朝南北（在 x–y 平面里转），小径在它北边。
// 吊舱挂在轮圈上、舱在挂点下面 1.5 米，所以轮心要够高：最低的那只舱底离地约半米
export const WHEEL = { x: 18.5, y: 6.6, z: -19.1, r: 4.66, cars: 10 };
export const CAROUSEL = { x: -25.8, z: 15.2, r: 2.32, horses: 6 };
// 碰碰车场：椭圆，rx / rz 是围挡内沿的两个半轴
export const RINK = { x: 27.9, z: 8.2, rx: 5.0, rz: 3.38 };
export const HAUNT_DOOR = { x: -6.5, z: -19.28 };
export const STALLS = [{ id: 'blocks', x: 30.2, z: -12.5 }, { id: 'ducks', x: 30.2, z: -8.38 }, { id: 'balloons', x: 30.2, z: -4.26 }];
export const STAGE = { x: 0, z: -4.8 };
