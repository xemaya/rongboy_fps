// 家：三层楼 + 花园。米制；x 向东，z 向南；玩家从南侧院门进入，面朝北。
// 房子占 x∈[-9,9]、z∈[-9,3]，花园占 z∈[3,11]；楼梯间是房子北面凸出去的竖井，从每层门厅 / 走廊的北头进。
// 这个对象本身是一层；upper 是二层和三层（格式一样，没有花园）。层高 3 米（净高 2.8 + 楼板 0.2）。
const garden = { minX: -1.5, maxX: 1.5, minZ: 9.4, maxZ: 11 };
export default {
  id: 'house',
  name: '绒仔家 · 三层楼与花园',
  look: 'afternoon',
  // 界面上的文案
  texts: {
    short: '绒仔家',
    eyebrow: '第一关 · 绒仔家（三层楼与花园）',
    title: '上阁楼，<br>把毛线篮拿回来。',
    intro: '僵尸把毛线篮藏进了三楼的藏宝间。整栋楼一共 36 只，不必都打倒：它们有的睡着，有的在巡逻，还没发现你。拿到篮子会惊动整层阁楼，再带着它回到院门。',
    how: ['Q 换枪 · E 投掷，G 切换炸弹 · F 换地上的枪 · R 换弹', '手里两把：手枪弹药无限，另一把在屋里换着用', '弓手：瞄准线变红就换个方向走，或躲到墙后', '炸弹客：离开红圈 · 持盾者：探照灯炮或蓄力球破防', '从背后打 ×2，趁它没发现再 ×2 · 棉甲要绕后或用毛衣针', '楼梯在门厅尽头 · 3 颗心 · 受伤少、8 分钟内带回可得三星'],
    start: '进入花园',
    hint: '毛线篮在三楼的藏宝间 · 楼梯在门厅尽头',
    brief: '从门厅尽头上楼，到三楼藏宝间拿回毛线篮，再带回院门。途中可以绕过僵尸。',
    route: '去三楼藏宝间找毛线篮 · 楼梯在门厅尽头',
    got: '拿到毛线篮了！',
    emerge: '守墓巨像醒了 · 躲开震地，带篮子下楼',
    carry: '带着毛线篮回到院门',
    won: '带回来了！',
    lostCarrying: '拿到篮子后整层楼都醒了：先把楼梯口清出来再拿。',
  },
  bounds: { minX: -9, maxX: 9, minZ: -12.5, maxZ: 11 },
  height: 2.8,
  storeyHeight: 3,
  wallThickness: 0.2,
  doorHeight: 2.05,
  par: 480,
  player: { x: 0, z: 10, yaw: 0 },
  // 任务：上到阁楼的藏宝间拿回毛线篮，再带回院门。拿起它会惊动 alarm 米以内的僵尸（隔着楼板减半：差不多是整个三楼，加上正下方的一两只）。
  // 想改回"清空全部"只要换成 { type: 'clear', title: '清空整栋房子里的僵尸' }。
  mission: { type: 'fetch', title: '上阁楼找回毛线篮，带回院门', alarm: 13, exit: garden },
  // 开局带的：手枪、一把特殊枪（霰弹）、手雷。手里只拿得下两把，其余的特殊枪在屋里（pickups 里 kind: 'weapon'），走到跟前按 F 换。
  arsenal: ['single', 'scatter', 'yarn', 'jack'],
  // 折返楼梯：西边一跑往北上到半层平台，东边一跑往南上到上一层。
  stairs: { minX: -1.4, maxX: 1.4, mouthZ: -9, landingZ: -11.2, endZ: -12.5 },

  rooms: [
    // surface / floor：地面的织物和颜色；accent：这个房间的墙裙颜色，用来一眼认出在哪个房间。
    { id: 'garden', name: '花园', minX: -9, maxX: 9, minZ: 3, maxZ: 11, outdoor: true, floor: 0x86a765 },
    { id: 'hall', name: '门厅', minX: -1.5, maxX: 1.5, minZ: -9, maxZ: 3, surface: 'boards', floor: 0xd6b383, accent: 0xd49a78 },
    { id: 'living', name: '客厅', minX: -9, maxX: -1.5, minZ: -3, maxZ: 3, surface: 'boards', floor: 0xcfa873, accent: 0x9db79a },
    { id: 'kitchen', name: '厨房', minX: -9, maxX: -1.5, minZ: -9, maxZ: -3, surface: 'quilt', floor: 0xeadcc2, accent: 0xe8c877 },
    { id: 'bedroom', name: '卧室', minX: 1.5, maxX: 9, minZ: -3, maxZ: 3, surface: 'boards', floor: 0xd2b49c, accent: 0xbfa8cf },
    { id: 'study', name: '书房', minX: 1.5, maxX: 9, minZ: -9, maxZ: -3, surface: 'boards', floor: 0xb39068, accent: 0x86aaa6 },
    { id: 'stairs', name: '楼梯间', minX: -1.5, maxX: 1.5, minZ: -12.5, maxZ: -9, tower: true },
  ],

  // 一道墙沿一条轴线走；doors 是墙上的门洞区间（沿墙方向的坐标）。
  walls: [
    { x: -1.5, z: [-9, 3], doors: [[-6.6, -5.1], [-0.9, 0.6]] },   // 门厅西墙：厨房门、客厅门
    { x: 1.5, z: [-9, 3], doors: [[-7.0, -5.5], [0.2, 1.7]] },     // 门厅东墙：书房门、卧室门
    { z: -3, x: [-9, -1.5], doors: [[-6.6, -5.1]] },               // 客厅 ↔ 厨房
    { z: -3, x: [1.5, 9], doors: [[5.2, 6.7]] },                   // 卧室 ↔ 书房
    { z: 3, x: [-9, 9], doors: [[-6.2, -4.7], [-0.75, 0.75]] },    // 南立面：客厅落地门、正门
  ],

  // 以下四项只影响画面，不参与碰撞和视线：窗是墙上的洞加一层纱帘（阳光能进来，毛球和僵尸的视线照旧被墙挡住）。
  // 窗：x 或 z 是所在墙线，at 是沿墙的中心，w 是宽；sill / head 是窗台和窗顶高度（默认 1.0 / 2.1）。
  windows: [
    { x: -9, at: 1.4, w: 1.8 }, { x: -9, at: -5.2, w: 1.8 },                                   // 西：客厅、厨房
    { z: -9, at: -5.5, w: 2.0, sill: 1.3 }, { z: -9, at: 6.3, w: 1.8 },                         // 北：厨房、书房
    { x: 9, at: 0.9, w: 1.6 },                                                                    // 东：卧室
    { z: 3, at: 4.6, w: 2.0 }, { z: 3, at: -2.9, w: 1.6 },                                     // 南立面：卧室、客厅
  ],
  lamps: [
    { x: -5.25, z: 0 }, { x: -5.4, z: -6.0 }, { x: 5.25, z: 0 }, { x: 5.25, z: -6.0 }, { x: 0, z: 0.4 }, { x: 0, z: -5.0 },
  ],
  rugs: [
    { x: -4.6, z: -0.3, w: 3.4, d: 2.6, color: 0x8fa98c }, { x: 4.3, z: 0.9, w: 2.2, d: 3.0, color: 0xb59cc6 },
    { x: 5.6, z: -6.0, w: 3.2, d: 2.2, color: 0x7a9d99 }, { x: 0, z: -2.6, w: 1.3, d: 6.0, color: 0xc98a68 },
    { x: -5.4, z: -7.55, w: 2.4, d: 0.7, color: 0xd9b45c }, { x: 0, z: 3.75, w: 1.3, d: 0.7, color: 0xc0705a },
  ],
  // 挂画：x、z 是墙面上的位置，normal 指向房间里。
  pictures: [
    { x: 1.4, z: -3.6, y: 1.55, normal: [-1, 0], color: 0x9fc3e0 }, { x: -1.4, z: -3.0, y: 1.55, normal: [1, 0], w: 0.5, h: 0.6, color: 0xf0d9a8 },
    { x: -3.7, z: -2.9, y: 1.6, normal: [0, 1], w: 0.9, h: 0.6, color: 0xa9cfe0 }, { x: -8.0, z: -2.9, y: 1.6, normal: [0, 1], w: 0.5, h: 0.5, color: 0xf0d9a8 },
    { x: 3.4, z: -2.9, y: 1.55, normal: [0, 1], w: 0.7, h: 0.5, color: 0xe9c9d9 }, { x: 7.5, z: -2.9, y: 1.6, normal: [0, 1], w: 0.5, h: 0.6, color: 0xbfe0d0 },
    { x: -3.4, z: -3.1, y: 1.6, normal: [0, -1], w: 0.8, h: 0.55, color: 0xf2dfb0 }, { x: 3.0, z: -3.1, y: 1.65, normal: [0, -1], w: 0.6, h: 0.45, color: 0xa9cfe0 },
    { x: 1.6, z: -4.2, y: 1.6, normal: [1, 0], w: 0.6, h: 0.45, color: 0xd9c9a0 },
  ],

  // w 沿 x，d 沿 z，h 为高度。look：外形（不写就按 kind 的默认外形）；face：正面朝向 n/s/e/w（北是 -z）。低于眼高（1.23）的可以越顶射击。
  // 家具要么贴墙，要么离墙至少 0.8 米：不留只有玩家挤得进、僵尸进不去的缝（自动检查会查）。
  furniture: [
    // 花园
    { id: 'hedge-west', kind: 'hedge', x: -5.5, z: 7.2, w: 3.2, d: 0.7, h: 1.0, color: 0x7caa66 },
    { id: 'hedge-east', kind: 'hedge', x: 5.0, z: 6.4, w: 0.7, d: 3.0, h: 1.0, color: 0x7caa66 },
    { id: 'tree', kind: 'tree', x: -7.3, z: 9.3, w: 0.7, d: 0.7, h: 2.8, color: 0x8a6747 },
    { id: 'shed', kind: 'cabinet', look: 'shed', face: 'n', x: 7.9, z: 10.1, w: 2.2, d: 1.8, h: 2.3, color: 0xb98a66 },
    { id: 'flowerbed', kind: 'planter', x: 2.6, z: 3.55, w: 2.6, d: 0.8, h: 0.45, color: 0xc58f7a },
    { id: 'garden-bench', kind: 'bench', look: 'bench', face: 's', x: -2.9, z: 3.45, w: 1.8, d: 0.6, h: 0.5, color: 0xb58a62 },
    { id: 'mailbox', kind: 'crate', look: 'mailbox', face: 'w', x: 1.4, z: 9.9, w: 0.4, d: 0.4, h: 1.1, color: 0xc0705a },
    { id: 'kennel', kind: 'crate', look: 'kennel', face: 'n', x: -5.8, z: 10.4, w: 1.2, d: 1.2, h: 1.0, color: 0xb7936d },
    // 院门内的高树篱挡住视线：开局是安全的，要从左或右绕出去
    { id: 'gate-hedge', kind: 'hedge', x: 0, z: 7.4, w: 5.0, d: 0.6, h: 1.7, color: 0x74a260 },
    // 门厅
    { id: 'shoe-cabinet', kind: 'cabinet', face: 'e', x: -1.15, z: 2.2, w: 0.5, d: 1.2, h: 1.0, color: 0x9c9d7b },
    { id: 'console', kind: 'bench', look: 'console', face: 'w', x: 1.2, z: -2.0, w: 0.4, d: 1.0, h: 0.9, color: 0xb58767 },
    // 客厅
    { id: 'sofa', kind: 'sofa', face: 'e', x: -7.0, z: 0.6, w: 1.0, d: 2.4, h: 0.8, color: 0xc49960 },
    { id: 'coffee-table', kind: 'bench', look: 'coffee', x: -3.9, z: -0.3, w: 0.9, d: 1.3, h: 0.45, color: 0xbb855d },
    { id: 'tv-cabinet', kind: 'cabinet', look: 'tv', face: 'w', x: -2.0, z: -2.2, w: 0.6, d: 1.2, h: 1.0, color: 0x778a76 },
    { id: 'living-bookshelf', kind: 'cabinet', look: 'bookshelf', face: 'e', x: -8.7, z: -1.4, w: 0.6, d: 2.2, h: 2.0, color: 0x8f9b7b },
    { id: 'armchair', kind: 'sofa', face: 'n', x: -3.4, z: 2.1, w: 0.95, d: 0.95, h: 0.85, color: 0xb9805f },
    // 厨房
    { id: 'counter', kind: 'bench', look: 'counter', face: 's', x: -5.75, z: -8.65, w: 6.5, d: 0.7, h: 0.9, color: 0xd8c9a6 },
    { id: 'fridge', kind: 'cabinet', look: 'fridge', face: 'e', x: -8.6, z: -7.9, w: 0.8, d: 0.8, h: 1.95, color: 0xb9c7c2 },
    { id: 'island', kind: 'bench', look: 'island', face: 's', x: -5.4, z: -6.0, w: 2.2, d: 0.9, h: 0.9, color: 0xbd9773 },
    { id: 'dining-table', kind: 'bench', look: 'dining', x: -3.4, z: -4.1, w: 1.6, d: 1.0, h: 0.78, color: 0xb58767 },
    // 卧室
    { id: 'bed', kind: 'bed', face: 'w', x: 6.6, z: 1.3, w: 2.1, d: 1.6, h: 0.55, color: 0x9fb4c9 },
    { id: 'nightstand', kind: 'crate', look: 'nightstand', face: 'w', x: 8.3, z: 2.4, w: 0.5, d: 0.5, h: 0.6, color: 0xad7863 },
    { id: 'wardrobe', kind: 'cabinet', look: 'wardrobe', face: 'w', x: 8.55, z: -1.5, w: 0.7, d: 1.8, h: 2.1, color: 0x83977c },
    { id: 'toy-chest', kind: 'crate', look: 'chest', face: 's', x: 3.4, z: -2.2, w: 1.2, d: 0.7, h: 0.6, color: 0xd0a35c },
    // 书房
    { id: 'desk', kind: 'bench', look: 'desk', face: 's', x: 5.6, z: -7.6, w: 2.0, d: 0.9, h: 0.78, color: 0xa97f5b },
    { id: 'study-shelf-north', kind: 'cabinet', look: 'bookshelf', face: 's', x: 3.2, z: -8.6, w: 1.8, d: 0.6, h: 2.1, color: 0x829b90 },
    { id: 'study-shelf-east', kind: 'cabinet', look: 'bookshelf', face: 'w', x: 8.6, z: -6.0, w: 0.6, d: 2.4, h: 2.1, color: 0x829b90 },
    { id: 'reading-chair', kind: 'sofa', face: 'n', x: 3.0, z: -3.6, w: 0.9, d: 0.9, h: 0.9, color: 0xa697b4 },
    { id: 'study-crate', kind: 'crate', x: 8.5, z: -3.55, w: 1.0, d: 0.8, h: 0.7, color: 0x9c8575 },
  ],

  // state: asleep 睡着（靠近或有声音才醒）；idle 醒着站岗或巡逻（靠视线发现你）。
  // heading：0 朝南（+z），π 朝北，π/2 朝东，-π/2 朝西。
  // 机关（docs/fun-design.md 第 9 节）：这张图用闹钟，打一下，附近没发现你的僵尸走过去围着看。位置用 node scripts/map.mjs suggest 找的。
  easterEggs: [
    { id: 'cushions', onSofa: 'sofa', w: 1.03, d: 0.34, h: 0.50 },
    { id: 'photo', x: -1.368, y: 1.55, z: -7.8, yaw: Math.PI / 2, w: 0.83, d: 0.16, h: 0.65 },
  ],
  gadgets: [
    { kind: 'clock', x: -7.25, z: 3.37 },    // 花园：从院门就看得到，旁边睡着两只,
  ],

  enemies: [
    // 花园
    { type: 'walker', x: -4.5, z: 5.5, state: 'idle', heading: Math.PI / 2, patrol: [[3.5, 5.5], [-4.5, 5.5]] },
    { type: 'leaper', x: -7.6, z: 5.0, state: 'asleep', heading: 0 },
    { type: 'archer', x: 7.6, z: 4.6, state: 'idle', heading: -Math.PI / 2 },   // 第一只弓手：花园东北角，单独一只；站在院门口它看不见你（超过 8 米），绕过树篱才会被它发现
    // 门厅：第一只背对正门，给玩家一次从背后下手的机会
    { type: 'walker', x: 0, z: -0.5, state: 'idle', heading: Math.PI },
    { type: 'archer', x: 0.3, z: -5.6, state: 'idle', heading: 0 },   // 门厅尽头：一条直廊，两边的房门就是掩体
    // 客厅
    { type: 'leaper', x: -5.4, z: 1.8, state: 'idle', heading: Math.PI, patrol: [[-5.4, -2.1], [-5.4, 1.8]] },
    { type: 'walker', x: -7.6, z: -2.3, state: 'asleep', heading: Math.PI / 2 },
    { type: 'leaper', x: -2.3, z: 2.4, state: 'asleep', heading: -Math.PI / 2 },
    // 厨房
    { type: 'heavy', x: -7.2, z: -4.8, state: 'idle', heading: Math.PI / 2 },
    { type: 'walker', x: -3.0, z: -7.6, state: 'asleep', heading: 0 },
    { type: 'walker', x: -7.3, z: -7.6, state: 'asleep', heading: Math.PI / 2 },
    // 卧室
    { type: 'leaper', x: 4.9, z: 1.3, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'leaper', x: 2.6, z: -0.6, state: 'idle', heading: Math.PI / 2, patrol: [[7.4, -0.6], [2.6, -0.6]] },
    // 书房
    { type: 'heavy', x: 6.9, z: -6.2, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'leaper', x: 3.2, z: -6.4, state: 'idle', heading: Math.PI / 2, patrol: [[7.0, -5.2], [3.2, -6.4]] },
    { type: 'walker', x: 3.4, z: -7.4, state: 'asleep', heading: 0 },
  ],

  pickups: [
    // 拉链暗格：打一下墙上的拉链（stash），里面的东西掉在墙脚（x, z）
    { kind: 'ammo', x: 7.95, z: -8.4, stash: { x: 7.95, z: -9, normal: [0, 1] } },      // 书房北墙,
    { kind: 'ammo', x: 5.4, z: 9.6 },
    { kind: 'ammo', x: -2.0, z: -7.6 },
    { kind: 'weapon', weapon: 'heavy', amount: 3, x: 2.2, z: 2.4 },
    { kind: 'ammo', x: 8.3, z: -8.3 },
    { kind: 'heart', amount: 1, x: -8.3, z: 2.4 },
    { kind: 'heart', amount: 1, x: 1.0, z: -6.6 },
    { kind: 'weapon', weapon: 'stun', amount: 4, x: -1.4, z: 9.0 },      // 静电枪：就在院门边，开局就能拿
    { kind: 'weapon', weapon: 'sewing', amount: 48, x: 5.6, z: -6.5 },   // 订书机枪：书房，棉甲僵尸睡在旁边
    { kind: 'ammo', weapon: 'yarn', amount: 1, x: -8.3, z: -6.3 },
  ],
  upper: [
    // ---------------------------------------------------------------- 二层：主卧、浴室、儿童房、游戏室
    {
      rooms: [
        { id: 'hall2', name: '二楼走廊', minX: -1.5, maxX: 1.5, minZ: -9, maxZ: 3, surface: 'boards', floor: 0xd9bd92, accent: 0x8fb0b8 },
        { id: 'master', name: '主卧', minX: -9, maxX: -1.5, minZ: -3, maxZ: 3, surface: 'boards', floor: 0xcbb096, accent: 0xd9a6a0 },
        { id: 'bath', name: '浴室', minX: -9, maxX: -1.5, minZ: -9, maxZ: -3, surface: 'quilt', floor: 0xdfe8e4, accent: 0x8fc0c4 },
        { id: 'kids', name: '儿童房', minX: 1.5, maxX: 9, minZ: -3, maxZ: 3, surface: 'boards', floor: 0xe0c08a, accent: 0xf0c060 },
        { id: 'play', name: '游戏室', minX: 1.5, maxX: 9, minZ: -9, maxZ: -3, surface: 'boards', floor: 0xc4a47c, accent: 0xa8c08a },
        { id: 'stairs2', name: '楼梯间', minX: -1.5, maxX: 1.5, minZ: -12.5, maxZ: -9, tower: true },
      ],
      walls: [
        { x: -1.5, z: [-9, 3], doors: [[-5.6, -4.1], [0.6, 2.1]] },    // 走廊西墙：浴室门、主卧门
        { x: 1.5, z: [-9, 3], doors: [[-7.6, -6.1], [-1.4, 0.1]] },    // 走廊东墙：游戏室门、儿童房门
        { z: -3, x: [-9, -1.5], doors: [[-8.2, -6.7]] },               // 主卧 ↔ 浴室
        { z: -3, x: [1.5, 9], doors: [[3.0, 4.5]] },                   // 儿童房 ↔ 游戏室
      ],
      windows: [
        { x: -9, at: 0.3, w: 1.8, sill: 1.2 }, { x: -9, at: -6.9, w: 1.4, sill: 1.25 },
        { z: -9, at: -4.2, w: 1.6, sill: 1.3 }, { z: -9, at: 5.6, w: 1.8, sill: 1.1 },
        { x: 9, at: 0.5, w: 1.6 }, { x: 9, at: -4.0, w: 1.3 },
        { z: 3, at: -5.5, w: 2.0 }, { z: 3, at: 0, w: 1.2 }, { z: 3, at: 4.6, w: 1.8 },
      ],
      lamps: [{ x: -5.25, z: 0 }, { x: -5.25, z: -6 }, { x: 5.25, z: 0 }, { x: 5.25, z: -6 }, { x: 0, z: 0.4 }, { x: 0, z: -5 }],
      rugs: [
        { x: -5.0, z: 0.4, w: 2.6, d: 3.2, color: 0xd8a8a2 }, { x: -5.2, z: -6.9, w: 1.8, d: 0.9, color: 0x9cc8c6 },
        { x: 5.0, z: 0.4, w: 3.0, d: 2.6, color: 0xe9c46a }, { x: 5.6, z: -6.2, w: 3.2, d: 2.2, color: 0x9fb98a }, { x: 0, z: -3.2, w: 1.3, d: 5.0, color: 0x7fa3ad },
      ],
      pictures: [
        { x: -1.6, z: -1.6, y: 1.65, normal: [-1, 0], w: 0.8, h: 0.55, color: 0xf2dfb0 }, { x: 1.4, z: -3.6, y: 1.55, normal: [-1, 0], color: 0xe9c9d9 },
        { x: -1.4, z: -1.2, y: 1.55, normal: [1, 0], w: 0.5, h: 0.6, color: 0xa9cfe0 }, { x: 6.2, z: -2.9, y: 1.6, normal: [0, 1], w: 0.9, h: 0.6, color: 0xbfe0d0 },
      ],
      easterEggs: [
        { id: 'duck', x: -7.47, y: 0.69, z: -8.14, w: 0.43, d: 0.29, h: 0.4 },
      ],
      furniture: [
        // 走廊
        { id: 'hall2-console', kind: 'bench', look: 'console', face: 'n', x: 0, z: 2.65, w: 1.2, d: 0.7, h: 0.9, color: 0x9db3a0 },
        { id: 'hall2-cabinet', kind: 'cabinet', face: 'e', x: -1.15, z: -2.0, w: 0.5, d: 1.2, h: 1.0, color: 0xb9a07c },
        // 主卧
        { id: 'master-bed', kind: 'bed', face: 'e', x: -7.9, z: 0.3, w: 2.2, d: 1.8, h: 0.55, color: 0xd39a94 },
        { id: 'master-night-n', kind: 'crate', look: 'nightstand', face: 'e', x: -8.75, z: -0.85, w: 0.5, d: 0.5, h: 0.6, color: 0xb98a66 },
        { id: 'master-night-s', kind: 'crate', look: 'nightstand', face: 'e', x: -8.75, z: 1.45, w: 0.5, d: 0.5, h: 0.6, color: 0xb98a66 },
        { id: 'master-wardrobe', kind: 'cabinet', look: 'wardrobe', face: 's', x: -4.2, z: -2.55, w: 2.0, d: 0.7, h: 2.1, color: 0xa9b59a },
        { id: 'master-dresser', kind: 'cabinet', face: 'w', x: -1.95, z: -1.6, w: 0.7, d: 1.4, h: 1.0, color: 0xc7a98a },
        { id: 'master-armchair', kind: 'sofa', face: 'n', x: -3.3, z: 2.525, w: 0.95, d: 0.95, h: 0.85, color: 0xc98f86 },
        // 浴室
        { id: 'tub', kind: 'bench', look: 'tub', face: 's', x: -7.9, z: -8.45, w: 2.2, d: 1.1, h: 0.62, color: 0xf3f0e8 },
        { id: 'vanity', kind: 'bench', look: 'vanity', face: 's', x: -4.2, z: -8.65, w: 1.8, d: 0.7, h: 0.9, color: 0xbcd6d2 },
        { id: 'laundry', kind: 'crate', look: 'basket', x: -1.95, z: -8.65, w: 0.7, d: 0.7, h: 0.75, color: 0xd9b98c },
        { id: 'towel-shelf', kind: 'cabinet', face: 'e', x: -8.7, z: -5.0, w: 0.6, d: 1.6, h: 1.9, color: 0x9cc0c2 },
        { id: 'bath-stool', kind: 'bench', look: 'coffee', x: -5.0, z: -5.6, w: 1.4, d: 0.7, h: 0.45, color: 0xd9c7a4, accent: 0x9cc8c6 },
        // 儿童房
        { id: 'kids-bed', kind: 'bed', face: 'w', x: 7.9, z: 2.3, w: 2.2, d: 1.4, h: 0.55, color: 0x8fb7d9, accent: 0xe9c46a },
        { id: 'kids-chest', kind: 'crate', look: 'chest', face: 's', x: 5.6, z: -2.55, w: 1.4, d: 0.7, h: 0.6, color: 0xe2a35c },
        { id: 'kids-shelf', kind: 'cabinet', look: 'bookshelf', face: 'w', x: 8.7, z: -1.6, w: 0.6, d: 1.8, h: 1.6, color: 0xe0b060 },
        { id: 'kids-table', kind: 'bench', look: 'coffee', x: 4.6, z: 0.6, w: 1.2, d: 1.2, h: 0.5, color: 0xd9b98c, accent: 0xe7836f },
        { id: 'kids-blocks', kind: 'crate', look: 'chest', face: 'e', x: 2.0, z: 2.6, w: 0.8, d: 0.8, h: 0.7, color: 0x9fc3e0 },
        // 游戏室
        { id: 'play-sofa', kind: 'sofa', face: 's', x: 5.6, z: -8.5, w: 2.6, d: 1.0, h: 0.8, color: 0x8fae8a },
        { id: 'play-tv', kind: 'cabinet', look: 'tv', face: 'n', x: 6.2, z: -3.4, w: 1.4, d: 0.6, h: 0.9, color: 0x8a9a86 },
        { id: 'play-table', kind: 'bench', look: 'coffee', x: 5.6, z: -6.2, w: 1.3, d: 0.8, h: 0.45, color: 0xbb855d },
        { id: 'play-shelf', kind: 'cabinet', look: 'bookshelf', face: 'w', x: 8.7, z: -6.0, w: 0.6, d: 2.0, h: 2.0, color: 0x9bb07c },
        { id: 'play-crate', kind: 'crate', x: 1.95, z: -3.55, w: 0.7, d: 0.9, h: 0.7, color: 0xb9936d },
      ],

      enemies: [
        { type: 'walker', x: 0, z: 1.0, state: 'idle', heading: Math.PI, patrol: [[0, -6.0], [0, 1.0]] },
        { type: 'heavy', x: -5.4, z: 1.2, state: 'asleep', heading: Math.PI / 2 },
        { type: 'leaper', x: -3.0, z: -1.2, state: 'idle', heading: -Math.PI / 2, patrol: [[-6.0, -1.6], [-3.0, -1.2]] },
        { type: 'archer', x: -6.0, z: 2.3, state: 'idle', heading: Math.PI },
        { type: 'leaper', x: -5.6, z: -7.2, state: 'asleep', heading: 0 },
        { type: 'leaper', x: -3.0, z: -4.2, state: 'idle', heading: -Math.PI / 2, patrol: [[-7.2, -4.2], [-3.0, -4.2]] },
        { type: 'leaper', x: 4.0, z: 2.2, state: 'asleep', heading: Math.PI },
        { type: 'bomber', x: 6.6, z: -0.6, state: 'idle', heading: -Math.PI / 2, patrol: [[3.0, -1.4], [6.6, -0.6]] },   // 第一只炸弹客：儿童房
        { type: 'walker', x: 3.2, z: -7.6, state: 'asleep', heading: Math.PI / 2 },
        { type: 'heavy', x: 7.4, z: -4.9, state: 'idle', heading: -Math.PI / 2 },
        { type: 'bomber', x: 3.4, z: -5.0, state: 'asleep', heading: 0 },
      ],
      pickups: [
        // 拉链暗格：打一下墙上的拉链（stash），里面的东西掉在墙脚（x, z）
        { kind: 'heart', amount: 1, x: -5.92, z: -8.4, stash: { x: -5.92, z: -9, normal: [0, 1] } },   // 浴室北墙,
        { kind: 'ammo', x: -2.2, z: 2.4 },
        { kind: 'ammo', x: 8.3, z: -8.3 },
        { kind: 'heart', amount: 1, x: -2.4, z: -3.9 },
        { kind: 'ammo', x: 2.3, z: 0.9 },
        { kind: 'weapon', weapon: 'needle', amount: 6, x: -8.2, z: -2.3 },   // 毛衣针：主卧
        { kind: 'weapon', weapon: 'stun', amount: 4, x: 0.9, z: 1.2 },
        { kind: 'ammo', weapon: 'yarn', amount: 1, x: 2.6, z: -8.3 },
      ],
    },
    // ---------------------------------------------------------------- 三层（阁楼）：储藏间、缝纫间、藏宝间
    {
      rooms: [
        { id: 'hall3', name: '阁楼走廊', minX: -1.5, maxX: 1.5, minZ: -9, maxZ: 3, surface: 'boards', floor: 0xb89a74, accent: 0xb08a6a },
        { id: 'attic', name: '储藏间', minX: -9, maxX: -1.5, minZ: -9, maxZ: 3, surface: 'boards', floor: 0xa98860, accent: 0x9a8f7a },
        { id: 'sewing', name: '缝纫间', minX: 1.5, maxX: 9, minZ: -9, maxZ: -3, surface: 'boards', floor: 0xc9a67a, accent: 0xd98a8a },
        { id: 'treasure', name: '藏宝间', minX: 1.5, maxX: 9, minZ: -3, maxZ: 3, surface: 'quilt', floor: 0xc9b0d0, accent: 0xe9c46a },
        { id: 'stairs3', name: '楼梯间', minX: -1.5, maxX: 1.5, minZ: -12.5, maxZ: -9, tower: true },
      ],
      walls: [
        { x: -1.5, z: [-9, 3], doors: [[-7.4, -5.9], [-0.6, 0.9]] },   // 走廊西墙：储藏间的两个门
        { x: 1.5, z: [-9, 3], doors: [[-6.4, -4.9], [0.8, 2.3]] },     // 走廊东墙：缝纫间门、藏宝间门
        { z: -3, x: [1.5, 9], doors: [[6.6, 8.1]] },                   // 缝纫间 ↔ 藏宝间
        { z: -3, x: [-9, -5.5] },                                      // 储藏间里的一段隔墙
      ],
      windows: [
        { x: -9, at: 0.4, w: 1.4, sill: 1.2 }, { x: -9, at: -7.3, w: 1.0, sill: 1.35 },
        { z: -9, at: -4.0, w: 1.6, sill: 1.2 }, { z: -9, at: 5.2, w: 1.6, sill: 1.25 },
        { x: 9, at: 1.2, w: 1.4 },
        { z: 3, at: -7.5, w: 1.6 }, { z: 3, at: 0, w: 1.2 }, { z: 3, at: 6.4, w: 1.6 },
      ],
      lamps: [{ x: -5.25, z: 0.2 }, { x: -5.0, z: -6.2 }, { x: 5.25, z: 0 }, { x: 5.4, z: -6.9 }, { x: 0, z: -2 }],
      rugs: [{ x: 6.4, z: 1.2, w: 2.6, d: 2.4, color: 0xe2b85a }, { x: 0, z: -2.0, w: 1.3, d: 5.0, color: 0xa87f62 }, { x: 5.4, z: -4.3, w: 2.4, d: 1.0, color: 0xd98a8a }],
      easterEggs: [
        { id: 'bobbin', x: 5.6, y: 0.195, z: -7.82, w: 0.42, d: 0.46, h: 0.4 },
      ],
      pictures: [{ x: 1.6, z: -0.8, y: 1.6, normal: [1, 0], w: 0.9, h: 0.6, color: 0xf2dfb0 }, { x: -1.4, z: -3.3, y: 1.55, normal: [1, 0], color: 0xa9cfe0 }],
      furniture: [
        { id: 'hall3-bench', kind: 'cabinet', face: 'w', x: 1.15, z: -2.4, w: 0.5, d: 1.4, h: 1.0, color: 0xa98f72 },
        // 储藏间：成堆的箱子和旧家具
        { id: 'attic-crate-a', kind: 'crate', x: -8.5, z: -8.5, w: 1.0, d: 1.0, h: 1.2, color: 0xb9936d },
        { id: 'attic-crate-b', kind: 'crate', x: -7.4, z: -8.6, w: 1.2, d: 0.8, h: 0.7, color: 0xa98463 },
        { id: 'attic-shelf', kind: 'cabinet', look: 'bookshelf', face: 'e', x: -8.7, z: -5.6, w: 0.6, d: 2.2, h: 2.0, color: 0x8f8a72 },
        { id: 'attic-pile', kind: 'crate', x: -4.6, z: -6.2, w: 1.4, d: 1.0, h: 1.0, color: 0xc0a078 },
        { id: 'attic-sofa', kind: 'sofa', face: 'e', x: -8.5, z: 0.4, w: 1.0, d: 2.2, h: 0.8, color: 0x9a86a6 },
        { id: 'attic-chest', kind: 'crate', look: 'chest', face: 'n', x: -5.0, z: 2.65, w: 1.4, d: 0.7, h: 0.6, color: 0xb0764f },
        { id: 'attic-table', kind: 'bench', look: 'coffee', x: -4.8, z: 0.2, w: 1.0, d: 1.4, h: 0.45, color: 0xbb855d },
        { id: 'attic-wardrobe', kind: 'cabinet', look: 'wardrobe', face: 'w', x: -1.95, z: -3.2, w: 0.7, d: 1.8, h: 2.1, color: 0x8a947c },
        // 缝纫间
        { id: 'sewing-table', kind: 'bench', look: 'desk', face: 's', x: 5.2, z: -8.55, w: 2.2, d: 0.9, h: 0.78, color: 0xc98f86 },
        { id: 'yarn-shelf', kind: 'cabinet', look: 'bookshelf', face: 'w', x: 8.7, z: -5.6, w: 0.6, d: 2.0, h: 2.0, color: 0xc7a07a },
        { id: 'fabric-crate', kind: 'crate', look: 'basket', x: 2.05, z: -8.5, w: 0.9, d: 1.0, h: 0.8, color: 0xd9b98c },
        { id: 'cutting-table', kind: 'bench', look: 'island', face: 's', x: 5.4, z: -5.6, w: 2.0, d: 0.9, h: 0.9, color: 0xd9a6a0 },
        // 藏宝间
        { id: 'treasure-chest-e', kind: 'crate', look: 'chest', face: 'w', x: 8.55, z: -1.2, w: 0.9, d: 1.4, h: 0.7, color: 0xd9a441 },
        { id: 'treasure-chest-s', kind: 'crate', look: 'chest', face: 'n', x: 4.0, z: 2.65, w: 1.6, d: 0.7, h: 0.7, color: 0xb0764f },
        { id: 'treasure-cabinet', kind: 'cabinet', face: 's', x: 4.2, z: -2.6, w: 1.6, d: 0.6, h: 1.6, color: 0xa68fb8 },
        { id: 'treasure-crate', kind: 'crate', x: 5.2, z: 0.2, w: 1.0, d: 1.0, h: 1.0, color: 0xc0a078 },
      ],

      enemies: [
        { type: 'shielded', x: -3.5, z: -1.4, state: 'idle', heading: -Math.PI / 2, patrol: [[-6.2, -1.4], [-3.5, -1.4]] },   // 储藏间的空地留出横移路线，阁楼走廊可用于撤离
        { type: 'leaper', x: -3.2, z: -7.6, state: 'idle', heading: -Math.PI / 2, patrol: [[-6.4, -7.4], [-3.2, -7.6]] },
        { type: 'walker', x: -6.6, z: -4.4, state: 'asleep', heading: Math.PI / 2 },
        { type: 'archer', x: -3.4, z: 2.0, state: 'idle', heading: Math.PI },
        { type: 'bomber', x: -6.6, z: -1.4, state: 'asleep', heading: Math.PI / 2 },
        { type: 'leaper', x: 3.4, z: -6.9, state: 'idle', heading: Math.PI / 2, patrol: [[7.4, -7.2], [3.4, -6.9]] },
        { type: 'shielded', x: 7.6, z: -6.25, state: 'idle', heading: -Math.PI / 2 },
        { type: 'heavy', x: 6.6, z: -0.8, state: 'idle', heading: -Math.PI / 2 },
        { type: 'leaper', x: 3.0, z: 1.4, state: 'asleep', heading: Math.PI / 2 },
        // 守墓巨像（开场片结尾的那一位）：开局不在场上，拿起毛线篮的那一刻在藏宝间的西北角现身，在玩家身后。
        // 不能放在两扇门前面：篮子在东南角，回楼梯最近的路是北门，它站在那儿就把人堵死了（第一版就是这么错的）。
        // 它很慢，身体比楼梯宽、下不了楼：不用打倒，带着篮子跑出阁楼就甩掉了。
        { type: 'boss-warden', x: 2.6, z: -1.9, dormant: true, encounter: 'attic' },
      ],
      pickups: [
        // 拉链暗格：打一下墙上的拉链（stash），里面的东西掉在墙脚（x, z）
        { kind: 'ammo', weapon: 'yarn', amount: 1, x: 8.4, z: -7.67, stash: { x: 9, z: -7.67, normal: [-1, 0] } },   // 缝纫间东墙,
        { kind: 'objective', item: 'basket', name: '毛线篮', x: 7.8, z: 1.9 },
        { kind: 'heart', amount: 1, x: -2.4, z: 2.3 },
        { kind: 'ammo', x: 8.2, z: -8.3 },
        { kind: 'ammo', x: -7.9, z: 2.4 },
        { kind: 'ammo', x: 3.0, z: -4.4 },
        { kind: 'ammo', weapon: 'yarn', amount: 1, x: -2.4, z: -8.3 },
      ],
    },
  ],
};
