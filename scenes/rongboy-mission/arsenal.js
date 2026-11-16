// 后四把武器的样子（手里的枪、飞出去的弹丸），以及所有武器共用的效果：枪口闪光、电弧、命中光圈、爆炸、扎在墙上的针。
// 只管画面，不碰规则；规则在 game.js。前三把枪的模型仍然来自 library/games/rongboy-workshop.js。
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { woolMaterial, createWoolBall } from '../../library/games/rongboy-runtime.js';

const hard = (color, roughness = 0.35, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
const glowing = (color, strength) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.6 });
function part(group, geometry, material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, material); m.position.set(x, y, z); group.add(m); return m;
}
const alongZ = m => { m.rotation.x = Math.PI / 2; return m; };

// 给武器套件补上第 4 把起的枪。枪口朝 +z，尺寸和前三把的发射筒相当（长约 0.6，枪口在 z = 0.63）。
export function extendWeaponKit(kit, weapons) {
  const wood = hard(0x906641, 0.8), metal = hard(0xcfd6d8, 0.3, 0.6);
  for (let i = kit.userData.variants.length; i < weapons.length; i++) {
    const id = weapons[i].id, g = new T.Group();
    if (id === 'stun') {
      // 静电枪：蓝绿色的枪身，一圈圈铜线，前头两根电极，中间一颗会跳的电火花
      part(g, new RoundedBoxGeometry(0.34, 0.27, 0.46, 3, 0.09), woolMaterial(0x6fb6c4), 0, 0, 0.02);
      alongZ(part(g, new T.CylinderGeometry(0.1, 0.1, 0.3, 16), woolMaterial(0xf1e6c8), 0, 0.01, 0.36));
      for (let k = 0; k < 4; k++) part(g, new T.TorusGeometry(0.115, 0.022, 8, 20), hard(0xe0a04a, 0.3, 0.7), 0, 0.01, 0.25 + k * 0.07);
      for (const x of [-0.075, 0.075]) { alongZ(part(g, new T.CylinderGeometry(0.018, 0.018, 0.2, 8), metal, x, 0.01, 0.56)); part(g, new T.SphereGeometry(0.03, 10, 8), metal, x, 0.01, 0.66); }
      g.userData.spark = part(g, new T.SphereGeometry(0.04, 10, 8), glowing(0x9fe8ff, 6), 0, 0.01, 0.64);
      part(g, new RoundedBoxGeometry(0.14, 0.2, 0.16, 2, 0.04), wood, 0, -0.2, -0.08);
      for (const x of [-0.175, 0.175]) part(g, new T.SphereGeometry(0.045, 10, 8), glowing(0xf2d27a, 1.2), x, 0.06, 0.02);
    } else if (id === 'sewing') {
      // 缝纫机枪：一台小缝纫机，顶上插着线轴，尾巴上一个手轮
      part(g, new RoundedBoxGeometry(0.22, 0.2, 0.62, 3, 0.07), woolMaterial(0xf1e6c8), 0, 0.06, 0.05);
      part(g, new RoundedBoxGeometry(0.22, 0.34, 0.18, 3, 0.07), woolMaterial(0xf1e6c8), 0, -0.02, 0.3);
      part(g, new RoundedBoxGeometry(0.3, 0.08, 0.5, 2, 0.03), wood, 0, -0.22, 0.02);
      alongZ(part(g, new T.CylinderGeometry(0.04, 0.05, 0.2, 12), metal, 0, -0.08, 0.5));
      alongZ(part(g, new T.CylinderGeometry(0.012, 0.004, 0.14, 6), metal, 0, -0.08, 0.66));
      part(g, new T.CylinderGeometry(0.085, 0.085, 0.15, 16), woolMaterial(0xe7836f), 0, 0.25, 0.0);
      for (const y of [0.165, 0.335]) part(g, new T.CylinderGeometry(0.105, 0.105, 0.02, 16), wood, 0, y, 0.0);
      const wheel = part(g, new T.TorusGeometry(0.11, 0.03, 8, 20), hard(0x5a4a3c, 0.5), 0.14, 0.06, -0.18); wheel.rotation.y = Math.PI / 2;
      g.userData.wheel = wheel;
      part(g, new T.SphereGeometry(0.035, 8, 6), hard(0xe9c46a, 0.3), 0.115, 0.14, 0.2);
    } else if (id === 'needle') {
      // 毛衣针：一根长长的银针架在毛线团上，针尾一个圆头
      alongZ(part(g, new T.CylinderGeometry(0.02, 0.024, 1.0, 10), metal, 0, 0.04, 0.2));
      alongZ(part(g, new T.ConeGeometry(0.02, 0.12, 10), metal, 0, 0.04, 0.76));
      part(g, new T.SphereGeometry(0.06, 12, 10), woolMaterial(0xe7a0b6), 0, 0.04, -0.32);
      const ball = createWoolBall(); ball.scale.setScalar(0.17); ball.position.set(0, -0.08, 0.02); g.add(ball);
      ball.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setHex(0xb7a0d8); } });
      part(g, new RoundedBoxGeometry(0.12, 0.2, 0.14, 2, 0.04), wood, 0, -0.26, -0.06);
      for (const z of [-0.06, 0.3]) part(g, new T.TorusGeometry(0.035, 0.012, 6, 14), hard(0xe9c46a, 0.3), 0, 0.04, z);
    } else if (id === 'yarn') {
      // 毛线团手雷：木碗里托着一团毛线，线头翘着（打空时线团不见，换好弹再出现）
      alongZ(part(g, new T.CylinderGeometry(0.2, 0.13, 0.2, 18), wood, 0, -0.03, 0.2));
      alongZ(part(g, new T.CylinderGeometry(0.1, 0.1, 0.3, 12), woolMaterial(0xd9c88f), 0, -0.03, -0.05));
      const ball = createWoolBall(); ball.scale.setScalar(0.18); ball.position.set(0, 0.0, 0.36); g.add(ball);
      ball.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setHex(weapons[i].color); } });
      const fuse = part(ball, new T.SphereGeometry(0.16, 8, 6), glowing(0xffd27a, 4), 0.2, 0.95, 0.1);
      g.userData.round = ball; g.userData.fuse = fuse;
    }
    g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = false; });
    g.visible = false; kit.add(g); kit.userData.variants.push(g);
  }
  return kit;
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
    } else {
      o = ballTemplate.clone(true);
      o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setHex(w.color); } });
      if (w.kind === 'grenade') part(o, new T.SphereGeometry(0.22, 8, 6), glowing(0xffd27a, 5), 0.25, 1.0, 0.1).name = 'fuse';   // 克隆时 userData 里存不住网格，按名字找
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
