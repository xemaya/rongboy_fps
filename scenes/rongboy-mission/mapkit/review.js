// 地图的体检报告：检查（check.js）只回答"能不能合入"，这里回答"哪里还能改得更好"。
// 给出一组数（环路、掩体、远程僵尸看得到多大一片、补给、两个机器人的战绩）和一串带坐标的建议，
// 改一版、再跑一次、看数怎么变。每个数对应 docs/map-guide.md 第 1 节的一条准则。只支持单层的图。不依赖 DOM。
import { compileLevel, freePoint, lineOfSight, roomAt } from '../level.js';
import { CONFIG, ENEMY_TYPES, WEAPONS } from '../game.js';
import { ATTACKS } from '../attacks.js';
import { ZOMBIES, coverOf } from './catalog.js';
import { roomOrder } from './check.js';
import { playBot } from './bots.js';
import { GADGETS } from '../gadgets.js';

const f1 = n => Math.round(n * 10) / 10;
const at = p => `(${f1(p.x)}, ${f1(p.z)})`;
const tally = list => Object.entries(list.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {}));
const ESCAPE = 3.5;   // 弓手拉弓 1.15 秒，玩家每秒 3.15 米：看到它举弓再跑，3.5 米内有东西挡才来得及

export function reviewMap(def, { bots = true } = {}) {
  const L = def.storeys ? def : compileLevel(def);
  if (L.storeys.length > 1) return { id: L.id, name: L.name, unsupported: '多层的图（家）暂时只能跑 check，体检报告只支持单层' };
  const S = L.storeys[0], B = L.bounds, rooms = S.rooms.filter(r => !r.tower), inRoom = (p, r) => roomAt(L, p.x, p.z) === r;
  const eye = p => ({ x: p.x, y: 1.2, z: p.z }), dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // 玩家站得下的地方，半米一格
  const cells = [];
  for (let x = B.minX + 0.25; x < B.maxX; x += 0.5) for (let z = B.minZ + 0.25; z < B.maxZ; z += 0.5) if (freePoint(L, x, z, CONFIG.playerRadius)) cells.push({ x, z, room: roomAt(L, x, z) });
  const walkable = cells.length * 0.25;

  // ---- 房间，按从出生点走进去的先后
  const seen = new Set(), order = roomOrder(L);
  const table = order.map(({ room, far }) => {
    const zs = L.enemies.filter(e => inRoom(e, room)), boxes = S.furnitureBoxes.filter(c => inRoom(c, room)), area = (room.maxX - room.minX) * (room.maxZ - room.minZ);
    const kinds = [...new Set(zs.map(e => e.type))], fresh = kinds.filter(t => !seen.has(t)); kinds.forEach(t => seen.add(t));
    return { id: room.id, name: room.name, outdoor: !!room.outdoor, far: f1(far), area: f1(area), free: Math.round(cells.filter(c => c.room === room).length * 0.25 / area * 100),
      tall: boxes.filter(c => coverOf(c.maxY) === 'tall').length, low: boxes.filter(c => coverOf(c.maxY) === 'low').length,
      zombies: zs.length, kinds: tally(zs.map(e => ZOMBIES[e.type].name)).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)), fresh: fresh.map(t => ZOMBIES[t].name),
      pickups: L.pickups.filter(k => inRoom(k, room)).map(k => (k.kind === 'heart' ? '心' : k.kind === 'objective' ? k.name : k.kind === 'weapon' ? WEAPONS.find(w => w.id === k.weapon).short : k.weapon === 'yarn' ? '毛线团' : '弹药包')) };
  });

  // ---- 动线：每扇门连着哪两间；有没有环
  const links = [];
  for (const w of def.walls || []) for (const [a, b] of w.doors || []) {
    const alongZ = typeof w.x === 'number', mid = (a + b) / 2, line = alongZ ? w.x : w.z;
    const p = roomAt(L, alongZ ? line - 0.6 : mid, alongZ ? mid : line - 0.6), q = roomAt(L, alongZ ? line + 0.6 : mid, alongZ ? mid : line + 0.6);
    if (p && q && p !== q) links.push([p, q]);
  }
  const neighbours = r => new Set(links.filter(l => l.includes(r)).map(l => (l[0] === r ? l[1] : l[0])));
  const pairs = new Set(links.map(l => l.map(r => r.id).sort().join('|')));
  // 环：一个房间的两扇门（哪怕通向同一间）也算一个环，能从一扇出去、另一扇绕回来
  const flow = { doors: links.length, loops: Math.max(0, links.length - rooms.length + 1), pairs: pairs.size, spurs: rooms.filter(r => neighbours(r).size === 1).map(r => r.name) };

  // ---- 远程僵尸：射程里它看得到多大一片；那一片里离"它看不到的地方"最远的一点有多远
  const ranged = L.enemies.filter(e => ZOMBIES[e.type]?.ranged).map(e => {
    // 贴着它的地方不算（离它 4 米以内是近身，不是远程的问题）
    const reach = ATTACKS[e.type].range, near = cells.filter(c => dist(c, e) <= reach && dist(c, e) >= 4), open = near.filter(c => lineOfSight(L, eye(e), eye(c))), hidden = cells.filter(c => !open.includes(c));
    let worst = null;
    for (const c of open) { const d = Math.min(Infinity, ...hidden.map(h => dist(h, c))); if (!worst || d > worst.d) worst = { x: c.x, z: c.z, d }; }
    return { type: e.type, name: ZOMBIES[e.type].name, x: e.x, z: e.z, room: roomAt(L, e.x, e.z)?.name, sees: f1(open.length * 0.25), escape: worst ? f1(worst.d) : 0, worst: worst && { x: f1(worst.x), z: f1(worst.z) },
      far: open.length ? Math.round(open.filter(c => Math.min(Infinity, ...hidden.map(h => dist(h, c))) > ESCAPE).length / open.length * 100) : 0 };
  });

  // ---- 机关：用不用得上（范围里站着几只、冲向出生点的路上会经过几只）、打不打得到（3–12 米外有没有看得见它的地方）
  const nearLine = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
  const gadgets = L.gadgets.map(g => {
    const G = GADGETS[g.kind], top = { x: g.x, y: G.lightY ?? G.h + 0.35, z: g.z };
    const inside = L.enemies.filter(e => {
      if (g.kind === 'quilt') return Math.abs(g.x-e.x) <= G.w/2 && Math.abs(g.z-e.z) <= G.depth/2;
      return dist(e, g) <= G.radius && (g.kind === 'clock' && dist(e, g) < G.radius * 0.5 ||
        lineOfSight(L, top, { x: e.x, y: g.kind === 'clock' ? 0 : 1.0, z: e.z }, 1.2, g.id));
    });
    const passing = g.kind === 'clock' ? [] : L.enemies.filter(e => !inside.includes(e) && nearLine(g, e, L.player) < G.radius * 0.75);
    const reach = cells.some(c => dist(c, g) >= 3 && dist(c, g) <= 12 && lineOfSight(L, { x: c.x, y: 1.05, z: c.z }, top, 1.2, g.id));
    return { kind: g.kind, name: G.name, x: g.x, z: g.z, room: roomAt(L, g.x, g.z)?.name, inside: inside.length, passing: passing.length, reach };
  });
  const stashes = L.pickups.filter(k => k.stash).length;

  // ---- 最长的一条直线视野（一米一格粗量）
  const coarse = cells.filter(c => Math.abs((c.x - B.minX) % 1 - 0.25) < 0.01 && Math.abs((c.z - B.minZ) % 1 - 0.25) < 0.01);
  let sight = { d: 0 };
  for (let i = 0; i < coarse.length; i++) for (let j = i + 1; j < coarse.length; j++) {
    const d = dist(coarse[i], coarse[j]);
    if (coarse[i].room?.outdoor && coarse[j].room?.outdoor) continue;   // 院子本来就开阔，只量至少一头在屋里的
    if (d > sight.d && lineOfSight(L, eye(coarse[i]), eye(coarse[j]))) sight = { d, from: coarse[i], to: coarse[j] };
  }

  const states = { asleep: L.enemies.filter(e => e.state === 'asleep').length, patrol: L.enemies.filter(e => e.state !== 'asleep' && e.patrol).length };
  states.idle = L.enemies.length - states.asleep - states.patrol;
  const firstLook = L.enemies.filter(e => dist(e, L.player) < 14 && lineOfSight(L, eye(e), eye(L.player)));
  const supplies = { stashes, hearts: L.pickups.filter(k => k.kind === 'heart').length, ammo: L.pickups.filter(k => k.kind === 'ammo' && !k.weapon).length, yarn: L.pickups.filter(k => k.weapon === 'yarn').length,
    guns: L.pickups.filter(k => k.kind === 'weapon').map(k => WEAPONS.find(w => w.id === k.weapon).short) };
  const facts = { size: `${f1(B.maxX - B.minX)} × ${f1(B.maxZ - B.minZ)} 米`, walkable: f1(walkable), rooms: rooms.length, zombies: L.enemies.length, density: f1(L.enemies.length / walkable * 100),
    kinds: tally(L.enemies.map(e => ZOMBIES[e.type].name)).map(([k, n]) => `${k}×${n}`), states, par: L.par, sight: f1(sight.d), firstLook: firstLook.length, nearest: f1(Math.min(Infinity, ...L.enemies.map(e => dist(e, L.player)))) };
  // 机器人对起点很敏感（差半步，后面遇到僵尸的先后就不一样），所以每个各跑三遍：原地、往左右各挪 0.4 米。
  // lazy / keen 是原地那一遍（报告里列它的细节），runs 是三遍的结果。
  const three = attentive => [0, 0.4, -0.4].map(shift => playBot(L, { attentive, shift }));
  const played = bots ? (() => { const lazy = three(false), keen = three(true); return { lazy: lazy[0], keen: keen[0], runs: { lazy, keen } }; })() : null;

  // ---- 建议。problem：照准则看是个问题；idea：可以考虑
  const tips = [], problem = text => tips.push({ level: 'problem', text }), idea = text => tips.push({ level: 'idea', text });
  if (rooms.length > 2 && flow.loops === 0) problem('房间连成了一条线（或一棵树），没有环：被追的时候只能原路退回，也没法绕到僵尸背后。加一扇门，让其中三间能绕一圈（准则 1.3）');
  for (const r of ranged) {
    if (r.sees < 6) idea(`${r.room}的${r.name} ${at(r)} 射程里只看得到 ${r.sees} 平米：几乎打不着人，等于没放。挪到看得远的位置（长边的尽头、门的正对面）`);
    else if (r.far >= 3) (r.far >= 10 ? problem : idea)(`${r.room}的${r.name} ${at(r)} 看得到 ${r.sees} 平米，其中 ${r.far}% 的地方离最近的掩体超过 ${ESCAPE} 米，最远的是 ${at(r.worst)}（${r.escape} 米）：看到它出手再跑来不及。在 ${at({ x: (r.x + r.worst.x) / 2, z: (r.z + r.worst.z) / 2 })} 附近（它和那一点之间）加一件 1.3 米以上的家具（准则 2.2）`);
  }
  for (const g of gadgets) {
    if (g.inside + g.passing === 0) problem(`${g.room}的${g.name} ${at(g)} 用不上：它的范围（${GADGETS[g.kind].radius} 米）里没有僵尸，也没有僵尸冲向出生点时会经过。挪到僵尸旁边，或者挪到它们追过来的路上（准则 3.8）`);
    if (!g.reach) problem(`${g.room}的${g.name} ${at(g)} 打不到：3–12 米外没有一个看得见它的站位。别让高家具把它围住（准则 3.8）`);
  }
  if (L.enemies.length >= 8 && !gadgets.length) idea('这张图没有机关：每张图配一种（家是闹钟、学校是颜料桶、博物馆是聚光灯、奶奶家是晒被绳），放在僵尸会经过的地方（准则 3.7）');
  for (const r of table) {
    if (r.zombies >= 3 && r.tall + r.low === 0) problem(`${r.name}里有 ${r.zombies} 只僵尸，却没有一件能挡身体的家具：只能在空地上硬拼。加一两件（准则 2.1）`);
    if (!r.outdoor && r.free < 35) problem(`${r.name}只有 ${r.free}% 的地面走得了人（现有的图里最挤的教室是 37%）：太挤，僵尸和玩家都会卡。拿掉一两件家具，或者把房间画大（准则 2.1）`);
    if (r.far > 0 && r.zombies === 0 && !r.pickups.length) idea(`${r.name}里既没有僵尸也没有东西：玩家没有理由进去。放一个补给，或者一只睡着的`);
    const hard = r.fresh.filter(n => Object.values(ZOMBIES).find(z => z.name === n)?.special);
    if (hard.length && r.zombies > 3) idea(`${r.name}第一次出现${hard.join('、')}，同时屋里一共有 ${r.zombies} 只：新种类第一次出场最好单独一点，给玩家看清它那一招的空间（准则 3.1）`);
  }
  if (table[0]?.zombies > 3 && table[0].zombies / L.enemies.length > 0.25) idea(`出生的${table[0].name}里就有 ${table[0].zombies} 只：开局最好留一口气，把最密的一间放到靠里的位置（准则 3.5）`);
  if (L.enemies.length >= 6) {
    if (states.asleep / L.enemies.length > 0.7) idea(`${states.asleep}/${L.enemies.length} 只都睡着：一路偷袭过去就完了。让一部分醒着站岗或巡逻（准则 3.3）`);
    if (states.asleep / L.enemies.length < 0.2) idea(`只有 ${states.asleep}/${L.enemies.length} 只睡着：几乎没有偷袭的机会。让一部分睡着（准则 3.3）`);
  }
  if (facts.density > 8) problem(`每 100 平米可走的地面上有 ${facts.density} 只僵尸，学校是 6.3 只：太密。减少僵尸或者把图画大（准则 3.4）`);
  if (facts.density < 3) idea(`每 100 平米可走的地面上只有 ${facts.density} 只僵尸，学校是 6.3 只：会有很长的空路（准则 3.4）`);
  if (supplies.hearts < 2) idea(`只有 ${supplies.hearts} 颗心：玩家一共 3 颗，一张图放 2 颗左右（准则 3.6）`);
  if (supplies.ammo < Math.ceil(L.enemies.length / 8)) idea(`只有 ${supplies.ammo} 个弹药包：大约每 8 只僵尸配 1 个，不然特殊枪用两下就只能回到手枪（准则 3.6）`);
  if (!supplies.guns.length) idea('地上一把枪都没有：玩家手里只有手枪和霰弹，没有"换哪把"的选择（准则 3.6）');
  if (played) {
    const { lazy, keen } = played, where = hits => tally(hits.map(h => `${h.room}的${ZOMBIES[h.by]?.name ?? h.by}`)).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n} 下`).join('，');
    const easy = played.runs.lazy.filter(b => b.won && b.hurt <= 1).length, stuck = played.runs.keen.filter(b => b.phase === 'lost').length;   // 只算真的倒下的；机器人自己绕不出来（stalled）不算这张图的问题
    const bad = played.runs.keen.find(b => b.phase === 'lost');
    if (stuck >= 2) problem(`留神的机器人三遍里有 ${stuck} 遍没打完（其中一遍：倒下了，还剩 ${bad.left} 只${bad.leftWhere.length ? '：' + bad.leftWhere.slice(0, 4).map(l => `${l.room}的${l.name}`).join('、') : ''}）${bad.hits.length ? '；挨打在：' + where(bad.hits) : ''}。会看预告的人都过不去，说明这里是硬卡：减少那一处的僵尸，或者加掩体（准则 4）`);
    else if (keen.hurt >= 2) idea(`留神的机器人挨了 ${keen.hurt} 下（${where(keen.hits)}）：这几处对会看预告的人也偏难`);
    if (easy >= 2) problem(`偷懒的机器人（只会后退加手枪）三遍里有 ${easy} 遍几乎无伤打完：这张图可以无脑打。加弓手、炸弹客或持盾者，或者把它们放到绕不开的位置（准则 4）`);
  }
  const marks = played ? [...played.lazy.hits.map(h => ({ ...h, token: '*l', label: '偷懒 ' + (ZOMBIES[h.by]?.name ?? '') })), ...played.keen.hits.map(h => ({ ...h, token: '*k', label: '留神 ' + (ZOMBIES[h.by]?.name ?? '') }))] : [];
  return { id: L.id, name: L.name, facts, rooms: table, flow, ranged, gadgets, supplies, bots: played, tips, marks };
}

// 报告印成文字。previous：上一次的报告（同一张图），有的话在后面标出变化。
export function formatReview(r, previous = null) {
  if (r.unsupported) return r.unsupported;
  const out = [], F = r.facts, P = previous?.facts;
  const delta = (now, before) => (before == null || before === now ? '' : `（上次 ${before}）`);
  out.push(`${r.name}（${r.id}）  ${F.size} · 可走 ${F.walkable} 平米 · ${F.rooms} 间 · 标准时间 ${F.par} 秒`);
  out.push(`僵尸 ${F.zombies} 只${delta(F.zombies, P?.zombies)}：${F.kinds.join(' ')} · 睡着 ${F.states.asleep} / 站岗 ${F.states.idle} / 巡逻 ${F.states.patrol} · 每 100 平米 ${F.density} 只${delta(F.density, P?.density)}`);
  out.push(`补给：心 ${r.supplies.hearts} · 弹药包 ${r.supplies.ammo} · 毛线团 ${r.supplies.yarn} · 枪 ${r.supplies.guns.join('、') || '无'}${r.supplies.stashes ? ` · 其中 ${r.supplies.stashes} 样藏在拉链暗格里` : ''}`);
  out.push(`动线：${r.flow.doors} 扇门 · ${r.flow.loops} 个环${delta(r.flow.loops, previous?.flow.loops)} · 屋里最长的直线视野 ${F.sight} 米${delta(F.sight, P?.sight)} · 出生点第一眼看得到 ${F.firstLook} 只，最近的一只在 ${F.nearest} 米外`);
  out.push('', '房间（按从出生点走进去的先后；"可走"扣掉了墙边和家具边站不下人的一圈，空房间也只有六成左右）');
  out.push('  路程  房间          面积  可走  高/矮掩体  僵尸                          新出现        拾取');
  const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 255 ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
  for (const t of r.rooms) out.push(`  ${pad(t.far + 'm', 6)}${pad(t.name, 14)}${pad(t.area, 6)}${pad(t.free + '%', 6)}${pad(`${t.tall} / ${t.low}`, 11)}${pad(t.kinds.join(' ') || '—', 30)}${pad(t.fresh.join('、') || '—', 14)}${t.pickups.join('、') || '—'}`);
  if (r.ranged.length) {
    out.push('', `远程僵尸（看得到的地方，${ESCAPE} 米内要有东西能躲）`);
    r.ranged.forEach((g, i) => { const b = previous?.ranged[i]; out.push(`  ${pad(g.room + '的' + g.name, 18)}${pad(at(g), 14)}看得到 ${pad(g.sees + ' 平米', 10)}离掩体最远 ${g.escape} 米${delta(g.escape, b?.escape)}${g.worst ? ' @ ' + at(g.worst) : ''} · 超过 ${ESCAPE} 米的占 ${g.far}%`); });
  }
  if (r.gadgets?.length) {
    out.push('', '机关（打一下触发，只能用一次；机器人不会用它们）');
    for (const g of r.gadgets) out.push(`  ${pad(g.room + '的' + g.name, 18)}${pad(at(g), 14)}范围里站着 ${g.inside} 只${g.kind === 'clock' ? '' : ` · 追过来的路上经过 ${g.passing} 只`} · ${g.reach ? '打得到' : '打不到'}`);
  }
  if (r.bots) {
    out.push('', '机器人（都只用手枪，瞄得比人准；时间只用来比前后两版，不能当成人的通关时间。每个跑三遍：原地出发、往左右各挪 0.4 米）');
    for (const [key, label] of [['lazy', '偷懒的'], ['keen', '留神的']]) {
      const b = r.bots[key], before = previous?.bots?.[key];
      const runs = r.bots.runs?.[key] || [b], won = runs.filter(q => q.won).length, wonBefore = previous?.bots?.runs?.[key]?.filter(q => q.won).length;
      out.push(`  ${label}：${runs.length} 遍里打完 ${won} 遍${delta(won, wonBefore)} · 各挨 ${runs.map(q => q.hurt).join(' / ')} 下 · 各用 ${runs.map(q => q.time).join(' / ')} 秒`);
      out.push(`      原地那一遍：${b.won ? '打完了' : b.phase === 'lost' ? `倒下了，还剩 ${b.left} 只` : `机器人自己绕不出来了，还剩 ${b.left} 只（不算这张图的问题）`}${b.hits.length ? ' · 挨打在 ' + b.hits.map(h => `${h.t}秒 ${h.room} ${ZOMBIES[h.by]?.name ?? h.by}`).join('，') : ''}`);
    }
  }
  const problems = r.tips.filter(t => t.level === 'problem'), ideas = r.tips.filter(t => t.level === 'idea');
  out.push('', `问题 ${problems.length} 条${delta(problems.length, previous?.tips.filter(t => t.level === 'problem').length)}`);
  problems.forEach((t, i) => out.push(`  ${i + 1}. ${t.text}`));
  out.push(`可以考虑 ${ideas.length} 条`);
  ideas.forEach((t, i) => out.push(`  ${i + 1}. ${t.text}`));
  return out.join('\n');
}
