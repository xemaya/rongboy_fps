// Same lawn, cover, actors and rules for both feedback variants.
import house from './house.js';

export const GARDEN_BOARD = 'garden-sewing-board';
export function gardenWallDef() {
  const garden = house.rooms.find(room => room.id === 'garden');
  const shield = {x:-1.85, z:6.0};
  const gate = {x:0,z:10.15};
  return {
    id:'garden-wall', name:'花园 · 一面墙', look:house.look,
    height:3.2, wallThickness:.20, doorHeight:2.05, par:100,
    bounds:{minX:garden.minX,maxX:garden.maxX,minZ:garden.minZ,maxZ:garden.maxZ},
    rooms:[garden], walls:[], arsenal:['single'], pickups:[], gadgets:[],
    player:{...gate,yaw:Math.atan2(gate.x-shield.x,gate.z-shield.z)},
    mission:{type:'clear',title:'清掉花园里的两只僵尸'},
    furniture:[
      ...house.furniture.filter(item=>['hedge-west','hedge-east','tree','shed'].includes(item.id))
        .map(item=>item.id==='hedge-west'?{...item,x:-4.02,w:4.15}:item),
      {id:GARDEN_BOARD,kind:'crate',look:'sewing-board',x:-1.55,z:4.16,w:5.4,d:.32,h:1.92,color:0x638d84},
    ],
    enemies:[
      {type:'shielded',...shield,state:'idle',heading:Math.atan2(gate.x-shield.x,gate.z-shield.z)},
      {type:'walker',x:-3.5,z:5.25,state:'asleep',heading:Math.PI*.43},
    ],
    texts:{short:'花园',hint:'',how:['用线轴手枪清掉花园里的两只僵尸。'],won:'花园安静了。'},
  };
}
