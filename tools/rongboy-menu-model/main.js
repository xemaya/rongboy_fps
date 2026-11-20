import * as T from 'three';
import { loadFigurines } from '../../library/games/rongboy-runtime.js';
import { poseRosterFigurine } from '../../library/games/rongboy-roster-pose.js';
import { ZOMBIE_ROSTER } from '../../library/games/rongboy-roster.js';
import { initializeLanguage, t } from '../../scenes/rongboy-mission/language.js';
import { modelPack } from '../../scenes/rongboy-mission/menu-flow.js';
import { ATTACKS } from '../../scenes/rongboy-mission/attacks.js';
import { applyAttackPose } from '../../scenes/rongboy-mission/attack-pose.js';
import { actionPose } from '../../scenes/rongboy-shooter-fps/enemy-actions.js';

initializeLanguage({platformLocale:false});
const status = document.getElementById('status'), canvas = document.getElementById('view');
const scene = new T.Scene(), camera = new T.PerspectiveCamera(33,1,.04,30);
let renderer;
try {
  renderer = new T.WebGLRenderer({canvas,alpha:true,antialias:true});
} catch {
  status.textContent = t('当前设备无法显示 3D 模型');
}
if (renderer) presentModels();

function rehearsal(actor,time,moving) {
  poseRosterFigurine(actor,time,moving);
  if (!moving) return;
  const type=actor.kind, step=time%3.2-.7;
  if (step<0) return;
  if (type==='crawler' || type==='shielded') {
    const windup=ATTACKS[type].windup, strike=type==='crawler'?.36:.5;
    if (step>=windup+strike) return;
    const attack=step>=windup, actionAge=attack?step-windup:step;
    const action=type==='crawler' ? (attack?'crawler-strike':'crawler-windup') : (attack?'shield-charge':'shield-windup');
    actor.reset();actor.world.position.y=0;
    applyAttackPose({type,action,actionAge},actor);
    if (action==='shield-charge') actor.parts.get('Body').rotation.x+=Math.sin(Math.PI*actionAge/strike)*.32;
  }
  if (type==='leaper' && step<1.36) {
    const action=step<.48?'windup':step<1.02?'pounce':'recover';
    const actionAge=step-(action==='windup'?0:action==='pounce'?.48:1.02);
    const pose=actionPose({action,actionAge});
    actor.reset();
    actor.world.position.y=action==='pounce'?Math.sin(Math.PI*actionAge/.54)*.36:0;
    actor.tilt.scale.set(1,1-pose.crouch,1);
    actor.parts.get('Body').rotation.x+=pose.lean;
    for (const side of ['L','R']) {
      actor.parts.get('Arm'+side).rotation.x-=1.2+pose.reach;
      actor.parts.get('Leg'+side).rotation.x+=pose.legTuck;
    }
  }
}

function presentModels() {
  renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));
  renderer.setClearColor(0,0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  scene.add(new T.HemisphereLight(0xf8ecd1,0x63533b,2.05));
  const sun = new T.DirectionalLight(0xffe0ad,2.65);
  sun.position.set(-3.5,5,3); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024); sun.shadow.normalBias=.025;
  Object.assign(sun.shadow.camera,{left:-2.4,right:2.4,top:3,bottom:-2,far:12});
  scene.add(sun);
  const rim=new T.DirectionalLight(0xffc183,1.65);
  rim.position.set(2,2,-2.1);scene.add(rim);
  const base=new T.Mesh(new T.CylinderGeometry(1,1.04,.115,64),new T.MeshStandardMaterial({color:0x65704c,roughness:1}));
  base.position.y=-.06;base.receiveShadow=true;scene.add(base);
  const edge=new T.Mesh(new T.TorusGeometry(1.015,.012,6,72),new T.MeshStandardMaterial({color:0xc6a470,roughness:1}));
  edge.rotation.x=Math.PI/2;edge.position.y=-.023;scene.add(edge);

  const factories=new Map(), actors=new Map();
  let active=null, generation=0, angle=.20, time=0, last=0, moving=false, frames=0;
  function factory(bank) {
    if (!factories.has(bank)) factories.set(bank,fetch(bank).then(async response => {
      if (!response.ok) throw Error(t('模型文件未找到'));
      return loadFigurines({zombies:new Uint8Array(await response.arrayBuffer())});
    }).catch(error=>{factories.delete(bank);throw error;}));
    return factories.get(bank);
  }
  async function select(id) {
    const spec=ZOMBIE_ROSTER.find(enemy=>enemy.id===id);
    if (!spec) return;
    const request=++generation;
    if (active?.kind===id) { status.textContent=''; return; }
    status.textContent='正在摆好手办…';
    try {
      if (!actors.has(id)) {
        const bank=await factory(modelPack(id));
        if (request!==generation) return;
        const actor=bank.create(id);
        actor.world.visible=false;
        actor.world.updateMatrixWorld(true);
        actor.size=new T.Box3().setFromObject(actor.world,true).getSize(new T.Vector3());
        actor.world.traverse(o=>{
          if(o.isMesh && o.material?.map && o.material.map.anisotropy<4) o.material.map.anisotropy=4;
        });
        actors.set(id,actor);scene.add(actor.world);
      }
      if (request!==generation) return;
      if (active) active.world.visible=false;
      active=actors.get(id);active.world.visible=true;
      status.textContent='';status.dataset.ready=id;
      time=0;frames=2;
    } catch {
      if(request===generation) status.textContent='模型暂时无法载入';
    }
  }

  function applyView(view,animate) {
    const nextAngle=view==='side'?Math.PI*.5:view==='back'?Math.PI+.16:.20;
    if (angle===nextAngle && moving===!!animate) return;
    angle=nextAngle;moving=!!animate;frames=2;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if (!active || (!moving && frames<=0)) return;
    frames--;
    if (moving) time+=dt;
    const {x,y,z}=active.size, span=Math.abs(x*Math.cos(angle))+Math.abs(z*Math.sin(angle));
    const radius=Math.max(.64,Math.hypot(x,z)*.57);
    base.scale.set(radius,1,radius);edge.scale.set(radius,radius,1);
    const h=Math.max(1,y);
    const d=Math.max((h+.22)/.55,Math.max(span,2*radius)/(.53*camera.aspect));
    camera.position.set(Math.sin(angle)*d,h*.5+d*.105,Math.cos(angle)*d);
    camera.lookAt(0,h*.47,0);
    rehearsal(active,time,moving);
    renderer.render(scene,camera);
  }
  function resize(){
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    frames=2;
  }
  new ResizeObserver(resize).observe(canvas);resize();
  const q=new URLSearchParams(location.search);
  applyView(q.get('view'),false);select(q.get('type')||'walker');
  addEventListener('message',event=>{
    if(event.origin!==location.origin || event.source!==parent || event.data?.kind!=='rongboy-model')return;
    applyView(event.data.view,event.data.motion);
    select(event.data.type);
  });
  requestAnimationFrame(frame);
}
