// 给人坐的轨道（游乐园的过山车、激流勇进）：规则层和画面共用，不依赖 DOM。
// 轨道是过一串控制点的曲线，按弧长取点；trackSchedule 再算出一趟车每一秒走到哪。

// 过一串点的闭合曲线（Catmull-Rom），按弧长取点。at(u)：u 是 0–1 的一圈，返回位置和切线方向。
export function closedTrack(points, perSegment = 14) {
  const n = points.length, pts = [];
  const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n], b = points[i], c = points[(i + 1) % n], d = points[(i + 2) % n];
    for (let j = 0; j < perSegment; j++) { const t = j / perSegment; pts.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)]); }
  }
  const lengths = [0];
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; lengths.push(lengths[i] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])); }
  const total = lengths[pts.length];
  function spot(s) {
    s = ((s % total) + total) % total;
    let lo = 0, hi = pts.length;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lengths[mid] <= s) lo = mid; else hi = mid; }
    const p = pts[lo], q = pts[(lo + 1) % pts.length], t = (s - lengths[lo]) / (lengths[lo + 1] - lengths[lo] || 1);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  }
  // 切线取前后各 0.4 米两点的连线：折线每一小段的方向是跳变的，直接用会让车头一顿一顿地转
  function at(u) {
    const s = ((u % 1) + 1) % 1 * total, p = spot(s), a = spot(s - 0.4), b = spot(s + 0.4);
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1;
    return { x: p[0], y: p[1], z: p[2], tx: dx / d, ty: dy / d, tz: dz / d };
  }
  return { points: pts, length: total, at };
}

// 一趟车在轨道上怎么跑（按时间查走到哪）：提升坡上匀速爬；过了坡顶，离坡顶越低越快；进弯前自己收速，
// 让车头每秒转过的角度不超过 turn（坐着的人镜头跟着车头转，转快了会晕，docs/park-design.md 3.2）；出站、进站缓起缓停。
// 返回 { time: 一圈几秒, at(t): 第 t 秒走到一圈的哪（0–1）, top: 最快多少米/秒 }。
export function trackSchedule(track, { lift = 4.4, crest = 3.2, gravity = 6.5, max = 10, turn = Math.PI / 4 * 0.88, accel = 5, brake = 5.5, creep = 0.25 } = {}) {
  const N = Math.ceil(track.length / 0.12), ds = track.length / N, at = Array.from({ length: N + 1 }, (_, i) => track.at(i / N));
  const W = 5, yaw = at.map(p => Math.atan2(-p.tx, -p.tz)), top = Math.max(...at.map(p => p.y)), peak = at.findIndex(p => p.y === top);
  const v = at.map((p, i) => {
    const lo = Math.max(0, i - W), hi = Math.min(N, i + W), a = yaw[hi] - yaw[lo], bend = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / ((hi - lo) * ds);   // 弯有多急：看前后各 0.6 米，不看一小格（一小格的方向是抖的，车速会跟着一顿一顿）
    return Math.min(i <= peak ? lift : Math.min(max, Math.hypot(crest, Math.sqrt(2 * gravity * (top - p.y)))), bend > 1e-4 ? turn / bend : Infinity);
  });
  v[0] = v[N] = creep;
  for (let i = 1; i <= N; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * accel * ds));
  for (let i = N - 1; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * brake * ds));
  const when = [0];
  for (let i = 0; i < N; i++) when.push(when[i] + 2 * ds / (v[i] + v[i + 1]));
  const time = when[N];
  return {
    time, top: Math.max(...v),
    at(t) {
      if (t <= 0) return 0; if (t >= time) return 1;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (when[mid] <= t) lo = mid; else hi = mid; }
      // 这一小段里匀加速：按时间求走了多远，速度才是连续的（直接按时间线性插值的话，起步那一格会一下子跳到平均速度）
      const T = when[lo + 1] - when[lo], k = (t - when[lo]) / T;
      return (lo + (v[lo] * k + (v[lo + 1] - v[lo]) * k * k / 2) * T / ds) / N;
    },
  };
}

// 搭一条轨道的控制点：平面走向用直线和圆弧一段段接，高度按弧长另配（docs/park-design.md 3.2a）。
// 控制点沿线等距（step 米一个）：疏密不匀、或者两个点挨得太近，曲线会打结。要改走向就改这里的段，不要手挪算出来的点。
//   start：[x, z]；heading：出发的方向角（度；0 朝 +x，90 朝 +z，-90 朝 -z）
//   moves：['line', 米] | ['arc', 半径, 度]（度是正的往右拐）| ['until', 'x' 或 'z', 值]（照现在的方向一直走到那条线）| ['mark', 名字]
//   heights(marks, total)：返回 [[弧长, 高度], ...]；marks 是各个 mark 处的弧长，total 是一整圈的弧长。两点之间用单调三次插值，不会冲过头
// 返回 { points: [[x, y, z], ...], marks, length, end: { x, z, heading } }。最后一段从 end 直着回到 start。
export function planTrack({ start, heading, step = 1.35, moves, heights }) {
  let [x, z] = start, h = heading * Math.PI / 180, s = 0;
  const pts = [], marks = {};
  const put = () => { const q = pts[pts.length - 1]; if (q && Math.hypot(q[0] - x, q[1] - z) < 0.6) pts.pop(); pts.push([x, z, s]); };
  const line = len => { if (len < 0.3) return; const n = Math.max(1, Math.round(len / step)); for (let i = 0; i < n; i++) { x += Math.cos(h) * len / n; z += Math.sin(h) * len / n; s += len / n; put(); } };
  const arc = (R, deg) => {
    const turn = deg * Math.PI / 180, n = Math.max(1, Math.round(R * Math.abs(turn) / step)), da = turn / n, sign = Math.sign(deg);
    for (let i = 0; i < n; i++) { const cx = x - Math.sin(h) * R * sign, cz = z + Math.cos(h) * R * sign; h += da; x = cx + Math.sin(h) * R * sign; z = cz - Math.cos(h) * R * sign; s += Math.abs(da) * R; put(); }
  };
  put();
  for (const [kind, a, b] of moves) {
    if (kind === 'line') line(a);
    else if (kind === 'arc') arc(a, b);
    else if (kind === 'until') line(a === 'x' ? (b - x) / Math.cos(h) : (b - z) / Math.sin(h));
    else if (kind === 'mark') marks[a] = s;
    else throw new Error('planTrack：不认识的一段 ' + kind);
  }
  const total = s + Math.hypot(x - start[0], z - start[1]), keys = heights(marks, total), n = keys.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]);   // Fritsch–Carlson：过每个关键点，坡度连续
  const yAt = q => {
    let i = 0; while (i < n - 2 && q > keys[i + 1][0]) i++;
    const hh = keys[i + 1][0] - keys[i][0], t = Math.max(0, Math.min(1, (q - keys[i][0]) / hh)), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * hh * m[i + 1];
  };
  const points = pts.filter(p => !(p[2] > 1 && Math.hypot(p[0] - start[0], p[1] - start[1]) < 0.05))   // 绕回来正好落在起点上的那一个不要：闭合的曲线自己会接上
    .map(p => [+p[0].toFixed(2), +yAt(p[2]).toFixed(2), +p[1].toFixed(2)]);
  return { points, marks, length: total, end: { x, z, heading: h * 180 / Math.PI } };
}

