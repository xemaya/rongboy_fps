#!/bin/zsh
# 把开场片逐帧渲成 mp4（H.264 + AAC），连同配乐和音效。每一帧都由 dist/rongboy-op.html 现场画（?export=1），所以要先 build。
#   scripts/op/export.sh [fps=30] [宽=1920] [从=0] [到=全片]
# 产物：assets/rongboy/op/rongboy-op.mp4（提交进仓库；build 时拷到 dist/，开场页默认放它）。
# 帧存在 shots/frames-op/（不提交）。需要 ego-browser 和 ffmpeg（~/.local/bin）。只导一段（给了"从/到"）时不混声音，产物在 shots/op-part.mp4。
export PATH="$HOME/.local/bin:$PATH"
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FPS=${1:-30}; W=${2:-1920}; FROM=${3:-0}; TO=${4:-0}
H=$(( W * 9 / 16 )); DIR=$ROOT/shots/frames-op; OUT=$ROOT/assets/rongboy/op/rongboy-op.mp4
# AUDIO_ONLY=1：画面没动、只改了声音时用——留着上次渲好的帧，只重混声音再合成
[[ -n "$AUDIO_ONLY" ]] || rm -rf "$DIR"; mkdir -p "$DIR"
ego-browser nodejs <<JS
const fs = await import("node:fs");
const task = await taskSpace("rongboy op export");
const page = task.page("p1");
// 画布按设备像素比出图：这里让 CSS 宽度乘像素比正好等于目标宽度
await page.goto("file://${ROOT}/dist/rongboy-op.html?export=1&w=1", { timeout: 90000 });
const dpr = await page.evaluate(() => Math.min(2, devicePixelRatio || 1));
await page.goto("file://${ROOT}/dist/rongboy-op.html?export=1&w=" + (${W} / dpr), { timeout: 90000 });
await page.waitForFunction(() => window.__ready === true || document.getElementById("err").textContent.length > 0, undefined, { timeout: 300000 });
const err = await page.evaluate(() => document.getElementById("err").textContent);
if (err) { console.log("page error: " + err.slice(0, 800)); process.exit(1); }
const dur = await page.evaluate(() => window.__film.duration);
const from = ${FROM}, to = ${TO} || dur, fps = ${FPS}, total = "${AUDIO_ONLY}" ? 0 : Math.round((to - from) * fps), t0 = Date.now();
await page.evaluate(() => { window.__op.film.reset(); });
for (let i = 0; i < total; ) {
  const n = Math.min(8, total - i);
  const frames = await page.evaluate(([i0, n, fps, from, W, H]) => {
    const src = document.getElementById("view"), cv = window.__cv || (window.__cv = Object.assign(document.createElement("canvas"), { width: W, height: H })), x = cv.getContext("2d"), out = [];
    for (let k = 0; k < n; k++) { window.__film.render(from + (i0 + k) / fps, 1 / fps); x.drawImage(src, 0, 0, W, H); out.push(cv.toDataURL("image/jpeg", 0.94).split(",")[1]); }
    return out;
  }, [i, n, fps, from, ${W}, ${H}]);
  frames.forEach((b, k) => fs.writeFileSync("${DIR}/f" + String(i + k).padStart(5, "0") + ".jpg", Buffer.from(b, "base64")));
  i += n;
  if (i % 240 < 8) console.log("frame " + i + "/" + total + "  " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
}
console.log("frames done in " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
if (!${FROM} && !${TO}) {
  // 混音要十几秒，超过了单次 evaluate 的时限：先启动，再等结果
  await page.evaluate(() => { window.__mixInfo = null; window.__op.mixdown().then((r) => { window.__mixInfo = r; }, (e) => { window.__mixInfo = { error: String(e) }; }); });
  await page.waitForFunction(() => window.__mixInfo !== null, undefined, { timeout: 300000 });
  const info = await page.evaluate(() => window.__mixInfo);
  if (info.error) { console.log("mixdown error: " + info.error); process.exit(1); }
  console.log("audio", JSON.stringify(info));
  const parts = [];
  for (let o = 0; o < info.length; o += 3000000) parts.push(await page.evaluate(([o]) => window.__wav.slice(o, o + 3000000), [o]));
  fs.writeFileSync("${DIR}/audio.wav", Buffer.from(parts.join(""), "base64"));
}
await task.finish({ keep: [] });
JS
[[ -f "$DIR/f00000.jpg" ]] || { echo "没有渲出帧"; exit 1; }
if [[ -f "$DIR/audio.wav" ]]; then
  ffmpeg -y -loglevel error -framerate $FPS -i "$DIR/f%05d.jpg" -i "$DIR/audio.wav" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT" && ls -la "$OUT" && cp "$OUT" "$ROOT/dist/"
else
  ffmpeg -y -loglevel error -framerate $FPS -i "$DIR/f%05d.jpg" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart "$ROOT/shots/op-part.mp4" && ls -la "$ROOT/shots/op-part.mp4"
fi
