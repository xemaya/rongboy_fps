// 会动的小东西：机关（闹钟、颜料桶、聚光灯）、拉链暗格，和被毛球打到会有反应的布景（吊灯、地球仪、小黄鸭、盆栽、骨架模型）。
// 规则在 game.js，这里只管样子和动效：机关用没用过、拉链开没开都看规则层的状态；布景的反应不影响任何规则（docs/fun-design.md 第 9 节）。
// 别的布景是合并成整块网格画的，动不了；这里的每一件单独一组网格，所以数量要省着用。
import * as T from 'three';
import { GADGETS } from './gadgets.js';

const PAINT = [0xf2a6b8, 0x8fc3e8, 0xf2c84b, 0x9fd8a4];

// Kit：造毛绒零件的工具；M：材质；label：画一块小名牌；floors：每层楼一个组（东西挂在所在的那一层上，换层时跟着隐藏）；
// floorY：每层楼地面的高度（组里的坐标都是相对这一层地面的）。
export function createToys({ Kit, M, label, floors, floorY }) {
  const toys = [], byOwner = new Map(), gadgets = new Map(), zippers = new Map();
  const made = (floor, build, x, y, z, name) => {
    const kit = new Kit(); build(kit);
    const g = new T.Group(); g.name = name; g.add(...kit.build({ name })); g.position.set(x, y, z); floors[floor].add(g); return g;
  };
  const toy = (t) => { toys.push(t); if (t.owner) byOwner.set(t.owner, [...(byOwner.get(t.owner) || []), t]); return t; };
  const tag = (text, y) => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: label(text, { width: 448, height: 96, size: 44 }), transparent: true, depthWrite: false }));
    s.scale.set(0.84, 0.18, 1); s.position.y = y; return s;
  };

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
    const o = { kind: g.kind, root, used: false, t: 0, tag: tag(`${G.name} · 打一下`, G.h + 0.3) };
    root.add(o.tag);
    if (g.kind === 'clock') {
      part(k => {   // 高脚凳
        k.cyl(M('toy_wood'), 0.21, 0.21, 0.05, 0, 0.905, 0, { seg: 14 });
        for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; k.tube(M('toy_wood'), [[Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], [Math.cos(a) * 0.12, 0.9, Math.sin(a) * 0.12]], 0.022, { seg: 6 }); }
        k.cyl(M('toy_wood'), 0.15, 0.15, 0.025, 0, 0.42, 0, { seg: 12 });
      });
      o.body = part(k => {   // 双铃闹钟：两面都有钟面
        k.cyl(M('felt', 0xd9584a), 0.17, 0.17, 0.11, 0, 0.21, 0, { seg: 20, rx: Math.PI / 2 });
        k.cyl(M.button(0xf6efe0), 0.14, 0.14, 0.125, 0, 0.21, 0, { seg: 20, rx: Math.PI / 2 });
        for (const s of [-1, 1]) {
          k.box(M.button(0x3d342c), 0.018, 0.1, 0.006, 0, 0.255, s * 0.066); k.box(M.button(0x3d342c), 0.075, 0.018, 0.006, 0.03, 0.21, s * 0.066);
          k.sphere(M.button(0xe9c46a), 0.07, s * 0.1, 0.41, 0, { seg: 10, rings: 8, sy: 0.7 }); k.cyl(M.button(0x8b7655), 0.012, 0.012, 0.06, s * 0.1, 0.36, 0, { seg: 6 });
          k.sphere(M.button(0x8b7655), 0.03, s * 0.11, 0.025, 0, { seg: 8, rings: 6 });
        }
        k.sphere(M.button(0x8b7655), 0.025, 0, 0.44, 0, { seg: 8, rings: 6 });
      }, 0.93);
    } else if (g.kind === 'bucket') {
      const paint = PAINT[Math.round(Math.abs(g.x * 3 + g.z * 7)) % PAINT.length];
      part(k => {   // 两只摞起来的木箱
        k.soft(M('boards', 0xc9a67a), 0.56, 0.42, 0.56, 0, 0.21, 0, { r: 0.03 }); k.soft(M('boards', 0xb98a66), 0.48, 0.42, 0.48, 0, 0.63, 0, { r: 0.03 });
      });
      o.body = part(k => {   // 一桶冒尖的颜料
        k.cyl(M.button(0xcfd6d8), 0.21, 0.16, 0.3, 0, 0.15, 0, { seg: 16 });
        k.sphere(M('felt', paint), 0.2, 0, 0.3, 0, { seg: 14, rings: 8, sy: 0.4 });
        for (let i = 0; i < 5; i++) { const a = i * 1.3; k.sphere(M('felt', paint), 0.045, Math.cos(a) * 0.2, 0.25 - (i % 2) * 0.08, Math.sin(a) * 0.2, { seg: 8, rings: 6, sy: 1.5 }); }
        k.tube(M.button(0x8b7655), Array.from({ length: 9 }, (_, i) => [Math.cos(i / 8 * Math.PI) * 0.21, 0.28 + Math.sin(i / 8 * Math.PI) * 0.14, 0]), 0.01, { seg: 5 });
      }, 0.84);
      o.splat = part(k => {   // 炸开以后留在地上的一摊
        k.cyl(M('felt', paint), 0.9, 0.9, 0.014, 0, 0.012, 0, { seg: 20 });
        for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 1.0 + (i % 4) * 0.33, r = 0.16 + (i % 3) * 0.1; k.cyl(M('felt', i % 2 ? paint : PAINT[(i + 1) % PAINT.length]), r, r, 0.014, Math.cos(a) * d, 0.012, Math.sin(a) * d, { seg: 12 }); }
      });
      o.splat.visible = false; o.paint = paint;
    } else if (g.kind === 'spot') {
      part(k => {   // 三脚架
        for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.4; k.tube(M('toy_wood'), [[Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23], [0, 1.46, 0]], 0.02, { seg: 6 }); }
        k.cyl(M('felt', 0x4a4f55), 0.1, 0.17, 0.26, 0, 1.56, 0, { seg: 16 });
        k.cyl(M('felt', 0x3d342c), 0.05, 0.05, 0.08, 0, 1.47, 0, { seg: 8 });
      });
      // 灯口和地上的光圈：亮度要单独调，所以各用自己的材质
      o.lens = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.02, 20), new T.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffe6a0, emissiveIntensity: 0.6 }));
      o.lens.position.y = 1.435; root.add(o.lens);
      o.ring = new T.Mesh(new T.TorusGeometry(G.radius, 0.022, 6, 96), new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd060, emissiveIntensity: 1.1 }));
      o.ring.rotation.x = Math.PI / 2; o.ring.position.y = 0.035; root.add(o.ring);
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
  function fire(e) { const o = gadgets.get(e.id); if (!o) return null; o.used = true; o.t = 0; o.tag.visible = false; return o; }
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
      if (!o.used) { if (o.kind === 'clock') o.body.rotation.z = Math.sin(time * 1.3) * 0.02; continue; }
      o.t += dt;
      if (o.kind === 'clock') {
        const ringing = o.t < GADGETS.clock.time;
        o.body.rotation.z = ringing ? Math.sin(o.t * 52) * 0.11 : Math.min(0.55, o.body.rotation.z + dt * 2);   // 响的时候直哆嗦，响完歪倒在凳子上
        o.body.position.x = ringing ? Math.sin(o.t * 37) * 0.012 : 0.05;
      } else if (o.kind === 'bucket') {
        o.body.visible = false; o.splat.visible = true;
        const s = Math.min(1, o.t / 0.25); o.splat.scale.set(s, 1, s);
      } else if (o.kind === 'spot') {
        o.lens.material.emissiveIntensity = o.t < GADGETS.spot.stun ? 9 * Math.max(0.25, 1 - o.t / GADGETS.spot.stun) : 0.02;   // 亮一下，慢慢暗下去，然后灭了
        o.ring.visible = o.t < GADGETS.spot.stun; o.ring.material.emissiveIntensity = 6 * Math.max(0, 1 - o.t / GADGETS.spot.stun);
      }
    }
    for (const z of zippers.values()) z.pull.rotation.z = z.isOpen ? 0 : Math.sin(time * 1.7 + z.phase) * 0.3;
  }

  // 新开一局：机关复原，拉链合上
  function reset() {
    for (const o of gadgets.values()) {
      o.used = false; o.t = 0; o.tag.visible = true;
      if (o.body) { o.body.visible = true; o.body.rotation.set(0, 0, 0); o.body.position.x = 0; }
      if (o.splat) o.splat.visible = false;
      if (o.lens) { o.lens.material.emissiveIntensity = 0.6; o.ring.visible = true; o.ring.material.emissiveIntensity = 1.1; }
    }
    for (const z of zippers.values()) { z.isOpen = false; z.shut.visible = true; z.open.visible = false; z.pull.position.y = 0.46; }
    for (const t of toys) { if ('ax' in t) { t.ax = t.az = t.vx = t.vz = 0; t.group.rotation.set(0, 0, 0); } if (t.kind === 'duck') { t.h = t.vy = 0; t.group.position.y = t.baseY; } if (t.kind === 'globe') t.w = 0; }
  }

  return { lamp, duck, plant, globe, rattler, gadget, zipper, react, sweep, fire, unzip, update, reset, gadgets, zippers, toys };
}
