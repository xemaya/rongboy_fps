// 地图的硬性检查：站得住（没有东西叠在一起、每样东西都走得到）、开局安全、任务走得通、没用错词。
// 对任何关卡数据都能跑：生成器展开的，或者手写的（现有的家、博物馆、学校）。准则见 docs/map-guide.md 第 1 节。
// errors：不改就不能合入。warnings：多半是问题，确认过是有意的可以留。不依赖 DOM。
import { compileLevel, clearPath, freePoint, routeTo, navRadius, roomAt, lineOfSight } from '../level.js';
import { createGame, step, missionStatus, CONFIG, WEAPONS, ENEMY_TYPES } from '../game.js';
import { ATTACKS } from '../attacks.js';
import { PROPS, ZOMBIES, SURFACES, OBJECTIVE_ITEMS } from './catalog.js';
import { GADGETS, STASH } from '../gadgets.js';

const LOOKS = ['afternoon', 'morning', 'night'];   // looks.js 里的光线预设（那个文件依赖渲染引擎，这里不能直接引）
const KINDS = new Set(Object.values(PROPS).map(p => p.kind));
const LOOK_NAMES = new Set(Object.values(PROPS).flatMap(p => [p.look, p.kind]).filter(Boolean));
const ITEMS = new Set([...Object.values(PROPS).map(p => p.item).filter(Boolean), 'gem-green', 'gem-empty']);
const f1 = n => (Math.round(n * 10) / 10).toString();
const at = p => `(${f1(p.x)}, ${f1(p.z)})`;

export function roomOrder(L) {   // 从出生点走进去，先到哪个房间（按到房间里最近一个空点的路程排）
  const S = L.storeys[0], r = navRadius(CONFIG.playerRadius);
  return S.rooms.filter(q => !q.tower).map(room => {
    let best = Infinity;
    if (L.player.x >= room.minX && L.player.x <= room.maxX && L.player.z >= room.minZ && L.player.z <= room.maxZ) best = 0;
    else for (let x = room.minX + 0.6; x <= room.maxX - 0.6 && best === Infinity; x += 0.6) for (let z = room.minZ + 0.6; z <= room.maxZ - 0.6; z += 0.6) {
      if (!freePoint(S, x, z, r)) continue;
      const pts = routeTo(S, L.player, { x, z }, r);
      if (pts.length) { let d = 0, p = L.player; for (const q of pts) { d += Math.hypot(q.x - p.x, q.z - p.z); p = q; } best = d; break; }
    }
    return { room, far: best };
  }).sort((a, b) => a.far - b.far);
}

export function checkMap(def, { play = true } = {}) {
  const errors = [], warnings = [];
  const err = (code, msg) => errors.push({ code, msg }), warn = (code, msg) => warnings.push({ code, msg });

  // ---- 0. 必填项
  for (const key of ['id', 'name', 'bounds', 'height', 'wallThickness', 'doorHeight', 'player', 'mission', 'rooms']) if (def[key] == null) err('missing', `缺 ${key}`);
  if (errors.length) return { errors, warnings, facts: {} };
  if (!LOOKS.includes(def.look)) err('look', `look "${def.look}" 不存在：只有 ${LOOKS.join('、')}（光线预设在 looks.js）`);
  for (const key of ['short', 'title', 'intro', 'how', 'start', 'won']) if (!def.texts?.[key]) err('texts', `texts.${key} 没写：开始画面要用`);
  if (def.mission.type === 'fetch') for (const key of ['got', 'carry']) if (!def.texts?.[key]) err('texts', `找东西的任务还要写 texts.${key}`);

  const parts = [def, ...(def.upper || [])];
  let L;
  try { L = compileLevel(def); } catch (e) { err('compile', `关卡数据编译不了：${e.message}`); return { errors, warnings, facts: {} }; }
  const multi = L.storeys.length > 1, B = L.bounds;
  const from = floor => (floor && L.stairs ? { x: 0, z: L.stairs.outZ + 0.6 } : L.player);   // 楼上的东西从楼梯口算起

  // ---- 1. 词汇
  const ids = new Set();
  parts.forEach((part, floor) => {
    const tag = multi ? `${floor + 1} 层 ` : '';
    const roomIds = new Set();
    for (const r of part.rooms) {
      if (roomIds.has(r.id)) err('room-id', `${tag}房间 id "${r.id}" 重复`); roomIds.add(r.id);
      if (!r.name) err('room-name', `${tag}房间 "${r.id}" 没有 name`);
      if (r.surface && !SURFACES.includes(r.surface)) err('surface', `${tag}${r.name} 的 surface "${r.surface}" 不存在：只有 ${SURFACES.join('、')}`);
      if (!r.outdoor && !r.tower && Math.min(r.maxX - r.minX, r.maxZ - r.minZ) < 2.4) warn('room-small', `${tag}${r.name} 最窄处只有 ${f1(Math.min(r.maxX - r.minX, r.maxZ - r.minZ))} 米：玩家后退、僵尸扑击都施展不开，至少 2.4 米（走廊 3 米更好）`);
    }
    for (const f of part.furniture || []) {
      const where = `${tag}家具 "${f.id}" ${at(f)}`;
      if (ids.has(f.id)) warn('furniture-id', `${where}：id 和别的家具重复`); ids.add(f.id);
      if (!KINDS.has(f.kind)) err('kind', `${where}：kind "${f.kind}" 不存在。world.js 认识的 kind：${[...KINDS].join('、')}`);
      if (f.look && !LOOK_NAMES.has(f.look)) err('look-name', `${where}：look "${f.look}" 不存在，会被画成一只箱子。运行 node scripts/map.mjs vocab 看全部名字`);
      if (f.item && !ITEMS.has(f.item)) err('item', `${where}：item "${f.item}" 不存在。现有：${[...ITEMS].join('、')}`);
      if (f.face && !'nsew'.includes(f.face)) err('face', `${where}：face 只能是 n / s / e / w`);
      if (!(f.w > 0 && f.d > 0 && f.h > 0)) err('size', `${where}：w、d、h 要是正数`);
    }
    for (const e of part.enemies || []) {
      if (!ENEMY_TYPES[e.type]) err('enemy-type', `${tag}僵尸 ${at(e)}：type "${e.type}" 不存在。现有：${Object.keys(ENEMY_TYPES).join('、')}`);
      else if (ZOMBIES[e.type]?.untested) warn('enemy-untested', `${tag}${ZOMBIES[e.type].name} ${at(e)}：这个种类还没进过正式地图，没有人玩过它在地图里的表现`);
      if (!['asleep', 'idle', 'alert'].includes(e.state ?? 'alert')) err('enemy-state', `${tag}僵尸 ${at(e)}：state "${e.state}" 不存在，只能是 asleep / idle（巡逻的也是 idle，再加 patrol）`);
      else if ((e.state ?? 'alert') === 'alert' && !e.dormant) warn('enemy-alert', `${tag}${ENEMY_TYPES[e.type]?.name ?? e.type} ${at(e)} 一开局就是警觉的：会立刻冲向出生点。正式地图里的僵尸都应该是 asleep 或 idle`);
    }
    for (const k of part.pickups || []) {
      if (!['weapon', 'ammo', 'heart', 'objective'].includes(k.kind)) err('pickup-kind', `${tag}拾取物 ${at(k)}：kind "${k.kind}" 不存在`);
      if (k.weapon && !WEAPONS.some(w => w.id === k.weapon)) err('pickup-weapon', `${tag}拾取物 ${at(k)}：没有叫 "${k.weapon}" 的枪`);
      if (k.kind === 'objective' && k.item && !OBJECTIVE_ITEMS.includes(k.item)) warn('pickup-item', `${tag}任务物品 ${at(k)}：item "${k.item}" 没有对应的模型，会画成毛线篮`);
      if (k.kind === 'objective' && !k.name) err('pickup-name', `${tag}任务物品 ${at(k)} 没有 name`);
      if (k.stash && (k.kind === 'weapon' || k.kind === 'objective')) err('stash-holds', `${tag}拉链暗格 ${at(k.stash)} 里放了${k.kind === 'weapon' ? '枪' : '任务物品'}：暗格里只放补给（心、弹药包、毛线团），过关必需的东西不能藏起来（fun-design 9.7）`);
    }
    for (const g of part.gadgets || []) if (!GADGETS[g.kind]) err('gadget-kind', `${tag}机关 ${at(g)}：kind "${g.kind}" 不存在。现有：${Object.keys(GADGETS).join('、')}`);
  });
  if (errors.length) return { errors, warnings, facts: {} };   // 词都没写对，后面的检查没有意义
  const gadgetKinds = [...new Set(parts.flatMap(part => (part.gadgets || []).map(g => g.kind)))];
  if (gadgetKinds.length > 1) warn('gadget-mix', `这张图用了 ${gadgetKinds.length} 种机关（${gadgetKinds.map(k => GADGETS[k].name).join('、')}）：一张图只用一种，玩家学一样就够用整张图（fun-design 9.4）`);

  // ---- 2. 房间拼得对不对：室内的房间要正好铺满房子的矩形，院子在南面
  parts.forEach((part, floor) => {
    const indoor = part.rooms.filter(r => !r.outdoor && !r.tower), tag = multi ? `${floor + 1} 层 ` : '';
    for (let i = 0; i < part.rooms.length; i++) for (let j = i + 1; j < part.rooms.length; j++) {
      const a = part.rooms[i], b = part.rooms[j], ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX), oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
      if (ox > 0.01 && oz > 0.01) err('rooms-overlap', `${tag}${a.name}和${b.name}重叠了 ${f1(ox)} × ${f1(oz)} 米`);
    }
    if (!indoor.length) return;
    const H = L.house, area = indoor.reduce((s, r) => s + (r.maxX - r.minX) * (r.maxZ - r.minZ), 0), full = (H.maxX - H.minX) * (H.maxZ - H.minZ);
    if (floor === 0 && Math.abs(area - full) > 0.05) err('rooms-gap', `${tag}室内房间的面积加起来是 ${f1(area)} 平米，但它们的外沿围出来有 ${f1(full)} 平米：中间有没被任何房间盖住的空地（渲染只会画一个长方形的房子）`);
    for (const r of part.rooms.filter(r => r.outdoor)) if (r.minZ < H.maxZ - 0.01) err('yard-side', `${tag}${r.name}（室外）不在房子南面：院子只能在房子南边，北沿贴着房子的南墙（z = ${H.maxZ}）`);
  });

  // ---- 3. 每样东西都放在空地上、走得到
  const widest = Math.max(0.455, ...L.enemies.map(e => navRadius(ENEMY_TYPES[e.type].radius)));
  if (!freePoint(L, L.player.x, L.player.z, CONFIG.playerRadius)) err('spawn', `出生点 ${at(L.player)} 压在墙或家具上`);
  for (const e of L.enemies) {
    const S = L.storeys[e.floor], T = ENEMY_TYPES[e.type], r = T.radius, where = `${multi ? e.floor + 1 + ' 层 ' : ''}${T.name} ${at(e)}`;
    if (!freePoint(S, e.x, e.z, r)) { err('enemy-blocked', `${where} 压在墙或家具上（它的半径 ${r} 米）。挪到空地上`); continue; }
    if (!roomAt(S, e.x, e.z)) err('enemy-room', `${where} 不在任何房间里`);
    for (const [x, z] of e.patrol || []) {
      if (!freePoint(S, x, z, r)) err('patrol-blocked', `${where} 的巡逻点 (${x}, ${z}) 压在墙或家具上`);
      else if (!(clearPath(S, e, { x, z }, r) || e.patrol.some(([a, b]) => clearPath(S, { x: a, z: b }, { x, z }, r)))) err('patrol-leg', `${where} 走不到巡逻点 (${x}, ${z})：两点之间隔着墙或家具，巡逻只会走直线`);
    }
    if (!routeTo(S, e, from(e.floor), navRadius(r)).length) err('enemy-cut-off', `${where} 被封死了，走不到${e.floor ? '楼梯口' : '出生点'}：检查它所在的房间有没有门，门口有没有被家具堵住`);
  }
  for (const k of L.pickups) {
    const S = L.storeys[k.floor], where = `${multi ? k.floor + 1 + ' 层 ' : ''}拾取物 ${k.name ?? k.weapon ?? k.kind} ${at(k)}`;
    if (!freePoint(S, k.x, k.z, CONFIG.playerRadius)) err('pickup-blocked', `${where} 压在墙或家具上`);
    else if (!routeTo(S, from(k.floor), k, navRadius(CONFIG.playerRadius)).length) err('pickup-cut-off', `${where} 玩家走不到`);
  }
  L.storeys.forEach((S, floor) => {
    const tag = multi ? `${floor + 1} 层 ` : '', boxes = S.furnitureBoxes;
    // 机关：不能压在墙和家具上；拉链要开在墙面上，东西掉在它前面
    for (const g of S.gadgetBoxes) {
      const others = [...boxes, ...S.walls.filter(w => w.kind === 'wall'), ...S.gadgetBoxes.filter(o => o !== g)];
      const clash = others.find(c => Math.min(g.maxX, c.maxX) - Math.max(g.minX, c.minX) > 0.03 && Math.min(g.maxZ, c.maxZ) - Math.max(g.minZ, c.minZ) > 0.03);
      if (clash) err('gadget-blocked', `${tag}${GADGETS[g.gadget].name} ${at(g)} 压在了 "${clash.id}" 上。挪到空地上，四周留 0.85 米`);
      else if (g.minX < S.bounds.minX || g.maxX > S.bounds.maxX || g.minZ < S.bounds.minZ || g.maxZ > S.bounds.maxZ) err('gadget-blocked', `${tag}${GADGETS[g.gadget].name} ${at(g)} 伸出了地图边界`);
    }
    for (const k of L.pickups.filter(k => k.floor === floor && k.stash)) {
      const z = k.stash, H = L.house, where = `${tag}拉链暗格 ${at(z)}`;
      const toWall = Math.min(...S.walls.filter(w => w.kind === 'wall').map(w => Math.hypot(Math.max(w.minX - z.x, 0, z.x - w.maxX), Math.max(w.minZ - z.z, 0, z.z - w.maxZ))), Infinity);
      const toEdge = Math.min(Math.abs(z.x - S.bounds.minX), Math.abs(z.x - S.bounds.maxX), Math.abs(z.z - S.bounds.minZ), Math.abs(z.z - S.bounds.maxZ), ...(Number.isFinite(H.minX) ? [Math.abs(z.x - H.minX), Math.abs(z.x - H.maxX), Math.abs(z.z - H.minZ)] : []));
      if (Math.min(toWall, toEdge) > 0.2) err('stash-wall', `${where} 不在墙面上（离最近的墙 ${f1(Math.min(toWall, toEdge))} 米）：毛球要打在墙上才拉得开它`);
      const n = z.normal || [0, 1], out = (k.x - z.x) * n[0] + (k.z - z.z) * n[1], far = Math.hypot(k.x - z.x, k.z - z.z);
      if (out < 0.3 || far > 1.2) err('stash-drop', `${where}：里面的东西落在 ${at(k)}，要落在拉链正前方 0.4–1 米的墙脚（normal 指向屋里）`);
    }
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      if (a.minX < S.bounds.minX - 0.01 || a.maxX > S.bounds.maxX + 0.01 || a.minZ < S.bounds.minZ - 0.01 || a.maxZ > S.bounds.maxZ + 0.01) err('furniture-out', `${tag}家具 "${a.id}" ${at(a)} 伸出了地图边界`);
      for (const w of S.walls) if (w.kind === 'wall' && Math.min(a.maxX, w.maxX) - Math.max(a.minX, w.minX) > 0.03 && Math.min(a.maxZ, w.maxZ) - Math.max(a.minZ, w.minZ) > 0.03) { err('furniture-in-wall', `${tag}家具 "${a.id}" ${at(a)} 嵌进了墙里`); break; }
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j], ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX), oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
        if (ox > 0.03 && oz > 0.03) warn('furniture-overlap', `${tag}家具 "${a.id}" 和 "${b.id}" 叠在一起（${f1(ox)} × ${f1(oz)} 米）`);
      }
    }
  });

  // ---- 4. 门：每间至少两个出口，最宽的僵尸过得去
  parts.forEach((part, floor) => {
    const S = L.storeys[floor], tag = multi ? `${floor + 1} 层 ` : '';
    for (const r of part.rooms.filter(r => !r.outdoor && !r.tower)) {
      let doors = 0;
      for (const w of part.walls || []) {
        const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, lo = alongZ ? r.minZ : r.minX, hi = alongZ ? r.maxZ : r.maxX;
        if (![alongZ ? r.minX : r.minZ, alongZ ? r.maxX : r.maxZ].includes(line)) continue;
        doors += (w.doors || []).filter(([a, b]) => a >= lo && b <= hi).length;
      }
      if (floor === 0 && L.stairs && r.minX <= 0 && r.maxX >= 0 && r.minZ === L.house.minZ) doors++;   // 楼梯口也是一个出口
      if (doors < 2) err('doors', `${tag}${r.name} 只有 ${doors} 个出口：每间至少两个，不然被堵在里面就出不来（僵尸也只能从一个方向来，变成守门口）。再开一扇门通到另一间`);
    }
    for (const w of part.walls || []) for (const [a, b] of w.doors || []) {
      const alongZ = typeof w.x === 'number', mid = (a + b) / 2, line = alongZ ? w.x : w.z;
      const p = alongZ ? { x: line - 0.8, z: mid } : { x: mid, z: line - 0.8 }, q = alongZ ? { x: line + 0.8, z: mid } : { x: mid, z: line + 0.8 };
      if (!clearPath(S, p, q, widest)) err('door-blocked', `${tag}${alongZ ? 'x' : 'z'} = ${line} 墙上 ${a}–${b} 的门过不去：门宽 ${f1(b - a)} 米，这张图上最宽的僵尸要 ${f1(widest * 2 + 0.1)} 米；或者门口 0.8 米内有家具挡着`);
    }
  });

  // ---- 5. 没有僵尸够不着的死角
  L.storeys.forEach((S, floor) => {
    const small = navRadius(ENEMY_TYPES.walker.radius), reach = CONFIG.playerRadius + ENEMY_TYPES.walker.radius, d = 0.15, stand = [], walk = [];
    for (let x = S.bounds.minX; x <= S.bounds.maxX; x += d) for (let z = S.bounds.minZ; z <= S.bounds.maxZ; z += d) {
      if (freePoint(S, x, z, small)) walk.push([x, z]); else if (freePoint(S, x, z, CONFIG.playerRadius)) stand.push([x, z]);
    }
    const pockets = stand.filter(([x, z]) => !walk.some(([a, b]) => Math.hypot(a - x, b - z) <= reach));
    if (pockets.length) {
      const [x, z] = pockets[0], near = S.furnitureBoxes.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
      err('pocket', `${multi ? floor + 1 + ' 层 ' : ''}(${f1(x)}, ${f1(z)}) 附近有一个玩家挤得进去、僵尸够不着的窄缝${near ? `（最近的家具是 "${near.id}"）` : ''}。家具要么贴死墙和别的家具，要么离开至少 0.8 米`);
    }
  });

  // ---- 6. 窗、灯、画放得上去（只影响画面，但放错了会穿模）
  parts.forEach((part, floor) => {
    const S = L.storeys[floor], H = L.house, tag = multi ? `${floor + 1} 层 ` : '';
    for (const w of part.windows || []) {
      const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z, a0 = w.at - w.w / 2, a1 = w.at + w.w / 2, where = `${tag}${alongZ ? 'x' : 'z'} = ${line} 墙上位置 ${w.at} 的窗`;
      if (!(alongZ ? [H.minX, H.maxX].includes(line) : [H.minZ, H.maxZ].includes(line))) { err('window-wall', `${where}：窗只能开在房子的外墙上`); continue; }
      if (!(a0 > (alongZ ? H.minZ : H.minX) + 0.3 && a1 < (alongZ ? H.maxZ : H.maxX) - 0.3)) err('window-corner', `${where} 离墙角太近（至少 0.3 米）`);
      const wall = (part.walls || []).find(v => (alongZ ? v.x : v.z) === line);
      for (const [d0, d1] of wall?.doors || []) if (!(a1 < d0 - 0.2 || a0 > d1 + 0.2)) err('window-door', `${where} 和 ${d0}–${d1} 的门重叠`);
      for (const v of part.walls || []) {
        const cross = alongZ ? v.z : v.x, span = alongZ ? v.x : v.z;
        if (typeof cross === 'number' && Array.isArray(span) && span.includes(line) && !(cross < a0 - 0.15 || cross > a1 + 0.15)) err('window-inner-wall', `${where} 正对着一道内墙的端头`);
      }
      const sill = w.sill ?? 1.0, head = w.head ?? 2.1;
      if (!(sill >= 0.9 && head <= def.height - 0.3 && head >= sill + 0.7)) err('window-height', `${where}：窗台 ${sill}、窗顶 ${head} 不对（窗台 ≥ 0.9，窗顶 ≤ 层高 − 0.3，窗高 ≥ 0.7）`);
      const inside = Math.sign((alongZ ? (H.minX + H.maxX) / 2 : (H.minZ + H.maxZ) / 2) - line);
      for (const c of S.furnitureBoxes) {
        const near = alongZ ? (inside > 0 ? c.minX - line : line - c.maxX) : (inside > 0 ? c.minZ - line : line - c.maxZ);
        const overlap = Math.min(a1, alongZ ? c.maxZ : c.maxX) - Math.max(a0, alongZ ? c.minZ : c.minX);
        if (near > -0.05 && near < 0.3 && overlap > 0.2 && c.maxY - S.y > sill + 0.25) warn('window-blocked', `${where} 被 "${c.id}" 挡住了（它比窗台高）`);
      }
    }
    for (const l of part.lamps || []) {
      if (!roomAt(S, l.x, l.z)) err('lamp-room', `${tag}灯 ${at(l)} 不在任何房间里`);
      else if (!S.furnitureBoxes.every(c => c.maxY - S.y < 2.0 || l.x < c.minX - 0.3 || l.x > c.maxX + 0.3 || l.z < c.minZ - 0.3 || l.z > c.maxZ + 0.3)) warn('lamp-furniture', `${tag}灯 ${at(l)} 撞到了下面的高家具`);
    }
    for (const p of part.pictures || []) {
      const h = p.h ?? 0.45, where = `${tag}画 ${at(p)}`;
      if (!(p.y - h / 2 > 1.0 && p.y + h / 2 < def.height - 0.3)) warn('picture-height', `${where} 挂得太低或太高`);
      const half = (p.w ?? 0.6) / 2 + 0.1, alongX = p.normal[0] === 0;
      for (const w of part.walls || []) for (const [a, b] of w.doors || []) {
        const alongZ = typeof w.x === 'number', line = alongZ ? w.x : w.z;
        if (alongZ === alongX || Math.abs((alongZ ? p.x : p.z) - line) > 0.3) continue;
        const u = alongZ ? p.z : p.x;
        if (!(u + half < a || u - half > b)) warn('picture-door', `${where} 挂在了门洞上`);
      }
      // 画的正面要朝着空屋子，背面要贴着墙
      const front = { x: p.x + p.normal[0] * 0.05, z: p.z + p.normal[1] * 0.05 }, inWall = q => S.walls.some(w => w.kind === 'wall' && q.x > w.minX && q.x < w.maxX && q.z > w.minZ && q.z < w.maxZ);
      if (inWall(front)) warn('picture-facing', `${where} 的 normal [${p.normal}] 指向墙里：画被埋在墙中间，看不见。normal 要指向它所在的房间`);
    }
  });

  // ---- 7. 玩法准则（docs/fun-design.md）
  const types = new Set(L.enemies.map(e => e.type)), guns = new Set([...(def.arsenal || ['single', 'scatter', 'heavy']), ...L.pickups.filter(k => k.kind === 'weapon').map(k => k.weapon)]);
  for (const t of types) {
    const z = ZOMBIES[t];
    if (z?.answer && !guns.has(z.answer)) warn('no-answer', `图里有${z.name}，但没有${WEAPONS.find(w => w.id === z.answer).name}："打不动"要成对出现（fun-design 3.6）。在它第一次出现的房间之前放一把（pickups 里写 '${z.answer}'）`);
  }
  if (!L.enemies.length) err('empty', '图里没有僵尸');
  if (L.enemies.length && !L.pickups.some(k => k.kind === 'heart')) warn('no-heart', '图里没有心：玩家只有 3 颗心，一张图至少放 2 颗');
  if (def.mission.type === 'fetch') {
    if (!L.pickups.some(k => k.kind === 'objective')) err('no-objective', '找东西的任务，但图里没有任务物品（pickups 里写 { objective: "名字" }）');
    const X = def.mission.exit;
    if (!X || !freePoint(L, (X.minX + X.maxX) / 2, (X.minZ + X.maxZ) / 2, CONFIG.playerRadius)) err('exit', '任务的 exit（把东西送到哪）没写，或者它的中心压在墙、家具上');
  }
  if (!multi) {
    const seenTypes = new Set();
    for (const { room, far } of roomOrder(L)) {
      const here = L.enemies.filter(e => roomAt(L, e.x, e.z) === room), kinds = [...new Set(here.map(e => e.type))];
      if (far === Infinity) { err('room-cut-off', `${room.name} 从出生点走不到`); continue; }
      const fresh = kinds.filter(t => ZOMBIES[t]?.special && !seenTypes.has(t));
      if (fresh.length > 1) warn('teach-one', `${room.name} 同时第一次出现 ${fresh.map(t => ZOMBIES[t].name).join('、')}：一次只教一种（fun-design 2.4）。把其中一种挪到更早或更晚的房间`);
      const hard = kinds.filter(t => ZOMBIES[t]?.special);
      if (hard.length > 2) warn('too-many-kinds', `${room.name} 里有 ${hard.length} 种特殊僵尸（${hard.map(t => ZOMBIES[t].name).join('、')}）：同一处最多两种，再多就看不过来了`);
      kinds.forEach(t => seenTypes.add(t));
    }
  }

  // ---- 8. 真的跑一遍：开局安全、任务结得了、惊动之后都找得到玩家
  const facts = { zombies: L.enemies.length, rooms: L.rooms.filter(r => !r.tower).length + (def.upper || []).reduce((n, u) => n + u.rooms.length, 0), storeys: L.storeys.length, par: def.par };
  if (play && !errors.length) {
    const run = (s, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds * 60); i++) step(s, 1 / 60, input); };
    let s = createGame({ level: L });
    run(s, 60);
    const roused = s.enemies.filter(e => e.awareness !== 'asleep' && e.awareness !== 'idle');
    if (s.health < CONFIG.maxHealth || roused.length) err('unsafe-start', `开局不安全：在出生点站一分钟，${roused.slice(0, 3).map(e => `${ENEMY_TYPES[e.type].name} ${at(e)}`).join('、')}${roused.length > 3 ? ' 等' : ''}发现了玩家。醒着的僵尸 8 米内、正前方 ±70° 看得见出生点就会发现；把它挪到看不见的地方、改成 asleep，或者在出生点前面放一件 1.3 米以上的东西`);
    if (def.mission.type === 'clear') {
      s = createGame({ level: L }); s.health = 1e9;
      for (const e of s.enemies.slice(1)) e.alive = false;
      run(s, 1);
      if (s.phase !== 'playing') err('mission-early', '还剩一只僵尸，任务就结束了');
      s.enemies[0].alive = false; run(s, CONFIG.endDelay + 0.5);
      if (s.phase !== 'won') err('mission-stuck', '僵尸都倒了，任务却没结束');
    } else if (missionStatus(createGame({ level: L })).needed < 1) err('mission-stuck', '找东西的任务没有可找的东西');
    if (!multi) {   // 多层的图（家）在 rongboy-mission.mjs 里有自己的检查
      s = createGame({ level: L }); s.health = 1e9;
      for (const e of s.enemies) e.awareness = 'alert';
      run(s, 75);
      const hold = e => (e.type === 'archer' || e.type === 'bomber' ? ATTACKS[e.type].range : 6);
      const lost = s.enemies.filter(e => Math.hypot(e.x - s.player.x, e.z - s.player.z) > hold(e) && !lineOfSight(L, { x: e.x, y: 1.2, z: e.z }, { x: s.player.x, y: 1.2, z: s.player.z }));
      if (lost.length) err('lost', `全部惊动后过了 75 秒，${lost.slice(0, 3).map(e => `${ENEMY_TYPES[e.type].name} ${at(e)}`).join('、')} 还没找到出生点的玩家：多半卡在了家具之间。看看那附近有没有它过不去的窄缝`);
      for (const e of s.enemies) if (!(freePoint(L, e.x, e.z, e.radius - 0.02) && Number.isFinite(e.x + e.z + e.y))) { err('stuck-in-solid', `${ENEMY_TYPES[e.type].name} 追着追着卡进了 ${at(e)} 的墙或家具里`); break; }
    }
  }
  return { errors, warnings, facts, notes: def.notes || [] };
}
