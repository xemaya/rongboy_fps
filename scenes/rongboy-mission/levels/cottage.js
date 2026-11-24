// Long orchard with two parallel routes and a small two-room packing barn.
// Wave groups have fixed homes in different parts of the farm.
// The crawler and the Chain Eater still need first-run balance feedback here.
import { buildMap } from '../mapkit/build.js';

const farm = buildMap({
  id: 'cottage',
  name: '奶奶家 · 果园保卫战',
  theme: 'home',
  look: 'orchard',
  arsenal: ['single','scatter','yarn','jack'],
  mission: { type:'clear', title:'清理果园的三波僵尸' },
  par: 480,
  texts: {
    short:'奶奶家',
    eyebrow:'第四关 · 果园保卫战',
    title:'守住奶奶的<br>果园。',
    intro:'绕过果树行，清完晾晒场，再到果料仓迎战噬连兽。',
    brief:'先清果树行，再去晾晒场，最后到果料仓迎战噬连兽。两波之间有时间换弹。',
    start:'进入果园',
    hint:'果树行和木箱道可以互相绕行',
    won:'果园守住了！',
  },
  origin: [-12,-8],
  cell: 1.5,
  start: { room:'G' },
  layout: [
    ...Array(4).fill('PPPPPPPPSSSSSSSS'),
    ...Array(6).fill('VVVVVVVVDDDDDDDD'),
    ...Array(7).fill('OOOOOORRRREEEEEE'),
    ...Array(4).fill('GGGGGGGGGGGGGGGG'),
  ],
  doors: [
    { between:['P','V'],at:.28,width:2.3 }, { between:['P','V'],at:.75,width:1.7 },
    { between:['S','D'],at:.35,width:2.35 }, { between:['S','D'],at:.75,width:1.85 },
    { between:['P','S'],at:.52,width:2.3 },
  ],
  rooms: {
    G: {id:'gate',name:'果园入口',outdoor:true,floor:0xb9a366,
      props:[{look:'hedge',place:'start',h:1.6},{look:'crate',at:[.15,.48]},
        {look:'crate',id:'harvest-stack',x:7.4,z:19.9,w:2.15,d:1.35,h:1.45,color:0xb98650}],
      zombies:['leaper:asleep','walker:patrol'],pickups:['heart']},
    O: {id:'orchard',name:'果树行',outdoor:true,floor:0x9faa67,
      props:[{look:'tree',rows:3,cols:2,h:2.15},{look:'crate',at:[.18,.86]}],
      zombies:['walker:patrol','crawler:patrol','leaper:asleep'],pickups:['stun','ammo']},
    R: {id:'lane',name:'果篮小路',outdoor:true,floor:0xbc9e67,
      props:[{look:'hedge',at:[.51,.54],turn:true,h:1.6},{look:'crate',at:[.19,.23]}],
      zombies:['leaper:patrol','walker:asleep'],pickups:['yarn']},
    E: {id:'crates',name:'木箱道',outdoor:true,floor:0xba9a65,
      props:[{look:'crate',rows:2,cols:2,h:1.15}],
      zombies:['archer:patrol'],pickups:['ammo']},
    V: {id:'beds',name:'菜地',outdoor:true,floor:0xafab69,
      props:[{look:'planter',rows:2,cols:2},{look:'tree',at:[.13,.29],h:2.1}],
      zombies:['leaper:patrol','leaper:patrol','heavy:patrol','crawler:asleep'],
      pickups:['needle','heart']},
    D: {id:'drying',name:'晾晒场',outdoor:true,floor:0xc1a470,
      props:[{look:'bench',at:[.21,.53]}, {look:'crate',at:[.77,.36],h:1.2}, {look:'crate',at:[.68,.76]}, {look:'hedge',at:[.20,.79],h:1.45}],
      zombies:['walker:patrol','leaper:patrol','bomber:patrol','archer:patrol'],
      pickups:['heavy','ammo','yarn']},
    P: {id:'packing',name:'分拣间',surface:'boards',floor:0xcbaa75,accent:0x886d53,
      props:['bookshelf@w','crate@n',{look:'island',id:'produce-counter',at:[.36,.55]},{look:'desk',id:'sorting-desk',at:[.76,.38]}],
      zombies:['walker:patrol','shielded:patrol','leaper:patrol','shielded:patrol'],
      pickups:['heart','ammo'],stash:['ammo']},
    S: {id:'store',name:'果料仓',surface:'terry',floor:0x9e966a,accent:0x817258,
      props:['cabinet@n',{look:'crate',at:[.24,.28],h:1.24},{look:'crate',at:[.78,.64],h:1.1}],
      zombies:['walker:patrol','bomber:patrol','leaper:patrol','boss-leech:patrol'],
      pickups:['sewing','ammo'],stash:['heart']},
  },
  raw: {
    gadgets:[{kind:'quilt',x:5.8,z:2.15}],
    easterEggs:[
      {id:'scarecrow',x:-8.1,y:.93,z:1.55,w:1.08,d:.43,h:1.78},
      {id:'pot',mount:{host:'produce-counter',up:.20,forward:.04},w:.69,d:.55,h:.53},
      {id:'sewing',mount:{host:'sorting-desk',up:.29},w:.86,d:.57,h:.62},
      {id:'rocker',x:10.1,y:.56,z:.6,yaw:-Math.PI/4,w:1,d:.81,h:1.2},
    ],
  },
});

const stages = [
  { name:'果树行', rooms:['gate','orchard','lane','crates'] },
  { name:'晾晒场', rooms:['beds','drying'] },
  { name:'果料仓', rooms:['packing','store'] },
];

export default {
  ...farm,
  enemyPace: 1.22,
  roomAlerts: true,
  resumePatrolAfterSearch: true,
  theme: {
    ...farm.theme, yard:'orchard', wall:0xe6c38e, roofColor:0x737b59, lawn:0xa8a85e,
    facadeTrim:false, lightCell:.66,
  },
  waves: { count:stages.length, breakSeconds:3.2, stages:stages.map(stage=>stage.name) },
  enemies:farm.enemies.map(enemy => {
    const room = farm.rooms.find(r=>enemy.x>=r.minX && enemy.x<=r.maxX && enemy.z>=r.minZ && enemy.z<=r.maxZ);
    const wave = stages.findIndex(stage=>stage.rooms.includes(room?.id));
    return { ...enemy,wave,enabled:wave===0 };
  }),
};
