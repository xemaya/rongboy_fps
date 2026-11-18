import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];src=Path(args[0]).resolve();out=Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
catalog=json.loads((src/'catalog.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(src/catalog['source']))
specs=catalog['models'];scene=bpy.context.scene;cam=scene.camera
scene.render.resolution_x=600 if '--same-scale' in args else 480;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
# Match the game's fine-fibre finish: the normal texture alpha stores neutral fibre luminance.
for m in bpy.data.materials:
 if not m.use_nodes:continue
 bs=m.node_tree.nodes.get('Principled BSDF')
 tx=next((n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.size[0]>=512),None)
 if not bs or not tx:continue
 base=tuple(bs.inputs['Base Color'].default_value);mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=base;add=m.node_tree.nodes.new('ShaderNodeMath');add.operation='ADD';add.inputs[1].default_value=.65 if m.get('rongboy_felt_finish')==2 else 0;m.node_tree.links.new(tx.outputs['Alpha'],add.inputs[0]);m.node_tree.links.new(add.outputs[0],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])

for spec in specs:
 for other in specs:
  for ob in bpy.data.collections['RONGBOY / '+other['id']].objects:ob.hide_render=other['id']!=spec['id']
 col=bpy.data.collections['RONGBOY / '+spec['id']];actor=next(o for o in col.objects if o.get('zombieType'));actor.location=(0,0,0)
 parts={o.get('part'):o for o in col.objects if o.get('part') and o.type=='EMPTY'}
 for name in ['ArmL','ArmR']:
  if name in parts:
   offset={'heavy':-.18,'boss-warden':-.50,'crawler':0,'shielded':(0 if name=='ArmL' else -.15),'bomber':(-.15 if name=='ArmL' else -.85),'archer':(-1.14 if name=='ArmL' else -1.0),'leaper':-.70,'boss-leech':-.55}.get(spec['id'],-.20);parts[name].rotation_mode='XYZ';parts[name].rotation_euler.x=offset
 bpy.context.view_layer.update()
 if spec['id']=='archer':
  mechanisms={o.get('mechanism'):o for o in col.objects if o.get('mechanism')};mechanisms['bowMount'].rotation_euler.x=1.14;nock=mechanisms['bowNock'];nock.location=nock.location.lerp(mechanisms['bowBack'].location,.35);bpy.context.view_layer.update();hand=mechanisms['drawHand'];right=parts['ArmR'];desired=right.parent.matrix_world.inverted()@nock.matrix_world.translation-right.location;base=hand.location;scale=right.scale.copy();right.rotation_mode='QUATERNION';right.rotation_quaternion=base.normalized().rotation_difference(desired.normalized());right.scale=scale*max(.85,min(1.35,desired.length/(base.length*scale.x)));mechanisms['heldArrow'].location=nock.location;bpy.context.view_layer.update()
  curve=next(o for o in mechanisms['nativeString'].children if o.type=='CURVE');inv=curve.matrix_world.inverted()
  for bp,name in zip(curve.data.splines[0].bezier_points,['bowLower','bowNock','bowUpper']):bp.co=inv@mechanisms[name].matrix_world.translation;bp.handle_left_type=bp.handle_right_type='VECTOR'
 bpy.context.view_layer.update();coords=[o.matrix_world@Vector(c) for o in col.objects if o.type in {'MESH','CURVE'} for c in o.bound_box];lo=Vector(tuple(min(p[i] for p in coords) for i in range(3)));hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)));target=(lo+hi)*.5
 cam.data.type='ORTHO';cam.data.ortho_scale=max((hi.z-lo.z)*1.08,max(hi.x-lo.x,hi.y-lo.y)*1.08/(480/900));dist=max(5,(hi.z-lo.z)*3)
 if '--same-scale' in args:
  target=Vector((0,0,1.19));cam.data.ortho_scale=2.55
 for label,a in [('front',0),('side',90),('back',180)]:
  a=math.radians(a);cam.location=target+Vector((math.sin(a)*dist,-math.cos(a)*dist,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'{spec["id"]}-{label}.png');bpy.ops.render.render(write_still=True)
 print('VIEWS_DONE',spec['id'],flush=True)
print('ALL_VIEWS_DONE',len(specs),flush=True)
