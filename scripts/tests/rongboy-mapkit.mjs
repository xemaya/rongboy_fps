// 地图工具的检查：生成器展开得对、写错的草图报得清楚、检查抓得到故意放的错、现有的图都过得了检查、随机草图都能用。
//   node scripts/tests/rongboy-mapkit.mjs
import assert from 'node:assert/strict';
import { buildMap, PlanError } from '../../scenes/rongboy-mission/mapkit/build.js';
import { checkMap } from '../../scenes/rongboy-mission/mapkit/check.js';
import { reviewMap, formatReview } from '../../scenes/rongboy-mission/mapkit/review.js';
import { asciiMap, svgMap } from '../../scenes/rongboy-mission/mapkit/preview.js';
import { playBot } from '../../scenes/rongboy-mission/mapkit/bots.js';
import { draftPlan, planSource } from '../../scenes/rongboy-mission/mapkit/draft.js';
import { PROPS, THEMES } from '../../scenes/rongboy-mission/mapkit/catalog.js';
import { LEVELS, ORDER } from '../../scenes/rongboy-mission/levels/index.js';

let checks = 0;
function test(name, fn) { const t = Date.now(); fn(); checks++; console.log('PASS', name, `(${((Date.now() - t) / 1000).toFixed(1)} s)`); }
const codes = list => list.map(e => e.code);
const clone = o => JSON.parse(JSON.stringify(o));

// 一份小草图：两间屋、一条走廊、一个院子
const PLAN = () => ({
  id: 'tiny', name: '小样 · 两间屋', theme: 'school', cell: 1.5,
  layout: ['AAAAABBBBB', 'AAAAABBBBB', 'AAAAABBBBB', 'AAAAABBBBB', 'CCCCCCCCCC', 'CCCCCCCCCC', 'YYYYYYYYYY', 'YYYYYYYYYY', 'YYYYYYYYYY', 'YYYYYYYYYY'],
  doors: ['Y-C', 'Y-C', 'C-A', 'C-B', 'A-B'],
  rooms: {
    Y: { id: 'yard', name: '操场', outdoor: true, props: ['blocks@start', 'slide'], zombies: ['walker:asleep'], pickups: ['stun'] },
    C: { id: 'corridor', name: '走廊', props: ['locker@n'], zombies: ['walker:patrol'], pickups: ['heavy'] },
    A: { id: 'class', name: '教室', props: ['podium@w', 'bookshelf@n', { look: 'desk-kid', rows: 2, cols: 2 }], zombies: ['archer', 'walker'], pickups: ['heart', 'ammo'] },
    B: { id: 'art', name: '美术教室', props: ['easel@n', 'palette'], zombies: ['shielded', 'leaper:asleep'], pickups: ['heart'] },
  },
});
const tiny = buildMap(PLAN());

test('a plan expands into a full level: bounds, rooms, walls with doorways, and a start in the yard facing north', () => {
  assert.deepEqual(tiny.bounds, { minX: -7.5, maxX: 7.5, minZ: -7.5, maxZ: 7.5 });
  assert.deepEqual(tiny.rooms.map(r => r.id), ['yard', 'corridor', 'class', 'art']);
  assert.deepEqual(tiny.rooms[2], { id: 'class', name: '教室', minX: -7.5, maxX: 0, minZ: -7.5, maxZ: -1.5, surface: tiny.rooms[2].surface, floor: tiny.rooms[2].floor, accent: tiny.rooms[2].accent });
  assert.deepEqual(tiny.player, { x: 0, z: 6.7, yaw: 0 });
  const facade = tiny.walls.find(w => w.z === 1.5), middle = tiny.walls.find(w => w.x === 0);
  assert.deepEqual(facade.x, [-7.5, 7.5]); assert.equal(facade.doors.length, 2);
  assert.deepEqual(middle.z, [-7.5, -1.5]); assert.equal(middle.doors.length, 1);
  for (const w of tiny.walls) for (const [a, b] of w.doors || []) { const [lo, hi] = w.x.length ? w.x : w.z; assert.ok(b - a >= 1.1 && a >= lo + 0.4 && b <= hi - 0.4, 'a doorway is wide enough and clear of the wall ends'); }
  assert.equal(tiny.look, THEMES.school.look); assert.equal(tiny.theme.yard, 'playground');
});

test('the same plan always expands into the same map', () => {
  assert.deepEqual(buildMap(PLAN()), tiny);
});

test('furniture goes where the plan says: against the named wall facing the room, clear of doorways', () => {
  const lockers = tiny.furniture.find(f => f.id === 'corridor-locker'), podium = tiny.furniture.find(f => f.id === 'class-podium');
  assert.equal(lockers.face, 's'); assert.ok(Math.abs(lockers.z - lockers.d / 2 - (-1.5 + 0.1)) < 0.05, 'flush against the north wall of the corridor');
  assert.equal(podium.face, 'e'); assert.ok(Math.abs(podium.x - podium.w / 2 - -7.5) < 0.05, 'flush against the outside west wall');
  assert.equal(tiny.furniture.filter(f => f.look === 'desk-kid').length, 4);
  const cover = tiny.furniture.find(f => f.id === 'yard-blocks');
  assert.equal(cover.x, tiny.player.x); assert.ok(cover.z < tiny.player.z - 1.5, 'the start cover stands in front of the spawn');
  for (const f of tiny.furniture) assert.equal(f.h, PROPS[f.look ?? f.kind].size[2]);
});

test('windows land on outside walls, every indoor room gets a lamp and a picture', () => {
  assert.ok(tiny.windows.length >= 3);
  for (const w of tiny.windows) assert.ok(w.x === -7.5 || w.x === 7.5 || w.z === -7.5 || w.z === 1.5);
  assert.equal(tiny.lamps.length, 6); assert.equal(tiny.pictures.length, 3);   // 45 平米以上的房间两盏灯
});

test('zombies and pickups: the counts the plan asked for, a patrol leg, texts and par filled in', () => {
  assert.equal(tiny.enemies.length, 6); assert.equal(tiny.pickups.length, 5);
  assert.ok(tiny.enemies.find(e => e.patrol), 'the corridor walker patrols');
  assert.deepEqual(tiny.pickups.filter(k => k.kind === 'weapon').map(k => [k.weapon, k.amount]), [['stun', 4], ['heavy', 3]]);
  assert.match(tiny.texts.intro, /6 只/); assert.equal(tiny.texts.short, '小样'); assert.equal(tiny.par, 120);
  assert.equal(tiny.mission.type, 'clear');
});

test('the expanded map passes every hard check, with nothing to warn about', () => {
  const r = checkMap(tiny);
  assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings, []);
});

test('a plan that cannot be built says what is wrong and how to fix it', () => {
  const broken = (change, pattern) => { const plan = PLAN(); change(plan); assert.throws(() => buildMap(plan), e => e instanceof PlanError && pattern.test(e.message), String(pattern)); };
  broken(p => { p.layout[0] = 'AAAAABBBBA'; }, /不是一个矩形/);
  broken(p => { p.layout[1] = 'AAAAABBBB'; }, /每行要一样长/);
  broken(p => { p.doors.push('Y-A'); }, /不挨着/);
  broken(p => { p.rooms.A.props.push('spaceship@n'); }, /词汇表里没有/);
  broken(p => { p.rooms.A.zombies.push('dragon'); }, /没有这个种类/);
  broken(p => { p.rooms.A.pickups.push('bazooka'); }, /能放在地上的枪只有/);
  broken(p => { p.rooms.C.props.push('bookshelf@n', 'bookshelf@n', 'bookshelf@n', 'bookshelf@n', 'bookshelf@n', 'bookshelf@n'); }, /这面墙放不下/);
  broken(p => { p.layout = ['YYYYYYYYYY', ...p.layout.slice(0, 6)]; }, /室外的行必须在 layout 的最下面/);
  broken(p => { p.theme = 'castle'; }, /主题 "castle" 不存在/);
});

test('fetch mission: the plan names the thing to find, the map gets an exit at the start', () => {
  const plan = PLAN(); plan.mission = 'fetch'; plan.rooms.B.pickups.push({ objective: '颜料盒', item: 'gem' });
  const def = buildMap(plan);
  assert.equal(def.mission.type, 'fetch'); assert.ok(def.mission.exit.minX < def.player.x && def.mission.exit.maxX > def.player.x);
  assert.match(def.texts.title, /颜料盒/); assert.ok(def.texts.got && def.texts.carry);
  assert.deepEqual(checkMap(def).errors, []);
});

test('gadgets and zipper stashes: the plan says which rooms, the theme says which gadget, the kit finds the spots', () => {
  const plan = PLAN(); plan.rooms.B.gadget = true; plan.rooms.Y.gadget = true; plan.rooms.C.stash = ['heart']; plan.rooms.B.stash = ['ammo'];
  const def = buildMap(plan), stashed = def.pickups.filter(k => k.stash);
  assert.deepEqual(def.gadgets.map(g => g.kind), ['bucket', 'bucket']);   // 学校主题用颜料桶
  assert.deepEqual(stashed.map(k => k.kind), ['heart', 'ammo']);
  for (const k of stashed) { const d = Math.hypot(k.x - k.stash.x, k.z - k.stash.z); assert.ok(d > 0.4 && d < 0.8 && (k.x - k.stash.x) * k.stash.normal[0] + (k.z - k.stash.z) * k.stash.normal[1] > 0.4, 'what is inside drops at the foot of the wall, on the room side'); }
  const r = checkMap(def); assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings, []);
  const text = asciiMap(def); assert.ok(text.includes('Pb') && text.includes('zz') && text.includes('??'));
  assert.equal(buildMap({ ...PLAN(), theme: 'home', rooms: { ...PLAN().rooms, Y: { ...PLAN().rooms.Y, gadget: true } } }).gadgets[0].kind, 'clock');
  const bad = change => { const q = PLAN(); change(q); try { buildMap(q); } catch (e) { return e.message; } return ''; };
  assert.match(bad(q => { q.rooms.C.stash = ['needle']; }), /拉链里只能放补给/);
  assert.match(bad(q => { q.gadget = 'trampoline'; q.rooms.A.gadget = true; }), /机关 "trampoline" 不存在/);
  // 检查抓得到放错的
  const faulty = (change, code, level = 'errors') => { const d = clone(def); change(d); const got = checkMap(d, { play: false }); assert.ok(codes(got[level]).includes(code), `${code} not reported; got ${codes(got.errors)} / ${codes(got.warnings)}`); };
  faulty(d => { const f = d.furniture[0]; Object.assign(d.gadgets[0], { x: f.x, z: f.z }); }, 'gadget-blocked');
  faulty(d => { d.gadgets[1].kind = 'clock'; }, 'gadget-mix', 'warnings');
  faulty(d => { const k = d.pickups.find(q => q.stash); k.kind = 'weapon'; k.weapon = 'heavy'; }, 'stash-holds');
  faulty(d => { const k = d.pickups.find(q => q.stash); k.stash.x += 1.5; k.stash.z += 1.5; }, 'stash-wall');
});

test('the checker catches planted faults', () => {
  const faulty = (change, code, level = 'errors') => { const def = clone(tiny); change(def); const r = checkMap(def, { play: code === 'unsafe-start' || code === 'lost' }); assert.ok(codes(r[level]).includes(code), `${code} not reported; got ${codes(r.errors)} / ${codes(r.warnings)}`); };
  const desk = tiny.furniture.find(f => f.look === 'desk-kid');
  faulty(d => { Object.assign(d.enemies[2], { x: desk.x, z: desk.z }); }, 'enemy-blocked');
  faulty(d => { d.furniture[0].look = 'spaceship'; }, 'look-name');
  faulty(d => { d.enemies[0].type = 'dragon'; }, 'enemy-type');
  faulty(d => { d.walls.find(w => w.x === 0).doors = []; d.walls.find(w => w.z === -1.5).doors.pop(); }, 'doors');
  faulty(d => { const door = d.walls.find(w => w.x === 0).doors[0]; d.furniture.push({ id: 'in-the-way', kind: 'crate', x: 0.45, z: (door[0] + door[1]) / 2, w: 0.7, d: 1.4, h: 0.7 }); }, 'door-blocked');
  faulty(d => { d.pickups = d.pickups.filter(k => k.weapon !== 'heavy'); }, 'no-answer', 'warnings');
  faulty(d => { d.pictures[0].normal = d.pictures[0].normal.map(n => -n); }, 'picture-facing', 'warnings');
  faulty(d => { d.furniture.push({ id: 'sliver', kind: 'cabinet', x: -7.5 + 0.66 + 0.3, z: 0, w: 0.6, d: 1.4, h: 1.0 }); }, 'pocket');
  faulty(d => { d.rooms[2].maxX = 1; }, 'rooms-overlap');
  faulty(d => { d.pickups.push({ kind: 'heart', amount: 1, x: 50, z: 0 }); }, 'pickup-blocked');
  // 一只醒着的僵尸站在出生点正前方、挡的东西拿掉：开局不安全
  faulty(d => { d.furniture = d.furniture.filter(f => f.id !== 'yard-blocks'); d.enemies.push({ type: 'walker', x: d.player.x, z: d.player.z - 3.5, state: 'idle', heading: 0 }); }, 'unsafe-start');
});

test('all four shipped maps pass the hard checks', () => {
  assert.deepEqual(ORDER, ['house', 'museum', 'school', 'cottage']);   // 奶奶家是用生成器写的，2026-11-17 起是第四张正式地图
  assert.ok(LEVELS.cottage);
  // 三张正式的图各有自己的测试把"真的跑一遍"那部分跑过了，这里只跑静态的；示例图全跑
  for (const id of ORDER.filter(id => id !== 'cottage')) assert.deepEqual(checkMap(LEVELS[id], { play: false }).errors.map(e => `${id}: ${e.msg}`), []);
  const cottage = checkMap(LEVELS.cottage);
  assert.deepEqual(cottage.errors, []);
  assert.equal(cottage.facts.storeys,1);
  assert.equal(cottage.facts.zombies,24);
  assert.deepEqual(LEVELS.cottage.waves.stages,['果树行','晾晒场','果料仓']);
  assert.deepEqual(cottage.warnings.filter(w => w.code !== 'enemy-untested'), []);
});

test('random drafts pass the hard checks for every theme, and a seed always gives the same plan', () => {
  for (const theme of Object.keys(THEMES)) for (const seed of [1]) {
    const made = draftPlan({ id: 'draft', theme, seed, rooms: 4 + seed });
    assert.deepEqual(made.result.errors, [], `${theme} seed ${seed}`);
    assert.ok(made.def.enemies.length >= 6 && made.def.pickups.some(k => k.kind === 'heart'));
    assert.ok(made.def.gadgets.length >= 1 && made.def.gadgets.every(g => g.kind === THEMES[theme].gadget), `${theme}: a draft comes with its theme's gadget`);
    if (seed === 1 && theme === 'home') assert.equal(planSource(draftPlan({ id: 'draft', theme, seed, rooms: 5 }).plan), planSource(draftPlan({ id: 'draft', theme, seed, rooms: 5 }).plan));
  }
  assert.match(planSource(draftPlan({ id: 'draft', theme: 'home', seed: 2 }).plan, { seed: 2 }), /export default buildMap\(\{\n  id: 'draft'/);
});

test('the review reports the numbers an author tunes, and the two bots tell lazy play from attentive play', () => {
  const r = reviewMap(LEVELS.school), sum = runs => runs.reduce((n, b) => n + b.hurt, 0);
  assert.equal(r.facts.zombies, 24); assert.ok(r.flow.loops >= 1); assert.equal(r.rooms[0].name, '课间活动区'); assert.equal(r.ranged.length, 4);
  assert.equal(r.gadgets.length, 1); assert.ok(r.gadgets.every(g => g.kind === 'bucket' && g.inside + g.passing > 0 && g.reach)); assert.equal(r.supplies.stashes, 3);
  assert.equal(r.bots.runs.lazy.length, 3);
  assert.ok(r.bots.runs.keen.filter(b => b.won).length >= 2 && sum(r.bots.runs.keen) < sum(r.bots.runs.lazy), JSON.stringify([r.bots.runs.lazy.map(b => b.hurt), r.bots.runs.keen.map(b => b.hurt)]));
  assert.deepEqual(r.tips.filter(t => t.level === 'problem'), []);
  assert.match(formatReview(r, r), /留神的：3 遍里打完/);
  assert.deepEqual(playBot(tiny, { attentive: true }), playBot(tiny, { attentive: true }));   // 同一张图跑两次，结果一样
  assert.equal(reviewMap(LEVELS.house).unsupported.includes('多层'), true);
  assert.equal(LEVELS.cottage.rooms.filter(room=>room.outdoor).length,6);
});

test('a map of nothing but walkers in one open room is flagged as playing itself', () => {
  const def = buildMap({ id: 'dull', name: '空地', theme: 'school', layout: ['YYYYYYYYYYYY', 'YYYYYYYYYYYY', 'YYYYYYYYYYYY', 'YYYYYYYYYYYY', 'YYYYYYYYYYYY', 'YYYYYYYYYYYY', 'YYYYYYYYYYYY', 'YYYYYYYYYYYY'],
    rooms: { Y: { id: 'yard', name: '空地', outdoor: true, props: ['blocks@start'], zombies: ['walker', 'walker', 'walker', 'walker', 'walker', 'walker'], pickups: ['heart'] } } });
  const r = reviewMap(def);
  assert.ok(r.bots.runs.lazy.filter(b => b.won && b.hurt <= 1).length >= 2, JSON.stringify(r.bots.runs.lazy.map(b => [b.won, b.hurt])));
  assert.ok(r.tips.some(t => t.level === 'problem' && /无脑打/.test(t.text)));
});

test('the top-down views draw walls, furniture, the spawn and every zombie', () => {
  const text = asciiMap(tiny), svg = svgMap(tiny, { marks: [{ x: 0, z: 0, label: 'x' }] });
  assert.ok(text.includes('@@') && text.includes('##') && text.includes('XX') && text.includes('A ') && text.includes('Gh'));
  assert.equal((svg.match(/<circle [^>]*fill-opacity/g) || []).length, tiny.enemies.length);
  assert.ok(svg.startsWith('<svg') && svg.includes('出生点'));
});

console.log(`${checks} mapkit checks passed`);
