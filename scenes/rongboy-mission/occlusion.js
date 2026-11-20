// 墙后面的小物件不画。
// 整块的墙、地板、家具是按材质合并成几十块网格画的，多画一点不贵；但吊灯、盆栽、机关、拉链暗格、地上的枪和弹药这些会动的小东西
// 各是一组单独的网格——一张图上一百多次绘制，而任何时候眼前看得见的只有几件。差一点的机器上，每一次绘制都是实打实的开销。
//
// 做法：从眼睛往每件东西的包围盒连线（中心、六个面心、八个角，共 15 条），只要有一条不被挡就画；全被挡住，过 HOLD 秒再藏。
// 挡不挡只认墙和楼板——world.js 搭墙时把每一段墙、每一块天花板的盒子原样记下来（窗洞、门洞已经切掉，所以隔着窗能看见的照样画），
// 各面往里缩 2 厘米。家具不算挡的东西：它画出来比碰撞盒小，拿盒子去挡会把本来露在外面的藏掉。宁可多画，不能错藏。
//
// 省着算：看得见的每帧都查（通常第一条线就通）；看不见的分成 STAGGER 批轮流查，所以一件东西从墙后转出来最多晚 STAGGER 帧出现。
// NEAR 米以内的一律画。一帧几万次线段和盒子的相交，零点几毫秒。
//
// 这里只管"藏不藏"：每件东西外面套一层空的组，藏的是这层组，东西自己的 visible 仍归玩法管（被捡走、机关用过、暗格没拉开）。
import * as T from 'three';

const HOLD = 0.45, NEAR = 3, STAGGER = 3;
const _box = new T.Box3();

// boxes：[[minX, minY, minZ, maxX, maxY, maxZ], ...]，墙和楼板
export function createOcclusion(boxes, { enabled = true } = {}) {
  const B = new Float32Array(boxes.length * 6);
  boxes.forEach((b, i) => B.set(b, i * 6));
  const NB = boxes.length;
  // 线段 a→b 有没有被哪个盒子挡住
  function blocked(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const lx = Math.min(ax, bx), hx = Math.max(ax, bx), ly = Math.min(ay, by), hy = Math.max(ay, by), lz = Math.min(az, bz), hz = Math.max(az, bz);
    for (let i = 0, o = 0; i < NB; i++, o += 6) {
      if (hx < B[o] || lx > B[o + 3] || hz < B[o + 2] || lz > B[o + 5] || hy < B[o + 1] || ly > B[o + 4]) continue;
      let t0 = 0, t1 = 1;
      if (dx !== 0) { let a = (B[o] - ax) / dx, b = (B[o + 3] - ax) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
      if (dy !== 0) { let a = (B[o + 1] - ay) / dy, b = (B[o + 4] - ay) / dy; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
      if (dz !== 0) { let a = (B[o + 2] - az) / dz, b = (B[o + 5] - az) / dz; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
      return true;
    }
    return false;
  }

  const items = [];
  // 把 object 从它现在的父节点上摘下来，套一层组挂回去
  function wrap(object) {
    const parent = object.parent, holder = new T.Group();
    holder.name = 'cull';
    parent.add(holder); holder.add(object);
    const it = { holder, object, pts: new Float32Array(45), first: 0, seen: -1e9, pending: true, index: items.length };
    items.push(it);
    return it;
  }
  // 量一次它的包围盒，定下 15 个取样点（角往里收一成，免得取到盒子外沿的空处）
  function measure(it) {
    it.object.updateWorldMatrix(true, true);
    _box.setFromObject(it.object);
    if (_box.isEmpty()) { const p = it.object.getWorldPosition(new T.Vector3()); _box.min.copy(p).subScalar(0.25); _box.max.copy(p).addScalar(0.25); }
    const lo = _box.min, hi = _box.max, c = [(lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2], h = [(hi.x - lo.x) / 2, (hi.y - lo.y) / 2, (hi.z - lo.z) / 2];
    const P = it.pts; let n = 0;
    const put = (x, y, z) => { P[n++] = c[0] + x * h[0]; P[n++] = c[1] + y * h[1]; P[n++] = c[2] + z * h[2]; };
    put(0, 0, 0);
    put(0, -0.85, 0); put(0, 0.85, 0); put(-0.85, 0, 0); put(0.85, 0, 0); put(0, 0, -0.85); put(0, 0, 0.85);
    for (let i = 0; i < 8; i++) put(i & 1 ? 0.9 : -0.9, i & 2 ? 0.9 : -0.9, i & 4 ? 0.9 : -0.9);
    it.pending = false;
  }
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const stats = { items: 0, drawn: 0, rays: 0 };
  let frame = 0;

  // eye：眼睛的位置（Vector3）；time：秒；all：这一帧所有的都查（定点截图用）
  function update(eye, time, all = false) {
    let drawn = 0, rays = 0;
    frame++;
    for (const it of items) {
      const h = it.holder;
      if (!enabled) { h.visible = true; drawn++; continue; }
      if (!h.parent || !shown(h.parent)) continue;          // 整层都没画，不用算
      if (it.pending) { h.visible = true; measure(it); }
      const P = it.pts, d = Math.hypot(P[0] - eye.x, P[1] - eye.y, P[2] - eye.z);
      if (d < NEAR) { it.seen = time; h.visible = true; drawn++; continue; }
      if (!h.visible && !all && (it.index + frame) % STAGGER !== 0) continue;   // 藏着的轮流查
      // 先试上次通的那条线
      let see = false;
      for (let k = 0; k < 15 && !see; k++) {
        const j = ((it.first + k) % 15) * 3;
        rays++;
        if (!blocked(eye.x, eye.y, eye.z, P[j], P[j + 1], P[j + 2])) { see = true; it.first = (it.first + k) % 15; }
      }
      if (see) it.seen = time;
      h.visible = time - it.seen < HOLD;
      if (h.visible) drawn++;
    }
    stats.items = items.length; stats.drawn = drawn; stats.rays = rays;
  }
  return { wrap, update, stats, items, blocked,
    // 这件东西挪了地方：下一帧重新量它在哪
    moved(object) { const it = items.find(i => i.object === object); if (it) it.pending = true; },
    forget(object) { const i = items.findIndex(q => q.object === object); if (i >= 0) { const it = items[i]; items.splice(i, 1); items.forEach((q, n) => { q.index = n; }); if (it.holder.parent) { it.holder.parent.add(object); it.holder.removeFromParent(); } } },
    set enabled(v) { enabled = v; }, get enabled() { return enabled; } };
}
