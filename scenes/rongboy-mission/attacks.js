// Authoritative attack timings and readable counterplay, shared by game and model gallery.
export const ATTACKS={
 walker:{name:'蹦跳追击',counter:'保持距离、用反弹与击退拉开'},
 leaper:{name:'敏捷扑击',counter:'看到金圈后侧移，开枪打断'},
 heavy:{name:'棉甲推进',counter:'正面减伤，绕后打'},
 crawler:{name:'贴地扑抓',counter:'低头瞄准，避开短扑；命中会缠线减速',windup:.65,cooldown:2.6,range:1.9},
 shielded:{name:'格挡盾冲',counter:'绕后，或用棉被炮/蓄力球破防',windup:.85,cooldown:3.2,range:3.8},
 bomber:{name:'抛掷毛线炸弹',counter:'看到举弹后移动，避开落地延时爆圈',windup:.95,cooldown:3.6,range:7.5,radius:2.2},
 archer:{name:'拉弓射箭',counter:'瞄准线锁定后侧移，或用掩体/命中打断',windup:.95,cooldown:2.5,range:11},
 'boss-warden':{name:'震地与召援',counter:'退离震地圈、利用掩体，重弹打断',windup:1.3,cooldown:3.7,range:2.65,radius:3.2},
 'boss-leech':{name:'吸引扇区',counter:'侧移或找掩体，重弹/蓄力打断',windup:1.1,cooldown:4.2,range:6.2,cone:.86},
};
export const SPECIAL_TYPES=new Set(['crawler','shielded','bomber','archer','boss-warden','boss-leech']);
export const CHARGED_ACTIONS=new Set(['crawler-windup','shield-windup','bomber-throw','archer-aim','warden-windup','warden-call','leech-windup','leech-pull']);
export function attackCue(e){
 const a=ATTACKS[e.type];if(!a)return null;
 const labels={'crawler-windup':'扑抓','shield-windup':'盾冲','bomber-throw':'投弹','archer-aim':'瞄准','warden-windup':'震地','warden-call':'召援','leech-windup':'吸引','leech-pull':'吸引'};
 if(!labels[e.action])return null;
 const duration=e.action==='leech-pull'?.65:a.windup,progress=Math.min(1,e.actionAge/duration);
 return {label:labels[e.action],progress,duration,radius:e.type==='bomber'?a.radius:e.action==='warden-windup'?a.radius:.55,color:e.type==='boss-leech'?0x87539f:e.type==='archer'?0xb25e3e:0xbd792c,
  kind:e.type==='bomber'?'landing':['archer','crawler','shielded'].includes(e.type)?'line':e.type==='boss-leech'?'cone':'ring',ground:e.type==='crawler'||e.type==='shielded',target:{x:e.aimX??e.x,z:e.aimZ??e.z}};
}
