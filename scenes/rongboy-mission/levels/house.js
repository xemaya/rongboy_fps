// 家 · 一层 + 花园。米制；x 向东，z 向南；玩家从南侧院门进入，面朝北。
// 房子占 z∈[-9,3]，花园占 z∈[3,11]。二、三层在第三阶段加入，楼梯位先用实体占住。
export default {
  id: 'house-ground',
  name: '家 · 一层与花园',
  bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 11 },
  height: 2.8,
  wallThickness: 0.2,
  doorHeight: 2.05,
  par: 240,
  player: { x: 0, z: 10, yaw: 0 },
  mission: { type: 'clear', title: '清空一层和花园里的所有僵尸' },

  rooms: [
    // surface / floor：地面的织物和颜色；accent：这个房间的墙裙颜色，用来一眼认出在哪个房间。
    { id: 'garden', name: '花园', minX: -9, maxX: 9, minZ: 3, maxZ: 11, outdoor: true, floor: 0x86a765 },
    { id: 'hall', name: '门厅', minX: -1.5, maxX: 1.5, minZ: -9, maxZ: 3, surface: 'boards', floor: 0xd6b383, accent: 0xd49a78 },
    { id: 'living', name: '客厅', minX: -9, maxX: -1.5, minZ: -3, maxZ: 3, surface: 'boards', floor: 0xcfa873, accent: 0x9db79a },
    { id: 'kitchen', name: '厨房', minX: -9, maxX: -1.5, minZ: -9, maxZ: -3, surface: 'quilt', floor: 0xeadcc2, accent: 0xe8c877 },
    { id: 'bedroom', name: '卧室', minX: 1.5, maxX: 9, minZ: -3, maxZ: 3, surface: 'boards', floor: 0xd2b49c, accent: 0xbfa8cf },
    { id: 'study', name: '书房', minX: 1.5, maxX: 9, minZ: -9, maxZ: -3, surface: 'boards', floor: 0xb39068, accent: 0x86aaa6 },
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
    { z: -9, at: -5.5, w: 2.0, sill: 1.3 }, { z: -9, at: 6.3, w: 1.8 }, { z: -9, at: 0, w: 1.1, sill: 1.65, head: 2.45 },   // 北：厨房、书房、楼梯上方
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
    { id: 'stairs', kind: 'stairs', face: 's', x: 0, z: -8.0, w: 2.6, d: 1.8, h: 1.4, color: 0xa98463 },
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
  enemies: [
    // 花园
    { type: 'walker', x: -4.5, z: 5.5, state: 'idle', heading: Math.PI / 2, patrol: [[3.5, 5.5], [-4.5, 5.5]] },
    { type: 'runner', x: -7.6, z: 5.0, state: 'asleep', heading: 0 },
    { type: 'walker', x: 7.0, z: 7.6, state: 'asleep', heading: -Math.PI / 2 },
    // 门厅：第一只背对正门，给玩家一次从背后下手的机会
    { type: 'walker', x: 0, z: -0.5, state: 'idle', heading: Math.PI },
    { type: 'leaper', x: 0.3, z: -5.6, state: 'asleep', heading: 0 },
    // 客厅
    { type: 'weaver', x: -5.4, z: 1.8, state: 'idle', heading: Math.PI, patrol: [[-5.4, -2.1], [-5.4, 1.8]] },
    { type: 'walker', x: -7.6, z: -2.3, state: 'asleep', heading: Math.PI / 2 },
    { type: 'runner', x: -2.3, z: 2.4, state: 'asleep', heading: -Math.PI / 2 },
    // 厨房
    { type: 'heavy', x: -7.2, z: -4.8, state: 'idle', heading: Math.PI / 2 },
    { type: 'walker', x: -3.0, z: -7.6, state: 'asleep', heading: 0 },
    { type: 'walker', x: -7.3, z: -7.6, state: 'asleep', heading: Math.PI / 2 },
    // 卧室
    { type: 'leaper', x: 4.9, z: 1.3, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'weaver', x: 2.6, z: -0.6, state: 'idle', heading: Math.PI / 2, patrol: [[7.4, -0.6], [2.6, -0.6]] },
    // 书房
    { type: 'heavy', x: 6.9, z: -6.2, state: 'asleep', heading: -Math.PI / 2 },
    { type: 'runner', x: 3.2, z: -6.4, state: 'idle', heading: Math.PI / 2, patrol: [[7.0, -5.2], [3.2, -6.4]] },
    { type: 'walker', x: 3.4, z: -7.4, state: 'asleep', heading: 0 },
  ],

  pickups: [
    { kind: 'ammo', weapon: 'scatter', amount: 4, x: 5.4, z: 9.6 },
    { kind: 'ammo', weapon: 'scatter', amount: 4, x: -2.0, z: -7.6 },
    { kind: 'ammo', weapon: 'heavy', amount: 2, x: 2.2, z: 2.4 },
    { kind: 'ammo', weapon: 'heavy', amount: 2, x: 8.3, z: -8.3 },
    { kind: 'heart', amount: 1, x: -8.3, z: 2.4 },
    { kind: 'heart', amount: 1, x: 1.0, z: -6.6 },
  ],
};
