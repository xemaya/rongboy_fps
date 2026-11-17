// 开场片的舞台：一个渲染器里搭好三张地图（家、博物馆、学校），各带一套演员和道具；一次只亮一张。
// 场景、手办、枪和特效全是游戏里那一套（world.js、手办运行时、arsenal.js），这里只负责"哪张图、谁在场"。
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCineRenderer, QUALITY } from '../../cine-engine/engine/index.js';
import { LOOK_PRESETS } from '../rongboy-mission/looks.js';
import { compileLevel } from '../rongboy-mission/level.js';
import { WEAPONS, ENEMY_TYPES } from '../rongboy-mission/game.js';
import { buildWorld } from '../rongboy-mission/world.js';
import { LEVELS } from '../rongboy-mission/levels/index.js';
import { extendWeaponKit, projectileModels, createEffects } from '../rongboy-mission/arsenal.js';
import { loadFigurines, createWoolBall, woolMaterial, addScoutHair } from '../../library/games/rongboy-runtime.js';
import { dressWalker, createWeaponKit } from '../../library/games/rongboy-workshop.js';
import assetData from '../rongboy-shooter-fps/models.js';
import { attachMood, layoutMoods } from './puppet.js';

export const WEAPON_INDEX = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));

// 每张图要的演员：名字 → 兵种（'scout' 是绒仔）
const CAST = {
  house: { hero: 'scout', v: 'walker', h1: 'walker', h2: 'leaper', h3: 'heavy', d1: 'leaper', d2: 'walker', boss: 'boss-warden' },
  museum: { hero: 'scout', a: 'walker', b: 'leaper', c: 'heavy' },
  school: { hero: 'scout', a: 'walker', b: 'leaper', c: 'leaper', d: 'heavy' },
};

export async function createStage({ canvas, quality, onError, onProgress = () => {} }) {
  // 阴影盒子跟着当前这张图换：引擎建渲染器时只记下这两个数组，换图时改数组里的数再重新对一次光
  const box = { min: [-11, -1, -14.5], max: [11, 10.5, 12.5] };
  const cine = createCineRenderer({
    canvas, look: LOOK_PRESETS.afternoon(), quality: quality || { ...QUALITY.high, pixels: 3.2e6 }, fov: 40, near: 0.04, far: 160, maxPixelRatio: 2, targetFps: 40,
    dynamicResolution: true, shadow: { mode: 'box', min: box.min, max: box.max, softness: 0.7 }, onError,
  });
  if (cine.postChain) cine.postChain.enable.volumetrics = false;   // 和游戏里一样：这里的体积光只会蒙一层雾
  const scene = cine.scene;
  const tick = () => new Promise(r => setTimeout(r, 0));

  onProgress('手办');
  const actors = await loadFigurines(assetData);
  const ballTemplates = projectileModels(WEAPONS, createWoolBall());
  const blobGeo = new T.PlaneGeometry(1, 1);
  const blobMat = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.55, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), color: 0x1b140c, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  })();

  function attachGun(a) {
    const weapon = extendWeaponKit(createWeaponKit(), WEAPONS);
    weapon.position.set(0, 0.24, 0.40);
    (a.parts.get('CTRL / body') || a.model).add(weapon);
    const ball = ballTemplates[0].clone(true); ball.position.z = 0.65; weapon.add(ball);
    a.gun = weapon; a.loaded = ball;
  }

  const sets = {};
  for (const id of ['house', 'museum', 'school']) {
    onProgress(LEVELS[id].texts.short); await tick();
    const level = compileLevel(LEVELS[id]), look = LOOK_PRESETS[level.look](), B = level.bounds;
    const sbox = { min: [B.minX - 1.5, -1, B.minZ - 1.5], max: [B.maxX + 1.5, level.top + 1, B.maxZ + 1.5] };
    box.min.splice(0, 3, ...sbox.min); box.max.splice(0, 3, ...sbox.max);
    cine.setLook(look);
    const world = buildWorld(cine, level, WEAPONS);
    const group = new T.Group(); scene.add(group);
    // 拾取物在片子里都收起来，只留任务目标（毛线篮），要用的时候再亮出来
    let basket = null;
    level.pickups.forEach((p, i) => { const o = world.pickups.get(p.id ?? i + 1); if (!o) return; o.visible = false; if (p.kind === 'objective' && !basket) { basket = Object.assign(o, { spot: p }); o.traverse(c => { if (c.isSprite) c.visible = false; }); } });   // 篮子头顶的名牌是给玩家看的，片子里不要
    const cast = {};
    for (const [name, kind] of Object.entries(CAST[id])) {
      const a = actors.create(kind);
      if (kind === 'scout') { attachGun(a); addScoutHair(a); attachMood(a, 1.5); a.radius = 0.3; }   // 帽子会弹起来，底下得有头发
      else { dressWalker(a, kind, ENEMY_TYPES[kind].scale); attachMood(a, ENEMY_TYPES[kind].height); a.radius = ENEMY_TYPES[kind].radius; }
      a.blob = new T.Mesh(blobGeo, blobMat); a.blob.rotation.x = -Math.PI / 2; a.blob.renderOrder = 1; a.blob.scale.setScalar(a.radius * 3.4); a.blob.position.y = 0.05; a.world.add(a.blob);
      world.light(a.world); a.world.visible = false; a.name = name; a.kind = kind; group.add(a.world); cast[name] = a;
    }
    // 毛球：每张图一小池子，按枪的种类取
    const balls = [];
    const ball = (i, weapon = 'single') => {
      const key = i + ':' + weapon; let o = balls.find(b => b.key === key);
      if (!o) { o = ballTemplates[WEAPON_INDEX[weapon]].clone(true); o.key = key; o.weapon = weapon; o.userData.trail = 0; world.light(o); group.add(o); balls.push(o); }
      return o;
    };
    world.root.visible = false; group.visible = false;
    sets[id] = { id, level, look, world, group, cast, ball, balls, basket, box: sbox, props: {} };
  }

  // 积木塔（家，门厅尽头）：七块毛绒积木摞着，球一碰就倒
  {
    const s = sets.house, tower = new T.Group(), colors = [0xe7836f, 0x9fc3e0, 0xf2d27a, 0x9fd8a4, 0xd9a6e0, 0xf2a65a, 0x8fc3e8];
    const geo = new RoundedBoxGeometry(0.21, 0.21, 0.21, 3, 0.035);
    tower.blocks = colors.map((c, i) => { const m = new T.Mesh(geo, woolMaterial(c)); m.castShadow = m.receiveShadow = true; tower.add(m); return m; });
    s.world.light(tower); tower.visible = false; s.group.add(tower); s.props.tower = tower;
    // 阁楼结尾用的三样：屋子深处的黑（八层半透明的黑幕叠起来，越往里越黑，角色穿过它们就是"从黑暗里走出来"）、
    // 巨像的两只眼睛（发亮的贴片，排在黑幕后面画，所以全黑里也看得见；照常做深度测试，前面有人就会被挡住——
    // 第二版关了深度测试，眼睛直接画到了绒仔的帽子上）、毛线篮发出的一点暖光
    const dark = new T.Group(), sheet = new T.PlaneGeometry(6.4, 2.9);
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(sheet, new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: i === 7 ? 1 : 0.3, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
      m.rotation.y = Math.PI / 2; m.position.set(4.3 - i * 0.17, 6 + 1.42, 0); m.renderOrder = 2; dark.add(m);
    }
    dark.visible = false; s.group.add(dark); s.props.dark = dark;
    const eyeTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,226,150,1)'); g.addColorStop(0.42, 'rgba(244,176,70,0.96)'); g.addColorStop(0.62, 'rgba(210,120,36,0.45)'); g.addColorStop(1, 'rgba(160,80,20,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      x.strokeStyle = 'rgba(60,34,16,0.92)'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(48, 48); x.lineTo(80, 80); x.moveTo(80, 48); x.lineTo(48, 80); x.stroke();
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    })();
    s.props.eyes = [0, 1].map(() => { const sp = new T.Sprite(new T.SpriteMaterial({ map: eyeTex, color: new T.Color(5, 5, 5), transparent: true, depthWrite: false, toneMapped: false })); sp.visible = false; sp.renderOrder = 8; s.group.add(sp); return sp; });
    const glow = new T.PointLight(0xffc98a, 5, 6.5, 1.5); glow.position.set(7.75, 6 + 0.55, 1.95); glow.visible = false; s.group.add(glow); s.props.glow = glow;
  }

  // ---- 绒絮：和游戏里一样的一小团一小团
  const FX_MAX = 420, fluff = [], dummy = new T.Object3D(), tint = new T.Color();
  const fxMesh = new T.InstancedMesh(new T.SphereGeometry(1, 7, 5), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), FX_MAX);
  fxMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); fxMesh.frustumCulled = false; fxMesh.setColorAt(0, new T.Color(0xffffff)); fxMesh.count = 0; scene.add(fxMesh);
  let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };   // 固定的随机数：每次放片绒絮都一样
  // opts：r 大小范围、life 寿命范围、up 往上的初速范围（手雷那一大团棉絮用）
  function burst(x, y, z, n = 10, force = 1, color = 0xf0dfba, floor = 0, opts = {}) {
    const [r0, r1] = opts.r || [0.025, 0.06], [l0, l1] = opts.life || [0.5, 0.8], [u0, u1] = opts.up || [0.6, 1.9];
    for (let i = 0; i < n; i++) {
      if (fluff.length >= FX_MAX) fluff.shift();
      const a = rnd() * Math.PI * 2;
      fluff.push({ x, y, z, floor: floor + 0.035, vx: Math.cos(a) * force * (0.5 + rnd() * 0.7), vz: Math.sin(a) * force * (0.5 + rnd() * 0.7), vy: u0 + rnd() * (u1 - u0), age: 0, life: l0 + rnd() * (l1 - l0), r: r0 + rnd() * (r1 - r0), color });
    }
  }
  function trail(x, y, z, color, r, floor = 0) {
    if (fluff.length >= FX_MAX) fluff.shift();
    fluff.push({ x, y, z, floor: floor + 0.035, vx: (rnd() - 0.5) * 0.25, vz: (rnd() - 0.5) * 0.25, vy: 0.25, age: 0, life: 0.34 + rnd() * 0.16, r: r * (0.6 + rnd() * 0.5), color });
  }
  function stepFluff(dt) {
    for (let i = fluff.length - 1; i >= 0; i--) {
      const p = fluff[i];
      p.age += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(p.floor, p.y + p.vy * dt); p.vy -= dt * 4;
      if (p.age > p.life) fluff.splice(i, 1);
    }
    for (let i = 0; i < fluff.length; i++) {
      const p = fluff[i], sc = p.r * Math.max(0, 1 - p.age / p.life);
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.age * 4, p.age * 6, 0); dummy.scale.set(sc * 0.8, sc * 1.2, sc); dummy.updateMatrix();
      fxMesh.setMatrixAt(i, dummy.matrix); fxMesh.setColorAt(i, tint.setHex(p.color));
    }
    fxMesh.count = fluff.length; fxMesh.instanceMatrix.needsUpdate = true;
    if (fxMesh.instanceColor) fxMesh.instanceColor.needsUpdate = true;
  }
  // 线头：手雷炸开时往外飞的一截截卷着的毛线，落地以后躺在地上，这个镜头里不消失
  const CURL_MAX = 96, curlList = [];
  const curlMesh = new T.InstancedMesh(new T.TorusGeometry(0.2, 0.024, 5, 12, 2.5), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), CURL_MAX);
  curlMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); curlMesh.frustumCulled = false; curlMesh.castShadow = true; curlMesh.setColorAt(0, new T.Color(0xffffff)); curlMesh.count = 0; scene.add(curlMesh);
  function curls(x, y, z, n, force, colors, floor = 0) {
    for (let i = 0; i < n; i++) {
      if (curlList.length >= CURL_MAX) curlList.shift();
      const a = rnd() * Math.PI * 2, sp = force * (0.35 + rnd() * 0.75);
      curlList.push({ x, y, z, floor: floor + 0.03, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 1.8 + rnd() * 3.4, rx: rnd() * 6, ry: rnd() * 6, rz: rnd() * 6, wx: (rnd() - 0.5) * 16, wz: (rnd() - 0.5) * 16, s: 0.6 + rnd() * 0.9, age: 0, down: false, color: colors[i % colors.length] });
    }
  }
  function stepCurls(dt) {
    curlList.forEach((p, i) => {
      p.age += dt;
      if (!p.down) {
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= dt * 9; p.rx += p.wx * dt; p.rz += p.wz * dt;
        if (p.y <= p.floor && p.vy < 0) { p.y = p.floor; p.down = true; p.rx = Math.PI / 2; p.rz = 0; }
      }
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, p.rz); dummy.scale.setScalar(p.s * Math.min(1, p.age * 10)); dummy.updateMatrix();
      curlMesh.setMatrixAt(i, dummy.matrix); curlMesh.setColorAt(i, tint.setHex(p.color));
    });
    curlMesh.count = curlList.length; curlMesh.instanceMatrix.needsUpdate = true;
    if (curlMesh.instanceColor) curlMesh.instanceColor.needsUpdate = true;
  }
  const effects = createEffects(scene);

  let current = null;
  function use(id, floor = 0) {
    const s = sets[id];
    if (current !== s) {
      for (const o of Object.values(sets)) { o.world.root.visible = o === s; o.group.visible = o === s; }
      box.min.splice(0, 3, ...s.box.min); box.max.splice(0, 3, ...s.box.max);
      cine.setLook(s.look);
      current = s;
    }
    s.world.setFloor(floor);
    return s;
  }
  // 每帧开头：当前这张图上的人和道具先全收起来，镜头要谁再摆谁
  function clearFrame() {
    if (!current) return;
    for (const a of Object.values(current.cast)) { a.world.visible = false; for (const m of a.moods) m.visible = false; if (a.tangle) a.tangle.visible = false; }
    for (const b of current.balls) b.visible = false;
    for (const p of Object.values(current.props)) { if (Array.isArray(p)) p.forEach(o => { o.visible = false; }); else p.visible = false; }
    if (current.basket) current.basket.visible = false;
  }
  // 毛球身后掉的一粒绒絮（手雷掉的是火星）
  function burstTrail(p, weapon, r, floor = 0) { trail(p[0], p[1], p[2], weapon === 'yarn' ? 0xffd27a : WEAPONS[WEAPON_INDEX[weapon]].color, r * (weapon === 'heavy' ? 0.5 : 0.42), floor); }
  // 被毛线缠住：身上绕三圈线（和游戏里一样），k 是缠上去的进度
  function tangle(a, k, time) {
    if (k <= 0) return;
    if (!a.tangle) {
      a.tangle = new T.Group();
      [0xd9a6e0, 0xf2d27a, 0x9fc3e0].forEach((color, i) => {
        const ring = new T.Mesh(new T.TorusGeometry(a.radius * 1.12, 0.03, 6, 22), new T.MeshStandardMaterial({ color, roughness: 1 }));
        ring.rotation.set(Math.PI / 2 + (i - 1) * 0.28, 0, i * 0.9); ring.position.y = a.height * (0.3 + i * 0.22); a.tangle.add(ring);
      });
      a.world.add(a.tangle);
    }
    a.tangle.visible = true; a.tangle.rotation.y = time * 1.3; a.tangle.scale.setScalar(Math.min(1, k));
  }
  function clearFx() { fluff.length = 0; fxMesh.count = 0; curlList.length = 0; curlMesh.count = 0; effects.clear(); seed = 7; }
  function step(dt, time) { stepFluff(dt); stepCurls(dt); effects.update(dt); if (current) current.world.update(time); }

  use('house');
  await cine.warmup();
  return { three: T, cine, scene, sets, use, clearFrame, clearFx, step, burst, trail, burstTrail, curls, tangle, effects, layoutMoods: (s, requests, camera) => layoutMoods(requests, camera), get current() { return current; } };
}
