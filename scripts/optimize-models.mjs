// 给游戏用的手办减面。Blender 导出的手办是给图鉴和近景看的：一只僵尸 10 万个三角形左右，头 3 万、一条腿 1.3 万。
// 游戏里它在两三米到十几米外，屏幕上两三百像素高，同屏好几只，还要再画一遍影子——差一点的显卡光是处理这些顶点就吃掉一帧的大半。
// 这里把源文件减面后另存一份，游戏（scenes/rongboy-shooter-fps/models.js）用减过的，图鉴和手办预览页仍然用原件。
//
//   node scripts/optimize-models.mjs            # 重新生成 assets/rongboy/game/*.glb，并打印前后对照
//   node scripts/optimize-models.mjs --check    # 只核对：现有的减面文件是不是由当前的源文件生成的（npm test 里由 scripts/tests/rongboy-game-models.mjs 跑）
// 改了 Blender 导出的手办（zombies-v7、runtime-v2）以后要重跑一次，不然游戏里还是旧模型，npm test 会报出来。
//
// 做法（meshoptimizer 的边折叠，经 gltf-transform）：
//   · 只减"身体"这类大块的面（一块超过 MIN_TRIS 个三角形才动）；针脚、纽扣、弓弦这些小零件原样保留。
//   · 绒毛（extras.fuzz）不动：它是一根根的细三角片，运行时要按三角形算生长方向，减了就秃了。
//   · 节点层级、名字、extras（part / zombieType / mechanism / gear……）、材质、贴图一概不动，运行时代码不用改。
//   · 减到原来的 RATIO，或者形状偏差到 ERROR（相对这一块自身的尺寸）为止，先到哪个算哪个。
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplifyPrimitive, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MODELS = [
  { id: 'zombie-roster', source: 'assets/rongboy/zombies-v7/zombie-roster.glb', out: 'assets/rongboy/game/zombie-roster.glb' },
  { id: 'scout', source: 'assets/rongboy/runtime-v2/scout.glb', out: 'assets/rongboy/game/scout.glb' },
];
export const SETTINGS = { ratio: 0.15, error: 0.008, minTris: 160 };
const MANIFEST = 'assets/rongboy/game/manifest.json';

const isFuzz = (node) => { for (let n = node; n; n = n.getParentNode?.()) if (n.getExtras().fuzz || /(^|\/ )fuzz( \/|$)/i.test(n.getName()) || n.getName().startsWith('fuzz')) return true; return false; };
const triCount = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;

// 每个顶层节点（一只手办）有多少三角形、多少顶点；绒毛单算
export function census(doc) {
  const rows = [];
  for (const scene of doc.getRoot().listScenes()) for (const top of scene.listChildren()) {
    const r = { name: top.getName(), type: top.getExtras().zombieType || null, tris: 0, fuzz: 0, verts: 0, meshes: 0 };
    top.traverse((n) => { const m = n.getMesh(); if (!m) return; const fz = isFuzz(n); for (const p of m.listPrimitives()) { const t = triCount(p); if (fz) r.fuzz += t; else r.tris += t; r.verts += p.getAttribute('POSITION').getCount(); r.meshes++; } });
    rows.push(r);
  }
  return rows;
}
// 每一块网格在自己坐标里的包围盒（核对减面没有把形状减变样用）
export function bounds(doc) {
  const out = new Map();
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], v = [0, 0, 0];
    for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } } }
    out.set(n.getName(), { lo, hi });
  }
  return out;
}

export async function optimize(doc, { ratio, error, minTris } = SETTINGS) {
  await MeshoptSimplifier.ready;
  await doc.transform(dedup(), weld());
  const done = new Set();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || done.has(mesh) || isFuzz(node)) continue;
    done.add(mesh);
    for (const prim of mesh.listPrimitives()) if (triCount(prim) >= minTris) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error, lockBorder: false });
  }
  await doc.transform(prune({ keepAttributes: true, keepLeaves: true, keepExtras: true }));
  return doc;
}

const io = () => new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

// 现有的减面文件是不是由当前的源文件、当前的设置生成的；返回对不上的那些（空数组 = 都对得上）
export async function stale() {
  const manifest = existsSync(path.join(root, MANIFEST)) ? JSON.parse(await readFile(path.join(root, MANIFEST), 'utf8')) : { models: {} };
  const out = [];
  for (const m of MODELS) {
    const src = await readFile(path.join(root, m.source)), rec = manifest.models[m.id];
    const built = existsSync(path.join(root, m.out)) ? await readFile(path.join(root, m.out)) : null;
    if (!rec || !built || rec.sourceSha !== sha(src) || rec.outSha !== sha(built) || JSON.stringify(rec.settings) !== JSON.stringify(SETTINGS)) out.push(m);
  }
  return out;
}

async function main() {
  if (process.argv.includes('--check')) {
    const bad = await stale();
    for (const m of bad) console.error(`${m.out} 不是由当前的 ${m.source} 生成的：跑一次 node scripts/optimize-models.mjs`);
    if (bad.length) process.exit(1);
    console.log('减面文件和源文件对得上'); return;
  }
  await mkdir(path.join(root, 'assets/rongboy/game'), { recursive: true });
  const next = { note: '由 scripts/optimize-models.mjs 生成，不要手改', models: {} };
  for (const m of MODELS) {
    const srcBuf = await readFile(path.join(root, m.source));
    const doc = await io().readBinary(new Uint8Array(srcBuf)), before = census(doc);
    await optimize(doc);
    const outBuf = await io().writeBinary(doc), after = census(doc);
    await writeFile(path.join(root, m.out), outBuf);
    next.models[m.id] = { source: m.source, sourceSha: sha(srcBuf), outSha: sha(outBuf), settings: SETTINGS, bytes: [srcBuf.length, outBuf.length], figures: after.map((a, i) => ({ name: a.name, tris: [before[i].tris, a.tris], fuzz: a.fuzz, verts: [before[i].verts, a.verts] })) };
    console.log(`\n${m.source}  ${(srcBuf.length / 1048576).toFixed(1)} MB → ${(outBuf.length / 1048576).toFixed(1)} MB`);
    for (let i = 0; i < after.length; i++) console.log(`  ${after[i].name.padEnd(22)} 面 ${String(before[i].tris).padStart(7)} → ${String(after[i].tris).padStart(6)}   绒毛 ${String(after[i].fuzz).padStart(6)}（不动）  顶点 ${String(before[i].verts).padStart(7)} → ${String(after[i].verts).padStart(6)}`);
  }
  await writeFile(path.join(root, MANIFEST), JSON.stringify(next, null, 1) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
