// 博物馆（奇妙夜）。楼上是修复区和织物展厅，蓝宝石移到二楼珍宝库。
//
//   画廊（西北） │ 北走廊 │ 珍宝馆（东北）
//   ─────────────┼────────┼──────────────
//   埃及厅（西） │ 中央大厅（恐龙骨架）│ 自然厅（东）
//   ─────────────┼────────┼──────────────
//   纪念品店     │ 门厅   │ 咖啡厅
//
// 夜里闭馆：月光从天窗和高窗照进来，展品上各有一盏射灯。木乃伊、头骨、恐龙骨架都只是展品，不会动。
// 任务：三件展品被僵尸拿走了（埃及厅的黄金面具、自然厅的恐龙蛋、珍宝馆的蓝宝石），找回来送到恐龙面前。
const front = { minX: -2, maxX: 2, minZ: 4.3, maxZ: 5.8 };
export default {
  id: 'museum',
  name: '博物馆 · 奇妙夜',
  look: 'night',
  bounds: { minX: -14, maxX: 14, minZ: -17, maxZ: 12 },
  stairs: { minX: -1.4, maxX: 1.4, mouthZ: -12, landingZ: -15.6, endZ: -17 },
  height: 4.4,
  wallThickness: 0.3,
  doorHeight: 2.8,
  par: 720,
  player: { x: 0, z: 11.2, yaw: 0 },
  menu: { x: 0, z: 9.4 },   // 开始画面里两个角色站在门厅中间，背后是大厅里的恐龙
  arsenal: ['single', 'scatter', 'yarn', 'jack'],
  mission: { type: 'fetch', title: '找回三件被拿走的展品，送回恐龙面前', alarm: 8, exit: front },
  // 外观：浅色石墙，没有木梁和坡屋顶，灯是贴着天花板的射灯；屋里的环境光是偏蓝的月色。
  theme: {
    wall: 0xe6dfd0, ceiling: 0xd8d4c8, trim: 0xcbbf9f, beams: false, roof: false, lamp: 'spot', night: true,
    // 光照：射灯是暖白的一圈一圈，照不到的地方是月色的蓝；天窗进来的夜空光放大很多倍才看得出
    lampColor: 0xffe6c0, lampPower: 7, lampRange: 8, skyGain: 14, lightAmbient: [0.16, 0.24, 0.44], bounce: null,
    sheer: [0xdfe9ff, 0x9fbdf0, 0.55], lightCell: .7,
  },
  texts: {
    short: '博物馆',
    eyebrow: '第二关 · 博物馆（奇妙夜）',
    title: '闭馆之后，<br>把展品找回来。',
    intro: '一楼找黄金面具和恐龙蛋，再从北走廊上楼找蓝宝石。三件展品送回一楼恐龙面前。',
    brief: '一楼埃及厅找面具，自然厅找恐龙蛋。走北走廊上二楼珍宝库取蓝宝石，再把三件展品送回恐龙面前。',
    how: ['Q 换枪 · E 投掷，G 切换炸弹 · F 换地上的枪 · R 换弹', '弓手：瞄准线变红就换方向 · 炸弹客：离开红圈 · 持盾者：探照灯炮或蓄力球', '从背后打 ×2，趁它没发现再 ×2', '门厅里有一把静电枪 · 其余的枪和弹药包在各个展厅', '每拿起一件展品，附近的僵尸会被惊动', '3 颗心 · 受伤少、12 分钟内送回可得三星'],
    start: '走进博物馆',
    hint: '埃及厅的面具、自然厅的恐龙蛋、二楼珍宝库的蓝宝石',
    got: '找到了！',
    carry: '三件都齐了 · 送回中央大厅的恐龙面前',
    won: '展品都回来了！',
    lostCarrying: '东西都齐了却没送到：回大厅前先把路上的清掉。',
  },

  rooms: [
    { id: 'lobby', name: '门厅', minX: -4, maxX: 4, minZ: 6, maxZ: 12, surface: 'quilt', floor: 0xe6e0d2, accent: 0x7fa3a0 },
    { id: 'shop', name: '纪念品店', minX: -14, maxX: -4, minZ: 6, maxZ: 12, surface: 'terry', floor: 0x9cb89a, accent: 0xd98a6a },
    { id: 'cafe', name: '咖啡厅', minX: 4, maxX: 14, minZ: 6, maxZ: 12, surface: 'boards', floor: 0xcfa873, accent: 0xc65a4e },
    { id: 'hall', name: '中央大厅', minX: -5, maxX: 5, minZ: -4, maxZ: 6, surface: 'quilt', floor: 0xe9e4d8, accent: 0xc9b48f },
    { id: 'egypt', name: '埃及厅', minX: -14, maxX: -5, minZ: -4, maxZ: 6, surface: 'quilt', floor: 0xdcc48f, accent: 0xd9a441 },
    { id: 'nature', name: '自然厅', minX: 5, maxX: 14, minZ: -4, maxZ: 6, surface: 'boards', floor: 0xa98860, accent: 0x6f8f6a },
    { id: 'gallery', name: '画廊', minX: -14, maxX: -2, minZ: -12, maxZ: -4, surface: 'boards', floor: 0xcdb089, accent: 0xa0525a },
    { id: 'corridor', name: '北走廊', minX: -2, maxX: 2, minZ: -12, maxZ: -4, surface: 'quilt', floor: 0xdcd6c8, accent: 0x8f7fa0 },
    { id: 'vault', name: '珍宝馆', minX: 2, maxX: 14, minZ: -12, maxZ: -4, surface: 'terry', floor: 0x6f7fa8, accent: 0x4f5f8f },
    { id: 'stairs', name: '楼梯间', minX: -1.4, maxX: 1.4, minZ: -17, maxZ: -12, tower: true },
  ],

  walls: [
    { z: 6, x: [-14, 14], doors: [[-10.5, -8.7], [-1.6, 1.6], [8.7, 10.5]] },   // 店 ↔ 埃及厅、门厅 ↔ 大厅（大门洞）、咖啡厅 ↔ 自然厅
    { x: -4, z: [6, 12], doors: [[8.2, 10.0]] },                                   // 门厅 ↔ 店
    { x: 4, z: [6, 12], doors: [[8.2, 10.0]] },                                    // 门厅 ↔ 咖啡厅
    { x: -5, z: [-4, 6], doors: [[0, 2.4]] },                                      // 大厅 ↔ 埃及厅
    { x: 5, z: [-4, 6], doors: [[0, 2.4]] },                                       // 大厅 ↔ 自然厅
    { z: -4, x: [-14, 14], doors: [[-11, -9.2], [-1.2, 1.2], [9.2, 11]] },        // 埃及厅 ↔ 画廊、大厅 ↔ 走廊、自然厅 ↔ 珍宝馆
    { x: -2, z: [-12, -4], doors: [[-9.4, -7.6]] },                                // 画廊 ↔ 走廊
    { x: 2, z: [-12, -4], doors: [[-9.4, -7.6]] },                                 // 走廊 ↔ 珍宝馆
  ],

  // 高窗：窗台 1.3 米，窗顶 3.5 米。月亮在东南，南窗和东窗有月光进来。
  windows: [
    { z: 12, at: -2.5, w: 1.6, sill: 1.3, head: 3.5 }, { z: 12, at: 2.5, w: 1.6, sill: 1.3, head: 3.5 },
    { z: 12, at: -5.6, w: 1.6, sill: 1.3, head: 3.5 }, { z: 12, at: 6.6, w: 2.2, sill: 1.3, head: 3.5 }, { z: 12, at: 11.4, w: 2.2, sill: 1.3, head: 3.5 },
    { x: 14, at: 9.0, w: 2.4, sill: 1.5, head: 3.5 }, { x: 14, at: -0.6, w: 1.5, sill: 1.6, head: 3.6 }, { x: 14, at: 2.6, w: 1.5, sill: 1.6, head: 3.6 }, { x: 14, at: -8.0, w: 2.4, sill: 1.3, head: 3.5 },
    { z: -12, at: -10, w: 2.2, sill: 1.3, head: 3.5 }, { z: -12, at: -5, w: 2.2, sill: 1.3, head: 3.5 },
    { x: -14, at: -8, w: 2.4, sill: 1.3, head: 3.5 },
  ],
  lamps: [
    { x: 0, z: 9 },
    { x: -3.3, z: -2.2 }, { x: 3.3, z: -2.2 }, { x: -3.3, z: 3.8 }, { x: 3.3, z: 3.8 },
    { x: -12.4, z: 0.5 }, { x: -7.0, z: 4.0 }, { x: -9.5, z: -2.6 },
    { x: 12.6, z: 1.0 }, { x: 7.2, z: -2.2 }, { x: 7.0, z: 4.2 },
    { x: -11.5, z: -6.2 }, { x: -4.5, z: -10 }, { x: -12.6, z: -10.2 },
    { x: 0, z: -8 },
    { x: 5.5, z: -6.2 }, { x: 8.5, z: -10.2 }, { x: 11.5, z: -6.2 },
    { x: -9, z: 9 }, { x: 9, z: 9 },
  ],
  rugs: [
    { x: 0, z: 8.9, w: 2.4, d: 4.4, color: 0xa0525a }, { x: 0, z: -8, w: 1.6, d: 5.6, color: 0x7a6a9a },
    { x: -8, z: -8, w: 4.6, d: 2.6, color: 0x8a4a52 }, { x: 8.5, z: -6.0, w: 7.6, d: 1.4, color: 0x3f4f80 },
  ],
  // 画：x、z 是墙面上的位置，normal 指向展厅里。画廊里的大一些。
  pictures: [
    { x: -14, z: -10.4, y: 2.0, normal: [1, 0], w: 1.4, h: 1.1, color: 0xf2dfb0 },
    { x: -12.6, z: -4.15, y: 2.0, normal: [0, -1], w: 1.5, h: 1.1, color: 0xe9c9d9 }, { x: -6.8, z: -4.15, y: 2.0, normal: [0, -1], w: 2.2, h: 1.4, color: 0xbfe0d0 }, { x: -3.8, z: -4.15, y: 2.0, normal: [0, -1], w: 1.3, h: 1.1, color: 0xf0d9a8 },
    { x: -2.15, z: -5.8, y: 2.0, normal: [-1, 0], w: 1.6, h: 1.2, color: 0xd9c9a0 }, { x: -2.15, z: -10.8, y: 2.0, normal: [-1, 0], w: 1.4, h: 1.1, color: 0xa9cfe0 },
    { x: -7.5, z: -12, y: 2.0, normal: [0, 1], w: 1.8, h: 1.3, color: 0xf2dfb0 }, { x: -12.4, z: -12, y: 2.0, normal: [0, 1], w: 1.3, h: 1.1, color: 0xe9c9d9 },
    { x: -1.85, z: -6.2, y: 1.9, normal: [1, 0], w: 1.2, h: 0.9, color: 0xbfe0d0 }, { x: 1.85, z: -6.2, y: 1.9, normal: [-1, 0], w: 1.2, h: 0.9, color: 0xf0d9a8 },
    { x: -4.85, z: -2.2, y: 2.1, normal: [1, 0], w: 1.6, h: 1.2, color: 0xd9c9a0 }, { x: 4.85, z: -2.2, y: 2.1, normal: [-1, 0], w: 1.6, h: 1.2, color: 0xa9cfe0 },
    { x: -3.85, z: 7.2, y: 2.0, normal: [1, 0], w: 1.2, h: 0.9, color: 0xf2dfb0 }, { x: 3.85, z: 7.2, y: 2.0, normal: [-1, 0], w: 1.2, h: 0.9, color: 0xe9c9d9 },
  ],
  // 挂在天花板下面的东西（高过头顶，不参与碰撞）
  hangings: [{ kind: 'whale', x: 9.6, z: -1.6, y: 3.3, length: 6.0, along: 'x' }, { kind: 'banner', x: -2.6, z: 5.84, color: 0xa0525a }, { kind: 'banner', x: 2.6, z: 5.84, color: 0x4f5f8f }],

  // w 沿 x，d 沿 z，h 为高度；都贴墙或者离墙至少 0.8 米。item：展台、展柜里摆的是什么。
  furniture: [
    // 门厅
    { id: 'tickets', kind: 'cabinet', look: 'reception', face: 's', x: 2.925, z: 6.55, w: 1.85, d: 0.8, h: 1.1, color: 0x8fa9a6 },
    { id: 'leaflets', kind: 'cabinet', look: 'bookshelf', face: 's', x: -2.925, z: 6.55, w: 1.85, d: 0.8, h: 1.6, color: 0x8fa9a6 },
    { id: 'lobby-bench-w', kind: 'bench', look: 'ottoman', x: -2.95, z: 11.55, w: 1.8, d: 0.9, h: 0.45, color: 0xa0525a },
    { id: 'lobby-bench-e', kind: 'bench', look: 'ottoman', x: 2.95, z: 11.55, w: 1.8, d: 0.9, h: 0.45, color: 0xa0525a },
    // 中央大厅：恐龙骨架，头朝正门；四角四座展台
    { id: 'dino', kind: 'plinth', look: 'dino', face: 's', x: 0, z: 0.8, w: 2.6, d: 6.6, h: 0.5, color: 0xcfc6b0 },
    { id: 'hall-nw', kind: 'plinth', item: 'bust', face: 's', x: -4.4, z: -3.4, w: 0.9, d: 0.9, h: 1.0, color: 0xd9d2c0 },
    { id: 'hall-ne', kind: 'plinth', item: 'vase', face: 's', x: 4.4, z: -3.4, w: 0.9, d: 0.9, h: 1.0, color: 0xd9d2c0 },
    { id: 'hall-sw', kind: 'plinth', item: 'globe', face: 'n', x: -4.4, z: 5.4, w: 0.9, d: 0.9, h: 1.0, color: 0xd9d2c0 },
    { id: 'hall-se', kind: 'plinth', item: 'armor', face: 'n', x: 4.4, z: 5.4, w: 0.9, d: 0.9, h: 0.5, color: 0xd9d2c0 },
    // 埃及厅：靠西墙三口立着的木乃伊棺，中间一口躺着的，北门两侧是阿努比斯
    { id: 'coffin-a', kind: 'sarcophagus', face: 'e', x: -13.6, z: -2.0, w: 0.8, d: 1.1, h: 2.2, color: 0x3f7f86 },
    { id: 'coffin-b', kind: 'sarcophagus', face: 'e', x: -13.6, z: 0.5, w: 0.8, d: 1.1, h: 2.2, color: 0xb0764f },
    { id: 'coffin-c', kind: 'sarcophagus', face: 'e', x: -13.6, z: 3.0, w: 0.8, d: 1.1, h: 2.2, color: 0x4f5f8f },
    { id: 'coffin-lying', kind: 'sarcophagus', look: 'lying', face: 's', x: -9.5, z: 1.0, w: 1.2, d: 2.6, h: 1.0, color: 0xd9a441 },
    { id: 'pyramid', kind: 'plinth', item: 'pyramid', face: 's', x: -5.6, z: -3.4, w: 0.9, d: 0.9, h: 0.8, color: 0xdcc48f },
    { id: 'anubis-w', kind: 'plinth', item: 'anubis', face: 's', x: -12.0, z: -3.4, w: 0.9, d: 0.9, h: 0.6, color: 0xdcc48f },
    { id: 'anubis-e', kind: 'plinth', item: 'anubis', face: 's', x: -8.2, z: -3.4, w: 0.9, d: 0.9, h: 0.6, color: 0xdcc48f },
    { id: 'jars', kind: 'case', item: 'jars', face: 'n', x: -6.15, z: 5.4, w: 2.0, d: 0.9, h: 1.9, color: 0xb9a07c },
    // 自然厅：中间是猛犸头骨，东墙一排头骨，天上吊着鲸鱼骨架
    { id: 'mammoth', kind: 'plinth', item: 'skull-mammoth', face: 'w', x: 9.6, z: 1.0, w: 2.2, d: 2.2, h: 0.6, color: 0xcfc6b0 },
    { id: 'skull-deer', kind: 'plinth', item: 'skull-deer', face: 'w', x: 13.5, z: -2.2, w: 1.0, d: 1.0, h: 1.0, color: 0xcfc6b0 },
    { id: 'skull-cat', kind: 'plinth', item: 'skull-cat', face: 'w', x: 13.5, z: 1.0, w: 1.0, d: 1.0, h: 1.0, color: 0xcfc6b0 },
    { id: 'skull-trike', kind: 'plinth', item: 'skull-trike', face: 'w', x: 13.5, z: 4.2, w: 1.0, d: 1.0, h: 1.0, color: 0xcfc6b0 },
    { id: 'eggs', kind: 'case', item: 'eggs', face: 's', x: 7.2, z: -3.4, w: 2.0, d: 0.9, h: 1.9, color: 0x8fa58a },
    { id: 'shells', kind: 'case', item: 'shells', face: 'n', x: 6.6, z: 5.4, w: 2.2, d: 0.9, h: 1.9, color: 0x8fa58a },
    // 画廊
    { id: 'gallery-bench', kind: 'bench', look: 'ottoman', x: -8, z: -8, w: 2.4, d: 0.9, h: 0.45, color: 0x8a4a52 },
    { id: 'gallery-bust', kind: 'plinth', item: 'bust', face: 'e', x: -12.5, z: -9.0, w: 1.0, d: 1.0, h: 1.1, color: 0xd9d2c0 },
    { id: 'gallery-vase', kind: 'plinth', item: 'vase', face: 's', x: -4.5, z: -6.2, w: 1.0, d: 1.0, h: 1.1, color: 0xd9d2c0 },
    // 北走廊：两副盔甲守在尽头
    { id: 'armor-w', kind: 'plinth', item: 'armor', face: 's', x: -1.4, z: -11.55, w: 0.9, d: 0.9, h: 0.4, color: 0xd9d2c0 },
    { id: 'armor-e', kind: 'plinth', item: 'armor', face: 's', x: 1.4, z: -11.55, w: 0.9, d: 0.9, h: 0.4, color: 0xd9d2c0 },
    // 珍宝馆：三只宝石展柜，北墙一只长柜
    { id: 'gem-a', kind: 'case', item: 'gem-red', x: 5.5, z: -8, w: 1.2, d: 1.2, h: 1.9, color: 0x5f6fa0 },
    { id: 'gem-b', kind: 'case', item: 'gem-empty', x: 8.5, z: -8, w: 1.2, d: 1.2, h: 1.9, color: 0x5f6fa0 },
    { id: 'gem-c', kind: 'case', item: 'gem-green', x: 11.5, z: -8, w: 1.2, d: 1.2, h: 1.9, color: 0x5f6fa0 },
    { id: 'crowns', kind: 'case', item: 'crowns', face: 's', x: 8.0, z: -11.55, w: 4.0, d: 0.9, h: 1.9, color: 0x5f6fa0 },
    { id: 'vault-globe', kind: 'plinth', item: 'globe', face: 'w', x: 13.5, z: -4.65, w: 1.0, d: 1.0, h: 1.0, color: 0xd9d2c0 },
    // 纪念品店
    { id: 'shop-shelf-w', kind: 'cabinet', look: 'bookshelf', face: 'e', x: -13.7, z: 9.0, w: 0.6, d: 3.0, h: 2.0, color: 0xc7a07a },
    { id: 'shop-shelf-s', kind: 'cabinet', look: 'bookshelf', face: 'n', x: -9.0, z: 11.7, w: 4.0, d: 0.6, h: 2.0, color: 0xc7a07a },
    { id: 'shop-till', kind: 'cabinet', look: 'reception', face: 's', x: -6.0, z: 6.55, w: 2.0, d: 0.8, h: 1.1, color: 0xd98a6a },
    { id: 'shop-table', kind: 'bench', look: 'dining', x: -9.5, z: 9.0, w: 1.8, d: 1.2, h: 0.8, color: 0xb58767, accent: 0x7fa3a0 },
    // 咖啡厅
    { id: 'cafe-table-a', kind: 'bench', look: 'dining', x: 7.0, z: 8.4, w: 1.2, d: 1.2, h: 0.78, color: 0xb58767 },
    { id: 'cafe-table-b', kind: 'bench', look: 'dining', x: 10.5, z: 8.4, w: 1.2, d: 1.2, h: 0.78, color: 0xb58767 },
    { id: 'cafe-table-c', kind: 'bench', look: 'dining', x: 8.8, z: 10.6, w: 1.2, d: 1.2, h: 0.78, color: 0xb58767 },
    { id: 'cafe-counter', kind: 'bench', look: 'counter', face: 'w', x: 13.55, z: 8.75, w: 0.9, d: 3.6, h: 0.9, color: 0xd8c9a6 },
    { id: 'cafe-fridge', kind: 'cabinet', look: 'fridge', face: 'w', x: 13.6, z: 6.55, w: 0.8, d: 0.8, h: 1.95, color: 0xb9c7c2 },
  ],

  // 机关（docs/fun-design.md 第 9 节）：这张图用聚光灯，打一下，光圈里的僵尸定住几秒。位置用 node scripts/map.mjs suggest 找的。
  easterEggs: [
    { id: 'dinosaur', x: 0, y: 1.83, z: 0.8, w: 1.7, d: 6.4, h: 2.68, replaces: 'dino' },
    { id: 'cat', x: -12.0, y: 1.06, z: -3.4, w: 0.64, d: 0.54, h: 0.91, replaces: 'anubis-w' },
    { id: 'sailboat', x: -13.958, y: 1.85, z: -5.6, yaw: Math.PI / 2, w: 1.66, d: 0.16, h: 1.21 },
    { id: 'cup', x: 7.03, y: 0.99, z: 8.4, yaw: Math.PI / 2, w: 0.7, d: 0.54, h: 0.46 },
  ],
  gadgets: [
    { kind: 'spot', x: -3.3, z: 2.7 },      // 中央大厅,
  ],

  enemies: [
    // 门厅：售票台后面睡着一只，开局碰不到
    { type: 'walker', x: 2.6, z: 8.0, state: 'asleep', heading: Math.PI },
    // 中央大厅
    { type: 'archer', x: -3.0, z: -3.0, state: 'idle', heading: 0, patrol: [[3.0, -3.0], [-3.0, -3.0]] },   // 中央大厅北头：大厅里的展台能挡箭
    { type: 'leaper', x: -3.2, z: 4.4, state: 'idle', heading: Math.PI, patrol: [[-3.2, -1.2], [-3.2, 4.4]] },
    { type: 'leaper', x: 3.4, z: 2.4, state: 'asleep', heading: -Math.PI / 2 },
    // 埃及厅
    { type: 'heavy', x: -11.4, z: -0.8, state: 'idle', heading: Math.PI / 2 },
    { type: 'bomber', x: -12.0, z: 4.9, state: 'asleep', heading: Math.PI / 2 },
    { type: 'leaper', x: -7.0, z: -2.4, state: 'idle', heading: 0, patrol: [[-7.0, 3.6], [-7.0, -2.4]] },
    { type: 'leaper', x: -10.2, z: -2.0, state: 'asleep', heading: 0 },
    { type: 'walker', x: -8.6, z: 4.6, state: 'asleep', heading: Math.PI },
    // 自然厅
    { type: 'leaper', x: 6.4, z: -1.6, state: 'idle', heading: Math.PI / 2, patrol: [[12.0, -1.6], [6.4, -1.6]] },
    { type: 'archer', x: 11.8, z: 3.0, state: 'idle', heading: -Math.PI / 2 },
    { type: 'heavy', x: 7.0, z: 2.6, state: 'asleep', heading: Math.PI / 2 },
    { type: 'leaper', x: 11.6, z: 5.0, state: 'idle', heading: -Math.PI / 2 },
    // 画廊
    { type: 'walker', x: -12.5, z: -5.2, state: 'idle', heading: Math.PI / 2, patrol: [[-3.2, -5.2], [-12.5, -5.2]] },
    { type: 'leaper', x: -12.8, z: -11.2, state: 'asleep', heading: Math.PI / 2 },
    { type: 'walker', x: -5.0, z: -10.6, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'bomber', x: -9.0, z: -10.6, state: 'idle', heading: 0 },
    // 北走廊
    { type: 'shielded', x: 0, z: -7.0, state: 'idle', heading: 0 },   // 北走廊：正面过不去
    // 珍宝馆
    { type: 'heavy', x: 8.5, z: -5.6, state: 'idle', heading: -Math.PI / 2 },
    { type: 'walker', x: 12.8, z: -10.4, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'leaper', x: 3.4, z: -6.0, state: 'idle', heading: Math.PI, patrol: [[3.4, -10.6], [3.4, -6.0]] },
    { type: 'shielded', x: 12.8, z: -6.4, state: 'idle', heading: -Math.PI / 2 },
    // 纪念品店
    { type: 'walker', x: -12.0, z: 7.2, state: 'asleep', heading: Math.PI / 2 },
    { type: 'archer', x: -6.4, z: 10.4, state: 'idle', heading: -Math.PI / 2 },
    // 咖啡厅
    { type: 'walker', x: 5.6, z: 10.9, state: 'asleep', heading: Math.PI / 2 },
    { type: 'leaper', x: 11.2, z: 11.0, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'walker', x: 7.8, z: 7.1, state: 'idle', heading: Math.PI / 2, patrol: [[12.2, 7.1], [7.8, 7.1]] },   // 巡到 7.8 就回头：再往西会从门里看见正门口
  ],

  pickups: [
    // 拉链暗格：打一下墙上的拉链（stash），里面的东西掉在墙脚（x, z）
    { kind: 'heart', amount: 1, x: -12.37, z: 11.4, stash: { x: -12.37, z: 12, normal: [0, -1] } },   // 纪念品店南墙,
    { kind: 'ammo', x: 2.65, z: -3.25, stash: { x: 2.65, z: -3.85, normal: [0, 1] } },              // 中央大厅北墙,
    { kind: 'ammo', weapon: 'yarn', amount: 1, x: 2.75, z: -10.35, stash: { x: 2.15, z: -10.35, normal: [1, 0] } },   // 珍宝馆西墙,
    { kind: 'objective', item: 'mask', name: '黄金面具', x: -11.4, z: 1.0 },
    { kind: 'objective', item: 'egg', name: '恐龙蛋', x: 12.2, z: 1.0 },
    { kind: 'weapon', weapon: 'stun', amount: 4, x: 1.3, z: 9.8 },
    { kind: 'weapon', weapon: 'sewing', amount: 48, x: -12.6, z: 10.9 },
    { kind: 'weapon', weapon: 'needle', amount: 6, x: -13.2, z: -5.0 },
    { kind: 'ammo', weapon: 'yarn', amount: 1, x: 13.2, z: 11.4 },
    { kind: 'ammo', weapon: 'yarn', amount: 1, x: -13.3, z: 5.0 },
    { kind: 'ammo', x: 4.3, z: 1.2 },
    { kind: 'ammo', x: -3.0, z: -11.2 },
    { kind: 'weapon', weapon: 'heavy', amount: 3, x: 13.3, z: -11.3 },
    { kind: 'ammo', x: 5.9, z: -1.2 },
    { kind: 'heart', amount: 1, x: 0, z: -10.4 },
    { kind: 'heart', amount: 1, x: -5.0, z: 10.8 },
  ],
  upper: [{
    rooms: [
      { id: 'archive', name: '档案室', minX: -14, maxX: -3, minZ: -12, maxZ: -5, surface: 'boards', floor: 0xc4a073, accent: 0x907966 },
      { id: 'landing', name: '二楼门厅', minX: -3, maxX: 3, minZ: -12, maxZ: -5, surface: 'quilt', floor: 0xc3b8c9, accent: 0x8d7f9d },
      { id: 'restoration', name: '修复工坊', minX: 3, maxX: 14, minZ: -12, maxZ: -5, surface: 'boards', floor: 0x9bada5, accent: 0x608078 },
      { id: 'textiles', name: '织物展厅', minX: -14, maxX: -3, minZ: -5, maxZ: 12, surface: 'quilt', floor: 0xa9868e, accent: 0x8d6474 },
      { id: 'upper-gallery', name: '二楼展廊', minX: -3, maxX: 3, minZ: -5, maxZ: 12, surface: 'boards', floor: 0xc5ac91, accent: 0xa48b77 },
      { id: 'upper-vault', name: '珍宝库', minX: 3, maxX: 14, minZ: -5, maxZ: 12, surface: 'terry', floor: 0x777d9a, accent: 0x706596 },
    ],
    walls: [
      { z: -5, x: [-14, 14], doors: [[-9.8,-7.4],[-1.3,1.3],[7.5,10]] },
      { x: -3, z: [-12, 12], doors: [[-9,-6.7],[-1.7,.7],[7.2,9.5]] },
      { x: 3, z: [-12, 12], doors: [[-9,-6.7],[-1.7,.7],[7.2,9.5]] },
    ],
    skylights: [
      { x:0, z:1, w:2.6, d:5.6 },
      { x:-8.3, z:1.5, w:3.7, d:2.6 },
      { x:9.6, z:6.9, w:2.7, d:3.2 },
    ],
    lamps: [{x:0,z:-9},{x:-9,z:-8},{x:9,z:-8},{x:0,z:-3.15},{x:0,z:8},{x:-8,z:-1.75},{x:-10,z:8},{x:8,z:1},{x:10,z:10}],
    rugs: [
      { x:0, z:3.2, w:2.5, d:13.2, color:0x6d647e },
      { x:-8.8, z:-8.2, w:5.4, d:2.6, color:0xa17f65 },
      { x:-9.2, z:6.5, w:4.7, d:2.9, color:0x7d5264 },
      { x:10.5, z:9.5, w:3.8, d:3.3, color:0x4f567e },
    ],
    pictures: [
      { x:-9.7, z:-12, y:2.05, normal:[0,1], w:2.4, h:1.25, color:0xc8a975 },
      { x:9.8, z:-12, y:2.10, normal:[0,1], w:2.65, h:1.25, color:0x76988d },
      { x:-14, z:1.5, y:2.1, normal:[1,0], w:2.3, h:1.35, color:0xc09098 },
      { x:-14, z:6.0, y:2.1, normal:[1,0], w:1.95, h:1.2, color:0xbe9f7e },
      { x:14, z:8.4, y:2.1, normal:[-1,0], w:2.1, h:1.2, color:0x8293b6 },
    ],
    furniture: [
      { id:'rolls', kind:'cabinet', look:'bookshelf', x:-12.7, z:-8.1, w: .8, d: 4, h:2, color:0x9a7458 },
      { id:'repair-a', kind:'bench', look:'labbench', x:7, z:-9.9, w:3, d:1.1, h:.95, color:0x9c8066 },
      { id:'repair-b', kind:'case', item:'jars', x:11.4, z:-7.1, w:1.1, d:2.2, h:1.95, color:0x75958d },
      { id:'textile-a', kind:'case', item:'crowns', x:-9.8, z:-.7, w:4.3, d:1.2, h:1.7, color:0xaa7c85 },
      { id:'textile-b', kind:'bench', look:'ottoman', x:-8.8, z:6.7, w:3.2, d:1.5, h:.65, color:0xab8c95 },
      { id:'gallery-bench-upper', kind:'bench', look:'ottoman', x:0, z:4, w:2.5, d:1, h:.52, color:0x8e697c },
      { id:'vault-case-upper', kind:'case', item:'gem-green', x:8.7, z:1.6, w:2.4, d:1.4, h:1.9, color:0x666d93 },
      { id:'vault-turn', kind:'case', item:'gem-red', x:9.7, z:7.5, w:1.75, d:2.5, h:1.9, color:0x7375a0 },
      { id:'vault-display', kind:'plinth', item:'gem-empty', x:12.25, z:9.9, w:1.1, d:1.1, h:.65, color:0xc7a56a },
    ],
    enemies: [
      { type:'walker', x:-6, z:-9.6, state:'asleep' },
      { type:'crawler', x:-8.5, z:1.4, state:'asleep' },
      { type:'archer', x:-10.6, z:9.4, heading:-1.7, state:'idle' },
      { type:'bomber', x:11.2, z:-10.6, heading:-1.6, state:'idle' },
      { type:'walker', x:5.2, z:-6.7, state:'asleep' },
      { type:'shielded', x:0, z:6.3, heading:Math.PI, state:'idle' },
      { type:'heavy', x:10.1, z:-2.5, heading:-1.6, state:'idle' },
      { type:'boss-leech', x:11.6, z:5.4, heading:Math.PI, state:'asleep' },
    ],
    pickups: [
      { kind:'objective', item:'gem', name:'蓝宝石', x:11.1, z:10 },
      { kind:'ammo', x:-10.8, z:-7 },
      { kind:'weapon', weapon:'needle', amount:5, x:1.95, z:-8.7 },
      { kind:'heart', amount:1, x:-12.2, z:4.5 },
    ],
  }],
};
