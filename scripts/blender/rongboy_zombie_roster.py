"""Build the complete native plush zombie cast using linked V2 mesh data.
All morphology lives on poseable rig pivots. Unique cloth equipment is authored in Blender.
blender -b --python scripts/blender/rongboy_zombie_roster.py -- [--render]
"""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
from math import sin,cos,pi
ROOT=Path.cwd();CUTE='--cute-v4' in sys.argv;VERSION='v4' if CUTE else 'v3';OUT=ROOT/('assets/rongboy/zombies-'+VERSION);OUT.mkdir(parents=True,exist_ok=True)
TARGETS={s['id']:s['height'] for s in json.loads((ROOT/'assets/rongboy/zombies-v3/catalog.json').read_text())['models']} if CUTE else {}
ROSTER=[
 {'id':'walker','name':'跳跳','original':'walker','role':'普通追击','accent':'#BDA678','pose':'hop','active':True},
 {'id':'runner','name':'快跳','original':'runner','role':'轻巧快跑','accent':'#72A99C','pose':'run','active':True},
 {'id':'weaver','name':'侧跳','original':None,'role':'侧跳变线','accent':'#A18BB1','pose':'weave','active':True},
 {'id':'leaper','name':'扑扑','original':None,'role':'蓄势扑近','accent':'#D7AD58','pose':'pounce','active':True},
 {'id':'heavy','name':'棉甲','original':'tank','role':'厚甲抗击退','accent':'#AB735D','pose':'stomp','active':True},
 {'id':'crawler','name':'爬行者','original':'crawler','role':'低伏爬行','accent':'#839D9D','pose':'crawl','active':False},
 {'id':'shielded','name':'持盾者','original':'shielded','role':'正面守护','accent':'#738F9C','pose':'guard','active':False},
 {'id':'bomber','name':'炸弹客','original':'bomber','role':'毛线团炸弹兜','accent':'#C78E5E','pose':'wobble','active':False},
 {'id':'spawner','name':'召唤巢','original':'spawner','role':'布篮孵化巢','accent':'#AC7B79','pose':'summon','active':False},
 {'id':'archer','name':'弓手','original':'archer','role':'弓与绒球箭袋','accent':'#5F8580','pose':'bow','active':False},
 {'id':'boss-warden','name':'守墓巨像','original':'boss-warden','role':'巨型棉甲与布钥匙','accent':'#8A8D85','pose':'warden','active':False},
 {'id':'boss-leech','name':'噬连兽','original':'boss-leech','role':'长臂与吸盘手','accent':'#8A709A','pose':'leech','active':False},
]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/rongboy/runtime-v2/walker.glb'))
base_root=next(o for o in bpy.context.scene.objects if o.parent is None);base_objects=[base_root]+list(base_root.children_recursive)
for o in base_objects:o.select_set(False)
normal=next((im for im in bpy.data.images if im.size[0]==256),None)
if normal:normal.pack()
def colour(hex):
 def linear(n):return n/12.92 if n<=.04045 else ((n+.055)/1.055)**2.4
 return tuple(linear(int(hex[i:i+2],16)/255) for i in (1,3,5))+(1,)
M={}
def material(name,hex):
 key=(name,hex)
 if key in M:return M[key]
 m=bpy.data.materials.new('Roster / '+name);m.diffuse_color=colour(hex);m.use_nodes=True;m.use_backface_culling=True;m['rongboy_palette']=hex;n=m.node_tree.nodes;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=colour(hex);bs.inputs['Roughness'].default_value=.95;bs.inputs['Sheen Weight'].default_value=1;bs.inputs['Sheen Tint'].default_value=(.0336,.0308,.0252,1)
 if normal:
  uv=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(6,6,1);tx=n.new('ShaderNodeTexImage');tx.image=normal;tx.extension='REPEAT';nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.38;l=m.node_tree.links;l.new(uv.outputs['UV'],mp.inputs['Vector']);l.new(mp.outputs['Vector'],tx.inputs['Vector']);l.new(tx.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],bs.inputs['Normal'])
 M[key]=m;return m
cream=material('oat stitches','#F0DFBD' if CUTE else '#E4D3AF');dark=material('dark yarn','#4A5943');wood=material('chestnut cloth','#B69B80' if CUTE else '#785E48');sage=material('soft green','#B0C799' if CUTE else '#A3B18E');slate=material('slate cloth','#737F78')
if CUTE:
 for spec,accent in zip(ROSTER,['#E3CB97','#98C5BC','#C5ACCF','#EACB84','#D5A58D','#AAC7C6','#9DBAC8','#E8BA8C','#D7A6AB','#9BBFB3','#BDBDAA','#BCA6D0']):spec['accent']=accent
unit={}
def primitive(kind):
 if kind in unit:return unit[kind]
 if kind=='sphere':bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=20,radius=1)
 elif kind=='cylinder':bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=1,depth=1)
 elif kind=='torus':bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,major_radius=1,minor_radius=.11)
 ob=bpy.context.object;data=ob.data;unit[kind]=data;bpy.data.objects.remove(ob,do_unlink=True)
 for p in data.polygons:p.use_smooth=True
 return data
current=None;parts=None

def attach(ob,name,mat,part,position,rotation=(0,0,0),scale=(1,1,1)):
 ob.name='Gear / '+current['id']+' / '+name;current['collection'].objects.link(ob);ob.parent=parts[part];ob.location=position;ob.rotation_euler=rotation;ob.scale=scale;ob['gear']=name
 # Object-linked slots preserve shared primitive geometry even when its cloth colour changes.
 if len(ob.data.materials)==0:ob.data.materials.append(mat)
 ob.material_slots[0].link='OBJECT';ob.material_slots[0].material=mat
 return ob

def sphere(name,pos,size,mat,part='Body',rot=(0,0,0)):
 return attach(bpy.data.objects.new(name,primitive('sphere')),name,mat,part,pos,rot,size)
def cylinder(name,pos,radius,height,mat,part='Body',rot=(0,0,0)):
 return attach(bpy.data.objects.new(name,primitive('cylinder')),name,mat,part,pos,rot,(radius,radius,height))
def torus(name,pos,radius,mat,part='Body',rot=(0,0,0),scale=(1,1,1)):
 return attach(bpy.data.objects.new(name,primitive('torus')),name,mat,part,pos,rot,tuple(radius*v for v in scale))
def box(name,pos,size,mat,part='Body',radius=.04,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1);ob=bpy.context.object;data=ob.data.copy();bpy.data.objects.remove(ob,do_unlink=True)
 # Apply dimensions in mesh space so bevel radii remain physically meaningful.
 for v in data.vertices:v.co.x*=size[0];v.co.y*=size[1];v.co.z*=size[2]
 ob=attach(bpy.data.objects.new(name,data),name,mat,part,pos,rot)
 bevel=ob.modifiers.new('Soft felt edge','BEVEL');bevel.width=min(radius,min(size)*.42);bevel.segments=3
 return ob

def yarn(name,points,mat=cream,part='Body',r=.006,closed=False):
 data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=3;data.bevel_depth=r;data.bevel_resolution=1;sp=data.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for p,co in zip(sp.bezier_points,points):p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
 sp.use_cyclic_u=closed;ob=bpy.data.objects.new(name,data);return attach(ob,name,mat,part,(0,0,0))
def button(name,pos,r,mat=cream,part='Body'):
 sphere(name,pos,(r,.018,r),mat,part)
 for sign in [-1,1]:yarn(name+' sewn X',[(pos[0]-r*.35,pos[1]-.02,pos[2]-sign*r*.35),(pos[0]+r*.35,pos[1]-.02,pos[2]+sign*r*.35)],dark,part,.003)

def setpart(name,loc=None,scale=None,rot=None):
 if loc:parts[name].location=loc
 if scale:parts[name].scale=scale
 if rot:parts[name].rotation_euler=rot

def legs(height,factor,width=.18):
 for sign,name in [(-1,'LegL'),(1,'LegR')]:setpart(name,(sign*width,.02,height),(1,1,factor))
def arms(height,width=.30,scale=(1,1,1)):
 for sign,name in [(-1,'ArmL'),(1,'ArmR')]:setpart(name,(sign*width,0,height),scale)
def scarf(mat,long=False):
 torus('rolled scarf',(0,0,.55),.24,mat,scale=(1,.82,1))
 for sign in [-1,1]:box('cloth scarf tail',(sign*.085,-.25,.32 if long and CUTE else .27 if long else .39),(.11,.065 if CUTE else .045,.40 if long and CUTE else .55 if long else .28),mat,rot=(0,sign*.08,sign*.22))

def outfit(role,accent):
 if role=='walker':return
 if role=='runner':
  legs(.66,1,.16);setpart('Body',(0,0,.70),(.86,.90,.82));setpart('Head',(0,-.015,1.16),(.88,.94,.84));arms(1.12,.265,(.88,.95,.90))
  torus('sport headband',(0,.01,.58),.39,accent,'Head',scale=(1,.80,.40));sphere('headband knot',(.34,.06,.58),(.07,.08,.06),accent,'Head');box('headband tails',(.39,.10,.46),(.10,.05,.25),accent,'Head',rot=(.1,.2,-.3))
  for sign,name in [(-1,'LegL'),(1,'LegR')]:
   box('soft knee pad',(0,-.16,-.18),(.18,.07,.18),accent,name);sphere('padded runner shoe',(0,-.10,-.52),(.17,.25,.12),accent,name);yarn('shoe stripe',[(-.10,-.29,-.49),(.10,-.29,-.49)],cream,name,.009)
  scarf(accent)
 elif role=='weaver':
  legs(.65,.98,.20);setpart('Body',(0,0,.68),(1.03,.92,.95));setpart('Head',(0,-.015,1.20),(1.02,.90,.94));arms(1.18,.31,(1.0,1.0,.95));scarf(accent,True)
  for x in [-.20,.20]:box('scarf shoulder fold',(x,-.09,.53),(.17,.12,.15),accent)
  box('angled jacket patch',(.21,-.20,.29),(.16,.06,.24),accent,rot=(0,0,-.17));button('patch button',(.21,-.24,.30),.028)
 elif role=='leaper':
  legs(.80,1.22,.19);setpart('Body',(0,0,.86),(.90,.95,.90));setpart('Head',(0,-.015,1.33),(.91,.94,.85));arms(1.35,.29,(.97,1,1.1))
  for x in [-.15,.15]:box('elastic chest strap',(x,-.23,.28),(.075,.07,.62),accent)
  box('buckle cross strap',(0,-.25,.41),(.44,.10,.14),accent);button('padded buckle',(0,-.31,.41),.055)
  for name in ['LegL','LegR']:
   for z in [-.29,-.20,-.11]:yarn('spring stitch',[(-.10,-.17,z),(.10,-.17,z+.025)],accent,name,.010)
   box('ankle cuff',(0,-.04,-.41),(.24,.23,.10),accent,name)
 elif role=='heavy':
  legs(.70,1.06,.23);setpart('Body',(0,0,.74),(1.38,1.15,1.10));setpart('Head',(0,-.015,1.41),(1.15,1.04,1.10));arms(1.35,.42,(1.25,1.13,1.05))
  for sign in [-1,1]:
   box('quilt chest panel',(sign*.16,-.23,.30),(.28,.15,.55),accent,radius=.06)
   for z in [.12,.27,.42]:yarn('quilt stitch',[(sign*.16-.10,-.312,z),(sign*.16+.10,-.312,z)],cream,r=.005)
   sphere('rounded shoulder pad',(sign*.27,0,.55),(.14,.25,.16),accent);box('padded ear protector',(sign*.42,.0,.36),(.14,.37,.43),accent,'Head',radius=.05)
  box('waist band',(0,-.23,.08),(.63,.10,.11),cream);button('front cloth badge',(0,-.33,.31),.055)
 elif role=='crawler':
  legs(.40,.58,.25);setpart('Body',(0,.20,.48),(1.18,1.60,.78));setpart('Head',(0,-.26,.67),(1.06,1.02,.75));arms(.64,.38,(1.03,1.05,.95))
  for name in ['ArmL','ArmR']:box('elbow guard',(0,-.12,-.27),(.24,.10,.24),accent,name)
  sphere('hunched blanket',(0,.15,.34),(.36,.22,.34),accent);yarn('back blanket seam',[(-.27,.35,.45),(0,.38,.48),(.27,.35,.45)],cream,r=.007)
 elif role=='shielded':
  legs(.68,1.03,.22);setpart('Body',(0,0,.72),(1.10,1.05,1.0));setpart('Head',(0,-.015,1.30),(1.03,1,1));arms(1.25,.34,(1.05,1.05,1))
  sphere('padded helmet back',(0,.10,.43),(.45,.32,.43),accent,'Head');box('helmet brow',(0,-.23,.65),(.70,.12,.15),accent,'Head')
  if CUTE:
   sphere('felt shield',(-.08,-.38,-.26),(.34,.115,.40),accent,'ArmL');sphere('shield piped rim',(-.08,-.469,-.26),(.30,.05,.36),cream,'ArmL');sphere('shield face',(-.08,-.51,-.26),(.27,.03,.325),accent,'ArmL');button('shield boss',(-.08,-.55,-.25),.085,cream,'ArmL')
  else:
   box('felt shield',(-.08,-.38,-.30),(.64,.15,.86),accent,'ArmL',radius=.065);box('shield piped rim',(-.08,-.468,-.30),(.54,.03,.75),cream,'ArmL',radius=.012);box('shield face',(-.08,-.49,-.30),(.47,.03,.67),accent,'ArmL',radius=.012);button('shield boss',(-.08,-.52,-.28),.10,cream,'ArmL')
 elif role=='bomber':
  legs(.60,.90,.22);setpart('Body',(0,0,.68),(1.45,1.35,1.0));setpart('Head',(0,-.015,1.25),(.91,.98,.94));arms(1.23,.40,(1.08,1.05,1.0));scarf(accent)
  sphere('round padded pouch',(0,-.26,.22),(.30,.14,.32),accent);box('pouch tab',(0,-.40,.31),(.07,.04,.16),cream);sphere('pouch dot',(0,-.405,.19),(.04,.02,.04),cream)
  for x,z in [(-.22,.10),(.22,.11)]:
   sphere('soft yarn ball',(x,-.36,z),(.115,.115,.115),wood);yarn('yarn ball winding',[(x-.09,-.43,z),(x,-.46,z+.075),(x+.08,-.42,z)],cream,r=.006);yarn('soft yarn fuse',[(x,-.35,z+.10),(x+.03,-.33,z+.18),(x-.015,-.32,z+.22)],accent,r=.012)
 elif role=='spawner':
  legs(.40,.58,.22);setpart('Body',(0,0,.53),(1.40,1.25,.85));setpart('Head',(0,-.015,1.08),(1.15,1.02,.80));arms(1.0,.36,(1.0,1.0,.75))
  cylinder('cloth nest basket',(0,.06,-.05),.48,.36,wood);torus('basket upper rim',(0,.06,.14),.49,cream,scale=(1,1,1.25));torus('basket lower rim',(0,.06,-.22),.45,cream)
  for x in [-.35,-.18,0,.18,.35]:
   y=.06-math.sqrt(.48**2-x*x)-.005;yarn('basket weave',[(x,y,-.19),(x,y,.12)],cream,r=.007)
  sphere('soft mushroom cap',(0,.01,.72),(.59,.46,.20 if CUTE else .14),accent,'Head')
  for x,y in [(-.28,-.17),(.22,-.23),(.12,.21)]:sphere('mushroom felt dot',(x,y,.84),(.075,.065,.022),cream,'Head')
  for x in [-.34,.34]:
   sphere('tiny plush hatchling',(x,.22,.48),(.12,.11,.13),sage)
   for dx in [-.04,.04]:sphere('hatchling bead eye',(x+dx,.12,.50),(.022,.018,.025),dark)
 elif role=='archer':
  legs(.69,1.04,.18);setpart('Body',(0,0,.72),(.88,.96,1.0));setpart('Head',(0,-.015,1.28),(.86,.95,1.03));arms(1.25,.29,(.95,1,1.0))
  sphere('hood back',(0,.12,.37),(.46,.33,.53),accent,'Head')
  hood=[]
  for i in range(48):
   a=i*2*pi/48;x=.36*cos(a);z=.36+.40*sin(a);y=-.325*math.sqrt(max(.03,1-(x/.43)**2-((z-.36)/.43)**2))-.013;hood.append((x,y,z))
  yarn('hood hem',hood,accent,'Head',.032,True)
  cylinder('plush quiver',(.24,.29,.30),.12,.56,wood,rot=(0,-.15,.1))
  for x in [.18,.25,.31]:yarn('cloth arrow shaft',[(x,.30,.40),(x,.30,.80)],cream,r=.009);sphere('arrow pom pom',(x,.30,.82),(.048,.05,.07),accent)
  # Bow geometry counter-rotates the representative raised left-arm pose.
  bow=bpy.data.objects.new('Gear / archer / bow mount',None);current['collection'].objects.link(bow);bow.parent=parts['ArmL'];bow.location=(-.16,-.20,-.40 if CUTE else -.48);bow.rotation_euler.x=.80
  before=set(current['collection'].objects)
  yarn('soft bow arc',[(.14,-.08,-.48),(-.08,-.10,-.27),(-.16,-.10,0),(-.08,-.10,.27),(.14,-.08,.48)],accent,'ArmL',.027)
  yarn('bow string',[(.14,-.08,-.48),(.14,-.08,.48)],cream,'ArmL',.006)
  for ob in set(current['collection'].objects)-before:ob.parent=bow;ob.location=(0,0,0)
 elif role=='boss-warden':
  legs(.90,1.38,.30);setpart('Body',(0,0,1.0),(1.75,1.45,1.35));setpart('Head',(0,-.015,1.78),(1.28,1.14,1.10));arms(1.65,.55,(1.40,1.22,1.35))
  if CUTE:
   sphere('warden chest slab',(0,-.23,.26),(.37,.14,.38),accent)
   for z in [.11,.25,.39]:yarn('warden quilt stitch',[(-.24,-.34,z),(0,-.37,z-.035),(.24,-.34,z)],cream,r=.005)
  else:box('warden chest slab',(0,-.23,.28),(.62,.15,.66),accent,radius=.065)
  for sign in [-1,1]:sphere('large quilt pauldron',(sign*.31,0,.58),(.25,.30,.21),accent)
  box('crown padded band',(0,0,.69),(.78,.59,.17),accent,'Head',radius=.05)
  for x in [-.28,0,.28]:box('crown stone pillow',(x,.0,.83),(.20,.51,.22),accent,'Head',radius=.08 if CUTE else .045)
  box('lock body',(0,-.34,.31),(.22,.07,.22),cream);torus('lock loop',(0,-.32,.46),.085,cream,rot=(pi/2,0,0));sphere('lock keyhole',(0,-.385,.34),(.026,.01,.038),dark)
  for x in [-.20,.20]:
   torus('cloth key ring',(x,-.29,.02),.07,wood,rot=(pi/2,0,0));yarn('cloth key shaft',[(x,-.29,-.05),(x,-.29,-.23)],cream,r=.019);box('key teeth',(x+.03,-.29,-.20),(.09,.04,.07),cream)
 elif role=='boss-leech':
  legs(.72,1.10,.18);setpart('Body',(0,0,.80),(.94,1.05,1.35));setpart('Head',(0,-.015,1.45),(.88,1.02,1.23));arms(1.38,.38,(1.03,1.05,1.65))
  sphere('long plum cape',(0,.20,.29),(.36,.20,.48),accent);torus('high padded collar',(0,.02,.61),.31,accent,scale=(1,.82,1.8))
  for sign in [-1,1]:
   box('cape front fold',(sign*.26,-.05,.30),(.16,.14,.63),accent,rot=(0,sign*.2,sign*.15));name='ArmL' if sign<0 else 'ArmR'
   torus('soft sucker palm',(-sign*.075,-.13 if CUTE else -.20,-.455 if CUTE else -.65),.09,cream,name,rot=(pi,0,0),scale=(1,1,1.5));sphere('sucker inset',(-sign*.075,-.13 if CUTE else -.20,-.454 if CUTE else -.649),(.07,.07,.012),accent,name)
  for x in [-.22,0,.22]:yarn('soft cape tendril',[(x,.25,-.08),(x+.07,.28,-.34),(x-.02,.22,-.54)],accent,r=.025)

if CUTE:
 sys.path.insert(0,str(ROOT/'scripts/blender'))
 from rongboy_plush_v4 import replace_base,cute_shape
 for ob in base_objects:bpy.data.objects.remove(ob,do_unlink=True)
 base_root,base_objects=replace_base(material,primitive)
def surface_points(collection):
 graph=bpy.context.evaluated_depsgraph_get();coords=[]
 for ob in collection.objects:
  if ob.type not in {'MESH','CURVE'} or ob.get('fuzz'):continue
  evaluated=ob.evaluated_get(graph);mesh=evaluated.to_mesh();coords.extend(ob.matrix_world@v.co for v in mesh.vertices);evaluated.to_mesh_clear()
 return coords
built=[]
for index,spec in enumerate(ROSTER):
 current=dict(spec);collection=bpy.data.collections.new('RONGBOY / '+spec['id']);bpy.context.scene.collection.children.link(collection);current['collection']=collection
 mapping={}
 for src in base_objects:
  ob=src.copy();ob.data=src.data if src.type=='MESH' else src.data;collection.objects.link(ob);mapping[src]=ob
 for src,ob in mapping.items():
  ob.parent=mapping.get(src.parent)
  if src==base_root:ob.name='Zombie / '+spec['id'];ob['zombieType']=spec['id'];ob['asset_version']=VERSION
  elif src.type=='EMPTY':ob.name='CTRL / '+spec['id']+' / '+str(ob.get('part',''))
  elif ob.get('fuzz'):ob.name='fuzz / '+spec['id']+' / '+src.name
  else:ob.name='Mesh / '+spec['id']+' / '+src.name
 parts={ob['part']:ob for ob in mapping.values() if ob.type=='EMPTY' and ob.get('part')}
 current['root']=mapping[base_root];current['parts']=parts;accent=material(spec['id']+' accent',spec['accent']);outfit(spec['id'],accent)
 if CUTE:
  cute_shape(spec['id'],parts);bpy.context.view_layer.update()
  coords=surface_points(collection);lo=min(v.z for v in coords);hi=max(v.z for v in coords);target=(TARGETS[spec['id']]+.017)/.78;factor=(target-.022)/(hi-lo)
  for ob in parts.values():ob.location*=factor;ob.scale*=factor;ob.location.z+=.022-lo*factor
 built.append(current)
# Remove only temporary import objects; their mesh datablocks are retained by linked variants.
for ob in base_objects:bpy.data.objects.remove(ob,do_unlink=True)
# Source layout and basic bounds, without stage objects contaminating export.
for index,item in enumerate(built):
 item['root'].location=((index%4-1.5)*3.5,(1-index//4)*4.1,0)
bpy.context.view_layer.update()
for item in built:
 rootpos=item['root'].matrix_world.translation;coords=[o.matrix_world@v.co-rootpos for o in item['collection'].objects if o.type=='MESH' for v in o.data.vertices];item['height']=max(v.z for v in coords)*.78-.017;item['width']=(max(v.x for v in coords)-min(v.x for v in coords))*.78
# A neutral source studio for editable native review.
studio=bpy.data.collections.new('STUDIO / roster review only');bpy.context.scene.collection.children.link(studio)
plain=material('review paper','#DCD1B9');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.025));ground=bpy.context.object
for c in list(ground.users_collection):c.objects.unlink(ground)
studio.objects.link(ground);ground.data.materials.append(plain)
for name,pos,power,size in [('Key',(-5,-10,13),1900,8),('Fill',(8,-4,10),1300,8),('Rim',(0,7,12),1600,7)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;light=bpy.data.objects.new(name,data);studio.objects.link(light);light.location=pos;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('Roster review camera',bpy.data.cameras.new('Roster review camera'));studio.objects.link(cam);cam.location=(9,-20,17);cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=17.8
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=1800;scene.render.resolution_y=1300;scene.render.resolution_percentage=100;scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.55,.55,.55,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.4;scene.view_settings.view_transform='AgX'
scene['asset_status']='Twelve native visual candidates, pending user judgement';scene['base_source']='V4 round plush construction; V3 preserved' if CUTE else 'V2 walker native runtime mesh; V2 source preserved'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('rongboy-zombie-roster-'+VERSION+'.blend')),compress=True)
if '--render' in sys.argv:
 scene.render.filepath=str(OUT/'roster-native-overview.png');bpy.ops.render.render(write_still=True)
# Export prefabs at their own origin, keeping shared base mesh datablocks for compactness.
for item in built:item['root'].location=(0,0,0)
for ob in scene.objects:ob.select_set(False)
for item in built:
 for ob in item['collection'].objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'zombie-roster.tmp.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_yup=True)
(OUT/'zombie-roster.tmp.glb').replace(OUT/'zombie-roster.glb')
public=[]
for item in built:public.append({**{k:item[k] for k in ['id','name','original','role','accent','pose','active']},'height':round(item['height'],3),'width':round(item['width'],3)})
(OUT/'catalog.json').write_text(json.dumps({'models':public,'source':'rongboy-zombie-roster-'+VERSION+'.blend','base':'round plush V4 primitives' if CUTE else '../walker-v2/rongboy-walker-v2.blend','bytes':(OUT/'zombie-roster.glb').stat().st_size},ensure_ascii=False,indent=2))
(ROOT/'library/games/rongboy-roster.js').write_text('// Native Blender roster metadata. Generated by rongboy_zombie_roster.py.\nexport const ZOMBIE_ROSTER = '+json.dumps(public,ensure_ascii=False,indent=2)+';\nexport const ZOMBIE_ALIASES = {tank:"heavy"};\n')
print('ROSTER_DONE',len(public),(OUT/'zombie-roster.glb').stat().st_size,flush=True)
