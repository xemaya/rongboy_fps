// 布偶游乐场（正式关卡）的样子。规则在 amusement.js：这里只读它的状态来摆（门栓滑到哪、木马转到哪、车在轨道的哪一点、
// 小丑在干什么），自己不决定任何事。准则在 docs/park-design.md 第 5d 节（精细度和开销）和 docs/amusement-whitebox-spec.md。
// 通用零件（针脚、扇贝边、树、栏杆、灯柱、木马、伞顶……）在 park-kit.js，小丑在 amusement-clown.js。
// 坐标：玩家从南边（z = 39）进来，一路往北（-z）走到大帐篷；能走的范围是 x ±9.5，两边的树、摩天轮、摊位都在这之外。
import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { mulberry32 } from '../../cine-engine/engine/noise.js';
import { uiCanvasFont } from './interface-font.js';
import { copy } from './language.js';
import {
  PARK_BOUNDS, CAROUSEL, SWITCH, TENT_DOOR, TENT, CLOWN, TILES, TILE, GATES, GATE_LIFT_SECONDS,
  LOCK, VALVE, RIVER, PLATFORM, COASTER_TARGETS, BALLOONS, FIRST_BOX, CLOWN_INTRO_SECONDS,
  tileSwitch, ridePose, lockPosition, coasterTargetPosition,
} from './amusement.js';
import { createParkKit, RED, CREAM, TEAL, GOLD, INK, CORAL, THREAD, WOOL_WHITE, TIMBER } from './park-kit.js';
import { createClown } from './amusement-clown.js';

const TAU = 2 * Math.PI;
const DETAIL_RANGE = 26;   // 小装饰（针脚、花、穗子）离人多远就不画了
const sat = v => Math.max(0, Math.min(1, v));
const PATH = 0xe6cf9f, EDGE = 0xf5e6c2, WATER = 0x4fa8b0, DEEP = 0x2f7f8c, RIPPLE = 0xdff1ee;

export function createAmusementView(cine, world) {
  const root = new T.Group(); root.name = 'Plushwood fair'; world.root.add(root);
  const M = plushMaterials(world.lib, { lit: m => world.volume.light(m) });
  const P = createParkKit(M), { felt, wool, leaf, knit } = P;
  const rand = mulberry32(51123); let seed = 9000;
  const box = (kit, m, w, h, dp, x, y, z, r = 0.045, o = {}) => kit.soft(m, w, h, dp, x, y, z, { r, seg: Math.min(w, h, dp) < 0.35 ? 1 : 2, ...o });
  const group = (parent = root, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const obj = (parent, geo, mat, x = 0, y = 0, z = 0) => { const mesh = new T.Mesh(geo, mat); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  // 会亮会灭的东西：自己的一份材质，颜色和亮度每帧照规则层的状态改
  const DIM = 0xbdb7c2, ROPE = 0x8f8a99;
  const lamp = (color = DIM, power = 0) => { const m = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: power, roughness: 0.7 }); m.userData.noShadow = true; return m; };
  const light = (m, color, power) => { m.color.setHex(color); m.emissive.setHex(color); m.emissiveIntensity = power; };
  const ghost = (color, opacity) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

  // ---------- 分块：不动的布景按四段分，每段两层（s 主体投影，d 小装饰不投影、走远了不画） ----------
  const zones = new Map(), details = [];
  const zone = id => { let q = zones.get(id); if (!q) zones.set(id, q = { s: new PlushKit(), d: new PlushKit() }); return q; };
  const zoneAt = z => zone(z > GATES[0].z ? 'gate' : z > GATES[1].z ? 'plaza' : z > TENT_DOOR + 0.3 ? 'river' : 'tent');
  let k, d; const use = id => { ({ s: k, d } = zone(id)); };
  // 一个会动的部件：单独一组网格。build(kit, det) 在原点附近造它；anchor = [x, z, 半径] 给了，det 那层走远就不画
  const part = (parent, build, x = 0, y = 0, z = 0, cast = false, anchor = null) => {
    const kit = new PlushKit(), det = new PlushKit(); build(kit, det);
    const g = group(parent, x, y, z); g.add(...kit.build({ cast }));
    const extra = det.build({ cast: false, name: 'detail' });
    if (extra.length) { g.add(...extra); if (anchor) details.push({ meshes: extra, x: anchor[0], z: anchor[1], r: anchor[2] }); }
    return g;
  };
  function sign(text, x, y, z, w, yaw = 0, parent = root) {
    const canvas = document.createElement('canvas'); canvas.width = 816; canvas.height = 216;
    const ctx = canvas.getContext('2d'); ctx.scale(1.5, 1.5); ctx.fillStyle = '#f5dfac'; ctx.beginPath(); ctx.roundRect(4, 4, 536, 136, 28); ctx.fill();
    ctx.strokeStyle = '#99704d'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.strokeRect(19, 16, 506, 111);
    ctx.fillStyle = '#5a2f33'; ctx.font = uiCanvasFont(60);
    const width = ctx.measureText(text).width; if (width > 470) ctx.font = uiCanvasFont(Math.floor(60 * 470 / width));
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, 272, 74);
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
    const panel = obj(parent, new T.PlaneGeometry(w, w * 144 / 544), new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide }), x, y, z);
    panel.rotation.y = yaw; return panel;
  }
  const loader = new T.TextureLoader();
  function picture(file, w, h, x, y, z, yaw = 0) {
    const map = loader.load(file); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
    const panel = obj(root, new T.PlaneGeometry(w, h), world.volume.light(new T.MeshStandardMaterial({ map, roughness: 0.9 })), x, y, z); panel.rotation.y = yaw; panel.receiveShadow = true; return panel;
  }

  // ---------- 通用的几样 ----------
  // 一条毛毡带子的路：两边各一道鼓起来的滚边，中间一行深绿的虚线
  function ribbon(pts, half, { color = PATH, y = 0.034, dashes = true } = {}) {
    const curve = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z))), N = Math.max(8, Math.round(curve.getLength() / 0.7));
    const line = curve.getSpacedPoints(N).map(p => [p.x, p.z]), L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(N, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
      L.push([line[i][0] - dz / len * half, line[i][1] + dx / len * half]); R.push([line[i][0] + dz / len * half, line[i][1] - dx / len * half]);
    }
    for (let i = 1; i <= N; i++) {
      const g = zoneAt((line[i][1] + line[i - 1][1]) / 2);
      g.s.quad(wool(color), [L[i - 1][0], y, L[i - 1][1]], [R[i - 1][0], y, R[i - 1][1]], [R[i][0], y, R[i][1]], [L[i][0], y, L[i][1]], [L[i - 1], R[i - 1], R[i], L[i]], 1, [0, 1, 0]);
      for (const side of [L, R]) g.s.tube(wool(EDGE), [[side[i - 1][0], y + 0.012, side[i - 1][1]], [side[i][0], y + 0.012, side[i][1]]], 0.055, { seg: 5, straight: true });
      if (dashes && i % 2) g.d.box(felt(0x4d6a4a), Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]) * 0.62, 0.012, 0.06, (line[i][0] + line[i - 1][0]) / 2, y + 0.006, (line[i][1] + line[i - 1][1]) / 2, { ry: Math.atan2(-(line[i][1] - line[i - 1][1]), line[i][0] - line[i - 1][0]) });
    }
  }
  // 一段矮树篱（三道门两边）：木板墙脚、叶子的身子、顶上一排叶团，偶尔开一朵花
  function hedge(x0, x1, z) {
    const len = x1 - x0, cx = (x0 + x1) / 2, n = Math.max(2, Math.round(len / 0.62));
    box(k, P.timber(0x9a6f4c), len, 0.16, 0.5, cx, 0.08, z, 0.03, { long: 0 });
    box(k, leaf(0x55813f), len, 0.86, 0.44, cx, 0.58, z, 0.14);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * len / n;
      k.sphere(leaf(i % 2 ? 0x6b9648 : 0x7fa552), 0.36, x, 0.97 + (i % 3) * 0.02, z, { seg: 8, rings: 5, sy: 0.5, sz: 0.72 });
      if (i % 3 === 1) P.daisy(d, x + 0.1, 1.17, z + 0.14, [0xf0c24f, 0xd9776a, 0xf6f1e4][i % 3], 1.2);
    }
  }
  // 礼物箱（能躲在后面的掩体）：针织的箱身、盖、十字金缎带、顶上一个蝴蝶结
  function gift(x, z, w, dp, h, body, ribbonColor = GOLD) {
    box(k, knit(body), w - 0.06, h - 0.2, dp - 0.06, x, (h - 0.2) / 2, z, 0.07);
    box(k, wool(body), w, 0.2, dp, x, h - 0.1, z, 0.06);
    box(k, wool(ribbonColor), 0.2, h + 0.02, dp + 0.03, x, h / 2, z, 0.03); box(k, wool(ribbonColor), w + 0.03, h + 0.02, 0.2, x, h / 2, z, 0.03);
    for (const s of [-1, 1]) k.sphere(wool(ribbonColor), 0.17, x + s * 0.17, h + 0.1, z, { seg: 9, rings: 6, sy: 0.7, sz: 0.6, rz: s * 0.5 });
    k.sphere(wool(ribbonColor), 0.09, x, h + 0.07, z, { seg: 7, rings: 5 });
    for (const s of [-1, 1]) { P.stitch(d, [[x - w / 2 + 0.1, h - 0.21, z + s * (dp / 2 + 0.004)], [x - 0.14, h - 0.21, z + s * (dp / 2 + 0.004)]], { len: 0.06, gap: 0.05, t: 0.014 }); P.stitch(d, [[x + 0.14, h - 0.21, z + s * (dp / 2 + 0.004)], [x + w / 2 - 0.1, h - 0.21, z + s * (dp / 2 + 0.004)]], { len: 0.06, gap: 0.05, t: 0.014 }); }
  }
  // 彩灯杆：红白相间的高杆，顶上一颗金球
  function pole(x, z, h = 4.0) {
    k.cyl(wool(RED), 0.17, 0.21, 0.3, x, 0.15, z, { seg: 10 });
    for (let i = 0; i < 6; i++) k.cyl(wool(i % 2 ? RED : WOOL_WHITE), 0.065, 0.07, (h - 0.3) / 6 + 0.004, x, 0.3 + (i + 0.5) * (h - 0.3) / 6, z, { seg: 8 });
    k.sphere(wool(GOLD), 0.12, x, h + 0.1, z, { seg: 8, rings: 6 });
  }

  // ====================================================================== 地面：路、广场、两边的栏杆
  use('gate');
  ribbon([[0, 41.0], [0, 38.5], [0.3, 35.2], [1.1, 31.6], [1.5, 28.4], [1.6, 27.0]], 1.5);
  ribbon([[1.6, 27.0], [2.5, 25.2], [3.05, 23.2], [2.9, 20.6], [2.1, 17.6], [0.9, 14.2], [0, 11.9], [0, 9.9]], 1.4);
  ribbon([[0, -1.3], [0, -3.4], [0, -5.2]], 1.6);
  k.cyl(wool(0xd8c59c), 4.3, 4.3, 0.05, 0, 0.02, 37.3, { seg: 48 });   // 入口广场：一块圆的毛毡地垫，边上两圈针脚
  P.ring(d, 0, 0.052, 37.3, 4.1, { color: 0x9c7a55, len: 0.16, gap: 0.12, t: 0.024 }); P.ring(d, 0, 0.052, 37.3, 3.82, { color: 0xf8efd8, len: 0.1, gap: 0.14, t: 0.02 });
  k.extrude(wool(GOLD), Array.from({ length: 10 }, (_, i) => { const t = Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? 0.42 : 0.92; return [Math.cos(t) * q, Math.sin(t) * q]; }), 0.02, new T.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.058, 37.3));   // 地垫中间平躺着一颗星
  // 两边：一排木桩拉绳的栏杆，栏杆外面是灌木、石头、花，再外面是树
  for (const side of [-1, 1]) {
    const x = side * 9.72, south = [], north = [];
    for (let z = 40.6; z > RIVER.maxZ + 0.5; z -= 2.25) south.push([x, z]);
    for (let z = RIVER.minZ - 0.7; z > -4.7; z -= 1.95) north.push([x, z]);
    P.fence(zone('plaza').s, south, { h: 0.9 }); P.fence(zone('river').s, north, { h: 0.9 });
    for (let z = 39.6; z > -4.4; z -= 1.9) {
      if (z > RIVER.minZ - 0.9 && z < RIVER.maxZ + 0.9) continue;
      const px = side * (10.55 + rand() * 0.9), pz = z + (rand() - 0.5) * 0.8, g = zoneAt(pz), roll = rand();
      if (roll < 0.22) P.rock(g.s, px, pz, 0.34 + rand() * 0.2, seed++); else if (roll < 0.66) P.shrub(g.s, g.d, px, pz, 0.48 + rand() * 0.36, seed++); else P.flowerPatch(g.d, px, pz, 5, 0.8, seed++);
      if (rand() < 0.6) P.tuft(g.d, side * (9.95 + rand() * 0.3), pz + 0.6, seed++, 1 + rand() * 0.5);
    }
  }
  // 树：两排。里面一排做细一点，外面一排少一层叶子；让开河、摩天轮和东边的摊位
  const clear = (x, z) => (z > RIVER.minZ - 1.4 && z < RIVER.maxZ + 1.4) || (x < -11 && z > 8.5 && z < 22.5) || (x > 10.5 && x < 18.5 && z > 19 && z < 34) || (Math.abs(x) < 12.5 && z < -3 && z > -20.5) || (Math.abs(x) < 5 && z > 41);
  let treeIndex = 0;
  const tree = (x, z, s, rich) => { if (clear(x, z)) return; const g = zoneAt(z).s, i = treeIndex++; if (i % 4 === 1) P.pine(g, x, z, s * 0.95, 500 + i); else P.leafTree(g, x, z, s, 500 + i, { tone: i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0, rich }); };
  for (const side of [-1, 1]) {
    for (let z = 43; z > -23; z -= 4.3) tree(side * (12.4 + rand() * 1.6), z + (rand() - 0.5) * 1.6, 1.05 + rand() * 0.3, true);
    for (let z = 45; z > -25; z -= 5.6) tree(side * (17.2 + rand() * 3.4), z + (rand() - 0.5) * 2.4, 1.2 + rand() * 0.35, false);
  }
  for (let x = -14; x <= 14; x += 4.1) { tree(x + (rand() - 0.5) * 1.4, 45.4 + rand() * 1.6, 1.15 + rand() * 0.3, false); tree(x + 2 + (rand() - 0.5) * 1.4, -21.4 - rand() * 1.8, 1.25 + rand() * 0.3, false); }
  // 草地上的花坛和花丛：都是矮的、平的，走得过去，不挡毛球
  for (const [x, z, r] of [[-6.6, 30.4, 1.15], [6.9, 38.2, 1.0], [-6.9, 38.0, 1.0], [6.4, -2.0, 0.9]]) {
    const g = zoneAt(z), n = Math.round(TAU * r / 0.25);
    for (let j = 0; j < n; j++) { const a = j * TAU / n; g.s.cyl(P.timber(j % 3 ? 0xa97a4c : 0x94683f), 0.1, 0.11, 0.2 + (j % 2) * 0.04, x + Math.sin(a) * r, 0.11, z + Math.cos(a) * r, { seg: 7 }); }
    g.s.cyl(M('terry', 0x5f7a45), r - 0.08, r - 0.08, 0.16, x, 0.08, z, { seg: 22 });
    for (let j = 0; j < 5; j++) { const a = j * TAU / 5 + rand(), q = r * (0.3 + rand() * 0.45); P.flowerPatch(g.d, x + Math.sin(a) * q, z + Math.cos(a) * q, 4, 0.6, seed++, 0.16); }
  }
  for (let i = 0; i < 26; i++) { const x = (rand() - 0.5) * 17.6, z = -4.4 + rand() * 44.6; if (Math.abs(x - 1.2) < 2.6 || (z > RIVER.minZ - 0.6 && z < RIVER.maxZ + 0.6) || Math.hypot(x - CAROUSEL.x, z - CAROUSEL.z) < 3.8 || (Math.abs(x) < 3.2 && z < 11.6 && z > 7.2)) continue; const g = zoneAt(z); if (i % 3) P.tuft(g.d, x, z, seed++, 1.2 + rand() * 0.6); else P.flowerPatch(g.d, x, z, 3, 0.5, seed++); }
  // 长椅：栏杆外面，面朝大路
  for (const [x, z] of [[-10.5, 36.2], [10.5, 30.4], [-10.5, 24.6], [10.5, 14.6]]) { const g = zoneAt(z); P.bench(g.s, g.d, x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2); }

  // ====================================================================== 彩灯：每段两道横跨大路的灯串，一根地上的电缆通到帐篷门上的一盏灯
  // 一段打完，这一段的灯串、电缆和门上那盏灯一起亮（规则层的 lit）
  const zoneLights = [0, 1, 2].map(() => ({ bulbs: [0xffce6b, 0xff8272, 0x8ef2dc].map(c => ({ color: c, mat: lamp() })), cable: lamp(ROPE, 0), beacon: lamp() }));
  [[38.4, 30.6], [25.4, 13.4], [8.4, -2.4]].forEach((rows, zi) => {
    use(['gate', 'plaza', 'river'][zi]);
    const kits = zoneLights[zi].bulbs.map(() => new PlushKit());
    for (const z of rows) {
      for (const side of [-1, 1]) pole(side * 10.05, z);
      const at = t => [-10.05 + 20.1 * t, 4.0 - Math.sin(t * Math.PI) * 0.95, z];
      d.tube(felt(INK), Array.from({ length: 21 }, (_, i) => at(i / 20)), 0.014, { seg: 4, straight: true });
      for (let i = 1; i < 16; i++) {
        const [x, y] = at(i / 16);
        kits[i % 3].sphere(zoneLights[zi].bulbs[i % 3].mat, 0.11, x, y - 0.12, z, { seg: 8, rings: 6, sy: 1.2 });
        d.cyl(felt(INK), 0.035, 0.04, 0.06, x, y - 0.03, z, { seg: 5 });
        const [fx, fy] = at((i + 0.5) / 16), m = felt([RED, GOLD, TEAL, CREAM][i % 4]);   // 灯和灯之间一面小三角旗
        d.quad(m, [fx - 0.13, fy, z], [fx + 0.13, fy, z], [fx, fy - 0.3, z], [fx, fy - 0.3, z], [[0, 1], [1, 1], [0.5, 0], [0.5, 0]], 1, [0, 0, 1]);
        d.quad(m, [fx + 0.13, fy, z], [fx - 0.13, fy, z], [fx, fy - 0.3, z], [fx, fy - 0.3, z], [[0, 1], [1, 1], [0.5, 0], [0.5, 0]], 1, [0, 0, -1]);
      }
    }
    kits.forEach(kit => root.add(...kit.build({ cast: false, name: 'fair-bulbs' })));
  });
  {   // 电缆：0 段走西边，1 段走东边，2 段从过山车的终点过来；都顺着帐篷的门柱爬上去，各点亮门楣上的一盏灯
    const pz = TENT_DOOR + 0.52, routes = [
      [[-8.9, 30.2], [-8.9, RIVER.maxZ + 0.6], [-8.9, RIVER.minZ - 0.6], [-8.9, -4.2], [-7.6, -4.55], [-2.6, -4.55], [-2.33, pz]],
      [[8.9, 21.4], [8.9, RIVER.maxZ + 0.6], [8.9, RIVER.minZ - 0.6], [8.9, -4.2], [7.6, -4.55], [2.6, -4.55], [2.33, pz]],
      [[-2.1, -4.25], [-2.06, -4.5], [-2.06, pz + 0.27]],
    ], top = [[-1.15, 4.28], [1.15, 4.28], [0, 4.4]];
    routes.forEach((route, i) => {
      const kit = new PlushKit(), end = route[route.length - 1], pts = route.map(([x, z]) => [x, 0.06, z]);
      pts.push([end[0], 4.1, end[1]], [end[0] * 0.9, 4.13, pz + 0.04], [top[i][0], 4.13, pz + 0.04]);
      kit.tube(zoneLights[i].cable, pts, 0.045, { seg: 6, straight: true });
      kit.sphere(zoneLights[i].beacon, 0.19, top[i][0], top[i][1], pz + 0.04, { seg: 12, rings: 8 });
      root.add(...kit.build({ cast: false, name: 'fair-cable' }));
      zone('tent').s.cyl(wool(GOLD), 0.13, 0.17, 0.14, top[i][0], top[i][1] - 0.2, pz + 0.04, { seg: 9 });
    });
  }

  // ====================================================================== 入口（在能走的范围外面一点：回头看得见，走不出去）
  use('gate');
  {
    const ex = 0, ez = 41.95, half = 2.1;
    for (const side of [-1, 1]) {   // 两座塔楼：红布墩（针脚勾出砖缝）、米白的塔身、一圈绒边、金色扇贝领、红尖顶、旗
      const x = ex + side * half;
      k.cyl(wool(RED), 0.74, 0.78, 0.8, x, 0.4, ez, { seg: 20 }); k.cyl(wool(0xa94f4b), 0.8, 0.8, 0.09, x, 0.82, ez, { seg: 20 });
      for (const y of [0.28, 0.55]) P.ring(d, x, y, ez, 0.775, { color: GOLD, len: 0.09, gap: 0.07 });
      k.cyl(wool(WOOL_WHITE), 0.62, 0.64, 2.5, x, 2.1, ez, { seg: 20 });
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8, q = 0.645; P.stitch(d, [[x + Math.sin(a) * q, 0.95, ez + Math.cos(a) * q], [x + Math.sin(a) * q, 3.1, ez + Math.cos(a) * q]], { color: 0xfffaf0, len: 0.1, gap: 0.12 }); }
      for (let i = 0; i < 14; i++) { const a = i * TAU / 14; k.sphere(wool(WOOL_WHITE), 0.2, x + Math.sin(a) * 0.6, 3.5, ez + Math.cos(a) * 0.6, { seg: 8, rings: 5, sy: 0.85 }); }
      P.valance(k, wool(GOLD), x, 3.4, ez, 0.74, 10, 0.3, { band: 0.12, pipe: THREAD, pipeKit: d, pipeR: 0.02 });
      const roof = [[0.8, 0], [0.72, 0.3], [0.54, 0.66], [0.29, 0.98], [0.09, 1.16]];
      k.lathe(wool(RED), roof, x, 3.62, ez, { seg: 20 });
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P.stitch(d, roof.map(([q, y]) => [x + Math.sin(a) * (q + 0.012), 3.62 + y + 0.01, ez + Math.cos(a) * (q + 0.012)]), { color: GOLD, len: 0.08, gap: 0.07 }); }
      k.cyl(wool(GOLD), 0.11, 0.14, 0.12, x, 4.82, ez, { seg: 10 }); k.cyl(P.timber(0xa97a4c), 0.035, 0.04, 0.95, x, 5.32, ez, { seg: 6 }); k.sphere(wool(GOLD), 0.09, x, 5.84, ez, { seg: 8, rings: 6 });
      k.extrude(wool(GOLD), [[0, 0.17], [0.3, 0.13], [0.64, 0.18], [0.52, 0], [0.64, -0.18], [0.3, -0.13], [0, -0.17]], 0.035, new T.Matrix4().makeTranslation(x + 0.04, 5.52, ez));
      box(k, felt(INK), 0.2, 0.44, 0.06, x, 2.3, ez - 0.62, 0.05); box(k, wool(GOLD), 0.3, 0.07, 0.1, x, 2.04, ez - 0.63, 0.02);   // 朝里的小窗
    }
    // 拱门：一整块厚毛毡，两头埋进塔楼；内沿一圈金色扇贝边，朝里的一面一行针脚；顶上立一颗星
    const outer = (t, grow = 0) => [(1.62 + grow) * Math.cos(t), 2.5 + (2.45 + grow) * Math.sin(t)], inner = (t, grow = 0) => [(1.5 + grow) * Math.cos(t), 2.3 + (1.05 + grow) * Math.sin(t)], steps = 28;
    const outline = [[1.62, 2.3]]; for (let i = 0; i <= steps; i++) outline.push(outer(Math.PI * i / steps)); outline.push([-1.62, 2.3]); for (let i = steps; i >= 0; i--) outline.push(inner(Math.PI * i / steps));
    k.extrude(wool(RED), outline, 0.56, new T.Matrix4().makeTranslation(ex, 0, ez));
    const zf = ez - 0.29;
    P.stitch(d, Array.from({ length: steps + 1 }, (_, i) => { const [x, y] = outer(Math.PI * i / steps, -0.14); return [ex + x, y, zf]; }), { len: 0.12, gap: 0.09, t: 0.022 });
    k.tube(wool(GOLD), Array.from({ length: 15 }, (_, i) => { const [x, y] = inner(Math.PI * (0.06 + 0.88 * i / 14), 0.02); return [ex + x, y, zf + 0.02]; }), 0.065, { seg: 6, detail: 2 });
    for (let i = 0; i < 9; i++) { const [x, y] = inner(Math.PI * (0.1 + 0.8 * (i + 0.5) / 9), 0.0); P.lobe(k, wool(GOLD), ex + x, y + 0.02, zf + 0.03, Math.PI, 0.17, 0.02, 0.22, 0.05, 0.5); }
    P.star(k, GOLD, 0.44, ex, 5.38, ez, 0, 0.16); k.cyl(wool(GOLD), 0.12, 0.2, 0.2, ex, 4.98, ez, { seg: 10 });
    sign(copy('布偶游乐场', 'PLUSHWOOD FAIR'), ex, 4.0, ez - 0.31, 2.3, Math.PI);
    // 关着的园门：进来了就出不去，等把小丑打倒再说
    for (let i = 0; i < 13; i++) { const x = ex - 1.38 + i * 0.23, h = 1.2 + Math.sin(i / 12 * Math.PI) * 0.34; box(k, felt(i % 2 ? WOOL_WHITE : 0xeadfc4), 0.17, h, 0.06, x, h / 2 + 0.08, ez - 0.05, 0.06); }
    for (const y of [0.42, 1.02]) box(k, wool(RED), 2.96, 0.1, 0.08, ex, y, ez - 0.01, 0.03);
    P.star(k, GOLD, 0.2, ex, 0.86, ez - 0.1, Math.PI, 0.05);
    // 入口两边：栏杆、灌木和花
    for (const side of [-1, 1]) { P.fence(k, [[side * 3.5, 41.4], [side * 5.6, 41.4], [side * 7.7, 41.4], [side * 9.72, 41.4]], { h: 0.9 }); P.shrub(k, d, side * 3.45, 42.1, 0.7, seed++); P.shrub(k, d, side * 4.5, 42.6, 0.55, seed++); P.flowerPatch(d, side * 6.4, 42.2, 5, 0.9, seed++); P.shrub(k, d, side * 8.3, 42.3, 0.6, seed++); }
  }

  // ====================================================================== 三道门：前两道是拱门加两扇对开的栅门，第三道是帐篷的门帘
  const gateLabels = [copy('木马广场', 'CAROUSEL PLAZA'), copy('过山车', 'COASTER')];
  const gateLeaves = [0, 1].map(i => {
    const g = GATES[i], gx = g.x, gz = g.z, hw = g.width / 2, tone = i ? TEAL : RED;
    use(i ? 'plaza' : 'gate');
    hedge(PARK_BOUNDS.minX - 0.3, gx - hw - 0.34, gz); hedge(gx + hw + 0.34, PARK_BOUNDS.maxX + 0.3, gz);
    for (const side of [-1, 1]) {   // 门柱：红布墩、米白的柱身缠一道红布条、金箍
      const x = gx + side * (hw + 0.16);
      k.cyl(wool(RED), 0.3, 0.34, 0.5, x, 0.25, gz, { seg: 14 }); k.cyl(wool(GOLD), 0.33, 0.33, 0.08, x, 0.54, gz, { seg: 14 });
      k.cyl(wool(WOOL_WHITE), 0.2, 0.22, 2.16, x, 1.66, gz, { seg: 14 });
      k.tube(wool(RED), Array.from({ length: 25 }, (_, j) => { const t = j / 24, a = t * TAU * 2.5 + side; return [x + Math.sin(a) * 0.215, 0.62 + t * 2.08, gz + Math.cos(a) * 0.215]; }), 0.05, { seg: 5, straight: true });
    }
    // 门楣：一块拱形的厚毛毡板，正面一行针脚，底下一排金色扇贝，两头各一颗金球，顶上一颗星
    const W = hw + 0.5, outline = [[W, 2.72]]; for (let j = 0; j <= 18; j++) { const t = Math.PI * j / 18; outline.push([Math.cos(t) * W, 3.2 + Math.sin(t) * 0.72]); } outline.push([-W, 2.72]);
    k.extrude(wool(tone), outline, 0.32, new T.Matrix4().makeTranslation(gx, 0, gz));
    for (const face of [1, -1]) P.stitch(d, [[gx - W + 0.12, 2.84, gz + face * 0.17], ...Array.from({ length: 19 }, (_, j) => { const t = Math.PI * (1 - j / 18); return [gx + Math.cos(t) * (W - 0.12), 3.2 + Math.sin(t) * 0.6, gz + face * 0.17]; }), [gx + W - 0.12, 2.84, gz + face * 0.17]], { len: 0.12, gap: 0.09, t: 0.022 });
    P.valanceLine(k, wool(GOLD), [gx - hw, gz - 0.02], [gx + hw, gz - 0.02], 2.74, 9, 0.28, { band: 0.06 });
    for (const side of [-1, 1]) k.sphere(wool(GOLD), 0.2, gx + side * W, 3.3, gz, { seg: 10, rings: 7 });
    P.star(k, GOLD, 0.32, gx, 4.2, gz, 0, 0.1); k.cyl(wool(GOLD), 0.1, 0.16, 0.16, gx, 3.95, gz, { seg: 10 });
    sign(gateLabels[i], gx, 3.3, gz + 0.18, 2.7); sign(gateLabels[i], gx, 3.3, gz - 0.18, 2.7, Math.PI);
    // 两扇栅门：铰在门柱上，开的时候朝北（里面）转
    return [1, -1].map(dir => part(root, kit => {
      const Lw = hw - 0.05;
      for (const y of [0.32, 1.06]) box(kit, wool(tone), Lw, 0.12, 0.1, dir * Lw / 2, y, 0, 0.04);
      for (const x of [0.07, Lw - 0.07]) box(kit, wool(tone), 0.14, 1.34, 0.13, dir * x, 0.67, 0, 0.04);
      for (let j = 0; j < 6; j++) { const x = 0.3 + j * (Lw - 0.6) / 5, h = 1.0 + Math.sin(j / 5 * Math.PI) * 0.22; box(kit, felt(j % 2 ? WOOL_WHITE : 0xeadfc4), 0.17, h, 0.06, dir * x, 0.12 + h / 2, 0, 0.06); }
      P.star(kit, GOLD, 0.2, dir * Lw / 2, 0.72, 0.07, 0, 0.05);
    }, gx - dir * hw, 0, gz, true));
  });

  // ====================================================================== 0 售票口
  use('gate');
  for (const [x, w, text] of [[-3.8, 2.5, copy('售票处', 'TICKETS')], [3.9, 2.2, copy('售票处', 'TICKETS')]]) {
    // 售票亭（矮的，能当掩体）：木板的身子、米白的台面、正面一排红白扇贝，后面两根旗杆拉一串小旗
    const z = 34.6, dp = 1.1, board = P.timber(0xb98a66), dark = P.timber(0x9a6f4c);
    box(k, board, w - 0.1, 1.16, dp - 0.1, x, 0.58, z, 0.05, { long: 1 });
    box(k, wool(WOOL_WHITE), w + 0.06, 0.12, dp + 0.06, x, 1.23, z, 0.045);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(k, dark, 0.14, 1.2, 0.14, x + sx * (w / 2 - 0.07), 0.6, z + sz * (dp / 2 - 0.07), 0.03, { long: 1 });
    P.valanceLine(k, null, [x - w / 2, z + dp / 2 + 0.03], [x + w / 2, z + dp / 2 + 0.03], 1.18, Math.round(w / 0.36), 0.24, { band: 0.05, mats: [wool(RED), wool(WOOL_WHITE)] });
    box(k, felt(0x4a3a33), w * 0.5, 0.42, 0.04, x, 0.6, z + dp / 2 - 0.03, 0.02);   // 正面一块暗的窗口，窗口上一行针脚
    P.stitch(d, [[x - w * 0.27, 0.86, z + dp / 2 + 0.005], [x + w * 0.27, 0.86, z + dp / 2 + 0.005]], { color: GOLD, len: 0.07, gap: 0.06, t: 0.016 });
    for (let i = 0; i < 3; i++) k.cyl(wool(i ? WOOL_WHITE : GOLD), 0.1, 0.1, 0.07, x - w * 0.28, 1.325 + i * 0.07, z + 0.12, { seg: 9 });   // 台面上一摞票
    k.sphere(wool(GOLD), 0.09, x + w * 0.26, 1.35, z + 0.1, { seg: 8, rings: 5, sy: 0.7 });   // 一只小铃
    const ends = [-1, 1].map(sx => [x + sx * (w / 2 - 0.1), z - dp / 2 + 0.1]);
    for (const [px, pz] of ends) { k.cyl(P.timber(0xa97a4c), 0.03, 0.035, 1.3, px, 1.94, pz, { seg: 6 }); k.sphere(wool(GOLD), 0.06, px, 2.62, pz, { seg: 6, rings: 4 }); }
    d.tube(felt(INK), [[ends[0][0], 2.5, ends[0][1]], [x, 2.3, ends[0][1]], [ends[1][0], 2.5, ends[1][1]]], 0.012, { seg: 4, detail: 4 });
    for (let j = 1; j < 6; j++) { const t = j / 6, fx = ends[0][0] + (ends[1][0] - ends[0][0]) * t, fy = 2.5 - Math.sin(t * Math.PI) * 0.2; d.quad(felt([RED, GOLD, TEAL, CREAM][j % 4]), [fx - 0.11, fy, ends[0][1]], [fx + 0.11, fy, ends[0][1]], [fx, fy - 0.26, ends[0][1]], [fx, fy - 0.26, ends[0][1]], [[0, 1], [1, 1], [0.5, 0], [0.5, 0]], 1, [0, 0, 1]); }
    sign(text, x, 0.6, z + dp / 2 + 0.01, w * 0.46);
    P.flowerPatch(d, x - w / 2 - 0.4, z + 0.3, 4, 0.6, seed++); P.tuft(d, x + w / 2 + 0.2, z + 0.5, seed++, 1.3);
  }
  // 门栓的架子：两根糖果色的短柱，中间两道金杆；门栓夹在杆上来回滑
  for (const side of [-1, 1]) {
    const x = side * (LOCK.amp + 0.75), z = LOCK.z - 0.18;
    k.cyl(wool(RED), 0.2, 0.24, 0.3, x, 0.15, z, { seg: 12 });
    for (let i = 0; i < 4; i++) k.cyl(wool(i % 2 ? TEAL : WOOL_WHITE), 0.1, 0.1, 0.36, x, 0.48 + i * 0.36, z, { seg: 10 });
    k.sphere(wool(GOLD), 0.15, x, 1.86, z, { seg: 9, rings: 6 });
  }
  for (const y of [LOCK.y + 0.2, LOCK.y - 0.2]) k.tube(wool(GOLD), [[-LOCK.amp - 0.75, y, LOCK.z - 0.18], [LOCK.amp + 0.75, y, LOCK.z - 0.18]], 0.045, { seg: 6, straight: true });
  const lockLamp = lamp(0xffcf72, 1.6);
  const lock = part(root, kit => {   // 门栓：一把青色的大挂锁，锁面上一个金靶心
    box(kit, knit(TEAL), 0.92, 0.66, 0.3, 0, -0.03, 0, 0.12);
    kit.tube(wool(GOLD), [[-0.24, 0.26, 0], [-0.24, 0.5, 0], [-0.14, 0.62, 0], [0.14, 0.62, 0], [0.24, 0.5, 0], [0.24, 0.26, 0]], 0.06, { seg: 6, detail: 2 });
    kit.cyl(wool(GOLD), 0.27, 0.27, 0.06, 0, -0.03, 0.16, { seg: 22, rx: Math.PI / 2 });
    kit.cyl(wool(WOOL_WHITE), 0.19, 0.19, 0.06, 0, -0.03, 0.175, { seg: 20, rx: Math.PI / 2 });
    kit.cyl(lockLamp, 0.1, 0.1, 0.06, 0, -0.03, 0.19, { seg: 16, rx: Math.PI / 2 });
    P.stitch(kit, [[-0.38, 0.24, 0.153], [0.38, 0.24, 0.153]], { len: 0.06, gap: 0.05, t: 0.014 }); P.stitch(kit, [[-0.38, -0.3, 0.153], [0.38, -0.3, 0.153]], { len: 0.06, gap: 0.05, t: 0.014 });
  }, LOCK.x, LOCK.y, LOCK.z, true);
  const frostGeo = new T.IcosahedronGeometry(1, 0), frostShell = ghost(0x96e9ff, 0.42), frostRim = new T.MeshBasicMaterial({ color: 0xd8f8ff, transparent: true, opacity: 0.5, wireframe: true, depthWrite: false });
  const frost = (parent, r, x = 0, y = 0, z = 0) => { const g = group(parent, x, y, z); obj(g, frostGeo, frostShell).scale.setScalar(r); obj(g, frostGeo, frostRim).scale.setScalar(r * 1.04); g.visible = false; return g; };
  const lockFrost = frost(lock, 0.66);
  // 路边的气球：每段一串，打得爆
  const balloons = BALLOONS.map((b, i) => {
    use(['gate', 'plaza', 'river'][b.zone]);
    if (i) { k.sphere(wool(i % 2 ? TEAL : RED), 0.2, b.x, 0.13, b.z, { seg: 9, rings: 6, sy: 0.7 }); k.cyl(P.timber(0xc9995f), 0.02, 0.025, 1.1, b.x, 0.7, b.z, { seg: 5 }); }   // 沙袋和细杆
    return part(root, (kit, det) => {
      [[-0.26, 0, -0.08, RED], [0, 0.2, 0.1, GOLD], [0.26, 0.02, -0.06, TEAL]].forEach(([x, y, z, c], j) => {
        kit.sphere(wool([RED, GOLD, TEAL][(i + j) % 3]), 0.25, x, y, z, { seg: 12, rings: 8, sy: 1.16 }); kit.cyl(wool(c), 0.02, 0.05, 0.06, x, y - 0.31, z, { seg: 6 });
        det.tube(felt(INK), [[x, y - 0.34, z], [x * 0.4, y - 0.6, z * 0.4], [0, -0.82, 0]], 0.007, { seg: 4, detail: 3 });
      });
    }, b.x, b.y, b.z, false, [b.x, b.z, 1]);
  });

  // ====================================================================== 1 木马广场
  use('plaza');
  const carousel = group(root, CAROUSEL.x, 0, CAROUSEL.z);
  {
    const c = CAROUSEL, SWEEP = c.radius + 0.62;
    // 地上：一块圆的毛毡地垫；木马软臂扫得到的范围用一圈红白相间的布条标出来
    k.cyl(wool(0xd8c59c), SWEEP + 0.3, SWEEP + 0.3, 0.05, c.x, 0.02, c.z, { seg: 56 });
    for (let i = 0; i < 28; i++) { const a = (i + 0.5) * TAU / 28; box(k, wool(i % 2 ? RED : WOOL_WHITE), SWEEP * TAU / 28 + 0.02, 0.03, 0.26, c.x + Math.sin(a) * SWEEP, 0.052, c.z + Math.cos(a) * SWEEP, 0.012, { ry: a }); }
    P.ring(d, c.x, 0.056, c.z, SWEEP - 0.3, { color: 0x9c7a55, len: 0.14, gap: 0.12, t: 0.022 }); P.ring(d, c.x, 0.056, c.z, 1.2, { color: GOLD, len: 0.1, gap: 0.08, t: 0.02 });
    // 不转的底座：青色的鼓、金边、红台面（碰撞盒就是这一块）
    k.cyl(wool(TEAL), 0.64, 0.68, 0.5, c.x, 0.25, c.z, { seg: 28 }); k.cyl(wool(GOLD), 0.7, 0.7, 0.1, c.x, 0.53, c.z, { seg: 28 }); k.cyl(wool(0xa94f4b), 0.62, 0.62, 0.08, c.x, 0.62, c.z, { seg: 28 });
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10, q = 0.672; P.stitch(d, Array.from({ length: 7 }, (_, j) => { const t = Math.PI * j / 6, b = a + Math.cos(t) * 0.22 / q; return [c.x + Math.sin(b) * q, 0.05 + Math.sin(t) * 0.34, c.z + Math.cos(b) * q]; }), { len: 0.06, gap: 0.05, t: 0.014 }); }
    // 转的部分：红色的中柱、伞顶、伞沿的扇贝边和穗子；四根包着软垫的长臂，臂上各骑一匹布马，臂头一只大拳套
    const anchor = [c.x, c.z, 4.2], RIM = 3.55, PEAK = 4.95, CR = 3.25, SECT = 16;
    part(carousel, (kit, det) => {
      kit.cyl(wool(0xa94f4b), 0.2, 0.23, 3.4, 0, 2.36, 0, { seg: 16 });
      for (const y of [0.74, 3.3, 3.95]) kit.cyl(wool(GOLD), 0.28, 0.28, 0.12, 0, y, 0, { seg: 16 });
      P.canopy(kit, det, CR, RIM, PEAK, [wool(TEAL), wool(GOLD)], SECT);
      kit.tube(wool(WOOL_WHITE), P.arc(0, RIM + 0.02, 0, CR + 0.02, 0, TAU, 44), 0.07, { seg: 6, straight: true, caps: false });
      const cusps = P.valance(kit, wool(GOLD), 0, RIM - 0.02, 0, CR + 0.03, SECT, 0.6, { band: 0.28, pipe: WOOL_WHITE, pipeKit: det, pipeR: 0.03 });
      for (const q of cusps) { P.rosette(kit, RED, q.x * 1.012, RIM - 0.19, q.z * 1.012, q.a, 0.15); P.tassel(kit, GOLD, q.x * 1.005, q.y - 0.02, q.z * 1.005, 1.15); }
      kit.cyl(wool(0xa94f4b), 0.3, 0.38, 0.2, 0, PEAK + 0.02, 0, { seg: 14 }); kit.sphere(wool(GOLD), 0.26, 0, PEAK + 0.34, 0, { seg: 12, rings: 8 });
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; kit.tube(P.timber(TIMBER), [[Math.sin(a) * 0.26, 3.92, Math.cos(a) * 0.26], [Math.sin(a) * (CR - 0.1), RIM + 0.02, Math.cos(a) * (CR - 0.1)]], 0.03, { seg: 5, straight: true }); }
      for (let i = 0; i < SECT; i++) { const a = (i + 0.5) * TAU / SECT; kit.sphere(M.glow(0xffe6a8, 2.2), 0.065, Math.sin(a) * (CR - 0.26), RIM - 0.06, Math.cos(a) * (CR - 0.26), { seg: 7, rings: 5 }); }
    }, 0, 0, 0, true, anchor);
    const tack = [[TEAL, GOLD], [RED, TEAL], [GOLD, RED], [CORAL, GOLD]];
    part(carousel, (kit, det) => {
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4, sx = Math.sin(a), cz = Math.cos(a), reach = c.radius + 0.42;
        kit.soft(knit(RED), 0.26, 0.24, reach - 0.3, sx * (reach + 0.3) / 2, 0.52, cz * (reach + 0.3) / 2, { r: 0.1, ry: a });
        for (const f of [0.34, 0.62, 0.9]) kit.cyl(wool(GOLD), 0.15, 0.15, 0.06, sx * reach * f, 0.52, cz * reach * f, { seg: 10, rx: Math.PI / 2, ry: a });
        kit.sphere(wool(WOOL_WHITE), 0.3, sx * reach, 0.56, cz * reach, { seg: 12, rings: 8, sy: 0.9 }); kit.sphere(wool(RED), 0.16, sx * (reach + 0.2), 0.56, cz * (reach + 0.2), { seg: 8, rings: 6 });
        const h = P.horse(...tack[i]), hr = 1.75;
        kit.merge(h.s, sx * hr, -0.2, cz * hr, a); det.merge(h.d, sx * hr, -0.2, cz * hr, a);
        kit.cyl(P.timber(0xc9995f), 0.03, 0.03, 3.0, sx * hr, 2.1, cz * hr, { seg: 6 });
      }
    }, 0, 0, 0, true, anchor);
    // 广场四周：花坛、石头、灌木（都在木马扫不到、也不挡路的地方）
    for (const [x, z, r] of [[-7.6, 25.2, 1.25], [-7.2, 13.8, 1.3], [6.9, 24.6, 1.2]]) {
      const n = Math.round(TAU * r / 0.25);
      for (let j = 0; j < n; j++) { const a = j * TAU / n; k.cyl(P.timber(j % 3 ? 0xa97a4c : 0x94683f), 0.1, 0.11, 0.2 + (j % 2) * 0.04, x + Math.sin(a) * r, 0.11, z + Math.cos(a) * r, { seg: 7 }); }
      k.cyl(M('terry', 0x5f7a45), r - 0.08, r - 0.08, 0.16, x, 0.08, z, { seg: 22 });
      for (let j = 0; j < 6; j++) { const a = j * TAU / 6 + rand(), q = r * (0.3 + rand() * 0.45); P.flowerPatch(d, x + Math.sin(a) * q, z + Math.cos(a) * q, 4, 0.6, seed++, 0.16); }
    }
  }
  // 蒸汽阀：一根从地里冒出来的旧管子，顶上一只红手轮；阀门后面是启动木马的金色开关
  const valveLamp = lamp(0xf2a367, 1.8), switchLamp = lamp(0xe3af55, 0.5);
  {
    const v = VALVE, pipe = knit(0x7f9aa0);
    k.cyl(wool(0x5b6f78), 0.24, 0.27, 0.12, v.x, 0.06, v.z, { seg: 12 });
    k.cyl(pipe, 0.13, 0.14, 1.1, v.x, 0.6, v.z, { seg: 10 });
    for (const y of [0.34, 0.88]) k.cyl(wool(GOLD), 0.17, 0.17, 0.07, v.x, y, v.z, { seg: 10 });
    k.sphere(pipe, 0.2, v.x, v.y - 0.12, v.z, { seg: 10, rings: 7 });
    k.cyl(pipe, 0.11, 0.13, 0.4, v.x, v.y + 0.18, v.z, { seg: 9 }); k.cyl(wool(GOLD), 0.16, 0.13, 0.09, v.x, v.y + 0.4, v.z, { seg: 9 });   // 喷口
    k.tube(wool(RED), Array.from({ length: 19 }, (_, i) => { const a = i * TAU / 18; return [v.x + Math.sin(a) * 0.27, v.y - 0.12 + Math.cos(a) * 0.27, v.z + 0.26]; }), 0.04, { seg: 6, straight: true });   // 手轮
    for (let i = 0; i < 3; i++) { const a = i * TAU / 6; P.dash(k, wool(RED), [v.x - Math.sin(a) * 0.25, v.y - 0.12 - Math.cos(a) * 0.25, v.z + 0.26], [v.x + Math.sin(a) * 0.25, v.y - 0.12 + Math.cos(a) * 0.25, v.z + 0.26], 0.04); }
    k.cyl(pipe, 0.05, 0.05, 0.12, v.x, v.y - 0.12, v.z + 0.2, { seg: 6, rx: Math.PI / 2 });
    k.sphere(valveLamp, 0.085, v.x, v.y - 0.12, v.z + 0.3, { seg: 9, rings: 6 });
    sign(copy('蒸汽阀', 'STEAM VALVE'), v.x - 1.15, 1.0, v.z + 0.05, 1.3, 0.35);
    for (const dx of [-0.52, 0.52]) k.cyl(P.timber(0xa97a4c), 0.035, 0.04, 0.92, v.x - 1.15 + dx * Math.cos(0.35), 0.46, v.z + 0.05 - dx * Math.sin(0.35), { seg: 6 });
    const w = SWITCH;   // 开关：青色的墩子，顶上一颗压得下去的金色大钮
    k.cyl(wool(TEAL), 0.2, 0.24, 0.74, w.x, 0.37, w.z, { seg: 12 }); k.cyl(wool(GOLD), 0.26, 0.26, 0.08, w.x, 0.76, w.z, { seg: 12 });
    k.sphere(switchLamp, 0.19, w.x, 0.84, w.z, { seg: 12, rings: 8, sy: 0.75 });
    P.ring(d, w.x, 0.5, w.z, 0.228, { len: 0.06, gap: 0.05, t: 0.014 });
    gift(4.1, 18.0, 1.3, 1.25, 1.05, TEAL);
    gift(4.95, 19.05, 0.62, 0.62, 0.5, CORAL, WOOL_WHITE);   // 旁边一只小的（不挡路：贴着大的）
  }
  const iceGeo = new T.IcosahedronGeometry(0.28, 0), valveIce = obj(root, iceGeo, ghost(0xb6f0ff, 0.85), VALVE.x, VALVE.y + 0.5, VALVE.z); valveIce.scale.set(1, 1.3, 1); valveIce.visible = false;
  const vaporMat = () => ghost(0xf2ece0, 0.4), vapor = Array.from({ length: 7 }, () => obj(root, new T.SphereGeometry(0.3, 9, 6), vaporMat()));

  // ====================================================================== 2 过山车：站台、河、轨道、小车、两个轨道靶、对岸
  use('river');
  const cart = group();
  {
    const px = PLATFORM.x, pz = PLATFORM.z, board = P.timber(0xb98a66), beam = P.timber(0xb98a5c);
    // 站台：一块木地板，四根米白的柱子托着红瓦人字顶，山墙上一颗星，檐下一圈红白扇贝
    for (let i = 0; i < 9; i++) box(k, P.timber(i % 2 ? 0xc9995f : 0xb98a5c), 5.4 / 9 - 0.02, 0.06, 3.6, px - 2.7 + (i + 0.5) * 0.6, 0.035, pz, 0.02, { long: 2 });
    for (const sx of [-1, 1]) for (const z of [8.0, 10.8]) { const x = px + sx * 2.45; k.cyl(wool(WOOL_WHITE), 0.11, 0.12, 2.6, x, 1.36, z, { seg: 10 }); for (const y of [0.11, 2.6]) k.cyl(wool(GOLD), 0.15, 0.15, 0.1, x, y, z, { seg: 10 }); }
    box(k, wool(WOOL_WHITE), 5.5, 0.12, 3.5, px, 2.72, pz, 0.04);
    for (const e of [-1, 1]) {
      k.soft(M('shingle', RED), 3.25, 0.14, 3.7, px + e * 1.38, 3.45, pz, { r: 0.05, rz: -e * 0.5 });
      P.valanceLine(k, null, e > 0 ? [px + 2.78, pz + 1.76] : [px - 2.78, pz - 1.76], e > 0 ? [px + 2.78, pz - 1.76] : [px - 2.78, pz + 1.76], 2.68, 9, 0.26, { band: 0.05, mats: [wool(RED), wool(WOOL_WHITE)] });
      k.extrude(wool(WOOL_WHITE), [[-2.76, 0], [2.76, 0], [0, 1.5]], 0.1, new T.Matrix4().makeTranslation(px, 2.78, pz + e * 1.72));
      P.star(k, GOLD, 0.3, px, 3.3, pz + e * 1.78, 0, 0.06);
      P.stitch(d, [[px - 2.4, 2.9, pz + e * 1.78], [px, 4.14, pz + e * 1.78], [px + 2.4, 2.9, pz + e * 1.78]], { color: RED, len: 0.08, gap: 0.07, t: 0.016 });
      P.valanceLine(k, null, e > 0 ? [px - 2.7, pz + 1.78] : [px + 2.7, pz - 1.78], e > 0 ? [px + 2.7, pz + 1.78] : [px - 2.7, pz - 1.78], 2.68, 10, 0.26, { band: 0.05, mats: [wool(RED), wool(WOOL_WHITE)] });
    }
    k.tube(wool(GOLD), [[px, 4.28, pz - 1.85], [px, 4.28, pz + 1.85]], 0.07, { straight: true, seg: 6 });
    // 河：深浅两层毛毡，水面上几行针脚当波纹；两岸一道鼓起来的滚边，石头、草丛、睡莲
    const rz = (RIVER.minZ + RIVER.maxZ) / 2, rd = RIVER.maxZ - RIVER.minZ;
    box(k, wool(DEEP), 36, 0.05, rd, 0, 0.02, rz, 0.02); box(k, wool(WATER), 36, 0.03, rd * 0.74, 0, 0.045, rz, 0.012);
    for (let i = 0; i < 6; i++) { const z = RIVER.minZ + 0.9 + i * (rd - 1.8) / 5; P.stitch(d, [[-13 + (i % 2) * 0.5, 0.064, z], [13, 0.064, z]], { color: RIPPLE, len: 0.24, gap: 0.34, t: 0.022 }); }
    for (const edge of [RIVER.minZ, RIVER.maxZ]) {
      k.tube(wool(0xcdb98c), [[-18, 0.07, edge], [18, 0.07, edge]], 0.16, { seg: 7, straight: true });
      for (let x = -12.5; x < 13; x += 2.3 + rand() * 1.4) { const off = edge === RIVER.minZ ? -0.28 : 0.28, roll = rand(); if (Math.abs(x) < 2.6 && edge === RIVER.maxZ) continue; if (roll < 0.45) P.rock(k, x, edge + off, 0.26 + rand() * 0.16, seed++); else P.tuft(d, x, edge + off * 0.8, seed++, 1.4 + rand() * 0.6); }
    }
    for (const [x, z, r] of [[-6.8, 5.2, 0.34], [-6.2, 4.7, 0.24], [5.4, 1.8, 0.32], [7.6, 5.4, 0.3], [-1.6, 1.6, 0.26], [11.4, 3.2, 0.34], [-11.6, 2.4, 0.3]]) { d.cyl(leaf(0x5f8f45), r, r, 0.02, x, 0.07, z, { seg: 10 }); if (r > 0.3) P.daisy(d, x + 0.06, 0.1, z, 0xf6f1e4, 1.5); }
    // 轨道：一红一金两根轨，枕木，架高的地方立着木支架（高的打上斜撑）
    const N = 60, rails = [[], []], spine = [];
    for (let i = 0; i <= N; i++) {
      const p = ridePose(i / N), q = ridePose(Math.min(1, (i + 0.5) / N)), o = ridePose(Math.max(0, (i - 0.5) / N)), dx = q.x - o.x, dz = q.z - o.z, len = Math.hypot(dx, dz) || 1, nx = dz / len, nz = -dx / len;
      rails[0].push([p.x + nx * 0.42, p.y, p.z + nz * 0.42]); rails[1].push([p.x - nx * 0.42, p.y, p.z - nz * 0.42]); spine.push([p.x, p.y - 0.15, p.z]);
      if (i % 2 === 0) P.dash(k, felt(0xe6d2a8), [p.x + nx * 0.56, p.y - 0.06, p.z + nz * 0.56], [p.x - nx * 0.56, p.y - 0.06, p.z - nz * 0.56], 0.085);
      if (i % 6 === 3 && p.y > 0.55) {
        const y = p.y - 0.2, A = [p.x + nx * 0.6, p.z + nz * 0.6], B = [p.x - nx * 0.6, p.z - nz * 0.6];
        for (const [x, z] of [A, B]) k.cyl(beam, 0.085, 0.1, y, x, y / 2, z, { seg: 7 });
        P.dash(k, beam, [A[0], y - 0.06, A[1]], [B[0], y - 0.06, B[1]], 0.11);
        if (y > 1.6) { P.dash(k, beam, [A[0], 0.2, A[1]], [B[0], y - 0.2, B[1]], 0.06); P.dash(k, beam, [B[0], 0.2, B[1]], [A[0], y - 0.2, A[1]], 0.06); }
      }
    }
    k.tube(wool(0xc9584f), rails[0], 0.075, { straight: true, seg: 6 }); k.tube(wool(GOLD), rails[1], 0.075, { straight: true, seg: 6 }); k.tube(beam, spine, 0.055, { straight: true, seg: 5 });
    for (const rail of rails) P.stitch(d, rail.map(([x, y, z]) => [x, y + 0.078, z]), { len: 0.13, gap: 0.16, t: 0.018 });
    // 终点：一块木板的小平台、红白相间的车挡；两只当掩体的礼物箱
    const end = ridePose(1);
    box(k, board, 2.6, 0.06, 2.4, end.x, 0.035, end.z + 0.3, 0.02, { long: 2 });
    for (const sx of [-1, 1]) k.cyl(wool(WOOL_WHITE), 0.09, 0.1, 0.8, end.x + sx * 0.55, 0.4, end.z - 0.85, { seg: 8 });
    for (let i = 0; i < 5; i++) box(k, wool(i % 2 ? WOOL_WHITE : RED), 0.3, 0.2, 0.16, end.x - 0.6 + i * 0.3, 0.72, end.z - 0.85, 0.04);
    gift(-5.8, -3.2, 1.3, 1.1, 1.05, RED); gift(5.8, -3.2, 1.3, 1.1, 1.05, 0x8a6fa6);
    gift(6.75, -2.5, 0.6, 0.6, 0.5, TEAL, WOOL_WHITE);
    // 小车：一节红车厢。人坐在里面，所以车帮上不加会横在视线中间的装饰，只有车头的圆鼻子、一颗星和一根扶手
    part(cart, (kit, det) => {
      box(kit, knit(RED), 0.98, 0.5, 1.45, 0, 0.3, 0, 0.16); box(kit, felt(0x5b4034), 0.8, 0.12, 1.15, 0, 0.5, 0, 0.05);
      box(kit, felt(0x5b4034), 0.78, 0.5, 0.14, 0, 0.72, -0.56, 0.06); box(kit, wool(0x6b4a3a), 0.7, 0.1, 0.4, 0, 0.5, -0.3, 0.04);
      kit.tube(felt(INK), [[-0.42, 0.62, 0.42], [0.42, 0.62, 0.42]], 0.028, { straight: true });
      for (const s of [-1, 1]) { P.stitch(det, [[s * 0.495, 0.3, -0.55], [s * 0.495, 0.3, 0.55]], { len: 0.06, gap: 0.05, t: 0.012 });
        for (const f of [-0.45, 0.45]) { kit.cyl(felt(0x4a3a33), 0.14, 0.14, 0.1, s * 0.47, 0.07, f, { seg: 12, rz: Math.PI / 2 }); kit.sphere(felt(0xd9b98c), 0.06, s * 0.525, 0.07, f, { seg: 6, rings: 4, sx: 0.5 }); } }
      kit.sphere(knit(RED), 0.5, 0, 0.3, 0.72, { sx: 0.98, sy: 0.52, sz: 0.9, seg: 12, rings: 8 }); P.star(kit, GOLD, 0.17, 0, 0.42, 1.17, 0, 0.05);
    }, 0, 0, 0, true);
  }
  // 两个轨道靶：各挂在一道金杆上来回滑。靶圈自己会亮：金色是没打中，冰蓝是冻住了，绿色是点亮了
  const coasterTargets = COASTER_TARGETS.map((t, i) => {
    use('river');
    const zb = t.z - 0.3, top = t.y + 0.86;
    for (const side of [-1, 1]) { const x = t.x + side * (t.amp + 0.75); k.cyl(P.timber(0xa97a4c), 0.07, 0.09, top, x, top / 2, zb, { seg: 7 }); k.sphere(wool(GOLD), 0.12, x, top + 0.08, zb, { seg: 8, rings: 6 }); k.cyl(wool(0xcdb98c), 0.17, 0.2, 0.14, x, 0.07, zb, { seg: 9 }); }
    k.tube(wool(GOLD), [[t.x - t.amp - 0.75, top - 0.1, zb], [t.x + t.amp + 0.75, top - 0.1, zb]], 0.04, { seg: 6, straight: true });
    const rim = lamp(0xffca72, 1.2), core = lamp(0xa83c48, 0.2);
    const g = part(root, kit => {
      kit.cyl(wool(RED), 0.44, 0.44, 0.1, 0, 0, 0, { seg: 26, rx: Math.PI / 2 });
      for (const f of [1, -1]) { kit.cyl(wool(WOOL_WHITE), 0.32, 0.32, 0.03, 0, 0, f * 0.055, { seg: 22, rx: Math.PI / 2 }); kit.cyl(core, 0.17, 0.17, 0.03, 0, 0, f * 0.075, { seg: 18, rx: Math.PI / 2 }); }
      kit.tube(rim, Array.from({ length: 25 }, (_, j) => { const a = j * TAU / 24; return [Math.sin(a) * 0.47, Math.cos(a) * 0.47, 0]; }), 0.055, { seg: 6, straight: true });
      for (const sx of [-0.2, 0.2]) kit.tube(felt(INK), [[sx, 0.44, 0], [sx, 0.74, -0.3]], 0.012, { straight: true });   // 挂绳
      kit.cyl(wool(GOLD), 0.07, 0.07, 0.5, 0, 0.76, -0.3, { seg: 8, rz: Math.PI / 2 });
    }, t.x, t.y, t.z, true);
    return { g, rim, core, frost: frost(g, 0.6) };
  });

  // ====================================================================== 3 大帐篷：外面、门、里面
  use('tent');
  const curtains = [], tentLights = [];
  let spot;
  {
    const { a: A, b: Bz, n: NN, z: CZ, wall: WALL } = TENT, RIDGE = 3.0, PEAK = 8.5, SECT = 36, SUB = 3;
    // 帐篷的轮廓：超椭圆。按弧长分成 36 片帐布，正南（门）在第 0 片的中间
    const curve = Array.from({ length: 721 }, (_, i) => { const t = Math.PI / 2 + i * TAU / 720, c = Math.cos(t), s = Math.sin(t); return [Math.sign(c) * A * Math.abs(c) ** (2 / NN), CZ + Math.sign(s) * Bz * Math.abs(s) ** (2 / NN)]; });
    const acc = [0]; for (let i = 1; i < curve.length; i++) acc.push(acc[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
    const total = acc[acc.length - 1], rimAt = f => { const s = (((f % 1) + 1) % 1) * total; let i = 1; while (acc[i] < s) i++; const u = (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1); return [curve[i - 1][0] + (curve[i][0] - curve[i - 1][0]) * u, curve[i - 1][1] + (curve[i][1] - curve[i - 1][1]) * u]; };
    const n = SECT * SUB, rim = Array.from({ length: n + 1 }, (_, i) => rimAt((i - SUB / 2) / n));   // rim[i]：第 i 小格的起点
    const out = i => { const p = rim[(i + n - 1) % n], q = rim[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz) || 1; return [-dz / len, dx / len]; };   // 朝外的法线（轮廓是顺着 t 增大的方向走的）
    const sign0 = (() => { const [nx, nz] = out(0); return nx * rim[0][0] + nz * (rim[0][1] - CZ) > 0 ? 1 : -1; })();
    const normal = i => { const [nx, nz] = out(i); return [nx * sign0, nz * sign0]; };
    const stripe = [wool(0xf1e3c0), wool(RED)], inner = [wool(0xc9aa82), wool(0xa05151)], door = (x, z) => Math.abs(x) < 1.86 && z > CZ;
    // 帐布墙：米白和红相间；里面那一面暗一点。门那一段不造
    for (let i = 0; i < n; i++) {
      const p = rim[i], q = rim[i + 1], m = stripe[Math.floor(i / SUB) % 2], mi = inner[Math.floor(i / SUB) % 2], [nx, nz] = normal(i);
      if (door(p[0], p[1]) && door(q[0], q[1])) continue;
      k.quad(m, [p[0], 0.02, p[1]], [q[0], 0.02, q[1]], [q[0], WALL, q[1]], [p[0], WALL, p[1]], [[i, 0], [i + 1, 0], [i + 1, WALL], [i, WALL]], 1, [nx, 0, nz]);
      k.quad(mi, [q[0] - nx * 0.05, 0.02, q[1] - nz * 0.05], [p[0] - nx * 0.05, 0.02, p[1] - nz * 0.05], [p[0] - nx * 0.05, WALL, p[1] - nz * 0.05], [q[0] - nx * 0.05, WALL, q[1] - nz * 0.05], [[0, 0], [1, 0], [1, 3.2], [0, 3.2]], 0.55, [-nx, 0, -nz]);
      if (i % SUB === 0 && !door(p[0], p[1])) P.stitch(d, [[p[0] + nx * 0.012, 0.2, p[1] + nz * 0.012], [p[0] + nx * 0.012, WALL - 0.15, p[1] + nz * 0.012]], { len: 0.2, gap: 0.2, t: 0.03 });
    }
    // 帐顶：两根主杆撑起一道屋脊，帐布从檐口一片片收到屋脊上；每道缝一行大针脚
    const apex = ([x]) => { const ax = Math.max(-RIDGE, Math.min(RIDGE, x)); return [ax, PEAK - 0.55 * (1 - (ax / RIDGE) ** 2), CZ]; };
    const prof = [[1, 0], [0.8, 0.2], [0.55, 0.46], [0.28, 0.76], [0, 1]], grow = 0.4;   // 最后一格收到屋脊上：两面的帐布在屋脊合缝
    const roofAt = (i, j, lift = 0) => { const [nx, nz] = normal(i % n), p = [rim[i][0] + nx * grow, rim[i][1] + nz * grow], ap = apex(p), [f, h] = prof[j]; return [ap[0] + (p[0] - ap[0]) * f, WALL - 0.03 + (ap[1] - WALL) * h + lift, ap[2] + (p[1] - ap[2]) * f]; };
    for (let i = 0; i < n; i++) {
      const m = stripe[(Math.floor(i / SUB) + 1) % 2], mi = inner[(Math.floor(i / SUB) + 1) % 2];
      for (let j = 1; j < prof.length; j++) {
        const uv = [[i, j - 1], [i + 1, j - 1], [i + 1, j], [i, j]];
        k.quad(m, roofAt(i, j - 1), roofAt(i + 1, j - 1), roofAt(i + 1, j), roofAt(i, j), uv, 1, [0, 1, 0]);
        k.quad(mi, roofAt(i + 1, j - 1, -0.03), roofAt(i, j - 1, -0.03), roofAt(i, j, -0.03), roofAt(i + 1, j, -0.03), uv, 0.5, [0, -1, 0]);
      }
      if (i % SUB === 0) P.stitch(d, prof.slice(0, 4).map((_, j) => roofAt(i, j, 0.03)), { len: 0.3, gap: 0.3, t: 0.035 });
    }
    k.tube(wool(GOLD), [[-RIDGE, PEAK + 0.02, CZ], [0, PEAK - 0.53, CZ], [RIDGE, PEAK + 0.02, CZ]], 0.09, { seg: 6, detail: 4 });   // 屋脊
    // 檐口：一圈金色扇贝边，每个尖上一颗金球，外面一道滚边
    for (let s = 0; s < SECT; s++) {
      const i0 = s * SUB, p = roofAt(i0, 0), q = roofAt(i0 + SUB, 0), mid = [(p[0] + q[0]) / 2, (p[2] + q[2]) / 2], [nx, nz] = normal(i0 + 1), half = Math.hypot(q[0] - p[0], q[2] - p[2]) / 2;
      P.lobe(k, wool(GOLD), mid[0], WALL + 0.02, mid[1], Math.atan2(nx, nz), half, 0.22, 0.6, 0.04);
      k.sphere(wool(GOLD), 0.13, p[0], WALL - 0.22, p[2], { seg: 7, rings: 5 });
    }
    k.tube(wool(0xf6e3a1), Array.from({ length: n + 1 }, (_, i) => { const p = roofAt(i % n, 0); return [p[0], WALL + 0.03, p[2]]; }), 0.08, { straight: true, seg: 6, caps: false });
    // 两根主杆顶上的旗
    for (const sx of [-1, 1]) {
      const x = sx * RIDGE; k.cyl(wool(RED), 0.3, 0.36, 0.2, x, PEAK + 0.05, CZ, { seg: 14 }); k.cyl(wool(GOLD), 0.08, 0.1, 1.4, x, PEAK + 0.8, CZ, { seg: 8 }); k.sphere(wool(GOLD), 0.18, x, PEAK + 1.6, CZ, { seg: 9, rings: 6 });
      k.extrude(wool(sx > 0 ? RED : TEAL), [[0, 0.3], [0.45, 0.23], [0.85, 0.32], [1.3, 0.2], [1.12, 0], [1.3, -0.18], [0.85, -0.27], [0.45, -0.2], [0, -0.28]], 0.05, new T.Matrix4().makeTranslation(x + 0.08, PEAK + 1.12, CZ));
    }
    // 门：两根红柱、门楣、招牌、一排金扇贝；门帘分左右两幅，开的时候各往两边收
    const dz = TENT_DOOR, pz = dz + 0.52;   // 门廊比帐布往外探出半米：门楣和招牌在檐口的扇贝边前面
    for (const side of [-1, 1]) { const x = side * 2.06; box(k, wool(RED), 0.44, 4.0, 0.46, x, 2.0, pz, 0.1); P.stitch(d, [[x, 3.3, pz + 0.235], [x, 0.3, pz + 0.235]], { color: GOLD, len: 0.12, gap: 0.1, t: 0.02 }); k.cyl(wool(GOLD), 0.3, 0.3, 0.1, x, 0.05, pz, { seg: 12 }); }
    box(k, wool(RED), 4.9, 0.7, 0.46, 0, 3.73, pz + 0.02, 0.1);
    for (const side of [-1, 1]) k.sphere(wool(GOLD), 0.2, side * 2.45, 4.2, pz, { seg: 9, rings: 6 });
    sign(copy('马戏帐篷', 'BIG TOP'), 0, 3.74, pz + 0.26, 2.45);
    P.valanceLine(k, wool(GOLD), [-1.84, pz + 0.2], [1.84, pz + 0.2], 3.4, 7, 0.3, { band: 0.06 });
    for (const side of [-1, 1]) { box(k, wool(0xa94f4b), 0.1, 3.4, 0.5, side * 1.86, 1.7, dz + 0.26, 0.03); }   // 门廊的两片侧板
    for (const side of [-1, 1]) curtains.push(part(root, (kit, det) => {
      for (let i = 0; i < 6; i++) kit.soft(wool(i % 2 ? 0xa94f4b : RED), 0.36, 3.36, 0.16, -side * (0.16 + i * 0.31), 1.7, 0, { r: 0.07, seg: 1 });
      kit.tube(wool(GOLD), [[-side * 0.02, 0.06, 0.09], [-side * 1.82, 0.06, 0.09]], 0.05, { seg: 5, straight: true });
      P.stitch(det, [[-side * 0.05, 0.3, 0.085], [-side * 1.8, 0.3, 0.085]], { color: GOLD, len: 0.1, gap: 0.08, t: 0.02 });
    }, side * 1.84, 0, dz + 0.02, true, [0, dz, 4]));
    // 门两边的海报（出图 agent 画的），帐布上的金菱形
    [['poster-circus-1.webp', -4.3], ['poster-circus-3.webp', 4.3]].forEach(([file, x]) => {
      box(k, M('boards', 0x9a6f4c), 1.34, 1.74, 0.07, x, 1.72, dz + 0.1, 0.03); box(k, wool(RED), 1.5, 0.14, 0.16, x, 2.68, dz + 0.1, 0.04); k.sphere(wool(GOLD), 0.09, x, 2.84, dz + 0.1, { seg: 7, rings: 5 });
      picture(file, 1.2, 1.6, x, 1.72, dz + 0.145);
    });
    for (let s = 2; s < SECT - 1; s += 2) { const i = s * SUB, p = rim[i], [nx, nz] = normal(i); if (p[1] > CZ + Bz - 0.4 && Math.abs(p[0]) < 6) continue; box(k, wool(GOLD), 0.4, 0.4, 0.03, p[0] + nx * 0.03, 1.7, p[1] + nz * 0.03, 0.02, { ry: Math.atan2(nx, nz), rz: Math.PI / 4 }); box(k, wool(CORAL), 0.2, 0.2, 0.03, p[0] + nx * 0.05, 1.7, p[1] + nz * 0.05, 0.02, { ry: Math.atan2(nx, nz), rz: Math.PI / 4 }); }
    // 门两侧的小帐：把帐篷和栏杆之间的空当填上
    for (const x of [-8.75, 8.75]) {
      const z = dz - 0.9, R = 1.25;
      for (let i = 0; i < 12; i++) { const a0 = i * TAU / 12, a1 = (i + 1) * TAU / 12, m = (a0 + a1) / 2, q = t => [x + Math.sin(t) * R, z + Math.cos(t) * R], [ax, az] = q(a0), [bx, bz] = q(a1); k.quad(stripe[i % 2], [ax, 0, az], [bx, 0, bz], [bx, 2.0, bz], [ax, 2.0, az], [[a0 * R, 0], [a1 * R, 0], [a1 * R, 2], [a0 * R, 2]], 1, [Math.sin(m), 0, Math.cos(m)]); }
      const top = new PlushKit(), tdet = new PlushKit(); P.canopy(top, tdet, R + 0.28, 1.98, 3.7, [stripe[1], stripe[0]], 12, { seam: { len: 0.2, gap: 0.2, t: 0.028 }, mid: false }); k.merge(top, x, 0, z); d.merge(tdet, x, 0, z);
      P.valance(k, wool(GOLD), x, 2.02, z, R + 0.3, 12, 0.36, { band: 0.12 }); k.cyl(wool(GOLD), 0.07, 0.09, 0.5, x, 3.9, z, { seg: 8 }); k.sphere(wool(GOLD), 0.15, x, 4.22, z, { seg: 9, rings: 6 });
      hedge(x < 0 ? -10.2 : 7.2, x < 0 ? -7.2 : 10.2, dz + 0.25);
    }
    // ---------- 里面：锯末色的地、进门的红毯、机关地砖底下的暗坑、两侧的看台、后台的幕布、从屋脊拉下来的灯串
    for (let i = 0; i < n; i += SUB) { const p = rim[i], q = rim[i + SUB]; k.quad(wool(0xc9a877), [p[0], 0.03, p[1]], [q[0], 0.03, q[1]], [0, 0.03, CZ], [0, 0.03, CZ], [[p[0], p[1]], [q[0], q[1]], [0, CZ], [0, CZ]], 0.7, [0, 1, 0]); }
    box(k, wool(0xa94f4b), 3.2, 0.03, 2.1, 0, 0.05, dz - 1.0, 0.012);
    for (const sx of [-1, 1]) P.stitch(d, [[sx * 1.45, 0.07, dz - 0.05], [sx * 1.45, 0.07, dz - 1.95]], { color: GOLD, len: 0.1, gap: 0.08, t: 0.02 });
    for (const sx of [-1, 1]) for (let tier = 0; tier < 2; tier++) for (let i = 0; i < 5; i++) box(k, M('boards', tier ? 0xb98a66 : 0x9a7250), 0.56, 0.33 + tier * 0.36, 1.26, sx * (6.42 + tier * 0.58), (0.33 + tier * 0.36) / 2 + 0.03, CZ - 2.7 + i * 1.34, 0.04, { long: 2 });   // 看台：两级实心的台阶
    for (const sx of [-1, 1]) { k.cyl(wool(GOLD), 0.1, 0.12, 3.5, sx * 2.9, 1.75, CZ - Bz + 0.75, { seg: 9 }); k.sphere(wool(GOLD), 0.17, sx * 2.9, 3.6, CZ - Bz + 0.75, { seg: 9, rings: 6 }); }   // 后台的门：两根金杆之间挂一幅深红的幕
    for (let i = 0; i < 12; i++) k.soft(wool(i % 2 ? 0x8f3f42 : 0x9c4a49), 0.5, 3.2, 0.16, -2.65 + i * 0.482, 1.62, CZ - Bz + 0.72, { r: 0.07, seg: 1 });
    P.valanceLine(k, wool(GOLD), [-2.9, CZ - Bz + 0.84], [2.9, CZ - Bz + 0.84], 3.3, 10, 0.34, { band: 0.08 });
    gift(-4.4, CZ - Bz + 1.5, 1.1, 1.0, 0.9, TEAL); gift(4.5, CZ - Bz + 1.45, 1.2, 1.0, 1.0, 0x8a6fa6); gift(-5.3, CZ - Bz + 2.3, 0.6, 0.6, 0.5, GOLD, RED);
    const strings = [0, 1, 2, 3].map(() => new PlushKit()), lamps = strings.map(() => lamp(0xffd884, 2.2));   // 灯串：分四组，开打以后一组一组地闪
    for (let j = 0; j < 12; j++) {
      const f = (j + 0.5) / 12, p = rimAt(f), ap = apex(p), from = [ap[0], ap[1] - 0.5, ap[2]], to = [p[0] * 0.93, WALL - 0.1, CZ + (p[1] - CZ) * 0.93];
      d.tube(felt(INK), [from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.5, (from[2] + to[2]) / 2], to], 0.012, { seg: 4, detail: 4 });
      for (let t = 1; t <= 4; t++) { const u = t / 4.6, y = from[1] + (to[1] - from[1]) * u - Math.sin(u * Math.PI) * 0.5; strings[(j + t) % 4].sphere(lamps[(j + t) % 4], 0.09, from[0] + (to[0] - from[0]) * u, y - 0.1, from[2] + (to[2] - from[2]) * u, { seg: 8, rings: 5 }); }
    }
    strings.forEach(kit => { const [mesh] = kit.build({ cast: false, name: 'tent-lights' }); root.add(mesh); tentLights.push(mesh); });
    spot = obj(root, new T.CircleGeometry(2.5, 36), new T.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }), CLOWN.x, 0.125, CLOWN.z); spot.rotation.x = -Math.PI / 2;   // 打在小丑脚下的一圈顶光
  }
  // 机关地砖：十五块活板。预警时角上竖起一颗布扣（急冻枪打它或打砖面都能冻住），到点往下翻，露出底下的暗坑
  const tileBack = Math.min(...TILES.map(t => t.z)) - TILE / 2, tileFront = Math.max(...TILES.map(t => t.z)) + TILE / 2;
  const pit = obj(root, new T.PlaneGeometry(TILE * 5, tileFront - tileBack), new T.MeshBasicMaterial({ color: 0x191322 }), 0, 0.052, (tileBack + tileFront) / 2); pit.rotation.x = -Math.PI / 2;
  const flapMeshes = [0x9a7250, 0xb98a66].map(tone => {
    const kit = new PlushKit(), S = TILE - 0.06;
    kit.soft(P.timber(tone), S, 0.07, S, 0, -0.035, S / 2, { r: 0.02, seg: 1, long: 0 });
    for (const [w, dp, x, z] of [[S - 0.2, 0.07, 0, 0.14], [S - 0.2, 0.07, 0, S - 0.14], [0.07, S - 0.2, -S / 2 + 0.14, S / 2], [0.07, S - 0.2, S / 2 - 0.14, S / 2]]) kit.box(P.timber(tone === 0x9a7250 ? 0x7e5b40 : 0x9a7250), w, 0.012, dp, x, 0.004, z);
    kit.cyl(P.timber(0x6d4d37), 0.13, 0.13, 0.014, 0, 0.004, S - 0.36, { seg: 12 });   // 拉环
    return kit.build({ cast: false, name: 'tile' });
  });
  const warnMat = new T.MeshBasicMaterial({ color: 0xffca71, transparent: true, opacity: 0.9, depthWrite: false }), iceRingMat = new T.MeshBasicMaterial({ color: 0x97e8ff, transparent: true, opacity: 0.9, depthWrite: false });
  const ringGeo = new T.RingGeometry(0.62, 0.78, 28); ringGeo.rotateX(-Math.PI / 2);
  const plateGeo = new T.PlaneGeometry(TILE - 0.12, TILE - 0.12); plateGeo.rotateX(-Math.PI / 2);
  // 竖起来的布扣：一根米白的细杆顶着一枚扣子（四个扣眼），预警时是橙色，冻住了变冰蓝
  const tabStalk = (() => { const kit = new PlushKit(); kit.cyl(wool(WOOL_WHITE), 0.035, 0.05, 0.5, 0, 0.3, 0, { seg: 7 }); kit.cyl(wool(GOLD), 0.09, 0.11, 0.06, 0, 0.08, 0, { seg: 8 }); return kit.build({ cast: false, name: 'tab' }); })();
  const tabGeo = new T.CylinderGeometry(0.21, 0.21, 0.07, 18), holeGeo = new T.CylinderGeometry(0.03, 0.03, 0.08, 6), holeMat = new T.MeshBasicMaterial({ color: 0x5a3a30 });
  const tiles = TILES.map((point, i) => {
    const flap = group(root, point.x, 0.108, point.z - TILE / 2 + 0.03);
    for (const mesh of flapMeshes[i % 2]) { const copyMesh = mesh.clone(); copyMesh.receiveShadow = true; flap.add(copyMesh); }
    const warning = obj(root, ringGeo, warnMat, point.x, 0.125, point.z), plate = obj(root, plateGeo, ghost(0x8ae6ff, 0.5), point.x, 0.13, point.z);
    const at = tileSwitch(point), tab = group(root, at.x, 0, at.z), tabMat = lamp(0xff8d62, 1.1);
    for (const mesh of tabStalk) tab.add(mesh.clone());
    const button = group(tab, 0, at.y, 0); button.rotation.x = 1.1; obj(button, tabGeo, tabMat);
    for (const [hx, hz] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]]) obj(button, holeGeo, holeMat, hx, 0, hz);
    warning.visible = plate.visible = tab.visible = false;
    return { flap, warning, plate, tab, tabMat };
  });

  // ---------- 嬉笑小丑、他扔出来的三只惊喜盒、烟花、打倒后掉出来的高压马达 ----------
  const clown = createClown(P, M); root.add(clown.root);
  const clownFrost = frost(root, 1.25); clownFrost.scale.set(1, 1.35, 1);
  const eyeRing = obj(root, new T.RingGeometry(0.74, 0.79, 36), new T.MeshBasicMaterial({ color: 0xffd982, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }), 0, CLOWN.maskY, CLOWN.z + 0.94);
  const springRing = new T.RingGeometry(0.7, 0.78, 32); springRing.rotateX(-Math.PI / 2);
  const boxes = Array.from({ length: 3 }, (_, i) => {
    const g = part(root, kit => {   // 惊喜盒：礼物箱的样子，盒盖上一块弹簧垫
      const tone = i === 0 ? TEAL : RED;
      box(kit, knit(tone), 1.02, 0.5, 1.02, 0, 0.25, 0, 0.08); box(kit, wool(tone), 1.1, 0.14, 1.1, 0, 0.55, 0, 0.05);
      box(kit, wool(GOLD), 0.18, 0.64, 1.13, 0, 0.32, 0, 0.03); box(kit, wool(GOLD), 1.13, 0.64, 0.18, 0, 0.32, 0, 0.03);
      kit.cyl(wool(WOOL_WHITE), 0.36, 0.38, 0.07, 0, 0.655, 0, { seg: 18 }); P.star(kit, GOLD, 0.2, 0, 0.3, 0.52, 0, 0.04);
    }, 0, 0, 0, true);
    const landing = obj(root, springRing, ghost(0xf3ac51, 0.85)), ready = obj(root, springRing, ghost(0x91f0dd, 0.9));
    return { g, landing, ready };
  });
  const fireGeo = new T.SphereGeometry(0.14, 10, 7), blastGeo = new T.SphereGeometry(1, 12, 8), dangerGeo = new T.RingGeometry(1.0, 1.26, 32); dangerGeo.rotateX(-Math.PI / 2);
  const fireworks = Array.from({ length: 5 }, () => ({ glow: obj(root, fireGeo, new T.MeshBasicMaterial({ color: 0xffc565 })), disc: obj(root, dangerGeo, ghost(0xff8a5a, 0.75)), burst: obj(root, blastGeo, ghost(0xffcf83, 0.55)) }));
  const motor = part(root, kit => {   // 高压马达：青色的机壳、一圈圈散热片、金色的轴、顶上一颗会放电的球
    kit.cyl(knit(TEAL), 0.22, 0.22, 0.5, 0, 0, 0, { seg: 16, rx: Math.PI / 2 });
    for (let i = 0; i < 4; i++) kit.cyl(wool(0x2f6d77), 0.255, 0.255, 0.04, 0, 0, -0.18 + i * 0.12, { seg: 16, rx: Math.PI / 2 });
    kit.cyl(wool(GOLD), 0.08, 0.08, 0.26, 0, 0, 0.36, { seg: 10, rx: Math.PI / 2 }); kit.cyl(wool(GOLD), 0.15, 0.15, 0.06, 0, 0, 0.27, { seg: 12, rx: Math.PI / 2 });
    box(kit, wool(0x2f6d77), 0.34, 0.08, 0.4, 0, -0.25, 0, 0.03);
    kit.sphere(M.glow(0x9de3f4, 2.6), 0.1, 0, 0.3, 0, { seg: 9, rings: 6 }); kit.cyl(wool(GOLD), 0.03, 0.03, 0.1, 0, 0.23, 0, { seg: 6 });
  }, CLOWN.x, 0.66, -12.1, true);
  motor.visible = false;

  // ====================================================================== 远处的摆设：西边一座摩天轮，东边两个摊位（都在栏杆外面，只是看的）
  const wheel = group(group(root, -16.6, 6.5, 15.2), 0, 0, 0); wheel.parent.rotation.y = Math.PI / 2;
  const cabins = [];
  {
    use('plaza');
    const wx = -16.6, wz = 15.2, R = 5.3, hubY = 6.5;
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) k.tube(felt(TEAL), [[wx + sx * 0.75, hubY, wz], [wx + sx * 0.9, 0, wz + sz * 3.0]], 0.17, { seg: 7, straight: true });   // A 字架
    box(k, P.timber(0xb98a66), 2.6, 0.5, 7.2, wx, 0.25, wz, 0.05, { long: 2 });
    for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) { const zz = wz - 3.5 + i; d.quad(felt([RED, GOLD, TEAL, CREAM][i % 4]), [wx + sx * 1.32, 0.5, zz], [wx + sx * 1.32, 0.5, zz + 0.5], [wx + sx * 1.32, 0.16, zz + 0.25], [wx + sx * 1.32, 0.16, zz + 0.25], undefined, 1, [sx, 0, 0]); }
    part(wheel, (kit, det) => {
      for (const sz of [-0.55, 0.55]) {
        kit.tube(felt(RED), Array.from({ length: 49 }, (_, i) => { const a = i * TAU / 48; return [Math.cos(a) * R, Math.sin(a) * R, sz]; }), 0.11, { seg: 6, straight: true, caps: false });
        kit.tube(felt(CREAM), Array.from({ length: 41 }, (_, i) => { const a = i * TAU / 40; return [Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56, sz]; }), 0.06, { seg: 5, straight: true, caps: false });
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; kit.tube(felt(i % 2 ? TEAL : CREAM), [[0, 0, sz], [Math.cos(a) * R, Math.sin(a) * R, sz]], 0.055, { seg: 5, straight: true }); }
      }
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; kit.tube(felt(GOLD), [[Math.cos(a) * R, Math.sin(a) * R, -0.55], [Math.cos(a) * R, Math.sin(a) * R, 0.55]], 0.05, { seg: 5, straight: true }); kit.sphere(wool(WOOL_WHITE), 0.15, Math.cos(a) * R, Math.sin(a) * R, 0.62, { seg: 7, rings: 5 }); }
      kit.cyl(wool(GOLD), 0.5, 0.5, 1.5, 0, 0, 0, { seg: 16, rx: Math.PI / 2 }); P.star(kit, RED, 0.32, 0, 0, 0.76, 0, 0.05);
    }, 0, 0, 0, true);
    for (let i = 0; i < 8; i++) cabins.push(part(wheel, kit => {
      const tone = [RED, TEAL, GOLD, CORAL][i % 4];
      box(kit, knit(tone), 1.0, 0.56, 0.9, 0, -1.0, 0, 0.14); box(kit, felt(CREAM), 1.1, 0.1, 1.0, 0, -0.32, 0, 0.04);
      for (const sx of [-0.42, 0.42]) for (const sz of [-0.36, 0.36]) kit.cyl(felt(CREAM), 0.025, 0.025, 0.46, sx, -0.54, sz, { seg: 5 });
      kit.tube(felt(INK), [[0, 0, 0], [0, -0.28, 0]], 0.02, { straight: true });
    }, 0, 0, 0, true));
    // 东边的两个摊位：圆柜台、尖顶条纹帐子、挂着的布偶
    use('gate');
    for (const [x, z, tones, prize] of [[13.4, 30.6, [RED, WOOL_WHITE], GOLD], [13.9, 23.4, [TEAL, WOOL_WHITE], CORAL]]) {
      const g = zoneAt(z), s = g.s;
      s.cyl(P.timber(0xb98a66), 1.5, 1.5, 0.95, x, 0.475, z, { seg: 20 }); s.cyl(wool(WOOL_WHITE), 1.6, 1.6, 0.1, x, 1.0, z, { seg: 20 });
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; s.cyl(P.timber(0xa97a4c), 0.05, 0.05, 1.7, x + Math.sin(a) * 1.5, 1.85, z + Math.cos(a) * 1.5, { seg: 6 }); }
      const top = new PlushKit(), tdet = new PlushKit(); P.canopy(top, tdet, 2.05, 2.7, 4.1, tones.map(c => wool(c)), 12, { mid: false }); s.merge(top, x, 0, z); g.d.merge(tdet, x, 0, z);
      P.valance(s, null, x, 2.72, z, 2.07, 24, 0.3, { band: 0.08, mats: tones.map(c => wool(c)) }); s.sphere(wool(GOLD), 0.14, x, 4.2, z, { seg: 8, rings: 6 });
      for (let i = 0; i < 5; i++) { const a = -2.2 + i * 0.35; s.sphere(wool(i % 2 ? prize : WOOL_WHITE), 0.17, x + Math.sin(a) * 1.45, 2.2, z + Math.cos(a) * 1.45, { seg: 8, rings: 6 }); s.sphere(wool(i % 2 ? prize : WOOL_WHITE), 0.11, x + Math.sin(a) * 1.45, 2.42, z + Math.cos(a) * 1.45, { seg: 7, rings: 5 }); }
    }
  }

  // ---------- 收尾：每段两组网格（主体投影，小装饰不投影、走远了关掉） ----------
  const farFromTent = [];   // 进了帐篷以后看不到的：入口和木马广场那两段的主体（门帘外只看得见过山车那一段）
  for (const [id, q] of zones) {
    const main = q.s.build({ cast: true, name: 'fair:' + id }); if (main.length) root.add(...main);
    if (id === 'gate' || id === 'plaza') farFromTent.push(...main);
    const extra = q.d.build({ cast: false, name: 'detail:' + id }); if (!extra.length) continue;
    root.add(...extra);
    const bounds = new T.Box3(); extra.forEach(m => { m.geometry.computeBoundingBox(); bounds.union(m.geometry.boundingBox); });
    details.push({ meshes: extra, x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2, r: Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2 });
  }
  farFromTent.push(carousel, wheel.parent);
  root.traverse(o => { if (o.isMesh && o.material?.transparent) o.castShadow = false; });
  [carousel, cart, clown.root, lock, ...gateLeaves.flat(), ...curtains, ...boxes.map(v => v.g), ...coasterTargets.map(t => t.g)].forEach(g => cine.shadows.addDynamic(g));
  cine.shadows.invalidate();

  // ---------- 每帧：照规则层的状态摆 ----------
  let last = 0, wheelAngle = 0, lightUp = [0, 0, 0];
  function update(s) {
    const a = s.amusement, time = s.time, c = a.clown, dt = Math.max(0, Math.min(0.1, time - last)); last = time;
    const eye = cine.camera.position;
    for (const q of details) { const on = Math.hypot(eye.x - q.x, eye.z - q.z) < q.r + DETAIL_RANGE; if (q.on !== on) { q.on = on; for (const m of q.meshes) m.visible = on; } }
    const won = a.lit[3], inside = c.entered && !a.pickedUp;
    if (farFromTent.inside !== inside) { farFromTent.inside = inside; for (const o of farFromTent) o.visible = !inside; }
    // 彩灯和电缆：一段打完就亮；全打完以后一起闪
    for (let z = 0; z < 3; z++) {
      const on = a.lit[z] || won; lightUp[z] += ((on ? 1 : 0) - lightUp[z]) * Math.min(1, dt * 2.2 + (dt ? 0 : 1));
      const f = lightUp[z], q = zoneLights[z];
      q.bulbs.forEach((b, i) => light(b.mat, f > 0.02 ? b.color : DIM, f * (2.0 + (won ? 0.9 * Math.sin(time * 5 + i * 2.1 + z) : 0.25 * Math.sin(time * 2.2 + i * 2.1)))));
      light(q.cable, f > 0.02 ? 0xffd36e : ROPE, f * 1.5); light(q.beacon, f > 0.02 ? q.bulbs[z].color : DIM, f * 2.4);
    }
    // 两道栅门、帐篷的门帘
    gateLeaves.forEach((pair, i) => { const f = a.opened[i] !== null ? sat((time - a.opened[i]) / GATE_LIFT_SECONDS) : 0, turn = f * f * (3 - 2 * f) * 1.72; pair[0].rotation.y = turn; pair[1].rotation.y = -turn; });
    { const f = a.opened[2] !== null ? sat((time - a.opened[2]) / GATE_LIFT_SECONDS) : 0, open = f * f * (3 - 2 * f); curtains.forEach(g => { g.scale.x = 1 - open * 0.8; }); }
    // 门栓
    lock.visible = a.lock !== 'open';
    const lp = lockPosition(a, time); lock.position.set(lp.x, lp.y, lp.z);
    light(lockLamp, a.lock === 'frozen' ? 0x9feaff : 0xd9584f, a.lock === 'frozen' ? 2.2 : 1.2);
    lockFrost.visible = a.lock === 'frozen';
    // 气球
    balloons.forEach((b, i) => { b.visible = !!a.balloons[i]; if (b.visible) b.position.y = BALLOONS[i].y + Math.sin(time * 2.3 + i) * 0.1; });
    // 木马：扫僵尸的时候飞转，这一段点亮以后慢慢转
    carousel.rotation.y = a.carousel.until > time ? a.carousel.angle : a.lit[1] ? a.carousel.angle + time * 0.75 : a.carousel.angle;
    // 蒸汽阀和开关
    const frozenValve = !a.valveLatched && a.valveUntil > time, venting = a.zone <= 1 && !a.valveLatched && !frozenValve;
    light(valveLamp, a.valveLatched ? 0xa4f89d : frozenValve ? 0x9feaff : 0xf2a367, 1.8);
    light(switchLamp, a.valveLatched || frozenValve ? 0xffd36e : 0xb9925a, a.valveLatched || frozenValve ? 1.6 + Math.sin(time * 6) * 0.5 : 0.15);
    valveIce.visible = frozenValve;
    vapor.forEach((m, i) => {
      const phase = (time * 0.9 + i / vapor.length) % 1;
      m.visible = venting; m.scale.setScalar(0.5 + phase * 1.5);
      m.position.set(VALVE.x + Math.sin(phase * 5 + i) * 0.22, VALVE.y + 0.5 + phase * 1.5, VALVE.z - phase * 1.7 + Math.cos(i * 2.3) * 0.18);
      m.material.opacity = (1 - phase) * 0.5;
    });
    // 过山车：小车跟着轨道走，车头朝前、随坡抬头低头，不侧倾
    { const u = a.ride.progress, p = ridePose(u), o = ridePose(Math.max(0, u - 0.01)), q = ridePose(Math.min(1, u + 0.01)), dx = q.x - o.x, dy = q.y - o.y, dz = q.z - o.z, len = Math.hypot(dx, dy, dz) || 1;
      cart.position.set(p.x, p.y + 0.06, p.z); cart.rotation.order = 'YXZ'; cart.rotation.set(-Math.asin(dy / len), Math.atan2(dx, dz), 0); }
    coasterTargets.forEach((t, i) => {
      const st = a.targets[i], pos = coasterTargetPosition(a, i), frozen = st.frozenUntil > time && !st.lit;
      t.g.position.set(pos.x, pos.y, pos.z);
      light(t.rim, st.lit ? 0x8cf4ba : frozen ? 0x96e9ff : 0xffca72, st.lit ? 2.4 : 1.2); light(t.core, st.lit ? 0xffffff : 0xa83c48, st.lit ? 1.6 : 0.2);
      t.frost.visible = frozen;
    });
    // 摩天轮：售票口点亮以后才转
    if (a.lit[0] || won) wheelAngle += dt * (won ? 0.3 : 0.16);
    wheel.rotation.z = wheelAngle;
    cabins.forEach((g, i) => { const b = i * TAU / 8; g.position.set(Math.cos(b) * 5.3, Math.sin(b) * 5.3, 0); g.rotation.z = -wheelAngle; });
    // 小丑
    const intro = a.clownIntroUntil > time ? sat((time - a.clownIntroStarted) / CLOWN_INTRO_SECONDS) : null;
    const down = c.defeatedAt === null ? 0 : sat((time - c.defeatedAt) / 1.3), frozen = c.frozenUntil > time;
    const casting = !!a.volleys.length || a.boxes.some(b => !b.teaching && time < b.land) || a.fireworks.some(f => time < f.impact);
    clown.pose({ time, pose: c.poseTime, x: c.x, z: c.z, mask: c.mask, flash: c.flash > time, frozen, hidden: !c.entered, intro, casting, down });
    clownFrost.visible = frozen; clownFrost.position.set(c.x, 2.75, c.z + 0.1);
    eyeRing.position.x = c.x; eyeRing.visible = c.entered && !!c.mask && time < a.launchUntil && s.player.jump > 0.52;
    const fight = c.entered && c.defeatedAt === null ? 1 : 0;
    spot.position.x = c.x; spot.material.opacity = fight * 0.16 + (intro !== null ? 0.2 : 0);
    tentLights.forEach((m, i) => { m.material.emissiveIntensity = 2.2 * (1 + (fight || won ? 0.9 + 0.7 * Math.sin(time * 5 + i * 1.6) : 0)); });
    motor.visible = c.defeatedAt !== null && !a.pickedUp;
    motor.rotation.y = time * 1.55; motor.position.y = 0.66 + Math.sin(time * 2.4) * 0.06;
    // 机关地砖
    for (let i = 0; i < tiles.length; i++) {
      const tile = a.tiles[i], r = tiles[i], frozenTile = tile.frozenUntil > time, off = tile.off > 0 && time >= tile.off && time < tile.until && !frozenTile;
      const warn = !off && tile.off > 0 && time >= tile.warn && time < tile.off;
      const swing = off ? sat((time - tile.off) / 0.22) : tile.off > 0 && time >= tile.until ? 1 - sat((time - tile.until) / 0.3) : 0;
      r.flap.rotation.x = swing * 1.5;
      r.warning.visible = frozenTile || warn; r.warning.material = frozenTile ? iceRingMat : warnMat;
      r.warning.scale.setScalar(1.02 + Math.sin(time * 13) * 0.1);
      r.plate.visible = frozenTile; r.tab.visible = frozenTile || warn; light(r.tabMat, frozenTile ? 0x90e6ff : 0xff8d62, 1.1 + (frozenTile ? 0 : Math.sin(time * 13) * 0.5));
    }
    // 惊喜盒：从小丑手里抛出来，落稳以后盒顶一圈青色的光，踩上去弹起来
    for (let i = 0; i < boxes.length; i++) {
      const v = boxes[i], b = a.boxes[i];
      v.g.visible = !!b && !b.used; v.landing.visible = !!b && time < b.land; v.ready.visible = !!b && b.settled && !b.used;
      if (!b) continue;
      const flight = b.settled ? 1 : sat((time - b.thrown) / (b.land - b.thrown));
      v.g.position.set(c.x + (b.x - c.x) * flight, 2.4 * (1 - flight) + 3.0 * Math.sin(Math.PI * flight), CLOWN.z + (b.z - CLOWN.z) * flight);
      v.g.rotation.set((1 - flight) * Math.sin(time * 8), i * 0.45, (1 - flight) * Math.sin(time * 7 + i));
      v.landing.position.set(b.x, 0.14, b.z); v.ready.position.set(b.x, 0.7, b.z); v.ready.scale.setScalar(0.56 + Math.sin(time * 5) * 0.05);
    }
    for (let i = 0; i < fireworks.length; i++) {
      const v = fireworks[i], f = a.fireworks[i];
      v.glow.visible = v.disc.visible = !!f && !f.spent; v.burst.visible = !!f && f.spent && time < f.impact + 0.33;
      if (!f) continue;
      const t = sat((time - f.created) / (f.impact - f.created));
      v.glow.position.set(c.x + (f.x - c.x) * t, 2.6 * (1 - t) + 5.2 * Math.sin(Math.PI * t), CLOWN.z + (f.z - CLOWN.z) * t);
      v.disc.position.set(f.x, 0.14, f.z); v.disc.scale.setScalar(0.7 + t * 0.3); v.disc.material.opacity = 0.35 + t * 0.5;
      const age = sat((time - f.impact) / 0.34);
      v.burst.position.set(f.x, 0.6, f.z); v.burst.scale.setScalar(0.35 + age * 1.3); v.burst.material.opacity = (1 - age) * 0.6;
    }
  }
  return { update, get lit() { return lightUp; } };
}
