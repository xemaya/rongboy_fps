// 布偶游乐园里跟着规则走的那些东西的样子：每站的门、入口的门栓、木马旁的蒸汽阀、过山车的轨道靶、马戏帐篷（外面和里面）、
// 嬉笑小丑和他的机关。规则在 amusement.js：这里只读它的状态来摆，自己不决定任何事。
// 园子的布景和设施在 park-tour-view.js；通用零件（针脚、扇贝边、伞顶……）在 park-kit.js，小丑在 amusement-clown.js。
// 准则在 docs/park-design.md 第 5d 节（精细度和开销）。
import * as T from 'three';
import { PlushKit } from '../../cine-engine/library/structures/plush.js';
import { plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { uiCanvasFont } from './interface-font.js';
import { copy } from './language.js';
import {
  TENT_DOOR, TENT, TENT_ZONE, CLOWN, TILES, TILE, GATES, GATE_LIFT_SECONDS, PARK_ZONES,
  LOCK, VALVE, SWEEP, COASTER_TARGETS, MOTOR, CLOWN_ENTRANCE,
  tileSwitch, lockPosition, coasterTargetPosition, amusementCutscene,
} from './amusement.js';
import { CAROUSEL, GATE as ARCH } from './park-tour-layout.js';
import { createParkKit, RED, TEAL, GOLD, INK, CORAL, WOOL_WHITE } from './park-kit.js';
import { createClown } from './amusement-clown.js';

const TAU = 2 * Math.PI;
const DETAIL_RANGE = 26;   // 小装饰（针脚、穗子）离人多远就不画了
const GATE_RANGE = 34;     // 路上的门、轨道靶、蒸汽阀冒的汽、帐篷门口的零碎离人多远就不画了
const sat = v => Math.max(0, Math.min(1, v));

export function createAmusementView(cine, world) {
  const root = new T.Group(); root.name = 'Plushwood park quest'; world.root.add(root);
  const M = plushMaterials(world.lib, { lit: m => world.volume.light(m) });
  const P = createParkKit(M), { felt, wool, knit } = P;
  const box = (kit, m, w, h, dp, x, y, z, r = 0.045, o = {}) => kit.soft(m, w, h, dp, x, y, z, { r, seg: Math.min(w, h, dp) < 0.35 ? 1 : 2, ...o });
  const group = (parent = root, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const obj = (parent, geo, mat, x = 0, y = 0, z = 0) => { const mesh = new T.Mesh(geo, mat); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  // 会亮会灭的东西：自己的一份材质，颜色和亮度每帧照规则层的状态改
  const DIM = 0xbdb7c2, ROPE = 0x8f8a99;
  const lamp = (color = DIM, power = 0) => { const m = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: power, roughness: 0.7 }); m.userData.noShadow = true; return m; };
  const light = (m, color, power) => { m.color.setHex(color); m.emissive.setHex(color); m.emissiveIntensity = power; };
  const ghost = (color, opacity) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

  // ---------- 分块：不动的东西按站分，每块两层（k 主体投影，d 小装饰不投影、走远了不画） ----------
  const zones = new Map(), details = [];
  const zone = id => { let q = zones.get(id); if (!q) zones.set(id, q = { s: new PlushKit(), d: new PlushKit() }); return q; };
  let k, d; const use = id => { ({ s: k, d } = zone(id)); };
  // 一个会动的部件：单独一组网格。build(kit, det) 在原点附近造它；anchor = [x, z, 半径] 给了，det 那层走远就不画
  const part = (parent, build, x = 0, y = 0, z = 0, cast = false, anchor = null) => {
    const kit = new PlushKit(), det = new PlushKit(); build(kit, det);
    const g = group(parent, x, y, z); g.add(...kit.build({ cast }));
    const extra = det.build({ cast: false, name: 'detail' });
    if (extra.length) { g.add(...extra); if (anchor) details.push({ meshes: extra, x: anchor[0], z: anchor[1], r: anchor[2] }); }
    return g;
  };
  function sign(text, x, y, z, w, yaw = 0, parent = root) {
    const canvas = document.createElement('canvas'); canvas.width = 816; canvas.height = 216;
    const ctx = canvas.getContext('2d'); ctx.scale(1.5, 1.5); ctx.fillStyle = '#f5dfac'; ctx.beginPath(); ctx.roundRect(4, 4, 536, 136, 28); ctx.fill();
    ctx.strokeStyle = '#99704d'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.strokeRect(19, 16, 506, 111);
    ctx.fillStyle = '#5a2f33'; ctx.font = uiCanvasFont(60);
    const width = ctx.measureText(text).width; if (width > 470) ctx.font = uiCanvasFont(Math.floor(60 * 470 / width));
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, 272, 74);
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
    const panel = obj(parent, new T.PlaneGeometry(w, w * 144 / 544), new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide }), x, y, z);
    panel.rotation.y = yaw; return panel;
  }
  const loader = new T.TextureLoader();
  function picture(file, w, h, x, y, z, yaw = 0, parent = root) {
    const map = loader.load(file); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
    const panel = obj(parent, new T.PlaneGeometry(w, h), world.volume.light(new T.MeshStandardMaterial({ map, roughness: 0.9 })), x, y, z); panel.rotation.y = yaw; panel.receiveShadow = true; return panel;
  }

  // 礼物箱（能躲在后面的掩体）：针织的箱身、盖、十字金缎带、顶上一个蝴蝶结
  function gift(x, z, w, dp, h, body, ribbonColor = GOLD) {
    box(k, knit(body), w - 0.06, h - 0.2, dp - 0.06, x, (h - 0.2) / 2, z, 0.07);
    box(k, wool(body), w, 0.2, dp, x, h - 0.1, z, 0.06);
    box(k, wool(ribbonColor), 0.2, h + 0.02, dp + 0.03, x, h / 2, z, 0.03); box(k, wool(ribbonColor), w + 0.03, h + 0.02, 0.2, x, h / 2, z, 0.03);
    for (const s of [-1, 1]) k.sphere(wool(ribbonColor), 0.17, x + s * 0.17, h + 0.1, z, { seg: 9, rings: 6, sy: 0.7, sz: 0.6, rz: s * 0.5 });
    k.sphere(wool(ribbonColor), 0.09, x, h + 0.07, z, { seg: 7, rings: 5 });
    for (const s of [-1, 1]) { P.stitch(d, [[x - w / 2 + 0.1, h - 0.21, z + s * (dp / 2 + 0.004)], [x - 0.14, h - 0.21, z + s * (dp / 2 + 0.004)]], { len: 0.06, gap: 0.05, t: 0.014 }); P.stitch(d, [[x + 0.14, h - 0.21, z + s * (dp / 2 + 0.004)], [x + w / 2 - 0.1, h - 0.21, z + s * (dp / 2 + 0.004)]], { len: 0.06, gap: 0.05, t: 0.014 }); }
  }

  // ====================================================================== 门：每站路上横一道（第 0 道是入口的拱门，最后一道是帐篷的门帘）
  // 两根糖果色的门柱、柱顶一盏灯（门开了就亮）、一块写着下一站的牌子、两扇对开的矮栅门；路比门宽的地方两边接一段栅栏。
  // 门在自己的坐标里朝 +z 迎着人，下一站在 -z 那边；整个转到小径的走向上。
  const gateLeaf = (kit, Lw, dir, tone) => {
    for (const y of [0.32, 1.06]) box(kit, wool(tone), Lw, 0.12, 0.1, dir * Lw / 2, y, 0, 0.04);
    for (const x of [0.07, Lw - 0.07]) box(kit, wool(tone), 0.14, 1.34, 0.13, dir * x, 0.67, 0, 0.04);
    const n = Math.max(3, Math.round(Lw / 0.3));
    for (let j = 0; j < n; j++) { const x = 0.3 + j * (Lw - 0.6) / (n - 1), h = 1.0 + Math.sin(j / (n - 1) * Math.PI) * 0.22; box(kit, felt(WOOL_WHITE), 0.17, h, 0.06, dir * x, 0.12 + h / 2, 0, 0.06); }
  };
  const gates = GATES.slice(0, -1).map((g, i) => {
    const arch = i === 0, tone = i % 2 ? TEAL : RED, hw = arch ? g.width / 2 : Math.min(g.width / 2, 1.7), lampMat = lamp();
    const holder = group(root, g.x, 0, g.z); holder.rotation.y = Math.atan2(-g.tx, -g.tz);
    if (!arch) {
      part(holder, (kit, det) => {
        for (const side of [-1, 1]) {
          const x = side * (hw + 0.16);
          kit.cyl(wool(RED), 0.3, 0.34, 0.5, x, 0.25, 0, { seg: 12 }); kit.cyl(wool(GOLD), 0.33, 0.33, 0.08, x, 0.54, 0, { seg: 12 });
          for (let j = 0; j < 5; j++) kit.cyl(wool(j % 2 ? RED : WOOL_WHITE), 0.2, 0.2, 0.38, x, 0.77 + j * 0.38, 0, { seg: 12 });
          kit.cyl(wool(GOLD), 0.24, 0.2, 0.1, x, 2.53, 0, { seg: 12 }); kit.sphere(lampMat, 0.2, x, 2.76, 0, { seg: 10, rings: 7 });
          // 路比门宽：门柱外面接一段矮栅栏，一直到路边外面一点
          const wing = g.width / 2 + 0.5 - (hw + 0.36);
          if (wing > 0.3) {
            const cx = side * (hw + 0.36 + wing / 2), n = Math.max(2, Math.round(wing / 0.3));
            for (const y of [0.3, 0.9]) box(kit, wool(tone), wing, 0.1, 0.09, cx, y, 0, 0.035);
            for (let j = 0; j < n; j++) box(kit, felt(WOOL_WHITE), 0.16, 1.05, 0.05, side * (hw + 0.36 + (j + 0.5) * wing / n), 0.6, 0, 0.05);
          }
        }
        // 牌子：两根柱子顶上拉一道横梁，底下挂一块板
        box(kit, wool(tone), hw * 2 + 0.3, 0.14, 0.14, 0, 2.5, 0, 0.05);
        box(kit, wool(tone), 2.5, 0.72, 0.1, 0, 2.02, 0, 0.05);
        P.stitch(det, [[-1.12, 2.3, 0.056], [1.12, 2.3, 0.056]], { len: 0.07, gap: 0.06, t: 0.014 }); P.stitch(det, [[-1.12, 1.74, 0.056], [1.12, 1.74, 0.056]], { len: 0.07, gap: 0.06, t: 0.014 });
      }, 0, 0, 0, false, [g.x, g.z, 3]);
      sign(copy(PARK_ZONES[i + 1].name, PARK_ZONES[i + 1].en.toUpperCase()), 0, 2.02, 0.06, 2.3, 0, holder);
    }
    const leaves = [1, -1].map(dir => part(holder, kit => gateLeaf(kit, hw - 0.05, dir, tone), -dir * hw, 0, 0, arch));   // 只有入口那一道投影：别的门不投（每多一组投影的网格就多画一遍）
    return { holder, leaves, lampMat, x: g.x, z: g.z };
  });

  // ====================================================================== 0 入口：门栓夹在拱门的两道金杆上来回滑
  use('entrance');
  for (const y of [LOCK.y + 0.2, LOCK.y - 0.2]) k.tube(wool(GOLD), [[ARCH.x - GATES[0].width / 2 - 0.1, y, LOCK.z - 0.18], [ARCH.x + GATES[0].width / 2 + 0.1, y, LOCK.z - 0.18]], 0.045, { seg: 6, straight: true });
  const lockLamp = lamp(0xffcf72, 1.6);
  const lock = part(root, kit => {   // 门栓：一把青色的大挂锁，锁面上一个金靶心
    box(kit, knit(TEAL), 0.92, 0.66, 0.3, 0, -0.03, 0, 0.12);
    kit.tube(wool(GOLD), [[-0.24, 0.26, 0], [-0.24, 0.5, 0], [-0.14, 0.62, 0], [0.14, 0.62, 0], [0.24, 0.5, 0], [0.24, 0.26, 0]], 0.06, { seg: 6, detail: 2 });
    kit.cyl(wool(GOLD), 0.27, 0.27, 0.06, 0, -0.03, 0.16, { seg: 22, rx: Math.PI / 2 });
    kit.cyl(wool(WOOL_WHITE), 0.19, 0.19, 0.06, 0, -0.03, 0.175, { seg: 20, rx: Math.PI / 2 });
    kit.cyl(lockLamp, 0.1, 0.1, 0.06, 0, -0.03, 0.19, { seg: 16, rx: Math.PI / 2 });
    P.stitch(kit, [[-0.38, 0.24, 0.153], [0.38, 0.24, 0.153]], { len: 0.06, gap: 0.05, t: 0.014 }); P.stitch(kit, [[-0.38, -0.3, 0.153], [0.38, -0.3, 0.153]], { len: 0.06, gap: 0.05, t: 0.014 });
  }, LOCK.x, LOCK.y, LOCK.z, true);
  const frostGeo = new T.IcosahedronGeometry(1, 0), frostShell = ghost(0x96e9ff, 0.42), frostRim = new T.MeshBasicMaterial({ color: 0xd8f8ff, transparent: true, opacity: 0.5, wireframe: true, depthWrite: false });
  const frost = (parent, r, x = 0, y = 0, z = 0) => { const g = group(parent, x, y, z); obj(g, frostGeo, frostShell).scale.setScalar(r); obj(g, frostGeo, frostRim).scale.setScalar(r * 1.04); g.visible = false; return g; };
  const lockFrost = frost(lock, 0.66);

  // ====================================================================== 1 木马：蒸汽阀（一根从地里冒出来的旧管子，顶上一只红手轮）。冻住它，铃才摇得动
  use('carousel');
  const valveLamp = lamp(0xf2a367, 1.8);
  {
    const v = VALVE, pipe = knit(0x7f9aa0);
    k.cyl(wool(0x5b6f78), 0.24, 0.27, 0.12, v.x, 0.06, v.z, { seg: 12 });
    k.cyl(pipe, 0.13, 0.14, 1.1, v.x, 0.6, v.z, { seg: 10 });
    for (const y of [0.34, 0.88]) k.cyl(wool(GOLD), 0.17, 0.17, 0.07, v.x, y, v.z, { seg: 10 });
    k.sphere(pipe, 0.2, v.x, v.y - 0.12, v.z, { seg: 10, rings: 7 });
    k.cyl(pipe, 0.11, 0.13, 0.4, v.x, v.y + 0.18, v.z, { seg: 9 }); k.cyl(wool(GOLD), 0.16, 0.13, 0.09, v.x, v.y + 0.4, v.z, { seg: 9 });   // 喷口
    k.tube(wool(RED), Array.from({ length: 19 }, (_, i) => { const a = i * TAU / 18; return [v.x + Math.sin(a) * 0.27, v.y - 0.12 + Math.cos(a) * 0.27, v.z + 0.26]; }), 0.04, { seg: 6, straight: true });   // 手轮
    for (let i = 0; i < 3; i++) { const a = i * TAU / 6; P.dash(k, wool(RED), [v.x - Math.sin(a) * 0.25, v.y - 0.12 - Math.cos(a) * 0.25, v.z + 0.26], [v.x + Math.sin(a) * 0.25, v.y - 0.12 + Math.cos(a) * 0.25, v.z + 0.26], 0.04); }
    k.cyl(pipe, 0.05, 0.05, 0.12, v.x, v.y - 0.12, v.z + 0.2, { seg: 6, rx: Math.PI / 2 });
    k.sphere(valveLamp, 0.085, v.x, v.y - 0.12, v.z + 0.3, { seg: 9, rings: 6 });
  }
  const iceGeo = new T.IcosahedronGeometry(0.28, 0), valveIce = obj(root, iceGeo, ghost(0xb6f0ff, 0.85), VALVE.x, VALVE.y + 0.5, VALVE.z); valveIce.scale.set(1, 1.3, 1); valveIce.visible = false;
  const vaporMat = () => ghost(0xf2ece0, 0.4), vapor = Array.from({ length: 7 }, () => obj(root, new T.SphereGeometry(0.3, 9, 6), vaporMat()));

  // 木马转起来的时候从底座往外扫的气浪：贴着地的一圈光
  const sweepGeo = new T.RingGeometry(0.93, 1, 64); sweepGeo.rotateX(-Math.PI / 2);
  const sweepRing = obj(root, sweepGeo, new T.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }), CAROUSEL.x, 0.09, CAROUSEL.z);
  sweepRing.visible = false;

  // ====================================================================== 3 过山车的两个轨道靶：各挂在一道金杆上来回滑。靶圈自己会亮：金色是没打中，冰蓝是冻住了，绿色是点亮了
  const coasterTargets = COASTER_TARGETS.map((t, i) => {
    use('coaster');
    const zb = t.z - 0.3, top = t.y + 0.86;
    for (const side of [-1, 1]) { const x = t.x + side * (t.amp + 0.75); k.cyl(P.timber(0xa97a4c), 0.07, 0.09, top, x, top / 2, zb, { seg: 7 }); k.sphere(wool(GOLD), 0.12, x, top + 0.08, zb, { seg: 8, rings: 6 }); k.cyl(wool(0xcdb98c), 0.17, 0.2, 0.14, x, 0.07, zb, { seg: 9 }); }
    k.tube(wool(GOLD), [[t.x - t.amp - 0.75, top - 0.1, zb], [t.x + t.amp + 0.75, top - 0.1, zb]], 0.04, { seg: 6, straight: true });
    const rim = lamp(0xffca72, 1.2), core = lamp(0xa83c48, 0.2);
    const g = part(root, kit => {
      kit.cyl(wool(RED), 0.44, 0.44, 0.1, 0, 0, 0, { seg: 26, rx: Math.PI / 2 });
      for (const f of [1, -1]) { kit.cyl(wool(WOOL_WHITE), 0.32, 0.32, 0.03, 0, 0, f * 0.055, { seg: 22, rx: Math.PI / 2 }); kit.cyl(core, 0.17, 0.17, 0.03, 0, 0, f * 0.075, { seg: 18, rx: Math.PI / 2 }); }
      kit.tube(rim, Array.from({ length: 25 }, (_, j) => { const a = j * TAU / 24; return [Math.sin(a) * 0.47, Math.cos(a) * 0.47, 0]; }), 0.055, { seg: 6, straight: true });
      for (const sx of [-0.2, 0.2]) kit.tube(felt(INK), [[sx, 0.44, 0], [sx, 0.74, -0.3]], 0.012, { straight: true });   // 挂绳
      kit.cyl(wool(GOLD), 0.07, 0.07, 0.5, 0, 0.76, -0.3, { seg: 8, rz: Math.PI / 2 });
    }, t.x, t.y, t.z, false);
    return { g, rim, core, frost: frost(g, 0.6) };
  });

  // ====================================================================== 9 大帐篷：外面、门、里面
  const arena = group(root), porch = group(root);   // porch：门帘、招牌、海报这些零碎的，离帐篷远了不画
  use('tent');
  const curtains = [], tentLights = [];
  let spot;
  {
    const { a: A, b: Bz, n: NN, z: CZ, wall: WALL } = TENT, RIDGE = 3.0, PEAK = 8.5, SECT = 36, SUB = 3;
    // 帐篷的轮廓：超椭圆。按弧长分成 36 片帐布，正南（门）在第 0 片的中间
    const curve = Array.from({ length: 721 }, (_, i) => { const t = Math.PI / 2 + i * TAU / 720, c = Math.cos(t), s = Math.sin(t); return [Math.sign(c) * A * Math.abs(c) ** (2 / NN), CZ + Math.sign(s) * Bz * Math.abs(s) ** (2 / NN)]; });
    const acc = [0]; for (let i = 1; i < curve.length; i++) acc.push(acc[i - 1] + Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]));
    const total = acc[acc.length - 1], rimAt = f => { const s = (((f % 1) + 1) % 1) * total; let i = 1; while (acc[i] < s) i++; const u = (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1); return [curve[i - 1][0] + (curve[i][0] - curve[i - 1][0]) * u, curve[i - 1][1] + (curve[i][1] - curve[i - 1][1]) * u]; };
    const n = SECT * SUB, rim = Array.from({ length: n + 1 }, (_, i) => rimAt((i - SUB / 2) / n));   // rim[i]：第 i 小格的起点
    const out = i => { const p = rim[(i + n - 1) % n], q = rim[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz) || 1; return [-dz / len, dx / len]; };   // 朝外的法线（轮廓是顺着 t 增大的方向走的）
    const sign0 = (() => { const [nx, nz] = out(0); return nx * rim[0][0] + nz * (rim[0][1] - CZ) > 0 ? 1 : -1; })();
    const normal = i => { const [nx, nz] = out(i); return [nx * sign0, nz * sign0]; };
    const stripe = [wool(0xf1e3c0), wool(RED)], inner = [wool(0xc9aa82), wool(0xa05151)], door = (x, z) => Math.abs(x) < 1.86 && z > CZ;
    // 帐布墙：米白和红相间；里面那一面暗一点。门那一段不造
    for (let i = 0; i < n; i++) {
      const p = rim[i], q = rim[i + 1], m = stripe[Math.floor(i / SUB) % 2], mi = inner[Math.floor(i / SUB) % 2], [nx, nz] = normal(i);
      if (door(p[0], p[1]) && door(q[0], q[1])) continue;
      k.quad(m, [p[0], 0.02, p[1]], [q[0], 0.02, q[1]], [q[0], WALL, q[1]], [p[0], WALL, p[1]], [[i, 0], [i + 1, 0], [i + 1, WALL], [i, WALL]], 1, [nx, 0, nz]);
      k.quad(mi, [q[0] - nx * 0.05, 0.02, q[1] - nz * 0.05], [p[0] - nx * 0.05, 0.02, p[1] - nz * 0.05], [p[0] - nx * 0.05, WALL, p[1] - nz * 0.05], [q[0] - nx * 0.05, WALL, q[1] - nz * 0.05], [[0, 0], [1, 0], [1, 3.2], [0, 3.2]], 0.55, [-nx, 0, -nz]);
      if (i % SUB === 0 && !door(p[0], p[1])) P.stitch(d, [[p[0] + nx * 0.012, 0.2, p[1] + nz * 0.012], [p[0] + nx * 0.012, WALL - 0.15, p[1] + nz * 0.012]], { len: 0.2, gap: 0.2, t: 0.03 });
    }
    // 帐顶：两根主杆撑起一道屋脊，帐布从檐口一片片收到屋脊上；每道缝一行大针脚
    const apex = ([x]) => { const ax = Math.max(-RIDGE, Math.min(RIDGE, x)); return [ax, PEAK - 0.55 * (1 - (ax / RIDGE) ** 2), CZ]; };
    const prof = [[1, 0], [0.8, 0.2], [0.55, 0.46], [0.28, 0.76], [0, 1]], grow = 0.4;   // 最后一格收到屋脊上：两面的帐布在屋脊合缝
    const roofAt = (i, j, lift = 0) => { const [nx, nz] = normal(i % n), p = [rim[i][0] + nx * grow, rim[i][1] + nz * grow], ap = apex(p), [f, h] = prof[j]; return [ap[0] + (p[0] - ap[0]) * f, WALL - 0.03 + (ap[1] - WALL) * h + lift, ap[2] + (p[1] - ap[2]) * f]; };
    for (let i = 0; i < n; i++) {
      const m = stripe[(Math.floor(i / SUB) + 1) % 2], mi = inner[(Math.floor(i / SUB) + 1) % 2];
      for (let j = 1; j < prof.length; j++) {
        const uv = [[i, j - 1], [i + 1, j - 1], [i + 1, j], [i, j]];
        k.quad(m, roofAt(i, j - 1), roofAt(i + 1, j - 1), roofAt(i + 1, j), roofAt(i, j), uv, 1, [0, 1, 0]);
        k.quad(mi, roofAt(i + 1, j - 1, -0.03), roofAt(i, j - 1, -0.03), roofAt(i, j, -0.03), roofAt(i + 1, j, -0.03), uv, 0.5, [0, -1, 0]);
      }
      if (i % SUB === 0) P.stitch(d, prof.slice(0, 4).map((_, j) => roofAt(i, j, 0.03)), { len: 0.3, gap: 0.3, t: 0.035 });
    }
    k.tube(wool(GOLD), [[-RIDGE, PEAK + 0.02, CZ], [0, PEAK - 0.53, CZ], [RIDGE, PEAK + 0.02, CZ]], 0.09, { seg: 6, detail: 4 });   // 屋脊
    // 檐口：一圈金色扇贝边，每个尖上一颗金球，外面一道滚边
    for (let s = 0; s < SECT; s++) {
      const i0 = s * SUB, p = roofAt(i0, 0), q = roofAt(i0 + SUB, 0), mid = [(p[0] + q[0]) / 2, (p[2] + q[2]) / 2], [nx, nz] = normal(i0 + 1), half = Math.hypot(q[0] - p[0], q[2] - p[2]) / 2;
      P.lobe(k, wool(GOLD), mid[0], WALL + 0.02, mid[1], Math.atan2(nx, nz), half, 0.22, 0.6, 0.04);
      k.sphere(wool(GOLD), 0.13, p[0], WALL - 0.22, p[2], { seg: 7, rings: 5 });
    }
    k.tube(wool(0xf6e3a1), Array.from({ length: n + 1 }, (_, i) => { const p = roofAt(i % n, 0); return [p[0], WALL + 0.03, p[2]]; }), 0.08, { straight: true, seg: 6, caps: false });
    // 两根主杆顶上的旗
    for (const sx of [-1, 1]) {
      const x = sx * RIDGE; k.cyl(wool(RED), 0.3, 0.36, 0.2, x, PEAK + 0.05, CZ, { seg: 14 }); k.cyl(wool(GOLD), 0.08, 0.1, 1.4, x, PEAK + 0.8, CZ, { seg: 8 }); k.sphere(wool(GOLD), 0.18, x, PEAK + 1.6, CZ, { seg: 9, rings: 6 });
      k.extrude(wool(sx > 0 ? RED : TEAL), [[0, 0.3], [0.45, 0.23], [0.85, 0.32], [1.3, 0.2], [1.12, 0], [1.3, -0.18], [0.85, -0.27], [0.45, -0.2], [0, -0.28]], 0.05, new T.Matrix4().makeTranslation(x + 0.08, PEAK + 1.12, CZ));
    }
    // 门：两根红柱、门楣、招牌、一排金扇贝；门帘分左右两幅，开的时候各往两边收
    const dz = TENT_DOOR, pz = dz + 0.52;   // 门廊比帐布往外探出半米：门楣和招牌在檐口的扇贝边前面
    for (const side of [-1, 1]) { const x = side * 2.06; box(k, wool(RED), 0.44, 4.0, 0.46, x, 2.0, pz, 0.1); P.stitch(d, [[x, 3.3, pz + 0.235], [x, 0.3, pz + 0.235]], { color: GOLD, len: 0.12, gap: 0.1, t: 0.02 }); k.cyl(wool(GOLD), 0.3, 0.3, 0.1, x, 0.05, pz, { seg: 12 }); }
    box(k, wool(RED), 4.9, 0.7, 0.46, 0, 3.73, pz + 0.02, 0.1);
    for (const side of [-1, 1]) k.sphere(wool(GOLD), 0.2, side * 2.45, 4.2, pz, { seg: 9, rings: 6 });
    sign(copy('马戏帐篷', 'BIG TOP'), 0, 3.74, pz + 0.26, 2.45, 0, porch);
    P.valanceLine(k, wool(GOLD), [-1.84, pz + 0.2], [1.84, pz + 0.2], 3.4, 7, 0.3, { band: 0.06 });
    for (const side of [-1, 1]) { box(k, wool(0xa94f4b), 0.1, 3.4, 0.5, side * 1.86, 1.7, dz + 0.26, 0.03); }   // 门廊的两片侧板
    for (const side of [-1, 1]) curtains.push(part(porch, (kit, det) => {
      for (let i = 0; i < 6; i++) kit.soft(wool(i % 2 ? 0xa94f4b : RED), 0.36, 3.36, 0.16, -side * (0.16 + i * 0.31), 1.7, 0, { r: 0.07, seg: 1 });
      kit.tube(wool(GOLD), [[-side * 0.02, 0.06, 0.09], [-side * 1.82, 0.06, 0.09]], 0.05, { seg: 5, straight: true });
      P.stitch(det, [[-side * 0.05, 0.3, 0.085], [-side * 1.8, 0.3, 0.085]], { color: GOLD, len: 0.1, gap: 0.08, t: 0.02 });
    }, side * 1.84, 0, dz + 0.02, true, [0, dz, 4]));
    // 门两边的海报（出图 agent 画的），帐布上的金菱形
    [['poster-circus-1.webp', -4.3], ['poster-circus-3.webp', 4.3]].forEach(([file, x]) => {
      box(k, M('boards', 0x9a6f4c), 1.34, 1.74, 0.07, x, 1.72, dz + 0.1, 0.03); box(k, wool(RED), 1.5, 0.14, 0.16, x, 2.68, dz + 0.1, 0.04); k.sphere(wool(GOLD), 0.09, x, 2.84, dz + 0.1, { seg: 7, rings: 5 });
      picture(file, 1.2, 1.6, x, 1.72, dz + 0.145, 0, porch);
    });
    for (let s = 2; s < SECT - 1; s += 2) { const i = s * SUB, p = rim[i], [nx, nz] = normal(i); if (p[1] > CZ + Bz - 0.4 && Math.abs(p[0]) < 6) continue; box(k, wool(GOLD), 0.4, 0.4, 0.03, p[0] + nx * 0.03, 1.7, p[1] + nz * 0.03, 0.02, { ry: Math.atan2(nx, nz), rz: Math.PI / 4 }); box(k, wool(CORAL), 0.2, 0.2, 0.03, p[0] + nx * 0.05, 1.7, p[1] + nz * 0.05, 0.02, { ry: Math.atan2(nx, nz), rz: Math.PI / 4 }); }
    // 里面的东西都挂在 arena 这一组上：帐布不透光，人不在帐篷跟前的时候整组不画
    use('arena');
    // ---------- 里面：锯末色的地、进门的红毯、机关地砖底下的暗坑、两侧的看台、后台的幕布、从屋脊拉下来的灯串
    for (let i = 0; i < n; i += SUB) { const p = rim[i], q = rim[i + SUB]; k.quad(wool(0xc9a877), [p[0], 0.03, p[1]], [q[0], 0.03, q[1]], [0, 0.03, CZ], [0, 0.03, CZ], [[p[0], p[1]], [q[0], q[1]], [0, CZ], [0, CZ]], 0.7, [0, 1, 0]); }
    box(k, wool(0xa94f4b), 3.2, 0.03, 2.1, 0, 0.05, dz - 1.0, 0.012);
    for (const sx of [-1, 1]) P.stitch(d, [[sx * 1.45, 0.07, dz - 0.05], [sx * 1.45, 0.07, dz - 1.95]], { color: GOLD, len: 0.1, gap: 0.08, t: 0.02 });
    for (const sx of [-1, 1]) for (let tier = 0; tier < 2; tier++) for (let i = 0; i < 5; i++) box(k, M('boards', tier ? 0xb98a66 : 0x9a7250), 0.56, 0.33 + tier * 0.36, 1.26, sx * (6.42 + tier * 0.58), (0.33 + tier * 0.36) / 2 + 0.03, CZ - 2.7 + i * 1.34, 0.04, { long: 2 });   // 看台：两级实心的台阶
    for (const sx of [-1, 1]) { k.cyl(wool(GOLD), 0.1, 0.12, 3.5, sx * 2.9, 1.75, CZ - Bz + 0.75, { seg: 9 }); k.sphere(wool(GOLD), 0.17, sx * 2.9, 3.6, CZ - Bz + 0.75, { seg: 9, rings: 6 }); }   // 后台的门：两根金杆之间挂一幅深红的幕
    for (let i = 0; i < 12; i++) k.soft(wool(i % 2 ? 0x8f3f42 : 0x9c4a49), 0.5, 3.2, 0.16, -2.65 + i * 0.482, 1.62, CZ - Bz + 0.72, { r: 0.07, seg: 1 });
    P.valanceLine(k, wool(GOLD), [-2.9, CZ - Bz + 0.84], [2.9, CZ - Bz + 0.84], 3.3, 10, 0.34, { band: 0.08 });
    gift(-4.4, CZ - Bz + 1.5, 1.1, 1.0, 0.9, TEAL); gift(4.5, CZ - Bz + 1.45, 1.2, 1.0, 1.0, 0x8a6fa6); gift(-5.3, CZ - Bz + 2.3, 0.6, 0.6, 0.5, GOLD, RED);
    const strings = [0, 1, 2, 3].map(() => new PlushKit()), lamps = strings.map(() => lamp(0xffd884, 2.2));   // 灯串：分四组，开打以后一组一组地闪
    for (let j = 0; j < 12; j++) {
      const f = (j + 0.5) / 12, p = rimAt(f), ap = apex(p), from = [ap[0], ap[1] - 0.5, ap[2]], to = [p[0] * 0.93, WALL - 0.1, CZ + (p[1] - CZ) * 0.93];
      d.tube(felt(INK), [from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.5, (from[2] + to[2]) / 2], to], 0.012, { seg: 4, detail: 4 });
      for (let t = 1; t <= 4; t++) { const u = t / 4.6, y = from[1] + (to[1] - from[1]) * u - Math.sin(u * Math.PI) * 0.5; strings[(j + t) % 4].sphere(lamps[(j + t) % 4], 0.09, from[0] + (to[0] - from[0]) * u, y - 0.1, from[2] + (to[2] - from[2]) * u, { seg: 8, rings: 5 }); }
    }
    strings.forEach(kit => { const [mesh] = kit.build({ cast: false, name: 'tent-lights' }); arena.add(mesh); tentLights.push(mesh); });
    const pool = document.createElement('canvas'); pool.width = pool.height = 128;
    const poolContext = pool.getContext('2d'), falloff = poolContext.createRadialGradient(64, 64, 0, 64, 64, 64);
    falloff.addColorStop(0, '#fff'); falloff.addColorStop(.36, '#fffe');
    falloff.addColorStop(.7, '#fff6'); falloff.addColorStop(1, '#fff0');
    poolContext.fillStyle = falloff; poolContext.fillRect(0, 0, 128, 128);
    const lightPool = new T.MeshBasicMaterial({ color: 0xffd2a0, map: new T.CanvasTexture(pool), transparent: true,
      opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    spot = obj(arena, new T.CircleGeometry(2.65, 36), lightPool, CLOWN.x, .125, CLOWN.z);
    spot.rotation.x = -Math.PI / 2;
  }
  // 机关地砖：十五块活板。预警时角上竖起一颗布扣（急冻枪打它或打砖面都能冻住），到点往下翻，露出底下的暗坑
  const tileBack = Math.min(...TILES.map(t => t.z)) - TILE / 2, tileFront = Math.max(...TILES.map(t => t.z)) + TILE / 2;
  const pit = obj(arena, new T.PlaneGeometry(TILE * 5, tileFront - tileBack), new T.MeshBasicMaterial({ color: 0x191322 }), 0, 0.052, (tileBack + tileFront) / 2); pit.rotation.x = -Math.PI / 2;
  const flapMeshes = [0x9a7250, 0xb98a66].map(tone => {
    const kit = new PlushKit(), S = TILE - 0.06;
    kit.soft(P.timber(tone), S, 0.07, S, 0, -0.035, S / 2, { r: 0.02, seg: 1, long: 0 });
    for (const [w, dp, x, z] of [[S - 0.2, 0.07, 0, 0.14], [S - 0.2, 0.07, 0, S - 0.14], [0.07, S - 0.2, -S / 2 + 0.14, S / 2], [0.07, S - 0.2, S / 2 - 0.14, S / 2]]) kit.box(P.timber(tone === 0x9a7250 ? 0x7e5b40 : 0x9a7250), w, 0.012, dp, x, 0.004, z);
    kit.cyl(P.timber(0x6d4d37), 0.13, 0.13, 0.014, 0, 0.004, S - 0.36, { seg: 12 });   // 拉环
    return kit.build({ cast: false, name: 'tile' });
  });
  const warnMat = new T.MeshBasicMaterial({ color: 0xffca71, transparent: true, opacity: 0.9, depthWrite: false }), iceRingMat = new T.MeshBasicMaterial({ color: 0x97e8ff, transparent: true, opacity: 0.9, depthWrite: false });
  const ringGeo = new T.RingGeometry(0.62, 0.78, 28); ringGeo.rotateX(-Math.PI / 2);
  const plateGeo = new T.PlaneGeometry(TILE - 0.12, TILE - 0.12); plateGeo.rotateX(-Math.PI / 2);
  // 竖起来的布扣：一根米白的细杆顶着一枚扣子（四个扣眼），预警时是橙色，冻住了变冰蓝
  const tabStalk = (() => { const kit = new PlushKit(); kit.cyl(wool(WOOL_WHITE), 0.035, 0.05, 0.5, 0, 0.3, 0, { seg: 7 }); kit.cyl(wool(GOLD), 0.09, 0.11, 0.06, 0, 0.08, 0, { seg: 8 }); return kit.build({ cast: false, name: 'tab' }); })();
  const tabGeo = new T.CylinderGeometry(0.21, 0.21, 0.07, 18), holeGeo = new T.CylinderGeometry(0.03, 0.03, 0.08, 6), holeMat = new T.MeshBasicMaterial({ color: 0x5a3a30 });
  const tiles = TILES.map((point, i) => {
    const flap = group(arena, point.x, 0.108, point.z - TILE / 2 + 0.03);
    for (const mesh of flapMeshes[i % 2]) { const copyMesh = mesh.clone(); copyMesh.receiveShadow = true; flap.add(copyMesh); }
    const warning = obj(arena, ringGeo, warnMat, point.x, 0.125, point.z), plate = obj(arena, plateGeo, ghost(0x8ae6ff, 0.5), point.x, 0.13, point.z);
    const at = tileSwitch(point), tab = group(arena, at.x, 0, at.z), tabMat = lamp(0xff8d62, 1.1);
    for (const mesh of tabStalk) tab.add(mesh.clone());
    const button = group(tab, 0, at.y, 0); button.rotation.x = 1.1; obj(button, tabGeo, tabMat);
    for (const [hx, hz] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]]) obj(button, holeGeo, holeMat, hx, 0, hz);
    warning.visible = plate.visible = tab.visible = false;
    return { flap, warning, plate, tab, tabMat };
  });

  // ---------- 嬉笑小丑、他扔出来的三只惊喜盒、烟花、打倒后掉出来的高压马达 ----------
  // Keep one light in the scene throughout the level so the intro doesn't change the shader's light count.
  const stageKey = new T.PointLight(0xffd49a, 0, 7, 2);
  stageKey.position.set(CLOWN.x + .35, 4.65, CLOWN.z + 1.35);
  cine.scene.add(stageKey);
  const clown = createClown(P, M); arena.add(clown.root);
  const clownFrost = frost(arena, 1.25); clownFrost.scale.set(1, 1.35, 1);
  const eyeRing = obj(arena, new T.RingGeometry(0.74, 0.79, 36), new T.MeshBasicMaterial({ color: 0xffd982, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }), 0, CLOWN.maskY, CLOWN.z + 0.94);
  const springRing = new T.RingGeometry(0.7, 0.78, 32); springRing.rotateX(-Math.PI / 2);
  const boxes = Array.from({ length: 3 }, (_, i) => {
    const g = part(arena, kit => {   // 惊喜盒：礼物箱的样子，盒盖上一块弹簧垫
      const tone = i === 0 ? TEAL : RED;
      box(kit, knit(tone), 1.02, 0.5, 1.02, 0, 0.25, 0, 0.08); box(kit, wool(tone), 1.1, 0.14, 1.1, 0, 0.55, 0, 0.05);
      box(kit, wool(GOLD), 0.18, 0.64, 1.13, 0, 0.32, 0, 0.03); box(kit, wool(GOLD), 1.13, 0.64, 0.18, 0, 0.32, 0, 0.03);
      kit.cyl(wool(WOOL_WHITE), 0.36, 0.38, 0.07, 0, 0.655, 0, { seg: 18 }); P.star(kit, GOLD, 0.2, 0, 0.3, 0.52, 0, 0.04);
    }, 0, 0, 0, true);
    const landing = obj(arena, springRing, ghost(0xf3ac51, 0.85)), ready = obj(arena, springRing, ghost(0x91f0dd, 0.9));
    return { g, landing, ready };
  });
  const fireGeo = new T.SphereGeometry(0.14, 10, 7), blastGeo = new T.SphereGeometry(1, 12, 8), dangerGeo = new T.RingGeometry(1.0, 1.26, 32); dangerGeo.rotateX(-Math.PI / 2);
  const fireworks = Array.from({ length: 5 }, () => ({ glow: obj(arena, fireGeo, new T.MeshBasicMaterial({ color: 0xffc565 })), disc: obj(arena, dangerGeo, ghost(0xff8a5a, 0.75)), burst: obj(arena, blastGeo, ghost(0xffcf83, 0.55)) }));
  const motor = part(arena, kit => {   // 高压马达：青色的机壳、一圈圈散热片、金色的轴、顶上一颗会放电的球
    kit.cyl(knit(TEAL), 0.22, 0.22, 0.5, 0, 0, 0, { seg: 16, rx: Math.PI / 2 });
    for (let i = 0; i < 4; i++) kit.cyl(wool(0x2f6d77), 0.255, 0.255, 0.04, 0, 0, -0.18 + i * 0.12, { seg: 16, rx: Math.PI / 2 });
    kit.cyl(wool(GOLD), 0.08, 0.08, 0.26, 0, 0, 0.36, { seg: 10, rx: Math.PI / 2 }); kit.cyl(wool(GOLD), 0.15, 0.15, 0.06, 0, 0, 0.27, { seg: 12, rx: Math.PI / 2 });
    box(kit, wool(0x2f6d77), 0.34, 0.08, 0.4, 0, -0.25, 0, 0.03);
    kit.sphere(M.glow(0x9de3f4, 2.6), 0.1, 0, 0.3, 0, { seg: 9, rings: 6 }); kit.cyl(wool(GOLD), 0.03, 0.03, 0.1, 0, 0.23, 0, { seg: 6 });
  }, MOTOR.x, MOTOR.y, MOTOR.z, true);
  motor.visible = false;

  // ---------- 收尾：每块两组网格（主体投影，小装饰不投影、走远了关掉） ----------
  for (const [id, q] of zones) {
    const host = id === 'arena' ? arena : root;
    const main = q.s.build({ cast: true, name: 'quest:' + id }); if (main.length) host.add(...main);
    const extra = q.d.build({ cast: false, name: 'detail:' + id }); if (!extra.length) continue;
    host.add(...extra);
    const bounds = new T.Box3(); extra.forEach(m => { m.geometry.computeBoundingBox(); bounds.union(m.geometry.boundingBox); });
    details.push({ meshes: extra, x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2, r: Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2 });
  }
  root.traverse(o => { if (o.isMesh && o.material?.transparent) o.castShadow = false; });
  [clown.root, lock, ...gates[0].leaves, ...curtains, ...boxes.map(v => v.g)].forEach(g => cine.shadows.addDynamic(g));
  cine.shadows.invalidate();

  // ---------- 每帧：照规则层的状态摆 ----------
  const last = { inside: false };
  function update(s) {
    const a = s.amusement, time = s.time, c = a.clown;
    const eye = cine.camera.position;
    for (const q of details) { const on = Math.hypot(eye.x - q.x, eye.z - q.z) < q.r + DETAIL_RANGE; if (q.on !== on) { q.on = on; for (const m of q.meshes) m.visible = on; } }
    const won = a.pickedUp, fight = c.entered && c.defeatedAt === null ? 1 : 0, near = (x, z) => Math.hypot(eye.x - x, eye.z - z) < GATE_RANGE;
    porch.visible = near(TENT.x, TENT_DOOR);
    last.inside = !!fight;
    arena.visible = a.zone >= TENT_ZONE - 1 && Math.hypot(eye.x - TENT.x, eye.z - TENT.z) < 24;
    // 路上的门：开的时候两扇朝里转，柱顶的灯亮起来；离得远的不画
    gates.forEach((g, i) => {
      g.holder.visible = (i === a.zone || i === a.zone - 1) && near(g.x, g.z);   // 只画眼前这一站的两道门：要过的那道和刚过的那道
      const f = a.opened[i] !== null ? sat((time - a.opened[i]) / GATE_LIFT_SECONDS) : 0, turn = f * f * (3 - 2 * f) * 1.72;
      g.leaves[0].rotation.y = turn; g.leaves[1].rotation.y = -turn;
      light(g.lampMat, a.lit[i] ? [0xffce6b, 0xff8272, 0x8ef2dc][i % 3] : DIM, a.lit[i] ? 2.0 + (won ? 0.9 * Math.sin(time * 5 + i * 2.1) : 0.25 * Math.sin(time * 2.2 + i * 2.1)) : 0);
    });
    // 帐篷的门帘：这一站的门开了就拉开；人进去、小丑登场以后在身后合上（打完了再拉开）
    { const i = GATES.length - 1, f = a.opened[i] !== null ? sat((time - a.opened[i]) / GATE_LIFT_SECONDS) : 0, open = f * f * (3 - 2 * f) * (1 - fight);
      curtains.forEach(g => { g.scale.x = 1 - open * 0.8; }); }
    // 门栓
    lock.visible = a.lock !== 'open';
    const lp = lockPosition(a); lock.position.set(lp.x, lp.y, lp.z);
    light(lockLamp, a.lock === 'frozen' ? 0x9feaff : 0xd9584f, a.lock === 'frozen' ? 2.2 : 1.2);
    lockFrost.visible = a.lock === 'frozen';
    // 蒸汽阀：没冻住的时候一直冒汽
    const frozenValve = !a.valveLatched && a.valveUntil > time, venting = !a.valveLatched && !frozenValve && near(VALVE.x, VALVE.z);
    light(valveLamp, a.valveLatched ? 0xa4f89d : frozenValve ? 0x9feaff : 0xf2a367, 1.8);
    valveIce.visible = frozenValve;
    vapor.forEach((m, i) => {
      const phase = (time * 0.9 + i / vapor.length) % 1;
      m.visible = venting; m.scale.setScalar(0.5 + phase * 1.5);
      m.position.set(VALVE.x + Math.sin(phase * 5 + i) * 0.22, VALVE.y + 0.5 + phase * 1.5, VALVE.z - phase * 1.7 + Math.cos(i * 2.3) * 0.18);
      m.material.opacity = (1 - phase) * 0.5;
    });
    // 木马的气浪
    sweepRing.visible = a.carousel.ring > 0;
    if (sweepRing.visible) { const f = (a.carousel.ring - SWEEP.from) / (SWEEP.to - SWEEP.from); sweepRing.scale.set(a.carousel.ring, 1, a.carousel.ring); sweepRing.material.opacity = 0.75 * (1 - f * f); }
    // 轨道靶
    coasterTargets.forEach((t, i) => {
      const st = a.targets[i], pos = coasterTargetPosition(a, i), frozen = st.frozenUntil > time && !st.lit;
      t.g.visible = near(COASTER_TARGETS[i].x, COASTER_TARGETS[i].z);
      t.g.position.set(pos.x, pos.y, pos.z);
      light(t.rim, st.lit ? 0x8cf4ba : frozen ? 0x96e9ff : 0xffca72, st.lit ? 2.4 : 1.2); light(t.core, st.lit ? 0xffffff : 0xa83c48, st.lit ? 1.6 : 0.2);
      t.frost.visible = frozen;
    });
    // 小丑
    const cut = amusementCutscene(s);
    const intro = cut?.kind === 'clown-intro' ? cut.elapsed : null;
    const stageDarkness = intro === null ? 0 : T.MathUtils.smoothstep(intro, 0, .48) *
      (1 - T.MathUtils.smoothstep(intro, CLOWN_ENTRANCE.handoff, 4.9));
    const down = c.defeatedAt === null ? 0 : sat((time - c.defeatedAt) / 1.3), frozen = c.frozenUntil > time;
    const casting = !!a.volleys.length || a.boxes.some(b => !b.teaching && time < b.land) || a.fireworks.some(f => time < f.impact);
    clown.pose({ time, pose: c.poseTime, x: c.x, z: c.z, mask: c.mask, flash: c.flash > time, frozen, hidden: !c.entered, intro, casting, down });
    clownFrost.visible = frozen; clownFrost.position.set(c.x, 2.75, c.z + 0.1);
    eyeRing.position.x = c.x; eyeRing.visible = c.entered && !!c.mask && time < a.launchUntil && s.player.jump > 0.52;
    spot.position.x = c.x;
    const key = intro === null ? 0 : T.MathUtils.smoothstep(intro, CLOWN_ENTRANCE.spot, .9) * stageDarkness;
    spot.material.opacity = fight * .16 * (1 - stageDarkness) + .34 * key;
    spot.scale.setScalar(1 + key * .12);
    stageKey.intensity = 12 * key;
    tentLights.forEach((m, i) => { m.material.emissiveIntensity = (1 - .89 * stageDarkness) * 2.2 * (1 + (fight || won ? 0.9 + 0.7 * Math.sin(time * 5 + i * 1.6) : 0)); });
    motor.visible = c.defeatedAt !== null && !a.pickedUp;
    motor.rotation.y = time * 1.55; motor.position.y = MOTOR.y + Math.sin(time * 2.4) * 0.06;
    // 机关地砖
    for (let i = 0; i < tiles.length; i++) {
      const tile = a.tiles[i], r = tiles[i], frozenTile = tile.frozenUntil > time, off = tile.off > 0 && time >= tile.off && time < tile.until && !frozenTile;
      const warn = !off && tile.off > 0 && time >= tile.warn && time < tile.off;
      const swing = off ? sat((time - tile.off) / 0.22) : tile.off > 0 && time >= tile.until ? 1 - sat((time - tile.until) / 0.3) : 0;
      r.flap.rotation.x = swing * 1.5;
      r.warning.visible = frozenTile || warn; r.warning.material = frozenTile ? iceRingMat : warnMat;
      r.warning.scale.setScalar(1.02 + Math.sin(time * 13) * 0.1);
      r.plate.visible = frozenTile; r.tab.visible = frozenTile || warn; light(r.tabMat, frozenTile ? 0x90e6ff : 0xff8d62, 1.1 + (frozenTile ? 0 : Math.sin(time * 13) * 0.5));
    }
    // 惊喜盒：从小丑手里抛出来，落稳以后盒顶一圈青色的光，踩上去弹起来
    for (let i = 0; i < boxes.length; i++) {
      const v = boxes[i], b = a.boxes[i];
      const reveal = b?.teaching && intro !== null
        ? T.MathUtils.smoothstep(intro, CLOWN_ENTRANCE.handoff - .12, 4.65) : 1;
      v.g.visible = !!b && !b.used && reveal > .02;
      v.g.scale.setScalar(.74 + .26 * reveal); v.landing.visible = !!b && time < b.land; v.ready.visible = !!b && b.settled && !b.used && reveal > .5;
      if (!b) continue;
      const flight = b.settled ? 1 : sat((time - b.thrown) / (b.land - b.thrown));
      v.g.position.set(c.x + (b.x - c.x) * flight, 2.4 * (1 - flight) + 3.0 * Math.sin(Math.PI * flight), CLOWN.z + (b.z - CLOWN.z) * flight);
      v.g.rotation.set((1 - flight) * Math.sin(time * 8), i * 0.45, (1 - flight) * Math.sin(time * 7 + i));
      v.landing.position.set(b.x, 0.14, b.z); v.ready.position.set(b.x, 0.7, b.z); v.ready.scale.setScalar(0.56 + Math.sin(time * 5) * 0.05);
    }
    for (let i = 0; i < fireworks.length; i++) {
      const v = fireworks[i], f = a.fireworks[i];
      v.glow.visible = v.disc.visible = !!f && !f.spent; v.burst.visible = !!f && f.spent && time < f.impact + 0.33;
      if (!f) continue;
      const t = sat((time - f.created) / (f.impact - f.created));
      v.glow.position.set(c.x + (f.x - c.x) * t, 2.6 * (1 - t) + 5.2 * Math.sin(Math.PI * t), CLOWN.z + (f.z - CLOWN.z) * t);
      v.disc.position.set(f.x, 0.14, f.z); v.disc.scale.setScalar(0.7 + t * 0.3); v.disc.material.opacity = 0.35 + t * 0.5;
      const age = sat((time - f.impact) / 0.34);
      v.burst.position.set(f.x, 0.6, f.z); v.burst.scale.setScalar(0.35 + age * 1.3); v.burst.material.opacity = (1 - age) * 0.6;
    }
  }
  // inside：人在帐篷里、门帘合着（外面的园子一点都看不见，play.js 用它把园子整个关掉省开销）
  return { update, get inside() { return last.inside; } };
}
