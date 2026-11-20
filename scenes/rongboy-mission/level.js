// 关卡几何：把关卡数据编译成实体盒子，并提供碰撞、视线和寻路。
// 渲染、战斗、寻路共用同一份盒子，所以看到的和撞到的一致。不依赖 DOM。

import { GADGETS } from './gadgets.js';

// 身体（玩家、僵尸）只被离地不高的盒子挡住；门楣之类悬空的盒子只挡毛球。
const BODY_HEIGHT = 1.1;

// y0 是这一层的地面高度；盒子里的 minY / maxY 都是绝对高度，floorY 记下它属于哪一层。
function box(o, y0 = 0) {
  const minY = y0 + (o.minY ?? 0);
  return {
    ...o,
    minX: o.x - o.w / 2, maxX: o.x + o.w / 2,
    minZ: o.z - o.d / 2, maxZ: o.z + o.d / 2,
    minY, maxY: minY + o.h, floorY: y0,
  };
}

// 一道带门洞的墙拆成若干实心段，每个门洞上方补一块门楣。
function wallBoxes(wall, index, def, y0) {
  const t = def.wallThickness, alongZ = typeof wall.x === 'number';
  const [from, to] = alongZ ? wall.z : wall.x;
  const doors = [...(wall.doors || [])].sort((a, b) => a[0] - b[0]);
  const out = [];
  const piece = (a, b, kind, minY, h, n) => {
    if (b - a < 1e-6) return;
    const mid = (a + b) / 2, len = b - a;
    out.push(box(alongZ
      ? { id: `wall${index}-${kind}${n}`, kind, alongZ, x: wall.x, z: mid, w: t, d: len, minY, h }
      : { id: `wall${index}-${kind}${n}`, kind, alongZ, x: mid, z: wall.z, w: len, d: t, minY, h }, y0));
  };
  let cursor = from;
  doors.forEach(([a, b], n) => {
    piece(cursor, a, 'wall', 0, def.height, n);
    piece(a, b, 'lintel', def.doorHeight, def.height - def.doorHeight, n);
    cursor = b;
  });
  piece(cursor, to, 'wall', 0, def.height, doors.length);
  return out;
}

const rectOf = rooms => rooms.reduce((a, r) => ({ minX: Math.min(a.minX, r.minX), maxX: Math.max(a.maxX, r.maxX), minZ: Math.min(a.minZ, r.minZ), maxZ: Math.max(a.maxZ, r.maxZ) }),
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });

// 关卡可以有好几层：def 本身是底层，def.upper 是往上的各层（各有自己的房间、墙、家具、僵尸、拾取物）。
// 层高 storeyHeight = 室内净高 + 楼板厚。每层编译成一个 storey：有自己的边界和挡路盒子，二维的碰撞、寻路按层做；
// level.solids 是全楼所有盒子（含楼板），毛球和视线在三维里用它。
//
// 楼梯间（def.stairs）是屋外凸出去的一个竖井，里面每两层之间一段折返楼梯：
// 西边一跑（A）从这层往北上到半层平台，东边一跑（B）从平台往南上到上一层。mouthZ 是楼梯口，landingZ 往北是平台。
export function compileLevel(def) {
  const SH = def.storeyHeight ?? def.height + 0.2, parts = [def, ...(def.upper || [])], n = parts.length, top = n * SH;
  const house = rectOf(def.rooms.filter(r => !r.outdoor && !r.tower));
  const B = def.bounds, shared = [], stairBoxes = [];
  let stairs = null;
  if (def.stairs) {
    const t = def.stairs, spine = 0.1;
    // lane：一跑楼梯有多宽。比它宽的身体（首领）上下不了楼
    stairs = { ...t, spine, lane: Math.min(-t.minX, t.maxX) - spine, xA: (t.minX - spine) / 2, xB: (t.maxX + spine) / 2, run: t.mouthZ - t.landingZ, rise: SH / 2,
      landZ: (t.landingZ + t.endZ) / 2, outZ: t.mouthZ + 0.45, flights: n - 1 };
    // 竖井两侧是实心的（屋外的空地不属于关卡），两跑之间是一道通高的隔墙
    for (const [x0, x1, side] of [[B.minX, t.minX, 'w'], [t.maxX, B.maxX, 'e']]) {
      shared.push(box({ id: 'void-' + side, kind: 'void', x: (x0 + x1) / 2, z: (t.endZ + t.mouthZ) / 2, w: x1 - x0, d: t.mouthZ - t.endZ, h: top }));
    }
    shared.push(box({ id: 'stair-spine', kind: 'spine', x: 0, z: (t.landingZ + t.mouthZ) / 2, w: spine * 2, d: stairs.run, h: top }));
    // 踏步和平台只给毛球和视线用（身体的高度由 surfaceY 按坡道算），每跑粗分成 5 级
    const STEPS = 5, dz = stairs.run / STEPS;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < STEPS; j++) {
        const z = t.mouthZ - (j + 0.5) * dz, hA = stairs.rise * (j + 1) / STEPS, hB = SH - stairs.rise * j / STEPS;
        stairBoxes.push(box({ id: `stairA${i}-${j}`, kind: 'stair', x: stairs.xA, z, w: -t.minX - spine, d: dz, minY: hA - 0.3, h: 0.3 }, i * SH));
        stairBoxes.push(box({ id: `stairB${i}-${j}`, kind: 'stair', x: stairs.xB, z, w: t.maxX - spine, d: dz, minY: hB - 0.3, h: 0.3 }, i * SH));
      }
      stairBoxes.push(box({ id: `landing${i}`, kind: 'stair', x: (t.minX + t.maxX) / 2, z: stairs.landZ, w: t.maxX - t.minX, d: t.landingZ - t.endZ, minY: stairs.rise - 0.2, h: 0.2 }, i * SH));
    }
    stairBoxes.push(box({ id: 'stair-roof', kind: 'slab', x: (t.minX + t.maxX) / 2, z: (t.endZ + t.mouthZ) / 2, w: t.maxX - t.minX, d: t.mouthZ - t.endZ, minY: top - (SH - def.height), h: SH - def.height }));
  }
  const storeys = parts.map((part, i) => {
    const y = i * SH, rooms = part.rooms, indoor = rooms.filter(r => !r.outdoor && !r.tower);
    const walls = (part.walls || []).flatMap((w, k) => wallBoxes(w, k, def, y));
    const furniture = (part.furniture || []).map(f => box({ ...f, solid: 'furniture' }, y));
    // 机关也是实心的：毛球打中它才触发，身体绕着走
    const gadgets = (part.gadgets || []).map((g, k) => box({ id: g.id ?? `gadget${i}-${k}`, kind: 'gadget', gadget: g.kind, x: g.x, z: g.z, w: GADGETS[g.kind].w, d: GADGETS[g.kind].d, h: GADGETS[g.kind].h }, y));
    const extra = [];
    if (indoor.length) {   // 这一层的天花板（也是上一层的楼板）
      const r = rectOf(indoor);
      extra.push(box({ id: 'slab' + i, kind: 'slab', x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, w: r.maxX - r.minX, d: r.maxZ - r.minZ, minY: def.height, h: SH - def.height }, y));
    }
    // 楼上朝花园的那面外墙：身体由本层边界挡住，这块盒子挡毛球和视线
    if (i > 0) extra.push(box({ id: 'shell' + i, kind: 'shell', x: (house.minX + house.maxX) / 2, z: house.maxZ + 0.1, w: house.maxX - house.minX + 0.4, d: 0.2, h: SH }, y));
    if (stairs) {
      // 底层：东边那一跑的下面是楼梯柜，封住；顶层：西边没有再往上的楼梯，口上一道栏杆
      if (i === 0) extra.push(box({ id: 'stair-cupboard', kind: 'cupboard', x: stairs.xB, z: stairs.mouthZ, w: stairs.maxX - stairs.spine, d: 0.1, h: def.height }, y));
      if (i === n - 1 && n > 1) extra.push(box({ id: 'stair-rail', kind: 'railing', x: stairs.xA, z: stairs.mouthZ, w: -stairs.minX - stairs.spine, d: 0.1, h: 1.0 }, y));
    }
    const solids = [...walls, ...furniture, ...gadgets, ...extra];
    return {
      index: i, y, height: def.height, rooms, outdoor: rooms.filter(r => r.outdoor),
      bounds: i === 0 ? B : { minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: house.maxZ },
      walls, furnitureBoxes: furniture, gadgetBoxes: gadgets, solids,
      blockers: [...solids.filter(b => b.minY - y < BODY_HEIGHT), ...shared],
      windows: part.windows || [], lamps: part.lamps || [], rugs: part.rugs || [], pictures: part.pictures || [],
      skylights: part.skylights || [], hangings: part.hangings || [],
    };
  });
  const ground = storeys[0];
  return {
    ...def, storeys, storeyHeight: SH, top, stairs, house,
    walls: ground.walls, furnitureBoxes: ground.furnitureBoxes, blockers: ground.blockers, outdoor: ground.outdoor,
    solids: [...storeys.flatMap(s => s.solids), ...shared, ...stairBoxes],
    enemies: parts.flatMap((part, i) => (part.enemies || []).map(e => ({ ...e, floor: i }))),
    pickups: parts.flatMap((part, i) => (part.pickups || []).map(k => ({ ...k, floor: i, y: i * SH }))),
    gadgets: storeys.flatMap(S => S.gadgetBoxes.map(b => ({ id: b.id, kind: b.gadget, x: b.x, z: b.z, floor: S.index, y: S.y }))),
  };
}

// 高度 y 的身体算在哪一层：半层平台及以上归上一层。
export function floorIndex(level, y = 0) {
  return Math.max(0, Math.min(level.storeys.length - 1, Math.floor(y / level.storeyHeight + 0.5 + 1e-6)));
}
export function storeyAt(level, y = 0) { return level.storeys[floorIndex(level, y)]; }
export function inStairs(level, p) {
  const t = level.stairs;
  return !!t && p.z < t.mouthZ && p.x > t.minX - 0.5 && p.x < t.maxX + 0.5;
}

// 站在 (x, z) 时脚下的高度：在几层楼板和楼梯坡面里取离当前高度 y 最近的那个。
// 身体每一步都拿上一步的高度来问，所以上下楼是连续的，不会从一层跳到另一层。
export function surfaceY(level, x, z, y = 0) {
  const t = level.stairs, SH = level.storeyHeight;
  let best = 0, gap = Infinity;
  const consider = h => { const g = Math.abs(h - y); if (g < gap) { gap = g; best = h; } };
  if (inStairs(level, { x, z })) {
    const k = Math.min(1, (t.mouthZ - z) / t.run);
    for (let i = 0; i < t.flights; i++) consider(z <= t.landingZ ? i * SH + t.rise : x < 0 ? i * SH + t.rise * k : (i + 1) * SH - t.rise * k);
    return best;
  }
  consider(0);
  for (let i = 1; i < level.storeys.length; i++) {
    const b = level.storeys[i].bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ + 0.2) consider(i * SH);
  }
  return best;
}

// 要从 body 走到 target（都带高度），下一步该朝哪里去。
// 同一高度：就是 target 本身（direct 表示两者在同一段楼梯上，直接走过去）。
// 不同高度：楼梯间外先走到楼梯口（上楼走西边 A，下楼走东边 B），楼梯间里沿着折返的路线走；这些点都是直走可达的。
export function navGoal(level, body, target) {
  const t = level.stairs, by = body.base ?? body.y ?? 0, dy = (target.y ?? 0) - by;
  const inside = inStairs(level, body);
  if (!t || Math.abs(dy) < 0.3) return { x: target.x, z: target.z, direct: !!t && inside && inStairs(level, target) };
  const up = dy > 0, point = (x, z) => ({ x, z, direct: true });
  if (inside) {
    const onLanding = body.z < t.landZ + 0.15;
    if (up) return onLanding ? (body.x < t.xB - 0.2 ? point(t.xB, t.landZ) : point(t.xB, t.outZ)) : body.x < 0 ? point(t.xA, t.landZ) : point(t.xB, t.outZ);
    return onLanding ? (body.x > t.xA + 0.2 ? point(t.xA, t.landZ) : point(t.xA, t.outZ)) : body.x > 0 ? point(t.xB, t.landZ) : point(t.xA, t.outZ);
  }
  const mouthX = up ? t.xA : t.xB;
  // 已经站在这一跑的正前方：直接往里走（一直走到进了楼梯间为止，不再回头找楼梯口那个点）
  if (body.z < t.outZ + 0.3 && Math.abs(body.x - mouthX) < 0.3) return point(mouthX, t.landZ);
  return { x: mouthX, z: t.outZ, direct: false };
}

// 线段与盒子求交（slab 法），返回最早的交点参数和表面法线。pad 把盒子向外扩一圈。
export function segmentBox(a, b, bx, pad = 0) {
  let near = 0, far = 1, nx = 0, ny = 0, nz = 0;
  for (const [axis, min, max] of [['x', 'minX', 'maxX'], ['y', 'minY', 'maxY'], ['z', 'minZ', 'maxZ']]) {
    const delta = b[axis] - a[axis], lo = bx[min] - pad, hi = bx[max] + pad;
    if (Math.abs(delta) < 1e-10) { if (a[axis] < lo || a[axis] > hi) return null; continue; }
    let t0 = (lo - a[axis]) / delta, t1 = (hi - a[axis]) / delta, sign = -1;
    if (t0 > t1) { [t0, t1] = [t1, t0]; sign = 1; }
    if (t0 >= near) { near = t0; nx = ny = nz = 0; if (axis === 'x') nx = sign; if (axis === 'y') ny = sign; if (axis === 'z') nz = sign; }
    far = Math.min(far, t1);
    if (near > far) return null;
  }
  return far >= 0 && near <= 1 ? { t: Math.max(0, near), nx, ny, nz } : null;
}

export function inBounds(level, x, z, r = 0) {
  const b = level.bounds;
  return x > b.minX + r && x < b.maxX - r && z > b.minZ + r && z < b.maxZ - r;
}

// 点到盒子的间隙，按轴向取最大值：segmentBox 的 pad 是把盒子按方形外扩，判断"是否已在外扩盒内"要用同一种量法。
const gapTo = (c, p) => Math.max(c.minX - p.x, p.x - c.maxX, c.minZ - p.z, p.z - c.maxZ, 0);

// 半径 r 的身体能否沿直线从 a 走到 b。
// loose：端点本身贴着某个盒子（比如玩家靠在柜子边）时，对那个盒子只按实际间隙检查，
// 否则贴着家具站的目标会被判成"永远走不到"。
export function clearPath(level, a, b, r, loose = false) {
  const y = (level.y ?? 0) + 0.2;   // 贴着这一层的地面量
  const p = { x: a.x, y, z: a.z }, q = { x: b.x, y, z: b.z };
  return !level.blockers.some(c => {
    let pad = r;
    if (loose) { const gap = Math.min(gapTo(c, a), gapTo(c, b)); if (gap < r) pad = Math.max(0, gap - 0.01); }
    return segmentBox(p, q, c, pad);
  });
}

export function freePoint(level, x, z, r) {
  if (!inBounds(level, x, z, r)) return false;
  return !level.blockers.some(c => Math.hypot(x - Math.max(c.minX, Math.min(c.maxX, x)), z - Math.max(c.minZ, Math.min(c.maxZ, z))) < r);
}

// 眼睛到眼睛的三维视线：矮家具不挡视线，墙和高柜会挡。
export function lineOfSight(level, a, b, eye = 1.2) {
  const p = { x: a.x, y: a.y ?? eye, z: a.z }, q = { x: b.x, y: b.y ?? eye, z: b.z };
  return !level.solids.some(c => segmentBox(p, q, c));
}

export function roomAt(level, x, z) {
  return level.rooms.find(r => !r.outdoor && x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)
    || level.rooms.find(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || null;
}

export function isOutdoor(level, x, z) {
  return level.outdoor.some(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}

// 把身体从盒子里推出来，并去掉朝向盒子的速度分量。
export function resolveBody(level, body, r) {
  for (let pass = 0; pass < 2; pass++) for (const c of level.blockers) {
    const x = Math.max(c.minX, Math.min(c.maxX, body.x)), z = Math.max(c.minZ, Math.min(c.maxZ, body.z));
    const dx = body.x - x, dz = body.z - z, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d > 1e-7) {
      const nx = dx / d, nz = dz / d;
      body.x += nx * (r - d + 0.001); body.z += nz * (r - d + 0.001);
      const v = (body.vx || 0) * nx + (body.vz || 0) * nz;
      if (v < 0) { body.vx -= nx * v; body.vz -= nz * v; }
    } else {
      const sides = [[Math.abs(body.x - c.minX), -1, 0], [Math.abs(c.maxX - body.x), 1, 0], [Math.abs(body.z - c.minZ), 0, -1], [Math.abs(c.maxZ - body.z), 0, 1]].sort((a, b) => a[0] - b[0]);
      const [, nx, nz] = sides[0];
      if (nx) body.x = (nx < 0 ? c.minX : c.maxX) + nx * (r + 0.001); else body.z = (nz < 0 ? c.minZ : c.maxZ) + nz * (r + 0.001);
      body.vx = body.vz = 0;
    }
  }
  const b = level.bounds;
  if (body.x < b.minX + r) { body.x = b.minX + r; if (body.vx < 0) body.vx *= -0.25; }
  if (body.x > b.maxX - r) { body.x = b.maxX - r; if (body.vx > 0) body.vx *= -0.25; }
  if (body.z < b.minZ + r) { body.z = b.minZ + r; if (body.vz < 0) body.vz *= -0.25; }
  if (body.z > b.maxZ - r) { body.z = b.maxZ - r; if (body.vz > 0) body.vz *= -0.25; }
}

// 寻路分普通、厚身与首领三档体宽，避免每种半径各建一张图。
export function navRadius(radius) { return radius <= 0.33 ? 0.345 : radius<=.46?.455:.675; }
// 找路用的图（每层楼 × 每种体型一张）头一回要用时才建，一张几毫秒到十几毫秒，正好卡在僵尸第一次发现玩家的那一下。
// 载入时调一次，全建好（play.js 的 boot）。
export function prepareNavigation(level, radii = [0.345, 0.455, 0.675]) { for (const S of level.storeys) for (const r of radii) graphFor(S, r); }

// 拐角可见图：每个挡路盒子的四个外角是节点，互相看得见就连边。每个关卡、每档体宽建一次。
const graphs = new WeakMap();
function graphFor(level, r) {
  let byRadius = graphs.get(level);
  if (!byRadius) graphs.set(level, byRadius = new Map());
  let graph = byRadius.get(r);
  if (graph) return graph;
  const nodes = [], pad = r + 0.055;
  for (const c of level.blockers) for (const x of [c.minX - pad, c.maxX + pad]) for (const z of [c.minZ - pad, c.maxZ + pad]) {
    if (freePoint(level, x, z, r) && !nodes.some(n => Math.hypot(n.x - x, n.z - z) < 0.05)) nodes.push({ x, z });
  }
  const edges = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (!clearPath(level, nodes[i], nodes[j], r)) continue;
    const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
    edges[i].push([j, d]); edges[j].push([i, d]);
  }
  byRadius.set(r, graph = { nodes, edges });
  return graph;
}

// 返回从 from 到 to 的路径点（不含起点）；走不通返回空数组。
export function routeTo(level, from, to, r) {
  if (clearPath(level, from, to, r, true)) return [{ x: to.x, z: to.z }];
  const graph = graphFor(level, r), n = graph.nodes.length, start = n, end = n + 1;
  const nodes = [...graph.nodes, { x: from.x, z: from.z }, { x: to.x, z: to.z }];
  const extra = [[], []];
  for (const k of [0, 1]) for (let j = 0; j < n; j++) {
    if (clearPath(level, nodes[n + k], nodes[j], r, true)) extra[k].push([j, Math.hypot(nodes[n + k].x - nodes[j].x, nodes[n + k].z - nodes[j].z)]);
  }
  const toEnd = new Map(extra[1]);
  const distance = new Array(n + 2).fill(Infinity), prev = new Array(n + 2).fill(-1), done = new Uint8Array(n + 2);
  distance[start] = 0;
  for (;;) {
    let best = -1;
    for (let i = 0; i < n + 2; i++) if (!done[i] && distance[i] < Infinity && (best < 0 || distance[i] < distance[best])) best = i;
    if (best < 0 || best === end) break;
    done[best] = 1;
    const out = best === start ? extra[0] : graph.edges[best];
    for (const [j, d] of out) if (distance[best] + d < distance[j]) { distance[j] = distance[best] + d; prev[j] = best; }
    if (best !== start && toEnd.has(best)) {
      const d = distance[best] + toEnd.get(best);
      if (d < distance[end]) { distance[end] = d; prev[end] = best; }
    }
  }
  if (distance[end] === Infinity) return [];
  const result = [];
  for (let i = end; i !== start; i = prev[i]) result.unshift({ x: nodes[i].x, z: nodes[i].z });
  return result;
}
