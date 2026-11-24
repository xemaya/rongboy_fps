// 布偶游乐园的通用零件：针脚、扇贝边、穗子、栏杆、树、灌木、花、石头、灯柱、长椅、木马。
// 准则在 docs/park-design.md 第 5d 节（精细度）。约定：s 是主体（投影，一直画），d 是小装饰（不投影，走远了不画）。
// 这里只管"长什么样"，摆在哪由 park-tour-view.js 定。
import * as T from 'three';
import { mulberry32 } from '../../cine-engine/engine/noise.js';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';

const TAU = 2 * Math.PI;
export const RED = 0xb85652, CREAM = 0xf1ddb0, TEAL = 0x3b8590, GOLD = 0xe3af55, INK = 0x3e3640, CORAL = 0xd9776a, NAVY = 0x4a6a8f;
export const FOREST = 0x657b4d, MOSS = 0x94a163, PINE = 0x386951, PLUM = 0x6b5a76, PLUM_DARK = 0x4d4058;
export const THREAD = 0xf8efd8, WOOL_WHITE = 0xf3ead8, TIMBER = 0xb98a5c;
const PETALS = [0xf0c24f, 0xd9776a, 0xf6f1e4, 0xe58f8a, 0xf3d27a];

export function createParkKit(M) {
  const felt = c => M('felt', c), wool = c => M('terry', c), leaf = c => M('leaves', c), knit = c => M('knit', c), timber = c => M('boards', c);

  // ---------------------------------------------------------------- 针脚
  // 一针：从 a 到 b 的一小段方条（12 个三角形）
  function dash(kit, mat, a, b, t = 0.018) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return;
    kit.box(mat, L, t, t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { rz: Math.asin(dy / L), ry: Math.atan2(-dz, dx) });
  }
  // 一行针脚：沿折线 pts 等距地走。len 针长，gap 针距，t 线粗
  function stitch(kit, pts, { color = THREAD, len = 0.1, gap = 0.07, t = 0.018 } = {}) {
    const mat = felt(color), seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(L); total += L; }
    if (total < len) return;
    const n = Math.max(1, Math.round(total / (len + gap))), pitch = total / n, on = pitch * len / (len + gap);
    const at = s => { let i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; } const f = seg[i] ? Math.min(1, s / seg[i]) : 0, a = pts[i], b = pts[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
    for (let i = 0; i < n; i++) { const s0 = i * pitch + (pitch - on) / 2; dash(kit, mat, at(s0), at(s0 + on), t); }
  }
  const arc = (cx, y, cz, r, a0 = 0, a1 = TAU, n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / 0.12))) =>
    Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r]; });
  const ring = (kit, cx, y, cz, r, o) => stitch(kit, arc(cx, y, cz, r), o);   // 水平的一圈针脚

  // ---------------------------------------------------------------- 扇贝边、穗子、花饰
  // 一瓣扇贝：一片薄板，中点在 (mx, y, mz)，朝 yaw 方向；half 半宽，band 直边的高，drop 最低点离顶边多远；round 小于 1 更圆
  function lobe(kit, mat, mx, y, mz, yaw, half, band, drop, thick = 0.04, round = 1) {
    const outline = [[-half, 0]];
    for (let j = 0; j <= 8; j++) { const u = j / 8; outline.push([-half + 2 * half * u, -band - (drop - band) * Math.sin(Math.PI * u) ** round]); }
    outline.push([half, 0]);
    kit.extrude(mat, outline, thick, new T.Matrix4().makeRotationY(yaw).setPosition(mx, y, mz));
  }
  // 一圈扇贝边：顶边在 y，n 瓣。mats 给了就一瓣一个颜色轮着来；pipe 给了就沿下沿包一圈滚边。
  // 返回每个尖（两瓣相接的地方）：{ a, x, z, y }，用来挂穗子、钉花饰
  function valance(kit, mat, cx, y, cz, r, n, drop, { band = drop * 0.5, thick = 0.04, a0 = 0, mats = null, pipe = null, pipeKit = kit, pipeR = 0.028 } = {}) {
    const step = TAU / n, half = r * Math.sin(step / 2), R = r * Math.cos(step / 2), edge = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + 0.5) * step, mx = cx + Math.sin(a) * R, mz = cz + Math.cos(a) * R;
      lobe(kit, mats ? mats[i % mats.length] : mat, mx, y, mz, a, half, band, drop, thick);
      for (let j = 0; j < 8; j++) { const u = j / 8, lx = -half + 2 * half * u, ly = -band - (drop - band) * Math.sin(Math.PI * u); edge.push([mx + Math.cos(a) * lx + Math.sin(a) * thick * 0.5, y + ly, mz - Math.sin(a) * lx + Math.cos(a) * thick * 0.5]); }
    }
    if (pipe !== null) { edge.push(edge[0]); pipeKit.tube(wool(pipe), edge, pipeR, { seg: 5, straight: true, caps: false }); }
    return Array.from({ length: n }, (_, i) => { const a = a0 + i * step; return { a, x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, y: y - band }; });
  }
  // 一条直的扇贝边：从 a 到 b（[x, z]），朝 a→b 的左手边
  function valanceLine(kit, mat, a, b, y, n, drop, { band = drop * 0.5, thick = 0.04, mats = null, round = 0.6 } = {}) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; lobe(kit, mats ? mats[i % mats.length] : mat, a[0] + dx * f, y, a[1] + dz * f, yaw, L / n / 2, band, drop, thick, round); }
  }
  // 穗子：顶在 y，往下垂 0.4 * s
  function tassel(kit, color, x, y, z, s = 1) {
    kit.sphere(wool(color), 0.062 * s, x, y - 0.05 * s, z, { seg: 6, rings: 4 });
    kit.cyl(wool(color), 0.04 * s, 0.085 * s, 0.27 * s, x, y - 0.235 * s, z, { seg: 7 });
    kit.cyl(felt(THREAD), 0.05 * s, 0.05 * s, 0.025 * s, x, y - 0.115 * s, z, { seg: 7 });
  }
  // 花饰：一枚朝 a 方向（水平）的圆布扣，中间一颗小的
  function rosette(kit, color, x, y, z, a, r = 0.15, centre = THREAD) {
    kit.sphere(wool(color), r, x, y, z, { seg: 10, rings: 5, sz: 0.34, ry: a });
    kit.sphere(felt(centre), r * 0.42, x + Math.sin(a) * r * 0.3, y, z + Math.cos(a) * r * 0.3, { seg: 7, rings: 4, sz: 0.5, ry: a });
  }
  // 五角星：一片厚布，立着，正面朝 yaw
  function star(kit, color, r, x, y, z, yaw = 0, thick = 0.12) {
    const outline = Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.46 : r; return [Math.cos(a) * q, Math.sin(a) * q]; });
    kit.extrude(wool(color), outline, thick, new T.Matrix4().makeRotationY(yaw).setPosition(x, y, z));
  }

  // 伞顶：sectors 片毛毡，每片横着再分 3 格所以伞沿是圆的；每道缝一行针脚、每片中间一行；从底下也看得见。
  // 造在原点，伞沿高 rim、尖顶高 peak。seam：缝上那行针脚的针长、针距、线粗；mid = false 不要每片中间那一行
  function canopy(kit, det, r, rim, peak, colors, sectors, { seam = { len: 0.13, gap: 0.1, t: 0.022 }, mid = true } = {}) {
    const prof = [[1, 0], [0.8, 0.2], [0.55, 0.46], [0.28, 0.76], [0.045, 1]].map(([f, h]) => [r * f, rim + (peak - rim) * h]), sub = 3;
    const at = (a, [q, y], lift = 0) => [Math.sin(a) * q, y + lift, Math.cos(a) * q], along = prof.map((p, j) => (j ? Math.hypot(p[0] - prof[0][0], p[1] - prof[0][1]) : 0));
    for (let i = 0; i < sectors; i++) {
      const m = colors[i % colors.length];
      for (let q = 0; q < sub; q++) {
        const a = (i + q / sub) * TAU / sectors, b = (i + (q + 1) / sub) * TAU / sectors;
        for (let j = 1; j < prof.length; j++) {
          const uv = [[a * prof[j - 1][0], along[j - 1]], [b * prof[j - 1][0], along[j - 1]], [b * prof[j][0], along[j]], [a * prof[j][0], along[j]]];
          kit.quad(m, at(a, prof[j - 1]), at(b, prof[j - 1]), at(b, prof[j]), at(a, prof[j]), uv, 1, [0, 1, 0]);
          kit.quad(m, at(b, prof[j - 1], -0.025), at(a, prof[j - 1], -0.025), at(a, prof[j], -0.025), at(b, prof[j], -0.025), uv, 0.47, [0, -1, 0]);
        }
      }
      stitch(det, prof.slice(0, 4).map(p => at(i * TAU / sectors, p, 0.02)), seam);
      if (mid) stitch(det, prof.slice(0, 4).map(p => at((i + 0.5) * TAU / sectors, [p[0] * 0.995, p[1]], 0.02)), { color: i % 2 ? 0xf8e7b4 : 0xbfe0dc, len: 0.09, gap: 0.14, t: 0.016 });
    }
  }

  // ---------------------------------------------------------------- 栏杆
  // 木桩：桩顶一圈布箍、一颗球
  function post(kit, x, z, { h = 0.95, r = 0.085, cap = WOOL_WHITE, y = 0 } = {}) {
    kit.cyl(timber(0xa97a4c), r * 0.9, r, h, x, y + h / 2, z, { seg: 8 });
    kit.cyl(wool(cap), r * 1.32, r * 1.32, 0.07, x, y + h + 0.015, z, { seg: 9 });
    kit.sphere(wool(cap), r * 1.22, x, y + h + 0.04 + r, z, { seg: 8, rings: 6 });
  }
  // 两根桩之间的一道绳：中间垂一点
  function rope(kit, a, b, { r = 0.04, sag = 0.05, color = WOOL_WHITE } = {}) {
    kit.tube(wool(color), [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2], b], r, { seg: 5, detail: 3 });
  }
  // 一段栏杆：沿 pts（[x, z]）每个点立一根桩，相邻的拉两道绳
  function fence(kit, pts, { h = 0.95, closed = false } = {}) {
    pts.forEach(([x, z]) => post(kit, x, z, { h }));
    for (let i = 1; i < pts.length + (closed ? 1 : 0); i++) { const a = pts[i - 1], b = pts[i % pts.length]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 3.2) continue; for (const y of [h * 0.42, h * 0.8]) rope(kit, [a[0], y, a[1]], [b[0], y, b[1]]); }
  }

  // ---------------------------------------------------------------- 树、灌木、花、石头
  const TREE_TONES = [[0x4f7f45, 0x6f9a4c, 0x97b65a], [0x5f8f45, 0x8bab52, 0xb6c868], [0x9c7f3c, 0xc09d4c, 0xdcc068]];   // 每行：深、中、亮
  // 阔叶树：树干、一团深色的芯、外面一层层往外垂的大叶片。tone：0 绿 1 黄绿 2 秋黄；rich = false 少一层（远处、边上用）
  function leafTree(kit, x, z, s, seed, { tone = 0, rich = true } = {}) {
    const rnd = mulberry32(seed), set = TREE_TONES[tone], cy = 2.72 * s;
    kit.cyl(knit(0x8a6243), 0.16 * s, 0.25 * s, 1.95 * s, x, 0.975 * s, z, { seg: 8 });
    kit.cyl(knit(0x7b5538), 0.25 * s, 0.38 * s, 0.2 * s, x, 0.1 * s, z, { seg: 8 });
    kit.sphere(leaf(set[0]), 0.98 * s, x, cy, z, { seg: 10, rings: 7, sy: 1.02 });
    const tiers = rich ? [[-0.5, 0.92, 8, 0.74, -0.8, 0], [0.02, 1.0, 9, 0.78, -0.42, 1], [0.52, 0.8, 7, 0.7, -0.12, 1], [0.95, 0.42, 5, 0.62, 0.25, 2]]
      : [[-0.4, 0.95, 7, 0.8, -0.7, 0], [0.3, 0.9, 7, 0.8, -0.2, 1], [0.9, 0.4, 4, 0.66, 0.25, 2]];
    for (const [dy, rr, n, len, tilt, shade] of tiers) {
      const off = rnd() * TAU;
      for (let i = 0; i < n; i++) {
        const a = off + i * TAU / n + (rnd() - 0.5) * 0.25, col = set[Math.min(2, shade + (rnd() < 0.3 ? 1 : 0))], L = len * (0.88 + rnd() * 0.24) * s;
        kit.sphere(leaf(col), L, x + Math.sin(a) * rr * s, cy + dy * s + (rnd() - 0.5) * 0.12 * s, z + Math.cos(a) * rr * s,
          { seg: 8, rings: 4, sy: 0.24, sz: 0.56, rz: tilt + (rnd() - 0.5) * 0.2, ry: Math.atan2(-Math.cos(a), Math.sin(a)) });
      }
    }
    kit.sphere(leaf(set[2]), 0.6 * s, x, cy + 1.12 * s, z, { seg: 8, rings: 4, sy: 0.3 });
  }
  // 松树：几层往下收的尖塔，每层下沿垂一圈小叶
  function pine(kit, x, z, s, seed) {
    const rnd = mulberry32(seed), greens = [0x2f6650, 0x3a765a, 0x4a8a66];
    kit.cyl(knit(0x7b5538), 0.13 * s, 0.2 * s, 1.1 * s, x, 0.55 * s, z, { seg: 8 });
    [[1.25, 1.35], [1.0, 2.2], [0.74, 2.95], [0.46, 3.6]].forEach(([R, y], i) => {
      kit.cyl(leaf(greens[Math.min(2, i)]), R * 0.1 * s, R * s, 1.15 * s, x, y * s, z, { seg: 9 });
      const n = i < 2 ? 8 : 6, off = rnd() * TAU;
      for (let j = 0; j < n; j++) { const a = off + j * TAU / n; kit.sphere(leaf(greens[(i + j) % 3]), R * 0.4 * s, x + Math.sin(a) * R * 0.88 * s, (y - 0.52) * s, z + Math.cos(a) * R * 0.88 * s, { seg: 6, rings: 3, sy: 0.3, sz: 0.62, rz: -0.65, ry: Math.atan2(-Math.cos(a), Math.sin(a)) }); }
    });
  }
  // 朝上开的五瓣小花
  function daisy(kit, x, y, z, color, s = 1) {
    for (let p = 0; p < 5; p++) { const a = p * TAU / 5; kit.sphere(felt(color), 0.062 * s, x + Math.sin(a) * 0.07 * s, y, z + Math.cos(a) * 0.07 * s, { seg: 5, rings: 3, sy: 0.4 }); }
    kit.sphere(felt(color === 0xf0c24f || color === 0xf3d27a ? 0xc9793f : 0xf0c24f), 0.045 * s, x, y + 0.018 * s, z, { seg: 5, rings: 3, sy: 0.6 });
  }
  // 一丛花：每朵一根茎、一朵五瓣花，脚下几片叶
  function flowerPatch(kit, x, z, n, spread, seed, y = 0) {
    const rnd = mulberry32(seed);
    for (let j = 0; j < n; j++) {
      const fx = x + (rnd() - 0.5) * spread, fz = z + (rnd() - 0.5) * spread, h = 0.13 + rnd() * 0.15;
      kit.cyl(felt(0x6f9a5e), 0.012, 0.016, h, fx, y + h / 2, fz, { seg: 5 });
      daisy(kit, fx, y + h + 0.01, fz, PETALS[Math.floor(rnd() * PETALS.length)], 1.15 + rnd() * 0.5);
      if (j % 2 === 0) for (let q = 0; q < 2; q++) kit.sphere(leaf(q ? 0x6b9648 : 0x8fae55), 0.13, fx + (rnd() - 0.5) * 0.16, y + 0.05, fz + (rnd() - 0.5) * 0.16, { seg: 6, rings: 3, sy: 0.22, sz: 0.45, rz: 0.45, ry: rnd() * TAU });
    }
  }
  // 灌木：几团高低不一的叶球，顶上一团亮的；det 给了就在上面钉几朵小花
  function shrub(kit, det, x, z, r, seed) {
    const rnd = mulberry32(seed), greens = [0x4f7f45, 0x6b9648, 0x8fae55];
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + rnd(), rr = r * (0.38 + rnd() * 0.2); kit.sphere(leaf(greens[i % 3]), r * (0.52 + rnd() * 0.2), x + Math.sin(a) * rr, r * (0.4 + rnd() * 0.16), z + Math.cos(a) * rr, { seg: 8, rings: 5, sy: 0.84 }); }
    kit.sphere(leaf(greens[2]), r * 0.58, x, r * 0.78, z, { seg: 8, rings: 5, sy: 0.78 });
    if (det) for (let j = 0, n = 1 + Math.floor(rnd() * 3); j < n; j++) { const a = rnd() * TAU, rr = r * (0.2 + rnd() * 0.45); daisy(det, x + Math.sin(a) * rr, r * (1.12 - rr / r * 0.32), z + Math.cos(a) * rr, PETALS[Math.floor(rnd() * PETALS.length)], 1.0); }
  }
  // 石头：一大一小两块压扁的毛毡球，有的顶上一片苔
  function rock(kit, x, z, r, seed) {
    const rnd = mulberry32(seed), greys = [0x9a968c, 0x86837b, 0xaaa69a], a = rnd() * TAU;
    kit.sphere(wool(greys[Math.floor(rnd() * 3)]), r, x, r * 0.4, z, { seg: 9, rings: 6, sx: 1.25, sy: 0.7, sz: 0.95, ry: a });
    kit.sphere(wool(greys[Math.floor(rnd() * 3)]), r * 0.6, x + Math.sin(a) * r * 0.85, r * 0.26, z + Math.cos(a) * r * 0.85, { seg: 8, rings: 5, sy: 0.72 });
    if (rnd() < 0.6) kit.sphere(leaf(0x7f9b52), r * 0.5, x - Math.sin(a) * r * 0.2, r * 0.66, z - Math.cos(a) * r * 0.2, { seg: 7, rings: 4, sy: 0.26 });
  }
  // 草丛：几根尖叶（贴着路边、设施脚下，让交界处不是一条直线）
  function tuft(kit, x, z, seed, s = 1) {
    const rnd = mulberry32(seed);
    for (let i = 0; i < 4; i++) { const a = rnd() * TAU, lean = 0.25 + rnd() * 0.3; kit.cyl(felt(i % 2 ? 0x7a9a52 : 0x93ad5e), 0.004, 0.03 * s, (0.16 + rnd() * 0.12) * s, x + Math.sin(a) * 0.05, 0.1 * s, z + Math.cos(a) * 0.05, { seg: 4, rx: Math.cos(a) * lean, rz: -Math.sin(a) * lean }); }
  }

  // ---------------------------------------------------------------- 灯柱、长椅
  // 灯柱（参考图）：红布墩、青色细柱、四根笼条里一颗亮球、红色扇贝帽、金球
  function lamp(kit, det, x, z) {
    kit.cyl(wool(RED), 0.19, 0.24, 0.26, x, 0.13, z, { seg: 10 }); kit.cyl(wool(WOOL_WHITE), 0.17, 0.19, 0.08, x, 0.3, z, { seg: 10 });
    kit.lathe(felt(TEAL), [[0.105, 0], [0.075, 0.5], [0.058, 1.9], [0.095, 2.02], [0.14, 2.1]], x, 0.34, z, { seg: 9 });
    kit.sphere(M.glow(0xffe6a8, 2.4), 0.17, x, 2.72, z, { seg: 10, rings: 7, sy: 1.12 });
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4, c = Math.sin(a), q = Math.cos(a); det.tube(felt(TEAL), [[x + c * 0.13, 2.46, z + q * 0.13], [x + c * 0.215, 2.72, z + q * 0.215], [x + c * 0.14, 2.98, z + q * 0.14]], 0.016, { seg: 4, detail: 3 }); }
    kit.sphere(wool(RED), 0.3, x, 2.98, z, { seg: 10, rings: 5, sy: 0.62, thetaLen: Math.PI / 2 });
    valance(det, wool(RED), x, 3.0, z, 0.3, 8, 0.11, { band: 0.03, thick: 0.03 });
    ring(det, x, 3.075, z, 0.245, { len: 0.05, gap: 0.045, t: 0.012 }); ring(det, x, 0.2, z, 0.228, { len: 0.06, gap: 0.05, t: 0.014 });
    kit.sphere(wool(GOLD), 0.07, x, 3.22, z, { seg: 7, rings: 5 });
  }
  // 长椅（参考图）：三条座板、两条靠背板、青色侧架、扶手上一块红垫。正面朝 yaw
  function bench(kit, det, x, z, yaw) {
    const s = new PlushKit(), dd = new PlushKit(), slat = timber(0xc08a52);
    for (const dz of [-0.15, 0, 0.15]) s.soft(slat, 1.5, 0.05, 0.13, 0, 0.46, dz, { r: 0.02, seg: 1, long: 0 });
    for (const y of [0.68, 0.86]) s.soft(slat, 1.5, 0.13, 0.045, 0, y, -0.26 - (y - 0.68) * 0.2, { r: 0.02, seg: 1, long: 0, rx: -0.14 });
    for (const sx of [-0.72, 0.72]) {
      s.soft(felt(TEAL), 0.075, 0.46, 0.09, sx, 0.23, 0.2, { r: 0.03, seg: 1 }); s.soft(felt(TEAL), 0.075, 0.98, 0.09, sx, 0.49, -0.27, { r: 0.03, seg: 1, rx: -0.12 });
      s.soft(felt(TEAL), 0.085, 0.06, 0.56, sx, 0.64, -0.03, { r: 0.025, seg: 1 }); s.sphere(felt(TEAL), 0.06, sx, 0.64, 0.26, { seg: 7, rings: 5 });
      s.soft(wool(RED), 0.12, 0.06, 0.36, sx, 0.7, 0, { r: 0.028, seg: 1 });
      stitch(dd, [[sx - 0.045, 0.735, -0.15], [sx - 0.045, 0.735, 0.15]], { len: 0.04, gap: 0.035, t: 0.01 }); stitch(dd, [[sx + 0.045, 0.735, -0.15], [sx + 0.045, 0.735, 0.15]], { len: 0.04, gap: 0.035, t: 0.01 });
    }
    kit.merge(s, x, 0, z, yaw); det.merge(dd, x, 0, z, yaw);
  }

  // ---------------------------------------------------------------- 木马
  // 一匹奔跑姿势的布马，立杆穿过马背。造在原点、头朝 +x；返回 { s, d } 两个 kit，由调用方转到位。
  let horseBody = null;
  function horse(saddle, girth) {
    if (!horseBody) {
      horseBody = new PlushKit();
      const parts = [
        { a: [-0.27, 1.37, 0], b: [0.25, 1.39, 0], r: 0.2, r2: 0.19 }, { p: [0.28, 1.41, 0], r: 0.2 }, { p: [-0.31, 1.39, 0], r: 0.215 },
        { a: [0.3, 1.5, 0], b: [0.47, 1.83, 0], r: 0.135, r2: 0.105 }, { a: [0.47, 1.87, 0], b: [0.71, 1.75, 0], r: 0.118, r2: 0.082 },
      ];
      for (const z of [-0.105, 0.105]) parts.push(
        { a: [0.3, 1.3, z], b: [0.52, 1.04, z], r: 0.072, r2: 0.052 }, { a: [0.52, 1.04, z], b: [0.43, 0.82, z], r: 0.05, r2: 0.046 },
        { a: [-0.33, 1.3, z], b: [-0.5, 1.05, z], r: 0.082, r2: 0.055 }, { a: [-0.5, 1.05, z], b: [-0.64, 0.86, z], r: 0.052, r2: 0.046 });
      horseBody.blob(wool(WOOL_WHITE), parts, { blend: 0.07, cell: 0.036 });
      const mane = wool(0xdcb877), hoof = felt(0x8a6243);
      for (const z of [-0.105, 0.105]) { horseBody.sphere(hoof, 0.058, 0.42, 0.775, z, { seg: 7, rings: 5, sy: 0.8 }); horseBody.sphere(hoof, 0.058, -0.66, 0.82, z, { seg: 7, rings: 5, sy: 0.8 }); }
      for (let i = 0; i < 6; i++) { const f = i / 5; horseBody.sphere(mane, 0.085 - f * 0.012, 0.44 - f * 0.2, 1.97 - f * 0.4, 0, { seg: 7, rings: 5, sz: 0.62 }); }   // 鬃毛：沿脖子后面一排
      horseBody.sphere(mane, 0.07, 0.56, 1.99, 0, { seg: 7, rings: 5, sx: 1.3, sz: 0.7 });   // 额发
      for (const z of [-0.07, 0.07]) horseBody.sphere(wool(WOOL_WHITE), 0.05, 0.47, 2.0, z, { seg: 6, rings: 4, sy: 1.7, sx: 0.6 });   // 耳朵
      [[-0.52, 1.45, 0.1], [-0.63, 1.34, 0.085], [-0.7, 1.2, 0.07]].forEach(([x, y, r]) => horseBody.sphere(mane, r, x, y, 0, { seg: 7, rings: 5, sy: 1.25 }));   // 尾巴
      for (const z of [-0.082, 0.082]) horseBody.sphere(M.button(INK), 0.022, 0.6, 1.855, z, { seg: 6, rings: 4 });   // 眼睛
    }
    const s = new PlushKit(), d = new PlushKit();
    s.merge(horseBody);
    s.sphere(wool(saddle), 0.225, -0.02, 1.385, 0, { seg: 12, rings: 5, sx: 1.25, sy: 1.0, sz: 1.04, thetaLen: 1.75 });   // 披在背上的鞍垫
    s.cyl(wool(girth), 0.212, 0.212, 0.05, 0.04, 1.385, 0, { seg: 12, rz: Math.PI / 2 });   // 肚带
    s.cyl(wool(girth), 0.094, 0.1, 0.03, 0.62, 1.795, 0, { seg: 9, rz: Math.PI / 2 - 0.45 });   // 笼头
    for (const z of [-1, 1]) {
      d.tube(wool(girth), [[0.62, 1.78, z * 0.09], [0.4, 1.62, z * 0.15], [0.14, 1.52, z * 0.17]], 0.012, { seg: 4, detail: 3 });   // 缰绳
      stitch(d, [[-0.28, 1.36, z * 0.238], [0.24, 1.36, z * 0.238]], { len: 0.035, gap: 0.03, t: 0.01 });   // 鞍垫下沿的一行针脚
    }
    return { s, d };
  }

  return { felt, wool, leaf, knit, timber, dash, stitch, arc, ring, lobe, valance, valanceLine, tassel, rosette, star, canopy, post, rope, fence, leafTree, pine, daisy, flowerPatch, shrub, rock, tuft, lamp, bench, horse };
}
