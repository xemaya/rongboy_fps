// 清晰度调节器：先保光影，再保分辨率，目标 30 帧。纯逻辑，不碰渲染器——每帧喂一个帧间隔，要改清晰度时返回新的档位和像素数。
//
// 为什么不用引擎自带的那个（实测，Radeon Pro 5300M，Retina 屏）：
//   一、它看的是几十帧的平均帧间隔，开局僵尸一只只建模型时卡的那几下就够它连降几档。这里看中位数，卡一两下不算。
//   二、浏览器按屏幕刷新出帧：一帧花 35 毫秒，显示出来是 20 帧。它拿这个数判断"分辨率缩到头了还是慢"，于是换档。
//       这里把"30 帧上下"当成一段不动的区间（26–48 帧都不动），只有掉到 20 帧那一级才减，上到 60 帧那一级才加。
//   三、它只降不升，掉到 low（没有抗锯齿、没有环境遮蔽）以后一整局都回不来。这里画面轻了会加回去。
//   四、它的分辨率最多缩到像素数的 36%，再慢就换光影更差的档。这里每一档有自己的像素数范围，同一档里减到底了才换档。
//
// 停在 30 帧的时候看不出还剩多少余量（一帧花 18 毫秒和 32 毫秒显示出来都是 30 帧），所以每隔一阵往上试一步：
// 站住了就留着；掉到 20 帧就退回去，下次隔两倍的时间再试（15 秒 → 30 秒 → …… → 最多两分钟）。
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// looks：[{ min, max }, ...]，从好到差；每档的像素数范围。opts 里的毫秒数是帧间隔。
export function createGovernor(looks, opts = {}) {
  const { start = 1.6e6, slow = 38, fast = 21, every = 1000, settle = 1500, minFrames = 20, firstTry = 15000, maxTry = 120000 } = opts;
  let tier = 0, pixels = start, nextEval = 0, tryEvery = firstTry, tryAt = firstTry, trying = null;
  const win = [], log = [];
  const median = () => [...win].sort((a, b) => a - b)[win.length >> 1];

  // now：毫秒；interval：这一帧和上一帧隔了多久；native：屏幕本身的像素数（再多也没用）
  function feed(now, interval, native = Infinity) {
    if (interval > 250) { win.length = 0; return null; }   // 切走又回来、整个卡住：这一段不算
    win.push(interval); if (win.length > 60) win.shift();
    if (now < nextEval || win.length < minFrames) return null;
    const med = median(), L = looks[tier], top = Math.min(L.max, native), cur = Math.min(pixels, top);
    let nt = tier, np = cur, why = '';
    if (med > slow) {
      if (trying) { nt = trying.tier; np = trying.pixels; trying = null; tryEvery = Math.min(maxTry, tryEvery * 2); why = '试高了，退回'; }
      else {
        np = cur * clamp(30 / med, 0.5, 0.85); why = '慢';
        if (np < L.min) { if (tier < looks.length - 1 && cur <= L.min * 1.05) { nt = tier + 1; np = Math.min(looks[nt].max, native); why = '这一档减到底了，换档'; } else np = L.min; }
      }
      tryAt = now + tryEvery;
    } else {
      if (trying && now >= trying.until) { trying = null; tryEvery = Math.max(firstTry, tryEvery / 2); }   // 上一步站住了
      if (!trying && (med < fast || now >= tryAt)) {
        if (cur < top * 0.97) { trying = { tier, pixels: cur, until: now + (med < fast ? 2000 : 4000) }; np = Math.min(top, cur * 1.25); why = med < fast ? '有余量' : '往上试一步'; }
        else if (tier > 0) { trying = { tier, pixels: cur, until: now + 4000 }; nt = tier - 1; np = Math.min(looks[nt].min * 1.2, native); why = '换回好一档'; }
        tryAt = now + tryEvery;
      }
    }
    if (nt === tier && Math.abs(np - cur) / cur < 0.04) { nextEval = now + every; return null; }
    tier = nt; pixels = np; win.length = 0; nextEval = now + settle;
    log.push({ t: Math.round(now), med: +med.toFixed(1), tier, pixels: Math.round(pixels), why }); if (log.length > 80) log.shift();
    return { tier, pixels };
  }
  return { feed, log, get tier() { return tier; }, get pixels() { return pixels; } };
}
