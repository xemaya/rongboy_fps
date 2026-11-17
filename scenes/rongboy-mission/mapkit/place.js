// 给机关和拉链暗格找位置。生成器（build.js）用它摆草图里写的；手写的地图可以用 `node scripts/map.mjs suggest <id>` 让它给出建议坐标。
// 都只读编译好的关卡，不依赖 DOM。
import { freePoint, lineOfSight, routeTo, navRadius } from '../level.js';
import { CONFIG } from '../game.js';
import { GADGETS } from '../gadgets.js';

const r2 = n => Math.round(n * 100) / 100;
const SIDES = { n: { alongZ: false, edge: 'minZ', sign: 1 }, s: { alongZ: false, edge: 'maxZ', sign: -1 }, w: { alongZ: true, edge: 'minX', sign: 1 }, e: { alongZ: true, edge: 'maxX', sign: -1 } };
const inside = (p, r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;

// 一个房间的门：在哪面墙上、门洞的范围、门口往屋里 0.7 米的那个点
export function doorsOf(part, room) {
  const out = [];
  for (const w of part.walls || []) {
    const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, lo = alongZ ? room.minZ : room.minX, hi = alongZ ? room.maxZ : room.maxX;
    const side = alongZ ? (Math.abs(room.minX - line) < 1e-6 ? 'w' : Math.abs(room.maxX - line) < 1e-6 ? 'e' : null) : (Math.abs(room.minZ - line) < 1e-6 ? 'n' : Math.abs(room.maxZ - line) < 1e-6 ? 's' : null);
    if (!side) continue;
    for (const [a, b] of w.doors || []) {
      if (a < lo - 1e-6 || b > hi + 1e-6) continue;
      const mid = (a + b) / 2, into = SIDES[side].sign * 0.7;
      out.push({ side, alongZ, line, a, b, mouth: alongZ ? { x: line + into, z: mid } : { x: mid, z: line + into } });
    }
  }
  return out;
}

// 玩家从哪进这个房间：出生的那间是出生点，别的是离出生点路程最短的那扇门
// from：从哪算起（底层是出生点，楼上是楼梯口）
export function entryOf(L, room, doors, from = L.player) {
  const PR = navRadius(CONFIG.playerRadius), far = p => { const pts = routeTo(L, from, p, PR); if (!pts.length) return Infinity; let d = 0, q = from; for (const n of pts) { d += Math.hypot(n.x - q.x, n.z - q.z); q = n; } return d; };
  if (inside(from, room)) return { x: from.x, z: from.z };
  return doors.map(d => ({ ...d.mouth, far: far(d.mouth) })).sort((a, b) => a.far - b.far)[0] || { x: (room.minX + room.maxX) / 2, z: (room.minZ + room.maxZ) / 2 };
}

// 机关摆在哪（准则 9.4、9.6）：四周留出 1 米（最宽的普通僵尸要 0.91 米才过得去），不堵门，从进门的地方一眼看得到、打得到，而且要用得上：
//   闹钟摆在僵尸的另一头（它们走过去看的时候背对着进门的玩家）；
//   颜料桶和聚光灯摆在僵尸冲向进门处的路上（它们经过的时候打）。
// taken：已经摆了东西的点（别的机关、拾取物），enemies：这间屋里的僵尸。找不到返回 null。
export function gadgetSpot(L, { room, kind, doors, entry, enemies, taken = [], from = L.player }) {
  const G = GADGETS[kind], half = Math.max(G.w, G.d) / 2, at = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  const nearLine = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
  // 候选位置两种：屋子中间（四周都留 1 米）；或者背靠一面墙（另外三面留 1 米），教室这样摆满了的房间只有靠墙才放得下
  const spots = [];
  for (let x = room.minX + 1.2; x <= room.maxX - 1.2 + 1e-6; x += 0.25) for (let z = room.minZ + 1.2; z <= room.maxZ - 1.2 + 1e-6; z += 0.25) if (freePoint(L, x, z, half + 1.0)) spots.push({ x, z });
  const hits = (q, c) => q.minX < c.maxX - 0.01 && q.maxX > c.minX + 0.01 && q.minZ < c.maxZ - 0.01 && q.maxZ > c.minZ + 0.01;
  for (const side of 'nsew') {
    const S = SIDES[side], edge = room[S.edge], lo = S.alongZ ? room.minZ : room.minX, hi = S.alongZ ? room.maxZ : room.maxX;
    const wall = L.blockers.find(c => c.kind === 'wall' && c.alongZ === S.alongZ && Math.abs((S.alongZ ? c.x : c.z) - edge) < 0.01), face = edge + (wall ? S.sign * Math.min(wall.w, wall.d) / 2 : 0);
    const across = face + S.sign * (half + 0.02);
    for (let u = lo + half + 1.0; u <= hi - half - 1.0 + 1e-6; u += 0.25) {
      const x = S.alongZ ? across : u, z = S.alongZ ? u : across;
      // 往两边和前面各扩 1 米的这一块里不能有别的东西；背后就是墙
      const q = S.alongZ ? { minX: Math.min(face, face + S.sign * (2 * half + 1.02)), maxX: Math.max(face, face + S.sign * (2 * half + 1.02)), minZ: u - half - 1, maxZ: u + half + 1 }
        : { minZ: Math.min(face, face + S.sign * (2 * half + 1.02)), maxZ: Math.max(face, face + S.sign * (2 * half + 1.02)), minX: u - half - 1, maxX: u + half + 1 };
      const B = L.bounds;
      if (q.minX < B.minX - 0.01 || q.maxX > B.maxX + 0.01 || q.minZ < B.minZ - 0.01 || q.maxZ > B.maxZ + 0.01 || L.blockers.some(c => hits(q, c))) continue;
      if (doors.some(d => d.side === side && u > d.a - half - 0.4 && u < d.b + half + 0.4)) continue;
      spots.push({ x, z, wall: side });
    }
  }
  let best = null;
  for (const { x, z, wall } of spots) {
    const p = { x: r2(x), z: r2(z) };
    if (doors.some(d => at(d.mouth, p) < 1.7) || taken.some(t => at(t, p) < 1.3) || enemies.some(e => at(e, p) < 1.2) || at(from, p) < 3) continue;
    const far = at(entry, p);
    if (far < 2.5 || !lineOfSight(L, { x: entry.x, y: (L.y ?? 0) + 1.05, z: entry.z }, { x, y: (L.y ?? 0) + 1.0, z })) continue;
    const used = kind === 'clock' ? enemies.filter(e => at(e, p) < G.radius && at(e, entry) < far + 0.5).length
      : enemies.filter(e => nearLine(p, e, entry) < G.radius * 0.75).length;
    const score = used * 3 + (kind === 'clock' ? Math.min(far, 8) * 0.3 : -Math.abs(far - 4.5) * 0.3) + (wall ? 0 : 0.4);
    if (!best || score > best.score + 1e-9) best = { ...p, score, used, ...(wall ? { wall } : {}) };
  }
  return best;
}

// 拉链暗格开在哪面墙上：一段至少 0.9 米的空墙（让开门、窗、画、贴墙的家具），东西掉在墙脚 0.6 米处的空地上。
// 优先离进门处远的墙（它是给多看一眼的人的）。house / yard / WT：房子的外沿、有没有院子、墙厚。找不到返回 null。
// pickups：已有的拾取物（掉出来的东西别和它们叠在一起）
export function stashSpot(L, part, { room, doors, entry, house, yard, WT, taken = [], enemies = [], pickups = [], from = L.player }) {
  const PR = navRadius(CONFIG.playerRadius), boxes = L.furnitureBoxes, out = [];
  for (const side of room.outdoor ? 'n' : 'nsew') {
    const S = SIDES[side], edge = room[S.edge], lo = S.alongZ ? room.minZ : room.minX, hi = S.alongZ ? room.maxZ : room.maxX;
    const outer = room.outdoor ? false : edge === house[S.edge] && !(side === 's' && yard), face = outer ? edge : edge + S.sign * WT / 2;
    const blocked = [...doors.filter(d => d.side === side).map(d => [d.a - 0.5, d.b + 0.5]),
      ...(part.windows || []).filter(w => (S.alongZ ? w.x : w.z) === edge).map(w => [w.at - w.w / 2 - 0.3, w.at + w.w / 2 + 0.3]),
      ...(part.pictures || []).filter(p => Math.abs((S.alongZ ? p.x : p.z) - face) < 0.3).map(p => [(S.alongZ ? p.z : p.x) - (p.w ?? 0.6) / 2 - 0.5, (S.alongZ ? p.z : p.x) + (p.w ?? 0.6) / 2 + 0.5]),
      ...taken.map(t => [(S.alongZ ? t.z : t.x) - 1.2, (S.alongZ ? t.z : t.x) + 1.2]),
      ...boxes.filter(c => { const gap = S.alongZ ? (S.sign > 0 ? c.minX - face : face - c.maxX) : (S.sign > 0 ? c.minZ - face : face - c.maxZ); return gap > -0.3 && gap < 1.0; }).map(c => (S.alongZ ? [c.minZ - 0.35, c.maxZ + 0.35] : [c.minX - 0.35, c.maxX + 0.35]))];
    let spans = [[lo + 0.6, hi - 0.6]];
    for (const [a, b] of blocked) spans = spans.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, b), q]])).filter(([p, q]) => q - p > 0.05);
    for (const [a, b] of spans) {
      if (b - a < 0.9) continue;
      const mid = (a + b) / 2, x = S.alongZ ? face : mid, z = S.alongZ ? mid : face, drop = { x: r2(S.alongZ ? face + S.sign * 0.6 : mid), z: r2(S.alongZ ? mid : face + S.sign * 0.6) };
      if (!freePoint(L, drop.x, drop.z, CONFIG.playerRadius + 0.15) || enemies.some(e => Math.hypot(e.x - drop.x, e.z - drop.z) < 1.1) || pickups.some(k => Math.hypot(k.x - drop.x, k.z - drop.z) < 1.3) || !routeTo(L, from, drop, PR).length) continue;
      out.push({ x: r2(x), z: r2(z), normal: S.alongZ ? [S.sign, 0] : [0, S.sign], drop, score: Math.min(Math.hypot(entry.x - x, entry.z - z), 9) + Math.min(b - a, 3) * 0.3 });
    }
  }
  return out.sort((p, q) => q.score - p.score || p.x - q.x || p.z - q.z)[0] || null;
}
