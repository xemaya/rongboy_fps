import * as T from 'three';

// Skin batching keeps removed meshes in joint-local coordinates. Remaining
// meshes (including movable equipment) still follow their scene transforms.
export function forEachPartGeometry(actor, name, visit) {
  for (const geometry of actor.ground?.get(name) ?? []) visit(geometry);
  const part = actor.parts.get(name);
  part.updateWorldMatrix(true, true);
  const inverse = part.matrixWorld.clone().invert(), matrix = new T.Matrix4();
  part.traverse(mesh => {
    if (mesh.isMesh && !mesh.userData.fuzz) visit(mesh.geometry, matrix.multiplyMatrices(inverse, mesh.matrixWorld));
  });
}

export function measureArmProbe(actor, name) {
  const tip = new T.Vector3(), points = [];
  let L = 0;
  forEachPartGeometry(actor, name, (geometry, matrix) => {
    const positions = geometry.getAttribute('position');
    const stride = Math.max(1, Math.floor(positions.count / 800));
    for (let i = 0; i < positions.count; i += stride) {
      const point = new T.Vector3().fromBufferAttribute(positions, i);
      if (matrix) point.applyMatrix4(matrix);
      points.push(point);
      if (point.length() > L) { L = point.length(); tip.copy(point); }
    }
  });
  const axis = tip.normalize();
  let r = .02;
  for (const point of points) {
    const projection = point.dot(axis);
    if (projection > .55 * L) r = Math.max(r, Math.sqrt(Math.max(0, point.lengthSq() - projection * projection)));
  }
  r = Math.min(r, L * .45);
  return { r, L, points:[.45, .75, 1].map(t => axis.clone().multiplyScalar(Math.max(0, L - r) * t)) };
}
