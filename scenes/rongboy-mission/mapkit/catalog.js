// 地图词汇表：草图里能写的家具、主题、僵尸、拾取物。生成器（build.js）、检查（check.js）和说明文档都从这里取。
// 新增一种家具要先在 world.js 的 furniture() 里能画出来，再到这里登记；这里登记了但 world.js 不认识的名字会画成一只箱子。
// 不依赖 DOM。

// size：[沿墙的长度, 进深, 高]（米）。贴墙放时"沿墙的长度"顺着墙，独立放时顺着房间的长边。
// 高度决定它算哪种掩体（见 coverOf）。set：属于哪套布景；where：'in' 室内、'out' 室外、'any' 都行。
const P = (set, kind, size, color, more = {}) => ({ set, kind, size, color, where: 'in', ...more });
export const PROPS = {
  // ---- 家
  sofa:        P('home', 'sofa', [2.2, 1.0, 0.85], 0xb79c77, { note: '沙发' }),
  bed:         P('home', 'bed', [1.6, 2.2, 0.55], 0xbfa8cf, { note: '床，床头靠墙' }),
  coffee:      P('home', 'bench', [1.2, 1.2, 0.45], 0xc09b70, { look: 'coffee', note: '茶几（很矮，不算掩体）' }),
  dining:      P('home', 'bench', [1.2, 1.2, 0.78], 0xb58767, { look: 'dining', note: '铺格子布的餐桌' }),
  desk:        P('home', 'bench', [2.2, 0.9, 0.78], 0xb58a62, { look: 'desk', note: '书桌' }),
  console:     P('home', 'bench', [1.2, 0.7, 0.9], 0xc09b70, { look: 'console', note: '玄关桌' }),
  counter:     P('home', 'bench', [3.6, 0.7, 0.9], 0xd8c9a6, { look: 'counter', note: '台面 / 操作台' }),
  island:      P('home', 'bench', [2.2, 0.9, 0.9], 0xd8c9a6, { look: 'island', note: '厨房中岛' }),
  tub:         P('home', 'bench', [2.2, 1.1, 0.62], 0xf6f3ec, { look: 'tub', note: '浴缸' }),
  vanity:      P('home', 'bench', [1.8, 0.7, 0.9], 0xd8c9a6, { look: 'vanity', note: '洗手台，墙上带镜子' }),
  cabinet:     P('home', 'cabinet', [1.4, 0.6, 1.0], 0x829b90, { note: '矮柜，上面一盆花' }),
  bookshelf:   P('home', 'cabinet', [2.2, 0.6, 2.0], 0xc7a07a, { look: 'bookshelf', note: '书架（高掩体）' }),
  fridge:      P('home', 'cabinet', [0.8, 0.8, 1.95], 0xb9c7c2, { look: 'fridge', note: '冰箱（高掩体）' }),
  tv:          P('home', 'cabinet', [1.4, 0.6, 1.0], 0x8a7a6a, { look: 'tv', note: '电视柜' }),
  wardrobe:    P('home', 'cabinet', [1.8, 0.7, 2.1], 0xb58a62, { look: 'wardrobe', note: '衣柜（高掩体）' }),
  chest:       P('home', 'crate', [1.4, 0.7, 0.7], 0xb58a62, { look: 'chest', note: '木箱' }),
  nightstand:  P('home', 'crate', [0.5, 0.5, 0.6], 0xc09b70, { look: 'nightstand', note: '床头柜带台灯' }),
  basket:      P('home', 'crate', [0.9, 1.0, 0.8], 0xc9a67a, { look: 'basket', note: '装布卷的藤篮' }),
  crate:       P('home', 'crate', [1.0, 1.0, 1.0], 0xad8970, { where: 'any', note: '箱子（齐腰掩体）' }),
  kennel:      P('home', 'crate', [1.2, 1.2, 1.0], 0xb58a62, { look: 'kennel', where: 'out', note: '狗屋' }),
  mailbox:     P('home', 'crate', [0.4, 0.4, 1.1], 0xc65a4e, { look: 'mailbox', where: 'out', note: '信箱' }),
  shed:        P('home', 'cabinet', [2.2, 1.8, 2.3], 0xb58a62, { look: 'shed', where: 'out', note: '花园工具房（高掩体）' }),
  hedge:       P('home', 'hedge', [3.2, 0.7, 1.0], 0x6d8f60, { where: 'out', note: '矮树篱；写 h: 1.7 就是挡视线的高树篱' }),
  tree:        P('home', 'tree', [0.7, 0.7, 2.6], 0xb58a62, { where: 'out', note: '树（细，挡不住多少）' }),
  planter:     P('home', 'planter', [3.0, 0.8, 0.45], 0xf2a6b8, { where: 'out', note: '花坛（很矮）' }),
  bench:       P('home', 'bench', [2.0, 0.6, 0.5], 0x8fc3e8, { look: 'bench', where: 'any', note: '长椅' }),
  // ---- 博物馆
  ottoman:     P('museum', 'bench', [2.0, 0.9, 0.45], 0xa0525a, { look: 'ottoman', note: '软凳' }),
  reception:   P('museum', 'cabinet', [2.0, 0.8, 1.1], 0x8fa9a6, { look: 'reception', note: '接待台 / 收银台' }),
  bust:        P('museum', 'plinth', [1.0, 1.0, 1.1], 0xd9d2c0, { item: 'bust', note: '展台：半身像' }),
  vase:        P('museum', 'plinth', [1.0, 1.0, 1.1], 0xd9d2c0, { item: 'vase', note: '展台：花瓶' }),
  globe:       P('museum', 'plinth', [1.0, 1.0, 1.0], 0xd9d2c0, { item: 'globe', note: '展台：地球仪' }),
  pyramid:     P('museum', 'plinth', [0.9, 0.9, 0.8], 0xdcc48f, { item: 'pyramid', note: '展台：金字塔' }),
  anubis:      P('museum', 'plinth', [0.9, 0.9, 0.6], 0xdcc48f, { item: 'anubis', note: '展台：阿努比斯像' }),
  armor:       P('museum', 'plinth', [0.9, 0.9, 0.4], 0xd9d2c0, { item: 'armor', note: '展台：盔甲（人那么高）' }),
  'skull-deer':    P('museum', 'plinth', [1.0, 1.0, 1.0], 0xcfc6b0, { item: 'skull-deer', note: '展台：鹿头骨' }),
  'skull-cat':     P('museum', 'plinth', [1.0, 1.0, 1.0], 0xcfc6b0, { item: 'skull-cat', note: '展台：剑齿虎头骨' }),
  'skull-trike':   P('museum', 'plinth', [1.0, 1.0, 1.0], 0xcfc6b0, { item: 'skull-trike', note: '展台：三角龙头骨' }),
  'skull-mammoth': P('museum', 'plinth', [2.2, 2.2, 0.6], 0xcfc6b0, { item: 'skull-mammoth', note: '大展台：猛犸头骨' }),
  dino:        P('museum', 'plinth', [2.6, 6.6, 0.5], 0xcfc6b0, { look: 'dino', note: '恐龙骨架（很长，放大厅中间）' }),
  'case-jars':   P('museum', 'case', [2.0, 0.9, 1.9], 0xb9a07c, { item: 'jars', note: '展柜：陶罐（高掩体）' }),
  'case-eggs':   P('museum', 'case', [2.0, 0.9, 1.9], 0x8fa58a, { item: 'eggs', note: '展柜：恐龙蛋（高掩体）' }),
  'case-shells': P('museum', 'case', [2.2, 0.9, 1.9], 0x8fa58a, { item: 'shells', note: '展柜：贝壳（高掩体）' }),
  'case-crowns': P('museum', 'case', [4.0, 0.9, 1.9], 0x5f6fa0, { item: 'crowns', note: '长展柜：王冠（高掩体）' }),
  'case-gem':    P('museum', 'case', [1.2, 1.2, 1.9], 0x5f6fa0, { item: 'gem-red', note: '方展柜：宝石（高掩体）；item 可写 gem-green、gem-empty' }),
  sarcophagus: P('museum', 'sarcophagus', [1.1, 0.8, 2.2], 0x3f7f86, { note: '立着的木乃伊棺（高掩体）' }),
  'sarcophagus-lying': P('museum', 'sarcophagus', [1.2, 2.6, 1.0], 0xd9a441, { look: 'lying', note: '躺着的木乃伊棺' }),
  // ---- 学校
  'desk-kid':  P('school', 'bench', [0.9, 1.2, 0.72], 0xf2c84b, { look: 'desk-kid', note: '课桌椅' }),
  podium:      P('school', 'bench', [1.8, 1.0, 0.95], 0xf2c84b, { look: 'podium', note: '讲台' }),
  locker:      P('school', 'cabinet', [2.4, 0.5, 1.8], 0x8fc3e8, { look: 'locker', note: '一组彩色储物柜（高掩体）' }),
  easel:       P('school', 'crate', [1.0, 0.8, 1.6], 0xf2c84b, { look: 'easel', note: '画架（高掩体）' }),
  palette:     P('school', 'bench', [2.4, 1.6, 0.72], 0xf2a6b8, { look: 'palette', note: '调色盘大桌' }),
  labbench:    P('school', 'bench', [2.6, 1.0, 0.9], 0xf6f3ec, { look: 'labbench', note: '实验台' }),
  skeleton:    P('school', 'plinth', [1.0, 1.0, 0.3], 0xb8d86a, { look: 'skeleton', note: '骨架模型' }),
  slide:       P('school', 'crate', [1.2, 3.4, 1.7], 0xf2c84b, { look: 'slide', where: 'out', note: '滑梯（高掩体）' }),
  swing:       P('school', 'bench', [3.0, 1.0, 0.5], 0xef7b6b, { look: 'swing', where: 'out', note: '秋千' }),
  playhouse:   P('school', 'crate', [2.2, 2.2, 1.8], 0x8fc3e8, { look: 'playhouse', where: 'out', note: '游戏小屋（高掩体）' }),
  seesaw:      P('school', 'bench', [2.8, 0.6, 0.6], 0x9fd8a4, { look: 'seesaw', where: 'out', note: '跷跷板' }),
  blocks:      P('school', 'crate', [3.0, 1.0, 2.0], 0xf2c84b, { look: 'blocks', where: 'any', note: '积木墙（高掩体，适合挡在出生点前面）' }),
};

// 掩体分三档（Level Design Book：齐腰 1.0–1.25 米是矮掩体，1.75 米以上是高掩体，膝盖以下不算）。
// 这个游戏里眼睛在 1.2 米：高过 1.3 米的东西挡视线、挡箭；0.6–1.3 米的挡身体和贴地的炸弹，站着能越过去开枪。
export const coverOf = h => (h >= 1.3 ? 'tall' : h >= 0.6 ? 'low' : 'none');

// 主题：一整套外观。look 是光线预设（looks.js），theme 交给 world.js，window / picture 是自动开窗、挂画时用的高度。
// floors：自动给房间配的地面 [surface, floor 颜色, accent 墙裙颜色]，按房间顺序轮着用；草图里写了就用草图的。
export const THEMES = {
  home: {
    name: '家', look: 'afternoon', height: 2.8, wallThickness: 0.2, doorHeight: 2.05, door: 1.5,
    theme: { facadeTrim: true },
    window: { sill: 1.0, head: 2.1, max: 2.0 }, pictureY: 1.7, yardFloor: 0x86a765,
    floors: [['boards', 0xd6b383, 0xd49a78], ['boards', 0xcfa873, 0x9db79a], ['quilt', 0xeadcc2, 0xe8c877], ['boards', 0xd2b49c, 0xbfa8cf], ['boards', 0xb39068, 0x86aaa6], ['terry', 0xbcd0c8, 0x8fb8c0]],
    pictures: [0xf2dfb0, 0xa9cfe0, 0xe9c9d9, 0xbfe0d0],
  },
  museum: {
    name: '博物馆', look: 'night', height: 4.4, wallThickness: 0.3, doorHeight: 2.8, door: 1.8,
    theme: { wall: 0xe6dfd0, ceiling: 0xd8d4c8, trim: 0xcbbf9f, beams: false, roof: false, lamp: 'spot', night: true,
      lampColor: 0xffe6c0, lampPower: 7, lampRange: 8, skyGain: 14, lightAmbient: [0.16, 0.24, 0.44], bounce: null, sheer: [0xdfe9ff, 0x9fbdf0, 0.55] },
    window: { sill: 1.3, head: 3.5, max: 2.2 }, pictureY: 2.0, yardFloor: 0x7f9a78,
    floors: [['quilt', 0xe6e0d2, 0x7fa3a0], ['quilt', 0xdcc48f, 0xd9a441], ['boards', 0xa98860, 0x6f8f6a], ['boards', 0xcdb089, 0xa0525a], ['terry', 0x6f7fa8, 0x4f5f8f], ['boards', 0xcfa873, 0xc65a4e]],
    pictures: [0xa9cfe0, 0xf2dfb0, 0xe9c9d9, 0xbfe0d0, 0xd9c9a0],
  },
  school: {
    name: '学校', look: 'morning', height: 2.8, wallThickness: 0.2, doorHeight: 2.05, door: 1.6,
    theme: { wall: 0xfff0c4, ceiling: 0xfffaf0, roofColor: 0xef7b6b, beams: false, yard: 'playground', rainbow: true, lawn: 0xb4dc8c, lampPower: 8, skyGain: 6 },
    window: { sill: 1.0, head: 2.1, max: 2.4 }, pictureY: 1.65, yardFloor: 0xb4dc8c,
    floors: [['boards', 0xecc98c, 0x9fd8c4], ['boards', 0xe6c088, 0x8fc3e8], ['quilt', 0xf6ecd6, 0xf2a6b8], ['quilt', 0xe2f0e6, 0xb8d86a], ['boards', 0xf0d8a8, 0xf2c84b], ['terry', 0xd6e6f2, 0xef7b6b]],
    pictures: [0xf2dfb0, 0xa9cfe0, 0xf2c9d6, 0xbfe0d0],
  },
};
export const SURFACES = ['boards', 'quilt', 'terry'];

// 僵尸：role 是它出的题（docs/fun-design.md 2.3）；answer 是地图上应该给玩家备着的枪（没有也打得过，但会很磨）。
// special：算"需要单独教"的种类，一个房间一次只引入一种。ranged：远程，它看得到的地方附近要有掩体。
export const ZOMBIES = {
  walker:   { name: '跳跳', role: '走过来碰你', special: false },
  leaper:   { name: '跃行者', role: '蓄一下再扑一大段', special: false },
  heavy:    { name: '棉甲', role: '正面只吃一半伤害，要绕后', special: true, answer: 'needle' },
  archer:   { name: '弓手', role: '远处拉弓射箭', special: true, ranged: true },
  bomber:   { name: '炸弹客', role: '往你脚下扔炸弹', special: true, ranged: true },
  shielded: { name: '持盾者', role: '正面挡普通毛球，蓄势盾冲', special: true, answer: 'heavy' },
  crawler:  { name: '爬行者', role: '贴地扑抓（还没进过正式地图）', special: true, untested: true },
  'boss-warden': { name: '守墓巨像', role: '首领：震地、召援（还没进过正式地图）', special: true, untested: true },
  'boss-leech':  { name: '噬连兽', role: '首领：吸引扇区（还没进过正式地图）', special: true, untested: true },
};

// 地上的枪默认带多少备弹（和现有三张图一致）。手枪和毛线团不在这里：手枪开局就有，毛线团写 'yarn'。
export const GUNS = { scatter: 6, heavy: 3, stun: 4, sewing: 48, needle: 6 };
export const OBJECTIVE_ITEMS = ['basket', 'mask', 'egg', 'gem'];
