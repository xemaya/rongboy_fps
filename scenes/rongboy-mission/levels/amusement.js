// The linear park is available by URL while being playtested.
import { PARK_BOUNDS, PARK_ZONES, GATES } from '../amusement.js';

const rooms = PARK_ZONES.map((zone,i)=>({
  id:zone.id,name:zone.name,minX:PARK_BOUNDS.minX,maxX:PARK_BOUNDS.maxX,
  minZ:GATES[i]?.z ?? PARK_BOUNDS.minZ,maxZ:GATES[i-1]?.z ?? PARK_BOUNDS.maxZ,outdoor:true,
}));
const widths = [PARK_BOUNDS.minX,PARK_BOUNDS.maxX];
const separators = GATES.flatMap((gate,i)=>[
  [widths[0],gate.x-gate.width/2],[gate.x+gate.width/2,widths[1]],
].map(([from,to],side)=>({
  id:`divider-${i}-${side}`,kind:'crate',parkStyle:'divider',x:(from+to)/2,z:gate.z,w:to-from,d:.28,h:2.16,
})));
const prop = (id,parkStyle,x,z,w,d,h) => ({id,kind:'crate',parkStyle,x,z,w,d,h});
const foes=(zone,points)=>points.map(([type,x,z])=>({type,x,z,zone,enabled:zone===0,state:'asleep',heading:0}));

export default {
  id:'amusement',name:'布偶游乐场',look:'orchard',height:7,wallThickness:.20,doorHeight:2.2,
  bounds:PARK_BOUNDS,
  player:{x:0,z:51.65,yaw:0},
  theme:{yard:'amusement',lawn:0xb2a674,lightCell:1.3,lightRays:22},
  mission:{type:'amusement',title:'逐区夺回游乐场，最后挑战嬉笑小丑'},
  par:480,
  arsenal:['single','sewing'],startWeapon:'single',
  roomAlerts:true,
  rooms,
  furniture:[
    ...separators,
    prop('ticket-west','ticket',-6.3,48.2,5,2.5,1.47),
    prop('ticket-east','ticket',6.3,48.2,5,2.5,1.47),
    {id:'ticket-queue',kind:'crate',x:.6,z:46.1,w:1.85,d:1.35,h:1.19,color:0xbb8064},
    {id:'ticket-luggage',kind:'crate',x:-5.2,z:51.3,w:1.7,d:1.15,h:.83,color:0xb78b58},
    {id:'rail-box-west',kind:'crate',x:-5.75,z:34,w:1.7,d:1.45,h:.92,color:0xb47851},
    {id:'rail-box-east',kind:'crate',x:5.4,z:36,w:1.65,d:1.35,h:1.2,color:0xbf8e57},
    {id:'station-luggage',kind:'crate',x:6.9,z:28,w:1.55,d:1.25,h:1.3,color:0xa77a63},
    {id:'plaza-crate',kind:'crate',x:6.3,z:20.3,w:1.8,d:1.2,h:1.45,color:0xd08069},
    {id:'plaza-benches',kind:'bench',look:'bench',x:-6.9,z:16.35,w:2.75,d:.86,h:.62,color:0x658a7e},
    prop('game-west-front','booth',-7,12,4,2,.99),
    prop('game-east-front','booth',7,12,4,2,.99),
    prop('game-west-back','booth',-7,7.2,4,2,.99),
    prop('game-east-back','booth',7,7.2,4,2,.99),
    {id:'game-cashbox',kind:'crate',x:0,z:9,w:1.65,d:1,h:1.19,color:0xba7b61},
    prop('stock-west','stock',-6,1,5.5,1,1.62),
    prop('stock-east','stock',4.2,1.7,5,1.0,1.54),
    prop('stock-middle','stock',-1.4,-1.8,5.4,1.2,1.57),
    {id:'stock-crates',kind:'crate',x:7,z:-2.5,w:3,d:2,h:1.67,color:0x8f746c},
  ],
  enemies:[
    ...foes(0,[['walker',-2.25,49.2],['walker',-.4,47.7],['leaper',3.2,46.2]]),
    ...foes(1,[['walker',-3.25,35.15],['leaper',2.3,33.6],['walker',3.5,30.7],['walker',-2.65,29.6]]),
    ...foes(2,[['walker',-4.7,21.25],['walker',-5.8,20.6],['walker',-5.9,17.8],['walker',-2.3,18.15],['leaper',-2.6,21.15]]),
    ...foes(3,[['walker',-3.3,11.4],['leaper',3.9,10.7],['archer',6.5,5.75],['walker',-6,5.75]]),
    ...foes(4,[['walker',2.65,3.05],['leaper',-1.2,2.8],['walker',-3.0,-.1],['bomber',4.85,-3.53]]),
  ],
  pickups:[
    {kind:'ammo',x:2.7,z:47.0},
    {kind:'heart',amount:20,x:4.2,z:30.5},
    {kind:'heart',amount:24,x:7.2,z:17.3},
    {kind:'ammo',x:-10.2,z:6.7},
    {kind:'heart',amount:32,x:2.7,z:-3.4},
  ],
  texts:{
    short:'布偶游乐场',title:'布偶游乐场',
    intro:'从售票口一路夺回游乐场，最后进帐篷挑战嬉笑小丑。',
    how:['WASD 移动 · 方向键瞄准 · 空格射击 · F 操作设施'],
    start:'出发',
    brief:'从售票口开始。清完每区的守卫，完成当地的机关目标，下一道门就会打开。',
    won:'游乐场重新亮灯了！',
  },
};
