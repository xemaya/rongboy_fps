// Authoritative attack timings and readable counterplay, shared by game and model gallery.
// 箭的速度（米/秒）。弓手锁定前按它算提前量。
export const ARROW_SPEED=7.5;
// 远程出手（箭、炸弹）之间至少隔这么久，而且同一时刻只有一只在蓄势（docs/fun-design.md 2.5）
export const RANGED_GAP=.9;
export const ATTACKS={
 walker:{name:'蹦跳追击',counter:'保持距离、用反弹与击退拉开'},
 leaper:{name:'敏捷扑击',counter:'看到金圈后侧移，开枪打断',windup:.48,strike:.54,recover:.34},
 heavy:{name:'棉甲推进',counter:'正面减伤，绕后打'},
 crawler:{name:'贴地扑抓',counter:'低头瞄准，避开短扑；命中会缠线减速',windup:.65,strike:.36,cooldown:2.6,range:1.9},
 shielded:{name:'格挡盾冲',counter:'绕后，或用探照灯炮/蓄力球破防',windup:.9,strike:.50,recover:1.35,cooldown:3.2,range:3.8},
 bomber:{name:'抛掷毛线炸弹',counter:'看到举弹后移动，避开落地延时爆圈',windup:.95,cooldown:3.6,range:7.5,radius:2.2},
 archer:{name:'拉弓射箭',counter:'瞄准线变红后换个方向走，或躲到掩体后；打中它会打断',windup:1.15,lock:.35,lead:1,cooldown:2.8,range:11},
 'boss-warden':{name:'震地与召援',counter:'退离震地圈、利用掩体，重弹打断',windup:1.3,cooldown:3.7,range:2.65,radius:3.2},
 'boss-leech':{name:'吸引扇区',counter:'侧移或找掩体，重弹/蓄力打断',windup:1.1,strike:.65,cooldown:4.2,range:6.2,cone:.86},
};
export const SPECIAL_TYPES=new Set(['crawler','shielded','bomber','archer','boss-warden','boss-leech']);
export const CHARGED_ACTIONS=new Set(['crawler-windup','shield-windup','bomber-throw','archer-aim','warden-windup','warden-call','leech-windup','leech-pull']);
const atticAttack = { ...ATTACKS['boss-warden'], cooldown: 2.4, range: 3.45, radius: 4.05, callAfter: 1 };
export const attackProfile = e => e.encounter === 'attic' ? atticAttack : ATTACKS[e.type];
export function attackCue(e){
 const a=attackProfile(e);if(!a)return null;
 const labels={'crawler-windup':'扑抓','shield-windup':'盾冲','bomber-throw':'投弹','archer-aim':'瞄准','warden-windup':'震地','warden-call':'召援','leech-windup':'吸引','leech-pull':'吸引'};
 if(!labels[e.action])return null;
 const duration=e.action==='leech-pull'?a.strike:a.windup,progress=Math.min(1,e.actionAge/duration);
 // 弓手：瞄准线先跟着你走（浅色），出手前 lock 秒定住变红——红了以后换方向就躲得开
 const locked=e.action==='archer-aim'&&e.actionAge>=a.windup-a.lock;
 return {label:locked?'要射了':labels[e.action],progress,duration,locked,radius:e.type==='bomber'?a.radius:e.action==='warden-windup'?a.radius:.55,color:e.type==='boss-leech'?0x87539f:e.type==='archer'?(locked?0xff3a30:0xe9c98a):0xbd792c,
  kind:e.type==='bomber'?'landing':['archer','crawler','shielded'].includes(e.type)?'line':e.type==='boss-leech'?'cone':'ring',ground:e.type==='crawler'||e.type==='shielded',target:{x:e.aimX??e.x,z:e.aimZ??e.z}};
}
