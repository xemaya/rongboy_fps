import { TOUR_BOUNDS, TOUR_PATH, TOUR_STOPS, TOUR_TENT, TOUR_MAZE } from '../park-tour-layout.js';

const solid=(id,x,z,w,d,h)=>({id,x,z,w,d,h,kind:'crate',parkStyle:'scenery'});
const tentWalls=Array.from({length:28},(_,i)=>{
  const a=i*Math.PI/14,x=Math.sin(a)*TOUR_TENT.radius,z=Math.cos(a)*TOUR_TENT.radius;
  return {x,z};
}).filter(p=>p.z<0||Math.abs(p.x)>1.37)
  .map((p,i)=>solid('big-top-rim-'+i,p.x,p.z,1.18,1.18,3.7));

export default {
  id:'amusement-tour',name:'布偶游乐园',look:'orchard',tour:true,
  bounds:TOUR_BOUNDS,height:14,wallThickness:.2,doorHeight:2.35,
  player:{x:TOUR_PATH[0].x,z:TOUR_PATH[0].z,yaw:.20},
  rooms:[{id:'park',name:'布偶游乐园',...TOUR_BOUNDS,outdoor:true}],
  theme:{yard:'park-tour',lawn:0x89966a,lightCell:2,lightRays:18},
  furniture:[
    ...tentWalls,
    ...TOUR_MAZE.map((p,i)=>solid('mirror-'+i,p.x,p.z,p.w,p.d,2.2)),
    solid('coaster-plinth',TOUR_STOPS[3].x,TOUR_STOPS[3].z,12,7,1.0),
    solid('carousel-platform',TOUR_STOPS[1].x,TOUR_STOPS[1].z,5.8,5.6,.42),
    solid('ferris-platform',TOUR_STOPS[5].x,TOUR_STOPS[5].z,8,4,1),
    solid('bumper-rink',TOUR_STOPS[7].x,TOUR_STOPS[7].z,10,6.8,.60),
  ],
  enemies:[],pickups:[],arsenal:[],
  mission:{type:'explore',title:'逛游乐园，集满十个章'},
  texts:{
    short:'布偶游乐园',title:'布偶游乐园',
    intro:'从入口沿弧形小径绕过外圈设施，最后穿过镜子迷宫走进中央马戏团。每个设施都能玩一下，玩过盖一个章。',
    brief:'WASD 移动，方向键转动视角。走近有星星的柱子按 F：木马会转，过山车和摩天轮能坐，碰碰车能开，鬼屋敲了门能进。集满十个章。',
    how:['WASD 移动 · 方向键转动视角','走近设施按 F 互动 · 坐着的时候再按一次是跳过'],
    start:'入园',won:'到达马戏团',
  },
};
