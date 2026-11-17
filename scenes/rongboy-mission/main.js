// Rongboy 任务制试玩：家 · 三层楼与花园。第一人称、纯键盘。
// 战斗规则在 game.js，关卡几何在 level.js；这里只管画面、声音、输入和 HUD。
import * as T from 'three';
import { createCineRenderer, QUALITY } from '../../cine-engine/engine/index.js';
import { createGovernor } from './governor.js';
import { LOOK_PRESETS } from './looks.js';
import { loadFigurines, createWoolBall } from '../../library/games/rongboy-runtime.js';
import { dressWalker, createWeaponKit } from '../../library/games/rongboy-workshop.js';
import { createRecoil, kickRecoil, stepRecoil, enemyReaction } from '../rongboy-shooter-fps/feedback.js';
import { createWoolAudio } from '../rongboy-shooter-fps/sound.js';
import assetData from '../rongboy-shooter-fps/models.js';
import { actionPose } from './actions.js';
import { compileLevel, segmentBox, roomAt, inBounds, lineOfSight, isOutdoor, storeyAt, floorIndex } from './level.js';
import { createGame, beginCharge, releaseCharge, startReload, selectWeapon, step, consumeEvents, missionStatus, aliveCount,
  cameraMove, segmentCylinder, CONFIG, WEAPONS, ENEMY_TYPES, TANGLE_SPEED } from './game.js';
import { buildWorld } from './world.js';
import { extendWeaponKit, projectileModels, createEffects } from './arsenal.js';
import { createArsenalAudio } from './sfx.js';
import { LEVELS, ORDER } from './levels/index.js';
import { trainingDef } from './levels/training.js';
import { ATTACKS, attackCue } from './attacks.js';
import { applyAttackPose } from './attack-pose.js';
import { createCombatFx } from './combat-fx.js';
import { createMenu, createMenuToy } from './menu.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// 哪张地图：网址里的 ?level=<id>，没有就是第一张。换图是换网址重新加载（场景和光线都是开局时搭好的）。
// ?level=training 是九类僵尸的试战庭院（&type=<兵种> 只练一种），从手办图鉴页进来，不在三张地图的列表里。
const training = q.get('level') === 'training', practiceType = ENEMY_TYPES[q.get('type')] ? q.get('type') : null;
const levelId = training ? 'training' : LEVELS[q.get('level')] ? q.get('level') : ORDER[0];
const level = compileLevel(training ? trainingDef(practiceType) : LEVELS[levelId]);
const TX = level.texts || { short: level.name, eyebrow: level.name, title: level.name, intro: level.mission.title, how: [], start: '进入', won: '全部清空！' };
const EYE = 1.23, FAR = 30, SH = level.storeyHeight;
// 脚下是露天的花园吗（楼上不算）
const openAir = (x, y, z) => y < 1 && isOutdoor(level, x, z);

let s = createGame({ level });
let mode = 'menu', ready = false, paused = false, down = false;   // mode：menu 主界面 / depart 出发的过渡 / playing / result
let menu = null, toy = null, departT = 0;
const DEPART = 1.25, onMenu = () => mode === 'menu' || mode === 'depart';
let actors, menuHero, menuZombie, fpHero, gun, loadedBall;
let yaw = level.player.yaw || 0, pitch = 0, phase = 0, acc = 0, shake = 0, last = performance.now(), frameCount = 0;
let recoil = createRecoil(), hitMarkerTime = 0, hitMarkerKind = '', toastUntil = 0, lastRoom = '', zoom = 0;
const keys = new Set(), errors = [], frameIntervals = [];

// 把这张图的名字和说明写进界面；开始画面上列出所有地图，按数字键换图。
function applyTexts() {
  document.title = `Rongboy · ${level.name}`;
  for (const el of document.querySelectorAll('.sub')) el.textContent = level.name;
  $('brief').textContent = training
    ? (practiceType ? `${ATTACKS[practiceType].name}：${ATTACKS[practiceType].counter}。本场共 ${s.total} 个目标。` : '九类僵尸各有攻击。看懂预告再动手：瞄准线、爆圈、吸引扇区。')
    : `${TX.short} · ${level.mission.title}`;
  $('pauseHow').innerHTML = (TX.how || []).join('<br>');
  $('result').querySelector('.eyebrow').textContent = level.name;
  $('objective').textContent = level.mission.title;
  // 主界面的几项。试战场是另一张图，从那里可以回来。
  const items = training
    ? [{ id: 'start', label: '进入试战' }, { id: 'zombies', label: '图鉴' }, { id: 'home', label: '回主界面' }]
    : [{ id: 'start', label: '出发' }, { id: 'level', label: '地图', pick: TX.short }, { id: 'zombies', label: '图鉴' }, { id: 'training', label: '试战场' }];
  menu = createMenu($('menu'), items, { onActivate: activate });
}
function activate(item) {
  if (item.id === 'start') depart();
  else if (item.id === 'level') cycleLevel(1);
  else if (item.id === 'zombies') location.href = 'rongboy-zombies.html?v=cast-v5';
  else if (item.id === 'training') location.href = 'rongboy-mission.html?level=training';
  else if (item.id === 'home') location.href = 'rongboy-mission.html';
}
function cycleLevel(d) { if (!training) switchLevel(ORDER[(ORDER.indexOf(levelId) + d + ORDER.length) % ORDER.length]); }
function switchLevel(id) {
  if (!LEVELS[id] || id === levelId) return;
  const next = new URLSearchParams(location.search); next.set('level', id); next.delete('from'); location.search = next.toString();
}
function fail(err) {
  const msg = String(err?.stack || err);
  errors.push(msg); $('error').textContent = msg; $('menuKeys').textContent = '加载失败';
}
addEventListener('error', e => fail(e.error || e.message));
addEventListener('unhandledrejection', e => fail(e.reason));

// ---------- 画面 ----------

// 光线按关卡取（level.look），预设在 looks.js（开场片也用同一份）。
const look = (LOOK_PRESETS[level.look] || LOOK_PRESETS.afternoon)();
const B = level.bounds;
// 清晰度：先保光影，再保分辨率，目标 30 帧。调节器在 governor.js（为什么不用引擎自带的，也写在那里），引擎自带的关掉了。
// 分三档，每档有自己的像素数范围；第 0 档的光影和导出视频时一样（4 倍抗锯齿、环境遮蔽、16 次采样的软阴影），只动像素数：
const LOOKS = [
  { q: { ...QUALITY.high }, min: 0.55e6, max: 3.6e6 },                  // Retina 原生是 360 万像素；最低相当于 990×557
  { q: { ...QUALITY.medium, scale: 1 }, min: 0.4e6, max: 1.0e6 },       // 2 倍抗锯齿，环境遮蔽还在
  { q: { ...QUALITY.low, scale: 1 }, min: 0.25e6, max: 1.0e6 },         // 最后才关抗锯齿和环境遮蔽
];
const fixedQuality = QUALITY[q.get('q')] || null, governed = !fixedQuality && q.get('dynres') !== '0';   // 网址加 ?q=medium / ?q=low 手动定档；?dynres=0 固定在第 0 档的最高像素数
const governor = createGovernor(LOOKS, { start: governed ? 1.6e6 : LOOKS[0].max });   // 从 160 万像素起步，头几秒里自己往上或往下找
const cine = createCineRenderer({
  canvas: $('view'), look, quality: fixedQuality || { ...LOOKS[0].q, pixels: governor.pixels }, fov: 65, near: 0.035, far: 150, maxPixelRatio: 2, targetFps: 30,
  dynamicResolution: false, shadow: { mode: 'box', min: [B.minX - 1.5, -1, B.minZ - 1.5], max: [B.maxX + 1.5, level.top + 1, B.maxZ + 1.5], softness: 0.7 }, onError: fail,
});
// 每帧把帧间隔喂给调节器。窗口不在前台时浏览器会把出帧压到很慢，那种帧间隔说明不了显卡快慢，不喂。
function govern(now, elapsed) {
  if (!governed || document.hidden || (document.hasFocus && !document.hasFocus())) return;
  const r = Math.min(devicePixelRatio || 1, 2), next = governor.feed(now, elapsed, innerWidth * r * innerHeight * r);
  if (next) cine.setQuality({ ...LOOKS[next.tier].q, pixels: next.pixels });
}
const world = buildWorld(cine, level, WEAPONS);
// 体积光在这里只会给整个画面蒙一层雾（实测看不出光柱），关掉省一趟半分辨率的光线步进。
if (cine.postChain) cine.postChain.enable.volumetrics = false;
// 九类僵尸的攻击预告（瞄准线、落点圈、吸引扇区）、敌方的箭和炸弹
const combatFx = createCombatFx(cine.scene);

const camera = cine.camera, ray = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
const lookDir = new T.Vector3(), muzzleWorld = new T.Vector3(), target = new T.Vector3(0, 0.75, -1);
const enemyModels = new Map(), ballModels = new Map();
const ballTemplate = createWoolBall();
const ballTemplates = projectileModels(WEAPONS, ballTemplate);
const effects = createEffects(cine.scene);
const feelOf = id => { const w = WEAPONS.find(v => v.id === id); return w?.feel || id; };   // 后坐力、受击声借用前三把里的哪一把

// 绒絮粒子：一个实例化网格，上限 360 颗（毛球拖尾和爆炸要用不少）。
const FX_MAX = 360, fx = [], dummy = new T.Object3D(), tint = new T.Color();
const fxMesh = new T.InstancedMesh(new T.SphereGeometry(1, 7, 5), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), FX_MAX);
fxMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); fxMesh.frustumCulled = false; fxMesh.setColorAt(0, new T.Color(0xffffff)); fxMesh.count = 0;
cine.scene.add(fxMesh);
function burst(x, z, n = 10, force = 1, color = 0xf0dfba, y = 0.55) {
  const floor = Math.max(0, Math.floor((y + 0.25) / SH)) * SH + 0.035;   // 绒絮落到这一层的地面为止
  for (let i = 0; i < n; i++) {
    if (fx.length >= FX_MAX) fx.shift();
    const a = Math.random() * Math.PI * 2;
    fx.push({ x, y, z, floor, vx: Math.cos(a) * force, vz: Math.sin(a) * force, vy: 0.6 + Math.random() * 1.3, age: 0, life: 0.45 + Math.random() * 0.25, r: 0.025 + Math.random() * 0.035, color });
  }
}
// 毛球身后掉的一粒绒絮：几乎不动，慢慢落下、变小
function trail(x, y, z, color, r) {
  if (fx.length >= FX_MAX) fx.shift();
  fx.push({ x, y, z, floor: Math.max(0, Math.floor((y + 0.25) / SH)) * SH + 0.035, vx: (Math.random() - 0.5) * 0.25, vz: (Math.random() - 0.5) * 0.25, vy: 0.25, age: 0, life: 0.32 + Math.random() * 0.16, r: r * (0.6 + Math.random() * 0.5), color });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    p.age += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(p.floor, p.y + p.vy * dt); p.vy -= dt * 4;
    if (p.age > p.life) fx.splice(i, 1);
  }
  for (let i = 0; i < fx.length; i++) {
    const p = fx[i], scale = p.r * Math.max(0, 1 - p.age / p.life);
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.age * 4, p.age * 6, 0); dummy.scale.set(scale * 0.8, scale * 1.2, scale); dummy.updateMatrix();
    fxMesh.setMatrixAt(i, dummy.matrix); fxMesh.setColorAt(i, tint.setHex(p.color));
  }
  fxMesh.count = fx.length; fxMesh.instanceMatrix.needsUpdate = true;
  if (fxMesh.instanceColor) fxMesh.instanceColor.needsUpdate = true;
}

// ---------- 声音与提示 ----------

let sound = true, audio = null, soundBus = null, arsenalBus = null, lastBounceSound = 0;
function unlock() { if (!sound) return; audio ??= new AudioContext(); soundBus ??= createWoolAudio(audio); arsenalBus ??= createArsenalAudio(audio); audio.resume(); }
function sfx2(kind, options = {}) { if (sound && audio && audio.state === 'running') arsenalBus.play(kind, options); }
function sfx(kind, options = {}) { if (sound && audio && audio.state === 'running') soundBus.play(kind, options); }
function say(text, seconds = 1.2) { $('toast').textContent = text; toastUntil = performance.now() + seconds * 1000; }
const part = (a, n) => a.parts.get(n);

// ---------- 第一人称的手和枪 ----------

// 手和枪以眼睛为中心整体缩小到 FP_SCALE 倍（大小、离眼睛的距离一起缩）：屏幕上的样子不变，
// 但最远的枪口离眼睛只有 0.28 米，比玩家的碰撞半径（0.30 米）短，贴着墙站也伸不进墙里。
// 出球点仍按没缩小时的位置算（同一条视线上，远 1/FP_SCALE 倍），玩法不变。
const FP_SCALE = 0.3;
const fpAim = new T.Vector3();
// 枪该指向哪：瞄准点跟着缩到眼前，枪的朝向就和没缩小时一模一样
function fpAimPoint(distance) {
  if (distance > 0.85) return fpAim.copy(target).sub(camera.position).multiplyScalar(FP_SCALE).add(camera.position);
  return fpAim.copy(camera.position).addScaledVector(lookDir, 3 * FP_SCALE);
}

function attachGun(a) {
  const weapon = extendWeaponKit(createWeaponKit(), WEAPONS);
  weapon.position.set(0, 0.24, 0.40);
  (part(a, 'CTRL / body') || a.model).add(weapon);
  const ball = ballTemplate.clone(true); ball.position.z = 0.65; weapon.add(ball);
  a.gun = weapon; a.loaded = ball;
  return weapon;
}
// 第一人称只保留手臂和枪，其余身体网格隐藏。
function makeHandsOnly(a) {
  a.model.traverse(o => {
    if (!o.isMesh) return;
    let n = o, arm = false, weapon = false;
    while (n && n !== a.model) { if (n === a.gun) weapon = true; if (n.userData.part?.startsWith('CTRL / arm ')) arm = true; n = n.parent; }
    o.visible = arm || weapon; o.castShadow = false; o.receiveShadow = false;
  });
}
function syncWeapon() { if (fpHero) for (const a of [fpHero, menuHero]) a.gun.userData.variants.forEach((v, i) => { v.visible = i === s.weapon; }); }
// 手里这把枪上会动的小零件：电火花跳、缝纫机手轮转、手雷打空了线团不见
function animateGun(hero, dt) {
  const v = hero.gun.userData.variants[s.weapon], u = v?.userData, w = WEAPONS[s.weapon];
  if (!u) return;
  if (u.spark) { const k = 0.7 + Math.random() * 0.6; u.spark.scale.setScalar(s.ammo[s.weapon].mag > 0 ? k : 0.01); }
  if (u.wheel) u.wheel.rotation.x += dt * (s.trigger && !s.reloading ? 26 : 1.5);
  if (u.round) { u.round.visible = s.ammo[s.weapon].mag > 0 && !s.reloading; u.round.rotation.y += dt * 1.5; u.fuse.scale.setScalar(s.charging ? 1 + Math.sin(s.time * 30) * 0.4 : 0.6); }
}

function animateHero(dt, moving) {
  const hero = onMenu() ? menuHero : fpHero;
  hero.reset();
  const heading = onMenu() ? (toy ? toy.heroHeading : 0.18) : Math.PI;
  hero.model.rotation.y = heading;
  const side = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), fwd = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0), speed = Math.hypot(side, fwd);
  if (moving && speed > 0) phase += dt * 10.5;
  const body = part(hero, 'CTRL / body'), head = part(hero, 'CTRL / head'), pack = part(hero, 'CTRL / backpack');
  if (body) body.position.y += Math.sin(phase * 2) * 0.012 * (speed > 0 ? 1 : 0.3);
  for (const sign of [-1, 1]) {
    const arm = part(hero, 'CTRL / arm ' + sign);
    if (arm) { arm.rotation.x -= 1.05; arm.rotation.z -= sign * 0.43; }
  }
  const charge = s.charging ? s.charge / CONFIG.chargeTime : 0, motion = reduced ? 0.5 : 1;
  // 换弹时把枪压低，换完再抬起来。
  const w = WEAPONS[s.weapon], reload = s.reloading ? Math.sin(Math.min(1, 1 - s.reload / w.reload) * Math.PI) : 0;
  if (body) body.rotation.x += recoil.pitch.x * 0.12 - charge * 0.025;
  if (head) head.rotation.x -= recoil.pitch.x * 0.1;
  if (pack) pack.rotation.x += Math.sin(phase * 0.8) * 0.018 * speed - recoil.pitch.x * 0.1;
  hero.gun.position.set(recoil.side.x * motion, 0.24 + recoil.up.x * motion - reload * 0.16, 0.40 - recoil.back.x * motion);
  hero.loaded.visible = (s.charging && s.weapon < 3) || onMenu();   // 只有前三把是往筒里装毛球
  animateGun(hero, dt);
  hero.loaded.scale.setScalar(0.12 + charge * 0.18); hero.loaded.rotation.y += dt * 2;
  if (!onMenu()) {
    camera.updateMatrixWorld(true);
    const distance = aim();
    hero.gun.lookAt(fpAimPoint(distance));
    hero.gun.rotateX(-recoil.pitch.x * motion + reload * 0.55); hero.gun.rotateZ(recoil.roll.x * motion);
    for (const sign of [-1, 1]) {
      const arm = part(hero, 'CTRL / arm ' + sign);
      if (arm) { arm.rotation.x += recoil.pitch.x * 0.65 * motion; arm.position.z -= recoil.back.x * 0.30 * motion; }
    }
  }
  hero.flash(s.invul > 0 ? 0.4 + Math.sin(s.time * 24) * 0.25 : 0);
}

// ---------- 僵尸 ----------

const BUTTON_COLORS = { heavy: '#d6a68a', runner: '#aed4c7', weaver: '#cab8dc', leaper: '#eed18a', walker: '#edcf83', crawler:'#a5bdb4', shielded:'#a1bac8', bomber:'#d6a475', spawner:'#c4a0ad', archer:'#98b8b0', 'boss-warden':'#c5c09c', 'boss-leech':'#bb9dcc' };
const healthMaterials = new Map(), moodMaterials = new Map();
function healthMaterial(type, hp, max) {
  const key = type + ':' + hp;
  if (healthMaterials.has(key)) return healthMaterials.get(key);
  const c = document.createElement('canvas'); c.width = 448; c.height = 76;
  const ctx = c.getContext('2d'), name = ENEMY_TYPES[type].name;
  ctx.textAlign = 'center'; ctx.font = 'bold 26px Georgia, "Songti SC", serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#f3ead3'; ctx.strokeText(name, 224, 26);
  ctx.fillStyle = '#3e5248'; ctx.fillText(name, 224, 26);
  if(max>10){ctx.fillStyle='#6b765b';ctx.fillRect(44,42,360,17);ctx.fillStyle=BUTTON_COLORS[type]||'#edcf83';ctx.fillRect(46,44,356*Math.max(0,hp)/max,13);ctx.font='bold 15px Georgia';ctx.fillStyle='#31422e';ctx.fillText(hp+' / '+max,224,73);}else{
  const gap = 30, start = 224 - (max - 1) * gap / 2;
  for (let i = 0; i < max; i++) {
    const x = start + i * gap;
    ctx.globalAlpha = i < hp ? 1 : 0.45; ctx.fillStyle = i < hp ? BUTTON_COLORS[type] : '#68775f'; ctx.strokeStyle = '#526247'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, 53, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#715e47'; ctx.beginPath(); ctx.moveTo(x - 3, 50); ctx.lineTo(x + 3, 56); ctx.moveTo(x + 3, 50); ctx.lineTo(x - 3, 56); ctx.stroke();
  }
  }
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
  const material = new T.SpriteMaterial({ map, transparent: true, depthTest: true, depthWrite: false });
  healthMaterials.set(key, material); return material;
}
// 头顶的状态标记：睡着是 Zzz，刚发现你是 !。
function moodMaterial(text) {
  if (moodMaterials.has(text)) return moodMaterials.get(text);
  const c = document.createElement('canvas'); c.width = 160; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${text === '!' ? 84 : Math.min(52,140/text.length)}px Georgia, serif`;
  ctx.lineWidth = 8; ctx.strokeStyle = '#3e4a38'; ctx.strokeText(text, 80, 50);
  ctx.fillStyle = text === 'Zzz' ? '#eef2e2' : '#f2b84b'; ctx.fillText(text, 80, 50);
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
  const material = new T.SpriteMaterial({ map, transparent: true, depthWrite: false });
  moodMaterials.set(text, material); return material;
}
// 脚下的软影：一张径向渐变的圆片。
const blobGeo = new T.PlaneGeometry(1, 1);
const blobMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.55, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), color: 0x1b140c, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
})();
const tellGeo = new T.RingGeometry(0.42, 0.48, 28);
const tellMat = new T.MeshBasicMaterial({ color: 0xe9bf65, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false });

function updateEnemy(e, a) {
  a.reset();
  a.world.position.set(e.x, e.y, e.z); a.tilt.position.y = 0; a.tilt.scale.setScalar(1); a.model.rotation.y = e.heading;
  const distance = Math.hypot(e.x - s.player.x, e.z - s.player.z);
  if (!a.healthBar) {
    a.healthBar = new T.Sprite(healthMaterial(e.type, e.hp, e.maxHp));
    a.healthBar.position.set(0, e.height + 0.25, 0); a.healthBar.scale.set(1.19, 0.202, 1); a.healthBar.renderOrder = 4; a.world.add(a.healthBar);
    a.mood = new T.Sprite(moodMaterial('Zzz')); a.mood.scale.set(0.5, 0.3, 1); a.mood.renderOrder = 4; a.world.add(a.mood);
  }
  a.healthBar.material = healthMaterial(e.type, Math.max(0, e.hp), e.maxHp);
  a.healthBar.visible = e.alive && (e.hp < e.maxHp || (e.awareness === 'alert' && distance < 6));
  const asleep = e.awareness === 'asleep', waking = e.awareness === 'waking';
  const cue=attackCue(e);
  a.mood.visible = e.alive && (asleep || waking || !!cue || e.guardBroken>0);
  if (a.mood.visible) {
    a.mood.material = moodMaterial(asleep?'Zzz':waking?'!':e.guardBroken>0?'破防':cue?.label||'!');
    a.mood.position.set(0.25, e.height + 0.12 + (asleep ? Math.sin(e.age * 1.6) * 0.05 : 0.12), 0);
    a.mood.scale.set(asleep ? 0.5 : 0.42, 0.3, 1);
  }
  const pose = actionPose(e), response = enemyReaction(e), body = part(a, 'Body'), head = part(a, 'Head');
  if (!e.alive) {
    if (a.tell) a.tell.visible = false;
    const heavy = e.reactionWeapon === 'heavy', t = Math.min(1, e.deathAge / (heavy ? 0.32 : 0.46)), ease = t * t * (3 - 2 * t);
    const dir = new T.Vector3(e.fallX, 0, e.fallZ).normalize(), axis = up.clone().cross(dir).normalize();
    a.tilt.quaternion.setFromAxisAngle(axis, ease * 1.43);
    a.tilt.position.y = 0.13 * ease + Math.sin(t * Math.PI) * (heavy ? 0.15 : 0.06);
    for (const sign of [-1, 1]) {
      const arm = part(a, sign < 0 ? 'ArmL' : 'ArmR'), leg = part(a, sign < 0 ? 'LegL' : 'LegR');
      if (arm) { arm.rotation.z -= sign * 0.65 * ease; arm.rotation.x -= 1.05 - 0.8 * ease; }
      if (leg) leg.rotation.x -= 0.35 * ease;
    }
    if (head) head.rotation.x -= 0.15 * ease;
    a.model.visible = e.deathAge < 0.96; a.flash(0);
    return;
  }
  a.model.rotation.y += response.twist * 0.65;
  const flight = Math.min(1, e.hopPhase / 0.78), lift = e.hop > 0.001 ? Math.min(1, e.hop / Math.max(0.001, e.hopHeight)) : 0, land = Math.max(0, (e.hopPhase - 0.78) / 0.22), squash = ['chase','rush','sidestep'].includes(e.action)?Math.sin(land * Math.PI):0;
  a.tilt.scale.set(1 + squash * 0.025, 1 - squash * 0.05, 1 + squash * 0.025);
  const axis = new T.Vector3(e.reactionZ || 0, 0, -(e.reactionX || 0)).normalize();
  a.tilt.quaternion.setFromAxisAngle(axis, response.bend * 0.58 + response.wobble * 0.055);
  a.tilt.position.y = response.lift;
  const actionScale = 1 - pose.crouch;
  a.tilt.scale.multiply(new T.Vector3(1 / Math.sqrt(actionScale), actionScale, 1 / Math.sqrt(actionScale)));
  a.tilt.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(Math.sin(e.heading), 0, Math.cos(e.heading)), pose.roll));
  const sy = 1 - Math.min(0.12, response.compression * 0.10);
  a.tilt.scale.multiply(new T.Vector3(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy)));
  const forward = (e.reactionX || 0) * Math.sin(e.heading) + (e.reactionZ || 0) * Math.cos(e.heading);
  // 没发现你时的站姿：睡着的低头垂手，醒着的手自然下垂；警觉后才双手前伸。
  const calm = e.awareness === 'alert' ? 0 : waking ? Math.max(0, Math.min(1, e.wake / 0.6)) : 1;
  const breathe = asleep ? Math.sin(e.age * 1.6) : 0;
  const reach = 1.18 * (1 - calm) + (waking ? -0.5 * (1 - calm) : 0);
  if (body) {
    body.rotation.x += 0.12 - lift * 0.08 + forward * response.bend * 0.12 + pose.lean + (asleep ? 0.28 + breathe * 0.02 : 0);
    body.rotation.y += response.twist * 0.30; body.position.y -= squash * 0.025;
  }
  if (head) {
    head.rotation.x -= 0.06 + lift * 0.045 + forward * response.headLag * 0.38 + pose.head - (asleep ? 0.42 + breathe * 0.03 : 0);
    head.rotation.y += Math.sin(e.age * 2 + e.id) * 0.055 * (asleep ? 0 : 1) - response.twist * 0.40;
    head.rotation.z += Math.sin(e.age * 3) * 0.025 * (asleep ? 0 : 1) + response.wobble * 0.14 + (asleep ? 0.12 : 0);
  }
  for (const sign of [-1, 1]) {
    const leg = part(a, sign < 0 ? 'LegL' : 'LegR'), arm = part(a, sign < 0 ? 'ArmL' : 'ArmR');
    if (leg) {
      leg.rotation.x += lift * 0.38 - squash * 0.15 + sign * Math.sin(e.age * 7) * 0.035 * (1 - calm) + response.flail * (sign > 0 ? 0.40 : -0.22) + pose.legTuck;
      leg.rotation.z += sign * (lift * 0.08 + response.flail * 0.12);
    }
    if (arm) {
      arm.rotation.x -= reach + lift * 0.10 + response.flail * 0.40 + pose.reach;
      arm.rotation.z += sign * (0.08 + lift * 0.035 + response.flail * 0.52 + pose.spread + (waking ? 0.35 * calm : 0));
      arm.rotation.y += response.twist * 0.35;
    }
  }
  if (e.type === 'leaper') {
    if (!a.tell) { a.tell = new T.Mesh(tellGeo, tellMat); a.tell.rotation.x = -Math.PI / 2; a.world.add(a.tell); }
    a.tell.visible = e.action === 'windup'; a.tell.position.y = 0.025 - (e.y - e.base);
    a.tell.scale.setScalar(1.65 - Math.min(1, e.actionAge / 0.48) * 0.65);
  }
  applyAttackPose(e, a);
  a.flash(Math.max(response.flash * 0.7, e.action === 'bomber-throw' ? (reduced ? 0.04 : 0.10 + Math.sin(e.actionAge * 12) * 0.08) : 0));
  // 被电住：浑身发蓝、发抖，身上窜着小电弧
  if (e.stun > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(s.time * 38 + e.id);
    for (const m of a.materials) m.emissive?.setRGB(0.04 + 0.10 * pulse, 0.22 + 0.25 * pulse, 0.42 + 0.35 * pulse);
    a.model.position.x += Math.sin(s.time * 71 + e.id) * 0.012; a.model.position.z += Math.cos(s.time * 83) * 0.012;
    a.tilt.rotation.z += Math.sin(s.time * 57 + e.id) * 0.03;
    if (Math.random() < 0.5) effects.crackle(e.x, e.y, e.z, e.radius, e.height);
    if (distance < 8 && Math.random() < 0.08) sfx2('crackle', { strength: 0.5 });
  }
  // 被毛线缠住：身上绕着几圈线
  if (e.tangle > 0 && !a.tangle) {
    a.tangle = new T.Group();
    [0xd9a6e0, 0xf2d27a, 0x9fc3e0].forEach((color, i) => {
      const ring = new T.Mesh(new T.TorusGeometry(e.radius * 1.12, 0.03, 6, 22), new T.MeshStandardMaterial({ color, roughness: 1 }));
      ring.rotation.set(Math.PI / 2 + (i - 1) * 0.28, 0, i * 0.9); ring.position.y = e.height * (0.3 + i * 0.22); ring.castShadow = false; a.tangle.add(ring);
    });
    a.world.add(a.tangle);
  }
  if (a.tangle) { a.tangle.visible = e.tangle > 0; a.tangle.rotation.y = s.time * 1.3; a.tangle.scale.setScalar(Math.min(1, e.tangle / 0.4)); a.tangle.position.y = e.base - e.y; }
}

// ---------- 僵尸的手不插墙 ----------
// 追人的时候手往前伸，比碰撞半径长（跳跳前伸 0.59 米对半径 0.32，守墓巨像 1.5 对 0.62），贴着墙或家具就插进去了。
// 这里只改画面：摆完姿势以后，沿着每条手臂放三个球去碰 level.solids，碰到了就把这条手臂往垂手的姿势收，收到刚好不碰为止。
// 碰撞、寻路、攻击判定都不变。
const ARM_PROBES = new Map(), ARM_PAD = 0.05;   // ARM_PAD：留的余量（米），补上平滑带来的滞后
const armM = new T.Matrix4(), armV = new T.Vector3(), armPosed = new T.Euler();
// 每个兵种的每条手臂量一次：从肩到最远的顶点是手臂的轴，靠外那一段的粗细是球的半径
function armProbe(e, a, name) {
  const key = e.type + ':' + name; let probe = ARM_PROBES.get(key);
  if (probe) return probe;
  const arm = part(a, name), inv = new T.Matrix4(), tip = new T.Vector3(), pts = []; let L = 0;
  a.world.updateWorldMatrix(true, true); inv.copy(arm.matrixWorld).invert();
  arm.traverse(m => {
    if (!m.isMesh || m.userData.fuzz) return;
    const pos = m.geometry.attributes.position, local = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld), stride = Math.max(1, Math.floor(pos.count / 800));
    for (let i = 0; i < pos.count; i += stride) { const v = new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(local); pts.push(v); if (v.length() > L) { L = v.length(); tip.copy(v); } }
  });
  const axis = tip.clone().normalize(); let r = 0.02;
  for (const v of pts) { const t = v.dot(axis); if (t > 0.55 * L) r = Math.max(r, Math.sqrt(Math.max(0, v.lengthSq() - t * t))); }
  r = Math.min(r, L * 0.45);
  probe = { r, L, points: [0.45, 0.75, 1].map(f => axis.clone().multiplyScalar(Math.max(0, L - r) * f)) };
  ARM_PROBES.set(key, probe); return probe;
}
function tuckArms(e, a, dt) {
  const R = e.radius + 1.6, near = [];
  for (const c of level.solids) if (e.x > c.minX - R && e.x < c.maxX + R && e.z > c.minZ - R && e.z < c.maxZ + R && c.maxY > e.base + 0.25 && c.minY < e.base + e.height * 0.95) near.push(c);
  const B = storeyAt(level, e.base).bounds;   // 这一层的外沿（外墙、花园的篱笆）不在 solids 里，单独查
  const first = !a.tuck; a.tuck ??= [1, 1];
  ['ArmL', 'ArmR'].forEach((name, i) => {
    const arm = part(a, name); if (!arm) return;
    const rest = a.rest.get(name).r; let k = 1;
    if (near.length || e.x - R < B.minX || e.x + R > B.maxX || e.z - R < B.minZ || e.z + R > B.maxZ) {
      const probe = armProbe(e, a, name); armPosed.copy(arm.rotation);
      arm.parent.updateWorldMatrix(true, false);
      // 手臂收到 f（1 是原姿势，0 是垂手）时碰不碰得到东西。蹦起来的高度不算：按整段跳跃扫过的范围查，不然每蹦一下手就抖一下。
      const hits = f => {
        arm.rotation.set(rest.x + (armPosed.x - rest.x) * f, rest.y + (armPosed.y - rest.y) * f, rest.z + (armPosed.z - rest.z) * f); arm.updateMatrix();
        armM.multiplyMatrices(arm.parent.matrixWorld, arm.matrix);
        const rr = probe.r * armM.getMaxScaleOnAxis() + ARM_PAD, hop = e.y - e.base;
        for (const q of probe.points) {
          armV.copy(q).applyMatrix4(armM); const lo = armV.y - hop, hi = lo + (e.hopHeight || 0);
          if (armV.x - rr < B.minX || armV.x + rr > B.maxX || armV.z - rr < B.minZ || armV.z + rr > B.maxZ) return true;
          for (const c of near) {
            const dx = Math.max(c.minX - armV.x, 0, armV.x - c.maxX), dz = Math.max(c.minZ - armV.z, 0, armV.z - c.maxZ), dy = Math.max(c.minY - hi, 0, lo - c.maxY);
            if (dx * dx + dy * dy + dz * dz < rr * rr) return true;
          }
        }
        return false;
      };
      if (hits(1)) { let lo = 0, hi = 1; for (let n = 0; n < 5; n++) { const mid = (lo + hi) / 2; if (hits(mid)) hi = mid; else lo = mid; } k = lo; }
      arm.rotation.copy(armPosed);
    }
    // 收得快、放得慢，中间平滑过渡
    a.tuck[i] = first ? k : a.tuck[i] + (k - a.tuck[i]) * Math.min(1, dt * (k < a.tuck[i] ? 20 : 5));
    const f = a.tuck[i];
    if (f < 0.999) arm.rotation.set(rest.x + (arm.rotation.x - rest.x) * f, rest.y + (arm.rotation.y - rest.y) * f, rest.z + (arm.rotation.z - rest.z) * f);
  });
}

// 从眼睛到僵尸的头、身体两侧、脚各连一条线，任一条不被挡就算看得见。
function canSee(e) {
  const eye = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const dx = e.x - eye.x, dz = e.z - eye.z, d = Math.hypot(dx, dz) || 1, sx = -dz / d * e.radius, sz = dx / d * e.radius;
  const top = e.y + e.height;
  return [[0, 0, top], [0, 0, top * 0.5], [sx, sz, top * 0.6], [-sx, -sz, top * 0.6], [0, 0, e.y + 0.1]]
    .some(([ox, oz, y]) => lineOfSight(level, eye, { x: e.x + ox, y, z: e.z + oz }));
}

function updateModels(dt) {
  animateHero(dt, mode === 'playing' && !paused);
  const present = new Set(s.enemies.map(e => e.id));
  for (const [id, a] of enemyModels) if (!present.has(id)) { a.world.removeFromParent(); a.dispose(); enemyModels.delete(id); }
  for (const e of s.enemies) {
    if(!e.enabled){const hidden=enemyModels.get(e.id);if(hidden)hidden.world.visible=false;continue;}
    let a = enemyModels.get(e.id);
    if (!a) {
      a = actors.create(e.type); dressWalker(a, e.type, e.scale);
      a.model.traverse(m => { if (m.isMesh) m.frustumCulled = true; });
      world.light(a.world);   // 角色和墙、家具查同一份烘焙光照：站在灯下亮，躲进角落暗
      enemyModels.set(e.id, a); cine.scene.add(a.world);
    }
    const distance = Math.hypot(e.x - s.player.x, e.z - s.player.z);
    // 隔着墙看不见的僵尸不画（每只约 6.7 万面，全屋 16 只一起画太重）。
    const apart = Math.abs(e.base - s.player.y);   // 隔了一层以上的不用看
    if (apart < SH * 1.6 && canSee(e)) a.seenAt = s.time;
    a.world.visible = (distance < 2.5 && apart < 1.5) || s.time - (a.seenAt ?? -9) < 0.35;
    if (!a.world.visible) continue;
    // 脚下垫一块软影，没有太阳的地方也站得住。
    if (!a.blob) { a.blob = new T.Mesh(blobGeo, blobMat); a.blob.rotation.x = -Math.PI / 2; a.blob.renderOrder = 1; a.world.add(a.blob); }
    a.blob.visible = e.alive || e.deathAge < 0.9;
    const hop = e.y - e.base;
    a.blob.position.y = 0.05 - hop; a.blob.scale.setScalar(e.radius * 3.4 * (1 - Math.min(0.5, hop * 0.6)));
    a.model.traverse(m => { if (m.userData.fuzz) m.visible = distance < 8.5; });
    updateEnemy(e, a);
    if (e.alive && !window.__rb.noArmTuck) tuckArms(e, a, dt);
    if (!e.alive && e.deathAge > 0.78 && !a.poof) { a.poof = true; burst(e.x, e.z, 20, 0.95, 0xddd7b5, e.base + 0.55); }
  }
  const ballIds = new Set(s.balls.map(b => b.id));
  for (const [id, o] of ballModels) if (!ballIds.has(id)) { o.removeFromParent(); for (const m of o.userData.ownMaterials) m.dispose(); ballModels.delete(id); }
  for (const b of s.balls) {
    let o = ballModels.get(b.id);
    if (!o) {
      o = ballTemplates[Math.max(0, WEAPONS.findIndex(w => w.id === b.weapon))].clone(true); o.userData.ownMaterials = []; o.userData.trail = 0; o.userData.fuse = o.getObjectByName('fuse') || null;
      o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; o.userData.ownMaterials.push(m.material); } });
      world.light(o);
      ballModels.set(b.id, o); cine.scene.add(o);
    }
    o.position.set(b.x, b.y, b.z);
    // 贴脸的球淡出，免得挡住命中反馈。
    const nearFade = Math.max(0, Math.min(1, (o.position.distanceTo(camera.position) - b.r - 0.30) / 0.6));
    for (const m of o.userData.ownMaterials) { m.opacity = nearFade * nearFade; m.depthWrite = nearFade > 0.98; }
    o.scale.setScalar(b.r * Math.min(1, Math.max(0, (b.lifetime - b.age) / 0.45)));
    if (o.userData.oriented) o.lookAt(b.x + b.dx, b.y + b.dy, b.z + b.dz);   // 针顺着飞行方向
    else { o.rotation.x += dt * b.speed * 2; o.rotation.z += dt * 3; }
    if (o.userData.fuse) o.userData.fuse.scale.setScalar(0.7 + 0.6 * Math.abs(Math.sin(b.age * (8 + b.age * 14))));   // 引信越闪越快
    // 拖尾：毛球身后掉一路绒絮，手雷掉火星；连发的小纽扣和针不掉
    o.userData.trail -= dt;
    if (o.userData.trail <= 0 && nearFade > 0.5 && b.weapon !== 'sewing' && b.weapon !== 'needle') {
      o.userData.trail = b.fuse ? 0.05 : b.weapon === 'heavy' ? 0.022 : 0.035;
      trail(b.x, b.y, b.z, b.fuse ? 0xffd27a : WEAPONS.find(w => w.id === b.weapon).color, b.r * (b.weapon === 'heavy' ? 0.5 : 0.42));
    }
  }
  combatFx.update(s,dt);
  for (const k of s.pickups) {
    const o = world.pickups.get(k.id);
    if (!o) continue;
    o.visible = !k.taken;
    o.userData.body.rotation.y += dt * 1.4; o.position.y = o.userData.baseY + Math.sin(s.time * 2.2 + k.id) * 0.05;
  }
}
function clearModels() {
  combatFx.clear();
  for (const a of enemyModels.values()) { a.world.removeFromParent(); a.dispose(); }
  enemyModels.clear();
  for (const o of ballModels.values()) { o.removeFromParent(); for (const m of o.userData.ownMaterials) m.dispose(); }
  ballModels.clear(); fx.length = 0; effects.clear();
}

// ---------- 事件 → 反馈 ----------

function processEvents() {
  let strongest = null, bonus = '';   // bonus：本批事件里最近一次带加成的命中，击倒提示会带上它
  for (const e of consumeEvents(s)) {
    const near = (r) => Math.hypot(e.x - s.player.x, e.z - s.player.z) < r && Math.abs((e.base ?? s.player.y) - s.player.y) < 2;
    const base = e.base ?? 0;
    combatFx.event(e);
    if(e.type==='blocked'){if(near(9)){say('盾挡住了 · 绕后或重弹破防',1);sfx('switch');}}
    else if(e.type==='guard-break'){say('破防！',1);sfx('kill');}
    else if(e.type==='attack-windup'){if(near(11))say(ATTACKS[e.enemyType].name+' · '+ATTACKS[e.enemyType].counter,1.2);}
    else if(e.type==='summoned'){if(near(12)){burst(e.x,e.z,12,.5,0xbaa5c2,.5);say('援兵出来了 · 优先击破召唤源',1.2);}}
    else if(e.type==='sealed'){say('封住 '+e.count+' 只援兵',1.2);}
    else if(e.type==='bomb-thrown'){if(near(12)){sfx('arrow');say('毛线炸弹！离开落点',1.0);}}
    else if(e.type==='bomb-land'){if(near(10))say('炸弹落地 · 离开红圈',.9);}
    else if(e.type==='enemy-shot'){if(near(12))sfx('arrow');}
    else if(e.type==='enemy-shot-impact'){burst(e.x,e.z,4,.4,0xd4a588,e.y);}
    else if(e.type==='yarn-blast'){burst(e.x,e.z,30,1.8,0xd5b58a,.7);sfx('kill');}
    else if(e.type==='ground-slam'){shake=Math.max(shake,.018);burst(e.x,e.z,20,1.3,0xe0c58e,.15);sfx('kill');}
    else if(e.type==='drain'){say('被吸取了 · 侧移或找掩体',1.2);}
    else if (e.type === 'weapon') { say(WEAPONS[e.weapon].name, 1); syncWeapon(); sfx('switch'); }
    else if (e.type === 'reload') { sfx('switch'); }
    else if (e.type === 'reloaded') { sfx('switch'); }
    else if (e.type === 'dry') { say(`${WEAPONS[s.weapon].name}没弹药了 · 按 1 换回手枪`, 1.6); sfx('switch'); }
    else if (e.type === 'zap') {
      // 电弧：从枪口到第一只，再一只只跳过去
      effects.zap(e.points); sfx2('zap');
      for (const p of e.points.slice(1)) burst(p.x, p.z, 6, 0.9, 0xbfeaff, p.y);
      if (e.struck.length > 1) say(`电住了 ${e.struck.length} 只`, 1);
    } else if (e.type === 'explode') {
      // 毛线团炸开：光球、一地彩色线头、镜头震一下
      effects.boom(e, e.radius, 0xe6b8f0); sfx2('boom', { strength: Math.min(1.2, 6 / Math.max(3, Math.hypot(e.x - s.player.x, e.z - s.player.z))) });
      for (const color of [0xd9a6e0, 0xf2d27a, 0x9fc3e0, 0xe7836f, 0xf6efe0]) burst(e.x, e.z, 14, 2.6, color, e.y + 0.2);
      if (Math.hypot(e.x - s.player.x, e.z - s.player.z) < 9) shake = Math.max(shake, 0.03);
      if (e.struck.length) say(`缠住了 ${e.struck.length} 只`, 1.1);
    }
    else if (e.type === 'interrupted') say('打断了攻击！', 0.8);
    else if (e.type === 'pounce') { if (near(6)) sfx('switch'); }
    else if (e.type === 'alert') { if (near(9)) { say(`${ENEMY_TYPES[e.enemyType].name}发现你了！`, 1.1); sfx('hurt'); } }
    else if (e.type === 'land') { if (near(5)) burst(e.x, e.z, e.enemyType === 'heavy' ? 5 : 2, 0.16, 0xb8c2a4, base + 0.04); }
    else if (e.type === 'shot') {
      const w = WEAPONS.find(v => v.id === e.weapon), light = e.weapon === 'sewing';
      kickRecoil(recoil, feelOf(e.weapon), light ? -2.2 : e.weapon === 'stun' ? -1 : e.power);   // 负的力度 = 更轻的一下
      burst(e.x, e.z, e.weapon === 'scatter' ? 12 : e.weapon === 'heavy' ? 10 : light ? 1 : 4, e.weapon === 'heavy' ? 0.85 : 0.45, w.color, e.y ?? 0.8);
      // 枪口闪光：一小团光，顺带把周围照亮一下；越重的枪越大
      effects.muzzle(e, e.weapon === 'stun' ? 0x9fdcff : 0xffe2b0, e.weapon === 'heavy' ? 1.1 : e.weapon === 'scatter' ? 0.8 : light ? 0.32 : 0.5, e.weapon === 'heavy' ? 9 : light ? 2.5 : 5);
      if (e.weapon === 'sewing') sfx2('stitch'); else if (e.weapon === 'needle') sfx2('needle'); else if (e.weapon === 'yarn') sfx2('throw'); else if (e.weapon !== 'stun') sfx('shot', { weapon: e.weapon, power: e.power });
    } else if (e.type === 'hit') {
      burst(e.contactX ?? e.x, e.contactZ ?? e.z, e.heavy ? 14 : e.weapon === 'scatter' ? 4 : 7, e.heavy ? 1.4 : 0.85, e.heavy ? 0xe6c5a8 : 0xe7ddbc, e.contactY ?? 0.75);
      // 命中光圈：带加成的更大、偏金色
      if (e.source === 'ball') effects.ring({ x: e.contactX ?? e.x, y: e.contactY ?? base + 0.8, z: e.contactZ ?? e.z }, e.back || e.sneak ? 0xffd27a : 0xfff0d8, e.heavy ? 1.2 : e.back || e.sneak ? 0.8 : 0.5, e.heavy ? 0.26 : 0.18);
      if (e.source === 'ball') {
        bonus = e.back && e.sneak ? '偷袭后背 ×3' : e.back ? '打中后背 ×2' : e.sneak ? '偷袭 ×2' : '';
        if (bonus) say(`${bonus} · -${e.amount}`, 1);
        else if (e.armored) say('棉甲挡住了 · 绕到背后打', 1.1);
      }
      if (!strongest || e.strength > strongest.strength) strongest = e;
    } else if (e.type === 'knockdown') {
      shake = Math.max(shake, e.weapon === 'heavy' ? 0.018 : 0.007); hitMarkerTime = 0.24; hitMarkerKind = 'kill'; sfx('kill', { weapon: feelOf(e.weapon) });
      if (e.left > 0) say(`${e.source === 'collision' ? '撞倒一只' : bonus || '击倒'} · 还剩 ${e.left} 只`, 1.3);
    } else if (e.type === 'bounce') {
      if (performance.now() - lastBounceSound > 90) { sfx('bounce', { weapon: e.weapon }); lastBounceSound = performance.now(); }
    } else if (e.type === 'ball-expired') {
      if (e.reason !== 'explode') burst(e.x, e.z, 4, 0.25, 0xeadbb9, e.y);
      if (e.weapon === 'needle' && e.reason === 'bounce-limit' && e.normal) {
        // 针扎在墙上：事件里的方向还是它飞来时的方向（碰到墙的这一帧还没来得及改）
        effects.stick(e, { x: e.dx, y: e.dy, z: e.dz }); sfx2('thunk', { strength: Math.min(1, 5 / Math.max(2, Math.hypot(e.x - s.player.x, e.z - s.player.z))) });
      } else if (e.reason === 'bounce-limit' || e.reason === 'range') effects.spark(e, 0xfff0d8, 0.35);
    }
    else if (e.type === 'pickup') {
      burst(e.x, e.z, 10, 0.5, e.kind === 'heart' ? 0xd9705f : 0xf3dfa5, base + 0.6);
      if (e.kind === 'weapon') { sfx2('weapon'); effects.ring({ x: e.x, y: base + 0.8, z: e.z }, 0xffe08a, 1.6, 0.4); } else sfx('switch');
      say(e.kind === 'weapon' ? `捡到${WEAPONS.find(w => w.id === e.weapon).name}！按 ${WEAPONS.findIndex(w => w.id === e.weapon) + 1} 选它` : e.kind === 'heart' ? '捡到棉花包 · ♥ +1' : e.kind === 'objective' ? (e.needed > 1 ? `${TX.got}${e.name} · ${e.collected} / ${e.needed}` : TX.got) : `${WEAPONS.find(w => w.id === e.weapon).name}弹药 +${e.amount}`, 1.4);
    } else if (e.type === 'hurt') {
      shake = 0.04; sfx('hurt');
      $('hurtFrame').classList.remove('damage'); void $('hurtFrame').offsetWidth; $('hurtFrame').classList.add('damage');
      say(e.source === 'arrow' ? '被绒球箭击中！' : e.source === 'ground-slam' ? '震地！退离范围' : e.source === 'bomb-blast' || e.source === 'yarn-blast' ? '线团爆开了！' : e.source === 'leech-drain' ? '被吸取了！' : '被扑到了！拉开距离', 1);
    } else if (e.type === 'mission-complete') say(level.mission.type === 'fetch' ? TX.won : '全部清空！', 1.5);
    else if (e.type === 'round-end') showResult();
  }
  if (strongest) {
    const e = strongest, dist = Math.hypot(e.x - s.player.x, e.z - s.player.z);
    const pan = ((e.x - s.player.x) * Math.cos(yaw) - (e.z - s.player.z) * Math.sin(yaw)) / Math.max(2, dist);
    sfx('hit', { weapon: feelOf(e.weapon), strength: Math.min(1.15, 3.5 / Math.max(2, dist)), pan });
    if (hitMarkerKind !== 'kill' || hitMarkerTime < 0.1) { hitMarkerTime = e.heavy ? 0.20 : 0.12; hitMarkerKind = e.heavy ? 'heavy' : ''; }
  }
}

// ---------- 瞄准与镜头 ----------

// 沿准星找到最近的东西（僵尸、墙、家具、场地边界），返回距离；枪口朝那一点开火。
function aim() {
  camera.updateMatrixWorld(true); camera.getWorldDirection(lookDir);
  const from = camera.position, far = from.clone().addScaledVector(lookDir, FAR);
  let distance = FAR, picked = null;
  for (const e of s.enemies) {
    if (!e.alive||!e.enabled) continue;
    const t = segmentCylinder(from.x, from.y, from.z, far.x, far.y, far.z, e.x, e.z, e.radius, e.y + 0.04, e.y + e.height);
    if (t !== null && t * FAR < distance) { distance = t * FAR; picked = e; }
  }
  for (const c of level.solids) { const h = segmentBox(from, far, c); if (h && h.t * FAR < distance) { distance = h.t * FAR; picked = null; } }
  ray.set(from, lookDir);
  const edge = ray.ray.intersectBox(new T.Box3(new T.Vector3(B.minX, 0.03, B.minZ), new T.Vector3(B.maxX, level.top, B.maxZ)), new T.Vector3());
  if (edge) { const d = edge.distanceTo(from); if (d < distance) { distance = d; picked = null; } }
  if (picked) {
    const state = picked.awareness === 'asleep' ? ' · 睡着' : picked.awareness === 'idle' ? ' · 没发现你' : '';
    $('targetLabel').textContent = `${ENEMY_TYPES[picked.type].name} ${picked.hp}/${picked.maxHp}${state}`;
  } else $('targetLabel').textContent = '';
  target.copy(from).addScaledVector(lookDir, Math.max(0.18, distance));
  $('reticle').classList.toggle('target', !!picked);
  return distance;
}

// 实际枪口位置和方向；枪口伸进墙或家具时改从眼前发射，避免球生在实体里。
function shotParams() {
  cameraFrame(0); camera.updateMatrixWorld(true);
  const distance = aim();
  gun.lookAt(fpAimPoint(distance)); gun.updateWorldMatrix(true, false);
  muzzleWorld.copy(gun.localToWorld(new T.Vector3(0, 0, gun.userData.muzzleZ || 0.63))).sub(camera.position).multiplyScalar(1 / FP_SCALE).add(camera.position);   // 换算回没缩小时的枪口
  const m = muzzleWorld, pad = 0.29;
  const blocked = level.solids.some(c => m.x > c.minX - pad && m.x < c.maxX + pad && m.z > c.minZ - pad && m.z < c.maxZ + pad && m.y > c.minY - pad && m.y < c.maxY + pad);
  if (blocked || target.clone().sub(m).dot(lookDir) < 0.08 || !inBounds(level, m.x, m.z, 0.12)) m.copy(camera.position).addScaledVector(lookDir, 0.02);
  const direction = target.clone().sub(m).normalize();
  return { origin: { x: m.x, y: m.y, z: m.z }, direction: { x: direction.x, y: direction.y, z: direction.z } };
}

// 主界面的机位：两个角色站在画面右半边（左边留给标题和菜单）。出发时镜头从这里推到出生点，变成第一人称。
const stage = level.menu || level.player;   // 主界面的两个角色站在哪
const menuCamera = new T.Vector3(stage.x + 1.7, 1.75, stage.z + 0.78), menuLook = new T.Vector3(stage.x - 1.4, 0.8, stage.z - 0.19);
const startYaw = level.player.yaw || 0, startEye = new T.Vector3(level.player.x, EYE, level.player.z), startLook = new T.Vector3(level.player.x - Math.sin(startYaw) * 4, EYE, level.player.z - Math.cos(startYaw) * 4);
const menuAt = new T.Vector3();
function cameraFrame(dt) {
  if (onMenu()) {
    const k = mode === 'depart' ? Math.min(1, departT / DEPART) : 0, e = k * k * (3 - 2 * k);
    if (mode === 'menu') camera.position.lerp(menuCamera, 0.10); else camera.position.lerpVectors(menuCamera, startEye, e);
    camera.fov = 40 + (65 - 40) * e; camera.lookAt(menuAt.lerpVectors(menuLook, startLook, e));
  } else {
    const motion = reduced ? 0.25 : 1, bob = reduced ? 0 : Math.sin(phase * 2) * 0.006;
    // 毛衣针按住是举枪瞄准：镜头拉近
    const aiming = s.charging && WEAPONS[s.weapon].zoom ? Math.min(1, s.charge / 0.35) : 0;
    zoom += (aiming - zoom) * Math.min(1, dt * 14);
    camera.fov = 65 - 31 * zoom + recoil.fov.x * motion;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch + recoil.camera.x * motion, yaw, Math.sin(s.time * 49) * shake * motion);
    camera.position.set(s.player.x + Math.sin(s.time * 67) * shake * motion, s.player.y + EYE + bob + Math.sin(s.time * 59) * shake * 0.4 * motion, s.player.z);
    if (fpHero) { fpHero.world.position.set(0.30 + Math.sin(phase) * 0.004, -0.76 - Math.abs(Math.sin(phase)) * 0.004, -0.52).multiplyScalar(FP_SCALE); fpHero.model.rotation.y = Math.PI; }
  }
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  shake = Math.max(0, shake - dt * 0.6);
}

// ---------- HUD ----------

const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function hud() {
  const w = WEAPONS[s.weapon], a = s.ammo[s.weapon], status = missionStatus(s);
  $('statusEffect').textContent=s.pulledUntil>s.time?'吸引中 · 侧移或找掩体':s.slowUntil>s.time?'缠线减速 · '+Math.max(0,s.slowUntil-s.time).toFixed(1)+'s':'';
  $('weaponName').textContent = w.name; $('weaponTag').textContent = w.tag;
  $('ammo').textContent = `${a.mag} / ${a.reserve === Infinity ? '∞' : a.reserve}`;
  $('ammo').classList.toggle('low', a.mag === 0);
  WEAPONS.forEach((weapon, i) => {
    const slot = $('weapon' + i), ammo = s.ammo[i];
    slot.hidden = !s.owned[i];
    slot.classList.toggle('selected', i === s.weapon);
    slot.classList.toggle('empty', ammo.mag === 0 && ammo.reserve === 0);
    slot.textContent = `${i + 1} · ${ammo.reserve === Infinity ? ammo.mag : ammo.mag + ammo.reserve}`;
  });
  $('objective').textContent = status.type !== 'fetch' ? level.mission.title : status.carrying ? TX.carry : status.needed > 1 ? `${level.mission.title} · ${status.collected} / ${status.needed}` : level.mission.title;
  $('enemyCount').textContent = `${status.alive} / ${status.total}`;
  $('timer').textContent = clock(s.time);
  const room = roomAt(storeyAt(level, s.player.y), s.player.x, s.player.z)?.name || '';
  $('room').textContent = room;
  if (mode === 'playing' && room && room !== lastRoom) { if (lastRoom) say(room, 0.9); lastRoom = room; }
  const hearts = Math.max(0, Math.min(CONFIG.maxHealth, s.health));
  $('hearts').textContent = '♥'.repeat(hearts) + '♡'.repeat(CONFIG.maxHealth - hearts);
  $('hearts').setAttribute('aria-label', `${s.health} 颗心`);
  const charging = s.charging ? s.charge / CONFIG.chargeTime : 0, reloading = s.reloading ? 1 - s.reload / w.reload : 0;
  $('chargeFill').style.width = (s.reloading ? reloading : charging) * 100 + '%';
  $('charge').classList.toggle('full', !s.reloading && charging > 0.95);
  $('charge').classList.toggle('reloading', s.reloading);
  $('chargeLabel').textContent = s.reloading ? '换弹中…' : a.mag === 0 ? '没弹药了' : w.auto ? '按住空格连发' : w.zoom ? (s.charging ? (charging > 0.95 ? '瞄稳了 · 松开射出' : '瞄准中…') : '按住空格瞄准 · 松开射出') : w.kind === 'grenade' ? (s.charging ? '松开扔出 · 按得越久越远' : '空格扔出 · 按住扔得更远') : w.kind === 'zap' ? '空格放电' : charging > 0.95 ? '松开空格 · 发射大毛球' : s.charging ? '蓄力中…' : '空格射击 · 按住蓄力';
  $('reticle').hidden = mode !== 'playing' || paused; $('reticle').style.scale = 1 + Math.min(0.35, recoil.back.x * 0.65);
  $('hitMarker').hidden = mode !== 'playing' || paused || hitMarkerTime <= 0;
  $('hitMarker').dataset.kind = hitMarkerKind; $('hitMarker').style.opacity = Math.min(1, hitMarkerTime * 18); $('hitMarker').style.scale = 1 + Math.min(0.35, hitMarkerTime);
}

// 给浏览器验证用的只读快照。
function snapshot() {
  return {
    mode, paused, phase: s.phase, time: s.time, health: s.health, stars: s.stars, kills: s.kills, total: s.total, alive: aliveCount(s),
    weapon: WEAPONS[s.weapon].id, owned: WEAPONS.filter((w, i) => s.owned[i]).map(w => w.id), ammo: s.ammo.map(a => ({ mag: a.mag, reserve: a.reserve === Infinity ? 'inf' : a.reserve })), reloading: s.reloading,
    shots: s.shots, hits: s.hits, backHits: s.backHits, sneakHits: s.sneakHits, bounces: s.bounces,
    player: { x: s.player.x, y: s.player.y, z: s.player.z }, floor: floorIndex(level, s.player.y), carrying: s.carrying, yaw, pitch, room: roomAt(storeyAt(level, s.player.y), s.player.x, s.player.z)?.id,
    enemies: s.enemies.map(e => ({ id: e.id, type: e.type, enabled: e.enabled, reserveOf: e.reserveOf, guardBroken: e.guardBroken, actionAge: e.actionAge, cue: attackCue(e), model: enemyModels.get(e.id)?.nativeVariant || null, x: e.x, y: e.base, z: e.z, stun: e.stun, tangle: e.tangle, hp: e.hp, alive: e.alive, awareness: e.awareness, action: e.action })),
    level: level.id, enemyBombs: s.enemyBombs.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, landed: b.landed, fuse: b.fuse })), enemyShots: s.enemyShots.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, age: b.age })), slowUntil: s.slowUntil, pulledUntil: s.pulledUntil, neutralized: s.neutralized,
    balls: s.balls.length, pickups: s.pickups.filter(k => !k.taken).length, errors,
  };
}
function diagnostics() {
  $('diagnostics').dataset.state = JSON.stringify(snapshot());
  $('diagnostics').dataset.stats = JSON.stringify({ ...cine.stats(), tier: governor.tier, pixels: Math.round(governor.pixels), frameIntervalMs: frameIntervals.length ? frameIntervals.reduce((a, b) => a + b, 0) / frameIntervals.length : null, measurement: 'observed RAF intervals; not synchronized GPU benchmark' });
  $('diagnostics').dataset.ready = ready ? 'true' : 'false';
  if (q.has('debug')) $('diagnostics').textContent = `${cine.stats().quality} · ${cine.stats().calls} draws · ${s.balls.length} balls`;
}

// ---------- 流程 ----------

function start() {
  if (!ready) return;
  frameIntervals.length = 0; clearModels(); keys.clear(); down = false; paused = false; phase = 0; acc = 0; toy.reset();
  recoil = createRecoil(); hitMarkerTime = 0; hitMarkerKind = ''; shake = 0; yaw = level.player.yaw || 0; pitch = 0; lastRoom = '';
  s = createGame({ level }); mode = 'playing';
  document.body.classList.remove('menu', 'paused', 'leaving');
  $('intro').hidden = true; $('pausePanel').hidden = true; $('result').hidden = true;
  menuZombie.world.visible = false; menuHero.world.visible = false; fpHero.world.visible = true;
  $('view').focus(); unlock(); syncWeapon();
  say(TX.hint, 4);
  updateModels(0);
}
// 出发：菜单淡出，僵尸被惊醒蹦到一边，镜头推到出生点；到位就是第一人称
function depart() {
  if (!ready || mode !== 'menu') return;
  mode = 'depart'; departT = 0; document.body.classList.add('leaving'); unlock(); sfx('switch');
}
// 主界面按空格：朝睡着的那只打一颗毛球
function toyShoot() {
  if (!ready || mode !== 'menu') return;
  unlock(); menuHero.world.updateMatrixWorld(true);
  if (toy.shoot(menuHero.gun.localToWorld(new T.Vector3(0, 0, 0.63)))) { kickRecoil(recoil, 'single', 0.5); sfx('shot', { weapon: 'single', power: 0 }); }
}
function setPause(value) {
  if (mode !== 'playing') return;
  paused = value; keys.clear(); down = false; s.charging = false; s.charge = 0;
  if (loadedBall) loadedBall.visible = false;
  document.body.classList.toggle('paused', paused); $('pausePanel').hidden = !paused; $('pause').textContent = paused ? '继续' : '暂停';
  if (!paused) { last = performance.now(); $('view').focus(); unlock(); }
}
function showResult() {
  mode = 'result'; keys.clear(); down = false;
  const won = s.phase === 'won';
  $('result').hidden = false; $('pausePanel').hidden = true;
  $('resultTitle').textContent = won ? (level.mission.type === 'fetch' ? TX.won : '清空了！') : '被扑倒了';
  $('resultStars').textContent = won ? '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) : '再试一次';
  $('resultNote').textContent = won
    ? `受伤 ${s.damageTaken} 次${s.damageTaken <= 1 ? ' ✓' : '（不超过 1 次得一星）'} · 用时 ${clock(s.time)}${s.time <= level.par ? ' ✓' : `（${clock(level.par)} 内得一星）`}`
    : s.carrying ? TX.lostCarrying : '被发现的僵尸越多越危险：先打落单的，从背后下手。';
  $('rKills').textContent = `${s.kills}/${s.total}`; $('rTime').textContent = clock(s.time); $('rSneak').textContent = s.backHits + s.sneakHits;
}
function toMenu() {
  clearModels(); mode = 'menu'; paused = false; toy.reset(); recoil = createRecoil();
  document.body.classList.add('menu'); document.body.classList.remove('paused', 'leaving');
  $('intro').hidden = false; $('result').hidden = true; $('pausePanel').hidden = true;
  menuHero.world.visible = true; menuZombie.world.visible = true; fpHero.world.visible = false; keys.clear(); menu.layout(); hidePickups();
}
// 主界面上不摆拾取物（它们头顶的名牌会挡在两个角色中间）；开局时 updateModels 会把没捡的再亮出来
function hidePickups() { for (const o of world.pickups.values()) o.visible = false; }

// ---------- 输入：纯键盘，不需要鼠标 ----------

const HELD = ['w', 'a', 's', 'd', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
$('view').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if ((k === 'enter' || k === ' ') && ['BUTTON','A'].includes(e.target?.tagName)) return;
  if (HELD.includes(k) || k === 'enter') e.preventDefault();
  if (k === 'enter' && ready && !e.repeat) { if (mode === 'menu') menu.activate(); else if (mode === 'result') start(); else if (paused) setPause(false); return; }
  if (mode === 'menu') {
    // 主界面：W / S（或上下键）选，A / D（或左右键）换地图，数字键直接选地图，空格打一球
    if (e.repeat) return;
    if (k === 'w' || k === 'arrowup') menu.move(-1);
    else if (k === 's' || k === 'arrowdown') menu.move(1);
    else if (k === 'a' || k === 'arrowleft') cycleLevel(-1);
    else if (k === 'd' || k === 'arrowright') cycleLevel(1);
    else if (k === ' ') toyShoot();
    else if (!training && k.length === 1 && k >= '1' && k <= String(ORDER.length)) switchLevel(ORDER[Number(k) - 1]);
    return;
  }
  if (mode === 'depart') return;
  if (k === 'escape') { if (mode === 'playing') setPause(!paused); return; }
  if (k === 'r' && !e.repeat && ready) {
    if (mode === 'result' || paused) start();          // 暂停或结算时 R 是重开
    else if (mode === 'playing') { startReload(s); processEvents(); }   // 游戏中 R 是换弹
    return;
  }
  if (mode !== 'playing' || paused) return;
  if (!e.repeat && ((k.length === 1 && k >= '1' && k <= String(WEAPONS.length)) || k === 'q')) {
    let index = Number(k) - 1;
    if (k === 'q') { index = s.weapon; do index = (index + 1) % WEAPONS.length; while (!s.owned[index]); }   // Q：换到下一把手里有的
    if (k !== 'q' && !s.owned[index]) say(`还没捡到${WEAPONS[index].name}`, 1);
    else if (selectWeapon(s, index)) { if (down) releaseCharge(s); down = false; keys.delete(' '); processEvents(); }
    return;
  }
  if (!HELD.includes(k)) return;
  keys.add(k);
  if (k === ' ' && !e.repeat && !down) { down = true; unlock(); beginCharge(s); processEvents(); }
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  keys.delete(k);
  if (k === ' ' && down) { down = false; if (mode === 'playing' && !paused) releaseCharge(s, shotParams()); }
});
addEventListener('blur', () => { if (mode === 'playing' && !paused) setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing' && !paused && !q.has('test')) setPause(true); });
$('expand').onclick = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); };
$('again').onclick = start; $('restart').onclick = () => { if (ready) start(); };
$('resume').onclick = () => setPause(false); $('pause').onclick = () => setPause(!paused); $('back').onclick = toMenu;
$('sound').onclick = () => {
  sound = !sound; $('sound').textContent = sound ? '声音 开' : '声音 关'; $('sound').setAttribute('aria-pressed', sound);
  if (sound) unlock(); if (mode === 'playing') $('view').focus();
};

// ---------- 主循环 ----------

// 推进一段游戏时间：固定 1/120 秒步长，画面帧率不影响结果。
function advance(dt) {
  const turn = 1 - 0.6 * zoom;   // 瞄准时转得慢，好对准
  yaw += ((keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0)) * dt * 1.15 * turn;
  pitch = Math.max(-0.78, Math.min(0.72, pitch + ((keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0)) * dt * 0.85 * turn));
  cameraFrame(0); aim();
  const move = cameraMove((keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), yaw);
  const input = { x: move.x, z: move.z, aimX: lookDir.x, aimY: lookDir.y, aimZ: lookDir.z };
  if (s.trigger) input.shot = shotParams();   // 连发枪：每一发都从当前的枪口出去
  acc += dt;
  while (acc >= 1 / 120) { step(s, 1 / 120, input); acc -= 1 / 120; }
  stepRecoil(recoil, dt); hitMarkerTime = Math.max(0, hitMarkerTime - dt);
  processEvents(); updateModels(dt); cameraFrame(dt); updateFx(dt); effects.update(dt);
}
function resize() { cine.resize(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = now - last, dt = Math.min(0.05, elapsed / 1000);
  last = now;
  if (!ready) { cine.frame(dt); return; }
  govern(now, elapsed);
  if (mode === 'playing' && !paused) { frameIntervals.push(elapsed); if (frameIntervals.length > 180) frameIntervals.shift(); }
  cameraFrame(dt);
  if (mode === 'playing' && !paused && !window.__rb.hold) advance(dt);
  else if (onMenu()) {
    if (mode === 'depart') { departT += dt; toy.depart(Math.min(1, departT / DEPART)); }
    stepRecoil(recoil, dt); animateHero(dt, false); toy.update(dt); updateFx(dt); effects.update(dt);
    if (mode === 'depart' && departT >= DEPART) start();
  }
  if (performance.now() > toastUntil) $('toast').textContent = '';
  world.update(cine.uniforms.time.value);
  world.setFloor(onMenu() ? 0 : floorIndex(level, s.player.y));
  hud(); cine.frame(dt);
  if (++frameCount % 8 === 0) diagnostics();
}

if (q.get('from') === 'op') document.body.classList.add('from-op');
async function boot() {
  applyTexts();
  camera.position.copy(menuCamera); camera.lookAt(menuLook);
  actors = await loadFigurines(assetData);
  menuHero = actors.create('scout'); menuZombie = actors.create(training&&practiceType?practiceType:'walker');
  cine.scene.add(menuHero.world, menuZombie.world);
  attachGun(menuHero);
  const toyBall = ballTemplate.clone(true); world.light(toyBall); cine.scene.add(toyBall);
  toy = createMenuToy({ stage, hero: menuHero, zombie: menuZombie, ball: toyBall, mood: moodMaterial, part, sfx, burst, ring: (pos, color, size, life) => effects.ring(pos, color, size, life) });
  fpHero = actors.create('scout'); fpHero.model.scale.setScalar(0.48);
  gun = attachGun(fpHero); loadedBall = fpHero.loaded; makeHandsOnly(fpHero);
  for (const actor of [menuHero, menuZombie, fpHero]) world.light(actor.world);
  camera.add(fpHero.world); fpHero.world.scale.setScalar(FP_SCALE); fpHero.world.visible = false;
  cameraFrame(0); resize();
  await cine.warmup();
  ready = true; window.__ready = true;
  $('menuKeys').innerHTML = '<b>W</b><b>S</b> 选' + (training ? '' : ' · <b>A</b><b>D</b> 换地图') + ' · <b>Enter</b> 确定 · <b>空格</b> 打一球试试';
  menu.layout(); hidePickups();
  document.body.classList.remove('from-op');   // 从开场片过来：黑场淡入
  diagnostics();
}
requestAnimationFrame(frame);
boot().catch(fail);

// 自动化验证入口：浏览器面板隐藏时 requestAnimationFrame 基本不跑，
// 所以提供同步推进和单帧渲染，按键也可以直接指定。
window.__rb = {
  get state() { return s; },   // 仅供调试：直接读写战斗状态
  cine, world, effects, governor,
  hold: false,   // true 时不按真实时间推进，只由 advance() 推进，方便定点截图
  snapshot, start,
  get menu() { return menu; }, get toy() { return toy; }, depart, toyShoot,
  get enemyModels() { return enemyModels; }, armProbes: ARM_PROBES, noArmTuck: false,   // 调试：noArmTuck 为 true 时不收手（对比用）
  // 主界面按真实时间走 seconds 秒（面板隐藏时不出帧，用它看小场景的动作）
  menuAdvance(seconds) { for (let t = 0; t < seconds; t += 1 / 60) { if (mode === 'depart') { departT += 1 / 60; toy.depart(Math.min(1, departT / DEPART)); } stepRecoil(recoil, 1 / 60); cameraFrame(1 / 60); if (onMenu()) { animateHero(1 / 60, false); toy.update(1 / 60); } updateFx(1 / 60); effects.update(1 / 60); if (mode === 'depart' && departT >= DEPART) start(); } return mode; },
  advance(seconds, held = []) {
    keys.clear(); for (const k of held) keys.add(k);
    for (let t = 0; t < seconds; t += 1 / 60) advance(1 / 60);
    keys.clear(); hud(); diagnostics(); return snapshot();
  },
  press(key) { dispatchEvent(new KeyboardEvent('keydown', { key })); dispatchEvent(new KeyboardEvent('keyup', { key })); hud(); return snapshot(); },
  teleport(x, z, newYaw = yaw, newPitch = 0, floor = 0) { s.player.x = x; s.player.z = z; s.player.y = floor * SH; yaw = newYaw; pitch = newPitch; cameraFrame(0); return snapshot(); },
  render() { cameraFrame(0); if (mode !== 'playing') { animateHero(0, false); if (onMenu()) toy.update(0); } else updateModels(0); world.setFloor(onMenu() ? 0 : floorIndex(level, s.player.y)); hud(); cine.frame(1 / 60); return cine.stats(); },
  capture(quality = 0.8) { this.render(); return $('view').toDataURL('image/jpeg', quality); },
  // 渲染一帧并交给开发服务器存成 shots/<name>.jpg（面板隐藏时截图是旧帧，用这个看画面）。
  async shot(name, quality = 0.9) { cine.still = true; this.render(); const body = this.capture(quality); cine.still = false; await fetch('/__shot?name=' + encodeURIComponent(name), { method: 'POST', body }); return cine.stats(); },
};
