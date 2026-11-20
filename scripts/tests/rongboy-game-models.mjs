// 游戏用的是减过面的手办（scripts/optimize-models.mjs 生成，assets/rongboy/game/）。源文件改了却没重新生成的话，游戏里还是旧模型。
//   node scripts/tests/rongboy-game-models.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stale } from '../optimize-models.mjs';

const bad = await stale();
assert.deepEqual(bad.map((m) => m.out), [], '减面文件和源文件对不上：跑一次 node scripts/optimize-models.mjs');
// 游戏的模型表必须指向减过面的那份；开场片的特写指向原件
const game = await readFile(new URL('../../scenes/rongboy-shooter-fps/models.js', import.meta.url), 'utf8');
assert.match(game, /assets\/rongboy\/game\/zombie-roster\.glb/); assert.match(game, /assets\/rongboy\/game\/scout\.glb/);
const op = await readFile(new URL('../../scenes/rongboy-op/stage.js', import.meta.url), 'utf8');
assert.match(op, /models-full\.js/, '开场片用原件');
console.log('PASS 减面文件是由当前的源文件生成的，游戏用减面版，开场片用原件');
