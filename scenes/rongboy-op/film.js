// 开场片《嘘——》的分镜和走位。全片按配乐（score）的拍点排：动作落在拍上，切点不必。
// 每个镜头一行注释：景别 / 角度 / 运动和动机 / 为什么切到这里 / 轴线哪一侧（准则见 docs/op-design.md 和引擎的 docs/film-grammar.md）。
// 贯穿全片的轴线：绒仔在画左、朝右；僵尸在画右。镜头都站在这条线的同一侧。
import * as T from 'three';
import { filmCamera } from '../../cine-engine/engine/shots.js';
import { poseZombie, poseHero, muzzleOf, hopAlong, walkAlong, ramp, seg, ease, easeOut, easeIn, overshoot, jolt, lerp, clamp01 } from './puppet.js';
import { WEAPONS } from '../rongboy-mission/game.js';

const WEAPON_INDEX = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));

// 配乐 music-musicbox.mp3：138.05 BPM，第一拍在 0.054 秒
export const BEAT = 60 / 138.05, B0 = 0.054;
export const beat = n => B0 + n * BEAT, bar = n => B0 + n * 4 * BEAT;
// 曲子的段落：0–7 秒八音盒独奏；7 秒起蹑手蹑脚；20.9 秒热闹起来；34.4–38.3 秒全停；38.3 秒起最热闹；50.5 秒收尾和弦
export const DURATION = 64;
const PI = Math.PI;

export function createFilm(stage, sink = {}) {
  const { cine, effects } = stage, camera = cine.camera;
  const fired = new Set();
  const once = (id, Tn, when, fn) => { if (Tn >= when && !fired.has(id)) { fired.add(id); fn(); } };
  const snd = (kind, opts) => sink.sound && sink.sound(kind, opts);
  const moods = [];
  const mood = (a, kind, t, opts) => moods.push({ a, kind, t, opts });
  const Z = (a, p) => { poseZombie(a, p); a.at = p; return a; };
  const H = (a, p) => { poseHero(a, p); a.at = p; return a; };
  const v3 = (x, y, z) => ({ x, y, z });

  // 一段抛物线：从 a 到 b，中途鼓起 apex 米
  const arc = (a, b, k, apex = 0) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + Math.sin(k * PI) * apex, lerp(a[2], b[2], k)];
  // 沿关键点走：keys = [[时刻, [x,y,z], 到下一点的鼓起高度, 缓动], ...]
  function along(keys, Tn) {
    if (Tn <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (Tn <= keys[i][0]) {
      const k = seg(Tn, keys[i - 1][0], keys[i][0]), e = keys[i - 1][3];
      return arc(keys[i - 1][1], keys[i][1], e === 'out' ? easeOut(k) : e === 'in' ? easeIn(k) : k, keys[i - 1][2] || 0);
    }
    return keys[keys.length - 1][1];
  }
  // 摆一颗毛球，顺手掉绒絮
  function ball(s, i, weapon, p, r, { spin = 0, dt = 0, trail = true, look = null, floor = 0 } = {}) {
    const o = s.ball(i, weapon); o.visible = true; o.position.set(p[0], p[1], p[2]); o.scale.setScalar(r);
    if (look) o.lookAt(look[0], look[1], look[2]); else o.rotation.set(spin * 2.1, 0, spin * 1.3);
    if (trail && dt > 0) { o.userData.trail -= dt; if (o.userData.trail <= 0) { o.userData.trail = 0.03; stage.burstTrail(p, weapon, r, floor); } }
    return o;
  }

  // ------------------------------------------------------------------ 家：客厅里的站位
  // 站位都对过家具的盒子（穿模检查 __op.clipcheck）：僵尸离茶几、绒仔的背包离沙发都留了空
  const V = { x: -4.85, z: 0.6 };           // 睡着的那只（离茶几留了一拳的空）
  const DOOR = { x: -5.85, z: -3.78 };      // 厨房门：绒仔从这扇门的门框后面探头，站在厨房一侧（头和帽子有一米一宽，不能卡在门框里）
  const AIM = { x: -5.75, z: -1.0 };        // 他摸进客厅以后站的地方：正对它的后背，周围是空地
  const aimHeading = Math.atan2(V.x - AIM.x, V.z - AIM.z), VH = aimHeading;   // 它背对着厨房门，脸朝东南
  const SNEAK = [[DOOR.x, DOOR.z], [DOOR.x, -2.2], [AIM.x, AIM.z]];
  const V_FALL = [0.3, 0.95];               // 它往哪边倒：朝南，躲开茶几和单人沙发
  // 绒仔走路的姿势：walkAlong 的结果摆到身上
  const walk = w => ({ x: w.x, z: w.z, heading: w.heading, hop: w.bob, legL: w.legL, legR: w.legR, roll: w.sway });
  const TOWER = { x: 0.5, z: -7.2 };
  const HALL = { h1: [-0.85, -1.5, PI / 2], h2: [0.8, -3.3, -PI / 2], h3: [-0.5, -4.7, 0] };
  const sleeper = (a, [x, z, h], Tn, extra = {}) => { Z(a, { x, z, heading: h, sleep: 1, breathe: Tn + x * 3, ...extra }); if (extra.sleep === undefined || extra.sleep > 0.8) mood(a, 'zzz', Tn + x * 2); };

  const HOLD_L = { x: -1.05, z: 0.43 }, HOLD_R = { x: -1.05, z: -0.43 };

  // 积木塔：32.2 秒被球碰到，晃两下像是稳住了，33.52 秒开始倒，34.39 秒最后一块落地
  const T_TAP = 32.2, T_TOPPLE = beat(77), T_CRASH = beat(79);
  const towerDir = [0.4, 0.92];
  function poseTower(s, Tn, quiet = false) {   // quiet：只摆位置，不出声不冒絮（后一个镜头接着用同一摞积木）
    const tw = s.props.tower; tw.visible = true; tw.position.set(0, 0, 0);
    const w = Tn < T_TAP ? 0 : Tn < T_TOPPLE ? 0.07 * Math.sin((Tn - T_TAP) * 10) * Math.exp(-(Tn - T_TAP) * 2.4) + 0.05 * easeIn(seg(Tn, T_TOPPLE - 0.45, T_TOPPLE)) : 0.05;
    tw.blocks.forEach((b, i) => {
      const y0 = 0.105 + i * 0.21, tau = Tn - T_TOPPLE;
      // 没倒的时候整摞绕着底边晃：越高的那块偏得越多
      let x = TOWER.x + towerDir[0] * Math.sin(w) * y0, z = TOWER.z + towerDir[1] * Math.sin(w) * y0, y = y0, rx = w * towerDir[1], rz = -w * towerDir[0], ry = (i % 2 ? 0.2 : -0.12) + i * 0.07;
      if (tau > 0) {
        const vh = 0.3 + 0.36 * i, vy = 0.5 + 0.12 * i, g = 6.2;
        const tl = (vy + Math.sqrt(vy * vy + 2 * g * (y0 - 0.105))) / g, a = Math.min(tau, tl), after = Math.max(0, tau - tl), slide = (1 - Math.exp(-after * 7)) / 7;
        x += towerDir[0] * vh * (a + slide * 0.6); z += towerDir[1] * vh * (a + slide * 0.6); y = Math.max(0.105, y0 + vy * a - 0.5 * g * a * a);
        const spin = (1.5 + i * 0.9) * a, settle = Math.round(spin / (PI / 2)) * (PI / 2), k = ease(clamp01(after * 5));
        rx = lerp(spin, settle, k) * towerDir[1]; rz = -lerp(spin, settle, k) * towerDir[0];
        if (after > 0 && !quiet) once('knock' + i, Tn, T_TOPPLE + tl, () => { snd('knock', { strength: 0.5 + i * 0.08 }); stage.burst(x, 0.1, z, 3, 0.5, 0xe7ddbc); });
      }
      b.position.set(x, y, z); b.rotation.set(rx, ry, rz);
    });
  }

  const fix = (p, at, fov) => ({ from: { p, at, fov }, to: { p, at, fov } });
  const move = (p0, at0, fov0, p1, at1, fov1, extra = {}) => ({ from: { p: p0, at: at0, fov: fov0 }, to: { p: p1, at: at1, fov: fov1 }, ...extra });

  const SHOTS = [
    // ============================== 第一段 · 潜行（0–20.6 秒，音乐很轻）
    {
      // 中景拉到全景 / 平视 / 慢拉：一只站着打瞌睡的僵尸；镜头退开，它身后的厨房门框边探出一顶帽子 / 冷开场，问题是"谁在看它" / 轴线南侧，门在画左
      // （第一版是脸部特写开场。用户：特写太长，一上来怼脸很丑。改成中景起，一个镜头拉到底，从落地门外往里看。）
      name: '01 门边的帽子', T0: 0, T1: 8.72, set: 'house',
      cam: move([-5.0, 1.35, 2.85], [-5.1, 1.02, 0.4], 42, [-5.3, 1.45, 3.85], [-5.4, 0.95, 0], 36, { m0: 0.06, m1: 0.62 }),
      play(Tn, s) {
        const SNORT = 5.0, WALK = 6.7;
        Z(s.cast.v, { x: V.x, z: V.z, heading: VH, sleep: 1, breathe: Tn, squash: Math.max(0, jolt(Tn - SNORT, 14, 5)) * 0.5, headY: Math.sin(seg(Tn, SNORT, SNORT + 0.9) * PI) * 0.25 }); mood(s.cast.v, 'zzz', Tn, { size: 1.2 });
        once('snore1', Tn, 0.25, () => snd('snore')); once('snore2', Tn, 2.5, () => snd('snore')); once('snort', Tn, SNORT, () => snd('snort')); once('snore4', Tn, 6.4, () => snd('snore', { strength: 0.6 }));
        // 他脚不动，身子从门框后面歪出来看：1.6 秒探头，左右瞧瞧；5.0 秒它哼了一声，缩回去；再探出来，然后三步走到门口正中（7.0 秒的重音落在这几步上）
        const peek = ease(seg(Tn, 1.6, 2.4)) * (1 - ease(seg(Tn, SNORT, SNORT + 0.16))) + ease(seg(Tn, 5.85, 6.45)) * (1 - ease(seg(Tn, WALK - 0.15, WALK)));
        const w = walkAlong([[-7.35, DOOR.z], [DOOR.x, DOOR.z]], ramp([[WALK, 0], [7.3, 1.5]], Tn), { stride: 0.38, swing: 0.5 }), face = ease(seg(Tn, 7.25, 7.55));
        H(s.cast.hero, { ...walk(w), heading: Tn < WALK ? 0 : lerp(PI / 2, 0, face), roll: -0.75 * Math.min(1, peek) + w.sway, headY: Tn < SNORT ? Math.sin((Tn - 2.5) * 3.6) * 0.45 * seg(Tn, 2.5, 2.8) : 0,
          hat: jolt(Tn - 7.32, 20, 7) * 0.05 + w.bob, gun: { spin: Tn } });
        if (w.moving) once('in' + w.step, Tn, 0, () => snd('step', { strength: 0.25 }));
      },
    },
    {
      // 近景 / 平视 / 固定：人在做小动作，镜头不动 / 切到他：观众想看清是谁、要干什么 / 轴线南侧
      name: '02 嘘，装弹', T0: 8.72, T1: 12.2, set: 'house',
      cam: fix([-5.45, 1.2, -1.35], [DOOR.x, 1.05, DOOR.z], 32),
      play(Tn, s) {
        const sh = ease(seg(Tn, 9.3, 9.6)) * (1 - ease(seg(Tn, 10.45, 10.75)));
        const lift = ease(seg(Tn, 10.7, 11.0)) * (1 - ease(seg(Tn, 11.5, 11.9))), nod = Math.sin(seg(Tn, 11.55, 11.95) * PI);
        H(s.cast.hero, {
          x: DOOR.x, z: DOOR.z, heading: 0.12, headY: -0.2 * sh, headX: nod * 0.28, hat: jolt(Tn - 11.05, 22, 8) * 0.03,
          armR: HOLD_R, armL: { x: lerp(HOLD_L.x, -2.05, sh), z: lerp(HOLD_L.z, 0.95, sh) },
          gun: { loaded: Tn > 11.02, charge: 0.15 * overshoot(seg(Tn, 11.02, 11.25)), lift: lift * 0.1, pitch: lift * 0.45, spin: Tn },
        });
        if (sh > 0.3) mood(s.cast.hero, '嘘', Tn - 9.45);
        once('shh', Tn, 9.45, () => snd('shh')); once('load', Tn, 11.02, () => snd('switch'));
      },
    },
    {
      // 全景 / 平视略俯 / 固定：人在走，镜头不动 / 切到全景：重新交代两人的距离 / 轴线南侧，绒仔从画左的门里走到画中，僵尸在画右
      name: '03 蹑手蹑脚', T0: 12.2, T1: 15.68, set: 'house',
      cam: fix([-7.9, 1.45, 1.9], [-5.3, 0.75, -1.0], 50),
      play(Tn, s) {
        Z(s.cast.v, { x: V.x, z: V.z, heading: VH, sleep: 1, breathe: Tn }); mood(s.cast.v, 'zzz', Tn);
        // 踮着脚小碎步进客厅：走几步，停一拍左右看看，再摸到它背后
        const w = walkAlong(SNEAK, ramp([[12.3, 0], [13.5, 1.45], [14.1, 1.45], [15.25, 2.8]], Tn), { stride: 0.3, swing: 0.42 });
        const peer = Math.sin(seg(Tn, 13.52, 14.08) * 2 * PI);
        H(s.cast.hero, { ...walk(w), heading: w.done ? aimHeading : w.heading, headY: peer * 0.6, hat: w.bob * 0.6, lean: 0.12, gun: { loaded: true, charge: 0.15, spin: Tn } });
        if (w.moving) once('step' + w.step, Tn, 0, () => snd('step', { strength: 0.22 }));
      },
    },
    {
      // 过肩中景 / 平视 / 慢推：蓄力越满越靠近 / 切到他的视角方向：这就是游戏里"背后 ×2"的那一枪 / 轴线南侧
      name: '04 瞄准后背', T0: 15.68, T1: 20.6, set: 'house',
      cam: move([-7.55, 1.8, -1.82], [-4.85, 0.9, 0.6], 40, [-7.3, 1.72, -1.7], [-4.85, 0.9, 0.6], 37, { m0: 0.1, m1: 0.85 }),
      play(Tn, s) {
        Z(s.cast.v, { x: V.x, z: V.z, heading: VH, sleep: 1, breathe: Tn }); mood(s.cast.v, 'zzz', Tn);
        const ch = ease(seg(Tn, 16.4, 19.7)), still = Tn > 20.0 ? Math.sin(Tn * 55) * 0.004 : 0;
        H(s.cast.hero, { x: AIM.x + still, z: AIM.z, heading: aimHeading, lean: 0.06 + ch * 0.07, squash: ch * 0.25, gun: { loaded: true, charge: 0.15 + ch * 0.85, spin: Tn * (1 + ch * 3) } });
        once('charge', Tn, 16.4, () => snd('charge'));
      },
    },
    // ============================== 第二段 · 闯祸（20.6–34.4 秒，音乐热闹起来）
    {
      // 全景双人 / 平视 / 固定：一枪的因和果在一个画面里 / 切在开火前一瞬（动作上切）/ 轴线南侧正侧面
      name: '05 一球放倒', T0: 20.6, T1: 24.36, set: 'house',
      cam: fix([-8.05, 1.55, 1.75], [-5.2, 0.85, -0.25], 40), shakes: [{ T: beat(48) + 0.1, amp: 0.012, dur: 0.3 }],
      play(Tn, s, dt) {
        const FIRE = beat(48), HIT = FIRE + 0.1, hero = s.cast.hero;
        // 僵尸：挨一下、扑倒、0.8 秒后化成一团绒絮
        const fall = seg(Tn, HIT, HIT + 0.46);
        Z(s.cast.v, { x: V.x + easeOut(fall) * 0.1 * V_FALL[0], z: V.z + easeOut(fall) * 0.1 * V_FALL[1], heading: VH, sleep: Tn < HIT ? 1 : 0, breathe: Tn, fall, fallDir: V_FALL, flash: Math.max(0, 1 - (Tn - HIT) * 6) * (Tn > HIT ? 1 : 0), visible: Tn < HIT + 0.96 });
        if (Tn < HIT) mood(s.cast.v, 'zzz', Tn);
        once('poof', Tn, HIT + 0.78, () => stage.burst(V.x + 0.7 * V_FALL[0], 0.4, V.z + 0.7 * V_FALL[1], 24, 1.0, 0xddd7b5));
        // 绒仔：开火后坐、探头看、连蹦三下庆祝；23.96 秒球掉回来砸在帽子上
        const BONK = beat(55), kick = Math.max(0, jolt(Tn - FIRE, 14, 7)) * 1.2;
        let hop = 0, squash = 0, arms = 0;
        for (const b of [52, 53, 54]) { const k = seg(Tn, beat(b), beat(b) + BEAT * 0.8); if (k > 0 && k < 1) { hop = Math.sin(k * PI) * 0.24; arms = Math.sin(k * PI); } const l = seg(Tn, beat(b) + BEAT * 0.8, beat(b) + BEAT); if (l > 0 && l < 1) squash = Math.sin(l * PI) * 0.7; }
        const bonk = Math.max(0, jolt(Tn - BONK, 18, 6)), peek = ease(seg(Tn, HIT + 0.5, HIT + 0.9)) * (1 - ease(seg(Tn, beat(52) - 0.2, beat(52))));
        H(hero, {
          x: AIM.x - kick * 0.05, z: AIM.z, heading: aimHeading, hop, squash: squash + bonk * 0.9 + (Tn < FIRE ? 0.25 : 0), lean: (Tn < FIRE ? 0.13 : 0) + peek * 0.16 - kick * 0.08,
          hat: -bonk * 0.05 + hop * 0.3, headX: bonk * 0.3,
          gun: { loaded: Tn < FIRE, charge: 1, kick, spin: Tn * 4, lift: arms * 0.22, pitch: arms * 0.9 },
        });
        const C = [V.x - 0.18, 1.0, V.z - 0.26];
        once('fire', Tn, FIRE, () => { const m = muzzleOf(hero); effects.muzzle(m, 0xffe2b0, 0.6, 5); stage.burst(m.x, m.y, m.z, 6, 0.5, 0xf3dfa5); snd('shot', { weapon: 'single', power: 1 }); this.m = [m.x, m.y, m.z]; });
        once('hit', Tn, HIT, () => { effects.ring(v3(...C), 0xffd27a, 0.9, 0.22); stage.burst(C[0], C[1], C[2], 12, 1.0, 0xe7ddbc); snd('hit', { weapon: 'single', strength: 1 }); snd('kill', { weapon: 'single' }); });
        // 球：飞过去 → 弹上天（出画，只听见它在外面"咚、咚"）→ 掉回来砸帽子 → 往左上弹走
        if (Tn >= FIRE && Tn < HIT) ball(s, 0, 'single', arc(this.m || C, C, seg(Tn, FIRE, HIT)), 0.17, { spin: Tn * 9, dt });
        else if (Tn >= HIT && Tn < HIT + 0.42) ball(s, 0, 'single', arc(C, [-5.2, 3.3, -0.3], easeOut(seg(Tn, HIT, HIT + 0.42))), 0.17, { spin: Tn * 9, dt });
        else if (Tn >= BONK - 0.28) ball(s, 0, 'single', along([[BONK - 0.28, [AIM.x + 0.1, 3.2, AIM.z + 0.05], 0, 'in'], [BONK, [AIM.x, 1.62, AIM.z], 0.25, 'out'], [24.5, [-6.6, 2.3, -1.1]]], Tn), 0.17, { spin: Tn * 9, dt });
        for (const [i, t] of [[0, HIT + 0.75], [1, beat(52) + 0.2], [2, beat(54) - 0.1]]) once('off' + i, Tn, t, () => snd('bounce', { weapon: 'single', strength: 0.5 }));
        once('bonk', Tn, BONK, () => { snd('bounce', { weapon: 'single' }); snd('pop', { strength: 0.5 }); stage.burst(AIM.x, 1.6, AIM.z, 5, 0.5, 0xf3dfa5); });
      },
    },
    {
      // 大全景 / 俯视 / 固定：球在满屋子弹，只有它在动 / 切高：看清球的路线和整间客厅 / 仍在轴线南侧（从东北角高处看，绒仔仍在画左）
      name: '06 球弹了一圈', T0: 24.36, T1: 27.84, set: 'house',
      cam: fix([-2.25, 2.55, 2.55], [-5.6, 0.45, -0.25], 50),
      play(Tn, s, dt) {
        const R = 0.17;
        const keys = [[24.36, [-6.5, 2.25, -1.08], 0.1], [beat(57), [-8.3, 1.35, -1.35], 0.45], [beat(59), [-3.9, 0.45 + R, -0.3], 0.4], [beat(60), [-2.75, R, -0.2], 0.14], [beat(61), [-1.55, R, -0.18], 0.03, 'out'], [27.9, [0.0, R, -0.6]]];
        const p = along(keys, Tn); ball(s, 0, 'single', p, R, { spin: Tn * 7, dt });
        [57, 59, 60].forEach((b, i) => once('bnc' + i, Tn, beat(b), () => { snd('bounce', { weapon: 'single' }); const q = keys[i + 1][1]; stage.burst(q[0], q[1], q[2], 5, 0.5, 0xf3dfa5); effects.spark(v3(...q), 0xfff0d8, 0.3); }));
        // 绒仔：捂着帽子，头跟着球转；球从茶几上弹下来他就追，绕着茶几北边跑到门口
        const hero = s.cast.hero, w = walkAlong([[AIM.x, AIM.z], [-5.2, -1.55], [-3.1, -1.55], [-2.6, -0.55]], ramp([[beat(59) + 0.1, 0], [27.75, 3.9]], Tn), { stride: 0.5, swing: 0.72, bob: 0.03 });
        const face = Math.atan2(p[0] - AIM.x, p[2] - AIM.z), guard = 1 - ease(seg(Tn, 25.3, 25.75));
        H(hero, { ...walk(w), heading: w.moving || w.done ? w.heading : lerp(aimHeading, face, ease(seg(Tn, 24.5, 25.2))), lean: w.moving ? 0.16 : 0, hat: w.bob * 1.2,
          armL: { x: lerp(HOLD_L.x, -2.8, guard), z: lerp(HOLD_L.z, 0.35, guard) }, armR: { x: lerp(HOLD_R.x, -2.8, guard), z: lerp(HOLD_R.z, -0.35, guard) }, gun: { spin: Tn } });
        if (w.moving) once('run' + w.step, Tn, 0, () => snd('step', { strength: 0.3 }));
      },
    },
    {
      // 全景 / 贴地仰视 / 固定：球从一排睡着的脚边滚过去，谁都别动 / 切到门厅：球到了哪、那里有什么 / 顺着球的去向（纵深）
      name: '07 从脚边滚过', T0: 27.84, T1: 31.31, set: 'house',
      cam: fix([0.35, 0.26, 2.1], [-0.05, 0.62, -3.2], 40),
      play(Tn, s, dt) {
        const R = 0.17, BUMP = bar(17);
        const keys = [[27.84, [-1.35, R, -0.3], 0], [28.75, [-0.15, R, -1.5], 0], [BUMP, [-0.22, R, -4.2], 0.02, 'out'], [30.5, [0.55, R, -5.5], 0, 'out'], [31.4, [0.3, R, -6.3]]];
        ball(s, 0, 'single', along(keys, Tn), R, { spin: -Tn * 5, dt: 0 });
        sleeper(s.cast.h1, HALL.h1, Tn); sleeper(s.cast.h2, HALL.h2, Tn);
        // 棉甲被碰了一下脚：哼一声、抬头、冒个问号，又睡回去
        const wake = ease(seg(Tn, BUMP, BUMP + 0.25)) * (1 - ease(seg(Tn, 30.55, 31.15)));
        sleeper(s.cast.h3, HALL.h3, Tn, { sleep: 1 - wake * 0.75, squash: Math.max(0, jolt(Tn - BUMP, 16, 6)) * 0.8, headY: wake * Math.sin((Tn - BUMP) * 3.2) * 0.45 });
        if (wake > 0.5) mood(s.cast.h3, '?', Tn - BUMP - 0.15);
        once('bump', Tn, BUMP, () => { snd('bounce', { weapon: 'single', strength: 0.6 }); snd('snort'); });
      },
    },
    {
      // 近景（物件特写）/ 贴地平视 / 固定：塔晃的时候镜头绝不动 / 切近：悬念全在这摞积木上 / —
      name: '08 积木塔', T0: 31.31, T1: 34.5, set: 'house',
      cam: fix([-1.0, 0.72, -5.45], [0.45, 0.78, -7.2], 44), shakes: [{ T: T_TOPPLE + 0.5, amp: 0.008, dur: 0.25 }, { T: T_CRASH, amp: 0.02, dur: 0.4 }],
      play(Tn, s) {
        const R = 0.17, keys = [[31.31, [0.2, R, -5.9], 0, 'out'], [T_TAP, [TOWER.x - 0.06, R, TOWER.z + 0.26], 0, 'out'], [T_TAP + 0.6, [TOWER.x - 0.1, R, TOWER.z + 0.36]]];
        ball(s, 0, 'single', along(keys, Tn), R, { spin: -Tn * 2.5 * (1 - seg(Tn, 31.3, T_TAP + 0.6)) });
        poseTower(s, Tn);
        once('tap', Tn, T_TAP, () => snd('knock', { strength: 0.35 }));
        once('crash', Tn, T_CRASH, () => { snd('crash'); const cx = TOWER.x + towerDir[0] * 1.3, cz = TOWER.z + towerDir[1] * 1.3; stage.burst(cx, 0.15, cz, 18, 1.6, 0xe7ddbc); });
      },
    },
    // ============================== 停顿（34.4–38.3 秒，音乐全停）
    {
      // 大全景 / 俯视 / 固定：全场静止，只有感叹号一个个冒 / 切远：一眼看到"全屋都醒了" / 从门厅尽头回看，绒仔在纵深最远处
      name: '09 全醒了', T0: 34.5, T1: 37.0, set: 'house',
      cam: fix([0.15, 2.55, -8.85], [0, 0.55, -3.4], 54),
      play(Tn, s) {
        poseTower(s, Tn, true);
        const SQUEAK = 36.72, turnAll = ease(seg(Tn, SQUEAK + 0.06, SQUEAK + 0.3));
        // 一只接一只醒：冒感叹号、蹦一下转向响声（朝镜头）；最后被一声"吱"齐刷刷转向绒仔
        const wakeAt = { h3: 35.26, h2: 35.69, h1: 36.13, d1: 36.35, d2: 36.56 }, home = { ...HALL, d1: [-1.62, -5.85, PI / 2], d2: [1.62, -6.25, -PI / 2] };
        for (const [n, t] of Object.entries(wakeAt)) {
          const a = s.cast[n], [x, z, h0] = home[n], w = seg(Tn, t, t + 0.3), door = n[0] === 'd';
          const toNoise = Math.atan2(TOWER.x - x, TOWER.z + 1.2 - z), toHero = Math.atan2(-1.45 - x, -0.15 - z);
          const hd = lerp(lerp(h0, h0 + shortest(h0, toNoise), ease(w)), h0 + shortest(h0, toHero), turnAll);
          const hop = Math.sin(w * PI) * 0.16 + Math.sin(seg(Tn, SQUEAK + 0.06, SQUEAK + 0.3) * PI) * 0.13;
          const xin = door ? lerp(x + (n === 'd1' ? -1.2 : 1.2), x, easeOut(seg(Tn, t - 0.25, t + 0.1))) : x;
          if (door && Tn < t - 0.25) { a.world.visible = false; continue; }
          Z(a, { x: xin, z, heading: hd, hop, sleep: door ? 0 : 1 - ease(seg(Tn, t - 0.05, t + 0.15)), breathe: Tn, reach: ease(w) * 0.25 + turnAll * 0.9, squash: Math.sin(seg(Tn, t + 0.3, t + 0.5) * PI) * 0.5 });
          if (Tn < t - 0.05 && !door) mood(a, 'zzz', Tn + x * 2); else if (Tn >= t) mood(a, '!', Tn - t, { size: 1.5 });
          once('wake' + n, Tn, t, () => snd('pop', { strength: 0.8 }));
        }
        const back = ease(seg(Tn, 36.3, 36.7));
        H(s.cast.hero, { x: -1.45 - back * 0.1, z: -0.15, heading: PI * 0.78, squash: Math.max(0, jolt(Tn - SQUEAK, 14, 6)), gun: { hide: true }, armL: { x: -0.4, z: 0.3 }, armR: { x: -0.4, z: -0.3 } });
        once('squeak', Tn, SQUEAK, () => snd('squeak'));
      },
    },
    {
      // 特写 / 平视 / 固定 / 反应镜头：大事之后看他的脸（帽子替他做表情）/ 轴线南侧，他仍朝画右
      name: '10 咕咚', T0: 37.0, T1: bar(22) - 0.04, set: 'house',
      cam: fix([-0.1, 1.2, -1.55], [-1.5, 1.08, -0.15], 32),
      play(Tn, s) {
        const popT = 37.2, hat = Tn < popT ? 0 : Math.max(0, Math.sin(seg(Tn, popT, popT + 0.42) * PI)) * 0.2 + jolt(Tn - popT - 0.42, 24, 9) * 0.03;
        const gulp = Math.sin(seg(Tn, 37.72, 37.95) * PI), draw = ease(seg(Tn, 37.95, 38.2));
        H(s.cast.hero, { x: -1.55, z: -0.15, heading: PI * 0.78, lean: draw * 0.1, squash: gulp * 0.6, hat, headX: -0.1 + gulp * 0.2,
          armL: draw > 0 ? null : { x: -0.4, z: 0.3 }, armR: draw > 0 ? null : { x: -0.4, z: -0.3 }, gun: { hide: draw <= 0, weapon: WEAPON_INDEX.scatter, lift: (draw - 1) * 0.3, spin: Tn } });
        once('hat', Tn, popT, () => snd('pop', { strength: 0.5 })); once('gulp', Tn, 37.72, () => snd('gulp')); once('draw', Tn, 37.95, () => snd('weapon'));
      },
    },
    // ============================== 第三段 · 一镜一把枪（38.3–50.5 秒，音乐最热闹）
    {
      // 全景 / 俯视 / 固定：三只扑过来、一枪三球 / 换到花园：追出来了，也换口气 / 轴线南侧，绒仔左、僵尸右
      name: '11 绒球霰弹', T0: bar(22) - 0.04, T1: 40.87, set: 'house', exposure: 0.8,
      cam: fix([-0.5, 2.9, 8.2], [-0.5, 0.7, 5.0], 40), shakes: [{ T: beat(90) + 0.02, amp: 0.014, dur: 0.3 }],
      play(Tn, s, dt) {
        const FIRE = beat(90), hero = s.cast.hero, kick = Math.max(0, jolt(Tn - FIRE, 14, 6)) * 1.3;
        const paths = { h2: [[-0.45, 3.5], [-0.9, 5.0]], d1: [[0.35, 4.3], [-0.2, 5.9]], h1: [[0.6, 3.2], [0.6, 4.6]] };   // 从正门出来；不踩花箱，彼此隔开一米多
        H(hero, { x: -2.3 - kick * 0.07, z: 5.4, heading: PI / 2, lean: 0.08 - kick * 0.1, squash: Tn < FIRE ? 0.2 : 0, hat: Math.max(0, jolt(Tn - FIRE - 0.05, 20, 7)) * 0.05, gun: { weapon: WEAPON_INDEX.scatter, kick, spin: Tn } });
        once('fire', Tn, FIRE, () => { const m = muzzleOf(hero); this.m = [m.x, m.y, m.z]; effects.muzzle(m, 0xffe2b0, 0.9, 6); stage.burst(m.x, m.y, m.z, 12, 0.6, 0xabc8bd); snd('shot', { weapon: 'scatter', power: 1 }); });
        // 挨了一下往后飞，倒的方向错开：不压在一起，也不倒进花箱
        Object.entries(paths).forEach(([n, path], i) => {
          const a = s.cast[n], h = hopAlong(path, Tn, { t0: 38.2 - i * 0.07, beat: BEAT * 0.72, hopLen: 0.55, height: 0.2 }), HIT = FIRE + 0.1 + i * 0.03;
          const at = hopAlong(path, HIT, { t0: 38.2 - i * 0.07, beat: BEAT * 0.72, hopLen: 0.55, height: 0.2 });
          if (Tn < HIT) Z(a, { x: h.x, z: h.z, heading: h.heading, hop: h.hop, squash: h.squash * 0.6, reach: 1.18, breathe: Tn });
          else { const f = seg(Tn, HIT, HIT + 0.5), k = easeOut(f), [ex, ez, fd] = [[0.1, 5.0, [1, 0]], [0.9, 6.2, [1, 0.3]], [1.9, 4.5, [1, -0.05]]][i]; Z(a, { x: lerp(at.x, ex, k), z: lerp(at.z, ez, k), heading: at.heading, fall: f, fallDir: fd, flash: Math.max(0, 1 - (Tn - HIT) * 6), visible: Tn < HIT + 0.96 }); }
          once('hit' + i, Tn, HIT, () => { effects.ring(v3(at.x, 0.9, at.z), 0xfff0d8, 0.6, 0.2); stage.burst(at.x, 0.9, at.z, 9, 1.1, 0xe7ddbc); snd('hit', { weapon: 'scatter', strength: 0.9 }); });
          once('poof' + i, Tn, HIT + 0.78, () => stage.burst([0.7, 1.5, 2.5][i], 0.4, [5.0, 6.35, 4.5][i], 16, 0.9, 0xddd7b5));
          if (Tn >= FIRE && Tn < HIT && this.m) ball(s, i, 'scatter', arc(this.m, [at.x, 0.9, at.z], seg(Tn, FIRE, HIT)), 0.1, { spin: Tn * 9, dt });
        });
        once('kill', Tn, FIRE + 0.2, () => snd('kill', { weapon: 'scatter' }));
      },
    },
    {
      // 全景 / 俯视 / 固定：一道电弧连跳三只 / 回屋里：厨房，新枪 / 从北侧看，绒仔仍在画左朝右
      name: '12 静电枪', T0: 40.87, T1: 43.48, set: 'house',
      cam: fix([-6.4, 2.2, -7.3], [-6.5, 0.7, -4.2], 50),
      play(Tn, s) {
        // 绒仔站得离餐桌远一点：背包不蹭桌子
        const ZAP = bar(24), hero = s.cast.hero, on = Tn >= ZAP, kick = Math.max(0, jolt(Tn - ZAP, 16, 8));
        H(hero, { x: -4.95, z: -4.3, heading: -PI / 2, lean: 0.08, hat: kick * 0.04, gun: { weapon: WEAPON_INDEX.stun, kick: kick * 0.6, spin: Tn } });
        const spots = [['h1', -6.45, -4.2, 0.6], ['d2', -7.5, -3.7, 0.6], ['h3', -7.85, -4.95, 0.45]], pts = [];   // 最后一个数：从身后多远蹦过来（棉甲贴着西墙，只能短一点）
        spots.forEach(([n, x, z, back], i) => {
          const path = [[x - back, z], [x, z]], opt = { t0: 40.9 + i * 0.1, beat: BEAT * 0.9, hopLen: back / 2, height: 0.16 };
          const a = s.cast[n], h = hopAlong(path, Tn, opt), frozen = hopAlong(path, ZAP + i * 0.06, opt);
          const q = on && Tn >= ZAP + i * 0.06 ? frozen : h, stunned = on && Tn >= ZAP + i * 0.06;
          Z(a, { x: q.x, z: q.z, heading: PI / 2, hop: q.hop, reach: 1.18, breathe: Tn, shiver: stunned ? Tn : 0, blue: stunned ? 1 : 0 });
          pts.push(v3(frozen.x, frozen.hop + a.height * 0.6, frozen.z));
          if (stunned) { const c = Math.floor(Tn * 9); once('ck' + i + c, Tn, 0, () => effects.crackle(q.x, q.hop, q.z, a.radius, a.height)); }
        });
        once('zap', Tn, ZAP, () => { const m = muzzleOf(hero); effects.zap([v3(m.x, m.y, m.z), ...pts]); snd('zap'); for (const p of pts) stage.burst(p.x, p.y, p.z, 6, 0.9, 0xbfeaff); });
        once('zap2', Tn, ZAP + 0.5, () => { const m = muzzleOf(hero); effects.zap([v3(m.x, m.y, m.z), ...pts]); snd('crackle'); });
        once('zap3', Tn, ZAP + 1.05, () => snd('crackle', { strength: 0.6 }));
      },
    },
    {
      // 全景 / 平视 / 固定：一针穿三只 / 换地图：博物馆的夜（硬切，靠音乐的拍子接）/ 绒仔左、僵尸右
      name: '13 毛衣针', T0: 43.48, T1: 46.09, set: 'museum',
      cam: fix([-0.75, 1.3, 11.75], [-0.75, 1.02, 8.6], 56), shakes: [{ T: beat(102) + 0.16, amp: 0.012, dur: 0.25 }],
      play(Tn, s) {
        const FIRE = beat(102), hero = s.cast.hero, kick = Math.max(0, jolt(Tn - FIRE, 16, 8)), aim = ease(seg(Tn, 43.5, 44.1));
        H(hero, { x: -3.05 - kick * 0.05, z: 9.05, heading: PI / 2, lean: 0.05 + aim * 0.08, squash: aim * 0.3 * (Tn < FIRE ? 1 : 0), gun: { weapon: WEAPON_INDEX.needle, kick, spin: Tn } });
        const xs = [-0.75, 0.3, 1.45], y = 1.02, zc = 9.05, falls = [[0.55, -0.83], [0.6, 0.8], [1, 0.1]];   // 三只朝三个方向倒，不叠在一起
        ['a', 'b', 'c'].forEach((n, i) => {
          const a = s.cast[n], h = hopAlong([[xs[i] + 0.9, zc], [xs[i], zc]], Tn, { t0: 43.45, beat: BEAT, hopLen: 0.45, height: 0.14 }), HIT = FIRE + 0.03 + i * 0.045;
          if (Tn < HIT) Z(a, { x: h.x, z: h.z, heading: -PI / 2, hop: h.hop, squash: h.squash * 0.6, reach: 1.18, breathe: Tn });
          else { const f = seg(Tn, HIT, HIT + 0.5 + i * 0.08); Z(a, { x: xs[i] + easeOut(f) * 0.35 * falls[i][0], z: zc + easeOut(f) * 0.35 * falls[i][1], heading: -PI / 2, fall: f, fallDir: falls[i], flash: Math.max(0, 1 - (Tn - HIT) * 6) * 0.3, visible: Tn < HIT + 1.0 }); }   // 夜里的受击闪光压暗一些，不然整只发黄
          once('hit' + i, Tn, HIT, () => { effects.ring(v3(xs[i], y, zc), 0xffd27a, 0.7, 0.2); stage.burst(xs[i], y, zc, 9, 1.0, 0xe7ddbc); snd('hit', { weapon: 'heavy', strength: 0.8 }); });
          once('poof' + i, Tn, HIT + 0.8, () => stage.burst(xs[i] + 0.9 * falls[i][0], 0.4, zc + 0.9 * falls[i][1], 16, 0.9, 0xddd7b5));
        });
        const END = 3.86, fly = seg(Tn, FIRE, FIRE + 0.2);
        once('fire', Tn, FIRE, () => { const m = muzzleOf(hero); this.m = [m.x, y, zc]; effects.muzzle(m, 0xffe2b0, 0.5, 4); snd('needle'); });
        if (Tn >= FIRE && fly < 1 && this.m) { const x = lerp(this.m[0], END, fly); ball(s, 0, 'needle', [x, y, zc], 0.03, { look: [x + 1, y, zc], trail: false }); }
        once('stick', Tn, FIRE + 0.2, () => { effects.stick(v3(END, y, zc), v3(1, 0, 0), 30); effects.spark(v3(END, y, zc), 0xfff0d8, 0.4); snd('thunk'); });
      },
    },
    {
      // 大全景 / 略俯 / 固定：手雷划一道弧线落进僵尸堆里，它们低头看，炸开一地线头 / 换地图：学校的上午（硬切）/ 绒仔左、僵尸右
      // （第二版在秋千架前面：前景挡着两块大积木，手雷飞出画外，炸开只有一层淡淡的光，僵尸原地套了三个圈——用户：没有爆炸效果，剧情也不搭。
      //   这一版挪到教学楼前的空地：整条抛物线都在画里；落地后它们低头看那一拍是"因"，炸飞是"果"。）
      name: '14 毛线团手雷', T0: 46.09, T1: 48.7, set: 'school',
      cam: fix([-0.5, 2.05, 8.1], [-0.5, 0.9, 3.9], 56), shakes: [{ T: beat(110), amp: 0.034, dur: 0.45 }],
      play(Tn, s, dt) {
        const THROW = beat(107), LAND = beat(109), BOOM = beat(110), hero = s.cast.hero, L = [0.3, 0.13, 4.3], HP = [-3.2, 4.9];
        const wind = ease(seg(Tn, 46.15, THROW)) * (1 - ease(seg(Tn, THROW, THROW + 0.18))), follow = Math.sin(seg(Tn, THROW, THROW + 0.4) * PI);
        // 扔出去以后他缩起来、两手按住帽子；炸的那一下帽子还是被掀起来
        const duck = ease(seg(Tn, LAND - 0.25, LAND + 0.05)), blast = Math.max(0, jolt(Tn - BOOM, 16, 5));
        const hd = Math.atan2(L[0] - HP[0], L[2] - HP[1]);
        H(hero, { x: HP[0] - blast * 0.06, z: HP[1], heading: hd, lean: -0.18 * wind + 0.2 * follow - blast * 0.1, squash: wind * 0.4 + duck * 0.55, hat: follow * 0.05 + blast * 0.12, hatTilt: blast * 0.2,
          armL: { x: lerp(HOLD_L.x, -2.8, duck), z: lerp(HOLD_L.z, 0.35, duck) }, armR: { x: lerp(lerp(HOLD_R.x, -3.3, wind) + follow * 1.4, -2.8, duck), z: lerp(HOLD_R.z, -0.35, duck) },
          gun: { weapon: WEAPON_INDEX.yarn, hide: Tn > THROW - 0.02, lift: wind * 0.3, spin: Tn } });
        const hand = [HP[0] + 0.35, 1.55, HP[1] - 0.1], L2 = [L[0] + 0.22, 0.13, L[2] - 0.06];
        if (Tn >= THROW && Tn < BOOM) ball(s, 0, 'yarn', along([[THROW, hand, 1.15], [LAND, L, 0.2], [BOOM, L2]], Tn), 0.13, { spin: Tn * 6, dt });
        once('throw', Tn, THROW, () => snd('throw')); once('land', Tn, LAND, () => { snd('bounce', { weapon: 'heavy', strength: 0.6 }); stage.burst(L[0], 0.1, L[2], 4, 0.5, 0xf6efe0); });
        once('boom', Tn, BOOM, () => {
          // 游戏里的爆炸是一层鼓起来的光球，大白天里只剩一个淡淡的泡泡；片子里换成：一下强闪光 + 贴地的一圈冲击波 + 一大团棉絮 + 满天线头
          effects.spark(v3(L2[0], 0.6, L2[2]), 0xfff0d0, 5.2); effects.spark(v3(L2[0], 0.5, L2[2]), 0xffc9e8, 3.2); effects.flash(v3(L2[0], 0.8, L2[2]), 0xffe2c0, 24, 0.35);
          effects.ring(v3(L2[0], 0.12, L2[2]), 0xfff0d8, 5.2, 0.45, 2.4); effects.ring(v3(L2[0], 0.4, L2[2]), 0xe6b8f0, 3.2, 0.3, 2.0); snd('boom');
          stage.burst(L2[0], 0.45, L2[2], 30, 3.0, 0xf6efe0, 0, { r: [0.16, 0.38], life: [0.65, 1.05], up: [1.0, 3.2] });   // 一大团棉絮
          for (const c of [0xd9a6e0, 0xf2d27a, 0x9fc3e0, 0xe7836f]) stage.burst(L2[0], 0.35, L2[2], 9, 3.0, c, 0, { r: [0.05, 0.12], life: [0.5, 0.8], up: [1.5, 4.2] });
          stage.curls(L2[0], 0.3, L2[2], 64, 4.4, [0xd9a6e0, 0xf2d27a, 0x9fc3e0, 0xe7836f, 0xf6efe0]);   // 线头：往外飞，落在地上不消失
        });
        // 四只围成半圈蹦过来；手雷落在中间，它们停下、低头看（冒问号）；炸开时朝外飞出去，落地化成绒絮
        const spots = [['a', -0.85, 4.2, -1.3, 4.0, [-0.8, -0.6]], ['b', 0.85, 2.75, 1.75, 2.35, [0.95, -0.3]], ['c', 0.75, 5.4, 0.95, 6.15, [0.25, 0.97]], ['d', 2.1, 3.8, 2.7, 3.65, [1, 0]]];   // 后三项：被炸到哪、朝哪边倒（对过操场上的花箱、大积木和绒仔，彼此也不压着）
        spots.forEach(([n, x, z, ex, ez, lie], i) => {
          const ux = x - HP[0], uz = z - HP[1], ul = Math.hypot(ux, uz);   // 从背离绒仔的方向蹦过来
          const a = s.cast[n], h = hopAlong([[x + ux / ul * 0.8, z + uz / ul * 0.8], [x, z]], Tn, { t0: 46.0 + i * 0.08, beat: BEAT * 0.9, hopLen: 0.4, height: 0.15 });
          const dx = x - L2[0], dz = z - L2[2], d = Math.hypot(dx, dz) || 1, look = ease(seg(Tn, LAND + 0.03 + i * 0.03, LAND + 0.2 + i * 0.03));
          if (Tn < BOOM) {
            Z(a, { x: h.x, z: h.z, heading: lerp(Math.atan2(HP[0] - x, HP[1] - z), Math.atan2(-dx, -dz), look), hop: h.hop, squash: h.squash * 0.6 + Math.max(0, jolt(Tn - LAND, 16, 6)) * 0.5, reach: 1.18 * (1 - look * 0.75), headX: look * 0.5, breathe: Tn });
            if (look > 0.6 && i % 2 === 0) mood(a, '?', Tn - LAND - 0.12);
          } else {
            const f = seg(Tn, BOOM, BOOM + 0.5), k = easeOut(f);
            Z(a, { x: lerp(x, ex, k), z: lerp(z, ez, k), heading: Math.atan2(-dx, -dz), hop: Math.sin(Math.min(1, f * 1.15) * PI) * 0.55, fall: f, fallDir: lie, flash: Math.max(0, 1 - (Tn - BOOM) * 5), visible: Tn < BOOM + 0.74 });
            once('poof' + i, Tn, BOOM + 0.62, () => stage.burst(ex + lie[0] * 0.6, 0.4, ez + lie[1] * 0.6, 16, 1.0, 0xddd7b5));
          }
        });
        once('kill', Tn, BOOM + 0.12, () => snd('kill', { weapon: 'heavy' }));
      },
    },
    {
      // 中景 / 平视正面 / 固定：最重的一炮直冲镜头，球把画面填满 → 接片名 / 回到花园正门前 / 正对镜头（收尾，破轴线：他第一次看向观众）
      name: '15 棉被炮', T0: 48.7, T1: beat(116) - 0.02, set: 'house', exposure: 0.8,
      cam: fix([0, 1.02, 6.85], [0, 0.98, 4.5], 38),
      play(Tn, s, dt) {
        const FIRE = beat(114), hero = s.cast.hero, kick = Math.max(0, jolt(Tn - FIRE, 12, 5)) * 1.5;
        const up = ease(seg(Tn, 48.75, 49.1)), ch = ease(seg(Tn, 49.05, FIRE));   // 站定，把炮端起来，蓄力
        H(hero, { x: 0, z: 4.5 - kick * 0.12, heading: 0, squash: ch * 0.3 * (Tn < FIRE ? 1 : 0), lean: ch * 0.06 - kick * 0.14,
          hat: Math.max(0, jolt(Tn - FIRE - 0.04, 18, 6)) * 0.08, gun: { weapon: WEAPON_INDEX.heavy, kick, loaded: false, spin: Tn, lift: (up - 1) * 0.25, pitch: (up - 1) * 0.5 } });
        once('fire', Tn, FIRE, () => { const m = muzzleOf(hero); this.m = [m.x, m.y, m.z]; effects.muzzle(m, 0xffe2b0, 1.2, 9); stage.burst(m.x, m.y, m.z, 14, 0.9, 0xd6a789); snd('shot', { weapon: 'heavy', power: 1 }); });
        if (Tn >= FIRE && this.m) { const k = easeIn(seg(Tn, FIRE, beat(116) - 0.06)); ball(s, 0, 'heavy', [lerp(this.m[0], 0, k), lerp(this.m[1], 1.02, k), lerp(this.m[2], 6.56, k)], 0.24, { spin: Tn * 5, dt, trail: k < 0.6 }); }
      },
    },
    // ============================== 片名（50.5–54.8 秒，收尾和弦）
    { name: '16 片名', T0: beat(116) - 0.02, T1: 54.8, set: 'house', title: true, cam: fix([0, 1.02, 6.85], [0, 0.98, 4.5], 38), play() {} },
    // ============================== 彩蛋（54.8–63.2 秒，没有音乐，只有一声越来越沉的低音）
    {
      // 全景 / 略俯 / 极慢的推 / 片名之后的"按钮"：他找到了毛线篮；他身后的黑暗里先亮起两只眼睛，然后守墓巨像一步一步走出来 / 观众看得见、他看不见
      // 屋子深处是一层层叠起来的黑幕（props.dark），巨像穿过它们走出来，所以是一点点显形的；唯一的光是毛线篮。
      name: '17 阁楼', T0: 54.8, T1: 63.2, set: 'house', floor: 2, exposure: 0.34,
      cam: move([8.8, 7.4, 2.78], [5.3, 6.85, 0.72], 53, [8.68, 7.36, 2.72], [5.3, 6.9, 0.72], 50, { ease: 'linear' }),
      shakes: [{ T: 60.95, amp: 0.012, dur: 0.35 }, { T: 61.95, amp: 0.016, dur: 0.35 }],
      play(Tn, s) {
        const y = 6, hero = s.cast.hero, boss = s.cast.boss, BK = [7.71, 1.19];
        const EYES = 58.95, STEP1 = 60.95, STEP2 = 61.95, FREEZE = 62.0, TURN = 62.3, BANG = 62.85;
        if (s.props.dark) s.props.dark.visible = true;
        if (s.props.glow) { s.props.glow.visible = true; s.props.glow.position.set(BK[0] - 0.05, y + 0.55, BK[1] + 0.05); s.props.glow.intensity = 5.2 + Math.sin(Tn * 5.3) * 0.25 + Math.sin(Tn * 13.1) * 0.12; }
        if (s.basket) { s.basket.visible = true; s.basket.position.x = BK[0]; s.basket.position.z = BK[1]; s.basket.position.y = (s.basket.userData.baseY ?? s.basket.position.y); if (s.basket.userData.body) s.basket.userData.body.rotation.y = Tn * 0.8; }
        // 绒仔：从暗处走出来，看见篮子，弯下腰伸手；62 秒觉得不对，僵住，慢慢回头
        const w = walkAlong([[3.6, 1.6], [6.0, 1.5], [7.06, 0.82]], ramp([[54.9, 0], [57.75, 3.66]], Tn), { stride: 0.42, swing: 0.5 });
        const perk = Math.max(0, Math.sin(seg(Tn, 57.85, 58.2) * PI)), bend = ease(seg(Tn, 58.25, 58.8)) * (1 - ease(seg(Tn, FREEZE, FREEZE + 0.25)) * 0.55), frozen = Tn >= FREEZE;
        const turn = ease(seg(Tn, TURN, TURN + 0.55)), shake = frozen && Tn < TURN ? Math.sin(Tn * 60) * 0.02 : 0;
        H(hero, { ...walk(w), y, heading: w.done ? Math.atan2(BK[0] - w.x, BK[1] - w.z) : w.heading, hat: w.bob + perk * 0.1 + (Tn >= BANG ? Math.max(0, Math.sin(seg(Tn, BANG, BANG + 0.3) * PI)) * 0.18 : 0), hatTilt: shake,
          lean: bend * 0.3, headY: -turn * 1.25, headX: -turn * 0.1, gun: { hide: true }, armL: { x: -0.5 - bend * 0.9, z: 0.3 }, armR: { x: -0.5 - bend * 0.9, z: -0.3 } });
        if (w.moving) once('st' + w.step, Tn, 0, () => snd('step', { strength: 0.3 }));
        // 巨像：先只有两只眼睛（它站在全黑的地方），眨一下；然后两步走出来，手慢慢抬起
        // 它走在木箱和宝箱中间那条一米六宽的过道里：还在门口的空地上就把两只手平举起来、往中间收（垂着或张开都会蹭到两边的箱子）
        const bx = lerp(2.3, 4.1, ease(seg(Tn, 60.5, 62.4))), stepPh = seg(Tn, 60.5, 62.4) * 2 * PI;
        if (Tn > EYES - 0.2) Z(boss, { x: bx, z: 1.5, y, heading: PI / 2, breathe: Tn * 0.6, lean: 0.1 + ease(seg(Tn, 61.5, 62.6)) * 0.08, legs: Math.sin(stepPh) * 0.22, hop: Math.abs(Math.sin(stepPh)) * 0.03,
          reach: 0.2 + ease(seg(Tn, 60.5, 61.25)) * 1.05 + ease(seg(Tn, 61.6, 62.7)) * 0.1, spread: -0.3, headZ: Math.sin(seg(Tn, 59.5, 60.4) * PI) * 0.12 });
        const open = ease(seg(Tn, EYES, EYES + 0.8)), blink = 1 - Math.sin(seg(Tn, 60.1, 60.45) * PI) * 0.94, head = boss.parts.get('Head');
        if (s.props.eyes && head) {
          head.updateWorldMatrix(true, false); const e = head.matrixWorld.elements;
          s.props.eyes.forEach((sp, i) => { sp.visible = open > 0.01; sp.position.set(e[12] + 0.5, e[13] + 0.2, e[14] + (i ? 0.2 : -0.2)); sp.scale.set(0.32, 0.32 * open * blink, 1); sp.material.opacity = open * (0.82 + Math.sin(Tn * 9 + i) * 0.06); });
        }
        if (Tn >= BANG) mood(hero, '!', Tn - BANG);
        once('drone', Tn, 58.3, () => snd('drone')); once('eyes', Tn, EYES, () => snd('shimmer'));
        once('thud1', Tn, STEP1, () => snd('thud')); once('thud2', Tn, STEP2, () => snd('thud', { strength: 1.3 })); once('bang', Tn, BANG, () => snd('stab'));
      },
    },
    { name: '18 黑', T0: 63.2, T1: DURATION, set: 'house', floor: 2, black: true, cam: fix([8.62, 7.3, 2.74], [5.2, 6.8, 1.5], 46), play() {} },
  ];

  function shortest(a, b) { let d = (b - a) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; }

  const cams = SHOTS.map(sh => filmCamera({ probe: () => [0, 0, 0], shakes: sh.shakes || [] }));
  let active = -1, lastT = -1;
  const indexAt = Tn => { for (let i = SHOTS.length - 1; i >= 0; i--) if (Tn >= SHOTS[i].T0) return i; return 0; };

  // 把片子摆到 Tn 这一刻（不渲染）。同一个镜头里只能往前走；跳到别处会从那个镜头的开头快进过来。
  function pose(Tn, dt) {
    const i = indexAt(Tn), sh = SHOTS[i];
    const s = stage.use(sh.set, sh.floor || 0);
    stage.clearFrame(); moods.length = 0;
    sh.play(Tn, s, dt);
    cams[i].place({ ...sh.cam, T0: sh.T0, T1: sh.T1 }, Tn, camera);
    camera.updateMatrixWorld(true);
    stage.layoutMoods(s, moods, camera);
    cine.post.exposure = sh.exposure ?? 1;
    cine.post.fade = sh.black ? 1 : 0;
    return sh;
  }
  function evaluate(Tn, dt = 1 / 30) {
    Tn = Math.min(DURATION - 1e-3, Math.max(0, Tn));
    const i = indexAt(Tn);
    if (i !== active || Tn < lastT) {
      // 进了新镜头（或者往回跳了）：清掉上一个镜头的绒絮和火花，从镜头开头静音快进到这一刻
      active = i; fired.clear(); stage.clearFx(); delete SHOTS[i].m;
      const mute = sink.sound; if (Tn - SHOTS[i].T0 > 0.05) sink.sound = null;
      for (let t = SHOTS[i].T0; t < Tn - 1e-4; t += 1 / 30) { pose(t, 1 / 30); stage.step(1 / 30, t); }
      sink.sound = mute;
    }
    lastT = Tn;
    const sh = pose(Tn, dt);
    stage.step(dt, Tn);
    return sh;
  }
  return { SHOTS, DURATION, evaluate, indexAt, reset() { active = -1; lastT = -1; } };
}
