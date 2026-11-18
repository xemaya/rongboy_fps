// Rongboy 开场片《嘘——》：每一帧都是游戏自己的引擎画的，用的是游戏里的场景、手办、枪和特效；播完（或按键跳过）进游戏主界面。
// 默认放的是事先逐帧渲好的 rongboy-op.mp4（scripts/op/export.sh 导出，和这个页面放在一起）：秒开，慢机器上也不卡。
// 找不到这个文件，或者网址带 ?live=1，就现场实时渲染（要先搭三张地图，等十几秒到半分钟；显卡不够快会自动降画质）。
//   ?live=1      实时渲染          ?t=<秒>  从这一刻开始     ?play=0  停在这一刻不放
//   ?export=1    固定 1920×1080 的画布（&w=<宽> 可改），不放声音，由 window.__film.render(t, dt) 逐帧驱动（导出用）
//   ?next=<页面>  播完去哪（默认 rongboy-mission.html?from=op）
import { QUALITY } from '../../cine-engine/engine/index.js';
import { createStage } from './stage.js';
import { createFilm, DURATION } from './film.js';
import { createTitle } from './title.js';
import { createOpAudio } from './audio.js';
import { poseZombie } from './puppet.js';
import { createGamepad } from '../rongboy-mission/gamepad.js';
import musicBytes from '../../assets/rongboy/op/music-musicbox.mp3';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const exporting = q.has('export'), autoplay = q.get('play') !== '0', wantLive = q.has('live') || exporting;
const video = $('film');
const pad = createGamepad();
const NEXT = q.get('next') || 'rongboy-mission.html?from=op';
const fail = err => { const msg = String(err?.stack || err); $('err').textContent = msg; $('gate').hidden = true; console.error(msg); };
addEventListener('error', e => fail(e.error || e.message));
addEventListener('unhandledrejection', e => fail(e.reason));

// 画面固定 16:9：分镜是按这个画幅构的图，窗口别的比例就上下或左右留黑
const view = $('view');
function fit() {
  if (exporting) { const w = Number(q.get('w')) || 1920; view.style.width = w + 'px'; view.style.height = w * 9 / 16 + 'px'; return; }   // &w=1280 出小一号的图（看静帧用）
  const w = Math.min(innerWidth, innerHeight * 16 / 9), h = w * 9 / 16;
  view.style.width = w + 'px'; view.style.height = h + 'px';
}
fit();

let stage, film, title, audio = null, ctx = null, sfx = null, music = null, musicBuffer = null;
let mode = 'loading', T = Math.max(0, Number(q.get('t')) || 0), last = 0, lastShot = null;
const sink = { sound: null };

// 渲染片子的 Tn 这一刻
function render(Tn, dt = 1 / 30) {
  const sh = film.evaluate(Tn, dt), cine = stage.cine;
  const cut = sh !== lastShot; lastShot = sh;
  if (sh.title) { title.draw(Tn - sh.T0); title.render(); return sh; }
  // 切镜头的第一帧不做时间上的平滑：曝光直接到位，不带着上一个镜头的亮度慢慢变
  const still = cine.still; if (cut) cine.still = true;
  cine.frame(dt, Tn);
  cine.still = still;
  return sh;
}

function finish() {
  if (mode === 'done') return;
  mode = 'done'; music?.stop(); ctx?.close?.(); video.pause();
  $('fade').classList.add('on');
  setTimeout(() => { location.href = NEXT; }, 380);
}
function start() {
  if (mode !== 'ready') return;
  mode = 'playing'; $('gate').hidden = true; $('skip').hidden = false;
  if (!stage) {
    video.currentTime = T;
    const playing = video.play();
    // 手柄按键不算浏览器的"用户操作"，带声音的片子可能被拦下来：退回等待，请玩家按一下键盘。
    playing?.catch?.(() => {
      mode = 'ready'; $('gate').hidden = false; $('skip').hidden = true;
      $('loading').hidden = true; $('press').hidden = false;
      $('press').innerHTML = '<b>按一下键盘开始</b>';
    });
    return;
  }
  if (ctx) {
    ctx.resume(); sfx = createOpAudio(ctx); sink.sound = (kind, opts) => { if (ctx.state === 'running') sfx.play(kind, opts); };
    if (musicBuffer) music = sfx.music(musicBuffer, T);
  }
  last = performance.now(); film.reset();
}
function frame(now) {
  requestAnimationFrame(frame);
  // 手柄：任意键开始 / 任意键跳过。和键盘一样，按下的那一帧才算（按住不会连跳）。
  pad.poll();
  if (mode === 'ready' && autoplay && pad.anyPressed) start();
  else if (mode === 'playing' && pad.anyPressed) finish();
  if (mode !== 'playing' || !stage) return;
  const prev = T;
  // 有声音就跟着声卡的钟走（画面和配乐不会越走越偏），没有就按帧间隔
  T = music && ctx.state === 'running' ? ctx.currentTime - music.t0 : T + Math.min(0.1, (now - last) / 1000);
  last = now;
  if (T >= DURATION) { finish(); return; }
  render(Math.max(0, T), Math.max(1 / 240, Math.min(0.1, T - prev)));
}

// 先试事先渲好的片子；能放就不用搭场景了
function tryVideo() {
  return new Promise(resolve => {
    const done = ok => { clearTimeout(timer); video.oncanplay = video.onerror = null; resolve(ok); };
    const timer = setTimeout(() => done(false), 6000);
    video.oncanplay = () => done(true); video.onerror = () => done(false);
    video.src = 'rongboy-op.mp4'; video.load();
  });
}
async function boot() {
  if (!wantLive && await tryVideo()) {
    view.hidden = true; video.hidden = false; video.onended = finish;
    mode = 'ready'; window.__ready = true; window.__op = { get state() { return { mode, T: video.currentTime, video: true }; }, start, finish };
    $('loading').hidden = true; $('press').hidden = false;
    return;
  }
  video.removeAttribute('src');
  stage = await createStage({ canvas: view, quality: QUALITY[q.get('q')], onError: fail, onProgress: what => { $('loading').textContent = '正在摆 ' + what + '…'; } });
  film = createFilm(stage, sink);
  title = createTitle(stage.cine.renderer);
  addEventListener('resize', () => { fit(); stage.cine.resize(); });
  stage.cine.resize();
  window.__cine = stage.cine;
  // 每个镜头先画一帧：把着色器和贴图都备好，正片切镜头时不卡
  $('loading').textContent = '正在对镜头…';
  for (const sh of film.SHOTS) { render((sh.T0 + sh.T1) / 2); await new Promise(r => setTimeout(r, 0)); }
  film.reset(); lastShot = null;
  const probe = name => { const [who, where] = name.split('.'), a = stage.current.cast[who]; if (!a || !a.world.visible) throw new Error('no ' + name); const p = a.world.position, h = a.height || 1.5; return [p.x, p.y + (where === 'head' ? h * 0.85 : where === 'chest' ? h * 0.55 : 0), p.z]; };
  window.__film = { duration: DURATION, fps: 30, shots: film.SHOTS.map(s => ({ ...s.cam, name: s.name, T0: s.T0, T1: s.T1, type: 'dolly' })), render, evaluate: Tn => film.evaluate(Tn), action: Tn => Tn, probe, film: Tn => Tn };
  window.__op = {
    stage, film, render, get state() { return { mode, T, audio: ctx?.state || 'none', fps: stage.cine.stats() }; }, start, finish,
    // 开发用：渲染某一刻并交给开发服务器存成 shots/<name>.jpg
    // 导出用：把配乐和全片的音效离线混成一条 44.1 kHz 立体声 WAV（base64），存在 window.__wav 里分段取
    async mixdown() {
      const cues = []; let now = 0; const live = sink.sound;
      sink.sound = (kind, opts) => cues.push({ T: now, kind, opts });
      film.reset(); for (let t = 0; t < DURATION; t += 1 / 60) { now = t; film.evaluate(t, 1 / 60); }
      sink.sound = live; film.reset(); lastShot = null;
      const sr = 44100, off = new OfflineAudioContext(2, Math.ceil(DURATION * sr), sr), mix = createOpAudio(off);
      mix.music(await off.decodeAudioData(musicBytes.buffer.slice(musicBytes.byteOffset, musicBytes.byteOffset + musicBytes.byteLength)), 0, undefined, 0);
      // 离线上下文只能在 128 个采样的整数倍上停下来：同一格里的音效一起发
      const slots = new Map();
      for (const c of cues) { const k = Math.max(1, Math.round(c.T * sr / 128)); if (!slots.has(k)) slots.set(k, []); slots.get(k).push(c); }
      for (const [k, list] of slots) off.suspend(k * 128 / sr).then(() => { for (const c of list) mix.play(c.kind, c.opts || {}); off.resume(); });
      const buf = await off.startRendering(), n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
      // 峰值超过 0.95 就整体压下来，不削波
      let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      const norm = peak > 0.95 ? 0.95 / peak : 1; if (norm < 1) for (let i = 0; i < n; i++) { L[i] *= norm; R[i] *= norm; }
      const wav = new DataView(new ArrayBuffer(44 + n * 4)), str = (o, t) => [...t].forEach((ch, i) => wav.setUint8(o + i, ch.charCodeAt(0)));
      str(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
      wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); str(36, 'data'); wav.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      const bytes = new Uint8Array(wav.buffer); let bin = '';
      for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
      window.__wav = btoa(bin);
      return { cues: cues.length, kinds: [...new Set(cues.map(c => c.kind))], length: window.__wav.length, peak: +peak.toFixed(3) };
    },
    // 穿模检查：把全片每 step 秒摆一遍，量每个在场角色身上每一块（头、帽子、身体、手臂、腿、枪）的包围盒
    // 有没有伸进墙、家具或别的角色里，机位有没有钻进实体。包围盒是轴对齐的，歪着的部件会量大一点，
    // 所以报出来的是"该去看一眼的地方"，不是定论。返回按镜头和对象合并的清单：[{ shot, who, into, from, to, depth }]。
    clipcheck(step = 0.1, slack = 0.04) {
      const THREE = stage.three, found = new Map();
      const note = (shot, who, into, Tn, depth) => { const k = shot + '|' + who + '|' + into, f = found.get(k); if (f) { f.to = Tn; f.depth = Math.max(f.depth, depth); } else found.set(k, { shot, who, into, from: Tn, to: Tn, depth }); };
      const inSolid = (b, c) => Math.min(b.max.x - c.minX, c.maxX - b.min.x, b.max.y - c.minY, c.maxY - b.min.y, b.max.z - c.minZ, c.maxZ - b.min.z);
      const inBox = (a, b) => Math.min(a.max.x - b.min.x, b.max.x - a.min.x, a.max.y - b.min.y, b.max.y - a.min.y, a.max.z - b.min.z, b.max.z - a.min.z);
      const partOf = m => { for (let n = m; n; n = n.parent) if (n.userData?.part) return String(n.userData.part).replace('CTRL / ', ''); return m.parent?.userData?.variants || m.parent?.parent?.userData?.variants ? 'gun' : 'part'; };
      film.reset();
      for (let Tn = 0; Tn < DURATION; Tn += step) {
        const sh = film.evaluate(Tn, step), set = stage.current;
        if (sh.title || sh.black) continue;
        const solids = set.level.solids, cast = [];
        for (const a of Object.values(set.cast)) {
          if (!a.world.visible) continue;
          a.world.updateMatrixWorld(true);
          const boxes = [];
          a.model.traverse(m => { if (!m.isMesh || m.userData.fuzz || !m.visible) return; for (let n = m; n && n !== a.model; n = n.parent) if (!n.visible) return; boxes.push({ box: new THREE.Box3().setFromObject(m), part: partOf(m) }); });
          cast.push({ a, boxes });
          const feet = a.world.position.y;
          for (const { box, part } of boxes) for (const c of solids) {
            if (c.kind === 'slab' && c.maxY <= feet + 0.3) continue;   // 脚下的楼板（猫腰、倒地时会量到）
            const d = inSolid(box, c);
            if (d > slack) note(sh.name, a.name + '.' + part, c.id || c.kind || 'box', Tn, d);
          }
        }
        for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) {
          let worst = 0;
          for (const p of cast[i].boxes) for (const q of cast[j].boxes) worst = Math.max(worst, inBox(p.box, q.box));
          if (worst > slack + 0.04) note(sh.name, cast[i].a.name, cast[j].a.name, Tn, worst);
        }
        const cam = stage.cine.camera.position;
        for (const c of solids) if (cam.x > c.minX - 0.06 && cam.x < c.maxX + 0.06 && cam.y > c.minY - 0.06 && cam.y < c.maxY + 0.06 && cam.z > c.minZ - 0.06 && cam.z < c.maxZ + 0.06) note(sh.name, '机位', c.id || c.kind || 'box', Tn, 1);
      }
      film.reset(); lastShot = null;
      return [...found.values()].map(f => ({ ...f, from: +f.from.toFixed(2), to: +f.to.toFixed(2), depth: +f.depth.toFixed(2) }));
    },
    // 查关卡布置：把三张地图里每只僵尸按出生的位置、朝向和状态（睡着 / 站岗）摆出来，量它身上每一块有没有伸进墙或家具里。
    // 关卡的碰撞半径比手办看上去窄（棉甲的胳膊、跃行者的头都比半径宽），所以碰撞上站得下的地方，画面上可能是嵌进去的。
    spawncheck(slack = 0.04) {
      const THREE = stage.three, out = [], alias = { runner: 'leaper', weaver: 'leaper', tank: 'heavy' };
      for (const [id, set] of Object.entries(stage.sets)) {
        stage.use(id, 0); stage.clearFrame();
        const byKind = {}; for (const a of Object.values(set.cast)) if (a.kind !== 'scout' && !byKind[a.kind]) byKind[a.kind] = a;
        for (const e of set.level.enemies || []) {
          const kind = alias[e.type] || e.type, a = byKind[kind] || byKind.walker; if (!a) continue;
          const y = (e.floor ?? 0) * set.level.storeyHeight, asleep = e.state === 'asleep';
          poseZombie(a, { x: e.x, z: e.z, y, heading: e.heading || 0, sleep: asleep ? 1 : 0 }); a.world.updateMatrixWorld(true);
          let worst = null;
          a.model.traverse(m => { if (!m.isMesh || m.userData.fuzz) return; const box = new THREE.Box3().setFromObject(m); let part = 'part'; for (let n = m; n; n = n.parent) if (n.userData?.part) { part = n.userData.part; break; }
            for (const c of set.level.solids) { if (c.kind === 'slab' && c.maxY <= y + 0.3) continue; const d = Math.min(box.max.x - c.minX, c.maxX - box.min.x, box.max.y - c.minY, c.maxY - box.min.y, box.max.z - c.minZ, c.maxZ - box.min.z); if (d > slack && (!worst || d > worst.depth)) worst = { depth: +d.toFixed(2), part, into: c.id || c.kind }; } });
          a.world.visible = false;
          if (worst) out.push({ level: id, type: e.type + (kind !== a.kind ? '（用跳跳的体型估）' : ''), at: [e.x, e.z], floor: Math.round(y / set.level.storeyHeight), state: e.state, ...worst });
        }
      }
      film.reset(); lastShot = null;
      return out;
    },
    async still(Tn, name, quality = 0.9) { stage.cine.still = true; film.reset(); lastShot = null; render(Tn); render(Tn, 1e-3); stage.cine.still = false; await fetch('/__shot?name=' + encodeURIComponent(name), { method: 'POST', body: view.toDataURL('image/jpeg', quality) }); return stage.cine.stats(); },
  };
  render(T);
  if (exporting) { $('gate').hidden = true; window.__ready = true; return; }
  try { ctx = new AudioContext(); musicBuffer = await ctx.decodeAudioData(musicBytes.buffer.slice(musicBytes.byteOffset, musicBytes.byteOffset + musicBytes.byteLength)); } catch (e) { console.warn('没有声音：' + e); ctx = null; }
  mode = 'ready'; window.__ready = true;
  $('loading').hidden = true; $('press').hidden = false;
  if (!autoplay) $('gate').hidden = true;
}

// 浏览器不让没按过键的页面出声，所以先等一下按键；放的时候任何键都是跳过
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (mode === 'ready' && autoplay) { e.preventDefault(); start(); }
  else if (mode === 'playing' && ['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); finish(); }
});
$('gate').addEventListener('click', () => { if (autoplay) start(); });
$('skip').addEventListener('click', finish);
requestAnimationFrame(frame);
boot().catch(fail);
