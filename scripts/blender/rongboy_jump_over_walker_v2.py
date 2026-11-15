"""Two native Blender figurines, one checkers-style jump-kill, two fixed cameras.
Uses scout-motion-v1 rig and appends walker-v1; existing accepted scout files are read only.
"""
import bpy,os,sys,math,json,random,argparse
from mathutils import Vector
from math import sin,cos,pi,exp
p=argparse.ArgumentParser();p.add_argument('--render',action='store_true');p.add_argument('--checks',default='');p.add_argument('--start',type=int,default=1);p.add_argument('--end',type=int,default=192);p.add_argument('--size',type=int,default=960);p.add_argument('--samples',type=int,default=12);o=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=os.path.abspath('assets/rongboy/jump-over-walker-v2');os.makedirs(OUT+'/frames',exist_ok=True);os.makedirs(OUT+'/checks',exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.abspath('assets/rongboy/scout-motion-v1/rongboy-scout-motion-v1.blend'))
scene=bpy.context.scene;scene.frame_set(1)
ctl=bpy.data.collections['ANIMATION / rigid puppet controls'];scout=list(ctl.objects)
rest={'CTRL / ground motion':(0,0,0),'CTRL / body':(0,0,.73),'CTRL / head':(0,-.025,1.23),'CTRL / hat':(0,0,1.88),'CTRL / backpack':(0,.30,1.05)}
for s in [-1,1]:
 rest['CTRL / arm '+str(s)]=(s*.31,0,1.14);rest['CTRL / leg '+str(s)]=(s*.205,.025,.67);rest['CTRL / boot '+str(s)]=(s*.205,.02,.24)
for ob in scout:ob.animation_data_clear();ob.location=rest[ob.name];ob.rotation_euler=(0,0,0);ob.scale=(1,1,1)
bpy.context.view_layer.update()
# Only append the character collection, using the scout's existing lights and scene.
with bpy.data.libraries.load(os.path.abspath('assets/rongboy/walker-v1/rongboy-walker-v1.blend'),link=False) as (a,b):b.collections=['RONGBOY / Walker figurine']
walker=b.collections[0];scene.collection.children.link(walker);wroot=next(x for x in walker.objects if x.name.startswith('Walker / figurine root'))
wc=bpy.data.collections.new('ANIMATION / walker controls');scene.collection.children.link(wc)
def control(name,pos,parent):
 ob=bpy.data.objects.new(name,None);wc.objects.link(ob);ob.empty_display_type='SPHERE';ob.empty_display_size=.06;ob.location=pos;bpy.context.view_layer.update();mw=ob.matrix_world.copy();ob.parent=parent;ob.matrix_parent_inverse=parent.matrix_world.inverted();ob.matrix_world=mw;return ob
wbody=control('WCTRL / body',(0,.03,.70),wroot);whead=control('WCTRL / head',(0,-.015,1.25),wbody);wa={s:control('WCTRL / arm '+str(s),(s*.30,0,1.23),wbody) for s in [-1,1]};wl={s:control('WCTRL / leg '+str(s),(s*.18,.02,.66),wroot) for s in [-1,1]}
bpy.context.view_layer.update();mapping={}
for ob in list(walker.objects):
 if ob==wroot:continue
 part=ob.get('rig_part','body');parent=whead if part=='head' else wa[-1] if part=='armL' else wa[1] if part=='armR' else wl[-1] if part=='legL' else wl[1] if part=='legR' else wbody
 mw=ob.matrix_world.copy();ob.parent=parent;ob.matrix_parent_inverse=parent.matrix_world.inverted();ob.matrix_world=mw;mapping[ob.name]=parent.name
winitial={ob.name:(ob.location.copy(),ob.rotation_euler.copy(),ob.scale.copy()) for ob in wc.objects}
# Soft stuffing burst + cloth remnant. Hand-authored toy feedback, no gore.
fx=bpy.data.collections.new('FX / felt stuffing and remnant');scene.collection.children.link(fx);random.seed(73)
wmats={m.name:m for m in bpy.data.materials}
def findmat(prefix):return next(m for m in bpy.data.materials if m.name.startswith(prefix))
cream=findmat('Cotton / oatmeal stitching');green=findmat('Walker / moss green wool');ochre=findmat('Walker / ochre wooden button');dark=findmat('Walker / dark sewn button')
def ball(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=loc);ob=bpy.context.object;ob.name=name;ob.scale=scale
 for c in list(ob.users_collection):c.objects.unlink(ob)
 fx.objects.link(ob);ob.data.materials.append(mat)
 for q in ob.data.polygons:q.use_smooth=True
 return ob
# Separate contact fibers and a delayed wool poof around the fallen torso.
puffs=[]
for i in range(44):
 ob=ball('Wool FX / tuft '+str(i),(0,0,0),(1,1,1),cream if i%4 else green)
 angle=random.uniform(0,2*pi)
 if i<10:
  origin=Vector((-.08,.15,1.91));v=Vector((random.uniform(.2,.7),random.uniform(-.35,.5),random.uniform(.3,.9)));born=35.5;life=.43;r=random.uniform(.012,.026)
 else:
  origin=Vector((random.uniform(-.5,.12),random.uniform(.15,1.6),random.uniform(.16,.4)));v=Vector((cos(angle)*random.uniform(.25,.65),sin(angle)*random.uniform(.25,.65),random.uniform(.4,1.0)));born=56;life=.65;r=random.uniform(.033,.064)
 # Fine curled strands give each tuft a wool silhouette instead of a smooth pellet.
 for strand in range(9):
  cu=bpy.data.curves.new('Tuft / curled wool','CURVE');cu.dimensions='3D';cu.bevel_depth=.027;cu.bevel_resolution=0;sp=cu.splines.new('POLY');sp.points.add(5)
  a=random.uniform(0,2*pi);offset=random.uniform(-.45,.45)
  for j,pt in enumerate(sp.points):
   t=j/5;rr=.25+t*.90;pt.co=(rr*cos(a+t*.9),rr*sin(a+t*.9),offset+.50*sin(t*pi*1.4+strand),1)
  fiber=bpy.data.objects.new('Tuft / wool strand',cu);fx.objects.link(fiber);cu.materials.append(cream if i%4 else green);fiber.parent=ob
 puffs.append((ob,origin,v,born,life,r))
dead=bpy.data.objects.new('FX / small wool traces',None);fx.objects.link(dead)
# Small irregular clumps, instead of the old flattened head-shaped disk.
for i in range(9):
 ob=ball('Loose wool trace',((i-4)*.035,random.uniform(-.12,.12),.055),(.022,.017,.025),cream if i%3 else green);ob.parent=dead
buttons=[]
for i,(mat,target) in enumerate([(ochre,Vector((-.17,-.12,.065))),(dark,Vector((.15,.12,.055)))]):
 br=bpy.data.objects.new('FX / loose button '+str(i),None);fx.objects.link(br)
 ob=ball('Detached wooden button',(0,0,0),(.075 if i==0 else .06,.075 if i==0 else .06,.018),mat);ob.parent=br
 # Sewn X retained on the small loose buttons.
 for sign in [-1,1]:
  cu=bpy.data.curves.new('Loose button thread','CURVE');cu.dimensions='3D';cu.bevel_depth=.004;cu.bevel_resolution=1;sp=cu.splines.new('POLY');sp.points.add(1)
  sp.points[0].co=(-.031,-sign*.031,.021,1);sp.points[1].co=(.031,sign*.031,.021,1)
  line=bpy.data.objects.new('Loose button X',cu);fx.objects.link(line);cu.materials.append(dark if i==0 else cream);line.parent=br
 buttons.append((br,target))
root=bpy.data.objects['CTRL / ground motion'];body=bpy.data.objects['CTRL / body'];head=bpy.data.objects['CTRL / head'];hat=bpy.data.objects['CTRL / hat'];pack=bpy.data.objects['CTRL / backpack'];arms={s:bpy.data.objects['CTRL / arm '+str(s)] for s in [-1,1]};legs={s:bpy.data.objects['CTRL / leg '+str(s)] for s in [-1,1]};feet={s:bpy.data.objects['CTRL / boot '+str(s)] for s in [-1,1]}
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
walkerparts=[ob for ob in walker.objects if ob!=wroot]
walkermeshes=[ob for ob in walkerparts if ob.type=='MESH']
def pose(local):
 # Two extra contact frames: a short hit pause before the fall starts.
 f=local if local<=36 else 36 if local<=38 else local-2
 for ob in scout:ob.location=rest[ob.name];ob.rotation_euler=(0,0,0);ob.scale=(1,1,1)
 for ob in wc.objects:
  a,b,c=winitial[ob.name];ob.location=a;ob.rotation_euler=b;ob.scale=c
 flight=0;z=0;x=-1.55;crouch=0;land=0
 if f<28:crouch=smooth((f-18)/9)
 elif f<=48:
  t=(f-28)/20;flight=sin(pi*t);x=-1.55+3.10*smooth(t);z=1.95*4*t*(1-t)
 else:x=1.55;land=sin(pi*min(1,(f-48)/10))
 root.location=(x,0,z)
 # Model front is local -Y. +pi/2 points it exactly along world +X.
 root.rotation_euler.z=(pi/2)*smooth((local-5)/11)
 body.location.z+=-.13*crouch-.13*land+.008*sin(f*.22)*(1-flight)
 body.scale=(1+.045*(crouch+land),1+.02*(crouch+land),1-.06*(crouch+land));body.rotation_euler.x=.20*crouch+.16*flight-.08*land
 head.rotation_euler.x=-.10*crouch-.11*flight+.045*land;head.scale.z=1/body.scale.z
 head.rotation_euler.z=.10*sin(pi*smooth((local-3)/14))-.08*smooth((f-60)/10)
 hat.rotation_euler.x=.022*sin(f*.35)*flight+.022*land;pack.rotation_euler.x=.06*crouch-.065*flight
 if f>48:pack.rotation_euler.x+=.065*exp(-(f-48)/8)*sin((f-48)*.65)
 for s in [-1,1]:
  arms[s].rotation_euler.x=.28*crouch-.78*flight+.13*land;arms[s].rotation_euler.y=-s*(.12*crouch+.48*flight+.13*land)
  legs[s].rotation_euler.x=(.46 if s<0 else -.29)*flight;feet[s].rotation_euler.x=(-.30 if s<0 else .14)*flight+.07*land
 # Full-volume knockdown: impulse, loss of balance, then a diagonal fall away from the landing lane.
 kick=smooth((f-35)/3);fall=smooth((f-38)/14);visible=f<63
 wroot.location=(.055*kick+.10*fall,.025*kick+.14*fall,0)
 wroot.rotation_euler=(-1.43*fall,.08*kick*(1-fall),-.30+.74*fall+.07*kick*(1-fall));wroot.scale=(1,1,1)
 wbody.rotation_euler.x=.075+.015*sin(f*.20)+.16*kick*(1-fall)
 wbody.scale=(1+.018*kick*(1-fall),1,1-.035*kick*(1-fall))
 whead.rotation_euler.x=-.025-.20*kick+.06*fall;whead.rotation_euler.z=-.12-.14*kick
 for s in [-1,1]:
  wa[s].rotation_euler.x=-.10-.035*sin(f*.17+s)-.50*kick+.20*fall
  wa[s].rotation_euler.y=-s*(.04+.70*kick);wl[s].rotation_euler.x=(-.55 if s<0 else -.35)*fall;wl[s].rotation_euler.y=-s*.18*fall
 for ob in walkerparts:ob.hide_render=not visible
 # Preserve shape while placing the falling toy against the felt floor.
 # Mesh vertices suffice here: wool nap is only sub-centimeter thickness.
 ground_min=None
 if fall>0 and visible:
  bpy.context.view_layer.update();required=0;lowest_clearance=100
  for ob in walkermeshes:
   m=ob.matrix_world
   for v in ob.data.vertices:
    a=v.co;wx=m[0][0]*a.x+m[0][1]*a.y+m[0][2]*a.z+m[0][3];wy=m[1][0]*a.x+m[1][1]*a.y+m[1][2]*a.z+m[1][3];wz=m[2][0]*a.x+m[2][1]*a.y+m[2][2]*a.z+m[2][3]
    floor=.025 if abs(wy)<=.60 and min(abs(wx-1.55),abs(wx),abs(wx+1.55))<=.675 else -.12
    clearance=wz-floor;lowest_clearance=min(lowest_clearance,clearance);required=max(required,-clearance)
  lift=max(0,required);wroot.location.z+=lift;ground_min=lowest_clearance+lift
 dead.scale=(max(.001,smooth((f-57)/6)),)*3
 for i,(br,target) in enumerate(buttons):
  t=smooth((f-56-i)/12);origin=Vector((-.30,1.05,.30));br.location=origin.lerp(target,t);br.location.z+=.28*sin(pi*t)
  br.rotation_euler=(.40*sin(pi*t),.65*sin(pi*t),i*.8+4.0*t);size=max(.001,smooth((f-56-i)/2));br.scale=(size,)*3
 for ob,origin,v,born,life,r in puffs:
  t=max(0,(f-born)/24);active=0 if f<born else smooth((f-born)/1.5)*(1-smooth((t-life*.5)/(life*.5)))
  ob.location=origin+v*t+Vector((0,0,-3.4*t*t));ob.location.z=max(.04,ob.location.z)
  size=max(.0001,r*active);ob.scale=(size,size*.9,size*1.1);ob.rotation_euler=v.to_track_quat('Z','Y').to_euler()
 return {'local_frame':local,'action_frame':f,'scout_position':[x,0,z],'heading_radians':float(root.rotation_euler.z),'hit':kick,'fall':fall,'zombie_visible':visible,'zombie_scale':[float(q) for q in wroot.scale],'zombie_ground_min':ground_min,'landing':land}
scene.render.engine='CYCLES';scene.cycles.samples=o.samples;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.render.use_persistent_data=True;scene.render.fps=24;scene.frame_start=1;scene.frame_end=192;scene.render.resolution_x=o.size;scene.render.resolution_y=round(o.size*5/8);scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
camera=scene.camera;camera.animation_data_clear();camera.data.ortho_scale=8.15
allanimated=scout+list(wc.objects)+[wroot,dead]+[q[0] for q in puffs]+[q[0] for q in buttons]
def aim(ob,p):ob.rotation_euler=(Vector(p)-ob.location).to_track_quat('-Z','Y').to_euler()
poses=[]
for f in range(1,193):
 scene.frame_set(f);state=pose((f-1)%96+1);state['timeline_frame']=f;poses.append(state)
 for ob in allanimated:
  for key in ['location','rotation_euler','scale']:ob.keyframe_insert(data_path=key,frame=f,group=ob.name)
 if f in [1,64,65,96,97,160,161,192]:
  for ob in walkerparts:ob.keyframe_insert(data_path='hide_render',frame=f)
 camera.location=(5.0,-8,5.3) if f<=96 else (2.2,-6,8.5);aim(camera,(0,0,2.10 if f<=96 else 1.85));camera.keyframe_insert(data_path='location',frame=f);camera.keyframe_insert(data_path='rotation_euler',frame=f)
# Check actual evaluated actor bounds at anticipation, contact, landing and camera cut.
from bpy_extras.object_utils import world_to_camera_view
framing=[]
actors=[q for col in [bpy.data.collections['RONGBOY / Scout figurine'],walker] for q in col.objects if q.type == 'MESH']
for frame in [1,16,27,35,36,38,40,42,48,50,56,64,65,97,112,124,132,134,136,138,144,146,152,160,161]:
 scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();points=[]
 for q in actors:
  if q.hide_render:continue
  ev=q.evaluated_get(dg)
  points.extend(world_to_camera_view(scene,camera,ev.matrix_world@Vector(corner)) for corner in ev.bound_box)
 bounds=[min(v.x for v in points),min(v.y for v in points),max(v.x for v in points),max(v.y for v in points)]
 framing.append({'frame':frame,'bounds_uv':bounds})
with open(OUT+'/camera-checks.json','w') as h:json.dump(framing,h,indent=2)
assert all(min(q['bounds_uv'][:2])>=0 and max(q['bounds_uv'][2:])<=1 for q in framing), 'Actor outside camera bounds; inspect camera-checks.json'
direction_checks=[]
for frame in [28,32,35,36,38,42,48,50,124,128,132,134,138,144,146]:
 scene.frame_set(frame);bpy.context.view_layer.update();forward=root.matrix_world.to_3x3()@Vector((0,-1,0));forward.z=0;forward.normalize()
 bootdots=[]
 for boot in feet.values():
  toe=boot.matrix_world.to_3x3()@Vector((0,-1,0));toe.z=0;toe.normalize();bootdots.append(float(toe.x))
 direction_checks.append({'frame':frame,'forward_dot_world_plus_x':float(forward.x),'boots_min_forward_dot':min(bootdots),'heading_radians':float(root.rotation_euler.z)})
assert all(c['forward_dot_world_plus_x']>.999 and c['boots_min_forward_dot']>.98 for c in direction_checks),'Scout heading does not follow jump lane'
with open(OUT+'/direction-checks.json','w') as h:json.dump(direction_checks,h,indent=2)
scene.frame_set(1);scene['preview_status']='Native Blender interaction candidate; not user approved';scene['action']='Scout turns to +X before takeoff; facing follows jump and landing. Two-frame contact pause. Walker keeps full volume, topples and vanishes in a wool poof. Replay from game camera at 97.'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/rongboy-jump-over-walker-v2.blend')
with open(OUT+'/manifest.json','w') as h:json.dump({'fps':24,'frames':192,'resolution':[o.size,round(o.size*5/8)],'source_scout':'assets/rongboy/scout-motion-v1/rongboy-scout-motion-v1.blend','source_walker':'assets/rongboy/walker-v1/rongboy-walker-v1.blend','camera_cut':97,'hit_frame':36,'contact_hold_frames':[36,37,38],'landing_frame':50,'walker_hidden_frame':65,'walker_parts':len(mapping),'poses':poses},h,indent=2)
if o.checks:
 for f in map(int,o.checks.split(',')):
  scene.frame_set(f);scene.render.filepath=OUT+f'/checks/{f:04d}.png';bpy.ops.render.render(write_still=True)
elif o.render:
 for f in range(o.start,o.end+1):
  target=OUT+f'/frames/{f:04d}.png'
  if os.path.exists(target):continue
  scene.frame_set(f);scene.render.filepath=target;bpy.ops.render.render(write_still=True)
print('JUMP_OVER_WALKER_DONE',OUT)
