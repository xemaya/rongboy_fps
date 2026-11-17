// 开场片的木偶：把手办摆成某一刻的样子。全部是时间的函数，不带状态——同一个时刻摆出来永远一样。
// 手办只有六个关节（身体、头、两臂、两腿，绒仔多一顶帽子和一个背包），没有表情，
// 所以表演靠整体：蹦、压扁、前倾、歪头、帽子慢半拍，情绪用头顶的 Zzz / ! 气泡（和游戏里同一套）。
import * as T from 'three';

export const clamp01 = v => Math.min(1, Math.max(0, v));
export const lerp = (a, b, k) => a + (b - a) * k;
// 0→1 的一段：t 在 [a, b] 里走到哪了
export const seg = (t, a, b) => clamp01((t - a) / Math.max(1e-6, b - a));
export const ease = k => k * k * (3 - 2 * k);
export const easeOut = k => 1 - (1 - k) * (1 - k);
export const easeIn = k => k * k;
// 冲过头再弹回来（气泡弹出、帽子落回）
export const overshoot = k => { const s = 1.9; const u = k - 1; return 1 + u * u * ((s + 1) * u + s); };
// 一下衰减的抖动：age 秒前挨了一下
export const jolt = (age, freq = 22, decay = 6) => (age < 0 ? 0 : Math.sin(age * freq) * Math.exp(-age * decay));

const UP = new T.Vector3(0, 1, 0), _axis = new T.Vector3(), _q = new T.Quaternion();

// ---------- 蹦着走 ----------
// 玩具不迈步，是一下一下蹦过去的。path 是 [x, z] 折线，每一蹦用 beat 秒，蹦 hopLen 米远。
// 返回这一刻的位置、朝向、离地高度和落地压扁量；t 在 t0 之前停在起点，走完停在终点。
export function hopAlong(path, t, { t0 = 0, beat = 0.4346, hopLen = 0.5, height = 0.14, air = 0.62 } = {}) {
  const segs = []; let total = 0;
  for (let i = 1; i < path.length; i++) { const dx = path[i][0] - path[i - 1][0], dz = path[i][1] - path[i - 1][1], d = Math.hypot(dx, dz); segs.push({ a: path[i - 1], dx, dz, d, s: total }); total += d; }
  const hops = Math.max(1, Math.round(total / hopLen)), step = total / hops;
  const u = (t - t0) / beat, n = Math.min(hops, Math.max(0, Math.floor(u))), f = u < 0 ? 0 : n >= hops ? 0 : u - n;
  // 一蹦里前 air 的时间在空中，剩下的时间踩在地上（压扁再弹起）
  const fly = clamp01(f / air), dist = Math.min(total, (n + ease(fly)) * step);
  let sg = segs[segs.length - 1];
  for (const q of segs) if (dist <= q.s + q.d + 1e-6) { sg = q; break; }
  const k = sg.d ? (dist - sg.s) / sg.d : 0;
  const land = f > air ? (f - air) / (1 - air) : 0;
  return {
    x: sg.a[0] + sg.dx * k, z: sg.a[1] + sg.dz * k, heading: Math.atan2(sg.dx, sg.dz),
    hop: u < 0 || n >= hops ? 0 : Math.sin(fly * Math.PI) * height,
    squash: u < 0 || n >= hops ? (n >= hops ? Math.max(0, 1 - (u - hops) * 3) * 0.6 : 0) : Math.sin(land * Math.PI),
    done: n >= hops, index: n, phase: f, moving: u >= 0 && n < hops,
  };
}

// ---------- 迈步走 ----------
// 绒仔是走路的（僵尸才是蹦的）。dist 是沿 path 已经走了多少米，由调用的人按时间给：想快想慢、中途停一下都在那边定。
// 腿的摆动跟着走过的距离算，所以脚不打滑。返回位置、朝向（拐角处转得圆一点）、两条腿的摆角和身体的起伏。
export function walkAlong(path, dist, { stride = 0.42, swing = 0.5, bob = 0.016 } = {}) {
  const segs = []; let total = 0;
  for (let i = 1; i < path.length; i++) { const dx = path[i][0] - path[i - 1][0], dz = path[i][1] - path[i - 1][1], d = Math.hypot(dx, dz); segs.push({ a: path[i - 1], dx, dz, d, s: total }); total += d; }
  const at = d => { d = Math.min(total, Math.max(0, d)); let sg = segs[segs.length - 1]; for (const q of segs) if (d <= q.s + q.d + 1e-6) { sg = q; break; } const k = sg.d ? (d - sg.s) / sg.d : 0; return [sg.a[0] + sg.dx * k, sg.a[1] + sg.dz * k]; };
  const d = Math.min(total, Math.max(0, dist)), [x, z] = at(d), a = at(d - 0.18), b = at(d + 0.18);
  const ph = d / stride * Math.PI, live = Math.min(1, d / 0.12, (total - d) / 0.12);   // 起步和站定的那一小段，腿收回来
  return { x, z, heading: Math.atan2(b[0] - a[0], b[1] - a[1]), legL: -Math.sin(ph) * swing * live, legR: Math.sin(ph) * swing * live,
    bob: Math.abs(Math.sin(ph)) * bob * live, sway: Math.sin(ph) * 0.035 * live, step: Math.floor(ph / Math.PI), total, moving: d > 0 && d < total, done: d >= total };
}
// 按关键点线性走：keys = [[时刻, 值], ...]，两头保持
export function ramp(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], (t - keys[i - 1][0]) / Math.max(1e-6, keys[i][0] - keys[i - 1][0]));
  return keys[keys.length - 1][1];
}

// ---------- 僵尸 ----------
// p：{ x, y, z, heading, hop, squash, sleep(0..1), lean, roll, fall(0..1)+fallDir[x,z], reach, spread, headX/Y/Z, bodyY,
//      legs, shiver, blue(0..1), flash, breathe(时间，睡着时的呼吸), visible }
export function poseZombie(a, p) {
  a.reset();
  a.world.visible = p.visible !== false;
  if (!a.world.visible) return;
  const h = p.heading || 0, sleep = p.sleep || 0, squash = p.squash || 0;
  a.world.position.set(p.x, (p.y || 0) + (p.hop || 0), p.z);
  a.model.rotation.y = h;
  const br = sleep ? Math.sin((p.breathe || 0) * 1.9) : 0;   // 睡着时一起一伏
  a.tilt.scale.set(1 + squash * 0.07 - br * 0.012 * sleep, 1 - squash * 0.13 + br * 0.022 * sleep, 1 + squash * 0.07 - br * 0.012 * sleep);
  a.tilt.position.y = 0; a.tilt.quaternion.identity();
  if (p.fall) {
    const k = ease(clamp01(p.fall)), d = p.fallDir || [Math.sin(h), Math.cos(h)];
    _axis.set(d[1], 0, -d[0]).normalize();
    a.tilt.quaternion.setFromAxisAngle(_axis, k * 1.43);
    a.tilt.position.y = 0.13 * k + Math.sin(clamp01(p.fall) * Math.PI) * 0.1;
  } else {
    if (p.lean) { _axis.set(Math.cos(h), 0, -Math.sin(h)); a.tilt.quaternion.setFromAxisAngle(_axis, p.lean); }
    if (p.roll) { _axis.set(Math.sin(h), 0, Math.cos(h)); a.tilt.quaternion.multiply(_q.setFromAxisAngle(_axis, p.roll)); }
  }
  if (p.shiver) { a.model.position.x += Math.sin(p.shiver * 71) * 0.012; a.model.position.z += Math.cos(p.shiver * 83) * 0.012; a.tilt.rotation.z += Math.sin(p.shiver * 57) * 0.03; }
  const part = n => a.parts.get(n), body = part('Body'), head = part('Head'), fall = ease(clamp01(p.fall || 0));
  if (body) { body.rotation.x += 0.12 + sleep * (0.28 + br * 0.02); body.rotation.y += p.bodyY || 0; body.position.y -= squash * 0.025; }
  if (head) {
    head.rotation.x += -0.06 + sleep * (0.42 + br * 0.04) + (p.headX || 0) - 0.15 * fall;
    head.rotation.y += p.headY || 0;
    head.rotation.z += sleep * 0.12 + (p.headZ || 0);
  }
  const reach = (p.reach || 0) * (1 - fall) + (1.05 - 0.8) * fall;
  for (const sign of [-1, 1]) {
    const arm = part(sign < 0 ? 'ArmL' : 'ArmR'), leg = part(sign < 0 ? 'LegL' : 'LegR');
    if (arm) { arm.rotation.x -= reach + (p.flail || 0) * 0.4; arm.rotation.z += sign * (0.08 + (p.spread || 0) + (p.flail || 0) * 0.5) - sign * 0.65 * fall; }
    if (leg) { leg.rotation.x += (p.hop ? Math.min(1, p.hop / 0.2) * 0.38 : 0) - squash * 0.15 + sign * (p.legs || 0) - 0.35 * fall + (p.flail || 0) * (sign > 0 ? 0.4 : -0.22); }
  }
  if (p.blue) { const pulse = 0.5 + 0.5 * Math.sin((p.shiver || 0) * 38); for (const m of a.materials) m.emissive?.setRGB((0.04 + 0.10 * pulse) * p.blue, (0.22 + 0.25 * pulse) * p.blue, (0.42 + 0.35 * pulse) * p.blue); }
  else a.flash(p.flash || 0);
}

// ---------- 绒仔 ----------
// p：{ x, y, z, heading, hop, squash, lean, roll, bodyX, bodyY, headX/Y/Z, hat(帽子离头多高), hatTilt,
//      armL / armR: { x, z }（不给就是端着枪的姿势）, legL, legR, pack, gun: { weapon, pitch, kick, charge, loaded, hide }, visible }
const HOLD = { x: -1.05, z: 0.43 };
export function poseHero(a, p) {
  a.reset();
  a.world.visible = p.visible !== false;
  if (!a.world.visible) return;
  const h = p.heading || 0, squash = p.squash || 0;
  a.world.position.set(p.x, (p.y || 0) + (p.hop || 0), p.z);
  a.model.rotation.y = h;
  a.tilt.scale.set(1 + squash * 0.07, 1 - squash * 0.13, 1 + squash * 0.07);
  a.tilt.position.y = 0; a.tilt.quaternion.identity();
  if (p.lean) { _axis.set(Math.cos(h), 0, -Math.sin(h)); a.tilt.quaternion.setFromAxisAngle(_axis, p.lean); }
  if (p.roll) { _axis.set(Math.sin(h), 0, Math.cos(h)); a.tilt.quaternion.multiply(_q.setFromAxisAngle(_axis, p.roll)); }
  const part = n => a.parts.get(n), body = part('CTRL / body'), head = part('CTRL / head'), hat = part('CTRL / hat'), pack = part('CTRL / backpack');
  if (body) { body.rotation.x += p.bodyX || 0; body.rotation.y += p.bodyY || 0; body.position.y -= squash * 0.03; }
  if (head) { head.rotation.x += p.headX || 0; head.rotation.y += p.headY || 0; head.rotation.z += p.headZ || 0; }
  if (hat) { hat.position.y += p.hat || 0; hat.rotation.x += p.hatTilt || 0; }
  if (pack) pack.rotation.x += p.pack || 0;
  const g = p.gun || {}, kick = g.kick || 0;
  for (const sign of [-1, 1]) {
    const arm = part('CTRL / arm ' + sign), leg = part('CTRL / leg ' + sign), spec = sign < 0 ? p.armL : p.armR;
    if (arm) {
      if (spec) { arm.rotation.x += spec.x || 0; arm.rotation.z += spec.z || 0; arm.rotation.y += spec.y || 0; }
      else { arm.rotation.x += HOLD.x + (g.pitch || 0) * 0.6 + kick * 0.5; arm.rotation.z -= sign * HOLD.z; arm.position.z -= kick * 0.1; }
    }
    if (leg) leg.rotation.x += (sign < 0 ? p.legL : p.legR) || (p.hop ? Math.min(1, p.hop / 0.15) * 0.28 : 0) + squash * 0.1;   // 蹦起来时脚往后收
  }
  if (a.gun) {
    a.gun.visible = !g.hide;
    a.gun.userData.variants.forEach((v, i) => { v.visible = i === (g.weapon || 0); });
    a.gun.position.set(0, 0.24 + kick * 0.05 + (g.lift || 0), 0.40 - kick * 0.16);
    a.gun.rotation.set(-(g.pitch || 0) - kick * 0.35, g.yaw || 0, 0);
    if (a.loaded) { a.loaded.visible = !!g.loaded; a.loaded.scale.setScalar(0.12 + (g.charge || 0) * 0.18); a.loaded.rotation.y = (g.spin || 0) * 2; }
    const u = a.gun.userData.variants[g.weapon || 0]?.userData;
    if (u?.spark) u.spark.scale.setScalar(0.7 + 0.6 * Math.abs(Math.sin((g.spin || 0) * 37)));
    if (u?.wheel) u.wheel.rotation.x = (g.spin || 0) * 6;
  }
  a.flash(p.flash || 0);
}

// 枪口在世界里的位置（发射点）
const _m = new T.Vector3();
export function muzzleOf(a) {
  a.world.updateMatrixWorld(true);
  return a.gun.localToWorld(_m.set(0, 0, a.gun.userData.muzzleZ || 0.63)).clone();
}

// ---------- 头顶的气泡 ----------
function moodTexture(text) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${text === '!' || text === '?' ? 132 : text === '嘘' ? 104 : 96}px Georgia, "Songti SC", serif`;
  ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeStyle = '#3e4a38'; ctx.strokeText(text, 80, 84);
  ctx.fillStyle = text === '!' ? '#f2b84b' : text === '?' ? '#f3dfa5' : '#eef2e2'; ctx.fillText(text, 80, 84);
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace; return map;
}
const moodTextures = new Map();
const moodMap = text => { if (!moodTextures.has(text)) moodTextures.set(text, moodTexture(text)); return moodTextures.get(text); };
// 每个角色带三片气泡（各有各的材质，好分别变淡）
export function attachMood(a, height) {
  a.height = height;
  a.moods = [0, 1, 2].map(() => { const s = new T.Sprite(new T.SpriteMaterial({ map: moodMap('z'), transparent: true, depthWrite: false, depthTest: false })); s.visible = false; s.renderOrder = 6; a.world.add(s); return s; });
}
// 摆好镜头之后再排气泡：往画面右上飘，不管角色朝哪。
// kind：'zzz'（三个 z 一个接一个往上飘，t 是时间）、'!' / '?' / '嘘'（t 秒前弹出来）
export function layoutMoods(requests, camera) {
  const e = camera.matrixWorld.elements, n = Math.hypot(e[0], e[2]) || 1, rx = e[0] / n, rz = e[2] / n;
  for (const { a, kind, t = 0, opts = {} } of requests) {
    const { size = 1, period = 2.6 } = opts, lift = (a.at?.hop || 0) * 0.7, top = a.height + (a.at?.sleep ? -0.1 : 0);
    if (kind === 'zzz') {
      a.moods.forEach((s, i) => {
        const ph = ((t / period - i / 3) % 1 + 1) % 1, d = 0.24 + ph * 0.36, sc = (0.13 + ph * 0.2) * size;
        s.material.map = moodMap(i === 2 ? 'Z' : 'z'); s.material.opacity = Math.sin(Math.PI * Math.min(1, ph * 1.12)); s.visible = true;
        s.position.set(rx * d, top + 0.02 + ph * 0.5 - lift, rz * d); s.scale.set(sc, sc, 1);
      });
    } else if (t >= 0) {
      const s = a.moods[0], k = overshoot(clamp01(t / 0.22)), sc = 0.44 * size * k, side = kind === '嘘' ? 0.62 : 0.04;
      s.material.map = moodMap(kind); s.material.opacity = 1; s.visible = true;
      s.position.set(rx * side, top + (kind === '嘘' ? -0.42 : 0.1) - lift, rz * side); s.scale.set(sc, sc, 1);
    }
  }
}
