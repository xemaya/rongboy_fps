// 学校：教学楼、小操场和校门内的课间活动区。活动区的短掩体适合先学反弹。
//
//   一班教室（西） │ 美术教室（中） │ 科学教室（东）
//   ───────────────────── 走廊 ─────────────────────
//                        操场
//
// 造型往 Q 版走：颜色像蜡笔盒，东西又圆又胖。铅笔围栏、蜡笔门柱、积木墙、彩色储物柜，远处有一道彩虹。
// 任务：把学校里的僵尸全部清走。
export default {
  id: 'school',
  name: '学校 · 三间教室和小操场',
  look: 'morning',
  bounds: { minX: -12, maxX: 12, minZ: -9, maxZ: 17.5 },
  height: 2.8,
  wallThickness: 0.2,
  doorHeight: 2.05,
  par: 480,
  player: { x: 0, z: 16.55, yaw: 0 },
  menu: { x: 0, z: 15.85 },
  arsenal: ['single', 'scatter', 'yarn', 'jack'],
  mission: { type: 'clear', title: '把学校里的僵尸全部清走' },
  theme: {
    wall: 0xfff0c4, ceiling: 0xfffaf0, roofColor: 0xef7b6b, beams: false, yard: 'playground', rainbow: true,
    lawn: 0xb4dc8c, lampPower: 8, skyGain: 6,   // 教室比家里更亮堂
  },
  texts: {
    short: '学校',
    eyebrow: '第三关 · 学校（三间教室和小操场）',
    title: '上课铃响之前，<br>把僵尸请出去。',
    intro: '从课间活动区打到操场，经两侧进教学楼，合计清理 24 只僵尸。',
    how: ['Q 换枪 · E 投掷，G 切换炸弹 · F 换地上的枪 · R 换弹', '弓手：瞄准线变红就换方向 · 炸弹客：离开红圈 · 持盾者：探照灯炮或蓄力球', '从背后打 ×2，趁它没发现再 ×2', '活动区有一把静电枪 · 订书机枪在美术教室，毛衣针在科学教室', '积木墙和滑梯能挡住视线，储物柜后面可以躲', '3 颗心，H 喝血瓶回 2 颗 · 受伤少、8 分钟内清完可得三星'],
    start: '走进校门',
    hint: '用积木做掩体 · 从活动区两侧绕进操场',
    won: '清空了！',
  },

  rooms: [
    { id: 'yard', name: '操场', minX: -12, maxX: 12, minZ: 0.5, maxZ: 12, outdoor: true, floor: 0xb4dc8c },
    { id: 'recess', name: '课间活动区', minX: -12, maxX: 12, minZ: 12, maxZ: 17.5, outdoor: true, floor: 0xa3ca7f },
    { id: 'corridor', name: '走廊', minX: -12, maxX: 12, minZ: -2.5, maxZ: 0.5, surface: 'boards', floor: 0xecc98c, accent: 0x9fd8c4 },
    { id: 'class', name: '一班教室', minX: -12, maxX: -4, minZ: -9, maxZ: -2.5, surface: 'boards', floor: 0xe6c088, accent: 0x8fc3e8 },
    { id: 'art', name: '美术教室', minX: -4, maxX: 4, minZ: -9, maxZ: -2.5, surface: 'quilt', floor: 0xf6ecd6, accent: 0xf2a6b8 },
    { id: 'lab', name: '科学教室', minX: 4, maxX: 12, minZ: -9, maxZ: -2.5, surface: 'quilt', floor: 0xe2f0e6, accent: 0xb8d86a },
  ],

  walls: [
    { z: 0.5, x: [-12, 12], doors: [[-7, -5], [5, 7]] },                                                           // 走廊 ↔ 操场：两扇大门
    { z: -2.5, x: [-12, 12], doors: [[-11, -9.4], [-5.8, -4.2], [-3, -1.4], [1.4, 3], [4.6, 6.2], [9.4, 11]] },   // 每间教室前后两个门
    { x: -4, z: [-9, -2.5] },
    { x: 4, z: [-9, -2.5] },
  ],

  windows: [
    { z: -9, at: -8, w: 2.6 }, { z: -9, at: 0, w: 2.2 }, { z: -9, at: 8, w: 2.6 },
    { x: -12, at: -1.0, w: 1.4 }, { x: 12, at: -1.0, w: 1.4 }, { x: 12, at: -6.3, w: 1.6 },
    { z: 0.5, at: -10, w: 1.8 }, { z: 0.5, at: -2.6, w: 1.8 }, { z: 0.5, at: 2.6, w: 1.8 }, { z: 0.5, at: 10, w: 1.8 },
  ],
  lamps: [{ x: -8, z: -5.75 }, { x: 0, z: -5.75 }, { x: 8, z: -5.75 }, { x: -8, z: -1 }, { x: 0, z: -1 }, { x: 8, z: -1 }],
  rugs: [{ x: -6, z: 1.3, w: 1.8, d: 0.8, color: 0xf2a6b8 }, { x: 6, z: 1.3, w: 1.8, d: 0.8, color: 0x8fc3e8 }],
  // 黑板（motif: 'board'）和墙上的画
  pictures: [
    { x: -4.1, z: -5.75, y: 1.6, normal: [-1, 0], w: 1.0, h: 0.8, color: 0xf2dfb0 },
    { x: -1.2, z: -9, y: 1.7, normal: [0, 1], w: 0.8, h: 0.9, color: 0xa9cfe0 }, { x: 1.9, z: -9, y: 1.7, normal: [0, 1], w: 0.8, h: 0.9, color: 0xf2c9d6 },
    { x: 3.9, z: -8.0, y: 1.7, normal: [-1, 0], w: 0.9, h: 0.7, color: 0xbfe0d0 },
    { x: 12, z: -3.4, y: 1.75, normal: [-1, 0], w: 1.2, h: 0.9, motif: 'board' },
    { x: -3.6, z: -2.4, y: 1.7, normal: [0, 1], w: 0.7, h: 0.7, color: 0xf2dfb0 }, { x: 3.8, z: -2.4, y: 1.7, normal: [0, 1], w: 0.7, h: 0.7, color: 0xa9cfe0 },
  ],
  // 操场上只是画在地上、立在边上的东西（不参与碰撞）
  yard: [
    { kind: 'sandbox', x: -8.4, z: 3.0, w: 3.2, d: 2.4 },
    { kind: 'hopscotch', x: 3.4, z: 2.2, along: 'z' },
    { kind: 'track', z: 5.2, x0: -10.5, x1: 10.5 },
    { kind: 'hoop', x: 11.55, z: 6.6, face: 'w' },
    { kind: 'flagpole', x: -1.9, z: 1.7 },
  ],

  furniture: [
    { id:'recess-blocks-w', kind:'crate', look:'blocks', x:-4.4, z:13.6, w:2.8, d:.95, h:1.2, color:0xb383cc },
    { id:'recess-blocks-e', kind:'crate', look:'blocks', x:4.5, z:14.55, w:3.2, d:1.0, h:1.3, color:0x94bcd6 },
    { id:'recess-box', kind:'crate', look:'chest', x:0, z:13.05, w:2.0, d:.85, h:.8, color:0xf2b881 },
    // 操场
    { id: 'block-wall', kind: 'crate', look: 'blocks', x: 0, z: 8.8, w: 3.0, d: 1.0, h: 2.0 },      // 校门里的积木墙：开局是安全的
    { id: 'blocks-east', kind: 'crate', look: 'blocks', x: 3.6, z: 5.4, w: 1.0, d: 2.0, h: 1.0 },
    { id: 'slide', kind: 'crate', look: 'slide', face: 'e', x: -8.4, z: 6.6, w: 3.4, d: 1.2, h: 1.7, color: 0xf2c84b },
    { id: 'swing', kind: 'bench', look: 'swing', x: 8.2, z: 4.4, w: 3.0, d: 1.0, h: 0.5, color: 0xef7b6b },
    { id: 'playhouse', kind: 'crate', look: 'playhouse', face: 'w', x: 8.4, z: 9.0, w: 2.2, d: 2.2, h: 1.8, color: 0x8fc3e8 },
    { id: 'seesaw', kind: 'bench', look: 'seesaw', x: -3.8, z: 6.4, w: 2.8, d: 0.6, h: 0.6, color: 0x9fd8a4 },
    { id: 'tree-sw', kind: 'tree', x: -10.8, z: 10.6, w: 0.7, d: 0.7, h: 2.6, color: 0xb58a62 },
    { id: 'tree-ne', kind: 'tree', x: 11.55, z: 2.85, w: 0.7, d: 0.7, h: 2.6, color: 0xb58a62 },
    { id: 'planter', kind: 'planter', x: 0, z: 0.95, w: 3.0, d: 0.7, h: 0.45, color: 0xf2a6b8 },
    { id: 'yard-bench', kind: 'bench', look: 'bench', face: 's', x: -9.6, z: 0.9, w: 2.0, d: 0.6, h: 0.5, color: 0x8fc3e8 },
    // 走廊：三组彩色储物柜，两头各一张软凳
    { id: 'lockers-w', kind: 'cabinet', look: 'locker', face: 's', x: -7.8, z: -2.1, w: 2.4, d: 0.5, h: 1.8 },
    { id: 'lockers-m', kind: 'cabinet', look: 'locker', face: 's', x: 0, z: -2.1, w: 2.4, d: 0.5, h: 1.8 },
    { id: 'lockers-e', kind: 'cabinet', look: 'locker', face: 's', x: 7.8, z: -2.1, w: 2.4, d: 0.5, h: 1.8 },
    { id: 'bench-w', kind: 'bench', look: 'ottoman', x: -10, z: 0.175, w: 2.0, d: 0.45, h: 0.45, color: 0xf2a6b8 },
    { id: 'bench-e', kind: 'bench', look: 'ottoman', x: 10, z: 0.175, w: 2.0, d: 0.45, h: 0.45, color: 0x8fc3e8 },
    // 一班教室：讲台靠西墙（黑板下面），六张课桌面朝西
    { id: 'podium', kind: 'bench', look: 'podium', face: 'e', x: -11.5, z: -5.75, w: 1.0, d: 1.8, h: 0.95, color: 0xf2c84b },
    ...[-8.6, -6.4].flatMap((x, i) => [-7.6, -5.75, -3.9].map((z, j) => ({ id: `desk-${i}${j}`, kind: 'bench', look: 'desk-kid', face: 'w', x, z, w: 1.2, d: 0.9, h: 0.72 }))),
    { id: 'class-shelf', kind: 'cabinet', look: 'bookshelf', face: 'w', x: -4.45, z: -8.0, w: 0.6, d: 2.0, h: 1.6, color: 0x8fc3e8 },
    // 美术教室：中间一张调色盘大桌，北墙两个画架
    { id: 'palette-table', kind: 'bench', look: 'palette', x: 0, z: -5.9, w: 2.4, d: 1.6, h: 0.72, color: 0xf2a6b8 },
    { id: 'easel-w', kind: 'crate', look: 'easel', face: 's', x: -2.6, z: -8.6, w: 1.0, d: 0.8, h: 1.6, color: 0xf2c84b },
    { id: 'easel-e', kind: 'crate', look: 'easel', face: 's', x: 2.6, z: -8.6, w: 1.0, d: 0.8, h: 1.6, color: 0x9fd8a4 },
    { id: 'paint-shelf', kind: 'cabinet', look: 'bookshelf', face: 'e', x: -3.55, z: -5.9, w: 0.6, d: 2.4, h: 1.5, color: 0xf2a6b8 },
    { id: 'art-sink', kind: 'bench', look: 'counter', face: 'w', x: 3.5, z: -5.9, w: 0.7, d: 2.4, h: 0.9, color: 0xfff0c4 },
    // 科学教室：两张实验台，角落里一副骨架模型
    { id: 'lab-bench-n', kind: 'bench', look: 'labbench', face: 's', x: 7.4, z: -6.9, w: 2.6, d: 1.0, h: 0.9, color: 0xf6f3ec },
    { id: 'lab-bench-s', kind: 'bench', look: 'labbench', face: 's', x: 8.6, z: -4.6, w: 2.6, d: 1.0, h: 0.9, color: 0xf6f3ec },
    { id: 'skeleton', kind: 'plinth', look: 'skeleton', face: 'w', x: 11.5, z: -8.5, w: 1.0, d: 1.0, h: 0.3, color: 0xb8d86a },
    { id: 'specimens', kind: 'case', item: 'jars', face: 'e', x: 4.6, z: -7.2, w: 0.9, d: 2.0, h: 1.9, color: 0xb8d86a },
    { id: 'lab-globe', kind: 'plinth', item: 'globe', face: 'w', x: 11.5, z: -4.2, w: 1.0, d: 1.0, h: 0.8, color: 0xfff0c4 },
  ],

  // 机关（docs/fun-design.md 第 9 节）：这张图用颜料桶，打一下炸开，和毛线团手雷一样。位置用 node scripts/map.mjs suggest 找的。
  easterEggs: [
    { id: 'locker', x: 0, y: 0.91, z: -2.1, w: 0.78, d: 0.56, h: 1.7, replaces: 'lockers-m' },
    { id: 'chalk', x: -11.954, y: 1.74, z: -5.75, yaw: Math.PI / 2, w: 3.1, d: 0.16, h: 1.35 },
    { id: 'globe', x: 11.5, y: 1.20, z: -4.2, yaw: -Math.PI / 2, w: 0.69, d: 0.62, h: 0.77, replaces: 'lab-globe' },
    { id: 'seesaw', x: -3.8, y: 0.46, z: 6.4, w: 2.8, d: 0.6, h: 0.54, replaces: 'seesaw' },
  ],
  gadgets: [
    { kind: 'bucket', x: 0.8, z: -8.68 },    // 美术教室,
  ],

  enemies: [
    { type:'walker', x:-6.2, z:15.65, state:'asleep', heading:Math.PI/2 },
    { type:'walker', x:7.7, z:13.8, state:'asleep', heading:-Math.PI/2 },
    { type:'leaper', x:-8.2, z:13.1, state:'asleep', heading:0 },
    { type:'crawler', x:6.8, z:16.25, state:'asleep', heading:-Math.PI/2 },
    // 操场
    { type: 'walker', x: -6.0, z: 4.2, state: 'idle', heading: Math.PI / 2, patrol: [[6.0, 4.2], [-6.0, 4.2]] },
    { type: 'leaper', x: -10.6, z: 4.6, state: 'asleep', heading: Math.PI / 2 },
    { type: 'walker', x: 10.6, z: 10.8, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'archer', x: 10.6, z: 6.4, state: 'idle', heading: -Math.PI / 2 },   // 操场东头：滑梯和积木墙能挡箭
    { type: 'bomber', x: -6.4, z: 9.8, state: 'asleep', heading: Math.PI / 2 },
    // 走廊
    { type: 'walker', x: -10.0, z: -1.0, state: 'idle', heading: Math.PI / 2, patrol: [[10.0, -1.0], [-10.0, -1.0]] },
    { type: 'archer', x: 11.2, z: -1.4, state: 'idle', heading: -Math.PI / 2 },   // 走廊东头：一条直廊，教室门是掩体
    { type: 'heavy', x: -11.3, z: -1.3, state: 'asleep', heading: Math.PI / 2 },
    // 一班教室
    { type: 'walker', x: -7.5, z: -6.68, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'heavy', x: -10.2, z: -3.8, state: 'idle', heading: Math.PI / 2 },
    { type: 'leaper', x: -5.0, z: -4.9, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'shielded', x: -10.2, z: -8.2, state: 'idle', heading: 0 },
    // 美术教室
    { type: 'leaper', x: -2.4, z: -3.6, state: 'idle', heading: Math.PI / 2, patrol: [[2.4, -3.6], [-2.4, -3.6]] },
    { type: 'walker', x: 2.0, z: -7.3, state: 'asleep', heading: Math.PI },
    { type: 'walker', x: -1.8, z: -7.6, state: 'asleep', heading: 0 },
    { type: 'bomber', x: 0, z: -7.6, state: 'idle', heading: 0 },
    // 科学教室
    { type: 'heavy', x: 10.7, z: -6.6, state: 'idle', heading: -Math.PI / 2 },
    { type: 'walker', x: 5.6, z: -4.0, state: 'asleep', heading: Math.PI / 2 },
    { type: 'shielded', x: 10.6, z: -3.2, state: 'idle', heading: -Math.PI / 2 },
    { type: 'leaper', x: 5.6, z: -8.4, state: 'idle', heading: Math.PI / 2, patrol: [[10.2, -8.4], [5.6, -8.4]] },
  ],

  pickups: [
    // 拉链暗格：打一下墙上的拉链（stash），里面的东西掉在墙脚（x, z）
    { kind: 'potion', x: -8.07, z: -0.2, stash: { x: -8.07, z: 0.4, normal: [0, -1] } },   // 走廊南墙,
    { kind: 'ammo', x: 10.13, z: -8.4, stash: { x: 10.13, z: -9, normal: [0, 1] } },             // 科学教室北墙,
    { kind: 'ammo', weapon: 'yarn', amount: 1, x: 8.15, z: 1.2, stash: { x: 8.15, z: 0.6, normal: [0, 1] } },   // 教学楼朝操场的外墙,
    { kind: 'weapon', weapon: 'stun', amount: 4, x: 1.7, z: 15.2 },
    { kind: 'weapon', weapon: 'sewing', amount: 48, x: -2.6, z: -4.2 },
    { kind: 'weapon', weapon: 'needle', amount: 6, x: 11.3, z: -6.2 },
    { kind: 'ammo', weapon: 'yarn', amount: 1, x: -4.0, z: -0.9 },
    { kind: 'ammo', weapon: 'yarn', amount: 1, x: 11.0, z: 8.4 },
    { kind: 'ammo', x: -11.3, z: -3.3 },
    { kind: 'ammo', x: -10.6, z: 8.2 },
    { kind: 'weapon', weapon: 'heavy', amount: 3, x: 5.0, z: -8.6 },
    { kind: 'ammo', x: 4.0, z: -0.9 },
    { kind: 'potion', x: 3.3, z: -3.5 },
    { kind: 'potion', x: -11.0, z: 6.0 },
  ],
};
