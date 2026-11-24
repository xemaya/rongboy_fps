// 布偶游乐园：世界观里的第 5 关（docs/worldview.md）。十站连成一关：每站一道门，这一站的事办完门才开，最后在马戏帐篷里打嬉笑小丑。
// 规则在 ../amusement.js（门、机关、小丑）和 ../park-rides.js（设施）；样子在 ../park-tour-view.js（布景）和 ../amusement-view.js（门、机关、帐篷里面）。
// 这里的 furniture 只是碰撞盒（parkStyle：通用布景不画它，由游乐园自己画）。人和僵尸能走的地方是小径（park-tour-layout.js）。
import { TOUR_BOUNDS, TOUR_PATH, TOUR_STOPS, TOUR_MAZE, CAROUSEL, GATE, TENT, TENT_DOOR } from '../park-tour-layout.js';
import { VALVE } from '../amusement.js';

const solid = (id, x, z, w, d, h) => ({ id, x, z, w, d, h, kind: 'crate', parkStyle: 'scenery' });
// 帐篷：四面帐布（挡人也挡毛球），正面留出门洞，门廊两根柱子
const side = TENT.a - .25, back = TENT.z - TENT.b + .25, jamb = 1.86;
const tent = [
  solid('tent-west', -side, TENT.z, .3, TENT.b * 2, TENT.wall), solid('tent-east', side, TENT.z, .3, TENT.b * 2, TENT.wall),
  solid('tent-back', TENT.x, back, TENT.a * 2, .3, TENT.wall),
  ...[-1, 1].map(sx => solid(`tent-front-${sx}`, sx * (jamb + side) / 2, TENT_DOOR - .1, side - jamb, .3, TENT.wall)),
  ...[-1, 1].map(sx => solid(`tent-post-${sx}`, sx * 2.06, TENT_DOOR + .5, .46, .5, TENT.wall)),
];

export default {
  id: 'amusement', name: '布偶游乐园', look: 'orchard', tour: true,
  bounds: TOUR_BOUNDS, height: 14, wallThickness: .2, doorHeight: 2.35,
  player: { x: TOUR_PATH[0].x, z: TOUR_PATH[0].z, yaw: .20 },
  rooms: [{ id: 'park', name: '布偶游乐园', ...TOUR_BOUNDS, outdoor: true }],
  theme: { yard: 'park-tour', lawn: 0x8ba05f, lightCell: 2, lightRays: 18 },
  mission: { type: 'amusement', title: '点亮游乐园，打败嬉笑小丑' },
  arsenal: ['single', 'freeze'], startWeapon: 'freeze',
  furniture: [
    ...tent,
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
  // zone：第几站的（这一站的门要等它们都倒下才开）。enabled: false = 先站着不动，轮到了规则层才叫醒；
  // parkWave = 不是一进这一站就醒，要等这一站的那件事（木马：摇了铃；过山车：下了车）。
  enemies: [
    // 1 旋转木马：进门路上两只，守着铃的两只；铃一摇再出来两只
    { type: 'walker', x: -19.6, z: 24.0, state: 'idle', heading: 0, zone: 1, enabled: false },
    { type: 'leaper', x: -22.6, z: 22.8, state: 'asleep', heading: 0, zone: 1, enabled: false },
    { type: 'walker', x: -27.6, z: 22.0, state: 'idle', heading: 0, zone: 1, enabled: false },
    { type: 'shielded', x: -25.0, z: 22.6, state: 'idle', heading: 0, zone: 1, enabled: false },
    { type: 'walker', x: -30.4, z: 19.4, state: 'idle', heading: 0, zone: 1, parkWave: true, enabled: false },
    { type: 'leaper', x: -29.2, z: 20.6, state: 'idle', heading: 0, zone: 1, parkWave: true, enabled: false },
    // 3 过山车：守在站台边的两只，下了车才围上来
    { type: 'bomber', x: -29.4, z: -17.4, state: 'idle', heading: 0, zone: 3, parkWave: true, enabled: false },
    { type: 'leaper', x: -33.0, z: -9.4, state: 'idle', heading: 0, zone: 3, parkWave: true, enabled: false },
  ],
  pickups: [
    { kind: 'potion', x: -35.2, z: 11.2 },    // 木马打完，去激流勇进的路上
    { kind: 'potion', x: -24.6, z: -22.0 },   // 过山车打完，出站的路上
    { kind: 'potion', x: 36.0, z: -1.8 },     // 游戏摊街尽头
    { kind: 'potion', x: 1.4, z: 9.4 },       // 帐篷门外
    { kind: 'potion', x: 3.1, z: TENT_DOOR - 1.85 },   // 帐篷门里，安全垫旁边
  ],
  texts: {
    short: '布偶游乐园', title: '布偶游乐园',
    intro: '游乐园的灯全灭了。带着急冻射线枪从入口进去，一站一站把设施玩过去：每站办完一件事，下一站的门才开。最后进马戏帐篷，会一会嬉笑小丑。',
    brief: 'WASD 移动，方向键转动视角，空格开火，Q 换枪，H 喝血瓶。走近设施按 F 互动。入口：急冻枪冻住摇摆的门栓，换手枪击碎。',
    start: '入园', won: '拿到了高压马达！',
  },
  par: 1500,
};
