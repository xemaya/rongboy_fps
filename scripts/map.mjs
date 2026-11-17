// 地图工具：出草图、检查、体检、看俯视图。给写地图的 agent 用，说明见 docs/map-guide.md。
//   node scripts/map.mjs vocab                         草图里能写的词：家具、僵尸、枪、主题
//   node scripts/map.mjs draft <id> [--theme school] [--rooms 5] [--seed 1] [--name 名字] [--force]
//                                                      随机出一份草图，写到 levels/<id>.js 并登记（不进游戏里的地图列表）
//   node scripts/map.mjs check <id>                    硬性检查：有 ERR 就不能合入（退出码 1）
//   node scripts/map.mjs review <id> [--json]          体检：一组数 + 两个机器人 + 带坐标的建议，并和上一次比
//   node scripts/map.mjs preview <id> [--hits]         字符俯视图（印出来）+ SVG（存到 shots/map/<id>.svg）；--hits 标出机器人挨打的地方
//   node scripts/map.mjs print <id>                    展开后的完整坐标表（家具、僵尸、拾取物）
//   node scripts/map.mjs register <id> [--listed]      把 levels/<id>.js 登记进地图表；--listed 同时进游戏里的地图列表
//   node scripts/map.mjs list                          现有的地图
// <id> 是 scenes/rongboy-mission/levels/ 下的文件名（不带 .js）。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { PROPS, THEMES, ZOMBIES, GUNS, OBJECTIVE_ITEMS, coverOf } from '../scenes/rongboy-mission/mapkit/catalog.js';
import { PlanError } from '../scenes/rongboy-mission/mapkit/build.js';
import { checkMap } from '../scenes/rongboy-mission/mapkit/check.js';
import { reviewMap, formatReview } from '../scenes/rongboy-mission/mapkit/review.js';
import { asciiMap, svgMap, LEGEND } from '../scenes/rongboy-mission/mapkit/preview.js';
import { draftPlan, planSource } from '../scenes/rongboy-mission/mapkit/draft.js';
import { ENEMY_TYPES, WEAPONS } from '../scenes/rongboy-mission/game.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const levels = path.join(root, 'scenes/rongboy-mission/levels'), indexFile = path.join(levels, 'index.js'), outDir = path.join(root, 'shots/map');
const [command, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { const k = rest[i].slice(2); flags[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; } else args.push(rest[i]); }
const id = args[0];
const die = message => { console.error(message); process.exit(1); };

async function load(name) {
  if (!name) die(`要写地图的 id，例如：node scripts/map.mjs ${command} cottage`);
  const file = path.join(levels, name + '.js');
  if (!existsSync(file)) die(`没有 ${path.relative(root, file)}。现有的地图：node scripts/map.mjs list；新建一张：node scripts/map.mjs draft ${name}`);
  try { return (await import(pathToFileURL(file).href)).default; }
  catch (e) { if (e instanceof PlanError || e.name === 'PlanError') die(`草图有问题（${path.relative(root, file)}）：\n  ${e.message}`); throw e; }
}

// 地图表 levels/index.js：import 一行一个，LEVELS 是能用网址打开的全部地图，ORDER 是游戏里列出来的。
async function readIndex() {
  const text = await readFile(indexFile, 'utf8');
  return { text, ids: [...text.matchAll(/^import (\w+) from '\.\/(\w+)\.js';/gm)].map(m => m[2]), order: [.../ORDER = \[([^\]]*)\]/.exec(text)[1].matchAll(/'(\w+)'/g)].map(m => m[1]) };
}
async function register(name, listed) {
  if (!/^[a-z][a-z0-9]*$/.test(name)) die(`地图 id "${name}" 只能用小写字母和数字，字母开头（它同时是文件名、网址参数和变量名）`);
  const { ids, order } = await readIndex(), all = ids.includes(name) ? ids : [...ids, name], shown = listed && !order.includes(name) ? [...order, name] : order;
  await writeFile(indexFile, `// 地图表。网址 ?level=<id> 选图，开始画面按 1、2… 也能换。\n// LEVELS：能用网址打开的全部地图；ORDER：游戏里列出来的（新图先不进 ORDER，有人看过、玩过再进）。\n// 这个文件由 node scripts/map.mjs register <id> [--listed] 改写，也可以手改。\n${all.map(n => `import ${n} from './${n}.js';`).join('\n')}\n\nexport const LEVELS = { ${all.join(', ')} };\nexport const ORDER = [${shown.map(n => `'${n}'`).join(', ')}];\n`);
  return { added: !ids.includes(name), listed: shown.includes(name) };
}

function printCheck(result) {
  for (const e of result.errors) console.log(`ERR   [${e.code}] ${e.msg}`);
  for (const w of result.warnings) console.log(`warn  [${w.code}] ${w.msg}`);
  for (const n of result.notes || []) console.log(`note  ${n}`);
  console.log(`${result.errors.length} 个错误，${result.warnings.length} 个警告${result.errors.length ? '' : '：硬性检查通过'}`);
}

if (command === 'vocab') {
  console.log('主题（theme）：' + Object.entries(THEMES).map(([k, t]) => `${k}（${t.name}，光线 ${t.look}，层高 ${t.height} 米，默认门宽 ${t.door} 米）`).join('；'));
  console.log('\n家具（props）。写法：\'名字\' 自动摆在屋子中间；\'名字@n\' 贴北墙（n/s/e/w）自动找位置；\'名字@ne\' 贴北墙的东头；\'名字@c\' 正中；\'名字@start\' 挡在出生点前面。');
  console.log('  掩体：高 = 1.3 米以上，挡视线挡箭；矮 = 0.6–1.3 米，挡身体；— = 不算掩体。尺寸是 沿墙 × 进深 × 高（米）。');
  for (const set of ['home', 'museum', 'school']) {
    console.log(`\n  ${THEMES[set].name}的家具（哪个主题都能用）`);
    for (const [name, p] of Object.entries(PROPS).filter(([, p]) => p.set === set)) console.log(`    ${name.padEnd(18)} ${p.size.join(' × ').padEnd(16)} ${{ tall: '高', low: '矮', none: '—' }[coverOf(p.size[2])]}  ${{ in: '室内', out: '室外', any: '都行' }[p.where]}  ${p.note}`);
  }
  console.log('\n僵尸（zombies）。写法：\'种类\' 或 \'种类:状态\'，状态是 asleep（睡着）/ idle（醒着站着）/ patrol（巡逻），不写就由工具搭配。');
  for (const [name, z] of Object.entries(ZOMBIES)) console.log(`    ${name.padEnd(12)} ${z.name}：${z.role}${z.answer ? `；图里要备着 ${WEAPONS.find(w => w.id === z.answer).name}（'${z.answer}'）` : ''}${z.ranged ? '；远程，它看得到的地方 3.5 米内要有掩体' : ''}`);
  console.log('\n拾取物（pickups）。写法：\'heart\' 心；\'ammo\' 弹药包（补手里那把特殊枪）；\'yarn\' 毛线团手雷；枪的名字；{ objective: \'名字\', item: \'…\' } 任务物品');
  console.log('    枪：' + Object.entries(GUNS).map(([g, n]) => `${g}（${WEAPONS.find(w => w.id === g).name}，带 ${n} 发）`).join('，'));
  console.log('    任务物品的模型（item）：' + OBJECTIVE_ITEMS.join('、') + '。任务物品要配 mission: \'fetch\'');
  console.log('\n开局玩家手里有：线轴手枪（备弹无限）、绒球霰弹、1 个毛线团。');
} else if (command === 'list') {
  const { ids, order } = await readIndex();
  for (const name of ids) { const def = await load(name); console.log(`${name.padEnd(12)} ${def.name}  ·  ${def.enemies.length + (def.upper || []).reduce((n, u) => n + u.enemies.length, 0)} 只僵尸  ·  ${order.includes(name) ? `游戏里第 ${order.indexOf(name) + 1} 张` : '只能用网址打开（?level=' + name + '）'}`); }
} else if (command === 'draft') {
  if (!id) die('要给新地图起一个 id（小写英文），例如：node scripts/map.mjs draft toyshop --theme school --rooms 5 --seed 3');
  if (!/^[a-z][a-z0-9]*$/.test(id)) die(`地图 id "${id}" 只能用小写字母和数字，字母开头`);
  const file = path.join(levels, id + '.js');
  if (existsSync(file) && !flags.force) die(`${path.relative(root, file)} 已经有了。要覆盖就加 --force（会丢掉现在的草图）`);
  const seed = Number(flags.seed ?? 1);
  let made;
  try { made = draftPlan({ id, name: typeof flags.name === 'string' ? flags.name : undefined, theme: flags.theme ?? 'school', rooms: Number(flags.rooms ?? 5), seed }); } catch (e) { if (e.name === 'PlanError') die(e.message); throw e; }
  await writeFile(file, planSource(made.plan, { seed }));
  const reg = await register(id, false);
  console.log(`写好了 ${path.relative(root, file)}${reg.added ? '，已登记进地图表（不在游戏里的列表中，网址 ?level=' + id + ' 可以打开）' : ''}\n`);
  console.log(asciiMap(made.def)); console.log(LEGEND.join('\n'), '\n');
  printCheck(made.result);
  console.log(`\n这只是初稿。接下来：改草图 → node scripts/map.mjs check ${id} → review ${id} → preview ${id}`);
} else if (command === 'check') {
  const result = checkMap(await load(id));
  printCheck(result);
  process.exit(result.errors.length ? 1 : 0);
} else if (command === 'review') {
  const def = await load(id), checked = checkMap(def, { play: false });
  if (checked.errors.length) { printCheck(checked); die(`\n先把硬性检查的错误改掉，再看体检报告：node scripts/map.mjs check ${id}`); }
  const report = reviewMap(def), file = path.join(outDir, id + '.review.json');
  let previous = null;
  try { previous = JSON.parse(await readFile(file, 'utf8')); } catch { /* 第一次跑 */ }
  if (flags.json) console.log(JSON.stringify(report, null, 1));
  else {
    console.log(formatReview(report, previous));
    if (checked.warnings.length) console.log(`\n另有 ${checked.warnings.length} 个检查警告（node scripts/map.mjs check ${id}）`);
    console.log(previous ? '\n括号里是上一次跑的数。' : '\n这是第一次跑；下一次会在括号里标出变化。');
  }
  if (!report.unsupported) { await mkdir(outDir, { recursive: true }); await writeFile(file, JSON.stringify(report)); }
} else if (command === 'preview') {
  const def = await load(id);
  const marks = flags.hits ? reviewMap(def).marks || [] : [];
  console.log(asciiMap(def, { marks })); console.log(LEGEND.join('\n'));
  if (marks.length) console.log('*l 偷懒的机器人在这挨打    *k 留神的机器人在这挨打');
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, id + '.svg');
  await writeFile(file, svgMap(def, { marks }));
  console.log(`\nSVG：${file}`);
} else if (command === 'print') {
  const def = await load(id), parts = [def, ...(def.upper || [])];
  console.log(`${def.name}（${def.id}） 边界 x ${def.bounds.minX}…${def.bounds.maxX}, z ${def.bounds.minZ}…${def.bounds.maxZ} · 出生点 (${def.player.x}, ${def.player.z}) · 任务 ${def.mission.title} · 标准时间 ${def.par} 秒`);
  parts.forEach((part, floor) => {
    if (parts.length > 1) console.log(`\n—— ${floor + 1} 层 ——`);
    console.log('墙和门'); for (const w of part.walls || []) console.log(`  ${typeof w.x === 'number' ? `x = ${w.x}, z ${w.z[0]}…${w.z[1]}` : `z = ${w.z}, x ${w.x[0]}…${w.x[1]}`}${w.doors ? '  门 ' + w.doors.map(d => d.join('–')).join('，') : ''}`);
    console.log('家具（中心 x, z · 宽 w × 深 d × 高 h）'); for (const f of part.furniture || []) console.log(`  ${f.id.padEnd(24)} ${(f.look ?? f.kind).padEnd(12)} ${f.item ?? ''} (${f.x}, ${f.z})  ${f.w} × ${f.d} × ${f.h}${f.face ? '  朝 ' + f.face : ''}`);
    console.log('僵尸'); for (const e of part.enemies || []) console.log(`  ${ENEMY_TYPES[e.type].name.padEnd(6)} (${e.x}, ${e.z})  ${e.state}${e.patrol ? '  巡逻到 ' + e.patrol.map(p => `(${p})`).join(' → ') : ''}`);
    console.log('拾取物'); for (const k of part.pickups || []) console.log(`  ${(k.name ?? k.weapon ?? k.kind).padEnd(8)} ${k.kind.padEnd(10)} (${k.x}, ${k.z})${k.amount ? '  ×' + k.amount : ''}`);
  });
  for (const n of def.notes || []) console.log('note  ' + n);
} else if (command === 'register') {
  await load(id);
  const reg = await register(id, !!flags.listed);
  console.log(`${id}：${reg.added ? '已登记' : '本来就登记了'}，${reg.listed ? '在游戏的地图列表里' : '不在游戏的地图列表里（网址 ?level=' + id + ' 可以打开）'}`);
} else {
  console.log((await readFile(fileURLToPath(import.meta.url), 'utf8')).split('\n').slice(0, 12).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  if (command && command !== 'help') process.exit(1);
}
