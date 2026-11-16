// A real playable test court. Single-type practice is opened from the model catalog.
import {ZOMBIE_ROSTER} from '../../../library/games/rongboy-roster.js';
export function trainingDef(requested=null){
 const kind=requested==='tank'?'heavy':requested,spec=ZOMBIE_ROSTER.find(s=>s.id===kind),single=!!spec;
 return {
  id:'training-'+(spec?.id||'all'),name:single?spec.name+'试战':'九类试战庭院',par:240,
  bounds:{minX:-12,maxX:12,minZ:-12,maxZ:12},height:3.2,wallThickness:.2,doorHeight:2.3,
  player:{x:0,z:single?4.2:10,yaw:0},mission:{type:'clear',title:single?'应对'+spec.name+'，击倒它'+(kind==='boss-warden'?'及限定援兵':''):'清空九类僵尸与限定援兵'},
  rooms:[{id:'training',name:single?spec.name+'试战':'试战庭院',minX:-12,maxX:12,minZ:-12,maxZ:12,outdoor:true,floor:0x879b76}],walls:[],
  furniture:[
   ...(!single?[{id:'start-hedge',kind:'hedge',x:0,z:7.2,w:5.2,d:.6,h:1.7,color:0x6d8f60}]:[]),
   {id:'low-bench',kind:'bench',x:single?3.0:0,z:1.6,w:2.2,d:.75,h:.62,color:0xc09b70},
   {id:'west-cover',kind:'cabinet',x:-5,z:1,w:1.0,d:3.0,h:1.85,color:0x829b90},
   {id:'east-cover',kind:'cabinet',x:5,z:1,w:1.0,d:3.0,h:1.85,color:0x9b9d7c},
   {id:'rear-cover',kind:'crate',x:0,z:-5.2,w:2.2,d:1.0,h:1.8,color:0xad8970},
   {id:'west-cushion',kind:'sofa',x:-6,z:-5,w:2.1,d:1,h:.7,color:0xb79c77},
   {id:'east-cushion',kind:'sofa',x:6,z:-5,w:2.1,d:1,h:.7,color:0xa697b4},
  ],
  enemies:single?[{type:kind,x:0,z:kind==='boss-leech'?-1:-2.2,state:'alert',heading:0}]:ZOMBIE_ROSTER.map((s,i)=>({type:s.id,x:[-7,0,7][i%3],z:[4.5,-1,-8][Math.floor(i/3)],state:'idle',heading:0})),
  pickups:[{kind:'ammo',weapon:'scatter',amount:8,x:-2.7,z:5.5},{kind:'ammo',weapon:'heavy',amount:5,x:2.7,z:5.5},{kind:'heart',amount:1,x:-9.5,z:-.5},{kind:'heart',amount:1,x:9.5,z:-.5}],
 };
}
