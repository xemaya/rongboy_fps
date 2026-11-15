"""Editable Blender scout figurine study. Blender 5.1; all authored geometry/materials.
Run: blender -b --python scripts/blender/rongboy_scout.py -- --out assets/rongboy/scout-v1
Front is -Y; Z up. Reference: scenes/rongboy/reference/target-v1.png.
"""
import bpy, math, random, os, sys, json, argparse
from mathutils import Vector
from math import sin, cos, pi
from bisect import bisect_left
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--out',default='assets/rongboy/scout-v1');p.add_argument('--samples',type=int,default=32);p.add_argument('--size',type=int,default=1100);p.add_argument('--engine',default='CYCLES');p.add_argument('--views',default='hero,front,side,game');opt=p.parse_args(args)
OUT=os.path.abspath(opt.out);os.makedirs(OUT+'/renders',exist_ok=True)
random.seed(41);bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)
model=bpy.data.collections.new('RONGBOY / Scout figurine');bpy.context.scene.collection.children.link(model)
studio=bpy.data.collections.new('STUDIO / presentation only');bpy.context.scene.collection.children.link(studio)
fur_jobs=[]
def move(o,collection=model):
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o);return o

def srgb(v):return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
def color(hex):return tuple(srgb(int(hex[i:i+2],16)/255) for i in (1,3,5))+(1,)
def material(name,hex,rough=.85,felt=True):
 m=bpy.data.materials.new(name);m.diffuse_color=color(hex);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=color(hex);bs.inputs['Roughness'].default_value=rough
 if 'Sheen Weight' in bs.inputs:bs.inputs['Sheen Weight'].default_value=.32 if felt else .05
 tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=155 if felt else 65;tex.inputs['Detail'].default_value=3;tex.inputs['Roughness'].default_value=.72
 coord=n.new('ShaderNodeTexCoord');l.new(coord.outputs['Generated'],tex.inputs['Vector']);r=n.new('ShaderNodeValToRGB');base=color(hex);r.color_ramp.elements[0].position=.18;r.color_ramp.elements[0].color=tuple(v*.70 for v in base[:3])+(1,);r.color_ramp.elements[1].position=.82;r.color_ramp.elements[1].color=tuple(min(1,v*1.17) for v in base[:3])+(1,);l.new(tex.outputs['Fac'],r.inputs[0]);l.new(r.outputs['Color'],bs.inputs['Base Color'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28 if felt else .15;bump.inputs['Distance'].default_value=.014 if felt else .004;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal']);return m
M={
 'face':material('Wool / warm oatmeal skin','#e5be91'),
 'cheek':material('Wool / subtle apricot cheeks','#d99776'),
 'jacket':material('Wool / sand canvas jacket','#ab8b57'),
 'hat':material('Wool / soft camel explorer hat','#bb955f'),
 'pants':material('Wool / olive shorts','#626243'),
 'hair':material('Wool / chestnut tufts','#563b2a'),
 'scarf':material('Wool / ochre neckerchief','#e6b542'),
 'leather':material('Leather / chestnut boots and straps','#674631',.7,False),
 'sole':material('Rubber / dark stacked sole','#392e25',.9,False),
 'thread':material('Cotton / oatmeal stitching','#e2cca0',.9,True),
 'darkthread':material('Cotton / embroidered mouth','#6d4130'),
 'pack':material('Wool / moss canvas rucksack','#7e8153'),
 'roll':material('Wool / rolled oat blanket','#c9ae76'),
 'metal':material('Brass / worn buckles','#b89559',.4,False),
 'eye':material('Glass / dark brown bead eyes','#211b16',.18,False),
 'white':material('Glass / reflected catchlight','#fff2cc',.2,False),
}
M['metal'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.65

def finish(o,name,mat,collection=model):
 o.name=name;move(o,collection);o.data.materials.append(mat)
 if o.type=='MESH':
  for f in o.data.polygons:f.use_smooth=True
 return o

def uv(name,loc,scale,mat,fur=0,rot=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=loc);o=bpy.context.object;o.scale=scale
 if rot:o.rotation_euler=rot
 finish(o,name,mat)
 if fur:fur_jobs.append((o,fur,mat))
 return o

def cube(name,loc,scale,mat,bevel=.08,rot=None,fur=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if rot:o.rotation_euler=rot
 finish(o,name,mat);b=o.modifiers.new('Soft sewn corners','BEVEL');b.width=bevel;b.segments=5
 w=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 if fur:fur_jobs.append((o,fur,mat))
 return o

def path(name,pts,radius,mat,closed=False,collection=model):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=8;cu.bevel_depth=radius;cu.bevel_resolution=2
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for bp,pt in zip(sp.bezier_points,pts):bp.co=pt;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
 sp.use_cyclic_u=closed;o=bpy.data.objects.new(name,cu);collection.objects.link(o);cu.materials.append(mat);return o

def tube_between(name,a,b,r1,r2,mat):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,mat)

def stitches(name,points,count=20,size=.015,mat=None):
 mat=mat or M['thread'];pts=[Vector(v) for v in points];lens=[0]
 for a,b in zip(pts,pts[1:]):lens.append(lens[-1]+(b-a).length)
 for i in range(count):
  d=(i+.5)*lens[-1]/count;j=min(len(pts)-2,max(0,bisect_left(lens,d)-1));t=(d-lens[j])/max(.00001,lens[j+1]-lens[j]);v=pts[j].lerp(pts[j+1],t);direction=(pts[j+1]-pts[j]).normalized();path(name+f' {i:02}',[v-direction*size/2,v+direction*size/2],.004,mat)

def lathe(name,profile,mat,ellipse=(1,1),n=96,fur=0,warp=0):
 verts=[];faces=[]
 for radius,z in profile:
  for i in range(n):
   a=2*pi*i/n;rr=radius*(1+warp*.05*cos(a*3));verts.append((rr*cos(a)*ellipse[0],rr*sin(a)*ellipse[1],z+warp*(cos(a*2)+.3*sin(a*3))))
 for j in range(len(profile)-1):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 faces.extend([tuple(range(n-1,-1,-1)),tuple((len(profile)-1)*n+i for i in range(n))]);me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);model.objects.link(o);finish(o,name,mat)
 sub=o.modifiers.new('Hand shaped smooth surface','SUBSURF');sub.levels=2
 if fur:fur_jobs.append((o,fur,mat))
 return o

# Soft weight-bearing boots, curved soles, tongue, laces and stitches.
for sign in [-1,1]:
 x=sign*.205
 uv(f'Boot {sign} / padded toe',(x,-.11,.185),(.18,.29,.16),M['leather'])
 uv(f'Boot {sign} / stacked sole',(x,-.11,.092),(.185,.295,.065),M['sole'])
 uv(f'Boot {sign} / ankle',(x,.015,.30),(.135,.145,.19),M['leather'])
 cube(f'Boot {sign} / felt tongue',(x,-.135,.31),(.13,.055,.22),M['jacket'],.045)
 for j in range(4):
  z=.24+j*.041;yy=-.183+(j*.006)
  path(f'Boot {sign} / crossing lace {j}',[(x-.067,yy,z),(x+.067,yy,z+.025)],.007,M['thread'])
  for s in [-1,1]:uv('Boot brass eyelet',(x+s*.075,yy+.003,z),(.014,.009,.014),M['metal'])
 seam=[(x+.151*cos(a),-.11+.258*sin(a),.13) for a in [2*pi*i/50 for i in range(51)]];stitches('Sole welt stitch',seam,30,.018)
 # Bent soft legs and cuff band.
 uv(f'Leg {sign}',(x,.025,.49),(.115,.135,.24),M['face'],fur=350)
 uv(f'Shorts leg {sign}',(x,.045,.65),(.15,.165,.18),M['pants'],fur=600)
 path('Shorts cuff seam',[(x+.145*cos(a),.045+.16*sin(a),.565) for a in [2*pi*i/24 for i in range(25)]],.007,M['thread'],True)

# Jacket has a hem, overlapping placket, soft shoulders, pockets and brass buttons.
uv('Jacket / padded torso',(0,.025,.94),(.36,.245,.375),M['jacket'],fur=3500)
uv('Jacket / lower hem',(0,.02,.727),(.36,.25,.13),M['jacket'],fur=650)
path('Jacket center stitched placket',[(0,-.224,.75),(-.012,-.229,.94),(-.018,-.208,1.14)],.014,M['leather'])
for z in [.79,.92,1.05]:uv('Jacket / wood button',(.035,-.242,z),(.024,.014,.024),M['leather'])
for sign in [-1,1]:
 x=sign*.20
 cube('Jacket / cargo pocket',(x,-.208,.88),(.145,.056,.145),M['jacket'],.035,rot=(0,sign*.07,0),fur=240)
 cube('Pocket / folded flap',(x,-.247,.938),(.158,.033,.05),M['jacket'],.019)
 uv('Pocket / button',(x,-.268,.925),(.015,.009,.015),M['leather'])
 stitches('Pocket embroidery',[(x-.053,-.25,.9),(x-.053,-.256,.825),(x+.053,-.256,.825),(x+.053,-.25,.9)],12,.016)
 # Arms with elbow bend and rounded mitten hands. Separate parts can be rigged later.
 arm=uv(f'Sleeve {sign}',(sign*.367,-.004,.975),(.145,.155,.26),M['jacket'],fur=1200,rot=(0,sign*-.28,sign*-.10))
 uv(f'Cuff {sign}',(sign*.42,-.05,.81),(.13,.14,.065),M['jacket'],fur=300)
 hand=uv(f'Mitten {sign}',(sign*.431,-.075,.713),(.115,.115,.13),M['face'],fur=350)
 uv(f'Thumb {sign}',(sign*.354,-.154,.746),(.052,.065,.075),M['face'],fur=90)
 path('Mitten / thumb seam',[(sign*.37,-.184,.73),(sign*.40,-.19,.75),(sign*.414,-.18,.79)],.004,M['darkthread'])

# Backpack: bowed canvas volume, flap, side pockets, bedroll and visible straps.
cube('Rucksack / main sewn canvas',(0,.31,1.0),(.56,.31,.56),M['pack'],.13,fur=1500)
cube('Rucksack / top flap',(0,.339,1.265),(.59,.34,.14),M['pack'],.065,fur=700)
cube('Rucksack / front pouch',(0,.495,.928),(.36,.105,.23),M['pack'],.055,fur=500)
for sign in [-1,1]:
 path('Shoulder / leather strap',[(sign*.22,.30,1.24),(sign*.29,.04,1.24),(sign*.255,-.19,1.13),(sign*.28,-.212,.84),(sign*.3,.1,.75)],.026,M['leather'])
 path('Backpack / wrapped bedroll strap',[(sign*.17,.50+.151*cos(a),1.415+.151*sin(a)) for a in [2*pi*i/36 for i in range(37)]],.022,M['leather'],True)
 for z in [.86,1.07]:cube('Rucksack leather tab',(sign*.16,.512,z),(.045,.025,.13),M['leather'],.012)
uv('Bedroll / blanket roll',(0,.50,1.415),(.38,.14,.14),M['roll'],fur=1800)
for sign in [-1,1]:
 spiral=[]
 for j in range(100):
  a=j/99*5.5*pi;r=.115*(1-j/112);spiral.append((sign*.375,.50+r*cos(a),1.415+r*sin(a)))
 path('Bedroll / spiral end',spiral,.009,M['thread'])
# Back pocket stitch border, visible in side/rear threequarter render.
stitches('Backpack / pocket border',[(-.145,.554,1.0),(-.145,.556,.85),(.145,.556,.85),(.145,.554,1.0)],26,.018)

# Friendly large head, softly widened cheeks. Bead eyes are recessed in a felt face.
head=uv('Head / felt face',(0,-.025,1.51),(.49,.355,.43),M['face'],fur=5200)
# Tiny ears and inner felt tufts.
for sign in [-1,1]:
 uv('Ear',(sign*.467,-.023,1.515),(.105,.09,.14),M['face'],fur=300)
 uv('Ear / inner',(sign*.505,-.096,1.52),(.047,.026,.075),M['cheek'],fur=80)
 # Eye socket edge and glossy bead.
 uv('Eye / embroidered rim',(sign*.161,-.345,1.57),(.070,.024,.083),M['hair'])
 uv('Eye / inset dark bead',(sign*.161,-.367,1.57),(.054,.031,.066),M['eye'])
 uv('Eye / tiny catchlight',(sign*.161-.014,-.396,1.595),(.011,.006,.013),M['white'])
 # Subtle cheek shape instead of flat painted disk.
 uv('Cheek / peach wool',(sign*.273,-.308,1.43),(.083,.024,.048),M['cheek'],fur=140)
 path('Eyebrow / sewn wool',[(sign*.105,-.347,1.704),(sign*.165,-.35,1.725),(sign*.213,-.325,1.709)],.013,M['hair'])
uv('Nose / little felt button',(0,-.389,1.485),(.058,.05,.049),M['face'],fur=90)
path('Smile / embroidered thread',[(-.075,-.359,1.385),(-.035,-.376,1.372),(0,-.38,1.37),(.042,-.368,1.383),(.067,-.354,1.401)],.007,M['darkthread'])
# Soft irregular chestnut fringe and sideburns along the hat line.
for i in range(11):
 a=-pi*.92+pi*1.84*i/10
 x=.425*sin(a);yy=-.025-.28*cos(a);z=1.775+.035*sin(i*2.3)
 uv('Hair / felt fringe tuft',(x,yy,z),(.115,.09,.15),M['hair'],fur=250,rot=(0,.3*sin(i*1.7),.2*cos(i)))
for sign in [-1,1]:uv('Hair / sideburn',(sign*.425,-.065,1.65),(.082,.155,.17),M['hair'],fur=400)

uv('Hair / rounded back cap',(0,.13,1.60),(.445,.295,.32),M['hair'],fur=1100)

# Keep felt fringe under brim: review found tuft tops penetrating the hat.
bpy.context.view_layer.update()
for o in list(model.objects):
 if o.type=='MESH' and o.name.startswith('Hair /'):
  inv=o.matrix_world.inverted()
  for v in o.data.vertices:
   world_co=o.matrix_world@v.co
   if world_co.z>1.823:
    world_co.z=1.823;v.co=inv@world_co

# Neckerchief: rounded collar, tied knot, folded triangular tails. Small cloth mesh.
path('Scarf / rolled neckerchief',[(-.27,-.16,1.245),(-.14,-.252,1.205),(0,-.272,1.197),(.17,-.239,1.223),(.28,-.10,1.26),(.20,.15,1.27),(-.21,.15,1.27)],.067,M['scarf'],True)
uv('Scarf / knot',(.025,-.304,1.185),(.088,.057,.068),M['scarf'],fur=300)
def scarf_tail(name,coords):
 verts=[];faces=[];n=12
 # Rounded pointed triangular cloth with curved central fold.
 top,left,right=map(Vector,coords)
 for j in range(n+1):
  t=j/n;center=top.lerp((left+right)/2,t);w=(right-left)*.5*t
  for i in range(n+1):
   u=2*i/n-1;v=center+w*u;v.y-=.018*sin(pi*t)*(1-u*u);verts.append(v)
 for j in range(n):
  for i in range(n):k=j*(n+1)+i;faces.append((k,k+1,k+n+2,k+n+1))
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);o=bpy.data.objects.new(name,me);model.objects.link(o);finish(o,name,M['scarf']);sol=o.modifiers.new('Soft folded cloth thickness','SOLIDIFY');sol.thickness=.016;bev=o.modifiers.new('Soft wool edge','BEVEL');bev.width=.009;bev.segments=3;fur_jobs.append((o,300,M['scarf']));return o
scarf_tail('Scarf / left triangular tail',[(-.015,-.31,1.17),(-.10,-.29,.96),(.035,-.32,1.02)])
scarf_tail('Scarf / right triangular tail',[(.06,-.32,1.17),(.07,-.28,1.01),(.18,-.275,1.075)])

# Hand-shaped broad brim: smooth rim with subtle curled sides. Crown pinched like safari felt.
brim=lathe('Hat / curled soft brim',[(0.001,1.867),(.36,1.865),(.55,1.844),(.665,1.842),(.695,1.864),(.69,1.89),(.64,1.897),(.51,1.88),(.001,1.89)],M['hat'],(1,.84),fur=3000,warp=.018)
crown=lathe('Hat / pinched crown',[(.39,1.88),(.43,1.96),(.408,2.13),(.35,2.24),(.25,2.29),(.06,2.30),(.001,2.29)],M['hat'],(1,.89),fur=2700)
# Crown crease gives the hat its characteristic broken-in hand-shaped top.
for v in crown.data.vertices:
 if v.co.z>2.14:v.co.z-=.065*math.exp(-((v.co.x/.12)**2))*((v.co.z-2.14)/.16)
# Leather hat band, brass buckle and embroidered brim edge.
band=lathe('Hat / chestnut band',[(.421,1.932),(.435,1.95),(.428,2.011),(.419,2.028)],M['leather'],(1,.89))
seam=[(.655*cos(a),.655*.84*sin(a),1.902+.018*cos(a*2)) for a in [2*pi*i/100 for i in range(101)]];stitches('Hat / brim stitching',seam,92,.024)
for sign in [-1,1]:
 # Two goggles rest on hat, in front, separate from face.
 x=sign*.135
 path('Goggle / brass frame',[(x+.095*cos(a),-.397-.01*cos(a),2.065+.075*sin(a)) for a in [2*pi*i/32 for i in range(33)]],.018,M['metal'],True)
 uv('Goggle / warm dark lens',(x,-.398,2.064),(.080,.022,.060),M['leather'])
 uv('Goggle / glass glint',(x-.025,-.421,2.085),(.025,.004,.008),M['thread'])
path('Goggles / bridge',[(-.04,-.407,2.064),(0,-.426,2.074),(.04,-.407,2.064)],.012,M['leather'])

# Geometry wool fibers sampled on evaluated surfaces: editable, not a screen-space filter.
bpy.context.view_layer.update()
def fibers(o,count,mat):
 dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();tris=list(me.loop_triangles);total=0;cdf=[]
 for tri in tris:total+=tri.area;cdf.append(total)
 if not total:ev.to_mesh_clear();return
 cu=bpy.data.curves.new(o.name+' / wool fibers','CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=.00065;cu.bevel_resolution=0;cu.resolution_u=1
 matrix=o.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
 for i in range(count):
  tri=tris[min(len(tris)-1,bisect_left(cdf,random.random()*total))];a,b,c=[me.vertices[j].co for j in tri.vertices];u=random.random();v=random.random()
  if u+v>1:u=1-u;v=1-v
  p=matrix@(a+(b-a)*u+(c-a)*v);normal=(normal_matrix@tri.normal).normalized();tangent=normal.cross(Vector((random.random(),random.random(),random.random()))).normalized();length=random.uniform(.005,.014)
  sp=cu.splines.new('POLY');sp.points.add(2)
  for pt,vv in zip(sp.points,[p,p+normal*length*.65+tangent*length*.2,p+normal*length+tangent*length*.65]):pt.co=(*vv,1)
 ob=bpy.data.objects.new(o.name+' / fine wool nap',cu);model.objects.link(ob);cu.materials.append(mat);ob['detail']='Editable geometric wool fibers; optional at runtime distance';ev.to_mesh_clear()
for o,count,mat in fur_jobs:fibers(o,count,mat)

# A minimal felt-topped display base, separate from the model export.
base=material('Studio / muted sage base','#687659',.9,True);rim=material('Studio / walnut plinth','#58402e',.65,False);back=material('Studio / warm parchment','#bdb49b',.9,False)
bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=.99,depth=.13,location=(0,0,-.04));o=finish(bpy.context.object,'Display / walnut disk',rim,studio);b=o.modifiers.new('Rounded wooden rim','BEVEL');b.width=.04;b.segments=4
bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=.95,depth=.035,location=(0,0,.042));o=finish(bpy.context.object,'Display / moss felt top',base,studio);b=o.modifiers.new('Rounded felt edge','BEVEL');b.width=.025;b.segments=3
# Tiny stitches on the pedestal emphasize scale.
for i in range(72):
 a=2*pi*i/72;path('Display / stitch',[(.90*cos(a),.90*sin(a),.067),(.90*cos(a+.029),.90*sin(a+.029),.067)],.004,M['thread'],collection=studio)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.12));finish(bpy.context.object,'Studio / seamless floor',back,studio)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.45,.50,.43,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.32

def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size,color_rgb):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color_rgb;o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;aim(o,(0,0,1.1))
light('Key / large warm window',(-3,-4,5),430,4,(1,.87,.68));light('Fill / soft cool card',(3,-2,2.8),180,3,(.77,.87,1));light('Rim / warm fiber edge',(1.8,2.5,4),500,2.6,(1,.88,.65))
camdata=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',camdata);studio.objects.link(cam);bpy.context.scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=3.05;camdata.lens=60
scene=bpy.context.scene;scene.render.engine=opt.engine
if opt.engine=='CYCLES':scene.cycles.samples=opt.samples;scene.cycles.use_denoising=True;scene.cycles.max_bounces=5;scene.cycles.diffuse_bounces=3
scene.render.resolution_x=opt.size;scene.render.resolution_y=opt.size;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
views={'hero':((3.4,-6,3.0),(0,0,1.1)), 'front':((0,-6,2.5),(0,0,1.1)), 'side':((6,-.3,2.65),(0,0,1.1)), 'game':((2.5,-5,6.4),(0,0,1.05)), 'rear':((3.8,5,3.0),(0,0,1.1))}
cam.location=views['hero'][0];aim(cam,views['hero'][1]);scene['asset_status']='First visual candidate; not accepted; geometry wool included; no generated image used in renders.';scene['reference']='scenes/rongboy/reference/target-v1.png';scene['front_axis']='-Y, Z up'
# Native file opens on the whole figurine, with model and studio in separate collections.
root=bpy.data.objects.new('RONGBOY / figurine root',None);model.objects.link(root)
for ob in list(model.objects):
 if ob!=root:ob.parent=root
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_perspective='CAMERA'
   area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/rongboy-scout-v1.blend')
meta={'blender':bpy.app.version_string,'status':'visual candidate','model_objects':len(model.objects),'wool_fiber_count':sum(n for _,n,_ in fur_jobs),'views':{},'render_engine':opt.engine,'samples':opt.samples}
for name in opt.views.split(','):
 cam.location=views[name][0];aim(cam,views[name][1]);camdata.ortho_scale=3.05 if name!='game' else 3.18;scene.render.filepath=OUT+'/renders/'+name+'.png';bpy.ops.render.render(write_still=True);meta['views'][name]=scene.render.filepath
with open(OUT+'/manifest.json','w') as f:json.dump(meta,f,indent=2)
print('RONGBOY_DONE '+json.dumps(meta))
