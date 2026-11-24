// 游乐园里设施的规则：走近设施按一个键，设施演一段、或者坐上去（docs/park-design.md）。
// 哪一站办完了什么事、门开不开、小丑怎么打，在 amusement.js；这里只管设施自己。
// 确定性、不依赖 DOM。画面（park-tour-view.js）只读这里的状态：木马转到哪、车在轨道的哪一点、门开了多少。
// 三类互动：看（设施演，人站在路上）、坐（摩天轮、过山车、激流勇进：人被带着走）、开（碰碰车：人自己开）。
import { COASTER, RAPIDS, WHEEL, RINK, STALLS, HAUNT, RAPIDS_DOCK, trackSchedule } from './park-tour-layout.js';
import { startStall, leaveStall, stepStall } from './park-stalls.js';

const TAU = Math.PI * 2, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// 眼睛离脚底的高度（和 play.js 里的 EYE 是同一个数）：坐着的时候按"眼睛该在哪"反推脚底的高度
export const PLAYER_EYE = 1.23;

// 过山车一圈怎么跑：提升坡每秒 4 米，俯冲最快每秒 10 米，弯里自己收速（见 trackSchedule）
const coasterRun = trackSchedule(COASTER);
// 每一段演多久（秒）、走多近出提示（米）、坐着的时候镜头被带着转得最快多少（弧度/秒）
export const PARK = {
  reach: 2.8, end: 2.2,
  carousel: { time: 18, ramp: 2.5, speed: 0.55 },
  rapids: { track: RAPIDS, time: 23, ramp: 2.4, seat: 1.0, maxTurn: Math.PI / 4, pitch: .34 },
  coaster: { track: COASTER, run: coasterRun, time: coasterRun.time, seat: 0.95, maxTurn: Math.PI / 4, pitch: 0.7 },   // time 是按轨道算出来的，约 23 秒。pitch：镜头俯仰跟坡度的七成（只跟一半的话，爬坡时车身会抬到画面中间来）
  haunt: { time: 5, show: 10, keep: 11 },   // time：敲门后窗里的幽灵探头多久；show：摇铃后画像上的幽灵出来多久；keep：人离门这么远以后门才关
  wheel: { speed: 0.2, seat: -0.86 },   // seat：坐着的时候眼睛在吊舱挂点下面 0.86 米（舱顶在 0.3 米处、栏杆在 1.07 米处：顶只压住画面上沿，栏杆在下沿）
  bumpers: { time: 30, accel: 12, top: 6, drag: 1.3, radius: 0.55, seat: 1.0, cars: 4, auto: 0.55, thump: 1.4, flag: 1 },   // top：最快每秒 6 米（场子长 10 米，两秒不到从这头冲到那头）；auto：没人开的车用几成油门；thump：撞得比这快才算一下（出声、抖一抖）；flag：第几辆车插着大旗（那一站要撞的就是它）
};

// 在哪按键（都在路上）、提示写什么。kind：look 看 / ride 坐 / drive 开。
export const SPOTS = [
  { id: 'carousel', stop: 'carousel', kind: 'look', x: -26.0, z: 21.0, zh: '摇铃开动木马', en: 'Ring the bell' },
  { id: 'rapids', stop: 'rapids', kind: 'ride', x: RAPIDS_DOCK.promptX, z: RAPIDS_DOCK.z, zh: '登船', en: 'Board the raft' },
  { id: 'coaster', stop: 'coaster', kind: 'ride', x: -31.4, z: -13.0, reach: 3.2, zh: '坐过山车', en: 'Ride the coaster' },
  { id: 'haunt', stop: 'haunt', kind: 'look', x: -6.8, z: -21.7, reach: 3.2, zh: '敲门', en: 'Knock' },
  { id: 'portraits', stop: 'haunt', kind: 'look', x: HAUNT.bell.x, z: HAUNT.bell.z, reach: 1.9, zh: '摇桌上的小铃', en: 'Ring the little bell' },   // 在门厅里：敲开门走进去才够得着
  { id: 'wheel', stop: 'wheel', kind: 'ride', x: 18.5, z: -26.0, reach: 3.2, zh: '坐摩天轮', en: 'Ride the wheel' },
  ...STALLS.map((stall, i) => ({
    id: 'stall-' + stall.id, stop: 'midway', kind: 'stall', x: 35.6 + i * .1, z: stall.z,
    reach: 2.05, zh: stall.zh, en: stall.en,
  })),
  { id: 'bumpers', stop: 'bumpers', kind: 'drive', x: 35.4, z: 10.0, zh: '开碰碰车', en: 'Drive a bumper car' },
];

export function createPark() {
  return {
    time: 0, riding: null, stall: null,
    watch: false,   // true：过山车只看不坐（系统设了"减少动态效果"的人，准则 3.9）
    // 各设施演到哪了：0 是没在演；大于 0 是已经演了多少秒
    running: { carousel: 0, rapids: 0, haunt: 0, portraits: 0, coaster: 0 },
    carouselAngle: 0, wheelAngle: 0, coasterU: 0, boatU: 0,
    door: 0, knocked: false,   // 鬼屋的门开了多少（0–1）；敲过门、门该开着
    // 碰碰车：四辆，在场里自己转悠；玩家上车就接手第 0 辆
    cars: Array.from({ length: PARK.bumpers.cars }, (_, i) => { const a = i * TAU / PARK.bumpers.cars + 0.4; return { x: RINK.x + Math.cos(a) * RINK.rx * 0.55, z: RINK.z + Math.sin(a) * RINK.rz * 0.55, vx: 0, vz: 0, heading: a + Math.PI / 2, bump: 0 }; }),
  };
}

const busy = (park, id) => (id === 'wheel' || id === 'bumpers' ? !!park.riding : PARK[id]?.track ? !!park.riding || park.running[id] > 0
  : id === 'haunt' ? park.knocked || park.door > 0.02 : park.running[id] > 0);

// 鬼屋门厅里第 i 只幽灵飘出来了多少（0–1）：摇铃后挨个出来，演完前一秒缩回去
export function ghostOut(park, i) {
  const ring = park.running.portraits;
  return ring > 0 ? clamp(Math.min((ring - i * 0.7) / 0.9, (PARK.haunt.show - ring) / 1.0), 0, 1) : 0;
}

// 现在按互动键会发生什么：{ id, kind, zh, en }；没有可按的返回 null。坐着的时候是"跳过 / 下车"。
export function parkPrompt(s) {
  const park = s.park, p = s.player;
  if (!park || s.phase !== 'playing') return null;
  if (park.riding) {
    const id = park.riding.id;
    if (id === 'bumpers') return { id, kind: 'leave', zh: '下车', en: 'Get out' };
    if (id === 'rapids') return { id, kind: 'leave', zh: '回码头', en: 'Return to dock' };
    return { id, kind: 'leave', zh: '跳过', en: 'Skip' };
  }
  if (park.stall) return { id: 'stall-' + park.stall.id, kind: 'exit-stall', zh: '离开摊位', en: 'Leave stall' };
  let best = null, near = Infinity;
  for (const q of SPOTS) {
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d > (q.reach ?? PARK.reach) || d >= near || busy(park, q.id)) continue;
    best = q; near = d;
  }
  if (park.watch && PARK[best?.id]?.track) return { id: best.id, kind: 'look', ...(best.id === 'rapids' ? { zh: '放船', en: 'Send the raft' } : { zh: '发车', en: 'Send the train' }) };
  return best && { id: best.id, kind: best.kind, zh: best.zh, en: best.en };
}

// 一圈走到哪了（0–1）：头尾各 ramp 秒缓起缓停，中间匀速
function lap(t, time, ramp) {
  const v = 1 / (time - ramp);
  if (t <= 0) return 0; if (t >= time) return 1;
  if (t < ramp) return v * t * t / (2 * ramp);
  if (t > time - ramp) return 1 - v * (time - t) * (time - t) / (2 * ramp);
  return v * (t - ramp / 2);
}

function board(s, id) {
  const park = s.park, p = s.player;
  const ride = { id, t: 0, from: { x: p.x, z: p.z }, yaw: 0, pitch: 0, turn: 0 };
  if (id === 'wheel') {
    // 上离最低点最近的那只吊舱；它转回最低点就下来
    let best = 0, gap = Infinity;
    for (let i = 0; i < WHEEL.cars; i++) { const a = park.wheelAngle + i * TAU / WHEEL.cars + Math.PI / 2; const g = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (g < gap) { gap = g; best = i; } }
    ride.car = best; ride.turned = 0;
  } else if (PARK[id]?.track) {
    const at = PARK[id].track.at(0); ride.yaw = Math.atan2(-at.tx, -at.tz);
  } else if (id === 'bumpers') {
    ride.car = 0; park.cars[0].vx = park.cars[0].vz = 0;
  }
  park.riding = ride; p.vx = p.vz = 0; p.jump = 0; p.jumpV = 0;
  s.events.push({ type: 'park', what: 'board', id });
  seat(s);
}

function alight(s, skipped = false) {
  const park = s.park, p = s.player, ride = park.riding;
  if (!ride) return;
  park.riding = null;
  p.x = ride.from.x; p.z = ride.from.z; p.y = 0; p.seat = null;
  p.vx = p.vz = p.jump = p.jumpV = 0;
  if (ride.id === 'coaster') park.coasterU = 0;
  if (ride.id === 'rapids') park.boatU = 0;
  s.events.push({ type: 'park', what: 'alight', id: ride.id, skipped });
}

// 坐着的时候人在哪：p.x / p.y / p.z 是脚底，p.seat 告诉画面车朝哪、镜头被带着转了多少
function seat(s) {
  const park = s.park, p = s.player, ride = park.riding;
  if (ride.id === 'wheel') {
    const a = park.wheelAngle + ride.car * TAU / WHEEL.cars;
    p.x = WHEEL.x + Math.cos(a) * WHEEL.r; p.z = WHEEL.z; p.y = WHEEL.y + Math.sin(a) * WHEEL.r + PARK.wheel.seat - PLAYER_EYE;
    p.seat = { id: 'wheel', yaw: null, pitch: 0, turn: 0 };
  } else if (PARK[ride.id]?.track) {
    const config = PARK[ride.id], at = config.track.at(ride.id === 'rapids' ? park.boatU : park.coasterU);
    // 过山车：眼睛在车里的座位上，车随坡前倾后仰，座位跟着车身走（沿轨道的法线抬高，不是笔直往上）。
    // 笔直往上的话，坡一陡车身就转到眼睛的位置上来：俯冲时眼睛会钻进靠背里，整屏发黑。船的坡缓，照旧笔直往上。
    const tilt = ride.id === 'coaster', flat = tilt ? Math.hypot(at.tx, at.tz) || 1 : 1, lean = tilt ? at.ty / flat * config.seat : 0;
    p.x = at.x - at.tx * lean; p.z = at.z - at.tz * lean;
    p.y = at.y + flat * config.seat - PLAYER_EYE + (ride.id === 'rapids' ? .05 : 0);
    p.seat = { id: ride.id, yaw: ride.yaw, pitch: ride.pitch, turn: ride.turn };
  } else {
    const car = park.cars[0];
    p.x = car.x; p.z = car.z; p.y = PARK.bumpers.seat - PLAYER_EYE;
    p.seat = { id: 'bumpers', yaw: null, pitch: 0, turn: 0 };
  }
}

// 按下互动键。返回有没有发生什么。
export function parkInteract(s) {
  const prompt = parkPrompt(s), park = s.park;
  if (!prompt) return false;
  if (prompt.kind === 'leave') { alight(s, true); return true; }
  if (prompt.kind === 'exit-stall') { leaveStall(s); return true; }
  const { id } = prompt;
  if (prompt.kind === 'stall') { startStall(s, id.slice(6)); return true; }
  if (prompt.kind === 'ride' || prompt.kind === 'drive') { board(s, id); return true; }
  if (id === 'haunt') { park.knocked = true; park.running.haunt = 1e-6; s.events.push({ type: 'park', what: 'start', id }); return true; }   // 敲门：门开，幽灵要进去摇了铃才出来
  park.running[id] = 1e-6;
  s.events.push({ type: 'park', what: 'start', id });
  return true;
}

function bumperCars(s, dt, input) {
  const park = s.park, B = PARK.bumpers, driving = park.riding?.id === 'bumpers', a = RINK.rx - B.radius, b = RINK.rz - B.radius;
  park.cars.forEach((car, i) => {
    let ax = 0, az = 0;
    if (i === 0 && driving) { ax = (input.x || 0) * B.accel; az = (input.z || 0) * B.accel; }
    else {   // 没人开的车：各自追一个在场里慢慢画 8 字的点
      const t = park.time * (0.5 + i * 0.1) + i * 1.9, tx = RINK.x + Math.sin(t) * a * 0.72, tz = RINK.z + Math.sin(t * 2 + i) * b * 0.6;
      const dx = tx - car.x, dz = tz - car.z, d = Math.hypot(dx, dz) || 1;
      ax = dx / d * B.accel * B.auto; az = dz / d * B.accel * B.auto;
    }
    car.vx += (ax - car.vx * B.drag) * dt; car.vz += (az - car.vz * B.drag) * dt;
    const v = Math.hypot(car.vx, car.vz);
    if (v > B.top) { car.vx *= B.top / v; car.vz *= B.top / v; }
    car.x += car.vx * dt; car.z += car.vz * dt; car.bump = Math.max(0, car.bump - dt);
    if (v > 0.25) { let turn = Math.atan2(car.vx, car.vz) - car.heading; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); car.heading += clamp(turn, -dt * 5, dt * 5); }
    // 撞到围挡：弹回来
    const ex = (car.x - RINK.x) / a, ez = (car.z - RINK.z) / b, e = Math.hypot(ex, ez);
    if (e > 1) {
      car.x = RINK.x + ex / e * a; car.z = RINK.z + ez / e * b;
      let nx = ex / a, nz = ez / b; const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
      const into = car.vx * nx + car.vz * nz;
      if (into > 0) { car.vx -= 1.7 * into * nx; car.vz -= 1.7 * into * nz; if (into > B.thump && car.bump <= 0) { car.bump = 0.3; s.events.push({ type: 'park', what: 'bump', car: i, x: car.x, z: car.z, hard: into, wall: true }); } }
    }
  });
  // 车和车：碰上了互相弹开
  for (let i = 0; i < park.cars.length; i++) for (let j = i + 1; j < park.cars.length; j++) {
    const p = park.cars[i], q = park.cars[j], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1e-6, gap = B.radius * 2 - d;
    if (gap <= 0) continue;
    const nx = dx / d, nz = dz / d, closing = (p.vx - q.vx) * nx + (p.vz - q.vz) * nz;
    p.x -= nx * gap / 2; p.z -= nz * gap / 2; q.x += nx * gap / 2; q.z += nz * gap / 2;
    if (closing > 0) {
      p.vx -= closing * nx * 0.9; p.vz -= closing * nz * 0.9; q.vx += closing * nx * 0.9; q.vz += closing * nz * 0.9;
      if (closing > B.thump && p.bump <= 0) {
        p.bump = q.bump = 0.3; s.events.push({ type: 'park', what: 'bump', car: i, other: j, x: (p.x + q.x) / 2, z: (p.z + q.z) / 2, hard: closing });
        if (i === 0 && driving) q.struck = (q.struck || 0) + 1;   // 被玩家开的车撞了几次（碰碰车那一站要数）
      }
    }
  }
}

// 每一步：推进所有在演的设施；坐着的时候把人放到座位上。返回玩家这一步是不是坐着（坐着就不走路）。
export function stepPark(s, dt, input = {}) {
  const park = s.park, R = park.running;
  park.time += dt;
  // 摩天轮一直慢慢转（有人没人都转），所以随时有一只吊舱快到最低点
  park.wheelAngle += PARK.wheel.speed * dt;
  // 旋转木马：缓起、匀速、缓停
  if (R.carousel > 0) {
    const C = PARK.carousel, t = R.carousel, k = Math.min(1, t / C.ramp, (C.time - t) / C.ramp);
    park.carouselAngle += C.speed * Math.max(0, k) * dt;
    R.carousel = t + dt >= C.time ? 0 : t + dt;
  }
  if (R.coaster > 0) { R.coaster += dt; park.coasterU = PARK.coaster.run.at(R.coaster); if (R.coaster >= PARK.coaster.time) { R.coaster = 0; park.coasterU = 0; } }
  if (R.rapids > 0) { R.rapids += dt; park.boatU = lap(R.rapids, PARK.rapids.time, PARK.rapids.ramp); if (R.rapids >= PARK.rapids.time) { R.rapids = 0; park.boatU = 0; } }
  {   // 鬼屋：敲过门，门就开着；人走远了才关上（人在门厅里的时候离门不到 keep，不会被关在里面）
    const H = PARK.haunt, far = Math.hypot(s.player.x - HAUNT.door.x, s.player.z - HAUNT.door.z) > H.keep;
    if (park.knocked && far && !(R.portraits > 0)) park.knocked = false;
    park.door = clamp(park.door + (park.knocked ? dt / 1.2 : -dt / 1.5), 0, 1);
    if (R.haunt > 0) R.haunt = R.haunt + dt >= H.time ? 0 : R.haunt + dt;
    if (R.portraits > 0) R.portraits = R.portraits + dt >= H.show ? 0 : R.portraits + dt;
  }
  if (park.stall) stepStall(s, dt);
  bumperCars(s, dt, input);

  const ride = park.riding;
  if (ride) {
    ride.t += dt;
    if (ride.id === 'wheel') {
      ride.turned += PARK.wheel.speed * dt;
      if (ride.turned >= TAU - 0.02) { alight(s); return true; }
    } else if (PARK[ride.id]?.track) {
      const C = PARK[ride.id], u = C.run ? C.run.at(ride.t) : lap(ride.t, C.time, C.ramp);
      if (ride.id === 'rapids') {
        if (park.boatU < .6 && u >= .6) s.events.push({ type: 'park', what: 'splash', id: ride.id });
        park.boatU = u;
      } else park.coasterU = u;
      // 镜头跟着车头转，但转得不超过 maxTurn（急弯的时候镜头会比车头慢一点）；俯仰只跟一半
      const at = C.track.at(u), want = Math.atan2(-at.tx, -at.tz);
      let turn = Math.atan2(Math.sin(want - ride.yaw), Math.cos(want - ride.yaw));
      const step = clamp(turn, -C.maxTurn * dt, C.maxTurn * dt);
      ride.yaw += step; ride.turn = dt > 0 ? Math.abs(step) / dt : 0;
      ride.pitch += (Math.asin(clamp(at.ty, -1, 1)) * C.pitch - ride.pitch) * Math.min(1, dt * 3);
      if (ride.t >= C.time) { alight(s); return true; }
    } else if (ride.id === 'bumpers' && ride.t >= PARK.bumpers.time) { alight(s); return true; }
    seat(s);
    return true;
  }
  return !!park.stall;
}
