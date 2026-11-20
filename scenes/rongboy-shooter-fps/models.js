// Actual native figurine meshes: clean V2 hero and the seven walker-family roles and two independent boss zombie models.
// These are the reduced copies made by scripts/optimize-models.mjs (a zombie: about 85,000 body triangles down to
// about 17,000; fuzz untouched). The gallery pages load the full-detail originals from assets/rongboy/zombies-v7 and
// runtime-v2. After re-exporting a figurine from Blender, run `node scripts/optimize-models.mjs`.
import scout from '../../assets/rongboy/game/scout.glb';
import zombies from '../../assets/rongboy/game/zombie-roster.glb';
export default {scout,zombies};
