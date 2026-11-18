import * as T from 'three';
import {createCineRenderer,LOOKS,cloneLook} from '../../cine-engine/engine/index.js';
import {loadFigurines} from '../../library/games/rongboy-runtime.js';
import {ZOMBIE_ROSTER} from '../../library/games/rongboy-roster.js';
import {ATTACKS} from '../../scenes/rongboy-mission/attacks.js';
import {poseRosterFigurine} from '../../library/games/rongboy-roster-pose.js';
import zombies from '../../assets/rongboy/zombies-v7/zombie-roster.glb';
const specialists = new URLSearchParams(location.search).get('study') === 'specialists';
const options = new URLSearchParams(location.search);
const finalStudy = options.get('study') === 'final';
const pair = finalStudy && options.get('pair') === '1';
const study = finalStudy || specialists;
const studyIds = finalStudy ? (pair?['boss-warden','boss-leech']:['archer','boss-warden','boss-leech']) : ['crawler','shielded','bomber'];
const roster = study ? ZOMBIE_ROSTER.filter(spec => studyIds.includes(spec.id)) : ZOMBIE_ROSTER;
if(pair) document.body.classList.add('boss-pair');
const groupTitle = pair ? '守墓巨像 · 噬连兽' : finalStudy ? '弓手 · 守墓巨像 · 噬连兽' : specialists ? '爬行者 · 持盾者 · 炸弹客' : '跳跳家族 7 类 · 独立 Boss 2 类';
const $=id=>document.getElementById(id),errors=[],actors=new Map(),plates=new Map(),labels=new Map();let ready=false,selected=null,view='front',detail=false,moving=false,time=0,last=performance.now(),frame=0;
const fail=e=>{errors.push(String(e?.stack||e));$('error').textContent=errors.at(-1);};addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));
const look=cloneLook(LOOKS.clearNoon);Object.assign(look.sun,{azimuth:225,elevation:55,intensity:3,color:[1,.95,.85]});look.env.intensity=1.2;Object.assign(look.sky,{zenith:[.55,.53,.48],mid:[.65,.61,.54],horizon:[.75,.70,.60],horizonAway:[.69,.66,.58],cloudCover:.7});Object.assign(look.air,{sigma:.0001,mist:0,sunScale:0,aoRadius:.14,aoIntensity:1});Object.assign(look.grade,{minExposure:1,maxExposure:1,exposure:1,key:.18,bloom:0,flare:0,streak:0,dirt:0,ca:0,grain:.002,vignette:.06,saturation:1.03,contrast:.05});
const cine=createCineRenderer({canvas:$('view'),look,quality:'medium',fov:17,near:.04,far:150,maxPixelRatio:1.35,dynamicResolution:false,shadow:{mode:'box',min:[-7,-.2,-6],max:[7,4.0,6],softness:.6},onError:fail});
const paper=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xdfd3bb,roughness:1}));paper.rotation.x=-Math.PI/2;paper.position.y=-.081;paper.receiveShadow=true;cine.scene.add(paper);const fill=new T.DirectionalLight(0xf3ead8,1.4);fill.position.set(-2,5,8);cine.scene.add(fill);
const plateGeo=new T.CylinderGeometry(.64,.67,.08,48),plateMat=new T.MeshStandardMaterial({color:0x9aa38c,roughness:.98});
function select(id){selected=id;view='front';update();if(id)document.querySelector(`[data-kind="${id}"]`)?.scrollIntoView({block:'nearest'});}
for(const [i,spec]of roster.entries()){const button=document.createElement('button');button.className='entry';button.dataset.kind=spec.id;button.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><b>${spec.name}</b><small>${spec.role}</small>`;button.onclick=()=>select(spec.id);$('roster').append(button);const label=document.createElement('div');label.className='tag';label.innerHTML=spec.name+`<small>${String(i+1).padStart(2,'0')}</small>`;$('labels').append(label);labels.set(spec.id,label);}
function inspectionDistance(spec, angle) {
 const base=Math.max(3,spec.height*2.35);
 if(detail)return base*.56;
 const bounds=actors.get(spec.id).inspectionSize;
 const width=bounds.x*Math.abs(Math.cos(angle))+bounds.z*Math.abs(Math.sin(angle));
 const aspect=$('stage').clientWidth/Math.max(1,$('stage').clientHeight);
 return Math.max(base,width*.61/(Math.tan(17*Math.PI/180)*Math.max(.1,aspect))+bounds.x*.5);
}
function update(){if(!ready)return;$('all').classList.toggle('active',!selected);for(const button of document.querySelectorAll('.entry'))button.classList.toggle('active',button.dataset.kind===selected);for(const id of ['front','side','back'])$(id).classList.toggle('active',!!selected&&view===id);
 for(const [i,spec]of roster.entries()){const a=actors.get(spec.id),visible=!selected||selected===spec.id;a.world.visible=visible;plates.get(spec.id).visible=visible;const x=selected?0:pair?(i-.5)*2.55:(i%3-1)*(study?2.5:3.7),z=selected||study?0:(Math.floor(i/3)-1)*3.7;a.world.position.set(x,0,z);plates.get(spec.id).position.set(x,-.038,z);labels.get(spec.id).hidden=!!selected;}
 if(selected){const spec=roster.find(s=>s.id===selected),a=view==='back'?Math.PI+.18:view==='side'?Math.PI/2:.22,d=inspectionDistance(spec,a);cine.camera.fov=34;cine.camera.position.set(Math.sin(a)*d,spec.height*(detail?.78:.55)+.42,Math.cos(a)*d);cine.camera.lookAt(0,spec.height*(detail?.72:.50),0);$('caption').textContent=spec.name;$('role').textContent=ATTACKS[spec.id].name+' · '+ATTACKS[spec.id].counter;}
 else{cine.camera.fov=17;const aspect=$('stage').clientWidth/$('stage').clientHeight,distance=Math.max(25,9.8/(2*Math.tan(17*Math.PI/360)*aspect))*1.12;cine.camera.position.copy(new T.Vector3(0,14,20).normalize().multiplyScalar(distance)).add(new T.Vector3(0,.55,0));cine.camera.lookAt(0,.55,0);if(finalStudy){cine.camera.fov=32;const span=pair?4.7:7.2;cine.camera.position.set(0,1.38,Math.max(5.8,span/(2*Math.tan(16*Math.PI/180)*aspect)));cine.camera.lookAt(0,1.15,0);}$('caption').textContent=groupTitle;$('role').textContent='同一家族，各有脾气。';}const trial=document.querySelector('footer a');trial.href='rongboy-mission.html?level=training'+(selected?'&type='+selected:'');trial.textContent=selected?'试战 · '+roster.find(s=>s.id===selected).name+' ↗':'九类试战场 ↗';if(finalStudy){
   const kind=selected||'boss-warden';
   trial.href='rongboy-play.html?level=training&study=final&type='+kind;trial.textContent='试战 · '+roster.find(r=>r.id===kind).name+' ↗';
   const review=document.querySelector('footer a:last-of-type');review.href='rongboy-final-review.html#'+kind;review.textContent='定妆与实模 ↗';
 }else if(specialists){
   trial.href='rongboy-play.html?level=school&study=specialists';
   trial.textContent='走廊试战 ↗';
   const review=document.querySelector('footer a:last-of-type');
   review.href='rongboy-specialist-review.html#'+(selected||'crawler');
   review.textContent='定妆图与模型 ↗';
 }cine.camera.updateProjectionMatrix();}
$('detail').onclick=()=>{detail=!detail;$('detail').classList.toggle('active',detail);$('detail').setAttribute('aria-pressed',detail);if(!selected)selected=roster[0].id;update();};
$('all').onclick=()=>{select(null);$('roster').scrollTop=0;};for(const id of ['front','side','back'])$(id).onclick=()=>{if(!selected)selected=roster[0].id;view=id;update();};$('animate').onclick=()=>{moving=!moving;$('animate').classList.toggle('active',moving);$('animate').setAttribute('aria-pressed',moving);};
addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;if(['ArrowLeft','ArrowRight','Escape',' '].includes(e.key))e.preventDefault();if(e.repeat)return;if(e.key===' '){$('animate').click();return;}if(e.key==='Escape'){select(null);return;}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const i=roster.findIndex(s=>s.id===selected),step=e.key==='ArrowRight'?1:-1;select(roster[i<0?(step>0?0:roster.length-1):(i+step+roster.length)%roster.length].id);}});
function positionLabels(){if(selected)return;const box=$('stage').getBoundingClientRect();for(const spec of roster){const a=actors.get(spec.id),p=new T.Vector3(a.world.position.x,-.13,a.world.position.z).project(cine.camera),label=labels.get(spec.id);label.style.left=(p.x*.5+.5)*box.width+'px';label.style.top=(-p.y*.5+.5)*box.height+'px';}}
function diagnostics(){$('diagnostics').dataset.state=JSON.stringify({ready,count:actors.size,selected,view,moving,kinds:[...actors.keys()],poses:[...actors].map(([id,a])=>({id,native:a.nativeVariant,parts:a.parts.size,y:a.world.position.y,arm:a.parts.get('ArmL')?.rotation.x})),errors});$('diagnostics').dataset.stats=JSON.stringify(cine.stats());}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;if(ready){if(moving)time+=dt;for(const a of actors.values())if(a.world.visible)poseRosterFigurine(a,time,moving);positionLabels();}cine.frame(dt);if(++frame%10===0)diagnostics();}requestAnimationFrame(animate);
addEventListener('resize',()=>{cine.resize();update();});
async function boot(){
 let bank=zombies;
 if(study) {
   const response=await fetch(finalStudy?'final-trio.glb':'second-trio.glb');
   if(!response.ok) throw new Error('模型加载失败');
   bank=new Uint8Array(await response.arrayBuffer());
 }
 const factory=await loadFigurines({zombies:bank});for(const spec of roster){const a=factory.create(spec.id);a.inspectionSize=new T.Box3().setFromObject(a.world,true).getSize(new T.Vector3());a.model.traverse(o=>{if(o.isMesh)o.frustumCulled=true;});actors.set(spec.id,a);cine.scene.add(a.world);const disk=new T.Mesh(plateGeo,plateMat);disk.castShadow=disk.receiveShadow=true;if(spec.id.startsWith('boss-'))disk.scale.set(1.25,1,1.25);plates.set(spec.id,disk);cine.scene.add(disk);}ready=true;cine.resize();const initial=location.hash.slice(1);if(actors.has(initial)) {
  select(initial);
  const options=new URLSearchParams(location.search);
  if(options.get('view')==='side') $('side').click();

 }else update();
 if(options.get('motion')==='1') $('animate').click();await cine.warmup();$('status').textContent=groupTitle;diagnostics();}
boot().catch(fail);
