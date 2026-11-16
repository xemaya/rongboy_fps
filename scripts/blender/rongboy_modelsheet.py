"""Native counterpart to tools/modelsheet.sh: four views, silhouettes, same source mesh.
blender -b --python scripts/blender/rongboy_modelsheet.py -- v4 /tmp/rongboy-v4-sheets
Compose the transparent frames with any contact-sheet utility; no game code is sampled.
"""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];version=args[0];out=Path(args[1]);out.mkdir(parents=True,exist_ok=True);root=Path.cwd();asset=root/'assets/rongboy'/('zombies-'+version)
bpy.ops.wm.open_mainfile(filepath=str(asset/('rongboy-zombie-roster-'+version+'.blend')))
specs=json.loads((asset/'catalog.json').read_text())['models'];scene=bpy.context.scene;camera=scene.camera
scene.render.resolution_x=240;scene.render.resolution_y=300;scene.render.resolution_percentage=100;scene.cycles.samples=8;scene.render.film_transparent=True
for ob in bpy.data.collections['STUDIO / roster review only'].objects:
    if ob.type=='MESH':ob.hide_render=True
black=bpy.data.materials.new('Sheet / silhouette');black.use_nodes=True;n=black.node_tree.nodes;n.clear();em=n.new('ShaderNodeEmission');em.inputs['Color'].default_value=(0,0,0,1);output=n.new('ShaderNodeOutputMaterial');black.node_tree.links.new(em.outputs[0],output.inputs[0])
for spec in specs:
    for other in specs:
        for ob in bpy.data.collections['RONGBOY / '+other['id']].objects:ob.hide_render=other['id']!=spec['id']
    actor=next(o for o in bpy.data.collections['RONGBOY / '+spec['id']].objects if o.get('zombieType'));actor.location=(0,0,0)
    height=(spec['height']+.017)/.78
    bpy.context.view_layer.update();coords=[o.matrix_world@Vector(corner) for o in bpy.data.collections['RONGBOY / '+spec['id']].objects if o.type in {'MESH','CURVE'} for corner in o.bound_box];width=max(p.x for p in coords)-min(p.x for p in coords);depth=max(p.y for p in coords)-min(p.y for p in coords)
    camera.data.ortho_scale=max(height*1.22,max(width,depth)*1.22/(240/300));target=Vector((0,0,height*.50));distance=height*3
    for silhouette in [False,True]:
        scene.view_layers[0].material_override=black if silhouette else None
        for angle in [0,35,90,180]:
            a=math.radians(angle);camera.location=(math.sin(a)*distance,-math.cos(a)*distance,height*.60);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(out/(spec['id']+('-sil-' if silhouette else '-colour-')+str(angle)+'.png'));bpy.ops.render.render(write_still=True)
    print('SHEET_DONE',spec['id'],flush=True)
print('SHEETS_COMPLETE',len(specs),flush=True)
