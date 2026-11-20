// 会动的小东西：机关（闹钟、颜料桶、聚光灯）、拉链暗格，和被毛球打到会有反应的布景（吊灯、地球仪、小黄鸭、盆栽、骨架模型）。
// 规则在 game.js，这里只管样子和动效：机关用没用过、拉链开没开都看规则层的状态；布景的反应不影响任何规则（docs/fun-design.md 第 9 节）。
// 别的布景是合并成整块网格画的，动不了；这里的每一件单独一组网格，所以数量要省着用。
import * as T from 'three';
import { GADGETS } from './gadgets.js';

const PAINT = [0xec7499, 0x80bed8, 0xf4bf61, 0x94ce8b];
const linear = (a, b, t) => T.MathUtils.clamp((t-a)/(b-a),0,1);
const ease = (a, b, t) => T.MathUtils.smoothstep(t,a,b);
const hop = (a, b, t) => Math.sin(Math.PI * linear(a,b,t));

// Kit：造毛绒零件的工具；M：材质；floors：每层楼一个组（东西挂在所在的那一层上，换层时跟着隐藏）；
// floorY：每层楼地面的高度（组里的坐标都是相对这一层地面的）。
export function createToys({ Kit, M, floors, floorY }) {
  const toys = [], byOwner = new Map(), gadgets = new Map(), zippers = new Map();
  const made = (floor, build, x, y, z, name) => {
    const kit = new Kit(); build(kit);
    const g = new T.Group(); g.name = name; g.add(...kit.build({ name })); g.position.set(x, y, z); floors[floor].add(g); return g;
  };
  const toy = (t) => { toys.push(t); if (t.owner) byOwner.set(t.owner, [...(byOwner.get(t.owner) || []), t]); return t; };
  // ---------- 布景 ----------
  // 吊灯：挂点在天花板上，整盏灯绕挂点摆。返回灯泡的位置（烘焙光照用）。
  function lamp(floor, { x, z, ceiling, drop = 0.6, color = 0xffd9a0 }) {
    const g = made(floor, k => {
      k.cyl(M('toy_wood'), 0.05, 0.05, 0.03, 0, -0.015, 0, { seg: 10 });
      k.cyl(M('toy_wood'), 0.008, 0.008, drop - 0.2, 0, -(drop - 0.2) / 2, 0, { seg: 5 });
      k.cyl(M.glow(color, 1.5), 0.1, 0.3, 0.24, 0, -drop + 0.08, 0, { seg: 18 });
      k.sphere(M.glow(0xfff0c8, 5), 0.075, 0, -drop - 0.03, 0, { seg: 10, rings: 8 });
    }, x, ceiling, z, 'lamp');
    toy({ kind: 'lamp', group: g, floor, touch: { x, z, r: 0.4, y: ceiling - drop - 0.25, h: 0.8 }, ax: 0, az: 0, vx: 0, vz: 0 });
    return { x, y: ceiling - drop - 0.06, z };
  }
  // 浴缸里的小黄鸭：被打到会蹦起来转两圈
  function duck(floor, owner, x, y, z) {
    const g = made(floor, k => {
      k.sphere(M('felt', 0xf2cf62), 0.085, 0, 0, 0, { seg: 10, rings: 8, sy: 0.8 });
      k.sphere(M('felt', 0xf2cf62), 0.055, 0.07, 0.08, 0, { seg: 8, rings: 6 });
      k.sphere(M.button(0xe58b3a), 0.022, 0.125, 0.075, 0, { seg: 6, rings: 4 });
    }, x, y, z, 'duck');
    toy({ kind: 'duck', owner, group: g, floor, touch: { x, z, r: 0.22, y: y - 0.12, h: 0.4 }, baseY: y, h: 0, vy: 0, spin: 0 });
  }
  // 矮柜上的盆栽：被打到来回晃
  function plant(floor, owner, x, y, z, rnd) {
    const g = made(floor, k => {
      k.cyl(M.button(0xd08a66), 0.07, 0.055, 0.1, 0, 0.05, 0, { seg: 10 });
      for (let i = 0; i < 5; i++) k.sphere(M('terry', 0x6f9a5e), 0.05 + rnd() * 0.03, (rnd() - 0.5) * 0.1, 0.14 + rnd() * 0.1, (rnd() - 0.5) * 0.1, { seg: 8, rings: 6 });
    }, x, y, z, 'plant');
    toy({ kind: 'plant', owner, group: g, floor, touch: { x, z, r: 0.22, y, h: 0.4 }, ax: 0, az: 0, vx: 0, vz: 0 });
  }
  // 展台上的地球仪：被打到转起来，慢慢停
  function globe(floor, owner, x, y, z, s) {
    const g = made(floor, k => {
      k.cyl(M('toy_wood'), 0.14 * s, 0.18 * s, 0.05 * s, 0, 0.025 * s, 0, { seg: 12 }); k.cyl(M('toy_wood'), 0.03 * s, 0.03 * s, 0.2 * s, 0, 0.15 * s, 0, { seg: 8 });
      k.sphere(M('felt', 0x6f9fc8), 0.3 * s, 0, 0.52 * s, 0, { seg: 16, rings: 12 });
      for (const [a, b, r] of [[0.4, 0.3, 0.13], [2.2, -0.2, 0.16], [3.6, 0.5, 0.1], [5.0, -0.1, 0.14], [1.2, -0.6, 0.09]])
        k.sphere(M('felt', 0x86ab6c), r * s, Math.cos(a) * Math.cos(b) * 0.25 * s, (0.52 + Math.sin(b) * 0.25) * s, Math.sin(a) * Math.cos(b) * 0.25 * s, { seg: 8, rings: 6 });
      k.cyl(M.button(0xe9c46a), 0.31 * s, 0.31 * s, 0.02 * s, 0, 0.51 * s, 0, { seg: 20 });
    }, x, y, z, 'globe');
    toy({ kind: 'globe', owner, group: g, floor, touch: { x, z, r: 0.36 * s, y: y + 0.15 * s, h: 0.75 * s }, w: 0 });
  }
  // 整件东西单独一组、被打到会抖（骨架模型）：build 在原点造它，这里把它摆到位
  function rattler(floor, owner, x, z, build, top = 1.9) {
    const g = made(floor, build, x, 0, z, 'rattler');
    toy({ kind: 'rattler', owner, group: g, floor, touch: { x, z, r: 0.34, y: 0.2, h: top }, t: 9 });
  }

  // ---------- 机关 ----------
  function gadget(g) {
    const G = GADGETS[g.kind], root = new T.Group(); root.name = 'gadget-' + g.kind; root.position.set(g.x, 0, g.z); floors[g.floor].add(root);
    const part = (build, y = 0) => { const kit = new Kit(); build(kit); const o = new T.Group(); o.add(...kit.build({ name: 'gadget' })); o.position.y = y; root.add(o); return o; };
    const o = { kind: g.kind, root, used: false, t: 0 };
    if (g.kind === 'clock') {
      part(k => {   // 高脚凳
        k.cyl(M('toy_wood'), 0.21, 0.21, 0.05, 0, 0.905, 0, { seg: 14 });
        for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; k.tube(M('toy_wood'), [[Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], [Math.cos(a) * 0.12, 0.9, Math.sin(a) * 0.12]], 0.022, { seg: 6 }); }
        k.cyl(M('toy_wood'), 0.15, 0.15, 0.025, 0, 0.42, 0, { seg: 12 });
      });
      o.body = part(k => {   // 双铃闹钟：两面都有钟面
        k.cyl(M('felt', 0xd9584a), 0.18, 0.18, 0.13, 0, 0.21, 0, { seg: 20, rx: Math.PI / 2 });
        k.cyl(M.button(0xf6efe0), 0.14, 0.14, 0.125, 0, 0.21, 0, { seg: 20, rx: Math.PI / 2 });
        for (const s of [-1, 1]) {
          k.box(M.button(0x3d342c), 0.018, 0.1, 0.006, 0, 0.255, s * 0.066); k.box(M.button(0x3d342c), 0.075, 0.018, 0.006, 0.03, 0.21, s * 0.066);
          k.cyl(M.button(0x8b7655), 0.012, 0.012, 0.06, s * 0.1, 0.36, 0, { seg: 6 });
          k.sphere(M.button(0x8b7655), 0.03, s * 0.11, 0.025, 0, { seg: 8, rings: 6 });
        }
        k.sphere(M.button(0x8b7655), 0.025, 0, 0.44, 0, { seg: 8, rings: 6 });
      }, 0.93);
      o.bells = [-1,1].map(s => {
        const bell = part(k => k.sphere(M.button(0xe9c46a), .077, 0, .03, 0, { seg:12,rings:8,sy:.72 }));
        o.body.add(bell); bell.position.set(s*.106,.377,0);
        return bell;
      });
    } else if (g.kind === 'bucket') {
      const paint = PAINT[0];
      part(k => {   // 两只摞起来的木箱
        k.soft(M('boards', 0xc9a67a), 0.56, 0.42, 0.56, 0, 0.21, 0, { r: 0.03 }); k.soft(M('boards', 0xb98a66), 0.48, 0.42, 0.48, 0, 0.63, 0, { r: 0.03 });
      });
      o.body = part(k => {   // 一桶冒尖的颜料
        k.cyl(M.button(0xcfd6d8), 0.21, 0.16, 0.3, 0, 0.15, 0, { seg: 16 });
        k.sphere(M('felt', paint), 0.2, 0, 0.3, 0, { seg: 14, rings: 8, sy: 0.4 });
        for (let i = 0; i < 5; i++) { const a = i * 1.3; k.sphere(M('felt', paint), 0.045, Math.cos(a) * 0.2, 0.25 - (i % 2) * 0.08, Math.sin(a) * 0.2, { seg: 8, rings: 6, sy: 1.5 }); }
        k.tube(M.button(0x8b7655), Array.from({ length: 9 }, (_, i) => [Math.cos(i / 8 * Math.PI) * 0.21, 0.28 + Math.sin(i / 8 * Math.PI) * 0.14, 0]), 0.01, { seg: 5 });
      }, 0.84);
      o.splat = part(k => {
        // Soft paint pieces with overlapping irregular edges follow the fall direction.
        for (let i = 0; i < 12; i++) {
          const a = i * 2.4, d = 0.18 + (i % 5)*.22, r = .13 + (i % 4)*.072;
          k.sphere(M('felt', i%4 ? paint : PAINT[1 + i%3]), r, Math.cos(a)*d, .029+i*.002, .57+Math.sin(a)*d, {seg:12,rings:8,sx:1.2,sy:.075,sz:1.45});
        }
      });
      const dropGeo = new T.IcosahedronGeometry(1,1);
      o.drops = Array.from({length:14},(_,i) => {
        const drop = new T.Mesh(dropGeo,M('felt',PAINT[i%PAINT.length]));
        root.add(drop); drop.visible = false;
        return drop;
      });
      o.splat.visible = false;
    } else if (g.kind === 'spot') {
      const headY = G.h - .19;
      part(k => {
        for (let i = 0; i < 3; i++) {
          const a = i*Math.PI*2/3+.4;
          k.tube(M('toy_wood'),[[Math.cos(a)*.24,0,Math.sin(a)*.24],[0,headY-.12,0]],.024,{seg:6});
        }
        k.sphere(M.button(0x9b7b54),.09,0,headY-.12,0,{seg:10,rings:8});
      });
      o.body = part(k => {
        k.cyl(M('felt',0x505358),.124,.216,.26,0,.04,0,{seg:18});
        k.cyl(M.button(0xb89159),.221,.221,.038,0,-.089,0,{seg:18});
      },headY);
      o.lens = new T.Mesh(new T.CylinderGeometry(.179,.179,.024,20),
        new T.MeshStandardMaterial({color:0xf3ddb0, emissive:0xffcf82, emissiveIntensity:.22}));
      o.lens.position.y = -.11; o.body.add(o.lens);
      // Real light with a shadow map keeps the floor, cases and characters in the same beam.
      o.light = new T.SpotLight(0xffd697,0,Math.hypot(G.radius,G.lightY)+.75,Math.atan2(G.radius,G.lightY),.28,1.2);
      o.light.position.y = G.lightY;
      o.light.castShadow = true;
      o.light.shadow.mapSize.set(512,512);
      // Prime the shadow map during loading, then stop redraws while the lamp is off.
      o.light.shadow.autoUpdate = false;
      o.light.shadow.needsUpdate = true;
      o.light.shadow.camera.near = .1;
      o.light.shadow.normalBias = .023;
      o.light.target.position.y = .02;
      root.add(o.light, o.light.target);
    } else if (g.kind === 'quilt') {
      part(k => {
        const end = G.w*.5+.08;
        for (const side of [-1,1]) {
          k.tube(M('toy_wood'),[[side*end,0,0],[side*end,G.h+.05,0]],.045,{seg:7});
          k.sphere(M.button(0xe3bc7b),.067,side*end,G.h+.066,0,{seg:10,rings:8});
        }
        k.tube(M('knit',0xf0deaf),[[-end,G.h,0],[0,G.h-.1,0],[end,G.h,0]],.025,{seg:6});
      });
      o.body = part(k => {
        const w = G.w - .09, h = G.h - G.minY;
        k.soft(M('quilt',0xbd665b),w,h,.09,0,-h/2,0,{r:.042,seg:3});
        for (const side of [-1,1]) {
          for (const x of [-.91,-.3,.3,.91]) {
            k.soft(M('gingham',0xf4d29e),.56,.57,.022,x,-h/2,side*.051,{r:.008});
            k.soft(M('felt',0xa2767a),.21,.21,.022,x,-h/2,side*.067,{r:.008,rz:Math.PI/4});
          }
          k.tube(M('knit',0xf2d5a8),[[-1.24,-h+.07,side*.05],[0,-h+.09,side*.05],[1.24,-h+.07,side*.05]],.016,{seg:6});
        }
      },G.h-.045);
      o.clips = [-.94,.94].map(x => {
        const peg = part(k => k.soft(M('toy_wood'),.075,.23,.11,0,0,0,{r:.016}));
        peg.position.set(x,G.h-.07,0); return peg;
      });
    }
    gadgets.set(g.id, o);
    return o;
  }

  // ---------- 拉链暗格 ----------
  // k：藏着东西的拾取物（k.stash = { x, z, normal }：拉链在墙面上的位置和朝屋里的方向）
  function zipper(k) {
    const root = new T.Group(), [nx, nz] = k.stash.normal || [0, 1]; root.name = 'zipper';
    root.position.set(k.stash.x, 1.2, k.stash.z); root.rotation.y = Math.atan2(nx, nz); floors[k.floor].add(root);
    const part = build => { const kit = new Kit(); build(kit); const o = new T.Group(); o.add(...kit.build({ name: 'zipper', cast: false })); root.add(o); return o; };
    const gold = M.button(0xe9c46a), tape = M('felt', 0xc65a4e);
    const shut = part(q => {
      q.soft(tape, 0.2, 0.92, 0.02, 0, 0, 0.012, { r: 0.008 });
      for (let i = 0; i < 15; i++) q.box(gold, 0.055, 0.03, 0.02, (i % 2 ? 0.012 : -0.012), -0.4 + i * 0.057, 0.03);
    });
    const open = part(q => {
      q.soft(M('felt', 0x2f2622), 0.34, 0.88, 0.012, 0, 0, 0.008, { r: 0.006 });
      for (const s of [-1, 1]) {
        q.soft(tape, 0.11, 0.92, 0.02, s * 0.2, 0, 0.03, { r: 0.008, ry: s * 0.5 });
        for (let i = 0; i < 15; i++) q.box(gold, 0.03, 0.03, 0.02, s * 0.155, -0.4 + i * 0.057, 0.05);
      }
    });
    open.visible = false;
    const pull = part(q => { q.box(gold, 0.045, 0.11, 0.012, 0, -0.07, 0); q.sphere(gold, 0.022, 0, 0, 0, { seg: 8, rings: 6 }); });
    pull.position.set(0, 0.46, 0.045);
    zippers.set(k.id, { root, shut, open, pull, phase: k.id * 1.7, isOpen: false });
  }

  // ---------- 反应 ----------
  // 它们的碰撞盒只有底座那么高（或者根本没有，比如吊灯），平射的毛球会从上面飞过去。所以不看碰撞，看样子：
  // 毛球飞进它的轮廓（touch：一个立着的圆柱）就算碰到。球照样往前飞，不反弹：这只是画面上的反应。
  function nudge(t, dx, dz, x, z) {
    t.cool = 0.35;
    if (t.kind === 'lamp') { t.vx += dz * 2.6; t.vz -= dx * 2.6; }
    else if (t.kind === 'duck') { t.vy = 2.6; t.spin = 14 * (dx >= 0 ? 1 : -1); }
    else if (t.kind === 'plant') { t.vx += dz * 5; t.vz -= dx * 5; }
    else if (t.kind === 'globe') t.w += ((x - t.touch.x) * dz - (z - t.touch.z) * dx >= 0 ? 1 : -1) * 16;
    else if (t.kind === 'rattler') t.t = 0;
  }
  // 每帧对每个毛球问一次。返回被碰到的那件（没有就是 null）。
  function sweep(b, floor) {
    for (const t of toys) {
      const c = t.touch;
      if (t.floor !== floor || t.cool > 0 || Math.hypot(b.x - c.x, b.z - c.z) > c.r + b.r) continue;
      const y = b.y - floorY[t.floor];
      if (y < c.y - b.r || y > c.y + c.h + b.r) continue;
      nudge(t, b.dx, b.dz, b.x, b.z);
      return t;
    }
    return null;
  }
  // 毛球打在底座上（bounce 事件）也算
  function react(e, dx = 0, dz = 0) {
    const hit = (byOwner.get(e.solid?.id) || []).filter(t => !(t.cool > 0));
    for (const t of hit) nudge(t, dx, dz, e.x, e.z);
    return hit[0] || null;
  }
  // 机关触发（gadget 事件）
  function fire(e) { const o = gadgets.get(e.id); if (!o) return null; o.used = true; o.t = 0; return o; }
  function land(e) {
    const o = gadgets.get(e.id);
    if (o) o.landed = e.struck.length ? 'caught' : 'floor';
  }
  let quiltCover;
  function cover() {
    if (!quiltCover) {
      const k = new Kit(), cloth = M('quilt',0xbd665b), trim = M('gingham',0xf4d29e);
      // Rounded shoulders with an uneven hem, open below so shoes can still be seen.
      k.sphere(cloth, .5, 0, .62, 0, {seg:18,rings:12,sx:1.18,sy:.69,sz:1.05});
      for (const side of [-1,1]) {
        k.soft(cloth,1.02,.55,.075,0,.29,side*.415,{r:.034,rx:side*.18,rz:side*.045});
        k.soft(trim,.81,.35,.026,-.016,.32,side*.455,{r:.01,rx:side*.18,rz:side*.045});
        k.soft(M('felt',0xa2767a),.18,.18,.022,.13,.39,side*.476,{r:.008,rz:Math.PI/4});
        k.soft(cloth,.085,.53,.71,side*.52,.29,0,{r:.027,rz:side*.14});
      }
      quiltCover = new T.Group();
      quiltCover.add(...k.build({name:'quilt-cover'}));
    }
    return quiltCover.clone(true);
  }
  let paintFlecks;
  function makePaintFlecks() {
    if (!paintFlecks) {
      const k = new Kit();
      for (const [i,x,y,z] of [[0,-.39,.51,.84],[1,.31,.66,.85],[0,.64,.39,.83],[2,-.71,.83,.46],[1,.57,.91,.55],[3,.19,.35,.65]]) {
        k.sphere(M('felt',PAINT[i]), .1, x,y,z, {seg:9,rings:6,sy:.39+i*.16,sz:.44});
      }
      paintFlecks = new T.Group();
      paintFlecks.add(...k.build({name:'paint-flecks'}));
    }
    return paintFlecks.clone(true);
  }
  function unzip(id) { const z = zippers.get(id); if (!z || z.isOpen) return; z.isOpen = true; z.shut.visible = false; z.open.visible = true; z.pull.position.y = -0.46; }

  function update(dt, time) {
    const spring = (t, w, damp) => { for (const a of ['x', 'z']) { t['v' + a] += (-w * w * t['a' + a] - 2 * damp * w * t['v' + a]) * dt; t['a' + a] += t['v' + a] * dt; } };
    for (const t of toys) {
      t.cool = Math.max(0, (t.cool || 0) - dt);
      if (t.kind === 'lamp') {
        if (Math.abs(t.ax) + Math.abs(t.az) + Math.abs(t.vx) + Math.abs(t.vz) < 1e-4) continue;
        spring(t, 4.0, 0.07); t.ax = Math.max(-0.9, Math.min(0.9, t.ax)); t.az = Math.max(-0.9, Math.min(0.9, t.az));
        t.group.rotation.set(t.ax, 0, t.az);
      } else if (t.kind === 'plant') {
        if (Math.abs(t.ax) + Math.abs(t.az) + Math.abs(t.vx) + Math.abs(t.vz) < 1e-4) continue;
        spring(t, 11, 0.12); t.ax = Math.max(-0.5, Math.min(0.5, t.ax)); t.az = Math.max(-0.5, Math.min(0.5, t.az));
        t.group.rotation.set(t.ax, 0, t.az);
      } else if (t.kind === 'duck') {
        if (t.h <= 0 && t.vy <= 0) continue;
        t.vy -= 9 * dt; t.h += t.vy * dt; t.group.rotation.y += t.spin * dt;
        if (t.h <= 0) { t.h = 0; t.vy = t.vy < -1.2 ? -t.vy * 0.35 : 0; t.spin *= 0.4; }
        t.group.position.y = t.baseY + t.h;
      } else if (t.kind === 'globe') {
        if (Math.abs(t.w) < 0.02) continue;
        t.group.rotation.y += t.w * dt; t.w *= Math.exp(-dt * 0.7);
      } else if (t.kind === 'rattler') {
        if (t.t > 1.2) continue;
        t.t += dt;
        const k = Math.exp(-t.t * 4.5);
        t.group.rotation.set(Math.sin(t.t * 41) * 0.03 * k, Math.sin(t.t * 33) * 0.09 * k, Math.sin(t.t * 37) * 0.03 * k);
      }
    }
    for (const o of gadgets.values()) {
      if (!o.used) continue;
      o.t += dt;
      const t = o.t;
      if (o.kind === 'clock') {
        const ringing = t < GADGETS.clock.time;
        o.body.rotation.z = ringing ? .32*hop(0,.33,t) + Math.sin(t*39)*.065 : .30*ease(GADGETS.clock.time,GADGETS.clock.time+.4,t);
        o.body.position.set(ringing ? Math.sin(t*37)*.014 : .035, .93 + .19*hop(0,.42,t) + .04*hop(.42,.65,t), 0);
        o.bells.forEach((bell,i) => { bell.rotation.z = ringing ? Math.sin(t*43+i*2.3)*.39 : 0; });
      } else if (o.kind === 'bucket') {
        const flip = ease(.09,.53,t);
        o.body.position.set(.09*flip,.84-.64*flip,.63*flip);
        o.body.rotation.x = 1.64*flip;
        o.body.scale.set(1+.17*hop(0,.21,t),1-.30*hop(0,.21,t),1+.14*hop(0,.21,t));
        const spread = ease(.15,.57,t);
        o.splat.visible = spread > 0;
        o.splat.scale.set(Math.max(.01,spread),1,Math.max(.01,spread));
        o.drops.forEach((drop,i) => {
          const p = linear(.07+i*.007,.47+i%4*.047,t), a = i*2.399, r = .5 + i%6*.18;
          drop.visible = p > 0 && p < 1;
          drop.position.set(Math.cos(a)*p*r,1.13*(1-p)+(.62+i%4*.14)*hop(0,1,p),.52*p+Math.sin(a)*p*r);
          drop.scale.set(.08,.14,.065);
          drop.rotation.set(p*4+i,p*3,0);
        });
      } else if (o.kind === 'spot') {
        const gain = ease(0,.16,t) * (1-ease(2.65,GADGETS.spot.stun,t));
        o.body.rotation.x = .31*hop(0,.34,t);
        o.light.intensity = 46*gain;
        if (gain > 0) o.light.shadow.needsUpdate = true;
        o.lens.material.emissiveIntensity = .22+6.5*gain;
      } else if (o.kind === 'quilt') {
        const G = GADGETS.quilt, fall = linear(0,G.fall,t), settle = ease(G.fall*.73,G.fall+.15,t);
        o.clips.forEach((peg,i) => {
          peg.rotation.z = (i ? -1 : 1)*1.23*ease(0,.14,t);
          peg.position.y = G.h-.07+.14*hop(0,.26,t);
        });
        o.body.position.y = G.h-.045 - (G.h-.13)*fall*fall;
        o.body.rotation.x = Math.sin(t*16)*.24*hop(0,G.fall,t) + 1.54*settle;
        o.body.scale.z = 1 + .31*hop(0,G.fall,t);
        o.body.visible = o.landed !== 'caught';
      }
    }
    for (const z of zippers.values()) z.pull.rotation.z = z.isOpen ? 0 : Math.sin(time * 1.7 + z.phase) * 0.3;
  }

  // 新开一局：机关复原，拉链合上
  function reset() {
    for (const o of gadgets.values()) {
      o.used = false; o.t = 0; o.landed = null;
      o.body.visible = true; o.body.rotation.set(0,0,0); o.body.scale.setScalar(1);
      if (o.kind === 'clock') {
        o.body.position.set(0,.93,0);
        for (const bell of o.bells) bell.rotation.z = 0;
      } else if (o.kind === 'bucket') {
        o.body.position.set(0,.84,0);
        o.splat.visible = false;
        for (const drop of o.drops) drop.visible = false;
      } else if (o.kind === 'spot') {
        o.lens.material.emissiveIntensity = .22; o.light.intensity = 0;
      } else if (o.kind === 'quilt') {
        o.body.position.y = GADGETS.quilt.h-.045;
        for (const peg of o.clips) { peg.rotation.z = 0; peg.position.y = GADGETS.quilt.h-.07; }
      }
    }
    for (const z of zippers.values()) { z.isOpen = false; z.shut.visible = true; z.open.visible = false; z.pull.position.y = 0.46; }
    for (const t of toys) { if ('ax' in t) { t.ax = t.az = t.vx = t.vz = 0; t.group.rotation.set(0, 0, 0); } if (t.kind === 'duck') { t.h = t.vy = 0; t.group.position.y = t.baseY; } if (t.kind === 'globe') t.w = 0; }
  }

  return { lamp, duck, plant, globe, rattler, gadget, zipper, react, sweep, fire, land, cover, makePaintFlecks, unzip, update, reset, gadgets, zippers, toys };
}
