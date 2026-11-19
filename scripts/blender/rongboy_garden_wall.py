"""Pack the accepted walker and kite-shield assets for the A/B garden."""
from pathlib import Path
import bpy

root = Path.cwd()/'assets/rongboy'
bpy.ops.wm.open_mainfile(filepath=str(root/'walker-trio/walker-trio.blend'))
walker = bpy.data.collections['RONGBOY / walker']
with bpy.data.libraries.load(str(root/'second-trio/second-trio.blend'), link=False) as (src, dst):
    dst.collections = ['RONGBOY / shielded']
shield = dst.collections[0]
bpy.context.scene.collection.children.link(shield)
bpy.ops.object.select_all(action='DESELECT')
for collection in (walker, shield):
    for item in collection.objects:
        item.select_set(True)
out = root/'garden-wall'
out.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out/'garden-wall.glb'), export_format='GLB',
                          use_selection=True,export_apply=True,export_animations=False,export_extras=True)
