// 布偶游乐园：世界观里的第 5 关（docs/worldview.md）。十站连成一关：每站一道门，这一站的事办完门才开，最后在马戏帐篷里打嬉笑小丑。
// 规则在 ../amusement.js（门、机关、小丑）和 ../park-rides.js（设施）；样子在 ../park-tour-view.js（布景）和 ../amusement-view.js（门、机关、帐篷里面）。
// 这里的 furniture 只是碰撞盒（parkStyle：通用布景不画它，由游乐园自己画）。人和僵尸能走的地方是小径（park-tour-layout.js）。
import { TOUR_BOUNDS, TOUR_PATH, TOUR_STOPS, TOUR_MAZE, CAROUSEL, GATE, HAUNT, TENT, TENT_DOOR, isTourWalkable, isHauntWalkable } from '../park-tour-layout.js';
import { PARK_ZONES, GATES, LOCK, VALVE, COASTER_TARGETS, BALLOONS, checkpointPosition } from '../amusement.js';
import { SPOTS } from '../park-rides.js';

const stage = id => PARK_ZONES.findIndex(zone => zone.id === id);

const solid = (id, x, z, w, d, h) => ({ id, x, z, w, d, h, kind: 'crate', parkStyle: 'scenery' });
// 帐篷：四面帐布（挡人也挡毛球），正面留出门洞，门廊两根柱子
const side = TENT.a - .25, back = TENT.z - TENT.b + .25, jamb = 1.86;
const tent = [
  solid('tent-west', -side, TENT.z, .3, TENT.b * 2, TENT.wall), solid('tent-east', side, TENT.z, .3, TENT.b * 2, TENT.wall),
  solid('tent-back', TENT.x, back, TENT.a * 2, .3, TENT.wall),
  ...[-1, 1].map(sx => solid(`tent-front-${sx}`, sx * (jamb + side) / 2, TENT_DOOR - .1, side - jamb, .3, TENT.wall)),
  ...[-1, 1].map(sx => solid(`tent-post-${sx}`, sx * 2.06, TENT_DOOR + .5, .46, .5, TENT.wall)),
];
// 门洞留宽。盒子和鬼屋外墙用同一份尺寸，身体、弹丸和手臂探测都能用。
const hauntShell = HAUNT.shell;
const hauntFront = hauntShell.z - (hauntShell.d - hauntShell.thickness) / 2;
const hauntWalls = [
  solid('haunt-back', hauntShell.x, hauntShell.z + (hauntShell.d - hauntShell.thickness) / 2,
    hauntShell.w, hauntShell.thickness, hauntShell.height),
  ...[-1, 1].map(side => solid(`haunt-side-${side}`,
    hauntShell.x + side * (hauntShell.w - hauntShell.thickness) / 2, hauntShell.z,
    hauntShell.thickness, hauntShell.d, hauntShell.height)),
  ...[[hauntShell.x - hauntShell.w / 2, HAUNT.door.x - hauntShell.doorHalf],
    [HAUNT.door.x + hauntShell.doorHalf, hauntShell.x + hauntShell.w / 2]].map(([a,b], i) =>
    solid(`haunt-front-${i}`, (a + b) / 2, hauntFront, b - a, hauntShell.thickness, hauntShell.height)),
];

// 每站三个营位，坐标沿缝线小径。最后一波加一只，不让十只同时追进窄路。
const W = 'walker', L = 'leaper', S = 'shielded', C = 'crawler', B = 'bomber', A = 'archer';
const squads = [
  [],  // 售票口只教冻门栓
  [  // 木马：路口暖身，摇铃后从气浪扫得到的位置靠过来
    [[W,-23.4,22.7],[W,-25.4,22.9],[L,-27.0,21.6]],
    [[S,-24.5,22.2],[W,-27,21.6],[L,-28.7,20.0]],
    [[W,-22.4,22.9],[W,-25.7,22.8],[L,-29.3,21.1],[W,-30.8,19.5]],
  ],
  [  // 激流勇进：回码头以后，先堵木桥两侧
    [[W,-35.3,11.4],[C,-36.8,9.6],[W,-36.7,3.7]],
    [[W,-37.4,4.1],[L,-35.6,2.0],[C,-36.5,0.1]],
    [[W,-36.8,10.9],[L,-36,5.0],[W,-37.1,1.8],[B,-35.0,-3.5]],
  ],
  [  // 过山车：停稳之后，出站小径上有抛弹和扑击
    [[L,-33.0,-9.4],[W,-32.3,-11.6],[W,-29.6,-16.9]],
    [[B,-29.4,-17.4],[W,-27.4,-20.1],[L,-25.0,-21.2]],
    [[W,-33.6,-8.2],[L,-31.0,-14.8],[W,-26.4,-21.2],[B,-22.8,-22.5]],
  ],
  [  // 鬼屋：摇铃后出门，敌人留在门廊外的宽路
    [[C,-9.8,-22.5],[C,-4.2,-21.7],[W,-2.5,-21.3]],
    [[W,-11.5,-23.5],[L,-1.4,-22.0],[C,1.6,-23.2]],
    [[W,-8.6,-22.9],[C,-4.8,-22.9],[L,0.2,-22.6],[W,3.3,-23.6]],
  ],
  [  // 摩天轮：下吊舱后，向两侧分散的守卫，末波有弓手
    [[W,14.6,-26.8],[L,22.0,-26.2],[W,25.8,-24.6]],
    [[S,15.0,-25.6],[W,20.9,-24.8],[A,27.1,-24.3]],
    [[W,12.4,-26.6],[L,21.9,-26.8],[W,25.9,-23.6],[A,29.1,-22.9]],
  ],
  [  // 游戏摊：投球先完成，离开柜台后才有战斗
    [[W,34.8,-16.1],[W,36.8,-8.5],[L,35.4,-3.2]],
    [[S,34.6,-11.6],[W,36.5,-6.0],[C,35.1,-2.1]],
    [[W,34.2,-18.5],[L,36.2,-13.6],[W,36.9,-7.0],[B,35.9,-0.8]],
  ],
  [  // 碰碰车：下车后在场边绕着软垫围挡打
    [[W,36.2,4.0],[L,34.3,12.1],[W,32.4,14.2]],
    [[S,36.9,7.1],[W,35.5,11.6],[L,31.0,15.1]],
    [[W,36.9,3.9],[C,36.8,9.4],[W,33.8,13.2],[B,30.7,15.7]],
  ],
  [  // 镜子迷宫：门口、镜廊正路、出口去帐篷的小径
    [[W,25.5,18.3],[C,23.6,19.0],[L,21.2,19.8]],
    [[C,16.4,18.4],[L,14.3,15.5],[W,11.1,16.1]],
    [[W,9.3,20.2],[C,7.3,20.7],[L,4.0,18.8],[W,2.1,13.5]],
  ],
  [  // 马戏帐篷：十只前场守卫打完才演登场，小丑独自接战
    [[W,-3.8,3.0],[W,3.7,2.8],[L,0,0.55]],
    [[S,-4.0,1.35],[W,3.6,.65],[L,-1.3,-.25]],
    [[W,4.5,2.1],[C,-4.6,1.0],[L,1.8,-.65],[W,-2.8,-1.1]],
  ],
];
const enemies = squads.flatMap((waves, zone) => waves.flatMap((waveEnemies, wave) =>
  waveEnemies.map(([type, x, z]) => ({ type, x, z, zone, wave, state:'alert', dormant:true }))
));

export default {
  id: 'amusement', name: '布偶游乐园', look: 'orchard', tour: true,
  bounds: TOUR_BOUNDS, height: 14, wallThickness: .2, doorHeight: 2.35,
  player: { x: TOUR_PATH[0].x, z: TOUR_PATH[0].z, yaw: .20 },
  rooms: [{ id: 'park', name: '布偶游乐园', ...TOUR_BOUNDS, outdoor: true }],
  theme: { yard: 'park-tour', lawn: 0x8ba05f, lightCell: 2, lightRays: 18 },
  mission: { type: 'amusement', title: '点亮游乐园，打败嬉笑小丑' },
  // 给 node scripts/map.mjs check 用（小径地图的检查，见 mapkit/check.js 的 checkPath）：路、门、要按的地方、要打的东西
  path: {
    line: TOUR_PATH, walkable: isTourWalkable, indoor: isHauntWalkable,
    stages: PARK_ZONES.map(zone => zone.name), gates: GATES, start: checkpointPosition,
    spots: SPOTS.map(q => ({ id: q.id, x: q.x, z: q.z, stage: stage(q.stop) })),
    targets: [
      { id: '门栓', ...LOCK, stage: stage('entrance') }, { id: '蒸汽阀', ...VALVE, stage: stage('carousel') },
      ...COASTER_TARGETS.map((t, i) => ({ id: '轨道靶 ' + i, ...t, stage: stage('coaster') })),
      ...BALLOONS.map(b => ({ id: b.key ? '钥匙气球' : '水道上的气球', x: b.x, y: b.y, z: b.z, stage: b.zone, ride: true })),
      ...HAUNT.ghosts.map((g, i) => ({ id: '幽灵 ' + i, x: g.x, y: g.y + .24, z: g.z - 1.02, stage: stage('haunt') })),
    ],
  },
  arsenal: ['single', 'freeze'], startWeapon: 'freeze',
  furniture: [
    ...tent,
    ...hauntWalls,
    ...TOUR_MAZE.map((p, i) => solid('mirror-' + i, p.x, p.z, p.w, p.d, 2.2)),
    solid('coaster-plinth', TOUR_STOPS[3].x, TOUR_STOPS[3].z, 12, 7, 1.0),
    // 木马的底座是圆的：三个盒子叠成一个八边形，再加台阶那一块
    ...(R => [[2 * R, .83 * R], [.83 * R, 2 * R], [1.42 * R, 1.42 * R]].map(([w, d], i) => solid('carousel-platform-' + i, CAROUSEL.x, CAROUSEL.z, w, d, .6)))(CAROUSEL.platform + .1),
    solid('carousel-steps', CAROUSEL.x + Math.sin(CAROUSEL.steps) * (CAROUSEL.platform + .45), CAROUSEL.z + Math.cos(CAROUSEL.steps) * (CAROUSEL.platform + .45), 2.5, 1.0, .4),
    // 入口：两座塔楼和售票亭，只能从拱门底下过
    solid('gate-tower-w', GATE.x - GATE.half, GATE.z, 1.56, 1.56, 4),
    solid('gate-tower-e', GATE.x + GATE.half, GATE.z, 1.56, 1.56, 4),
    solid('ticket-booth', GATE.booth.x, GATE.booth.z + .2, 2.2, 2.3, 2.6),
    solid('ferris-platform', TOUR_STOPS[5].x, TOUR_STOPS[5].z, 8, 4, 1),
    solid('bumper-rink', TOUR_STOPS[7].x, TOUR_STOPS[7].z, 10, 6.8, .60),
    solid('valve-pipe', VALVE.x, VALVE.z, .34, .34, .95),
  ],
  enemies,
  pickups: [
    { kind: 'potion', x: -20.6, z: 23.2 },
    { kind: 'potion', x: -35.2, z: 11.2 },    // 木马打完，去激流勇进的路上
    { kind: 'potion', x: -24.6, z: -22.0 },   // 过山车打完，出站的路上
    { kind: 'potion', x: -9.9, z: -22.55 },
    { kind: 'potion', x: 18.5, z: -26.0 },
    { kind: 'potion', x: 36.0, z: -1.8 },
    { kind: 'potion', x: 35.3, z: 10.8 },     // 游戏摊街尽头
    { kind: 'potion', x: 1.4, z: 9.4 },       // 帐篷门外
    { kind: 'potion', x: 3.1, z: TENT_DOOR - 1.85 },   // 帐篷门里，安全垫旁边
  ],
  texts: {
    short: '布偶游乐园', title: '布偶游乐园',
    intro: '游乐园的灯全灭了。带着急冻射线枪从入口进去，一站一站把设施玩过去：每站完成设施任务并清场，下一站的门才开。最后进马戏帐篷，会一会嬉笑小丑。',
    brief: 'WASD 移动，方向键转动视角，空格开火，Q 换枪，H 喝血瓶。走近设施按 F 互动。入口：急冻枪冻住摇摆的门栓，换手枪击碎。',
    how: ['WASD 移动 · 方向键转动视角 · 空格开火', 'Q 换枪 · R 换弹 · H 喝血瓶 · F 玩设施（坐着的时候再按一次是下车）', '急冻枪定住会动的机关和僵尸，再换手枪打', '每站办完一件事门才开 · 倒下了从这一站的门口重来'],
    start: '入园', won: '拿到了高压马达！',
  },
  par: 1500,
};
