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
    const now = ctx.currentTime, gap = kind === 'stitch' ? 0.05 : kind === 'crackle' ? 0.12 : 0;
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
    if (kind === 'zap') {            // 噼啪一声：下滑的锯齿音 + 几下高频的碎响
      tone(0, 2100, 260, 0.2, 0.09, 'sawtooth'); tone(0.01, 3200, 900, 0.09, 0.05, 'square');
      for (const d of [0, 0.03, 0.07, 0.12, 0.17]) hiss(d, 0.035, 0.2, 5200 + Math.random() * 2000, 'highpass');
      tone(0.02, 120, 60, 0.22, 0.08);
    } else if (kind === 'crackle') { // 被电住的僵尸身上的细碎电火花
      hiss(0, 0.03, 0.07, 6000, 'highpass'); hiss(0.05, 0.02, 0.05, 7000, 'highpass');
    } else if (kind === 'stitch') {  // 缝纫机的一针：短促的"哒"
      hiss(0, 0.028, 0.2, 3000, 'bandpass', 1.6); tone(0, 760, 420, 0.035, 0.07, 'triangle'); tone(0.012, 190, 110, 0.04, 0.05);
    } else if (kind === 'needle') {  // 针射出去：一声尖细的"咻"
      hiss(0, 0.16, 0.16, 4200, 'bandpass', 2.5); tone(0, 900, 2600, 0.11, 0.05); tone(0, 260, 120, 0.09, 0.09, 'triangle');
    } else if (kind === 'thunk') {   // 针扎进墙
      tone(0, 320, 110, 0.07, 0.12, 'triangle'); hiss(0, 0.04, 0.1, 1800); tone(0.03, 1400, 1100, 0.18, 0.02);
    } else if (kind === 'throw') {   // 把毛线团抛出去
      hiss(0, 0.2, 0.1, 900, 'bandpass', 0.7); tone(0, 240, 420, 0.14, 0.04);
    } else if (kind === 'boom') {    // 毛线团炸开：闷闷的一声，然后一把线散开
      tone(0, 150, 38, 0.5, 0.3); tone(0.005, 300, 70, 0.22, 0.12, 'triangle'); hiss(0, 0.4, 0.3, 700, 'lowpass');
      hiss(0.04, 0.5, 0.12, 2600, 'bandpass', 0.6); for (const d of [0.1, 0.16, 0.24, 0.33]) tone(d, 520 + Math.random() * 500, 300, 0.09, 0.025, 'triangle');
    } else if (kind === 'ouch') {    // 挨打：闷的一下，加一声布撕开
      tone(0, 170, 62, 0.22, 0.3); tone(0, 330, 140, 0.12, 0.1, 'triangle'); hiss(0.01, 0.16, 0.2, 2400, 'bandpass', 0.8); hiss(0.05, 0.22, 0.09, 5200, 'highpass', 0.7);
    } else if (kind === 'beat') {    // 只剩一颗心：咚、咚
      tone(0, 74, 46, 0.16, 0.22); tone(0.19, 66, 42, 0.18, 0.16);
    } else if (kind === 'swap') {    // 换枪：咔、嗒
      tone(0, 520, 360, 0.05, 0.08, 'triangle'); tone(0.07, 760, 620, 0.06, 0.07, 'triangle'); hiss(0, 0.05, 0.05, 3000, 'highpass', 0.7);
    } else if (kind === 'weapon') {  // 捡到一把新枪
      for (const [d, f] of [[0, 523], [0.09, 659], [0.18, 784], [0.28, 1047]]) tone(d, f, f * 0.99, 0.22, 0.06, 'triangle');
    }
    const cleanup = ctx.createConstantSource(); cleanup.offset.value = 0; cleanup.connect(bus); cleanup.start(at); cleanup.stop(end);
    cleanup.onended = () => { cleanup.disconnect(); bus.disconnect(); stereo.disconnect(); };
  }
  return { play };
}
