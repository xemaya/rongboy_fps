// 机关的数值（docs/fun-design.md 第 9 节）。规则层（level.js、game.js）、画面（world.js、main.js）和地图工具共用。不依赖 DOM。
// 一张图只用一种。都是"朝它打一球"触发，只能用一次；效果都是玩家已经见过的。
// w / d / h：碰撞盒（米）。都架在齐胸高，平射就打得到。radius：生效范围，圆心是机关自己。
export const GADGETS = {
  // 闹钟：响 time 秒。radius 米内还没发现你的僵尸走过去围着看（隔着墙减半，和枪声一样）；响完它们就留在那儿。
  clock: { name: '闹钟', verb: '引过去', w: 0.5, d: 0.5, h: 1.3, radius: 9, time: 14 },
  // 颜料桶：炸开，效果就是一颗毛线团手雷（范围、伤害、缠住的时间都取自 WEAPONS 里的 yarn）。
  bucket: { name: '颜料桶', verb: '炸开', w: 0.6, d: 0.6, h: 1.25, radius: 2.6 },
  // 聚光灯：灯亮，radius 米内被照到的僵尸定住 stun 秒（棉甲和首领打六折，和静电枪一样）。不掉血，也不惊动它们。
  spot: { name: '聚光灯', verb: '定住', w: 0.5, d: 0.5, h: 1.75, radius: 3.2, stun: 3.5 },
};
// 拉链暗格：毛球打在离拉链这么近的墙上（并且高度在 lo–hi 之间）就拉开。
export const STASH = { reach: 0.55, lo: 0.35, hi: 2.1 };
