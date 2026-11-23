import { PARK_BOUNDS, GATES, CAROUSEL } from '../amusement.js';

const fence = GATES.flatMap((g, i) => [
  [PARK_BOUNDS.minX, g.x - g.width/2], [g.x + g.width/2, PARK_BOUNDS.maxX],
].map(([min,max],side)=>({id:`fair-fence-${i}-${side}`,kind:'crate',x:(min+max)/2,z:g.z,w:max-min,d:.30,h:1.12,color:0x9b7660})));

export default {
  id:'amusement-whitebox', name:'布偶游乐场 · 白盒', look:'orchard',
  bounds:PARK_BOUNDS, height:9, wallThickness:.2, doorHeight:2.35,
  player:{x:0, z:39.2, yaw:0},
  rooms:[{id:'park', name:'布偶游乐场', ...PARK_BOUNDS, outdoor:true}],
  theme:{yard:'park-tour', lawn:0x9cac77, lightCell:2, lightRays:18},
  mission:{type:'amusement', title:'冻住机关，一路点亮游乐场'},
  arsenal:['single','freeze'], startWeapon:'freeze',
  furniture:[
    ...fence,
    {id:'ticket-left',kind:'crate',x:-3.8,z:34.6,w:2.5,d:1.1,h:1.3,color:0xbba17e},
    {id:'ticket-right',kind:'crate',x:3.9,z:34.6,w:2.2,d:1.1,h:1.3,color:0xbba17e},
    {id:'sweep-core',kind:'crate',x:CAROUSEL.x,z:CAROUSEL.z,w:1.35,d:1.35,h:.68,parkStyle:'carousel'},
    {id:'plaza-crate',kind:'crate',x:4.1,z:18.0,w:1.3,d:1.25,h:1.05,color:0xae7656},
    {id:'landing-crate-l',kind:'crate',x:-5.8,z:-3.2,w:1.3,d:1.1,h:1.05,color:0xb3825c},
    {id:'landing-crate-r',kind:'crate',x:5.8,z:-3.2,w:1.3,d:1.1,h:1.05,color:0xb3825c},
  ],
  enemies:[
    // Zone 0: Ticket Gate (woken when latch shatters)
    {type:'walker',x:2.6,z:30.2,state:'idle',heading:0,zone:0,enabled:false},
    {type:'leaper',x:-2.7,z:29.8,state:'asleep',heading:0,zone:0,enabled:false},
    // Zone 1: Carousel Plaza (initial guards + wave on carousel spin)
    {type:'walker',x:-5.1,z:19.8,state:'idle',heading:0,zone:1,enabled:false},
    {type:'shielded',x:.85,z:21.1,state:'idle',heading:0,zone:1,enabled:false},
    {type:'walker',x:-4.7,z:17.2,state:'idle',heading:0,zone:1,parkWave:true,enabled:false},
    {type:'leaper',x:-.35,z:16.8,state:'idle',heading:0,zone:1,parkWave:true,enabled:false},
    // Zone 2: Coaster Flyover (north shore guards, shootable from coaster or landing deck)
    {type:'bomber',x:-3.1,z:-1.6,state:'idle',heading:0,zone:2,enabled:false},
    {type:'leaper',x:3.0,z:-2.2,state:'idle',heading:0,zone:2,enabled:false},
  ],
  pickups:[
    {kind:'heart',amount:30,x:3.6,z:13.6},
    {kind:'heart',amount:30,x:2.9,z:-3.6},
    {kind:'heart',amount:30,x:3.1,z:-7.3},
  ],
  texts:{
    short:'布偶游乐场 · 白盒', title:'布偶游乐场 · 白盒',
    brief:'急冻摇摆门栓后切手枪击碎。冻住蒸汽阀开木马扫冰雕，乘过山车飞跃河道击亮轨道靶，最后进帐篷迎战嬉笑小丑！',
    start:'出发', won:'拿到了高压马达！',
  },
  par:360,
};
