// 布偶游乐园的样子。规则在 park-rides.js：这里只读它的状态来摆（木马转到哪、车在轨道的哪一点、门开了多少），
// 自己不决定任何事。准则在 docs/park-design.md 第 5 节：照概念图做、会动的部件单独成组、从路上看得到的那一面做细。
import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { plush, plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { mulberry32 } from '../../cine-engine/engine/noise.js';
import { uiCanvasFont } from './interface-font.js';
import { copy } from './language.js';
import { TOUR_PATH, TOUR_STOPS, TOUR_BOUNDS, TOUR_TENT, TOUR_MAZE, TOUR_BRIDGE, TOUR_CHANNEL, isTourWalkable,
  COASTER, RAPIDS, WHEEL, CAROUSEL, RINK, HAUNT, STALLS, STAGE } from './park-tour-layout.js';
import { PARK, SPOTS } from './park-rides.js';

const TAU = 2 * Math.PI;
const RED = 0xb85652, CREAM = 0xf1ddb0, TEAL = 0x3b8590, GOLD = 0xe3af55, INK = 0x3e3640, CORAL = 0xd9776a, NAVY = 0x4a6a8f;
const FOREST = 0x657b4d, MOSS = 0x94a163, PINE = 0x386951, PLUM = 0x6b5a76, PLUM_DARK = 0x4d4058;

export function createParkTour(cine, world, { reduced = false } = {}) {
  const root = new T.Group(); root.name = 'Stitched amusement park'; world.root.add(root);
  const M = plushMaterials(world.lib, { lit: m => world.volume.light(m) });
  const felt = c => M('felt', c), quilt = c => M('quilt', c), knit = c => M('knit', c), wood = M('toy_wood');
  const cream = felt(CREAM), red = felt(RED), teal = felt(TEAL), gold = felt(GOLD), ink = felt(INK), coral = felt(CORAL), white = felt(0xf6f1e4);
  const raw = (id, color) => world.volume.light(plush(world.lib, id, color));
  const glow = (color, power = 2) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: power, roughness: 0.6 });
  const k = new PlushKit(), rand = mulberry32(231123);
  const box = (kit, m, w, h, d, x, y, z, r = 0.045, o = {}) => kit.soft(m, w, h, d, x, y, z, { r, ...o });
  const puff = (kit, m, r, x, y, z, o = {}) => kit.sphere(m, r, x, y, z, { seg: 10, rings: 7, ...o });
  const finish = (kit, parent = root, cast = true) => { parent.add(...kit.build({ cast })); return parent; };
  const group = (parent = root, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const obj = (parent, geo, mat, x = 0, y = 0, z = 0) => { const mesh = new T.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  // 一个会动的部件：单独一组网格。build 在原点附近造它。
  const part = (parent, build, x = 0, y = 0, z = 0, cast = false) => { const kit = new PlushKit(); build(kit); const g = group(parent, x, y, z); finish(kit, g, cast); return g; };
  const stopOf = id => TOUR_STOPS.find(q => q.id === id);

  // ---------- 招牌 ----------
  function sign(text, x, y, z, w, yaw = 0, parent = root) {
    const canvas = document.createElement('canvas'); canvas.width = 544; canvas.height = 144;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f5dfac'; ctx.beginPath(); ctx.roundRect(4, 4, 536, 136, 28); ctx.fill();
    ctx.strokeStyle = '#99704d'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.strokeRect(19, 16, 506, 111);
    ctx.fillStyle = '#2e4c3e'; ctx.font = uiCanvasFont(56); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, 272, 74, 490);
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
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
  for (const stop of TOUR_STOPS) {
    const [x, z, yaw] = stop.sign;
    for (const side of [-1, 1]) box(k, wood, 0.14, 1.95, 0.14, x + Math.cos(yaw) * side * 1.1, 0.975, z - Math.sin(yaw) * side * 1.1, 0.035);
    sign(copy(stop.name, stop.en), x, 1.72, z, 2.93, yaw);
  }

  // ---------- 小径（地面上的贴图和能走的范围用同一份坐标）----------
  const B = TOUR_BOUNDS, mw = B.maxX - B.minX, md = B.maxZ - B.minZ, px = 24;
  const pathCanvas = document.createElement('canvas'); pathCanvas.width = mw * px; pathCanvas.height = md * px;
  const pc = pathCanvas.getContext('2d'), X = x => (x - B.minX) * px, Z = z => (z - B.minZ) * px;
  pc.lineCap = 'round'; pc.lineJoin = 'round';
  const stroke = (color, grow) => { for (let i = 1; i < TOUR_PATH.length; i++) { const a = TOUR_PATH[i - 1], b = TOUR_PATH[i]; pc.strokeStyle = color; pc.lineWidth = (a.width + b.width + grow) * px; pc.beginPath(); pc.moveTo(X(a.x), Z(a.z)); pc.lineTo(X(b.x), Z(b.z)); pc.stroke(); } };
  stroke('#ae916d', 0.07); stroke('#e3c999', -0.04);
  pc.save(); pc.globalCompositeOperation = 'source-atop';
  pc.fillStyle = '#b8c9b9'; pc.fillRect(X(6), Z(13), 14 * px, 9 * px);
  pc.lineWidth = 0.8; pc.strokeStyle = '#7f674e38';
  for (let y = 0; y < pathCanvas.height; y += 8) { pc.beginPath(); pc.moveTo(0, y); pc.lineTo(pathCanvas.width, y); pc.stroke(); }
  pc.strokeStyle = '#f8e4ad79';
  for (let x = 0; x < pathCanvas.width; x += 9) { pc.beginPath(); pc.moveTo(x, 0); pc.lineTo(x, pathCanvas.height); pc.stroke(); }
  pc.restore();
  pc.strokeStyle = '#62705a'; pc.lineWidth = 2.25; pc.setLineDash([11, 8]); pc.beginPath();
  TOUR_PATH.forEach((p, i) => (i ? pc.lineTo(X(p.x), Z(p.z)) : pc.moveTo(X(p.x), Z(p.z)))); pc.stroke();
  const trailTexture = new T.CanvasTexture(pathCanvas); trailTexture.colorSpace = T.SRGBColorSpace; trailTexture.anisotropy = 4;
  obj(root, new T.PlaneGeometry(mw, md), world.volume.light(new T.MeshStandardMaterial({ map: trailTexture, roughness: 1, alphaTest: 0.45, transparent: true })),
    (B.minX + B.maxX) / 2, 0.031, (B.minZ + B.maxZ) / 2).rotation.x = -Math.PI / 2;
  const beside = (i, offset) => {   // 小径第 i 个点旁边、离中线 offset 倍路宽的地方
    const p = TOUR_PATH[i], a = TOUR_PATH[Math.max(0, i - 1)], b = TOUR_PATH[Math.min(TOUR_PATH.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
    return [p.x - dz / d * p.width * offset, p.z + dx / d * p.width * offset];
  };

  // ---------- 树、石头、灌木、花坛 ----------
  // 设施占的地方不种东西：轨道、摩天轮、碰碰车场、木马、鬼屋、摊位
  const taken = (x, z, pad = 0) => isTourWalkable(x, z, 0.5 + pad)
    || COASTER.points.some(p => Math.hypot(p[0] - x, p[2] - z) < 2.2 + pad) || RAPIDS.points.some(p => Math.hypot(p[0] - x, p[2] - z) < 1.8 + pad)
    || Math.hypot(x - WHEEL.x, z - WHEEL.z) < 6.5 + pad || ((x - RINK.x) / (RINK.rx + 1.2 + pad)) ** 2 + ((z - RINK.z) / (RINK.rz + 1.2 + pad)) ** 2 < 1
    || Math.hypot(x - CAROUSEL.x, z - CAROUSEL.z) < 4.6 + pad || (Math.abs(x + 6.5) < 5.6 + pad && Math.abs(z + 15.7) < 5 + pad)
    || (x > 27.5 - pad && x < 33 + pad && z > -15.5 - pad && z < -1.2 + pad) || Math.hypot(x, z) < 10.2 + pad || (x > 5 - pad && x < 21 + pad && z > 12 - pad && z < 23 + pad)
    || (x < -20.5 + pad && x > -37 - pad && z > -3.6 - pad && z < 9 + pad);
  function tree(x, z, size = 1, orange = false) {
    box(k, knit(0x926844), 0.39 * size, 1.9 * size, 0.43 * size, x, 0.95 * size, z, 0.11);
    const c = orange ? 0xb1914d : rand() > 0.58 ? FOREST : PINE;
    puff(k, M('leaves', c), 1.23 * size, x, 2.63 * size, z, { sy: 1.12 });
    for (const [dx, dz] of [[-0.63, 0.12], [0.69, 0.29], [0.18, -0.65]]) puff(k, M('leaves', orange ? 0xc7a65c : MOSS), 0.62 * size, x + dx * size, 2.5 * size, z + dz * size, { sy: 1.12 });
  }
  const stone = (x, y, z, r) => puff(k, quilt(0x918d82), r, x, y, z, { sx: 1.2, sy: 0.70, sz: 0.91 });
  const bush = (x, z, r) => puff(k, M('leaves', rand() < 0.48 ? MOSS : FOREST), r, x, r * 0.48, z, { sx: 1.15, sy: 0.72 });
  const flowers = (x, z, n = 4, spread = 0.6) => { for (let j = 0; j < n; j++) puff(k, felt([GOLD, 0xd98583, 0xf6f1e4, CORAL][j % 4]), 0.11, x + (rand() - 0.5) * spread, 0.14 + rand() * 0.1, z + (rand() - 0.5) * spread, { sy: 0.65 }); };
  for (let i = 8; i < TOUR_PATH.length - 5; i += 4) for (const side of [-1, 1]) {
    const [x, z] = beside(i, side * 1.22);
    if (taken(x, z, -0.3)) continue;
    const roll = rand();
    if (roll < 0.3) stone(x, 0.23, z, 0.42 + rand() * 0.2); else if (roll < 0.72) bush(x, z, 0.45 + rand() * 0.38); else flowers(x, z, 5, 0.7);
  }
  const trees = [
    [-11, 23, 1.1], [-7, 25, 1.35], [-22, 27.2, 0.98], [-29, 26, 1.12], [-34, 23, 1.15], [-27, 10, 0.92], [-21, 11.9, 1.27], [-17.2, 15, 1.05], [-13.5, 18.0, 1.3],
    [-19.6, 1.0, 1.06], [-11.7, -1.5, 1.1], [-37.9, -12.6, 1.08], [-34.2, -22.3, 1.22], [-28.2, -26.8, 1.33], [-21.0, -27, 1.18],
    [-13.6, -26.8, 1.0], [-1.7, -27.9, 1.03], [5.6, -29.7, 1.42], [12.1, -30.4, 1.19], [26.5, -28.5, 1.32], [34.8, -26.4, 1.27], [38.0, -23.6, 1.12],
    [5.4, -17.8, 1.3], [9.3, -16, 1.1], [12.0, -12.6, 1.21], [26.2, -16.4, 1.14], [24.5, -11.4, 1.24], [25.2, -1.6, 1.05], [19.4, -4.6, 1.29], [19.7, 1, 1.12], [17.3, 6.9, 1.1],
    [12.3, 7.4, 1.19], [-11.4, 12.4, 1.16], [-12.7, 8.3, 1.08], [-5.9, 21.6, 1.1], [14.2, 27.8, 1.35], [20.3, 26.1, 1.02], [28.2, 23.25, 1.24], [33.7, 21.2, 1.2], [37.5, 17, 1.2],
    [-39, 27, 1.3], [-39.2, 2, 1.25], [-38.6, -27, 1.2], [39, -29, 1.3], [39.3, -3, 1.2], [39, 26, 1.25], [0, 30.5, 1.2], [-25, 30.6, 1.1], [25, 30.2, 1.15],
  ];
  trees.forEach(([x, z, r], i) => { if (!taken(x, z)) tree(x, z, r, i % 6 === 0); });
  const apple = felt(0xba644c);   // 中间的果园：结着红果子的树
  for (const [x, z] of [[-12.4, -12.2], [4.6, -13.2], [11.6, -6.2], [-12.6, 4.6], [13.4, 1.6], [-13.6, -4.4]]) {
    if (taken(x, z)) continue;
    tree(x, z, 1.04);
    for (let j = 0; j < 6; j++) { const a = j * TAU / 6; puff(k, apple, 0.14, x + Math.cos(a) * 0.9, 2.2 + rand() * 0.9, z + Math.sin(a) * 0.9); }
  }
  // 南边的三座圆花坛（概念图上入口和帐篷之间）
  for (const [x, z, r] of [[-6.2, 14.2, 1.7], [-1.2, 19.6, 1.9], [4.6, 25.6, 1.6]]) {
    k.cyl(M('boards', 0x9a6f4c), r, r + 0.06, 0.34, x, 0.17, z, { seg: 22 }); k.cyl(M('terry', 0x5f7a45), r - 0.14, r - 0.14, 0.06, x, 0.36, z, { seg: 22 });
    for (let j = 0; j < 12; j++) { const a = j * TAU / 12 + rand(), d = (0.35 + rand() * 0.55) * r; puff(k, felt([GOLD, 0xd98583, CORAL, 0xf6f1e4][j % 4]), 0.13, x + Math.cos(a) * d, 0.46, z + Math.sin(a) * d, { sy: 0.7 }); }
  }

  // ---------- 灯柱和彩旗：沿路两边交替立，相邻两根之间拉一串小旗 ----------
  const bulb = glow(0xffe6a8, 2.4), posts = [];
  for (let i = 14; i < TOUR_PATH.length - 26; i += 13) {
    const [x, z] = beside(i, (posts.length % 2 ? 1 : -1) * 1.16);
    if (taken(x, z, -0.42) || Math.hypot(x, z) < 12) continue;
    k.cyl(felt(TEAL), 0.07, 0.1, 2.7, x, 1.35, z, { seg: 10 }); k.cyl(cream, 0.2, 0.24, 0.22, x, 0.11, z, { seg: 12 }); k.cyl(red, 0.15, 0.17, 0.12, x, 0.3, z, { seg: 12 }); k.cyl(felt(TEAL), 0.16, 0.08, 0.14, x, 2.74, z, { seg: 10 });
    obj(root, new T.SphereGeometry(0.2, 12, 9), bulb, x, 2.95, z).castShadow = false;
    puff(k, red, 0.27, x, 3.14, z, { sy: 0.5 }); for (let j = 0; j < 6; j++) { const a = j * TAU / 6; puff(k, cream, 0.07, x + Math.cos(a) * 0.24, 3.1, z + Math.sin(a) * 0.24, { sy: 0.8 }); } puff(k, gold, 0.07, x, 3.3, z);
    posts.push([x, z]);
  }
  for (let i = 1; i < posts.length; i++) {
    const [ax, az] = posts[i - 1], [bx, bz] = posts[i], span = Math.hypot(bx - ax, bz - az);
    if (span > 14) continue;
    const sag = t => 2.95 - Math.sin(t * Math.PI) * 0.55, line = Array.from({ length: 9 }, (_, j) => { const t = j / 8; return [ax + (bx - ax) * t, sag(t), az + (bz - az) * t]; });
    k.tube(ink, line, 0.012, { straight: true });
    for (let j = 1; j < 8; j++) { const t = (j + 0.0) / 8, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = sag(t), nx = (bx - ax) / span * 0.11, nz = (bz - az) / span * 0.11;
      k.quad(felt([RED, GOLD, TEAL, CREAM][j % 4]), [x - nx, y, z - nz], [x + nx, y, z + nz], [x, y - 0.26, z], [x, y - 0.26, z], [[0, 1], [1, 1], [0.5, 0], [0.5, 0]], 1, [0, 0, 1]);
      k.quad(felt([RED, GOLD, TEAL, CREAM][j % 4]), [x + nx, y, z + nz], [x - nx, y, z - nz], [x, y - 0.26, z], [x, y - 0.26, z], [[0, 1], [1, 1], [0.5, 0], [0.5, 0]], 1, [0, 0, -1]); }
  }
  // 长椅：几处歇脚的地方
  for (const i of [36, 96, 150, 212, 262]) {
    const [x, z] = beside(i, 1.2); if (taken(x, z, -0.42)) continue;
    box(k, wood, 1.5, 0.09, 0.45, x, 0.46, z, 0.03); box(k, wood, 1.5, 0.4, 0.07, x, 0.74, z - 0.2, 0.03); for (const s of [-0.6, 0.6]) box(k, felt(TEAL), 0.09, 0.46, 0.4, x + s, 0.23, z, 0.03);
  }

  // ---------- 条纹伞顶（木马、帐篷、摊位都用）。inside：从底下也看得见 ----------
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
  const awning = (kit, x, z, y, w, d, accent, tilt = 0) => { for (let i = 0; i < 7; i++) box(kit, i % 2 ? cream : accent, w / 7 + 0.014, 0.1, d, x + w * ((i + 0.5) / 7 - 0.5), y, z, 0.03, { rx: tilt }); };
  const star = (kit, m, r, x, y, z) => { puff(kit, m, r * 0.62, x, y, z, { sz: 0.45 }); for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + Math.PI / 2; puff(kit, m, r * 0.36, x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66, z, { sz: 0.4, seg: 8, rings: 5 }); } };

  // ---------- 互动点的标记：路边一根小柱子顶着一颗星。盖过章的变成青色 ----------
  const markers = new Map(), starOn = glow(0xffd66b, 1.8), starDone = glow(0x67c2b4, 1.2);
  for (const q of SPOTS) {
    const stop = stopOf(q.stop); let dx = stop.x - q.x, dz = stop.z - q.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    let x = q.x, z = q.z; for (let n = 0; n < 40 && isTourWalkable(x, z, 0.3); n++) { x += dx * 0.15; z += dz * 0.15; }
    if (q.id === 'circus') { x = 1.9; z = -1.9; }
    if (q.id === 'haunt') { x = HAUNT.door.x + 1.4; z = HAUNT.door.z - 0.45; }   // 门廊柱子旁边，不挡门
    if (q.id === 'portraits') { x = HAUNT.bell.x + 0.78; z = -13.08; }   // 门厅里：立在小桌旁边、靠着后墙
    box(k, cream, 0.12, 1.05, 0.12, x, 0.525, z, 0.04); box(k, red, 0.16, 0.12, 0.16, x, 0.42, z, 0.04);
    const s = obj(root, new T.OctahedronGeometry(0.17, 0), starOn, x, 1.32, z); s.castShadow = false; s.scale.set(1, 1.25, 0.55);
    markers.set(q.id, { mesh: s, stop: q.stop, phase: x + z });
  }

  // ====================================================================== 01 入口
  {
    const ex = -16.2, ez = 26.68;
    k.cyl(quilt(0xcdbb96), 5.2, 5.2, 0.05, ex + 1.2, 0.036, ez + 1.2, { seg: 28 });   // 广场的石板地
    for (const side of [-1, 1]) {   // 两座红色小塔楼
      const x = ex + side * 2.1;
      k.cyl(red, 0.52, 0.58, 3.3, x, 1.65, ez, { seg: 14 }); k.cyl(cream, 0.6, 0.6, 0.22, x, 0.9, ez, { seg: 14 }); k.cyl(cream, 0.62, 0.62, 0.26, x, 3.32, ez, { seg: 14 });
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; box(k, cream, 0.2, 0.24, 0.2, x + Math.cos(a) * 0.5, 3.56, ez + Math.sin(a) * 0.5, 0.04); }
      k.cyl(gold, 0.02, 0.5, 0.95, x, 4.0, ez, { seg: 12 }); puff(k, gold, 0.11, x, 4.52, ez);
      box(k, wood, 0.05, 0.7, 0.05, x, 4.9, ez, 0.01); k.quad(felt(TEAL), [x, 5.22, ez], [x + 0.5, 5.1, ez], [x + 0.5, 4.86, ez], [x, 4.94, ez], undefined, 1, [0, 0, 1]);
      k.quad(felt(TEAL), [x + 0.5, 5.1, ez], [x, 5.22, ez], [x, 4.94, ez], [x + 0.5, 4.86, ez], undefined, 1, [0, 0, -1]);
      box(k, ink, 0.22, 0.42, 0.05, x, 2.3, ez + 0.54, 0.06);
    }
    const arch = Array.from({ length: 19 }, (_, i) => { const a = Math.PI * i / 18; return [ex + 1.72 * Math.cos(a), 3.0 + 1.05 * Math.sin(a), ez]; });
    k.tube(red, arch, 0.24, { radial: 8 }); k.tube(gold, arch.map(([x, y, z]) => [x, y, z + 0.22]), 0.05, { radial: 6 }); star(k, gold, 0.34, ex, 4.42, ez + 0.1);
    sign(copy('布偶游乐园', 'PLUSHWOOD PARK'), ex, 3.4, ez + 0.3, 3.1);
    // 售票亭：有窗口、柜台、条纹雨棚，里面坐着一位布偶售票员
    const bx = -12.4, bz = 27.9;
    box(k, M('boards', 0xb98a66), 2.0, 1.05, 1.7, bx, 0.525, bz, 0.08); box(k, felt(TEAL), 2.06, 0.16, 1.76, bx, 1.08, bz, 0.05);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(k, wood, 0.13, 1.35, 0.13, bx + sx * 0.92, 1.8, bz + sz * 0.78, 0.035);
    box(k, M('boards', 0xb98a66), 2.0, 1.3, 0.1, bx, 1.8, bz + 0.8, 0.03); box(k, wood, 2.2, 0.08, 0.5, bx - 0.0, 1.2, bz - 0.95, 0.03);
    awning(k, bx, bz - 0.55, 2.62, 2.5, 1.5, red, 0.34); box(k, red, 2.3, 0.14, 1.9, bx, 2.55, bz + 0.1, 0.05);
    puff(k, felt(0xe7c49a), 0.3, bx, 1.72, bz + 0.15, { sy: 1.05 }); puff(k, felt(RED), 0.31, bx, 1.93, bz + 0.15, { sy: 0.5 });
    for (const s of [-1, 1]) puff(k, ink, 0.035, bx + s * 0.11, 1.75, bz - 0.13);
    box(k, cream, 0.5, 0.03, 0.34, bx - 0.55, 1.26, bz - 0.95, 0.01);   // 柜台上的一摞游园卡
    for (const [x, z] of [[-19.4, 28.4], [-13.2, 24.4]]) { flowers(x, z, 6, 0.9); bush(x + 0.6, z + 0.3, 0.5); }
    { const cx = -19.9, cz = 26.4;   // 气球车
      box(k, red, 1.3, 0.5, 0.7, cx, 0.72, cz, 0.08); box(k, cream, 1.36, 0.1, 0.76, cx, 1.0, cz, 0.04); for (const e of [-1, 1]) { k.cyl(wood, 0.3, 0.3, 0.07, cx - 0.3, 0.32, cz + e * 0.4, { seg: 14, rx: Math.PI / 2 }); puff(k, gold, 0.07, cx - 0.3, 0.32, cz + e * 0.45); box(k, wood, 0.06, 0.5, 0.06, cx + 0.55, 0.25, cz + e * 0.25, 0.02); }
      for (const ex of [-1, 1]) for (const e of [-1, 1]) box(k, wood, 0.05, 0.9, 0.05, cx + ex * 0.58, 1.45, cz + e * 0.3, 0.015);
      stripedRoof(k, cx, cz, 0.95, 1.9, 2.4, [teal, cream], 8); puff(k, gold, 0.08, cx, 2.46, cz);
      [[0.9, 2.5, 0.1, RED], [1.12, 2.86, -0.14, GOLD], [0.74, 3.02, -0.05, TEAL]].forEach(([dx, y, dz, c]) => { puff(k, felt(c), 0.25, cx + dx, y, cz + dz, { sy: 1.2 }); k.tube(ink, [[cx + 0.62, 1.2, cz], [cx + dx, y - 0.3, cz + dz]], 0.008, { straight: true }); }); }
  }

  // ====================================================================== 02 旋转木马
  const carousel = group(root, CAROUSEL.x, 0, CAROUSEL.z); let horsesA, horsesB;
  {
    const c = CAROUSEL;
    k.cyl(teal, 3.75, 3.85, 0.2, c.x, 0.1, c.z, { seg: 36 }); k.cyl(cream, 3.5, 3.6, 0.2, c.x, 0.3, c.z, { seg: 36 }); k.cyl(quilt(0xc98f5e), 3.38, 3.38, 0.04, c.x, 0.42, c.z, { seg: 36 });
    for (let i = 0; i < 16; i++) {   // 一圈矮栏杆，朝小径的那一面留口
      const a = i * TAU / 16, x = c.x + Math.sin(a) * 4.5, z = c.z + Math.cos(a) * 4.5;
      if (isTourWalkable(x, z, 0.6) || (a > 0.2 && a < 1.2)) continue;
      box(k, wood, 0.1, 0.8, 0.1, x, 0.4, z, 0.03); puff(k, gold, 0.07, x, 0.84, z);
      const b = (i + 1) * TAU / 16; k.tube(wood, [[x, 0.62, z], [c.x + Math.sin(b) * 4.5, 0.62, c.z + Math.cos(b) * 4.5]], 0.035, { straight: true });
    }
    // 转的部分：中柱、伞顶、立杆、木马
    part(carousel, kit => {
      kit.cyl(gold, 0.34, 0.4, 3.5, 0, 2.17, 0, { seg: 16 });
      for (const y of [0.9, 1.9, 2.9]) kit.cyl(felt(RED), 0.42, 0.42, 0.14, 0, y, 0, { seg: 16 });
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; box(kit, i % 2 ? cream : coral, 0.26, 1.1, 0.04, Math.sin(a) * 0.4, 1.9, Math.cos(a) * 0.4, 0.02, { ry: a }); }
      stripedRoof(kit, 0, 0, 3.7, 3.78, 5.15, [teal, gold], 24, true);
      kit.cyl(gold, 3.66, 3.66, 0.14, 0, 3.72, 0, { seg: 40, open: true });
      for (let i = 0; i < 24; i++) { const a = (i + 0.5) * TAU / 24, x = Math.sin(a) * 3.74, z = Math.cos(a) * 3.74;   // 伞沿：一格一朵红花饰，花饰之间垂一条金穗
        puff(kit, red, 0.13, x, 3.72, z, { sz: 0.5, ry: a }); puff(kit, cream, 0.05, x * 1.012, 3.72, z * 1.012);
        const b = i * TAU / 24; puff(kit, gold, 0.07, Math.sin(b) * 3.72, 3.36, Math.cos(b) * 3.72, { sy: 2.2 }); puff(kit, gold, 0.06, Math.sin(b) * 3.72, 3.56, Math.cos(b) * 3.72); } kit.cyl(cream, 0.5, 0.2, 0.3, 0, 5.25, 0, { seg: 12 }); puff(kit, gold, 0.2, 0, 5.5, 0);
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; kit.tube(gold, [[Math.sin(a) * 0.4, 3.9, Math.cos(a) * 0.4], [Math.sin(a) * 3.6, 3.74, Math.cos(a) * 3.6]], 0.03, { straight: true }); }
    }, 0, 0, 0, true);
    const horse = (kit, a, tone) => {
      const x = Math.sin(a) * c.r, z = Math.cos(a) * c.r, body = felt(0xf3ead8), saddle = felt(tone), mane = felt(0xcaa56a), fx = Math.cos(a), fz = -Math.sin(a);   // 头朝转的方向
      kit.cyl(gold, 0.04, 0.04, 3.2, x, 2.1, z, { seg: 8 });
      puff(kit, body, 0.3, x, 1.38, z, { sx: 0.72, sy: 0.8, sz: 0.72 }); puff(kit, body, 0.3, x - fx * 0.3, 1.36, z - fz * 0.3, { sx: 0.7, sy: 0.78, sz: 0.7 }); puff(kit, body, 0.26, x + fx * 0.28, 1.4, z + fz * 0.28, { sx: 0.7, sy: 0.8, sz: 0.7 });
      puff(kit, body, 0.17, x + fx * 0.48, 1.68, z + fz * 0.48, { sy: 1.25 }); puff(kit, body, 0.17, x + fx * 0.62, 1.86, z + fz * 0.62, { sx: 0.95, sy: 0.85 }); puff(kit, cream, 0.1, x + fx * 0.76, 1.8, z + fz * 0.76);
      for (const s of [-1, 1]) { puff(kit, body, 0.05, x + fx * 0.58 - fz * s * 0.09, 2.02, z + fz * 0.58 + fx * s * 0.09, { sy: 1.6 }); puff(kit, ink, 0.03, x + fx * 0.7 - fz * s * 0.11, 1.9, z + fz * 0.7 + fx * s * 0.11); }
      for (let j = 0; j < 4; j++) puff(kit, mane, 0.075, x + fx * (0.44 - j * 0.07), 1.9 - j * 0.09, z + fz * (0.44 - j * 0.07));   // 鬃毛
      for (const f of [-1, 1]) for (const s of [-1, 1]) box(kit, body, 0.1, 0.5, 0.1, x + fx * f * 0.3 - fz * s * 0.13, 0.98, z + fz * f * 0.3 + fx * s * 0.13, 0.04);
      for (const f of [-1, 1]) for (const s of [-1, 1]) puff(kit, gold, 0.065, x + fx * f * 0.3 - fz * s * 0.13, 0.72, z + fz * f * 0.3 + fx * s * 0.13, { sy: 0.7 });
      box(kit, saddle, 0.46, 0.12, 0.46, x - fx * 0.02, 1.62, z - fz * 0.02, 0.05, { ry: a }); box(kit, gold, 0.5, 0.05, 0.2, x - fx * 0.02, 1.6, z - fz * 0.02, 0.02, { ry: a });   // 鞍和鞍边
      kit.tube(saddle, [[x + fx * 0.52, 1.72, z + fz * 0.52], [x + fx * 0.74, 1.78, z + fz * 0.74]], 0.035, { straight: true }); puff(kit, mane, 0.09, x - fx * 0.62, 1.44, z - fz * 0.62, { sy: 1.8 });   // 笼头、尾巴
    };
    const tones = [TEAL, RED, GOLD, TEAL, RED, GOLD];   // 鞍的颜色；马身都是米白（参考图）
    horsesA = part(carousel, kit => { for (let i = 0; i < c.horses; i += 2) horse(kit, i * TAU / c.horses, tones[i]); });
    horsesB = part(carousel, kit => { for (let i = 1; i < c.horses; i += 2) horse(kit, i * TAU / c.horses, tones[i]); });
    carousel.children.forEach(g => { g.userData.spin = true; });
  }

  // ====================================================================== 03 激流勇进
  const boats = [];
  {
    const w = TOUR_CHANNEL, b = TOUR_BRIDGE, wet = quilt(0x509eac), bank = quilt(0x2b727e), foam = felt(0xdff1ee);
    box(k, quilt(0x4a9c9e), w.w, 0.07, w.d, w.x, 0.054, w.z, 0.025); box(k, quilt(0x62aeb3), w.w * 0.98, 0.031, w.d * 0.78, w.x, 0.091, w.z, 0.013);
    const n = b.d / 12;   // 木桥
    for (let i = 0; i < 12; i++) box(k, i % 3 ? wood : felt(0xb78354), b.w, 0.12, n - 0.022, b.x, 0.13, b.z - b.d * 0.5 + (i + 0.5) * n, 0.022);
    for (const side of [-1, 1]) { const x = b.x + side * b.w * 0.5; box(k, wood, 0.11, 0.13, b.d, x, 0.87, b.z, 0.024); for (const dz of [-2.55, -0.98, 0.98, 2.55]) { box(k, wood, 0.17, 0.98, 0.17, x, 0.52, b.z + dz, 0.036); puff(k, gold, 0.09, x, 1.05, b.z + dz); } }
    // 水槽：槽底一条布，两边的槽帮，架高的地方有木支架
    const pts = RAPIDS.points, edges = [[], []];
    for (let i = 0; i <= pts.length; i++) {
      const p = pts[i % pts.length], q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dz = q[2] - p[2], d = Math.hypot(dx, dz) || 1;
      edges[0].push([p[0] + dz / d * 0.8, p[1] - 0.13, p[2] - dx / d * 0.8]); edges[1].push([p[0] - dz / d * 0.8, p[1] - 0.13, p[2] + dx / d * 0.8]);
      if (i > 0) k.quad(wet, edges[0][i - 1], edges[0][i], edges[1][i], edges[1][i - 1], [[0, i - 1], [0, i], [1.6, i], [1.6, i - 1]], 1, [0, 1, 0]);
      if (i % 9 === 4 && p[1] > 1.1) { box(k, wood, 0.2, p[1], 0.2, p[0], p[1] * 0.5 - 0.1, p[2], 0.04); k.tube(wood, [[p[0] - 0.9, 0.1, p[2]], [p[0], p[1] * 0.7, p[2]]], 0.07, { straight: true }); }
    }
    for (const edge of edges) k.tube(bank, edge.map(([x, y, z]) => [x, y + 0.2, z]), 0.2, { straight: true });
    // 石头山：水槽最高的那一段从山里穿出来，山口挂一道瀑布
    for (const [x, z, r, y] of [[-27.4, -3.0, 2.2, 1.6], [-24.4, -2.4, 2.0, 1.9], [-22.2, -0.4, 1.7, 1.5], [-29.6, -1.6, 1.6, 1.0], [-26.0, -4.6, 1.5, 0.9], [-21.4, 1.8, 1.2, 0.8], [-31.3, 0.9, 1.3, 0.74], [-19.8, 4.6, 0.92, 0.5]]) stone(x, y, z, r);
    puff(k, M('leaves', PINE), 0.9, -25.6, 3.9, -3.9, { sy: 0.8 }); puff(k, M('leaves', MOSS), 0.7, -22.9, 3.6, -2.2, { sy: 0.8 });
    for (let i = 0; i < 7; i++) { const x = -21.3 + (i - 3) * 0.2; k.tube(felt(i % 2 ? 0xaeefde : 0x71c5c8), [[x, 3.4, 2.2], [x + 0.05, 2.6, 2.9], [x + 0.1, 1.4, 3.9], [x + 0.2, 0.5, 5.0]], 0.11, { straight: true }); }
    for (let i = 0; i < 9; i++) puff(k, foam, 0.16 + rand() * 0.12, -22.4 + rand() * 2.2, 0.42 + rand() * 0.2, 5.2 + rand() * 1.2, { sy: 0.7 });
    // 码头和闸：靠桥这一头
    box(k, wood, 2.6, 0.2, 1.3, -31.6, 0.38, 6.9, 0.04); for (const s of [-1, 1]) box(k, wood, 0.14, 1.5, 0.14, -31.6 + s * 1.2, 0.75, 7.5, 0.04);
    box(k, red, 2.5, 0.16, 0.16, -31.6, 1.5, 7.5, 0.05); box(k, felt(TEAL), 0.9, 0.5, 0.08, -31.6, 1.05, 7.5, 0.04);
    const boat = tone => part(root, kit => {   // 木头小船：船身、两个座、船头一圈白边
      puff(kit, felt(tone), 0.5, 0, 0.1, 0, { sx: 0.72, sy: 0.42, sz: 1.5 }); puff(kit, felt(0x7a4a34), 0.4, 0, 0.2, 0, { sx: 0.6, sy: 0.22, sz: 1.3 });
      box(kit, cream, 0.5, 0.08, 0.22, 0, 0.3, -0.2, 0.03); box(kit, cream, 0.5, 0.08, 0.22, 0, 0.3, 0.25, 0.03); puff(kit, white, 0.12, 0, 0.26, 0.68, { sx: 1.6 });
    });
    boats.push(boat(0xba7450), boat(0x9c6a4c));
  }

  // ====================================================================== 04 过山车
  const train = group();
  {
    const pts = COASTER.points, N = pts.length, rails = [[], []], spine = [];
    for (let i = 0; i <= N; i++) {
      const p = pts[i % N], q = pts[(i + 1) % N], dx = q[0] - p[0], dz = q[2] - p[2], d = Math.hypot(dx, dz) || 1;
      rails[0].push([p[0] + dz / d * 0.42, p[1], p[2] - dx / d * 0.42]); rails[1].push([p[0] - dz / d * 0.42, p[1], p[2] + dx / d * 0.42]); spine.push([p[0], p[1] - 0.16, p[2]]);
      if (i % 2 === 0) k.tube(wood, [rails[0][i], rails[1][i]], 0.045, { straight: true });   // 枕木
      if (i % 10 === 5 && i < N) {   // 木支架：一对立柱加一道横梁；高的再加斜撑
        const y = p[1] - 0.2, ox = dz / d * 0.55, oz = -dx / d * 0.55;
        if (!isTourWalkable(p[0] + ox, p[2] + oz, 0.4) && !isTourWalkable(p[0] - ox, p[2] - oz, 0.4)) {
          for (const s of [-1, 1]) box(k, wood, 0.18, y, 0.18, p[0] + ox * s, y / 2, p[2] + oz * s, 0.04);
          k.tube(wood, [[p[0] + ox, y - 0.06, p[2] + oz], [p[0] - ox, y - 0.06, p[2] - oz]], 0.07, { straight: true });
          if (y > 3) { k.tube(wood, [[p[0] + ox, y * 0.5, p[2] + oz], [p[0] - ox, y * 0.5, p[2] - oz]], 0.06, { straight: true }); k.tube(wood, [[p[0] + ox, y * 0.5, p[2] + oz], [p[0] - ox, y - 0.1, p[2] - oz]], 0.045, { straight: true }); k.tube(wood, [[p[0] - ox, 0.1, p[2] - oz], [p[0] + ox, y * 0.5, p[2] + oz]], 0.045, { straight: true }); }
        }
      }
    }
    k.tube(coral, rails[0], 0.075, { straight: true }); k.tube(gold, rails[1], 0.075, { straight: true }); k.tube(felt(0x8c5a4a), spine, 0.06, { straight: true });
    // 站台：木平台、台阶、栏杆、红白条的顶
    const sx = -28.25, sz = -12.4, deck = 1.02;
    box(k, M('boards', 0xb98a66), 2.5, 0.16, 6.4, sx, deck - 0.08, sz, 0.04);
    for (const dz of [-3.0, -1.0, 1.0, 3.0]) for (const dx of [-1.1, 1.1]) box(k, wood, 0.16, deck, 0.16, sx + dx, deck / 2 - 0.08, sz + dz, 0.04);
    for (let i = 0; i < 4; i++) box(k, M('boards', 0xb98a66), 0.34, 0.14, 1.7, sx - 1.42 - i * 0.34, deck - 0.2 - i * 0.24, sz - 0.6, 0.03);   // 朝小径的台阶
    for (const dz of [-3.1, 3.1]) for (const dx of [-1.15, 1.15]) box(k, red, 0.15, 2.2, 0.15, sx + dx, deck + 1.1, sz + dz, 0.045);
    awning(k, sx, sz, deck + 2.3, 3.0, 6.9, red); for (const dx of [-1.5, 1.5]) for (let i = 0; i < 17; i++) puff(k, i % 2 ? cream : red, 0.2, sx + dx, deck + 2.2, sz - 3.2 + i * 0.4, { sx: 0.3, sy: 1.0, seg: 8, rings: 5 });
    for (const dz of [-3.1, 0.6, 3.1]) box(k, wood, 0.1, 0.9, 0.1, sx - 1.15, deck + 0.45, sz + dz, 0.03); k.tube(wood, [[sx - 1.15, deck + 0.85, sz + 0.6], [sx - 1.15, deck + 0.85, sz + 3.1]], 0.04, { straight: true });
    for (const e of [-1, 1]) k.soft(M('shingle', RED), 1.95, 0.14, 7.1, sx + e * 0.78, deck + 2.82, sz, { r: 0.05, rz: -e * 0.54 });   // 红瓦的人字顶
    for (const e of [-1, 1]) for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5, hh = 0.92 * (1 - Math.abs(t - 0.5) * 2); box(k, cream, 3.0 / 5 + 0.02, hh + 0.04, 0.1, sx + (t - 0.5) * 3.0, deck + 2.38 + hh / 2, sz + e * 3.42, 0.02); }
    star(k, gold, 0.3, sx - 1.55, deck + 2.5, sz);
    // 小火车：两节，头一节有圆鼻子和一颗星
    part(train, kit => {
      for (const [dz, tone] of [[0.2, coral], [-1.45, gold]]) {
        box(kit, tone, 0.98, 0.5, 1.45, 0, 0.3, dz, 0.16); box(kit, felt(0x7a4a34), 0.8, 0.12, 1.15, 0, 0.5, dz, 0.05);
        box(kit, teal, 0.78, 0.5, 0.14, 0, 0.72, dz - 0.56, 0.06); box(kit, cream, 0.7, 0.1, 0.4, 0, 0.5, dz - 0.3, 0.04);   // 靠背和座垫
        kit.tube(ink, [[-0.42, 0.56, dz + 0.42], [0.42, 0.56, dz + 0.42]], 0.028, { straight: true });   // 扶手：一根横杆，在视线下沿
        for (const s of [-1, 1]) for (const f of [-0.45, 0.45]) kit.cyl(ink, 0.13, 0.13, 0.1, s * 0.46, 0.06, dz + f, { seg: 10, rz: Math.PI / 2 });
      }
      puff(kit, coral, 0.5, 0, 0.3, 1.0, { sx: 0.98, sy: 0.52, sz: 0.9 }); star(kit, gold, 0.2, 0, 0.42, 1.44); box(kit, ink, 0.2, 0.1, 0.3, 0, 0.2, -0.62, 0.03);
    }, 0, 0, 0, true);
  }

  // ====================================================================== 05 鬼屋
  // 主屋是空心的：敲开门能走进门厅（准则第 5c 节）。门厅的地面和外面一样高，所以屋基只是薄薄一层。
  let door, bell; const windowGhosts = [], portraitGhosts = [], frames = [];
  {
    const h = stopOf('haunt'), wall = quilt(PLUM), dark = felt(PLUM_DARK), roofA = M('shingle', 0x4a3d56), roofB = M('shingle', 0x5c4a66), lit = glow(0xffc95a, 1.5);
    const front = h.z - 3.3, dx = HAUNT.door.x, dz = front;   // 朝北（朝小径）的那一面
    const mx = h.x - 0.6, x0 = mx - 2.8, x1 = mx + 2.8, z0 = h.z - 3.2, z1 = h.z + 3.2, TH = 0.25, top = 4.6, tx = h.x + 3.35, wx = h.x - 4.5;
    box(k, quilt(0x8f8a84), 9.4, 0.1, 7.0, h.x, 0.05, h.z, 0.04);   // 石头屋基
    box(k, wall, 5.6, top, TH, mx, top / 2, z1 - TH / 2, 0.04);   // 后墙
    for (const e of [-1, 1]) box(k, wall, TH, top, 6.4, mx + e * (2.8 - TH / 2), top / 2, h.z, 0.04);   // 两侧的墙
    box(k, wall, dx - 0.7 - x0, top, TH, (x0 + dx - 0.7) / 2, top / 2, z0 + TH / 2, 0.04); box(k, wall, x1 - dx - 0.7, top, TH, (x1 + dx + 0.7) / 2, top / 2, z0 + TH / 2, 0.04);   // 前墙：门的两边
    box(k, wall, 1.4, top - 2.4, TH, dx, (top + 2.4) / 2, z0 + TH / 2, 0.04);   // 门上面
    box(k, wall, 2.5, 6.8, 2.7, tx, 3.4, h.z - 1.6, 0.1, { rz: -0.035 });   // 歪一点的塔楼
    box(k, wall, 2.6, 3.4, 3.2, wx, 1.7, h.z + 0.8, 0.1);   // 侧屋
    const gable = (x, z, w, d, eave, rise, mat, yaw = 0) => {   // 两片斜屋面合成一个尖顶
      for (const s of [-1, 1]) k.soft(mat, Math.hypot(w / 2 + 0.25, rise) + 0.1, 0.16, d + 0.5, x + s * (w / 4 + 0.05) * Math.cos(yaw), eave + rise / 2, z, { r: 0.05, rz: -s * Math.atan2(rise, w / 2 + 0.25), ry: yaw });
      for (const sz of [-1, 1]) for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7, hh = rise * (1 - Math.abs(t - 0.5) * 2); box(k, dark, w / 7 + 0.02, hh + 0.04, 0.12, x + (t - 0.5) * w, eave + hh / 2, z + sz * d / 2, 0.02); }
    };
    gable(mx, h.z, 5.6, 6.4, 4.6, 2.3, roofA); gable(tx, h.z - 1.6, 2.5, 2.7, 6.8, 2.4, roofB); gable(wx, h.z + 0.8, 2.6, 3.2, 3.4, 1.5, roofB);
    puff(k, gold, 0.1, tx, 9.28, h.z - 1.6); box(k, dark, 0.6, 1.9, 0.6, h.x - 2.0, 6.6, h.z + 1.2, 0.06, { rz: 0.07 }); box(k, felt(PLUM), 0.76, 0.2, 0.76, h.x - 2.07, 7.56, h.z + 1.2, 0.05);
    // 窗：亮着黄灯，十字窗棂，歪歪的百叶
    const windows = [[h.x - 2.2, 3.1, 0.8, 1.1], [h.x + 0.6, 3.1, 0.8, 1.1], [h.x - 2.2, 1.35, 0.7, 0.8], [tx, 4.9, 0.7, 1.0], [tx, 2.6, 0.7, 0.9], [wx, 2.0, 0.7, 0.9]];
    for (const [x, y, w, hh] of windows) {
      const z = x > h.x + 1.5 ? h.z - 2.98 : x < h.x - 3.4 ? h.z - 0.82 : front + 0.08;
      obj(root, new T.BoxGeometry(w, hh, 0.06), lit, x, y, z).castShadow = false;
      box(k, dark, w + 0.16, 0.1, 0.12, x, y + hh / 2 + 0.04, z - 0.03, 0.02); box(k, dark, w + 0.2, 0.12, 0.16, x, y - hh / 2 - 0.05, z - 0.04, 0.02);
      box(k, dark, 0.05, hh, 0.08, x, y, z - 0.04, 0.01); box(k, dark, w, 0.05, 0.08, x, y, z - 0.04, 0.01);
      for (const s of [-1, 1]) box(k, felt(0x55455b), 0.3, hh + 0.05, 0.05, x + s * (w / 2 + 0.17), y - 0.02, z - 0.03, 0.02, { rz: s * (0.05 + rand() * 0.12) });
    }
    // 门廊和门：门是单独一组，绕门轴往里开
    for (const s of [-1, 1]) box(k, dark, 0.16, 3.0, 0.16, dx + s * 1.05, 1.5, dz - 0.9, 0.04);
    k.soft(roofB, 2.8, 0.14, 1.4, dx, 3.08, dz - 0.5, { r: 0.04, rx: -0.3 }); box(k, M('boards', 0x6f5648), 2.6, 0.08, 1.5, dx, 0.13, dz - 0.62, 0.03);
    for (const s of [-1, 1]) box(k, dark, 0.14, 2.5, 0.22, dx + s * 0.77, 1.25, dz, 0.03); box(k, dark, 1.7, 0.16, 0.22, dx, 2.5, dz, 0.03);
    door = part(root, kit => { box(kit, M('boards', 0x4f3d36), 1.26, 2.2, 0.08, 0.63, 1.1, 0, 0.03); for (const y of [0.55, 1.65]) box(kit, felt(0x3d2f2a), 1.0, 0.7, 0.03, 0.63, y, -0.05, 0.02); puff(kit, gold, 0.06, 1.1, 1.1, -0.08); puff(kit, gold, 0.06, 1.1, 1.1, 0.08); }, dx - 0.63, 0.16, z0 + 0.06, true);
    // ---- 门厅（照 docs/park-refs/ref-05-haunt.png 右下那一格）：木地板、圆地毯、护墙板、门里两边的帘子、顶上一盏灯
    const zi0 = z0 + TH, zi1 = z1 - TH, xi0 = x0 + TH, xi1 = x1 - TH, cz = (zi0 + zi1) / 2, warm = glow(0xffc27a, 1.7), boards = M('boards', 0x6f5648);
    box(k, M('boards', 0x7a5a48), xi1 - xi0, 0.06, zi1 - zi0, mx, 0.13, cz, 0.01); box(k, M('boards', 0x5a463c), xi1 - xi0, 0.12, zi1 - zi0, mx, 3.2, cz, 0.01);   // 地板、天花板
    puff(k, gold, 1, mx, 0.15, cz - 0.2, { sx: 1.78, sy: 0.03, sz: 1.28, seg: 20 }); puff(k, quilt(0x9c4a4e), 1, mx, 0.165, cz - 0.2, { sx: 1.66, sy: 0.03, sz: 1.16, seg: 20 }); puff(k, gold, 1, mx, 0.18, cz - 0.2, { sx: 0.5, sy: 0.02, sz: 0.36, seg: 14 });
    box(k, boards, xi1 - xi0, 0.9, 0.05, mx, 0.61, zi1 - 0.03, 0.01); for (const e of [-1, 1]) box(k, boards, 0.05, 0.9, zi1 - zi0, e < 0 ? xi0 + 0.03 : xi1 - 0.03, 0.61, cz, 0.01);   // 护墙板
    box(k, dark, xi1 - xi0, 0.08, 0.07, mx, 1.08, zi1 - 0.04, 0.01);
    for (const e of [-1, 1]) { puff(k, quilt(0x7b4f7c), 0.5, dx + e * 1.05, 1.5, zi0 + 0.14, { sx: 0.62, sy: 2.6, sz: 0.3 }); puff(k, quilt(0x7b4f7c), 0.4, dx + e * 1.22, 0.62, zi0 + 0.16, { sx: 0.7, sy: 1.4, sz: 0.34 }); puff(k, gold, 0.07, dx + e * 0.92, 1.25, zi0 + 0.3); }
    box(k, dark, 2.9, 0.14, 0.12, dx, 2.72, zi0 + 0.1, 0.03);   // 帘杆
    k.tube(ink, [[mx, 3.14, cz - 0.2], [mx, 2.78, cz - 0.2]], 0.012, { straight: true }); box(k, dark, 0.3, 0.06, 0.3, mx, 2.78, cz - 0.2, 0.02);
    obj(root, new T.SphereGeometry(0.17, 12, 9), warm, mx, 2.62, cz - 0.2).castShadow = false; box(k, dark, 0.2, 0.05, 0.2, mx, 2.44, cz - 0.2, 0.02);   // 吊灯
    // 西墙的书架
    box(k, M('boards', 0x5a463c), 0.36, 2.0, 1.4, xi0 + 0.2, 1.16, cz + 0.9, 0.03);
    for (let row = 0; row < 3; row++) for (let j = 0; j < 6; j++) box(k, felt([RED, TEAL, GOLD, PLUM, MOSS, CORAL][(row * 2 + j) % 6]), 0.2, 0.34 + ((row + j) % 3) * 0.05, 0.14, xi0 + 0.36, 0.55 + row * 0.6, cz + 0.36 + j * 0.2, 0.02);
    // 后墙的三张肖像，每张顶上一盏小壁灯；中间那张下面一张小桌：蜡烛和小铃
    const px = [mx - 1.62, mx, mx + 1.62];
    px.forEach((x, i) => {
      const f = picture('haunt-portrait-' + (i + 1) + '.webp', 1.0, 1.25, x, 1.93, zi1 - 0.07, Math.PI, { lit: false }); f.material.color.setScalar(0.86); frames.push(f);
      obj(root, new T.SphereGeometry(0.06, 8, 6), warm, x, 2.68, zi1 - 0.16).castShadow = false; box(k, dark, 0.14, 0.05, 0.16, x, 2.62, zi1 - 0.1, 0.01);
    });
    const bx = HAUNT.bell.x, tz = zi1 - 0.36;
    box(k, wood, 1.1, 0.07, 0.5, bx, 0.9, tz, 0.02); for (const e of [-1, 1]) for (const f of [-1, 1]) box(k, wood, 0.07, 0.72, 0.07, bx + e * 0.46, 0.52, tz + f * 0.18, 0.02);
    box(k, felt(0x9c4a4e), 0.7, 0.02, 0.4, bx, 0.945, tz, 0.005); k.cyl(cream, 0.04, 0.045, 0.24, bx - 0.34, 1.07, tz, { seg: 8 }); k.cyl(gold, 0.09, 0.09, 0.03, bx - 0.34, 0.96, tz, { seg: 10 });
    obj(root, new T.SphereGeometry(0.05, 8, 6), warm, bx - 0.34, 1.23, tz).scale.set(0.8, 1.5, 0.8);
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
      puff(k, felt(0xdf8b4d), r, x, r * 0.72, z, { sx: 1.12, sy: 0.81 }); box(k, felt(PINE), 0.1, 0.16, 0.1, x, r * 1.5, z, 0.03);
      for (const e of [-1, 1]) box(k, ink, r * 0.22, r * 0.2, 0.03, x + e * r * 0.36, r * 0.86, z - r * 0.98, 0.01, { rz: e * 0.5 }); box(k, ink, r * 0.6, r * 0.12, 0.03, x, r * 0.5, z - r * 1.04, 0.01);
    }
    for (const [x, z, s] of [[h.x - 5.9, h.z - 3.4, 1], [h.x + 5.4, h.z - 3.0, 0.85]]) {
      k.tube(knit(0x5b4a44), [[x, 0, z], [x + 0.1 * s, 1.4 * s, z], [x - 0.2 * s, 2.6 * s, z + 0.1]], 0.16 * s, { straight: true });
      for (const [bx2, by, bz2] of [[0.9, 3.3, 0.2], [-1.0, 3.1, -0.3], [0.5, 3.7, -0.6], [-0.4, 3.9, 0.5]]) k.tube(knit(0x5b4a44), [[x - 0.1 * s, 2.2 * s, z], [x + bx2 * s * 0.6, by * s * 0.82, z + bz2 * s], [x + bx2 * s, by * s, z + bz2 * s * 1.6]], 0.06 * s, { straight: true });
    }
    for (let i = 0; i < 13; i++) { const x = h.x - 4.8 + i * 0.8; if (Math.abs(x - dx) < 1.5) continue; box(k, dark, 0.12, 0.9 + (i % 3) * 0.12, 0.08, x, 0.45, dz - 2.3, 0.02, { rz: (i % 2 ? 1 : -1) * 0.06 }); if (i < 12 && Math.abs(x + 0.8 - dx) >= 1.5) k.tube(dark, [[x, 0.6, dz - 2.3], [x + 0.8, 0.6, dz - 2.3]], 0.03, { straight: true }); }
  }

  // ====================================================================== 06 摩天轮
  const wheel = group(root, WHEEL.x, WHEEL.y, WHEEL.z), cabins = [];
  {
    const W = WHEEL, R = W.r, half = 0.62, north = W.z - 2.4;
    const rim = raw('felt', GOLD);
    for (const s of [-1, 1]) obj(wheel, new T.TorusGeometry(R, 0.11, 8, 60), rim, 0, 0, s * half).castShadow = false;
    part(wheel, kit => {
      for (let i = 0; i < W.cars; i++) {
        const a = i * TAU / W.cars, c = Math.cos(a), sn = Math.sin(a);
        for (const s of [-1, 1]) kit.tube(i % 2 ? gold : cream, [[0, 0, s * half * 0.5], [R * c, R * sn, s * half]], 0.05, { straight: true });
        kit.tube(gold, [[R * c, R * sn, -half], [R * c, R * sn, half]], 0.06, { straight: true });
        const b = (i + 0.5) * TAU / W.cars; kit.tube(gold, [[R * 0.6 * c, R * 0.6 * sn, half], [R * 0.6 * Math.cos(b), R * 0.6 * Math.sin(b), half]], 0.03, { straight: true });
      }
      kit.cyl(red, 0.5, 0.5, half * 2 + 0.3, 0, 0, 0, { seg: 16, rx: Math.PI / 2 }); star(kit, gold, 0.42, 0, 0, half + 0.18); star(kit, gold, 0.42, 0, 0, -half - 0.18);
    });
    const bulbs = glow(0xffe9a8, 2.2);
    for (let i = 0; i < 20; i++) { const a = i * TAU / 20 + 0.16; obj(wheel, new T.SphereGeometry(0.075, 8, 6), bulbs, Math.cos(a) * R, Math.sin(a) * R, half + 0.1).castShadow = false; }
    // A 字支架、上客平台、台阶（朝北，朝小径）
    for (const s of [-1, 1]) for (const e of [-1, 1]) k.tube(wood, [[W.x + e * 3.4, 0.2, W.z + s * 1.25], [W.x, W.y, W.z + s * 0.95]], 0.17, { straight: true });
    for (const s of [-1, 1]) { k.tube(wood, [[W.x - 1.75, W.y * 0.5, W.z + s * 1.1], [W.x + 1.75, W.y * 0.5, W.z + s * 1.1]], 0.1, { straight: true }); box(k, red, 0.5, 0.5, 0.3, W.x, W.y, W.z + s * 0.98, 0.08); }
    box(k, quilt(TEAL), 8.4, 0.34, 3.6, W.x, 0.17, W.z, 0.08); box(k, M('boards', 0xb98a66), 4.4, 0.12, 3.0, W.x, 0.4, north + 0.1, 0.04);
    for (let i = 0; i < 2; i++) box(k, M('boards', 0xb98a66), 2.2, 0.14, 0.4, W.x, 0.3 - i * 0.16, north - 1.5 - i * 0.4, 0.03);
    for (const e of [-1, 1]) { for (const dz of [-1.3, 0.3]) box(k, wood, 0.1, 0.95, 0.1, W.x + e * 2.1, 0.9, north + dz, 0.03); k.tube(wood, [[W.x + e * 2.1, 1.3, north - 1.3], [W.x + e * 2.1, 1.3, north + 0.3]], 0.04, { straight: true }); }
    box(k, M('boards', 0xb98a66), 0.9, 1.0, 0.9, W.x + 3.3, 0.85, north - 0.2, 0.06); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(k, red, 0.08, 0.9, 0.08, W.x + 3.3 + sx * 0.4, 1.8, north - 0.2 + sz * 0.4, 0.02); awning(k, W.x + 3.3, north - 0.2, 2.3, 1.2, 1.2, gold);   // 操作亭
    // 吊舱：挂点在顶上，舱在下面。坐进去的时候眼睛在挂点下 0.5 米左右，看得到栏杆和四根柱子
    for (let i = 0; i < W.cars; i++) {
      const tone = [teal, coral, gold][i % 3];
      cabins.push(part(wheel, kit => {
        kit.tube(ink, [[0, 0, -half], [0, -0.3, -0.5], [0, -0.3, 0.5], [0, 0, half]], 0.03, { straight: true });
        box(kit, cream, 1.5, 0.1, 1.24, 0, -0.34, 0, 0.05); puff(kit, cream, 0.24, 0, -0.22, 0, { sx: 3.3, sy: 0.9, sz: 2.8 }); puff(kit, tone, 0.1, 0, 0.02, 0);   // 顶：米白的圆顶，一圈扇贝边
        for (let j = 0; j < 12; j++) { const a = j * TAU / 12; puff(kit, cream, 0.12, Math.cos(a) * 0.76, -0.4, Math.sin(a) * 0.62, { sy: 0.9, seg: 8, rings: 5 }); }
        puff(kit, tone, 0.62, 0, -1.52, 0, { sx: 1.2, sy: 0.42, sz: 0.98 });   // 圆肚子的舱底
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(kit, cream, 0.06, 1.1, 0.06, sx * 0.66, -0.9, sz * 0.52, 0.02);
        box(kit, tone, 1.44, 0.14, 1.16, 0, -1.5, 0, 0.06);   // 底
        for (const sz of [-1, 1]) box(kit, tone, 1.44, 0.36, 0.08, 0, -1.28, sz * 0.56, 0.05);   // 前后的围板（矮一点，坐着能越过去看）
        for (const sx of [-1, 1]) { box(kit, tone, 0.08, 0.36, 1.16, sx * 0.7, -1.28, 0, 0.05); box(kit, cream, 0.28, 0.08, 1.0, sx * 0.5, -1.3, 0, 0.03); }   // 两侧的围板和座
        kit.tube(gold, [[-0.7, -1.07, -0.56], [0.7, -1.07, -0.56], [0.7, -1.07, 0.56], [-0.7, -1.07, 0.56], [-0.7, -1.07, -0.56]], 0.03, { straight: true });   // 栏杆
      }));
    }
  }

  // ====================================================================== 07 游戏摊街
  const stalls = {};
  {
    const accents = [red, teal, gold], names = [copy('打积木', 'KNOCKDOWN'), copy('打绒鸭', 'DUCK POND'), copy('打气球', 'BALLOON POP')];
    STALLS.forEach((st, i) => {
      const x = st.x, z = st.z, accent = accents[i], back = x - 1.3;   // 柜台朝东（朝小径），后墙在西
      box(k, M('boards', 0xb98a66), 0.5, 0.95, 3.2, x + 1.2, 0.475, z, 0.05); box(k, wood, 0.66, 0.08, 3.36, x + 1.2, 0.99, z, 0.03);
      for (let j = 0; j < 6; j++) box(k, j % 2 ? cream : accent, 0.06, 0.8, 3.2 / 6, x + 1.47, 0.46, z - 1.6 + (j + 0.5) * 3.2 / 6, 0.02);
      box(k, M('boards', 0x9a7250), 0.14, 2.6, 3.4, back, 1.3, z, 0.04); for (const s of [-1, 1]) { box(k, M('boards', 0x9a7250), 2.6, 2.6, 0.12, x - 0.05, 1.3, z + s * 1.7, 0.04); box(k, accent, 0.14, 2.7, 0.14, x + 1.4, 1.35, z + s * 1.66, 0.04); }
      awning(k, x + 0.55, z, 2.86, 3.6, 3.7, accent); for (let j = 0; j < 9; j++) puff(k, j % 2 ? cream : accent, 0.2, x + 2.36, 2.72, z - 1.6 + j * 0.4, { sx: 0.3, sy: 1.0, seg: 8, rings: 5 });
      for (let j = 0; j < 4; j++) puff(k, felt([0xf5bf55, 0x72aba0, 0xe4a294, 0xb9a4cf][(i + j) % 4]), 0.19, x + 1.2, 2.35 - (j % 2) * 0.18, z - 1.2 + j * 0.8, { sy: 1.15 });   // 挂着的奖品
      stripedRoof(k, x + 0.2, z, 2.02, 2.94, 4.25, [accent, cream], 12); k.cyl(wood, 0.03, 0.03, 0.8, x + 0.2, 4.6, z, { seg: 6 }); puff(k, gold, 0.07, x + 0.2, 5.02, z);
      k.quad(accent, [x + 0.2, 4.98, z], [x + 0.2, 4.9, z + 0.6], [x + 0.2, 4.68, z + 0.56], [x + 0.2, 4.66, z], undefined, 1, [1, 0, 0]); k.quad(accent, [x + 0.2, 4.9, z + 0.6], [x + 0.2, 4.98, z], [x + 0.2, 4.66, z], [x + 0.2, 4.68, z + 0.56], undefined, 1, [-1, 0, 0]);
      sign(names[i], x + 2.16, 3.05, z, 2.5, Math.PI / 2);
      k.cyl(cream, 0.5, 0.5, 0.06, x + 2.2, 3.86, z, { seg: 20, rz: Math.PI / 2 }); picture('stall-' + st.id + '.webp', 0.84, 0.84, x + 2.25, 3.86, z, Math.PI / 2, { cutout: true });
      box(k, wood, 0.5, 0.08, 2.9, back + 0.35, 1.15, z, 0.03);   // 摆靶子的架子
      const items = [];
      if (st.id === 'blocks') [[0, 0], [0, 1], [0, 2], [1, 0.5], [1, 1.5], [2, 1]].forEach(([row, col], j) => items.push(part(root, kit => box(kit, felt([RED, TEAL, GOLD, CORAL, NAVY, MOSS][j]), 0.3, 0.3, 0.3, 0, 0.15, 0, 0.05), back + 0.35, 1.19 + row * 0.3, z + (col - 1) * 0.34)));
      else if (st.id === 'ducks') for (let j = 0; j < 3; j++) items.push(part(root, kit => { puff(kit, felt(0xf2cf62), 0.19, 0, 0.17, 0, { sy: 0.85, sz: 1.2 }); puff(kit, felt(0xf2cf62), 0.12, 0.02, 0.36, 0.1); puff(kit, felt(0xe58b3a), 0.05, 0.1, 0.34, 0.14); puff(kit, ink, 0.025, 0.1, 0.4, 0.06); }, back + 0.35, 1.19, z + (j - 1) * 0.8));
      else for (let j = 0; j < 6; j++) items.push(part(root, kit => { puff(kit, felt([RED, TEAL, GOLD, CORAL, NAVY, 0xb9a4cf][j]), 0.2, 0, 0, 0, { sy: 1.2 }); box(kit, ink, 0.02, 0.3, 0.02, 0, -0.38, 0, 0.005); }, back + 0.24, 1.75 + (j % 2) * 0.5, z - 1.1 + j * 0.44));
      const ball = obj(root, new T.SphereGeometry(0.09, 10, 8), raw('felt', 0xf3dfa5), 0, -5, 0); ball.castShadow = false;
      stalls['stall-' + st.id] = { x, z, items, home: items.map(o => o.position.clone()), down: items.map(() => 0), ball, flight: null, kind: st.id };
    });
  }

  // ====================================================================== 08 碰碰车
  const cars = [];
  {
    const R = RINK, floor = obj(root, new T.CylinderGeometry(1, 1, 0.14, 44), raw('quilt', NAVY), R.x, 0.08, R.z); floor.scale.set(R.rx + 0.1, 1, R.rz + 0.1);
    const rimAt = (a, grow = 0) => [R.x + Math.cos(a) * (R.rx + grow), R.z + Math.sin(a) * (R.rz + grow)];
    // 软垫围挡：朝东（朝小径）留一个口
    const gate = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.26, seg = [];
    for (let i = 0; i <= 56; i++) { const a = i * TAU / 56; if (gate(a)) { if (seg.length > 1) { k.tube(cream, seg.map(([x, z]) => [x, 0.62, z]), 0.2, { straight: true }); k.tube(felt(NAVY), seg.map(([x, z]) => [x, 0.3, z]), 0.24, { straight: true }); } seg.length = 0; continue; } seg.push(rimAt(a, 0.22)); }
    if (seg.length > 1) { k.tube(cream, seg.map(([x, z]) => [x, 0.62, z]), 0.2, { straight: true }); k.tube(felt(NAVY), seg.map(([x, z]) => [x, 0.3, z]), 0.24, { straight: true }); }
    for (let i = 0; i < 14; i++) { const a = (i + 0.5) * TAU / 14; if (gate(a)) continue; const [x, z] = rimAt(a, 0.5); star(k, gold, 0.16, x, 0.34, z); }
    // 入口上的红白拱门，顶上一颗星
    const [gx, gz] = rimAt(0, 0.4), arch = Array.from({ length: 13 }, (_, i) => { const a = Math.PI * i / 12; return [gx, 0.3 + Math.sin(a) * 2.5, gz + Math.cos(a) * 1.7]; });
    for (let i = 1; i < arch.length; i++) k.tube(i % 2 ? red : cream, [arch[i - 1], arch[i]], 0.2, { straight: true });
    star(k, gold, 0.36, gx + 0.1, 3.1, gz);
    const tones = [0xd9776a, 0x67b7ad, 0xf0c35c, 0xb9a4cf];
    for (let i = 0; i < PARK.bumpers.cars; i++) cars.push(part(root, kit => {   // 小车：圆滚滚的车身、一圈黑缓冲垫、座椅、方向盘、小旗杆
      puff(kit, ink, 0.6, 0, 0.16, 0, { sx: 0.98, sy: 0.32, sz: 1.22 }); puff(kit, felt(tones[i]), 0.52, 0, 0.3, 0, { sx: 0.96, sy: 0.5, sz: 1.2 });
      puff(kit, felt(0x4a3d44), 0.3, 0, 0.44, -0.08, { sx: 1.05, sy: 0.4, sz: 1.1 }); box(kit, cream, 0.6, 0.42, 0.14, 0, 0.66, -0.42, 0.06);
      kit.tube(ink, [[0, 0.44, 0.52], [0, 0.6, 0.44]], 0.022, { straight: true }); kit.cyl(ink, 0.11, 0.11, 0.03, 0, 0.61, 0.43, { seg: 12, rx: 1.1 });   // 方向盘：低、靠前，坐着的时候在视线下沿
      for (const s of [-1, 1]) puff(kit, cream, 0.07, s * 0.26, 0.34, 0.56); kit.tube(wood, [[-0.3, 0.5, -0.5], [-0.3, 1.5, -0.5]], 0.015, { straight: true });
      kit.quad(felt(tones[(i + 1) % 4]), [-0.3, 1.5, -0.5], [-0.02, 1.42, -0.5], [-0.3, 1.3, -0.5], [-0.3, 1.3, -0.5], undefined, 1, [0, 0, 1]); kit.quad(felt(tones[(i + 1) % 4]), [-0.02, 1.42, -0.5], [-0.3, 1.5, -0.5], [-0.3, 1.3, -0.5], [-0.3, 1.3, -0.5], undefined, 1, [0, 0, -1]);
    }, 0, 0, 0, true));
  }

  // ====================================================================== 09 镜子迷宫
  {
    // 镜面：一块很光的金属面，照出天和周围的颜色。哈哈镜里的绒仔等贴图到了再加（docs/park-asset-handoff.md）
    const mirror = new T.MeshStandardMaterial({ color: 0xd4ecf2, metalness: 1, roughness: 0.07, envMapIntensity: 1.3 });
    for (const wall of TOUR_MAZE) {
      const length = Math.max(wall.w, wall.d), wide = wall.w > wall.d, cols = Math.max(1, Math.round(length / 1.3));
      for (let i = 0; i < cols; i++) {
        const delta = length * ((i + 0.5) / cols - 0.5), x = wall.x + (wide ? delta : 0), z = wall.z + (wide ? 0 : delta), w = length / cols;
        box(k, cream, wide ? 0.1 : 0.2, 2.3, wide ? 0.2 : 0.1, x - (wide ? w / 2 : 0), 1.15, z - (wide ? 0 : w / 2), 0.03); puff(k, gold, 0.1, x - (wide ? w / 2 : 0), 2.44, z - (wide ? 0 : w / 2)); box(k, felt(0x9cc7d0), wide ? w : 0.2, 0.14, wide ? 0.2 : w, x, 2.28, z, 0.04); box(k, felt(0x9cc7d0), wide ? w : 0.2, 0.16, wide ? 0.2 : w, x, 0.08, z, 0.04);
        const pane = obj(root, new T.BoxGeometry(wide ? w - 0.12 : 0.09, 2.0, wide ? 0.09 : w - 0.12), mirror, x, 1.18, z); pane.castShadow = false;
      }
    }
    const ax = 20.6, az = 19.9;   // 入口的拱门（东头）
    for (const s of [-1, 1]) { box(k, cream, 0.32, 2.7, 0.32, ax, 1.35, az + s * 1.25, 0.08); box(k, wood, 0.4, 0.3, 0.4, ax, 0.15, az + s * 1.25, 0.05); puff(k, gold, 0.16, ax, 2.78, az + s * 1.25); }
    const hoopLine = r => Array.from({ length: 11 }, (_, i) => { const a = Math.PI * i / 10; return [ax, 2.6 + Math.sin(a) * r * 0.64, az + Math.cos(a) * r]; });
    k.tube(red, hoopLine(1.25), 0.17, { radial: 8 }); k.tube(gold, hoopLine(1.02).map(([x, y, z]) => [x + 0.06, y - 0.08, z]), 0.07, { radial: 6 }); star(k, gold, 0.3, ax + 0.14, 3.5, az);
    // 哈哈镜：路上迎面的三块镜板里是被拉长、压扁、扭歪的绒仔
    picture('mirror-tall.webp', 0.98, 1.96, 13.05 + 0.06, 1.18, 19.935, Math.PI / 2);
    picture('mirror-wide.webp', 0.98, 1.96, 13.0, 1.18, 13 + 0.06, 0);
    picture('mirror-wavy.webp', 0.98, 1.96, 9.28 + 0.06, 1.18, 15.2325, Math.PI / 2);
  }

  // ====================================================================== 10 马戏团
  const tentLights = [], performers = [], hoop = group(root, STAGE.x - 2.0, 0.5, STAGE.z + 1.4); let gong, spot;
  {
    const tnt = TOUR_TENT, N = 28, at = (theta, y, r = tnt.radius) => [Math.sin(theta) * r, y, Math.cos(theta) * r];
    k.cyl(quilt(0xc49972), tnt.radius - 0.16, tnt.radius - 0.16, 0.09, 0, 0.04, 0, { seg: 48 });
    for (let i = 0; i < N; i++) {
      if (i === 0 || i === 1 || i === N - 1) continue;
      const a = (i - 0.5) * TAU / N, b = (i + 0.5) * TAU / N, aa = (a + b) / 2;
      k.quad(i % 2 ? red : cream, at(b, 0.017), at(a, 0.017), at(a, 3.85), at(b, 3.85), [[0, 0], [1, 0], [1, 3.2], [0, 3.2]], 1, [Math.sin(aa), 0, Math.cos(aa)]);
      k.quad(i % 2 ? quilt(0xa05151) : quilt(0xc9aa82), at(b, 0.017, tnt.radius - 0.045), at(a, 0.017, tnt.radius - 0.045), at(a, 3.85, tnt.radius - 0.045), at(b, 3.85, tnt.radius - 0.045), [[0, 0], [1, 0], [1, 3.2], [0, 3.2]], 0.52, [-Math.sin(aa), 0, -Math.cos(aa)]);
    }
    stripedRoof(k, 0, 0, tnt.radius + 0.38, 3.82, 9.2, [red, cream], N, true);
    for (let i = 0; i < N; i++) { const a = i * TAU / N; puff(k, gold, 0.13, ...at(a, 3.46, tnt.radius + 0.4)); k.tube(gold, [at(a, 3.8, tnt.radius + 0.4), at(a, 3.5, tnt.radius + 0.4)], 0.025, { straight: true });
      if (i % 2 === 0 && i > 1 && i < N - 1) box(k, gold, 0.36, 0.36, 0.03, ...at(a, 1.7, tnt.radius + 0.03), 0.02, { ry: a, rz: Math.PI / 4 }); }
    [['poster-circus-1.webp', -2.5, 11.9, 0.34], ['poster-circus-2.webp', 5.3, 12.9, -0.42], ['poster-circus-3.webp', -4.3, 9.6, 0.5]].forEach(([file, x, z, yaw]) => {   // 海报牌：朝着从南边走来的人
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (const e of [-1, 1]) box(k, wood, 0.1, 2.5, 0.1, x + e * 0.66 * fz, 1.25, z - e * 0.66 * fx, 0.03);
      box(k, M('boards', 0x9a6f4c), 1.34, 1.74, 0.07, x, 1.6, z, 0.03, { ry: yaw }); box(k, red, 1.5, 0.14, 0.16, x, 2.56, z, 0.04, { ry: yaw }); puff(k, gold, 0.09, x, 2.72, z);
      picture(file, 1.2, 1.6, x + fx * 0.05, 1.6, z + fz * 0.05, yaw);
    });
    for (const side of [-1, 1]) {   // 门口：两根红柱、束起来的门帘
      const x = side * 2.02; box(k, red, 0.44, 4.11, 0.46, x, 2.05, 7.40, 0.10); puff(k, gold, 0.18, x, 3.98, 7.64);
      puff(k, quilt(RED), 0.62, x + side * 0.3, 2.6, 7.5, { sx: 0.9, sy: 1.9, sz: 0.4 }); puff(k, quilt(RED), 0.4, x + side * 0.5, 1.1, 7.5, { sx: 0.8, sy: 1.6, sz: 0.4 }); k.tube(gold, [[x + side * 0.05, 1.75, 7.72], [x + side * 0.75, 1.75, 7.72]], 0.05, { straight: true });
    }
    box(k, red, 4.4, 0.35, 0.40, 0, 3.87, 7.54, 0.073); sign(copy('马戏团', 'BIG TOP'), 0, 3.74, 7.78, 3.61);
    k.cyl(wood, 0.063, 0.075, 1.43, 0, 9.77, 0, { seg: 10 }); k.quad(red, [0.05, 10.31, 0], [1.45, 10.15, 0.12], [1.31, 9.69, 0.28], [0.05, 9.74, 0], undefined, 1, [0, 0, 1]); k.quad(red, [1.45, 10.15, 0.12], [0.05, 10.31, 0], [0.05, 9.74, 0], [1.31, 9.69, 0.28], undefined, 1, [0, 0, -1]);
    for (const [x, z] of [[-9.6, 2.4], [9.6, 2.4]]) { k.cyl(cream, 1.9, 1.9, 2.0, x, 1.0, z, { seg: 16 }); stripedRoof(k, x, z, 2.2, 1.98, 4.2, [red, cream], 12); puff(k, gold, 0.14, x, 4.3, z); }   // 两侧的小帐
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18, b = (i + 0.5) * TAU / 18; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4) continue;   // 外面一圈三角旗
      const p = at(a, 4.0, tnt.radius + 0.5), q = at((i + 1) * TAU / 18, 4.0, tnt.radius + 0.5), m = at(b, 3.55, tnt.radius + 0.5);
      k.quad(felt([GOLD, TEAL, CORAL, CREAM][i % 4]), p, q, m, m, undefined, 1, [Math.sin(b), 0, Math.cos(b)]); }
    // 里面：一圈红白的场沿、锯末地、圆台、看台、从顶上拉下来的灯串
    k.cyl(quilt(0xd9b98a), 3.9, 3.9, 0.03, 0, 0.1, -1.5, { seg: 40 });
    for (let i = 0; i < 24; i++) { const a = i * TAU / 24; if (Math.cos(a) > 0.86) continue; box(k, i % 2 ? red : cream, 1.06, 0.3, 0.34, Math.sin(a) * 4.0, 0.2, -1.5 + Math.cos(a) * 4.0, 0.08, { ry: a }); }
    box(k, M('boards', 0x9a6f4c), 3.4, 0.36, 2.4, STAGE.x, 0.22, STAGE.z, 0.06); k.cyl(gold, 1.0, 1.08, 0.3, STAGE.x, 0.55, STAGE.z, { seg: 20 }); k.cyl(red, 0.62, 0.7, 0.36, STAGE.x + 1.2, 0.58, STAGE.z + 0.2, { seg: 16 }); k.cyl(teal, 0.62, 0.7, 0.36, STAGE.x - 1.2, 0.58, STAGE.z + 0.2, { seg: 16 });
    for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 16; i++) { const a = Math.PI * (0.62 + i * 0.76 / 15), r = 5.2 + tier * 0.72; box(k, M('boards', tier % 2 ? 0xb98a66 : 0x9a7250), 1.24 + tier * 0.16, 0.3, 0.7, Math.sin(a) * r, 0.25 + tier * 0.38, -0.6 + Math.cos(a) * r, 0.04, { ry: a }); }
    for (const [x, z] of [[-1.6, 1.4], [1.6, 1.4]]) box(k, red, 0.16, 8.4, 0.16, x * 2.2, 4.2, z * 1.5 - 1.5, 0.05);   // 两根撑帐子的柱
    const lamp = glow(0xffd884, 2.2);
    for (let j = 0; j < 8; j++) { const a = j * TAU / 8 + 0.2; k.tube(ink, [[0, 8.6, 0], [Math.sin(a) * 3.4, 5.6, Math.cos(a) * 3.4], [Math.sin(a) * 6.9, 3.7, Math.cos(a) * 6.9]], 0.012, { straight: true });
      for (let t = 1; t <= 4; t++) { const f = t / 4.6, r = 6.9 * f, y = 8.6 - (8.6 - 3.7) * (f * 0.75 + f * f * 0.25); const m = obj(root, new T.SphereGeometry(0.09, 8, 5), lamp, Math.sin(a) * r, y, Math.cos(a) * r); m.castShadow = false; tentLights.push(m); } }
    spot = obj(root, new T.CylinderGeometry(1.5, 1.5, 0.012, 28), new T.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false }), STAGE.x, 0.72, STAGE.z);
    // 锣：台子右前方的架子上
    box(k, wood, 0.1, 1.5, 0.1, 1.5, 0.75, -2.2, 0.03); box(k, wood, 0.1, 1.5, 0.1, 2.3, 0.75, -2.2, 0.03); box(k, wood, 1.0, 0.1, 0.1, 1.9, 1.5, -2.2, 0.03);
    gong = part(root, kit => { kit.cyl(gold, 0.34, 0.34, 0.04, 0, -0.42, 0, { seg: 20, rx: Math.PI / 2 }); kit.cyl(felt(0xc98f3a), 0.12, 0.12, 0.05, 0, -0.42, 0, { seg: 12, rx: Math.PI / 2 }); kit.tube(ink, [[-0.2, 0, 0], [-0.2, -0.14, 0]], 0.01, { straight: true }); kit.tube(ink, [[0.2, 0, 0], [0.2, -0.14, 0]], 0.01, { straight: true }); }, 1.9, 1.46, -2.2);
    // 三位演员：熊、两只兔子
    const animal = (tone, ears, x, z) => part(root, kit => {
      const body = felt(tone);
      puff(kit, body, 0.34, 0, 0.36, 0, { sy: 1.1 }); puff(kit, body, 0.27, 0, 0.86, 0); puff(kit, cream, 0.12, 0, 0.8, 0.22);
      for (const s of [-1, 1]) { puff(kit, ink, 0.035, s * 0.1, 0.92, 0.23); puff(kit, body, 0.12, s * 0.3, 0.45, 0.05, { sy: 1.5 }); puff(kit, body, 0.13, s * 0.15, 0.08, 0.05, { sy: 0.7 });
        if (ears === 'long') puff(kit, body, 0.08, s * 0.12, 1.28, 0, { sy: 2.6 }); else puff(kit, body, 0.1, s * 0.2, 1.08, 0); }
      box(kit, red, 0.3, 0.1, 0.06, 0, 0.64, 0.24, 0.03);
    }, x, 0.7, z, true);
    performers.push(animal(0x9a6a4c, 'round', STAGE.x, STAGE.z), animal(0xf1e6d2, 'long', STAGE.x + 1.2, STAGE.z + 0.2), animal(0xd9b8a8, 'long', STAGE.x - 1.2, STAGE.z + 0.2));
    performers.forEach((g, i) => { g.userData.home = g.position.clone(); g.userData.i = i; });
    part(hoop, kit => { kit.tube(gold, Array.from({ length: 21 }, (_, i) => { const a = i * TAU / 20; return [0, 1.5 + Math.sin(a) * 0.6, Math.cos(a) * 0.6]; }), 0.05, { straight: true }); box(kit, wood, 0.08, 0.9, 0.08, 0, 0.45, 0, 0.03); });
    hoop.visible = false;
  }
  const juggle = [0, 1, 2].map(i => { const m = obj(root, new T.SphereGeometry(0.1, 10, 8), raw('felt', [RED, GOLD, TEAL][i]), 0, -5, 0); m.castShadow = false; return m; });

  finish(k);
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
    clock += dt * (reduced ? 0.5 : 1);
    const t = park.time;
    // 木马：整个伞顶和马一起转；两组马一上一下
    carousel.rotation.y = park.carouselAngle;
    const bob = park.running.carousel > 0 ? Math.min(1, park.running.carousel / 2, (PARK.carousel.time - park.running.carousel) / 2) : 0;
    horsesA.position.y = Math.sin(park.carouselAngle * 3.2) * 0.16 * bob; horsesB.position.y = -Math.sin(park.carouselAngle * 3.2) * 0.16 * bob;
    // 船：一条在跑（或停在码头），另一条拴在码头边上轻轻晃
    ride(boats[0], RAPIDS.at(park.boatU), 0.05 + Math.sin(t * 2.1) * 0.02);
    ride(boats[1], RAPIDS.at(0.93), 0.05 + Math.sin(t * 1.7 + 1) * 0.02);
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
    // 游戏摊：毛球飞过去，打中的靶子倒下；一局结束后靶子复位
    for (const [id, st] of Object.entries(stalls)) {
      const running = park.running[id] > 0;
      if (st.flight) { st.flight.t += dt / 0.36; const f = Math.min(1, st.flight.t), a = st.flight.from, b = st.flight.to; st.ball.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * 0.35, a.z + (b.z - a.z) * f); if (f >= 1) { st.down[st.flight.n] = 1e-6; st.flight = null; st.ball.position.y = -5; } }
      st.items.forEach((g, i) => {
        if (st.down[i] > 0) st.down[i] = Math.min(1, st.down[i] + dt * 3);
        if (!running && !st.flight) st.down[i] = Math.max(0, st.down[i] - dt * 1.5);
        const d = st.down[i], home = st.home[i];
        if (st.kind === 'ducks') { g.position.set(home.x, home.y, home.z + Math.sin(t * 1.3 + i * 2.1) * 0.35); g.rotation.x = -d * 1.5; }
        else if (st.kind === 'blocks') { g.position.set(home.x - d * 0.5, home.y - d * (home.y - 1.19) * 0.9, home.z); g.rotation.z = d * 1.4; }
        else { g.scale.setScalar(Math.max(0.01, 1 - d)); g.position.copy(home); g.position.y += Math.sin(t * 1.6 + i) * 0.03; }
      });
    }
    // 马戏团：开演的时候灯串亮起来、台上打一束光，三位演员按节目动
    const show = park.running.circus, on = show > 0 ? Math.min(1, show / 1.2, (PARK.circus.time - show) / 1.5) : 0;
    tentLights.forEach((m, i) => { m.scale.setScalar(1 + on * (0.5 + 0.4 * Math.sin(t * 5 + i))); });
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
    // 互动点的星星：慢慢转；盖过章的换成青色
    for (const m of markers.values()) { m.mesh.rotation.y = clock * 1.4 + m.phase; m.mesh.position.y = 1.32 + Math.sin(clock * 2 + m.phase) * 0.05; m.mesh.material = park.stamps.includes(m.stop) ? starDone : starOn; }
  }
  // 规则层来的事件：摊位扔球
  function event(e) {
    if (e.what !== 'throw') return;
    const st = stalls[e.id]; if (!st) return;
    const n = st.kind === 'ducks' ? e.n : st.kind === 'blocks' ? [5, 3, 0][e.n] : [1, 3, 4][e.n], target = st.items[n].position;
    st.flight = { n, t: 0, from: new T.Vector3(st.x + 4.6, 1.25, st.z), to: target.clone() };
  }
  update({ park: { time: 0, carouselAngle: 0, running: {}, boatU: 0, coasterU: 0, wheelAngle: 0, cars: Array.from({ length: PARK.bumpers.cars }, () => ({ x: RINK.x, z: RINK.z, heading: 0, bump: 0 })), door: 0, act: 0, stamps: [] } });
  return { update, event };
}
