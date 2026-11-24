// 随机出一份草图当初稿：切房间、开门（保证每间两个出口、有环）、按房间类型摆家具、按"一次只教一种"排僵尸、把对应的枪放在前一间。
// 同一个种子永远出同一份。出来的只是初稿：它保证通过硬性检查，不保证好看好玩，要接着改。不依赖 DOM。
import { buildMap, PlanError } from './build.js';
import { checkMap } from './check.js';
import { THEMES } from './catalog.js';

function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 每种主题的房间类型：[id, 名字, 贴墙的家具, 不贴墙的家具]。走廊（很窄的房间）单独处理。
const ROOMS = {
  home: [['living', '客厅', ['bookshelf@w', 'tv@n', 'sofa@s', 'cabinet@e'], ['coffee']], ['kitchen', '厨房', ['fridge@nw', 'counter@n', 'cabinet@e'], ['island']], ['bedroom', '卧室', ['bed@n', 'nightstand@n', 'wardrobe@e'], ['chest']],
    ['study', '书房', ['bookshelf@n', 'desk@w', 'cabinet@s'], ['crate']], ['dining', '餐厅', ['cabinet@n', 'console@e'], ['dining', 'dining']], ['store', '储物间', ['wardrobe@n', 'chest@w', 'basket@e'], ['crate']], ['bath', '浴室', ['tub@n', 'vanity@e'], []]],
  school: [['class', '教室', ['podium@w', 'bookshelf@n'], [{ look: 'desk-kid', rows: 2, cols: 2 }]], ['art', '美术教室', ['easel@n', 'easel@n', 'bookshelf@w'], ['palette']], ['lab', '科学教室', ['case-jars@w', 'skeleton@ne'], ['labbench', 'labbench']],
    ['library', '图书角', ['bookshelf@n', 'bookshelf@w', 'bookshelf@e'], ['ottoman']], ['music', '音乐教室', ['locker@n', 'podium@e'], ['ottoman', 'ottoman']], ['office', '办公室', ['locker@w', 'bookshelf@n'], ['labbench']]],
  museum: [['egypt', '埃及厅', ['sarcophagus@w', 'sarcophagus@w', 'case-jars@s'], ['sarcophagus-lying']], ['nature', '自然厅', ['skull-deer@e', 'skull-cat@e', 'case-eggs@n'], ['skull-mammoth']], ['gallery', '画廊', ['bust@w', 'vase@e'], ['ottoman']],
    ['vault', '珍宝馆', ['case-crowns@n', 'globe@e'], ['case-gem', 'case-gem']], ['shop', '纪念品店', ['bookshelf@w', 'bookshelf@s', 'reception@n'], ['dining']], ['cafe', '咖啡厅', ['counter@e', 'fridge@ne'], ['dining', 'dining']], ['armory', '兵器厅', ['armor@n', 'armor@n', 'case-shells@w'], ['pyramid']]],
};
const HALL = { home: ['hall', '门厅', ['console@n'], []], school: ['corridor', '走廊', ['locker@n'], []], museum: ['lobby', '门厅', ['reception@n', 'ottoman@s'], []] };
const YARD = { home: ['garden', '花园', [{ look: 'hedge', place: 'start', h: 1.7 }, 'shed@e', 'planter@w', 'tree', 'crate'], []], school: ['yard', '操场', ['blocks@start', 'slide', 'playhouse', 'swing', 'seesaw'], []] };

function layoutOf(rand, count, yardRows) {
  const cols = count <= 4 ? 12 : count <= 6 ? 14 : 16, rows = Math.max(6, Math.min(12, Math.round(count * 18 / cols)));
  let rects = [{ c0: 0, r0: 0, c1: cols, r1: rows }];
  while (rects.length < count) {
    rects.sort((a, b) => (b.c1 - b.c0) * (b.r1 - b.r0) - (a.c1 - a.c0) * (a.r1 - a.r0));
    const i = rects.findIndex(q => Math.max(q.c1 - q.c0, q.r1 - q.r0) >= 6);
    if (i < 0) break;
    const [q] = rects.splice(i, 1), w = q.c1 - q.c0, h = q.r1 - q.r0, alongC = w > h || (w === h && rand() < 0.5), len = alongC ? w : h;
    const cut = Math.max(3, Math.min(len - 3, Math.round(len * (0.4 + rand() * 0.2))));
    rects.push(alongC ? { ...q, c1: q.c0 + cut } : { ...q, r1: q.r0 + cut }, alongC ? { ...q, c0: q.c0 + cut } : { ...q, r0: q.r0 + cut });
  }
  rects.sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0);
  const grid = Array.from({ length: rows + yardRows }, () => Array(cols).fill('Y'));
  rects.forEach((q, n) => { q.key = String.fromCharCode(65 + n); for (let r = q.r0; r < q.r1; r++) for (let c = q.c0; c < q.c1; c++) grid[r][c] = q.key; });
  return { rects, rows, cols, layout: grid.map(row => row.join('')) };
}

// 一份草图（对象）。出不来能通过检查的就换下一个子种子，最多试 attempts 次。
export function draftPlan({ id, name, theme = 'school', seed = 1, rooms = 5, attempts = 16 } = {}) {
  if (!THEMES[theme]) throw new PlanError(`主题 "${theme}" 不存在（现有：${Object.keys(THEMES).join('、')}）`);
  rooms = Math.max(3, Math.min(9, rooms));
  let last = null;
  for (let n = 0; n < attempts; n++) {
    const plan = onePlan({ id, name, theme, rooms }, rng(seed * 7919 + n * 104729));
    for (let fix = 0; fix < 60; fix++) {
      try {
        const def = buildMap(plan), result = checkMap(def);
        if (!result.errors.length) return { plan, def, result, tries: n + 1 };
        last = result.errors[0].msg; break;
      } catch (e) {
        if (!(e instanceof PlanError)) throw e;
        last = e.message;
        // 放不下：把报错的那间屋里最后一件同类的东西拿掉再试
        const key = /（(\w)）/.exec(e.message)?.[1], spec = plan.rooms[key];
        // 机关、暗格放不下：这间不放了
        if (spec && /拉链暗格/.test(e.message) && spec.stash?.length) { spec.stash.pop(); continue; }
        if (spec && /放不下(闹钟|颜料桶|聚光灯)/.test(e.message) && spec.gadget) { delete spec.gadget; continue; }
        const list = !spec ? null : /僵尸/.test(e.message) ? spec.zombies : /拾取物/.test(e.message) ? spec.pickups : spec.props;
        if (!list?.length) break;
        list.pop();
      }
    }
  }
  throw new PlanError(`试了 ${attempts} 次都没出来能通过检查的草图（最后一次的问题：${last}）。换个 --seed，或者减少 --rooms`);
}

function onePlan({ id, name, theme, rooms: count }, rand) {
  const hasYard = !!YARD[theme], { rects, rows, cols, layout } = layoutOf(rand, count, hasYard ? 4 : 0);
  const pick = list => list[Math.floor(rand() * list.length)], shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 相邻：共用的边至少 2 格（3 米）才开得下门
  const shared = (a, b) => (a.c1 === b.c0 || b.c1 === a.c0 ? Math.min(a.r1, b.r1) - Math.max(a.r0, b.r0) : a.r1 === b.r0 || b.r1 === a.r0 ? Math.min(a.c1, b.c1) - Math.max(a.c0, b.c0) : 0);
  const next = a => rects.filter(b => b !== a && shared(a, b) >= 2);
  const front = rects.filter(q => q.r1 === rows), entry = front.slice().sort((a, b) => Math.abs((a.c0 + a.c1) / 2 - cols / 2) - Math.abs((b.c0 + b.c1) / 2 - cols / 2))[0];
  // 先连成一棵树，再给只有一个出口的房间补一扇门，最后随机再加一两扇
  const doors = [], count2 = q => doors.filter(d => d.includes(q.key)).length, linked = (a, b) => doors.some(d => d.includes(a.key) && d.includes(b.key));
  const depth = new Map([[entry, 1]]), queue = [entry];
  while (queue.length) { const a = queue.shift(); for (const b of shuffle(next(a))) if (!depth.has(b)) { depth.set(b, depth.get(a) + 1); doors.push([a.key, b.key]); queue.push(b); } }
  if (hasYard) { doors.push(['Y', entry.key]); const other = front.filter(q => q !== entry && q.c1 - q.c0 >= 3)[0]; doors.push(['Y', (other || entry).key]); }
  for (const a of rects) {
    if (count2(a) >= 2) continue;
    const b = shuffle(next(a)).find(q => !linked(a, q)) || next(a).sort((p, q) => shared(a, q) - shared(a, p))[0];
    if (b) doors.push([a.key, b.key]);
  }
  for (let i = 0; i < 2; i++) { const a = pick(rects), b = shuffle(next(a)).find(q => !linked(a, q)); if (b) doors.push([a.key, b.key]); }

  // 房间类型：入口那间是门厅 / 走廊，其余从主题的房间表里不重复地取
  const order = [...rects].sort((a, b) => depth.get(a) - depth.get(b)), pool = shuffle(ROOMS[theme]), spec = {};
  if (hasYard) { const [yid, yname, props] = YARD[theme]; spec.Y = { id: yid, name: yname, outdoor: true, props: [...props], zombies: ['walker:asleep', 'walker:patrol'], pickups: ['stun'] }; }
  order.forEach((q, n) => {
    const [rid, rname, wall, free] = q === entry ? HALL[theme] : pool[(n - 1) % pool.length], repeat = q !== entry && n - 1 >= pool.length ? Math.floor((n - 1) / pool.length) + 1 : 0;
    const small = Math.min(q.c1 - q.c0, q.r1 - q.r0) < 4;
    spec[q.key] = { id: rid + (repeat || ''), name: rname + (repeat ? ' ' + repeat : ''), props: [...wall, ...(small ? [] : free)], zombies: [], pickups: [] };
  });
  // 僵尸：总数按面积算（每 100 平米 4.5 只左右），越往里越多；特殊种类一间引入一种，第一次出场只放一只
  const total = Math.round((rows + (hasYard ? 4 : 0)) * cols * 2.25 / 100 * 4.5), specials = shuffle(['archer', 'heavy', 'bomber', 'shielded']), known = [];
  let budget = total - (hasYard ? 2 : 0);
  const inner = hasYard ? order : order.slice(1);
  if (!hasYard) { spec[entry.key].zombies.push('walker:asleep'); spec[entry.key].pickups.push('stun'); budget--; }
  const weight = inner.map((q, i) => (q.c1 - q.c0) * (q.r1 - q.r0) * (0.7 + 0.6 * i / Math.max(1, inner.length - 1))), sum = weight.reduce((a, b) => a + b, 0);
  inner.forEach((q, i) => {
    const z = spec[q.key].zombies, n = Math.max(1, Math.round(budget * weight[i] / sum));
    if (i > 0 && specials.length) { const t = specials.shift(); z.push(t); known.push(t); spec[q.key].fresh = t; }
    else if (known.length && n >= 3) z.push(pick(known));
    while (z.length < n) z.push(rand() < 0.6 ? 'walker' : 'leaper');
  });
  // 拾取物：新种类对应的枪放在它前一间；心放在靠里的两间；弹药包大约每 7 只一包；毛线团两个
  const gunFor = { shielded: 'heavy', heavy: 'needle', archer: 'sewing' };
  inner.forEach((q, i) => { const g = gunFor[spec[q.key].fresh]; if (g) spec[inner[Math.max(0, i - 1)].key].pickups.push(g); delete spec[q.key].fresh; });
  const deep = [...inner].reverse();
  [deep[0], deep[Math.min(2, deep.length - 1)]].forEach(q => spec[q.key].pickups.push('potion'));
  for (let i = 0; i < Math.ceil(total / 7); i++) spec[inner[(i * 2 + 1) % inner.length].key].pickups.push('ammo');
  spec[inner[Math.floor(inner.length / 2)].key].pickups.push('yarn'); (spec.Y || spec[entry.key]).pickups.push('yarn');
  // 机关：出生的那间一个（一进来就看得到），僵尸最多的两间各一个；暗格：最靠里的一间藏一颗心，中间的一间藏一个弹药包
  (spec.Y || spec[entry.key]).gadget = true;
  [...inner].filter(q => spec[q.key] !== (spec.Y || spec[entry.key])).sort((a, b) => spec[b.key].zombies.length - spec[a.key].zombies.length).slice(0, 2).forEach(q => { spec[q.key].gadget = true; });
  spec[deep[0].key].stash = ['potion']; if (inner.length > 2) spec[inner[Math.floor(inner.length / 2)].key].stash = ['ammo'];
  const keys = [...(hasYard ? ['Y'] : []), ...order.map(q => q.key)];
  return { id, name: name ?? `${THEMES[theme].name}（草图 ${id}）`, theme, cell: 1.5, layout, doors: doors.map(d => d.join('-')), rooms: Object.fromEntries(keys.map(k => [k, spec[k]])) };
}

// 草图印成一个地图文件的源码。
export function planSource(plan, { seed } = {}) {
  const q = v => (typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : typeof v === 'number' && Number.isInteger(v) && v > 0xffff ? '0x' + v.toString(16) : Array.isArray(v) ? `[${v.map(q).join(', ')}]`
    : v && typeof v === 'object' ? `{ ${Object.entries(v).map(([k, x]) => `${/^[A-Za-z_]\w*$/.test(k) ? k : q(k)}: ${q(x)}`).join(', ')} }` : String(v));
  const room = ([key, r]) => `    ${key}: { id: ${q(r.id)}, name: ${q(r.name)},${r.outdoor ? ' outdoor: true,' : ''}${r.gadget ? ' gadget: true,' : ''}${r.stash?.length ? ` stash: ${q(r.stash)},` : ''}\n      props: ${q(r.props || [])},\n      zombies: ${q(r.zombies || [])},\n      pickups: ${q(r.pickups || [])} },`;
  return `// ${plan.name}。用地图生成器出的初稿${seed != null ? `（种子 ${seed}）` : ''}：只保证通过硬性检查，要接着改。
// 改法见 docs/map-guide.md：改这份草图 → node scripts/map.mjs check ${plan.id} → review ${plan.id} → preview ${plan.id}。
// layout 一个字母一格（${plan.cell} 米），上北下南；doors 写哪两间连通；props / zombies / pickups 的写法见 map-guide 第 3 节。
// gadget: true 是在这间放一个机关（这张图用哪种看主题）；stash 是在这间的墙上开一个拉链暗格。
import { buildMap } from '../mapkit/build.js';

export default buildMap({
  id: ${q(plan.id)},
  name: ${q(plan.name)},
  theme: ${q(plan.theme)},
  cell: ${plan.cell},
  layout: [
${plan.layout.map(r => `    '${r}',`).join('\n')}
  ],
  doors: ${q(plan.doors)},
  rooms: {
${Object.entries(plan.rooms).map(room).join('\n')}
  },
});
`;
}
