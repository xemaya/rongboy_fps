// 片名卡：一块米色毛毡，"RONGBOY" 一个字母一个字母缝上去，"绒仔"是右下角一块绣章。只有名字，没有别的字。
// 画在一张二维画布上，再作为一整屏的贴片盖在三维画面上面（这样导出 mp4 时也在画面里）。
import * as T from 'three';
import { clamp01, lerp, overshoot, seg, ease } from './puppet.js';

const W = 1920, H = 1080;
const INK = '#343e2d', RUST = '#aa6549', PAPER = '#f0e5ca', THREAD = '#fbf3dc';

export function createTitle(renderer) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = T.LinearFilter;
  const scene = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false })));

  // 毛毡的底纹：一次画好的细碎短纤维
  const felt = document.createElement('canvas'); felt.width = W; felt.height = H;
  {
    const f = felt.getContext('2d'); let s = 31; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 5200; i++) {
      const px = rnd() * W, py = rnd() * H, a = rnd() * Math.PI, l = 5 + rnd() * 12;
      f.strokeStyle = rnd() < 0.5 ? 'rgba(255,250,235,0.20)' : 'rgba(120,100,70,0.09)'; f.lineWidth = 1.2;
      f.beginPath(); f.moveTo(px, py); f.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); f.stroke();
    }
    const g = f.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(90,70,40,0)'); g.addColorStop(1, 'rgba(90,70,40,0.22)');
    f.fillStyle = g; f.fillRect(0, 0, W, H);
  }
  const mix = (a, b, k) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], k))).join(',')})`; };
  const round = (px, py, w, h, r) => { x.beginPath(); x.roundRect(px, py, w, h, r); };

  const WORD = 'RONGBOY', FONT = 'bold 232px Georgia, "Times New Roman", serif', GAP = 16;
  x.font = FONT;
  const widths = [...WORD].map(ch => x.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0) + GAP * (WORD.length - 1);
  // 每个字母缝上去的时刻（从片名开始算的秒数）
  const LETTER0 = 0.35, STEP = 0.13;
  const letterTimes = [...WORD].map((_, i) => LETTER0 + i * STEP);

  // "绒仔"布标：一块绣章。锁边是一圈密密的斜针脚，字是缎面绣（一道道平行的线），量过字的实际外框再摆，正好在布标正中。
  // （第二版是"圆角框 + 虚线 + 一行字"，字偏右下，也看不出是缝的。）
  const PW = 460, PH = 260, BW = 344, BH = 160, BR = 36;
  const patch = document.createElement('canvas'); patch.width = PW; patch.height = PH;
  {
    const p = patch.getContext('2d'); p.translate(PW / 2, PH / 2);
    const rr = (c, w, h, r) => { c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, r); };
    // 布面：铁锈红的底，细细的经纬线，上亮下暗
    rr(p, BW, BH, BR); p.fillStyle = RUST; p.fill();
    p.save(); p.clip();
    p.lineWidth = 1; for (let i = -BW / 2; i < BW / 2; i += 4) { p.strokeStyle = 'rgba(255,232,205,0.10)'; p.beginPath(); p.moveTo(i, -BH / 2); p.lineTo(i, BH / 2); p.stroke(); }
    for (let j = -BH / 2; j < BH / 2; j += 4) { p.strokeStyle = 'rgba(70,28,12,0.12)'; p.beginPath(); p.moveTo(-BW / 2, j); p.lineTo(BW / 2, j); p.stroke(); }
    const sh = p.createLinearGradient(0, -BH / 2, 0, BH / 2); sh.addColorStop(0, 'rgba(255,225,190,0.14)'); sh.addColorStop(1, 'rgba(60,20,8,0.16)'); p.fillStyle = sh; p.fillRect(-BW / 2, -BH / 2, BW, BH);
    p.restore();
    // 锁边：沿着外沿每隔几个像素一针，针脚斜着压过布边
    const pts = [], hw = BW / 2 - BR, hh = BH / 2 - BR, STEP_PX = 5.2;
    const line = (x0, y0, x1, y1, nx, ny) => { const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / STEP_PX); for (let i = 0; i < n; i++) pts.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n), nx, ny]); };
    const corner = (cx, cy, a0) => { const n = Math.round(BR * Math.PI / 2 / STEP_PX); for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * BR, cy + Math.sin(a) * BR, Math.cos(a), Math.sin(a)]); } };
    line(-hw, -BH / 2, hw, -BH / 2, 0, -1); corner(hw, -hh, -Math.PI / 2); line(BW / 2, -hh, BW / 2, hh, 1, 0); corner(hw, hh, 0);
    line(hw, BH / 2, -hw, BH / 2, 0, 1); corner(-hw, hh, Math.PI / 2); line(-BW / 2, hh, -BW / 2, -hh, -1, 0); corner(-hw, -hh, Math.PI);
    p.lineCap = 'round';
    pts.forEach(([px, py, nx, ny], i) => {
      const tx = -ny, ty = nx;
      p.strokeStyle = 'rgba(60,24,10,0.35)'; p.lineWidth = 5.6; p.beginPath(); p.moveTo(px - nx * 10 + tx * 3.4, py - ny * 10 + ty * 3.4 + 1.5); p.lineTo(px + nx * 6 - tx * 3.4, py + ny * 6 - ty * 3.4 + 1.5); p.stroke();
      p.strokeStyle = i % 2 ? '#fbf3dc' : '#e9dbb2'; p.lineWidth = 4.4; p.beginPath(); p.moveTo(px - nx * 10 + tx * 3.4, py - ny * 10 + ty * 3.4); p.lineTo(px + nx * 6 - tx * 3.4, py + ny * 6 - ty * 3.4); p.stroke();
    });
    // 字：先画成一块线的颜色，再在字的范围里排满斜着的针脚
    const txt = document.createElement('canvas'); txt.width = PW; txt.height = PH;
    const q = txt.getContext('2d'); q.translate(PW / 2, PH / 2);
    q.font = 'bold 98px "Yuanti SC", "PingFang SC", "Songti SC", "Noto Sans CJK SC", sans-serif'; q.textAlign = 'left'; q.textBaseline = 'alphabetic';
    const chars = ['绒', '仔'], ms = chars.map(ch => q.measureText(ch)), GAPC = 26;
    const ws = ms.map(m => m.actualBoundingBoxLeft + m.actualBoundingBoxRight), tw = ws[0] + ws[1] + GAPC;
    const asc = Math.max(...ms.map(m => m.actualBoundingBoxAscent)), desc = Math.max(...ms.map(m => m.actualBoundingBoxDescent));
    let cx0 = -tw / 2; q.fillStyle = THREAD;
    chars.forEach((ch, i) => { q.fillText(ch, cx0 + ms[i].actualBoundingBoxLeft, (asc - desc) / 2); cx0 += ws[i] + GAPC; });
    q.globalCompositeOperation = 'source-atop'; q.lineCap = 'butt';
    for (let d = -PW; d < PW; d += 4.6) {
      q.strokeStyle = 'rgba(150,112,64,0.42)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(d, -PH / 2); q.lineTo(d + PH * 0.42, PH / 2); q.stroke();
      q.strokeStyle = 'rgba(255,255,255,0.55)'; q.lineWidth = 1.3; q.beginPath(); q.moveTo(d + 2.3, -PH / 2); q.lineTo(d + 2.3 + PH * 0.42, PH / 2); q.stroke();
    }
    const tg = q.createLinearGradient(0, -asc / 2, 0, asc / 2); tg.addColorStop(0, 'rgba(255,255,255,0.18)'); tg.addColorStop(1, 'rgba(110,70,30,0.22)'); q.fillStyle = tg; q.fillRect(-PW / 2, -PH / 2, PW, PH);
    p.save(); p.shadowColor = 'rgba(55,20,8,0.7)'; p.shadowBlur = 3; p.shadowOffsetY = 3.5; p.drawImage(txt, -PW / 2, -PH / 2); p.restore();
  }

  // t：片名开始后的秒数；from：上一个镜头最后填满画面的那颗毛球的颜色
  const BASE = 548, PATCH_Y = 676;
  function draw(t, from = '#d6a789') {
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    x.fillStyle = mix(from, PAPER, ease(clamp01(t / 0.4))); x.fillRect(0, 0, W, H);
    x.globalAlpha = ease(clamp01(t / 0.4)); x.drawImage(felt, 0, 0); x.globalAlpha = 1;
    // 一圈缝线边
    const edge = ease(seg(t, 0.15, 0.9));
    if (edge > 0) { x.globalAlpha = edge; x.strokeStyle = '#b6a77d'; x.lineWidth = 5; x.setLineDash([26, 18]); round(46, 46, W - 92, H - 92, 34); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; }
    // RONGBOY：一个字母一下，落下来的时候冲过头再弹回
    x.font = FONT; x.textBaseline = 'alphabetic'; x.textAlign = 'center'; x.lineJoin = 'round';
    let px = W / 2 - total / 2;
    [...WORD].forEach((ch, i) => {
      const k = clamp01((t - letterTimes[i]) / 0.24), cx = px + widths[i] / 2; px += widths[i] + GAP;
      if (k <= 0) return;
      const sc = overshoot(k), dy = (1 - ease(k)) * -46;
      x.save(); x.translate(cx, BASE + dy); x.scale(sc, sc); x.rotate((i % 2 ? 1 : -1) * 0.012);
      x.fillStyle = 'rgba(70,55,30,0.22)'; x.fillText(ch, 5, 9);
      x.fillStyle = INK; x.fillText(ch, 0, 0);
      x.strokeStyle = THREAD; x.lineWidth = 4; x.setLineDash([13, 10]); x.strokeText(ch, 0, 0); x.setLineDash([]);
      x.restore();
    });
    // "绒仔"绣章：最后"啪"地按上去
    const kp = clamp01((t - 1.5) / 0.3);
    if (kp > 0) {
      const sc = overshoot(kp);
      x.save(); x.translate(W / 2 + total / 2 - 150, PATCH_Y); x.rotate(-0.06); x.scale(sc, sc);
      x.shadowColor = 'rgba(70,55,30,0.32)'; x.shadowBlur = 10; x.shadowOffsetX = 4; x.shadowOffsetY = 9;
      x.drawImage(patch, -PW / 2, -PH / 2);
      x.restore();
    }
    tex.needsUpdate = true;
  }
  function render() {
    renderer.setRenderTarget(null);
    const tm = renderer.toneMapping; renderer.toneMapping = T.NoToneMapping;
    renderer.render(scene, cam);
    renderer.toneMapping = tm;
  }
  return { draw, render, letterTimes };
}
