// 奶奶家：一层的小平房加菜园，18 × 18 米。第四张地图，也是地图生成器的示例（docs/map-guide.md）：整张图是用它写的。
// 这里只有草图，墙、门洞、窗、灯和每样东西的坐标由 mapkit/build.js 展开。看展开结果：node scripts/map.mjs print cottage
//
// 一格 1.5 米。玩家从菜园南边的院门进来，面朝北。
// 教学顺序：菜园只有跳跳 → 客厅第一次见弓手 → 厨房第一次见棉甲（毛衣针在门厅）→ 缝纫间第一次见炸弹客 → 卧室第一次见持盾者（棉被炮在缝纫间）。
// 机关是闹钟（家主题默认）：菜园、客厅、缝纫间各一个；厨房和门厅的墙上各有一个拉链暗格。
// 卧室的第二只弓手、厨房的第二只炸弹客是体检之后加的：原先偷懒的机器人三遍都能几乎无伤打完。
import { buildMap } from '../mapkit/build.js';

export default buildMap({
  id: 'cottage',
  name: '奶奶家 · 小平房和菜园',
  theme: 'home',
  texts: {
    eyebrow: '第四关 · 奶奶家（小平房和菜园）',
    title: '奶奶不在家，<br>把僵尸请出去。',
    start: '走进菜园',
    hint: '树篱挡着你 · 从左边或右边绕出去 · 看到闹钟就打一下',
  },
  cell: 1.5,
  layout: [
    'KKKKKHHBBBBB',
    'KKKKKHHBBBBB',
    'KKKKKHHBBBBB',
    'LLLLLHHSSSSS',
    'LLLLLHHSSSSS',
    'LLLLLHHSSSSS',
    'LLLLLHHSSSSS',
    'GGGGGGGGGGGG',
    'GGGGGGGGGGGG',
    'GGGGGGGGGGGG',
    'GGGGGGGGGGGG',
    'GGGGGGGGGGGG',
  ],
  doors: ['G-H', 'G-L', 'L-H', 'L-K', 'K-H', 'H-S', 'H-B', 'S-B'],
  rooms: {
    G: { id: 'garden', name: '菜园', outdoor: true, gadget: true,
      props: [{ look: 'hedge', place: 'start', h: 1.7 }, 'shed@e', 'planter@w', 'bench@n', 'tree', 'crate'],
      zombies: ['walker:asleep', 'walker:patrol'],
      pickups: ['stun', 'yarn'] },
    H: { id: 'hall', name: '门厅', stash: ['heart'],
      props: ['console@n', 'crate@c'],
      zombies: ['leaper:asleep'],
      pickups: ['needle'] },
    L: { id: 'living', name: '客厅', rug: true, gadget: true,
      props: ['bookshelf@w', 'tv@n', 'sofa@se', 'coffee', 'cabinet@sw'],
      zombies: ['archer', 'walker:asleep', 'leaper:patrol'],
      pickups: ['heart'] },
    K: { id: 'kitchen', name: '厨房', stash: ['ammo'],
      props: ['fridge@nw', 'counter@n', 'island', 'dining'],
      zombies: ['heavy:idle', 'bomber', 'walker:asleep'],
      pickups: ['ammo'] },
    S: { id: 'sewing', name: '缝纫间', rug: true, gadget: true,
      props: ['desk@e', 'basket@ne', 'wardrobe@s', 'bookshelf@n'],
      zombies: ['bomber', 'walker:patrol', 'leaper:asleep'],
      pickups: ['heavy', 'yarn'] },
    B: { id: 'bedroom', name: '卧室',
      props: ['bed@n', 'nightstand@n', 'wardrobe@e', 'chest@s'],
      zombies: ['shielded', 'archer', 'walker:asleep'],
      pickups: ['heart', 'ammo'] },
  },
});
