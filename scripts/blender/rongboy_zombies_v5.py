"""Nine structural zombie designs. The accepted V2 walker is imported unchanged.
blender -b --python scripts/blender/rongboy_zombies_v5.py -- [--render]
"""
import bpy,sys,json,math,random
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd();OUT=ROOT/'assets/rongboy/zombies-v5';OUT.mkdir(parents=True,exist_ok=True)
ROSTER=[
 dict(id='walker',name='跳跳',role='原始布偶 · 基准',pose='hop',accent='#BDA678',height=1.574),
 dict(id='leaper',name='跃行者',role='收腹弓腿 · 敏捷扑击',pose='pounce',accent='#B99E60',height=1.50),
 dict(id='heavy',name='棉甲',role='梨形厚躯 · 小头短腿',pose='stomp',accent='#9B7C63',height=1.76),
 dict(id='crawler',name='爬行者',role='低腹四肢 · 长臂支撑',pose='crawl',accent='#81968B',height=.98),
 dict(id='shielded',name='持盾者',role='偏肩长脸 · 巨型盾臂',pose='guard',accent='#7C929B',height=1.68),
 dict(id='bomber',name='炸弹客',role='团身短腿 · 捧弹抛投',pose='throw',accent='#BB8D60',height=1.52),
 dict(id='archer',name='弓手',role='瘦长驼背 · 长弓搭箭',pose='bow',accent='#718C7D',height=1.70),
 dict(id='boss-warden',name='守墓巨像',role='沉肩巨臂 · 震地重击',pose='warden',accent='#898D80',height=2.18),
 dict(id='boss-leech',name='噬连兽',role='垂袋长颈 · 吸盘长臂',pose='leech',accent='#8C7999',height=1.88),
]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/rongboy/runtime-v2/walker.glb'))
walker=next(o for o in bpy.context.scene.objects if o.parent is None);walker_objects=[walker]+list(walker.children_recursive)
normal=next(im for im in bpy.data.images if im.size[0]==256);normal.pack()
def rgba(h):
 def lin(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
 return tuple(lin(int(h[i:i+2],16)/255) for i in (1,3,5))+(1,)
materials={}
def mat(name,h,trim=False):
 if name in materials:return materials[name]
 m=bpy.data.materials.new('V5 / '+name);m.diffuse_color=rgba(h);m.use_nodes=True;m.use_backface_culling=True;m['rongboy_palette']=h
 n=m.node_tree.nodes;l=m.node_tree.links;b=n.get('Principled BSDF');b.inputs['Base Color'].default_value=rgba(h);b.inputs['Roughness'].default_value=.84 if trim else .97;b.inputs['Sheen Weight'].default_value=1;b.inputs['Sheen Tint'].default_value=(.0336,.0308,.0252,1)
 if not trim:
  uv=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(5,5,1);tx=n.new('ShaderNodeTexImage');tx.image=normal;tx.extension='REPEAT';nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.55;l.new(uv.outputs['UV'],mp.inputs['Vector']);l.new(mp.outputs['Vector'],tx.inputs['Vector']);l.new(tx.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],b.inputs['Normal'])
 materials[name]=m;return m
skin=mat('moss green wool','#8E9F7B');light=mat('faded green wool','#A3B18E');patch=mat('dark felt repair','#697F5C');vest=mat('worn chestnut felt','#75604E');pants=mat('plum brown cloth','#6E6470');oat=mat('oat felt','#E8D9B7');ink=mat('charcoal yarn','#4A5943');mouth=mat('mouth wool inset','#3D4938');button=mat('ochre button','#D0AF65',True);buttondark=mat('dark sewn button','#51594F',True)
current=None;parts={};counter=0
def obj(name,data,part,pos=(0,0,0),material=None):
 o=bpy.data.objects.new(current['id']+' / '+name,data);current['collection'].objects.link(o);o.parent=parts[part];o.location=pos
 if material:data.materials.append(material)
 return o
def point(name,part,pos):
 o=obj(name,None,part,pos);o['mechanism']=name;return o
def yarn(name,points,material=oat,part='Body',radius=.005,closed=False,parent=None):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=3;d.bevel_depth=radius;d.bevel_resolution=2;s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
 s.use_cyclic_u=closed;o=obj(name,d,part,material=material)
 if parent:o.parent=parent
 return o
def surface(u,size,power,pear):
 q=Vector(tuple(math.copysign(abs(c)**power,c) for c in u));q.x*=1-pear*q.z
 p=Vector((q.x*size[0],q.y*size[1],q.z*size[2]));n=Vector((q.x/size[0],q.y/size[1],q.z/size[2])).normalized();w=.0017*(math.sin(p.x*71+p.z*23)*math.sin(p.y*63+p.z*37));return p+n*w,n
def ball(name,pos,size,material=skin,part='Body',fur=0,power=1,pear=0,rot=(0,0,0),parent=None):
 global counter
 seg,rings=(32,22) if fur>=800 else (22,16) if max(size)>.13 else (16,12)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1);temp=bpy.context.object;d=temp.data.copy();bpy.data.objects.remove(temp,do_unlink=True)
 for v in d.vertices:v.co=surface(v.co,size,power,pear)[0]
 for f in d.polygons:f.use_smooth=True
 o=obj(name,d,part,pos,material);o.rotation_euler=rot;o['structural_surface']=current['id']
 if parent:o.parent=parent
 if fur:
  rnd=random.Random(701+counter);counter+=1;vv=[];ff=[]
  for i in range(fur):
   z=rnd.uniform(-1,1);a=rnd.random()*math.tau;r=math.sqrt(1-z*z);p,n=surface(Vector((r*math.cos(a),r*math.sin(a),z)),size,power,pear);s=n.cross(Vector((.2,.7,.3))).normalized()*rnd.uniform(.00035,.00065);tip=p+n*rnd.uniform(.004,.011);j=len(vv);vv.extend([p-s,p+s,tip]);ff.append((j,j+1,j+2))
  hair=bpy.data.meshes.new(name+' fine wool');hair.from_pydata(vv,[],ff);hair.update();f=obj('fuzz / '+name,hair,part,pos,material);f['fuzz']=True;f.rotation_euler=rot
  if parent:f.parent=parent
 return o
def box(name,pos,size,material,part='Body',radius=.018,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1);temp=bpy.context.object;d=temp.data.copy();bpy.data.objects.remove(temp,do_unlink=True)
 for v in d.vertices:v.co=Vector((v.co.x*size[0],v.co.y*size[1],v.co.z*size[2]))
 o=obj(name,d,part,pos,material);o.rotation_euler=rot;b=o.modifiers.new('Worn cloth edge','BEVEL');b.width=min(radius,min(size)*.42);b.segments=4;return o
def seam(name,pts,part='Body',material=ink,r=.005):
 yarn(name,pts,material,part,r)
 for i in range(1,len(pts)-1,2):
  p=Vector(pts[i]);yarn(name+' cross',[p+Vector((-.023,-.003,-.008)),p+Vector((.023,-.003,.008))],oat,part,.0035)
def head(center,size,power=1,pear=0,eyes=(-.34,.34),mouth_v=-.46,mouth_w=.43,teeth=5):
 cx,cy,cz=center;rx,ry,rz=size;ball('sculpted head',center,size,skin,'Head',1100,power,pear)
 def front(x,z,off=.008):
  v=(z-cz)/rz;u=(x-cx)/(rx*(1-pear*v));return cy-ry*max(.01,1-abs(u)**(2/power)-abs(v)**(2/power))**(power/2)-off
 for sign in [-1,1]:ball('sewn ear',(cx+sign*rx*.97,cy,cz-.04*rz),(.075,.065,.105),skin,'Head',130)
 for i,u in enumerate(eyes):
  x=cx+u*rx;z=cz+(.16 if i==0 else .08)*rz;r=rx*(.25 if i==0 else .19);y=front(x,z,.022)
  ball('button socket',(x,y+.012,z),(r*1.16,.025,r*1.12),light,'Head')
  ball('button eye',(x,y-.008,z),(r,.023,r),button if i==0 else buttondark,'Head')
  yarn('button rim',[(x+r*.9*math.cos(a),y-.03,z+r*.9*math.sin(a)) for a in [j*math.tau/40 for j in range(40)]],oat if i==0 else vest,'Head',.0045,True)
  for sign in [-1,1]:yarn('sewn button X',[(x-r*.36,y-.034,z-sign*r*.36),(x+r*.36,y-.034,z+sign*r*.36)],ink if i==0 else oat,'Head',.006)
 z=cz+mouth_v*rz;x=cx;y=front(x,z,.012);mw=rx*mouth_w;mh=rz*.17
 ball('cloth mouth inset',(x,y,z),(mw,.026,mh),mouth,'Head')
 yarn('mouth felt welt',[(x+mw*math.cos(a),front(x+mw*math.cos(a),z+mh*math.sin(a),.020),z+mh*math.sin(a)) for a in [j*math.tau/40 for j in range(40)]],patch,'Head',.004,True)
 for i in range(teeth):
  upper=i%2==0;xx=x+(i-(teeth-1)/2)*mw*1.45/max(1,teeth-1);zz=z+mh*(.48 if upper else -.52);box('crooked felt tooth',(xx,y-.027,zz),(rx*.105,.026,rz*(.12 if upper else .09)),oat,'Head',.009,rot=(0,(i%3-1)*.12,0))
 for x in [cx-.02,cx+.02]:yarn('nose stitch',[(x,front(x,cz-.20*rz,.016),cz-.20*rz),(x+.004,front(x,cz-.29*rz,.016),cz-.29*rz)],ink,'Head',.005)
 # Sewn applique, projected onto this character's own head surface.
 vv=[(cx+rx*.38,front(cx+rx*.38,cz+rz*.64,.014),cz+rz*.64)];rings=[]
 for radius in [.5,1]:
  ring=[]
  for i in range(40):
   a=i*math.tau/40;xx=cx+rx*.38+rx*.27*radius*math.copysign(abs(math.cos(a))**.65,math.cos(a));zz=cz+rz*.64+rz*.22*radius*math.copysign(abs(math.sin(a))**.65,math.sin(a));ring.append(len(vv));vv.append((xx,front(xx,zz,.014),zz))
  rings.append(ring)
 ff=[(0,rings[0][i],rings[0][(i+1)%40]) for i in range(40)]+[(rings[0][i],rings[1][i],rings[1][(i+1)%40],rings[0][(i+1)%40]) for i in range(40)];d=bpy.data.meshes.new('Character-specific curved repair');d.from_pydata(vv,[],ff);d.update();uv=d.uv_layers.new(name='UVMap')
 for f in d.polygons:
  for li in f.loop_indices:
   co=d.vertices[d.loops[li].vertex_index].co;uv.data[li].uv=((co.x-cx)/rx,(co.z-cz)/rz)
 o=obj('curved head repair',d,'Head',material=patch);sol=o.modifiers.new('Felt patch thickness','SOLIDIFY');sol.thickness=.004
 for i in range(0,40,5):
  xx,yy,zz=vv[rings[1][i]];yarn('patch stitch',[(xx-.009,front(xx-.009,zz-.009,.025),zz-.009),(xx+.009,front(xx+.009,zz+.009,.025),zz+.009)],oat,'Head',.003)
 pts=[(cx-rx*.40+math.sin(j*.8)*rx*.03,front(cx-rx*.40+math.sin(j*.8)*rx*.03,cz+rz*(.65-j*.08),.015),cz+rz*(.65-j*.08)) for j in range(6)];seam('head repair seam',pts,'Head')
def limb(part,length=.60,width=.11,palm=.12,leg=False):
 if leg:
  ball('cloth leg',(0,0,-length*.40),(width,width*1.14,length*.52),pants,part,360)
  ball('felt foot',(0,-.10,-length+.11),(width*1.2,.24,.12),skin,part,260)
  for x in [-.05,.02,.08]:yarn('toe stitch',[(x,-.32,-length+.08),(x,-.33,-length+.14),(x,-.30,-length+.19)],ink,part,.004)
 else:
  ball('upper arm',(0,0,-length*.20),(width,width*1.1,length*.29),skin,part,250)
  ball('stuffed forearm',(0,-.05,-length*.57),(width*1.07,width*1.25,length*.28),skin,part,300)
  ball('cloth palm',(0,-.12,-length*.84),(palm,palm*.90,palm*1.12),skin,part,220)
  for j in range(3):ball('soft finger',((j-1)*palm*.54,-.17,-length*.99),(palm*.37,palm*.44,palm*.62),skin,part,45)
  ball('thumb',(-palm*.85,-.13,-length*.77),(palm*.42,palm*.58,palm*.6),skin,part,55)
  seam('forearm seam',[(0,-width*1.3,-length*.34),(.015,-width*1.5,-length*.48),(.005,-width*1.6,-length*.63)],part)
def rig(spec,locations):
 global current,parts
 col=bpy.data.collections.new('RONGBOY / '+spec['id']);bpy.context.scene.collection.children.link(col);root=bpy.data.objects.new('Zombie / '+spec['id'],None);col.objects.link(root);root['zombieType']=spec['id'];root['asset_version']='v5';parts={}
 for name,loc in locations.items():
  p=bpy.data.objects.new('CTRL / '+spec['id']+' / '+name,None);col.objects.link(p);p.parent=root;p.location=loc;p['part']=name;parts[name]=p
 current=dict(spec,collection=col,root=root);return current
def build(spec):
 k=spec['id'];accent=mat(k+' cloth',spec['accent'])
 if k=='leaper':
  rig(spec,dict(Body=(0,.10,.91),Head=(0,-.13,1.40),ArmL=(-.27,-.04,1.25),ArmR=(.27,-.04,1.25),LegL=(-.24,.10,.80),LegR=(.24,.10,.80)))
  head((0,-.01,.27),(.48,.32,.32),pear=-.08,mouth_v=-.45,teeth=4);ball('compact forward torso',(0,0,.12),(.25,.27,.32),skin,fur=850,pear=.15,rot=(.30,0,0));ball('leaning neck bridge',(0,-.13,.47),(.14,.16,.20),skin,fur=380,rot=(.25,0,0))
  for n in ['ArmL','ArmR']:limb(n,.59,.085,.105)
  for n in ['LegL','LegR']:
   ball('powerful folded thigh',(0,.03,-.12),(.18,.25,.27),pants,n,450,rot=(-.45,0,0));ball('slanted hock',(0,-.10,-.45),(.11,.12,.24),skin,n,300,rot=(.30,0,0));ball('long spring foot',(0,-.24,-.68),(.14,.30,.10),skin,n,220)
  seam('hock stretch seam',[(-.17,-.21,.25),(-.19,-.22,.12),(-.17,-.23,-.02)])
 elif k=='heavy':
  rig(spec,dict(Body=(0,.06,.86),Head=(0,-.13,1.49),ArmL=(-.48,.02,1.22),ArmR=(.48,.02,1.22),LegL=(-.27,.02,.44),LegR=(.27,.02,.44)))
  ball('large pear stuffed torso',(0,0,.27),(.57,.39,.68),skin,fur=1800,pear=.22);head((0,-.04,.23),(.34,.29,.29),power=.9,mouth_w=.48,teeth=4)
  for n in ['ArmL','ArmR']:limb(n,.72,.18,.18)
  for n in ['LegL','LegR']:limb(n,.43,.15,leg=True)
  ball('quilted belly',(0,-.31,.17),(.42,.10,.42),accent,fur=600)
  for x in [-.23,0,.23]:seam('belly quilt channel',[(x,-.40,-.12),(x,-.42,.09),(x,-.41,.32),(x,-.37,.48)],material=oat,r=.004)
 elif k=='crawler':
  rig(spec,dict(Body=(0,.30,.46),Head=(0,-.36,.65),ArmL=(-.40,-.16,.61),ArmR=(.40,-.16,.61),LegL=(-.28,.48,.36),LegR=(.28,.48,.36)))
  ball('horizontal low belly',(0,.08,.10),(.41,.61,.30),skin,fur=1200,power=.9);head((0,-.10,.14),(.49,.34,.27),power=.83,mouth_v=-.43,mouth_w=.52,teeth=5)
  for n in ['ArmL','ArmR']:limb(n,.49,.13,.18)
  for n in ['LegL','LegR']:limb(n,.34,.12,leg=True)
  seam('long back seam',[(0,.72,.27),(0,.58,.36),(0,.30,.39),(0,.04,.38)],material=vest)
 elif k=='shielded':
  rig(spec,dict(Body=(0,.03,.83),Head=(.07,-.01,1.32),ArmL=(-.40,-.04,1.26),ArmR=(.29,.01,1.22),LegL=(-.18,.02,.64),LegR=(.18,.02,.64)))
  ball('narrow leaning chest',(0,.02,.23),(.27,.24,.45),skin,fur=850,pear=.10);head((.025,-.01,.38),(.31,.30,.48),power=.87,eyes=(-.32,.36),teeth=5)
  limb('ArmR',.63,.10,.12);limb('ArmL',.64,.21,.19)
  for n in ['LegL','LegR']:limb(n,.63,.12,leg=True)
  ball('felt shield',(-.04,-.30,-.35),(.38,.15,.57),accent,'ArmL',800,power=.65);ball('shield padded rim',(-.04,-.43,-.35),(.32,.035,.50),oat,'ArmL');ball('shield face',(-.04,-.46,-.35),(.29,.03,.46),accent,'ArmL')
  seam('shield central stitch',[(-.04,-.497,.0),(-.04,-.50,-.25),(-.04,-.497,-.52),(-.04,-.48,-.72)],'ArmL')
 elif k=='bomber':
  rig(spec,dict(Body=(0,.04,.79),Head=(0,-.09,1.44),ArmL=(-.43,0,1.16),ArmR=(.43,0,1.16),LegL=(-.23,.02,.43),LegR=(.23,.02,.43)))
  ball('round bomb carrier torso',(0,.02,.20),(.51,.40,.55),skin,fur=1600,power=.93);head((0,-.02,.20),(.36,.31,.29),pear=.16,mouth_w=.43,teeth=4)
  for n in ['ArmL','ArmR']:limb(n,.58,.13,.16)
  for n in ['LegL','LegR']:limb(n,.42,.14,leg=True)
  # Bomb supply is actual volume on the back; the right hand holds the thrown payload.
  for x,z in [(-.27,.22),(.26,.27),(0,.50)]:
   ball('spare yarn bomb',(x,.37,z),(.18,.19,.18),accent,fur=260);yarn('bomb winding',[(x-.13,.50,z),(x,.56,z+.12),(x+.13,.50,z)],oat,radius=.007)
  held=point('heldBomb','ArmR',(0,-.20,-.51));ball('held yarn bomb',(0,0,0),(.20,.20,.20),accent,'ArmR',350,parent=held)
  yarn('held bomb winding',[(-.15,-.12,0),(0,-.19,.12),(.15,-.12,0)],oat,'ArmR',.008,parent=held);yarn('soft bomb fuse',[(0,0,.18),(.03,0,.27),(-.01,0,.31)],vest,'ArmR',.012,parent=held)
 elif k=='archer':
  rig(spec,dict(Body=(0,.12,.92),Head=(0,-.12,1.41),ArmL=(-.26,-.01,1.48),ArmR=(.26,-.01,1.48),LegL=(-.15,.05,.78),LegR=(.15,.05,.78)))
  ball('thin curved chest',(0,.02,.18),(.21,.22,.48),skin,fur=850,pear=-.12,rot=(.15,0,0));ball('stooped shoulder hump',(0,.17,.46),(.25,.22,.23),vest,fur=430)
  head((0,-.04,.36),(.28,.28,.43),pear=.18,eyes=(-.37,.35),mouth_v=-.50,mouth_w=.42,teeth=3)
  limb('ArmL',.77,.085,.10);limb('ArmR',.84,.09,.11);point('drawHand','ArmR',(0,-.12,-.84*.84))
  for n in ['LegL','LegR']:limb(n,.77,.085,leg=True)
  bow=point('bowMount','ArmL',(-.13,-.21,-.69));bow.rotation_euler.x=math.pi/2
  yarn('soft bow arc',[(.12,-.04,-.52),(-.08,-.07,-.29),(-.18,-.07,0),(-.08,-.07,.29),(.12,-.04,.52)],accent,'ArmL',.025,parent=bow)
  for label,pos in [('bowUpper',(.12,-.04,.52)),('bowLower',(.12,-.04,-.52)),('bowNock',(.12,-.04,0)),('bowBack',(.12,.25,0))]:
   p=point(label,'ArmL',pos);p.parent=bow
  string=point('nativeString','ArmL',(0,0,0));string.parent=bow;yarn('bow string',[(.12,-.04,-.52),(.12,-.04,0),(.12,-.04,.52)],oat,'ArmL',.003,parent=string)
  arrow=point('heldArrow','ArmL',(.12,-.04,0));arrow.parent=bow
  yarn('nocked arrow shaft',[(0,.30,0),(0,-.53,0)],vest,'ArmL',.007,parent=arrow);ball('soft arrow tip',(0,-.57,0),(.032,.075,.032),accent,'ArmL',parent=arrow)
  for x in [-.025,.025]:ball('arrow feather',(x,.26,0),(.025,.10,.012),oat,'ArmL',parent=arrow)
  for x in [-.08,.02,.12]:yarn('back arrow shaft',[(x,.28,.25),(x,.28,.90)],vest,radius=.007);ball('back arrow feather',(x,.28,.82),(.03,.025,.09),oat)
 elif k=='boss-warden':
  rig(spec,dict(Body=(0,.07,1.07),Head=(0,-.13,1.62),ArmL=(-.62,0,1.51),ArmR=(.62,0,1.51),LegL=(-.28,.02,.57),LegR=(.28,.02,.57)))
  ball('massive low trapezoid torso',(0,.03,.18),(.65,.43,.68),skin,fur=1700,power=.82,pear=-.15);head((0,-.03,.23),(.36,.32,.34),power=.64,mouth_w=.49,teeth=5)
  for n in ['ArmL','ArmR']:
   ball('high sunk shoulder',(0,0,-.08),(.30,.32,.32),skin,n,650);limb(n,1.30,.245,.29)
  for n in ['LegL','LegR']:limb(n,.56,.18,leg=True)
  ball('grave cloth belly',(0,-.34,.12),(.45,.11,.46),accent,fur=600,power=.8)
  seam('large torso seam',[(0,-.46,-.20),(0,-.47,.06),(0,-.46,.30),(0,-.39,.49)],material=oat,r=.007)
  box('cloth lock',(0,-.46,.18),(.21,.07,.21),oat,radius=.04);yarn('lock loop',[(-.07,-.45,.29),(-.06,-.45,.40),(.06,-.45,.40),(.07,-.45,.29)],oat,radius=.018)
 elif k=='boss-leech':
  rig(spec,dict(Body=(0,.02,.92),Head=(0,-.03,1.48),ArmL=(-.33,.0,1.40),ArmR=(.33,.0,1.40),LegL=(-.15,.02,.42),LegR=(.15,.02,.42)))
  ball('long sack torso',(0,0,.18),(.235,.25,.68),skin,fur=1200,pear=.18);head((0,-.02,.33),(.29,.28,.55),pear=.33,eyes=(-.37,.34),mouth_v=-.42,mouth_w=.38,teeth=4)
  for sign in [-1,1]:ball('sloping shoulder join',(sign*.22,0,.48),(.15,.19,.20),skin,fur=280,rot=(0,sign*.2,0))
  for n in ['ArmL','ArmR']:
   limb(n,1.24,.10,.16);ball('suction palm',(0,-.13,-1.24),(.20,.19,.09),accent,n,230)
   yarn('soft sucker palm',[(.14*math.cos(a),-.13+.14*math.sin(a),-1.30) for a in [j*math.tau/40 for j in range(40)]],oat,n,.022,True)
  for n in ['LegL','LegR']:limb(n,.41,.105,leg=True)
  seam('long sack repair',[(0,-.23,-.32),(.02,-.25,-.10),(-.02,-.26,.15),(.02,-.23,.42)],material=accent)
 return current
built=[]
for spec in ROSTER:
 if spec['id']=='walker':
  col=bpy.data.collections.new('RONGBOY / walker');bpy.context.scene.collection.children.link(col)
  for ob in walker_objects:
   for old in list(ob.users_collection):old.objects.unlink(ob)
   col.objects.link(ob)
  walker['zombieType']='walker';walker['asset_version']='v5';walker['accepted_reference']='Unchanged V2 runtime geometry and materials';item=dict(spec,collection=col,root=walker)
 else:
  item=build(spec);bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();coords=[]
  for ob in item['collection'].objects:
   if ob.type not in {'MESH','CURVE'} or ob.get('fuzz'):continue
   ev=ob.evaluated_get(graph);me=ev.to_mesh();coords.extend(ob.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear()
  lo=min(p.z for p in coords);hi=max(p.z for p in coords);target=(spec['height']+.017)/.78;f=(target-.022)/(hi-lo)
  for p in parts.values():p.location*=f;p.scale*=f;p.location.z+=.022-lo*f
 built.append(item)
for i,item in enumerate(built):item['root'].location=((i%3-1)*4.2,(1-i//3)*4.6,0)
bpy.context.view_layer.update()
for item in built:
 origin=item['root'].matrix_world.translation;coords=[ob.matrix_world@v.co-origin for ob in item['collection'].objects if ob.type=='MESH' for v in ob.data.vertices];item['height']=round(max(p.z for p in coords)*.78-.017,3);item['width']=round((max(p.x for p in coords)-min(p.x for p in coords))*.78,3)
studio=bpy.data.collections.new('STUDIO / roster review only');bpy.context.scene.collection.children.link(studio)
paper=mat('review paper','#DCD1B9');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.01));floor=bpy.context.object
for c in list(floor.users_collection):c.objects.unlink(floor)
studio.objects.link(floor);floor.data.materials.append(paper)
for name,pos,power,size in [('Key',(-5,-10,13),1900,8),('Fill',(8,-4,10),1100,8),('Rim',(0,7,12),1800,7)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('Native review camera',bpy.data.cameras.new('Native review'));studio.objects.link(cam);cam.location=(8,-20,15);cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=15.8
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1400;scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.55,.55,.55,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.4;scene.view_settings.view_transform='AgX';scene['design_status']='Nine structural candidates; original V2 walker retained; awaiting user judgement'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rongboy-zombie-roster-v5.blend'),compress=True)
if '--render' in sys.argv:scene.render.filepath=str(OUT/'roster-native-overview.png');bpy.ops.render.render(write_still=True)
for item in built:item['root'].location=(0,0,0)
for ob in scene.objects:ob.select_set(False)
for item in built:
 for ob in item['collection'].objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'zombie-roster.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_yup=True)
public=[{k:item[k] for k in ['id','name','role','pose','accent','height','width']} for item in built]
(OUT/'catalog.json').write_text(json.dumps(dict(models=public,source='rongboy-zombie-roster-v5.blend',basis='Original V2 walker untouched; eight independently constructed body plans',bytes=(OUT/'zombie-roster.glb').stat().st_size),ensure_ascii=False,indent=2))
(ROOT/'library/games/rongboy-roster.js').write_text('// Native V5 roster. Generated by rongboy_zombies_v5.py.\nexport const ZOMBIE_ROSTER = '+json.dumps(public,ensure_ascii=False,indent=2)+';\nexport const ZOMBIE_ALIASES={tank:"heavy",runner:"leaper",weaver:"leaper"};\n')
print('V5_DONE',len(public),(OUT/'zombie-roster.glb').stat().st_size,flush=True)
