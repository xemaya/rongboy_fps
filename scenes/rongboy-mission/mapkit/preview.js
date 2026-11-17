// 地图的俯视图：字符画（终端里直接看，agent 也能读）和 SVG（给人看）。只读编译好的关卡，不依赖 DOM。
import { compileLevel, roomAt } from '../level.js';
import { ENEMY_TYPES, WEAPONS } from '../game.js';
import { coverOf } from './catalog.js';

const LETTER = { walker: 'W', leaper: 'L', heavy: 'H', shielded: 'S', archer: 'A', bomber: 'B', crawler: 'C', 'boss-warden': 'K', 'boss-leech': 'K' };
const GUN = { scatter: 'Gc', heavy: 'Gh', stun: 'Gt', sewing: 'Gw', needle: 'Gn' };
const tokenOf = k => (k.kind === 'heart' ? '<3' : k.kind === 'objective' ? '!!' : k.kind === 'weapon' ? GUN[k.weapon] ?? 'G?' : k.weapon === 'yarn' ? 'ya' : 'am');
export const LEGEND = [
  '## 墙（门洞是墙上的缺口）   XX 高家具（≥1.3 米，挡视线挡箭）   oo 矮家具（挡身体，能越过去开枪）   :: 很矮（不算掩体）',
  '空白 室内地面    . 室外地面    @@ 出生点（面朝北 = 朝上）',
  '僵尸：W 跳跳  L 跃行者  H 棉甲  S 持盾者  A 弓手  B 炸弹客  C 爬行者  K 首领；后面的 z = 睡着，~ = 巡逻，空 = 醒着站着',
  '拾取：<3 心  am 弹药包  ya 毛线团  Gc 霰弹  Gh 棉被炮  Gt 静电枪  Gw 缝纫机枪  Gn 毛衣针  !! 任务物品',
];

// 一格 0.5 米，一格印两个字符（终端里的字符高是宽的两倍，这样比例是对的）。上北下南，左西右东。
// marks：额外标在图上的点 [{ x, z, token, floor }]（比如机器人挨打的位置）。
export function asciiMap(def, { marks = [], cell = 0.5 } = {}) {
  const L = def.storeys ? def : compileLevel(def), out = [];
  L.storeys.forEach((S, floor) => {
    // 格子的中心落在半米的整数倍上（墙线通常也在这上面），所以一道墙正好占一格
    const B = S.bounds, cols = Math.round((B.maxX - B.minX) / cell) + 1, rows = Math.round((B.maxZ - B.minZ) / cell) + 1, H = L.house, T = L.stairs;
    const facade = S.walls.some(c => !c.alongZ && Math.abs(c.z - H.maxZ) < 0.01);
    const grid = Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => {
      const x = B.minX + i * cell, z = B.minZ + j * cell, inside = (c, pad = 0) => x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad;
      if (S.walls.some(c => c.kind === 'wall' && inside(c, Math.max(0, cell / 2 - Math.min(c.w, c.d) / 2) + 0.001))) return '##';
      // 房子的外墙不在碰撞盒里（身体由边界挡住）：沿房子的外沿画一圈
      if (Number.isFinite(H.minX) && x >= H.minX - 0.01 && x <= H.maxX + 0.01 && z >= H.minZ - 0.01 && z <= H.maxZ + 0.01) {
        const onX = Math.abs(x - H.minX) < 0.26 || Math.abs(x - H.maxX) < 0.26, onN = Math.abs(z - H.minZ) < 0.26, onS = Math.abs(z - H.maxZ) < 0.26;
        if (onX || (onN && !(T && x > T.minX && x < T.maxX)) || (onS && !facade)) return '##';
      }
      const f = S.furnitureBoxes.filter(c => inside(c, 0.05)).sort((a, b) => b.maxY - a.maxY)[0];
      if (f) return { tall: 'XX', low: 'oo', none: '::' }[coverOf(f.maxY - S.y)];
      const room = roomAt(S, x, z);
      return !room ? '  ' : room.outdoor ? ' .' : room.tower ? '//' : '  ';
    }));
    const put = (p, token) => { const i = Math.round((p.x - B.minX) / cell), j = Math.round((p.z - B.minZ) / cell); if (grid[j]?.[i] !== undefined) grid[j][i] = token; };
    for (const k of L.pickups.filter(k => k.floor === floor)) put(k, tokenOf(k));
    for (const e of L.enemies.filter(e => e.floor === floor)) put(e, (LETTER[e.type] ?? '?') + (e.state === 'asleep' ? 'z' : e.patrol ? '~' : ' '));
    if (floor === 0) put(L.player, '@@');
    for (const m of marks.filter(m => (m.floor ?? 0) === floor)) put(m, m.token);
    if (L.storeys.length > 1) out.push(`—— ${floor + 1} 层 ——`);
    // 上边的刻度：每 2 米标一次 x 坐标
    let ruler = '      ';
    for (let i = 0; i < cols; i += 4) ruler += String(Math.round((B.minX + i * cell) * 10) / 10).padEnd(8);
    out.push(ruler + ' ← x（米）');
    grid.forEach((row, j) => out.push((j % 2 ? '     ' : String(Math.round((B.minZ + j * cell) * 10) / 10).padStart(5)) + ' ' + row.join('')));
    out.push('      ↑ 左边是 z（米）');
    out.push('房间：' + S.rooms.filter(r => !r.tower).map(r => `${r.name} x ${r.minX}…${r.maxX}, z ${r.minZ}…${r.maxZ}`).join('；'));
  });
  return out.join('\n');
}

const hex = n => '#' + (n ?? 0xcccccc).toString(16).padStart(6, '0');
const TYPE_COLOR = { walker: '#7a9a5a', leaper: '#c9a227', heavy: '#6b7f9c', shielded: '#8b5fb0', archer: '#c0504d', bomber: '#d98a2b', crawler: '#5a8a8a', 'boss-warden': '#333', 'boss-leech': '#333' };

// 一层一张图，上下排开。marks 同上（token 会画成红叉旁边的小字）。
export function svgMap(def, { marks = [], scale = 34 } = {}) {
  const L = def.storeys ? def : compileLevel(def), pad = 40, parts = [];
  let top = 46, width = 0;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  L.storeys.forEach((S, floor) => {
    const B = S.bounds, W = (B.maxX - B.minX) * scale, H = (B.maxZ - B.minZ) * scale, X = x => pad + (x - B.minX) * scale, Z = z => top + (z - B.minZ) * scale;
    width = Math.max(width, W + pad * 2);
    const g = [];
    g.push(`<rect x="${pad}" y="${top}" width="${W}" height="${H}" fill="#ece7dc"/>`);
    for (const r of S.rooms) {
      g.push(`<rect x="${X(r.minX)}" y="${Z(r.minZ)}" width="${(r.maxX - r.minX) * scale}" height="${(r.maxZ - r.minZ) * scale}" fill="${r.tower ? '#d8d2c4' : hex(r.floor)}" fill-opacity="0.75"/>`);
      g.push(`<text x="${X(r.minX) + 8}" y="${Z(r.minZ) + 18}" font-size="13" fill="#3b3a36" font-weight="600">${esc(r.name)}</text>`);
    }
    for (let x = Math.ceil(B.minX); x <= B.maxX; x++) g.push(`<line x1="${X(x)}" y1="${top}" x2="${X(x)}" y2="${top + H}" stroke="#000" stroke-opacity="${x % 5 ? 0.05 : 0.14}"/>` + (x % 2 ? '' : `<text x="${X(x)}" y="${top - 5}" font-size="10" text-anchor="middle" fill="#777">${x}</text>`));
    for (let z = Math.ceil(B.minZ); z <= B.maxZ; z++) g.push(`<line x1="${pad}" y1="${Z(z)}" x2="${pad + W}" y2="${Z(z)}" stroke="#000" stroke-opacity="${z % 5 ? 0.05 : 0.14}"/>` + (z % 2 ? '' : `<text x="${pad - 6}" y="${Z(z) + 3}" font-size="10" text-anchor="end" fill="#777">${z}</text>`));
    for (const c of S.furnitureBoxes) {
      const cover = coverOf(c.maxY - S.y);
      g.push(`<rect x="${X(c.minX)}" y="${Z(c.minZ)}" width="${(c.maxX - c.minX) * scale}" height="${(c.maxZ - c.minZ) * scale}" rx="3" fill="${hex(c.color)}" fill-opacity="${cover === 'none' ? 0.45 : 0.9}" stroke="#4a4338" stroke-width="${cover === 'tall' ? 2.4 : 0.8}"${cover === 'none' ? ' stroke-dasharray="3 2"' : ''}><title>${esc(c.id)} · ${c.look ?? c.kind} · 高 ${c.maxY - S.y} 米</title></rect>`);
    }
    for (const c of S.walls) if (c.kind === 'wall') g.push(`<rect x="${X(c.minX)}" y="${Z(c.minZ)}" width="${(c.maxX - c.minX) * scale}" height="${(c.maxZ - c.minZ) * scale}" fill="#5b5346"/>`);
    g.push(`<rect x="${pad}" y="${top}" width="${W}" height="${H}" fill="none" stroke="#5b5346" stroke-width="3"/>`);
    for (const k of L.pickups.filter(k => k.floor === floor)) {
      const label = k.kind === 'heart' ? '♥' : k.kind === 'objective' ? '★' : k.kind === 'weapon' ? WEAPONS.find(w => w.id === k.weapon)?.short ?? k.weapon : k.weapon === 'yarn' ? '毛线团' : '弹药';
      const color = k.kind === 'heart' ? '#d9705f' : k.kind === 'objective' ? '#d9a21f' : k.kind === 'weapon' ? '#2f8fbf' : '#8a7a55';
      g.push(`<circle cx="${X(k.x)}" cy="${Z(k.z)}" r="6" fill="#fff" stroke="${color}" stroke-width="2"/><text x="${X(k.x) + 9}" y="${Z(k.z) + 4}" font-size="11" fill="${color}">${esc(k.name ?? label)}</text>`);
    }
    for (const e of L.enemies.filter(e => e.floor === floor)) {
      const T = ENEMY_TYPES[e.type], color = TYPE_COLOR[e.type] ?? '#555', r = T.radius * scale, h = e.heading ?? 0;
      if (e.patrol) g.push(`<polyline points="${[[e.x, e.z], ...e.patrol].map(([x, z]) => `${X(x)},${Z(z)}`).join(' ')}" fill="none" stroke="${color}" stroke-dasharray="5 4" stroke-width="1.5"/>`);
      g.push(`<circle cx="${X(e.x)}" cy="${Z(e.z)}" r="${r}" fill="${color}" fill-opacity="${e.state === 'asleep' ? 0.35 : 0.9}" stroke="${color}" stroke-width="1.5"><title>${T.name} · ${e.state}${e.patrol ? ' · 巡逻' : ''}</title></circle>`);
      g.push(`<line x1="${X(e.x)}" y1="${Z(e.z)}" x2="${X(e.x + Math.sin(h) * 0.6)}" y2="${Z(e.z + Math.cos(h) * 0.6)}" stroke="#222" stroke-width="1.5"/>`);
      g.push(`<text x="${X(e.x)}" y="${Z(e.z) - r - 3}" font-size="10" text-anchor="middle" fill="#222">${T.name}${e.state === 'asleep' ? ' z' : ''}</text>`);
    }
    if (floor === 0) { const p = L.player; g.push(`<polygon points="${X(p.x)},${Z(p.z) - 10} ${X(p.x) - 8},${Z(p.z) + 8} ${X(p.x) + 8},${Z(p.z) + 8}" fill="#1f6fd0" stroke="#fff" stroke-width="1.5"/><text x="${X(p.x) + 12}" y="${Z(p.z) + 5}" font-size="11" fill="#1f6fd0">出生点</text>`); }
    for (const m of marks.filter(m => (m.floor ?? 0) === floor)) g.push(`<path d="M${X(m.x) - 5},${Z(m.z) - 5} l10,10 m0,-10 l-10,10" stroke="#e02020" stroke-width="2.5"/>${m.label ? `<text x="${X(m.x) + 7}" y="${Z(m.z) - 6}" font-size="10" fill="#e02020">${esc(m.label)}</text>` : ''}`);
    if (L.storeys.length > 1) g.push(`<text x="${pad}" y="${top - 20}" font-size="14" fill="#333">${floor + 1} 层</text>`);
    parts.push(g.join('\n'));
    top += H + 60;
  });
  const legend = ['粗框 = 高家具（挡视线） · 细框 = 矮家具 · 虚框 = 很矮', '圆 = 僵尸（半透明是睡着的，短线是朝向，虚线是巡逻路线） · 圈 = 拾取物 · 蓝三角 = 出生点 · 红叉 = 机器人挨打的地方', '一格 1 米；上北下南'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${top + 30}" viewBox="0 0 ${width} ${top + 30}" font-family="-apple-system, 'PingFang SC', sans-serif">
<rect width="100%" height="100%" fill="#faf8f3"/>
<text x="${pad}" y="22" font-size="16" font-weight="700" fill="#222">${esc(L.name)}（${esc(L.id)}）</text>
${parts.join('\n')}
${legend.map((t, i) => `<text x="${pad}" y="${top - 30 + i * 16}" font-size="11" fill="#666">${esc(t)}</text>`).join('\n')}
</svg>`;
}
