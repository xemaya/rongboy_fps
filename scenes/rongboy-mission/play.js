import { uiCanvasFont } from './interface-font.js';
// Rongboy 任务制试玩：家 · 三层楼与花园。第一人称，键盘或手柄。
// 战斗规则在 game.js，关卡几何在 level.js；这里只管画面、声音、输入和 HUD。
import * as T from 'three';
import { createCineRenderer, QUALITY } from '../../cine-engine/engine/index.js';
import { createGovernor } from './governor.js';
import { LOOK_PRESETS } from './looks.js';
import { loadFigurines, createWoolBall } from '../../library/games/rongboy-runtime.js';
import { dressWalker, createWeaponKit } from '../../library/games/rongboy-workshop.js';
import { createRecoil, kickRecoil, stepRecoil, enemyReaction } from '../rongboy-shooter-fps/feedback.js';
import { createWoolAudio } from '../rongboy-shooter-fps/sound.js';
import { actionPose } from './actions.js';
import { compileLevel, segmentBox, roomAt, inBounds, lineOfSight, isOutdoor, storeyAt, floorIndex, prepareNavigation } from './level.js';
import { createGame, beginCharge, releaseCharge, startReload, reloadTime, selectWeapon, step, consumeEvents, missionStatus, aliveCount,
  cameraMove, segmentCylinder, CONFIG, WEAPONS as RAW_WEAPONS, ENEMY_TYPES as RAW_ENEMIES, TANGLE_SPEED,
  PISTOL, GRENADE_TYPES, secondOf, grenades, selectGrenade, offeredWeapon, exchangeWeapon, beginThrow, releaseThrow, beginJump, drinkPotion, checkpointCarry } from './game.js';
import { buildWorld } from './world.js';
import { extendWeaponKit, projectileModels, createEffects, createWeaponFeedback, scopeFieldOfView } from './arsenal.js';
import { makeAnkleTangle } from './soft-weave.js';
import { createViewmodel, VIEWMODEL_SCALE } from './viewmodel.js';
import { enemyHealthMaterial, heartImage, potionImage, weaponImage } from './combat-hud.js';
import { measureArmProbe } from '../../library/games/rongboy-rig-geometry.js';
import { poseGroundedGait } from '../../library/games/rongboy-gait.js';
import { GAITS } from './locomotion.js';
import { createArsenalAudio } from './sfx.js';
import { LEVELS, ORDER } from './levels/index.js';
import { GADGETS } from './gadgets.js';
import { trioStudy } from './levels/trio-study.js';
import {gardenWallDef,GARDEN_BOARD} from './levels/garden-wall.js';
import {gardenReceipts} from './garden-feedback.js';
import {gardenThread} from './garden-thread.js';
import { trainingDef } from './levels/training.js';
import { ATTACKS, attackCue } from './attacks.js';
import { applyAttackPose } from './attack-pose.js';
import { createCombatFx } from './combat-fx.js';
import { createGamepad } from './gamepad.js';
import { createKeyboardInput } from './keyboard-input.js';


import { readPreferences, writePreferences } from './preferences.js';
import { exitPlayHref,modelPack,playHref } from './menu-flow.js';
import { KEYBOARD, GAMEPAD, drawPauseBindings, keyBadge, labelAction } from './input-hints.js';
import { readPlayChallenge, saveStamp } from './challenges.js';
import { challengeArena } from './levels/challenge-arenas.js';
import { weaponRange } from './levels/weapon-range.js';

import { crazyGames, firstRound, nextChapter, platformReady, platformPlaying } from './platform.js';
import { t, copy, localizeFields, localizeLevel } from './language.js';
import { gardenIntroDef, advanceGardenIntro } from './levels/garden-intro.js';
import { cottageStudyDef } from './levels/cottage-study.js';
import { createParkTour } from './park-tour-view.js';
import { STALLS } from './park-tour-layout.js';
import { PARK_ZONES, TENT_ZONE, CLOWN, TENT_DOOR, amusementPrompt, amusementTargets, useAmusement, parkRemaining, amusementCutscene, skipAmusementCutscene, clownGaze, GAZE } from './amusement.js';
import { createAmusementView } from './amusement-view.js';
import { PARK } from './park-rides.js';
import { fireStall, stallTarget, STALL_SHOTS } from './park-stalls.js';

const WEAPONS = RAW_WEAPONS.map(weapon => localizeFields(weapon,['name','short']));
const ENEMY_TYPES = Object.fromEntries(Object.entries(RAW_ENEMIES).map(([id,enemy])=>[id,localizeFields(enemy,['name'])]));
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const entry = q.get('level') || (crazyGames ? firstRound : ORDER[0]);
const intro = crazyGames && entry === firstRound;
const preferences = readPreferences();
const reduced = preferences.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const challenge = localizeFields(readPlayChallenge(q),['name','stamp','goal','hint','unit']);
const weaponShowcase = q.get('level') === 'weapon-range';
// 哪张地图：网址里的 ?level=<id>，没有就是第一张。换图是换网址重新加载（场景和光线都是开局时搭好的）。
// ?level=training 是九类僵尸的试战庭院（&type=<兵种> 只练一种），不在地图列表里。
const training = q.get('level') === 'training', practiceType = Object.hasOwn(ENEMY_TYPES,q.get('type')) ? q.get('type') : null;
const garden = intro || entry === 'garden-wall' || challenge?.id === 'shield-bank';
const polished = garden && (!!challenge || q.get('feel') !== 'base');
const receipts = garden ? gardenReceipts() : null;
let lastBlock = -10, chargeCue = false, gardenShieldId = null;
const levelId = weaponShowcase ? 'weapon-range' : challenge ? 'challenge' : garden ? (intro ? firstRound : 'garden-wall') : training ? 'training' : LEVELS[q.get('level')] ? q.get('level') : ORDER[0];
const study = q.get('study');
const cottageStudy = levelId === 'cottage' && ['waves','all-at-once'].includes(study);
const specialists = levelId === 'school' && q.get('study') === 'specialists';
const trio = specialists || (levelId === 'school' && q.get('study') === 'trio');
const source = q.get('from');
const menuTrial = training && !!practiceType && ['codex','practice'].includes(source);
const finalStudy = training && q.get('study') === 'final' && ['archer','boss-warden','boss-leech'].includes(practiceType);
const returnTo = exitPlayHref(q,levelId);
const returnLabel = intro ? (source === 'chapters' ? '返回选关' : '返回主菜单') : challenge ? '返回挑战簿' : training ? '返回兵种试战' : garden || weaponShowcase ? '返回练习' : '返回选关';
let awaitingApproach = false, pauseIndex = 0, introStage = 0;
let hadPointerLock = false, pointerReleasedAt = -Infinity;
const level = compileLevel(localizeLevel(weaponShowcase ? weaponRange() : challenge ? challengeArena(challenge) : garden ? (intro ? gardenIntroDef() : gardenWallDef()) : trio ? trioStudy(LEVELS.school, specialists) : training ? trainingDef(practiceType) : cottageStudy ? cottageStudyDef(study) : LEVELS[levelId]));
const park = !!level.tour, amusement=level.mission.type==='amusement';   // park：游乐园的大地图（有设施能坐）；amusement：有门、机关和小丑的那套规则。布偶游乐园两样都是
const missionBriefing = (amusement || level.mission.type === 'fetch') && !challenge;
const practiceBindingsOnly = garden || challenge?.id === 'dodge-arrows';
const requestedStage = !crazyGames && amusement && q.get('debug') === '1' ? Math.min(TENT_ZONE,Math.max(0,Number(q.get('checkpoint'))|0)) : 0;
const TX = level.texts || { short: level.name, eyebrow: level.name, title: level.name, intro: level.mission.title, how: [], start: '进入', won: '全部清空！' };
const EYE = 1.23, FAR = 30, SH = level.storeyHeight;
const RANGE_GUNS = WEAPONS.flatMap((w,index) => w.kind === 'grenade' || w.id === 'freeze' ? [] : [index]);
const HIP_FOV = 65, SCOPE_POWER = WEAPONS.find(w=>w.zoom).zoom;
// 脚下是露天的花园吗（楼上不算）
const openAir = (x, y, z) => y < 1 && isOutdoor(level, x, z);

let s = createGame({ level,amusementCheckpoint:requestedStage });
let mode = 'loading', ready = false, paused = false, fireInput = null, throwInput = null;
let actors, bossActors, viewmodel, tourView, amusementView;
let rideYaw = 0, rideVignette = 0;   // 游乐园：上车那一刻面朝哪、暗角的深浅
const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
function loadingProgress(value, message) { $('loadingProgress').value = value; $('loadingStatus').textContent = t(message); }
const gaze = { kind: null, home: 0, back: false, manual: false, mouse: 0 };   // 小丑战里镜头自己转的那部分俯仰
let yaw = level.player.yaw || 0, pitch = 0, phase = 0, acc = 0, shake = 0, last = performance.now(), frameCount = 0;
let recoil = createRecoil(), hitMarkerTime = 0, hitMarkerKind = '', toastUntil = 0, toastPriority = 0, zoom = 0;
let aimedEnemy = null, lastWounded = null;
const hasPotions = (level.pickups || []).some(k => k.kind === 'potion');   // 这张图里有血瓶才显示瓶数和按键
let potionShown = '', zoneCarry = null;
let hurtRoll = 0, hurtPitch = 0, lastHealth = CONFIG.maxHealth, nextBeat = 0, offerShown = '';   // 挨打时镜头偏的那一下；心跳声；换枪提示
let lastPress = -Infinity;
const keys = createKeyboardInput(), errors = [], frameIntervals = [];
// 手柄：PS5 插上就能用；没插的时候这一套全是 0，键盘照旧。
const pad = createGamepad({deadzone:.26});
const neutralSticks = {x:0, y:0, lookX:0, lookY:0};
let padAxes = neutralSticks, padNeedsNeutral = true, padWasConnected = false;
let inputMode = 'keyboard', padSoundHint = false;

// The menu is a separate lightweight page; this page loads only the confirmed map.
function applyTexts() {
 document.title = `${t('绒仔')} · ${level.name}`;
 document.body.classList.toggle('reduced-ui',reduced);
 document.body.classList.toggle('challenge-round',!!challenge);
 $('result').querySelector('.eyebrow').textContent = level.name;
 document.body.style.setProperty('--heart-full','url('+heartImage(true)+')');
 document.body.style.setProperty('--heart-empty','url('+heartImage(false)+')');
 document.body.style.setProperty('--potion-full','url('+potionImage(true)+')');
 document.body.style.setProperty('--potion-empty','url('+potionImage(false)+')');
 $('loadingTitle').textContent = TX.short || level.name;
 $('loadBack').href = returnTo;
 $('pauseMenu').textContent = t(returnLabel);
 $('ready-title').textContent = t(cottageStudy ? TX.short : missionBriefing ? '出发前' : garden ? '借墙破盾' : practiceType ? ATTACKS[practiceType].name : '准备迎战');
 $('ready-brief').textContent = t(amusement ? copy(TX.brief,'WASD to move, arrows to look, Space to fire, Q to switch guns, H to drink a potion. Press F by a ride to use it. At the entrance: freeze the sliding latch, then shatter it with the pistol.') : missionBriefing || cottageStudy ? TX.brief || level.mission.title
   : garden ? '蓄满力打盾面，或让毛球从墙上弹回盾后。' : practiceType ? ATTACKS[practiceType].counter : level.mission.title);
 if (cottageStudy) $('missionHud').querySelector('strong').textContent = t(s.wave ? '院子波次' : '院子对照局');
 $('sound').textContent = t(sound ? '声音 开' : '声音 关');
 $('sound').setAttribute('aria-pressed',sound);
 $('expand').hidden = crazyGames;
 if(garden && !challenge && !crazyGames){
   const link=$('gardenCompare'), next=new URL(location.href);
   next.searchParams.set('feel',polished?'base':'new');link.href=next;link.hidden=false;
   link.textContent=t(polished?'切到原手感':'切到新手感');
 }
 applyInputHints();
}

// 屏幕上的按键提示跟着最近用过的输入设备走：键盘动过就是键盘，手柄动过就是手柄。
// 动作本身不受影响，两套输入一直都能用。
const MOUSE = { ...KEYBOARD, look:['鼠标'], fire:'鼠标左键' };
const inputLabels = () => inputMode === 'gamepad' ? GAMEPAD : inputMode === 'mouse' ? MOUSE : KEYBOARD;
function updateBankGuide() {
  if (!bankGuide) return;
  const enemy = s.enemies.find(e => e.alive && e.enabled);
  const board = level.solids.find(box => box.id === GARDEN_BOARD);
  const front = board.maxZ + .1;
  const from = s.player.z-front, back = (enemy?.z ?? front)-front;
  const x = from>0 && back>0 ? (back*s.player.x+from*enemy.x)/(back+from) : Infinity;
  bankGuide.visible = introStage===2 && mode==='playing' && !paused && x>board.minX+.16 && x<board.maxX-.12;
  if (bankGuide.visible) bankGuide.position.set(x,1.19,board.maxZ+.018);
}
function introPrompt() {
  if (!intro) return;
  updateBankGuide();
  const root = $('introGuide');
  root.hidden = !introStage || mode !== 'playing' || paused;
  const hints = [
    '',
    inputMode === 'mouse' ? '左键开火' :
      inputMode === 'gamepad' ? '按 R2 开火' : 'WASD 移动 · 点击用鼠标瞄准，或用方向键和空格',
    '瞄准墙板上的圆环，让毛球反弹',
    '按住开火蓄力破盾，或绕到背后',
  ];
  root.textContent = t(hints[introStage] || '');
}
function setInputMode(value) { if (inputMode === value) return; inputMode = value; applyInputHints(); }
function applyInputHints() {
  const L = inputLabels();
  const quick = [[L.move,'移动'],[L.look,'转动视角']];
  quick.push([L.fire,'开火'],[L.reload,'换弹']);
  drawPauseBindings($('pauseQuick'),quick);
  const detail = [...quick];
  detail[2] = [L.fire,'开火 / 蓄力']; detail.push([L.jump,'跳跃']);
  if (!practiceBindingsOnly) {
    detail.push([L.switch,'换枪']);
    if (hasPotions) detail.push([L.potion,'喝血瓶']);
    if (amusement) detail.push([L.exchange,copy('玩设施 / 跳过 / 下车','Use rides / Skip / Get off')]);
    else if (!challenge) detail.push([L.exchange,'拾取地上的枪'],[L.throw,'投掷'],[L.grenade,'切换炸弹']);
  }
  if (weaponShowcase) {
    if (inputMode === 'gamepad') detail.push(['△','下一把枪']);
    else detail.push(['3','灯炮'],['4','电网'],['6','4× 毛衣针']);
  }
  drawPauseBindings($('pauseBindings'),detail);
  for (const [id,label] of [['resume','继续'],['pauseDetailsBack','返回暂停']]) {
    labelAction($(id),L.back,label);
    $(id).firstElementChild.classList.add('pause-action-key');
  }
  labelAction($('approach'), L.confirm, park ? copy('入园','Enter park') : missionBriefing ? '出发' : garden ? '开始练习' : '开打');
  if (!$('nextChapter').hidden) {
    labelAction($('nextChapter'),L.confirm,'下一关');
    $('again').textContent = t('再来一次');
  } else labelAction($('again'), L.confirm, challenge ? '再挑战' : '再来一次');
  for (const id of ['back','readyBack']) labelAction($(id), L.back, returnLabel);
  $('loadBack').textContent = t(returnLabel);
  introPrompt();
}
function fail(err) {
  const msg = String(err?.stack || err);
  errors.push(msg); $('error').textContent = msg; $('loadingStatus').textContent = t('加载失败，请返回菜单重试。'); $('loadBack').hidden = false;
}
addEventListener('error', e => fail(e.error || e.message));
addEventListener('unhandledrejection', e => fail(e.reason));

// ---------- 画面 ----------

// 光线按关卡取（level.look），预设在 looks.js（开场片也用同一份）。
const look = (LOOK_PRESETS[level.look] || LOOK_PRESETS.afternoon)();
const B = level.bounds;
// 清晰度：先争 60 帧，够不到再保 30 帧。调节器在 governor.js（为什么不用引擎自带的，也写在那里），引擎自带的关掉了。
// 分三档，每档有自己的像素数范围；第 0 档的光影和导出视频时一样（4 倍抗锯齿、环境遮蔽、16 次采样的软阴影），只动像素数：
const LOOKS = [
  { q: { ...QUALITY.high }, min: 0.55e6, max: 3.6e6 },                  // Retina 原生是 360 万像素；最低相当于 990×557
  { q: { ...QUALITY.medium, scale: 1 }, min: 0.4e6, max: 1.0e6 },       // 2 倍抗锯齿，环境遮蔽还在
  { q: { ...QUALITY.low, scale: 1 }, min: 0.25e6, max: 1.0e6 },         // 最后才关抗锯齿和环境遮蔽
];
const fixedQuality = QUALITY[q.get('q')] || QUALITY[preferences.quality] || null, governed = !fixedQuality && q.get('dynres') !== '0';   // 网址加 ?q=medium / ?q=low 手动定档；?dynres=0 固定在第 0 档的最高像素数
const GOVERNOR_KEY = 'rongboy-governor-v1', gpuName = governed ? gpuRenderer() : '';
const governor = createGovernor(LOOKS, governed ? governorStart() : { start: LOOKS[0].max });
let cine, camera, world, combatFx, effects, weaponFeedback, ankleTangle, thread, bankGuide;
function initRenderer() {
  cine = createCineRenderer({
    canvas: $('view'), look, quality: fixedQuality || { ...LOOKS[governor.tier].q, pixels: governor.pixels }, fov: 65, near: 0.035, far: 150, maxPixelRatio: 2, targetFps: 30,
    dynamicResolution: false, shadow: { mode: 'box', min: [B.minX - 1.5, -1, B.minZ - 1.5], max: [B.maxX + 1.5, level.top + 1, B.maxZ + 1.5], softness: 0.7,
      // The spotlight needs to render the moving actors into its own shadow map.
      static: !q.has('liveshadow') && !level.gadgets.some(g => g.kind === 'spot'),
    }, onError: fail,
  });
  camera = cine.camera;
  // 体积光在关卡里只会蒙上一层雾，关闭后省一趟半分辨率步进。
  if (cine.postChain) cine.postChain.enable.volumetrics = false;
}
// 每帧把帧间隔喂给调节器。窗口不在前台时浏览器会把出帧压到很慢，那种帧间隔说明不了显卡快慢，不喂。
function govern(now, elapsed) {
  if (!governed || document.hidden || (document.hasFocus && !document.hasFocus())) return;
  const r = Math.min(devicePixelRatio || 1, 2), next = governor.feed(now, elapsed, innerWidth * r * innerHeight * r);
  if (next) {
    cine.setQuality({ ...LOOKS[next.tier].q, pixels: next.pixels });
    try { localStorage.setItem(GOVERNOR_KEY, JSON.stringify({ gpu: gpuName, target: governor.target, tier: next.tier, pixels: Math.round(next.pixels) })); } catch {}
  }
}
// 起步：这台机器（按显卡名认）上次找到的帧数目标和设置记在本机，下次直接从那儿起步，不用再花十几秒从头试。
// 头一回来：一般从第 0 档 160 万像素起步；显卡名像核显、手机、软件渲染的，从第 1 档 60 万像素起步，少卡几秒。
function gpuRenderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info'), name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext(); return name;
  } catch { return ''; }
}
function governorStart() {
  try {
    const saved = JSON.parse(localStorage.getItem(GOVERNOR_KEY) || 'null');
    if (saved && saved.gpu === gpuName && LOOKS[saved.tier] && saved.pixels > 0)
      return { targets: saved.target === 30 ? [30] : [60, 30], startTier: saved.tier, start: saved.pixels };
  } catch {}
  return /Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Basic Render/i.test(gpuName) ? { startTier: 1, start: 0.6e6 } : { start: 1.6e6 };
}
const ray = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
const lookDir = new T.Vector3(), muzzleWorld = new T.Vector3(), localMuzzle = new T.Vector3(), target = new T.Vector3();
const sightEnd = new T.Vector3(), boundaryHit = new T.Vector3();
const aimBounds = new T.Box3(new T.Vector3(B.minX,0.03,B.minZ),new T.Vector3(B.maxX,level.top,B.maxZ));
const enemyModels = new Map(), ballModels = new Map();
const ballTemplate = createWoolBall();
const ballTemplates = projectileModels(WEAPONS, ballTemplate);
const feelOf = id => { const w = WEAPONS.find(v => v.id === id); return w?.feel || id; };   // 后坐力、受击声借用前三把里的哪一把

// 绒絮粒子：一个实例化网格，上限 360 颗（毛球拖尾和爆炸要用不少）。
const FX_MAX = 360, fx = [], dummy = new T.Object3D(), tint = new T.Color();
const fxMesh = new T.InstancedMesh(new T.SphereGeometry(1, 7, 5), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), FX_MAX);
fxMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); fxMesh.frustumCulled = false; fxMesh.setColorAt(0, new T.Color(0xffffff)); fxMesh.count = 0;
function initWorld(kit) {
  world = buildWorld(cine, level, WEAPONS, kit?.userData.variants);
  if (park) { tourView = createParkTour(cine,world,{reduced}); s.park.watch = reduced; }
  if (amusement) amusementView=createAmusementView(cine,world);
  combatFx = createCombatFx(cine.scene);
  effects = createEffects(cine.scene);
  weaponFeedback = createWeaponFeedback(cine.scene,world.light);
  ankleTangle = world.light(makeAnkleTangle());
  thread = polished ? gardenThread(cine.scene,reduced) : null;
  cine.scene.add(fxMesh);
  if (intro) {
    bankGuide = new T.Mesh(new T.RingGeometry(.12,.142,32),
      new T.MeshBasicMaterial({color:0xffdc96,transparent:true,opacity:.88,depthWrite:false}));
    bankGuide.visible = false;
    cine.scene.add(bankGuide);
  }
}
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

let sound = preferences.sound, audio = null, soundBus = null, arsenalBus = null, lastBounceSound = 0, lastKnockSound = 0, lastRing = 0;
// 家具是什么做的：决定被毛球打到时的声音和绒絮多少
const SOUND_OF = { soft: 'thump', wood: 'knock', glass: 'ting', metal: 'clang', stone: 'tock' };
const SOFT = new Set(['sofa', 'bed', 'ottoman', 'basket', 'hedge', 'tree', 'planter']), METAL = new Set(['fridge', 'locker', 'tub', 'slide', 'swing', 'mailbox']);
const stuffOf = c => (c.kind === 'case' ? 'glass' : c.kind === 'plinth' || c.kind === 'sarcophagus' ? 'stone' : c.kind === 'gadget' ? 'metal' : SOFT.has(c.look || c.kind) ? 'soft' : METAL.has(c.look || c.kind) ? 'metal' : 'wood');
function unlock() {
  if (!sound) return;
  audio ??= new AudioContext();
  soundBus ??= createWoolAudio(audio);
  arsenalBus ??= createArsenalAudio(audio);
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}
function sfx2(kind, options = {}) { if (sound && audio && audio.state === 'running') arsenalBus.play(kind, options); }
function sfx(kind, options = {}) { if (sound && audio && audio.state === 'running') soundBus.play(kind, options); }
function say(text, seconds = 1.2, priority = 0) {
  const now = performance.now();
  if (!text || (now < toastUntil && priority < toastPriority)) return;
  $('toast').textContent = t(text);
  toastUntil = now + seconds * 1000;
  toastPriority = priority;
}
const part = (a, n) => a.parts.get(n);

// ---------- 第一人称的手和枪 ----------

// 第一人称模型保留原有的前景深度范围。它的姿态和投影按眼前的构图单独调节。
const FP_DEPTH = 0.1, fpErasers = [];
function drawInFront(root) {
  const gl = cine.renderer.getContext(), meshes = [];
  root.traverse(o => { if (o.isMesh) meshes.push(o); });
  // 画完以后，再把手和枪占的那些像素的深度改写成"无穷远"：不然环境遮蔽会以为眼前 4 厘米处有东西，
  // 在贴近的墙上围着枪抹一圈黑。改写放在最后（所有透明物体之后），所以不影响别的东西和枪的前后关系。
  const erase = new T.MeshBasicMaterial({ colorWrite: false, depthFunc: T.AlwaysDepth, depthWrite: true, transparent: true });
  for (const o of meshes) {
    o.onBeforeRender = () => { if (window.__rb.gunInFront) gl.depthRange(0, FP_DEPTH); };
    o.onAfterRender = () => gl.depthRange(0, 1);
    const e = new T.Mesh(o.geometry, erase); e.renderOrder = 1e6; e.frustumCulled = false; e.castShadow = e.receiveShadow = false;
    e.onBeforeRender = () => gl.depthRange(1, 1); e.onAfterRender = () => gl.depthRange(0, 1);
    o.add(e); fpErasers.push(e);
  }
}
const weaponImages = new Map();
function syncWeapon() {
  if (!viewmodel) return;
  viewmodel.equip(s.weapon);
  const weapon = WEAPONS[s.weapon];
  if (!weaponImages.has(weapon.id)) weaponImages.set(weapon.id, weaponImage(weapon.id));
  $('weaponIcon').src = weaponImages.get(weapon.id);
}

function animateViewmodel(dt, moving) {
  if (!viewmodel) return;
  const side = ((keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)) + padAxes.x;
  const forward = ((keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0)) - padAxes.y;
  const speed = Math.min(1,Math.hypot(side,forward));
  if (moving) phase += dt * 10.5 * speed;
  const weapon=WEAPONS[s.weapon], variant=viewmodel.kit.userData.variants[s.weapon].userData;
  const reload=s.reloading ? Math.sin(Math.min(1,1-s.reload/weapon.reload)*Math.PI) : 0;
  const charge=s.charging ? s.charge/CONFIG.chargeTime : 0;
  viewmodel.update({
    weapon:weapon.id, phase, speed:moving?speed:0, motion:reduced?.5:1, recoil, reload, charge,
    lob:s.lobbing?s.lob/CONFIG.chargeTime:null, grenade:s.grenade, invul:s.invul, time:s.time,
  });
  const loaded=viewmodel.ball;
  loaded.visible=s.charging && s.weapon===PISTOL;
  loaded.scale.setScalar(.12+charge*.18);
  loaded.rotation.y+=dt*2;
  if (polished && loaded.visible) {
    const squeeze=charge*.24;
    loaded.scale.x*=1+squeeze;loaded.scale.y*=1+squeeze;loaded.scale.z*=1-squeeze;
  }
  if (variant.lamp) variant.lamp.emissiveIntensity=s.reloading?.25:1.25+recoil.back.x*4;
  if (variant.contacts) variant.contacts.emissiveIntensity=s.charging?1.7:.65;
  if (variant.press) variant.press.rotation.x=Math.max(0,1-(s.time-lastPress)/weapon.cooldown)*.19;
  aim();
  for (const eraser of fpErasers) eraser.visible=window.__rb.gunInFront;
}

// ---------- 僵尸 ----------

// 攻击和破防提示只在对应的动作窗口出现。
const moodMaterials = new Map();
function moodMaterial(text) {
  if (moodMaterials.has(text)) return moodMaterials.get(text);
  const c = document.createElement('canvas'); c.width = 160; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const size = text === '!' || text === '?' ? 78 : 43;
  ctx.font = uiCanvasFont(size);
  const measured = ctx.measureText(text).width;
  if (measured > 143) ctx.font = uiCanvasFont(size * 143 / measured);
  ctx.lineWidth = 8; ctx.strokeStyle = '#3e4a38'; ctx.strokeText(text, 80, 50);
  ctx.fillStyle = text === 'Zzz' ? '#eef2e2' : text === '?' ? '#e6dcb4' : '#f2b84b'; ctx.fillText(text, 80, 50);
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

let iceGeometry, iceShellMaterial, iceRimMaterial, iceRingGeo, iceRingMat;
const freezeBeams = [];
const beamGeo = new T.CylinderGeometry(.032, .052, 1, 8, 1, true);
function spawnFreezeBeam(x0, y0, z0, x1, y1, z1) {
  const from = new T.Vector3(x0, y0, z0), to = new T.Vector3(x1, y1, z1);
  const diff = to.clone().sub(from), len = Math.max(.08, diff.length());
  const mat = new T.MeshBasicMaterial({ color: 0xb6f4ff, transparent: true, opacity: .92, depthWrite: false, side: T.DoubleSide });
  const mesh = new T.Mesh(beamGeo, mat);
  mesh.position.copy(from).addScaledVector(diff, .5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), diff.normalize());
  cine.scene.add(mesh);
  freezeBeams.push({ mesh, mat, age: 0, life: .24 });
}
function stepFreezeBeams(dt) {
  for (let i = freezeBeams.length - 1; i >= 0; i--) {
    const b = freezeBeams[i]; b.age += dt;
    if (b.age >= b.life) { cine.scene.remove(b.mesh); b.mat.dispose(); freezeBeams.splice(i, 1); continue; }
    const left = 1 - b.age / b.life;
    b.mat.opacity = left * .92;
    b.mesh.scale.x = b.mesh.scale.z = .5 + left * .8;
  }
}
function updateEnemy(e, a, showHealth) {
  a.reset();
  a.world.position.set(e.x, e.y, e.z); a.tilt.position.set(0,0,0); a.tilt.scale.setScalar(1); a.model.rotation.y = e.heading;
  const distance = Math.hypot(e.x - s.player.x, e.z - s.player.z);
  if (showHealth) {
    const material = enemyHealthMaterial(e.hp, e.maxHp);
    if (!a.healthBar) {
      a.healthBar = new T.Sprite(material);
      a.healthBar.renderOrder = 4;
      a.world.add(a.healthBar);
    }
    const projection = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / Math.tan(T.MathUtils.degToRad(HIP_FOV / 2));
    const width = Math.min(.93, Math.max(.16, distance * .163)) * projection;
    a.healthBar.position.set(0, e.height + .16, 0);
    a.healthBar.scale.set(width, width * 36 / 256, 1);
    a.healthBar.material = material;
  }
  if (a.healthBar) a.healthBar.visible = showHealth;
  const asleep = e.awareness === 'asleep', waking = e.awareness === 'waking';
  const searching = e.awareness === 'idle' && e.lure?.kind === 'noise';
  const frozen = e.alive && e.frozenUntil>s.time;
  if (frozen && !a.ice) {
    iceGeometry ??= new T.IcosahedronGeometry(1,0);
    iceShellMaterial ??= new T.MeshBasicMaterial({color:0x8be4ff,transparent:true,opacity:.38,depthWrite:false,flatShading:true});
    iceRimMaterial ??= new T.MeshBasicMaterial({color:0xdaf8ff,transparent:true,opacity:.55,wireframe:true,depthWrite:false});
    iceRingGeo ??= (() => { const g = new T.RingGeometry(.46, .64, 24); g.rotateX(-Math.PI/2); return g; })();
    iceRingMat ??= new T.MeshBasicMaterial({color:0x9ef0ff,transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide});
    a.ice = new T.Group();
    const shell = new T.Mesh(iceGeometry, iceShellMaterial);
    shell.position.y = e.height * .54; shell.scale.set(e.radius * 1.24, e.height * .60, e.radius * 1.24);
    const rim = new T.Mesh(iceGeometry, iceRimMaterial);
    rim.position.y = e.height * .54; rim.scale.set(e.radius * 1.28, e.height * .62, e.radius * 1.28);
    const floorRing = new T.Mesh(iceRingGeo, iceRingMat);
    floorRing.position.y = .04; floorRing.scale.setScalar(e.radius / .34);
    a.ice.add(shell, rim, floorRing);
    a.world.add(a.ice);
  }
  if (a.ice) a.ice.visible=frozen;
  const cue = frozen ? null : attackCue(e);
  const mood = e.alive && (frozen?copy('冻住了','Frozen'):t(cue?.label || (e.guardBroken > 0 ? '破防' : waking ? '!' : searching ? '?' : '')));
  if (mood) {
    const material = moodMaterial(mood);
    if (!a.mood) {
      a.mood = new T.Sprite(material);
      a.mood.renderOrder = 4;
      a.world.add(a.mood);
    }
    a.mood.material = material;
    a.mood.position.set(showHealth ? .46 : .20, e.height + (showHealth ? .31 : .15), 0);
    a.mood.scale.set(.36, .216, 1);
  }
  if (a.mood) a.mood.visible = !!mood;
  const pose = actionPose(e), response = enemyReaction(e), body = part(a, 'Body'), head = a.model.userData.continuous_neck ? null : part(a, 'Head');
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
  const leap = e.type === 'leaper' && ['windup','pounce','recover'].includes(e.action);
  const grounded = !!GAITS[e.type] && !leap;
  const lift = e.hop > .001 && e.hopHeight ? Math.min(1,e.hop/e.hopHeight) : 0;
  const landing = Math.max(0,(e.hopPhase-.78)/.22);
  const squash = e.type === 'walker' ? Math.sin(landing*Math.PI) : 0;
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
  if (grounded) poseGroundedGait(e,a);
  // 跳跳和扑击保持双手向前的剪影。其余兵种让脚步和手里的道具带动姿态。
  const calm = e.awareness === 'alert' ? 0 : waking ? Math.max(0, Math.min(1, e.wake / 0.6)) : 1;
  const breathe = asleep ? Math.sin(e.age * 1.6) : 0;
  const reach = grounded ? 0 : 1.18 * (1 - calm) + (waking ? -0.5 * (1 - calm) : 0);
  if (body) {
    body.rotation.x += (grounded ? 0 : .12-lift*.08) + forward * response.bend * 0.12 + pose.lean + (asleep ? 0.28 + breathe * 0.02 : 0);
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
      leg.rotation.x += lift * 0.38 - squash * 0.15 + (grounded ? 0 : sign * Math.sin(e.age * 7) * .035 * (1-calm)) + response.flail * (sign > 0 ? .40 : -.22) + pose.legTuck;
      leg.rotation.z += sign * (lift * 0.08 + response.flail * 0.12);
    }
    if (arm) {
      arm.rotation.x -= reach + lift * 0.10 + response.flail * 0.40 + pose.reach;
      const spread = grounded ? 0 : .08 + lift*.035 + (waking ? .35*calm : 0);
      arm.rotation.z += sign * (spread + response.flail * .52 + pose.spread);
      arm.rotation.y += response.twist * 0.35;
    }
  }
  if (e.type === 'leaper') {
    if (!a.tell) { a.tell = new T.Mesh(tellGeo, tellMat); a.tell.rotation.x = -Math.PI / 2; a.world.add(a.tell); }
    a.tell.visible = e.action === 'windup'; a.tell.position.y = 0.025 - (e.y - e.base);
    a.tell.scale.setScalar(1.65 - Math.min(1, e.actionAge / 0.48) * 0.65);
  }
  applyAttackPose(e, a);
  if(polished && e.type==='shielded'){
    const shield=part(a,'ArmL'),elapsed=s.time-lastBlock;
    if(e.guardBroken>0)shield.rotation.z-=.83*Math.min(1,e.guardBroken*6,(1.8-e.guardBroken)*18);
    else if(elapsed>=0 && elapsed<.26)shield.rotation.x-=.32*Math.sin(elapsed/.26*Math.PI*2)*Math.exp(-elapsed*8);
  }
  a.flash(Math.max(response.flash * 0.7, e.action === 'bomber-throw' ? (reduced ? 0.04 : 0.10 + Math.sin(e.actionAge * 12) * 0.08) : 0));
  const quiltTime = (e.quiltUntil ?? -1) - s.time;
  if (quiltTime > -.42 && !a.quilt) {
    a.quilt = world.toys.cover();
    a.world.add(a.quilt);
  }
  if (a.quilt) {
    a.quilt.visible = quiltTime > -.42 && e.alive;
    const peel = T.MathUtils.clamp(-quiltTime/.42,0,1);
    const struggle = Math.sin(s.time*20+e.id) * Math.min(1, Math.max(0,quiltTime)*5);
    a.quilt.position.set(.64*peel,.38*e.height+.54*Math.sin(Math.PI*peel)-.66*peel,0);
    a.quilt.scale.set(Math.max(.82,e.radius*2.65),e.height*.73,Math.max(.8,e.radius*2.6));
    a.quilt.rotation.set(.32*peel,e.heading,.095*struggle+1.2*peel);
    a.tilt.rotation.z += .065*struggle;
  }
  const painted = (e.paintUntil ?? 0) > s.time;
  if (painted && !a.paintFlecks) {
    a.paintFlecks = world.toys.makePaintFlecks();
    a.world.add(a.paintFlecks);
  }
  if (a.paintFlecks) {
    a.paintFlecks.visible = painted && e.alive;
    a.paintFlecks.scale.set(e.radius*1.18,e.height,e.radius*1.12);
    a.paintFlecks.rotation.y = e.heading;
  }
  // 聚光灯用照明，棉被用布套。只有电网定身才画电弧。
  if (e.stun > 0 && (e.spotUntil ?? 0) <= s.time && quiltTime <= 0) {
    const pulse = 0.5 + 0.5 * Math.sin(s.time * 38 + e.id);
    for (const m of a.materials) m.emissive?.setRGB(.02+.035*pulse,.07+.09*pulse,.13+.13*pulse);
    a.model.position.x += Math.sin(s.time * 71 + e.id) * 0.012; a.model.position.z += Math.cos(s.time * 83) * 0.012;
    a.tilt.rotation.z += Math.sin(s.time * 57 + e.id) * 0.03;
    if (Math.random() < 0.5) effects.crackle(e.x, e.y, e.z, e.radius, e.height);
    if (distance < 8 && Math.random() < 0.08) sfx2('crackle', { strength: 0.5 });
  }
  // 绒网收紧在脚边，保留蹒跚动作和原有的角色轮廓。
  if (e.tangle > 0 && !a.tangle) {
    a.tangle = ankleTangle.clone(true);
    a.world.add(a.tangle);
  }
  if (a.tangle) {
    const loosen = Math.min(1,e.tangle/.22), width = e.radius * (1.20-.14*loosen);
    a.tangle.visible = e.tangle > 0;
    a.tangle.scale.setScalar(width*(.8+.2*loosen));
    a.tangle.position.y = e.base - e.y;
  }
}

// ---------- 僵尸的手不插墙 ----------
// 追人的时候手往前伸，比碰撞半径长（跳跳前伸 0.59 米对半径 0.32，守墓巨像 1.5 对 0.62），贴着墙或家具就插进去了。
// 这里只改画面：摆完姿势以后，沿着每条手臂放三个球去碰 level.solids，碰到了就把这条手臂往垂手的姿势收，收到刚好不碰为止。
// 碰撞、寻路、攻击判定都不变。
const ARM_PROBES = new Map(), ARM_PAD = 0.05;   // ARM_PAD：留的余量（米），补上平滑带来的滞后
const armM = new T.Matrix4(), armV = new T.Vector3(), armPosed = new T.Euler();
// 每个兵种的每条手臂量一次：从肩到最远的顶点是手臂的轴，靠外那一段的粗细是球的半径
function armProbe(e, actor, name) {
  const key = e.type + ':' + name;
  if (!ARM_PROBES.has(key)) ARM_PROBES.set(key, measureArmProbe(actor, name));
  return ARM_PROBES.get(key);
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

// 守墓巨像先露出两只眼睛，现身后交给定稿的面部模型。
const emerging = new Map(), eyeGeo = new T.SphereGeometry(.056, 12, 8), eyeMat = new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc94a, emissiveIntensity: 4 });
function wardenLook(e, a, dt) {
  const st = emerging.get(e.id);
  if (!st) { if (a.eyes) a.eyes.visible = false; return; }
  if (!a.eyes) {
    a.eyes = new T.Group();
    for (const sx of [-1, 1]) { const m = new T.Mesh(eyeGeo, eyeMat); m.position.set(sx * 0.2, e.height * 0.84, e.radius * 0.8); a.eyes.add(m); }
    a.world.add(a.eyes);
  }
  a.eyes.rotation.y = e.heading; a.eyes.scale.y = 1;
  st.t += dt;
  const shown = st.t > st.time * 0.5;
  a.eyes.visible = e.alive && !shown;
  a.model.visible = shown; a.blob.visible = shown; if (a.healthBar && !shown) a.healthBar.visible = false;
  if (st.t > 0.45 && st.t < 0.6) a.eyes.scale.y = 0.12;   // 眨一下
  if (shown && !st.done) { st.done = true; burst(e.x, e.z, 28, 1.3, 0x3d342c, e.base + 1.2); sfx2('rumble'); }
  if (st.t > st.time) emerging.delete(e.id);
}

const actorFrustum = new T.Frustum(), viewProjection = new T.Matrix4(), actorEnvelope = new T.Sphere();
function healthTarget() {
  if (mode !== 'playing' || paused || awaitingApproach) return null;
  if (lastWounded && s.time < lastWounded.until) {
    const struck = s.enemies.find(e => e.id === lastWounded.id);
    if (struck?.alive && struck.enabled && !struck.type.startsWith('boss-') &&
        floorIndex(level, struck.base) === floorIndex(level, s.player.y) &&
        lineOfSight(level, camera.position, { x: struck.x, y: struck.y + struck.height * .82, z: struck.z })) return struck.id;
  }
  return aimedEnemy?.alive && !aimedEnemy.type.startsWith('boss-') ? aimedEnemy.id : null;
}

const actorBank = type => type.startsWith('boss-') ? bossActors || actors : actors;

function updateModels(dt) {
  camera.updateWorldMatrix(true,false);
  actorFrustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  animateViewmodel(dt, mode === 'playing' && !paused);
  const healthFocus = healthTarget();
  const present = new Set(s.enemies.map(e => e.id));
  for (const [id, a] of enemyModels) if (!present.has(id)) { cine.shadows.removeDynamic(a.world); a.world.removeFromParent(); a.dispose(); enemyModels.delete(id); }
  for (const e of s.enemies) {
    if(!e.enabled){const hidden=enemyModels.get(e.id);if(hidden)hidden.world.visible=false;continue;}
    let a = enemyModels.get(e.id);
    if (!a) {
      a = actorBank(e.type).create(e.type); dressWalker(a, e.type, e.scale);
      a.model.traverse(m => { if (m.isMesh) m.frustumCulled = true; });
      world.light(a.world);   // 角色和墙、家具查同一份烘焙光照：站在灯下亮，躲进角落暗
      cine.shadows.addDynamic(a.world, () =>
        (e.alive || e.deathAge < .78) && world.volume.skyAt(e.x, e.base + .9, e.z) > .05);
      enemyModels.set(e.id, a); cine.scene.add(a.world);
    }
    // Match the rendered storeys. Depth testing against the drawn scenery clips
    // individual pixels, including tiny exposed parts at the edge of a hedge.
    const distance = Math.hypot(e.x-s.player.x,e.z-s.player.z);
    actorEnvelope.center.set(e.x,e.y+e.height*.5,e.z);
    actorEnvelope.radius=e.height+e.radius+.5; // includes outstretched arms, shield and raised fists
    a.world.visible = Math.abs(floorIndex(level,e.base)-floorIndex(level,s.player.y)) <= 1
      && actorFrustum.intersectsSphere(actorEnvelope);
    if (!a.world.visible) continue;
    // 脚下垫一块软影，没有太阳的地方也站得住。
    if (!a.blob) { a.blob = new T.Mesh(blobGeo, blobMat); a.blob.rotation.x = -Math.PI / 2; a.blob.renderOrder = 1; a.world.add(a.blob); }
    a.blob.visible = e.alive || e.deathAge < 0.9;
    const hop = e.y - e.base;
    a.blob.position.y = 0.05 - hop; a.blob.scale.setScalar(e.radius * 3.4 * (1 - Math.min(0.5, hop * 0.6)));
    const drawFuzz = distance < 8.5;
    if (a.drawFuzz !== drawFuzz) {
      a.drawFuzz=drawFuzz;
      a.model.traverse(m => { if (m.userData.fuzz) m.visible = drawFuzz; });
    }
    updateEnemy(e, a, e.id === healthFocus);
    if (e.type === 'boss-warden') wardenLook(e, a, dt);
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
    // 擦到会动的布景（吊灯、地球仪、骨架、小黄鸭、盆栽）：它动一下，响一声
    const touched = world.eggProps.eggs.size ? null : world.toys.sweep(b, floorIndex(level, b.y - 1));
    if (touched) { sfx2({ lamp: 'ting', globe: 'knock', rattler: 'rattle', duck: 'squeak', plant: 'thump' }[touched.kind], { strength: 0.6 }); burst(b.x, b.z, 4, 0.4, 0xf6efe0, b.y); }
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
  weaponFeedback.sync(s);
  // 闹钟响着的时候一直有铃声
  if (s.gadgets.some(g => g.kind === 'clock' && g.used && s.time < g.until && Math.hypot(g.x - s.player.x, g.z - s.player.z) < 16) && performance.now() - lastRing > 430) { sfx2('ring', { strength: 0.7 }); lastRing = performance.now(); }
  for (const k of s.pickups) {
    const o = world.pickups.get(k.id);
    if (!o) continue;
    o.visible = !k.taken && !k.hidden;   // 藏在拉链暗格里的，拉开之前看不见
    if (!o.visible) continue;
    const distance = Math.hypot(k.x - s.player.x, (k.y ?? 0) - s.player.y, k.z - s.player.z);
    const label = o.userData.label;
    label.visible = distance < (k.kind === 'objective' ? 8 : 4);
    if (label.visible) {
      const scale = Math.min(1, Math.max(.35, distance / 3.7));
      label.scale.set(.72 * scale, .18 * scale, 1);
    }
    o.userData.body.rotation.y += dt * .85;
    o.position.y = o.userData.baseY + Math.sin(s.time * 2.2 + k.id) * .045;
  }
}
function clearModels() {
  combatFx.clear();
  weaponFeedback.clear();
  for (const a of enemyModels.values()) { cine.shadows.removeDynamic(a.world); a.world.removeFromParent(); a.dispose(); }
  enemyModels.clear();
  for (const o of ballModels.values()) { o.removeFromParent(); for (const m of o.userData.ownMaterials) m.dispose(); }
  ballModels.clear(); fx.length = 0; effects.clear();
}

// ---------- 事件 → 反馈 ----------

let reloadReadyUntil = -1;
const attackNotices = { shielded: '盾冲 · 横移', archer: '红线定住后横移', bomber: '离开炸弹落点',
  crawler: '扑抓 · 拉开距离', 'boss-warden': '远离震地圈', 'boss-leech': '被吸引时侧移' };
function amusementEvent(e) {
  const L = inputLabels(), sw = t(L.switch), ex = t(L.exchange);
  const messages={
    'lock-frozen':[`门栓冻住 3.5 秒 · 按 ${sw} 切手枪击碎它`,`Latch frozen 3.5s · Press ${sw} for pistol to shatter it`],
    'lock-thaw':['门栓化冰了 · 再用急冻枪冻住它','Latch thawed · Freeze it again'],
    'lock-block':['摇摆太快 · 先用急冻枪冻住门栓','Moving too fast · Freeze the latch first'],
    'lock-open':['门栓碎了 · 急冻僵尸再切手枪碎冰','Latch shattered · Freeze zombies, then shatter with pistol'],
    'valve-frozen':[`阀门冻住了 · 到木马台阶前按 ${ex} 摇铃`,`Valve frozen · Press ${ex} at the carousel steps to ring the bell`],
    'valve-block':['用急冻枪堵住蒸汽','Use the freeze ray to plug the steam'],
    'ice-sweep':['冰雕扫碎！','Ice sweep!'],
    'spin':['木马转起来了 · 把僵尸引到气浪里','The carousel is turning · Lure zombies into the shockwaves'],
    'target-frozen':[`轨道靶定住了 · 切手枪或补一发点亮`,`Target frozen · Shoot to lock it lit`],
    'target-lit':['轨道靶点亮！','Coaster target lit!'],
    'balloon-pop':['砰！彩球爆开！','Pop! Confetti burst!'],
    'gate-open':['这一站的灯亮了 · 门开了，沿小径去下一站','This stop is lit · The gate is open'],
    'clown-start':['嬉笑小丑登场！按开火键可跳过过场','Giggles arrives! Press fire to skip'],
    'clown-intro-end':['踩落稳的惊喜盒腾空打面具，或先用急冻枪定住他','Bounce from a box to break the mask, or freeze him first'],
    'mask-block':['要踩惊喜盒弹到空中打面具','Bounce from a box to hit the mask'],
    'mask-hit':['面具裂开一层','One layer of the mask cracked'],
    'mask-break':['面具碎了 · 现在可以直接打小丑，急冻地砖可保命','Mask broken · Attack Giggles, freeze warning tiles for safety'],
    'clown-frozen':['小丑冻住了 · 趁现在反击！','Giggles is frozen · Strike now!'],
    'clown-resist':['小丑暂时抗冻','Giggles is briefly frost-resistant'],
    'tile-frozen':['地砖冻牢了 4 秒！','Floor tile frozen solid for 4s!'],
    'clown-down':[`小丑倒下了 · 靠近舞台中央按 ${ex} 拾取高压马达`,`Giggles is down · Press ${ex} to collect the motor`],
    'motor':['拿到了高压马达 · 全园彩灯亮起！','Motor recovered · The whole park lights up!'],
  };
  if (e.action==='zone-enter') zoneCarry = { zone: e.zone, ...checkpointCarry(s) };   // 进这一段时身上几瓶血瓶、地上哪些捡过了：从这里重来时照这个摆
  const message=messages[e.action];
  if (message) say(copy(...message),e.action==='clown-start'||e.action==='motor'?3.2:1.85,1);
  if (['lock-frozen','valve-frozen','ice-sweep','tile-frozen','clown-frozen','target-frozen'].includes(e.action)) {
    effects.spark({x:e.x,y:e.y,z:e.z},0x9be7ff,.95); sfx2('china');
  } else if (e.action==='balloon-pop') {
    burst(e.x,e.z,16,.9,0xf4be59,e.y); effects.spark({x:e.x,y:e.y,z:e.z},0xff8272,.9); sfx2('jack-pop');
  } else if (['spring','lock-open','spin','gate-open','motor','target-lit'].includes(e.action)) {
    if (e.action==='gate-open' || e.action==='motor') burst(e.x??0,e.z??0,24,1.6,0xffd67a,(e.y??1.2)+1);
    sfx2(e.action==='spring'?'jack-pop':'bell');
  } else if (['mask-break','mask-hit','clown-hit'].includes(e.action)) {
    hitMarkerTime=.19;hitMarkerKind=e.action==='mask-break'?'heavy':'';
    sfx2(e.action==='clown-hit'?'thump':'china');
  } else if (e.action==='clown-start') sfx2('gong');
  else if (e.action==='boxes' || e.action==='volley') sfx2('throw');
  else if (e.action==='firework-impact' || e.action==='fall') sfx2('thump');
}

function processEvents() {
  let strongest = null;
  for (const e of consumeEvents(s)) {
    const near = (r) => Math.hypot(e.x - s.player.x, e.z - s.player.z) < r && Math.abs((e.base ?? s.player.y) - s.player.y) < 2;
    const base = e.base ?? 0;
    if (e.type==='freeze-beam') { spawnFreezeBeam(e.x0,e.y0,e.z0,e.x1,e.y1,e.z1); continue; }
    if (e.type==='amusement') { amusementEvent(e); continue; }
    if (e.type==='enemy-frozen') { effects.spark(e,0x9be7ff,.9);sfx2('china');continue; }
    if (e.type === 'park') { parkEvent(e); continue; }
    const returnHit=receipts?.event(e,gardenShieldId);
    thread?.event(e,s.time);
    if(polished && e.type==='blocked'){lastBlock=s.time;effects.ring(e,0xbedcec,.67,.20);sfx2('shield-pad');}
    if(polished && e.type==='guard-break'){effects.ring({...e,y:e.base+.95},0xf3c764,1.15,.32);sfx2('shield-open');}
    if(polished && e.type==='bounce' && e.solid?.id===GARDEN_BOARD){
      effects.ring(e,0xaaf4dd,.72,.26);sfx2('board-note',{pan:Math.sin(yaw)*.4});
    }
    if(polished && returnHit){
      effects.ring({x:e.contactX,y:e.contactY,z:e.contactZ},0xffd786,1.0,.32);
      sfx2('return-hit');
    }
    combatFx.event(e);
    if(e.type==='wave-start'){
      sfx('switch');
      say(copy(`第 ${e.index + 1} 波来了`,`Wave ${e.index + 1} incoming`),1.4,1);
    }
    else if(e.type==='blocked'){if(near(9)){say('盾挡了 · 绕后或蓄力破盾',1.7);if(!polished)sfx('switch');}}
    else if(e.type==='guard-break'){say('盾已破',1);if(!polished)sfx('kill');}
    else if(e.type==='attack-windup'){if(near(11))say(attackNotices[e.enemyType],1.2,1);}
    else if(e.type==='summoned'){if(near(12)){burst(e.x,e.z,12,.5,0xbaa5c2,.5);say('援兵出来了 · 优先击破召唤源',1.2);}}
    else if(e.type==='sealed'){say(copy('封住 '+e.count+' 只援兵', 'Summons blocked: '+e.count),1.2);}
    else if(e.type==='bomb-thrown'){if(near(12))sfx('arrow');}
    else if(e.type==='bomb-land'){if(near(10))say('炸弹落地 · 离开红圈',.9,1);}
    else if(e.type==='enemy-shot'){if(near(12))sfx('arrow');}
    else if(e.type==='enemy-shot-impact'){burst(e.x,e.z,4,.4,0xd4a588,e.y);}
    else if(e.type==='yarn-blast'){burst(e.x,e.z,30,1.8,0xd5b58a,.7);sfx('kill');}
    else if(e.type==='ground-slam'){shake=Math.max(shake,.018);burst(e.x,e.z,20,1.3,0xe0c58e,.15);sfx('kill');}
    else if(e.type==='drain'){say('被吸取了 · 侧移或找掩体',1.2);}
    else if (e.type === 'weapon') { reloadReadyUntil = -1; say(WEAPONS[e.weapon].name, 1); syncWeapon(); sfx2('swap'); }
    else if (e.type === 'exchange') {
      // 换枪：地上那一格变成放下的那把
      world.refreshPickup(s.pickups.find(k => k.id === e.id)); sfx2('weapon'); effects.ring({ x: e.x, y: e.base + 0.8, z: e.z }, 0xffe08a, 1.6, 0.4);
      const kept = WEAPONS.find(w => w.id === e.weapon).name;
      const dropped = WEAPONS.find(w => w.id === e.dropped).name;
      say(copy(`换成${kept} · ${dropped}放在这儿了`,`Equipped ${kept} · Dropped ${dropped}`),1.6);
    }
    else if (e.type === 'reload') { reloadReadyUntil = -1; sfx('switch'); }
    else if (e.type === 'reloaded') { reloadReadyUntil = s.time + .65; sfx('switch'); }
    else if (e.type === 'dry') {
      const weapon=WEAPONS.find(w=>w.id===e.weapon);
      say(weapon.kind === 'grenade'
        ? weapon.name+copy('用完了 · ',' is empty · ')+t(inputLabels().grenade)+copy(' 切换炸弹',' switch throwable')
        : weapon.name+copy('打空了 · 换回手枪',' is empty · Back to pistol'), 1.4);
      sfx('switch');
    } else if (e.type === 'net-contact') {
      burst(e.x,e.z,8,.9,0xc2f6ff,e.y);effects.ring(e,0x8ee9fa,.8,.25);sfx2('crackle');
    } else if (e.type === 'zap') {
      const hitCount=e.struck.length;
      say(hitCount ? copy(`电网定住 ${hitCount} 只 · ${inputLabels().switch} 换枪追击`,
        `Net caught ${hitCount} · ${t(inputLabels().switch)} switch weapons`) :
        copy('电网落空 · 瞄准靠在一起的僵尸','Net missed · Aim between nearby zombies'),1.6);
    } else if (e.type === 'explode') {
      const jack=e.weapon==='jack', bucket=e.source==='bucket';
      const distance=Math.hypot(e.x-s.player.x,e.z-s.player.z);
      const accent=jack?0xffbf86:0xd2b0f3;
      if(jack) weaponFeedback.burst(e,s.time);
      const strength = Math.min(1.2,6/Math.max(3,distance));
      if (bucket) {
        sfx2('splash',{strength}); sfx2('clang',{strength:strength*.65,delay:.16});
        burst(e.x,e.z,10,.75,0xf2a6b8,e.y);
      } else {
        effects.ring(e,accent,e.radius*1.55,.32);
        sfx2(jack?'jack-pop':'steamer-open',{strength});
        for (const color of [accent,0xf6efe0]) burst(e.x,e.z,16,jack?2.75:1.7,color,e.y+.15);
        if (distance<9) shake=Math.max(shake,jack?.033:.012);
        const effect = jack ? copy('小丑盒弹击','Jack-in-the-box') : copy('蒸笼绒网','Steamer net');
        say(effect+(e.struck.length ? copy(` · ${e.struck.length} 只受伤`,` · ${e.struck.length} hit`) : copy(' · 没打中',' · Missed')),1.35);
      }
    }
    else if (e.type === 'interrupted') say('打断了攻击！', 0.8);
    else if (e.type === 'pounce') { if (near(6)) sfx('switch'); }
    else if (e.type === 'alert') { if (near(9)) sfx('hurt'); }
    else if (e.type === 'hop') { sfx2('thump', { strength: 0.18 }); }
    else if (e.type === 'hop-land') { burst(s.player.x, s.player.z, 3, 0.16, 0xeadbb9, s.player.y + 0.04); sfx2('thump', { strength: 0.3 }); }
    else if (e.type === 'land') { if (near(5)) burst(e.x, e.z, e.enemyType === 'heavy' ? 5 : 2, 0.16, 0xb8c2a4, base + 0.04); }
    else if (e.type === 'footstep' && near(6) && ['heavy','shielded','boss-warden'].includes(e.enemyType)) {
      sfx2('thump', { strength: e.enemyType === 'boss-warden' ? .56 : .25 });
    }
    else if (e.type === 'shot') {
      if (e.thrown) { sfx2('throw'); say(WEAPONS[s.grenade].short + ' ×' + grenades(s), .75); continue; }
      if(e.weapon==='sewing') lastPress=s.time;
      reloadReadyUntil = -1;
      const w = WEAPONS.find(v => v.id === e.weapon), light = e.weapon === 'sewing';
      kickRecoil(recoil, feelOf(e.weapon), light ? -2.2 : e.weapon === 'stun' ? -1 : e.power);   // 负的力度 = 更轻的一下
      burst(e.x, e.z, e.weapon === 'scatter' ? 12 : e.weapon === 'heavy' ? 10 : light ? 1 : 4, e.weapon === 'heavy' ? 0.85 : 0.45, w.color, e.y ?? 0.8);
      // 枪口闪光：一小团光，顺带把周围照亮一下；越重的枪越大
      effects.muzzle(e, e.weapon === 'stun' ? 0x9fdcff : 0xffe2b0, e.weapon === 'heavy' ? 1.1 : e.weapon === 'scatter' ? 0.8 : light ? 0.32 : 0.5, e.weapon === 'heavy' ? 9 : light ? 2.5 : 5);
      if (e.weapon === 'sewing') sfx2('staple'); else if (e.weapon === 'needle') sfx2('needle'); else if (e.weapon === 'stun') sfx2('zap'); else sfx('shot', { weapon: e.weapon, power: e.power });
    } else if (e.type === 'hit') {
      if (e.amount > 0 && e.source !== 'enemy-arrow') lastWounded = { id: e.id, until: s.time + 1.05 };
      if(e.source==='blast' && e.amount>0) weaponFeedback.damage(e,s.time);
      burst(e.contactX ?? e.x, e.contactZ ?? e.z, e.heavy ? 14 : e.weapon === 'scatter' ? 4 : 7, e.heavy ? 1.4 : 0.85, e.heavy ? 0xe6c5a8 : 0xe7ddbc, e.contactY ?? 0.75);
      // 命中光圈：带加成的更大、偏金色
      if (e.source === 'ball') effects.ring({ x: e.contactX ?? e.x, y: e.contactY ?? base + 0.8, z: e.contactZ ?? e.z }, e.back || e.sneak ? 0xffd27a : 0xfff0d8, e.heavy ? 1.2 : e.back || e.sneak ? 0.8 : 0.5, e.heavy ? 0.26 : 0.18);
      if (e.source === 'ball' && e.armored) say('护甲减伤 · 绕后或用毛衣针',1.5);
      else if (polished && returnHit) say(copy('回弹打中后背 · −','Bank shot to the back · −')+e.amount,1.35);
      else if (intro && introStage === 2 && e.afterSurface === GARDEN_BOARD) say('反弹命中！',1.4);
      if (!strongest || e.strength > strongest.strength) strongest = e;
    } else if (e.type === 'knockdown') {
      shake = Math.max(shake, e.weapon === 'heavy' ? 0.018 : 0.007); hitMarkerTime = 0.24; hitMarkerKind = 'kill'; sfx('kill', { weapon: feelOf(e.weapon) });
    } else if (e.type === 'bounce') {
      if (polished && (e.solid?.id===GARDEN_BOARD || e.kind==='enemy')) continue;
      if (performance.now() - lastBounceSound > 90) { sfx('bounce', { weapon: e.weapon }); lastBounceSound = performance.now(); }
      // 打在家具上：冒一团它那种颜色的绒絮，声音听得出是什么做的；会动的那几样（小黄鸭、盆栽、地球仪、骨架）动一下
      if (e.solid && e.solid.kind !== 'wall' && e.solid.kind !== 'lintel' && near(16)) {
        const stuff = stuffOf(e.solid);
        burst(e.x + (e.nx || 0) * 0.05, e.z + (e.nz || 0) * 0.05, stuff === 'soft' ? 9 : 5, stuff === 'soft' ? 0.7 : 0.5, e.solid.color ?? 0xd9c9a8, e.y);
        if (performance.now() - lastKnockSound > 70) { sfx2(SOUND_OF[stuff], { strength: Math.min(1, 4 / Math.max(2, Math.hypot(e.x - s.player.x, e.z - s.player.z))) }); lastKnockSound = performance.now(); }
        const moved = world.eggProps.eggs.size ? null : world.toys.react(e, -(e.nx || 0), -(e.nz || 0));
        if (moved) sfx2({ globe: 'knock', rattler: 'rattle', duck: 'squeak', plant: 'thump' }[moved.kind] ?? 'knock', { strength: 0.6 });
      }
    } else if (e.type === 'easter-egg') {
      const egg = world.eggProps.fire(e);
      if (egg && near(15)) {
        const strength = Math.min(.8,4/Math.max(3,Math.hypot(e.x-s.player.x,e.z-s.player.z)));
        sfx2(egg.sounds[0], { strength });
        sfx2(egg.sounds[1], { strength:strength*.75, delay:.24 });
      }
    } else if (e.type === 'gadget') {
      world.toys.fire(e);
      if (e.kind === 'clock') {
        sfx2('ring');
        effects.ring({ x:e.x, y:base+GADGETS.clock.h, z:e.z },0xffe3ac,1.7,.36,1);
      } else if (e.kind === 'spot') sfx2('flash');
      else if (e.kind === 'quilt') { sfx2('knock'); sfx2('flop',{delay:.14}); }
    } else if (e.type === 'quilt-land') {
      world.toys.land(e);
      sfx2('thump',{strength:.64});
      burst(e.x,e.z,10,.5,0xebd5b3,e.y+.17);
    } else if (e.type === 'emerge') {
      // 没出场的首领现身（任务物品拿齐的那一刻）：这句提示盖过"拿到了"
      emerging.set(e.id, { t: 0, time: e.time, done: false }); sfx2('rumble', { strength: 0.6 });
      burst(e.x, e.z, 30, 0.8, 0x2a2420, base + 1.4);   // 一团暗絮：眼睛先从里面亮出来
      say(TX.emerge || ENEMY_TYPES[e.enemyType].name+copy('出现了 · 快跑',' is awake · Get clear'), 3, 2);
    } else if (e.type === 'stash') {
      world.toys.unzip(e.id); sfx2('zip'); burst(e.sx, e.sz, 12, 0.7, 0xe9c46a, base + 1.2);
      say(copy('拉链里掉出了','Unzipped: ')+(e.kind === 'potion' ? copy('一瓶血瓶','a potion') : WEAPONS.find(w=>w.id===e.weapon)?.name ?? copy('弹药包','ammo')),1.5);
    } else if (e.type === 'ball-expired') {
      if (e.reason !== 'explode') burst(e.x, e.z, 4, 0.25, 0xeadbb9, e.y);
      if (e.weapon === 'needle' && e.reason === 'bounce-limit' && e.normal) {
        // 针扎在墙上：事件里的方向还是它飞来时的方向（碰到墙的这一帧还没来得及改）
        effects.stick(e, { x: e.dx, y: e.dy, z: e.dz }); sfx2('thunk', { strength: Math.min(1, 5 / Math.max(2, Math.hypot(e.x - s.player.x, e.z - s.player.z))) });
      } else if (e.reason === 'bounce-limit' || e.reason === 'range') effects.spark(e, 0xfff0d8, 0.35);
    }
    else if (e.type === 'pickup') {
      const tint = e.kind === 'potion' ? 0xed8790 : e.kind === 'ammo' ? 0x9cdbc0 : 0xeac474;
      burst(e.x, e.z, 14, .42, tint, base + .58);
      if (e.kind !== 'weapon') effects.ring({ x: e.x, y: base + .55, z: e.z }, tint, e.kind === 'objective' ? 1.15 : .70, .34);
      if (e.kind === 'weapon') { sfx2('weapon'); effects.ring({ x: e.x, y: base + 0.8, z: e.z }, 0xffe08a, 1.6, 0.4); } else sfx('switch');
      const got = WEAPONS.find(w => w.id === e.weapon);
      if (e.kind === 'objective') say(objectiveText(missionStatus(s)), 2.6, 2);
      else say(got?.kind === 'grenade' ? got.name+' +'+(e.amount??1)+' · '+t(inputLabels().throw)+copy(' 投掷',' throw')
        : e.kind === 'weapon' ? copy('捡到','Picked up ')+got.name+' · '+t(inputLabels().switch)+copy(' 换枪',' switch') : e.kind === 'potion' ? copy('捡到血瓶（','Potion (')+e.potions+' / '+CONFIG.maxPotions+copy('）· ',') · ')+t(inputLabels().potion)+copy(' 喝',' to drink')
        : (got?.name ?? '')+copy('弹药 +',' ammo +')+e.amount,1.4);
    } else if (e.type === 'drink') {
      sfx2('drink');
      say(copy('喝了一瓶血瓶 · ','Potion · ')+(amusement ? copy('生命 +','Health +')+e.healed : '♥ +'+e.healed)+copy(' · 还剩 ',' · ')+e.potions+copy(' 瓶',' left'), 1.5);
    } else if (e.type === 'hurt') {
      hurtFeedback(e);
      const low = s.potions > 0 && s.health > 0 && (amusement ? s.health <= 25 : s.health === 1);   // 血不多了、身上有瓶子：提醒一句怎么喝
      say(low ? copy('生命不多了 · 按 ','Low health · ')+t(inputLabels().potion)+copy(' 喝血瓶',' to drink a potion') : e.source === 'arrow' ? '被绒球箭击中！' : e.source === 'ground-slam' ? '震地！退离范围' : e.source === 'bomb-blast' || e.source === 'yarn-blast' ? '线团爆开了！' : e.source === 'leech-drain' ? '被吸取了！' : '被扑到了！拉开距离', low ? 2.4 : 1, low ? 1 : 0);
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

// ---------- 受伤 ----------
// 一次挨打回答三个问题（docs/fun-design.md 第 4 节）：挨打了吗（整屏边缘的玫红）、从哪边来的（那一侧更亮 + 一段指向来源的弧 +
// 从那一侧飞出来的棉絮）、还剩多少（碎掉的那颗心；只剩一颗时边缘持续脉动、有心跳声）。镜头只朝反方向轻轻偏一下，不抖。
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
function hurtFeedback(e) {
  // 来源相对镜头的方位：0 是正前方，正值在右边
  const vx = (e.fromX ?? s.player.x) - s.player.x, vz = (e.fromZ ?? s.player.z) - s.player.z;
  const a = Math.hypot(vx, vz) < 0.01 ? 0 : Math.atan2(vx * Math.cos(yaw) - vz * Math.sin(yaw), -vx * Math.sin(yaw) - vz * Math.cos(yaw));
  const side = $('hurtSide'), arc = $('hurtArc');
  side.style.setProperty('--hx', (50 + 50 * Math.sin(a)).toFixed(1) + '%'); side.style.setProperty('--hy', (50 - 50 * Math.cos(a)).toFixed(1) + '%');
  arc.style.setProperty('--a', (a * 180 / Math.PI).toFixed(1) + 'deg');
  restart($('hurtFrame'), 'damage'); restart(side, 'on'); restart(arc, 'on');
  cottonBurst(a);
  const k = reduced ? 0.25 : 1;
  hurtRoll = -0.035 * Math.sin(a) * k; hurtPitch = 0.022 * Math.cos(a) * k;   // 朝挨打的反方向偏一下
  sfx('hurt'); sfx2('ouch', { pan: Math.sin(a) * 0.6 });
}
// 棉絮：绒仔是布偶，挨打漏的是棉花。从挨打的那一侧屏幕边缘飞出几团，往里飘一小段再落下去，不到画面中间。
function cottonBurst(a) {
  const box = $('cotton'), W = innerWidth, H = innerHeight, unit = Math.min(W, H) / 100;
  const ex = W * (0.5 + 0.5 * Math.sin(a)), ey = H * (0.5 - 0.5 * Math.cos(a)), inX = W / 2 - ex, inY = H / 2 - ey, n = Math.hypot(inX, inY) || 1;
  for (let i = 0; i < (reduced ? 4 : 10); i++) {
    const el = document.createElement('i'), size = (2.4 + Math.random() * 3.8) * unit, spread = (Math.random() - 0.5) * 0.5;
    const x0 = ex - inY / n * spread * W - size / 2, y0 = ey + inX / n * spread * H - size / 2, go = (8 + Math.random() * 17) * unit;
    const x1 = x0 + inX / n * go + (Math.random() - 0.5) * 8 * unit, y1 = y0 + inY / n * go, fall = (6 + Math.random() * 12) * unit, turn = (Math.random() - 0.5) * 220;
    el.style.width = el.style.height = size + 'px'; box.appendChild(el);
    el.animate([
      { transform: `translate(${x0}px,${y0}px) scale(.35) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${(x0 + x1) / 2}px,${(y0 + y1) / 2}px) scale(1) rotate(${turn * 0.5}deg)`, opacity: 1, offset: 0.28 },
      { transform: `translate(${x1}px,${y1 + fall}px) scale(.8) rotate(${turn}deg)`, opacity: 0 },
    ], { duration: 950 + Math.random() * 650, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => el.remove();
  }
}
function clearHurt() {
  hurtRoll = hurtPitch = 0; lastHealth = -1; document.body.classList.remove('danger');
  for (const id of ['hurtFrame', 'hurtSide', 'hurtArc']) $(id).classList.remove('damage', 'on');
  $('cotton').replaceChildren();
}

// ---------- 瞄准与镜头 ----------

// 沿准星找到最近的东西（僵尸、墙、家具、场地边界），返回距离；枪口朝那一点开火。
function aim() {
  camera.updateMatrixWorld(true); camera.getWorldDirection(lookDir);
  const from = camera.position, far = sightEnd.copy(from).addScaledVector(lookDir, FAR);
  let distance = FAR, picked = null;
  for (const e of s.enemies) {
    if (!e.alive||!e.enabled) continue;
    const t = segmentCylinder(from.x, from.y, from.z, far.x, far.y, far.z, e.x, e.z, e.radius, e.y + 0.04, e.y + e.height);
    if (t !== null && t * FAR < distance) { distance = t * FAR; picked = e; }
  }
  for (const c of level.solids) { const h = segmentBox(from, far, c); if (h && h.t * FAR < distance) { distance = h.t * FAR; picked = null; } }
  if (amusement) for (const part of amusementTargets(s,WEAPONS[s.weapon].id==='freeze')) {
    const h=segmentBox(from,far,part);
    if (h && h.t*FAR<distance) { distance=h.t*FAR; picked=null; }
  }
  ray.set(from, lookDir);
  for (const egg of level.easterEggs) {
    const contact = segmentBox(from, far, egg);
    if (contact && contact.t * FAR < distance) { distance = contact.t * FAR; picked = null; }
  }
  const edge = ray.ray.intersectBox(aimBounds,boundaryHit);
  if (edge) { const d = edge.distanceTo(from); if (d < distance) { distance = d; picked = null; } }
  aimedEnemy = picked;
  target.copy(from).addScaledVector(lookDir, Math.max(0.18, distance));
  $('reticle').classList.toggle('target', !!picked);
  return distance;
}

// 实际枪口位置和方向；枪口伸进墙或家具时改从眼前发射，避免球生在实体里。
function shotParams(thrown = false) {
  cameraFrame(0);
  aim();
  const {kit, held}=viewmodel;
  const muzzle=kit.userData.variants[s.weapon].userData;
  const anchor=thrown?held:kit;
  if (thrown) localMuzzle.set(0,0,0);
  else localMuzzle.set(0,muzzle.muzzleY??0,muzzle.muzzleZ??kit.userData.muzzleZ);
  muzzleWorld.copy(anchor.localToWorld(localMuzzle)).sub(camera.position)
    .multiplyScalar(1/VIEWMODEL_SCALE).add(camera.position);
  const m=muzzleWorld, pad=.29;
  const blocked=level.solids.some(c=>segmentBox(camera.position,m,c,.035)
    || (m.x>c.minX-pad && m.x<c.maxX+pad && m.y>c.minY-pad && m.y<c.maxY+pad && m.z>c.minZ-pad && m.z<c.maxZ+pad));
  if (blocked || target.clone().sub(m).dot(lookDir)<.08 || !inBounds(level,m.x,m.z,.12))
    m.copy(camera.position).addScaledVector(lookDir,.02);
  const direction=target.clone().sub(m).normalize();
  return {origin:{x:m.x,y:m.y,z:m.z},direction:{x:direction.x,y:direction.y,z:direction.z}};
}

function cameraFrame(dt) {
    const cut = amusement && amusementCutscene(s);
    if (cut) {
      const p = cut.progress, smooth = reduced ? .6 : p * p * (3 - 2 * p);   // 系统设了减少动态效果：镜头停在一个机位不动
      camera.fov = HIP_FOV;
      camera.rotation.order = 'YXZ';
      if (cut.kind === 'clown-intro') {
        const cx = Math.sin(smooth * Math.PI) * 1.4, cy = 2.0 + Math.sin(smooth * Math.PI) * .6, cz = TENT_DOOR - 2.15 - smooth * 2.4;
        camera.position.set(cx, cy, cz);
        camera.lookAt(CLOWN.x, 2.55, CLOWN.z);
        yaw = 0; pitch = .08;
      } else {
        // 通关：镜头在帐篷门外慢慢升到帐顶上空，朝南看着园子里的灯一起亮起来（全程在帐篷外面，不穿帐布；只升不转）
        camera.position.set(Math.sin(smooth * Math.PI * .5) * 2.4, 4.6 + smooth * 8.4, TENT_DOOR + 2.25 - smooth * 5.0);
        camera.lookAt(0, 2.2 - smooth * 1.2, TENT_DOOR + 19.45 + smooth * 8);
      }
      viewmodel?.project(camera.fov, camera.aspect, false);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return;
    }
    const motion = reduced ? 0.25 : 1, bob = reduced ? 0 : Math.sin(phase * 2) * 0.006;
    // 毛衣针按住是举枪瞄准：镜头拉近
    const aiming = s.charging && WEAPONS[s.weapon].zoom ? Math.min(1, s.charge / 0.27) : 0;
    zoom += (aiming - zoom) * Math.min(1, dt * 19);
    const focalScale=1+(SCOPE_POWER-1)*zoom;
    camera.fov=scopeFieldOfView(HIP_FOV,focalScale) + recoil.fov.x * motion / focalScale;
    camera.rotation.order = 'YXZ';
    // 坐在设施上（准则第 3 节）：过山车带着镜头转（转速有上限、不滚转），玩家的转头叠加在上面；不加走路的起伏
    const seat = s.player.seat;
    const carried = seat && seat.yaw !== null;
    const viewYaw = carried ? seat.yaw + (yaw - rideYaw) : yaw;
    const viewPitch = Math.max(-0.9, Math.min(0.9, pitch + (seat ? seat.pitch : 0)));
    camera.rotation.set(viewPitch + recoil.camera.x * motion + hurtPitch, viewYaw, seat ? 0 : Math.sin(s.time * 49) * shake * motion + hurtRoll);
    camera.position.set(s.player.x + (seat ? 0 : Math.sin(s.time * 67) * shake * motion), s.player.y + s.player.jump + EYE + (seat ? 0 : bob + Math.sin(s.time * 59) * shake * 0.4 * motion), s.player.z);
    if (park) {   // 转得快的时候四周压一圈暗角，直行时没有
      rideVignette += ((seat ? Math.min(1, seat.turn / PARK.coaster.maxTurn) : 0) - rideVignette) * Math.min(1, dt * 4);
      $('rideVignette').style.opacity = (rideVignette * 0.62).toFixed(3);
    }
    viewmodel?.project(camera.fov,camera.aspect,zoom<.5);

  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  shake = Math.max(0, shake - dt * 0.6);
  const settle = Math.exp(-dt * 8); hurtRoll *= settle; hurtPitch *= settle;   // 挨打偏的那一下，约 0.4 秒回正
}

// ---------- HUD ----------

const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function challengeHud() {
  const run=s.challenge;
  const progress=`${challenge.unit} ${run.progress} / ${challenge.target}`;
  if ($('challenge-progress').textContent !== progress) $('challenge-progress').textContent=progress;
  $('challenge-clock').textContent=Math.max(0,Math.ceil(challenge.seconds-s.time))+copy(' 秒','s');
  const left=run.pulse ? run.pulse.expires-s.time : 0;
  $('challenge-window').hidden=left<=0 || mode!=='playing';
  if (left>0) $('challenge-window').textContent=copy(`定身 ${left.toFixed(1)} 秒`,`Stunned · ${left.toFixed(1)}s`);
}

function textOf(id, value) {
  const el = $(id);
  const localized = t(value);
  if (el.textContent !== localized) el.textContent = localized;
}

function objectiveText(status) {
  if (status.type !== 'fetch') return level.mission.title;
  if (status.carrying) return TX.carry || level.mission.title;
  if (status.needed > 1) return level.mission.title + ' · ' + status.collected + ' / ' + status.needed;
  return level.mission.title;
}

function describeAmmo(weaponIndex) {
  const { mag, reserve } = s.ammo[weaponIndex];
  return WEAPONS[weaponIndex].short + ' ' + mag + '/' + (reserve === Infinity ? '∞' : reserve);
}

function cottageStudyProgress() {
  if (!s.wave) {
    const left = aliveCount(s);
    return copy(`剩 ${left} / ${s.total} 只`,`${left} / ${s.total} left`);
  }
  const { index, nextAt } = s.wave, count = level.waves.count;
  if (nextAt !== null) {
    const seconds = Math.max(1, Math.ceil(nextAt - s.time));
    return copy(`下一波 ${seconds} 秒 · 换弹或走位`,`Next wave in ${seconds}s · Reload or move`);
  }
  const left = s.enemies.filter(enemy => enemy.alive && enemy.enabled).length;
  if (!left && index + 1 === count) return t('三波都打完了！');
  return copy(`第 ${index + 1} / ${count} 波 · 剩 ${left} 只`, `Wave ${index + 1} / ${count} · ${left} left`);
}

let shownLoadout;
function pauseBrief() {
  const status = missionStatus(s);
  textOf('pausePlace', level.texts?.short || level.name);
  textOf('objective',amusement?amusementObjective():objectiveText(status));
  textOf('pauseProgress', challenge
    ? challenge.unit + ' ' + s.challenge.progress + '/' + challenge.target + copy(' · 剩余 ',' · Time left ') + Math.max(0, Math.ceil(challenge.seconds - s.time)) + copy(' 秒','s')
    : cottageStudy ? cottageStudyProgress()
    : copy('剩余 ','Remaining ') + status.alive + '/' + status.total + copy(' · 用时 ',' · Time ') + clock(s.time));
  if ($('pauseDetailView').hidden) return;
  const second = secondOf(s), equipment = [describeAmmo(PISTOL)];
  if (second >= 0) equipment.push(describeAmmo(second));
  for (const index of GRENADE_TYPES) if (s.owned[index]) equipment.push(WEAPONS[index].short + ' ×' + grenades(s,index));
  const summary = equipment.join('\n');
  if (summary !== shownLoadout) {
    shownLoadout = summary;
    $('pauseLoadout').replaceChildren(...equipment.map(label => {
      const item = document.createElement('span');
      item.textContent = label;
      return item;
    }));
  }
}

let shownAmmo = '';
function ammoHud(active) {
  const weapon = WEAPONS[s.weapon], { mag, reserve } = s.ammo[s.weapon];
  const out = reserve === Infinity ? '∞' : String(reserve);
  const key = weapon.id + ':' + mag + ':' + out;
  if (shownAmmo !== key) {
    shownAmmo = key;
    textOf('ammoMag', String(mag)); textOf('ammoReserve', out);
    $('ammo').classList.toggle('low', mag === 0);
    $('ammo').setAttribute('aria-label', weapon.name + copy('，已装 ',', loaded ') + mag + copy('，备用 ',', reserve ') + out);
  }
  const showReload = active && (s.reloading || s.time < reloadReadyUntil);
  $('reloadStatus').hidden = !showReload;
  if (showReload) {
    textOf('reloadCaption', s.reloading ? copy('换弹中  ','Reloading · ') + (Math.ceil(s.reload * 10) / 10).toFixed(1) + copy(' 秒','s') : '装填完成');
    $('reloadProgress').hidden = !s.reloading;
    $('reloadProgress').value = s.reloading ? Math.max(0, 1 - s.reload / reloadTime(s,s.weapon)) : 1;
  }
}

function bossHud(active) {
  const clown=s.amusement?.clown;
  $('bossDetail').hidden=!(active && clown?.entered);
  if (clown) {
    $('bossHud').hidden=!active || !clown.entered || clown.defeatedAt!==null;
    if (!active || !clown.entered) return;
    textOf('bossName',copy('嬉笑小丑','Giggles'));
    textOf('bossDetail',clown.mask?copy('面具 '+clown.mask+'/2','Mask '+clown.mask+'/2'):copy('面具已碎','Mask broken'));
    $('bossFill').style.width=(100*clown.hp/CLOWN.hp)+'%';
    $('bossTrack').setAttribute('aria-valuemax',CLOWN.hp);
    $('bossTrack').setAttribute('aria-valuenow',clown.hp);
    return;
  }
  const boss = active ? s.enemies.find(e => e.alive && e.enabled && e.type.startsWith('boss-') &&
    floorIndex(level, e.base) === floorIndex(level, s.player.y) &&
    Math.hypot(e.x - s.player.x, e.z - s.player.z) < 18 &&
    (e.awareness === 'alert' || aimedEnemy === e)) : null;
  $('bossHud').hidden = !boss;
  if (!boss) return;
  textOf('bossName', ENEMY_TYPES[boss.type].name);
  $('bossFill').style.width = (100 * boss.hp / boss.maxHp) + '%';
  $('bossTrack').setAttribute('aria-valuemax', boss.maxHp);
  $('bossTrack').setAttribute('aria-valuenow', boss.hp);
}

// 上下车：黑一下再淡回来，不让人看见镜头从路上跳到座位上（准则 3.6）
function rideFade() {
  const el = $('rideFade');
  el.style.transition = 'none'; el.style.opacity = '1'; void el.offsetWidth;
  el.style.transition = 'opacity .5s ease'; el.style.opacity = '0';
}
function parkEvent(e) {
  if (e.what === 'board') {
    clearHeldInput(); rideYaw = yaw; pitch = 0; rideFade();
    sfx2(e.id === 'coaster' ? 'chain' : e.id === 'rapids' ? 'splash' : 'swap');
  }
  else if (e.what === 'alight') { clearHeldInput(); yaw = rideYaw; pitch = 0; rideFade(); }
  else if (e.what === 'start') { sfx2({ carousel: 'bell', rapids: 'splash', haunt: 'knock', portraits: 'bell', circus: 'gong', coaster: 'chain' }[e.id] || 'swap'); }
  else if (e.what === 'splash') sfx2('splash');
  else if (e.what === 'stall-start') {
    const stall = STALLS.find(stall => stall.id === e.id);
    const target = stallTarget(stall, stall.id === 'balloons' ? 2 : 1, 0);
    const dx = s.player.x - target.x, dz = s.player.z - stall.z;
    clearHeldInput(); yaw = Math.atan2(dx, dz);
    pitch = Math.atan2(target.y - s.player.y - EYE, Math.hypot(dx, dz));
    sfx2('bell');
  } else if (e.what === 'stall-leave') clearHeldInput();
  else if (e.what === 'stall-shot') sfx2('throw');
  else if (e.what === 'stall-hit') sfx2(e.id === 'ducks' ? 'squeak' : e.id === 'balloons' ? 'jack-pop' : 'thump');
  else if (e.what === 'stall-miss') sfx2('thump', { strength: .3 });
  else if (e.what === 'bump') { if (s.park.riding?.id === 'bumpers' || Math.hypot(e.x - s.player.x, e.z - s.player.z) < 9) sfx2('thump', { strength: Math.min(1, e.hard / 5) * (e.car === 0 && s.park.riding ? 1 : 0.45) }); }
  else if (e.what === 'complete') say(copy('演出结束，逛完了！','The show is over. That was the park!'), 2.4, 2);
}


const formatStallCount = (count, total) => count + ' / ' + total;
function stallHud(round) {
  $('stallHud').hidden = !round;
  const recent = round?.last && round.time - round.last.at < .85;
  $('stallFeedback').hidden = !recent;
  if (!round) return;
  const stall = STALLS.find(stall => stall.id === round.id);
  textOf('stallTitle', copy(stall.zh, stall.en));
  textOf('stallScore', copy('命中 ', 'Hits ') + formatStallCount(round.score, stall.targets.length));
  textOf('stallShots', copy('剩余 ', 'Throws ') + formatStallCount(round.left, STALL_SHOTS));
  textOf('stallHint', round.done ? copy('本局结束', 'Round complete')
    : inputLabels().fire + ' · ' + copy(stall.hintZh, stall.hintEn));
  textOf('stallFeedback', recent ? round.last.count ? '+' + round.last.count : copy('擦过了', 'Miss') : '');
}

function amusementObjective() {
  const a=s.amusement, c=a.clown, L=inputLabels(), sw=t(L.switch), ex=t(L.exchange), left=parkRemaining(s);
  const cut = amusementCutscene(s);
  if (cut) return cut.kind === 'clown-intro' ? copy('嬉笑小丑登场！','Giggles enters the ring!') : copy('全园彩灯重燃！','The whole park is lit!');
  const id=PARK_ZONES[a.zone].id, open=a.opened[a.zone]!==null, next=PARK_ZONES[a.zone+1];
  if (open && next) return copy('门开了 · 沿小径去'+next.name,'The gate is open · On to the '+next.en.toLowerCase());
  const riding=s.park.riding?.id;
  if (id==='entrance') return a.lock==='frozen' ? copy(`按 ${sw} 切手枪，趁化冰前击碎门栓`,`Press ${sw} for pistol and shatter the latch`) : copy('用急冻枪冻住拱门上左右滑的门栓','Freeze the latch sliding across the arch');
  if (id==='carousel') {
    if (!a.valveLatched && a.valveUntil<=s.time) return copy(`切急冻枪（${sw}），冻住木马旁漏气的蒸汽阀`,`Switch to the freeze ray (${sw}) and plug the leaking steam valve`);
    if (!a.carousel.used) return copy(`到木马台阶前按 ${ex} 摇铃`,`Press ${ex} at the carousel steps to ring the bell`);
    return a.carousel.until>s.time ? copy('把僵尸引到木马的气浪里 · 剩余 '+left,'Lure zombies into the shockwaves · '+left+' left') : copy('可以再摇一次铃，或直接击倒 · 剩余 '+left,'Ring again or finish them off · '+left+' left');
  }
  if (id==='rapids') return riding==='rapids' ? copy('坐稳了，漂完这一圈','Hold on for the lap') : copy(`到码头按 ${ex} 登船，漂一圈`,`Press ${ex} at the dock and ride a lap`);
  if (id==='coaster') {
    const lit=a.targets.filter(t=>t.lit).length, all=a.targets.length;
    if (riding==='coaster') return copy(`车上打亮轨道靶（${lit}/${all}）`,`Light the track targets as you ride (${lit}/${all})`);
    if (!a.done.coaster) return copy(`到站台按 ${ex} 上车，路上打亮两个轨道靶`,`Press ${ex} at the station; light two targets on the way`);
    if (lit<all) return copy(`打亮剩下的轨道靶（${lit}/${all}）· 在路上打，或再坐一趟`,`Light the remaining targets (${lit}/${all}) from the path, or ride again`);
    return copy('击倒站台边的僵尸 · 剩余 '+left,'Clear the zombies by the station · '+left+' left');
  }
  if (id==='haunt') return s.park.door>.9 ? copy(`进门厅，到小桌前按 ${ex} 摇铃`,`Step inside and press ${ex} at the little table`) : copy(`到鬼屋门口按 ${ex} 敲门`,`Press ${ex} at the haunted house door`);
  if (id==='wheel') return riding==='wheel' ? copy('坐稳了，转完这一圈','Hold on for the turn') : copy(`到摩天轮底下按 ${ex} 上吊舱，转一圈`,`Press ${ex} under the wheel and ride a turn`);
  if (id==='midway') return s.park.stall ? copy('打中一个就算赢','One hit wins') : copy(`挑一个游戏摊按 ${ex}，打中一个就算赢`,`Press ${ex} at any stall; one hit wins`);
  if (id==='bumpers') return riding==='bumpers' ? copy('开一会儿，想下车就按 '+ex,'Drive a while; press '+ex+' to get out') : copy(`到碰碰车场按 ${ex} 上车`,`Press ${ex} at the bumper cars`);
  if (id==='mirrors') return copy('穿过镜子迷宫，去马戏帐篷','Through the mirror maze to the big top');
  if (c.defeatedAt!==null) return copy(`靠近舞台中央按 ${ex} 拾取高压马达`,`Press ${ex} by the motor on stage`);
  if (!c.entered) return copy('走进马戏帐篷','Enter the big top');
  if (c.mask) return copy('急冻小丑或直接踩惊喜盒，腾空打碎面具','Freeze Giggles or bounce from a box to break the mask');
  return copy('急冻红圈预警地砖可保命，击败嬉笑小丑','Freeze warning tiles for cover and defeat Giggles');
}
function hud() {
  const active = mode === 'playing' && !paused && !awaitingApproach;
  const stall = park && active ? s.park.stall : null;
  stallHud(stall);
  $('fightHud').hidden = !active;
  $('missionHud').hidden = !(missionBriefing || cottageStudy) || !active;
  if (amusement && active) {
    const zone=PARK_ZONES[s.amusement.zone];
    $('missionHud').querySelector('strong').textContent=copy(zone.name,zone.en);
    textOf('missionStep',amusementObjective());
  } else if (cottageStudy && active) textOf('missionStep', cottageStudyProgress());
  else if (missionBriefing && active) {
    const status = missionStatus(s);
    textOf('missionStep', !status.carrying && TX.route ? t(TX.route) : objectiveText(status));
  }
  ammoHud(active && !stall);
  $('challenge-run').hidden = !challenge || !active;
  if (challenge && active) challengeHud();
  if (paused) pauseBrief();
  bossHud(active);

  const scoped = active && zoom > .5;
  $('scopeOverlay').hidden = !scoped;
  document.body.classList.toggle('scoped', scoped);
  textOf('statusEffect', active && s.pulledUntil > s.time ? '吸引中 · 侧移或找掩体' :
    active && s.slowUntil > s.time ? copy('缠线减速 · ','Tangled · ') + (s.slowUntil-s.time).toFixed(1) + copy(' 秒','s') : '');

  // 游乐园：走近设施，同一块提示牌上写"按 F 做什么"
  const ask = amusement && active ? amusementPrompt(s) : null;
  const offer = active && !stall ? offeredWeapon(s) : null;
  const offerKey = ask ? 'park:' + ask.id + ':' + ask.kind + ':' + inputMode : offer ? offer.id + ':' + offer.weapon + ':' + inputMode : '';
  if (offerKey !== offerShown) {
    offerShown = offerKey;
    $('swapPrompt').hidden = !offer && !ask;
    if (ask) $('swapPrompt').replaceChildren(keyBadge(inputLabels().exchange), ' ' + copy(ask.zh, ask.en));
    else if (offer) $('swapPrompt').replaceChildren(keyBadge(inputLabels().exchange), copy(' 换成',' Swap to ') + WEAPONS.find(w => w.id === offer.weapon).name);
  }

  $('hearts').hidden=amusement;
  $('playerHealth').hidden=!amusement;
  if (amusement) {
    $('playerHealthFill').style.width=s.health+'%';
    $('playerHealth').setAttribute('aria-valuenow',s.health);
    textOf('playerHealthValue',s.health+' / 100');
  }
  document.body.classList.toggle('park-boxed',amusement && active && !!s.amusement.trap);
  const hearts = Math.max(0, Math.min(CONFIG.maxHealth, s.health));
  if (hearts !== lastHealth) {
    [...$('hearts').children].forEach((el, i) => {
      el.className = 'heart ' + (i < hearts ? 'on' : 'off');
      if (i >= hearts && i < lastHealth && !reduced) restart(el, 'pop');
    });
    $('hearts').setAttribute('aria-label', hearts + copy(' 颗心',' hearts'));
    lastHealth = hearts;
  }
  $('potions').hidden = !hasPotions;
  const potionState = s.potions + inputMode;
  if (hasPotions && potionState !== potionShown) {
    const before = Number.parseInt(potionShown) || 0;
    [...$('potions').querySelectorAll('.potion')].forEach((el, i) => {
      el.className = 'potion ' + (i < s.potions ? 'on' : 'off');
      if (!reduced && (i < s.potions) !== (i < before)) restart(el, 'pop');
    });
    $('potionKey').replaceWith(Object.assign(keyBadge(inputLabels().potion), { id: 'potionKey' }));
    $('potions').classList.toggle('bar', amusement);
    $('potions').setAttribute('aria-label', copy('血瓶 ','Potions ') + s.potions + ' / ' + CONFIG.maxPotions);
    potionShown = potionState;
  }
  const danger = active && s.phase === 'playing' && (amusement?s.health<=25:hearts===1);
  document.body.classList.toggle('danger', danger);
  if (danger && performance.now() > nextBeat) { nextBeat = performance.now() + 1100; sfx2('beat', { strength: 0.8 }); }

  const inCharge = active && WEAPONS[s.weapon].id!=='freeze' && !s.reloading && (s.lobbing || (s.charging && s.charge > .085));
  $('charge').hidden = !inCharge;
  if (inCharge) {
    const progress = (s.lobbing ? s.lob : s.charge) / CONFIG.chargeTime;
    $('chargeFill').style.width = (progress * 100) + '%';
    $('charge').classList.toggle('full', progress > .95);
    const weapon = WEAPONS[s.weapon];
    const label = s.lobbing ? WEAPONS[s.grenade].short + copy(' · 松手投掷',' · Release to throw') :
      weapon.zoom ? (progress > .95 ? '瞄稳了 · 松手发射' : '瞄准中') :
      weapon.kind === 'zap' ? '松手发射电网' : progress > .95 ? '蓄满 · 松手发射' : '蓄力中';
    textOf('chargeLabel', label);
  }
  $('reticle').hidden = !active || !!stall?.done || (amusement && !!amusementCutscene(s));
  $('reticle').style.scale = 1 + Math.min(.35, recoil.back.x * .65);
  $('hitMarker').hidden = !active || hitMarkerTime <= 0;
  $('hitMarker').dataset.kind = hitMarkerKind;
  $('hitMarker').style.opacity = Math.min(1, hitMarkerTime * 18);
  $('hitMarker').style.scale = 1 + Math.min(.35, hitMarkerTime);
}

// 给浏览器验证用的只读快照。
function snapshot() {
  return {
    mode, paused, phase: s.phase, time: s.time, health: s.health, stars: s.stars, kills: s.kills, total: s.total, alive: aliveCount(s),
    weapon: WEAPONS[s.weapon].id, second: WEAPONS[secondOf(s)]?.id || null, grenades: grenades(s), offer: offeredWeapon(s)?.weapon || null, owned: WEAPONS.filter((w, i) => s.owned[i]).map(w => w.id), ammo: s.ammo.map(a => ({ mag: a.mag, reserve: a.reserve === Infinity ? 'inf' : a.reserve })), reloading: s.reloading,
    shots: s.shots, hits: s.hits, backHits: s.backHits, sneakHits: s.sneakHits, bounces: s.bounces,
    player: { x: s.player.x, y: s.player.y, z: s.player.z, jump: s.player.jump }, floor: floorIndex(level, s.player.y), carrying: s.carrying, yaw, pitch, room: roomAt(storeyAt(level, s.player.y), s.player.x, s.player.z)?.id,
    enemies: s.enemies.map(e => ({ id: e.id, type: e.type, frozenUntil: e.frozenUntil, enabled: e.enabled, reserveOf: e.reserveOf, guardBroken: e.guardBroken, actionAge: e.actionAge, cue: attackCue(e), model: enemyModels.get(e.id)?.nativeVariant || null, x: e.x, y: e.base, z: e.z, stun: e.stun, tangle: e.tangle, hp: e.hp, alive: e.alive, awareness: e.awareness, action: e.action })),
    amusement: amusement ? {zone:s.amusement.zone,lock:s.amusement.lock,opened:s.amusement.opened,valveLatched:s.amusement.valveLatched,valveUntil:s.amusement.valveUntil,mask:s.amusement.clown.mask,bossHp:s.amusement.clown.hp,maskHits:s.amusement.maskHits,iceHits:s.amusement.carousel.iceHits,pickedUp:s.amusement.pickedUp,done:s.amusement.done,lit:s.amusement.lit,targets:s.amusement.targets.map(t=>t.lit),entered:s.amusement.clown.entered} : undefined,
    park: park ? { riding: s.park.riding?.id ?? null, stall: s.park.stall, door: s.park.door } : undefined,
    level: level.id, enemyBombs: s.enemyBombs.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, landed: b.landed, fuse: b.fuse })), enemyShots: s.enemyShots.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, age: b.age })), slowUntil: s.slowUntil, pulledUntil: s.pulledUntil, neutralized: s.neutralized,
    balls: s.balls.length, pickups: s.pickups.filter(k => !k.taken).length, errors,
  };
}
function diagnostics() {
  if (ready) pinPrograms();
  $('diagnostics').dataset.state = JSON.stringify(snapshot());
  $('diagnostics').dataset.stats = JSON.stringify({ ...cine.stats(), tier: governor.tier, pixels: Math.round(governor.pixels), fpsTarget: governor.target, frameIntervalMs: frameIntervals.length ? frameIntervals.reduce((a, b) => a + b, 0) / frameIntervals.length : null, measurement: 'observed RAF intervals; not synchronized GPU benchmark' });
  $('diagnostics').dataset.ready = ready ? 'true' : 'false';
  if (q.has('debug')) $('diagnostics').textContent = `${cine.stats().quality} · ${cine.stats().calls} draws · ${s.balls.length} balls`;
}

// ---------- 流程 ----------

function start() {
  if (!ready) return;
  platformPlaying(false);
  frameIntervals.length = 0;
  if (mode !== 'loading') clearModels();
  clearHeldInput();
  paused = false; phase = 0; acc = 0; clearHurt();
  receipts?.reset();thread?.reset();lastBlock=-10;chargeCue=false;document.body.classList.remove('thread-tight');
  reloadReadyUntil = -1;
  zoom=0;lastPress=-Infinity;
  recoil = createRecoil(); hitMarkerTime = 0; hitMarkerKind = ''; shake = 0; yaw = level.player.yaw || 0; pitch = 0; Object.assign(gaze, { kind: null, home: 0, back: false, manual: false, mouse: 0 });
  aimedEnemy = lastWounded = null;
  toastUntil = toastPriority = 0; $('toast').textContent = '';
  for (const k of s.pickups) if (k.kind === 'weapon' && k.weapon !== level.pickups[k.id - 1].weapon) world.refreshPickup({ ...level.pickups[k.id - 1], id: k.id });   // 上一局换过的枪摆回原样
  const checkpoint=amusement && mode==='result' && s.phase==='lost' ? s.amusement.zone : requestedStage;
  if (zoneCarry?.zone !== checkpoint) zoneCarry = null;
  s = createGame({ level,amusementCheckpoint:checkpoint,carry:zoneCarry });
  amusementView?.update(s);
  if(weaponShowcase) for(const index of [...RANGE_GUNS.slice(1),...GRENADE_TYPES]) s.ammo[index].reserve=20;
  if(garden) gardenShieldId=s.enemies.find(e=>e.type==='shielded').id;
  awaitingApproach = !checkpoint && !challenge && !intro && (missionBriefing || cottageStudy || garden || trio || finalStudy || menuTrial);
  $('ready-actions').hidden = !awaitingApproach;
  document.body.classList.toggle('practice-ready',awaitingApproach);
  if(finalStudy || menuTrial) for(const e of s.enemies){
    if(menuTrial && e.type==='leaper') e.height=1.76;
    if(menuTrial && e.type==='bomber') { e.height=1.47; e.muzzle={side:.357572,y:.821297,forward:.503111}; }
  }
  if (trio) for (const enemy of s.enemies) {
    if (enemy.type === 'leaper') enemy.height = 1.76;
    if (enemy.type === 'heavy') enemy.height = 1.81;
    if (specialists && enemy.type === 'bomber') {
      enemy.height = 1.47;
      enemy.muzzle = {side: 0.357572, y: 0.821297, forward: 0.503111};
    }
  }
  mode = 'playing'; world.toys.reset(); world.eggProps.reset(); emerging.clear();
  document.body.classList.remove('menu', 'paused', 'result', 'leaving', 'loading');
  $('pausePanel').hidden = true; $('result').hidden = true; $('nextChapter').hidden = true;
  $('again').classList.add('primary');
  $('again').classList.remove('ui-return');
  introStage = intro ? 1 : 0;
  applyInputHints();
  platformPlaying(!awaitingApproach);
  if (viewmodel) viewmodel.root.visible = true;
  (awaitingApproach ? $('approach') : $('view')).focus(); unlock(); syncWeapon();
  if (weaponShowcase) say('武器试验场 · 暂停可查看操作', 2.1);
  else if (!awaitingApproach && !challenge && !intro) say(level.mission.title, 2.8, 1);
  updateModels(0);
}
function beginApproach() {
  awaitingApproach = false;
  platformPlaying(true);
  $('ready-actions').hidden = true;
  document.body.classList.remove('practice-ready');
  $('view').focus();
  unlock();
}
$('approach').onclick = beginApproach;
function releasePointer() {
  if (document.pointerLockElement === $('view')) document.exitPointerLock();
}
function setPause(value, fromFocus = false) {
  if (mode !== 'playing' || value === paused) return;
  paused = value;
  clearHeldInput();
  if (!fromFocus) platformPlaying(!paused && !awaitingApproach);
  introPrompt();
  if (viewmodel) viewmodel.ball.visible = false;
  document.body.classList.toggle('paused', paused); $('pausePanel').hidden = !paused;
  if (paused) {
    releasePointer();
    for (const actor of enemyModels.values()) if (actor.healthBar) actor.healthBar.visible = false;
    showPauseDetails(false);
  }
  else { last = performance.now(); (awaitingApproach ? $('approach') : $('view')).focus(); unlock(); }
}
function showResult() {
  mode = 'result'; platformPlaying(false); clearHeldInput();
  releasePointer(); introPrompt();
  document.body.classList.add('result');
  const won = s.phase === 'won';
  $('result').hidden = false; $('pausePanel').hidden = true;
  if (amusement) {
    $('resultTitle').textContent=won?copy('拿到了高压马达！','Motor recovered!'):copy('再试一次','Try again');
    $('resultNote').textContent=won?copy(`整座游乐园的灯都亮了！用时 ${clock(s.time)}`,`The whole park is lit! ${clock(s.time)}`):copy('满血满弹，从这一站的门口重来。','Retry from this stop with full health and magazines.');
    $('resultStars').hidden=true; $('resultStats').hidden=true;
    $('again').focus({preventScroll:true});
    return;
  }
  if (challenge) {
    $('resultTitle').textContent=t(won?'挑战完成':'挑战未完成');
    $('resultStars').hidden=true;
    $('resultStats').hidden=true;
    $('challenge-stamp').hidden=!won;
    $('challenge-stamp').textContent=challenge.stamp;
    const stamped=won && saveStamp(challenge.id);
    $('resultNote').textContent=won
      ? (stamped ? challenge.name+copy(' · 已在挑战簿盖章',' · Stamp earned') : challenge.name+copy(' · 本次达成，印章未能保存',' · Complete, but the stamp could not be saved'))
      : t(s.challenge.failure);
    $('again').focus({preventScroll:true});
    return;
  }
  $('resultTitle').textContent = t(won ? (crazyGames || cottageStudy || level.mission.type === 'fetch' ? TX.won : null) || '清空了！' : '被扑倒了');
  $('resultStars').hidden = !won;
  $('resultStars').textContent = won ? '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) : '';
  $('resultNote').textContent = won
    ? copy(`受伤 ${s.damageTaken} 次${s.damageTaken <= 1 ? ' ✓' : '（不超过 1 次得一星）'} · 用时 ${clock(s.time)}${s.time <= level.par ? ' ✓' : `（${clock(level.par)} 内得一星）`}`,
      `Hits taken: ${s.damageTaken}${s.damageTaken <= 1 ? ' ✓' : ' (one or fewer for a star)'} · ${clock(s.time)}${s.time <= level.par ? ' ✓' : ` (beat ${clock(level.par)} for a star)`}`)
    : s.carrying ? TX.lostCarrying : t('被发现的僵尸越多越危险：先打落单的，从背后下手。');
  if(receipts && !intro){
    const {blocks,breaks,returns}=receipts.counts;
    $('gardenReceipt').hidden=false;
    $('gardenReceipt').textContent=copy(`盾面挡弹 ${blocks}　蓄力破盾 ${breaks}　借墙打背 ${returns}`,`Blocks: ${blocks} · Shield breaks: ${breaks} · Banked back hits: ${returns}`);
  }
  $('rKills').textContent = `${s.kills}/${s.total}`; $('rTime').textContent = clock(s.time); $('rSneak').textContent = s.backHits + s.sneakHits;
  const next = won && !cottageStudy ? nextChapter(level.id) : null;
  const button = $('nextChapter');
  button.hidden = !next;
  if (next) {
    labelAction(button,inputLabels().confirm,'下一关');
    $('again').textContent = t('再来一次');
    $('again').classList.remove('primary');
    $('again').classList.add('ui-return');
    button.onclick = () => { location.href = playHref(next, 'campaign'); };
  }
  (next ? button : $('again')).focus({preventScroll:true});
}
function toMenu() { platformPlaying(false); releasePointer(); location.href = returnTo; }
const pauseOverviewOptions = ['resume','pauseRestart','pauseMenu','pauseDetailsOpen'];
const pauseDetailOptions = ['pauseDetailsBack',...(crazyGames ? [] : ['expand']),'sound'];
const pauseOptions = () => $('pauseDetailView').hidden ? pauseOverviewOptions : pauseDetailOptions;
function dialogOptions() {
  if (paused) return pauseOptions();
  if (awaitingApproach && ready) return ['approach','readyBack'];
  if (mode === 'result') return $('nextChapter').hidden ? ['again','back'] : ['nextChapter','again','back'];
  return [];
}
function moveDialogFocus(options, direction) {
  const current = options.indexOf(document.activeElement?.id);
  const next = current < 0 ? 0 : (current + direction + options.length) % options.length;
  $(options[next]).focus();
}
function markPauseFocus(index) {
  const options = pauseOptions();
  pauseIndex = index;
  for (const [i,id] of options.entries()) $(id).classList.toggle('selected',i===index);
}
function focusPause(index) {
  const options = pauseOptions();
  const selected = (index+options.length)%options.length;
  markPauseFocus(selected);
  $(options[selected]).focus({preventScroll:true});
}
function showPauseDetails(open, index = 0) {
  $('pauseOverview').hidden = open;
  $('pauseDetailView').hidden = !open;
  $('pauseDetailsOpen').setAttribute('aria-expanded',open);
  pauseBrief();
  $('pausePanel').scrollTop = 0;
  focusPause(index);
}
function backFromPauseDetails() {
  showPauseDetails(false,pauseOverviewOptions.indexOf('pauseDetailsOpen'));
}

// ---------- 输入：键盘 + 手柄，不需要鼠标 ----------

const HELD = ['w', 'a', 's', 'd', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
const DIALOG_DIRECTIONS = { arrowleft:-1, arrowup:-1, a:-1, w:-1, arrowright:1, arrowdown:1, d:1, s:1 };
$('view').addEventListener('contextmenu', e => e.preventDefault());
$('view').addEventListener('pointerdown', e => {
  unlock();
  if (!crazyGames || e.button !== 0 || e.pointerType !== 'mouse' || !ready || paused || awaitingApproach || mode !== 'playing') return;
  if (document.pointerLockElement !== $('view')) return;
  e.preventDefault();
  setInputMode('mouse');
  firePress('mouse');
});
if (crazyGames) {
  const mouseUnavailable = () => say('无法锁定鼠标 · 可用方向键和空格', 2.5);
  $('view').addEventListener('click', e => {
    if (e.button !== 0 || !ready || paused || awaitingApproach || mode !== 'playing' || document.pointerLockElement) return;
    $('view').focus({preventScroll:true});
    try { $('view').requestPointerLock()?.catch(mouseUnavailable); } catch { mouseUnavailable(); }
  });
  document.addEventListener('pointerlockerror', mouseUnavailable);
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === $('view');
    document.body.classList.toggle('locked',locked);
    if (locked !== hadPointerLock) clearHeldInput();
    if (locked) setInputMode('mouse');
    else if (hadPointerLock) {
      pointerReleasedAt = performance.now();
      if (mode === 'playing' && !paused) setPause(true);
    }
    hadPointerLock = locked;
  });
  document.addEventListener('mousemove', e => {
    if (mode !== 'playing' || paused || document.pointerLockElement !== $('view')) return;
    if (e.movementX || e.movementY) setInputMode('mouse');
    const sensitivity = .0024 / (1 + 3 * zoom);
    yaw -= e.movementX * sensitivity;
    pitch = Math.max(-.78,Math.min(.72,pitch - e.movementY * sensitivity));
    gaze.mouse += Math.abs(e.movementY * sensitivity);   // 鼠标上下挪了多少：攒够了才算玩家自己在看（见 advance 里的小丑战镜头）
    cameraFrame(0);
  });
  addEventListener('mouseup', e => {
    if (e.button === 0 && document.pointerLockElement === $('view')) fireRelease('mouse');
  }, true);
}   // 只用手柄开的局，点一下画面也能补上声音

// 键盘和手柄共用的动作。两个设备只负责把"按了什么"翻译成这里的一个调用。
function confirmAction(options = dialogOptions()) {
  if (!options.length) return;
  const focused = document.activeElement?.id;
  const selected = options.includes(focused) ? focused : options[paused ? pauseIndex : 0];
  $(selected).click();
}
function pauseAction() {
  if (mode !== 'playing') return;
  if (paused && !$('pauseDetailView').hidden) backFromPauseDetails();
  else setPause(!paused);
}
// 喝血瓶：喝不了的时候说一句为什么（没瓶子、满血）
function potionAction() {
  if (mode !== 'playing' || paused || !hasPotions) return;
  if (!drinkPotion(s) && s.phase === 'playing') say(s.potions ? copy('生命是满的，先留着','Health is full') : copy('身上没有血瓶','No potions'), 1.1);
  processEvents();
}
function reloadAction() {
  if (mode === 'result' || paused) start();          // 暂停或结算时是重开
  else if (mode === 'playing') { startReload(s); processEvents(); }   // 游戏中是换弹
}
function switchAction(index) {
  if (index < 0) { say('第二把枪还空着 · 屋里能捡到', 1.2); return; }
  if (selectWeapon(s, index)) { cancelFire(); processEvents(); }
}
function switchRangeGun(index) {
  if (index === PISTOL) { switchAction(index); return; }
  const previous=secondOf(s);
  s.owned[index]=true;
  switchAction(index);
  if(previous>=0 && previous!==index) s.owned[previous]=false;
}
function switchBomb() {
  if(selectGrenade(s)) { say(WEAPONS[s.grenade].name,1);sfx2('swap'); }
}
function throwAction(source) {
  if (throwInput || s.park?.stall) return;
  unlock();
  if (beginThrow(s)) throwInput = source;
  processEvents();
}
function exchangeAction() {
  unlock();
  if (amusement && canTakeGameplayInput() && useAmusement(s)) { cancelFire(); processEvents(); return; }
  if (exchangeWeapon(s)) cancelFire();
  processEvents();
}
function firePress(source) {
  if (amusement && amusementCutscene(s)) { if (skipAmusementCutscene(s)) processEvents(); return; }
  if (s.park?.stall) {   // 站在游戏摊前：开火键是投球
    if (!canTakeGameplayInput()) return;
    cameraFrame(0); camera.getWorldDirection(lookDir);
    if (fireStall(s, { origin: camera.position, direction: lookDir })) processEvents();
    return;
  }
  if (fireInput) return;
  fireInput = source;
  unlock(); beginCharge(s); processEvents();
}
function fireRelease(source) {
  if (fireInput !== source) return;
  fireInput = null;
  if (mode === 'playing' && !paused) releaseCharge(s, shotParams());
}
function throwRelease(source) {
  if (throwInput !== source) return;
  throwInput = null;
  if (mode === 'playing' && !paused) { releaseThrow(s, shotParams(true)); processEvents(); }
}
function jumpAction() { if (!s.park?.riding && !s.park?.stall && beginJump(s)) processEvents(); }

function cancelFire() {
  fireInput = null;
  keys.forget(' ');
  s.charging = false; s.trigger = false; s.charge = 0;
}
function cancelThrow() {
  throwInput = null;
  s.lobbing = false; s.lob = 0;
}
function resetSticks() {
  padAxes = neutralSticks;
  padNeedsNeutral = true;
}
function clearHeldInput() {
  keys.clear();
  cancelFire(); cancelThrow(); resetSticks();
}

const hasGameFocus = () => !document.hidden && document.hasFocus();
const canvasHasFocus = () => document.activeElement === $('view') || document.pointerLockElement === $('view');
const blocksKeyboard = e => e.metaKey || e.ctrlKey || e.altKey || e.isComposing
  || ['Meta','Control','Alt','AltGraph','Process'].includes(e.key);
const canTakeGameplayInput = () => ready && mode === 'playing' && !paused && !awaitingApproach
  && hasGameFocus() && canvasHasFocus();

addEventListener('keydown', e => {
  if (blocksKeyboard(e)) {
    // Browser shortcuts and IME can consume a held key's release.
    clearHeldInput();
    return;
  }
  const k = e.key.toLowerCase();
  if (document.pointerLockElement !== $('view') || k === ' ' || k.startsWith('arrow')) setInputMode('keyboard');
  unlock();   // 浏览器要一次真实按键才放出声音；手柄开的局按一下键盘也能补上
  const options = dialogOptions();
  if (options.length && Object.hasOwn(DIALOG_DIRECTIONS,k)) {
    e.preventDefault();
    moveDialogFocus(options,DIALOG_DIRECTIONS[k]);
    return;
  }
  if (options.length && k === 'enter' && (options.includes(e.target?.id) || !['BUTTON','A'].includes(e.target?.tagName))) {
    e.preventDefault();
    if (!e.repeat) confirmAction(options);
    return;
  }
  if (awaitingApproach && !paused && ready) {
    if (k === 'escape' && !e.repeat) { e.preventDefault(); toMenu(); }
    return;
  }
  if ((k === 'enter' || k === ' ') && ['BUTTON','A'].includes(e.target?.tagName)) return;
  if (HELD.includes(k) || k === 'enter') e.preventDefault();
  if (k === 'enter' && ready && !e.repeat) { confirmAction(); return; }
  if (k === 'escape' && !e.repeat) {
    if (mode === 'result') toMenu();
    else if (document.pointerLockElement === $('view')) setPause(true);
    else if (performance.now() - pointerReleasedAt > 180) pauseAction();
    return;
  }
  if (k === 'r' && !e.repeat && ready) { reloadAction(); return; }
  if (!canTakeGameplayInput()) return;
  const newPress = keys.press(e);
  if (k === 'shift') { if (!e.repeat) jumpAction(); return; }   // 蹦一下（不替代枪和走位）
  if(weaponShowcase && /^[1-6]$/.test(k)) { if(!e.repeat)switchRangeGun(RANGE_GUNS[Number(k)-1]);return; }
  // Q：在手枪和另一把之间换（1、2 也行）。E：投掷，G：切换炸弹，按住扔得更远。F：换脚边的枪。
  if (k === 'q' || k === '1' || k === '2') {
    if (e.repeat) return;
    const second = secondOf(s), index = k === 'q' ? (s.weapon === PISTOL ? second : PISTOL) : k === '1' ? PISTOL : second;
    switchAction(index);
    return;
  }
  if (k === 'e') {
    if (newPress) throwAction('keyboard');
    return;
  }
  if (k === 'g') { if (!e.repeat) switchBomb(); return; }
  if (k === 'h') { if (!e.repeat) potionAction(); return; }
  if (k === 'f') { if (!e.repeat) exchangeAction(); return; }
  if (k === ' ' && newPress) firePress('keyboard');
}, true);
addEventListener('keyup', e => {
  if (blocksKeyboard(e) || ((!e.code || e.code === 'Unidentified') && (!e.key || ['Unidentified','Dead'].includes(e.key)))) {
    clearHeldInput();
    return;
  }
  const action = keys.release(e);
  if (action === ' ') fireRelease('keyboard');
  if (action === 'e') throwRelease('keyboard');
}, true);

// ---------- 手柄 ----------
// PS5 DualSense 插上就能用：左摇杆走、右摇杆转向 / 抬头低头、R2 开火（按住蓄力）、
// L2 投掷（按住扔得更远），十字键下切换炸弹、R1 换弹、L1 换枪、□ 换地上的枪、十字键左右直接选两把枪、
// Options 暂停、✕ 确定 / 继续、○ 返回选图。摇杆和扳机是模拟量，轻推轻按有轻的效果。
let padHintTimer = 0;
function gamepadFrame() {
  const { axes, connected } = pad.poll();
  if (!connected) {
    if (padWasConnected) {
      padWasConnected = false; resetSticks();
      if (fireInput === 'gamepad') cancelFire();
      if (throwInput === 'gamepad') cancelThrow();
      setInputMode('keyboard'); say('手柄断开了 · 改用键盘', 1.6);
    }
    return;
  }
  const active = pad.anyPressed || Math.hypot(axes.x, axes.y) > 0.35 || Math.hypot(axes.lookX, axes.lookY) > 0.35;
  if (active) setInputMode('gamepad');
  if (!padWasConnected) { padWasConnected = true; say('手柄已连接 · 左摇杆走 · R2 开火', 2); }
  // 浏览器不把"按手柄"当成用户按键，声音可能还锁着。等一秒确认没开声，再提示一次（按键盘能解开）。
  if (sound && active && mode === 'playing' && !paused && !padSoundHint && !padHintTimer && (!audio || audio.state !== 'running')) {
    padHintTimer = setTimeout(() => {
      padHintTimer = 0;
      if (!sound || padSoundHint || !pad.connected || inputMode !== 'gamepad' || audio?.state === 'running') return;
      padSoundHint = true; say('浏览器要按一下键盘才放出声音 · 手柄照常能用', 2.6);
    }, 900);
  }

  // 确定 / 暂停 / 返回：暂停面板、结算、接敌提示里都能用
  const options = dialogOptions();
  const crossUsed = options.length && pad.pressed('cross');
  if (crossUsed) confirmAction(options);
  else if (options.length) {
    if (pad.pressed('left') || pad.pressed('up')) moveDialogFocus(options,-1);
    if (pad.pressed('right') || pad.pressed('down')) moveDialogFocus(options,1);
  }
  if (pad.pressed('options')) pauseAction();
  if (pad.pressed('circle')) {
    if (paused) pauseAction();
    else if (mode === 'result' || awaitingApproach) toMenu();
  }
  if (pad.pressed('r1') && ready) reloadAction();
  if (!canTakeGameplayInput()) return;
  // After a focus/pause boundary the old stick tilt cannot resume movement.
  if (padNeedsNeutral && !axes.x && !axes.y && !axes.lookX && !axes.lookY) padNeedsNeutral = false;
  if (!padNeedsNeutral) padAxes = axes;

  if (pad.pressed('cross') && !crossUsed) jumpAction();
  if (pad.pressed('l1')) switchAction(s.weapon === PISTOL ? secondOf(s) : PISTOL);
  if (pad.pressed('left')) switchAction(PISTOL);
  if (pad.pressed('right')) switchAction(secondOf(s));
  if (pad.pressed('down')) switchBomb();
  if (weaponShowcase && pad.pressed('triangle')) switchRangeGun(RANGE_GUNS[(s.weapon+1)%RANGE_GUNS.length]);
  else if (pad.pressed('triangle')) potionAction();
  if (pad.pressed('square')) exchangeAction();
  if (pad.pressed('r2')) firePress('gamepad');
  if (pad.released('r2')) fireRelease('gamepad');
  if (pad.pressed('l2')) throwAction('gamepad');
  if (pad.released('l2')) throwRelease('gamepad');
}
function losePlayFocus() {
  if (mode === 'playing' && !paused) setPause(true, true);
  else clearHeldInput();
}
addEventListener('blur', losePlayFocus);
addEventListener('focus', clearHeldInput);
addEventListener('pagehide', clearHeldInput);
addEventListener('pageshow', event => { if (event.persisted) clearHeldInput(); });
$('view').addEventListener('blur', clearHeldInput);
$('view').addEventListener('pointercancel', clearHeldInput);
document.addEventListener('fullscreenchange', clearHeldInput);
document.addEventListener('compositionstart', clearHeldInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (q.has('test')) clearHeldInput();
    else losePlayFocus();
  }
});
if (!crazyGames) $('expand').onclick = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); };
$('again').onclick = start;
for (const id of [...pauseOverviewOptions,...pauseDetailOptions]) $(id).addEventListener('focus',() => {
  const index = pauseOptions().indexOf(id);
  if (index >= 0) markPauseFocus(index);
});
$('pauseDetailsOpen').onclick = () => showPauseDetails(true);
$('pauseDetailsBack').onclick = backFromPauseDetails;
$('pauseMenu').onclick = toMenu; $('readyBack').onclick=toMenu; $('pauseRestart').onclick=start; $('resume').onclick = () => setPause(false); $('back').onclick = toMenu;
$('sound').onclick = () => {
  sound = !sound; preferences.sound=sound; writePreferences(preferences); $('sound').textContent = t(sound ? '声音 开' : '声音 关'); $('sound').setAttribute('aria-pressed', sound);
  if (sound) unlock();
};

// ---------- 主循环 ----------

// 推进一段游戏时间：固定 1/120 秒步长，画面帧率不影响结果。
function advance(dt) {
  keys.expireMotion();
  const turn = 1 / (1 + 3 * zoom);   // 4× 下保留可操作的微调速度
  yaw += ((keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0)) * dt * 1.15 * turn;
  pitch = Math.max(-0.78, Math.min(0.72, pitch + ((keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0)) * dt * 0.85 * turn));
  // 右摇杆：平方一下让中间更好细瞄，推满时比方向键快一点
  const {lookX, lookY} = padAxes;
  yaw -= lookX * Math.abs(lookX) * dt * 2.6 * turn;
  pitch = Math.max(-0.78, Math.min(0.72, pitch - lookY * Math.abs(lookY) * dt * 1.9 * turn));
  // 小丑战：镜头自己低头看地、弹起来时对着面具（准则 3.12）。只动俯仰、有转速上限；玩家自己上下看了就听玩家的
  // （方向键、右摇杆一动就算；鼠标要挪够 0.12 弧度才算，手抖不算）。低头前的角度记在 home 里，地上的东西过去以后转回去。
  const want = amusement ? clownGaze(s) : null, kind = want?.kind ?? null;
  if (kind !== gaze.kind) {
    if (!gaze.kind && !gaze.back) gaze.home = pitch;
    gaze.back = !kind && gaze.kind === 'down' && !gaze.manual;
    gaze.kind = kind; gaze.manual = false; gaze.mouse = 0;
  }
  if (keys.has('arrowup') || keys.has('arrowdown') || Math.abs(lookY) > .25 || gaze.mouse > .12) { gaze.manual = true; gaze.back = false; }
  const gazeTo = want && !gaze.manual ? want.pitch : gaze.back ? gaze.home : null;
  if (gazeTo !== null) {
    const gap = gazeTo - pitch, most = Math.min(GAZE.rate, Math.abs(gap) * 6 + .05) * dt;   // 快到的时候放慢，不是一下停住
    pitch = Math.abs(gap) <= most ? gazeTo : pitch + Math.sign(gap) * most;
    pitch = Math.max(-0.78, Math.min(0.72, pitch));
    if (!want && Math.abs(gap) <= most) gaze.back = false;
  }
  cameraFrame(0); camera.getWorldDirection(lookDir);
  const side = ((keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)) + padAxes.x;
  const forward = ((keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0)) - padAxes.y;
  const move = cameraMove(side, forward, yaw);
  const input = { x: move.x, z: move.z, aimX: lookDir.x, aimY: lookDir.y, aimZ: lookDir.z };
  if (s.trigger) input.shot = shotParams();   // 连发枪：每一发都从当前的枪口出去
  acc += dt;
  while (acc >= 1 / 120) { step(s, 1 / 120, input); acc -= 1 / 120; }
  stepRecoil(recoil, dt); hitMarkerTime = Math.max(0, hitMarkerTime - dt);
  processEvents();
  if (intro && advanceGardenIntro(s)) { introStage++; introPrompt(); }
  updateBankGuide();
  cameraFrame(dt); updateModels(dt); updateFx(dt); effects.update(dt);
  thread?.update(s.balls,s.time);
  if(polished){
    const ready=s.charging && s.charge >= .12+.6*(CONFIG.chargeTime-.12);
    if(ready && !chargeCue)sfx2('thread-tight');
    chargeCue=ready;
    document.body.classList.toggle('thread-tight',ready);
  }
}
function resize() { cine?.resize(); }
addEventListener('resize', resize);

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = now - last, dt = Math.min(0.05, elapsed / 1000);
  last = now;
  if (!ready) return;
  govern(now, elapsed);
  if (!hasGameFocus() || (mode === 'playing' && !paused && !awaitingApproach && !canvasHasFocus())) clearHeldInput();
  else gamepadFrame();
  if (mode === 'playing' && !paused) { frameIntervals.push(elapsed); if (frameIntervals.length > 180) frameIntervals.shift(); }
  if (mode === 'playing' && !paused && !awaitingApproach && !window.__rb.hold) advance(dt);
  else cameraFrame(dt);
  if (performance.now() > toastUntil) $('toast').textContent = '';
  world.update(cine.uniforms.time.value);
  stepFreezeBeams(dt);
  tourView?.update(s, dt); amusementView?.update(s);
  if (tourView && amusementView) tourView.root.visible = !amusementView.inside;   // 在帐篷里打小丑：门帘合着，外面的园子看不见，整个不画
  world.setFloor(floorIndex(level, s.player.y));
  world.occlusion.update(camera.position, now / 1000);
  hud(); cine.frame(dt);
  if (++frameCount % 8 === 0) diagnostics();
}

// 载入画面后面，每种僵尸、每种毛线球各摆一个到镜头前，让着色器（身体、绒毛、配件、影子、球）在这时候编译，而不是第一次碰面、第一次开枪时。
// 这些画完就从场景里拿掉，但不释放：three 在最后一个用某个着色器的材质释放时会把着色器也删掉——
// 球落地就释放材质，不留一份的话，场上的球全落了地，下一枪又得现编一遍（Windows 上一次几十到上百毫秒）；僵尸死光一种、重开一局也一样。
const warmKeep = [];
function warmActors(kinds) {
  const ahead = camera.getWorldDirection(new T.Vector3()).setY(0).normalize(), side = new T.Vector3(-ahead.z, 0, ahead.x);
  const n = kinds.size + ballTemplates.length; let i = 0;
  const place = (o, y) => o.position.copy(camera.position).addScaledVector(ahead, 3).addScaledVector(side, (i++ - (n - 1) / 2) * 0.9).setY(camera.position.y + y);
  for (const k of kinds) {
    const a = actorBank(k).create(k); dressWalker(a, k, 1); world.light(a.world); place(a.world, -1.2);
    cine.shadows.addDynamic(a.world, () => true); cine.scene.add(a.world); warmKeep.push(a);
  }
  for (const tpl of ballTemplates) {   // 和 updateModels 里造球的做法一样
    const o = tpl.clone(true); o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } });
    world.light(o); place(o, -0.3); o.scale.setScalar(0.12); cine.scene.add(o); warmKeep.push({ world: o });
  }
  const fx = combatFx.samples(); place(fx, -0.8); fx.scale.setScalar(0.3); cine.scene.add(fx); warmKeep.push({ world: fx });
  combatFx.update(s, 0);   // 每只僵尸的攻击预告（圈、扇形、瞄准线）现在就建好，下面一起编
}
// 着色器一旦编过就一直留着：three 默认在最后一个用它的材质释放时删掉它，下回用到再现编——
// 球落地、预告圈消失、重开一局都会释放材质，于是同一个着色器反复编，每次卡一下（Windows 上一次几十毫秒）。
// 这里给每个编过的着色器多记一次引用，它就不会被删（一共六七十个，占不了多少）。动的是 three 的内部计数（WebGLProgram.usedTimes）。
function pinPrograms() {
  for (const p of cine.renderer.info.programs || []) if (!p.rongboyPinned) { p.rongboyPinned = true; p.usedTimes++; }
}
// 藏着的东西 compileAsync 不编：别的楼层、还没用上的特效（枪口闪光、爆炸光球、扎墙的针）、藏起来的配件。编的时候先全亮出来，编完原样藏回去。
// 灯不动：灯的数目一变，所有材质都得重编。
async function compileEverything() {
  const hidden = []; cine.scene.traverse(o => { if (!o.visible && !o.isLight) { hidden.push(o); o.visible = true; } });
  try { await cine.warmup(); } finally { for (const o of hidden) o.visible = false; }
}
export async function boot(sdkReady) {
  applyTexts();
  loadingProgress(18,park?copy('正在铺设游乐园小径…','Laying out the park…'):'正在加载毛绒模型…');
  const pack = garden ? 'garden-wall.glb'
    : crazyGames ? 'zombie-roster.glb'
    : finalStudy || (training && practiceType?.startsWith('boss-')) || challenge?.id==='dodge-arrows' ? 'final-trio.glb'
    : menuTrial ? modelPack(practiceType) : specialists ? 'second-trio.glb' : trio || challenge ? 'walker-trio.glb' : 'zombie-roster.glb';
  async function fetchPack(name) {
    const response = await fetch(name);
    if (!response.ok) throw new Error(copy('僵尸模型加载失败 · ','Could not load figures · ') + name);
    return new Uint8Array(await response.arrayBuffer());
  }
  // Download only the packs the selected map uses, including the boss that will appear later.
  const usesBosses = level.enemies.some(e => e.type.startsWith('boss-'));
  const downloads = Promise.all([fetchPack(pack), usesBosses && !crazyGames && pack !== 'final-trio.glb' ? fetchPack('final-trio.glb') : null]);
  // Attach a handler before yielding to the loading screen.
  downloads.catch(() => {});
  await paint();
  initRenderer();
  loadingProgress(42,'正在收拾房间…');
  await paint();
  const kit = extendWeaponKit(createWeaponKit(), WEAPONS);
  initWorld(kit);
  const [roster,bossRoster] = await downloads;
  loadingProgress(63,park?copy('正在摆放游乐设施…','Setting up the rides…'):'正在准备绒仔和毛绒伙伴…');
  await paint();
  const skin = !q.has('noskin');
  [actors, bossActors] = await Promise.all([
    loadFigurines({ zombies:roster }, { skin }),
    bossRoster && loadFigurines({ zombies:bossRoster }, { skin }),
  ]);
  const kinds = new Set([...s.enemies, ...s.dormant].map(enemy => enemy.type));
  for (const kind of kinds) actorBank(kind).prepare(kind);
  prepareNavigation(level);
  {
    viewmodel=createViewmodel(kit,ballTemplate.clone(true),GRENADE_TYPES.map(index=>({index,model:ballTemplates[index].clone(true)})));
    world.light(viewmodel.root);
    camera.add(viewmodel.root);
    viewmodel.equip(s.weapon);
    if (!q.has('nofront')) drawInFront(viewmodel.root);
  }
  cameraFrame(0); resize(); updateModels(0); amusementView?.update(s);
  loadingProgress(84,'正在准备第一帧…');
  await paint();
  warmActors(kinds);
  await compileEverything();
  cine.frame(1/60);
  await paint();
  cine.frame(1/60);
  for (const { world:object } of warmKeep) {
    cine.shadows.removeDynamic(object);
    object.removeFromParent();
  }
  pinPrograms();
  await paint();
  await sdkReady;
  ready = true;
  $('loading').hidden = true;
  platformReady();
  start();
  last = performance.now();
  governor.deferUpscale(last + 6500);
  performance.mark('rongboy:playable');
  window.__ready = true;
  diagnostics();
}
requestAnimationFrame(frame);


// 自动化验证入口：浏览器面板隐藏时 requestAnimationFrame 基本不跑，
// 所以提供同步推进和单帧渲染，按键也可以直接指定。
window.__rb = {
  get state() { return s; },
  get cine() { return cine; }, get world() { return world; }, get effects() { return effects; }, governor, pad,
  get inputMode() { return inputMode; }, get padInput() { return { side: padAxes.x, forward: -padAxes.y }; },
  gamepadFrame,
  hurt(fromX, fromZ) { hurtFeedback({ fromX, fromZ }); },
  interact() { if (amusement && useAmusement(s)) { cancelFire(); processEvents(); } return snapshot(); },   // 调试：按一下互动键（不看窗口有没有焦点）
  // 调试（自测脚本用）：看向世界里的一点；走真实的开火路径打一发（charge 秒是按住多久）；换到某把枪
  lookAt(x, y, z) { const p = s.player, ey = p.y + p.jump + EYE, dx = x - p.x, dz = z - p.z, seat = p.seat; yaw = Math.atan2(-dx, -dz) - (seat && seat.yaw !== null ? seat.yaw - rideYaw : 0); pitch = Math.max(-0.78, Math.min(0.72, Math.atan2(y - ey, Math.hypot(dx, dz)))); cameraFrame(0); return { yaw, pitch }; },
  shoot(charge = 0) { firePress('test'); for (let t = 0; t < charge; t += 1 / 60) advance(1 / 60); fireRelease('test'); processEvents(); return snapshot(); },
  fireDown() { firePress('test'); }, fireUp() { fireRelease('test'); processEvents(); },
  weapon(id) { const index = WEAPONS.findIndex(w => w.id === id); if (index >= 0) switchAction(index); return WEAPONS[s.weapon].id; },
  get tourView() { return tourView; },   // 调试：只演一遍受伤的画面，不扣心
  gunInFront: true,   // 调试：false 时手和枪照普通物体画（对比穿模用）
  hold: false,   // true 时不按真实时间推进，只由 advance() 推进，方便定点截图
  snapshot, start,
  get enemyModels() { return enemyModels; }, armProbes: ARM_PROBES, noArmTuck: false,   // 调试：noArmTuck 为 true 时不收手（对比用）
  advance(seconds, held = []) {
    keys.clear(); for (const k of held) keys.press({key:k});
    for (let t = 0; t < seconds; t += 1 / 60) advance(1 / 60);
    keys.clear(); hud(); diagnostics(); return snapshot();
  },
  press(key) { dispatchEvent(new KeyboardEvent('keydown', { key })); dispatchEvent(new KeyboardEvent('keyup', { key })); hud(); return snapshot(); },
  teleport(x, z, newYaw = yaw, newPitch = 0, floor = 0) { s.player.x = x; s.player.z = z; s.player.y = floor * SH; yaw = newYaw; pitch = newPitch; cameraFrame(0); return snapshot(); },
  render() { tourView?.update(s, 0); amusementView?.update(s); cameraFrame(0); if (mode !== 'playing') { animateViewmodel(0, false);  } else updateModels(0); world.setFloor(floorIndex(level, s.player.y)); world.occlusion.update(camera.position, performance.now() / 1000, true); hud(); cine.frame(1 / 60); return cine.stats(); },
  capture(quality = 0.8) { this.render(); return $('view').toDataURL('image/jpeg', quality); },
  // 渲染一帧并交给开发服务器存成 shots/<name>.jpg（面板隐藏时截图是旧帧，用这个看画面）。
  async shot(name, quality = 0.9) { cine.still = true; this.render(); const body = this.capture(quality); cine.still = false; await fetch('/__shot?name=' + encodeURIComponent(name), { method: 'POST', body }); return cine.stats(); },
};
