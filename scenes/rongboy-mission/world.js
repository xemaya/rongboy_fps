// 把编译好的关卡搭成毛绒的家：墙、地面、屋顶、窗、灯和家具都用 library 里的毛绒零件拼。
// 楼有几层就搭几层：每层在自己的坐标里从 y = 0 建起，整组抬到那一层的高度；楼梯间是通高的一个竖井。
// 碰撞仍然只认 level.js 的盒子；这里画出来的东西都落在那些盒子里，盒子外只有贴地、贴墙或高过头顶的装饰。
import * as T from 'three';
import { createMaterialLibrary } from '../../engine/index.js';
import { skyMaterial } from '../../engine/kit.js';
import { mulberry32 } from '../../engine/noise.js';
import { registerPlush, plush, roomLit, ROOM_LIGHT } from '../../library/surfaces/plush.js';
import { PlushKit, tone, cabinet, bookshelf, fridge, table, crate, sofa, bed, hedge, tree, planter, windowUnit, pendantLamp, rug, picture, flower, PETALS } from '../../library/structures/plush.js';
import { woolMaterial } from '../../library/games/rongboy-runtime.js';

export const INDOOR_SKY = 0.4;   // 屋里能分到多少天光（环境光按这个比例压暗）
export const INDOOR_ACTOR = 0.55; // 角色身上的室内反射光强度（见 roomLitActor）
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
  const g = new T.Group(), heart = k.kind === 'heart', objective = k.kind === 'objective', gun = k.kind === 'weapon';
  const weapon = weapons.find(w => w.id === k.weapon);
  const color = heart ? 0xd9705f : objective ? 0xe9bf65 : weapon?.color ?? 0xf3dfa5;
  const body = new T.Group(); g.add(body);
  const add = (geometry, material, x, y, z) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); body.add(m); return m; };
  if (heart) {
    for (const sign of [-1, 1]) add(new T.SphereGeometry(0.11, 12, 10), woolMaterial(color), sign * 0.075, 0.06, 0);
    add(new T.ConeGeometry(0.155, 0.2, 12), woolMaterial(color), 0, -0.07, 0).rotation.x = Math.PI;
  } else if (objective) {   // 毛线篮：一只藤篮装着三团毛线
    add(new T.CylinderGeometry(0.26, 0.2, 0.24, 16), woolMaterial(0xb58a62), 0, -0.04, 0);
    for (const [x, z, c] of [[-0.1, 0.04, 0xe7836f], [0.11, 0.02, 0x9fc3e0], [0, -0.1, 0xf2d27a]]) add(new T.SphereGeometry(0.11, 12, 10), woolMaterial(c), x, 0.13, z);
    const glow = add(new T.TorusGeometry(0.36, 0.018, 8, 28), new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd060, emissiveIntensity: 2.5 }), 0, -0.2, 0);
    glow.rotation.x = Math.PI / 2;
  } else {
    add(new T.BoxGeometry(0.3, 0.2, 0.22), woolMaterial(0xb58a62), 0, -0.02, 0);
    for (const x of [-0.08, 0.08]) add(new T.SphereGeometry(0.075, 10, 8), woolMaterial(color), x, 0.12, 0);
  }
  if (gun) {   // 一把枪：底下一圈光
    const glow = add(new T.TorusGeometry(0.34, 0.018, 8, 28), new T.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x7fd8ff, emissiveIntensity: 2.5 }), 0, -0.2, 0);
    glow.rotation.x = Math.PI / 2;
  }
  const text = heart ? '♥ +1' : objective ? '★ 毛线篮' : gun ? `★ ${weapon?.name ?? ''}` : `${weapon?.name ?? ''} +${k.amount}`;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: label(text, { width: 384, height: 96, size: 46 }), transparent: true, depthWrite: false }));
  sprite.scale.set(0.72, 0.18, 1); sprite.position.y = 0.42; g.add(sprite);
  g.position.set(k.x, (k.y ?? 0) + 0.55, k.z);
  g.userData.body = body; g.userData.baseY = (k.y ?? 0) + 0.55;
  return g;
}

function furniture(k, M, c) {
  const look = c.look || c.kind;
  if (look === 'hedge') hedge(k, M, c);
  else if (look === 'tree') tree(k, M, c);
  else if (look === 'planter') planter(k, M, c);
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
  } else if (look === 'tub') {
    // 浴缸：圆滚滚的白缸，一汪水，两个龙头，一只小黄鸭
    k.soft(M('felt', c.color), c.w, c.h - 0.06, c.d, c.x, (c.h - 0.06) / 2 + 0.06, c.z, { r: 0.22, seg: 3 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.sphere(M.button(0xe9c46a), 0.07, c.x + sx * (c.w / 2 - 0.2), 0.06, c.z + sz * (c.d / 2 - 0.16), { seg: 8, rings: 6 });
    k.soft(M.button(0x9fd6e4), c.w - 0.3, 0.03, c.d - 0.3, c.x, c.h - 0.012, c.z, { r: 0.012 });
    for (let i = 0; i < 7; i++) k.sphere(M('felt', 0xffffff), 0.07 + (i % 3) * 0.02, c.x - c.w * 0.3 + (i % 4) * 0.13, c.h + 0.02, c.z - 0.12 + (i % 3) * 0.12, { seg: 8, rings: 6 });
    k.sphere(M('felt', 0xf2cf62), 0.085, c.x + c.w * 0.18, c.h + 0.05, c.z + 0.05, { seg: 10, rings: 8, sy: 0.8 });
    k.sphere(M('felt', 0xf2cf62), 0.055, c.x + c.w * 0.18 + 0.07, c.h + 0.13, c.z + 0.05, { seg: 8, rings: 6 });
    k.sphere(M.button(0xe58b3a), 0.022, c.x + c.w * 0.18 + 0.125, c.h + 0.125, c.z + 0.05, { seg: 6, rings: 4 });
    k.cyl(M.button(0xcfd6d8), 0.018, 0.018, 0.22, c.x + c.w / 2 - 0.12, c.h + 0.11, c.z - c.d / 2 + 0.1, { seg: 8 });
    k.sphere(M.button(0xcfd6d8), 0.035, c.x + c.w / 2 - 0.12, c.h + 0.23, c.z - c.d / 2 + 0.1, { seg: 8, rings: 6 });
  } else if (look === 'vanity') {
    // 洗手台：柜子上一个水盆，墙上一面镜子
    const l = cabinet(k, M, c, { doors: 2 }), [x, z] = l.pos(0, l.depth / 2), [bx, bz] = l.pos(0, 0.035), ns = l.ns;
    k.cyl(M.button(0xf6f3ec), 0.26, 0.2, 0.05, x, c.h + 0.022, z, { seg: 16 });
    k.cyl(M.button(0xcfd6d8), 0.016, 0.016, 0.18, bx, c.h + 0.09, bz + (ns ? 0.07 : 0), { seg: 8 });
    k.soft(M('toy_wood'), ns ? 1.0 : 0.05, 0.9, ns ? 0.05 : 1.0, bx, 1.65, bz, { r: 0.015 });
    const [mx, mz] = l.pos(0, 0.064);
    k.soft(M.button(0xcfe6ee), ns ? 0.88 : 0.012, 0.78, ns ? 0.012 : 0.88, mx, 1.65, mz, { r: 0 });
  } else if (look === 'basket') {
    // 藤篮：装着几卷布
    k.soft(M('knit', c.color), c.w, c.h - 0.08, c.d, c.x, (c.h - 0.08) / 2, c.z, { r: 0.12, seg: 3 });
    k.soft(M('toy_wood'), c.w + 0.02, 0.05, c.d + 0.02, c.x, c.h - 0.1, c.z, { r: 0.02 });
    const rolls = [0xe7a089, 0x9fc3e0, 0xf2d27a, 0xb7d1a0];
    for (let i = 0; i < 4; i++) k.cyl(M('felt', rolls[i]), 0.085, 0.085, c.d * 0.7, c.x + ((i + 0.5) / 4 - 0.5) * (c.w - 0.2), c.h - 0.02 + (i % 2) * 0.05, c.z, { seg: 10, rx: Math.PI / 2 });
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
  const scene = cine.scene, B = level.bounds, H = level.height, WT = level.wallThickness, SH = level.storeyHeight, N = level.storeys.length, T0 = level.stairs;
  const root = new T.Group(); scene.add(root);
  const house = level.house, hx = (house.minX + house.maxX) / 2, hz = (house.minZ + house.maxZ) / 2, hw = house.maxX - house.minX, hd = house.maxZ - house.minZ;
  const inTower = (x, z) => !!T0 && x >= T0.minX - 0.01 && x <= T0.maxX + 0.01 && z >= T0.endZ - 0.01 && z <= T0.mouthZ;
  const inHouse = (x, z, pad = 0.01) => (x >= house.minX - pad && x <= house.maxX + pad && z >= house.minZ - pad && z <= house.maxZ) || inTower(x, z);   // 南立面外侧算室外
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
  const wall = M('felt', WALL), wood = M('toy_wood'), sun = cine.sunDir;
  const rnd = mulberry32(20261115);

  // ================================================================== 每一层
  // shell：外墙、窗、层间腰线（一直画，从花园看得到）；inner：地面、内墙、家具、灯（只画玩家所在层和上下相邻的层）
  function buildStorey(S) {
    const shell = new PlushKit({ skyAt }), k = new PlushKit({ skyAt }), top = S.index === N - 1, ground = S.index === 0;
    const indoor = S.rooms.filter(r => !r.outdoor && !r.tower);
    for (const r of indoor) {
      const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
      k.soft(M(r.surface || 'boards', r.floor), w, 0.07, d, (r.minX + r.maxX) / 2, -0.023, (r.minZ + r.maxZ) / 2, { r: 0, long: w >= d ? 0 : 2 });
    }
    if (T0) k.soft(M('boards', 0xc9a67a), T0.maxX - T0.minX + 0.2, 0.07, 0.24, 0, -0.023, T0.mouthZ - 0.02, { r: 0, long: 0 });   // 楼梯口的门槛

    // ---- 墙：内墙取碰撞盒；外墙沿房屋外沿补一圈（北面在楼梯间那里留口）；窗洞从整段墙里切出来
    const slabs = [];
    for (const c of S.walls) slabs.push({ alongZ: c.alongZ, line: c.alongZ ? c.x : c.z, t: WT, a0: c.alongZ ? c.minZ : c.minX, a1: c.alongZ ? c.maxZ : c.maxX, y0: c.minY - S.y, y1: c.maxY - S.y, lintel: c.kind === 'lintel' });
    const interiorLines = new Set(slabs.map(s => (s.alongZ ? 'x' : 'z') + s.line)), southOutside = !interiorLines.has('z' + house.maxZ);
    for (const [alongZ, edge, out] of [[true, house.minX, -1], [true, house.maxX, 1], [false, house.minZ, -1], [false, house.maxZ, 1]]) {
      if (interiorLines.has((alongZ ? 'x' : 'z') + edge)) continue;   // 这一边本来就有一道内墙（一层的南立面）
      const lo = alongZ ? house.minZ : house.minX, hi = alongZ ? house.maxZ : house.maxX, base = { alongZ, line: edge + out * WT / 2, edge, t: WT, y0: 0, y1: H, outside: true };
      if (alongZ) slabs.push({ ...base, a0: lo - WT, a1: hi + (southOutside ? WT : WT / 2) });
      else if (T0 && edge === house.minZ) slabs.push({ ...base, a0: lo, a1: T0.minX }, { ...base, a0: T0.maxX, a1: hi });
      else slabs.push({ ...base, a0: lo, a1: hi });
    }
    const windows = S.windows.map(w => {
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
    const facade = s => s.outside || (!s.alongZ && s.line === house.maxZ);   // 朝外的墙归 shell
    const along = (kit, s, mat, len, h, thick, a, y, across, o) => kit.soft(mat, s.alongZ ? thick : len, h, s.alongZ ? len : thick, s.alongZ ? s.line + across : a, y, s.alongZ ? a : s.line + across, o);
    for (const s of pieces) along(facade(s) ? shell : k, s, wall, s.a1 - s.a0, s.y1 - s.y0, s.t, (s.a0 + s.a1) / 2, (s.y0 + s.y1) / 2, 0, { r: 0.012 });
    // 门框和门槛
    for (const s of slabs.filter(s => s.lintel)) {
      const kit = facade(s) ? shell : k;
      for (const sign of [-1, 1]) along(kit, s, wood, 0.08, level.doorHeight, s.t + 0.07, sign > 0 ? s.a1 - 0.04 : s.a0 + 0.04, level.doorHeight / 2, 0, { r: 0.015 });
      along(kit, s, wood, s.a1 - s.a0, 0.08, s.t + 0.07, (s.a0 + s.a1) / 2, level.doorHeight + 0.04, 0, { r: 0.015 });
      along(kit, s, wood, s.a1 - s.a0 - 0.16, 0.03, s.t + 0.1, (s.a0 + s.a1) / 2, 0.012, 0, { r: 0.008 });
    }
    // 窗
    for (const w of windows) {
      if (w.line === undefined) continue;
      const facing = Math.max(0, -(w.alongZ ? sun.x : sun.z) * w.inside);   // 朝着太阳的窗，纱帘更亮
      windowUnit(shell, M, { ...w, t: WT, glow: Math.round((0.35 + facing * 1.5) * 10) / 10, drape: [0xc65a4e, 0x6f93a8, 0xd9a441][(S.index + (w.alongZ ? 0 : 1)) % 3] });
      const outer = w.line + WT / 2;
      const below = ground && S.furnitureBoxes.some(c => c.maxY > 0.46 && c.minZ < w.edge + 0.7 && c.maxZ > w.edge && c.maxX > w.a0 && c.minX < w.a1);
      if (!w.alongZ && w.inside < 0 && !below) {   // 朝花园的窗外挂花箱（窗下已经靠着长椅之类的就不挂）
        shell.soft(M('boards', 0xb98a66), w.w + 0.1, 0.2, 0.22, w.at, w.sill - 0.2, outer + 0.12, { r: 0.03, long: 0 });
        for (let i = 0, n = Math.round(w.w / 0.16); i < n; i++) flower(shell, M, w.at + ((i + 0.5) / n - 0.5) * w.w, w.sill - 0.12, outer + 0.1 + (i % 2) * 0.05, PETALS[Math.floor(rnd() * PETALS.length)], 0.9 + rnd() * 0.5);
      }
    }

    // ---- 每个房间：墙裙（房间自己的颜色）、踢脚线、顶上的木梁、天花板
    for (const r of indoor) {
      const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2, panel = M('quilt', r.accent ?? 0xb9b08f), base = M('felt', tone(r.accent ?? 0xb9b08f, -0.3));
      for (const s of pieces) {
        if (s.y0 !== 0) continue;
        const face = s.alongZ ? [r.minX, r.maxX] : [r.minZ, r.maxZ], span = s.alongZ ? [r.minZ, r.maxZ] : [r.minX, r.maxX];
        const edge = s.edge ?? s.line, a0 = Math.max(s.a0, span[0]), a1 = Math.min(s.a1, span[1]);
        if (!face.includes(edge) || a1 - a0 < 0.12) continue;
        const dir = Math.sign((s.alongZ ? cx : cz) - edge), off = (edge - s.line) + dir * (s.edge === undefined ? s.t / 2 : 0), topY = Math.min(0.94, s.y1 - 0.02);
        along(k, s, panel, a1 - a0, topY - 0.1, 0.03, (a0 + a1) / 2, 0.1 + (topY - 0.1) / 2, off + dir * 0.011, { r: 0.012 });
        along(k, s, base, a1 - a0, 0.1, 0.045, (a0 + a1) / 2, 0.05, off + dir * 0.02, { r: 0.012 });
        if (s.y1 > 1) along(k, s, wood, a1 - a0, 0.045, 0.055, (a0 + a1) / 2, topY + 0.02, off + dir * 0.022, { r: 0.012 });
      }
      const w = r.maxX - r.minX, d = r.maxZ - r.minZ, alongX = w < d, n = Math.max(1, Math.round((alongX ? d : w) / 2.2));
      for (let i = 0; i < n; i++) {
        const o = ((i + 0.5) / n - 0.5) * (alongX ? d : w);
        k.soft(wood, alongX ? w - 0.2 : 0.12, 0.13, alongX ? 0.12 : d - 0.2, cx + (alongX ? 0 : o), H - 0.065, cz + (alongX ? o : 0), { r: 0.02, long: alongX ? 0 : 2 });
      }
      // 每个房间一块天花板：顶点落在屋内，才分得到室内的反射光
      k.soft(M('felt', CEILING), w, 0.06, d, cx, H + 0.03, cz, { r: 0 });
    }
    // 外立面：一层的墙基，层与层之间的腰线，顶层的屋檐（伸出去一截，负责挡住太阳）
    if (ground) for (const s of pieces) if (!s.alongZ && s.line === house.maxZ && s.y0 === 0) along(shell, s, M('boards', 0x9db3a0), s.a1 - s.a0, 0.42, 0.04, (s.a0 + s.a1) / 2, 0.21, s.t / 2 + 0.014, { r: 0.015, long: 0 });
    if (top) shell.soft(M('felt', CEILING), hw + 1.3, 0.1, hd + 1.3, hx, H + 0.11, hz, { r: 0.03 });
    else {
      const band = M('boards', 0xc9b48f), y = H + (SH - H) / 2;
      shell.soft(band, hw + 0.56, SH - H + 0.12, 0.1, hx, y, house.maxZ + (ground ? WT / 2 : WT) + 0.03, { r: 0.03, long: 0 });
      for (const sx of [-1, 1]) shell.soft(band, 0.1, SH - H + 0.12, hd + 0.5, hx + sx * (hw / 2 + WT + 0.03), y, hz + 0.05, { r: 0.03, long: 2 });
      shell.soft(M('felt', WALL), hw + 0.4, SH - H - 0.07, hd + 0.2, hx, y, hz + 0.1, { r: 0 });   // 楼板本身：从楼梯口看过去是实心的（上下各让开一点，不和天花板、地板同面）
    }
    // 两处入口上方的雨棚和壁灯
    if (ground) for (const s of slabs.filter(s => s.lintel && !s.alongZ && s.line === house.maxZ)) {
      const x = (s.a0 + s.a1) / 2, w = s.a1 - s.a0 + 0.7, z = house.maxZ + WT / 2;
      shell.soft(M('gingham', 0xc65a4e), w, 0.06, 1.0, x, 2.42, z + 0.45, { r: 0.02, rx: 0.32 });
      for (const sx of [-1, 1]) shell.soft(wood, 0.06, 0.06, 0.8, x + sx * (w / 2 - 0.08), 2.26, z + 0.4, { r: 0.012, rx: 0.32 });
      shell.soft(wood, 0.1, 0.16, 0.1, x + w / 2 + 0.1, 1.86, z + 0.05, { r: 0.02 });
      shell.sphere(M.glow(0xffd9a0, 2.2), 0.09, x + w / 2 + 0.1, 1.72, z + 0.1, { seg: 10, rings: 8 });
    }

    // ---- 室内摆设
    const lamps = S.lamps.map(l => { const p = pendantLamp(k, M, { x: l.x, z: l.z, ceiling: H, color: l.color ?? 0xffd9a0 }); return { x: p.x, y: p.y + S.y, z: p.z }; });
    for (const r of S.rugs) rug(k, M, { ...r, y: inHouse(r.x, r.z) ? 0.026 : 0.012 });
    S.pictures.forEach((p, i) => picture(k, M, { ...p, seed: S.index * 31 + i + 1 }));
    for (const c of S.furnitureBoxes) if (!ground || inHouse(c.x, c.z)) furniture(k, M, c);
    if (T0 && top) {   // 顶层西边那一跑的口上：栏杆
      const x0 = T0.minX, x1 = -T0.spine, z = T0.mouthZ;
      for (const x of [x0 + 0.06, (x0 + x1) / 2, x1 - 0.06]) k.soft(wood, 0.08, 1.0, 0.08, x, 0.5, z, { r: 0.02 });
      k.soft(wood, x1 - x0, 0.07, 0.1, (x0 + x1) / 2, 1.0, z, { r: 0.025, long: 0 });
      k.soft(M('quilt', 0xc65a4e), x1 - x0 - 0.2, 0.6, 0.04, (x0 + x1) / 2, 0.5, z, { r: 0.02 });
    }
    const group = (kit, name) => { const g = new T.Group(); g.position.y = S.y; g.add(...kit.build({ name: name + S.index })); root.add(g); return g; };
    return { shell: group(shell, 'shell'), inner: group(k, 'inner'), lamps };
  }
  const storeys = level.storeys.map(buildStorey);

  // ================================================================== 楼梯间：通高的竖井，折返楼梯
  const tower = new PlushKit({ skyAt: (x, y, z) => (inTower(x, z) && y < level.top ? INDOOR_SKY : 1) });
  if (T0) {
    const t = T0, tw = t.maxX - t.minX, depth = t.mouthZ - t.endZ, zc = (t.mouthZ + t.endZ) / 2, hgt = level.top - (SH - H), laneW = -t.minX - t.spine, STEPS = 8, dz = t.run / STEPS;
    // 三面墙；北墙在每个半层平台的高度开一扇窗
    for (const sx of [-1, 1]) tower.soft(wall, WT, hgt, depth + WT, sx * (tw / 2 + WT / 2), hgt / 2, zc - WT / 2, { r: 0.012 });
    const nz = t.endZ - WT / 2, wins = [];
    for (let i = 0; i < t.flights; i++) wins.push([i * SH + t.rise + 0.95, i * SH + t.rise + 2.05]);
    for (const sx of [-1, 1]) tower.soft(wall, tw / 2 - 0.65, hgt, WT, sx * (0.65 + (tw / 2 - 0.65) / 2), hgt / 2, nz, { r: 0.012 });
    let cursor = 0;
    for (const [y0, y1] of [...wins, [hgt, hgt]]) { if (y0 - cursor > 0.01) tower.soft(wall, 1.3, y0 - cursor, WT, 0, (cursor + y0) / 2, nz, { r: 0.012 }); cursor = y1; }
    for (const [y0, y1] of wins) windowUnit(tower, M, { line: nz, at: 0, w: 1.3, sill: y0, head: y1, t: WT, inside: 1, alongZ: false, glow: 0.5, drape: 0xd9a441 });
    // 两跑之间的隔墙
    tower.soft(M('felt', tone(WALL, -0.08)), t.spine * 2, hgt, t.run, 0, hgt / 2, (t.landingZ + t.mouthZ) / 2, { r: 0.03 });
    const tread = M('boards', 0xdcc096), runner = M('quilt', 0xc0705a), under = M('boards', 0xcfae82);
    for (let i = 0; i < t.flights; i++) {
      const y = i * SH;
      for (let j = 0; j < STEPS; j++) {
        // 踏步顶面取这一级中点的坡面高度：身体按坡道走，脚和台阶最多差半级
        const zA = t.mouthZ - (j + 0.5) * dz, hA = y + t.rise * (j + 0.5) / STEPS, zB = t.landingZ + (j + 0.5) * dz, hB = y + t.rise + t.rise * (j + 0.5) / STEPS;
        for (const [x, z, h] of [[t.xA, zA, hA], [t.xB, zB, hB]]) {
          tower.soft(j % 2 ? tread : under, laneW - 0.02, 0.34, dz + 0.01, x, h - 0.17, z, { r: 0.02, long: 0 });
          tower.soft(runner, laneW * 0.55, 0.02, dz + 0.02, x, h + 0.006, z, { r: 0.006 });
        }
      }
      tower.soft(tread, tw - 0.02, 0.2, t.landingZ - t.endZ, 0, y + t.rise - 0.1, t.landZ, { r: 0.02, long: 0 });
      tower.soft(runner, tw - 0.5, 0.02, (t.landingZ - t.endZ) * 0.55, 0, y + t.rise + 0.006, t.landZ, { r: 0.006 });
      tower.sphere(M.glow(0xffd9a0, 2.2), 0.08, -tw / 2 + 0.1, y + t.rise + 1.9, t.landZ, { seg: 10, rings: 8 });   // 平台上的壁灯
    }
    // 一层：东边那一跑下面是楼梯柜
    tower.soft(M('quilt', 0xb9a07c), laneW - 0.1, H - 0.5, 0.06, t.xB, (H - 0.5) / 2 + 0.06, t.mouthZ + 0.03, { r: 0.03 });
    tower.loop(M.thread, [[t.spine + 0.14, 0.16, t.mouthZ + 0.07], [t.spine + 0.14, H - 0.56, t.mouthZ + 0.07], [t.maxX - 0.14, H - 0.56, t.mouthZ + 0.07], [t.maxX - 0.14, 0.16, t.mouthZ + 0.07], [t.spine + 0.14, 0.16, t.mouthZ + 0.07]]);
    tower.sphere(M.button(0xe9c46a), 0.035, t.spine + 0.24, 1.05, t.mouthZ + 0.08, { seg: 8, rings: 6 });
    tower.soft(wall, laneW, 0.5, 0.1, t.xB, H - 0.25, t.mouthZ, { r: 0.012 });
    // 竖井的顶
    tower.soft(M('felt', CEILING), tw, 0.06, depth, 0, hgt + 0.03, zc, { r: 0 });
    tower.soft(M('shingle', ROOF), tw + WT * 2 + 0.5, 0.2, depth + WT + 0.4, 0, level.top + 0.06, zc - WT / 2 - 0.1, { r: 0.06 });
  }

  // ================================================================== 花园：草地、围篱、院门、石板路
  const k = new PlushKit(), far = new PlushKit();   // far：屋顶和远景，不投影
  k.soft(M('terry', LAWN), 120, 0.2, 120, hx, -0.1, (B.minZ + B.maxZ) / 2, { r: 0 });   // 草地顶面在 y = 0，室内地面高出 1.2 厘米
  for (const c of level.furnitureBoxes) if (!inHouse(c.x, c.z)) furniture(k, M, c);
  const G = level.outdoor.length ? { minX: house.minX, maxX: house.maxX, minZ: house.maxZ, maxZ: B.maxZ } : null;
  if (G) {
    // 围篱：东、南、西三面，朝外的一面没人看得到
    hedge(k, M, { id: 'edge-s', x: hx, z: G.maxZ + 0.3, w: hw + 1.2, d: 0.6, h: 2.2, color: HEDGE, hidden: 's' });
    for (const sx of [-1, 1]) hedge(k, M, { id: 'edge' + sx, x: hx + sx * (hw / 2 + 0.3), z: (G.minZ + WT / 2 + G.maxZ) / 2, w: 0.6, d: G.maxZ - G.minZ - WT / 2, h: 2.2, color: HEDGE, hidden: sx > 0 ? 'e' : 'w' });
    const gx = level.player.x, gz = G.maxZ - 0.06;
    for (const s of [-1, 1]) { k.soft(wood, 0.16, 1.9, 0.16, gx + s * 0.95, 0.95, gz, { r: 0.03 }); k.sphere(M.button(0xe9c46a), 0.11, gx + s * 0.95, 1.98, gz, { seg: 10, rings: 8 }); }
    for (let i = 0; i < 9; i++) { const x = gx - 0.72 + i * 0.18, h = 1.25 + Math.sin(i / 8 * Math.PI) * 0.3; k.soft(M('felt', 0xf3ead8), 0.13, h, 0.05, x, h / 2 + 0.06, gz, { r: 0.05 }); }
    for (const y of [0.45, 1.05]) k.soft(wood, 1.74, 0.07, 0.035, gx, y, gz + 0.04, { r: 0.012 });
    const stone = [0xd9cdb0, 0xcfc3a4, 0xe2d7bd];
    const path = [[0, 4.45], [0.05, 5.2], [-0.04, 5.95]];
    for (const s of [-1, 1]) path.push([s * 1.0, 6.5], [s * 2.0, 6.75], [s * 3.0, 7.05], [s * 3.3, 7.9], [s * 2.8, 8.75], [s * 1.9, 9.4], [s * 0.85, 9.9]);
    path.push([-5.45, 3.8], [-5.2, 4.6], [-4.6, 5.3], [-3.7, 5.85], [-2.7, 6.2], [-1.7, 6.45]);
    for (const [x, z] of path) k.cyl(M('felt', stone[Math.floor(rnd() * 3)]), 0.3 + rnd() * 0.06, 0.33 + rnd() * 0.06, 0.035, x + (rnd() - 0.5) * 0.08, 0.004, z, { seg: 12 });
    // 沿围篱脚下的野花和蘑菇（都很矮，不挡路）
    for (let i = 0; i < 46; i++) {
      const side = Math.floor(rnd() * 3), u = rnd();
      const x = side === 0 ? G.minX + 0.22 + rnd() * 0.25 : side === 1 ? G.maxX - 0.22 - rnd() * 0.25 : G.minX + 0.6 + u * (hw - 1.2);
      const z = side === 2 ? G.maxZ - 0.22 - rnd() * 0.25 : G.minZ + 0.5 + u * (G.maxZ - G.minZ - 1);
      if (Math.abs(x - gx) < 1.2 && z > G.maxZ - 1) continue;
      if (rnd() < 0.2) { k.cyl(M('felt', 0xf3ead8), 0.03, 0.04, 0.1, x, 0.05, z, { seg: 6 }); k.sphere(M('felt', 0xd9584a), 0.09, x, 0.1, z, { seg: 10, rings: 5, thetaLen: Math.PI / 2 }); }
      else flower(k, M, x, 0, z, PETALS[Math.floor(rnd() * PETALS.length)], 0.9 + rnd() * 0.8);
    }
  }

  // ---- 坡屋顶、烟囱（在顶层上面）
  const roofY = (N - 1) * SH, pitch = 0.47, run = hd / 2 + 0.75, rise = run * Math.tan(pitch), slope = run / Math.cos(pitch), eave = roofY + H + 0.16;
  for (const sign of [-1, 1]) {
    far.soft(M('shingle', ROOF), hw + 1.6, 0.18, slope + 0.1, hx, eave + rise / 2, hz + sign * run / 2, { r: 0.05, rx: sign * pitch, ry: sign > 0 ? Math.PI : 0 });
    for (const x of [house.minX - 0.5, house.maxX + 0.5]) far.quad(M('felt', WALL), [x, eave - 0.05, hz], [x, eave - 0.05, hz + sign * run], [x, eave + rise, hz], [x, eave + rise, hz], [[0, 0], [run, 0], [0, rise], [0, rise]], 1, [Math.sign(x - hx), 0, 0]);
  }
  far.cyl(M('felt', tone(ROOF, -0.2)), 0.13, 0.13, hw + 1.7, hx, eave + rise + 0.05, hz, { seg: 10, rz: Math.PI / 2 });
  const chimney = { x: hx + 4.6, z: hz + 2.6, top: eave + rise - 2.6 * Math.tan(pitch) + 1.5 };
  far.soft(M('quilt', 0xb86a55), 0.9, 2.2, 0.9, chimney.x, chimney.top - 1.1, chimney.z, { r: 0.05 });
  far.soft(M('felt', 0xe9dcc0), 1.06, 0.16, 1.06, chimney.x, chimney.top, chimney.z, { r: 0.05 });

  // ---- 远景：毛毡小山、棒棒糖树（都在围篱外面）
  const hills = [0x9dbb7c, 0x8fb074, 0xa9c487, 0x86a86e];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, dist = 34 + rnd() * 24, r = 12 + rnd() * 14;
    far.sphere(M('terry', hills[i % 4]), r, hx + Math.cos(a) * dist, -r * 0.12, (B.minZ + B.maxZ) / 2 + Math.sin(a) * dist, { seg: 22, rings: 10, sy: 0.3 + rnd() * 0.18, uv: 3 });
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, dist = 19 + rnd() * 16, x = hx + Math.cos(a) * dist, z = (B.minZ + B.maxZ) / 2 + Math.sin(a) * dist, s = 0.8 + rnd() * 0.9;
    far.cyl(M('knit', 0x8a6747), 0.16 * s, 0.24 * s, 2.4 * s, x, 1.2 * s, z, { seg: 8 });
    far.sphere(M('leaves', rnd() < 0.3 ? 0xd7a35a : rnd() < 0.5 ? 0x8fb56c : 0x7da762), 1.5 * s, x, 3.3 * s, z, { seg: 14, rings: 10, sy: 0.9 });
  }

  const fixed = [...k.build({ name: 'garden' }), ...tower.build({ name: 'stairs' }), ...far.build({ name: 'far', cast: false })];
  root.add(...fixed);

  // ---- 会动的小东西：烟囱冒的棉花烟、天上的棉花云（一个实例化网格）
  const puffMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xfff3dd, emissiveIntensity: 0.22 });
  const cloudSpec = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, dist = 30 + rnd() * 40, y = 18 + rnd() * 10, s = 2.2 + rnd() * 2.2;
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

  // ---- 灯光：一组朝下的聚光灯（不投影），只点亮玩家所在那一层的吊灯。灯的数量固定，换层只是挪位置，不会重编着色器。
  const pool = Array.from({ length: Math.max(1, ...storeys.map(s => s.lamps.length)) }, () => {
    const s = new T.SpotLight(0xffd3a0, 0, 10, 1.3, 0.8, 0.5);   // 衰减放得很缓：灯正下方的头顶不至于过曝
    s.castShadow = false; root.add(s, s.target); return s;
  });
  let floor = -1;
  // 玩家换层时调用：摆灯，并且只画这一层和上下相邻两层的室内
  function setFloor(f) {
    if (f === floor) return;
    floor = f;
    storeys.forEach((s, i) => { s.inner.visible = Math.abs(i - f) <= 1; });
    pool.forEach((light, i) => {
      const l = storeys[f].lamps[i];
      light.intensity = l ? 3.2 : 0;
      if (l) { light.position.set(l.x, l.y, l.z); light.target.position.set(l.x, l.y - 2.2, l.z); }
    });
  }
  setFloor(0);

  // 屋里的反射光：吊灯和晒到太阳的地板把整间屋子映亮（只作用于见不到天的面，见 library/surfaces/plush.js）
  ROOM_LIGHT.value.setRGB(1.0, 0.86, 0.68).multiplyScalar(1.9);
  // 地面反上来的一点暖光，角色和朝下的面靠它不发黑
  const bounce = new T.HemisphereLight(0x59636e, 0xffd2a0, 0.45); root.add(bounce);

  const pickups = new Map();
  for (const p of level.pickups) { const m = pickupModel(p, weapons); pickups.set(p.id ?? pickups.size + 1, m); root.add(m); }
  const all = []; root.traverse(o => { if (o.isMesh && o.geometry.attributes.aSky) all.push(o); });
  const tris = all.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
  return { root, storeys, pickups, lights: pool, bounce, roomLight: ROOM_LIGHT, update, setFloor, lib, stats: { tris, meshes: all.length, ...lib.stats() } };
}
