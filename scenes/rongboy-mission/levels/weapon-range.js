import { trainingDef } from './training.js';

export function weaponRange() {
  const yard = trainingDef('archer');
  const bounds = { minX:-4.2, maxX:4.2, minZ:-15, maxZ:8 };
  return {
    ...yard, id:'weapon-range', name:'武器试验场', look:'night', bounds,
    rooms:[{ id:'range', name:'试验走廊', ...bounds, floor:0xb78c67 }],
    walls:[
      { x:bounds.minX, z:[bounds.minZ,bounds.maxZ] }, { x:bounds.maxX, z:[bounds.minZ,bounds.maxZ] },
      { z:bounds.minZ, x:[bounds.minX,bounds.maxX] }, { z:bounds.maxZ, x:[bounds.minX,bounds.maxX] },
    ],
    lamps:[{ x:0, z:4 }, { x:0, z:-9 }],
    furniture:[{ id:'range-crate', kind:'crate', x:2.85, z:-2.9, w:1.2, d:.85, h:1.48, color:0x826759 }],
    player:{ x:0, z:4.2, yaw:0 },
    mission:{ type:'clear', title:'试射武器，击倒走廊里的僵尸' },
    arsenal:['single','heavy','yarn','jack'], startWeapon:'heavy',
    pickups:[{kind:'ammo',weapon:'yarn',amount:3,x:-1.9,z:4.5},{kind:'ammo',weapon:'jack',amount:4,x:1.9,z:4.5}],
    enemies:[
      { type:'walker', x:-.78, z:.35, state:'asleep', heading:0 },
      { type:'walker', x:.78, z:.35, state:'asleep', heading:0 },
      { type:'shielded', x:0, z:-5.85, state:'idle', heading:0 },
      { type:'heavy', x:-1.08, z:-10.6, state:'asleep', heading:0 },
    ],
  };
}
