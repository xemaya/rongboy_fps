// 僵尸并成刚性蒙皮（library/games/rongboy-runtime.js 的 skinFigurine）以后，摆什么姿势都要和不并的时候一模一样：
// 同一套随机姿势下，每个关节带着的顶点（按包围盒比）位置不差；两只从同一个模板复制出来的僵尸各动各的；爬行用的底面轮廓还在。
//   node scripts/tests/rongboy-skin.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { optimizeFigurine, loadFigurines } from '../../library/games/rongboy-runtime.js';
import { poseGroundedGait } from '../../library/games/rongboy-gait.js';
import { measureArmProbe } from '../../library/games/rongboy-rig-geometry.js';

// 去掉贴图（Node 里没有图片解码），几何和层级不动
async function stripped(file) {
  const bytes = await readFile(new URL(file, import.meta.url));
  const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length));
  json.images = []; json.textures = []; json.samplers = [];
  json.materials = (json.materials || []).map((m) => ({ name: m.name, extras: m.extras, pbrMetallicRoughness: { baseColorFactor: m.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1], roughnessFactor: m.pbrMetallicRoughness?.roughnessFactor ?? 1, metallicFactor: m.pbrMetallicRoughness?.metallicFactor ?? 0 } }));
  delete json.extensionsUsed; delete json.extensionsRequired;
  const raw = Buffer.from(JSON.stringify(json)), jb = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]), bin = bytes.subarray(20 + length), header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + jb.length + bin.length, 8); header.writeUInt32LE(jb.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, jb, bin]);
  return new Uint8Array(glb.buffer, glb.byteOffset, glb.byteLength);
}
const glb = await stripped('../../assets/rongboy/game/zombie-roster.glb');
const parse = async () => (await new GLTFLoader().parseAsync(glb.slice().buffer, '')).scene;
const isRig = (o) => !!o.userData.part && !o.isMesh && !o.name.startsWith('Mesh');

let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) - 0.5;
function pose(root, values) {
  const rigs = []; root.traverse((o) => { if (isRig(o)) rigs.push(o); });
  rigs.forEach((o, i) => { const v = values[i]; o.rotation.x += v[0]; o.rotation.y += v[1]; o.rotation.z += v[2]; o.position.y += v[3]; });
  root.rotation.y = 0.7; root.position.set(1.5, 0.2, -2); root.updateMatrixWorld(true);
  return rigs.map((o) => o.userData.part);
}
// 每个关节自己那些身体网格（不含绒毛）的世界包围盒
function boxesPlain(root) {
  const out = new Map(); root.traverse((o) => { if (!isRig(o)) return; const b = new T.Box3(); for (const c of o.children) if (c.isMesh && !c.userData.fuzz) b.expandByObject(c, true); out.set(o.userData.part, b); });
  return out;
}
function boxesSkinned(root) {
  const out = new Map(), v = new T.Vector3();
  root.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData.fuzz) return;
    const idx = o.geometry.getAttribute('skinIndex'), names = o.skeleton.bones.map((b) => b.userData.part);
    for (let i = 0; i < idx.count; i++) {
      const part = names[idx.getX(i)]; if (!out.has(part)) out.set(part, new T.Box3());
      o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); out.get(part).expandByPoint(v);
    }
  });
  return out;
}

let compared = 0;
const plainScene = await parse(), skinScene = await parse();
for (const type of ['walker', 'archer', 'bomber', 'heavy']) {
  const a = plainScene.children.find((o) => o.userData.zombieType === type), b = skinScene.children.find((o) => o.userData.zombieType === type);
  assert.ok(a && b, `花名册里有 ${type}`);
  optimizeFigurine(a); optimizeFigurine(b, { skin: true });
  let meshesA = 0, meshesB = 0; a.traverse((o) => { if (o.isMesh) meshesA++; }); b.traverse((o) => { if (o.isMesh) meshesB++; });
  assert.ok(meshesB < meshesA / 2, `${type}：并了以后网格少一半以上（${meshesA} → ${meshesB}）`);
  const values = Array.from({ length: 12 }, () => [rnd() * 1.6, rnd() * 1.2, rnd() * 0.8, rnd() * 0.1]);
  const parts = pose(a, values); assert.deepEqual(pose(b, values), parts, '两边关节顺序一样');
  const pa = boxesPlain(a), pb = boxesSkinned(b);
  for (const part of parts) {
    if (pa.get(part).isEmpty()) continue;
    assert.ok(pb.has(part), `${type}/${part}：蒙皮里有这个关节的顶点`);
    const d = Math.max(pa.get(part).min.distanceTo(pb.get(part).min), pa.get(part).max.distanceTo(pb.get(part).max));
    assert.ok(d < 1e-4, `${type}/${part}：同一个姿势下位置一样（差 ${d.toExponential(2)} 米）`);
    compared++;
  }
}

// 游戏里的用法：loadFigurines(…, { skin: true }) 再 create 两只
const actors = await loadFigurines({ zombies: glb }, { skin: true });
const plainActors = await loadFigurines({ zombies: glb });
const one = actors.create('walker'), two = actors.create('walker');
assert.ok(one.ground && one.ground.get('LegL')?.length, '爬行用的底面轮廓还在');
const skinnedOf = (actor) => { let m; actor.model.traverse((o) => { if (o.isSkinnedMesh && !m) m = o; }); return m; };
assert.notEqual(skinnedOf(one).skeleton, skinnedOf(two).skeleton, '每只有自己的骨架');
assert.ok(skinnedOf(one).skeleton.bones.every((bone) => { let p = bone; while (p.parent) p = p.parent; return p === one.world; }), '骨头是这一只自己的关节');
one.world.updateMatrixWorld(true); two.world.updateMatrixWorld(true);
const before = boxesSkinned(two.model).get('ArmL').clone();
one.parts.get('ArmL').rotation.x = -1.2; one.world.updateMatrixWorld(true); two.world.updateMatrixWorld(true);
assert.ok(boxesSkinned(two.model).get('ArmL').equals(before), '动一只，另一只不跟着动');
assert.ok(!boxesSkinned(one.model).get('ArmL').equals(before), '动的那只胳膊确实抬了');

const plainWalker = plainActors.create('walker');
for (const name of ['ArmL', 'ArmR']) {
  const a = measureArmProbe(plainWalker, name), b = measureArmProbe(two, name);
  assert.ok(b.L > .5, `${name} still has a measurable arm after batching`);
  assert.ok(Math.abs(a.L-b.L) < 1e-5 && Math.abs(a.r-b.r) < 1e-5, name);
  assert.ok(a.points.every((point,i) => point.distanceTo(b.points[i]) < 1e-5), `${name} has the same clearance test points`);
}

for (const type of ['leaper', 'heavy', 'archer']) {
  const a = plainActors.create(type), b = actors.create(type);
  const enemy = { type, awareness:'alert', action:'chase', stepDistance:.34, stepWeight:1, stepForward:1 };
  poseGroundedGait(enemy,a);
  poseGroundedGait(enemy,b);
  for (const name of ['LegL', 'LegR']) {
    assert.ok(a.parts.get(name).position.distanceTo(b.parts.get(name).position) < 1e-5,
      `${type}/${name} keeps the same sole support compensation`);
  }
  a.dispose();
  b.dispose();
}
plainWalker.dispose();
one.dispose();
two.dispose();
console.log(`PASS 刚性蒙皮：${compared} 个关节在随机姿势下和不并的一样；复制出来的僵尸各用各的骨架`);
