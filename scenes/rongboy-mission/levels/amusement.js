// 布偶游乐场：世界观里的第 5 关（docs/worldview.md），四段：售票口 → 旋转木马 → 过山车 → 马戏帐篷里的嬉笑小丑。
// 规则在 ../amusement.js，样子在 ../amusement-view.js。这里的 furniture 只是碰撞盒（parkStyle：通用布景不画它，由游乐场自己画）。
import { PARK_BOUNDS, GATES, CAROUSEL, PLATFORM, TENT, TENT_DOOR } from '../amusement.js';

const B = PARK_BOUNDS;
const solid = (id, x, z, w, d, h) => ({ id, kind: 'crate', x, z, w, d, h, parkStyle: 'scenery' });
// 三道门两边的矮树篱；第三道是帐篷的正面，要高到挡得住毛球
const fence = GATES.flatMap((g, i) => [[B.minX, g.x - g.width / 2], [g.x + g.width / 2, B.maxX]]
  .map(([min, max], side) => solid(`fair-fence-${i}-${side}`, (min + max) / 2, g.z, max - min, .30, i === 2 ? TENT.wall : 1.12)));
// 帐篷的两侧和背后：帐布外面走不过去，毛球也飞不出去
const tentSide = TENT.a - .4, tentBack = TENT.z - TENT.b + .45;
const tent = [
  solid('tent-west', (B.minX - tentSide) / 2, (TENT_DOOR + B.minZ) / 2, B.maxX - tentSide, TENT_DOOR - B.minZ, TENT.wall),
  solid('tent-east', (B.maxX + tentSide) / 2, (TENT_DOOR + B.minZ) / 2, B.maxX - tentSide, TENT_DOOR - B.minZ, TENT.wall),
  solid('tent-back', 0, (tentBack + B.minZ) / 2, tentSide * 2, tentBack - B.minZ, TENT.wall),
];

export default {
  id: 'amusement', name: '布偶游乐场', look: 'orchard',
  bounds: B, height: 9, wallThickness: .2, doorHeight: 2.35,
  player: { x: 0, z: 39.2, yaw: 0 },
  rooms: [{ id: 'park', name: '布偶游乐场', ...B, outdoor: true }],
  theme: { yard: 'park-tour', lawn: 0x8ba05f, lightCell: 2, lightRays: 18 },
  mission: { type: 'amusement', title: '点亮游乐场，打败嬉笑小丑' },
  arsenal: ['single', 'freeze'], startWeapon: 'freeze',
  furniture: [
    ...fence, ...tent,
    solid('ticket-left', -3.8, 34.6, 2.5, 1.1, 1.3),
    solid('ticket-right', 3.9, 34.6, 2.2, 1.1, 1.3),
    solid('sweep-core', CAROUSEL.x, CAROUSEL.z, 1.35, 1.35, .68),
    solid('plaza-crate', 4.1, 18.0, 1.3, 1.25, 1.05),
    ...[-1, 1].flatMap(sx => [8.0, 10.8].map(z => solid(`station-post-${sx}-${z}`, PLATFORM.x + sx * 2.45, z, .28, .28, 2.7))),
    ...[-1, 1].map(sx => solid(`tent-post-${sx}`, sx * 2.06, TENT_DOOR + .5, .46, .5, TENT.wall)),   // 帐篷门廊的两根柱子
    solid('valve-pipe', 1.55, 23.6, .34, .34, .95), solid('carousel-switch', 1.55, 22.25, .44, .44, .8),
    solid('landing-crate-l', -5.8, -3.2, 1.3, 1.1, 1.05),
    solid('landing-crate-r', 5.8, -3.2, 1.3, 1.1, 1.05),
  ],
  enemies: [
    // 0 售票口：门栓碎了才醒
    { type: 'walker', x: 2.6, z: 30.2, state: 'idle', heading: 0, zone: 0, enabled: false },
    { type: 'leaper', x: -2.7, z: 29.8, state: 'asleep', heading: 0, zone: 0, enabled: false },
    // 1 木马广场：先是守着开关的两只，木马一转再来两只
    { type: 'walker', x: -5.1, z: 19.8, state: 'idle', heading: 0, zone: 1, enabled: false },
    { type: 'shielded', x: .85, z: 21.1, state: 'idle', heading: 0, zone: 1, enabled: false },
    { type: 'walker', x: -4.7, z: 17.2, state: 'idle', heading: 0, zone: 1, parkWave: true, enabled: false },
    { type: 'leaper', x: -.35, z: 16.8, state: 'idle', heading: 0, zone: 1, parkWave: true, enabled: false },
    // 2 过山车：河对岸的两只，车上、到站后都打得到
    { type: 'bomber', x: -3.1, z: -1.6, state: 'idle', heading: 0, zone: 2, enabled: false },
    { type: 'leaper', x: 3.0, z: -2.2, state: 'idle', heading: 0, zone: 2, enabled: false },
  ],
  pickups: [
    { kind: 'heart', amount: 30, x: 3.6, z: 13.6 },
    { kind: 'heart', amount: 30, x: 2.9, z: -3.6 },
    { kind: 'heart', amount: 30, x: 3.1, z: -7.3 },
  ],
  texts: {
    short: '布偶游乐场', title: '布偶游乐场',
    intro: '游乐场的灯全灭了。带着急冻射线枪，从售票口一路打到马戏帐篷：冻住机关、点亮彩灯，最后会一会嬉笑小丑。',
    brief: '急冻枪冻住摇摆的门栓，换手枪击碎。冻住蒸汽阀启动木马，把僵尸冻在木马扫过的地方。坐过山车过河，打亮两个轨道靶，再进帐篷打败嬉笑小丑。',
    start: '出发', won: '拿到了高压马达！',
  },
  par: 360,
};
