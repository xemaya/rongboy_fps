"""Animate the accepted scout-v1 static model with an editable rigid-part control rig.
No source geometry/material replacement. Local Blender renders, not image-to-video.
"""
import bpy, math, os, sys, json, argparse
from mathutils import Vector
from math import sin,cos,pi,exp
p=argparse.ArgumentParser();p.add_argument('--out',default='assets/rongboy/scout-motion-v1');p.add_argument('--frames',default='');p.add_argument('--start',type=int,default=1);p.add_argument('--end',type=int,default=192);p.add_argument('--samples',type=int,default=12);p.add_argument('--size',type=int,default=960);p.add_argument('--render',action='store_true');opt=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=os.path.abspath(opt.out);os.makedirs(OUT+'/frames',exist_ok=True);os.makedirs(OUT+'/checks',exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.abspath('assets/rongboy/scout-v1/rongboy-scout-v1.blend'))
scene=bpy.context.scene;model=bpy.data.collections['RONGBOY / Scout figurine'];studio=bpy.data.collections['STUDIO / presentation only'];source_objects=list(model.objects);source_count=len(source_objects)
oldroot=bpy.data.objects['RONGBOY / figurine root']
controls=bpy.data.collections.new('ANIMATION / rigid puppet controls');scene.collection.children.link(controls)
def control(name,position,parent=None):
 ob=bpy.data.objects.new(name,None);controls.objects.link(ob);ob.empty_display_type='SPHERE';ob.empty_display_size=.065;ob.location=position;bpy.context.view_layer.update()
 if parent:mw=ob.matrix_world.copy();ob.parent=parent;ob.matrix_parent_inverse=parent.matrix_world.inverted();ob.matrix_world=mw
 return ob
root=control('CTRL / ground motion',(0,0,0));body=control('CTRL / body',(0,0,.73),root);head=control('CTRL / head',(0,-.025,1.23),body);hat=control('CTRL / hat',(0,0,1.88),head);pack=control('CTRL / backpack',(0,.30,1.05),body)
arms={s:control('CTRL / arm '+str(s),(s*.31,0,1.14),body) for s in [-1,1]};legs={s:control('CTRL / leg '+str(s),(s*.205,.025,.67),root) for s in [-1,1]};feet={s:control('CTRL / boot '+str(s),(s*.205,.02,.24),legs[s]) for s in [-1,1]}
bpy.context.view_layer.update()
# Surface fibers are world-coordinate curves; they inherit their source part's controller.
def center(ob):
 try:return sum((ob.matrix_world@Vector(v) for v in ob.bound_box),Vector())/8
 except:return ob.matrix_world.translation.copy()
def route(ob):
 n=ob.name;c=center(ob);s=-1 if c.x<0 else 1
 if n.startswith(('Hat /','Goggle','Goggles /')):return hat
 if n.startswith(('Head /','Ear','Eye /','Cheek /','Eyebrow','Nose /','Smile /','Hair /')):return head
 if n.startswith(('Rucksack /','Backpack /','Bedroll /')):return pack
 if n.startswith(('Sleeve','Cuff ','Mitten','Thumb')):return arms[s]
 if n.startswith(('Boot ','Sole welt stitch')):return feet[s]
 if n.startswith(('Leg ','Shorts leg','Shorts cuff seam')):return legs[s]
 return body
assignment={}
for ob in source_objects:
 if ob==oldroot:continue
 mw=ob.matrix_world.copy();ctl=route(ob);ob.parent=ctl;ob.matrix_parent_inverse=ctl.matrix_world.inverted();ob.matrix_world=mw;assignment[ob.name]=ctl.name
# Keep the original root as provenance; all visible parts now have explicit moving parents.
oldroot.hide_viewport=True;oldroot.hide_render=True
initial={o.name:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in controls.objects}
# Replace only the study's display disk with three felt landing pads. Figurine unchanged.
for ob in list(studio.objects):
 if ob.name.startswith('Display /'):bpy.data.objects.remove(ob,do_unlink=True)
felt=bpy.data.materials['Studio / muted sage base'];wood=bpy.data.materials['Studio / walnut plinth'];thread=bpy.data.materials['Cotton / oatmeal stitching']
def block(name,loc,scale,material,bevel):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for c in list(o.users_collection):c.objects.unlink(o)
 studio.objects.link(o);o.data.materials.append(material);b=o.modifiers.new('Soft edge','BEVEL');b.width=bevel;b.segments=4;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
for i,x in enumerate([-1.55,0,1.55]):
 block('Stage / walnut pad '+str(i),(x,0,-.095),(1.39,1.24,.12),wood,.055)
 block('Stage / felt pad '+str(i),(x,0,-.012),(1.35,1.20,.075),felt,.055)
 for edge in [-1,1]:
  for j in range(13):
   block('Stage / sewn stitch',(x-.57+j*.09,edge*.52,.029),(.041,.009,.007),thread,.003)
  for j in range(11):block('Stage / sewn stitch',(x+edge*.60,-.44+j*.088,.029),(.009,.041,.007),thread,.003)
# Hand-authored pose evaluator, independent of prior frames. 4s phrase, repeated from game camera.
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def jump(frame,start,end,a,b,height):
 if frame<start:return a,0,0
 if frame>end:return b,0,0
 t=(frame-start)/(end-start);return a+(b-a)*(t*t*(3-2*t)),height*4*t*(1-t),sin(pi*t)
def pose(local):
 # frame 1–12 idle, 13–20 anticipation, 21–35 jump, 36–43 landing/rebound,
 # 44–57 chained jump, 58–66 landing, 67–96 settle/acknowledgment.
 for o in controls.objects:
  loc,rot,scale=initial[o.name];o.location=loc;o.rotation_euler=rot;o.scale=scale
 f=local;x=-1.55;z=0;flight=0;crouch=0;land=0
 if f<21:crouch=smooth((f-12)/8)
 elif f<=35:x,z,flight=jump(f,21,35,-1.55,0,.76)
 elif f<44:
  x=0;u=(f-35)/8;land=sin(pi*min(1,u));crouch=.55*smooth((f-39)/4)
 elif f<=57:x,z,flight=jump(f,44,57,0,1.55,.69)
 else:
  x=1.55;u=(f-57)/9;land=sin(pi*min(1,u)) if u<1 else 0
 root.location.x+=x;root.location.z+=z
 # Body compresses before launch; feet stay planted. No uniform flattening of face/hat.
 body.location.z+=-.10*crouch-.115*land+.012*sin(f*.22)*(1-flight)
 body.scale=(1+.035*(crouch+land),1+.02*(crouch+land),1-.055*(crouch+land))
 body.rotation_euler.x=.13*crouch-.13*flight+.08*land
 body.rotation_euler.y=-.09*flight
 root.rotation_euler.z=.72*flight
 # Look ahead first, then counterbalance the torso. Soft toy head retains its round shape.
 head.rotation_euler.x=-.08*crouch+.075*flight-.055*land
 head.rotation_euler.z=.09*flight+.035*sin(f*.15)
 head.scale.z=1/max(.8,body.scale.z)
 hat.rotation_euler.x=.025*sin(f*.31-.7)*flight+.025*land
 hat.rotation_euler.y=.025*sin(f*.28-1.2)*flight
 # Small delayed backpack and hat follow-through; stays attached at shoulder seam.
 residual=0
 for impact in [35,57]:
  if f>=impact:residual+=.065*exp(-(f-impact)/7)*sin((f-impact)*.65)
 pack.rotation_euler.x=.055*crouch-.075*flight+residual
 pack.rotation_euler.y=.025*sin(f*.3)*flight
 for s in [-1,1]:
  arms[s].rotation_euler.x=.26*crouch-.75*flight+.13*land
  arms[s].rotation_euler.y=-s*(.10*crouch+.50*flight+.13*land)
  arms[s].rotation_euler.z=-s*.06*flight
  legs[s].rotation_euler.x=(.40 if s<0 else -.26)*flight
  legs[s].rotation_euler.y=s*.07*flight
  feet[s].rotation_euler.x=(-.28 if s<0 else .13)*flight+.07*land
 # Final small greeting: one hand lifts after the landing has resolved.
 if f>71:
  u=smooth((f-71)/8)*(1-smooth((f-87)/9));arms[-1].rotation_euler.y+=(1.95+.08*sin(f*1.15))*u;arms[-1].rotation_euler.x-=.25*u;head.rotation_euler.z-=.04*u
 return {'frame':f,'position':[float(x),0,float(z)],'flight':flight,'anticipation':crouch,'landing':land}
scene.render.fps=24;scene.frame_start=1;scene.frame_end=192;scene.render.resolution_x=opt.size;scene.render.resolution_y=round(opt.size*5/8);scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.render.engine='CYCLES';scene.cycles.samples=opt.samples;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.render.use_persistent_data=True
camera=scene.camera;camera.data.ortho_scale=6.20
hero=(3.3,-7.5,3.6);game=(2,-5.5,7.0)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
poses=[]
for f in range(1,193):
 scene.frame_set(f);local=(f-1)%96+1;meta=pose(local);meta['timeline_frame']=f;poses.append(meta)
 for o in controls.objects:
  o.keyframe_insert(data_path='location',frame=f,group=o.name);o.keyframe_insert(data_path='rotation_euler',frame=f,group=o.name);o.keyframe_insert(data_path='scale',frame=f,group=o.name)
 camera.location=hero if f<=96 else game;aim(camera,(0,0,1.30));camera.keyframe_insert(data_path='location',frame=f);camera.keyframe_insert(data_path='rotation_euler',frame=f)
# Rendered frames are integer sampled. Dense keyed curves intentionally preserve authored timing.
scene.frame_set(1);scene['animation_status']='Motion candidate. Rigid part controls, no generative video. Same static scout-v1 geometry/materials.';scene['motion_phrase']='Idle → anticipate → jump → landing → chain jump → rebound → settle';scene['camera_cut']=97
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/rongboy-scout-motion-v1.blend')
with open(OUT+'/motion-manifest.json','w') as h:json.dump({'source':'assets/rongboy/scout-v1/rongboy-scout-v1.blend','source_object_count':source_count,'assigned_visible_parts':len(assignment),'assignment':assignment,'fps':24,'frames':192,'resolution':[scene.render.resolution_x,scene.render.resolution_y],'camera_cut':97,'poses':poses},h,indent=2)
if opt.frames:
 for f in map(int,opt.frames.split(',')):
  scene.frame_set(f);scene.render.filepath=OUT+f'/checks/frame-{f:03d}.png';bpy.ops.render.render(write_still=True)
elif opt.render:
 for f in range(opt.start,opt.end+1):
  target=OUT+f'/frames/{f:04d}.png'
  if os.path.exists(target):continue
  scene.frame_set(f);scene.render.filepath=target;bpy.ops.render.render(write_still=True)
print('MOTION_DONE',OUT)
