"""Felt walker zombie model; reference is the original zombie_walker sprite.
Blender 5.1 native asset. No generated image used in output renders.
"""
import bpy,os,sys,math,json
from mathutils import Vector
from math import sin,cos,pi,sqrt
sys.path.insert(0,os.path.dirname(__file__))
import rongboy_figure_kit as k
from rongboy_figure_kit import uv,cube,path,stitches,material
OUT=os.path.abspath('assets/rongboy/walker-v1');os.makedirs(OUT+'/renders',exist_ok=True)
M=k.M
M.update(skin=material('Walker / moss green wool','#85865b'),skinlight=material('Walker / faded green wool','#96966b'),patch=material('Walker / dark moss felt patch','#505b3e'),vest=material('Walker / worn chestnut felt vest','#68513a'),pants=material('Walker / plum brown cloth','#655258'),button=material('Walker / ochre wooden button','#c89a3e',.7,False),buttondark=material('Walker / dark sewn button','#51493e',.8,False),stitch=material('Walker / charcoal yarn','#393d2a'),tooth=material('Walker / oat felt teeth','#dfcda3'),mouth=material('Walker / mouth wool inset','#353225'))
# Feet, long soft trousers and patchwork knees.
for s in [-1,1]:
 x=s*.18
 uv(f'Leg {s} / felt foot',(x,-.105,.145),(.16,.245,.12),M['skin'],fur=700)
 uv(f'Leg {s} / dark sole',(x,-.10,.063),(.163,.247,.045),M['sole'])
 uv(f'Leg {s} / trouser',(x,.018,.47),(.135,.155,.34),M['pants'],fur=1300)
 # Rounded cloth knee patch and deliberately uneven stitches.
 patchmat=M['patch'] if s<0 else M['button'];patchx=x-s*.025
 cube(f'Leg {s} / stitched knee patch',(patchx,-.139,.46),(.17,.029,.18),patchmat,.04,rot=(0,s*.12,s*.12),fur=250)
 stitches(f'Leg {s} / knee stitches',[(patchx-.067,-.163,.53),(patchx-.073,-.167,.39),(patchx+.064,-.163,.39),(patchx+.071,-.161,.52)],19,.022,M['tooth'])
 for j in [-1,0,1]:
  path(f'Leg {s} / toe seam',[(x+j*.06,-.322,.112),(x+j*.065,-.33,.166),(x+j*.06,-.31,.202)],.004,M['stitch'])
 # Short ragged felt tips, a shallow silhouette rather than flat printed wear.
 for j in range(5):
  a=2*pi*j/5;uv(f'Leg {s} / frayed cuff',(x+.112*cos(a),.018+.13*sin(a),.235+(j%2)*.025),(.045,.04,.075),M['pants'],fur=90)
# Narrow hunched torso, open ragged vest and sewn skin repair.
uv('Body / soft green torso',(0,.035,.98),(.29,.205,.36),M['skin'],fur=2300)
uv('Body / vest back',(0,.14,1.0),(.315,.145,.34),M['vest'],fur=900)
for s in [-1,1]:
 uv('Body / vest side',(s*.255,.025,1.0),(.09,.18,.30),M['vest'],fur=400)
 # Lapel with an uneven outline, following the rounded chest.
 points=[(s*.28,1.29),(s*.15,1.25),(s*.06,1.18),(s*.10,1.06),(s*.065,.78),(s*.12,.72),(s*.20,.77),(s*.26,.72),(s*.285,.85)]
 verts=[]
 for x,z in points:
  yy=-.205*sqrt(max(.12,1-(x/.36)**2))-.014;verts.append((x,yy,z))
 me=bpy.data.meshes.new('Ragged lapel');me.from_pydata(verts,[],[tuple(range(len(verts)))]);o=bpy.data.objects.new('Body / ragged felt lapel',me);k.model.objects.link(o);k.finish(o,o.name,M['vest']);so=o.modifiers.new('Thick felt panel','SOLIDIFY');so.thickness=.026;be=o.modifiers.new('Soft worn edges','BEVEL');be.width=.014;be.segments=3;k.fur_jobs.append((o,450,M['vest']))
for z in [.83,.92,1.01,1.10]:
 path('Body / zigzag repair',[(-.035,-.219,z-.022),(.033,-.219,z+.022)],.007,M['stitch'])
# Drooping reach: thin upper arm, padded forearm, mitten fingers.
for s in [-1,1]:
 uv(f'Arm {s} / upper',(s*.34,-.035,1.115),(.104,.12,.21),M['skin'],fur=650,rot=(-.24,s*.10,0))
 uv(f'Arm {s} / forearm',(s*.365,-.13,.875),(.105,.135,.21),M['skin'],fur=800,rot=(-.28,s*.07,0))
 uv(f'Arm {s} / palm',(s*.376,-.225,.69),(.118,.11,.13),M['skin'],fur=450)
 for j in range(3):
  xx=s*.376+(j-1)*.064;uv(f'Arm {s} / finger',(xx,-.273,.616+(j==0)*.018),(.043,.057,.082),M['skin'],fur=80)
 uv(f'Arm {s} / thumb',(s*.285,-.225,.707),(.051,.07,.078),M['skin'],fur=100)
 stitches(f'Arm {s} / sewn scar',[(s*.365,-.251,1.07),(s*.39,-.269,.98),(s*.38,-.278,.89)],6,.040,M['stitch'])
# Rounded patchwork head with button eyes and crooked stuffed-cloth teeth.
HZ=1.61;R=.43;DY=.325
def front(x,z,offset=.006):return -.015-DY*sqrt(max(.01,1-(x/R)**2-((z-HZ)/R)**2))-offset
uv('Head / green wool face',(0,-.015,HZ),(.43,DY,.43),M['skin'],fur=4600)
for s in [-1,1]:
 uv('Head / ear',(s*.419,-.005,1.60),(.085,.077,.11),M['skin'],fur=220)
 uv('Head / ear center',(s*.45,-.066,1.60),(.034,.02,.054),M['patch'],fur=60)
# Curved forehead patch follows head surface exactly.
verts=[];faces=[];nx=12;nz=10
for j in range(nz+1):
 t=j/nz;z=1.79+t*.19
 for i in range(nx+1):
  u=i/nx;zz=z+.008*sin(u*pi*4)*sin(t*pi);limit=R*sqrt(max(.01,1-((zz-HZ)/R)**2))*.94;x=.065+u*(min(.32,limit)-.065);verts.append((x,front(x,zz,.009),zz))
for j in range(nz):
 for i in range(nx):q=j*(nx+1)+i;faces.append((q,q+1,q+nx+2,q+nx+1))
me=bpy.data.meshes.new('Head patch curved');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Head / dark forehead patch',me);k.model.objects.link(o);k.finish(o,o.name,M['patch']);k.fur_jobs.append((o,500,M['patch']))
# Long stitched seam on the other side of the forehead.
seam=[(-.17-.045*sin(t*pi*2),front(-.17-.045*sin(t*pi*2),1.90-t*.36,.012),1.90-t*.36) for t in [i/30 for i in range(31)]];path('Head / repair seam',seam,.005,M['stitch'])
for j in range(9):
 z=1.885-j*.038;x=-.17-.045*sin(((1.90-z)/.36)*pi*2)
 path('Head / cross stitch',[(x-.022,front(x-.022,z-.006,.019),z-.006),(x+.021,front(x+.021,z+.006,.019),z+.006)],.005,M['stitch'])
for j in range(6):
 x=.10+j*.034;z=1.79+.008*sin(j)
 path('Head / patch stitch',[(x,front(x,z-.016,.019),z-.016),(x+.008,front(x+.008,z+.016,.019),z+.016)],.005,M['tooth'])
for x,z,radius,mat in [(-.15,1.68,.112,M['button']),(.158,1.65,.082,M['buttondark'])]:
 yy=front(x,z,.018);uv('Head / button eye',(x,yy,z),(radius,.028,radius),mat)
 path('Head / button rim',[(x+radius*.90*cos(a),yy-.023,z+radius*.90*sin(a)) for a in [2*pi*i/32 for i in range(33)]],.007,M['tooth'] if x<0 else M['vest'],True)
 for direction in [-1,1]:
  path('Head / X button thread',[(x-.039,yy-.030,z-direction*.039),(x+.039,yy-.030,z+direction*.039)],.007,M['stitch'] if x<0 else M['tooth'])
for s in [-1,1]:uv('Head / nose stitch',(s*.023,front(s*.023,1.535,.012),1.535),(.012,.009,.025),M['stitch'],rot=(0,s*.20,0))
uv('Head / mouth opening',(0,front(0,1.415,.009),1.415),(.19,.027,.093),M['mouth'])
for i,x in enumerate([-.125,-.052,.025,.115]):
 z=1.459+(.007 if i%2 else -.006);cube('Head / crooked upper felt tooth',(x,-.337,z),(.047,.027,.053 if i%2 else .043),M['tooth'],.009,rot=(0,(i-1.5)*.1,0))
for i,x in enumerate([-.078,.007,.09]):cube('Head / lower felt tooth',(x,-.329,1.364),(.041,.026,.037),M['tooth'],.009,rot=(0,(1-i)*.12,0))
# Add the same geometric wool nap used by the scout.
bpy.context.view_layer.update()
for ob,count,mat in k.fur_jobs:k.fibers(ob,count,mat)
root=bpy.data.objects.new('Walker / figurine root',None);k.model.objects.link(root)
for ob in list(k.model.objects):
 if ob==root:continue
 ob.parent=root
 n=ob.name
 ob['rig_part']='head' if n.startswith('Head /') else 'armL' if n.startswith('Arm -1') else 'armR' if n.startswith('Arm 1') else 'legL' if n.startswith('Leg -1') else 'legR' if n.startswith('Leg 1') else 'body'
# Match the scout's studio and display disk.
base=material('Studio / muted sage base','#687659');rim=material('Studio / walnut plinth','#58402e',.65,False);back=material('Studio / warm parchment','#bdb49b',.9,False)
for name,r,dep,z,mat in [('walnut',.88,.13,-.04,rim),('felt',.84,.035,.042,base)]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r,depth=dep,location=(0,0,z));ob=k.finish(bpy.context.object,'Display / '+name,mat,k.studio);b=ob.modifiers.new('Soft rim','BEVEL');b.width=.025;b.segments=4
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.12));k.finish(bpy.context.object,'Studio / seamless floor',back,k.studio)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.45,.50,.43,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.32
def aim(ob,p):ob.rotation_euler=(Vector(p)-ob.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size,col in [('Key',(-3,-4,5),430,4,(1,.87,.68)),('Fill',(3,-2,2.8),180,3,(.77,.87,1)),('Rim',(1.8,2.5,4),500,2.6,(1,.88,.65))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=col;ob=bpy.data.objects.new(name,d);k.studio.objects.link(ob);ob.location=loc;aim(ob,(0,0,1.0))
camera=bpy.data.objects.new('Walker / portrait camera',bpy.data.cameras.new('Walker / camera'));k.studio.objects.link(camera);camera.data.type='ORTHO';camera.data.ortho_scale=2.75
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
views={'hero':(3.1,-6,2.8),'front':(0,-6,2.3),'side':(6,-.3,2.4)};camera.location=views['hero'];aim(camera,(0,0,1.0));scene['asset_status']='First walker visual candidate; not accepted';scene['reference']='Original combo-hopper/public/sprites/zombie_walker.png'
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/rongboy-walker-v1.blend')
manifest={'source_reference':scene['reference'],'status':'visual candidate','objects':len(k.model.objects),'fiber_count':sum(j[1] for j in k.fur_jobs),'collection':k.model.name,'views':{}}
for name,loc in views.items():
 camera.location=loc;aim(camera,(0,0,1.0));scene.render.filepath=OUT+'/renders/'+name+'.png';bpy.ops.render.render(write_still=True);manifest['views'][name]=scene.render.filepath
with open(OUT+'/manifest.json','w') as h:json.dump(manifest,h,indent=2)
print('WALKER_DONE',OUT)
