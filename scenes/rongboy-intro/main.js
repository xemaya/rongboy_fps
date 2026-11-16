import * as T from 'three';
import {createCineRenderer,LOOKS,QUALITY,cloneLook} from '../../cine-engine/engine/index.js';
import {filmCamera} from '../../cine-engine/engine/shots.js';
import {createIntroStage} from './stage.js';
import {createIntroCast} from './cast.js';
import {DURATION,SHOTS,shotAt,sampleIntro} from './timeline.js';
import cues from './cue-map.json';
import score from './score.mp3';
const $=id=>document.getElementById(id),capture=new URLSearchParams(location.search).has('render'),errors=[];if(capture)document.body.classList.add('capture');
const look=cloneLook(LOOKS.clearNoon);Object.assign(look.sun,{azimuth:225,elevation:42,intensity:3.4,color:[1,.91,.78]});look.env.intensity=1.1;Object.assign(look.sky,{zenith:[.48,.59,.61],mid:[.72,.72,.64],horizon:[.87,.81,.69],horizonAway:[.75,.78,.71],cloudCover:.4});Object.assign(look.air,{sigma:.0001,mist:0,sunScale:0,aoRadius:.18,aoIntensity:.9});Object.assign(look.grade,{minExposure:1.03,maxExposure:1.03,exposure:1.03,key:.18,bloom:.035,flare:0,streak:0,dirt:0,ca:0,grain:.001,vignette:.11,saturation:1.04,contrast:.10,sharpen:.28});
const fail=e=>{const message=String(e?.stack||e);errors.push(message);$('error').textContent=message;console.error(message);};addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));
const cine=createCineRenderer({canvas:$('view'),look,quality:{...QUALITY.high,shadow:2048,pixels:3e6,scale:1},fov:42,near:.025,far:80,maxPixelRatio:1,dynamicResolution:false,shadow:{mode:'box',min:[-4,-.3,-4],max:[4,3.6,5],softness:.8},onError:fail});cine.still=true;if(cine.postChain){cine.postChain.enable.volumetrics=false;cine.postChain.enable.motionBlur=false;}
const stage=createIntroStage(cine),camera=cine.camera,audio=$('score');audio.src=score;let cast,rig,ready=false,playing=false,time=0,start=0;
window.DUR=DURATION;window.EV=cues.cues;window.READY=false;
function render(t){if(!ready)return;time=Math.max(0,Math.min(DURATION,t));const state=sampleIntro(time);cast.update(state);stage.update(state);stage.door.rotation.y=state.door*1.3;rig.place(shotAt(time),time,camera);cast.firstPerson(camera,state);cine.sun.shadow.needsUpdate=true;cine.frame(1/24,time);
 $('title').style.opacity=state.title;$('title').style.transform=`translateX(-50%) translateY(${(1-state.title)*8}px)`;$('seek').value=time;$('clock').textContent=time.toFixed(1).padStart(4,'0')+' / 30';
 $('diagnostics').dataset.state=JSON.stringify({ready,time,shot:state.shot,pov:state.pov,ball:state.ball,walker:state.walker,errors});$('diagnostics').dataset.stats=JSON.stringify(cine.stats());window.FILMSTATE={time,shot:state.shot,errors};return state;
}
window.render=render;
window.TEXTS=t=>t>=26?[{id:'brand',text:'RONGBOY',x0:.2,y0:.055,x1:.8,y1:.15},{id:'subtitle',text:'一颗毛球惹的祸',x0:.30,y0:.15,x1:.70,y1:.20}]:[];
function pause(){playing=false;audio.pause();$('play').textContent=time>=DURATION?'重播':'播放';$('play').setAttribute('aria-label','播放片头');}
async function play(restart=false){if(!ready)return;if(restart||time>=DURATION)time=0;audio.currentTime=time;try{await audio.play();}catch(e){fail(e);return;}start=performance.now()-time*1000;playing=true;$('play').textContent='暂停';$('play').setAttribute('aria-label','暂停片头');}
$('play').onclick=()=>playing?pause():play();$('replay').onclick=()=>play(true);$('enter').onclick=()=>location.href='rongboy-mission.html?level=house';$('seek').oninput=()=>{pause();render(Number($('seek').value));};
addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||e.repeat)return;if(e.code==='Space'){e.preventDefault();playing?pause():play();}if(e.key.toLowerCase()==='r')play(true);if(e.key==='Escape')pause();if(e.key==='Enter')$('enter').click();});
function frame(now){requestAnimationFrame(frame);if(playing){const t=audio.currentTime||((now-start)/1000);render(t);if(t>=DURATION-.015||audio.ended){render(DURATION);pause();}}}if(!capture)requestAnimationFrame(frame);
addEventListener('resize',()=>{cine.resize();render(time);});
async function boot(){cast=await createIntroCast(cine.scene);rig=filmCamera({probe:cast.probe});cine.camera.add(cast.hands.world);cine.resize();ready=true;render(0);for(const a of [cast.hero,cast.walker,cast.bomber,cast.archer,cast.hands])a.world.visible=true;await cine.warmup();render(0);await document.fonts.ready;window.READY=true;$('play').disabled=false;$('play').textContent='播放';$('play').setAttribute('aria-label','播放片头');$('status').textContent='30 秒 · 原生针毡片头';}
boot().catch(fail);
