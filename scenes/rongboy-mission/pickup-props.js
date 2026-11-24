import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWoolBall } from '../../library/games/rongboy-runtime.js';
import { fuzzy, registerPlush } from '../../cine-engine/library/surfaces/plush.js';

export function pickupFabric(lib) {
  registerPlush(lib);
  return (color, surface = 'felt') => {
    const material = lib.get(surface, { color, triplanar:.54 });
    material.userData.sharedPickupMaterial = true;
    return fuzzy(material, surface === 'felt' ? .44 : 0);
  };
}

function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const part = new T.Mesh(geometry, material);
  part.position.set(x, y, z);
  group.add(part);
  return part;
}

function roundedOutline(width, height, radius) {
  const x = width / 2, y = height / 2, shape = new T.Shape();
  shape.moveTo(-x + radius, -y).lineTo(x - radius, -y).quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius).quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y).quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius).quadraticCurveTo(-x, -y, -x + radius, -y);
  return shape;
}

function stitchedPaths(group, material, paths, radius = .005) {
  const geometry = [], up = new T.Vector3(0, 1, 0), axis = new T.Vector3(), rotation = new T.Quaternion();
  for (const points of paths) for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    axis.subVectors(b, a);
    const length = axis.length();
    if (length < radius * 2) continue;
    rotation.setFromUnitVectors(up, axis.normalize());
    geometry.push(new T.CapsuleGeometry(radius, Math.max(.002, length * .62 - 2 * radius), 2, 5)
      .applyQuaternion(rotation)
      .translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2));
  }
  mesh(group, mergeGeometries(geometry), material);
  for (const stitch of geometry) stitch.dispose();
}

// 血瓶：毛毡缝的圆肚小瓶。沿用原来补血道具的定妆（珊瑚红的身子、米色布贴、米色缝线），布贴上缝一颗小红心，一眼还认得出是补血的。
export function feltPotion(group, fabric) {
  const red = fabric(0xda5946), thread = fabric(0xeab380), patch = fabric(0xf0dab6), cork = fabric(0xbf8a54, 'toy_wood');
  // 瓶身的剖面（半径、高）：圆肚、收肩、短颈、翻边的瓶口
  const side = [[0, -.225], [.095, -.225], [.142, -.196], [.166, -.12], [.160, -.03], [.124, .045], [.070, .092], [.056, .135], [.074, .150], [.074, .172], [0, .172]];
  mesh(group, new T.LatheGeometry(side.map(([r, y]) => new T.Vector2(r, y)), 22), red);
  mesh(group, new T.CylinderGeometry(.050, .042, .075, 14), cork, 0, .205);
  // 肚子上一圈布贴，上下各一道缝线
  const band = [[.150, -.168], [.170, -.12], [.166, -.045], [.150, -.012]];
  mesh(group, new T.LatheGeometry(band.map(([r, y]) => new T.Vector2(r, y)), 22), patch);
  const ring = (r, y) => Array.from({ length: 23 }, (_, i) => new T.Vector3(Math.sin(i / 22 * Math.PI * 2) * r, y, Math.cos(i / 22 * Math.PI * 2) * r));
  stitchedPaths(group, thread, [ring(.158, -.158), ring(.163, -.026), ring(.079, .161)], .0055);
  // 前后各一颗小红心
  const heart = new T.Shape();
  heart.moveTo(0, -.22);
  heart.bezierCurveTo(-.11, -.14, -.28, -.035, -.25, .105);
  heart.bezierCurveTo(-.234, .225, -.08, .248, 0, .122);
  heart.bezierCurveTo(.08, .248, .234, .225, .25, .105);
  heart.bezierCurveTo(.28, -.035, .11, -.14, 0, -.22);
  const badge = () => new T.ExtrudeGeometry(heart, { depth: .05, bevelEnabled: true, bevelThickness: .03, bevelSize: .02, bevelSegments: 2, curveSegments: 8 }).scale(.24, .24, .24).translate(0, -.092, .163);
  const front = badge(), back = badge().rotateY(Math.PI), both = mergeGeometries([front, back]);
  mesh(group, both, red);
  front.dispose(); back.dispose();
}

export function ammoPouch(group, fabric) {
  const felt = fabric(0x536b65), lining = fabric(0xb29c7b), stitching = fabric(0xe8ce9d);
  const yarn = fabric(0xead4b0), wood = fabric(0xbf8a54, 'toy_wood'), bore = fabric(0x765b40, 'toy_wood');
  const brass = new T.MeshStandardMaterial({ color:0xc29455, roughness:.41, metalness:.45 });

  const rim = roundedOutline(.52, .32, .061);
  rim.holes.push(roundedOutline(.450, .254, .050));
  const box = new T.ExtrudeGeometry(rim, {
    depth:.163, bevelThickness:.012, bevelSize:.009, bevelSegments:2, curveSegments:5,
  }).rotateX(-Math.PI / 2);
  mesh(group, box, felt, 0, -.167);
  mesh(group, new RoundedBoxGeometry(.517, .045, .317, 2, .032), felt, 0, -.177);
  mesh(group, new RoundedBoxGeometry(.440, .022, .247, 2, .010), lining, 0, -.141);
  stitchedPaths(group, stitching, [
    roundedOutline(.537, .336, .061).getSpacedPoints(29).map(p => new T.Vector3(p.x, -.016, -p.y)),
    roundedOutline(.537, .336, .061).getSpacedPoints(29).map(p => new T.Vector3(p.x, -.139, -p.y)),
  ]);
  mesh(group, new T.TorusGeometry(.041, .007, 6, 24), brass, 0, -.075, .171);
  mesh(group, new T.SphereGeometry(.035, 14, 10), brass, 0, -.075, .174).scale.set(1, 1, .40);

  const lid = new T.Group();
  lid.position.set(0, -.006, -.145);
  lid.rotation.x = -.43;
  group.add(lid);
  mesh(lid, new RoundedBoxGeometry(.531, .270, .055, 3, .027), felt, 0, .124);
  mesh(lid, new RoundedBoxGeometry(.463, .206, .016, 2, .008), lining, 0, .125, .025);
  stitchedPaths(lid, stitching, [
    roundedOutline(.496, .239, .037).getSpacedPoints(32).map(p => new T.Vector3(p.x, p.y + .124, .026)),
    roundedOutline(.496, .239, .037).getSpacedPoints(32).map(p => new T.Vector3(p.x, p.y + .124, -.027)),
  ]);
  for (const x of [-.166, .166]) {
    const hinge = mesh(group, new RoundedBoxGeometry(.051, .084, .037, 2, .016), lining, x, .001, -.139);
    hinge.rotation.x = -.54;
  }

  const wraps = [];
  for (const x of [-.153, 0, .153]) {
    mesh(group, new T.CylinderGeometry(.053, .053, .202, 16), yarn, x, .007, .013);
    for (const offset of [-.106, .110])
      mesh(group, new T.CylinderGeometry(.066, .066, .025, 18), wood, x, .007 + offset, .013);
    mesh(group, new T.CylinderGeometry(.019, .019, .001, 12), bore, x, .130, .013);
    for (let i = 0; i < 9; i++) {
      const y = -.077 + i * .018;
      wraps.push(new T.TorusGeometry(.052 + .002 * (i & 1), .0046, 4, 16)
        .rotateX(Math.PI / 2).rotateZ((i & 1 ? -1 : 1) * .045).translate(x, y, .013));
    }
  }
  mesh(group, mergeGeometries(wraps), yarn);
  for (const wrap of wraps) wrap.dispose();
}

export function yarnBasket(group, fabric) {
  const mustard = fabric(0xcd8629), collar = fabric(0xda973a);
  const blue = fabric(0x526477), thread = fabric(0xe7bb71);
  const profile = [[0,-.230],[.195,-.230],[.222,-.220],[.238,-.199],[.244,-.171],[.264,.067],
    [.268,.095],[.261,.109],[.237,.109],[.228,.074],[.215,-.158],[0,-.168]];
  mesh(group, new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 36), mustard);
  mesh(group, new T.TorusGeometry(.250, .028, 8, 36), collar, 0, .097).rotation.x = Math.PI / 2;

  const path = (radius, count, height) => Array.from({length:count + 1}, (_, i) => {
    const a = i * Math.PI * 2 / count;
    return new T.Vector3(Math.cos(a) * radius, height, Math.sin(a) * radius);
  });
  stitchedPaths(group, thread, [path(.244, 32, -.173), path(.276, 28, .086)], .0058);

  const handle = new T.Shape();
  handle.moveTo(-.094, -.056).bezierCurveTo(-.132,.094,-.082,.161,-.008,.166);
  handle.bezierCurveTo(.075,.160,.109,.092,.103,-.059).lineTo(.056,-.059);
  handle.bezierCurveTo(.063,.054,.050,.111,-.009,.116).bezierCurveTo(-.052,.109,-.069,.064,-.044,-.056);
  handle.closePath();
  for (const side of [-1, 1]) {
    // Anchor both ends to the outside of the rim. The front tab covers the seam.
    const front = new T.Vector2(side * .179, .181), back = new T.Vector2(side * .252, .042);
    const carry = new T.Group();
    carry.position.set((front.x + back.x) / 2, .061, (front.y + back.y) / 2);
    carry.rotation.y = -Math.atan2(back.y - front.y, back.x - front.x);
    group.add(carry);
    const strap = new T.ExtrudeGeometry(handle, {
      depth:.052, bevelThickness:.010, bevelSize:.008, bevelSegments:2, curveSegments:8,
    }).translate(0, 0, -.026);
    mesh(carry, strap, blue);
    const patch = new T.Group();
    patch.position.set(front.x * 1.025, .008, front.y * 1.025);
    patch.rotation.y = Math.atan2(front.x, front.y);
    group.add(patch);
    mesh(patch, new RoundedBoxGeometry(.079, .106, .027, 2, .011), blue);
    stitchedPaths(patch, thread, [
      [new T.Vector3(-.024,-.030,.015), new T.Vector3(.024,.030,.015)],
      [new T.Vector3(.024,-.030,.016), new T.Vector3(-.024,.030,.016)],
    ], .0045);
  }
  for (const [x, y, z, radius, color, turn] of [
    [-.113,.125,.077,.121,0xefb142,-.3],
    [.112,.149,.070,.120,0xe68689,1],
    [.008,.193,-.106,.133,0x5b9384,2.5],
  ]) {
    const wool = createWoolBall();
    wool.position.set(x, y, z);
    wool.scale.setScalar(radius);
    wool.rotation.set(.25, turn, -.2);
    wool.traverse(part => { if (part.isMesh) part.material.color.setHex(color); });
    group.add(wool);
  }
}

export function displayedWeapon(group, source) {
  const model = new T.Group();
  source.updateWorldMatrix(true, true);
  const inverse = new T.Matrix4().copy(source.matrixWorld).invert(), local = new T.Matrix4();
  source.traverse(part => {
    if (!part.isMesh) return;
    const material = Array.isArray(part.material) ? part.material.map(m => m.clone()) : part.material.clone();
    const display = mesh(model, part.geometry, material);
    local.multiplyMatrices(inverse, part.matrixWorld).decompose(display.position, display.quaternion, display.scale);
    display.userData.sharedGeometry = true;
  });
  model.rotation.y = Math.PI * .35;
  const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
  const scale = .57 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  model.position.copy(bounds.getCenter(new T.Vector3())).multiplyScalar(-scale);
  group.add(model);
}
