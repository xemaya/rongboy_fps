// 两个试玩机器人，在真正的规则层（game.js）里把一张图打一遍，报告打没打完、挨了几下、在哪挨的。
// 它们只用手枪，瞄得一样准，差别只在"看不看"（docs/fun-design.md 第 6 节）：
//   偷懒的：见到僵尸就打，有东西贴近就往后退，别的不管。
//   留神的：瞄准线变红就换方向横着走、离开炸弹的红圈、对持盾者用蓄力球。
// 机器人证明不了好玩，只能说明"偷懒不行、留神可以"，以及哪里最容易挨打。只支持单层的图。不依赖 DOM。
import { compileLevel, freePoint, clearPath, lineOfSight, routeTo, navRadius, roomAt } from '../level.js';
import { createGame, step, beginCharge, releaseCharge, consumeEvents, aliveCount, missionStatus, CONFIG, ENEMY_TYPES } from '../game.js';
import { attackCue } from '../attacks.js';

const DT = 1 / 60, PR = navRadius(CONFIG.playerRadius);
const DIRS = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos(i * Math.PI / 8), z: Math.sin(i * Math.PI / 8) }));
const ranged = e => e.type === 'archer' || e.type === 'bomber';

// shift：出生点往旁边挪多少米（机器人对起点很敏感，体检会换几个起点各跑一遍）
export function playBot(def, { attentive = false, seconds, shift = 0 } = {}) {
  const L = def.storeys ? def : compileLevel(def);
  if (L.storeys.length > 1) return null;
  const s = createGame({ level: L }), p = s.player, limit = seconds ?? Math.max(240, (L.par || 300) * 2);
  if (shift && freePoint(L, p.x + shift, p.z, CONFIG.playerRadius + 0.05)) p.x += shift;
  const hits = [], dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // 这一枪打不打得到：毛球有粗细，所以除了正中一条线，左右各偏 0.14 米的两条也要是通的（不然会一直打在门框上）
  const canShoot = e => {
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1, nx = -dz / d * 0.14, nz = dx / d * 0.14, y = e.y + e.height * 0.55;
    return [0, 1, -1].every(k => lineOfSight(L, { x: p.x + nx * k, y: 1.05, z: p.z + nz * k }, { x: e.x + nx * k, y, z: e.z + nz * k }));
  };
  const aim = e => {
    const o = { x: p.x, y: p.y + 1.05, z: p.z }, t = { x: e.x, y: e.y + e.height * 0.55, z: e.z }, d = Math.hypot(t.x - o.x, t.y - o.y, t.z - o.z) || 1;
    const dir = { x: (t.x - o.x) / d, y: (t.y - o.y) / d, z: (t.z - o.z) / d };
    return { origin: { x: o.x + dir.x * 0.5, y: o.y, z: o.z + dir.z * 0.5 }, direction: dir };
  };
  let held = false, strafe = 1, wasLocked = false, goal = null, route = [], planIn = 0, lastSpot = { x: p.x, z: p.z }, stuckFor = 0, shove = null;
  let aimed = null, aimedSince = 0, lastHit = -9, giveUp = new Map();   // 对着同一只打了 3 秒都没打中：先不打它，换个位置
  let progress = 0;   // 上一次有进展（打中、击倒、挨打、捡到东西）是什么时候；一分钟没进展就是机器人自己绕不出来了，不再耗着
  while (s.time < limit && s.phase === 'playing' && s.time - progress < 60) {
    const foes = s.enemies.filter(e => e.alive && e.enabled), awake = foes.filter(e => e.awareness === 'alert' || e.awareness === 'waking');
    // 去哪：先对付已经发现自己的；没有，就去找还没拿的任务物品、然后是最近的僵尸；东西齐了就回出口
    planIn -= DT;
    if (planIn <= 0) {
      planIn = 0.4;
      const m = missionStatus(s), want = [];
      if (m.type === 'fetch' && m.carrying) { const X = L.mission.exit; want.push({ x: (X.minX + X.maxX) / 2, z: (X.minZ + X.maxZ) / 2 }); }
      else if (awake.length) want.push(...awake);
      else {
        if (m.type === 'fetch') want.push(...s.pickups.filter(k => k.kind === 'objective' && !k.taken));
        if (!want.length || m.type !== 'fetch') want.push(...foes);
      }
      // 已经在追的那只还在名单里就接着追，不来回换（不然隔着墙的两只会让它原地打转）
      goal = want.includes(goal) ? goal : want.slice().sort((a, b) => dist(a, p) - dist(b, p))[0] || null;
      route = goal ? routeTo(L, p, goal, PR) : [];
    }
    // 打谁：看得见、够得着的里面最近的。还没发现自己的，走到 6 米内（手枪全额伤害的距离）再开第一枪
    const target = foes.filter(e => !(giveUp.get(e.id) > s.time) && dist(e, p) < (awake.includes(e) ? 10 : 6) && canShoot(e)).sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (target !== aimed) { aimed = target; aimedSince = s.time; }
    if (target && s.time - Math.max(aimedSince, lastHit) > 3) { giveUp.set(target.id, s.time + 2.5); goal = target; planIn = 0; }
    let mx = 0, mz = 0;
    const close = awake.filter(e => !ranged(e) && dist(e, p) < 4.5).sort((a, b) => dist(a, p) - dist(b, p));
    if (close.length) {
      // 有东西贴近：十六个方向里挑一个走得通、离它们最远的
      let best = null;
      for (const d of DIRS) {
        const q = { x: p.x + d.x * 0.9, z: p.z + d.z * 0.9 };
        if (!freePoint(L, q.x, q.z, CONFIG.playerRadius + 0.05) || !clearPath(L, p, q, CONFIG.playerRadius)) continue;
        const open = freePoint(L, p.x + d.x * 2.2, p.z + d.z * 2.2, CONFIG.playerRadius) ? 0.6 : 0;   // 别往死角里退
        const score = Math.min(...close.map(e => dist(e, q))) + open;
        if (!best || score > best.score) best = { ...d, score };
      }
      if (best) { mx = best.x; mz = best.z; }
    } else if (!target && route.length) {
      const next = route[0];
      if (dist(next, p) < 0.25 && route.length > 1) route.shift();
      const d = dist(route[0], p) || 1; mx = (route[0].x - p.x) / d; mz = (route[0].z - p.z) / d;
    }
    if (attentive) {
      const archer = foes.find(f => attackCue(f)?.locked), aiming = foes.find(f => f.action === 'archer-aim');
      if (archer && !wasLocked) strafe = -strafe;
      wasLocked = !!archer;
      const from = archer || aiming || (s.enemyShots.length ? s.enemyShots[0] : null);
      if (from) {
        const ax = p.x - from.x, az = p.z - from.z, ad = Math.hypot(ax, az) || 1;
        let sx = -az / ad * strafe, sz = ax / ad * strafe;
        if (!freePoint(L, p.x + sx * 0.7, p.z + sz * 0.7, CONFIG.playerRadius)) { sx = -sx; sz = -sz; }   // 这边是墙：往另一边
        mx += sx * 1.4; mz += sz * 1.4;
      }
      for (const b of s.enemyBombs) { const bx = p.x - b.x, bz = p.z - b.z, bd = Math.hypot(bx, bz) || 1; if (bd < b.radius + 0.6) { mx += bx / bd * 3; mz += bz / bd * 3; } }
      for (const f of foes) { const cue = attackCue(f); if (cue?.kind === 'landing') { const bx = p.x - cue.target.x, bz = p.z - cue.target.z, bd = Math.hypot(bx, bz) || 1; if (bd < cue.radius + 0.6) { mx += bx / bd * 3; mz += bz / bd * 3; } } }
    }
    // 卡住了（3 秒没挪动、也没有可打的）：朝一个走得通的方向挤一下
    stuckFor = dist(p, lastSpot) > 0.4 || target ? ((lastSpot = { x: p.x, z: p.z }), 0) : stuckFor + DT;
    if (stuckFor > 3) { shove = { until: s.time + 0.8, ...(DIRS.filter(d => freePoint(L, p.x + d.x, p.z + d.z, CONFIG.playerRadius))[Math.floor(s.time) % 5] || DIRS[0]) }; stuckFor = 0; planIn = 0; }
    if (shove && s.time < shove.until) { mx = shove.x; mz = shove.z; }
    if (target) {
      const need = attentive && target.type === 'shielded' && target.guardBroken <= 0 ? 0.56 : 0;
      if (!held && s.cooldown <= 0 && !s.reloading) held = beginCharge(s);
      else if (held && s.charge >= need) { releaseCharge(s, aim(target)); held = false; }
    }
    step(s, DT, { x: mx, z: mz });
    for (const e of consumeEvents(s)) if (e.type === 'hit') lastHit = progress = s.time; else if (e.type === 'knockdown' || e.type === 'pickup') progress = s.time; else if (e.type === 'hurt') {
      progress = s.time;
      const by = s.enemies.find(q => q.id === e.by);
      hits.push({ x: Math.round(e.x * 10) / 10, z: Math.round(e.z * 10) / 10, t: Math.round(s.time), by: by?.type ?? '?', source: e.source, room: roomAt(L, e.x, e.z)?.name ?? '?' });
    }
  }
  return { won: s.phase === 'won', phase: s.phase === 'playing' ? 'stalled' : s.phase, hurt: s.damageTaken, time: Math.round(s.time), left: aliveCount(s), kills: s.kills, hits, stars: s.stars,
    leftWhere: s.enemies.filter(e => e.alive && e.enabled).map(e => ({ type: e.type, name: ENEMY_TYPES[e.type].name, room: roomAt(L, e.x, e.z)?.name ?? '?' })) };
}
