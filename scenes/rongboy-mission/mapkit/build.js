// 地图生成器：把一份草图（房间格子、哪两间连通、每间放什么）展开成 level.js 认识的完整关卡数据。
// 地图文件直接写 `export default buildMap({ … })`：草图就是源头，加载时展开，不另存一份坐标表。
// 同一份草图永远展开成同一张图（不用随机数）。草图怎么写见 docs/map-guide.md 第 3 节。不依赖 DOM。
import { compileLevel, freePoint, clearPath, lineOfSight, routeTo, navRadius } from '../level.js';
import { CONFIG, ENEMY_TYPES, WEAPONS } from '../game.js';
import { PROPS, THEMES, ZOMBIES, GUNS, OBJECTIVE_ITEMS } from './catalog.js';

// 草图写错了：消息里说清楚哪里错、怎么改（读的人多半是 agent）。
export class PlanError extends Error { constructor(message) { super(message); this.name = 'PlanError'; } }
const fail = message => { throw new PlanError(message); };
const r2 = n => Math.round(n * 100) / 100;
const names = o => Object.keys(o).join('、');
const boxOf = (x, z, w, d) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
const hit = (a, b, pad = 0) => a.minX < b.maxX + pad && a.maxX > b.minX - pad && a.minZ < b.maxZ + pad && a.maxZ > b.minZ - pad;
const SIDES = { n: { alongZ: false, edge: 'minZ', sign: 1 }, s: { alongZ: false, edge: 'maxZ', sign: -1 }, w: { alongZ: true, edge: 'minX', sign: 1 }, e: { alongZ: true, edge: 'maxX', sign: -1 } };
const FACE_IN = { n: 's', s: 'n', w: 'e', e: 'w' };   // 贴着这面墙的家具，正面朝哪

// ---------- 1. 房间：layout 里每个字母是一个矩形房间 ----------
function parseLayout(plan) {
  const rows = (plan.layout || []).map(r => String(r).replace(/\s+/g, ''));
  if (!rows.length) fail('草图缺 layout：用几行字母画出房间，一个字母一格，例如 ["AABB", "AABB", "YYYY"]');
  const cols = rows[0].length, cell = plan.cell ?? 1.5;
  rows.forEach((r, j) => { if (r.length !== cols) fail(`layout 第 ${j + 1} 行有 ${r.length} 格，第 1 行有 ${cols} 格：每行要一样长`); });
  const W = cols * cell, D = rows.length * cell, x0 = plan.origin ? plan.origin[0] : -W / 2, z0 = plan.origin ? plan.origin[1] : -D / 2;
  const spans = new Map();
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const b = spans.get(ch) || { c0: i, c1: i, r0: j, r1: j, n: 0 };
    b.c0 = Math.min(b.c0, i); b.c1 = Math.max(b.c1, i); b.r0 = Math.min(b.r0, j); b.r1 = Math.max(b.r1, j); b.n++;
    spans.set(ch, b);
  }));
  const specs = plan.rooms || {};
  for (const [ch, b] of spans) {
    if (!specs[ch]) fail(`layout 里的 "${ch}" 在 rooms 里没有定义（rooms 现有：${names(specs) || '空'}）`);
    if (b.n !== (b.c1 - b.c0 + 1) * (b.r1 - b.r0 + 1)) fail(`房间 "${ch}" 不是一个矩形：每个字母占的格子必须正好拼成一个长方形。L 形的房间拆成两个字母，中间开一个宽门`);
  }
  for (const ch of Object.keys(specs)) if (!spans.has(ch)) fail(`rooms 里的 "${ch}" 没有出现在 layout 里`);
  // 室外只能是最南边的整行（world.js 把院子画在房子南面，和房子一样宽）
  const outdoorRow = rows.map(row => { const n = [...row].filter(ch => specs[ch].outdoor).length; if (n && n < cols) fail('室外的房间（outdoor: true）要占满整行：院子只能在房子南面，和房子一样宽'); return n > 0; });
  outdoorRow.forEach((out, j) => { if (out && outdoorRow.slice(j).includes(false)) fail('室外的行必须在 layout 的最下面（院子在房子南面）'); });
  const ids = new Set();
  const rooms = Object.keys(specs).map(ch => {
    const b = spans.get(ch), spec = specs[ch], id = spec.id ?? 'room-' + ch;
    if (ids.has(id)) fail(`房间 id "${id}" 重复了`); ids.add(id);
    if (!spec.name) fail(`房间 "${ch}" 缺 name（界面上和报告里都要用，比如 '厨房'）`);
    return { key: ch, id, name: spec.name, spec, outdoor: !!spec.outdoor, minX: r2(x0 + b.c0 * cell), maxX: r2(x0 + (b.c1 + 1) * cell), minZ: r2(z0 + b.r0 * cell), maxZ: r2(z0 + (b.r1 + 1) * cell), doors: [] };
  });
  // 相邻两格字母不同：之间有一段墙（两边都是室外的不算）
  const units = [];
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < cols; i++) {
    const A = rows[j][i];
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const B = rows[j + dj]?.[i + di];
      if (!B || B === A || (specs[A].outdoor && specs[B].outdoor)) continue;
      units.push(di ? { alongZ: true, line: r2(x0 + (i + 1) * cell), a: r2(z0 + j * cell), b: r2(z0 + (j + 1) * cell), A, B }
        : { alongZ: false, line: r2(z0 + (j + 1) * cell), a: r2(x0 + i * cell), b: r2(x0 + (i + 1) * cell), A, B });
    }
  }
  return { rooms, units, cell, bounds: { minX: r2(x0), maxX: r2(x0 + W), minZ: r2(z0), maxZ: r2(z0 + D) } };
}

// 把同一条线上首尾相接的小段并成长段；samePair：只并两边房间相同的（得到"两间房共用的那段墙"）
function merge(units, samePair) {
  const groups = new Map();
  for (const u of units) {
    const key = `${u.alongZ ? 'x' : 'z'}${u.line}${samePair ? ':' + [u.A, u.B].sort().join('') : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  const out = [];
  for (const list of groups.values()) {
    list.sort((p, q) => p.a - q.a);
    let cur = null;
    for (const u of list) { if (cur && Math.abs(cur.b - u.a) < 1e-6) cur.b = u.b; else out.push(cur = { ...u }); }
  }
  return out;
}

// ---------- 2. 门：写哪两间连通，门洞开在它们共用的那段墙上 ----------
function placeDoors(plan, rooms, units, T) {
  const byKey = new Map(rooms.flatMap(r => [[r.key, r], [r.id, r]]));
  const shared = merge(units, true), wanted = new Map();
  for (const raw of plan.doors || []) {
    const spec = typeof raw === 'string' ? { between: raw.split('-').map(s => s.trim()) } : Array.isArray(raw) ? { between: raw.slice(0, 2), ...(raw[2] || {}) } : raw;
    const pair = (spec.between || []).map(k => byKey.get(k) || fail(`门 ${JSON.stringify(raw)}：没有叫 "${k}" 的房间（现有：${rooms.map(r => r.key).join('、')}）`));
    if (pair.length !== 2 || pair[0] === pair[1]) fail(`门 ${JSON.stringify(raw)}：要写成 'A-B'，A 和 B 是两个不同的房间`);
    const key = pair.map(r => r.key).sort().join('');
    const edge = shared.find(e => [e.A, e.B].sort().join('') === key) || fail(`门 ${pair[0].key}-${pair[1].key}：${pair[0].name}和${pair[1].name}不挨着，没有共用的墙。看 layout 里这两个字母有没有贴在一起`);
    if (!wanted.has(edge)) wanted.set(edge, []);
    wanted.get(edge).push({ ...spec, pair });
  }
  for (const [edge, list] of wanted) {
    const len = edge.b - edge.a, label = `${list[0].pair[0].name} ↔ ${list[0].pair[1].name}`;
    edge.doors = list.map((spec, i) => {
      const w = Math.min(spec.width ?? T.door, len - 0.8);
      if (w < 1.1) fail(`门 ${label}：共用的墙只有 ${len} 米，开不下一扇够宽的门（最宽的僵尸要 1.1 米，两边还要各留 0.4 米墙）。把房间拉长，或者换一对房间开门`);
      const want = edge.a + len * (spec.at ?? (i + 1) / (list.length + 1));
      const c = Math.max(edge.a + 0.4 + w / 2, Math.min(edge.b - 0.4 - w / 2, want));
      return [r2(c - w / 2), r2(c + w / 2)];
    }).sort((p, q) => p[0] - q[0]);
    edge.doors.forEach((d, i) => { if (i && d[0] - edge.doors[i - 1][1] < 0.6) fail(`门 ${label}：${len} 米的墙上开 ${list.length} 扇门挤不下。减少门的数量，或者给每扇门写 at（0–1，沿墙的位置）错开`); });
    for (const d of edge.doors) for (const room of list[0].pair) {
      const side = edge.alongZ ? (Math.abs(room.minX - edge.line) < 1e-6 ? 'w' : 'e') : (Math.abs(room.minZ - edge.line) < 1e-6 ? 'n' : 's'), mid = (d[0] + d[1]) / 2, into = SIDES[side].sign * 0.7;
      room.doors.push({ side, alongZ: edge.alongZ, line: edge.line, a: d[0], b: d[1], other: list[0].pair.find(r => r !== room),
        mouth: edge.alongZ ? { x: edge.line + into, z: mid } : { x: mid, z: edge.line + into } });
    }
  }
  return merge(units, false).map(w => {
    const doors = shared.filter(e => e.alongZ === w.alongZ && e.line === w.line && e.a >= w.a - 1e-6 && e.b <= w.b + 1e-6).flatMap(e => e.doors || []).sort((p, q) => p[0] - q[0]);
    return w.alongZ ? { x: w.line, z: [w.a, w.b], ...(doors.length ? { doors } : {}) } : { z: w.line, x: [w.a, w.b], ...(doors.length ? { doors } : {}) };
  });
}

// ---------- 3. 家具 ----------
// 房间里真正空着的那一块：有墙的一边让出半道墙厚（外墙画在房子外面，不占屋里的地方）
function innerOf(room, ctx) {
  const { house, yard, WT } = ctx, t = WT / 2, out = { ...room };
  const walled = side => {
    const edge = room[SIDES[side].edge];
    if (room.outdoor) return side === 'n' && Number.isFinite(house.maxZ);             // 院子只有朝房子的那面有墙
    if (side === 's' && edge === house.maxZ) return yard;                              // 南立面：有院子时是一道带门的墙
    return edge !== house[SIDES[side].edge];                                           // 其余：不在房子外沿上的都是内墙
  };
  if (walled('n')) out.minZ += t; if (walled('s')) out.maxZ -= t; if (walled('w')) out.minX += t; if (walled('e')) out.maxX -= t;
  return out;
}

function parseProp(raw) {
  if (typeof raw !== 'string') return { ...raw };
  const [look, place] = raw.split('@').map(s => s.trim());
  return { look, ...(place ? { place } : {}) };
}

function placeProps(ctx) {
  const { rooms, furniture, player } = ctx, used = new Set();
  const spawn = boxOf(player.x, player.z, 1.6, 1.6);
  for (const room of rooms) {
    const inner = innerOf(room, ctx), where = `${room.name}（${room.key}）`;
    // 门口要留出来：门洞往屋里 1.2 米的一块不放东西
    const keep = room.doors.map(d => d.alongZ
      ? { minX: Math.min(d.line, d.line + SIDES[d.side].sign * 1.2), maxX: Math.max(d.line, d.line + SIDES[d.side].sign * 1.2), minZ: d.a - 0.2, maxZ: d.b + 0.2 }
      : { minZ: Math.min(d.line, d.line + SIDES[d.side].sign * 1.2), maxZ: Math.max(d.line, d.line + SIDES[d.side].sign * 1.2), minX: d.a - 0.2, maxX: d.b + 0.2 });
    if (hit(spawn, room)) keep.push(spawn);
    const mine = [];   // 这个房间里已经放下的
    const freeTotal = (room.spec.props || []).map(parseProp).filter(q => !q.place && !q.wall && !q.at && !q.rows && !q.cols && !Number.isFinite(q.x)).length;
    let freeIndex = 0;
    const add = (spec, def, x, z, w, d, face) => {
      let id = spec.id ?? `${room.id}-${spec.look}`;
      for (let n = 2; used.has(id); n++) id = `${room.id}-${spec.look}${n}`;
      used.add(id);
      const f = { id, kind: def.kind, ...(def.look ? { look: def.look } : {}), ...(spec.item ?? def.item ? { item: spec.item ?? def.item } : {}), ...(face ? { face } : {}),
        x: r2(x), z: r2(z), w: r2(w), d: r2(d), h: spec.h ?? def.size[2], color: spec.color ?? def.color, ...(spec.accent ? { accent: spec.accent } : {}) };
      furniture.push(f); mine.push({ ...boxOf(f.x, f.z, f.w, f.d), standing: !spec.wall });
    };
    const clear = (b, gap) => !mine.some(o => hit(b, o, gap)) && !keep.some(o => hit(b, o));
    const within = (b, pad = 0) => b.minX >= inner.minX + pad - 1e-6 && b.maxX <= inner.maxX - pad + 1e-6 && b.minZ >= inner.minZ + pad - 1e-6 && b.maxZ <= inner.maxZ - pad + 1e-6;

    for (const raw of room.spec.props || []) {
      const base = parseProp(raw), def = PROPS[base.look] || fail(`${where} 的家具 "${base.look}"：词汇表里没有这个名字。运行 node scripts/map.mjs vocab 看全部`);
      const along = base.along ?? def.size[0], deep = base.deep ?? def.size[1];
      const place = base.place ?? base.wall ?? (base.at ? 'at' : base.rows || base.cols ? 'grid' : 'free');
      if (Number.isFinite(base.x) && Number.isFinite(base.z)) {             // 写了绝对坐标：照放
        const ns = !base.face || base.face === 'n' || base.face === 's';
        add(base, def, base.x, base.z, base.w ?? (ns ? along : deep), base.d ?? (ns ? deep : along), base.face);
      } else if (place === 'start') {                                         // 挡在出生点前面
        if (!hit(spawn, room)) fail(`${where} 的 "${base.look}@start"：出生点不在这个房间里（出生点在 ${ctx.startRoom.name}）`);
        add({ ...base, wall: null }, def, player.x, player.z - 2.4, along, deep, 's');
      } else if (/^[nsew][nsew]?$/.test(place)) {                             // 贴墙：@n 自动找位置，@ne 靠北墙的东头
        const side = place[0], S = SIDES[side], lo = S.alongZ ? inner.minZ : inner.minX, hi = S.alongZ ? inner.maxZ : inner.maxX;
        const across = inner[S.edge] + S.sign * (deep / 2 + 0.03), at = u => S.alongZ ? boxOf(across, u, deep, along) : boxOf(u, across, along, deep);
        // 沿墙往两头量：到墙角或者下一件家具的空隙，要么贴死（≤ 0.12 米），要么够一个身体过（≥ 0.9 米），不留卡人的窄缝
        const gapOk = u => [-1, 1].every(dir => {
          const end = u + dir * along / 2; let gap = dir < 0 ? end - lo : hi - end;
          for (const o of mine) { const oLo = S.alongZ ? o.minZ : o.minX, oHi = S.alongZ ? o.maxZ : o.maxX, oNear = S.alongZ ? [o.minX, o.maxX] : [o.minZ, o.maxZ];
            if (Math.min(across + deep / 2, oNear[1]) - Math.max(across - deep / 2, oNear[0]) <= 0) continue;
            const g = dir < 0 ? end - oHi : oLo - end; if (g > -0.05) gap = Math.min(gap, g); }
          return gap <= 0.12 || gap >= 0.9;
        });
        const ok = [];
        for (let u = lo + along / 2 + 0.03; u <= hi - along / 2 - 0.03 + 1e-6; u += 0.05) if (clear(at(u), 0.1) && gapOk(u)) ok.push(u);
        if (!ok.length) fail(`${where} 的 "${base.look}@${place}"：这面墙放不下。墙长 ${r2(hi - lo)} 米，它要 ${along} 米，还要让开门口和已有的家具。换一面墙，或者减少这面墙上的东西`);
        let u;
        if (place[1] || base.at != null) {
          const want = base.at != null ? lo + (hi - lo) * base.at : 'nw'.includes(place[1]) ? lo : hi;
          u = ok.reduce((best, v) => (Math.abs(v - want) < Math.abs(best - want) ? v : best));
        } else {   // 自动：最长的一段空墙的正中
          let run = [], best = [];
          for (const v of ok) { if (run.length && v - run[run.length - 1] > 0.051) run = []; run.push(v); if (run.length > best.length) best = run; }
          u = best[Math.floor(best.length / 2)];
        }
        const b = at(u);
        add({ ...base, wall: side }, def, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, b.maxX - b.minX, b.maxZ - b.minZ, FACE_IN[side]);
      } else {                                                                // 不贴墙
        const wide = inner.maxX - inner.minX >= inner.maxZ - inner.minZ;
        const alongX = base.face ? base.face === 'n' || base.face === 's' : base.turn ? !wide : wide, w = alongX ? along : deep, d = alongX ? deep : along;
        const frac = (fx, fz) => [inner.minX + (inner.maxX - inner.minX) * fx, inner.minZ + (inner.maxZ - inner.minZ) * fz];
        const spots = place === 'c' ? [frac(0.5, 0.5)] : place === 'at' ? [frac(...base.at)]
          : place === 'grid' ? Array.from({ length: (base.rows ?? 1) * (base.cols ?? 1) }, (_, i) => frac((i % (base.cols ?? 1) + 1) / ((base.cols ?? 1) + 1), (Math.floor(i / (base.cols ?? 1)) + 1) / ((base.rows ?? 1) + 1))) : null;
        if (spots) {
          for (const [x, z] of spots) {
            const b = boxOf(x, z, w, d);
            if (!within(b) || !clear(b, 0.05)) fail(`${where} 的 "${base.look}"（放在 ${r2(x)}, ${r2(z)}）：和别的家具、门口重叠，或者伸出了房间。${place === 'grid' ? '减少 rows / cols，或者把房间画大一点' : '换个位置'}`);
            add(base, def, x, z, w, d, base.face);
          }
        } else if (place === 'free') {   // 自动：这间屋里不贴墙的几件沿房间的长边匀开，各自挪到最近的、离墙和别的家具至少 0.85 米的地方
          const [tx, tz] = frac(wide ? (freeIndex + 1) / (freeTotal + 1) : 0.5, wide ? 0.5 : (freeIndex + 1) / (freeTotal + 1));
          freeIndex++;
          let best = null;
          for (let x = inner.minX + 0.85 + w / 2; x <= inner.maxX - 0.85 - w / 2 + 1e-6; x += 0.25) for (let z = inner.minZ + 0.85 + d / 2; z <= inner.maxZ - 0.85 - d / 2 + 1e-6; z += 0.25) {
            const b = boxOf(x, z, w, d);
            if (mine.some(o => hit(b, o, 0.85)) || keep.some(o => hit(b, o, 0.3))) continue;
            const off = Math.hypot(x - tx, z - tz);
            if (!best || off < best.off - 1e-9) best = { x, z, off };
          }
          if (!best) fail(`${where} 的 "${base.look}"：屋子中间放不下（它要 ${w} × ${d} 米，四周还要各留 0.85 米走人）。改成贴墙放（"${base.look}@n"），或者把房间画大`);
          add(base, def, best.x, best.z, w, d, base.face);
        } else fail(`${where} 的 "${base.look}@${place}"：@ 后面只能写 n / s / e / w（贴哪面墙）、ne 这样的两个字母（贴北墙的东头）、c（正中）或 start（挡在出生点前面）`);
      }
    }
  }
}

// ---------- 4. 窗、灯、画：只影响画面 ----------
function dress(ctx) {
  const { rooms, house, yard, WT, T, L, def } = ctx, tall = L.furnitureBoxes;
  const freeSpans = (lo, hi, blocked) => {   // [lo, hi] 里挖掉 blocked 之后剩下的几段，长的在前
    let spans = [[lo, hi]];
    for (const [a, b] of blocked) spans = spans.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, b), q]])).filter(([p, q]) => q - p > 0.05);
    return spans.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
  };
  const nearWall = (S, edge, lo, hi, minTop, reach) => tall.filter(c => {   // 贴着这面墙、高过 minTop 的家具占了哪几段
    const gap = S.alongZ ? (S.sign > 0 ? c.minX - edge : edge - c.maxX) : (S.sign > 0 ? c.minZ - edge : edge - c.maxZ);
    return gap > -0.3 && gap < reach && c.maxY > minTop;
  }).map(c => (S.alongZ ? [c.minZ, c.maxZ] : [c.minX, c.maxX])).filter(([a, b]) => b > lo && a < hi);
  const auto = { windows: true, lamps: true, pictures: true, ...(ctx.plan.auto || {}) };
  rooms.filter(r => !r.outdoor).forEach((room, n) => {
    const windowsHere = [];
    for (const side of 'nsew') {
      const S = SIDES[side], edge = room[S.edge], lo = S.alongZ ? room.minZ : room.minX, hi = S.alongZ ? room.maxZ : room.maxX;
      const doors = room.doors.filter(d => d.side === side).map(d => [d.a, d.b]);
      // 窗只能开在房子的外墙上
      if (auto.windows && room.spec.windows !== false && edge === house[S.edge]) {
        const blocked = [...doors.map(([a, b]) => [a - 0.35, b + 0.35]), ...nearWall(S, edge, lo, hi, T.window.sill + 0.25, 0.4)];
        const [span] = freeSpans(lo + 0.6, hi - 0.6, blocked);
        if (span && span[1] - span[0] >= 1.6) {
          const two = span[1] - span[0] >= 6.5, w = Math.floor(Math.min(T.window.max, (span[1] - span[0]) / (two ? 2 : 1) - 0.4) * 10) / 10;
          for (const f of two ? [0.27, 0.73] : [0.5]) {
            const win = { [S.alongZ ? 'x' : 'z']: edge, at: r2(span[0] + (span[1] - span[0]) * f), w, ...(T.window.sill !== 1.0 ? { sill: T.window.sill } : {}), ...(T.window.head !== 2.1 ? { head: T.window.head } : {}) };
            def.windows.push(win); windowsHere.push({ side, a: win.at - w / 2, b: win.at + w / 2 });
          }
        }
      }
    }
    if (auto.lamps && room.spec.lamp !== false) {
      const w = room.maxX - room.minX, d = room.maxZ - room.minZ, wide = w >= d, count = w * d >= 45 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const f = (i + 1) / (count + 1), x0 = wide ? room.minX + w * f : room.minX + w / 2, z0 = wide ? room.minZ + d / 2 : room.minZ + d * f;
        const free = (x, z) => tall.every(c => c.maxY < Math.min(2.0, def.height - 1.2) || x < c.minX - 0.4 || x > c.maxX + 0.4 || z < c.minZ - 0.4 || z > c.maxZ + 0.4);
        const spot = [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [0.9, 0.9], [-0.9, -0.9], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]].map(([dx, dz]) => [x0 + dx, z0 + dz])
          .find(([x, z]) => free(x, z) && x > room.minX + 0.5 && x < room.maxX - 0.5 && z > room.minZ + 0.5 && z < room.maxZ - 0.5);
        if (spot) def.lamps.push({ x: r2(spot[0]), z: r2(spot[1]) });
      }
    }
    if (auto.pictures && room.spec.picture !== false) {   // 每间一幅画，挂在最长的一段空墙上
      let best = null;
      for (const side of 'nsew') {
        const S = SIDES[side], edge = room[S.edge], lo = S.alongZ ? room.minZ : room.minX, hi = S.alongZ ? room.maxZ : room.maxX;
        const exterior = edge === house[S.edge] && !(side === 's' && yard), face = exterior ? edge : edge + S.sign * WT / 2;
        const blocked = [...room.doors.filter(d => d.side === side).map(d => [d.a - 0.45, d.b + 0.45]), ...windowsHere.filter(q => q.side === side).map(q => [q.a - 0.3, q.b + 0.3]), ...nearWall(S, face, lo, hi, 0.9, 0.7)];
        const [span] = freeSpans(lo + 0.5, hi - 0.5, blocked);
        if (span && span[1] - span[0] >= 1.4 && (!best || span[1] - span[0] > best.len)) best = { S, face, mid: (span[0] + span[1]) / 2, len: span[1] - span[0] };
      }
      if (best) {
        const { S, face, mid } = best;
        def.pictures.push({ x: r2(S.alongZ ? face : mid), z: r2(S.alongZ ? mid : face), y: T.pictureY, normal: S.alongZ ? [S.sign, 0] : [0, S.sign], w: 0.9, h: 0.7, color: T.pictures[n % T.pictures.length] });
      }
    }
    if (room.spec.rug) def.rugs.push({ x: r2((room.minX + room.maxX) / 2), z: r2((room.minZ + room.maxZ) / 2), w: r2((room.maxX - room.minX) * 0.5), d: r2((room.maxZ - room.minZ) * 0.5), color: room.spec.rug === true ? room.accent : room.spec.rug });
  });
}

// ---------- 5. 僵尸和拾取物 ----------
const routeLength = (L, a, b, r) => { const pts = routeTo(L, a, b, r); if (!pts.length) return Infinity; let d = 0, p = a; for (const q of pts) { d += Math.hypot(q.x - p.x, q.z - p.z); p = q; } return d; };

function populate(ctx) {
  const { rooms, L, player, def, notes } = ctx, PR = navRadius(CONFIG.playerRadius);
  // 开局时会不会被出生点看见：睡着的要离得够远，醒着的要么看不见出生点、要么在视距之外
  const seen = p => lineOfSight(L, { x: p.x, y: 0, z: p.z }, { x: player.x, y: 1.2, z: player.z });
  const far = p => Math.hypot(p.x - player.x, p.z - player.z);
  const safe = (p, awake) => (awake ? far(p) > CONFIG.sightRange + 0.6 || !seen(p) : far(p) > CONFIG.hearRadius + 1.1 || !seen(p));
  const counters = {}, placedAll = [];
  for (const room of rooms) {
    const inner = innerOf(room, ctx), where = `${room.name}（${room.key}）`;
    // 玩家从哪进这个房间：出生的房间就是出生点，别的房间是离出生点路程最短的那扇门
    const entry = room === ctx.startRoom ? player : room.doors.map(d => ({ ...d.mouth, far: routeLength(L, player, d.mouth, PR) })).sort((p, q) => p.far - q.far)[0] || { x: (room.minX + room.maxX) / 2, z: (room.minZ + room.maxZ) / 2 };
    room.entry = { x: r2(entry.x), z: r2(entry.z) };
    const grid = (radius, pad) => {
      const out = [];
      for (let x = inner.minX + radius + pad; x <= inner.maxX - radius - pad + 1e-6; x += 0.25) for (let z = inner.minZ + radius + pad; z <= inner.maxZ - radius - pad + 1e-6; z += 0.25) {
        if (freePoint(L, x, z, radius + pad) && room.doors.every(d => Math.hypot(d.mouth.x - x, d.mouth.z - z) > 1.1)) out.push({ x: r2(x), z: r2(z) });
      }
      return out;
    };
    const here = [];
    for (const raw of room.spec.zombies || []) {
      const spec = typeof raw === 'string' ? { type: raw.split(':')[0].trim(), state: raw.split(':')[1]?.trim() } : { ...raw };
      const kind = ENEMY_TYPES[spec.type] || fail(`${where} 的僵尸 "${spec.type}"：没有这个种类（现有：${names(ENEMY_TYPES)}）`);
      const info = ZOMBIES[spec.type], n = counters[spec.type] = (counters[spec.type] || 0) + 1;
      let state = spec.state ?? (info.ranged || spec.type === 'shielded' ? 'idle' : spec.type === 'heavy' ? ['idle', 'asleep'][n % 2] : ['asleep', 'patrol', 'idle', 'asleep'][n % 4]);
      if (!['asleep', 'idle', 'patrol'].includes(state)) fail(`${where} 的僵尸 "${spec.type}:${state}"：冒号后面只能写 asleep（睡着）、idle（醒着站着）、patrol（来回巡逻）`);
      if (Number.isFinite(spec.x) && Number.isFinite(spec.z)) {   // 写了绝对坐标：照放
        def.enemies.push({ type: spec.type, x: spec.x, z: spec.z, state: state === 'patrol' ? 'idle' : state, heading: spec.heading ?? 0, ...(spec.patrol ? { patrol: spec.patrol } : {}) });
        here.push(spec); placedAll.push(spec); continue;
      }
      const all = grid(kind.radius, 0.15);
      const dE = p => Math.hypot(p.x - entry.x, p.z - entry.z);
      const apart = p => Math.min(6, ...here.map(o => Math.hypot(o.x - p.x, o.z - p.z)));
      const snug = p => !freePoint(L, p.x, p.z, kind.radius + 0.75);   // 贴着墙或家具
      const score = p => (info.ranged ? Math.min(dE(p), 9) + Math.min(apart(p), 3) : 2 * Math.min(apart(p), 3.5) - Math.abs(dE(p) - 5) * 0.6 + (state === 'asleep' && snug(p) ? 0.8 : 0));
      const pick = awake => all.filter(p => apart(p) >= 1.3 && safe(p, awake)).map(p => ({ ...p, score: score(p) - (dE(p) < 2.2 ? 6 : 0) })).sort((p, q) => q.score - p.score || p.x - q.x || p.z - q.z)
        .find(p => routeTo(L, p, player, navRadius(kind.radius)).length > 0);
      let spot = pick(state !== 'asleep');
      if (!spot && state !== 'asleep') {
        spot = pick(false);
        if (spot) { notes.push(`${where} 的${info.name}：这间屋里没有出生点看不见的位置，改成了睡着。想让它醒着，在出生点前面放一件高的东西（比如 "blocks@start"）`); state = 'asleep'; }
      }
      if (!spot) fail(`${where} 放不下第 ${here.length + 1} 只僵尸（${info.name}）：找不到既不堵门、又不会一开局就发现玩家的空地。减少这间屋的僵尸或家具，或者在出生点前面放一件高的东西（"blocks@start"）`);
      const toEntry = Math.atan2(entry.x - spot.x, entry.z - spot.z), turn = (n % 2 ? 1 : -1) * Math.PI / 2;
      const enemy = { type: spec.type, x: spot.x, z: spot.z, state: state === 'patrol' ? 'idle' : state,
        heading: r2(spec.heading ?? (spec.type === 'shielded' ? toEntry : state === 'asleep' ? toEntry + (n % 2 ? Math.PI : turn) : toEntry + turn)) };
      if (state === 'patrol') {   // 巡逻：在屋里找一段走得通、全程不会被出生点看见的直线
        const leg = all.map(q => ({ ...q, len: Math.hypot(q.x - spot.x, q.z - spot.z), straight: Math.min(Math.abs(q.x - spot.x), Math.abs(q.z - spot.z)) < 0.3 }))
          .filter(q => q.len >= 3 && q.len <= 9 && clearPath(L, spot, q, kind.radius + 0.1) && Array.from({ length: Math.ceil(q.len / 0.2) + 1 }, (_, i) => i / Math.ceil(q.len / 0.2)).every(f => safe({ x: spot.x + (q.x - spot.x) * f, z: spot.z + (q.z - spot.z) * f }, true)))
          .sort((p, q) => (q.len + (q.straight ? 3 : 0)) - (p.len + (p.straight ? 3 : 0)))[0];
        if (leg) { enemy.patrol = [[leg.x, leg.z], [spot.x, spot.z]]; enemy.heading = r2(Math.atan2(leg.x - spot.x, leg.z - spot.z)); }
      }
      def.enemies.push(enemy); here.push(spot); placedAll.push(spot);
    }
    room.zombieSpots = here;
  }
  // 拾取物：枪放在进门不远的地方（一进来就看得到），补给放在往里走的角落（奖励多走几步）
  const dropped = [];
  for (const room of rooms) {
    const inner = innerOf(room, ctx), where = `${room.name}（${room.key}）`, entry = room.entry;
    for (const raw of room.spec.pickups || []) {
      const spec = typeof raw === 'string' ? (raw === 'ammo' || raw === 'heart' || raw === 'yarn' ? { kind: raw } : { kind: 'weapon', weapon: raw.replace(/^gun:/, '') }) : raw.objective ? { kind: 'objective', name: raw.objective, ...raw } : { ...raw };
      let item;
      if (spec.kind === 'weapon') {
        if (!(spec.weapon in GUNS)) fail(`${where} 的拾取物 "${spec.weapon}"：能放在地上的枪只有 ${names(GUNS)}；另外可以写 'ammo'（弹药包）、'heart'（心）、'yarn'（毛线团）、{ objective: '名字' }（任务物品）`);
        item = { kind: 'weapon', weapon: spec.weapon, amount: spec.amount ?? GUNS[spec.weapon] };
      } else if (spec.kind === 'ammo') item = { kind: 'ammo' };
      else if (spec.kind === 'yarn') item = { kind: 'ammo', weapon: 'yarn', amount: spec.amount ?? 1 };
      else if (spec.kind === 'heart') item = { kind: 'heart', amount: 1 };
      else if (spec.kind === 'objective') {
        if (spec.item && !OBJECTIVE_ITEMS.includes(spec.item)) fail(`${where} 的任务物品 item "${spec.item}"：只有 ${OBJECTIVE_ITEMS.join('、')} 这几种模型`);
        item = { kind: 'objective', item: spec.item ?? 'basket', name: spec.name };
      } else fail(`${where} 的拾取物 ${JSON.stringify(raw)} 看不懂：写 'ammo'、'heart'、'yarn'、枪的名字（${names(GUNS)}）或 { objective: '名字' }`);
      let spot = Number.isFinite(spec.x) && Number.isFinite(spec.z) ? { x: spec.x, z: spec.z } : null;
      if (!spot) {
        const dE = p => Math.hypot(p.x - entry.x, p.z - entry.z), apart = p => Math.min(5, ...dropped.map(o => Math.hypot(o.x - p.x, o.z - p.z)));
        const all = [];
        for (let x = inner.minX + 0.5; x <= inner.maxX - 0.5 + 1e-6; x += 0.25) for (let z = inner.minZ + 0.5; z <= inner.maxZ - 0.5 + 1e-6; z += 0.25) {
          const p = { x: r2(x), z: r2(z) };
          if (!freePoint(L, x, z, CONFIG.playerRadius + 0.2) || room.doors.some(d => Math.hypot(d.mouth.x - x, d.mouth.z - z) < 1.0) || apart(p) < 1.2 || placedAll.some(o => Math.hypot(o.x - x, o.z - z) < 1.0) || Math.hypot(player.x - x, player.z - z) < 1.2) continue;
          const corner = !freePoint(L, x, z, 1.0) ? 1 : 0;
          all.push({ ...p, score: item.kind === 'weapon' ? -Math.abs(dE(p) - 2.5) + corner * 0.3 : item.kind === 'objective' ? dE(p) : Math.min(dE(p), 8) * 0.6 + corner + Math.min(apart(p), 4) * 0.5 });
        }
        spot = all.sort((p, q) => q.score - p.score || p.x - q.x || p.z - q.z).find(p => routeTo(L, player, p, PR).length > 0);
        if (!spot) fail(`${where} 放不下拾取物 ${JSON.stringify(raw)}：没有够宽的空地。减少这间屋里的东西`);
      }
      def.pickups.push({ ...item, x: spot.x, z: spot.z }); dropped.push(spot);
    }
  }
}

// ---------- 6. 界面文案：草图里没写的，按内容补 ----------
function texts(plan, def, rooms) {
  const short = plan.short ?? def.name.split(/\s*·\s*/)[0], n = def.enemies.length, fetch = def.mission.type === 'fetch';
  const types = new Set(def.enemies.map(e => e.type)), minutes = Math.round(def.par / 60);
  const special = [types.has('archer') && '弓手：瞄准线变红就换方向', types.has('bomber') && '炸弹客：离开红圈', types.has('shielded') && '持盾者：棉被炮或蓄力球', types.has('heavy') && '棉甲：绕后或毛衣针'].filter(Boolean);
  const guns = def.pickups.filter(k => k.kind === 'weapon').map(k => `${WEAPONS.find(w => w.id === k.weapon).name}在${rooms.find(r => k.x >= r.minX && k.x <= r.maxX && k.z >= r.minZ && k.z <= r.maxZ)?.name ?? '地图里'}`);
  const things = def.pickups.filter(k => k.kind === 'objective').map(k => k.name);
  return {
    short, eyebrow: def.name,
    title: fetch ? `把${things.join('、') || '东西'}<br>找回来。` : `把${short}里的僵尸<br>全部清走。`,
    intro: fetch ? `${short}里一共 ${n} 只僵尸，不会再多，也不必都打倒。找到${things.join('、')}，带回出发的地方。它们有的睡着，有的在巡逻，还没发现你。`
      : `${short}里一共 ${n} 只僵尸，不会再多。把它们全部击倒就过关。它们有的睡着，有的在巡逻，还没发现你。`,
    how: ['Q 换枪 · E 扔毛线团 · F 换地上的枪 · R 换弹', ...(special.length ? [special.slice(0, 2).join(' · '), ...(special.length > 2 ? [special.slice(2).join(' · ')] : [])] : []), '从背后打 ×2，趁它没发现再 ×2',
      ...(guns.length ? [guns.slice(0, 3).join(' · ')] : []), `3 颗心 · 受伤少、${minutes} 分钟内${fetch ? '带回' : '清完'}可得三星`],
    start: '出发', hint: fetch ? `${things.join('、')}在里面 · 拿到后回到出发的地方` : '它们还没发现你 · 从背后打更省事',
    won: fetch ? '带回来了！' : '清空了！',
    ...(fetch ? { got: '拿到了！', carry: '都齐了 · 回到出发的地方', lostCarrying: '东西到手却没带回来：回去之前先把路上的清掉。' } : {}),
    ...(plan.texts || {}),
  };
}

// ---------- 入口 ----------
export function buildMap(plan) {
  if (!plan || !plan.id || !plan.name) fail('草图缺 id 或 name（id 是文件名和网址里用的英文短名，name 是界面上的名字）');
  const T = THEMES[plan.theme ?? 'home'] || fail(`主题 "${plan.theme}" 不存在（现有：${names(THEMES)}）`);
  const { rooms, units, bounds } = parseLayout(plan);
  const indoor = rooms.filter(r => !r.outdoor), yard = rooms.some(r => r.outdoor);
  const house = indoor.reduce((a, r) => ({ minX: Math.min(a.minX, r.minX), maxX: Math.max(a.maxX, r.maxX), minZ: Math.min(a.minZ, r.minZ), maxZ: Math.max(a.maxZ, r.maxZ) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const walls = placeDoors(plan, rooms, units, T);
  rooms.forEach((room, i) => {
    const [surface, floor, accent] = T.floors[indoor.indexOf(room) % T.floors.length] || [];
    Object.assign(room, room.outdoor ? { floor: room.spec.floor ?? T.yardFloor } : { surface: room.spec.surface ?? surface, floor: room.spec.floor ?? floor, accent: room.spec.accent ?? accent });
  });
  // 出生点：最南边那一行，默认在院子（没有院子就是最南边、正中的那间）的南沿正中，面朝北
  const byKey = k => rooms.find(r => r.key === k || r.id === k);
  const south = rooms.filter(r => r.maxZ === bounds.maxZ);
  const startRoom = plan.start?.room ? byKey(plan.start.room) || fail(`start.room "${plan.start.room}"：没有这个房间`) : south.find(r => r.minX <= (bounds.minX + bounds.maxX) / 2 && r.maxX >= (bounds.minX + bounds.maxX) / 2) || south[0];
  if (startRoom.maxZ !== bounds.maxZ) fail(`start.room "${startRoom.key}"：出生的房间要在 layout 的最下面一行（玩家从南边进来，面朝北）`);
  const player = { x: r2(startRoom.minX + (startRoom.maxX - startRoom.minX) * (plan.start?.at ?? 0.5)), z: r2(bounds.maxZ - 0.8), yaw: 0 };

  const mission = plan.mission === 'fetch' || plan.mission?.type === 'fetch'
    ? { type: 'fetch', title: plan.mission.title ?? '把东西找回来，带回出发的地方', alarm: plan.mission.alarm ?? 8, exit: plan.mission.exit && plan.mission.exit !== 'start' ? plan.mission.exit : { minX: r2(player.x - 1.5), maxX: r2(player.x + 1.5), minZ: r2(player.z - 0.8), maxZ: bounds.maxZ } }
    : { type: 'clear', title: plan.mission?.title ?? `把${plan.short ?? plan.name.split(/\s*·\s*/)[0]}里的僵尸全部清走` };
  const def = {
    id: plan.id, name: plan.name, look: plan.look ?? T.look, bounds, height: plan.height ?? T.height, wallThickness: T.wallThickness, doorHeight: T.doorHeight,
    par: 0, player, arsenal: plan.arsenal ?? ['single', 'scatter', 'yarn'], mission, theme: { ...T.theme, ...(plan.raw?.theme || {}) },
    rooms: rooms.map(r => ({ id: r.id, name: r.name, minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, ...(r.outdoor ? { outdoor: true, floor: r.floor } : { surface: r.surface, floor: r.floor, accent: r.accent }) })),
    walls, windows: [], lamps: [], rugs: [], pictures: [], furniture: [], enemies: [], pickups: [],
  };
  const notes = [], ctx = { plan, T, rooms, house, yard, WT: T.wallThickness, player, startRoom, furniture: def.furniture, def, notes };
  placeProps(ctx);
  def.furniture.push(...(plan.raw?.furniture || []));
  ctx.L = compileLevel(def);
  dress(ctx);
  populate(ctx);
  for (const key of ['windows', 'lamps', 'rugs', 'pictures', 'enemies', 'pickups']) def[key].push(...(plan.raw?.[key] || []));
  for (const key of ['yard', 'hangings', 'skylights', 'menu']) if (plan.raw?.[key]) def[key] = plan.raw[key];
  // 标准时间：每只僵尸 21 秒，取整到半分钟（现有三张图大致是这个数）
  def.par = plan.par ?? Math.max(120, Math.round(def.enemies.length * 21 / 30) * 30);
  def.texts = texts(plan, def, rooms);
  if (notes.length) def.notes = notes;
  return def;
}
