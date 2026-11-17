// OP 配乐：MiniMax 音乐生成（纯音乐）。每个候选存 assets/rongboy/op/music-<名字>.mp3 和同名 .json（提示词、时长）。
//   MINIMAX_API_KEY=... node scripts/op/music.mjs            生成还没有的候选
//   MINIMAX_API_KEY=... node scripts/op/music.mjs sneak      只重做这一首
// 片子用的是 musicbox 这一首（53 秒，138.05 BPM），sneak 和 caper 是当时一起生成的另外两首候选，没有提交。
// 片子按它的拍点来排（scenes/rongboy-op/film.js 开头的 BEAT、B0），所以换曲子要重新对拍。
// 不带名字运行会把缺的候选都生成一遍（每首都要花额度）；只想重做某一首就带上名字。
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'assets/rongboy/op');
const URL_ = 'https://api.minimaxi.com/v1/music_generation';
const MODELS = ['music-3.0', 'music-2.0'];

const COMMON = 'Instrumental only, no vocals, no singing. Cozy handmade felt-and-yarn toy world, whimsical, warm, cute but mischievous. About one minute long.';
export const CUES = {
  sneak: `Opening theme for a cute stop-motion plush toy adventure game. First 25 seconds: very quiet and sneaky, tiptoeing pizzicato strings, a soft bassoon and a music box, lots of silence between notes, around 104 BPM. Then one comedic full stop. Then it bursts into a lively mischievous chase: bouncy marimba, ukulele strums, handclaps, toy piano and playful brass stabs, same tempo, joyful. Ends on a mysterious held chord and one bright final hit. ${COMMON}`,
  caper: `Playful toy heist caper. Starts sparse and sneaky with a walking upright bass, brushed snare, muted clarinet and vibraphone, tiptoe feel, around 108 BPM. Halfway through a sudden stop, then a swinging energetic chase with full toy band: xylophone runs, hand percussion, plucky strings, cheerful trumpet. Finishes with a suspenseful low note and a single bright sting. ${COMMON}`,
  musicbox: `Starts as a sleepy music box lullaby with glockenspiel and soft snoring-like low woodwind, slow and gentle. After about 20 seconds tiptoeing pizzicato joins and builds curiosity. Then a comedic pause and a bright bouncy romp with ukulele, marimba, claps, whistling melody and toy drums around 112 BPM, energetic and fun. Final seconds: sudden hush, mysterious tremolo, one big friendly final chord. ${COMMON}`,
};

async function generate(name, prompt) {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error('MINIMAX_API_KEY 没设');
  let last;
  for (const model of MODELS) {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, is_instrumental: true, audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' } }),
    });
    const d = await res.json();
    if (d.base_resp?.status_code) { last = model + ': ' + JSON.stringify(d.base_resp); continue; }
    await writeFile(path.join(dir, `music-${name}.mp3`), Buffer.from(d.data.audio, 'hex'));
    await writeFile(path.join(dir, `music-${name}.json`), JSON.stringify({ model, prompt, extra_info: d.extra_info, trace_id: d.trace_id }, null, 2));
    console.log(name, model, (d.extra_info.music_duration / 1000).toFixed(0) + 's');
    return;
  }
  throw new Error(name + ' 失败 ' + last);
}

await mkdir(dir, { recursive: true });
const only = process.argv.slice(2);
const todo = Object.entries(CUES).filter(([n]) => (only.length ? only.includes(n) : !existsSync(path.join(dir, `music-${n}.mp3`))));
const out = await Promise.allSettled(todo.map(([n, p]) => generate(n, p)));
for (const r of out) if (r.status === 'rejected') console.log('ERR', r.reason.message);
