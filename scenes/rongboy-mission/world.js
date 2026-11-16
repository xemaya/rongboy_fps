// 把编译好的关卡搭成毛绒的家：墙、地面、屋顶、窗、灯和家具都用 library 里的毛绒零件拼。
// 碰撞仍然只认 level.js 的盒子；这里画出来的东西都落在那些盒子里，盒子外只有贴地、贴墙或高过头顶的装饰。
import * as T from 'three';
import { createMaterialLibrary } from '../../engine/index.js';
import { skyMaterial } from '../../engine/kit.js';
import { mulberry32 } from '../../engine/noise.js';
import { registerPlush, plush, roomLit, ROOM_LIGHT } from '../../library/surfaces/plush.js';
import { PlushKit, tone, cabinet, bookshelf, fridge, table, crate, sofa, bed, hedge, tree, planter, stairs, windowUnit, pendantLamp, rug, picture, flower, PETALS } from '../../library/structures/plush.js';
import { woolMaterial } from '../../library/games/rongboy-runtime.js';

export const INDOOR_SKY = 0.4;   // 屋里能分到多少天光（环境光按这个比例压暗）
const WALL = 0xf0e4c8, CEILING = 0xf6eedb, ROOF = 0xd98468, HEDGE = 0x7caa66, LAWN = 0xa5c57c;

function label(text, { width = 512, height = 128, size = 64, ink = '#4d5c47', paper = '#efe3c4' } = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const a = c.getContext('2d');
  a.fillStyle = paper; a.beginPath(); a.roundRect(4, 4, width - 8, height - 8, 22); a.fill();
  a.strokeStyle = '#8b7655'; a.lineWidth = 3; a.setLineDash([10, 8]); a.beginPath(); a.roundRect(12, 12, width - 24, height - 24, 16); a.stroke();
  a.fillStyle = ink; a.textAlign = 'center'; a.textBaseline = 'middle'; a.font = `bold ${size}px Georgia, "Songti SC", serif`;
  a.fillText(text, width / 2, height / 2 + 2);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}

function pickupModel(k, weapons) {
  const g = new T.Group(), heart = k.kind === 'heart', objective = k.kind === 'objective';
  const weapon = weapons.find(w => w.id === k.weapon);
  const color = heart ? 0xd9705f : objective ? 0xe9bf65 : weapon?.color ?? 0xf3dfa5;
  const body = new T.Group(); g.add(body);
  const add = (geometry, material, x, y, z) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); body.add(m); return m; };
  if (heart) {
    for (const sign of [-1, 1]) add(new T.SphereGeometry(0.11, 12, 10), woolMaterial(color), sign * 0.075, 0.06, 0);
    add(new T.ConeGeometry(0.155, 0.2, 12), woolMaterial(color), 0, -0.07, 0).rotation.x = Math.PI;
  } else {
    add(new T.BoxGeometry(0.3, 0.2, 0.22), woolMaterial(0xb58a62), 0, -0.02, 0);
    for (const x of [-0.08, 0.08]) add(new T.SphereGeometry(0.075, 10, 8), woolMaterial(color), x, 0.12, 0);
  }
  const text = heart ? '♥ +1' : objective ? '★' : `${weapon?.name ?? ''} +${k.amount}`;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: label(text, { width: 384, height: 96, size: 46 }), transparent: true, depthWrite: false }));
  sprite.scale.set(0.72, 0.18, 1); sprite.position.y = 0.42; g.add(sprite);
  g.position.set(k.x, 0.55, k.z);
  g.userData.body = body; g.userData.baseY = 0.55;
  return g;
}

function furniture(k, M, c) {
  const look = c.look || c.kind;
  if (look === 'hedge') hedge(k, M, c);
  else if (look === 'tree') tree(k, M, c);
  else if (look === 'planter') planter(k, M, c);
  else if (look === 'stairs') stairs(k, M, c);
  else if (look === 'sofa') sofa(k, M, c);
  else if (look === 'bed') bed(k, M, c);
  else if (look === 'bookshelf') bookshelf(k, M, c);
  else if (look === 'fridge') fridge(k, M, c);
  else if (look === 'wardrobe') cabinet(k, M, c, { doors: 2, crown: true });
  else if (look === 'shed') {
    // 花园工具房：木板墙、一扇门、瓦片顶
    k.soft(M('boards', c.color), c.w, c.h - 0.16, c.d, c.x, (c.h - 0.16) / 2, c.z, { r: 0.04 });
    k.soft(M('shingle', ROOF), c.w + 0.02, 0.17, c.d + 0.02, c.x, c.h - 0.085, c.z, { r: 0.05 });
    const zf = c.z - c.d / 2;
    k.soft(M('quilt', 0x8aa79b), 0.8, 1.7, 0.04, c.x - 0.3, 0.87, zf - 0.004, { r: 0.02 });
    k.loop(M.thread, [[c.x - 0.64, 0.08, zf - 0.03], [c.x - 0.64, 1.66, zf - 0.03], [c.x + 0.04, 1.66, zf - 0.03], [c.x + 0.04, 0.08, zf - 0.03]]);
    k.sphere(M.button(0xe9c46a), 0.035, c.x - 0.02, 0.9, zf - 0.04, { seg: 8, rings: 6 });
    k.soft(M.sheer(0.25), 0.5, 0.45, 0.02, c.x + 0.6, 1.4, zf - 0.006, { r: 0 });
    k.loop(M.thread, [[c.x + 0.33, 1.15, zf - 0.02], [c.x + 0.33, 1.65, zf - 0.02], [c.x + 0.87, 1.65, zf - 0.02], [c.x + 0.87, 1.15, zf - 0.02], [c.x + 0.33, 1.15, zf - 0.02]]);
  } else if (look === 'tv') {
    const l = cabinet(k, M, c), [x, z] = l.pos(0, l.depth / 2), ns = l.ns;
    k.soft(M('toy_wood'), ns ? 0.3 : 0.14, 0.04, ns ? 0.14 : 0.3, x, c.h + 0.02, z, { r: 0.01 });
    k.soft(M('felt', 0x4a4f55), ns ? 0.95 : 0.07, 0.56, ns ? 0.07 : 0.95, x, c.h + 0.34, z, { r: 0.03 });
    const [sx, sz] = l.pos(0, l.depth / 2 + 0.037);
    k.soft(M.glow(0x9fd3d8, 0.55), ns ? 0.84 : 0.006, 0.45, ns ? 0.006 : 0.84, sx, c.h + 0.34, sz, { r: 0 });
  } else if (c.kind === 'cabinet') {
    const l = cabinet(k, M, c), [x, z] = l.pos(l.across * 0.2, l.depth / 2), rnd = l.rnd;
    k.cyl(M.button(0xd08a66), 0.07, 0.055, 0.1, x, c.h + 0.05, z, { seg: 10 });
    for (let i = 0; i < 5; i++) k.sphere(M('terry', 0x6f9a5e), 0.05 + rnd() * 0.03, x + (rnd() - 0.5) * 0.1, c.h + 0.14 + rnd() * 0.1, z + (rnd() - 0.5) * 0.1, { seg: 8, rings: 6 });
  } else if (c.kind === 'bench') table(k, M, c, look === 'bench' && c.id !== 'garden-bench' ? 'coffee' : look);
  else crate(k, M, c, look);
}

export function buildWorld(cine, level, weapons) {
  const scene = cine.scene, B = level.bounds, H = level.height, WT = level.wallThickness;
  const root = new T.Group(); scene.add(root);
  const indoor = level.rooms.filter(r => !r.outdoor);
  const house = indoor.reduce((a, r) => ({ minX: Math.min(a.minX, r.minX), maxX: Math.max(a.maxX, r.maxX), minZ: Math.min(a.minZ, r.minZ), maxZ: Math.max(a.maxZ, r.maxZ) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const hx = (house.minX + house.maxX) / 2, hz = (house.minZ + house.maxZ) / 2, hw = house.maxX - house.minX, hd = house.maxZ - house.minZ;
  const inHouse = (x, z, pad = 0.01) => x >= house.minX - pad && x <= house.maxX + pad && z >= house.minZ - pad && z <= house.maxZ;   // 南立面外侧算室外
  const skyAt = (x, y, z) => (y < H + 0.05 && inHouse(x, z) ? INDOOR_SKY : 1);

  // ---- 材质：织物从材质库烘焙，小硬件（线、纽扣、灯罩、纱帘）用普通材质
  const lib = registerPlush(createMaterialLibrary(cine.renderer, { resolution: 1024 }));
  const cache = new Map(), once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  // 七种织物各自只有一个材质，颜色写在顶点上（{ base, color } 由 PlushKit 展开），同一种布不管多少颜色都只画一次
  const VERTEX = new Set(['felt', 'knit', 'quilt', 'terry', 'leaves', 'boards', 'shingle']);
  const M = (id, color = 0xffffff) => (VERTEX.has(id)
    ? once(id + color, () => ({ base: plush(lib, id, undefined, { vertexColors: true }), color: new T.Color(color) }))
    : plush(lib, id, color === 0xffffff ? undefined : color));
  M.thread = roomLit(skyMaterial({ color: 0xf3e8cc, roughness: 0.85 }), 'vSky');
  const buttonBase = roomLit(skyMaterial({ roughness: 0.3, vertexColors: true }), 'vSky');
  M.button = color => once('b' + color, () => ({ base: buttonBase, color: new T.Color(color) }));
  M.glow = (color, strength) => once('g' + color + ':' + strength, () => { const m = skyMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.9 }); m.userData.noShadow = true; return m; });
  M.sheer = strength => once('s' + strength, () => {
    const m = skyMaterial({ color: 0xfff6e2, emissive: 0xffe6bd, emissiveIntensity: strength, transparent: true, opacity: 0.66, roughness: 1, side: T.DoubleSide, depthWrite: false });
    m.userData.noShadow = true; return m;
  });

  const k = new PlushKit({ skyAt }), far = new PlushKit();   // far：屋顶和远景，不投影
  const rnd = mulberry32(20261115);

  // ---- 地面
  k.soft(M('terry', LAWN), 120, 0.2, 120, hx, -0.1, (B.minZ + B.maxZ) / 2, { r: 0 });   // 草地顶面在 y = 0，室内地面高出 1.2 厘米
  for (const r of indoor) {
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
    k.soft(M(r.surface || 'boards', r.floor), w, 0.07, d, (r.minX + r.maxX) / 2, -0.023, (r.minZ + r.maxZ) / 2, { r: 0, long: w >= d ? 0 : 2 });
  }

  // ---- 墙：内墙取碰撞盒，外墙沿房屋外沿补一圈；窗洞从整段墙里切出来
  const slabs = [];
  for (const c of level.walls) {
    const alongZ = Math.abs(c.w - WT) < 1e-6 && c.d > c.w;
    slabs.push({ alongZ, line: alongZ ? c.x : c.z, t: WT, a0: alongZ ? c.minZ : c.minX, a1: alongZ ? c.maxZ : c.maxX, y0: c.minY, y1: c.maxY, lintel: c.kind === 'lintel' });
  }
  const interiorLines = new Set(slabs.map(s => (s.alongZ ? 'x' : 'z') + s.line));
  for (const [alongZ, edge, out] of [[true, house.minX, -1], [true, house.maxX, 1], [false, house.minZ, -1], [false, house.maxZ, 1]]) {
    if (interiorLines.has((alongZ ? 'x' : 'z') + edge)) continue;   // 这一边本来就有一道内墙（南立面）
    const lo = alongZ ? house.minZ : house.minX, hi = alongZ ? house.maxZ : house.maxX;
    slabs.push({ alongZ, line: edge + out * WT / 2, edge, t: WT, a0: alongZ ? lo - WT : lo, a1: alongZ ? hi + WT / 2 : hi, y0: 0, y1: H });
  }
  const windows = (level.windows || []).map(w => {
    const alongZ = typeof w.x === 'number', edge = alongZ ? w.x : w.z;
    return { alongZ, edge, at: w.at, w: w.w, a0: w.at - w.w / 2, a1: w.at + w.w / 2, sill: w.sill ?? 1.0, head: w.head ?? 2.1, inside: Math.sign((alongZ ? hx : hz) - edge) || 1 };
  });
  const pieces = [];
  for (const s of slabs) {
    const here = windows.filter(w => w.alongZ === s.alongZ && w.edge === (s.edge ?? s.line) && s.y0 === 0 && w.a0 > s.a0 && w.a1 < s.a1).sort((a, b) => a.a0 - b.a0);
    let cursor = s.a0;
    for (const w of here) {
      w.line = s.line;
      pieces.push({ ...s, a0: cursor, a1: w.a0 }, { ...s, a0: w.a0, a1: w.a1, y1: w.sill }, { ...s, a0: w.a0, a1: w.a1, y0: w.head });
      cursor = w.a1;
    }
    pieces.push({ ...s, a0: cursor });
  }
  const wall = M('felt', WALL), wood = M('toy_wood');
  const along = (s, mat, len, h, thick, a, y, across, o) => k.soft(mat, s.alongZ ? thick : len, h, s.alongZ ? len : thick, s.alongZ ? s.line + across : a, y, s.alongZ ? a : s.line + across, o);
  for (const s of pieces) along(s, wall, s.a1 - s.a0, s.y1 - s.y0, s.t, (s.a0 + s.a1) / 2, (s.y0 + s.y1) / 2, 0, { r: 0.012 });
  // 门框和门槛
  for (const s of slabs.filter(s => s.lintel)) {
    for (const sign of [-1, 1]) along(s, wood, 0.08, level.doorHeight, s.t + 0.07, sign > 0 ? s.a1 - 0.04 : s.a0 + 0.04, level.doorHeight / 2, 0, { r: 0.015 });
    along(s, wood, s.a1 - s.a0, 0.08, s.t + 0.07, (s.a0 + s.a1) / 2, level.doorHeight + 0.04, 0, { r: 0.015 });
    along(s, wood, s.a1 - s.a0 - 0.16, 0.03, s.t + 0.1, (s.a0 + s.a1) / 2, 0.012, 0, { r: 0.008 });
  }
  // 窗
  const sun = cine.sunDir;
  for (const w of windows) {
    if (w.line === undefined) continue;
    const facing = Math.max(0, -(w.alongZ ? sun.x : sun.z) * w.inside);   // 朝着太阳的窗，纱帘更亮
    windowUnit(k, M, { ...w, t: WT, glow: Math.round((0.35 + facing * 1.5) * 10) / 10, drape: w.inside > 0 === w.alongZ ? 0xc65a4e : 0x6f93a8 });
    const below = level.furnitureBoxes.some(c => c.maxY > 0.46 && c.minZ < w.edge + 0.7 && c.maxZ > w.edge && c.maxX > w.a0 && c.minX < w.a1);
    if (w.edge === house.maxZ && !below) {   // 南立面窗外的花箱（窗下已经靠着长椅之类的就不挂）
      k.soft(M('boards', 0xb98a66), w.w + 0.1, 0.2, 0.22, w.at, w.sill - 0.2, w.edge + WT / 2 + 0.12, { r: 0.03, long: 0 });
      for (let i = 0, n = Math.round(w.w / 0.16); i < n; i++) flower(k, M, w.at + ((i + 0.5) / n - 0.5) * w.w, w.sill - 0.12, w.edge + WT / 2 + 0.1 + (i % 2) * 0.05, PETALS[Math.floor(rnd() * PETALS.length)], 0.9 + rnd() * 0.5);
    }
  }

  // ---- 每个房间：墙裙（房间自己的颜色）、踢脚线、顶上的木梁
  for (const r of indoor) {
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2, panel = M('quilt', r.accent ?? 0xb9b08f), base = M('felt', tone(r.accent ?? 0xb9b08f, -0.3));
    for (const s of pieces) {
      if (s.y0 !== 0) continue;
      const face = s.alongZ ? [r.minX, r.maxX] : [r.minZ, r.maxZ], span = s.alongZ ? [r.minZ, r.maxZ] : [r.minX, r.maxX];
      const edge = s.edge ?? s.line, a0 = Math.max(s.a0, span[0]), a1 = Math.min(s.a1, span[1]);
      if (!face.includes(edge) || a1 - a0 < 0.12) continue;
      const dir = Math.sign((s.alongZ ? cx : cz) - edge), off = (edge - s.line) + dir * (s.edge === undefined ? s.t / 2 : 0), top = Math.min(0.94, s.y1 - 0.02);
      along(s, panel, a1 - a0, top - 0.1, 0.03, (a0 + a1) / 2, 0.1 + (top - 0.1) / 2, off + dir * 0.011, { r: 0.012 });
      along(s, base, a1 - a0, 0.1, 0.045, (a0 + a1) / 2, 0.05, off + dir * 0.02, { r: 0.012 });
      if (s.y1 > 1) along(s, wood, a1 - a0, 0.045, 0.055, (a0 + a1) / 2, top + 0.02, off + dir * 0.022, { r: 0.012 });
    }
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ, alongX = w < d, n = Math.max(1, Math.round((alongX ? d : w) / 2.2));
    for (let i = 0; i < n; i++) {
      const o = ((i + 0.5) / n - 0.5) * (alongX ? d : w);
      k.soft(wood, alongX ? w - 0.2 : 0.12, 0.13, alongX ? 0.12 : d - 0.2, cx + (alongX ? 0 : o), H - 0.065, cz + (alongX ? o : 0), { r: 0.02, long: alongX ? 0 : 2 });
    }
  }
  // 南立面外侧的墙基
  for (const s of pieces) if (!s.alongZ && s.line === house.maxZ && s.y0 === 0) along(s, M('boards', 0x9db3a0), s.a1 - s.a0, 0.42, 0.04, (s.a0 + s.a1) / 2, 0.21, s.t / 2 + 0.014, { r: 0.015, long: 0 });

  // ---- 天花板（伸出去一截当屋檐，负责挡住太阳）、坡屋顶、烟囱
  // 每个房间一块天花板：顶点落在屋内，才分得到室内的反射光；上面再盖一整块带屋檐的板
  for (const r of indoor) k.soft(M('felt', CEILING), r.maxX - r.minX, 0.06, r.maxZ - r.minZ, (r.minX + r.maxX) / 2, H + 0.03, (r.minZ + r.maxZ) / 2, { r: 0 });
  k.soft(M('felt', CEILING), hw + 1.3, 0.1, hd + 1.3, hx, H + 0.11, hz, { r: 0.03 });
  const pitch = 0.47, run = hd / 2 + 0.75, rise = run * Math.tan(pitch), slope = run / Math.cos(pitch), eave = H + 0.16;
  for (const sign of [-1, 1]) {
    far.soft(M('shingle', ROOF), hw + 1.6, 0.18, slope + 0.1, hx, eave + rise / 2, hz + sign * run / 2, { r: 0.05, rx: sign * pitch, ry: sign > 0 ? Math.PI : 0 });
    for (const x of [house.minX - 0.5, house.maxX + 0.5]) far.quad(M('felt', WALL), [x, eave - 0.05, hz], [x, eave - 0.05, hz + sign * run], [x, eave + rise, hz], [x, eave + rise, hz], [[0, 0], [run, 0], [0, rise], [0, rise]], 1, [Math.sign(x - hx), 0, 0]);
  }
  far.cyl(M('felt', tone(ROOF, -0.2)), 0.13, 0.13, hw + 1.7, hx, eave + rise + 0.05, hz, { seg: 10, rz: Math.PI / 2 });
  const chimney = { x: hx + 4.6, z: hz + 2.6, top: eave + rise - 2.6 * Math.tan(pitch) + 1.5 };
  far.soft(M('quilt', 0xb86a55), 0.9, 2.2, 0.9, chimney.x, chimney.top - 1.1, chimney.z, { r: 0.05 });
  far.soft(M('felt', 0xe9dcc0), 1.06, 0.16, 1.06, chimney.x, chimney.top, chimney.z, { r: 0.05 });

  // ---- 花园：围篱、院门、石板路、门廊
  const edges = [[B.minX, B.minZ, B.maxX, B.minZ], [B.maxX, B.minZ, B.maxX, B.maxZ], [B.maxX, B.maxZ, B.minX, B.maxZ], [B.minX, B.maxZ, B.minX, B.minZ]];
  for (const [x0, z0, x1, z1] of edges) {
    const vertical = x0 === x1, out = vertical ? Math.sign(x0 - (B.minX + B.maxX) / 2) : Math.sign(z0 - (B.minZ + B.maxZ) / 2);
    const lo = vertical ? Math.min(z0, z1) : Math.min(x0, x1), hi = vertical ? Math.max(z0, z1) : Math.max(x0, x1);
    const hLo = vertical ? house.minZ : house.minX, hHi = vertical ? house.maxZ : house.maxX;
    const onHouse = vertical ? (x0 === house.minX || x0 === house.maxX) : (z0 === house.minZ || z0 === house.maxZ);
    const span = (a, b) => {
      if (b - a < 0.3) return;
      const p = (vertical ? x0 : z0) + out * 0.3, len = b - a + (onHouse ? 0 : 0.6);
      hedge(k, M, { id: 'edge' + x0 + z0 + a, x: vertical ? p : (a + b) / 2, z: vertical ? (a + b) / 2 : p, w: vertical ? 0.6 : len, d: vertical ? len : 0.6, h: 2.2, color: HEDGE, hidden: vertical ? (out > 0 ? 'e' : 'w') : (out > 0 ? 's' : 'n') });   // 朝外的一面没人看得到
    };
    if (onHouse) { span(lo, Math.max(lo, hLo)); span(Math.min(hi, hHi) + WT / 2, hi); } else span(lo, hi);
  }
  const gx = level.player.x, gz = B.maxZ - 0.06;
  for (const s of [-1, 1]) { k.soft(wood, 0.16, 1.9, 0.16, gx + s * 0.95, 0.95, gz, { r: 0.03 }); k.sphere(M.button(0xe9c46a), 0.11, gx + s * 0.95, 1.98, gz, { seg: 10, rings: 8 }); }
  for (let i = 0; i < 9; i++) { const x = gx - 0.72 + i * 0.18, h = 1.25 + Math.sin(i / 8 * Math.PI) * 0.3; k.soft(M('felt', 0xf3ead8), 0.13, h, 0.05, x, h / 2 + 0.06, gz, { r: 0.05 }); }
  for (const y of [0.45, 1.05]) k.soft(wood, 1.74, 0.07, 0.035, gx, y, gz + 0.04, { r: 0.012 });
  const stone = [0xd9cdb0, 0xcfc3a4, 0xe2d7bd];
  const path = [[0, 3.75, 4.5], [0, 4.45, 0], [0.05, 5.2, 0], [-0.04, 5.95, 0]];
  for (const s of [-1, 1]) path.push([s * 1.0, 6.5], [s * 2.0, 6.75], [s * 3.0, 7.05], [s * 3.3, 7.9], [s * 2.8, 8.75], [s * 1.9, 9.4], [s * 0.85, 9.9]);
  path.push([-5.45, 3.8], [-5.2, 4.6], [-4.6, 5.3], [-3.7, 5.85], [-2.7, 6.2], [-1.7, 6.45]);
  for (const [x, z] of path) k.cyl(M('felt', stone[Math.floor(rnd() * 3)]), 0.3 + rnd() * 0.06, 0.33 + rnd() * 0.06, 0.035, x + (rnd() - 0.5) * 0.08, 0.004, z, { seg: 12 });
  // 沿围篱脚下的野花和蘑菇（都很矮，不挡路）
  for (let i = 0; i < 46; i++) {
    const side = Math.floor(rnd() * 3), t = rnd();
    const x = side === 0 ? B.minX + 0.22 + rnd() * 0.25 : side === 1 ? B.maxX - 0.22 - rnd() * 0.25 : B.minX + 0.6 + t * (B.maxX - B.minX - 1.2);
    const z = side === 2 ? B.maxZ - 0.22 - rnd() * 0.25 : house.maxZ + 0.5 + t * (B.maxZ - house.maxZ - 1);
    if (Math.abs(x - gx) < 1.2 && z > B.maxZ - 1) continue;
    if (rnd() < 0.2) { k.cyl(M('felt', 0xf3ead8), 0.03, 0.04, 0.1, x, 0.05, z, { seg: 6 }); k.sphere(M('felt', 0xd9584a), 0.09, x, 0.1, z, { seg: 10, rings: 5, thetaLen: Math.PI / 2 }); }
    else flower(k, M, x, 0, z, PETALS[Math.floor(rnd() * PETALS.length)], 0.9 + rnd() * 0.8);
  }
  // 两处入口上方的雨棚和壁灯
  for (const s of slabs.filter(s => s.lintel && !s.alongZ && s.line === house.maxZ)) {
    const x = (s.a0 + s.a1) / 2, w = s.a1 - s.a0 + 0.7, z = house.maxZ + WT / 2;
    k.soft(M('gingham', 0xc65a4e), w, 0.06, 1.0, x, 2.42, z + 0.45, { r: 0.02, rx: 0.32 });
    for (const sx of [-1, 1]) k.soft(wood, 0.06, 0.06, 0.8, x + sx * (w / 2 - 0.08), 2.26, z + 0.4, { r: 0.012, rx: 0.32 });
    k.soft(wood, 0.1, 0.16, 0.1, x + w / 2 + 0.1, 1.86, z + 0.05, { r: 0.02 });
    k.sphere(M.glow(0xffd9a0, 2.2), 0.09, x + w / 2 + 0.1, 1.72, z + 0.1, { seg: 10, rings: 8 });
  }

  // ---- 室内摆设
  const lamps = (level.lamps || []).map(l => pendantLamp(k, M, { x: l.x, z: l.z, ceiling: H, color: l.color ?? 0xffd9a0 }));
  for (const r of level.rugs || []) rug(k, M, { ...r, y: inHouse(r.x, r.z) ? 0.026 : 0.012 });
  (level.pictures || []).forEach((p, i) => picture(k, M, { ...p, seed: i + 1 }));
  for (const c of level.furnitureBoxes) furniture(k, M, c);

  // ---- 远景：毛毡小山、棒棒糖树（都在围篱外面）
  const hills = [0x9dbb7c, 0x8fb074, 0xa9c487, 0x86a86e];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, dist = 34 + rnd() * 24, r = 12 + rnd() * 14;
    far.sphere(M('terry', hills[i % 4]), r, hx + Math.cos(a) * dist, -r * 0.12, (B.minZ + B.maxZ) / 2 + Math.sin(a) * dist, { seg: 22, rings: 10, sy: 0.3 + rnd() * 0.18, uv: 3 });
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, dist = 17 + rnd() * 16, x = hx + Math.cos(a) * dist, z = (B.minZ + B.maxZ) / 2 + Math.sin(a) * dist, s = 0.8 + rnd() * 0.9;
    far.cyl(M('knit', 0x8a6747), 0.16 * s, 0.24 * s, 2.4 * s, x, 1.2 * s, z, { seg: 8 });
    far.sphere(M('terry', rnd() < 0.3 ? 0xd7a35a : rnd() < 0.5 ? 0x7fa66a : 0x6f9a5e), 1.5 * s, x, 3.3 * s, z, { seg: 14, rings: 10, sy: 0.9 });
  }

  const meshes = [...k.build({ name: 'home' }), ...far.build({ name: 'far', cast: false })];
  root.add(...meshes);

  // ---- 会动的小东西：烟囱冒的棉花烟、天上的棉花云（一个实例化网格）
  const puffMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xfff3dd, emissiveIntensity: 0.22 });
  const cloudSpec = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, dist = 26 + rnd() * 40, y = 13 + rnd() * 9, s = 2.2 + rnd() * 2.2;
    for (let j = 0; j < 5; j++) cloudSpec.push({ a, dist, y: y + (j % 2) * s * 0.25 - (j === 0 ? 0 : s * 0.1), s: s * (j === 2 ? 1 : 0.62 + rnd() * 0.2), dx: (j - 2) * s * 0.75 });
  }
  const puffs = new T.InstancedMesh(new T.SphereGeometry(1, 14, 10), puffMat, cloudSpec.length + 4);
  puffs.frustumCulled = false; puffs.castShadow = false; puffs.receiveShadow = false; root.add(puffs);
  const dummy = new T.Object3D();
  function update(time) {
    cloudSpec.forEach((c, i) => {
      const a = c.a + time * 0.004;
      dummy.position.set(hx + Math.cos(a) * c.dist - Math.sin(a) * c.dx, c.y, hz + Math.sin(a) * c.dist + Math.cos(a) * c.dx);
      dummy.scale.set(c.s, c.s * 0.62, c.s * 0.8); dummy.updateMatrix(); puffs.setMatrixAt(i, dummy.matrix);
    });
    for (let j = 0; j < 4; j++) {
      const t = (time * 0.11 + j / 4) % 1, s = 0.28 + t * 0.6;
      dummy.position.set(chimney.x + t * t * 1.8 + Math.sin(time * 0.7 + j) * 0.08, chimney.top + 0.2 + t * 3.2, chimney.z - t * 0.6);
      dummy.scale.setScalar(s * Math.min(1, t * 6) * Math.min(1, (1 - t) * 4)); dummy.updateMatrix(); puffs.setMatrixAt(cloudSpec.length + j, dummy.matrix);
    }
    puffs.instanceMatrix.needsUpdate = true;
  }
  update(0);

  // 楼梯口的告示
  const st = level.furnitureBoxes.find(c => c.kind === 'stairs');
  if (st) {
    const sign = new T.Mesh(new T.PlaneGeometry(1.5, 0.375), new T.MeshStandardMaterial({ map: label('二楼 · 稍后开放', { size: 52 }), roughness: 1 }));
    sign.position.set(st.x, st.h + 0.5, st.z + st.d / 2 - 0.05); root.add(sign);
  }

  // ---- 灯光：每盏吊灯一个朝下的聚光灯（不投影），照亮地面和墙的下半截
  const lights = lamps.map(l => {
    const s = new T.SpotLight(0xffd3a0, 3.2, 10, 1.3, 0.8, 0.5);   // 衰减放得很缓：灯正下方的头顶不至于过曝
    s.position.set(l.x, l.y, l.z); s.target.position.set(l.x, 0, l.z); s.castShadow = false;
    root.add(s, s.target); return s;
  });

  // 屋里的反射光：吊灯和晒到太阳的地板把整间屋子映亮（只作用于见不到天的面，见 library/surfaces/plush.js）
  ROOM_LIGHT.value.setRGB(1.0, 0.86, 0.68).multiplyScalar(1.9);
  // 地面反上来的一点暖光，角色和朝下的面靠它不发黑
  const bounce = new T.HemisphereLight(0x59636e, 0xffd2a0, 0.45); root.add(bounce);

  const pickups = new Map();
  for (const p of level.pickups) { const m = pickupModel(p, weapons); pickups.set(p.id ?? pickups.size + 1, m); root.add(m); }
  const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
  return { root, meshes, pickups, lights, bounce, roomLight: ROOM_LIGHT, update, lib, stats: { tris, materials: meshes.length, ...lib.stats() } };
}
