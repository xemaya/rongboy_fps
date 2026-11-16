"""Refine the accepted native figurines; v1 sources stay read-only.
blender -b --python scripts/blender/rongboy_refine_v2.py -- scout|walker [--render]
"""
import bpy,sys,os,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from math import sin,cos,pi,sqrt
args=sys.argv[sys.argv.index('--')+1:];kind=args[0];ROOT=Path.cwd();out=ROOT/'assets/rongboy'/f'{kind}-v2';out.mkdir(parents=True,exist_ok=True)
# The supplied PNG is also reproducible without an external image service.
normal_path=ROOT/'assets/rongboy/runtime-v2/felt-normal.png'
if '--rebuild-normal' in args or not normal_path.exists():
 import numpy as np
 normal_path.parent.mkdir(parents=True,exist_ok=True);rng=np.random.default_rng(478);h=rng.normal(size=(256,256))
 for i in range(5):h=(h*4+np.roll(h,1,0)+np.roll(h,-1,0)+np.roll(h,1,1)+np.roll(h,-1,1))/8
 nx=(np.roll(h,1,1)-np.roll(h,-1,1))*.75;ny=(np.roll(h,1,0)-np.roll(h,-1,0))*.75;vectors=np.stack([nx,ny,np.ones_like(nx)],-1);vectors/=np.linalg.norm(vectors,axis=-1,keepdims=True)
 pixels=np.concatenate([np.round((vectors*.5+.5)*255)/255,np.ones((256,256,1))],-1).astype('float32');im=bpy.data.images.new('Rebuild / fine felt normal',width=256,height=256,alpha=True);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(normal_path);im.file_format='PNG';im.save()
source=ROOT/'assets/rongboy'/('scout-motion-v1/rongboy-scout-motion-v1.blend' if kind=='scout' else 'walker-v1/rongboy-walker-v1.blend')
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;scene.frame_set(1)
col=bpy.data.collections['RONGBOY / Scout figurine' if kind=='scout' else 'RONGBOY / Walker figurine']
# Freeze only the derived scout, preserving the accepted construction pose and joint hierarchy.
if kind=='scout':
 rest={'CTRL / ground motion':(0,0,0),'CTRL / body':(0,0,.73),'CTRL / head':(0,-.025,1.23),'CTRL / hat':(0,0,1.88),'CTRL / backpack':(0,.30,1.05)}
 for sign in [-1,1]:rest.update({f'CTRL / arm {sign}':(sign*.31,0,1.14),f'CTRL / leg {sign}':(sign*.205,.025,.67),f'CTRL / boot {sign}':(sign*.205,.02,.24)})
 for name,position in rest.items():
  ob=bpy.data.objects[name];ob.animation_data_clear();ob.location=position;ob.rotation_euler=(0,0,0);ob.scale=(1,1,1)
bpy.context.view_layer.update()
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgba(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (1,3,5))+(1,)
palette={
 'Wool / warm oatmeal skin':'#EACFA8','Wool / subtle apricot cheeks':'#DDA78B','Wool / sand canvas jacket':'#B19A6A','Wool / soft camel explorer hat':'#C8A76F','Wool / olive shorts':'#687354','Wool / chestnut tufts':'#594637','Wool / ochre neckerchief':'#D7AF4F','Leather / chestnut boots and straps':'#70513D','Rubber / dark stacked sole':'#3C3530','Cotton / oatmeal stitching':'#DFCEA7','Cotton / embroidered mouth':'#70503A','Wool / moss canvas rucksack':'#85916B','Wool / rolled oat blanket':'#CDBA8A','Brass / worn buckles':'#B99C60','Glass / dark brown bead eyes':'#30271F','Glass / reflected catchlight':'#FFF2D7',
 'Walker / moss green wool':'#8E9F7B','Walker / faded green wool':'#A3B18E','Walker / dark moss felt patch':'#697F5C','Walker / worn chestnut felt vest':'#75604E','Walker / plum brown cloth':'#6E6470','Walker / ochre wooden button':'#D0AF65','Walker / dark sewn button':'#51594F','Walker / charcoal yarn':'#4A5943','Walker / oat felt teeth':'#E8D9B7','Walker / mouth wool inset':'#3D4938'}
# Shared microscopic normal detail, no coloured noise. Embed in the editable native file as well.
normal=bpy.data.images.load(str(ROOT/'assets/rongboy/runtime-v2/felt-normal.png'),check_existing=True);normal.colorspace_settings.name='Non-Color';normal.pack()
used={m for ob in col.objects if ob.type in {'MESH','CURVE'} for m in ob.data.materials if m}
for m in used:
 name=m.name;h=palette.get(name)
 if not h:continue
 felt=not any(s in name for s in ['Brass /','Glass /','Leather /','Rubber /','wooden button','dark sewn button'])
 m.diffuse_color=rgba(h);m.use_nodes=True;m['rongboy_palette']=h;m['rongboy_surface']='felt' if felt else 'trim';n=m.node_tree.nodes;n.clear();l=m.node_tree.links;outnode=n.new('ShaderNodeOutputMaterial');bs=n.new('ShaderNodeBsdfPrincipled');l.new(bs.outputs['BSDF'],outnode.inputs['Surface']);bs.inputs['Base Color'].default_value=rgba(h);bs.inputs['Roughness'].default_value=.95 if felt else .76
 if 'Sheen Weight' in bs.inputs:bs.inputs['Sheen Weight'].default_value=.28 if felt else .04;bs.inputs['Sheen Roughness'].default_value=.85;bs.inputs['Sheen Tint'].default_value=(.12,.11,.09,1)
 if 'Glass /' in name:bs.inputs['Roughness'].default_value=.20
 if 'Brass /' in name:bs.inputs['Metallic'].default_value=.55;bs.inputs['Roughness'].default_value=.40
 if felt:
  uv=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(6,6,1);l.new(uv.outputs['UV'],mapping.inputs['Vector']);tex=n.new('ShaderNodeTexImage');tex.image=normal;tex.extension='REPEAT';l.new(mapping.outputs['Vector'],tex.inputs['Vector']);nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.38;l.new(tex.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],bs.inputs['Normal'])
# Shorter, finer native fibres. Their roots and the accepted silhouette stay fixed.
fibres=0
for ob in list(col.objects):
 if ob.type=='CURVE' and 'fine wool nap' in ob.name:
  ob.data.bevel_depth=.00038
  for spline in ob.data.splines:
   if not spline.points:continue
   root=Vector(spline.points[0].co[:3])
   for point in list(spline.points)[1:]:point.co=(*(root+(Vector(point.co[:3])-root)*.42),1)
  fibres+=len(ob.data.splines)
# New mesh helpers never clear/rebuild the original scene.
def finish(ob,name,mat,part='head'):
 ob.name=name
 for c in list(ob.users_collection):c.objects.unlink(ob)
 col.objects.link(ob);ob.data.materials.clear();ob.data.materials.append(mat);ob['rig_part']=part
 if ob.type=='MESH':
  for f in ob.data.polygons:f.use_smooth=True
 return ob

def sphere(name,position,scale,mat,part='head'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=28,location=position);ob=bpy.context.object;ob.scale=scale;return finish(ob,name,mat,part)
def yarn(name,points,mat,r=.0035,closed=False,part='head'):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=4;cu.bevel_depth=r;cu.bevel_resolution=1;sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for p,v in zip(sp.bezier_points,points):p.co=v;p.handle_left_type=p.handle_right_type='AUTO'
 sp.use_cyclic_u=closed;ob=bpy.data.objects.new(name,cu);col.objects.link(ob);cu.materials.append(mat);ob['rig_part']=part;return ob
changes=['constant authored base colours','shared fine normal instead of coloured atlas','native wool nap shortened to 42 percent']
if kind=='walker':
 M={name:bpy.data.materials[name] for name in palette if name in bpy.data.materials}
 if 'Walker / faded green wool' not in M:
  light=M['Walker / moss green wool'].copy();light.name='Walker / faded green wool';light.diffuse_color=rgba(palette[light.name]);light.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=light.diffuse_color;light['rongboy_palette']=palette[light.name];M[light.name]=light
 skin=M['Walker / moss green wool'];skinlight=M['Walker / faded green wool'];patch=M['Walker / dark moss felt patch'];thread=M['Walker / oat felt teeth'];dark=M['Walker / charcoal yarn']
 def front(x,z,offset=.006):return -.015-.325*sqrt(max(.01,1-(x/.43)**2-((z-1.61)/.43)**2))-offset
 for ob in list(col.objects):
  if ob.name.startswith(('Head / dark forehead patch','Head / patch stitch')):bpy.data.objects.remove(ob,do_unlink=True)
  elif ob.type=='MESH' and ob.name.startswith('Head / button eye'):ob.scale.y*=.78
  elif ob.type=='CURVE' and ob.name.startswith('Head / button rim'):ob.data.bevel_depth=.0055
  elif ob.type=='MESH' and '/ palm' in ob.name:ob.scale.x*=1.07;ob.scale.z*=1.06
  elif ob.type=='MESH' and '/ finger' in ob.name:ob.scale.x*=1.04;ob.scale.z*=.87;ob.location.z+=.012
 # Soft socket appliques support the buttons, rather than buttons floating over the face.
 for x,z,r in [(-.15,1.68,.112),(.158,1.65,.082)]:sphere('Head / soft felt eye socket',(x,front(x,z,.004),z),(r*1.22,.025,r*1.15),skinlight)
 # Rounded, genuinely curved cloth patch with real thickness; no faceted polygon decal.
 verts=[(.174,front(.174,1.873,.014),1.873)];rings=[]
 for radius in [.5,1]:
  ring=[]
  for i in range(48):
   a=2*pi*i/48;c=cos(a);s=sin(a);x=.174+.125*radius*math.copysign(abs(c)**.55,c);z=1.873+.104*radius*math.copysign(abs(s)**.55,s);limit=.43*sqrt(max(.01,1-((z-1.61)/.43)**2))*.93;x=min(x,limit);ring.append(len(verts));verts.append((x,front(x,z,.013),z))
  rings.append(ring)
 faces=[(0,rings[0][i],rings[0][(i+1)%48]) for i in range(48)]+[(rings[0][i],rings[1][i],rings[1][(i+1)%48],rings[0][(i+1)%48]) for i in range(48)]
 me=bpy.data.meshes.new('Rounded curved forehead patch');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('Head / rounded forehead patch',me);col.objects.link(ob);finish(ob,ob.name,patch);sol=ob.modifiers.new('Real felt thickness','SOLIDIFY');sol.thickness=.0035;sol.offset=0
 uv=me.uv_layers.new(name='UVMap')
 for f in me.polygons:
  for loop in f.loop_indices:
   co=me.vertices[me.loops[loop].vertex_index].co;uv.data[loop].uv=((co.x-.049)/.25,(co.z-1.769)/.208)
 boundary=[(x,y-.003,z) for x,y,z in verts[49:]];yarn('Head / patch piped edge',boundary,dark,.0025,True)
 for i in range(0,48,4):
  p=Vector(boundary[i]);direction=Vector(boundary[(i+1)%48])-Vector(boundary[(i-1)%48]);cross=Vector((direction.z,0,-direction.x)).normalized()*.008;p.y-=.003;yarn('Head / patch hand stitch',[p-cross,p+cross],thread,.0028)
 mouth=bpy.data.objects.get('Head / mouth opening')
 if mouth:
  mouth.scale.y*=.78;points=[(.193*cos(a),mouth.location.y-.018,1.415+.096*sin(a)) for a in [i*2*pi/48 for i in range(48)]];yarn('Head / mouth welt',points,patch,.004,True)
 for sign in [-1,1]:
  for offset in [-.031,.031]:
   x=sign*.376+offset;yarn(f'Arm {sign} / mitten finger seam',[(x,-.312,.689),(x,-.326,.662),(x,-.315,.639)],dark,.0028,False,'armL' if sign<0 else 'armR')
 # The old forearm scars sat in front of the skin like loose needles. Conform
 # each stitch endpoint to the actual evaluated arm surface before parenting.
 bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
 for seam in list(col.objects):
  if seam.type!='CURVE' or ' / sewn scar' not in seam.name:continue
  sign=-1 if seam.name.startswith('Arm -1') else 1
  targets=[o for o in col.objects if o.type=='MESH' and o.name.startswith(f'Arm {sign} /')]
  inv=seam.matrix_world.inverted()
  for sp in seam.data.splines:
   for point in sp.bezier_points:
    world=seam.matrix_world@point.co;origin=Vector((world.x,-1,world.z));direction=Vector((0,1,0));hits=[]
    for surface in targets:
     evaluated=surface.evaluated_get(graph);back=surface.matrix_world.inverted();ok,location,normal,index=evaluated.ray_cast(back@origin,(back.to_3x3()@direction).normalized())
     if ok:hits.append(surface.matrix_world@location)
    if hits:
     hit=min(hits,key=lambda p:p.y);hit.y-=.0028;point.co=inv@hit
  seam.data.bevel_depth=.0028
 # Poseable native pivots, saved at construction pose. Export reads the unchanged rest state.
 root=bpy.data.objects.get('Walker / figurine root');controls={}
 for part,loc in {'body':(0,0,.70),'head':(0,-.015,1.25),'armL':(-.30,0,1.23),'armR':(.30,0,1.23),'legL':(-.18,.02,.66),'legR':(.18,.02,.66)}.items():
  e=bpy.data.objects.new('CTRL / Walker '+part,None);col.objects.link(e);e.location=loc;e.empty_display_size=.07;controls[part]=e
 bpy.context.view_layer.update()
 for ob in list(col.objects):
  if ob.type not in {'MESH','CURVE'}:continue
  part=ob.get('rig_part','body');world=ob.matrix_world.copy();ob.parent=controls[part];ob.matrix_world=world
 changes+=['soft button sockets and thinner buttons','rounded forehead patch with thickness and tiny sewn border','mouth piping','fuller palms and blended finger pads','six editable native pose pivots','forearm stitches conformed to skin']
# Simple neutral review studio, independently stored in v2.
for ob in list(bpy.data.collections['STUDIO / presentation only'].objects):bpy.data.objects.remove(ob,do_unlink=True)
studio=bpy.data.collections['STUDIO / presentation only']
def studio_mat(name,h):
 m=bpy.data.materials.new(name);m.diffuse_color=rgba(h);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=rgba(h);bs.inputs['Roughness'].default_value=.92;return m
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.025));plane=bpy.context.object;plane.name='Studio / paper floor'
for c in list(plane.users_collection):c.objects.unlink(plane)
studio.objects.link(plane);plane.data.materials.append(studio_mat('Studio v2 / cream paper','#DDD2BA'))
for name,pos,power,size,colr in [('Key',(-3,-4,5),430,4,(1,.94,.83)),('Fill',(3,-2,3),260,4,(.86,.92,1)),('Rim',(1,3,4),380,3,(1,.96,.84))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=colr;o=bpy.data.objects.new(name,data);studio.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('V2 / review camera',bpy.data.cameras.new('V2 camera'));studio.objects.link(camera);camera.data.type='ORTHO';camera.data.ortho_scale=2.85;camera.location=(3,-6,2.8);camera.rotation_euler=(Vector((0,0,1.12))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.55,.55,.55,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.35
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4;scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
scene['rongboy_asset_version']='v2';scene['asset_status']='Visual candidate, pending user judgement';scene['material_note']='Uniform PBR base colours; shared fine normal; no coloured atlas';scene['source_v1']=str(source.relative_to(ROOT))
bpy.ops.wm.save_as_mainfile(filepath=str(out/f'rongboy-{kind}-v2.blend'))
manifest={'version':'v2','kind':kind,'source_v1':str(source.relative_to(ROOT)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'changes':changes,'palette':{m.name:m.get('rongboy_palette') for ob in col.objects if ob.type in {'MESH','CURVE'} for m in ob.data.materials if m and m.get('rongboy_palette')},'native_fibres':fibres,'status':'visual candidate'}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
if '--render' in args:
 if kind=='walker':
  for part in ['armL','armR']:controls[part].rotation_euler.x=-.95
 scene.render.filepath=str(out/'review-threequarter.png');bpy.ops.render.render(write_still=True)
print('REFINE_DONE',kind,flush=True)
