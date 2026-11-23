// 布偶游乐园的样子。规则在 park-rides.js：这里只读它的状态来摆（木马转到哪、车在轨道的哪一点、门开了多少），
// 自己不决定任何事。准则在 docs/park-design.md 第 5 节（照概念图做、会动的部件单独成组）和第 5d 节（精细度和开销）。
// 通用零件（针脚、扇贝边、树、栏杆、灯柱、木马……）在 park-kit.js。
import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { plush, plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { mulberry32 } from '../../cine-engine/engine/noise.js';
import { uiCanvasFont } from './interface-font.js';
import { copy } from './language.js';
import { TOUR_PATH, TOUR_STOPS, TOUR_BOUNDS, TOUR_TENT, TOUR_MAZE, TOUR_BRIDGE, TOUR_CHANNEL, isTourWalkable,
  COASTER, RAPIDS, RAPIDS_DOCK, WHEEL, CAROUSEL, RINK, HAUNT, STALLS, STAGE, GATE } from './park-tour-layout.js';
import { PARK, SPOTS } from './park-rides.js';
import { stallTarget } from './park-stalls.js';
import { createParkKit, RED, CREAM, TEAL, GOLD, INK, CORAL, NAVY, FOREST, MOSS, PINE, PLUM, PLUM_DARK, THREAD, WOOL_WHITE, TIMBER } from './park-kit.js';

const TAU = 2 * Math.PI;
const DETAIL_RANGE = 26;   // 小装饰（针脚、花、穗子）离人多远就不画了：再远它们不到一个像素
const CELL = 20;           // 路边的小装饰按这么大的格子分块（走远了整格关掉）；树、石头、灯柱这些主体按六大块分（背后的整块不画）

export function createParkTour(cine, world, { reduced = false } = {}) {
  const root = new T.Group(); root.name = 'Stitched amusement park'; world.root.add(root);
  const M = plushMaterials(world.lib, { lit: m => world.volume.light(m) });
  const P = createParkKit(M), { felt, wool, leaf, knit } = P;
  const quilt = c => M('quilt', c), wood = M('toy_wood');
  const cream = felt(CREAM), red = felt(RED), teal = felt(TEAL), gold = felt(GOLD), ink = felt(INK), coral = felt(CORAL), white = felt(0xf6f1e4);
  const raw = (id, color) => world.volume.light(plush(world.lib, id, color));
  const glow = (color, power = 2) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: power, roughness: 0.6 });
  const rand = mulberry32(231123);
  // 倒圆角的方块。细的（最短边不到 0.35 米）圆角只切一刀：108 个三角形，不是 300 个
  const box = (kit, m, w, h, dp, x, y, z, r = 0.045, o = {}) => kit.soft(m, w, h, dp, x, y, z, { r, seg: Math.min(w, h, dp) < 0.35 ? 1 : 2, ...o });
  const puff = (kit, m, r, x, y, z, o = {}) => kit.sphere(m, r, x, y, z, { seg: 10, rings: 7, ...o });
  const finish = (kit, parent = root, cast = true) => { parent.add(...kit.build({ cast })); return parent; };
  const group = (parent = root, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const obj = (parent, geo, mat, x = 0, y = 0, z = 0) => { const mesh = new T.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  // ---------- 分块 ----------
  // 不动的布景按"哪个设施"或"哪一格地面"分块，每块两层：s 主体，d 小装饰。背后的块不画，远处的小装饰不画。
  const zones = new Map(), details = [];
  const zone = id => { let q = zones.get(id); if (!q) zones.set(id, q = { s: new PlushKit(), d: new PlushKit() }); return q; };
  const cells = new Map();
  const ground = (x, z) => {
    const big = 'G' + Math.min(2, Math.floor((x - TOUR_BOUNDS.minX) / 27.4)) + (z < 0 ? 'n' : 's'), small = 'g' + Math.floor(x / CELL) + ',' + Math.floor(z / CELL), key = big + small;
    let c = cells.get(key); if (!c) cells.set(key, c = { s: zone(big).s, d: zone(small).d }); return c;
  };
  let k, d; const use = id => { ({ s: k, d } = zone(id)); }; use('common');
  // 一个会动的部件：单独一组网格。build(kit, det) 在原点附近造它；anchor = [x, z, 半径] 给了，det 那层走远就不画
  const part = (parent, build, x = 0, y = 0, z = 0, cast = false, anchor = null) => {
    const kit = new PlushKit(), det = new PlushKit(); build(kit, det);
    const g = group(parent, x, y, z); finish(kit, g, cast);
    const extra = det.build({ cast: false, name: 'detail' });
    if (extra.length) { g.add(...extra); if (anchor) details.push({ meshes: extra, x: anchor[0], z: anchor[1], r: anchor[2] }); }
    return g;
  };
  const stopOf = id => TOUR_STOPS.find(q => q.id === id);

  // ---------- 招牌 ----------
  function sign(text, x, y, z, w, yaw = 0, parent = root) {
    const canvas = document.createElement('canvas'); canvas.width = 816; canvas.height = 216;
    const ctx = canvas.getContext('2d'); ctx.scale(1.5, 1.5); ctx.fillStyle = '#f5dfac'; ctx.beginPath(); ctx.roundRect(4, 4, 536, 136, 28); ctx.fill();
    ctx.strokeStyle = '#99704d'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.strokeRect(19, 16, 506, 111);
    ctx.fillStyle = '#2e4c3e'; ctx.font = uiCanvasFont(56);
    const width = ctx.measureText(text).width;
    if (width > 478) ctx.font = uiCanvasFont(Math.floor(56 * 478 / width));
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, 272, 74);
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
    const panel = obj(parent, new T.PlaneGeometry(w, w * 144 / 544), new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide }), x, y, z);
    panel.rotation.y = yaw; return panel;
  }
  // 出图 agent 画的图（docs/park-asset-handoff.md 第二节）：一块朝 yaw 方向的平板
  const loader = new T.TextureLoader();
  function picture(file, w, h, x, y, z, yaw = 0, { cutout = false, lit = true } = {}) {
    const map = loader.load(file); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
    const mat = lit ? world.volume.light(new T.MeshStandardMaterial({ map, roughness: 0.9, transparent: cutout, alphaTest: cutout ? 0.35 : 0 })) : new T.MeshBasicMaterial({ map, transparent: cutout, alphaTest: cutout ? 0.35 : 0 });
    const panel = obj(root, new T.PlaneGeometry(w, h), mat, x, y, z); panel.rotation.y = yaw; panel.castShadow = false; return panel;
  }
  // 站名牌：两根木桩（桩顶一颗球）夹一块布牌
  for (const stop of TOUR_STOPS) {
    const [x, z, yaw] = stop.sign, g = ground(x, z).s;
    for (const side of [-1, 1]) { const px = x + Math.cos(yaw) * side * 1.1, pz = z - Math.sin(yaw) * side * 1.1; P.post(g, px, pz, { h: 2.02, r: 0.07, cap: GOLD }); g.cyl(wool(RED), 0.13, 0.16, 0.16, px, 0.08, pz, { seg: 9 }); }
    sign(copy(stop.name, stop.en), x, 1.72, z, 2.93, yaw);
  }

  // ---------- 小径：一条毛毡带子，两边各一道鼓起来的滚边，中间一行深绿的虚线（概念图）。能走的范围用的是同一份坐标 ----------
  const beside = (i, offset) => {   // 小径第 i 个点旁边、离中线 offset 倍路宽的地方
    const p = TOUR_PATH[i], a = TOUR_PATH[Math.max(0, i - 1)], b = TOUR_PATH[Math.min(TOUR_PATH.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    return [p.x - dz / len * p.width * offset, p.z + dx / len * p.width * offset];
  };
  {
    const N = TOUR_PATH.length, PATH = 0xe6cf9f, EDGE = 0xf5e6c2, MAZE = 0xb8c9b9;
    const inMaze = p => p.x > 6 && p.x < 20 && p.z > 13 && p.z < 22;
    const edge = (i, side, grow = 0) => { const p = TOUR_PATH[i], [x, z] = beside(i, side); const f = (p.width + grow) / p.width; return [p.x + (x - p.x) * f, p.z + (z - p.z) * f]; };
    const turn = i => { if (i < 1 || i > N - 2) return 0; const a = TOUR_PATH[i - 1], b = TOUR_PATH[i], c = TOUR_PATH[i + 1]; const t = Math.abs(Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x)); return Math.min(t, TAU - t); };
    for (let i = 1; i < N; i++) {
      const a = TOUR_PATH[i - 1], b = TOUR_PATH[i], g = ground((a.x + b.x) / 2, (a.z + b.z) / 2), top = wool(inMaze(a) && inMaze(b) ? MAZE : PATH);
      const l0 = edge(i - 1, 1), l1 = edge(i, 1), r0 = edge(i - 1, -1), r1 = edge(i, -1);
      g.s.quad(top, [l0[0], 0.034, l0[1]], [r0[0], 0.034, r0[1]], [r1[0], 0.034, r1[1]], [l1[0], 0.034, l1[1]], [l0, r0, r1, l1], 1, [0, 1, 0]);
      if (turn(i) > 0.3) g.s.cyl(top, b.width, b.width, 0.01, b.x, 0.029, b.z, { seg: 20 });   // 急弯处补一块圆的
    }
    // 滚边和中线：按地面的格子一段段地造，这样背后的不画
    const runs = (pointAt, flush) => { let cell = null, pts = []; for (let i = 0; i < N; i++) { const p = pointAt(i), c = ground(p[0], p[2]); if (cell && c !== cell) { pts.push(p); flush(cell, pts); pts = []; } cell = c; pts.push(p); } if (pts.length > 1) flush(cell, pts); };
    for (const side of [-1, 1]) runs(i => { const [x, z] = edge(i, side, -0.02); return [x, 0.045, z]; }, (c, pts) => c.s.tube(wool(EDGE), pts, 0.055, { seg: 5, straight: true }));
    runs(i => [TOUR_PATH[i].x, 0.04, TOUR_PATH[i].z], (c, pts) => { const mat = felt(0x4d6a4a); for (let i = 1; i < pts.length; i += 2) { const a = pts[i - 1], b = pts[i], f = 0.62; c.d.box(mat, Math.hypot(b[0] - a[0], b[2] - a[2]) * f, 0.012, 0.06, (a[0] + b[0]) / 2, 0.04, (a[2] + b[2]) / 2, { ry: Math.atan2(-(b[2] - a[2]), b[0] - a[0]) }); } });
  }

  // ---------- 树、石头、灌木、花坛 ----------
  // 设施占的地方不种东西：轨道、摩天轮、碰碰车场、木马、鬼屋、摊位
  const taken = (x, z, pad = 0) => isTourWalkable(x, z, 0.5 + pad)
    || COASTER.points.some(p => Math.hypot(p[0] - x, p[2] - z) < 2.2 + pad) || RAPIDS.points.some(p => Math.hypot(p[0] - x, p[2] - z) < 1.8 + pad)
    || Math.hypot(x - WHEEL.x, z - WHEEL.z) < 6.5 + pad || ((x - RINK.x) / (RINK.rx + 1.2 + pad)) ** 2 + ((z - RINK.z) / (RINK.rz + 1.2 + pad)) ** 2 < 1
    || Math.hypot(x - CAROUSEL.x, z - CAROUSEL.z) < 5.2 + pad || (Math.abs(x + 6.5) < 5.6 + pad && Math.abs(z + 15.7) < 5 + pad)
    || (x > 27.5 - pad && x < 33 + pad && z > -15.5 - pad && z < -1.2 + pad) || Math.hypot(x, z) < 10.2 + pad || (x > 5 - pad && x < 21 + pad && z > 12 - pad && z < 23 + pad)
    || (x < -20.5 + pad && x > -37 - pad && z > -3.6 - pad && z < 9 + pad);
  let seed = 7000;
  const stone = (x, y, z, r) => P.rock(ground(x, z).s, x, z, r, seed++);   // 后面几个设施还在用这个名字
  for (let i = 8; i < TOUR_PATH.length - 5; i += 4) for (const side of [-1, 1]) {
    const [x, z] = beside(i, side * 1.22), g = ground(x, z);
    if (taken(x, z, -0.3)) continue;
    const roll = rand();
    if (roll < 0.26) P.rock(g.s, x, z, 0.4 + rand() * 0.22, seed++); else if (roll < 0.66) P.shrub(g.s, g.d, x, z, 0.5 + rand() * 0.4, seed++); else P.flowerPatch(g.d, x, z, 5, 0.8, seed++);
    for (let j = 0; j < 3; j++) { const [tx, tz] = beside(i + j, side * (1.06 + rand() * 0.1)); if (!isTourWalkable(tx, tz, 0.05)) P.tuft(g.d, tx, tz, seed++, 1 + rand() * 0.5); }
  }
  const trees = [
    [-11, 23, 1.1], [-7, 25, 1.35], [-22, 27.2, 0.98], [-29, 26, 1.12], [-34, 23, 1.15], [-27, 10, 0.92], [-21, 11.9, 1.27], [-17.2, 15, 1.05], [-13.5, 18.0, 1.3],
    [-19.6, 1.0, 1.06], [-11.7, -1.5, 1.1], [-37.9, -12.6, 1.08], [-34.2, -22.3, 1.22], [-28.2, -26.8, 1.33], [-21.0, -27, 1.18],
    [-13.6, -26.8, 1.0], [-1.7, -27.9, 1.03], [5.6, -29.7, 1.42], [12.1, -30.4, 1.19], [26.5, -28.5, 1.32], [34.8, -26.4, 1.27], [38.0, -23.6, 1.12],
    [5.4, -17.8, 1.3], [9.3, -16, 1.1], [12.0, -12.6, 1.21], [26.2, -16.4, 1.14], [24.5, -11.4, 1.24], [25.2, -1.6, 1.05], [19.4, -4.6, 1.29], [19.7, 1, 1.12], [17.3, 6.9, 1.1],
    [12.3, 7.4, 1.19], [-11.4, 12.4, 1.16], [-12.7, 8.3, 1.08], [-5.9, 21.6, 1.1], [14.2, 27.8, 1.35], [20.3, 26.1, 1.02], [28.2, 23.25, 1.24], [33.7, 21.2, 1.2], [37.5, 17, 1.2],
    [-39, 27, 1.3], [-39.2, 2, 1.25], [-38.6, -27, 1.2], [39, -29, 1.3], [39.3, -3, 1.2], [39, 26, 1.25], [0, 30.5, 1.2], [-25, 30.6, 1.1], [25, 30.2, 1.15],
  ];
  trees.forEach(([x, z, r], i) => {   // 概念图：阔叶树里夹着深色的松树；园子边上的少做一层叶子
    if (taken(x, z)) return;
    const g = ground(x, z).s, far = Math.abs(x) > 36 || Math.abs(z) > 28.4;
    if (i % 4 === 1) P.pine(g, x, z, r * 0.92, 500 + i); else P.leafTree(g, x, z, r, 500 + i, { tone: i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0, rich: !far });
  });
  {   // 园子四周一圈树（概念图：边上是密林），把园外的远景挡在后面
    const B = TOUR_BOUNDS, inset = 1.3, ring = [];
    for (let x = B.minX + inset; x <= B.maxX - inset; x += 6.4) ring.push([x, B.minZ + inset], [x + 3.2, B.maxZ - inset]);
    for (let z = B.minZ + inset + 5; z <= B.maxZ - inset - 4; z += 6.4) ring.push([B.minX + inset, z], [B.maxX - inset, z + 3.2]);
    ring.forEach(([bx, bz], i) => {
      const x = Math.max(B.minX + 1, Math.min(B.maxX - 1, bx + (rand() - 0.5) * 1.6)), z = Math.max(B.minZ + 1, Math.min(B.maxZ - 1, bz + (rand() - 0.5) * 1.2));
      if (taken(x, z, 0.4) || trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 3.2)) return;
      if (i % 3 === 0) P.pine(ground(x, z).s, x, z, 1.1 + rand() * 0.3, 900 + i); else P.leafTree(ground(x, z).s, x, z, 1.15 + rand() * 0.3, 900 + i, { tone: i % 5 === 0 ? 1 : 0, rich: false });
    });
  }
  for (const [x, z] of [[-12.4, -12.2], [4.6, -13.2], [11.6, -6.2], [-12.6, 4.6], [13.4, 1.6], [-13.6, -4.4]]) {   // 中间的果园：结着红果子的树
    if (taken(x, z)) continue;
    const g = ground(x, z);
    P.leafTree(g.s, x, z, 1.04, seed++, { tone: 1 });
    for (let j = 0; j < 9; j++) { const a = j * TAU / 9 + rand(); g.d.sphere(felt(0xba4f45), 0.13, x + Math.sin(a) * (1.25 + rand() * 0.3), 2.3 + rand() * 1.1, z + Math.cos(a) * (1.25 + rand() * 0.3), { seg: 7, rings: 5 }); }
  }
  // 南边的三座圆花坛（概念图上入口和帐篷之间）：一圈短木桩围着，里面是叶子和大朵的花
  for (const [x, z, r] of [[-6.2, 14.2, 1.7], [-1.2, 19.6, 1.9], [4.6, 25.6, 1.6]]) {
    const g = ground(x, z), n = Math.round(TAU * r / 0.25);
    for (let j = 0; j < n; j++) { const a = j * TAU / n; g.s.cyl(P.timber(j % 3 ? 0xa97a4c : 0x94683f), 0.11, 0.12, 0.3 + (j % 2) * 0.05, x + Math.sin(a) * r, 0.16, z + Math.cos(a) * r, { seg: 7 }); }
    g.s.cyl(M('terry', 0x5f7a45), r - 0.08, r - 0.08, 0.26, x, 0.13, z, { seg: 24 });
    for (let j = 0; j < 7; j++) { const a = j * TAU / 7 + rand(), q = r * (0.25 + rand() * 0.45); g.s.sphere(leaf(j % 2 ? 0x6b9648 : 0x4f7f45), 0.34 + rand() * 0.16, x + Math.sin(a) * q, 0.3, z + Math.cos(a) * q, { seg: 8, rings: 5, sy: 0.6 }); }
    for (let j = 0; j < 6; j++) { const a = j * TAU / 6 + rand(), q = r * (0.3 + rand() * 0.45); P.flowerPatch(g.d, x + Math.sin(a) * q, z + Math.cos(a) * q, 4, 0.7, seed++, 0.38); }
  }

  // ---------- 灯柱和彩旗：沿路两边交替立，相邻两根之间拉一串小旗 ----------
  const posts = [];
  for (let i = 14; i < TOUR_PATH.length - 26; i += 13) {
    const [x, z] = beside(i, (posts.length % 2 ? 1 : -1) * 1.16);
    if (taken(x, z, -0.42) || Math.hypot(x, z) < 12) continue;
    const g = ground(x, z); P.lamp(g.s, g.d, x, z);
    posts.push([x, z]);
  }
  for (let i = 1; i < posts.length; i++) {
    const [ax, az] = posts[i - 1], [bx, bz] = posts[i], span = Math.hypot(bx - ax, bz - az), g = ground((ax + bx) / 2, (az + bz) / 2);
    if (span > 14) continue;
    const sag = t => 2.44 - Math.sin(t * Math.PI) * 0.5, line = Array.from({ length: 9 }, (_, j) => { const t = j / 8; return [ax + (bx - ax) * t, sag(t), az + (bz - az) * t]; });
    g.d.tube(ink, line, 0.012, { straight: true });
    for (let j = 1; j < 8; j++) { const t = j / 8, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = sag(t), nx = (bx - ax) / span * 0.13, nz = (bz - az) / span * 0.13, m = felt([RED, GOLD, TEAL, CREAM][j % 4]);
      g.d.quad(m, [x - nx, y, z - nz], [x + nx, y, z + nz], [x, y - 0.3, z], [x, y - 0.3, z], [[0, 1], [1, 1], [0.5, 0], [0.5, 0]], 1, [0, 0, 1]);
      g.d.quad(m, [x + nx, y, z + nz], [x - nx, y, z - nz], [x, y - 0.3, z], [x, y - 0.3, z], [[0, 1], [1, 1], [0.5, 0], [0.5, 0]], 1, [0, 0, -1]); }
  }
  // 长椅：几处歇脚的地方，面朝小径
  for (const i of [46, 96, 150, 212, 262]) {
    const [x, z] = beside(i, 1.2), p = TOUR_PATH[i], g = ground(x, z); if (taken(x, z, -0.42) || Math.hypot(x - CAROUSEL.x, z - CAROUSEL.z) < 7) continue;
    P.bench(g.s, g.d, x, z, Math.atan2(p.x - x, p.z - z));
  }

  // ---------- 条纹伞顶（帐篷、摊位在用的老版本）。inside：从底下也看得见 ----------
  function stripedRoof(kit, x, z, r, rim, peak, colors, sectors = 24, inside = false) {
    const profile = [[r, rim], [r * 0.83, rim + (peak - rim) * 0.28], [r * 0.50, rim + (peak - rim) * 0.64], [r * 0.19, rim + (peak - rim) * 0.87], [0.035, peak]];
    for (let i = 0; i < sectors; i++) {
      const a = i * TAU / sectors, b = (i + 1) * TAU / sectors, p = (theta, radius, y) => [x + Math.sin(theta) * radius, y, z + Math.cos(theta) * radius], uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (let j = 1; j < profile.length; j++) {
        const [r0, y0] = profile[j - 1], [r1, y1] = profile[j];
        kit.quad(colors[i % colors.length], p(a, r0, y0), p(b, r0, y0), p(b, r1, y1), p(a, r1, y1), uv, 1, [0, 1, 0]);
        if (inside) kit.quad(colors[i % colors.length], p(b, r0, y0 - 0.023), p(a, r0, y0 - 0.023), p(a, r1, y1 - 0.023), p(b, r1, y1 - 0.023), uv, 0.47, [0, -1, 0]);
      }
      // 伞沿垂下来的一圈扇贝边：每一瓣都是一片薄薄的小圆片，宽的伞面一格里排几片
      const wide = r * TAU / sectors, n = Math.max(1, Math.round(wide / 0.5)), size = Math.min(0.26, wide / n * 0.5);
      for (let j = 0; j < n; j++) { const t = a + (b - a) * (j + 0.5) / n; puff(kit, colors[(i + (j % 2 ? 0 : 1)) % colors.length], size, x + Math.sin(t) * r, rim - size * 0.35, z + Math.cos(t) * r, { sz: 0.3, sy: 1.1, ry: t, seg: 8, rings: 5 }); }
    }
  }
  // 伞顶（细的版本，准则 5d）：sectors 片毛毡，每片横着再分 3 格所以伞沿是圆的；每道缝一行针脚、每片中间一行；从底下也看得见。
  // 造在原点，伞沿高 rim、尖顶高 peak。seam：缝上那行针脚的针长、针距、线粗（大帐子用大针脚）；mid = false 不要每片中间那一行
  function canopy(kit, det, r, rim, peak, colors, sectors, { seam = { len: 0.13, gap: 0.1, t: 0.022 }, mid = true } = {}) {
    const prof = [[1, 0], [0.8, 0.2], [0.55, 0.46], [0.28, 0.76], [0.045, 1]].map(([f, h]) => [r * f, rim + (peak - rim) * h]), sub = 3;
    const at = (a, [q, y], lift = 0) => [Math.sin(a) * q, y + lift, Math.cos(a) * q], along = prof.map((p, j) => (j ? Math.hypot(p[0] - prof[0][0], p[1] - prof[0][1]) : 0));
    for (let i = 0; i < sectors; i++) {
      const m = colors[i % colors.length];
      for (let q = 0; q < sub; q++) {
        const a = (i + q / sub) * TAU / sectors, b = (i + (q + 1) / sub) * TAU / sectors;
        for (let j = 1; j < prof.length; j++) {
          const uv = [[a * prof[j - 1][0], along[j - 1]], [b * prof[j - 1][0], along[j - 1]], [b * prof[j][0], along[j]], [a * prof[j][0], along[j]]];
          kit.quad(m, at(a, prof[j - 1]), at(b, prof[j - 1]), at(b, prof[j]), at(a, prof[j]), uv, 1, [0, 1, 0]);
          kit.quad(m, at(b, prof[j - 1], -0.025), at(a, prof[j - 1], -0.025), at(a, prof[j], -0.025), at(b, prof[j], -0.025), uv, 0.47, [0, -1, 0]);
        }
      }
      P.stitch(det, prof.slice(0, 4).map(p => at(i * TAU / sectors, p, 0.02)), seam);
      if (mid) P.stitch(det, prof.slice(0, 4).map(p => at((i + 0.5) * TAU / sectors, [p[0] * 0.995, p[1]], 0.02)), { color: i % 2 ? 0xf8e7b4 : 0xbfe0dc, len: 0.09, gap: 0.14, t: 0.016 });
    }
  }
  const awning = (kit, x, z, y, w, dp, accent, tilt = 0) => { for (let i = 0; i < 7; i++) box(kit, i % 2 ? cream : accent, w / 7 + 0.014, 0.1, dp, x + w * ((i + 0.5) / 7 - 0.5), y, z, 0.03, { rx: tilt }); };
  const star = (kit, m, r, x, y, z) => { puff(kit, m, r * 0.62, x, y, z, { sz: 0.45 }); for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + Math.PI / 2; puff(kit, m, r * 0.36, x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66, z, { sz: 0.4, seg: 8, rings: 5 }); } };

  // ---------- 互动点的标记：路边一根小柱子顶着一颗星 ----------
  const markers = new Map(), starOn = glow(0xffd66b, 1.8);
  for (const q of SPOTS) {
    const stop = stopOf(q.stop); let dx = stop.x - q.x, dz = stop.z - q.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    let x = q.x, z = q.z; for (let n = 0; n < 40 && isTourWalkable(x, z, 0.3); n++) { x += dx * 0.15; z += dz * 0.15; }
    if (q.id === 'carousel') { x = CAROUSEL.x + Math.sin(CAROUSEL.steps) * 5.45 - Math.cos(CAROUSEL.steps) * 1.5; z = CAROUSEL.z + Math.cos(CAROUSEL.steps) * 5.45 + Math.sin(CAROUSEL.steps) * 1.5; }   // 台阶旁边
    if (q.id === 'coaster') { x = -31.0; z = -14.3; }   // 站台台阶的旁边，不挡台阶
    if (q.id === 'circus') { x = 1.9; z = -1.9; }
    if (q.kind === 'stall') { x = q.x - 1.4; z = q.z + 1.28; }
    if (q.id === 'haunt') { x = HAUNT.door.x + 1.4; z = HAUNT.door.z - 0.45; }   // 门廊柱子旁边，不挡门
    if (q.id === 'portraits') { x = HAUNT.bell.x + 0.78; z = -13.08; }   // 门厅里：立在小桌旁边、靠着后墙
    const g = ground(x, z).s;
    g.cyl(felt(WOOL_WHITE), 0.06, 0.07, 1.05, x, 0.525, z, { seg: 8 }); g.cyl(wool(RED), 0.1, 0.12, 0.14, x, 0.07, z, { seg: 8 }); g.cyl(wool(RED), 0.085, 0.085, 0.06, x, 1.04, z, { seg: 8 });
    const s = obj(root, new T.OctahedronGeometry(0.17, 0), starOn, x, 1.32, z); s.castShadow = false; s.scale.set(1, 1.25, 0.55);
    markers.set(q.id, { mesh: s, stop: q.stop, phase: x + z });
  }

  // ====================================================================== 01 入口（docs/park-refs/ref-01-entrance.png）
  use('entrance');
  {
    const ex = GATE.x, ez = GATE.z, plaza = [ex + 1.2, ez + 1.2];
    k.cyl(wool(0xd8c59c), 5.2, 5.2, 0.05, plaza[0], 0.02, plaza[1], { seg: 48 });   // 广场：一块圆的毛毡地垫，边上两圈针脚
    P.ring(d, plaza[0], 0.052, plaza[1], 5.0, { color: 0x9c7a55, len: 0.16, gap: 0.12, t: 0.024 }); P.ring(d, plaza[0], 0.052, plaza[1], 4.72, { color: 0xf8efd8, len: 0.1, gap: 0.14, t: 0.02 });
    for (const side of [-1, 1]) {   // 两座塔楼：红布墩（针脚勾出砖缝）、米白的塔身、一圈绒边、金色扇贝领、红尖顶、旗
      const x = ex + side * GATE.half;
      k.cyl(wool(RED), 0.74, 0.78, 0.8, x, 0.4, ez, { seg: 20 }); k.cyl(wool(0xa94f4b), 0.8, 0.8, 0.09, x, 0.82, ez, { seg: 20 });
      for (const y of [0.28, 0.55]) P.ring(d, x, y, ez, 0.775, { color: GOLD, len: 0.09, gap: 0.07 });
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12, q = 0.778; for (const [y0, y1, off] of [[0.03, 0.27, 0], [0.29, 0.54, TAU / 24], [0.56, 0.78, 0]]) { const b = a + off; P.stitch(d, [[x + Math.sin(b) * q, y0, ez + Math.cos(b) * q], [x + Math.sin(b) * q, y1, ez + Math.cos(b) * q]], { color: GOLD, len: 0.06, gap: 0.05, t: 0.016 }); } }
      k.cyl(wool(WOOL_WHITE), 0.62, 0.64, 2.5, x, 2.1, ez, { seg: 20 });
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8, q = 0.645; P.stitch(d, [[x + Math.sin(a) * q, 0.95, ez + Math.cos(a) * q], [x + Math.sin(a) * q, 3.1, ez + Math.cos(a) * q]], { color: 0xfffaf0, len: 0.1, gap: 0.12 }); }
      for (let i = 0; i < 14; i++) { const a = i * TAU / 14; k.sphere(wool(WOOL_WHITE), 0.2, x + Math.sin(a) * 0.6, 3.5, ez + Math.cos(a) * 0.6, { seg: 8, rings: 5, sy: 0.85 }); }   // 塔顶下的一圈绒边
      P.valance(k, wool(GOLD), x, 3.4, ez, 0.74, 10, 0.3, { band: 0.12, pipe: THREAD, pipeKit: d, pipeR: 0.02 });
      const roof = [[0.8, 0], [0.72, 0.3], [0.54, 0.66], [0.29, 0.98], [0.09, 1.16]];
      k.lathe(wool(RED), roof, x, 3.62, ez, { seg: 20 });
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P.stitch(d, roof.map(([q, y]) => [x + Math.sin(a) * (q + 0.012), 3.62 + y + 0.01, ez + Math.cos(a) * (q + 0.012)]), { color: GOLD, len: 0.08, gap: 0.07 }); }
      k.cyl(wool(GOLD), 0.11, 0.14, 0.12, x, 4.82, ez, { seg: 10 }); k.cyl(P.timber(0xa97a4c), 0.035, 0.04, 0.95, x, 5.32, ez, { seg: 6 }); k.sphere(wool(GOLD), 0.09, x, 5.84, ez, { seg: 8, rings: 6 });
      k.extrude(wool(GOLD), [[0, 0.17], [0.3, 0.13], [0.64, 0.18], [0.52, 0], [0.64, -0.18], [0.3, -0.13], [0, -0.17]], 0.035, new T.Matrix4().makeTranslation(x + 0.04, 5.52, ez));
      for (const face of [1, -1]) { box(k, ink, 0.2, 0.44, 0.06, x, 2.3, ez + face * 0.62, 0.05); box(k, wool(GOLD), 0.3, 0.07, 0.1, x, 2.04, ez + face * 0.63, 0.02); }   // 小窗和窗台
    }
    // 拱门：一整块厚毛毡，两头埋进塔楼；内沿一圈金色扇贝边，正反两面各一行针脚；顶上立一颗星
    const outer = (t, grow = 0) => [(1.62 + grow) * Math.cos(t), 2.5 + (2.45 + grow) * Math.sin(t)], inner = (t, grow = 0) => [(1.5 + grow) * Math.cos(t), 2.3 + (1.05 + grow) * Math.sin(t)], steps = 28;
    const outline = [[1.62, 2.3]]; for (let i = 0; i <= steps; i++) outline.push(outer(Math.PI * i / steps)); outline.push([-1.62, 2.3]); for (let i = steps; i >= 0; i--) outline.push(inner(Math.PI * i / steps));
    k.extrude(wool(RED), outline, 0.56, new T.Matrix4().makeTranslation(ex, 0, ez));
    for (const face of [1, -1]) {
      const zf = ez + face * 0.29;
      P.stitch(d, Array.from({ length: steps + 1 }, (_, i) => { const [x, y] = outer(Math.PI * i / steps, -0.14); return [ex + x, y, zf]; }), { len: 0.12, gap: 0.09, t: 0.022 });
      k.tube(wool(GOLD), Array.from({ length: 15 }, (_, i) => { const [x, y] = inner(Math.PI * (0.06 + 0.88 * i / 14), 0.02); return [ex + x, y, zf - face * 0.02]; }), 0.065, { seg: 6, detail: 2 });
      for (let i = 0; i < 9; i++) { const [x, y] = inner(Math.PI * (0.1 + 0.8 * (i + 0.5) / 9), 0.0); P.lobe(k, wool(GOLD), ex + x, y + 0.02, zf - face * 0.03, face > 0 ? 0 : Math.PI, 0.17, 0.02, 0.22, 0.05, 0.5); }
    }
    P.star(k, GOLD, 0.44, ex, 5.38, ez, 0, 0.16); k.cyl(wool(GOLD), 0.12, 0.2, 0.2, ex, 4.98, ez, { seg: 10 });
    P.star(k, GOLD, 0.5, ex, 4.02, ez - 0.3, 0, 0.1);   // 背面（出园时看到的那一面）也有一颗星
    sign(copy('布偶游乐园', 'PLUSHWOOD PARK'), ex, 4.0, ez + 0.3, 2.1);
    // 售票亭（参考图：挨着东塔，正面朝来的人）：木板墙、金框窗口、带托架的柜台、红白条纹雨棚，里面坐着一位布偶售票员
    {
      const s = new PlushKit(), det = new PlushKit(), board = P.timber(0xb98a66), dark = P.timber(0x9a6f4c);
      box(s, board, 2.1, 2.6, 1.7, 0, 1.3, 0, 0.05, { long: 1 });
      for (const sx of [-1, 1]) box(s, dark, 0.14, 2.64, 0.14, sx * 1.02, 1.32, 0.82, 0.03, { long: 1 });
      box(s, felt(0x4a3a33), 1.3, 0.78, 0.06, 0, 1.78, 0.84, 0.02);   // 窗洞里的暗处
      for (const [w, h, x, y] of [[1.5, 0.1, 0, 2.22], [1.5, 0.1, 0, 1.34], [0.1, 0.98, -0.7, 1.78], [0.1, 0.98, 0.7, 1.78]]) box(s, wool(GOLD), w, h, 0.1, x, y, 0.87, 0.03);   // 金框
      for (const y of [2.22, 1.34]) P.stitch(det, [[-0.66, y, 0.925], [0.66, y, 0.925]], { len: 0.06, gap: 0.05, t: 0.012 });
      box(s, P.timber(0xc9995f), 1.9, 0.09, 0.5, 0, 1.26, 1.08, 0.03, { long: 0 });   // 柜台
      for (const sx of [-0.62, 0.62]) s.extrude(dark, [[0, 0], [0.34, 0], [0, -0.34]], 0.08, new T.Matrix4().makeRotationY(-Math.PI / 2).setPosition(sx, 1.21, 0.86));   // 托架
      puff(s, felt(0xe7c49a), 0.26, 0.2, 1.72, 0.74, { sy: 1.05, seg: 12, rings: 8 }); puff(s, wool(RED), 0.27, 0.2, 1.92, 0.74, { sy: 0.5 }); s.sphere(wool(GOLD), 0.05, 0.2, 2.06, 0.74, { seg: 6, rings: 4 });   // 售票员：脑袋、红帽
      for (const e of [-1, 1]) { s.sphere(M.button(INK), 0.03, 0.2 + e * 0.1, 1.76, 0.985, { seg: 6, rings: 4 }); s.sphere(felt(0xe9a99a), 0.05, 0.2 + e * 0.17, 1.68, 0.96, { seg: 6, rings: 4, sz: 0.4 }); }
      for (let i = 0; i < 3; i++) s.cyl(wool(i ? WOOL_WHITE : GOLD), 0.1, 0.1, 0.07, -0.42, 1.34 + i * 0.075, 1.0, { seg: 9 });   // 柜台上的一摞游园卡
      s.cyl(P.timber(0xa97a4c), 0.06, 0.05, 0.12, -0.72, 1.37, 1.12, { seg: 8 });   // 笔筒里插两面小旗
      for (const [dx, c] of [[-0.03, TEAL], [0.04, RED]]) { s.cyl(P.timber(0xc9995f), 0.008, 0.008, 0.3, -0.72 + dx, 1.56, 1.12, { seg: 4, rz: dx * 6 }); s.extrude(felt(c), [[0, 0.07], [0.14, 0], [0, -0.07]], 0.012, new T.Matrix4().makeTranslation(-0.72 + dx - dx * 1.6, 1.66, 1.12)); }
      // 雨棚：七条红白相间的布，往前斜下来，前沿一排扇贝
      const stripes = [wool(RED), wool(WOOL_WHITE)], aw = 2.5, tilt = 0.42, len = 1.05, top = 2.76, front = 0.72 + len * Math.cos(tilt), low = top - len * Math.sin(tilt);
      for (let i = 0; i < 7; i++) box(s, stripes[i % 2], aw / 7 + 0.012, 0.09, len + 0.04, aw * ((i + 0.5) / 7 - 0.5), top - len / 2 * Math.sin(tilt), 0.72 + len / 2 * Math.cos(tilt), 0.03, { rx: tilt });
      P.valanceLine(s, null, [-aw / 2, front], [aw / 2, front], low + 0.03, 7, 0.26, { band: 0.05, mats: stripes, thick: 0.05 });
      for (let i = 0; i <= 7; i++) { const x = aw * (i / 7 - 0.5); P.stitch(det, [[x, top + 0.055, 0.72], [x, low + 0.055, front]], { len: 0.07, gap: 0.06, t: 0.014 }); }
      box(s, wool(RED), 2.2, 0.14, 1.8, 0, 2.66, 0, 0.05);   // 亭子的顶
      k.merge(s, GATE.booth.x, 0, GATE.booth.z); d.merge(det, GATE.booth.x, 0, GATE.booth.z);
    }
    // 门两边的灌木和花
    for (const [x, z, r] of [[ex - 3.6, ez - 0.9, 0.7], [ex - 4.4, ez - 1.5, 0.55], [GATE.booth.x + 1.7, GATE.booth.z + 0.4, 0.6]]) P.shrub(k, d, x, z, r, seed++);
    P.flowerPatch(d, ex - 4.3, ez - 0.5, 5, 0.8, seed++); P.flowerPatch(d, GATE.booth.x + 1.6, GATE.booth.z + 1.2, 4, 0.6, seed++);
    {   // 气球车（参考图 ref-11）：红车斗、木头车架、大小两个轮子、青白相间的尖顶、三只气球
      const s = new PlushKit(), det = new PlushKit(), frame = P.timber(0xc9995f);
      box(s, wool(RED), 1.4, 0.5, 0.8, 0, 0.75, 0, 0.07); box(s, frame, 1.52, 0.08, 0.92, 0, 0.47, 0, 0.03, { long: 0 }); box(s, frame, 1.52, 0.07, 0.92, 0, 1.03, 0, 0.03, { long: 0 });
      for (const [a, b] of [[[-0.74, 0.47], [0.74, 0.47]], [[0.74, -0.47], [-0.74, -0.47]], [[0.77, 0.45], [0.77, -0.45]], [[-0.77, -0.45], [-0.77, 0.45]]]) P.valanceLine(s, wool(WOOL_WHITE), a, b, 1.0, a[0] === b[0] ? 4 : 6, 0.17, { band: 0.03 });
      for (const e of [-1, 1]) {
        s.cyl(P.timber(0xa97a4c), 0.36, 0.36, 0.07, -0.3, 0.36, e * 0.52, { seg: 18, rx: Math.PI / 2 }); s.sphere(wool(GOLD), 0.09, -0.3, 0.36, e * 0.57, { seg: 8, rings: 5, sz: 0.6 });
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P.stitch(det, [[-0.3 + Math.cos(a) * 0.1, 0.36 + Math.sin(a) * 0.1, e * 0.562], [-0.3 + Math.cos(a) * 0.32, 0.36 + Math.sin(a) * 0.32, e * 0.562]], { len: 0.05, gap: 0.035, t: 0.012 }); }
        s.cyl(P.timber(0xa97a4c), 0.13, 0.13, 0.06, 0.52, 0.13, e * 0.4, { seg: 10, rx: Math.PI / 2 }); box(s, frame, 0.06, 0.34, 0.06, 0.52, 0.3, e * 0.4, 0.02);
        box(s, frame, 0.6, 0.05, 0.05, 1.0, 0.98, e * 0.32, 0.02, { long: 0 });
        for (const sx of [-1, 1]) box(s, frame, 0.06, 1.04, 0.06, sx * 0.62, 1.56, e * 0.34, 0.02, { long: 1 });
      }
      box(s, frame, 0.05, 0.05, 0.7, 1.28, 0.98, 0, 0.02, { long: 2 });   // 推车的横把
      canopy(s, det, 1.05, 2.06, 2.62, [wool(TEAL), wool(WOOL_WHITE)], 8);
      P.valance(s, null, 0, 2.07, 0, 1.06, 8, 0.26, { band: 0.06, mats: [wool(RED), wool(WOOL_WHITE)] }); s.sphere(wool(GOLD), 0.09, 0, 2.7, 0, { seg: 8, rings: 6 });
      [[0.98, 2.55, 0.12, RED], [1.22, 2.98, -0.16, GOLD], [0.84, 3.14, -0.04, TEAL]].forEach(([x, y, z, c]) => {
        s.sphere(wool(c), 0.27, x, y, z, { seg: 12, rings: 8, sy: 1.16 }); s.cyl(wool(c), 0.02, 0.05, 0.06, x, y - 0.33, z, { seg: 6 });
        for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; P.stitch(det, Array.from({ length: 7 }, (_, j) => { const t = 0.35 + j * 0.4; return [x + Math.sin(t) * Math.sin(a) * 0.275, y + Math.cos(t) * 0.318, z + Math.sin(t) * Math.cos(a) * 0.275]; }), { len: 0.045, gap: 0.04, t: 0.012 }); }
        det.tube(ink, [[0.7, 1.1, 0.3], [(0.7 + x) / 2 + 0.05, (1.1 + y) / 2, (0.3 + z) / 2], [x, y - 0.36, z]], 0.007, { seg: 4, detail: 3 });
      });
      k.merge(s, -20.6, 0, 27.6, 0.99); d.merge(det, -20.6, 0, 27.6, 0.99);
      P.flowerPatch(d, -21.9, 28.7, 4, 0.6, seed++); P.shrub(k, d, -21.9, 26.7, 0.5, seed++);
    }
  }

  // ====================================================================== 02 旋转木马（docs/park-refs/ref-02-carousel.png）
  use('carousel');
  const carousel = group(root, CAROUSEL.x, 0, CAROUSEL.z); let horsesA, horsesB;
  {
    const c = CAROUSEL, R = c.platform, FLOOR = 0.56, sa = Math.sin(c.steps), ca = Math.cos(c.steps);
    // 底座（不转）：青色的鼓、一圈金边、红色的台面
    k.cyl(wool(TEAL), R, R + 0.05, 0.36, c.x, 0.18, c.z, { seg: 56 }); k.cyl(wool(GOLD), R + 0.07, R + 0.07, 0.15, c.x, 0.43, c.z, { seg: 56 }); k.cyl(wool(0xa94f4b), R - 0.08, R - 0.08, 0.07, c.x, 0.525, c.z, { seg: 56 });
    for (let i = 0; i < 18; i++) {   // 鼓面上一圈针脚拱，拱和拱之间一颗米白的布扣
      const a = i * TAU / 18, q = R + 0.045;
      P.stitch(d, Array.from({ length: 9 }, (_, j) => { const t = Math.PI * j / 8, b = a + Math.cos(t) * 0.5 / q; return [c.x + Math.sin(b) * q, 0.03 + Math.sin(t) * 0.25, c.z + Math.cos(b) * q]; }), { len: 0.07, gap: 0.055, t: 0.016 });
      const b = a + TAU / 36; d.sphere(felt(THREAD), 0.04, c.x + Math.sin(b) * q, 0.27, c.z + Math.cos(b) * q, { seg: 6, rings: 4 });
    }
    for (let i = 0; i < 36; i++) { const a = i * TAU / 36; d.sphere(felt(THREAD), 0.036, c.x + Math.sin(a) * (R + 0.075), 0.43, c.z + Math.cos(a) * (R + 0.075), { seg: 6, rings: 4 }); }
    P.ring(d, c.x, 0.565, c.z, R - 0.3, { len: 0.12, gap: 0.1, t: 0.02 }); P.ring(d, c.x, 0.565, c.z, 1.15, { color: GOLD, len: 0.1, gap: 0.08, t: 0.02 });
    // 台阶：朝着摇铃的地方，两级米白的毛毡，前沿各一行红针脚
    for (const [w, h, dp, out] of [[2.5, 0.2, 0.95, 0.47], [2.1, 0.4, 0.5, 0.24]]) {
      const q = R + out; k.soft(knit(0xeadfc4), w, h, dp, c.x + sa * q, h / 2, c.z + ca * q, { r: 0.05, ry: c.steps });
      const f = q + dp / 2 - 0.07, tx = ca, tz = -sa; P.stitch(d, [[c.x + sa * f - tx * (w / 2 - 0.1), h + 0.006, c.z + ca * f - tz * (w / 2 - 0.1)], [c.x + sa * f + tx * (w / 2 - 0.1), h + 0.006, c.z + ca * f + tz * (w / 2 - 0.1)]], { color: RED, len: 0.09, gap: 0.07, t: 0.02 });
    }
    // 一圈木桩栏杆（桩顶一颗绒球，两道绳），让开小径和台阶
    const fenceR = R + 0.75, ring = [];
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + TAU / 36, x = c.x + Math.sin(a) * fenceR, z = c.z + Math.cos(a) * fenceR, da = Math.abs(((a - c.steps + Math.PI * 3) % TAU) - Math.PI); ring.push(isTourWalkable(x, z, 0.35) || da < 0.4 ? null : [x, z]); }
    ring.forEach((p, i) => { if (!p) return; P.post(k, p[0], p[1], { h: 0.92 }); const q = ring[(i + 1) % ring.length]; if (q) for (const y of [0.4, 0.76]) P.rope(k, [p[0], y, p[1]], [q[0], y, q[1]]); });
    for (let i = 0; i < 18; i++) {   // 栏杆脚下：石头、灌木、花
      const a = i * TAU / 18 + 0.1, q = fenceR + 0.5 + rand() * 0.5, x = c.x + Math.sin(a) * q, z = c.z + Math.cos(a) * q;
      if (isTourWalkable(x, z, 0.6)) continue;
      const roll = i % 3; if (roll === 0) P.rock(k, x, z, 0.3 + rand() * 0.14, seed++); else if (roll === 1) P.shrub(k, d, x, z, 0.42 + rand() * 0.2, seed++); else P.flowerPatch(d, x, z, 4, 0.6, seed++);
    }
    // 转的部分：红色的中柱、伞顶、伞沿的扇贝边、花饰和穗子
    const anchor = [c.x, c.z, 4.5], RIM = 3.95, PEAK = 5.55, CR = 3.95, SECT = 16;
    part(carousel, (kit, det) => {
      kit.cyl(wool(0xa94f4b), 0.55, 0.58, 3.9, 0, FLOOR + 1.95, 0, { seg: 20 });
      for (const y of [FLOOR + 0.1, 3.6, 4.3]) kit.cyl(wool(GOLD), 0.64, 0.64, 0.14, 0, y, 0, { seg: 20 });
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10; P.stitch(det, [[Math.sin(a) * 0.575, FLOOR + 0.3, Math.cos(a) * 0.575], [Math.sin(a) * 0.56, 3.45, Math.cos(a) * 0.56]], { len: 0.1, gap: 0.09 }); }
      canopy(kit, det, CR, RIM, PEAK, [wool(TEAL), wool(GOLD)], SECT);
      kit.tube(wool(WOOL_WHITE), P.arc(0, RIM + 0.02, 0, CR + 0.02, 0, TAU, 48), 0.075, { seg: 6, straight: true, caps: false });   // 伞沿的一道绒边
      const cusps = P.valance(kit, wool(GOLD), 0, RIM - 0.02, 0, CR + 0.03, SECT, 0.66, { band: 0.3, pipe: WOOL_WHITE, pipeKit: det, pipeR: 0.032 });
      for (const q of cusps) { P.rosette(kit, RED, q.x * 1.012, RIM - 0.2, q.z * 1.012, q.a, 0.17); P.tassel(kit, GOLD, q.x * 1.005, q.y - 0.02, q.z * 1.005, 1.25); }
      P.ring(det, 0, RIM - 0.11, 0, CR + 0.06, { len: 0.11, gap: 0.09, t: 0.02 });
      kit.cyl(wool(0xa94f4b), 0.36, 0.44, 0.22, 0, PEAK + 0.02, 0, { seg: 16 }); kit.sphere(wool(GOLD), 0.3, 0, PEAK + 0.38, 0, { seg: 14, rings: 9 });   // 顶上：红圈、金球
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; kit.tube(P.timber(TIMBER), [[Math.sin(a) * 0.6, 4.25, Math.cos(a) * 0.6], [Math.sin(a) * (CR - 0.1), RIM + 0.02, Math.cos(a) * (CR - 0.1)]], 0.035, { seg: 5, straight: true }); }   // 伞骨
      for (let i = 0; i < SECT; i++) { const a = (i + 0.5) * TAU / SECT; kit.sphere(M.glow(0xffe6a8, 2.2), 0.07, Math.sin(a) * (CR - 0.28), RIM - 0.06, Math.cos(a) * (CR - 0.28), { seg: 7, rings: 5 }); }   // 伞沿里面一圈小灯
    }, 0, 0, 0, true, anchor);
    // 木马：六匹，鞍垫三种颜色，立杆是木头的，跟着马一起上下
    const tack = [[TEAL, GOLD], [RED, TEAL], [GOLD, RED]];
    const mount = (kit, det, i) => {
      const a = i * TAU / c.horses, x = Math.sin(a) * c.r, z = Math.cos(a) * c.r, h = P.horse(...tack[i % 3]);
      kit.merge(h.s, x, 0, z, a); det.merge(h.d, x, 0, z, a);
      kit.cyl(P.timber(0xc9995f), 0.034, 0.034, 4.3, x, 2.45, z, { seg: 7 }); kit.sphere(wool(GOLD), 0.055, x, 1.62, z, { seg: 7, rings: 5 });
    };
    horsesA = part(carousel, (kit, det) => { for (let i = 0; i < c.horses; i += 2) mount(kit, det, i); }, 0, 0, 0, true, anchor);
    horsesB = part(carousel, (kit, det) => { for (let i = 1; i < c.horses; i += 2) mount(kit, det, i); }, 0, 0, 0, true, anchor);
  }

  // ====================================================================== 03 激流勇进（docs/park-refs/ref-03-rapids.png）
  use('rapids');
  const boats = [];
  {
    const w = TOUR_CHANNEL, b = TOUR_BRIDGE, WATER = 0x4fa8b0, DEEP = 0x2f7f8c, RIM = 0x3d93a0, FOAM = 0xf2f7f4, RIPPLE = 0xdff1ee;
    // 桥下的水池：深浅两层毛毡，水面上几行针脚当波纹
    box(k, wool(DEEP), w.w, 0.07, w.d, w.x, 0.054, w.z, 0.025); box(k, wool(WATER), w.w * 0.98, 0.031, w.d * 0.78, w.x, 0.091, w.z, 0.013);
    for (let i = 0; i < 5; i++) { const z = w.z + (i - 2) * w.d * 0.16; P.stitch(d, [[w.x - w.w * 0.46 + (i % 2) * 0.3, 0.112, z], [w.x + w.w * 0.46, 0.112, z]], { color: RIPPLE, len: 0.22, gap: 0.3, t: 0.022 }); }
    // 木桥：一块块桥板，两边各四根木桩（桩顶一颗球），上下两道弯的扶手
    const planks = Math.round(b.d / 0.36), n = b.d / planks;
    for (let i = 0; i < planks; i++) box(k, P.timber(i % 3 ? 0xc9995f : 0xb98a5c), b.w, 0.12, n - 0.022, b.x, 0.13, b.z - b.d * 0.5 + (i + 0.5) * n, 0.022, { long: 0 });
    for (const side of [-1, 1]) {
      const x = b.x + side * (b.w * 0.5 - 0.06), z0 = b.z - b.d / 2 + 0.2, z1 = b.z + b.d / 2 - 0.2;
      for (let i = 0; i < 4; i++) { const f = i / 3, lift = Math.sin(f * Math.PI) * 0.22; P.post(k, x, z0 + (z1 - z0) * f, { h: 0.98 + lift, r: 0.085, cap: 0xdcb877, y: 0.14 }); }
      for (const [y, r] of [[1.0, 0.05], [0.58, 0.04]]) k.tube(P.timber(0xc9995f), [[x, y + 0.14, z0], [x, y + 0.36, b.z], [x, y + 0.14, z1]], r, { seg: 5, detail: 5 });
      P.stitch(d, [[b.x + side * (b.w * 0.5 - 0.3), 0.196, z0 - 0.1], [b.x + side * (b.w * 0.5 - 0.3), 0.196, z1 + 0.1]], { len: 0.08, gap: 0.07, t: 0.014 });
    }
    // 水槽：槽底一条青色的毛毡，两道鼓起来的槽帮；槽底两行针脚是水流，槽帮顶上一行针脚；架高的地方立着圆木桩
    const pts = RAPIDS.points, N = pts.length, edges = [[], []], lanes = [[], []];
    for (let i = 0; i <= N; i++) {
      const p = pts[i % N], q = pts[(i + 1) % N], dx = q[0] - p[0], dz = q[2] - p[2], len = Math.hypot(dx, dz) || 1, nx = dz / len, nz = -dx / len;
      edges[0].push([p[0] + nx * 0.8, p[1] - 0.13, p[2] + nz * 0.8]); edges[1].push([p[0] - nx * 0.8, p[1] - 0.13, p[2] - nz * 0.8]);
      lanes[0].push([p[0] + nx * 0.28, p[1] - 0.112, p[2] + nz * 0.28]); lanes[1].push([p[0] - nx * 0.28, p[1] - 0.112, p[2] - nz * 0.28]);
      if (i > 0) k.quad(wool(WATER), edges[0][i - 1], edges[0][i], edges[1][i], edges[1][i - 1], [[0, i - 1], [0, i], [1.6, i], [1.6, i - 1]], 1, [0, 1, 0]);
      if (i % 9 === 4 && p[1] > 1.1 && i < N) for (const s of [-1, 1]) { const x = p[0] + nx * s * 0.95, z = p[2] + nz * s * 0.95; k.cyl(P.timber(0xa97a4c), 0.1, 0.12, p[1], x, p[1] / 2 - 0.1, z, { seg: 8 }); k.sphere(wool(WOOL_WHITE), 0.11, x, p[1] + 0.02, z, { seg: 7, rings: 5 }); }
    }
    for (const edge of edges) { k.tube(wool(RIM), edge.map(([x, y, z]) => [x, y + 0.2, z]), 0.2, { straight: true, seg: 7 }); P.stitch(d, edge.map(([x, y, z]) => [x, y + 0.405, z]), { len: 0.13, gap: 0.15, t: 0.02 }); }
    for (const lane of lanes) P.stitch(d, lane, { color: RIPPLE, len: 0.2, gap: 0.28, t: 0.02 });
    // 石头山：一堆大石头垒起来，水槽最高的那一段从山里穿过去，从东边的山口冲下来。每块石头上两道针脚当石缝
    const greys = [0x9a968c, 0x86837b, 0xaaa69a, 0x7d7a73];
    const boulder = (x, y, z, r, i) => {
      const sx = 1.05 + (i % 3) * 0.1, sy = 0.84 + (i % 2) * 0.18, sz = 0.94, turn = i * 1.7;
      k.sphere(wool(greys[i % 4]), r, x, y, z, { seg: 12, rings: 8, sx, sy, sz });
      for (const a of [turn, turn + 2.2]) P.stitch(d, Array.from({ length: 7 }, (_, j) => { const phi = 0.25 + j * 0.2, q = r * 1.006; return [x + q * sx * Math.sin(phi) * Math.cos(a + j * 0.08), y + q * sy * Math.cos(phi), z + q * sz * Math.sin(phi) * Math.sin(a + j * 0.08)]; }), { color: 0xe9e2cf, len: 0.13, gap: 0.11, t: 0.022 });
    };
    [[-28.6, 1.3, -3.7, 2.4], [-25.6, 1.4, -4.5, 2.6], [-22.6, 1.3, -3.3, 2.4], [-20.5, 1.2, -0.8, 2.0], [-30.0, 1.0, -0.2, 1.7], [-27.4, 3.3, -3.7, 2.0], [-24.6, 3.6, -3.5, 2.2], [-22.2, 3.2, -2.1, 1.9],
      [-25.7, 5.5, -3.0, 1.7], [-23.5, 5.5, -2.4, 1.5], [-21.0, 3.4, 0.2, 1.3], [-29.6, 1.0, -1.6, 1.6], [-21.4, 0.8, 1.8, 1.2], [-31.3, 0.74, 0.9, 1.3], [-19.8, 0.5, 4.6, 0.92], [-26.6, 0.8, -6.0, 1.3]].forEach(([x, y, z, r], i) => boulder(x, y, z, r, i));
    for (const [x, y, z, r] of [[-25.2, 6.6, -3.4, 0.9], [-27.6, 4.9, -4.2, 0.8], [-22.0, 4.7, -2.4, 0.7]]) k.sphere(leaf(0x7f9b52), r, x, y, z, { seg: 8, rings: 5, sy: 0.4 });   // 山顶的苔
    P.pine(k, -29.4, -5.4, 1.15, seed++); P.pine(k, -20.6, -4.2, 1.05, seed++); P.leafTree(k, -31.6, -3.6, 1.1, seed++, { tone: 1 });
    // 瀑布：山口挂下来几条水，底下一堆白绒球是水花
    for (let i = 0; i < 7; i++) { const x = -21.3 + (i - 3) * 0.2; k.tube(wool(i % 2 ? 0xaeefde : 0x71c5c8), [[x, 3.4, 2.2], [x + 0.05, 2.6, 2.9], [x + 0.1, 1.4, 3.9], [x + 0.2, 0.5, 5.0]], 0.11, { straight: true, seg: 5 }); }
    for (let i = 0; i < 14; i++) k.sphere(wool(FOAM), 0.18 + rand() * 0.16, -23.2 + rand() * 3.0, 0.46 + rand() * 0.24, 5.0 + rand() * 1.5, { seg: 8, rings: 5, sy: 0.8 });
    for (let i = 0; i < 5; i++) k.sphere(wool(FOAM), 0.14 + rand() * 0.1, -22.2 + rand() * 0.9, 2.4 + rand() * 1.2, 2.9 + rand() * 1.0, { seg: 7, rings: 5 });
    const { x: dockX, z: dockZ, w: dockW, d: dockD } = RAPIDS_DOCK;
    for (let i = 0; i < 10; i++) box(k, P.timber(i % 2 ? 0xc9995f : 0xb98959), dockW / 10, .17, dockD, dockX + dockW * ((i + .5) / 10 - .5), .075, dockZ, .03, {long: 2});
    for (const side of [-1, 1]) P.post(k, dockX + side * (dockW / 2 - .16), dockZ + dockD / 2, { h: .9, r: .08, cap: 0xdcb877 });
    k.tube(felt(CREAM), [[dockX - 2.05, .71, dockZ + .75], [dockX, .55, dockZ + .75], [dockX + 2.05, .71, dockZ + .75]], .035, { seg: 6 });
    // 岸边：灌木、花、草丛
    for (const [x, z, r] of [[-33.4, 8.4, 0.5], [-27.2, 8.3, 0.55], [-24.0, 8.0, 0.45], [-34.6, -0.2, 0.5]]) if (!isTourWalkable(x, z, 0.5)) P.shrub(k, d, x, z, r, seed++);
    for (const [x, z] of [[-29.6, 8.2], [-25.6, 8.4], [-34.9, 1.6], [-19.4, 6.4]]) if (!isTourWalkable(x, z, 0.4)) P.flowerPatch(d, x, z, 4, 0.7, seed++);
    // 木头小船（参考图）：圆木挖的船身、深色的舱、两排红褐色的座，船帮一圈针脚
    const boat = tone => part(root, (kit, det) => {
      kit.sphere(P.timber(tone), 0.5, 0, 0.12, 0, { seg: 12, rings: 8, sx: 0.74, sy: 0.46, sz: 1.5 });
      kit.sphere(felt(0x5b4034), 0.42, 0, 0.21, 0, { seg: 10, rings: 6, sx: 0.62, sy: 0.22, sz: 1.32 });
      for (const z of [-0.26, 0.2]) { box(kit, wool(0x9c4f43), 0.5, 0.1, 0.24, 0, 0.3, z, 0.035); box(kit, wool(0x9c4f43), 0.5, 0.22, 0.07, 0, 0.4, z - 0.14, 0.03); }
      P.stitch(det, Array.from({ length: 25 }, (_, i) => { const a = i * TAU / 24; return [Math.sin(a) * 0.335, 0.262, Math.cos(a) * 0.69]; }), { len: 0.06, gap: 0.05, t: 0.014 });
      kit.tube(felt(0xbd7d58), [[-.31, .38, .57], [-.24, .55, .80], [0, .61, .92], [.24, .55, .80], [.31, .38, .57]], .065, { seg: 8 });
      P.stitch(det, [[-.22, .60, .82], [0, .675, .92], [.22, .60, .82]], { len: .045, gap: .04, t: .012 });
      for (let i = 0; i < 3; i++) kit.sphere(wool(FOAM), 0.13 - i * 0.02, (i - 1) * 0.2, 0.1, 0.78 + (i % 2) * 0.08, { seg: 7, rings: 5 });   // 船头的水花
    }, 0, 0, 0, true);
    boats.push(boat(0xb9824f), boat(0xa5713f));
  }

  // ====================================================================== 04 过山车（docs/park-refs/ref-04-coaster.png）
  use('coaster');
  const train = group();
  {
    const pts = COASTER.points, N = pts.length, rails = [[], []], spine = [], beam = P.timber(0xb98a5c), sleeper = felt(0xe6d2a8), RAIL_A = 0xc9584f;
    for (let i = 0; i <= N; i++) {
      const p = pts[i % N], q = pts[(i + 1) % N], dx = q[0] - p[0], dz = q[2] - p[2], len = Math.hypot(dx, dz) || 1;
      rails[0].push([p[0] + dz / len * 0.42, p[1], p[2] - dx / len * 0.42]); rails[1].push([p[0] - dz / len * 0.42, p[1], p[2] + dx / len * 0.42]); spine.push([p[0], p[1] - 0.16, p[2]]);
      if (i % 2 === 0 && i < N) P.dash(k, sleeper, [p[0] + dz / len * 0.56, p[1] - 0.06, p[2] - dx / len * 0.56], [p[0] - dz / len * 0.56, p[1] - 0.06, p[2] + dx / len * 0.56], 0.085);   // 枕木
      if (i % 10 === 5 && i < N) {   // 木支架：一对圆木桩加横梁；高的打上交叉的斜撑，接头钉一颗布扣
        const y = p[1] - 0.2, ox = dz / len * 0.6, oz = -dx / len * 0.6, A = [p[0] + ox, p[2] + oz], B = [p[0] - ox, p[2] - oz];
        if (!isTourWalkable(A[0], A[1], 0.4) && !isTourWalkable(B[0], B[1], 0.4)) {
          for (const [x, z] of [A, B]) k.cyl(beam, 0.085, 0.1, y, x, y / 2, z, { seg: 7 });
          P.dash(k, beam, [A[0], y - 0.06, A[1]], [B[0], y - 0.06, B[1]], 0.11);
          const tiers = Math.max(0, Math.floor(y / 2.2));
          for (let t = 0; t < tiers; t++) { const y0 = y * t / tiers + 0.12, y1 = y * (t + 1) / tiers - 0.14;
            P.dash(k, beam, [A[0], y0, A[1]], [B[0], y1, B[1]], 0.06); P.dash(k, beam, [B[0], y0, B[1]], [A[0], y1, A[1]], 0.06);
            if (t) P.dash(k, beam, [A[0], y0 - 0.1, A[1]], [B[0], y0 - 0.1, B[1]], 0.07);
            for (const [x, z] of [A, B]) d.sphere(felt(0x7b5538), 0.045, x + ox * 0.17, y0, z + oz * 0.17, { seg: 5, rings: 3 }); }
        }
      }
    }
    k.tube(wool(RAIL_A), rails[0], 0.08, { straight: true, seg: 6 }); k.tube(wool(GOLD), rails[1], 0.08, { straight: true, seg: 6 }); k.tube(beam, spine, 0.06, { straight: true, seg: 5 });
    for (const rail of rails) P.stitch(d, rail.map(([x, y, z]) => [x, y + 0.083, z]), { len: 0.13, gap: 0.16, t: 0.018 });
    // 站台（参考图）：木平台、台阶，四根米白的柱子托着红瓦人字顶，山墙是米白的、中间一颗星，檐下一圈红白扇贝边
    const sx = -28.25, sz = -12.4, deck = 1.02, board = P.timber(0xb98a66);
    box(k, board, 2.5, 0.16, 6.4, sx, deck - 0.08, sz, 0.04, { long: 2 });
    for (const dz of [-3.0, -1.0, 1.0, 3.0]) for (const dx of [-1.1, 1.1]) k.cyl(beam, 0.09, 0.1, deck - 0.1, sx + dx, (deck - 0.1) / 2, sz + dz, { seg: 7 });
    for (let i = 0; i < 4; i++) {   // 朝小径的台阶，每级前沿一行针脚
      box(k, board, 0.34, 0.14, 1.7, sx - 1.42 - i * 0.34, deck - 0.2 - i * 0.24, sz - 0.6, 0.03, { long: 2 });
      P.stitch(d, [[sx - 1.55 - i * 0.34, deck - 0.124 - i * 0.24, sz - 1.4], [sx - 1.55 - i * 0.34, deck - 0.124 - i * 0.24, sz + 0.2]], { len: 0.07, gap: 0.06, t: 0.014 });
    }
    for (const side of [-1, 1]) { P.post(k, sx - 1.36, sz - 0.6 + side * 0.95, { h: 0.9, r: 0.07, y: deck - 0.14 }); P.post(k, sx - 2.6, sz - 0.6 + side * 0.95, { h: 0.9, r: 0.07, y: 0.12 }); P.rope(k, [sx - 1.36, deck + 0.62, sz - 0.6 + side * 0.95], [sx - 2.6, 0.9, sz - 0.6 + side * 0.95], { sag: 0.03 }); }
    for (const dz of [-3.1, 3.1]) for (const dx of [-1.15, 1.15]) { k.cyl(wool(WOOL_WHITE), 0.11, 0.12, 2.2, sx + dx, deck + 1.1, sz + dz, { seg: 10 }); k.cyl(wool(GOLD), 0.15, 0.15, 0.1, sx + dx, deck + 0.05, sz + dz, { seg: 10 }); k.cyl(wool(GOLD), 0.15, 0.15, 0.1, sx + dx, deck + 2.15, sz + dz, { seg: 10 }); }
    box(k, wool(WOOL_WHITE), 3.1, 0.12, 7.0, sx, deck + 2.28, sz, 0.04);   // 檐口的一圈梁
    for (const e of [-1, 1]) {
      k.soft(M('shingle', RED), 1.95, 0.14, 7.1, sx + e * 0.78, deck + 2.82, sz, { r: 0.05, rz: -e * 0.54 });   // 红瓦的人字顶
      P.valanceLine(k, null, e > 0 ? [sx + 1.56, sz + 3.5] : [sx - 1.56, sz - 3.5], e > 0 ? [sx + 1.56, sz - 3.5] : [sx - 1.56, sz + 3.5], deck + 2.24, 14, 0.26, { band: 0.05, mats: [wool(RED), wool(WOOL_WHITE)] });
      k.extrude(wool(WOOL_WHITE), [[-1.56, 0], [1.56, 0], [0, 0.94]], 0.1, new T.Matrix4().makeTranslation(sx, deck + 2.34, sz + e * 3.44));   // 山墙
      P.star(k, GOLD, 0.26, sx, deck + 2.66, sz + e * 3.5, 0, 0.06);
      P.stitch(d, [[sx - 1.3, deck + 2.42, sz + e * 3.5], [sx, deck + 3.16, sz + e * 3.5], [sx + 1.3, deck + 2.42, sz + e * 3.5]], { color: RED, len: 0.08, gap: 0.07, t: 0.016 });
      P.valanceLine(k, null, e > 0 ? [sx - 1.5, sz + 3.5] : [sx + 1.5, sz - 3.5], e > 0 ? [sx + 1.5, sz + 3.5] : [sx - 1.5, sz - 3.5], deck + 2.24, 6, 0.26, { band: 0.05, mats: [wool(RED), wool(WOOL_WHITE)] });
    }
    k.tube(wool(GOLD), [[sx, deck + 3.36, sz - 3.5], [sx, deck + 3.36, sz + 3.5]], 0.07, { straight: true, seg: 6 });   // 屋脊
    for (const dz of [0.6, 3.1]) P.post(k, sx - 1.15, sz + dz, { h: 0.86, r: 0.06, y: deck - 0.02 });
    for (const y of [0.5, 0.82]) P.rope(k, [sx - 1.15, deck + y, sz + 0.6], [sx - 1.15, deck + y, sz + 3.1], { sag: 0.03, r: 0.03 });
    // 站台脚下和轨道外面：一段栏杆、灌木、花
    { const ring = []; for (let i = 0; i < 7; i++) { const x = sx - 3.0 - (i > 3 ? (i - 3) * 0.1 : 0), z = sz + 1.2 + i * 1.5; if (!isTourWalkable(x, z, 0.4)) ring.push([x, z]); } P.fence(k, ring, { h: 0.85 }); }
    for (const [x, z, r] of [[sx - 2.3, sz + 1.6, 0.55], [sx - 2.4, sz - 2.6, 0.5], [-18.6, -5.2, 0.6], [-13.2, -9.4, 0.55]]) if (!isTourWalkable(x, z, 0.5)) P.shrub(k, d, x, z, r, seed++);
    for (const [x, z] of [[sx - 2.5, sz + 2.8], [sx - 2.2, sz - 3.6], [-16.2, -5.4]]) if (!isTourWalkable(x, z, 0.4)) P.flowerPatch(d, x, z, 4, 0.7, seed++);
    // 小火车（参考图）：两节红车厢，车帮包一圈金边，头一节有圆鼻子和一颗星，深褐色的座，轮子带浅色的毂
    part(train, (kit, det) => {
      for (const dz of [0.2, -1.45]) {
        box(kit, knit(RED), 0.98, 0.5, 1.45, 0, 0.3, dz, 0.16); box(kit, felt(0x5b4034), 0.8, 0.12, 1.15, 0, 0.5, dz, 0.05);   // 车身用针织：人就坐在里面，毛巾绒贴脸看是一片花斑
        box(kit, felt(0x5b4034), 0.78, 0.5, 0.14, 0, 0.72, dz - 0.56, 0.06); box(kit, wool(0x6b4a3a), 0.7, 0.1, 0.4, 0, 0.5, dz - 0.3, 0.04);   // 靠背和座垫
        if (dz < 0) kit.tube(wool(GOLD), [[-0.39, 0.74, dz - 0.56], [-0.39, 1.0, dz - 0.56], [0.39, 1.0, dz - 0.56], [0.39, 0.74, dz - 0.56]], 0.035, { straight: true, seg: 5 });   // 靠背上的金边（后一节）
        if (dz < 0) kit.tube(wool(GOLD), [[-0.46, 0.56, dz - 0.66], [-0.46, 0.56, dz + 0.66], [0.46, 0.56, dz + 0.66], [0.46, 0.56, dz - 0.66], [-0.46, 0.56, dz - 0.66]], 0.04, { straight: true, seg: 5 });   // 车帮的金边：只有后一节有。前一节坐着人，金边会横在视线中间（准则 3.4：眼前只留车头和扶手）
        kit.tube(ink, [[-0.42, 0.62, dz + 0.42], [0.42, 0.62, dz + 0.42]], 0.028, { straight: true });   // 扶手：一根横杆，在视线下沿
        for (const s of [-1, 1]) { P.stitch(det, [[s * 0.495, 0.3, dz - 0.55], [s * 0.495, 0.3, dz + 0.55]], { len: 0.06, gap: 0.05, t: 0.012 });
          for (const f of [-0.45, 0.45]) { kit.cyl(felt(0x4a3a33), 0.14, 0.14, 0.1, s * 0.47, 0.07, dz + f, { seg: 12, rz: Math.PI / 2 }); kit.sphere(felt(0xd9b98c), 0.06, s * 0.525, 0.07, dz + f, { seg: 6, rings: 4, sx: 0.5 }); } }
      }
      puff(kit, knit(RED), 0.5, 0, 0.3, 1.0, { sx: 0.98, sy: 0.52, sz: 0.9, seg: 12, rings: 8 }); star(kit, gold, 0.2, 0, 0.42, 1.44); box(kit, ink, 0.2, 0.1, 0.3, 0, 0.2, -0.62, 0.03);
      kit.tube(felt(GOLD), Array.from({ length: 9 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 8; return [Math.sin(a) * 0.47, 0.2, 1.0 + Math.cos(a) * 0.43]; }), 0.03, { straight: true, seg: 5 });   // 鼻子下沿的一道金边（在视线以下）
    }, 0, 0, 0, true);
  }

  // ====================================================================== 05 鬼屋（docs/park-refs/ref-05-haunt.png）
  use('haunt');
  // 主屋是空心的：敲开门能走进门厅（准则第 5c 节）。门厅的地面和外面一样高，所以屋基只是薄薄一层。
  let door, bell; const windowGhosts = [], portraitGhosts = [], frames = [];
  {
    const h = stopOf('haunt'), wall = wool(0x93708f), dark = felt(PLUM_DARK), roofA = M('shingle', 0x6e3b58), roofB = M('shingle', 0x84486a), lit = M.glow(0xffc95a, 1.5);
    const timberDark = P.timber(0x6b4a3a), stones = [0x8f8a84, 0x9d98a0, 0x7f7a80], TAN = 0xd9b98c;
    const front = h.z - 3.3, dx = HAUNT.door.x, dz = front;   // 朝北（朝小径）的那一面
    const mx = h.x - 0.6, x0 = mx - 2.8, x1 = mx + 2.8, z0 = h.z - 3.2, z1 = h.z + 3.2, TH = 0.25, top = 4.6, tx = h.x + 3.35, wx = h.x - 4.5;
    box(k, wool(0x8f8a84), 9.4, 0.1, 7.0, h.x, 0.05, h.z, 0.04);   // 石头屋基
    box(k, wall, 5.6, top, TH, mx, top / 2, z1 - TH / 2, 0.04);   // 后墙
    for (const e of [-1, 1]) box(k, wall, TH, top, 6.4, mx + e * (2.8 - TH / 2), top / 2, h.z, 0.04);   // 两侧的墙
    box(k, wall, dx - 0.7 - x0, top, TH, (x0 + dx - 0.7) / 2, top / 2, z0 + TH / 2, 0.04); box(k, wall, x1 - dx - 0.7, top, TH, (x1 + dx + 0.7) / 2, top / 2, z0 + TH / 2, 0.04);   // 前墙：门的两边
    box(k, wall, 1.4, top - 2.4, TH, dx, (top + 2.4) / 2, z0 + TH / 2, 0.04);   // 门上面
    box(k, wall, 2.5, 6.8, 2.7, tx, 3.4, h.z - 1.6, 0.1, { rz: -0.035 });   // 歪一点的塔楼
    box(k, wall, 2.6, 3.4, 3.2, wx, 1.7, h.z + 0.8, 0.1);   // 侧屋
    const gable = (x, z, w, d, eave, rise, mat, yaw = 0) => {   // 两片斜屋面合成一个尖顶
      for (const s of [-1, 1]) k.soft(mat, Math.hypot(w / 2 + 0.25, rise) + 0.1, 0.16, d + 0.5, x + s * (w / 4 + 0.05) * Math.cos(yaw), eave + rise / 2, z, { r: 0.05, rz: -s * Math.atan2(rise, w / 2 + 0.25), ry: yaw });
      for (const sz of [-1, 1]) for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7, hh = rise * (1 - Math.abs(t - 0.5) * 2); box(k, dark, w / 7 + 0.02, hh + 0.04, 0.12, x + (t - 0.5) * w, eave + hh / 2, z + sz * d / 2, 0.02); }
      k.tube(wool(TAN), [[x, eave + rise + 0.1, z - d / 2 - 0.28], [x, eave + rise + 0.1, z + d / 2 + 0.28]], 0.075, { straight: true, seg: 6 });   // 屋脊包一道浅色的边，两头各一颗球
      for (const sz of [-1, 1]) { k.sphere(wool(TAN), 0.13, x, eave + rise + 0.12, z + sz * (d / 2 + 0.3), { seg: 8, rings: 6 }); for (const e of [-1, 1]) P.stitch(zone('haunt').d, [[x + e * (w / 2 + 0.2), eave + 0.08, z + sz * (d / 2 + 0.26)], [x + e * 0.1, eave + rise + 0.02, z + sz * (d / 2 + 0.26)]], { color: TAN, len: 0.1, gap: 0.09, t: 0.02 }); }
    };
    gable(mx, h.z, 5.6, 6.4, 4.6, 2.3, roofA); gable(tx, h.z - 1.6, 2.5, 2.7, 6.8, 2.4, roofB); gable(wx, h.z + 0.8, 2.6, 3.2, 3.4, 1.5, roofB);
    puff(k, gold, 0.1, tx, 9.28, h.z - 1.6); for (let i = 0; i < 4; i++) box(k, wool(i % 2 ? stones[0] : PLUM_DARK), 0.62 - (i % 2) * 0.04, 0.5, 0.62, h.x - 2.0 - i * 0.03, 5.9 + i * 0.47, h.z + 1.2, 0.07);   // 烟囱：一块灰一块紫垒起来
    box(k, wool(PLUM), 0.8, 0.2, 0.8, h.x - 2.1, 7.62, h.z + 1.2, 0.06);
    // 朝小径的那几面：墙脚两排石块，墙上钉着深色的木梁（立柱、腰线、斜撑）
    const faces = [[x0, dx - 0.7, z0, top], [dx + 0.7, x1, z0, top], [tx - 1.25, tx + 1.25, h.z - 2.95, 6.8], [wx - 1.3, wx + 1.3, h.z - 0.8, 3.4]];
    faces.forEach(([a, b, z, hh], f) => {
      const n = Math.max(1, Math.round((b - a) / 0.7)), w = (b - a) / n;
      for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) box(k, wool(stones[(i + row + f) % 3]), w - 0.03, 0.34, 0.12, a + (i + 0.5) * w + (row ? 0 : 0), 0.27 + row * 0.35, z - 0.04, 0.05);
      for (const x of [a + 0.07, b - 0.07]) P.dash(k, timberDark, [x, 0.8, z - 0.05], [x, hh - 0.05, z - 0.05], 0.15);
      for (const y of [hh * 0.5, hh - 0.12]) P.dash(k, timberDark, [a, y, z - 0.05], [b, y, z - 0.05], 0.14);
      if (b - a > 1.6) { P.dash(k, timberDark, [a + 0.12, hh * 0.5 + 0.1, z - 0.04], [a + (b - a) * 0.42, hh - 0.2, z - 0.04], 0.09); P.dash(k, timberDark, [b - 0.12, hh * 0.5 + 0.1, z - 0.04], [b - (b - a) * 0.42, hh - 0.2, z - 0.04], 0.09); }
      P.stitch(d, [[a + 0.2, hh * 0.5 + 0.005, z - 0.125], [b - 0.2, hh * 0.5 + 0.005, z - 0.125]], { color: TAN, len: 0.08, gap: 0.08, t: 0.014 });
    });
    // 窗：亮着黄灯，十字窗棂，歪歪的百叶
    const windows = [[h.x - 2.2, 3.1, 0.8, 1.1], [h.x + 0.6, 3.1, 0.8, 1.1], [h.x - 2.2, 1.35, 0.7, 0.8], [tx, 4.9, 0.7, 1.0], [tx, 2.6, 0.7, 0.9], [wx, 2.0, 0.7, 0.9]];
    for (const [x, y, w, hh] of windows) {
      const z = x > h.x + 1.5 ? h.z - 2.98 : x < h.x - 3.4 ? h.z - 0.82 : front + 0.08;
      k.box(lit, w, hh, 0.06, x, y, z);
      box(k, dark, w + 0.16, 0.1, 0.12, x, y + hh / 2 + 0.04, z - 0.03, 0.02); box(k, dark, w + 0.2, 0.12, 0.16, x, y - hh / 2 - 0.05, z - 0.04, 0.02);
      box(k, dark, 0.05, hh, 0.08, x, y, z - 0.04, 0.01); box(k, dark, w, 0.05, 0.08, x, y, z - 0.04, 0.01);
      for (const s of [-1, 1]) box(k, felt(0x55455b), 0.3, hh + 0.05, 0.05, x + s * (w / 2 + 0.17), y - 0.02, z - 0.03, 0.02, { rz: s * (0.05 + rand() * 0.12) });
      P.lobe(k, dark, x, y + hh / 2 + 0.07, z - 0.06, Math.PI, (w + 0.16) / 2, 0, -0.22, 0.08, 0.6);   // 窗楣：一个小圆拱
    }
    // 门廊和门：门是单独一组，绕门轴往里开
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) box(k, wool(stones[(i + (s > 0 ? 1 : 0)) % 3]), 0.36 - (i % 2) * 0.03, 0.5, 0.36, dx + s * 1.05, 0.25 + i * 0.5, dz - 0.9, 0.07);   // 门廊的两根石柱：六块石头垒起来
    k.soft(roofB, 2.8, 0.14, 1.4, dx, 3.08, dz - 0.5, { r: 0.04, rx: -0.3 }); k.tube(wool(TAN), [[dx - 1.42, 2.9, dz - 1.17], [dx + 1.42, 2.9, dz - 1.17]], 0.06, { straight: true, seg: 6 });
    k.box(M.glow(0xffc27a, 1.7), 0.16, 0.2, 0.16, dx, 2.62, dz - 0.72); box(k, dark, 0.22, 0.05, 0.22, dx, 2.75, dz - 0.72, 0.02); k.tube(ink, [[dx, 2.98, dz - 0.72], [dx, 2.76, dz - 0.72]], 0.012, { straight: true });   // 门廊下的一盏小灯 box(k, M('boards', 0x6f5648), 2.6, 0.08, 1.5, dx, 0.13, dz - 0.62, 0.03);
    for (const s of [-1, 1]) box(k, dark, 0.14, 2.5, 0.22, dx + s * 0.77, 1.25, dz, 0.03); box(k, dark, 1.7, 0.16, 0.22, dx, 2.5, dz, 0.03);
    door = part(root, kit => { box(kit, M('boards', 0x4f3d36), 1.26, 2.2, 0.08, 0.63, 1.1, 0, 0.03); for (const y of [0.55, 1.65]) box(kit, felt(0x3d2f2a), 1.0, 0.7, 0.03, 0.63, y, -0.05, 0.02); puff(kit, gold, 0.06, 1.1, 1.1, -0.08); puff(kit, gold, 0.06, 1.1, 1.1, 0.08); }, dx - 0.63, 0.16, z0 + 0.06, true);
    // ---- 门厅（照 docs/park-refs/ref-05-haunt.png 右下那一格）：木地板、圆地毯、护墙板、门里两边的帘子、顶上一盏灯
    const zi0 = z0 + TH, zi1 = z1 - TH, xi0 = x0 + TH, xi1 = x1 - TH, cz = (zi0 + zi1) / 2, warm = M.glow(0xffc27a, 1.7), boards = M('boards', 0x6f5648);
    box(k, M('boards', 0x7a5a48), xi1 - xi0, 0.06, zi1 - zi0, mx, 0.13, cz, 0.01); box(k, M('boards', 0x5a463c), xi1 - xi0, 0.12, zi1 - zi0, mx, 3.2, cz, 0.01);   // 地板、天花板
    puff(k, gold, 1, mx, 0.15, cz - 0.2, { sx: 1.78, sy: 0.03, sz: 1.28, seg: 20 }); puff(k, wool(0x9c4a4e), 1, mx, 0.165, cz - 0.2, { sx: 1.66, sy: 0.03, sz: 1.16, seg: 20 }); puff(k, gold, 1, mx, 0.18, cz - 0.2, { sx: 0.5, sy: 0.02, sz: 0.36, seg: 14 });
    box(k, boards, xi1 - xi0, 0.9, 0.05, mx, 0.61, zi1 - 0.03, 0.01); for (const e of [-1, 1]) box(k, boards, 0.05, 0.9, zi1 - zi0, e < 0 ? xi0 + 0.03 : xi1 - 0.03, 0.61, cz, 0.01);   // 护墙板
    box(k, dark, xi1 - xi0, 0.08, 0.07, mx, 1.08, zi1 - 0.04, 0.01);
    for (const e of [-1, 1]) { puff(k, wool(0x8a4a68), 0.5, dx + e * 1.05, 1.5, zi0 + 0.14, { sx: 0.62, sy: 2.6, sz: 0.3 }); puff(k, wool(0x8a4a68), 0.4, dx + e * 1.22, 0.62, zi0 + 0.16, { sx: 0.7, sy: 1.4, sz: 0.34 }); puff(k, gold, 0.07, dx + e * 0.92, 1.25, zi0 + 0.3); }
    box(k, dark, 2.9, 0.14, 0.12, dx, 2.72, zi0 + 0.1, 0.03);   // 帘杆
    k.tube(ink, [[mx, 3.14, cz - 0.2], [mx, 2.78, cz - 0.2]], 0.012, { straight: true }); box(k, dark, 0.3, 0.06, 0.3, mx, 2.78, cz - 0.2, 0.02);
    k.sphere(warm, 0.17, mx, 2.62, cz - 0.2, { seg: 12, rings: 9 }); box(k, dark, 0.2, 0.05, 0.2, mx, 2.44, cz - 0.2, 0.02);   // 吊灯
    // 西墙的书架
    box(k, M('boards', 0x5a463c), 0.36, 2.0, 1.4, xi0 + 0.2, 1.16, cz + 0.9, 0.03);
    for (let row = 0; row < 3; row++) for (let j = 0; j < 6; j++) box(k, felt([RED, TEAL, GOLD, PLUM, MOSS, CORAL][(row * 2 + j) % 6]), 0.2, 0.34 + ((row + j) % 3) * 0.05, 0.14, xi0 + 0.36, 0.55 + row * 0.6, cz + 0.36 + j * 0.2, 0.02);
    // 后墙的三张肖像，每张顶上一盏小壁灯；中间那张下面一张小桌：蜡烛和小铃
    const px = [mx - 1.62, mx, mx + 1.62];
    px.forEach((x, i) => {
      const f = picture('haunt-portrait-' + (i + 1) + '.webp', 1.0, 1.25, x, 1.93, zi1 - 0.07, Math.PI, { lit: false }); f.material.color.setScalar(0.86); frames.push(f);
      k.sphere(warm, 0.06, x, 2.68, zi1 - 0.16, { seg: 8, rings: 6 }); box(k, dark, 0.14, 0.05, 0.16, x, 2.62, zi1 - 0.1, 0.01);
    });
    const bx = HAUNT.bell.x, tz = zi1 - 0.36;
    box(k, wood, 1.1, 0.07, 0.5, bx, 0.9, tz, 0.02); for (const e of [-1, 1]) for (const f of [-1, 1]) box(k, wood, 0.07, 0.72, 0.07, bx + e * 0.46, 0.52, tz + f * 0.18, 0.02);
    box(k, felt(0x9c4a4e), 0.7, 0.02, 0.4, bx, 0.945, tz, 0.005); k.cyl(cream, 0.04, 0.045, 0.24, bx - 0.34, 1.07, tz, { seg: 8 }); k.cyl(gold, 0.09, 0.09, 0.03, bx - 0.34, 0.96, tz, { seg: 10 });
    k.sphere(warm, 0.05, bx - 0.34, 1.23, tz, { seg: 8, rings: 6, sx: 0.8, sy: 1.5, sz: 0.8 });
    bell = part(root, kit => { kit.cyl(gold, 0.03, 0.1, 0.16, 0, -0.14, 0, { seg: 12 }); puff(kit, gold, 0.035, 0, -0.04, 0); kit.cyl(wood, 0.016, 0.016, 0.12, 0, 0.04, 0, { seg: 6 }); }, bx + 0.26, 1.2, tz - 0.04);
    // 布偶幽灵：敲门时两只从窗后探头；摇铃时三只从三张肖像上面的墙里飘出来
    const ghost = (x, y, z, s = 1) => part(root, kit => {
      puff(kit, white, 0.34 * s, 0, 0.3 * s, 0, { sy: 1.25 }); for (let i = 0; i < 5; i++) { const a = i * TAU / 5; puff(kit, white, 0.13 * s, Math.cos(a) * 0.24 * s, -0.08 * s, Math.sin(a) * 0.2 * s, { sy: 1.3 }); }
      for (const e of [-1, 1]) puff(kit, ink, 0.05 * s, e * 0.12 * s, 0.4 * s, -0.29 * s, { sy: 1.4 }); puff(kit, ink, 0.045 * s, 0, 0.22 * s, -0.31 * s, { sy: 1.5 }); box(kit, felt(0xc8b8d6), 0.14 * s, 0.14 * s, 0.03, 0.14 * s, 0.1 * s, -0.31 * s, 0.02);
    }, x, y, z);
    windowGhosts.push([ghost(h.x - 2.2, 2.9, front + 0.45, 0.8), h.x - 2.2, 2.9, front + 0.45], [ghost(tx, 4.0, h.z - 2.6, 0.8), tx, 4.0, h.z - 2.6]);
    px.forEach(x => portraitGhosts.push([ghost(x, 2.46, z1 + 0.25, 0.8), x, 2.46, z1 + 0.25]));
    // 南瓜（带脸）、枯树、歪栅栏
    for (const [x, z, r] of [[dx - 1.9, dz - 1.5, 0.42], [dx + 1.8, dz - 1.4, 0.36], [dx + 2.4, dz - 1.9, 0.26], [-11.3, -20.4, 0.44]]) {
      puff(k, wool(0xdf7f3d), r, x, r * 0.72, z, { sx: 1.12, sy: 0.81, seg: 12, rings: 8 }); k.tube(felt(0x5f8a45), [[x, r * 1.4, z], [x + r * 0.05, r * 1.75, z], [x + r * 0.28, r * 1.86, z]], r * 0.1, { seg: 5, detail: 3 });   // 南瓜：一瓣一瓣的缝线，弯弯的绿蒂
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.26; P.stitch(d, Array.from({ length: 6 }, (_, j) => { const t = 0.35 + j * 0.42; return [x + Math.sin(t) * Math.sin(a) * r * 1.13, r * 0.72 + Math.cos(t) * r * 0.82, z + Math.sin(t) * Math.cos(a) * r * 1.01]; }), { color: 0xf3d9a8, len: 0.05, gap: 0.045, t: 0.012 }); }
      for (const e of [-1, 1]) box(k, ink, r * 0.22, r * 0.2, 0.03, x + e * r * 0.36, r * 0.86, z - r * 0.98, 0.01, { rz: e * 0.5 }); box(k, ink, r * 0.6, r * 0.12, 0.03, x, r * 0.5, z - r * 1.04, 0.01);
    }
    for (const [x, z, s] of [[h.x - 5.9, h.z - 3.4, 1], [h.x + 5.4, h.z - 3.0, 0.85]]) {
      k.tube(knit(0x5b4a44), [[x, 0, z], [x + 0.1 * s, 1.4 * s, z], [x - 0.2 * s, 2.6 * s, z + 0.1]], 0.16 * s, { straight: true });
      for (const [bx2, by, bz2] of [[0.9, 3.3, 0.2], [-1.0, 3.1, -0.3], [0.5, 3.7, -0.6], [-0.4, 3.9, 0.5]]) k.tube(knit(0x5b4a44), [[x - 0.1 * s, 2.2 * s, z], [x + bx2 * s * 0.6, by * s * 0.82, z + bz2 * s], [x + bx2 * s, by * s, z + bz2 * s * 1.6]], 0.06 * s, { straight: true });
    }
    for (let i = 0; i < 13; i++) { const x = h.x - 4.8 + i * 0.8; if (Math.abs(x - dx) < 1.5) continue; const hh = 0.9 + (i % 3) * 0.12; box(k, P.timber(0x7b5538), 0.16, hh, 0.1, x, hh / 2, dz - 2.3, 0.03, { rz: (i % 2 ? 1 : -1) * 0.06, long: 1 }); k.sphere(wool(0x9a7a6a), 0.09, x + (i % 2 ? -1 : 1) * 0.03, hh + 0.03, dz - 2.3, { seg: 6, rings: 4 });
      if (i < 12 && Math.abs(x + 0.8 - dx) >= 1.5) for (const y of [0.36, 0.66]) P.dash(k, P.timber(0x8a6243), [x, y, dz - 2.34], [x + 0.8, y + (i % 2 ? 0.04 : -0.04), dz - 2.34], 0.06); }
    for (const [x, z, r] of [[h.x - 4.2, dz - 1.5, 0.5], [h.x + 3.6, dz - 1.6, 0.45], [h.x - 3.0, dz - 1.2, 0.4]]) P.shrub(k, null, x, z, r, seed++);   // 栅栏里面几丛深色的灌木
    for (let i = 0; i < 10; i++) { const x = h.x - 4.6 + i * 1.0; if (Math.abs(x - dx) > 1.4) P.tuft(d, x + 0.3, dz - 2.55, seed++, 1.3); }
  }

  // ====================================================================== 06 摩天轮（docs/park-refs/ref-06-wheel.png）
  use('wheel');
  const wheel = group(root, WHEEL.x, WHEEL.y, WHEEL.z), cabins = [];
  {
    const W = WHEEL, R = W.r, half = 0.62, north = W.z - 2.4, anchor = [W.x, W.z, R + 1.5], deckWood = P.timber(0xc9995f);
    // 轮子：两道金色的轮圈、十对轮辐、轮心一只红鼓和两颗星；每个挂吊舱的地方一颗米白的球。轮圈和轮辐上都有针脚
    part(wheel, (kit, det) => {
      const circle = (q, z) => Array.from({ length: 49 }, (_, i) => { const a = i * TAU / 48; return [Math.cos(a) * q, Math.sin(a) * q, z]; });
      for (const s of [-1, 1]) { kit.tube(wool(GOLD), circle(R, s * half), 0.13, { straight: true, seg: 6, caps: false }); P.stitch(det, circle(R, s * (half + 0.135)), { len: 0.14, gap: 0.12, t: 0.02 }); }
      for (let i = 0; i < W.cars; i++) {
        const a = i * TAU / W.cars, c = Math.cos(a), sn = Math.sin(a);
        for (const s of [-1, 1]) { kit.tube(wool(GOLD), [[0, 0, s * half * 0.6], [R * c, R * sn, s * half]], 0.075, { straight: true, seg: 5 }); P.stitch(det, [[0.75 * c, 0.75 * sn, s * (half * 0.6 + 0.085)], [(R - 0.3) * c, (R - 0.3) * sn, s * (half + 0.085)]], { len: 0.12, gap: 0.12, t: 0.018 }); kit.sphere(wool(WOOL_WHITE), 0.17, R * c, R * sn, s * half, { seg: 8, rings: 6 }); }
        kit.tube(wool(GOLD), [[R * c, R * sn, -half], [R * c, R * sn, half]], 0.06, { straight: true, seg: 5 });
        const b = (i + 0.5) * TAU / W.cars; for (const s of [-1, 1]) kit.tube(wool(WOOL_WHITE), [[R * 0.58 * c, R * 0.58 * sn, s * half * 0.84], [R * 0.58 * Math.cos(b), R * 0.58 * Math.sin(b), s * half * 0.84]], 0.03, { straight: true, seg: 4 });
      }
      kit.cyl(wool(RED), 0.62, 0.62, half * 2 + 0.3, 0, 0, 0, { seg: 20, rx: Math.PI / 2 }); kit.cyl(wool(GOLD), 0.7, 0.7, half * 2 + 0.1, 0, 0, 0, { seg: 20, rx: Math.PI / 2 });
      P.star(kit, 0xf6e3a1, 0.42, 0, 0, half + 0.17, 0, 0.08); P.star(kit, 0xf6e3a1, 0.42, 0, 0, -half - 0.17, Math.PI, 0.08);
      for (const s of [-1, 1]) P.stitch(det, circle(0.52, s * (half + 0.155)), { color: GOLD, len: 0.07, gap: 0.06, t: 0.016 });
      for (let i = 0; i < 20; i++) { const a = i * TAU / 20 + 0.16; for (const s of [-1, 1]) kit.sphere(M.glow(0xffe9a8, 2.2), 0.07, Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02), s * (half + 0.15), { seg: 7, rings: 5 }); }   // 轮圈上的一圈小灯
    }, 0, 0, 0, false, anchor);
    // A 字支架：四条金色的毛毡腿、横档；轮轴两头各一只红布墩
    for (const s of [-1, 1]) {
      for (const e of [-1, 1]) { const a = [W.x + e * 3.4, 0.5, W.z + s * 1.25], b = [W.x, W.y, W.z + s * 0.95]; k.tube(wool(GOLD), [a, b], 0.17, { straight: true, seg: 7 });
        P.stitch(d, [[a[0], a[1] + 0.3, a[2] + s * 0.175], [b[0] + e * 0.3, b[1] - 0.5, b[2] + s * 0.175]], { len: 0.14, gap: 0.13, t: 0.02 }); k.cyl(wool(RED), 0.3, 0.34, 0.3, a[0], 0.5, a[2], { seg: 10 }); }
      k.tube(wool(GOLD), [[W.x - 1.75, W.y * 0.5, W.z + s * 1.1], [W.x + 1.75, W.y * 0.5, W.z + s * 1.1]], 0.11, { straight: true, seg: 6 }); k.cyl(wool(RED), 0.34, 0.34, 0.34, W.x, W.y, W.z + s * 1.0, { seg: 12, rx: Math.PI / 2 });
    }
    // 上客平台（朝北，朝小径）：木板的台子，裙边是竖着的木板，沿口挂一圈红青相间的小旗；木桩和绳子围着，台阶两边各两根桩
    box(k, P.timber(0xa97a4c), 8.4, 0.34, 3.6, W.x, 0.17, W.z, 0.04, { long: 1 }); box(k, deckWood, 8.5, 0.07, 3.7, W.x, 0.375, W.z, 0.02, { long: 0 });
    box(k, P.timber(0xa97a4c), 4.4, 0.34, 1.9, W.x, 0.17, north - 0.4, 0.04, { long: 1 }); box(k, deckWood, 4.5, 0.07, 2.0, W.x, 0.375, north - 0.4, 0.02, { long: 0 });
    for (let i = 0; i < 2; i++) { box(k, deckWood, 2.2, 0.14, 0.4, W.x, 0.3 - i * 0.16, north - 1.5 - i * 0.4, 0.03, { long: 0 }); P.stitch(d, [[W.x - 1.0, 0.375 - i * 0.16, north - 1.62 - i * 0.4], [W.x + 1.0, 0.375 - i * 0.16, north - 1.62 - i * 0.4]], { len: 0.07, gap: 0.06, t: 0.014 }); }
    const flags = [wool(RED), wool(TEAL), wool(WOOL_WHITE)], zN = north - 1.36;
    for (const e of [-1, 1]) { P.valanceLine(k, null, e > 0 ? [W.x + 2.22, zN] : [W.x - 1.15, zN], e > 0 ? [W.x + 1.15, zN] : [W.x - 2.22, zN], 0.37, 4, 0.26, { band: 0.03, mats: flags, round: 1.6 });
      P.valanceLine(k, null, e > 0 ? [W.x + 4.22, W.z - 1.82] : [W.x - 2.25, W.z - 1.82], e > 0 ? [W.x + 2.25, W.z - 1.82] : [W.x - 4.22, W.z - 1.82], 0.37, 7, 0.26, { band: 0.03, mats: flags, round: 1.6 });
      const rail = [[W.x + e * 1.2, north - 1.25], [W.x + e * 2.1, north - 1.25], [W.x + e * 2.1, north + 0.5], [W.x + e * 4.05, north + 0.6], [W.x + e * 4.05, W.z + 1.6]];
      rail.forEach(([x, z]) => P.post(k, x, z, { h: 0.9, r: 0.075, y: 0.4 })); for (let i = 1; i < rail.length; i++) for (const y of [0.82, 1.14]) P.rope(k, [rail[i - 1][0], y, rail[i - 1][1]], [rail[i][0], y, rail[i][1]], { r: 0.032 });
      P.post(k, W.x + e * 1.2, north - 2.25, { h: 0.9, r: 0.075 }); P.rope(k, [W.x + e * 1.2, 1.14, north - 1.25], [W.x + e * 1.2, 0.76, north - 2.25], { r: 0.032, sag: 0.02 });
    }
    {   // 操作亭：木板小亭，四根红柱子，尖顶
      const bx = W.x + 3.3, bz = north - 0.2, tmp = new PlushKit(), tdet = new PlushKit();
      box(k, P.timber(0xb98a66), 0.9, 1.0, 0.9, bx, 0.9, bz, 0.06, { long: 1 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(wool(RED), 0.045, 0.045, 0.9, bx + sx * 0.4, 1.85, bz + sz * 0.4, { seg: 6 });
      canopy(tmp, tdet, 0.86, 2.3, 2.75, [wool(GOLD), wool(WOOL_WHITE)], 8); k.merge(tmp, bx, 0, bz); d.merge(tdet, bx, 0, bz);
      P.valance(k, null, bx, 2.31, bz, 0.87, 8, 0.2, { band: 0.04, mats: [wool(GOLD), wool(WOOL_WHITE)] }); k.sphere(wool(RED), 0.07, bx, 2.82, bz, { seg: 7, rings: 5 });
    }
    for (const [x, z, r] of [[W.x - 5.2, W.z - 1.2, 0.6], [W.x + 5.3, W.z - 0.6, 0.55], [W.x - 4.9, W.z + 1.4, 0.5]]) if (!isTourWalkable(x, z, 0.5)) P.shrub(k, d, x, z, r, seed++);
    for (const [x, z] of [[W.x - 4.9, W.z - 2.3], [W.x + 5.0, W.z - 2.0]]) if (!isTourWalkable(x, z, 0.4)) P.flowerPatch(d, x, z, 4, 0.7, seed++);
    // 吊舱（参考图）：挂点在顶上，舱在下面。米白的绒顶带一圈扇贝边，圆肚子的舱，四根柱子，一圈木栏杆。
    // 坐进去的时候眼睛在挂点下 0.86 米，看得到栏杆和四根柱子，所以这几样的位置不能动
    for (let i = 0; i < W.cars; i++) {
      const tone = [TEAL, CORAL][i % 2];
      cabins.push(part(wheel, (kit, det) => {
        kit.tube(ink, [[0, 0, -half], [0, -0.3, -0.5], [0, -0.3, 0.5], [0, 0, half]], 0.03, { straight: true, seg: 5 });
        kit.sphere(wool(WOOL_WHITE), 0.8, 0, -0.34, 0, { seg: 14, rings: 6, sx: 1.0, sy: 0.4, sz: 0.82, thetaLen: Math.PI / 2 }); kit.sphere(wool(tone), 0.1, 0, 0.0, 0, { seg: 7, rings: 5 });   // 绒顶
        box(kit, felt(CREAM), 1.5, 0.1, 1.24, 0, -0.34, 0, 0.05);
        for (let j = 0; j < 12; j++) { const a = j * TAU / 12; kit.sphere(felt(CREAM), 0.12, Math.cos(a) * 0.76, -0.4, Math.sin(a) * 0.62, { seg: 8, rings: 5, sy: 0.9 }); }   // 顶沿一圈扇贝（位置和大小不动：它压着画面的上沿）
        kit.sphere(wool(tone), 0.62, 0, -1.52, 0, { seg: 14, rings: 8, sx: 1.2, sy: 0.42, sz: 0.98 });   // 圆肚子的舱底
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(kit, felt(CREAM), 0.06, 1.1, 0.06, sx * 0.66, -0.9, sz * 0.52, 0.02);
        box(kit, felt(tone), 1.44, 0.14, 1.16, 0, -1.5, 0, 0.06);   // 底。围板和底用毛毡：人坐在里面，贴着看
        for (const sz of [-1, 1]) { box(kit, felt(tone), 1.44, 0.36, 0.08, 0, -1.28, sz * 0.56, 0.05); P.stitch(det, [[-0.62, -1.16, sz * 0.605], [0.62, -1.16, sz * 0.605]], { len: 0.06, gap: 0.05, t: 0.012 }); }   // 前后的围板（矮一点，坐着能越过去看）
        for (const sx of [-1, 1]) { box(kit, felt(tone), 0.08, 0.36, 1.16, sx * 0.7, -1.28, 0, 0.05); box(kit, felt(CREAM), 0.28, 0.08, 1.0, sx * 0.5, -1.3, 0, 0.03); }   // 两侧的围板和座
        kit.tube(felt(0xd9b98c), [[-0.7, -1.07, -0.56], [0.7, -1.07, -0.56], [0.7, -1.07, 0.56], [-0.7, -1.07, 0.56], [-0.7, -1.07, -0.56]], 0.03, { straight: true, seg: 5 });   // 栏杆
      }, 0, 0, 0, false, anchor));
    }
  }

  // ====================================================================== 07 游戏摊街（docs/park-refs/ref-07-midway.png）
  use('stalls');
  const stalls = [];
  {
    const tones = [RED, TEAL, GOLD], names = [copy('打积木', 'KNOCKDOWN'), copy('打绒鸭', 'DUCK POND'), copy('打气球', 'BALLOON POP')];
    // 挂着的奖品：一只小熊（或小兔）、一颗星
    const plushie = (kit, x, y, z, tone, ears) => {
      kit.sphere(wool(tone), 0.15, x, y - 0.2, z, { seg: 8, rings: 6, sy: 1.1 }); kit.sphere(wool(tone), 0.14, x, y + 0.03, z, { seg: 8, rings: 6 }); kit.sphere(felt(0xf6efe0), 0.06, x + 0.11, y, z, { seg: 6, rings: 4 });
      for (const e of [-1, 1]) { kit.sphere(wool(tone), ears === 'long' ? 0.045 : 0.055, x, y + (ears === 'long' ? 0.22 : 0.14), z + e * (ears === 'long' ? 0.06 : 0.1), { seg: 6, rings: 4, sy: ears === 'long' ? 2.4 : 1 }); kit.sphere(M.button(INK), 0.018, x + 0.125, y + 0.05, z + e * 0.05, { seg: 5, rings: 3 }); kit.sphere(wool(tone), 0.05, x + 0.02, y - 0.16, z + e * 0.15, { seg: 6, rings: 4, sy: 1.5 }); }
      kit.sphere(felt(RED), 0.04, x + 0.13, y - 0.1, z, { seg: 5, rings: 3, sz: 1.8 }); kit.tube(ink, [[x, y + 0.16, z], [x, y + 0.5, z]], 0.006, { straight: true, seg: 4 });
    };
    STALLS.forEach((st, i) => {
      const x = st.x, z = st.z, tone = tones[i], accent = wool(tone), back = x - 1.3, cx = x + 0.2;   // 柜台朝东（朝小径），后墙在西
      // 柜台：竖着的彩色木板，上面一块木台面
      for (let j = 0; j < 10; j++) box(k, P.timber(j % 2 ? tone : (tone === GOLD ? 0xcf9a45 : tone === RED ? 0xa64c48 : 0x34767f)), 0.5, 0.95, 0.32, x + 1.2, 0.475, z - 1.6 + (j + 0.5) * 0.32, 0.03, { long: 1 });
      box(k, P.timber(0xc9995f), 0.7, 0.09, 3.4, x + 1.2, 0.995, z, 0.03, { long: 2 }); P.stitch(d, [[x + 1.5, 1.045, z - 1.6], [x + 1.5, 1.045, z + 1.6]], { len: 0.07, gap: 0.06, t: 0.014 });
      // 后墙、两侧墙：深色木板；前面两根彩色的柱子，柱顶一颗金球
      box(k, P.timber(0x9a7250), 0.14, 2.6, 3.4, back, 1.3, z, 0.04, { long: 1 });
      for (const s of [-1, 1]) { box(k, P.timber(0x9a7250), 2.6, 2.6, 0.12, x - 0.05, 1.3, z + s * 1.7, 0.04, { long: 1 }); k.cyl(accent, 0.08, 0.09, 2.9, x + 1.4, 1.45, z + s * 1.66, { seg: 8 }); P.stitch(d, [[x + 1.492, 0.2, z + s * 1.66], [x + 1.492, 2.8, z + s * 1.66]], { len: 0.08, gap: 0.08, t: 0.014 }); }
      // 尖顶的条纹帐子，顶沿一圈两色的扇贝边，顶上一根旗杆、一面小旗
      { const tmp = new PlushKit(), tdet = new PlushKit(); canopy(tmp, tdet, 2.34, 2.94, 4.3, [accent, wool(WOOL_WHITE)], 12); k.merge(tmp, cx, 0, z); d.merge(tdet, cx, 0, z); }
      P.valance(k, null, cx, 2.96, z, 2.36, 24, 0.3, { band: 0.08, mats: [accent, accent, wool(WOOL_WHITE), wool(WOOL_WHITE)] });
      k.cyl(P.timber(0xc9995f), 0.03, 0.035, 0.9, cx, 4.7, z, { seg: 6 }); k.sphere(wool(GOLD), 0.08, cx, 5.2, z, { seg: 7, rings: 5 });
      k.extrude(accent, [[0, 0.16], [0.3, 0.12], [0.6, 0.17], [0.5, 0], [0.6, -0.17], [0.3, -0.12], [0, -0.16]], 0.03, new T.Matrix4().makeRotationY(-Math.PI / 2).setPosition(cx, 4.92, z + 0.04));
      // 挂着的奖品，摆靶子的架子
      plushie(k, x + 0.9, 2.3, z - 1.0, i === 1 ? 0xf3ead8 : 0xc99a6a, i === 1 ? 'long' : 'round'); plushie(k, x + 0.9, 2.36, z + 0.1, 0x9a6a4c, 'round');
      P.star(k, GOLD, 0.17, x + 0.9, 2.3, z + 1.05, Math.PI / 2, 0.07); k.tube(ink, [[x + 0.9, 2.46, z + 1.05], [x + 0.9, 2.86, z + 1.05]], 0.006, { straight: true, seg: 4 });
      box(k, P.timber(0xc9995f), 0.5, 0.08, 2.9, back + 0.35, 1.15, z, 0.03, { long: 2 });
      for (const side of [-1, 1]) P.dash(k, wood, [x + 1.32, 2.76, z + side * 1.05], [x + 2.63, 2.76, z + side * .88], .065);
      sign(copy(st.zh, st.en), x + 2.68, 2.78, z, 2.3, Math.PI / 2);
      k.cyl(wool(WOOL_WHITE), 0.5, 0.5, 0.06, x + 2.38, 4.0, z, { seg: 24, rz: Math.PI / 2 }); picture('stall-' + st.id + '.webp', 0.84, 0.84, x + 2.43, 4.0, z, Math.PI / 2, { cutout: true });
      P.stitch(d, Array.from({ length: 25 }, (_, j) => { const a = j * TAU / 24; return [x + 2.42, 4.0 + Math.cos(a) * 0.45, z + Math.sin(a) * 0.45]; }), { color: tone, len: 0.06, gap: 0.05, t: 0.012 });
      if (st.id === 'ducks') {
        box(k, felt(TEAL), .54, .11, 2.93, back + .35, 1.19, z, .045);
        P.stitch(d, [[back + .62, 1.25, z - 1.40], [back + .62, 1.25, z + 1.40]], { len: .09, gap: .05, t: .015 });
      } else if (st.id === 'balloons') {
        box(k, felt(PLUM_DARK), .07, 1.30, 2.95, back + .10, 1.82, z, .045);
      }
      const items = [];
      if (st.id === 'blocks') [[0, 0], [0, 1], [0, 2], [1, 0.5], [1, 1.5], [2, 1]].forEach(([row, col], j) => items.push(part(root, kit => { box(kit, wool(0xf1e3c0), 0.3, 0.3, 0.3, 0, 0.15, 0, 0.05); const c = felt([RED, TEAL, GOLD, CORAL, NAVY, MOSS][j]); for (const [w, hh, y, dz] of [[0.012, 0.16, 0.15, -0.08], [0.012, 0.16, 0.15, 0.08], [0.012, 0.02, 0.23, 0], [0.012, 0.02, 0.07, 0]]) kit.box(c, w, hh, dz ? 0.02 : 0.18, 0.153, y, dz); }, back + 0.35, 1.19 + row * 0.3, z + (col - 1) * 0.34)));   // 积木：米白的方块，朝外那面一个彩色的方框
      else if (st.id === 'ducks') for (let j = 0; j < 3; j++) items.push(part(root, kit => { kit.sphere(wool(0xf2cf62), 0.19, 0, 0.17, 0, { seg: 10, rings: 7, sy: 0.85, sz: 1.2 }); kit.sphere(wool(0xf2cf62), 0.12, 0.02, 0.36, 0.1, { seg: 9, rings: 6 }); kit.sphere(felt(0xe58b3a), 0.05, 0.1, 0.34, 0.14, { seg: 6, rings: 4, sx: 1.6 }); kit.sphere(M.button(INK), 0.022, 0.1, 0.4, 0.06, { seg: 5, rings: 3 }); kit.sphere(wool(0xf2cf62), 0.08, -0.06, 0.2, -0.2, { seg: 6, rings: 4, sy: 0.6 }); }, back + 0.35, 1.19, z + (j - 1) * 0.8));
      else for (let j = 0; j < st.targets.length; j++) items.push(part(root, kit => { kit.sphere(wool([RED, TEAL, GOLD, CORAL, NAVY, 0xb9a4cf][j]), 0.2, 0, 0, 0, { seg: 10, rings: 7, sy: 1.2 }); kit.cyl(felt(INK), 0.006, 0.006, 0.3, 0, -0.38, 0, { seg: 4 }); }, back + 0.24, 1.75 + (j % 2) * 0.5, z - 1.1 + j * 0.44));
      const ball = obj(root, new T.SphereGeometry(0.09, 10, 8), raw('felt', 0xf3dfa5), 0, -5, 0); ball.castShadow = false;
      stalls.push({ stall: st, items, ball });
    });
    // 摊位之间和两头：灌木、花
    for (const [x, z, r] of [[32.4, -14.6, 0.5], [32.5, -10.4, 0.45], [32.5, -6.3, 0.45], [32.4, -2.2, 0.5]]) if (!isTourWalkable(x, z, 0.5)) P.shrub(k, d, x, z, r, seed++);
    for (const [x, z] of [[32.9, -10.5], [32.9, -6.2]]) if (!isTourWalkable(x, z, 0.3)) P.flowerPatch(d, x, z, 3, 0.4, seed++);
  }

  // ====================================================================== 08 碰碰车（docs/park-refs/ref-08-bumpers.png）
  use('bumpers');
  const cars = [];
  {
    const R = RINK, BLUE = 0x4a6a9f, anchor = [R.x, R.z, R.rx + 1.5];
    const rimAt = (a, grow = 0) => [R.x + Math.cos(a) * (R.rx + grow), R.z + Math.sin(a) * (R.rz + grow)];
    // 场地：一整块蓝毛毡，上面的针脚缝出一格一格的拼布
    for (let i = 0; i < 56; i++) { const p = rimAt(i * TAU / 56, 0.1), q = rimAt((i + 1) * TAU / 56, 0.1); k.quad(wool(BLUE), [R.x, 0.15, R.z], [p[0], 0.15, p[1]], [q[0], 0.15, q[1]], [q[0], 0.15, q[1]], [[R.x, R.z], p, q, q], 1, [0, 1, 0]); }
    k.sphere(wool(NAVY), 1, R.x, 0.07, R.z, { seg: 40, rings: 4, sx: R.rx + 0.34, sy: 0.075, sz: R.rz + 0.34 });
    for (let x = -4; x <= 4; x += 1.25) { const reach = R.rz * Math.sqrt(Math.max(0, 1 - (x / R.rx) ** 2)) - 0.15; if (reach > 0.3) P.stitch(d, [[R.x + x, 0.158, R.z - reach], [R.x + x, 0.158, R.z + reach]], { color: 0x9fb4d6, len: 0.12, gap: 0.14, t: 0.016 }); }
    for (let z = -2.5; z <= 2.5; z += 1.25) { const reach = R.rx * Math.sqrt(Math.max(0, 1 - (z / R.rz) ** 2)) - 0.15; if (reach > 0.3) P.stitch(d, [[R.x - reach, 0.158, R.z + z], [R.x + reach, 0.158, R.z + z]], { color: 0x9fb4d6, len: 0.12, gap: 0.14, t: 0.016 }); }
    // 软垫围挡：两道鼓鼓的蓝垫子摞起来（不能比坐着的视线高），顶上一行针脚，外面每隔一段钉一颗金星；朝东（朝小径）留一个口
    const gate = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.26, seg = [];
    const pad = () => { if (seg.length > 1) { k.tube(wool(NAVY), seg.map(([x, z]) => [x, 0.34, z]), 0.3, { straight: true, seg: 7 }); k.tube(wool(BLUE), seg.map(([x, z]) => [x, 0.64, z]), 0.2, { straight: true, seg: 7 }); P.stitch(d, seg.map(([x, z]) => [x, 0.845, z]), { len: 0.12, gap: 0.12, t: 0.02 }); } seg.length = 0; };   // 垫子顶在 0.84 米：坐在车里眼睛在 1 米，靠着围挡也看得出去
    for (let i = 0; i <= 56; i++) { const a = i * TAU / 56; if (gate(a)) { pad(); continue; } seg.push(rimAt(a, 0.26)); }
    pad();
    for (let i = 0; i < 14; i++) { const a = (i + 0.5) * TAU / 14; if (gate(a)) continue; const [x, z] = rimAt(a, 0.57); P.star(k, GOLD, 0.2, x, 0.42, z, Math.atan2(Math.cos(a), Math.sin(a)), 0.06); }
    // 入口上的红白拱门（参考图）：一截红一截白的毛毡卷，中间一块红圆牌、一颗金星，两根木桩托着
    const [gx, gz] = rimAt(0, 0.45), arch = Array.from({ length: 13 }, (_, i) => { const a = Math.PI * i / 12; return [gx, 0.9 + Math.sin(a) * 2.1, gz + Math.cos(a) * 1.75]; });
    for (let i = 1; i < arch.length; i++) { k.tube(wool(i % 2 ? RED : WOOL_WHITE), [arch[i - 1], arch[i]], 0.22, { straight: true, seg: 8 }); d.cyl(felt(THREAD), 0.228, 0.228, 0.02, arch[i][0], arch[i][1], arch[i][2], { seg: 8, rx: Math.PI / 2 - Math.PI * i / 12 }); }
    for (const s of [-1, 1]) P.post(k, gx, gz + s * 1.75, { h: 0.95, r: 0.12, cap: GOLD });
    k.sphere(wool(RED), 0.62, gx, 3.12, gz, { seg: 14, rings: 8, sx: 0.4, sy: 0.82 });
    for (const s of [-1, 1]) { P.star(k, GOLD, 0.34, gx + s * 0.25, 3.12, gz, s * Math.PI / 2, 0.06); P.stitch(d, Array.from({ length: 21 }, (_, i) => { const a = i * TAU / 20; return [gx + s * 0.2, 3.12 + Math.sin(a) * 0.43, gz + Math.cos(a) * 0.52]; }), { len: 0.07, gap: 0.06, t: 0.014 }); }
    for (const [x, z, r] of [[R.x - 5.9, R.z - 2.2, 0.6], [R.x - 5.6, R.z + 2.6, 0.55], [R.x + 1.5, R.z - 4.6, 0.5]]) if (!isTourWalkable(x, z, 0.5)) P.shrub(k, d, x, z, r, seed++);
    for (const [x, z] of [[R.x - 5.0, R.z - 3.2], [R.x - 2.0, R.z + 4.3]]) if (!isTourWalkable(x, z, 0.4)) P.flowerPatch(d, x, z, 4, 0.7, seed++);
    // 小车（参考图）：圆滚滚的车身、一圈黑缓冲垫（上面一行针脚）、两只米白的车灯、褐色的座、方向盘、小旗杆
    const tones = [0xd9776a, 0x3f9b98, 0xf0c35c, 0xb9a4cf];
    for (let i = 0; i < PARK.bumpers.cars; i++) cars.push(part(root, (kit, det) => {
      kit.sphere(felt(INK), 0.6, 0, 0.16, 0, { seg: 14, rings: 7, sx: 0.98, sy: 0.32, sz: 1.22 }); kit.sphere(knit(tones[i]), 0.52, 0, 0.3, 0, { seg: 14, rings: 8, sx: 0.96, sy: 0.5, sz: 1.2 });   // 车身用针织：人坐在里面贴着看
      P.stitch(det, Array.from({ length: 29 }, (_, j) => { const a = j * TAU / 28; return [Math.sin(a) * 0.575, 0.2, Math.cos(a) * 0.715]; }), { len: 0.07, gap: 0.07, t: 0.014 });
      kit.sphere(felt(0x6b4a3a), 0.3, 0, 0.44, -0.08, { seg: 10, rings: 6, sx: 1.05, sy: 0.4, sz: 1.1 }); box(kit, felt(0x6b4a3a), 0.6, 0.42, 0.14, 0, 0.66, -0.42, 0.06);
      kit.tube(ink, [[0, 0.44, 0.52], [0, 0.6, 0.44]], 0.022, { straight: true }); kit.cyl(ink, 0.11, 0.11, 0.03, 0, 0.61, 0.43, { seg: 12, rx: 1.1 });   // 方向盘：低、靠前，坐着的时候在视线下沿
      for (const s of [-1, 1]) kit.sphere(felt(0xf6efe0), 0.075, s * 0.26, 0.34, 0.56, { seg: 8, rings: 5 });
      P.stitch(det, [[-0.32, 0.5, 0.36], [0, 0.535, 0.5], [0.32, 0.5, 0.36]], { len: 0.05, gap: 0.045, t: 0.012 });
      kit.tube(felt(0xd9b98c), [[-0.3, 0.5, -0.5], [-0.3, 1.5, -0.5]], 0.015, { straight: true, seg: 4 });
      kit.extrude(felt(tones[(i + 1) % 4]), [[0, 0.1], [0.3, 0], [0, -0.1]], 0.012, new T.Matrix4().makeTranslation(-0.3, 1.4, -0.5));
    }, 0, 0, 0, true, anchor));
  }

  // ====================================================================== 09 镜子迷宫（docs/park-refs/ref-09-mirrors.png）
  use('maze');
  {
    // 镜面：一块很光的金属面，照出天和周围的颜色。所有镜板并成一组网格
    const mirror = new T.MeshStandardMaterial({ color: 0xd4ecf2, metalness: 1, roughness: 0.07, envMapIntensity: 1.3 }); mirror.userData.noShadow = true;
    const frame = felt(0x9cc7d0);
    for (const wall of TOUR_MAZE) {
      const length = Math.max(wall.w, wall.d), wide = wall.w > wall.d, cols = Math.max(1, Math.round(length / 1.3));
      for (let i = 0; i <= cols; i++) {   // 立柱：米白的圆柱，柱顶一颗金球
        const delta = length * (i / cols - 0.5), x = wall.x + (wide ? delta : 0), z = wall.z + (wide ? 0 : delta);
        k.cyl(wool(WOOL_WHITE), 0.075, 0.085, 2.3, x, 1.15, z, { seg: 8 }); k.sphere(wool(GOLD), 0.1, x, 2.42, z, { seg: 7, rings: 5 });
      }
      for (let i = 0; i < cols; i++) {
        const delta = length * ((i + 0.5) / cols - 0.5), x = wall.x + (wide ? delta : 0), z = wall.z + (wide ? 0 : delta), w = length / cols;
        box(k, frame, wide ? w : 0.2, 0.14, wide ? 0.2 : w, x, 2.28, z, 0.04); box(k, frame, wide ? w : 0.2, 0.16, wide ? 0.2 : w, x, 0.08, z, 0.04);
        k.box(mirror, wide ? w - 0.12 : 0.09, 2.0, wide ? 0.09 : w - 0.12, x, 1.18, z);
      }
      for (const side of [-1, 1]) { const off = side * 0.105; P.stitch(d, wide ? [[wall.x - length / 2 + 0.1, 2.28, wall.z + off], [wall.x + length / 2 - 0.1, 2.28, wall.z + off]] : [[wall.x + off, 2.28, wall.z - length / 2 + 0.1], [wall.x + off, 2.28, wall.z + length / 2 - 0.1]], { len: 0.08, gap: 0.08, t: 0.014 }); }
    }
    const ax = 20.6, az = 19.9;   // 入口的拱门（东头）：两根米白的柱子、红布墩，一道红拱包着金边，顶上一颗星
    for (const s of [-1, 1]) { k.cyl(wool(WOOL_WHITE), 0.17, 0.18, 2.6, ax, 1.4, az + s * 1.25, { seg: 12 }); k.cyl(wool(RED), 0.24, 0.27, 0.34, ax, 0.17, az + s * 1.25, { seg: 12 }); k.sphere(wool(GOLD), 0.17, ax, 2.84, az + s * 1.25, { seg: 9, rings: 6 });
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.6; P.stitch(d, [[ax + Math.sin(a) * 0.18, 0.4, az + s * 1.25 + Math.cos(a) * 0.18], [ax + Math.sin(a) * 0.172, 2.6, az + s * 1.25 + Math.cos(a) * 0.172]], { color: 0xfffaf0, len: 0.09, gap: 0.1, t: 0.014 }); } }
    const hoopLine = r => Array.from({ length: 11 }, (_, i) => { const a = Math.PI * i / 10; return [ax, 2.6 + Math.sin(a) * r * 0.64, az + Math.cos(a) * r]; });
    k.tube(wool(RED), hoopLine(1.25), 0.18, { seg: 8 }); k.tube(wool(GOLD), hoopLine(1.02).map(([x, y, z]) => [x + 0.06, y - 0.08, z]), 0.07, { seg: 6 });
    P.stitch(d, hoopLine(1.25).map(([x, y, z]) => [x + 0.185, y, z]), { len: 0.1, gap: 0.09, t: 0.02 });
    P.star(k, GOLD, 0.32, ax + 0.14, 3.56, az, Math.PI / 2, 0.1);
    // 哈哈镜：路上迎面的三块镜板里是被拉长、压扁、扭歪的绒仔
    picture('mirror-tall.webp', 0.98, 1.96, 13.05 + 0.06, 1.18, 19.935, Math.PI / 2);
    picture('mirror-wide.webp', 0.98, 1.96, 13.0, 1.18, 13 + 0.06, 0);
    picture('mirror-wavy.webp', 0.98, 1.96, 9.28 + 0.06, 1.18, 15.2325, Math.PI / 2);
    for (const [x, z, r] of [[21.4, 17.6, 0.5], [21.3, 22.4, 0.5], [4.9, 13.4, 0.55], [13.0, 23.2, 0.5]]) if (!isTourWalkable(x, z, 0.5)) P.shrub(k, d, x, z, r, seed++);
  }

  // ====================================================================== 10 马戏团（docs/park-refs/ref-10-bigtop.png）
  use('bigtop');
  const tentLights = [], performers = [], hoop = group(root, STAGE.x - 2.0, 0.5, STAGE.z + 1.4); let gong, spot;
  {
    const tnt = TOUR_TENT, N = 28, at = (theta, y, r = tnt.radius) => [Math.sin(theta) * r, y, Math.cos(theta) * r];
    k.cyl(wool(0xc9a877), tnt.radius - 0.16, tnt.radius - 0.16, 0.09, 0, 0.04, 0, { seg: 48 });
    const stripe = [wool(0xf1e3c0), wool(RED)], inner = [wool(0xc9aa82), wool(0xa05151)];   // 帐布：米白和红相间；里面那一面暗一点
    for (let i = 0; i < N; i++) {
      if (i === 0 || i === 1 || i === N - 1) continue;
      const a = (i - 0.5) * TAU / N, b = (i + 0.5) * TAU / N, aa = (a + b) / 2;
      k.quad(stripe[i % 2], at(b, 0.017), at(a, 0.017), at(a, 3.85), at(b, 3.85), [[b * tnt.radius, 0], [a * tnt.radius, 0], [a * tnt.radius, 3.85], [b * tnt.radius, 3.85]], 1, [Math.sin(aa), 0, Math.cos(aa)]);
      P.stitch(d, [at(a, 0.2, tnt.radius + 0.012), at(a, 3.7, tnt.radius + 0.012)], { len: 0.2, gap: 0.2, t: 0.03 });   // 每道缝一行大针脚
      k.quad(inner[i % 2], at(b, 0.017, tnt.radius - 0.045), at(a, 0.017, tnt.radius - 0.045), at(a, 3.85, tnt.radius - 0.045), at(b, 3.85, tnt.radius - 0.045), [[0, 0], [1, 0], [1, 3.2], [0, 3.2]], 0.52, [-Math.sin(aa), 0, -Math.cos(aa)]);
    }
    {   // 帐顶：28 片红白相间的毛毡，缝上是大针脚；檐口一圈金色的扇贝边，每个尖上一颗金球
      const top = new PlushKit(), tdet = new PlushKit(); canopy(top, tdet, tnt.radius + 0.38, 3.82, 9.2, [stripe[1], stripe[0]], N, { seam: { len: 0.3, gap: 0.3, t: 0.035 }, mid: false });
      k.merge(top, 0, 0, 0, -0.5 * TAU / N); d.merge(tdet, 0, 0, 0, -0.5 * TAU / N);
      const cusps = P.valance(k, wool(GOLD), 0, 3.86, 0, tnt.radius + 0.42, N, 0.62, { band: 0.24, a0: 0.5 * TAU / N, pipe: 0xf6e3a1, pipeKit: d, pipeR: 0.035 });
      for (const q of cusps) k.sphere(wool(GOLD), 0.13, q.x * 1.006, q.y - 0.02, q.z * 1.006, { seg: 7, rings: 5 });
      k.tube(wool(0xf6e3a1), P.arc(0, 3.9, 0, tnt.radius + 0.43, 0, TAU, 56), 0.08, { straight: true, seg: 6, caps: false });
      P.ring(d, 0, 3.72, 0, tnt.radius + 0.47, { len: 0.16, gap: 0.14, t: 0.024 });
    }
    for (let i = 2; i < N - 1; i += 2) { const a = i * TAU / N; box(k, wool(GOLD), 0.4, 0.4, 0.03, ...at(a, 1.7, tnt.radius + 0.03), 0.02, { ry: a, rz: Math.PI / 4 }); box(k, wool(CORAL), 0.2, 0.2, 0.03, ...at(a, 1.7, tnt.radius + 0.05), 0.02, { ry: a, rz: Math.PI / 4 }); }   // 帐布上的菱形
    [['poster-circus-1.webp', -2.5, 11.9, 0.34], ['poster-circus-2.webp', 5.3, 12.9, -0.42], ['poster-circus-3.webp', -4.3, 9.6, 0.5]].forEach(([file, x, z, yaw]) => {   // 海报牌：朝着从南边走来的人
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (const e of [-1, 1]) box(k, wood, 0.1, 2.5, 0.1, x + e * 0.66 * fz, 1.25, z - e * 0.66 * fx, 0.03);
      box(k, M('boards', 0x9a6f4c), 1.34, 1.74, 0.07, x, 1.6, z, 0.03, { ry: yaw }); box(k, red, 1.5, 0.14, 0.16, x, 2.56, z, 0.04, { ry: yaw }); puff(k, gold, 0.09, x, 2.72, z);
      picture(file, 1.2, 1.6, x + fx * 0.05, 1.6, z + fz * 0.05, yaw);
    });
    for (const side of [-1, 1]) {   // 门口：两根红柱、束起来的门帘
      const x = side * 2.02; box(k, wool(RED), 0.44, 4.11, 0.46, x, 2.05, 7.40, 0.10); k.sphere(wool(GOLD), 0.18, x, 3.98, 7.64, { seg: 9, rings: 6 });
      puff(k, wool(RED), 0.62, x + side * 0.3, 2.6, 7.5, { sx: 0.9, sy: 1.9, sz: 0.4, seg: 12, rings: 8 }); puff(k, wool(0xc9584f), 0.4, x + side * 0.5, 1.1, 7.5, { sx: 0.8, sy: 1.6, sz: 0.4, seg: 12, rings: 8 }); puff(k, wool(GOLD), 0.3, x + side * 0.72, 1.0, 7.56, { sx: 0.5, sy: 1.5, sz: 0.3 });
      k.tube(wool(GOLD), [[x + side * 0.05, 1.75, 7.72], [x + side * 0.75, 1.75, 7.72]], 0.06, { straight: true, seg: 6 }); k.sphere(wool(GOLD), 0.13, x + side * 0.78, 1.75, 7.74, { seg: 8, rings: 5 });
      P.stitch(d, [[x + side * 0.02, 3.6, 7.64], [x + side * 0.02, 0.3, 7.64]], { color: GOLD, len: 0.12, gap: 0.1, t: 0.02 });
    }
    box(k, wool(RED), 4.4, 0.35, 0.40, 0, 3.87, 7.54, 0.073); sign(copy('马戏团', 'BIG TOP'), 0, 3.74, 7.78, 3.61);
    P.valanceLine(k, wool(GOLD), [-1.8, 7.76], [1.8, 7.76], 3.3, 6, 0.3, { band: 0.06 });
    k.cyl(wool(GOLD), 0.09, 0.11, 1.5, 0, 9.8, 0, { seg: 10 }); k.cyl(wool(RED), 0.3, 0.36, 0.2, 0, 9.22, 0, { seg: 14 }); k.sphere(wool(GOLD), 0.2, 0, 10.7, 0, { seg: 10, rings: 7 });   // 顶上的旗杆和旗
    k.extrude(wool(RED), [[0, 0.34], [0.5, 0.26], [0.95, 0.36], [1.5, 0.24], [1.3, 0], [1.5, -0.2], [0.95, -0.3], [0.5, -0.22], [0, -0.32]], 0.05, new T.Matrix4().makeTranslation(0.08, 10.1, 0));
    P.stitch(d, [[0.2, 10.1, 0.03], [0.6, 10.14, 0.03], [1.0, 10.06, 0.03], [1.3, 10.02, 0.03]], { color: GOLD, len: 0.09, gap: 0.08, t: 0.02 });
    for (const [x, z] of [[-9.6, 2.4], [9.6, 2.4]]) {   // 两侧的小帐：一样的红白帐布、金扇贝边、尖顶上一颗金球
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12, b = (i + 1) * TAU / 12, m = (a + b) / 2, q = t => [x + Math.sin(t) * 1.9, z + Math.cos(t) * 1.9]; const [ax2, az2] = q(a), [bx2, bz2] = q(b);
        k.quad(stripe[i % 2], [bx2, 0, bz2], [ax2, 0, az2], [ax2, 2.0, az2], [bx2, 2.0, bz2], [[b * 1.9, 0], [a * 1.9, 0], [a * 1.9, 2], [b * 1.9, 2]], 1, [Math.sin(m), 0, Math.cos(m)]); }
      const top = new PlushKit(), tdet = new PlushKit(); canopy(top, tdet, 2.2, 1.98, 4.2, [stripe[1], stripe[0]], 12, { seam: { len: 0.2, gap: 0.2, t: 0.028 }, mid: false }); k.merge(top, x, 0, z); d.merge(tdet, x, 0, z);
      P.valance(k, wool(GOLD), x, 2.02, z, 2.22, 12, 0.4, { band: 0.14 }); k.cyl(wool(GOLD), 0.07, 0.09, 0.5, x, 4.4, z, { seg: 8 }); k.sphere(wool(GOLD), 0.15, x, 4.72, z, { seg: 9, rings: 6 });
    }
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18, b = (i + 0.5) * TAU / 18; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4) continue;   // 外面一圈三角旗
      const p = at(a, 4.0, tnt.radius + 0.5), q = at((i + 1) * TAU / 18, 4.0, tnt.radius + 0.5), m = at(b, 3.55, tnt.radius + 0.5);
      k.quad(felt([GOLD, TEAL, CORAL, CREAM][i % 4]), p, q, m, m, undefined, 1, [Math.sin(b), 0, Math.cos(b)]); }
    // 里面：一圈红白的场沿、锯末地、圆台、看台、从顶上拉下来的灯串
    k.cyl(wool(0xd9b98a), 3.9, 3.9, 0.03, 0, 0.1, -1.5, { seg: 48 }); P.ring(d, 0, 0.12, -1.5, 3.6, { color: 0x9c7a55, len: 0.14, gap: 0.12, t: 0.02 });
    for (let i = 0; i < 24; i++) { const a = i * TAU / 24; if (Math.cos(a) > 0.86) continue; box(k, wool(i % 2 ? RED : 0xf1e3c0), 1.06, 0.3, 0.34, Math.sin(a) * 4.0, 0.2, -1.5 + Math.cos(a) * 4.0, 0.08, { ry: a }); }
    box(k, M('boards', 0x9a6f4c), 3.4, 0.36, 2.4, STAGE.x, 0.22, STAGE.z, 0.06); k.cyl(wool(GOLD), 1.0, 1.08, 0.3, STAGE.x, 0.55, STAGE.z, { seg: 24 }); k.cyl(wool(RED), 0.62, 0.7, 0.36, STAGE.x + 1.2, 0.58, STAGE.z + 0.2, { seg: 18 }); k.cyl(wool(TEAL), 0.62, 0.7, 0.36, STAGE.x - 1.2, 0.58, STAGE.z + 0.2, { seg: 18 });
    P.star(k, RED, 0.5, STAGE.x, 0.71, STAGE.z, 0, 0.02); for (const [dx, c] of [[0, RED], [1.2, GOLD], [-1.2, GOLD]]) P.ring(d, STAGE.x + dx, dx ? 0.77 : 0.71, STAGE.z + (dx ? 0.2 : 0), dx ? 0.52 : 0.9, { color: dx ? THREAD : c, len: 0.08, gap: 0.07, t: 0.016 });
    for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 16; i++) { const a = Math.PI * (0.62 + i * 0.76 / 15), r = 5.2 + tier * 0.72; box(k, M('boards', tier % 2 ? 0xb98a66 : 0x9a7250), 1.24 + tier * 0.16, 0.3, 0.7, Math.sin(a) * r, 0.25 + tier * 0.38, -0.6 + Math.cos(a) * r, 0.04, { ry: a }); }
    for (const [x, z] of [[-1.6, 1.4], [1.6, 1.4]]) { k.cyl(wool(RED), 0.09, 0.1, 8.4, x * 2.2, 4.2, z * 1.5 - 1.5, { seg: 8 }); for (const y of [0.3, 2.8, 5.4]) k.cyl(wool(GOLD), 0.12, 0.12, 0.12, x * 2.2, y, z * 1.5 - 1.5, { seg: 8 }); }   // 两根撑帐子的柱
    const strings = [0, 1, 2, 3].map(() => new PlushKit()), lamps = strings.map(() => { const m = glow(0xffd884, 2.2); m.userData.noShadow = true; return m; });   // 灯串：分四组，每组一个网格，开演时一组一组地闪
    for (let j = 0; j < 8; j++) { const a = j * TAU / 8 + 0.2; k.tube(ink, [[0, 8.6, 0], [Math.sin(a) * 3.4, 5.6, Math.cos(a) * 3.4], [Math.sin(a) * 6.9, 3.7, Math.cos(a) * 6.9]], 0.012, { straight: true });
      for (let t = 1; t <= 4; t++) { const f = t / 4.6, r = 6.9 * f, y = 8.6 - (8.6 - 3.7) * (f * 0.75 + f * f * 0.25); strings[(j + t) % 4].sphere(lamps[(j + t) % 4], 0.09, Math.sin(a) * r, y, Math.cos(a) * r, { seg: 8, rings: 5 }); } }
    strings.forEach(kit => { const [mesh] = kit.build({ cast: false, name: 'tent-lights' }); root.add(mesh); tentLights.push(mesh); });
    spot = obj(root, new T.CylinderGeometry(1.5, 1.5, 0.012, 28), new T.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false }), STAGE.x, 0.72, STAGE.z);
    // 锣：台子右前方的架子上
    box(k, wood, 0.1, 1.5, 0.1, 1.5, 0.75, -2.2, 0.03); box(k, wood, 0.1, 1.5, 0.1, 2.3, 0.75, -2.2, 0.03); box(k, wood, 1.0, 0.1, 0.1, 1.9, 1.5, -2.2, 0.03);
    gong = part(root, kit => { kit.cyl(gold, 0.34, 0.34, 0.04, 0, -0.42, 0, { seg: 20, rx: Math.PI / 2 }); kit.cyl(felt(0xc98f3a), 0.12, 0.12, 0.05, 0, -0.42, 0, { seg: 12, rx: Math.PI / 2 }); kit.tube(ink, [[-0.2, 0, 0], [-0.2, -0.14, 0]], 0.01, { straight: true }); kit.tube(ink, [[0.2, 0, 0], [0.2, -0.14, 0]], 0.01, { straight: true }); }, 1.9, 1.46, -2.2);
    // 三位演员：熊、两只兔子
    const animal = (tone, ears, x, z) => part(root, kit => {
      const body = wool(tone);
      puff(kit, body, 0.34, 0, 0.36, 0, { sy: 1.1, seg: 12, rings: 8 }); puff(kit, body, 0.27, 0, 0.86, 0, { seg: 12, rings: 8 }); puff(kit, felt(0xf6efe0), 0.12, 0, 0.8, 0.22); kit.sphere(M.button(INK), 0.03, 0, 0.83, 0.335, { seg: 6, rings: 4 });
      for (const s of [-1, 1]) { puff(kit, ink, 0.035, s * 0.1, 0.92, 0.23); puff(kit, body, 0.12, s * 0.3, 0.45, 0.05, { sy: 1.5 }); puff(kit, body, 0.13, s * 0.15, 0.08, 0.05, { sy: 0.7 });
        if (ears === 'long') puff(kit, body, 0.08, s * 0.12, 1.28, 0, { sy: 2.6 }); else puff(kit, body, 0.1, s * 0.2, 1.08, 0); }
      for (const s of [-1, 1]) kit.sphere(wool(RED), 0.07, s * 0.08, 0.63, 0.25, { seg: 6, rings: 4, sx: 1.4, sz: 0.6 }); kit.sphere(wool(GOLD), 0.035, 0, 0.63, 0.27, { seg: 5, rings: 3 });   // 领结
    }, x, 0.7, z, true);
    performers.push(animal(0x9a6a4c, 'round', STAGE.x, STAGE.z), animal(0xf1e6d2, 'long', STAGE.x + 1.2, STAGE.z + 0.2), animal(0xd9b8a8, 'long', STAGE.x - 1.2, STAGE.z + 0.2));
    performers.forEach((g, i) => { g.userData.home = g.position.clone(); g.userData.i = i; });
    part(hoop, kit => { kit.tube(gold, Array.from({ length: 21 }, (_, i) => { const a = i * TAU / 20; return [0, 1.5 + Math.sin(a) * 0.6, Math.cos(a) * 0.6]; }), 0.05, { straight: true }); box(kit, wood, 0.08, 0.9, 0.08, 0, 0.45, 0, 0.03); });
    hoop.visible = false;
  }
  const juggle = [0, 1, 2].map(i => { const m = obj(root, new T.SphereGeometry(0.1, 10, 8), raw('felt', [RED, GOLD, TEAL][i]), 0, -5, 0); m.castShadow = false; return m; });

  // 每块两组网格：主体投影，小装饰不投影、记下它的位置好在走远时关掉
  for (const [id, q] of zones) {
    const main = q.s.build({ cast: true, name: 'park:' + id }); if (main.length) root.add(...main);
    const extra = q.d.build({ cast: false, name: 'detail:' + id }); if (!extra.length) continue;
    root.add(...extra);
    const bounds = new T.Box3(); extra.forEach(m => { m.geometry.computeBoundingBox(); bounds.union(m.geometry.boundingBox); });
    details.push({ meshes: extra, x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2, r: Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2 });
  }
  cine.shadows.invalidate();

  // ---------- 每帧：照规则层的状态摆 ----------
  function ride(g, at, lift = 0) {   // 沿轨道放一个东西：朝着前进的方向，可以抬头低头，但不侧倾
    g.position.set(at.x, at.y + lift, at.z);
    g.rotation.set(0, 0, 0); g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(at.tx, at.tz); g.rotation.x = -Math.asin(Math.max(-1, Math.min(1, at.ty)));
  }
  let clock = 0;
  function update(s, dt = 0) {
    const park = s.park; if (!park) return;
    const eye = cine.camera.position;   // 小装饰：离人超过 DETAIL_RANGE 的整层关掉
    for (const q of details) { const on = Math.hypot(eye.x - q.x, eye.z - q.z) < q.r + DETAIL_RANGE; if (q.on !== on) { q.on = on; for (const m of q.meshes) m.visible = on; } }
    clock += dt * (reduced ? 0.5 : 1);
    const t = park.time;
    // 木马：整个伞顶和马一起转；两组马一上一下
    carousel.rotation.y = park.carouselAngle;
    const bob = park.running.carousel > 0 ? Math.min(1, park.running.carousel / 2, (PARK.carousel.time - park.running.carousel) / 2) : 0;
    horsesA.position.y = Math.sin(park.carouselAngle * 3.2) * 0.16 * bob; horsesB.position.y = -Math.sin(park.carouselAngle * 3.2) * 0.16 * bob;
    // 船：一条在跑（或停在码头），另一条拴在码头边上轻轻晃
    ride(boats[0], RAPIDS.at(park.boatU), 0.05 + Math.sin(t * 2.1) * 0.02);
    const moored = RAPIDS.at(.93);
    ride(boats[1], { ...moored, z: moored.z + 1.08 }, .05 + Math.sin(t * 1.7 + 1) * .02);
    // 过山车
    ride(train, COASTER.at(park.coasterU), 0.02);
    // 摩天轮：轮子转，吊舱始终朝下
    wheel.rotation.z = park.wheelAngle;
    cabins.forEach((g, i) => { const a = i * TAU / WHEEL.cars; g.position.set(Math.cos(a) * WHEEL.r, Math.sin(a) * WHEEL.r, 0); g.rotation.z = -park.wheelAngle + Math.sin(t * 0.9 + i) * 0.02; });
    // 碰碰车：被撞的那一下车身抖一抖
    park.cars.forEach((c, i) => { const g = cars[i]; g.position.set(c.x, 0.12, c.z); g.rotation.y = c.heading; g.rotation.z = c.bump > 0 ? Math.sin(c.bump * 60) * 0.06 : 0; });
    // 鬼屋：门绕门轴往里开；敲门后窗里的幽灵探一下头；摇铃后三只幽灵挨个从肖像上面的墙里飘出来，画框跟着晃
    const sat = v => Math.max(0, Math.min(1, v));
    door.rotation.y = -park.door * 1.75;
    const peek = park.running.haunt > 0 ? sat(Math.min(park.running.haunt / 0.8, (PARK.haunt.time - park.running.haunt) / 1.0)) : 0;
    windowGhosts.forEach(([g, x, y, z], i) => { const out = sat(peek * 1.4 - i * 0.3); g.position.set(x, y + Math.sin(t * 2.4 + i) * 0.06 * out, z - out * 0.62); g.scale.setScalar(0.4 + out * 0.6); g.visible = out > 0.02; });
    const ring = park.running.portraits > 0 ? park.running.portraits : 0;
    portraitGhosts.forEach(([g, x, y, z], i) => {
      const out = ring > 0 ? sat(Math.min((ring - i * 0.7) / 0.9, (PARK.haunt.show - ring) / 1.0)) : 0;
      g.position.set(x + Math.sin(t * 1.7 + i * 2) * 0.1 * out, y + Math.sin(t * 2.4 + i) * 0.06 * out, z - out * 1.02); g.scale.setScalar(0.5 + out * 0.5); g.visible = out > 0.02;
      frames[i].rotation.z = Math.sin(t * 5 + i * 1.3) * 0.045 * out;
    });
    bell.rotation.z = ring > 0 && ring < 1.8 ? Math.sin(ring * 24) * 0.55 * (1 - ring / 1.8) : 0;
    for (const { stall, items, ball } of stalls) {
      const round = park.stall?.id === stall.id ? park.stall : null;
      const time = round?.time ?? t;
      const shot = round?.flight;
      ball.visible = !!shot;
      if (shot) {
        const f = sat((time - shot.start) / (shot.end - shot.start)), a = shot.from, b = shot.to;
        ball.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * .10, a.z + (b.z - a.z) * f);
      }
      items.forEach((g, i) => {
        const hit = round?.hitAt[i];
        const down = hit == null ? 0 : sat((time - hit) / (stall.id === 'balloons' ? .18 : .56));
        const at = stallTarget(stall, i, hit ?? time);
        const base = stall.id === 'blocks' ? .15 : stall.id === 'ducks' ? .23 : 0;
        const fall = stall.id === 'blocks' ? down * down * .54 : stall.id === 'ducks' ? down * .34 : 0;
        g.position.set(at.x - down * .22, at.y - base - fall, at.z + (i % 2 ? 1 : -1) * down * .20);
        g.rotation.set(stall.id === 'ducks' ? -down * 1.6 : 0, 0, stall.id === 'blocks' ? (i % 2 ? 1 : -1) * down * 1.6 : 0);
        g.scale.setScalar(stall.id === 'balloons' && down ? Math.max(.01, down < .25 ? 1 + down : (1 - down) * 1.7) : 1);
        g.visible = down < 1;
      });
    }
    // 马戏团：开演的时候灯串亮起来、台上打一束光，三位演员按节目动
    const show = park.running.circus, on = show > 0 ? Math.min(1, show / 1.2, (PARK.circus.time - show) / 1.5) : 0;
    tentLights.forEach((m, i) => { m.material.emissiveIntensity = 2.2 * (1 + on * (0.9 + 0.7 * Math.sin(t * 5 + i * 1.6))); });
    spot.material.opacity = on * 0.5; hoop.visible = on > 0 && park.act === 3;
    performers.forEach(g => {
      const home = g.userData.home, i = g.userData.i; g.position.copy(home); g.rotation.set(0, 0, 0);
      if (!(on > 0)) { g.position.y += Math.sin(t * 1.4 + i) * 0.015; return; }
      if (park.act === 1) { if (i === 0) g.rotation.y = show * 2.2; else g.position.y += Math.abs(Math.sin(show * 3.2 + i)) * 0.35 * on; }   // 熊转圈抛球，兔子打拍子
      else if (park.act === 2) { const hop = Math.abs(Math.sin(show * 2.6 + i * 1.05)); g.position.y += hop * 0.9 * on; g.rotation.y = Math.sin(show * 1.3 + i) * 0.8; }   // 轮流蹦高
      else { const phase = ((show * 0.42 + i / 3) % 1), x = home.x - 3.2 + phase * 6.4; g.position.set(STAGE.x + (x - STAGE.x) * on + home.x * (1 - on) * 0, home.y + Math.sin(phase * Math.PI) * 1.3 * on, STAGE.z + 1.4); g.rotation.y = Math.PI / 2; }   // 挨个跳圈
    });
    juggle.forEach((m, i) => { if (on > 0 && park.act === 1) { const a = show * 4 + i * TAU / 3; m.position.set(STAGE.x + Math.cos(a) * 0.45, 2.3 + Math.sin(a) * 0.5, STAGE.z + 0.3); } else m.position.y = -5; });
    gong.rotation.z = show > 0 && show < 2.5 ? Math.sin(show * 22) * 0.25 * (1 - show / 2.5) : 0;
    // 互动点的星星：慢慢转
    for (const m of markers.values()) { m.mesh.rotation.y = clock * 1.4 + m.phase; m.mesh.position.y = 1.32 + Math.sin(clock * 2 + m.phase) * 0.05; }
  }
  update({ park: { time: 0, carouselAngle: 0, running: {}, boatU: 0, coasterU: 0, wheelAngle: 0, cars: Array.from({ length: PARK.bumpers.cars }, () => ({ x: RINK.x, z: RINK.z, heading: 0, bump: 0 })), door: 0, act: 0 } });
  return { update };
}
