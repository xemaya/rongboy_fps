// 开场片的声音：配乐（MiniMax 生成的 mp3）+ 游戏里现成的合成音效 + 几个片子专用的小声音（呼噜、"嘘"、积木、感叹号）。
// 实时播放和离线混音（导出 mp4 时）用同一套：都是"到了某一刻，调一次 play(kind)"。
import { createWoolAudio } from '../rongboy-shooter-fps/sound.js';
import { createArsenalAudio } from '../rongboy-mission/sfx.js';

const WOOL = new Set(['shot', 'hit', 'kill', 'bounce', 'switch', 'hurt']);
const ARSENAL = new Set(['zap', 'crackle', 'boom', 'stitch', 'needle', 'thunk', 'throw', 'weapon']);

export function createOpAudio(ctx) {
  // 游戏里的两套音效各自直接接到 ctx.destination，音量是按"没有配乐"调的；片子里有配乐，所以让它们先过一个放大的旁路。
  // （量过第一版的混音：音效比配乐低二十分贝左右，热闹的段落里几乎听不见。）
  const sfxOut = ctx.createGain(); sfxOut.gain.value = 2.4; sfxOut.connect(ctx.destination);
  const shim = new Proxy(ctx, { get(t, k) { if (k === 'destination') return sfxOut; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
  const wool = createWoolAudio(shim), arsenal = createArsenalAudio(shim);
  const out = ctx.createGain(); out.gain.value = 1.3; out.connect(ctx.destination);
  const noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), a = b.getChannelData(0); let s = 977; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; a[i] = s / 2147483648 - 1; } return b; })();
  const tone = (t, from, to, dur, vol, type = 'sine') => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  };
  const hiss = (t, dur, vol, type, freq, q = 1, attack = 0.02) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 0.02);
    return g;
  };
  const custom = {
    // 呼噜：一吸（低低的颤音）一呼（一声细哨）
    snore(t, k) { for (let i = 0; i < 14; i++) tone(t + i * 0.055, 92 - i * 1.2, 74, 0.06, 0.16 * k * Math.sin((i + 1) / 15 * Math.PI), 'sawtooth'); hiss(t, 0.8, 0.05 * k, 'bandpass', 260, 2, 0.3); tone(t + 1.0, 520, 380, 0.55, 0.035 * k); },
    snort(t, k) { for (let i = 0; i < 5; i++) tone(t + i * 0.04, 120 - i * 6, 80, 0.05, 0.2 * k, 'sawtooth'); hiss(t, 0.25, 0.06 * k, 'bandpass', 400, 2); },
    pop(t, k) { tone(t, 620, 1240, 0.07, 0.22 * k); tone(t + 0.05, 1240, 990, 0.12, 0.12 * k); },
    shh(t, k) { hiss(t, 0.7, 0.07 * k, 'highpass', 4200, 0.7, 0.12); },
    step(t, k) { tone(t, 150, 85, 0.08, 0.25 * k); },
    charge(t, k) { tone(t, 180, 520, 3.3, 0.035 * k, 'triangle'); },
    knock(t, k) { tone(t, 760 + k * 300, 520, 0.05, 0.3 * k, 'triangle'); hiss(t, 0.04, 0.08 * k, 'highpass', 2500, 0.7, 0.002); },
    crash(t, k) { [0, 0.05, 0.11, 0.16, 0.24].forEach((d, i) => { tone(t + d, 620 + i * 130, 400, 0.06, 0.32 * k, 'triangle'); }); hiss(t, 0.3, 0.14 * k, 'lowpass', 1800, 0.7, 0.005); },
    squeak(t, k) { tone(t, 950, 1750, 0.09, 0.16 * k); tone(t + 0.09, 1750, 1100, 0.14, 0.14 * k); },
    // 结尾的四样：一声越来越沉的低音、眼睛亮起时很轻的一丝高音、巨像的脚步、最后那一下
    drone(t, k) { for (const [f, v] of [[46, 0.13], [69.5, 0.06], [92.6, 0.03]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.94, t + 4.6); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * k * 0.5, t + 2.6); g.gain.linearRampToValueAtTime(v * k, t + 4.5); g.gain.linearRampToValueAtTime(0, t + 4.62); o.connect(g); g.connect(out); o.start(t); o.stop(t + 4.7); } },
    shimmer(t, k) { for (const f of [1870, 1883, 2805]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022 * k, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.85); } },
    thud(t, k) { tone(t, 70, 34, 0.32, 0.32 * k); hiss(t, 0.12, 0.1 * k, 'lowpass', 300, 0.7, 0.004); },
    stab(t, k) { tone(t, 620, 1240, 0.07, 0.22 * k); tone(t, 90, 40, 0.4, 0.28 * k); hiss(t, 0.18, 0.1 * k, 'highpass', 3000, 0.7, 0.003); },
    gulp(t, k) { tone(t, 310, 180, 0.09, 0.25 * k); tone(t + 0.11, 220, 430, 0.08, 0.2 * k); },
  };
  return {
    play(kind, opts = {}) {
      if (WOOL.has(kind)) wool.play(kind, opts);
      else if (ARSENAL.has(kind)) arsenal.play(kind, opts);
      else if (custom[kind]) custom[kind](ctx.currentTime + 0.002, opts.strength ?? 1);
    },
    // 从曲子的 offset 秒开始放；返回"片子时间 0"对应的 ctx 时刻。when：指定开始的 ctx 时刻（离线混音时是 0）
    music(buffer, offset = 0, gain = 0.6, when = null) {   // 这首曲子本身录得很满（解码后峰值超过 1），压到 0.6 给音效留位置
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buffer; g.gain.value = gain; src.connect(g); g.connect(ctx.destination);
      const at = when ?? ctx.currentTime + 0.06; if (offset < buffer.duration) src.start(at, Math.max(0, offset));
      return { t0: at - offset, stop() { try { src.stop(); } catch {} } };
    },
  };
}
