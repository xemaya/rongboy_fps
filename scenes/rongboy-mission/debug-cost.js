// 量一张图的开销（docs/park-design.md 5d.6）：隔几米站一次、朝八个方向各看一眼，报最重的几个视角。
// 不依赖 DOM 和渲染器：站哪由 costPoints 给，怎么看、怎么数由调用方给（页面里是 __rb.cost()，见 play.js）。

// 该站在哪些地方：小径地图（给了 path）沿小径每 step 米一个点；房间地图每间屋的中心，加上出发点。返回 [[x, z, 楼层], ...]
export function costPoints(level, path = null, step = 4.5) {
  if (path) {
    const out = []; let last = null;
    for (const p of path) if (!last || Math.hypot(p.x - last.x, p.z - last.z) >= step) { out.push([p.x, p.z, 0]); last = p; }
    return out;
  }
  const rooms = (level.storeys || [level]).flatMap((storey, floor) => (storey.rooms || []).map(r => [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, floor]));
  return [[level.player.x, level.player.z, 0], ...rooms];
}

// look(x, z, yaw, floor) 返回 { calls, tris }。step(budget) 算到时间用完为止：没算完返回 { at, of }，再调接着算；
// 算完返回 { views, worstCalls: [[次数, 三角形, x, z, 朝向第几格], ...最重的六个], worstTris }。
export function createCostSweep({ points, look, turns = 8, now = () => performance.now() }) {
  const views = []; let at = 0;
  return {
    step(budget = 8000) {
      const from = now();
      for (; at < points.length && now() - from < budget; at++) {
        const [x, z, floor] = points[at];
        for (let k = 0; k < turns; k++) { const q = look(x, z, k * 2 * Math.PI / turns, floor); views.push([q.calls, q.tris, +x.toFixed(1), +z.toFixed(1), k]); }
      }
      if (at < points.length) return { at, of: points.length };
      const byCalls = [...views].sort((a, b) => b[0] - a[0]), byTris = [...views].sort((a, b) => b[1] - a[1]);
      return { views: views.length, worstCalls: byCalls.slice(0, 6), worstTris: byTris[0] };
    },
  };
}

// 这一帧的绘制是谁占的：root 底下每个看得见的子节点各有多少个网格在画（网格数约等于绘制次数，投影的再算一遍）
export function costParts(root) {
  const parts = {};
  for (const child of root.children) {
    if (!child.visible) continue;
    let n = 0; child.traverseVisible(o => { if (o.isMesh) n++; });
    if (n) { const key = child.name || child.type; parts[key] = (parts[key] || 0) + n; }
  }
  return Object.fromEntries(Object.entries(parts).sort((a, b) => b[1] - a[1]));
}
