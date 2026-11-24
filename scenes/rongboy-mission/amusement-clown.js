// 嬉笑小丑（Giggles）：从一只带轮子的大礼盒里弹出来的弹簧小丑。规则在 amusement.js（面具两层、血 46、会冻住）；
// 这里只管他长什么样、每一帧摆成什么姿势。造型准则：一个主导形状（圆），招牌特征放在轮廓上（两侧的红头发、歪着的尖帽）。
// 命中盒是照这个模型定的：身子连盒子 2.08 宽、到 2.41 高，头在 3.03，面具在脸前 0.64。
import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { RED, TEAL, GOLD, INK, THREAD, WOOL_WHITE } from './park-kit.js';

const TAU = 2 * Math.PI;
const PLUM = 0x70507c, FACE = 0x8b9a78, HAIR = 0xc9584f, STEEL = 0xc9ccd0;
const sat = v => Math.max(0, Math.min(1, v));
const ease = t => t * t * (3 - 2 * t);

export function createClown(P, M) {
  const { felt, wool, knit } = P;
  const root = new T.Group(); root.name = 'Giggles';
  const add = (parent, build, x = 0, y = 0, z = 0) => {
    const kit = new PlushKit(); build(kit);
    const g = new T.Group(); g.position.set(x, y, z); g.add(...kit.build({ cast: true })); parent.add(g); return g;
  };

  // ---------- 礼盒（机关箱）：红布箱身、金色包边、四个轮子、正面一颗星、右侧一个摇把
  const BOX_TOP = 1.3;
  add(root, k => {
    k.soft(knit(RED), 2.0, 1.05, 1.2, 0, 0.775, 0, { r: 0.08 });
    k.soft(felt(0x5b4034), 1.84, 0.06, 1.04, 0, BOX_TOP - 0.02, 0, { r: 0.02, seg: 1 });   // 盒口里面是暗的
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.tube(wool(GOLD), [[sx * 0.98, 0.27, sz * 0.58], [sx * 0.98, BOX_TOP, sz * 0.58]], 0.055, { seg: 6, straight: true });
      k.cyl(felt(INK), 0.17, 0.17, 0.13, sx * 0.8, 0.17, sz * 0.44, { seg: 14, rz: Math.PI / 2 });
      k.sphere(wool(GOLD), 0.07, sx * 0.875, 0.17, sz * 0.44, { seg: 7, rings: 5, sx: 0.5 });
    }
    for (const y of [0.27, BOX_TOP]) k.tube(wool(GOLD), [[-0.98, y, 0.58], [0.98, y, 0.58], [0.98, y, -0.58], [-0.98, y, -0.58], [-0.98, y, 0.58]], 0.055, { seg: 6, straight: true });
    P.star(k, GOLD, 0.34, 0, 0.8, 0.6, 0, 0.07);
    for (const sx of [-1, 1]) { k.soft(wool(TEAL), 0.3, 0.3, 0.04, sx * 0.62, 0.8, 0.61, { r: 0.02, seg: 1, rz: Math.PI / 4 }); k.soft(wool(WOOL_WHITE), 0.15, 0.15, 0.04, sx * 0.62, 0.8, 0.63, { r: 0.02, seg: 1, rz: Math.PI / 4 }); }   // 两边的菱形
    P.stitch(k, [[-0.86, 0.4, 0.607], [0.86, 0.4, 0.607], [0.86, 1.18, 0.607], [-0.86, 1.18, 0.607], [-0.86, 0.4, 0.607]], { len: 0.1, gap: 0.08, t: 0.02 });
    // 摇把：一根轴、一段曲柄、一颗红球
    k.cyl(wool(GOLD), 0.06, 0.06, 0.22, 1.1, 0.85, 0, { seg: 8, rz: Math.PI / 2 });
    k.tube(wool(GOLD), [[1.2, 0.85, 0], [1.2, 1.12, 0], [1.34, 1.12, 0]], 0.04, { seg: 6, straight: true });
    k.sphere(wool(RED), 0.1, 1.4, 1.12, 0, { seg: 9, rings: 6 });
  });
  // 盒盖：铰在后沿，往后翻开
  const lid = add(root, k => {
    k.soft(knit(RED), 2.06, 0.13, 1.26, 0, 0.065, 0.63, { r: 0.05 });
    k.tube(wool(GOLD), [[-1.0, 0.07, 0.03], [1.0, 0.07, 0.03], [1.0, 0.07, 1.23], [-1.0, 0.07, 1.23], [-1.0, 0.07, 0.03]], 0.05, { seg: 6, straight: true });
    P.star(k, GOLD, 0.26, 0, 0.145, 0.63, 0, 0.05);
  }, 0, BOX_TOP + 0.01, -0.62);

  // ---------- 弹出来的那一截：弹簧、身子、头、手
  const fig = new T.Group(); root.add(fig);
  const spring = add(fig, k => {
    k.tube(wool(STEEL), Array.from({ length: 41 }, (_, i) => { const t = i / 40, a = t * TAU * 3.5; return [Math.sin(a) * 0.3, t * 0.62, Math.cos(a) * 0.3]; }), 0.045, { seg: 6, straight: true });
  }, 0, 1.2, 0);
  const body = new T.Group(); body.position.set(0, 1.78, 0); fig.add(body);   // 腰：弹簧顶上，身子绕这里晃
  add(body, k => {
    // 身子：圆鼓鼓的紫色连体衣，左右各一条金背带，三颗金绒球，腰上一圈米白和金相间的荷叶边
    k.sphere(knit(PLUM), 0.62, 0, 0.36, 0, { seg: 16, rings: 11, sx: 1.14, sy: 1.02, sz: 0.86 });
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; k.sphere(wool(i % 2 ? GOLD : WOOL_WHITE), 0.2, Math.sin(a) * 0.52, -0.06, Math.cos(a) * 0.4, { seg: 8, rings: 5, sy: 0.55 }); }
    for (const sx of [-1, 1]) k.tube(wool(GOLD), [[sx * 0.3, 0.86, 0.3], [sx * 0.36, 0.5, 0.5], [sx * 0.34, 0.1, 0.5], [sx * 0.3, -0.02, 0.44]], 0.05, { seg: 6, detail: 3 });
    for (let i = 0; i < 3; i++) k.sphere(wool(GOLD), 0.095, 0, 0.12 + i * 0.25, 0.53 - Math.abs(i - 1) * 0.03, { seg: 8, rings: 6 });
    for (let i = 0; i < 6; i++) { const a = (i + 0.5) * TAU / 6; P.stitch(k, Array.from({ length: 6 }, (_, j) => { const p = 0.5 + j * 0.42; return [Math.sin(a) * Math.sin(p) * 0.71, 0.36 + Math.cos(p) * 0.635, Math.cos(a) * Math.sin(p) * 0.535]; }), { color: 0xa98bb4, len: 0.07, gap: 0.07, t: 0.016 }); }
    // 领口一圈大荷叶边
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; k.sphere(wool(i % 2 ? WOOL_WHITE : GOLD), 0.21, Math.sin(a) * 0.5, 0.86, Math.cos(a) * 0.4, { seg: 8, rings: 5, sy: 0.5, sx: 1.1 }); }
  });
  const head = new T.Group(); head.position.set(0, 1.24, 0.02); body.add(head);   // 头：中心在腰上面 1.24（世界高度 3.02）
  add(head, k => {
    // 没戴面具的真容：灰绿色的布偶脸，一只纽扣眼、一只打了叉的眼，撇着的嘴
    k.sphere(felt(FACE), 0.63, 0, 0, 0, { seg: 18, rings: 12, sx: 1.05, sz: 0.9 });
    k.sphere(M.button(INK), 0.1, -0.25, 0.08, 0.5, { seg: 10, rings: 7, sz: 0.5 }); k.sphere(felt(THREAD), 0.035, -0.22, 0.11, 0.56, { seg: 6, rings: 4 });
    P.stitch(k, [[0.16, 0.17, 0.535], [0.34, -0.01, 0.52]], { color: INK, len: 0.3, gap: 0.01, t: 0.03 }); P.stitch(k, [[0.16, -0.01, 0.535], [0.34, 0.17, 0.52]], { color: INK, len: 0.3, gap: 0.01, t: 0.03 });
    k.sphere(wool(RED), 0.13, 0, -0.07, 0.58, { seg: 10, rings: 7 });
    k.tube(felt(INK), [[-0.24, -0.32, 0.47], [-0.1, -0.25, 0.53], [0.1, -0.25, 0.53], [0.24, -0.32, 0.47]], 0.03, { seg: 5, detail: 3 });
    for (const sx of [-1, 1]) { k.sphere(felt(0xc98f86), 0.11, sx * 0.4, -0.14, 0.44, { seg: 8, rings: 5, sz: 0.4 }); P.stitch(k, [[sx * 0.14, 0.3, 0.51], [sx * 0.36, 0.24 + sx * 0.05, 0.47]], { color: INK, len: 0.24, gap: 0.01, t: 0.028 }); }   // 腮红、皱着的眉
    P.stitch(k, [[-0.3, 0.42, 0.42], [-0.05, 0.5, 0.46], [0.2, 0.44, 0.44]], { len: 0.06, gap: 0.05, t: 0.016 });   // 额头上一道缝线
    // 两侧的红头发：三团绒球，撑在轮廓外面
    for (const sx of [-1, 1]) for (const [dx, dy, dz, r] of [[0.66, 0.06, -0.05, 0.3], [0.6, 0.36, -0.1, 0.24], [0.62, -0.24, -0.02, 0.22]]) k.sphere(wool(HAIR), r, sx * dx, dy, dz, { seg: 10, rings: 7 });
    // 歪着的尖帽：青色的锥、金边、尖上一颗红绒球
    const tilt = 0.24, top = [Math.sin(tilt) * -0.92 + 0.06, 0.52 + Math.cos(tilt) * 0.92];
    k.cyl(wool(TEAL), 0.04, 0.4, 0.86, 0.06 - Math.sin(tilt) * 0.43, 0.54 + Math.cos(tilt) * 0.43, -0.03, { seg: 14, rz: tilt });
    k.cyl(wool(GOLD), 0.42, 0.44, 0.1, 0.05, 0.55, -0.03, { seg: 14, rz: tilt });
    for (let i = 0; i < 3; i++) k.cyl(wool(WOOL_WHITE), 0.3 - i * 0.09, 0.32 - i * 0.09, 0.05, 0.06 - Math.sin(tilt) * (0.22 + i * 0.2), 0.54 + Math.cos(tilt) * (0.22 + i * 0.2), -0.03, { seg: 12, rz: tilt });
    k.sphere(wool(RED), 0.13, top[0], top[1], -0.03, { seg: 9, rings: 6 });
  });
  // 面具：米白的硬壳，弯弯的笑眼、蓝色的泪滴、咧到耳根的红嘴、红鼻头，一圈金边
  const mask = add(head, k => {
    k.sphere(wool(WOOL_WHITE), 0.61, 0, 0, 0.38, { seg: 18, rings: 11, sx: 1.02, sy: 0.98, sz: 0.5 });
    k.tube(wool(GOLD), Array.from({ length: 25 }, (_, i) => { const a = i * TAU / 24; return [Math.sin(a) * 0.615, Math.cos(a) * 0.59, 0.42]; }), 0.04, { seg: 5, straight: true });
    for (const sx of [-1, 1]) {
      k.tube(felt(INK), [[sx * 0.36, 0.1, 0.61], [sx * 0.25, 0.2, 0.655], [sx * 0.13, 0.1, 0.66]], 0.034, { seg: 5, detail: 4 });   // 笑眼
      k.tube(wool(RED), [[sx * 0.38, 0.3, 0.57], [sx * 0.25, 0.36, 0.62], [sx * 0.12, 0.31, 0.635]], 0.026, { seg: 5, detail: 3 });   // 眉
      k.soft(wool(TEAL), 0.11, 0.11, 0.03, sx * 0.25, -0.02, 0.665, { r: 0.012, seg: 1, rz: Math.PI / 4 });   // 泪滴
      k.sphere(felt(0xe9a99a), 0.1, sx * 0.42, -0.1, 0.57, { seg: 8, rings: 5, sz: 0.3 });
    }
    k.sphere(wool(RED), 0.12, 0, 0.0, 0.7, { seg: 10, rings: 7 });
    k.tube(wool(RED), [[-0.36, -0.18, 0.59], [-0.2, -0.31, 0.64], [0, -0.35, 0.66], [0.2, -0.31, 0.64], [0.36, -0.18, 0.59]], 0.05, { seg: 6, detail: 4 });
    for (let i = 0; i < 4; i++) k.soft(felt(THREAD), 0.07, 0.06, 0.03, (i - 1.5) * 0.09, -0.27 - (Math.abs(i - 1.5) < 1 ? 0.03 : 0), 0.675, { r: 0.012, seg: 1 });
  });
  const crack = add(head, k => {   // 裂了一层：一道锯齿形的黑缝
    k.tube(felt(INK), [[-0.3, 0.5, 0.56], [-0.12, 0.33, 0.66], [-0.2, 0.16, 0.685], [0.02, 0.02, 0.705], [-0.06, -0.14, 0.69], [0.14, -0.3, 0.67], [0.1, -0.48, 0.58]], 0.022, { seg: 4, straight: true });
    k.tube(felt(INK), [[0.02, 0.02, 0.705], [0.22, 0.08, 0.68], [0.34, 0.0, 0.64]], 0.018, { seg: 4, straight: true });
  });
  // 手：肩上一团泡泡袖、条纹的小臂、荷叶边袖口、白手套
  const arms = [-1, 1].map(side => add(body, k => {
    k.sphere(wool(side > 0 ? RED : TEAL), 0.3, side * 0.1, -0.02, 0, { seg: 10, rings: 7, sx: 1.15 });
    for (let i = 0; i < 4; i++) k.cyl(knit(i % 2 ? WOOL_WHITE : side > 0 ? RED : TEAL), 0.15, 0.15, 0.17, side * (0.24 + i * 0.045), -0.22 - i * 0.165, 0.02, { seg: 10, rz: side * 0.27 });
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7; k.sphere(wool(i % 2 ? GOLD : WOOL_WHITE), 0.1, side * 0.42 + Math.sin(a) * 0.16, -0.86, 0.02 + Math.cos(a) * 0.16, { seg: 6, rings: 4, sy: 0.6 }); }
    k.sphere(wool(WOOL_WHITE), 0.25, side * 0.46, -1.06, 0.05, { seg: 12, rings: 8, sy: 1.1 });
    k.sphere(wool(WOOL_WHITE), 0.1, side * 0.3, -1.0, 0.2, { seg: 7, rings: 5, sy: 1.3 });   // 拇指
    for (let i = 0; i < 3; i++) P.stitch(k, [[side * (0.38 + i * 0.08), -0.98, 0.285 - Math.abs(i - 1) * 0.03], [side * (0.38 + i * 0.08), -1.16, 0.26 - Math.abs(i - 1) * 0.03]], { color: 0xcbbfa8, len: 0.16, gap: 0.01, t: 0.014 });
  }, side * 0.66, 0.74, 0));

  // 每一帧。q：{ time, pose（小丑自己的时钟，冻住时不走）, x, z, mask, flash, frozen, hidden（还没登场：缩在盒子里）,
  //   intro（登场过场的进度 0..1 或 null）, casting（正在扔东西）, down（倒下的进度 0..1，没倒是 0） }
  function pose(q) {
    root.position.set(q.x, 0, q.z);
    const t = q.pose, live = q.frozen ? 0 : 1;
    // 弹出来多少：0 缩在盒子里，1 整个在外面
    let out = 1, open = 1, rattle = 0, wave = 0;
    if (q.hidden) { out = 0; open = 0; rattle = 0.4; }
    if (q.intro !== null) {
      const p = q.intro;
      rattle = p < 0.36 ? 1 : 0;
      open = sat((p - 0.36) / 0.08);
      const u = sat((p - 0.38) / 0.24); out = u <= 0 ? 0 : 1 + Math.exp(-5.5 * u) * Math.sin(u * 15) * -0.42 - Math.exp(-9 * u);   // 弹出来，晃两下才站稳
      wave = sat((p - 0.62) / 0.12);
    }
    if (q.down > 0) { const dn = ease(sat(q.down)); out = 1 - dn; open = 1 - ease(sat((q.down - 0.72) / 0.28)) * 0.86; }
    out = Math.max(0, out);
    lid.rotation.x = -open * 1.95 + (rattle ? Math.max(0, Math.sin(q.time * 23)) * -0.07 * rattle : 0);
    root.rotation.z = rattle ? Math.sin(q.time * 31) * 0.012 * rattle : 0;
    fig.visible = out > 0.03;
    const bob = live * Math.sin(t * 2.3) * 0.05, squash = q.flash ? 0.05 * Math.sin(q.time * 83) : 0;
    const rise = (out - 1) * 1.55 + bob;                                   // 腰比站直时低多少
    spring.scale.y = Math.max(0.12, (0.58 + rise) / 0.62);
    body.position.y = 1.78 + rise;
    body.scale.set(1 + squash, (1 - squash) * (0.35 + 0.65 * sat(out * 1.6)), 1 + squash);
    body.rotation.z = live * Math.sin(t * 1.25) * 0.07 + (q.down > 0 ? ease(sat(q.down)) * 0.5 : 0);
    body.rotation.x = live * Math.sin(t * 0.9 + 1) * 0.04 + (q.casting ? -0.08 : 0);
    head.rotation.z = live * Math.sin(t * 1.9 + 0.6) * 0.09 + (q.down > 0 ? ease(sat(q.down)) * 0.6 : 0);
    head.rotation.y = live * Math.sin(t * 0.7) * 0.16;
    mask.visible = q.mask > 0; crack.visible = q.mask === 1;
    mask.rotation.z = crack.rotation.z = q.mask === 1 ? Math.sin(q.time * 12) * 0.05 : 0;
    arms.forEach((arm, i) => {
      const side = i ? 1 : -1, up = Math.max(q.casting ? 1 : 0, wave);
      arm.rotation.z = side * (0.12 + up * 1.7) + live * Math.sin(t * 2.9 + i * 0.8) * 0.1 + (up ? Math.sin(q.time * 9 + i * 2.2) * 0.22 * up : 0);
      arm.rotation.x = up ? -0.75 * up + Math.sin(q.time * 8 + i * 2) * 0.25 * up : live * Math.sin(t * 1.9 + i) * 0.12;
    });
  }

  return { root, pose, parts: [root] };
}
