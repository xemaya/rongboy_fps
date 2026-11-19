// 后四把武器的声音：现场合成，不加载音频文件。前三把枪和命中、击倒的声音仍用工坊版的 sound.js。
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function createArsenalAudio(ctx) {
  const out = ctx.createGain(), limit = ctx.createDynamicsCompressor();
  out.gain.value = 0.7; limit.threshold.value = -12; limit.ratio.value = 5; out.connect(limit); limit.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), data = noise.getChannelData(0);
  let seed = 977;
  for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 4294967296 * 2 - 1; }
  const last = {};

  function play(kind, { strength = 1, pan = 0 } = {}) {
    const now = ctx.currentTime, gap = ['stitch','staple'].includes(kind) ? 0.05 : kind === 'crackle' ? 0.12 : 0;
    if (now - (last[kind] ?? -10) < gap) return;
    last[kind] = now;
    const at = now + 0.002, bus = ctx.createGain(), stereo = ctx.createStereoPanner();
    bus.gain.value = clamp(strength, 0.2, 1.3); stereo.pan.value = clamp(pan, -0.65, 0.65); bus.connect(stereo); stereo.connect(out);
    let end = at + 0.3;
    const tone = (delay, from, to, duration, volume, type = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = at + delay;
      o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + duration + 0.01); end = Math.max(end, t + duration + 0.03);
    };
    const hiss = (delay, duration, volume, freq, type = 'bandpass', q = 0.8) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = at + delay;
      src.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random() * 0.5, duration + 0.02); end = Math.max(end, t + duration + 0.03);
    };
    if (kind === 'shield-pad') {
      hiss(0,.075,.13,640); tone(0,155,65,.105,.12);
    } else if (kind === 'shield-open') {
      hiss(0,.10,.15,1750);tone(.025,350,185,.14,.12,'triangle');
    } else if (kind === 'board-note') {
      tone(0,665,540,.11,.12,'triangle');tone(.013,1050,840,.085,.045);
    } else if (kind === 'return-hit') {
      tone(0,510,620,.09,.09,'triangle');tone(.075,765,890,.14,.08);
    } else if (kind === 'thread-tight') {
      tone(0,320,670,.10,.065,'sine');
    } else if (kind === 'zap') {            // 噼啪一声：下滑的锯齿音 + 几下高频的碎响
      tone(0, 2100, 260, 0.2, 0.09, 'sawtooth'); tone(0.01, 3200, 900, 0.09, 0.05, 'square');
      for (const d of [0, 0.03, 0.07, 0.12, 0.17]) hiss(d, 0.035, 0.2, 5200 + Math.random() * 2000, 'highpass');
      tone(0.02, 120, 60, 0.22, 0.08);
    } else if (kind === 'crackle') { // 被电住的僵尸身上的细碎电火花
      hiss(0, 0.03, 0.07, 6000, 'highpass'); hiss(0.05, 0.02, 0.05, 7000, 'highpass');
    } else if (kind === 'stitch') {  // 缝纫机的一针：短促的"哒"
      hiss(0, 0.028, 0.2, 3000, 'bandpass', 1.6); tone(0, 760, 420, 0.035, 0.07, 'triangle'); tone(0.012, 190, 110, 0.04, 0.05);
    } else if (kind === 'staple') {
      hiss(0,.021,.22,2550,'bandpass',2);tone(0,630,290,.032,.13,'triangle');
      hiss(.031,.017,.09,3800,'bandpass',1.7);tone(.031,990,740,.027,.045,'triangle');
    } else if (kind === 'needle') {  // 针射出去：一声尖细的"咻"
      hiss(0, 0.16, 0.16, 4200, 'bandpass', 2.5); tone(0, 900, 2600, 0.11, 0.05); tone(0, 260, 120, 0.09, 0.09, 'triangle');
    } else if (kind === 'thunk') {   // 针扎进墙
      tone(0, 320, 110, 0.07, 0.12, 'triangle'); hiss(0, 0.04, 0.1, 1800); tone(0.03, 1400, 1100, 0.18, 0.02);
    } else if (kind === 'throw') {   // 把毛线团抛出去
      hiss(0, 0.2, 0.1, 900, 'bandpass', 0.7); tone(0, 240, 420, 0.14, 0.04);
    } else if (kind === 'boom') {    // 毛线团炸开：闷闷的一声，然后一把线散开
      tone(0, 150, 38, 0.5, 0.3); tone(0.005, 300, 70, 0.22, 0.12, 'triangle'); hiss(0, 0.4, 0.3, 700, 'lowpass');
      hiss(0.04, 0.5, 0.12, 2600, 'bandpass', 0.6); for (const d of [0.1, 0.16, 0.24, 0.33]) tone(d, 520 + Math.random() * 500, 300, 0.09, 0.025, 'triangle');
    } else if (kind === 'jack-pop') {
      tone(0,177,51,.25,.25);hiss(0,.16,.22,780,'lowpass');
      tone(.024,240,610,.13,.12,'triangle');tone(.10,830,425,.14,.075,'triangle');
    } else if (kind === 'steamer-open') {
      tone(0,130,60,.22,.19);hiss(.025,.22,.13,2550);
      for (const delay of [.045,.075,.106,.135]) tone(delay,710+delay*800,440,.10,.055,'triangle');
    } else if (kind === 'ouch') {    // 挨打：闷的一下，加一声布撕开
      tone(0, 170, 62, 0.22, 0.3); tone(0, 330, 140, 0.12, 0.1, 'triangle'); hiss(0.01, 0.16, 0.2, 2400, 'bandpass', 0.8); hiss(0.05, 0.22, 0.09, 5200, 'highpass', 0.7);
    } else if (kind === 'beat') {    // 只剩一颗心：咚、咚
      tone(0, 74, 46, 0.16, 0.22); tone(0.19, 66, 42, 0.18, 0.16);
    } else if (kind === 'swap') {    // 换枪：咔、嗒
      tone(0, 520, 360, 0.05, 0.08, 'triangle'); tone(0.07, 760, 620, 0.06, 0.07, 'triangle'); hiss(0, 0.05, 0.05, 3000, 'highpass', 0.7);
    } else if (kind === 'knock') {   // 毛球打在木头上：笃
      tone(0, 260, 150, 0.06, 0.13, 'triangle'); hiss(0, 0.025, 0.07, 1500, 'bandpass', 1.2);
    } else if (kind === 'thump') {   // 打在软垫上：噗
      tone(0, 120, 60, 0.1, 0.16); hiss(0, 0.1, 0.1, 500, 'lowpass');
    } else if (kind === 'ting') {    // 打在玻璃、灯罩上：叮
      tone(0, 2300, 2250, 0.32, 0.05); tone(0, 3450, 3400, 0.2, 0.025); hiss(0, 0.015, 0.05, 6000, 'highpass');
    } else if (kind === 'clang') {   // 打在铁皮上：当
      tone(0, 620, 600, 0.26, 0.07, 'square'); tone(0, 930, 905, 0.2, 0.04, 'triangle'); hiss(0, 0.03, 0.08, 2600, 'bandpass', 1.5);
    } else if (kind === 'tock') {    // 打在石台上：嗒
      tone(0, 420, 300, 0.035, 0.1, 'triangle'); hiss(0, 0.03, 0.09, 2400, 'bandpass', 1.4);
    } else if (kind === 'rattle') {  // 骨架模型：一串骨头磕在一起
      for (let i = 0; i < 7; i++) { tone(i * 0.035 + Math.random() * 0.01, 700 + Math.random() * 500, 500, 0.03, 0.06, 'triangle'); hiss(i * 0.035, 0.015, 0.05, 3200, 'bandpass', 2); }
    } else if (kind === 'squeak') {  // 小黄鸭：吱
      tone(0, 1100, 1900, 0.09, 0.09, 'square'); tone(0.09, 1900, 1300, 0.08, 0.06, 'square');
    } else if (kind === 'rumble') {  // 守墓巨像现身：一声越来越沉的低音
      tone(0, 78, 34, 1.5, 0.32); tone(0.25, 52, 28, 1.3, 0.22, 'triangle'); hiss(0, 1.2, 0.12, 180, 'lowpass');
    } else if (kind === 'ring') {    // 闹钟：一串很密的铃声
      for (let i = 0; i < 9; i++) { tone(i * 0.045, i % 2 ? 2100 : 1750, i % 2 ? 2080 : 1730, 0.05, 0.05, 'square'); tone(i * 0.045, 4200, 4100, 0.03, 0.02); }
    } else if (kind === 'flash') {   // 聚光灯：啪地一亮，嗡一声
      hiss(0, 0.03, 0.2, 3000, 'highpass'); tone(0, 180, 120, 0.5, 0.08, 'sawtooth'); tone(0.02, 1200, 2400, 0.25, 0.04);
    } else if (kind === 'zip') {     // 拉链拉开：一串越来越高的小齿声
      for (let i = 0; i < 12; i++) hiss(i * 0.022, 0.018, 0.12, 1800 + i * 320, 'bandpass', 3);
      tone(0.28, 880, 1320, 0.16, 0.05, 'triangle');
    } else if (kind === 'weapon') {  // 捡到一把新枪
      for (const [d, f] of [[0, 523], [0.09, 659], [0.18, 784], [0.28, 1047]]) tone(d, f, f * 0.99, 0.22, 0.06, 'triangle');
    }
    const cleanup = ctx.createConstantSource(); cleanup.offset.value = 0; cleanup.connect(bus); cleanup.start(at); cleanup.stop(end);
    cleanup.onended = () => { cleanup.disconnect(); bus.disconnect(); stereo.disconnect(); };
  }
  return { play };
}
