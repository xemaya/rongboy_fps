// 把编译好的关卡搭成毛毡灰盒场景。看得见的盒子就是碰撞用的盒子，只在表面加少量缝线和软装。
// 这是灰盒：用来验证布局和玩法，正式的房屋美术在第三阶段做。
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { woolMaterial } from '../../library/games/rongboy-runtime.js';

const felts = new Map();
const felt = color => { if (!felts.has(color)) felts.set(color, woolMaterial(color)); return felts.get(color); };
const seam = new T.MeshStandardMaterial({ color: 0xe6d8b0, roughness: 1 });
const wood = new T.MeshStandardMaterial({ color: 0x8b6447, roughness: 0.86 });

function add(group, geometry, material, x, y, z) {
  const m = new T.Mesh(geometry, material);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  group.add(m); return m;
}
function block(group, w, h, d, material, x, y, z, r = 0.06) {
  return add(group, new RoundedBoxGeometry(w, h, d, 3, Math.max(0.004, Math.min(r, w / 3, h / 3, d / 3))), material, x, y, z);
}
function stitch(group, points, r = 0.008) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  return add(group, new T.TubeGeometry(curve, Math.max(2, points.length * 2), r, 4, false), seam, 0, 0, 0);
}
// 同材质的静态网格合并，控制绘制次数。
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!batches.has(o.material)) batches.set(o.material, []);
    batches.get(o.material).push(g);
  });
  group.clear();
  for (const [material, list] of batches) {
    const m = new T.Mesh(mergeGeometries(list, false), material);
    m.castShadow = m.receiveShadow = true; group.add(m);
    for (const g of list) g.dispose();
  }
  return group;
}

function label(text, { width = 512, height = 128, size = 64, ink = '#4d5c47', paper = '#efe3c4' } = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const a = c.getContext('2d');
  a.fillStyle = paper; a.beginPath(); a.roundRect(4, 4, width - 8, height - 8, 22); a.fill();
  a.strokeStyle = '#8b7655'; a.lineWidth = 3; a.setLineDash([10, 8]); a.beginPath(); a.roundRect(12, 12, width - 24, height - 24, 16); a.stroke();
  a.fillStyle = ink; a.textAlign = 'center'; a.textBaseline = 'middle'; a.font = `bold ${size}px Georgia, "Songti SC", serif`;
  a.fillText(text, width / 2, height / 2 + 2);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

// 一件家具：主体是与碰撞盒一致的圆角盒，按种类加一点识别特征。
function furniture(c) {
  const g = new T.Group(), main = felt(c.color), long = c.w >= c.d;
  block(g, c.w, c.h, c.d, main, 0, c.h / 2, 0, 0.07);
  const top = c.h + 0.004;
  if (c.kind === 'cabinet') {
    for (const z of [-c.d / 2 - 0.006, c.d / 2 + 0.006]) {
      stitch(g, [[-c.w / 2 + 0.07, 0.1, z], [-c.w / 2 + 0.07, c.h - 0.08, z], [c.w / 2 - 0.07, c.h - 0.08, z], [c.w / 2 - 0.07, 0.1, z]]);
      if (c.w > 0.9) block(g, 0.02, c.h - 0.22, 0.014, wood, 0, c.h / 2, z, 0.005);
    }
    for (const x of [-c.w / 2 - 0.006, c.w / 2 + 0.006]) {
      stitch(g, [[x, 0.1, -c.d / 2 + 0.07], [x, c.h - 0.08, -c.d / 2 + 0.07], [x, c.h - 0.08, c.d / 2 - 0.07], [x, 0.1, c.d / 2 - 0.07]]);
      if (c.d > 0.9) block(g, 0.014, c.h - 0.22, 0.02, wood, x, c.h / 2, 0, 0.005);
    }
  } else if (c.kind === 'bench') {
    block(g, c.w - 0.06, 0.05, c.d - 0.06, felt(0xead9b0), 0, c.h - 0.02, 0, 0.02);
  } else if (c.kind === 'crate') {
    for (const sign of [-1, 1]) block(g, long ? 0.08 : c.w + 0.012, c.h + 0.012, long ? c.d + 0.012 : 0.08, felt(0xead9b0), long ? sign * c.w * 0.28 : 0, c.h / 2, long ? 0 : sign * c.d * 0.28, 0.01);
  } else if (c.kind === 'sofa') {
    const n = Math.max(1, Math.round((long ? c.w : c.d) / 0.8)), cushion = felt(0xe2cfa6);
    for (let i = 0; i < n; i++) {
      const offset = ((i + 0.5) / n - 0.5) * (long ? c.w : c.d);
      block(g, (long ? c.w / n : c.w) - 0.12, 0.07, (long ? c.d : c.d / n) - 0.12, cushion, long ? offset : 0, top, long ? 0 : offset, 0.03);
    }
  } else if (c.kind === 'bed') {
    block(g, 0.5, 0.11, c.d - 0.3, felt(0xf3ead8), -c.w / 2 + 0.38, top + 0.03, 0, 0.05);
    block(g, c.w * 0.58, 0.05, c.d - 0.05, felt(0xd9a9a0), c.w * 0.19, top, 0, 0.02);
    stitch(g, [[-c.w * 0.1, top + 0.03, -c.d / 2 + 0.05], [-c.w * 0.1, top + 0.03, c.d / 2 - 0.05]], 0.01);
  } else if (c.kind === 'hedge') {
    const leaf = felt(0x6f9a5e);
    for (let i = 0, n = Math.round((long ? c.w : c.d) / 0.45); i < n; i++) {
      const offset = ((i + 0.5) / n - 0.5) * (long ? c.w : c.d);
      add(g, new T.SphereGeometry(0.2, 10, 8), leaf, long ? offset : 0, c.h - 0.06, long ? 0 : offset).scale.set(long ? 1.2 : 1.5, 0.55, long ? 1.5 : 1.2);
    }
  } else if (c.kind === 'tree') {
    const canopy = add(g, new T.SphereGeometry(1.25, 18, 14), felt(0x6f9a5e), 0, c.h + 0.75, 0); canopy.scale.y = 0.8;
    add(g, new T.SphereGeometry(0.75, 14, 10), felt(0x86ab6c), 0.7, c.h + 0.35, 0.4);
  } else if (c.kind === 'planter') {
    const petals = [0xe8a4a0, 0xf2d27a, 0xd9b3e0, 0xf3ead8];
    for (let i = 0, n = Math.round(c.w / 0.3); i < n; i++) {
      add(g, new T.SphereGeometry(0.075, 8, 6), felt(petals[i % petals.length]), ((i + 0.5) / n - 0.5) * c.w, top + 0.05, (i % 2 ? 1 : -1) * c.d * 0.2);
    }
  } else if (c.kind === 'stairs') {
    const steps = 5;
    for (let i = 0; i < steps; i++) stitch(g, [[-c.w / 2 + 0.1, c.h * (i + 1) / (steps + 1), c.d / 2 + 0.006], [c.w / 2 - 0.1, c.h * (i + 1) / (steps + 1), c.d / 2 + 0.006]], 0.012);
    const sign = add(g, new T.PlaneGeometry(1.5, 0.375), new T.MeshStandardMaterial({ map: label('二楼 · 稍后开放', { size: 52 }), roughness: 1 }), 0, c.h + 0.32, c.d / 2 - 0.2);
    sign.castShadow = false;
    block(g, 0.05, 0.3, 0.05, wood, 0, c.h + 0.07, c.d / 2 - 0.2, 0.01);
  }
  g.position.set(c.x, 0, c.z);
  return g;
}

function pickupModel(k, weapons) {
  const g = new T.Group(), heart = k.kind === 'heart', objective = k.kind === 'objective';
  const weapon = weapons.find(w => w.id === k.weapon);
  const color = heart ? 0xd9705f : objective ? 0xe9bf65 : weapon?.color ?? 0xf3dfa5;
  const body = new T.Group(); g.add(body);
  if (heart) {
    for (const sign of [-1, 1]) add(body, new T.SphereGeometry(0.11, 12, 10), felt(color), sign * 0.075, 0.06, 0);
    const tip = add(body, new T.ConeGeometry(0.155, 0.2, 12), felt(color), 0, -0.07, 0); tip.rotation.x = Math.PI;
  } else {
    block(body, 0.3, 0.2, 0.22, felt(0xb58a62), 0, -0.02, 0, 0.04);
    for (const x of [-0.08, 0.08]) add(body, new T.SphereGeometry(0.075, 10, 8), felt(color), x, 0.12, 0);
  }
  body.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const text = heart ? '♥ +1' : objective ? '★' : `${weapon?.name ?? ''} +${k.amount}`;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: label(text, { width: 384, height: 96, size: 46 }), transparent: true, depthWrite: false }));
  sprite.scale.set(0.72, 0.18, 1); sprite.position.y = 0.42; g.add(sprite);
  g.position.set(k.x, 0.55, k.z);
  g.userData.body = body; g.userData.baseY = 0.55;
  return g;
}

export function buildWorld(scene, level, weapons) {
  const B = level.bounds, H = level.height, root = new T.Group(), statics = new T.Group();
  scene.add(root); root.add(statics);
  const wall = felt(0xd2c8a6), trim = felt(0x799386), hedge = felt(0x557d4b), roof = felt(0xb57e60), ceiling = felt(0xead9b0);

  // 地面：场地外一圈草地，每个房间一块自己颜色的地毯。
  block(statics, B.maxX - B.minX + 30, 0.2, B.maxZ - B.minZ + 30, felt(0x7d9a63), (B.minX + B.maxX) / 2, -0.12, (B.minZ + B.maxZ) / 2, 0.05);
  for (const r of level.rooms) {
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ, cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    block(statics, w, 0.06, d, felt(r.floor), cx, -0.03, cz, 0.02);
    if (r.outdoor) {   // 花园小路：从院门到正门
      for (let z = r.minZ + 0.5; z < r.maxZ - 0.3; z += 0.75) block(statics, 0.9, 0.02, 0.5, felt(0xcdbf9d), cx + Math.sin(z * 1.7) * 0.12, 0.012, z, 0.04);
    } else {
      stitch(statics, [[r.minX + 0.25, 0.006, r.minZ + 0.25], [r.maxX - 0.25, 0.006, r.minZ + 0.25], [r.maxX - 0.25, 0.006, r.maxZ - 0.25], [r.minX + 0.25, 0.006, r.maxZ - 0.25], [r.minX + 0.25, 0.006, r.minZ + 0.25]], 0.006);
    }
  }

  // 内墙和门楣：就是碰撞用的那些盒子。
  for (const c of level.walls) block(statics, c.w, c.maxY - c.minY, c.d, wall, c.x, (c.minY + c.maxY) / 2, c.z, 0.015);
  // 门框：门洞两侧各一根木条，方便在远处认出门在哪。
  for (const c of level.walls.filter(b => b.kind === 'lintel')) {
    const alongZ = c.d > c.w;
    for (const sign of [-1, 1]) {
      block(statics, alongZ ? c.w + 0.06 : 0.07, level.doorHeight, alongZ ? 0.07 : c.d + 0.06, wood,
        alongZ ? c.x : c.x + sign * (c.w / 2 - 0.035), level.doorHeight / 2, alongZ ? c.z + sign * (c.d / 2 - 0.035) : c.z, 0.01);
    }
  }

  // 外围：房屋部分是外墙加屋顶，花园部分是一圈高树篱。
  const indoor = level.rooms.filter(r => !r.outdoor);
  const house = indoor.reduce((a, r) => ({ minX: Math.min(a.minX, r.minX), maxX: Math.max(a.maxX, r.maxX), minZ: Math.min(a.minZ, r.minZ), maxZ: Math.max(a.maxZ, r.maxZ) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const side = (x0, z0, x1, z1, material, h, t) => {
    const w = Math.abs(x1 - x0) + t, d = Math.abs(z1 - z0) + t;
    block(statics, w, h, d, material, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0.02);
  };
  const edges = [[B.minX, B.minZ, B.maxX, B.minZ], [B.maxX, B.minZ, B.maxX, B.maxZ], [B.maxX, B.maxZ, B.minX, B.maxZ], [B.minX, B.maxZ, B.minX, B.minZ]];
  for (const [x0, z0, x1, z1] of edges) {
    const vertical = x0 === x1, out = vertical ? Math.sign(x0 - (B.minX + B.maxX) / 2) : Math.sign(z0 - (B.minZ + B.maxZ) / 2);
    const lo = vertical ? Math.min(z0, z1) : Math.min(x0, x1), hi = vertical ? Math.max(z0, z1) : Math.max(x0, x1);
    const hLo = vertical ? house.minZ : house.minX, hHi = vertical ? house.maxZ : house.maxX;
    const onHouse = vertical ? (x0 === house.minX || x0 === house.maxX) : (z0 === house.minZ || z0 === house.maxZ);
    const span = (a, b, material, h, t) => { if (b - a < 0.01) return; const p = (vertical ? x0 : z0) + out * t / 2; vertical ? side(p, a, p, b, material, h, t) : side(a, p, b, p, material, h, t); };
    if (onHouse) { span(lo, Math.max(lo, hLo), hedge, 2.2, 0.5); span(Math.max(lo, hLo), Math.min(hi, hHi), wall, H, 0.2); span(Math.min(hi, hHi), hi, hedge, 2.2, 0.5); }
    else span(lo, hi, hedge, 2.2, 0.5);
  }
  // 院门：玩家身后的一道木栅门（只是装饰）。
  block(statics, 1.6, 1.5, 0.12, wood, level.player.x, 0.75, B.maxZ + 0.02, 0.03);

  // 天花板和屋顶盖住室内，花园露天。
  const hw = house.maxX - house.minX, hd = house.maxZ - house.minZ, hx = (house.minX + house.maxX) / 2, hz = (house.minZ + house.maxZ) / 2;
  block(statics, hw + 0.4, 0.12, hd + 0.4, ceiling, hx, H + 0.06, hz, 0.02);
  block(statics, hw + 1.0, 0.5, hd + 1.0, roof, hx, H + 0.37, hz, 0.12);
  block(statics, hw * 0.7, 0.5, hd * 0.7, roof, hx, H + 0.85, hz, 0.14);
  // 踢脚线让室内墙面不那么平。
  for (const r of indoor) for (const [x, z, w, d] of [[(r.minX + r.maxX) / 2, r.minZ + 0.115, r.maxX - r.minX - 0.3, 0.03], [(r.minX + r.maxX) / 2, r.maxZ - 0.115, r.maxX - r.minX - 0.3, 0.03]]) {
    block(statics, w, 0.1, d, trim, x, 0.05, z, 0.01);
  }

  for (const c of level.furnitureBoxes) statics.add(furniture(c));
  mergeStatic(statics);
  statics.traverse(o => { if (o.isMesh && (o.material === ceiling || o.material === wall)) o.castShadow = o.material === wall; });

  // 房间名牌：贴在每个门楣上方，朝两侧都能看到太费事，这里只在房间中央上方挂一块。
  for (const r of indoor) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: label(r.name, { width: 256, height: 96, size: 50 }), transparent: true, depthWrite: false }));
    s.scale.set(0.8, 0.3, 1); s.position.set((r.minX + r.maxX) / 2, H - 0.35, (r.minZ + r.maxZ) / 2); root.add(s);
  }

  const pickups = new Map();
  for (const k of level.pickups) { const m = pickupModel(k, weapons); pickups.set(k.id ?? pickups.size + 1, m); root.add(m); }
  return { root, statics, pickups };
}
