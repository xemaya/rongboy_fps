// 清晰度调节器：先争 60 帧，够不着再保 30 帧；同一个帧数目标下先保光影，再保分辨率。纯逻辑，不碰渲染器——每帧喂一个帧间隔，要改清晰度时返回新的档位和像素数。
//
// 为什么不用引擎自带的那个（实测，Radeon Pro 5300M，Retina 屏）：
//   一、它看的是几十帧的平均帧间隔，开局僵尸一只只建模型时卡的那几下就够它连降几档。这里看分位数，偶尔卡一两下不算。
//   二、浏览器按屏幕刷新出帧：一帧花 35 毫秒，显示出来是 20 帧。它拿这个数判断"分辨率缩到头了还是慢"，于是换档。
//       这里每个目标都是一段不动的区间（30 帧时 26–48 帧都不动），只有掉到下一级才减，上到上一级才加。
//   三、它只降不升，掉到 low（没有抗锯齿、没有环境遮蔽）以后一整局都回不来。这里画面轻了会加回去。
//   四、它的分辨率最多缩到像素数的 36%，再慢就换光影更差的档。这里每一档有自己的像素数范围，同一档里减到底了才换档。
//
// 帧数目标（2026-11 性能这一轮改的，原来只有 30）：第一人称射击 30 帧转视角发涩，所以先按 60 帧找；
// 光影降到最后一档、像素减到底还到不了 60 帧的机器，硬撑只会画面最差、帧数照样 30 出头，
// 这时改保 30 帧：从起步的档位重新往下找，停在 30 帧撑得住的最好看的那一档（也就是原来的做法）。
// "慢"看的是最近一段帧间隔的 75% 分位：60 帧时一帧够、一帧不够（16.7、33.3 交替）中位数看不出来，分位数看得出；
// 偶尔卡一下（少于四分之一的帧）照样不算。
//
// 停在目标帧数的时候看不出还剩多少余量（一帧花 18 毫秒和 32 毫秒显示出来都是 30 帧），所以每隔一阵往上试一步：
// 站住了就留着；掉下来就退回去，下次隔两倍的时间再试（15 秒 → 30 秒 → …… → 最多两分钟）。
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// looks：[{ min, max }, ...]，从好到差；每档的像素数范围。opts 里的毫秒数是帧间隔。
// targets：帧数目标，从高到低依次退；startTier/start：起步的档位和像素数（猜是慢显卡时可以从低一点起步）。
export function createGovernor(looks, opts = {}) {
  const { start = 1.6e6, startTier = 0, targets = [60, 30], every = 1000, settle = 1500, minFrames = 20, firstTry = 15000, maxTry = 120000 } = opts;
  let goal = 0, tier = startTier, pixels = start, nextEval = 0, tryEvery = firstTry, tryAt = firstTry, upscaleAfter = 0, trying = null;
  const win = [], log = [], seen = [];   // seen：量过的设置和它的 75% 分位帧间隔
  // 慢：75% 分位的帧间隔比目标长 14%（30 帧时 38 毫秒）；有余量：中位数比目标短 37%（30 帧时 21 毫秒）
  const band = () => { const ms = 1000 / targets[goal]; return { slow: ms * 1.14, fast: ms * 0.63 }; };
  const quantile = (p) => [...win].sort((a, b) => a - b)[Math.min(win.length - 1, Math.floor(win.length * p))];

  // now：毫秒；interval：这一帧和上一帧隔了多久；native：屏幕本身的像素数（再多也没用）
  function feed(now, interval, native = Infinity) {
    if (interval > 250) { win.length = 0; return null; }   // 切走又回来、整个卡住：这一段不算
    win.push(interval); if (win.length > 60) win.shift();
    if (now < nextEval || win.length < minFrames) return null;
    const { slow, fast } = band(), high = quantile(0.75), med = quantile(0.5);
    const L = looks[tier], top = Math.min(L.max, native), cur = Math.min(pixels, top);
    let nt = tier, np = cur, why = '';
    if (high > slow) {
      if (trying) { nt = trying.tier; np = trying.pixels; trying = null; tryEvery = Math.min(maxTry, tryEvery * 2); why = '试高了，退回'; }
      else {
        np = cur * clamp((1000 / targets[goal]) / high, 0.5, 0.85); why = '慢';
        if (np < L.min) {
          if (tier < looks.length - 1 && cur <= L.min * 1.05) { nt = tier + 1; np = Math.min(looks[nt].max, native); why = '这一档减到底了，换档'; }
          else if (cur <= L.min * 1.05 && goal < targets.length - 1) {
            // 往下找的一路上每个设置都量过：挑新目标下撑得住的最好看的那个（档位最好、像素最多）；一个都没有就停在这儿
            goal++; seen.push({ tier, pixels: cur, high }); tryEvery = firstTry; why = `最低一档也到不了 ${targets[goal - 1]} 帧，改保 ${targets[goal]} 帧`;
            const ok = seen.filter(v => v.high <= band().slow).sort((a, b) => a.tier - b.tier || b.pixels - a.pixels)[0];
            if (ok) { nt = ok.tier; np = ok.pixels; } else np = cur;
          }
          else np = L.min;
        }
      }
      tryAt = now + tryEvery;
    } else {
      if (trying && now >= trying.until) { trying = null; tryEvery = Math.max(firstTry, tryEvery / 2); }   // 上一步站住了
      if (!trying && now >= upscaleAfter && (med < fast || now >= tryAt)) {
        if (cur < top * 0.97) { trying = { tier, pixels: cur, until: now + (med < fast ? 2000 : 4000) }; np = Math.min(top, cur * 1.25); why = med < fast ? '有余量' : '往上试一步'; }
        else if (tier > 0) { trying = { tier, pixels: cur, until: now + 4000 }; nt = tier - 1; np = Math.min(looks[nt].min * 1.2, native); why = '换回好一档'; }
        tryAt = now + tryEvery;
      }
    }
    const gaveUp = why.includes('改保');
    if (nt === tier && Math.abs(np - cur) / cur < 0.04 && !gaveUp) { nextEval = now + every; return null; }
    if (!gaveUp) { seen.push({ tier, pixels: cur, high }); if (seen.length > 40) seen.shift(); }
    tier = nt; pixels = np; win.length = 0; nextEval = now + settle;
    log.push({ t: Math.round(now), p75: +high.toFixed(1), fps: targets[goal], tier, pixels: Math.round(pixels), why }); if (log.length > 80) log.shift();
    return { tier, pixels };
  }
  return { feed, log, deferUpscale(until) { upscaleAfter = until; }, get tier() { return tier; }, get pixels() { return pixels; }, get target() { return targets[goal]; } };
}
