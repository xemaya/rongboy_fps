import { uiCanvasFont } from './interface-font.js';
import { t } from './language.js';
// 把编译好的关卡搭成毛绒的家：墙、地面、屋顶、窗、灯和家具都用 library 里的毛绒零件拼。
// 楼有几层就搭几层：每层在自己的坐标里从 y = 0 建起，整组抬到那一层的高度；楼梯间是通高的一个竖井。
// 碰撞仍然只认 level.js 的盒子；这里画出来的东西都落在那些盒子里，盒子外只有贴地、贴墙或高过头顶的装饰。
import * as T from 'three';
import { createMaterialLibrary, createLightVolume, lightFromLook } from '../../cine-engine/engine/index.js';
import { mulberry32 } from '../../cine-engine/engine/noise.js';
import { plushMaterials } from '../../cine-engine/library/surfaces/plush.js';
import { PlushKit, tone, cabinet, bookshelf, fridge, table, crate, sofa, bed, hedge, tree, planter, windowUnit, pendantLamp, rug, picture, flower, PETALS } from '../../cine-engine/library/structures/plush.js';
import { plinth, displayCase, sarcophagus, dinosaur, whale, banner, reception, ottoman, spotLamp } from '../../cine-engine/library/structures/museum.js';
import { kidDesk, podium, lockers, easel, paletteTable, labBench, skeletonModel, slide, swings, playhouse, seesaw, blockStack, playground, rainbow } from '../../cine-engine/library/structures/school.js';
import { woolMaterial } from '../../library/games/rongboy-runtime.js';
import { createToys } from './toys.js';
import { createEasterEggProps } from './easter-egg-props.js';
import { ammoPouch, cottonHeart, displayedWeapon, pickupFabric, yarnBasket } from './pickup-props.js';
import { bombProp } from './arsenal.js';
import { createVapor } from './vapor.js';
import { createOcclusion } from './occlusion.js';

const WALL = 0xf0e4c8, CEILING = 0xf6eedb, ROOF = 0xd98468, HEDGE = 0x7caa66, LAWN = 0xa5c57c;

function distantScenery(bounds, x, z, angle, distance, clearance) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  const awayX = (dx < 0 ? x - bounds.minX : bounds.maxX - x) + clearance;
  const awayZ = (dz < 0 ? z - bounds.minZ : bounds.maxZ - z) + clearance;
  const safe = Math.max(distance, Math.min(awayX / Math.abs(dx), awayZ / Math.abs(dz)));
  return [x + dx * safe, z + dz * safe];
}

function label(text, { width = 512, height = 128, size = 64, ink = '#4d5c47', paper = '#efe3c4' } = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const a = c.getContext('2d');
  a.fillStyle = paper; a.beginPath(); a.roundRect(4, 4, width - 8, height - 8, 22); a.fill();
  a.strokeStyle = '#8b7655'; a.lineWidth = 3; a.setLineDash([10, 8]); a.beginPath(); a.roundRect(12, 12, width - 24, height - 24, 16); a.stroke();
  a.fillStyle = ink; a.textAlign = 'center'; a.textBaseline = 'middle'; a.font = uiCanvasFont(size);
  const widthLimit = width - 36;
  const measured = a.measureText(text).width;
  if (measured > widthLimit) a.font = uiCanvasFont(size * widthLimit / measured);
  a.fillText(text, width / 2, height / 2 + 2);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}

function pickupModel(k, weapons, variants, fabric) {
  const g = new T.Group(), heart = k.kind === 'heart', objective = k.kind === 'objective', gun = k.kind === 'weapon';
  const index = weapons.findIndex(w => w.id === k.weapon), weapon = weapons[index];
  const body = new T.Group(); g.add(body);
  let labelHeight = .42;
  const add = (geometry, material, x, y, z) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); body.add(m); return m; };
  if (heart) {
    cottonHeart(body, fabric);
  } else if (objective) {
    const shiny = (c, e = 0) => new T.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: e });
    if (k.item === 'mask') {          // 黄金面具
      add(new T.SphereGeometry(0.2, 16, 12), shiny(0xe2b33c, 0.25), 0, 0.02, 0).scale.set(0.85, 1.15, 0.45);
      for (const x of [-0.07, 0.07]) add(new T.SphereGeometry(0.035, 8, 6), woolMaterial(0x3d342c), x, 0.07, 0.085).scale.set(1.4, 0.6, 0.5);
      for (const x of [-0.19, 0.19]) add(new T.BoxGeometry(0.07, 0.42, 0.05), woolMaterial(0x4f6fa8), x, 0.0, -0.02);
    } else if (k.item === 'egg') {    // 恐龙蛋
      add(new T.SphereGeometry(0.17, 16, 12), woolMaterial(0xf3ead6), 0, 0.03, 0).scale.set(0.85, 1.2, 0.85);
      for (const [x, y, z] of [[0.09, 0.1, 0.1], [-0.08, 0.0, 0.12], [0.02, -0.08, 0.13], [-0.1, 0.12, -0.08], [0.11, -0.03, -0.09]]) add(new T.SphereGeometry(0.03, 6, 5), woolMaterial(0xb9a07c), x, y + 0.03, z);
    } else if (k.item === 'gem') {    // 蓝宝石：八面体
      add(new T.SphereGeometry(0.17, 4, 2), shiny(0x5f9cf0, 1.6), 0, 0.05, 0).scale.y = 1.3;
    } else {
      yarnBasket(body, fabric);
      labelHeight = .49;
    }
    const glow = add(new T.TorusGeometry(0.36, 0.018, 8, 28), new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd060, emissiveIntensity: 2.5 }), 0, -0.2, 0);
    glow.rotation.x = Math.PI / 2;
  } else if (weapon?.kind === 'grenade') {
    const model = bombProp(weapon.id);
    model.scale.setScalar(.30);
    body.add(model);
  } else if (gun && variants?.[index]) displayedWeapon(body, variants[index]);
  else ammoPouch(body, fabric);
  if (gun) {   // 一把枪：底下一圈光
    const glow = add(new T.TorusGeometry(0.34, 0.018, 8, 28), new T.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x7fd8ff, emissiveIntensity: 2.5 }), 0, -0.2, 0);
    glow.rotation.x = Math.PI / 2;
  }
  const text = heart ? '♥ +1' : objective ? `★ ${k.name || t('毛线篮')}` : gun ? `★ ${weapon?.name ?? ''}` : weapon ? `${weapon.short} +${k.amount ?? 1}` : t('弹药包');
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: label(text, { width: 384, height: 96, size: 46 }), transparent: true, depthWrite: false }));
  sprite.scale.set(0.72, 0.18, 1); sprite.position.y = labelHeight; g.add(sprite);
  g.position.set(k.x, (k.y ?? 0) + 0.55, k.z);
  g.userData.body = body; g.userData.label = sprite; g.userData.baseY = (k.y ?? 0) + 0.55;
  return g;
}

// toys / floor：会动的那几样（骨架模型、地球仪、小黄鸭、盆栽）不并进整块网格，交给 toys 单独造在第 floor 层上
function furniture(k, M, c, toys = null, floor = 0, authoredEggs = false) {
  const look = c.look || c.kind;
  if (look === 'sewing-board') {
    // All decoration stays flush with the board face.
    const face=c.z+c.d/2, rim=.082;
    k.soft(M('boards',0xb58b59),c.w,c.h,c.d,c.x,c.h/2,c.z,{r:.045});
    k.soft(M('felt',c.color),c.w-2*rim,c.h-2*rim,.045,c.x,c.h/2,face-.022,{r:.018});
    for(const y of [rim+.08,c.h-rim-.08]) {
      for(let x=c.minX+.20;x<c.maxX-.14;x+=.20) {
        k.soft(M('felt',0xe0c496),.098,.018,.012,x,y,face+.002,{r:.005,rz:.06});
      }
    }
    return;
  }
  // 博物馆的展品
  if (c.kind === 'plinth' && toys && look === 'skeleton') return toys.rattler(floor, c.id, c.x, c.z, kit => skeletonModel(kit, M, { ...c, x: 0, z: 0 }));
  if (c.kind === 'plinth' && toys && c.item === 'globe') {
    const l = plinth(k, M, { ...c, item: undefined }), [x, z] = l.pos(0, l.depth / 2);
    return toys.globe(floor, c.id, x, c.h, z, Math.min(l.across, l.depth) * 0.9);
  }
  if (c.kind === 'plinth') return look === 'dino' ? dinosaur(k, M, c) : look === 'skeleton' ? skeletonModel(k, M, c) : plinth(k, M, c);
  if (c.kind === 'case') {
    const display = Object.assign((type, color) => M(type, color), M, {
      glow: (color, strength) => M.glow(color, strength * .43),
    });
    return displayCase(k, display, c);
  }
  if (c.kind === 'sarcophagus') return sarcophagus(k, M, c);
  if (look === 'ottoman') return ottoman(k, M, c);
  if (look === 'reception') return reception(k, M, c);
  // 学校的课桌椅和操场上的玩具
  const school = { 'desk-kid': kidDesk, podium, locker: lockers, easel, palette: paletteTable, labbench: labBench, slide, swing: swings, playhouse, seesaw, blocks: blockStack }[look];
  if (school) return school(k, M, c);
  if (look === 'hedge') hedge(k, M, c);
  else if (look === 'tree') tree(k, M, c);
  else if (look === 'planter') planter(k, M, c);
  else if (look === 'sofa') sofa(k, M, c);
  else if (look === 'bed') bed(k, M, c);
  else if (look === 'bookshelf') bookshelf(k, M, c);
  else if (look === 'fridge') fridge(k, M, c);
  else if (look === 'wardrobe') cabinet(k, M, c, { doors: 2, crown: true });
  else if (look === 'shed') {
    // 花园工具房：木板墙、一扇门、瓦片顶
    k.soft(M('boards', c.color), c.w, c.h - 0.16, c.d, c.x, (c.h - 0.16) / 2, c.z, { r: 0.04 });
    k.soft(M('shingle', ROOF), c.w + 0.02, 0.17, c.d + 0.02, c.x, c.h - 0.085, c.z, { r: 0.05 });
    const zf = c.z - c.d / 2;
    k.soft(M('quilt', 0x8aa79b), 0.8, 1.7, 0.04, c.x - 0.3, 0.87, zf - 0.004, { r: 0.02 });
    k.loop(M.thread, [[c.x - 0.64, 0.08, zf - 0.03], [c.x - 0.64, 1.66, zf - 0.03], [c.x + 0.04, 1.66, zf - 0.03], [c.x + 0.04, 0.08, zf - 0.03]]);
    k.sphere(M.button(0xe9c46a), 0.035, c.x - 0.02, 0.9, zf - 0.04, { seg: 8, rings: 6 });
    k.soft(M.sheer(0.25), 0.5, 0.45, 0.02, c.x + 0.6, 1.4, zf - 0.006, { r: 0 });
    k.loop(M.thread, [[c.x + 0.33, 1.15, zf - 0.02], [c.x + 0.33, 1.65, zf - 0.02], [c.x + 0.87, 1.65, zf - 0.02], [c.x + 0.87, 1.15, zf - 0.02], [c.x + 0.33, 1.15, zf - 0.02]]);
  } else if (look === 'tub') {
    // 浴缸：圆滚滚的白缸，一汪水，两个龙头，一只小黄鸭
    k.soft(M('felt', c.color), c.w, c.h - 0.06, c.d, c.x, (c.h - 0.06) / 2 + 0.06, c.z, { r: 0.22, seg: 3 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.sphere(M.button(0xe9c46a), 0.07, c.x + sx * (c.w / 2 - 0.2), 0.06, c.z + sz * (c.d / 2 - 0.16), { seg: 8, rings: 6 });
    k.soft(M.button(0x9fd6e4), c.w - 0.3, 0.03, c.d - 0.3, c.x, c.h - 0.012, c.z, { r: 0.012 });
    for (let i = 0; i < 7; i++) k.sphere(M('felt', 0xffffff), 0.07 + (i % 3) * 0.02, c.x - c.w * 0.3 + (i % 4) * 0.13, c.h + 0.02, c.z - 0.12 + (i % 3) * 0.12, { seg: 8, rings: 6 });
    if (toys && !authoredEggs) toys.duck(floor, c.id, c.x + c.w * 0.18, c.h + 0.05, c.z + 0.05);
    else {
      k.sphere(M('felt', 0xf2cf62), 0.085, c.x + c.w * 0.18, c.h + 0.05, c.z + 0.05, { seg: 10, rings: 8, sy: 0.8 });
      k.sphere(M('felt', 0xf2cf62), 0.055, c.x + c.w * 0.18 + 0.07, c.h + 0.13, c.z + 0.05, { seg: 8, rings: 6 });
      k.sphere(M.button(0xe58b3a), 0.022, c.x + c.w * 0.18 + 0.125, c.h + 0.125, c.z + 0.05, { seg: 6, rings: 4 });
    }
    k.cyl(M.button(0xcfd6d8), 0.018, 0.018, 0.22, c.x + c.w / 2 - 0.12, c.h + 0.11, c.z - c.d / 2 + 0.1, { seg: 8 });
    k.sphere(M.button(0xcfd6d8), 0.035, c.x + c.w / 2 - 0.12, c.h + 0.23, c.z - c.d / 2 + 0.1, { seg: 8, rings: 6 });
  } else if (look === 'vanity') {
    // 洗手台：柜子上一个水盆，墙上一面镜子
    const l = cabinet(k, M, c, { doors: 2 }), [x, z] = l.pos(0, l.depth / 2), [bx, bz] = l.pos(0, 0.035), ns = l.ns;
    k.cyl(M.button(0xf6f3ec), 0.26, 0.2, 0.05, x, c.h + 0.022, z, { seg: 16 });
    k.cyl(M.button(0xcfd6d8), 0.016, 0.016, 0.18, bx, c.h + 0.09, bz + (ns ? 0.07 : 0), { seg: 8 });
    k.soft(M('toy_wood'), ns ? 1.0 : 0.05, 0.9, ns ? 0.05 : 1.0, bx, 1.65, bz, { r: 0.015 });
    const [mx, mz] = l.pos(0, 0.064);
    k.soft(M.button(0xcfe6ee), ns ? 0.88 : 0.012, 0.78, ns ? 0.012 : 0.88, mx, 1.65, mz, { r: 0 });
  } else if (look === 'basket') {
    // 藤篮：装着几卷布
    k.soft(M('knit', c.color), c.w, c.h - 0.08, c.d, c.x, (c.h - 0.08) / 2, c.z, { r: 0.12, seg: 3 });
    k.soft(M('toy_wood'), c.w + 0.02, 0.05, c.d + 0.02, c.x, c.h - 0.1, c.z, { r: 0.02 });
    const rolls = [0xe7a089, 0x9fc3e0, 0xf2d27a, 0xb7d1a0];
    for (let i = 0; i < 4; i++) k.cyl(M('felt', rolls[i]), 0.085, 0.085, c.d * 0.7, c.x + ((i + 0.5) / 4 - 0.5) * (c.w - 0.2), c.h - 0.02 + (i % 2) * 0.05, c.z, { seg: 10, rx: Math.PI / 2 });
  } else if (look === 'tv') {
    const l = cabinet(k, M, c), [x, z] = l.pos(0, l.depth / 2), ns = l.ns;
    k.soft(M('toy_wood'), ns ? 0.3 : 0.14, 0.04, ns ? 0.14 : 0.3, x, c.h + 0.02, z, { r: 0.01 });
    k.soft(M('felt', 0x4a4f55), ns ? 0.95 : 0.07, 0.56, ns ? 0.07 : 0.95, x, c.h + 0.34, z, { r: 0.03 });
    const [sx, sz] = l.pos(0, l.depth / 2 + 0.037);
    k.soft(M.glow(0x9fd3d8, 0.55), ns ? 0.84 : 0.006, 0.45, ns ? 0.006 : 0.84, sx, c.h + 0.34, sz, { r: 0 });
  } else if (c.kind === 'cabinet') {
    const l = cabinet(k, M, c), [x, z] = l.pos(l.across * 0.2, l.depth / 2), rnd = l.rnd;
    if (toys) toys.plant(floor, c.id, x, c.h, z, rnd);
    else {
      k.cyl(M.button(0xd08a66), 0.07, 0.055, 0.1, x, c.h + 0.05, z, { seg: 10 });
      for (let i = 0; i < 5; i++) k.sphere(M('terry', 0x6f9a5e), 0.05 + rnd() * 0.03, x + (rnd() - 0.5) * 0.1, c.h + 0.14 + rnd() * 0.1, z + (rnd() - 0.5) * 0.1, { seg: 8, rings: 6 });
    }
  } else if (c.kind === 'bench') table(k, M, c, c.look || 'coffee');
  else crate(k, M, c, look);
}

export function buildWorld(cine, level, weapons, variants) {
  const scene = cine.scene, B = level.bounds, H = level.height, WT = level.wallThickness, SH = level.storeyHeight, N = level.storeys.length, T0 = level.stairs;
  const root = new T.Group(); scene.add(root);
  // 没有房子的图（试战庭院：整张图都是露天）：把“房子”当成北边界上一条零进深的线，院子就是整张图，
  // 下面凡是搭房子的地方（外墙、屋檐、屋顶、石板路）都跳过
  const built = Number.isFinite(level.house.minX);
  const house = built ? level.house : { minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: B.minZ }, hx = (house.minX + house.maxX) / 2, hz = (house.minZ + house.maxZ) / 2, hw = house.maxX - house.minX, hd = house.maxZ - house.minZ;
  const inTower = (x, z) => !!T0 && x >= T0.minX - 0.01 && x <= T0.maxX + 0.01 && z >= T0.endZ - 0.01 && z <= T0.mouthZ;
  const inHouse = (x, z, pad = 0.01) => (x >= house.minX - pad && x <= house.maxX + pad && z >= house.minZ - pad && z <= house.maxZ) || inTower(x, z);   // 南立面外侧算室外
  // 这张图的外观参数：关卡的 theme 盖在默认值（家的样子）上
  // lampPower / lampRange / lampColor：每盏灯烘焙进光照体积时的亮度、照多远、颜色；skyGain：从窗和天窗进来的天光的倍数；
  // lightBounces：反射几次；lightBleed：反射光带多少表面的颜色；lightAmbient：屋里暗部的底色（[r, g, b]）；
  // sunBounce：晒到太阳的地面往回反多少光（1 是照实算；玩具的颜色都很亮，照实算室外会发白）
  // facadeTrim：朝花园那面外墙加不加装饰（百叶、窗楣、墙角包边、檐口的小方块、雨棚的花边）。只有“家”默认开。
  const TH = { wall: WALL, ceiling: CEILING, trim: null, beams: true, roof: true, lamp: 'pendant', night: false, facadeTrim: level.id === 'house',
    lampPower: 7, lampRange: 9, lampColor: 0xfff4e6, skyGain: 5, lightGain: 1, lightBounces: 4, lightBleed: 0.5, lightAmbient: null, sunBounce: 0.45, bounce: [0x59636e, 0xffd2a0, 0.4], sheer: [0xfff6e2, 0xffe6bd, 1], ...(level.theme || {}) };
  if (!built) TH.roof = false;

  // ---- 光照体积：整栋楼（外加一圈院子）里每半米一格，记下那里收到的天光、灯光和反射光。
  // 墙、家具和会动的角色都按自己的位置去查同一份数据，所以不用再给“室内”单独调一个亮度。
  // 这里只定范围、给材质挂上查询；搭完之后（文件末尾）再把搭出来的网格交给它烘焙。
  const VM = 2.5, vol = createLightVolume({
    min: [Math.min(house.minX, T0 ? T0.minX : Infinity) - VM, -0.2, Math.min(house.minZ, T0 ? T0.endZ : Infinity) - VM],
    max: [Math.max(house.maxX, T0 ? T0.maxX : -Infinity) + VM, level.top + (TH.roof ? 4.2 : 1.6), (built ? house.maxZ + 1.5 : B.maxZ) + VM],   // 没有房子就包住整个院子
    cell: TH.lightCell ?? 0.5, voxel: 0.2, ground: { y: 0, color: TH.lawn ?? LAWN },
  });
  const lit = m => vol.light(m);
  const lampList = [];   // 烘焙进体积的灯：吊灯 / 射灯、壁灯

  // ---- 材质：织物从材质库烘焙，小硬件（线、纽扣、灯罩、纱帘）用普通材质；整套由 library 的 plushMaterials 给，
  // 每个材质都过一遍 vol.light，于是墙、家具、线头都按位置查同一份烘焙光照
  const lib = createMaterialLibrary(cine.renderer, { resolution: 1024 });
  const M = plushMaterials(lib, { lit, sheer: TH.sheer });
  const barnSiding = TH.yard === 'orchard' ? M('boards',0xb56e4e) : null;
  const wall = M('felt', TH.wall), wood = M('toy_wood'), trim = TH.trim ? M('felt', TH.trim) : wood, sun = cine.sunDir;
  // 从一组矩形里挖掉一个洞（天窗）：每块被洞压到的矩形换成洞四周的四条
  const minus = (rects, h) => rects.flatMap(r => {
    if (h.maxX <= r.minX || h.minX >= r.maxX || h.maxZ <= r.minZ || h.minZ >= r.maxZ) return [r];
    return [{ ...r, maxX: h.minX }, { ...r, minX: h.maxX }, { ...r, minX: h.minX, maxX: h.maxX, maxZ: h.minZ }, { ...r, minX: h.minX, maxX: h.maxX, minZ: h.maxZ }].filter(q => q.maxX - q.minX > 0.02 && q.maxZ - q.minZ > 0.02);
  });
  const holes = S => S.index === N - 1
    ? S.skylights.map(q => ({ minX: q.x - q.w / 2, maxX: q.x + q.w / 2, minZ: q.z - q.d / 2, maxZ: q.z + q.d / 2 }))
    : [];
  const rnd = mulberry32(20261115);

  // ================================================================== 每一层
  // shell：外墙、窗、层间腰线（一直画，从花园看得到）；inner：地面、内墙、家具、灯（只画玩家所在层和上下相邻的层）
  const facadeDeco = new PlushKit();
  // 会动的小东西（机关、拉链、吊灯之类）：每层一个组，稍后挂到那一层的室内组上，换层时一起隐藏
  // Record the wall pieces after cutting window and door openings.
  const occluders = [];
  function solid(w, h, d, x, y, z, pad = .02) {
    if (w > pad * 3 && h > pad * 3 && d > pad * 3) {
      occluders.push([x - w / 2 + pad, y - h / 2 + pad, z - d / 2 + pad,
        x + w / 2 - pad, y + h / 2 - pad, z + d / 2 - pad]);
    }
  }
  const toyFloors = level.storeys.map(() => new T.Group());
  const toys = createToys({ Kit: PlushKit, M, floors: toyFloors, floorY: level.storeys.map(q => q.y) });
  const eggProps = createEasterEggProps({ Kit: PlushKit, M, floors: toyFloors, level });
  const authoredEggs = level.easterEggs.length > 0;
  function sceneFurniture(k, c, S) {
    if (!S.easterEggs.some(egg => egg.replaces === c.id)) furniture(k, M, c, toys, S.index, authoredEggs);
  }
  function buildStorey(S) {
    const shell = new PlushKit(), k = new PlushKit(), top = S.index === N - 1, ground = S.index === 0;
    const deco = new PlushKit();   // 外立面上的小装饰：一直画，但不投影（阴影那一趟已经很重）
    const indoor = S.rooms.filter(r => !r.outdoor && !r.tower);
    for (const r of indoor) {
      const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
      k.soft(M(r.surface || 'boards', r.floor), w, 0.07, d, (r.minX + r.maxX) / 2, -0.023, (r.minZ + r.maxZ) / 2, { r: 0, long: w >= d ? 0 : 2 });
    }
    if (T0) k.soft(M('boards', 0xc9a67a), T0.maxX - T0.minX + 0.2, 0.07, 0.24, 0, -0.023, T0.mouthZ - 0.02, { r: 0, long: 0 });   // 楼梯口的门槛

    // ---- 墙：内墙取碰撞盒；外墙沿房屋外沿补一圈（北面在楼梯间那里留口）；窗洞从整段墙里切出来
    const slabs = [];
    for (const c of S.walls) slabs.push({ alongZ: c.alongZ, line: c.alongZ ? c.x : c.z, t: WT, a0: c.alongZ ? c.minZ : c.minX, a1: c.alongZ ? c.maxZ : c.maxX, y0: c.minY - S.y, y1: c.maxY - S.y, lintel: c.kind === 'lintel' });
    const interiorLines = new Set(slabs.map(s => (s.alongZ ? 'x' : 'z') + s.line)), southOutside = !interiorLines.has('z' + house.maxZ);
    for (const [alongZ, edge, out] of built ? [[true, house.minX, -1], [true, house.maxX, 1], [false, house.minZ, -1], [false, house.maxZ, 1]] : []) {
      if (interiorLines.has((alongZ ? 'x' : 'z') + edge)) continue;   // 这一边本来就有一道内墙（一层的南立面）
      const lo = alongZ ? house.minZ : house.minX, hi = alongZ ? house.maxZ : house.maxX, base = { alongZ, line: edge + out * WT / 2, edge, t: WT, y0: 0, y1: H, outside: true };
      if (alongZ) slabs.push({ ...base, a0: lo - WT, a1: hi + (southOutside ? WT : WT / 2) });
      else if (T0 && edge === house.minZ) slabs.push({ ...base, a0: lo, a1: T0.minX }, { ...base, a0: T0.maxX, a1: hi });
      else slabs.push({ ...base, a0: lo, a1: hi });
    }
    const windows = S.windows.map(w => {
      const alongZ = typeof w.x === 'number', edge = alongZ ? w.x : w.z;
      return { alongZ, edge, at: w.at, w: w.w, a0: w.at - w.w / 2, a1: w.at + w.w / 2, sill: w.sill ?? 1.0, head: w.head ?? 2.1, inside: Math.sign((alongZ ? hx : hz) - edge) || 1 };
    });
    const pieces = [];
    for (const s of slabs) {
      const here = windows.filter(w => w.alongZ === s.alongZ && w.edge === (s.edge ?? s.line) && s.y0 === 0 && w.a0 > s.a0 && w.a1 < s.a1).sort((a, b) => a.a0 - b.a0);
      let cursor = s.a0;
      for (const w of here) {
        w.line = s.line;
        pieces.push({ ...s, a0: cursor, a1: w.a0 }, { ...s, a0: w.a0, a1: w.a1, y1: w.sill }, { ...s, a0: w.a0, a1: w.a1, y0: w.head });
        cursor = w.a1;
      }
      pieces.push({ ...s, a0: cursor });
    }
    const facade = s => s.outside || (!s.alongZ && s.line === house.maxZ);   // 朝外的墙归 shell
    const along = (kit, s, mat, len, h, thick, a, y, across, o) => kit.soft(mat, s.alongZ ? thick : len, h, s.alongZ ? len : thick, s.alongZ ? s.line + across : a, y, s.alongZ ? a : s.line + across, o);
    // 朝外的墙是一段段拼起来的（窗洞上下、门楣各是一块）：不倒圆角，拼缝才看不出来；内墙保留一点圆角
    for (const s of pieces) along(facade(s) ? shell : k, s, facade(s) && barnSiding ? barnSiding : wall, s.a1 - s.a0, s.y1 - s.y0, s.t, (s.a0 + s.a1) / 2, (s.y0 + s.y1) / 2, 0, { r: facade(s) ? 0 : 0.012 });
    for (const s of pieces) {
      const span = s.a1 - s.a0, midpoint = (s.a0 + s.a1) / 2;
      solid(s.alongZ ? s.t : span, s.y1 - s.y0, s.alongZ ? span : s.t,
        s.alongZ ? s.line : midpoint, S.y + (s.y0 + s.y1) / 2, s.alongZ ? midpoint : s.line);
    }
    // 门框和门槛
    for (const s of slabs.filter(s => s.lintel)) {
      const kit = facade(s) ? shell : k;
      for (const sign of [-1, 1]) along(kit, s, trim, 0.08, level.doorHeight, s.t + 0.07, sign > 0 ? s.a1 - 0.04 : s.a0 + 0.04, level.doorHeight / 2, 0, { r: 0.015 });
      along(kit, s, trim, s.a1 - s.a0, 0.08, s.t + 0.07, (s.a0 + s.a1) / 2, level.doorHeight + 0.04, 0, { r: 0.015 });
      along(kit, s, trim, s.a1 - s.a0 - 0.16, 0.03, s.t + 0.1, (s.a0 + s.a1) / 2, 0.012, 0, { r: 0.008 });
    }
    // ---- 朝花园那面外墙的装饰（TH.facadeTrim）。都贴着墙：离地 2.2 米以下凸出不超过 0.12 米，不加碰撞盒。
    const trimOn = TH.facadeTrim && built, fz = house.maxZ + (southOutside ? WT : WT / 2);   // fz：这一层南墙的外表面
    const sage = M('boards', 0x9db3a0), slatMat = M('felt', tone(0x9db3a0, -0.16)), cream = M('felt', TH.ceiling), bandMat = M('boards', 0xc9b48f);
    const doors = slabs.filter(s => s.lintel && !s.alongZ && s.line === house.maxZ);
    // 百叶要让开的东西：门框、门边的壁灯、别的窗、墙角
    const busy = [[-Infinity, house.minX + 0.22], [house.maxX - 0.22, Infinity]];
    for (const s of doors) { const lamp = (s.a0 + s.a1) / 2 + (s.a1 - s.a0 + 0.7) / 2 + 0.1; busy.push([s.a0 - 0.1, s.a1 + 0.1], [lamp - 0.12, lamp + 0.12]); }
    for (const w of windows) if (!w.alongZ && w.inside < 0) busy.push([w.a0 - 0.6, w.a1 + 0.6, w]);
    // 一扇窗的窗套：两边的百叶（地方不够就不装）、上面的窗楣；没挂花箱的窗下面加一条窗台
    function windowTrim(w, hasBox) {
      const hh = w.head - w.sill, want = Math.min(0.46, Math.max(0.34, w.w * 0.26));
      const room = side => {   // 这一侧从窗框往外到最近的东西有多宽
        const from = w.at + side * (w.w / 2 + 0.075); let gap = Infinity;
        for (const b of busy) { if (b[2] === w) continue; const d = side > 0 ? b[0] - from : from - b[1]; if (d > -0.5) gap = Math.min(gap, Math.max(0, d)); }
        return gap;
      };
      const sw = Math.min(want, room(-1) - 0.08, room(1) - 0.08), shutters = sw >= 0.26;
      if (shutters) for (const side of [-1, 1]) {
        const x = w.at + side * (w.w / 2 + 0.075 + sw / 2), n = Math.max(3, Math.round((hh - 0.14) / 0.115));
        deco.soft(sage, sw, hh + 0.05, 0.035, x, (w.sill + w.head) / 2, fz + 0.0175, { r: 0.012, long: 1 });
        for (let i = 0; i < n; i++) deco.box(slatMat, sw - 0.1, 0.06, 0.014, x, w.sill + 0.07 + (i + 0.5) * (hh - 0.14) / n, fz + 0.045, { rx: 0.5 });
      }
      const W = w.w + 0.3 + (shutters ? sw * 2 : 0);
      deco.soft(cream, W, 0.1, 0.07, w.at, w.head + 0.125, fz + 0.035, { r: 0.02, long: 0 });
      deco.soft(bandMat, W + 0.1, 0.045, 0.11, w.at, w.head + 0.197, fz + 0.055, { r: 0.015, long: 0 });
      if (!hasBox) deco.soft(bandMat, w.w + 0.3, 0.06, 0.1, w.at, w.sill - 0.1, fz + 0.05, { r: 0.02, long: 0 });
    }
    // 窗
    for (const w of windows) {
      if (w.line === undefined) continue;
      const facing = Math.max(0, -(w.alongZ ? sun.x : sun.z) * w.inside);   // 朝着太阳的窗，纱帘更亮
      windowUnit(shell, M, { ...w, t: WT, glow: Math.round((0.35 + facing * 1.5) * 10) / 10, drape: [0xc65a4e, 0x6f93a8, 0xd9a441][(S.index + (w.alongZ ? 0 : 1)) % 3] });
      const outer = w.line + WT / 2;
      const below = ground && S.furnitureBoxes.some(c => c.maxY > 0.46 && c.minZ < w.edge + 0.7 && c.maxZ > w.edge && c.maxX > w.a0 && c.minX < w.a1);
      if (trimOn && !w.alongZ && w.inside < 0) windowTrim(w, !below && level.outdoor.length > 0);
      if (!w.alongZ && w.inside < 0 && !below && level.outdoor.length) {   // 朝花园的窗外挂花箱（窗下已经靠着长椅之类的就不挂）
        shell.soft(M('boards', 0xb98a66), w.w + 0.1, 0.2, 0.22, w.at, w.sill - 0.2, outer + 0.12, { r: 0.03, long: 0 });
        for (let i = 0, n = Math.round(w.w / 0.16); i < n; i++) flower(shell, M, w.at + ((i + 0.5) / n - 0.5) * w.w, w.sill - 0.12, outer + 0.1 + (i % 2) * 0.05, PETALS[Math.floor(rnd() * PETALS.length)], 0.9 + rnd() * 0.5);
      }
    }

    // ---- 每个房间：墙裙（房间自己的颜色）、踢脚线、顶上的木梁、天花板
    for (const r of indoor) {
      const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2, panel = M('quilt', r.accent ?? 0xb9b08f), base = M('felt', tone(r.accent ?? 0xb9b08f, -0.3));
      for (const s of pieces) {
        if (s.y0 !== 0) continue;
        const face = s.alongZ ? [r.minX, r.maxX] : [r.minZ, r.maxZ], span = s.alongZ ? [r.minZ, r.maxZ] : [r.minX, r.maxX];
        const edge = s.edge ?? s.line, a0 = Math.max(s.a0, span[0]), a1 = Math.min(s.a1, span[1]);
        if (!face.includes(edge) || a1 - a0 < 0.12) continue;
        const dir = Math.sign((s.alongZ ? cx : cz) - edge), off = (edge - s.line) + dir * (s.edge === undefined ? s.t / 2 : 0), topY = Math.min(0.94, s.y1 - 0.02);
        along(k, s, panel, a1 - a0, topY - 0.1, 0.03, (a0 + a1) / 2, 0.1 + (topY - 0.1) / 2, off + dir * 0.011, { r: 0.012 });
        along(k, s, base, a1 - a0, 0.1, 0.045, (a0 + a1) / 2, 0.05, off + dir * 0.02, { r: 0.012 });
        if (s.y1 > 1) along(k, s, trim, a1 - a0, 0.045, 0.055, (a0 + a1) / 2, topY + 0.02, off + dir * 0.022, { r: 0.012 });
      }
      const w = r.maxX - r.minX, d = r.maxZ - r.minZ, alongX = w < d, n = Math.max(1, Math.round((alongX ? d : w) / 2.2));
      if (TH.beams) for (let i = 0; i < n; i++) {
        const o = ((i + 0.5) / n - 0.5) * (alongX ? d : w);
        k.soft(wood, alongX ? w - 0.2 : 0.12, 0.13, alongX ? 0.12 : d - 0.2, cx + (alongX ? 0 : o), H - 0.065, cz + (alongX ? o : 0), { r: 0.02, long: alongX ? 0 : 2 });
      }
      // 每个房间一块天花板（有天窗的挖掉天窗）
      for (const q of holes(S).reduce(minus, [r])) {
        const width = q.maxX - q.minX, depth = q.maxZ - q.minZ;
        const x = (q.minX + q.maxX) / 2, z = (q.minZ + q.maxZ) / 2;
        k.soft(M('felt', TH.ceiling), width, .06, depth, x, H + .03, z, { r:0 });
        solid(width, .06, depth, x, S.y + H + .03, z, .005);
      }
    }
    // 天窗：木框、几根窗棂（月光把它们的影子投在地上）、一层玻璃
    for (const q of holes(S)) {
      const w = q.maxX - q.minX, d = q.maxZ - q.minZ, cx = (q.minX + q.maxX) / 2, cz = (q.minZ + q.maxZ) / 2, y = H + 0.1;
      for (const s of [-1, 1]) { shell.soft(trim, w + 0.24, 0.26, 0.12, cx, y, cz + s * (d / 2 + 0.06), { r: 0.02 }); shell.soft(trim, 0.12, 0.26, d, cx + s * (w / 2 + 0.06), y, cz, { r: 0.02 }); }
      const wide = w >= d, n = Math.max(1, Math.round((wide ? w : d) / 1.1));
      for (let i = 1; i < n; i++) shell.soft(trim, wide ? 0.06 : w, 0.08, wide ? d : 0.06, cx + (wide ? (i / n - 0.5) * w : 0), y + 0.06, cz + (wide ? 0 : (i / n - 0.5) * d), { r: 0.012 });
      shell.soft(trim, wide ? w : 0.06, 0.08, wide ? 0.06 : d, cx, y + 0.06, cz, { r: 0.012 });
      shell.quad(M.glass, [q.minX, y + 0.11, q.minZ], [q.maxX, y + 0.11, q.minZ], [q.maxX, y + 0.11, q.maxZ], [q.minX, y + 0.11, q.maxZ]);
    }
    // 外立面：一层的墙基，层与层之间的腰线，顶层的屋檐（伸出去一截，负责挡住太阳）
    if (ground) for (const s of pieces) if (!s.alongZ && s.line === house.maxZ && s.y0 === 0) along(shell, s, M('boards', barnSiding ? 0x88654f : 0x9db3a0), s.a1 - s.a0, 0.42, 0.04, (s.a0 + s.a1) / 2, 0.21, s.t / 2 + 0.014, { r: 0.015, long: 0 });
    if (!built) { /* 露天：没有屋檐也没有腰线 */ }
    else if (top) for (const q of holes(S).reduce(minus, [{ minX: hx - hw / 2 - 0.65, maxX: hx + hw / 2 + 0.65, minZ: hz - hd / 2 - 0.65, maxZ: hz + hd / 2 + 0.65 }])) shell.soft(M('felt', TH.ceiling), q.maxX - q.minX, 0.1, q.maxZ - q.minZ, (q.minX + q.maxX) / 2, H + 0.11, (q.minZ + q.maxZ) / 2, { r: 0 });
    else {
      const band = M('boards', 0xc9b48f), y = H + (SH - H) / 2;
      shell.soft(band, hw + 0.56, SH - H + 0.12, 0.1, hx, y, house.maxZ + (ground ? WT / 2 : WT) + 0.03, { r: 0.03, long: 0 });
      for (const sx of [-1, 1]) shell.soft(band, 0.1, SH - H + 0.12, hd + 0.5, hx + sx * (hw / 2 + WT + 0.03), y, hz + 0.05, { r: 0.03, long: 2 });
      shell.soft(M('felt', WALL), hw + 0.4, SH - H - 0.07, hd + 0.2, hx, y, hz + 0.1, { r: 0 });   // 楼板本身：从楼梯口看过去是实心的（上下各让开一点，不和天花板、地板同面）
      solid(hw + .4, SH - H - .07, hd + .2, hx, S.y + y, hz + .1);
    }
    if (trimOn) {
      // 墙角包边：每层一根方木，两个面各凸出 0.05 米
      for (const sx of [-1, 1]) deco.soft(bandMat, 0.26, H, 0.26, hx + sx * (hw / 2 + WT - 0.08), H / 2, fz - 0.08, { r: 0.04, long: 1 });
      if (!top) {   // 腰线加厚：上沿压一条盖板，下沿一条细线脚
        const y = H + (SH - H) / 2, hb = (SH - H + 0.12) / 2, bz = house.maxZ + (ground ? WT / 2 : WT) + 0.03;
        deco.soft(bandMat, hw + 0.72, 0.06, 0.2, hx, y + hb, bz + 0.03, { r: 0.02, long: 0 });
        deco.soft(cream, hw + 0.6, 0.05, 0.06, hx, y - hb + 0.01, bz + 0.05, { r: 0.02, long: 0 });
      } else {      // 檐口：屋檐底下一条饰带，带上一排小方块；两侧山墙只有饰带
        deco.soft(bandMat, hw + WT * 2 + 0.14, 0.26, 0.07, hx, H - 0.1, fz + 0.035, { r: 0.02, long: 0 });
        for (const sx of [-1, 1]) deco.soft(bandMat, 0.07, 0.26, hd + WT + 0.1, hx + sx * (hw / 2 + WT + 0.035), H - 0.1, hz + 0.05, { r: 0.02, long: 2 });
        for (let i = 0, n = Math.round((hw + 0.3) / 0.42); i < n; i++) deco.soft(cream, 0.17, 0.12, 0.13, hx + ((i + 0.5) / n - 0.5) * (hw + 0.3), H + 0.0, fz + 0.135, { r: 0.02 });
      }
    }
    // 两处入口上方的雨棚和壁灯
    if (ground && !barnSiding) for (const s of doors) {
      const x = (s.a0 + s.a1) / 2, w = s.a1 - s.a0 + 0.7, z = house.maxZ + WT / 2;
      // 有装饰的版本：雨棚抬高、放平一点，前沿挂一条波浪花边（花边最低处离地 2.23 米，人和僵尸都从底下过）
      const ay = trimOn ? 2.5 : 2.42, tilt = trimOn ? 0.26 : 0.32, armY = trimOn ? 2.44 : 2.26;
      shell.soft(M('gingham', 0xc65a4e), w, 0.06, 1.0, x, ay, z + 0.45, { r: 0.02, rx: tilt });
      for (const sx of [-1, 1]) shell.soft(wood, 0.06, 0.06, 0.8, x + sx * (w / 2 - 0.08), armY, z + 0.4, { r: 0.012, rx: tilt });
      if (trimOn) {
        const n = Math.round(w / 0.22), r = w / n / 2, strip = 0.05, outline = [[-w / 2, 0], [w / 2, 0], [w / 2, -strip]];
        for (let i = n - 1; i >= 0; i--) for (let j = 1; j <= 8; j++) { const a = -Math.PI * j / 8; outline.push([-w / 2 + (2 * i + 1) * r + Math.cos(a) * r, -strip + Math.sin(a) * r]); }
        deco.extrude(M('gingham', 0xc65a4e), outline, 0.025, new T.Matrix4().makeTranslation(x, ay - 0.5 * Math.sin(tilt) + 0.02, z + 0.45 + 0.5 * Math.cos(tilt) + 0.005), { uv: 1 });
      }
      shell.soft(wood, 0.1, 0.16, 0.1, x + w / 2 + 0.1, 1.86, z + 0.05, { r: 0.02 });
      shell.sphere(M.glow(0xffd9a0, 2.2), 0.09, x + w / 2 + 0.1, 1.72, z + 0.1, { seg: 10, rings: 8 });
      lampList.push({ p: [x + w / 2 + 0.1, 1.72, z + 0.25], color: 0xffd9a0, power: TH.lampPower * 0.25, range: 4 });
    }

    // ---- 室内摆设
    const lamps = S.lamps.map(l => { const p = TH.lamp === 'spot' ? spotLamp(k, M, { x: l.x, z: l.z, ceiling: H }) : toys.lamp(S.index, { x: l.x, z: l.z, ceiling: H, color: l.color ?? 0xffd9a0 }); return { x: p.x, y: p.y + S.y, z: p.z }; });   // 吊灯单独一组：被毛球碰到会晃
    for (const l of lamps) lampList.push({ p: [l.x, l.y - 0.05, l.z], color: TH.lampColor, power: TH.lampPower, range: TH.lampRange, ...(TH.lamp === 'spot' ? { dir: [0, -1, 0], cone: 1.15, soft: 0.6 } : {}) });
    for (const g of S.hangings) (g.kind === 'whale' ? whale : banner)(k, M, { ...g, ceiling: H });
    for (const r of S.rugs) rug(k, M, { ...r, y: inHouse(r.x, r.z) ? 0.026 : 0.012 });
    S.pictures.forEach((p, i) => picture(k, M, { ...p, seed: S.index * 31 + i + 1 }));
    for (const c of S.furnitureBoxes) if (!ground || inHouse(c.x, c.z)) sceneFurniture(k, c, S);
    if (T0 && top) {   // 顶层西边那一跑的口上：栏杆
      const x0 = T0.minX, x1 = -T0.spine, z = T0.mouthZ;
      for (const x of [x0 + 0.06, (x0 + x1) / 2, x1 - 0.06]) k.soft(wood, 0.08, 1.0, 0.08, x, 0.5, z, { r: 0.02 });
      k.soft(wood, x1 - x0, 0.07, 0.1, (x0 + x1) / 2, 1.0, z, { r: 0.025, long: 0 });
      k.soft(M('quilt', 0xc65a4e), x1 - x0 - 0.2, 0.6, 0.04, (x0 + x1) / 2, 0.5, z, { r: 0.02 });
    }
    const group = (kit, name) => { const g = new T.Group(); g.position.y = S.y; const meshes = kit.build({ name: name + S.index }); if (meshes.length) g.add(...meshes); root.add(g); return g; };
    facadeDeco.merge(deco, 0, S.y, 0);   // 各层的装饰并成一组网格：每种材质只多一次绘制
    return { shell: group(shell, 'shell'), inner: group(k, 'inner'), lamps };
  }
  const storeys = level.storeys.map(buildStorey);
  storeys.forEach((q, i) => q.inner.add(toyFloors[i]));
  for (const g of level.gadgets || []) toys.gadget(g);
  level.pickups.forEach((p, i) => { if (p.stash) toys.zipper({ ...p, id: p.id ?? i + 1 }); });

  // ================================================================== 楼梯间：通高的竖井，折返楼梯
  const tower = new PlushKit();
  if (T0) {
    const t = T0, tw = t.maxX - t.minX, depth = t.mouthZ - t.endZ, zc = (t.mouthZ + t.endZ) / 2, hgt = level.top - (SH - H), laneW = -t.minX - t.spine, STEPS = 8, dz = t.run / STEPS;
    // 三面墙；北墙在每个半层平台的高度开一扇窗
    for (const sx of [-1, 1]) {
      const x = sx * (tw / 2 + WT / 2), z = zc - WT / 2;
      tower.soft(wall, WT, hgt, depth + WT, x, hgt / 2, z, { r:.012 });
      solid(WT, hgt, depth + WT, x, hgt / 2, z);
    }
    const nz = t.endZ - WT / 2, wins = [];
    for (let i = 0; i < t.flights; i++) wins.push([i * SH + t.rise + 0.95, i * SH + t.rise + 2.05]);
    for (const sx of [-1, 1]) tower.soft(wall, tw / 2 - 0.65, hgt, WT, sx * (0.65 + (tw / 2 - 0.65) / 2), hgt / 2, nz, { r: 0.012 });
    let cursor = 0;
    for (const [y0, y1] of [...wins, [hgt, hgt]]) { if (y0 - cursor > 0.01) tower.soft(wall, 1.3, y0 - cursor, WT, 0, (cursor + y0) / 2, nz, { r: 0.012 }); cursor = y1; }
    for (const [y0, y1] of wins) windowUnit(tower, M, { line: nz, at: 0, w: 1.3, sill: y0, head: y1, t: WT, inside: 1, alongZ: false, glow: 0.5, drape: 0xd9a441 });
    // 两跑之间的隔墙
    tower.soft(M('felt', tone(WALL, -0.08)), t.spine * 2, hgt, t.run, 0, hgt / 2, (t.landingZ + t.mouthZ) / 2, { r: 0.03 });
    solid(t.spine * 2, hgt, t.run, 0, hgt / 2, (t.landingZ + t.mouthZ) / 2, .04);
    const tread = M('boards', 0xdcc096), runner = M('quilt', 0xc0705a), under = M('boards', 0xcfae82);
    for (let i = 0; i < t.flights; i++) {
      const y = i * SH;
      for (let j = 0; j < STEPS; j++) {
        // 踏步顶面取这一级中点的坡面高度：身体按坡道走，脚和台阶最多差半级
        const zA = t.mouthZ - (j + 0.5) * dz, hA = y + t.rise * (j + 0.5) / STEPS, zB = t.landingZ + (j + 0.5) * dz, hB = y + t.rise + t.rise * (j + 0.5) / STEPS;
        for (const [x, z, h] of [[t.xA, zA, hA], [t.xB, zB, hB]]) {
          tower.soft(j % 2 ? tread : under, laneW - 0.02, 0.34, dz + 0.01, x, h - 0.17, z, { r: 0.02, long: 0 });
          tower.soft(runner, laneW * 0.55, 0.02, dz + 0.02, x, h + 0.006, z, { r: 0.006 });
        }
      }
      tower.soft(tread, tw - 0.02, 0.2, t.landingZ - t.endZ, 0, y + t.rise - 0.1, t.landZ, { r: 0.02, long: 0 });
      tower.soft(runner, tw - 0.5, 0.02, (t.landingZ - t.endZ) * 0.55, 0, y + t.rise + 0.006, t.landZ, { r: 0.006 });
      tower.sphere(M.glow(0xffd9a0, 2.2), 0.08, -tw / 2 + 0.1, y + t.rise + 1.9, t.landZ, { seg: 10, rings: 8 });   // 平台上的壁灯
      lampList.push({ p: [-tw / 2 + 0.3, y + t.rise + 1.9, t.landZ], color: 0xffd9a0, power: TH.lampPower * 0.45, range: 6 });
    }
    // 一层：东边那一跑下面是楼梯柜
    tower.soft(M('quilt', 0xb9a07c), laneW - 0.1, H - 0.5, 0.06, t.xB, (H - 0.5) / 2 + 0.06, t.mouthZ + 0.03, { r: 0.03 });
    tower.loop(M.thread, [[t.spine + 0.14, 0.16, t.mouthZ + 0.07], [t.spine + 0.14, H - 0.56, t.mouthZ + 0.07], [t.maxX - 0.14, H - 0.56, t.mouthZ + 0.07], [t.maxX - 0.14, 0.16, t.mouthZ + 0.07], [t.spine + 0.14, 0.16, t.mouthZ + 0.07]]);
    tower.sphere(M.button(0xe9c46a), 0.035, t.spine + 0.24, 1.05, t.mouthZ + 0.08, { seg: 8, rings: 6 });
    tower.soft(wall, laneW, 0.5, 0.1, t.xB, H - 0.25, t.mouthZ, { r: 0.012 });
    // 竖井的顶
    tower.soft(M('felt', CEILING), tw, 0.06, depth, 0, hgt + 0.03, zc, { r: 0 });
    tower.soft(M('shingle', ROOF), tw + WT * 2 + 0.5, 0.2, depth + WT + 0.4, 0, level.top + 0.06, zc - WT / 2 - 0.1, { r: 0.06 });
  }

  // ================================================================== 花园：草地、围篱、院门、石板路
  const k = new PlushKit(), far = new PlushKit();   // far：屋顶和远景，不投影
  k.soft(M('terry', TH.lawn ?? LAWN), 120, 0.2, 120, hx, -0.1, (B.minZ + B.maxZ) / 2, { r: 0 });   // 草地顶面在 y = 0，室内地面高出 1.2 厘米
  for (const c of level.furnitureBoxes) if (!inHouse(c.x, c.z) && !c.parkStyle) sceneFurniture(k, c, level.storeys[0]);
  const G = level.outdoor.length ? { minX: house.minX, maxX: house.maxX, minZ: house.maxZ, maxZ: B.maxZ } : null;
  if (G && TH.yard === 'playground') playground(k, M, { G, gateX: level.player.x, yard: level.yard || [] });   // 学校：铅笔围栏、蜡笔校门、地上的画线
  else if (G && TH.yard !== 'park-tour') {
    if (TH.yard === 'orchard') {
      for (const plot of level.outdoor) {
        const x=(plot.minX+plot.maxX)/2, z=(plot.minZ+plot.maxZ)/2;
        k.soft(M('terry',plot.floor),plot.maxX-plot.minX-.05,.024,plot.maxZ-plot.minZ-.05,x,-.006,z,{r:.009});
      }
      // Two sewn soil strips make the orchard readable as rows, with cross lanes between trees.
      const rows = new Map();
      for (const prop of level.furnitureBoxes.filter(c=>c.id.startsWith('orchard-tree'))) {
        const line = rows.get(prop.x) ?? [];
        line.push(prop.z);
        rows.set(prop.x,line);
        for (let i=0;i<6;i++) {
          const a=i*Math.PI/3+prop.z, x=prop.x+Math.cos(a)*1.1, z=prop.z+Math.sin(a)*1.1, y=prop.h-.08+(i%2)*.26;
          k.sphere(M('felt',i%3===0?0xe2a64f:0xb7543e),.16,x,y,z,{seg:10,rings:8});
          k.soft(wood,.035,.10,.035,x,y+.15,z,{r:.011});
        }
      }
      for (const [x, points] of rows) {
        const near=Math.min(...points), far=Math.max(...points), z=(near+far)/2;
        k.soft(M('quilt',0x9f835c),1.64,.019,far-near+1.6,x,.006,z,{r:.008});
        for (const side of [-1,1])
          k.dashes(M.thread,[x+side*.69,.026,near-.65],[x+side*.69,.026,far+.65],{ stitch:.13, gap:.082,r:.011 });
      }
    }
    // 围篱：东、南、西三面，朝外的一面没人看得到
    hedge(k, M, { id: 'edge-s', x: hx, z: G.maxZ + 0.3, w: hw + 1.2, d: 0.6, h: 2.2, color: HEDGE, hidden: 's' });
    if (!built) hedge(k, M, { id: 'edge-n', x: hx, z: G.minZ - 0.3, w: hw + 1.2, d: 0.6, h: 2.2, color: HEDGE, hidden: 'n' });
    for (const sx of [-1, 1]) hedge(k, M, { id: 'edge' + sx, x: hx + sx * (hw / 2 + 0.3), z: (G.minZ + WT / 2 + G.maxZ) / 2, w: 0.6, d: G.maxZ - G.minZ - WT / 2, h: 2.2, color: HEDGE, hidden: sx > 0 ? 'e' : 'w' });
    const gx = level.player.x, gz = G.maxZ - 0.06;
    for (const s of [-1, 1]) { k.soft(wood, 0.16, 1.9, 0.16, gx + s * 0.95, 0.95, gz, { r: 0.03 }); k.sphere(M.button(0xe9c46a), 0.11, gx + s * 0.95, 1.98, gz, { seg: 10, rings: 8 }); }
    for (let i = 0; i < 9; i++) { const x = gx - 0.72 + i * 0.18, h = 1.25 + Math.sin(i / 8 * Math.PI) * 0.3; k.soft(M('felt', 0xf3ead8), 0.13, h, 0.05, x, h / 2 + 0.06, gz, { r: 0.05 }); }
    for (const y of [0.45, 1.05]) k.soft(wood, 1.74, 0.07, 0.035, gx, y, gz + 0.04, { r: 0.012 });
    const stone = [0xd9cdb0, 0xcfc3a4, 0xe2d7bd];
    const path = [];
    if (level.id === 'house') {   // 家：绕过花坛的两条弧线，再分一条去客厅的落地门（坐标是照着这张图摆的）
      path.push([0, 4.45], [0.05, 5.2], [-0.04, 5.95]);
      for (const s of [-1, 1]) path.push([s * 1.0, 6.5], [s * 2.0, 6.75], [s * 3.0, 7.05], [s * 3.3, 7.9], [s * 2.8, 8.75], [s * 1.9, 9.4], [s * 0.85, 9.9]);
      path.push([-5.45, 3.8], [-5.2, 4.6], [-4.6, 5.3], [-3.7, 5.85], [-2.7, 6.2], [-1.7, 6.45]);
    } else {                      // 别的图：从院门到南墙上每扇门各铺一条直的，压在家具底下的那几块不铺
      for (const d of level.walls.filter(c => c.kind === 'lintel' && !c.alongZ && Math.abs(c.z - house.maxZ) < 0.01)) {
        const from = [gx, G.maxZ - 1.0], to = [d.x, house.maxZ + 0.75], n = Math.max(1, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.78));
        for (let i = 0; i <= n; i++) {
          const x = from[0] + (to[0] - from[0]) * i / n, z = from[1] + (to[1] - from[1]) * i / n;
          if (!level.furnitureBoxes.some(c => x > c.minX - 0.35 && x < c.maxX + 0.35 && z > c.minZ - 0.35 && z < c.maxZ + 0.35)) path.push([x + (i % 2 ? 0.05 : -0.04), z]);
        }
      }
    }
    if (built && TH.yard !== 'orchard') for (const [x, z] of path) k.cyl(M('felt', stone[Math.floor(rnd() * 3)]), 0.3 + rnd() * 0.06, 0.33 + rnd() * 0.06, 0.035, x + (rnd() - 0.5) * 0.08, 0.004, z, { seg: 12 });
    // 沿围篱脚下的野花和蘑菇（都很矮，不挡路）
    for (let i = 0; i < 46; i++) {
      const side = Math.floor(rnd() * 3), u = rnd();
      const x = side === 0 ? G.minX + 0.22 + rnd() * 0.25 : side === 1 ? G.maxX - 0.22 - rnd() * 0.25 : G.minX + 0.6 + u * (hw - 1.2);
      const z = side === 2 ? G.maxZ - 0.22 - rnd() * 0.25 : G.minZ + 0.5 + u * (G.maxZ - G.minZ - 1);
      if (Math.abs(x - gx) < 1.2 && z > G.maxZ - 1) continue;
      if (rnd() < 0.2) { k.cyl(M('felt', 0xf3ead8), 0.03, 0.04, 0.1, x, 0.05, z, { seg: 6 }); k.sphere(M('felt', 0xd9584a), 0.09, x, 0.1, z, { seg: 10, rings: 5, thetaLen: Math.PI / 2 }); }
      else flower(k, M, x, 0, z, PETALS[Math.floor(rnd() * PETALS.length)], 0.9 + rnd() * 0.8);
    }
  }

  let chimney = null;
  if (TH.roof) {
  // ---- 坡屋顶、烟囱（在顶层上面）
  const roofY = (N - 1) * SH, pitch = 0.47, run = hd / 2 + 0.75, rise = run * Math.tan(pitch), slope = run / Math.cos(pitch), eave = roofY + H + 0.16;
  for (const sign of [-1, 1]) {
    far.soft(M('shingle', TH.roofColor ?? ROOF), hw + 1.6, 0.18, slope + 0.1, hx, eave + rise / 2, hz + sign * run / 2, { r: 0.05, rx: sign * pitch, ry: sign > 0 ? Math.PI : 0 });
    for (const x of [house.minX - 0.5, house.maxX + 0.5]) far.quad(M('felt', WALL), [x, eave - 0.05, hz], [x, eave - 0.05, hz + sign * run], [x, eave + rise, hz], [x, eave + rise, hz], [[0, 0], [run, 0], [0, rise], [0, rise]], 1, [Math.sign(x - hx), 0, 0]);
  }
  far.cyl(M('felt', tone(TH.roofColor ?? ROOF, -0.2)), 0.13, 0.13, hw + 1.7, hx, eave + rise + 0.05, hz, { seg: 10, rz: Math.PI / 2 });
  if (TH.yard !== 'playground' && !barnSiding) {
    chimney = { x: hx + 4.6, z: hz + 2.6, top: eave + rise - 2.6 * Math.tan(pitch) + 1.5 };
    const { x, z, top } = chimney, cap = M('felt', 0xe4d2ad);
    far.soft(M('quilt', 0xb86a55), .9, 2.12, .9, x, top - 1.14, z, { r:.050 });
    far.soft(M('felt', 0x4b3c34), .81, .05, .81, x, top - .07, z, { r:.018 });
    for (const side of [-1, 1]) {
      far.soft(cap, 1.03, .15, .17, x, top, z + side * .43, { r:.034 });
      far.soft(cap, .17, .15, .72, x + side * .43, top, z, { r:.034 });
    }
  }

  }

  if (G) {
  // ---- 远景：毛毡小山、棒棒糖树（都在围篱外面）
  if (TH.rainbow) rainbow(far, M, { x: hx, z: house.minZ - 34, r: 23 });
  const hills = [0x9dbb7c, 0x8fb074, 0xa9c487, 0x86a86e];
  const yardZ = (B.minZ + B.maxZ) / 2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * .3, dist = 34 + rnd() * 24, r = 12 + rnd() * 14;
    const [x, z] = distantScenery(B, hx, yardZ, a, dist, r + 2.0);
    far.sphere(M('terry', hills[i % 4]), r, x, -r * .12, z, { seg:22, rings:10, sy:.3 + rnd() * .18, uv:3 });
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, dist = 19 + rnd() * 16, s = .8 + rnd() * .9;
    const [x, z] = distantScenery(B, hx, yardZ, a, dist, 1.5 * s + 1.0);
    far.cyl(M('knit', 0x8a6747), 0.16 * s, 0.24 * s, 2.4 * s, x, 1.2 * s, z, { seg: 8 });
    far.sphere(M('leaves', rnd() < 0.3 ? 0xd7a35a : rnd() < 0.5 ? 0x8fb56c : 0x7da762), 1.5 * s, x, 3.3 * s, z, { seg: 14, rings: 10, sy: 0.9 });
  }

  }

  const fixed = [...k.build({ name: 'garden' }), ...tower.build({ name: 'stairs' }), ...far.build({ name: 'far', cast: false }), ...facadeDeco.build({ name: 'facade', cast: false })];
  root.add(...fixed);

  // ---- 天上的棉花云共用一个实例化网格，烟从烟囱开口往上散开。
  const puffMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xfff3dd, emissiveIntensity: 0.22 });
  const cloudSpec = [];
  if (!TH.night) for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, dist = 30 + rnd() * 40, y = 18 + rnd() * 10, s = 2.2 + rnd() * 2.2;
    for (let j = 0; j < 5; j++) cloudSpec.push({ a, dist, y: y + (j % 2) * s * 0.25 - (j === 0 ? 0 : s * 0.1), s: s * (j === 2 ? 1 : 0.62 + rnd() * 0.2), dx: (j - 2) * s * 0.75 });
  }
  const puffs = new T.InstancedMesh(new T.SphereGeometry(1, 14, 10), puffMat, cloudSpec.length);
  puffs.visible = cloudSpec.length > 0;
  puffs.frustumCulled = false; puffs.castShadow = false; puffs.receiveShadow = false; root.add(puffs);
  const chimneySmoke = chimney && createVapor({ parent:root, x:chimney.x, y:chimney.top + .08, z:chimney.z,
    count:7, duration:9.2, rise:3.0, size:1.85, drift:1.8, opacity:.48, loop:true });
  const dummy = new T.Object3D();
  let lastTime = null;
  function update(time) {
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.05, time - lastTime));
    toys.update(dt, time); eggProps.update(dt); lastTime = time;
    cloudSpec.forEach((c, i) => {
      const a = c.a + time * 0.004;
      dummy.position.set(hx + Math.cos(a) * c.dist - Math.sin(a) * c.dx, c.y, hz + Math.sin(a) * c.dist + Math.cos(a) * c.dx);
      dummy.scale.set(c.s, c.s * 0.62, c.s * 0.8); dummy.updateMatrix(); puffs.setMatrixAt(i, dummy.matrix);
    });
    chimneySmoke?.(time);
    puffs.instanceMatrix.needsUpdate = true;
  }
  update(0);

  // ---- 烘焙光照：搭好的网格就是挡光的东西；窗洞和天窗保持通透；每个房间给一个“这里是空气”的种子点
  for (const st of storeys) for (const g of [st.shell, st.inner]) for (const m of g.children) vol.addMesh(m);
  for (const m of fixed) vol.addMesh(m);
  const seeds = [];
  for (const S of level.storeys) {
    for (const r of S.rooms) seeds.push([(r.minX + r.maxX) / 2, S.y + 1.5, (r.minZ + r.maxZ) / 2]);
    for (const w of S.windows) {
      const alongZ = typeof w.x === 'number', edge = alongZ ? w.x : w.z, a0 = w.at - w.w / 2 + 0.06, a1 = w.at + w.w / 2 - 0.06, y0 = S.y + (w.sill ?? 1.0) + 0.06, y1 = S.y + (w.head ?? 2.1) - 0.06;
      vol.carve(alongZ ? [edge - WT - 0.1, y0, a0] : [a0, y0, edge - WT - 0.1], alongZ ? [edge + WT + 0.1, y1, a1] : [a1, y1, edge + WT + 0.1]);
    }
    for (const q of holes(S)) vol.carve([q.minX, S.y + H - .1, q.minZ], [q.maxX, S.y + H + .5, q.maxZ]);
  }
  if (T0) for (let i = 0; i < T0.flights; i++) { seeds.push([T0.xA, i * SH + 1.6, (T0.mouthZ + T0.landingZ) / 2]); vol.carve([-0.55, i * SH + T0.rise + 1.0, T0.endZ - WT - 0.1], [0.55, i * SH + T0.rise + 2.0, T0.endZ + 0.1]); }
  for (const l of lampList) { seeds.push(l.p); vol.carve([l.p[0] - 0.3, l.p[1] - 0.3, l.p[2] - 0.3], [l.p[0] + 0.3, l.p[1] + 0.3, l.p[2] + 0.3]); }   // 灯罩不算挡光的东西
  vol.uniforms.uLvGain.value = TH.lightGain;
  // 调光用：换一组参数重新烘焙（挡光的格子不变）。o: skyGain, lampScale, lampColor, bounces, rays
  const rebake = (o = {}) => { const from = lightFromLook(cine.look, { skyGain: o.skyGain ?? TH.skyGain }); from.sun.bounce = o.sunBounce ?? TH.sunBounce; return vol.bake({ ...from, seeds, rays: o.rays ?? TH.lightRays ?? 48, bounces: o.bounces ?? TH.lightBounces, bleed: o.bleed ?? TH.lightBleed, ambient: o.ambient ?? TH.lightAmbient,
    lamps: lampList.map(l => ({ ...l, power: l.power * (o.lampScale ?? 1), color: o.lampColor ?? l.color })) }); };
  const bake = rebake();

  // 室外地面反上来的一点光（体积只管到房子周围两米多，再远的院子靠它）；只作用于见得到天的地方，屋里不受影响
  if (TH.bounce) root.add(new T.HemisphereLight(TH.bounce[0], TH.bounce[1], TH.bounce[2]));

  let floor = -1;
  // 玩家换层时：只画这一层和上下相邻两层的室内
  function setFloor(f) {
    if (f === floor) return;
    floor = f;
    storeys.forEach((s, i) => { s.inner.visible = Math.abs(i - f) <= 1; });
    cine.shadows.invalidate();
  }
  setFloor(0);
  // 给会动的东西（角色、手里的枪、掉落物）挂上同一份光照
  const light = (object) => { object.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) lit(m); }); return object; };

  const occlusion = createOcclusion(occluders, { enabled:!new URLSearchParams(globalThis.location?.search).has('nocull') });
  for (const floor of toyFloors) for (const prop of [...floor.children]) {
    let castsShadow = false, hasLight = false;
    prop.traverse(node => {
      if (node.isMesh && node.castShadow) castsShadow = true;
      if (node.isLight) hasLight = true;
    });
    // An off-screen light can still illuminate what is in view.
    if (hasLight) continue;
    // Moving toys and scenery must be kept out of the static sun map.
    if (castsShadow) cine.shadows.addDynamic(prop);
    occlusion.wrap(prop);
  }

  const pickups = new Map();
  const fabric = pickupFabric(lib);
  for (const p of level.pickups) { const m = light(pickupModel(p, weapons, variants, fabric)); pickups.set(p.id ?? pickups.size + 1, m); root.add(m); occlusion.wrap(m); }
  // 换枪以后，地上那一格变成放下的那把：重做它的模型和名牌
  const refreshPickup = (k) => {
    const old = pickups.get(k.id);
    if (old) {
      occlusion.forget(old);
      old.removeFromParent();
      const materials = new Set();
      old.traverse(o => {
        if (o.isMesh && !o.userData.sharedGeometry) o.geometry.dispose();
        if (o.isSprite) o.material.map?.dispose();
        if (o.isMesh || o.isSprite) for (const material of [].concat(o.material)) materials.add(material);
      });
      for (const material of materials) if (!material.userData.sharedPickupMaterial) material.dispose();
    }
    const m = light(pickupModel(k, weapons, variants, fabric)); pickups.set(k.id, m); root.add(m); occlusion.wrap(m); return m;
  };
  const all = []; root.traverse(o => { if (o.isMesh && o.geometry.attributes.aSky) all.push(o); });
  const tris = all.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
  return { root, storeys, pickups, refreshPickup, toys, eggProps, occlusion, volume: vol, light, rebake, lamps: lampList, theme: TH, update, setFloor, lib, stats: { tris, meshes: all.length, ...lib.stats(), bake } };
}
