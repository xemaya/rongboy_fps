"""Two native Blender figurines, one checkers-style jump-kill, two fixed cameras.
Uses scout-motion-v1 rig and appends walker-v1; existing accepted scout files are read only.
"""
import bpy,os,sys,math,json,random,argparse
from mathutils import Vector
from math import sin,cos,pi,exp
p=argparse.ArgumentParser();p.add_argument('--render',action='store_true');p.add_argument('--checks',default='');p.add_argument('--start',type=int,default=1);p.add_argument('--end',type=int,default=192);p.add_argument('--size',type=int,default=960);p.add_argument('--samples',type=int,default=12);o=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=os.path.abspath('assets/rongboy/jump-over-walker-v1');os.makedirs(OUT+'/frames',exist_ok=True);os.makedirs(OUT+'/checks',exist_ok=True)
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
puffs=[]
for i in range(18):
 ob=ball('Stuffing / tuft '+str(i),(0,0,0),(1,1,1),cream if i%3 else green);angle=random.uniform(0,2*pi);puffs.append((ob,Vector((cos(angle)*random.uniform(.3,1),sin(angle)*random.uniform(.3,.8),random.uniform(.7,1.6))),random.uniform(.024,.045)))
dead=bpy.data.objects.new('FX / flat felt remnant',None);fx.objects.link(dead)
for name,loc,scale,mat in [('Felt scrap',(.02,0,.075),(.45,.29,.045),green),('Amber button',(-.14,-.10,.132),(.083,.083,.025),ochre),('Dark button',(.17,.05,.122),(.065,.065,.022),dark)]:
 ob=ball(name,loc,scale,mat);ob.parent=dead
# A few curled fibers on the remnant make the remaining spot read as soft fabric.
for i in range(7):
 ob=ball('Loose cotton',((i-3)*.075,.07*sin(i*2),.11),(.025,.02,.017),cream);ob.parent=dead
root=bpy.data.objects['CTRL / ground motion'];body=bpy.data.objects['CTRL / body'];head=bpy.data.objects['CTRL / head'];hat=bpy.data.objects['CTRL / hat'];pack=bpy.data.objects['CTRL / backpack'];arms={s:bpy.data.objects['CTRL / arm '+str(s)] for s in [-1,1]};legs={s:bpy.data.objects['CTRL / leg '+str(s)] for s in [-1,1]};feet={s:bpy.data.objects['CTRL / boot '+str(s)] for s in [-1,1]}
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def pose(f):
 for ob in scout:ob.location=rest[ob.name];ob.rotation_euler=(0,0,0);ob.scale=(1,1,1)
 for ob in wc.objects:
  a,b,c=winitial[ob.name];ob.location=a;ob.rotation_euler=b;ob.scale=c
 flight=0;z=0;x=-1.55;crouch=0;land=0
 if f<28:crouch=smooth((f-18)/9)
 elif f<=48:
  t=(f-28)/20;flight=sin(pi*t);x=-1.55+3.10*smooth(t);z=1.95*4*t*(1-t)
 else:x=1.55;land=sin(pi*min(1,(f-48)/10))
 root.location=(x,0,z);root.rotation_euler.z=.70*flight
 body.location.z+=-.13*crouch-.13*land+.008*sin(f*.22)*(1-flight)
 body.scale=(1+.045*(crouch+land),1+.02*(crouch+land),1-.06*(crouch+land));body.rotation_euler.x=.15*crouch-.16*flight+.10*land
 head.rotation_euler.x=-.07*crouch+.07*flight-.055*land;head.scale.z=1/body.scale.z;head.rotation_euler.z=.08*flight-.27*smooth((f-60)/10)*(1-smooth((f-87)/9))
 hat.rotation_euler.x=.028*sin(f*.35)*flight+.026*land;pack.rotation_euler.x=.05*crouch-.075*flight
 if f>48:pack.rotation_euler.x+=.075*exp(-(f-48)/8)*sin((f-48)*.65)
 for s in [-1,1]:
  arms[s].rotation_euler.x=.28*crouch-.78*flight+.13*land;arms[s].rotation_euler.y=-s*(.12*crouch+.48*flight+.13*land)
  legs[s].rotation_euler.x=(.46 if s<0 else -.29)*flight;feet[s].rotation_euler.x=(-.30 if s<0 else .14)*flight+.07*land
 # React just as the leading boot reaches the head, then fold into a cloth scrap.
 hit=smooth((f-35)/7);fade=smooth((f-44)/6);alive=max(.001,1-fade)
 wroot.location=(.07*hit,0,0);wroot.rotation_euler=(0,0,-.09*hit);wroot.scale=((1+.28*hit)*alive,(1+.22*hit)*alive,max(.001,(1-.88*hit)*alive))
 wbody.rotation_euler.x=.075+.018*sin(f*.20)+.20*hit;whead.rotation_euler.x=-.025+.19*hit;whead.rotation_euler.z=.035*sin(f*.15)-.18*hit
 for s in [-1,1]:
  wa[s].rotation_euler.x=-.10-.04*sin(f*.17+s)-.5*hit;wa[s].rotation_euler.y=-s*(.04+.95*hit);wl[s].rotation_euler.y=-s*.30*hit
 dead.scale=(max(.001,smooth((f-41)/7)),)*3
 for ob,v,r in puffs:
  t=max(0,(f-36)/24);appear=smooth((f-35)/2)*(1-smooth((f-51)/12));ob.location=Vector((0,0,1.65))+v*t+Vector((0,0,-3.7*t*t));ob.location.z=max(.08,ob.location.z);ob.scale=(max(.0001,r*appear),)*3
 return {'local_frame':f,'scout_position':[x,0,z],'hit':hit,'zombie_scale_z':float(wroot.scale.z),'landing':land}
scene.render.engine='CYCLES';scene.cycles.samples=o.samples;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.render.use_persistent_data=True;scene.render.fps=24;scene.frame_start=1;scene.frame_end=192;scene.render.resolution_x=o.size;scene.render.resolution_y=round(o.size*5/8);scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
camera=scene.camera;camera.animation_data_clear();camera.data.ortho_scale=8.15
allanimated=scout+list(wc.objects)+[wroot,dead]+[q[0] for q in puffs]
def aim(ob,p):ob.rotation_euler=(Vector(p)-ob.location).to_track_quat('-Z','Y').to_euler()
poses=[]
for f in range(1,193):
 scene.frame_set(f);state=pose((f-1)%96+1);state['timeline_frame']=f;poses.append(state)
 for ob in allanimated:
  for key in ['location','rotation_euler','scale']:ob.keyframe_insert(data_path=key,frame=f,group=ob.name)
 camera.location=(3.4,-8,4.8) if f<=96 else (2.2,-6,8.5);aim(camera,(0,0,2.10 if f<=96 else 1.85));camera.keyframe_insert(data_path='location',frame=f);camera.keyframe_insert(data_path='rotation_euler',frame=f)
# Check actual evaluated actor bounds at anticipation, contact, landing and camera cut.
from bpy_extras.object_utils import world_to_camera_view
framing=[]
actors=[q for col in [bpy.data.collections['RONGBOY / Scout figurine'],walker] for q in col.objects if q.type == 'MESH']
for frame in [1,27,35,38,41,48,60,97,124,134,144,156]:
 scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();points=[]
 for q in actors:
  ev=q.evaluated_get(dg)
  points.extend(world_to_camera_view(scene,camera,ev.matrix_world@Vector(corner)) for corner in ev.bound_box)
 bounds=[min(v.x for v in points),min(v.y for v in points),max(v.x for v in points),max(v.y for v in points)]
 framing.append({'frame':frame,'bounds_uv':bounds})
with open(OUT+'/camera-checks.json','w') as h:json.dump(framing,h,indent=2)
assert all(min(q['bounds_uv'][:2])>=0 and max(q['bounds_uv'][2:])<=1 for q in framing), 'Actor outside camera bounds; inspect camera-checks.json'
scene.frame_set(1);scene['preview_status']='Native Blender interaction candidate; not user approved';scene['action']='Scout jumps over walker. Felt hit at local frame 36; landing 48; same action replayed from game camera at frame 97.'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/rongboy-jump-over-walker-v1.blend')
with open(OUT+'/manifest.json','w') as h:json.dump({'fps':24,'frames':192,'resolution':[o.size,round(o.size*5/8)],'source_scout':'assets/rongboy/scout-motion-v1/rongboy-scout-motion-v1.blend','source_walker':'assets/rongboy/walker-v1/rongboy-walker-v1.blend','camera_cut':97,'hit_frame':36,'landing_frame':48,'walker_parts':len(mapping),'poses':poses},h,indent=2)
if o.checks:
 for f in map(int,o.checks.split(',')):
  scene.frame_set(f);scene.render.filepath=OUT+f'/checks/{f:04d}.png';bpy.ops.render.render(write_still=True)
elif o.render:
 for f in range(o.start,o.end+1):
  target=OUT+f'/frames/{f:04d}.png'
  if os.path.exists(target):continue
  scene.frame_set(f);scene.render.filepath=target;bpy.ops.render.render(write_still=True)
print('JUMP_OVER_WALKER_DONE',OUT)
