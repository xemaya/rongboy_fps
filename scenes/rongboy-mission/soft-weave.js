import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { woolMaterial } from '../../library/games/rongboy-runtime.js';

function yarn(color, glow, intensity) {
  const material = woolMaterial(color);
  material.emissive.setHex(glow);
  material.emissiveIntensity = intensity;
  return material;
}

function tube(points, thickness, segments = 9) {
  return new T.TubeGeometry(new T.CatmullRomCurve3(points), segments, thickness, 6);
}

function pointOnWeave(u, v, ground) {
  // Map the outer weave to a round edge so the lines end in knots, without square corners.
  const x = u * Math.sqrt(1 - v * v * .5), y = v * Math.sqrt(1 - u * u * .5);
  const radius = Math.hypot(x, y);
  const noise = Math.sin(u * 4.1 + v * 6.2) * Math.cos(v * 5.4 - u * 2.3);
  const angle = ground ? .51 : .63;
  const sway = .032 * noise;
  const curl = Math.sin(u * 3.8 + v * 2.5) * Math.sin(v * 3.1 - u);
  return new T.Vector3(
    (x * Math.cos(angle) - y * Math.sin(angle)) * (1 + .09 * noise) + sway,
    (x * Math.sin(angle) + y * Math.cos(angle)) * (.88 + .10 * curl) - sway,
    ground ? .004 + .016 * (curl + 1) : -.25 * (1 - radius * radius) + .112 * curl,
  );
}

function addMorphs(geometry, ground) {
  const positions = geometry.getAttribute('position');
  const fold = new Float32Array(positions.count * 3);
  const ripple = new Float32Array(fold.length);
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), base = index * 3;
    const edge = Math.min(1, Math.hypot(x, y));
    if (ground) {
      fold[base + 2] = .12 * (1 - edge) + .035 * Math.sin(8 * x + 5 * y) * edge;
      ripple[base + 2] = .02 * (1 + Math.sin(10 * x - 6 * y)) * edge;
    } else {
      fold[base] = -.27 * x;
      fold[base + 1] = -.22 * y;
      fold[base + 2] = .25 * Math.sin(x * 9 + y * 1.7);
      ripple[base + 2] = .13 * Math.sin(x * 7 + y * 4.3);
    }
  }
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new T.BufferAttribute(fold, 3), new T.BufferAttribute(ripple, 3)];
  return geometry;
}

export function makeSoftWeave(ground) {
  const group = new T.Group(), fibres = [], details = [];
  const warp = [-1, -.74, -.39, -.04, .36, .67, 1];
  const weft = [-1, -.69, -.34, .02, .33, .74, 1];
  const nodes = warp.map(u => weft.map(v => pointOnWeave(u, v, ground)));
  const thickness = ground ? .0095 : .013;
  const width = nodes.length - 1;

  function span(from, to, index, along) {
    const wave = Math.sin(index * 2.83 + along);
    const low = from.clone().lerp(to, .36);
    low.y -= (ground ? .023 : .047) * (.8 + wave * .2);
    low.z += ground ? .008 + Math.abs(wave) * .012 : -.045 - .028 * wave;
    const high = from.clone().lerp(to, .75);
    high.y += (ground ? .018 : .020) * wave;
    high.z += ground ? .008 : .03 * wave;
    const radius = thickness * (1 + .19 * wave);
    const strand = new T.CatmullRomCurve3([from, low, high, to]);
    fibres.push(new T.TubeGeometry(strand, 11, radius, 6));
    // Twist a thinner ply round the main cord. Both ends stay tied to their knots.
    const side = new T.Vector2(from.y - to.y, to.x - from.x).normalize();
    const twist = Array.from({ length: 17 }, (_, step) => {
      const t = step / 16, turn = t * Math.PI * 6 + index;
      const point = strand.getPoint(t), offset = radius * .77 * Math.sin(turn) * Math.sin(t * Math.PI);
      point.x += side.x * offset; point.y += side.y * offset;
      point.z += radius * .8 * Math.cos(turn) * Math.sin(t * Math.PI);
      return point;
    });
    details.push(tube(twist, radius * .44, 16));
  }

  for (let row = 0; row <= width; row++) for (let col = 0; col <= width; col++) {
    const at = nodes[row][col], index = row * nodes.length + col;
    if (row < width) span(at, nodes[row + 1][col], index, 0);
    if (col < width) span(at, nodes[row][col + 1], index, 1.5);
    const knot = new T.SphereGeometry(thickness * (1.24 + .36 * Math.sin(index * 2.95)), 7, 5);
    knot.scale(1, 1.15, .83).translate(at.x, at.y, at.z);
    details.push(knot);
    if ((row === 0 || col === 0 || row === width || col === width) && index % 3 === 0) {
      const bend = at.clone().multiplyScalar(1.046);
      const end = at.clone().multiplyScalar(1.102);
      bend.y += .04;
      end.x += .045 * Math.sin(index);
      end.y -= .028;
      end.z += ground ? .015 : -.083;
      fibres.push(tube([at, bend, end], thickness * .52, 6));
    }
  }

  const colour = ground ? [0xb398c3, 0xe1c9db, 0xa982c0] : [0x459aa9, 0xa2e6e6, 0x80d7e7];
  for (const [parts, tint, glow] of [
    [fibres, colour[0], ground ? .11 : .33],
    [details, colour[1], ground ? .13 : .59],
  ]) {
    const geometry = addMorphs(mergeGeometries(parts), ground);
    for (const part of parts) part.dispose();
    const material = yarn(tint, colour[2], glow);
    material.transparent = true;
    material.depthWrite = false;
    group.add(new T.Mesh(geometry, material));
  }
  if (ground) group.rotation.x = -Math.PI / 2;
  return group;
}

export function makeAnkleTangle() {
  const group = new T.Group();
  const material = yarn(0xbe9fcb, 0xba8fc7, .12);
  for (const [layer, radius] of [[0, 1.18], [1, 1.13], [2, 1.17]]) {
    const points = Array.from({ length: 15 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2 + layer * 1.52;
      const wobble = radius + Math.sin(angle * 3 + layer) * .085;
      return new T.Vector3(Math.sin(angle) * wobble,
        .26 + layer * .15 + Math.sin(angle * 2 + layer) * .074,
        Math.cos(angle) * wobble);
    });
    group.add(new T.Mesh(tube(points, .020, 36), material));
  }
  return group;
}
