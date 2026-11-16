"""Export V2 figurines with stable PBR palette, tiled micro-normal and native rig pivots.
No albedo/normal atlas bake: coloured UV bleeding cannot create facial dirt.
"""
import bpy,sys,math,json,random
from pathlib import Path
from mathutils import Vector,Matrix
kind=sys.argv[sys.argv.index('--')+1];ROOT=Path.cwd();OUT=ROOT/'assets/rongboy/runtime-v2';OUT.mkdir(parents=True,exist_ok=True);source=ROOT/'assets/rongboy'/f'{kind}-v2'/f'rongboy-{kind}-v2.blend'
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;scene.frame_set(1);col=bpy.data.collections['RONGBOY / Scout figurine' if kind=='scout' else 'RONGBOY / Walker figurine'];original=list(col.objects)
exports=bpy.data.collections.new('RUNTIME v2 / '+kind);scene.collection.children.link(exports);parts={}
if kind=='scout':
 for ob in list(scene.objects):
  if ob.name.startswith('CTRL / ') and not ob.name.startswith('CTRL / Walker'):
   e=bpy.data.objects.new(ob.name,None);exports.objects.link(e);e.matrix_world=ob.matrix_world.copy();e['part']=ob.name;parts[ob.name]=e
 for name,e in parts.items():
  ob=bpy.data.objects[name]
  if ob.parent and ob.parent.name in parts:
   world=e.matrix_world.copy();e.parent=parts[ob.parent.name];e.matrix_world=world
else:
 for name,position in {'Body':(0,0,.70),'Head':(0,-.015,1.25),'ArmL':(-.30,0,1.23),'ArmR':(.30,0,1.23),'LegL':(-.18,.02,.66),'LegR':(.18,.02,.66)}.items():
  e=bpy.data.objects.new(name,None);exports.objects.link(e);e.location=position;e['part']=name;parts[name]=e
bpy.context.view_layer.update();root=bpy.data.objects.new('ActorRoot',None);exports.objects.link(root);root['asset_version']='v2';root['palette_mode']='constant PBR colours; fine tiled normal'
for e in parts.values():
 if e.parent is None:world=e.matrix_world.copy();e.parent=root;e.matrix_world=world
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();meshes=[];hairs=[]
export_materials={}
def export_material(material):
 if material.name not in export_materials:
  m=material.copy();m.name='v2 / '+material.name;m.use_backface_culling=True
  bs=m.node_tree.nodes.get('Principled BSDF')
  if bs and 'Sheen Weight' in bs.inputs:
   weight=bs.inputs['Sheen Weight'].default_value;tint=bs.inputs['Sheen Tint'].default_value
   bs.inputs['Sheen Tint'].default_value=tuple(v*weight for v in tint[:3])+(1,);bs.inputs['Sheen Weight'].default_value=1
  export_materials[material.name]=m
 return export_materials[material.name]
def part_for(ob):
 if kind=='scout':
  p=ob.parent
  while p and not p.name.startswith('CTRL / '):p=p.parent
  return p.name if p else 'CTRL / body'
 return {'head':'Head','body':'Body','armL':'ArmL','armR':'ArmR','legL':'LegL','legR':'LegR'}.get(ob.get('rig_part'),'Body')
for ob in list(scene.objects):ob.select_set(False)
for ob in original:
 if ob.type not in {'MESH','CURVE'}:continue
 part=part_for(ob)
 if 'fine wool nap' in ob.name:hairs.append((ob,part));continue
 if ob.type=='CURVE':ob.data.resolution_u=3;ob.data.bevel_resolution=1
 me=bpy.data.meshes.new_from_object(ob.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
 if not me.vertices:continue
 for i,material in enumerate(list(me.materials)):
  if material:me.materials[i]=export_material(material)
 neo=bpy.data.objects.new(ob.name+' / v2 runtime',me);exports.objects.link(neo);neo.matrix_world=ob.matrix_world.copy();neo['part']=part
 bpy.context.view_layer.objects.active=neo;neo.select_set(True)
 if len(me.polygons)>900:
  mod=neo.modifiers.new('Bounded runtime surface','DECIMATE');mod.ratio=.40 if 'Head /' not in ob.name else .50;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Authored sphere/cube UVs are retained; only legacy UV-less curves receive local UVs.
 if not neo.data.uv_layers:
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
 neo.select_set(False);world=neo.matrix_world.copy();neo.parent=parts[part];neo.matrix_world=world;meshes.append(neo)
# Much finer silhouette hairs; low density fronts avoid the old long black pin appearance.
random.seed(91);hair_count=0;fuzz_mats={}
for ob,part in hairs:
 verts=[];faces=[];world=ob.matrix_world
 for i,sp in enumerate(ob.data.splines):
  if i%20:continue
  points=[world@Vector(pt.co[:3]) for pt in sp.points]
  if len(points)<2:continue
  a,b=points[0],points[-1];d=(b-a).normalized();side=d.cross(Vector((.2,.7,.3))).normalized()*.00032;other=d.cross(side).normalized()*.00032
  for off in [side,other]:
   j=len(verts);verts.extend([a-off,a+off,b]);faces.append((j,j+1,j+2))
  hair_count+=1
 if not verts:continue
 me=bpy.data.meshes.new('Short silhouette wool');me.from_pydata(verts,[],faces);me.update();neo=bpy.data.objects.new('fuzz / '+ob.name,me);exports.objects.link(neo);neo['fuzz']=True
 base=ob.data.materials[0]
 if base.name not in fuzz_mats:
  mat=bpy.data.materials.new('fuzz / '+base.name);mat.diffuse_color=base.diffuse_color;mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=base.diffuse_color;bs.inputs['Roughness'].default_value=1;fuzz_mats[base.name]=mat
 me.materials.append(fuzz_mats[base.name]);neo.parent=parts[part];neo.matrix_world=Matrix.Identity(4);meshes.append(neo)
for ob in list(scene.objects):ob.select_set(False)
for name,e in parts.items():
 group=[ob for ob in list(exports.objects) if ob.type=='MESH' and ob.parent==e and not ob.get('fuzz')]
 if not group:continue
 for ob in group:ob.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();bpy.context.object.name='Mesh / '+name
 for ob in list(bpy.context.selected_objects):ob.select_set(False)
for ob in exports.objects:ob.select_set(True);ob.hide_render=False
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/(kind+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_yup=True)
manifest={'source':str(source.relative_to(ROOT)),'version':'v2','colour_mode':'constant PBR factors, vertex-colour batching in runtime','normal':'256px tile; no albedo atlas','sampled_wool_fibers':hair_count,'polygons':sum(len(ob.data.polygons) for ob in exports.objects if ob.type=='MESH'),'parts':list(parts),'file_bytes':(OUT/(kind+'.glb')).stat().st_size}
(OUT/(kind+'-export.json')).write_text(json.dumps(manifest,indent=2));print('EXPORT_CLEAN_DONE',kind,flush=True)
