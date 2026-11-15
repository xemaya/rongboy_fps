"""Bake the authored figurine materials and export actual native meshes to GLB.
Original .blend files are read-only. Hair is sampled for a bounded real-time silhouette.
"""
import bpy,os,sys,math,json,random
from mathutils import Vector
ROOT=os.path.abspath('.');OUT=ROOT+'/assets/rongboy/runtime';os.makedirs(OUT,exist_ok=True)
kind=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'scout'
source='assets/rongboy/scout-motion-v1/rongboy-scout-motion-v1.blend' if kind=='scout' else 'assets/rongboy/walker-v1/rongboy-walker-v1.blend'
bpy.ops.wm.open_mainfile(filepath=ROOT+'/'+source);scene=bpy.context.scene;scene.frame_set(1)
collection=bpy.data.collections['RONGBOY / Scout figurine' if kind=='scout' else 'RONGBOY / Walker figurine'];original=list(collection.objects)
# Reset the scout's existing animation to its authored construction pose.
if kind=='scout':
 rest={'CTRL / ground motion':(0,0,0),'CTRL / body':(0,0,.73),'CTRL / head':(0,-.025,1.23),'CTRL / hat':(0,0,1.88),'CTRL / backpack':(0,.30,1.05)}
 for s in [-1,1]:
  rest['CTRL / arm '+str(s)]=(s*.31,0,1.14);rest['CTRL / leg '+str(s)]=(s*.205,.025,.67);rest['CTRL / boot '+str(s)]=(s*.205,.02,.24)
 for n,pos in rest.items():
  ob=bpy.data.objects[n];ob.animation_data_clear();ob.location=pos;ob.rotation_euler=(0,0,0);ob.scale=(1,1,1)
bpy.context.view_layer.update()
exports=bpy.data.collections.new('RUNTIME / '+kind);scene.collection.children.link(exports)
parts={};part_mats={};meshes=[];hairs=[]
# Preserve the original controller hierarchy. Node names are consumed by the runtime animation adapter.
def part_for(ob):
 if kind=='scout':
  p=ob.parent
  while p and not p.name.startswith('CTRL /'):p=p.parent
  return p.name if p else 'CTRL / body'
 return {'head':'Head','body':'Body','armL':'ArmL','armR':'ArmR','legL':'LegL','legR':'LegR'}.get(ob.get('rig_part'),'Body')
if kind=='scout':
 for n in rest:
  p=bpy.data.objects[n];e=bpy.data.objects.new(n,None);exports.objects.link(e);e.matrix_world=p.matrix_world.copy();e['part']=n;parts[n]=e
 for n in rest:
  src=bpy.data.objects[n];e=parts[n]
  if src.parent and src.parent.name in parts:
   w=e.matrix_world.copy();e.parent=parts[src.parent.name];e.matrix_world=w
else:
 for n,loc in {'Body':(0,0,.70),'Head':(0,-.015,1.25),'ArmL':(-.30,0,1.23),'ArmR':(.30,0,1.23),'LegL':(-.18,.02,.66),'LegR':(.18,.02,.66)}.items():
  e=bpy.data.objects.new(n,None);exports.objects.link(e);e.location=loc;e['part']=n;parts[n]=e
bpy.context.view_layer.update() # Ensure new walker pivots have evaluated world matrices before parenting.
root=bpy.data.objects.new('ActorRoot',None);exports.objects.link(root)
for e in list(parts.values()):
 if e.parent is None:w=e.matrix_world.copy();e.parent=root;e.matrix_world=w
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
# Material copies preserve procedural colors during baking without touching source materials.
matmap={}
def copied(m):
 if m.name not in matmap:matmap[m.name]=m.copy();matmap[m.name].name=kind+' / baked / '+m.name
 return matmap[m.name]
for ob in original:
 if ob.type not in {'MESH','CURVE'}:continue
 part=part_for(ob)
 if 'fine wool nap' in ob.name:
  hairs.append((ob,part));continue
 if ob.type=='CURVE':ob.data.resolution_u=2;ob.data.bevel_resolution=0
 ev=ob.evaluated_get(dg);me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=dg)
 if not me.vertices:continue
 neo=bpy.data.objects.new(ob.name+' / runtime',me);exports.objects.link(neo);neo.matrix_world=ob.matrix_world.copy();neo['part']=part
 for i,m in enumerate(list(neo.data.materials)):
  if m:neo.data.materials[i]=copied(m)
 bpy.context.view_layer.objects.active=neo;neo.select_set(True)
 if len(me.polygons)>900:
  mod=neo.modifiers.new('Runtime surface budget','DECIMATE');mod.ratio=.40;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 neo.select_set(False);meshes.append(neo)
# Hide the source scene during baking. Only copies participate in bake and export.
for ob in list(scene.objects):
 ob.select_set(False)
 if ob not in meshes and ob not in parts.values() and ob!=root:ob.hide_render=True
for ob in meshes:ob.hide_render=False;ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
# One packed UV atlas shared by all selected mesh parts.
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.004,area_weight=.5,correct_aspect=True,scale_to_bounds=False);bpy.ops.object.mode_set(mode='OBJECT')
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.max_bounces=2;scene.render.bake.use_selected_to_active=False;scene.render.bake.margin=4
images={}
for channel in ['color','normal']:
 image=bpy.data.images.new(kind+' '+channel,width=1024,height=1024,alpha=False);image.colorspace_settings.name='sRGB' if channel=='color' else 'Non-Color';images[channel]=image
 for mat in matmap.values():
  node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
  for n in mat.node_tree.nodes:n.select=n==node
 print('BAKE_START',kind,channel,flush=True)
 if channel=='color':bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},use_clear=False)
 else:bpy.ops.object.bake(type='NORMAL',use_clear=False)
 image.filepath_raw=OUT+'/'+kind+'-'+channel+'.png';image.file_format='PNG';image.save();print('BAKE_DONE',kind,channel,flush=True)
# glTF PBR textures use the actual baked color and micro-surface response.
for mat in matmap.values():
 rough=mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value;sheen=mat.node_tree.nodes.get('Principled BSDF').inputs['Sheen Weight'].default_value;metal=mat.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value
 nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');bs=nodes.new('ShaderNodeBsdfPrincipled');bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;bs.inputs['Sheen Weight'].default_value=sheen;mat.node_tree.links.new(bs.outputs['BSDF'],out.inputs['Surface'])
 tex=nodes.new('ShaderNodeTexImage');tex.image=images['color'];mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);nt=nodes.new('ShaderNodeTexImage');nt.image=images['normal'];normal=nodes.new('ShaderNodeNormalMap');mat.node_tree.links.new(nt.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
# Attach every evaluated mesh to its correct controller at the same world transform.
for ob in meshes:
 w=ob.matrix_world.copy();ob.parent=parts[ob['part']];ob.matrix_world=w
# Sample the original wool geometry; use a small triangular cross-section per fiber.
random.seed(91);hair_count=0
for ob,part in hairs:
 verts=[];faces=[];mw=ob.matrix_world
 for i,sp in enumerate(ob.data.splines):
  if i%20:continue
  pp=[mw@Vector(pt.co[:3]) for pt in sp.points]
  if len(pp)<2:continue
  a,b=pp[0],pp[-1];d=(b-a).normalized();side=d.cross(Vector((.2,.7,.3))).normalized()*.0008;other=d.cross(side).normalized()*.0008
  for off in [side,other]:
   ix=len(verts);verts.extend([a-off,a+off,b]);faces.append((ix,ix+1,ix+2))
  hair_count+=1
 if not verts:continue
 me=bpy.data.meshes.new('Silhouette wool');me.from_pydata(verts,[],faces);me.update();neo=bpy.data.objects.new('fuzz / '+ob.name,me);exports.objects.link(neo);neo['fuzz']=True
 mat=bpy.data.materials.new('fuzz / '+ob.data.materials[0].name);mat.diffuse_color=ob.data.materials[0].diffuse_color;mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=mat.diffuse_color;bs.inputs['Roughness'].default_value=1;me.materials.append(mat)
 neo.parent=parts[part];neo.matrix_world=__import__('mathutils').Matrix.Identity(4);meshes.append(neo)
# Merge by controller and material for a bounded draw-call budget, preserving UV atlas.
for ob in list(scene.objects):ob.select_set(False)
merged=[]
for part,e in parts.items():
 group=[q for q in list(exports.objects) if q.type=='MESH' and q.parent==e and not q.get('fuzz')]
 if not group:continue
 for q in group:q.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();ob=bpy.context.object;ob.name='Mesh / '+part;merged.append(ob)
 for q in list(bpy.context.selected_objects):q.select_set(False)
# Export only the authored actor copy, excluding studio and unneeded original controls.
for ob in exports.objects:ob.select_set(True);ob.hide_render=False
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=OUT+'/'+kind+'.glb',export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True)
triangles=sum(len(ob.data.polygons) for ob in exports.objects if ob.type=='MESH')
with open(OUT+'/'+kind+'-export.json','w') as h:json.dump({'source':source,'format':'GLB','atlas':1024,'sampled_wool_fibers':hair_count,'polygons':triangles,'parts':list(parts),'materials':len(matmap),'file_bytes':os.path.getsize(OUT+'/'+kind+'.glb')},h,indent=2)
print('EXPORT_DONE',kind,flush=True)
