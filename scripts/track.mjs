// 轨道体检：照 park-tour-layout.js 里的走向方案（COASTER_PLAN）算一遍过山车，报它多长、多陡、多快，有没有压到路、碰到别的设施。
//   node scripts/track.mjs            体检
//   node scripts/track.mjs --points   另外打印控制点
// 改走向：改 COASTER_PLAN 里的段（直线、圆弧）和高度，再跑这个。准则在 docs/park-design.md 第 3 节（3.2、3.2a）。
import { pathToFileURL } from 'node:url';
import { COASTER, COASTER_PLAN, RAPIDS, CAROUSEL, TENT, HAUNT, planTrack, trackSchedule, isTourWalkable, inRock } from '../scenes/rongboy-mission/park-tour-layout.js';

const deg = r => r * 180 / Math.PI;

// track：closedTrack 的结果；plan：planTrack 的结果（看首尾接不接得上）。返回数字和一串问题（空的就是没问题）。
export function trackReport(track = COASTER, plan = planTrack(COASTER_PLAN)) {
  const run = trackSchedule(track), N = 900, problems = [];
  let slope = 0, top = -Infinity;
  for (let i = 0; i < N; i++) {
    const p = track.at(i / N), at = `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`;
    slope = Math.max(slope, Math.abs(deg(Math.asin(p.ty)))); top = Math.max(top, p.y);
    if (p.y < 3.6 && isTourWalkable(p.x, p.z, 0.6)) problems.push('压到小径上空不到 3.6 米 ' + at);
    if (RAPIDS.points.some(r => Math.hypot(r[0] - p.x, r[2] - p.z) < 1.7 && p.y - r[1] < 2.6)) problems.push('离激流勇进的水道太近 ' + at);
    const flat = Math.hypot(p.tx, p.tz) || 1, nx = p.tz / flat, nz = -p.tx / flat;   // 车身有 1.2 米宽：中线和两边各查一次
    if ([-0.6, 0, 0.6].some(o => inRock(p.x + nx * o, p.z + nz * o, 0.3, p.y - 0.25))) problems.push('穿进石头山 ' + at);
    if (Math.hypot(p.x - CAROUSEL.x, p.z - CAROUSEL.z) < CAROUSEL.platform + 1.4) problems.push('离木马太近 ' + at);
    if (Math.abs(p.x - TENT.x) < TENT.a + 2.4 && Math.abs(p.z - TENT.z) < TENT.b + 2.4) problems.push('离帐篷太近 ' + at);
    if (p.x > HAUNT.block.minX - 1.45 && p.x < HAUNT.block.maxX && p.z > HAUNT.block.minZ && p.z < HAUNT.block.maxZ) problems.push('离鬼屋太近 ' + at);
  }
  // 照实际车速跑一圈：最快多快、车头最快转多急（每秒多少度；镜头跟着车头转，另有每秒 45° 的上限）
  let prev = track.at(0), yaw = null, turn = 0, fastest = 0;
  for (let t = 1 / 60; t <= run.time; t += 1 / 60) {
    const p = track.at(run.at(t)), now = Math.atan2(-p.tx, -p.tz);
    fastest = Math.max(fastest, Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) * 60);
    if (yaw !== null) turn = Math.max(turn, Math.abs(deg(Math.atan2(Math.sin(now - yaw), Math.cos(now - yaw)))) * 60);
    prev = p; yaw = now;
  }
  const gap = Math.hypot(plan.end.x - plan.points[0][0], plan.end.z - plan.points[0][2]), heading = ((plan.end.heading - COASTER_PLAN.heading) % 360 + 540) % 360 - 180;
  if (Math.abs(heading) > 0.5) problems.push(`绕回来的方向和出发差 ${heading.toFixed(1)}°：首尾接不顺`);
  return { length: track.length, top, slope, seconds: run.time, fastest, turn, points: plan.points.length, gap, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = trackReport();
  console.log(`过山车：一圈 ${r.length.toFixed(1)} 米 · 最高 ${r.top.toFixed(1)} 米 · 最陡 ${r.slope.toFixed(0)}° · 一圈 ${r.seconds.toFixed(1)} 秒 · 最快每秒 ${r.fastest.toFixed(1)} 米 · 车头最快每秒转 ${r.turn.toFixed(0)}°（镜头另有每秒 45° 的上限）`);
  console.log(`控制点 ${r.points} 个 · 绕回来离起点 ${r.gap.toFixed(2)} 米（最后这一段直着接回去）`);
  if (r.problems.length) { console.log(`\n${r.problems.length} 处问题（每 5 处列 1 处）：`); r.problems.filter((_, i) => i % 5 === 0).slice(0, 14).forEach(p => console.log('  ' + p)); }
  else console.log('没有压到小径、水道、石头山、木马、帐篷、鬼屋');
  if (process.argv.includes('--points')) console.log('\n' + JSON.stringify(planTrack(COASTER_PLAN).points).replace(/\],\[/g, '], ['));
  process.exitCode = r.problems.length ? 1 : 0;
}
