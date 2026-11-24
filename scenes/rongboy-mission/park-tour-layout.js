import { closedTrack, planTrack } from './track.js';
export { closedTrack, trackSchedule, planTrack } from './track.js';
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
  [2.15,13.6,2.3],[1.45,10.3,2.45],[.15,7.35,2.15],[0,4.0,2.5],   // 小径到帐篷门里为止：帐篷里面是打小丑的场地（TENT_FLOOR）
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

// 大帐篷：一个圆角的长方形（超椭圆 |x/a|^n + |z/b|^n = 1），门开在正南。布景、碰撞盒和打小丑的场地都照它摆。
export const TENT = { x:0, z:0, a:7.6, b:5.95, n:5, wall:3.85 };
export const TENT_DOOR = TENT.z + TENT.b;
// 帐篷里能走的那块地（打小丑的时候再收一点，见 amusement.js 的 ARENA）
export const TENT_FLOOR = { minX:-5.85, maxX:5.85, minZ:TENT_DOOR-7.8, maxZ:TENT_DOOR-.35 };
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
export const RAPIDS_DOCK = { x: -32.65, z: 6.9, w: 4.5, d: 1.5, promptX: -33.3 };

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
  const dock = RAPIDS_DOCK, tent = TENT_FLOOR;
  if (x >= tent.minX - tolerance && x <= tent.maxX + tolerance && z >= tent.minZ - tolerance && z <= tent.maxZ + tolerance) return true;
  if (Math.abs(x - dock.x) <= dock.w / 2 + tolerance && Math.abs(z - dock.z) <= dock.d / 2 + tolerance) return true;
  return segments.some(segment=>testSegment(segment,x,z,tolerance));
}

// 鬼屋：门、屋子占的那块地（门关着的时候整块都进不去），门开了以后能走的地方（门洞和门厅），和门厅尽头的小铃。
// 能走的范围比墙往里收 0.4 米：镜头不贴到墙上。门扇是往里开的，开着的时候靠在门洞西边，所以门厅西半从门扇后面才开始。
export const HAUNT = {
  door: {x:-6.5,z:-19.0},
  block: {minX:-11.15,maxX:-1.85,minZ:-19.55,maxZ:-11.8},
  walk: [
    {minX:-6.85,maxX:-6.15,minZ:-19.6,maxZ:-17.8},   // 门洞，一直进到帘子后面
    {minX:-6.85,maxX:-4.95,minZ:-17.9,maxZ:-13.9},   // 门厅东半
    {minX:-8.75,maxX:-6.85,minZ:-17.3,maxZ:-13.9},   // 门厅西半（西墙有书架，所以收得多一点）
  ],
  bell: {x:-7.1,z:-14.4},
  // 摇铃后从后墙三张肖像上面飘出来的幽灵：藏在墙里的位置（飘出来是往 -z 挪 1 米）。画面和规则（能不能打中）共用
  ghosts: [-8.72,-7.1,-5.48].map(x=>({x,y:2.46,z:-12.25})),
};
const inRect=(r,x,z)=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ;
export const isHauntWalkable=(x,z)=>HAUNT.walk.some(r=>inRect(r,x,z));

// hauntOpen：鬼屋的门是不是开着。屋子占的那块地只有门开着才进得去，而且只能走门洞和门厅。
export function constrainTourWalk(p,oldX,oldZ,hauntOpen=false,canOccupy=()=>true) {
  const ok=(x,z)=>canOccupy(x,z) && (inRect(HAUNT.block,x,z) ? hauntOpen&&isHauntWalkable(x,z) : isTourWalkable(x,z,.2));
  if (ok(p.x,p.z)) return;
  if (ok(p.x,oldZ)) p.z=oldZ;
  else if (ok(oldX,p.z)) p.x=oldX;
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

// 过山车：一圈闭合的轨道，约 98 米。站台在 u = 0 那一点旁边。
// 出站向北，沿园子北边往东爬，拐向南接着爬到 10.6 米；坡顶过后贴着马戏团西侧一口气俯冲到 2.5 米（最陡约 36°），
// 冲上南头的高弯掉头（弯放在高处、车慢的地方），回程往北再冲一段，绕过激流勇进的石头山，向西拐回站台。
// 平面走向是直线加圆弧（弯的半径 3–5 米），高度按弧长另配；控制点是算出来的（沿线每 1.35 米一个，疏密不匀曲线会打结），
// 要改走向就改半径和长度重算，不要手挪单个点。
// 轨道不压小径（低于 3.6 米的地方都在草地上），离激流勇进的石头和水道、木马、马戏团、鬼屋都留了空。
export const COASTER_PLAN = {
  start: [-26.4, -12.0], heading: -90,
  moves: [
    ['line', 2.2], ['mark', 'out'], ['arc', 4.0, 90], ['mark', 'liftA'], ['line', 4.4], ['mark', 'liftB'],   // 出站向北，右拐，沿北边往东爬
    ['arc', 4.6, 90], ['mark', 'south'], ['line', 7.4], ['mark', 'crest'], ['line', 4.6], ['mark', 'lean'],   // 拐向南接着爬，到坡顶
    ['arc', 20, -16], ['line', 7.0], ['mark', 'bottom'],                                                      // 贴着帐篷西侧俯冲
    ['arc', 5.2, 218], ['mark', 'uturn'], ['line', 6], ['arc', 14, -22], ['mark', 'north'],                   // 南头的高弯掉头，回程往北
    ['until', 'z', -3.3], ['mark', 'hill'], ['arc', 4.5, -90], ['mark', 'west'],                              // 走到石头山的北沿，左拐向西
    ['until', 'x', -23.4], ['arc', 3.0, 90], ['mark', 'home'],                                                // 右拐进站
  ],
  heights: (m, total) => {
    const mid = (m.bottom + m.uturn) / 2;
    return [[0, 1.6], [m.out, 1.6], [m.liftA, 2.6], [m.liftB, 4.3], [m.south, 7.4], [m.crest - 0.8, 10.4], [m.crest + 0.6, 10.6], [m.crest + 2.0, 10.3],
      [m.crest + 4.6, 9.2], [m.bottom - 4.2, 3.7], [m.bottom - 1.0, 2.5], [m.bottom + 0.6, 2.5], [mid - 1.5, 5.6], [mid + 0.5, 6.1], [mid + 2.5, 5.9],
      [m.north - 3.0, 2.9], [m.north - 1.0, 2.6], [m.hill + 1.0, 3.4], [m.west - 2.0, 3.3], [m.west + 0.5, 2.6], [m.home - 1.5, 1.8], [m.home, 1.62], [total, 1.6]];
  },
};
export const COASTER = closedTrack(planTrack(COASTER_PLAN).points, 6);
// 激流勇进的水道：船顺着它漂一圈（爬到石头山顶，再冲下来）
export const RAPIDS = closedTrack([
  [-30.7, .42, 4.8], [-33.6, .7, 1.38], [-31.8, 1.63, -1.1], [-27.8, 4.28, -2.37],
  [-23.15, 5.08, -.64], [-21.6, 3.0, 3.12], [-24.9, .85, 6.2], [-28.3, .51, 6.18],
]);
// 摩天轮：轮心、半径、吊舱数。轮面朝南北（在 x–y 平面里转），小径在它北边。
// 吊舱挂在轮圈上、舱在挂点下面 1.5 米，所以轮心要够高：最低的那只舱底离地约半米
// 激流勇进的石头山：每块 [x, y, z, 半径]。画面照它堆石头，过山车的支架和轨道照它让开。
export const RAPIDS_ROCKS = [[-28.6, 1.3, -3.7, 2.4], [-25.6, 1.4, -4.5, 2.6], [-22.6, 1.3, -3.3, 2.4], [-20.5, 1.2, -0.8, 2.0], [-30.0, 1.0, -0.2, 1.7], [-27.4, 3.3, -3.7, 2.0], [-24.6, 3.6, -3.5, 2.2], [-22.2, 3.2, -2.1, 1.9],
      [-25.7, 5.5, -3.0, 1.7], [-23.5, 5.5, -2.4, 1.5], [-21.0, 3.4, 0.2, 1.3], [-29.6, 1.0, -1.6, 1.6], [-21.4, 0.8, 1.8, 1.2], [-31.3, 0.74, 0.9, 1.3], [-19.8, 0.5, 4.6, 0.92], [-26.6, 0.8, -6.0, 1.3]];
export const rockScale = i => [1.05 + (i % 3) * 0.1, 0.84 + (i % 2) * 0.18, 0.94];   // 每块石头压扁、拉长的比例
// (x, z) 是不是在某块石头的脚印里；给了 y 就按整块石头（椭球）算
export const inRock = (x, z, pad = 0.25, y = null) => RAPIDS_ROCKS.some(([rx, ry, rz, r], i) => {
  const [sx, sy, sz] = rockScale(i), flat = ((x - rx) / (r * sx + pad)) ** 2 + ((z - rz) / (r * sz + pad)) ** 2;
  return flat + (y === null ? 0 : ((y - ry) / (r * sy + pad)) ** 2) < 1;
});
export const WHEEL = { x: 18.5, y: 6.6, z: -19.1, r: 4.66, cars: 10 };
// r：马站的那一圈；platform：底座的半径（人被挡在外面）；steps：台阶朝哪个方向（弧度，0 朝 +z），对着摇铃的地方
export const CAROUSEL = { x: -25.8, z: 15.2, r: 2.32, horses: 6, platform: 3.9, steps: -0.03 };
// 入口：拱门的中心、两座塔楼离中心多远、售票亭的位置（挨着东塔，正面朝 +z）
export const GATE = { x: -16.2, z: 26.68, half: 2.1, booth: { x: -12.25, z: 26.7 } };
// 碰碰车场：椭圆，rx / rz 是围挡内沿的两个半轴
export const RINK = { x: 27.9, z: 8.2, rx: 5.0, rz: 3.38 };
export const HAUNT_DOOR = { x: -6.5, z: -19.28 };
export const STALLS = [
  { id: 'blocks', x: 30.2, z: -12.5, zh: '打积木', en: 'Knock the blocks',
    hintZh: '打底层，带倒上面几块', hintEn: 'Hit low to topple the stack',
    targets: [[.15,-.36],[.15,0],[.15,.36],[.46,-.18],[.46,.18],[.77,0]] },
  { id: 'ducks', x: 30.2, z: -8.38, zh: '打绒鸭', en: 'Hit the ducks',
    hintZh: '瞄着移动的绒鸭，提前一点出手', hintEn: 'Lead the moving ducks a little',
    targets: [[.23,-.83],[.23,0],[.23,.83]] },
  { id: 'balloons', x: 30.2, z: -4.26, zh: '打气球', en: 'Pop the balloons',
    hintZh: '每个气球只算一次，五球能打中几个？', hintEn: 'Each balloon counts once. How many can you pop in five throws?',
    targets: [[.56,-1.0],[1.05,-.55],[.56,0],[1.05,.55],[.56,1.0]] },
];
