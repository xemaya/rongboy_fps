// 后四把武器的样子（手里的枪、飞出去的弹丸），以及所有武器共用的效果：枪口闪光、电弧、命中光圈、爆炸、扎在墙上的针。
// 只管画面，不碰规则；规则在 game.js。前三把枪的模型仍然来自 library/games/rongboy-workshop.js。
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { woolMaterial, createWoolBall } from '../../library/games/rongboy-runtime.js';
import { makeSoftWeave } from './soft-weave.js';

const hard = (color, roughness = 0.35, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
const glowing = (color, strength) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.6 });
function part(group, geometry, material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, material); m.position.set(x, y, z); group.add(m); return m;
}
const alongZ = m => { m.rotation.x = Math.PI / 2; return m; };

export function extendWeaponKit(kit, weapons) {
  const original = kit.userData.variants;
  const wood = hard(0x8d6040, .86), brass = hard(0xb29357, .48, .38);
  const cream = woolMaterial(0xf1dfb8), rust = woolMaterial(0xa35138);
  const olive = woolMaterial(0x677057), slate = woolMaterial(0x536e70);
  const dark = hard(0x312b23, .92), metal = hard(0xcfd6d8, .3, .6);
  const button = hard(0xc78659, .52);
  function soft(group, w, h, d, r, mat, x, y, z) {
    return part(group, new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z);
  }
  function tube(group, radius, depth, mat, x, y, z) {
    return alongZ(part(group, new T.CylinderGeometry(radius, radius, depth, 24), mat, x, y, z));
  }
  function ring(group, radius, thickness, mat, x, y, z) {
    return part(group, new T.TorusGeometry(radius, thickness, 9, 32), mat, x, y, z);
  }
  function grip(g) {
    soft(g, .14, .26, .16, .047, wood, 0, -.17, -.19).rotation.x = -.22;
    soft(g, .05, .09, .085, .015, brass, 0, -.135, -.065);
  }

  kit.userData.variants = weapons.map((w, index) => {
    const id = w.id;
    if (id === 'single') return original[index];
    original[index]?.removeFromParent();
    const g = new T.Group();
    if (id === 'scatter') {
      // 花园喷枪，扁喷头前并排三孔。
      soft(g,.36,.26,.52,.09,olive,0,0,.02);
      soft(g,.31,.165,.26,.066,olive,0,-.025,.35);
      soft(g,.335,.187,.044,.052,cream,0,-.025,.363);
      soft(g,.59,.245,.19,.105,rust,0,.005,.51);
      soft(g,.55,.204,.06,.09,cream,0,.005,.602);
      for (const x of [-.175,0,.175]) {
        tube(g,.069,.02,dark,x,.005,.634);
        ring(g,.071,.015,brass,x,.005,.642);
      }
      soft(g,.34,.12,.08,.04,cream,0,.102,.16);
      part(g,new T.CylinderGeometry(.067,.067,.032,8),brass,0,.177,.07);
      grip(g);
      g.userData.muzzleZ=.67;
    } else if (id === 'heavy') {
      // 皮布提梁、B 版的厚灯圈、凹入的独立出膛口。
      tube(g,.218,.55,slate,0,.015,.147);
      ring(g,.213,.022,cream,0,.015,-.106);
      tube(g,.247,.085,rust,0,.015,.425);
      ring(g,.254,.046,rust,0,.015,.517);
      ring(g,.227,.021,brass,0,.015,.549);
      tube(g,.225,.025,dark,0,.015,.493);
      const lamp = glowing(0xffbf64,1.4);
      ring(g,.173,.029,lamp,0,.015,.518);
      tube(g,.104,.096,wood,0,.015,.526);
      tube(g,.078,.015,dark,0,.015,.577);
      ring(g,.079,.015,slate,0,.015,.581);
      for (const z of [-.09,.26]) {
        soft(g,.1,.14,.072,.025,cream,0,.234,z);
        part(g,new T.SphereGeometry(.026,12,8),brass,.06,.232,z);
      }
      soft(g,.111,.082,.42,.037,wood,0,.31,.085);
      for (const z of [-.04,.02,.08,.14,.2]) ring(g,.231,.009,cream,0,.015,z).scale.y=.99;
      soft(g,.29,.091,.26,.033,cream,0,-.205,.29);
      grip(g);
      g.userData.lamp = lamp;
    } else if (id === 'stun') {
      // 四个凹入的陶瓷网发射点，枪口和飞网完全分开。
      soft(g,.32,.29,.56,.085,olive,0,0,.09);
      soft(g,.281,.24,.23,.053,olive,0,.013,.438);
      soft(g,.301,.258,.045,.057,cream,0,.013,.471);
      soft(g,.398,.327,.09,.075,cream,0,.018,.56);
      soft(g,.318,.248,.032,.047,dark,0,.018,.611);
      const contacts=glowing(0x78bcb8,.8);
      for (const x of [-.086,.086]) for (const y of [-.041,.077]) {
        tube(g,.041,.025,slate,x,y,.622);
        ring(g,.026,.010,contacts,x,y,.647);
      }
      soft(g,.37,.055,.06,.025,rust,0,.158,.216);
      grip(g);
      g.userData.contacts=contacts;
      g.userData.muzzleZ=.67;
    } else if (id === 'sewing') {
      // 订书机的翻压臂与纽扣轨，抛离时按每发节奏压一次。
      soft(g,.24,.103,.65,.038,slate,0,-.08,.058);
      soft(g,.25,.15,.18,.05,olive,0,-.01,-.22);
      soft(g,.20,.143,.08,.035,cream,0,-.059,.383);
      for (let i=0;i<7;i++) {
        const disc=part(g,new T.CylinderGeometry(.075,.075,.024,14),button,0,-.003,-.12+i*.072);
        disc.rotation.x=Math.PI/2;
      }
      const press=new T.Group();press.position.set(0,.056,-.24);g.add(press);
      soft(press,.272,.09,.57,.04,rust,0,.072,.285);
      soft(press,.23,.032,.48,.014,cream,0,.027,.251);
      for (const x of [-.133,.133]) {
        const hinge=part(g,new T.CylinderGeometry(.053,.053,.025,16),brass,x,.043,-.221);
        hinge.rotation.z=Math.PI/2;
      }
      grip(g);g.userData.press=press;g.userData.muzzleZ=.43;g.userData.muzzleY=-.025;
    } else if (id === 'needle') {
      // 毛衣针：一根长长的银针架在毛线团上，针尾一个圆头
      alongZ(part(g, new T.CylinderGeometry(0.02, 0.024, 1.0, 10), metal, 0, 0.04, 0.2));
      alongZ(part(g, new T.ConeGeometry(0.02, 0.12, 10), metal, 0, 0.04, 0.76));
      part(g, new T.SphereGeometry(0.06, 12, 10), woolMaterial(0xe7a0b6), 0, 0.04, -0.32);
      const ball = createWoolBall(); ball.scale.setScalar(0.17); ball.position.set(0, -0.08, 0.02); g.add(ball);
      ball.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setHex(0xb7a0d8); } });
      part(g, new RoundedBoxGeometry(0.12, 0.2, 0.14, 2, 0.04), wood, 0, -0.26, -0.06);
      for (const z of [-0.06, 0.3]) part(g, new T.TorusGeometry(0.035, 0.012, 6, 14), hard(0xe9c46a, 0.3), 0, 0.04, z);
    } else if (w.kind === 'grenade') {
      const bomb=bombProp(id);
      bomb.scale.setScalar(.2);bomb.position.set(0,.04,.34);g.add(bomb);
    }
    g.visible = false;
    kit.add(g);
    return g;
  });
  return kit;
}

// The same toy in flight, in the player's hand and when it opens.
function bombProp(id, deployed=false) {
  const g=new T.Group(), brass=hard(0xb7985a,.52,.37), knit=woolMaterial(0xc8a1cd);
  const oat=woolMaterial(0xf2deb3), rust=woolMaterial(0xa75639);
  if (id==='jack') {
    part(g,new RoundedBoxGeometry(1.35,1.01,1.2,3,.18),rust,0,-.14,0);
    part(g,new RoundedBoxGeometry(.22,.91,1.218,3,.054),oat,.36,-.14,0);
    const lid=part(g,new RoundedBoxGeometry(1.42,.25,1.27,3,.105),rust,0,.48,0);
    part(g,new RoundedBoxGeometry(.32,.23,.09,3,.04),brass,0,.34,.648);
    for (const x of [-.53,.53]) for (const z of [-.47,.47]) part(g,new T.SphereGeometry(.105,8,6),brass,x,-.59,z);
    if (deployed) {
      lid.rotation.x=-1.05;lid.position.set(0,.84,-.49);
      const spring=new T.Curve();
      spring.getPoint=t=>new T.Vector3(Math.cos(t*18.85)*.25,.38+t*.91,Math.sin(t*18.85)*.25);
      part(g,new T.TubeGeometry(spring,32,.065,8),oat,0,0,0);
      const head=new T.Group();head.position.set(0,1.54,0);g.add(head);
      part(head,new T.SphereGeometry(.43,16,12),oat,0,0,0);
      part(head,new T.ConeGeometry(.36,.48,16),rust,0,.47,0);
      part(head,new T.SphereGeometry(.11,12,8),oat,0,.72,0);
      for(const x of [-.39,.39]) part(head,new T.SphereGeometry(.22,12,8),knit,x,.013,0);
      for(const x of [-.147,.147]) part(head,new T.SphereGeometry(.054,10,8),brass,x,.03,.409);
      part(head,new T.SphereGeometry(.104,12,8),rust,0,-.075,.425);
      const smile=new T.CatmullRomCurve3([new T.Vector3(-.16,-.17,.365),new T.Vector3(0,-.23,.39),new T.Vector3(.16,-.17,.365)]);
      part(head,new T.TubeGeometry(smile,12,.021,5),rust,0,0,0);
    }
  } else {
    part(g,new T.CylinderGeometry(.64,.59,.24,24),knit,0,-.55,0);
    for(let i=0;i<9;i++) {
      const angle=i*Math.PI*2/9, petal=new T.Group();
      petal.rotation.y=angle;g.add(petal);
      const shell=part(petal,new T.SphereGeometry(1,15,9),brass,0,deployed?-.35:.06,deployed?.87:.49);
      shell.scale.set(.37,.59,.072);shell.rotation.x=deployed?1.08:-.48;
      for (const x of [-.15,.15]) part(petal,new T.SphereGeometry(.037,7,5),rust,x,deployed?-.14:.15,deployed?.91:.562);
    }
    part(g,new T.CylinderGeometry(.19,.17,.27,16),brass,0,.23,0);
    part(g,new T.SphereGeometry(deployed?.31:.21,14,10),knit,0,deployed?-.05:.45,0);
  }
  return g;
}

// 每把枪打出去的东西。单位大小是半径 1，画的时候按毛球半径缩放；oriented 的要顺着飞行方向摆，不打转。
export function projectileModels(weapons, ballTemplate) {
  return weapons.map(w => {
    let o;
    if (w.id === 'sewing') {   // 小纽扣
      o = new T.Group();
      const disc = part(o, new T.CylinderGeometry(1, 1, 0.45, 12), hard(w.color, 0.4)); disc.rotation.x = Math.PI / 2;
      for (const x of [-0.32, 0.32]) part(o, new T.SphereGeometry(0.16, 6, 4), hard(0x5a3a30, 0.6), x, 0, 0.24);
    } else if (w.id === 'needle') {   // 一根针拖着一截毛线
      o = new T.Group(); o.userData.oriented = true;
      alongZ(part(o, new T.CylinderGeometry(0.34, 0.4, 11, 8), hard(0xdfe6ea, 0.25, 0.7), 0, 0, -3));
      alongZ(part(o, new T.ConeGeometry(0.34, 2.4, 8), hard(0xdfe6ea, 0.25, 0.7), 0, 0, 3.7));
      part(o, new T.SphereGeometry(1.0, 8, 6), hard(0xe7a0b6, 0.8), 0, 0, -8.6);
      alongZ(part(o, new T.CylinderGeometry(0.16, 0.05, 16, 5), new T.MeshBasicMaterial({ color: 0xf2b8c8 }), 0, 0, -16.5));
    } else if (w.kind === 'grenade') {
      o = bombProp(w.id);
    } else {
      o = ballTemplate.clone(true);
      o.traverse(m => {
        if (!m.isMesh) return;
        m.material=m.material.clone();
        m.material.color.setHex(w.color);
        if (w.id==='heavy') {
          m.material.emissive.setHex(0xe99024);
          m.material.emissiveIntensity=.72;
        }
      });   // 克隆时 userData 里存不住网格，按名字找
    }
    return o;
  });
}

function sprite(draw, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

// 效果都从固定大小的池子里取，不在开枪时新建网格。颜色用高亮度值（大于 1），后期的泛光会让它们发亮。
export function createWeaponFeedback(scene, lightObject = null) {
  const light = new T.PointLight(0xffae4d, 0, 5.2, 1.7);
  light.name = 'Spotlight projectile';
  scene.add(light);
  const netTemplate=makeSoftWeave(false), floorTemplate=makeSoftWeave(true);
  const steamer=bombProp('yarn',true), popping=bombProp('jack',true);
  const active=new Map();
  const jackBursts=Array.from({length:3},()=>{
    const model=popping.clone(true);model.visible=false;scene.add(model);
    return {model,at:-Infinity};
  });
  let nextJack=0, nextMark=0;
  const damageTextures=new Map();
  const marks=Array.from({length:14},()=>{
    const icon=new T.Sprite(new T.SpriteMaterial({transparent:true,depthWrite:false,toneMapped:false}));
    icon.visible=false;scene.add(icon);return {icon,at:-Infinity,y:0};
  });

  function display(state, terrain) {
    if (!active.has(state.id)) {
      const template=terrain?floorTemplate:netTemplate, model=new T.Group(), mesh=template.clone(true);
      const materials=mesh.children.map(rope=>{
        rope.material=rope.material.clone();
        return rope.material;
      });
      lightObject?.(mesh);
      model.add(mesh);
      const pod=terrain?steamer.clone(true):null;
      if (pod) { pod.position.y=.19;model.add(pod); }
      scene.add(model);active.set(state.id,{model,mesh,pod,materials});
    }
    return active.get(state.id);
  }
  function remove(id, entry) {
    entry.model.removeFromParent();
    entry.materials.forEach(material=>material.dispose());
    active.delete(id);
  }
  function deform(mesh, fold, ripple, opacity) {
    for (const rope of mesh.children) {
      rope.morphTargetInfluences[0]=fold;
      rope.morphTargetInfluences[1]=ripple;
      rope.material.opacity=opacity;
    }
  }

  return {
    burst(event,time) {
      const pop=jackBursts[nextJack++%jackBursts.length];pop.at=time;
      pop.model.position.set(event.x,Math.max(.16,event.y),event.z);
      pop.model.visible=true;
    },
    damage(event,time) {
      if (!damageTextures.has(event.amount)) damageTextures.set(event.amount,sprite((ctx,n)=>{
        ctx.font='800 65px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.lineWidth=7;ctx.strokeStyle='#44291d';ctx.fillStyle='#ffe5ac';
        const amount='−'+event.amount;
        ctx.strokeText(amount,n/2,n*.51);ctx.fillText(amount,n/2,n*.51);
      }));
      const mark=marks[nextMark++%marks.length];mark.at=time;mark.y=(event.contactY ?? event.y)+.42;
      mark.icon.position.set(event.x,mark.y,event.z);
      mark.icon.scale.set(.52,.52,1);mark.icon.material.map=damageTextures.get(event.amount);mark.icon.material.needsUpdate=true;
      mark.icon.visible=true;
    },
    sync(state) {
      const ball=state.balls.find(ball=>ball.weapon==='heavy');
      light.intensity=ball ? 20 * Math.min(1,(ball.lifetime-ball.age)/.3) : 0;
      if (ball) light.position.set(ball.x,ball.y,ball.z);
      const present=new Set();
      for (const net of state.nets) {
        present.add(net.id);
        const {model,mesh}=display(net,false);
        model.position.set(net.x,net.y,net.z);
        model.lookAt(net.x+net.dx,net.y+net.dy,net.z+net.dz);
        const spread=Math.min(1,net.travel/3.05);
        model.rotateZ(.32*(1-spread)+.13*Math.sin(net.travel*1.65));
        model.scale.set(net.radius,net.radius*(.67+.33*spread),net.radius);
        const fade=Math.min(1,net.travel/.38,(net.until-state.time)/.16);
        deform(mesh,1-spread,.36+.29*Math.sin(net.travel*3.6),fade*.92);
      }
      for (const field of state.tangleFields) {
        present.add(field.id);
        const {model,mesh,pod}=display(field,true);
        const age=state.time-field.start;
        const spread=1-Math.pow(1-Math.min(1,age/.24),2);
        model.position.set(field.x,field.y,field.z);
        mesh.scale.setScalar(field.radius * Math.max(.08,spread));
        pod.scale.setScalar(.22+.09*spread);
        const settle=Math.max(0,1-age/.36);
        deform(mesh,settle,settle*(.59+.4*Math.sin(age*18)),.93*Math.min(1,(field.until-state.time)/.64));
      }
      for (const [id,entry] of active) if (!present.has(id)) remove(id,entry);
      for (const pop of jackBursts) {
        const t=state.time-pop.at;
        pop.model.visible=t<.68;
        if(pop.model.visible) pop.model.scale.set(.27,.27*Math.min(1,Math.max(.22,t*12)),.27);
      }
      for (const mark of marks) {
        const t=state.time-mark.at;
        mark.icon.visible=t<.56;
        if (mark.icon.visible) {
          mark.icon.position.y=mark.y+t*.54;
          mark.icon.material.opacity=Math.min(1,(.56-t)/.24);
        }
      }
    },
    clear() {
      light.intensity=0;
      for (const [id,entry] of active) remove(id,entry);
      for (const pop of jackBursts) { pop.model.visible=false;pop.at=-Infinity; }
      for (const mark of marks) { mark.icon.visible=false;mark.at=-Infinity; }
    },
  };
}

export function scopeFieldOfView(fov, magnification) {
  return T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(fov / 2)) / magnification));
}

export function createEffects(scene) {
  const flashTex = sprite((a, n) => {
    const g = a.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    a.fillStyle = g; a.fillRect(0, 0, n, n);
    a.globalCompositeOperation = 'lighter'; a.strokeStyle = 'rgba(255,255,255,0.55)'; a.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2 + 0.3; a.lineWidth = 3 + (i % 2) * 3; a.beginPath(); a.moveTo(n / 2, n / 2); a.lineTo(n / 2 + Math.cos(t) * n * 0.46, n / 2 + Math.sin(t) * n * 0.46); a.stroke(); }
  });
  const ringTex = sprite((a, n) => {
    const g = a.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.72, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    a.fillStyle = g; a.fillRect(0, 0, n, n);
  });
  const additive = { transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false };
  const sprites = Array.from({ length: 18 }, () => { const sp = new T.Sprite(new T.SpriteMaterial({ map: flashTex, ...additive })); sp.visible = false; sp.renderOrder = 5; scene.add(sp); return { sp, age: 0, life: 0, from: 0, to: 0, strength: 1 }; });
  let nextSprite = 0;
  function puff(map, pos, color, from, to, life, strength = 1) {
    const s = sprites[nextSprite++ % sprites.length];
    s.sp.material.map = map; s.sp.material.color.setHex(color).multiplyScalar(strength); s.sp.material.rotation = Math.random() * Math.PI;
    s.sp.position.set(pos.x, pos.y, pos.z); s.age = 0; s.life = life; s.from = from; s.to = to; s.sp.visible = true;
  }

  // 一盏闪一下的点光：枪口、电弧、爆炸共用（同一时刻只照最近的那一下）
  const light = new T.PointLight(0xffffff, 0, 9, 1.4); scene.add(light);
  let lightLife = 0, lightAge = 1, lightPeak = 0;
  function flash(pos, color, intensity, life) { light.position.set(pos.x, pos.y, pos.z); light.color.setHex(color); lightPeak = intensity; lightLife = life; lightAge = 0; }

  // 电弧：一串折线，每隔几十毫秒重新抖一次。画成一节节的细圆柱（实例化），外面一层淡的、里面一层亮的。
  const MAX = 220, seg = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 5, 1, true), new T.MeshBasicMaterial({ color: 0xffffff, ...additive }), MAX);
  seg.instanceMatrix.setUsage(T.DynamicDrawUsage); seg.frustumCulled = false; seg.count = 0; seg.setColorAt(0, new T.Color(1, 1, 1)); seg.renderOrder = 5; scene.add(seg);
  const bolts = [], up = new T.Vector3(0, 1, 0), a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3(), q = new T.Quaternion(), m4 = new T.Matrix4(), sc = new T.Vector3(), col = new T.Color();
  function bolt(points, { life = 0.2, width = 0.022, wobble = 0.16 } = {}) { bolts.push({ points, life, age: 0, width, wobble, shape: null, redraw: 0 }); }
  function jag(bo) {
    const out = [];
    for (let i = 0; i + 1 < bo.points.length; i++) {
      const p = bo.points[i], r = bo.points[i + 1], len = Math.hypot(r.x - p.x, r.y - p.y, r.z - p.z), n = Math.max(2, Math.min(9, Math.ceil(len / 0.4)));
      for (let k = 0; k < n; k++) {
        const t = k / n, amp = bo.wobble * Math.min(1, len * 0.6) * Math.sin(t * Math.PI);
        out.push(k === 0 ? [p.x, p.y, p.z] : [p.x + (r.x - p.x) * t + (Math.random() - 0.5) * 2 * amp, p.y + (r.y - p.y) * t + (Math.random() - 0.5) * 2 * amp, p.z + (r.z - p.z) * t + (Math.random() - 0.5) * 2 * amp]);
      }
      if (i + 2 === bo.points.length) out.push([r.x, r.y, r.z]);
    }
    return out;
  }

  // 爆炸：一层往外鼓的光球
  const shells = Array.from({ length: 3 }, () => { const me = new T.Mesh(new T.SphereGeometry(1, 20, 14), new T.MeshBasicMaterial({ color: 0xffffff, ...additive, side: T.DoubleSide })); me.visible = false; me.renderOrder = 5; scene.add(me); return { me, age: 1, life: 0, radius: 1 }; });
  let nextShell = 0;
  // 扎在墙上的针
  const needleGeo = new T.CylinderGeometry(0.014, 0.017, 0.42, 6), needleMat = hard(0xdfe6ea, 0.25, 0.7), knobGeo = new T.SphereGeometry(0.04, 8, 6), knobMat = hard(0xe7a0b6, 0.8);
  const stuck = Array.from({ length: 10 }, () => { const g = new T.Group(); const n = new T.Mesh(needleGeo, needleMat); n.rotation.x = Math.PI / 2; n.position.z = -0.17; const k = new T.Mesh(knobGeo, knobMat); k.position.z = -0.4; g.add(n, k); g.visible = false; scene.add(g); return { g, left: 0 }; });
  let nextStuck = 0;

  return {
    // 枪口闪光：一小团光加一下照明
    muzzle(pos, color, size = 0.5, intensity = 5) { puff(flashTex, pos, color, size * 0.5, size, 0.07, 2.2); flash(pos, color, intensity, 0.09); },
    // 命中光圈：从一点往外扩的一圈
    ring(pos, color, size = 0.5, life = 0.2, strength = 1.6) { puff(ringTex, pos, color, size * 0.25, size, life, strength); },
    spark(pos, color, size = 0.3) { puff(flashTex, pos, color, size * 0.4, size, 0.1, 2); },
    bolt, flash,
    zap(points) {
      bolt(points, { life: 0.22, width: 0.024, wobble: 0.2 }); bolt(points, { life: 0.14, width: 0.012, wobble: 0.34 });
      const tip = points[points.length - 1];
      flash(points[Math.min(1, points.length - 1)], 0x9fdcff, 9, 0.2);
      for (let i = 1; i < points.length; i++) { puff(flashTex, points[i], 0xbfeaff, 0.25, 0.9, 0.16, 2.4); puff(ringTex, points[i], 0x7fd0ff, 0.2, 1.1, 0.26, 1.4); }
      return tip;
    },
    // 被电住的僵尸身上乱窜的小电弧
    crackle(x, y, z, radius, height) {
      const t = Math.random() * Math.PI * 2, t2 = t + 1 + Math.random() * 2, y0 = y + height * (0.15 + Math.random() * 0.75), y1 = y + height * (0.15 + Math.random() * 0.75), r = radius * 1.12;
      bolt([{ x: x + Math.cos(t) * r, y: y0, z: z + Math.sin(t) * r }, { x: x + Math.cos(t2) * r, y: y1, z: z + Math.sin(t2) * r }], { life: 0.09, width: 0.012, wobble: 0.1 });
    },
    boom(pos, radius, color) {
      const s = shells[nextShell++ % shells.length];
      s.me.position.set(pos.x, pos.y, pos.z); s.me.material.color.setHex(color); s.age = 0; s.life = 0.32; s.radius = radius; s.me.visible = true;
      puff(flashTex, pos, 0xfff0d0, radius * 0.6, radius * 2.2, 0.22, 2.6);
      puff(ringTex, { x: pos.x, y: pos.y + 0.1, z: pos.z }, color, radius * 0.5, radius * 2.6, 0.4, 1.6);
      flash({ x: pos.x, y: pos.y + 0.5, z: pos.z }, 0xffd9b0, 16, 0.3);
    },
    stick(pos, dir, seconds = 8) {
      const s = stuck[nextStuck++ % stuck.length];
      s.g.position.set(pos.x, pos.y, pos.z); s.g.lookAt(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z); s.left = seconds; s.g.visible = true;
    },
    clear() { bolts.length = 0; seg.count = 0; for (const s of sprites) s.sp.visible = false; for (const s of shells) s.me.visible = false; for (const s of stuck) s.g.visible = false; light.intensity = 0; },
    update(dt) {
      for (const s of sprites) {
        if (!s.sp.visible) continue;
        s.age += dt; const t = s.age / s.life;
        if (t >= 1) { s.sp.visible = false; continue; }
        const size = s.from + (s.to - s.from) * (1 - (1 - t) * (1 - t)); s.sp.scale.set(size, size, 1); s.sp.material.opacity = (1 - t) * (1 - t);
      }
      lightAge += dt; light.intensity = lightAge < lightLife ? lightPeak * (1 - lightAge / lightLife) ** 2 : 0;
      for (const s of shells) {
        if (!s.me.visible) continue;
        s.age += dt; const t = s.age / s.life;
        if (t >= 1) { s.me.visible = false; continue; }
        s.me.scale.setScalar(s.radius * (0.25 + 0.75 * (1 - (1 - t) ** 3))); s.me.material.opacity = 0.85 * (1 - t) ** 2;
      }
      for (const s of stuck) if (s.g.visible) { s.left -= dt; if (s.left <= 0) s.g.visible = false; else if (s.left < 0.4) s.g.scale.setScalar(s.left / 0.4); else s.g.scale.setScalar(1); }
      let n = 0;
      for (let i = bolts.length - 1; i >= 0; i--) {
        const bo = bolts[i]; bo.age += dt; bo.redraw -= dt;
        if (bo.age >= bo.life) { bolts.splice(i, 1); continue; }
        if (!bo.shape || bo.redraw <= 0) { bo.shape = jag(bo); bo.redraw = 0.035; }
        const fade = 1 - bo.age / bo.life;
        for (let k = 0; k + 1 < bo.shape.length && n + 2 <= MAX; k++) {
          a.fromArray(bo.shape[k]); b.fromArray(bo.shape[k + 1]); d.subVectors(b, a); const len = d.length(); if (len < 1e-4) continue;
          q.setFromUnitVectors(up, d.multiplyScalar(1 / len)); a.add(b).multiplyScalar(0.5);
          for (const [w, r, g, bl] of [[bo.width * 3.2, 0.10, 0.34, 0.75], [bo.width, 1.5, 2.3, 3.0]]) {
            seg.setMatrixAt(n, m4.compose(a, q, sc.set(w * (0.5 + fade * 0.5), len, w * (0.5 + fade * 0.5)))); seg.setColorAt(n, col.setRGB(r * fade, g * fade, bl * fade)); n++;
          }
        }
      }
      seg.count = n; seg.instanceMatrix.needsUpdate = true; if (seg.instanceColor) seg.instanceColor.needsUpdate = true;
    },
  };
}
