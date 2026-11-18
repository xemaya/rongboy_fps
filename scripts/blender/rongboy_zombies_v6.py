"""Nine structural zombie designs. The accepted V2 walker solid shapes are preserved; target colours and wool are repaired.
blender -b --python scripts/blender/rongboy_zombies_v6.py -- [--render]
"""
import bpy,sys,json,math,random,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd();OUT=ROOT/'assets/rongboy/zombies-v6';OUT.mkdir(parents=True,exist_ok=True)
ROSTER=[
 dict(id='walker',name='跳跳',role='原始布偶 · 基准',pose='hop',accent='#BDA678',height=1.574),
 dict(id='leaper',name='跃行者',role='收腹弓腿 · 敏捷扑击',pose='pounce',accent='#B99E60',height=1.50),
 dict(id='heavy',name='棉甲',role='梨形厚躯 · 小头短腿',pose='stomp',accent='#9B7C63',height=1.76),
 dict(id='crawler',name='爬行者',role='低腹四肢 · 长臂支撑',pose='crawl',accent='#81968B',height=.98),
 dict(id='shielded',name='持盾者',role='偏肩长脸 · 巨型盾臂',pose='guard',accent='#647E85',height=1.68),
 dict(id='bomber',name='炸弹客',role='团身短腿 · 捧弹抛投',pose='throw',accent='#C59B47',height=1.52),
 dict(id='archer',name='弓手',role='瘦长驼背 · 长弓搭箭',pose='bow',accent='#60776C',height=1.70),
 dict(id='boss-warden',name='守墓巨像',role='沉肩巨臂 · 震地重击',pose='warden',accent='#8E8173',height=2.18),
 dict(id='boss-leech',name='噬连兽',role='垂袋长颈 · 吸盘长臂',pose='leech',accent='#927D8D',height=1.88),
]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/rongboy/runtime-v2/walker.glb'))
walker=next(o for o in bpy.context.scene.objects if o.parent is None);walker_objects=[walker]+list(walker.children_recursive)
normal=next(im for im in bpy.data.images if im.size[0]==256);old_normal=normal
normal=bpy.data.images.load(str(ROOT/'assets/rongboy/zombies-v6/felt-normal.png'));normal.colorspace_settings.name='Non-Color';normal.pack()
for m in bpy.data.materials:
 if m.use_nodes:
  for node in m.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image==old_normal:node.image=normal
bpy.data.images.remove(old_normal)

def rgba(h):
 def lin(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
 return tuple(lin(int(h[i:i+2],16)/255) for i in (1,3,5))+(1,)
for m in bpy.data.materials:
 if not m.use_nodes:continue
 for node in m.node_tree.nodes:
  if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.7
  if node.type=='MAPPING':node.inputs['Scale'].default_value=(.7,.7,1)
materials={}
def mat(name,h,trim=False):
 if name in materials:return materials[name]
 m=bpy.data.materials.new('V6 / '+name);m.diffuse_color=rgba(h);m.use_nodes=True;m.use_backface_culling=True;m['rongboy_palette']=h;m['rongboy_felt_finish']=2 if not trim else 0
 n=m.node_tree.nodes;l=m.node_tree.links;b=n.get('Principled BSDF');b.inputs['Base Color'].default_value=rgba(h);b.inputs['Roughness'].default_value=.84 if trim else .97;b.inputs['Sheen Weight'].default_value=1;b.inputs['Sheen Tint'].default_value=(.12,.11,.09,1)
 if not trim:
  uv=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(.7,.7,1);tx=n.new('ShaderNodeTexImage');tx.image=normal;tx.extension='REPEAT';nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.7;l.new(uv.outputs['UV'],mp.inputs['Vector']);l.new(mp.outputs['Vector'],tx.inputs['Vector']);l.new(tx.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],b.inputs['Normal'])
 materials[name]=m;return m
sole=mat('dark felt sole','#453D35')
skin=mat('moss green wool','#78815B');light=mat('faded green wool','#97976E');patch=mat('dark felt repair','#565D36');vest=mat('worn chestnut felt','#715039');pants=mat('plum brown cloth','#624C47');oat=mat('oat felt','#D5BC95');ink=mat('charcoal yarn','#373B27');mouth=mat('mouth wool inset','#303421');button=mat('ochre button','#CE963B',True);buttondark=mat('dark sewn button','#493B32',True)

# Per-character hues sampled from the existing AI sheets, then conservatively
# corrected in linear light against the preceding native render. No coloured noise.
SKIN_PALETTES={'walker':'#727C52','leaper':'#6E7648','heavy':'#747C58','crawler':'#7A8165','shielded':'#6F775C','bomber':'#727852','archer':'#7C826D','boss-warden':'#7D8669','boss-leech':'#85906F'}
def palette_tone(h,mul):
 return '#'+''.join(f'{min(255,round(int(h[i:i+2],16)*mul)):02X}' for i in (1,3,5))
# Final conservative back-head colour correction under the unchanged review light.
SKIN_PALETTES={'walker': '#767648', 'leaper': '#78784A', 'heavy': '#767346', 'crawler': '#868257', 'shielded': '#787750', 'bomber': '#757346', 'archer': '#827D53', 'boss-warden': '#878455', 'boss-leech': '#89895B'}
LIGHT_PALETTES={k:palette_tone(v,1.13) for k,v in SKIN_PALETTES.items()}
PATCH_PALETTES={k:palette_tone(v,.73) for k,v in SKIN_PALETTES.items()}
walker_palette={'moss green wool':SKIN_PALETTES['walker'],'charcoal yarn':'#373B27','worn chestnut felt vest':'#715039','dark moss felt patch':'#535C34','ochre wooden button':'#CE963B','oat felt teeth':'#D5BC95','dark sewn button':'#493B32','mouth wool inset':'#303421','faded green wool':'#929367','plum brown cloth':'#624C47'}
for m in bpy.data.materials:
 if not m.name.startswith(('v2 /','fuzz /')):continue
 for suffix,h in walker_palette.items():
  if m.name.endswith(suffix):
   m.diffuse_color=rgba(h);m['rongboy_palette']=h
   if m.use_nodes:m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgba(h)
for m in bpy.data.materials:
 if m.use_nodes and any(n.type=='NORMAL_MAP' for n in m.node_tree.nodes):m['rongboy_felt_finish']=2

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
 p=Vector((q.x*size[0],q.y*size[1],q.z*size[2]));n=Vector((q.x/size[0],q.y/size[1],q.z/size[2])).normalized();w=.0027*(math.sin(p.x*71+p.z*23)*math.sin(p.y*63+p.z*37));return p+n*w,n
def ball(name,pos,size,material=skin,part='Body',fur=0,power=1,pear=0,rot=(0,0,0),parent=None):
 global counter
 seg,rings=(20,14) if name in {'inflated quilt cell','side quilt cell'} else (32,22) if fur>=800 else (22,16) if max(size)>.13 else (16,12)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1);temp=bpy.context.object;d=temp.data.copy();bpy.data.objects.remove(temp,do_unlink=True)
 for v in d.vertices:v.co=surface(v.co,size,power,pear)[0]
 for f in d.polygons:f.use_smooth=True
 o=obj(name,d,part,pos,material);o.rotation_euler=rot;o['structural_surface']=current['id']
 if parent:o.parent=parent
 if fur:
  rnd=random.Random(701+counter);counter+=1;vv=[];ff=[]
  for i in range(fur):
   z=rnd.uniform(-1,1);a=rnd.random()*math.tau;r=math.sqrt(1-z*z);p,n=surface(Vector((r*math.cos(a),r*math.sin(a),z)),size,power,pear);s=n.cross(Vector((.2,.7,.3))).normalized()*rnd.uniform(.00065,.00105);tip=p+n*rnd.uniform(.007,.015);j=len(vv);vv.extend([p-s,p+s,tip]);ff.append((j,j+1,j+2))
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
  if current['id']!='crawler':ball('dark cloth sole',(0,-.10,-length+.018),(width*1.205,.235,.025),sole,part)
  for x in [-.05,.02,.08]:yarn('toe stitch',[(x,-.32,-length+.08),(x,-.33,-length+.14),(x,-.30,-length+.19)],ink,part,.004)
 else:
  ball('upper arm',(0,0,-length*.20),(width,width*1.1,length*.29),skin,part,250)
  ball('stuffed forearm',(0,-.05,-length*.57),(width*1.07,width*1.25,length*.28),skin,part,300)
  ball('cloth palm',(0,-.12,-length*.84),(palm,palm*.90,palm*1.12),skin,part,220)
  for j in (range(3) if current['id']!='boss-leech' else []):ball('soft finger',((j-1)*palm*.54,-.17,-length*.99),(palm*.37,palm*.44,palm*.62),skin,part,45)
  if current['id']!='boss-leech':ball('thumb',((palm*.85 if part=='ArmL' else -palm*.85),-.13,-length*.77),(palm*.42,palm*.58,palm*.6),skin,part,55)
  pts=[]
  for t in [.34,.42,.50,.58,.63]:
   z=-length*t;candidates=[]
   for cy,cz,ry,rz in [(0,-length*.20,width*1.1,length*.29),(-.05,-length*.57,width*1.25,length*.28)]:
    if abs((z-cz)/rz)<1:candidates.append(cy-ry*math.sqrt(1-((z-cz)/rz)**2))
   pts.append((0,min(candidates)-.004,z))
  seam('projected forearm seam',pts,part)

def blob_seam(name,center,size,power=1,pear=0,part='Body',material=ink,front=False,rot=(0,0,0)):
 pts=[]
 for j in range(13):
  a=-.95+j*1.9/12;p,n=surface(Vector((0,(-1 if front else 1)*math.cos(a),math.sin(a))),size,power,pear);q=p+n*.005
  if rot!=(0,0,0):q.rotate(__import__('mathutils').Euler(rot))
  pts.append(tuple(Vector(center)+q))
 seam(name,pts,part,material,r=.004)
def wraps(name,center,r,material,part,parent=None):
 for axis in range(3):
  n=Vector([(0,0,1),(.86,.45,.2),(-.5,.8,.3)][axis]).normalized();u=n.cross(Vector((.23,.6,.51))).normalized();v=n.cross(u).normalized()
  for band,offset in enumerate([-.45,-.225,0,.225,.45]):
   rr=r*math.sqrt(1-offset*offset);pts=[]
   for j in range(48):
    a=j*math.tau/48;q=Vector(center)+n*(offset*r)+(u*math.cos(a)+v*math.sin(a))*(rr+.004);pts.append(tuple(q))
   o=yarn(name+str(axis)+'/'+str(band),pts,material,part,.010,True,parent);o.data.bevel_resolution=1;o.data.resolution_u=1
def vane(name,coords,part,parent=None):
 d=bpy.data.meshes.new(name);d.from_pydata(coords,[],[(0,1,2,3)]);d.update();o=obj(name,d,part,material=oat)
 if parent:o.parent=parent
 m=o.modifiers.new('Soft felt vane thickness','SOLIDIFY');m.thickness=.007
 b=o.modifiers.new('Rounded stitched feather edge','BEVEL');b.width=.004;b.segments=2
 return o
def cloth_band(name,rx,ry,cy,z,width,material,part):
 vv=[];ff=[]
 for dz in [-width/2,width/2]:
  for j in range(48):
   a=j*math.tau/48;vv.append((rx*math.cos(a),cy+ry*math.sin(a),z+dz))
 for j in range(48):ff.append((j,(j+1)%48,(j+1)%48+48,j+48))
 d=bpy.data.meshes.new(name);d.from_pydata(vv,[],ff);d.update();o=obj(name,d,part,material=material);sol=o.modifiers.new('Cloth strap thickness','SOLIDIFY');sol.thickness=.009
 return o
def patch_border(name,center,size,power,material):
 pts=[]
 for j in range(64):
  a=j*math.tau/64;p,n=surface(Vector((.87*math.cos(a),-math.sqrt(1-.87**2),.87*math.sin(a))),size,power,0);pts.append(tuple(Vector(center)+p+n*.006))
 yarn(name,pts,material,radius=.006,closed=True)
def cup(part,material):
 rings=[];verts=[]
 for rr,zz in [(.10,-.94),(.18,-1.02),(.18,-1.11),(.145,-1.11),(.10,-1.06),(.001,-1.015)]:
  ring=[]
  for j in range(40):
   a=j*math.tau/40;ring.append(len(verts));verts.append((rr*math.cos(a),-.13+rr*math.sin(a),zz))
  rings.append(ring)
 faces=[]
 for a,b in zip(rings,rings[1:]):
  for j in range(40):faces.append((a[j],b[j],b[(j+1)%40],a[(j+1)%40]))
 d=bpy.data.meshes.new('Hollow felt suction cup');d.from_pydata(verts,[],faces);d.update();o=obj('hollow suction palm',d,part,material=material)
 for f in d.polygons:f.use_smooth=True
 for j in range(6):
  a=j*math.tau/6;yarn('cup rim radial stitch',[(.15*math.cos(a),-.13+.15*math.sin(a),-1.115),(.18*math.cos(a),-.13+.18*math.sin(a),-1.115)],oat,part,.003)
def rig(spec,locations):
 global current,parts
 col=bpy.data.collections.new('RONGBOY / '+spec['id']);bpy.context.scene.collection.children.link(col);root=bpy.data.objects.new('Zombie / '+spec['id'],None);col.objects.link(root);root['zombieType']=spec['id'];root['asset_version']='v6';parts={}
 for name,loc in locations.items():
  p=bpy.data.objects.new('CTRL / '+spec['id']+' / '+name,None);col.objects.link(p);p.parent=root;p.location=loc;p['part']=name;parts[name]=p
 current=dict(spec,collection=col,root=root);return current
def build(spec):
 global skin,light,patch
 k=spec['id'];skin=mat(k+' target olive wool',SKIN_PALETTES[k]);light=mat(k+' lighter olive wool',LIGHT_PALETTES[k]);patch=mat(k+' target repair wool',PATCH_PALETTES[k]);accent=mat(k+' cloth',spec['accent'])
 if k=='leaper':
  rig(spec,dict(Body=(0,.10,.91),Head=(0,-.13,1.47),ArmL=(-.27,-.04,1.25),ArmR=(.27,-.04,1.25),LegL=(-.24,.10,.80),LegR=(.24,.10,.80)))
  head((0,-.01,.27),(.49,.32,.28),pear=-.08,mouth_v=-.45,teeth=4);ball('compact forward torso',(0,0,.12),(.25,.27,.32),skin,fur=850,pear=.15,rot=(.30,0,0));ball('leaning neck bridge',(0,-.13,.47),(.14,.16,.20),skin,fur=380,rot=(.25,0,0))
  for n in ['ArmL','ArmR']:limb(n,.59,.085,.105)
  for n in ['LegL','LegR']:
   ball('powerful folded thigh',(0,.03,-.12),(.18,.25,.27),pants,n,450,rot=(-.45,0,0));ball('slanted hock',(0,-.04,-.47),(.105,.12,.24),skin,n,300,rot=(.60,0,0));ball('long spring foot',(0,-.24,-.68),(.18,.30,.10),skin,n,220)
   ball('soft knee join',(0,-.14,-.35),(.135,.15,.12),skin,n,110)
   ball('stuffed ankle join',(0,.025,-.66),(.105,.13,.11),skin,n,100)
   ball('spring foot dark sole',(0,-.24,-.76),(.18,.29,.021),sole,n)
  for n in ['LegL','LegR']:
   ball('sewn knee patch',(0,-.265,-.36),(.095,.025,.11),patch,n,90,power=.65)
   for sign in [-1,1]:yarn('knee crossed stitch',[(-.05,-.293,-.36-sign*.05),(.05,-.293,-.36+sign*.05)],oat,n,.004)
   blob_seam('thigh outer seam',(0,.03,-.12),(.18,.25,.27),part=n,material=oat,front=True,rot=(-.45,0,0))
   for x in [-.06,0,.06]:yarn('spring foot toe seam',[(x,-.48,-.70),(x,-.53,-.68),(x,-.50,-.64)],ink,n,.0035)
  blob_seam('projected forward chest stitch',(0,0,.12),(.25,.27,.32),1,.15,front=True,rot=(.30,0,0))
 elif k=='heavy':
  rig(spec,dict(Body=(0,.06,.86),Head=(0,-.13,1.64),ArmL=(-.48,.02,1.22),ArmR=(.48,.02,1.22),LegL=(-.27,.02,.44),LegR=(.27,.02,.44)))
  ball('large pear stuffed torso',(0,0,.27),(.57,.39,.68),skin,fur=1800,pear=.22);head((0,-.04,.18),(.30,.29,.34),power=.9,mouth_w=.48,teeth=4)
  for n in ['ArmL','ArmR']:limb(n,.72,.18,.18)
  for n in ['LegL','LegR']:limb(n,.43,.15,leg=True)
  taupe=mat('quilt middle cloth','#8C7158');cream=mat('quilt oat cloth','#B7A07C')
  for side in [-1,1]:
   ball('quilt cloth backing',(0,side*.38,.215),(.47,.045,.54),cream,fur=80,power=.6)
   for row,zz in enumerate([-.12,.22,.55]):
    for xx in [-.29,0,.29]:
     y=side*(.40+.018*math.sqrt(max(.1,1-(xx/.57)**2-((zz-.27)/.7)**2)))
     ball('inflated quilt cell',(xx,y,zz),(.15,.115,.162),taupe if row==1 else cream,fur=70,power=.80)
   yarn('rolled quilt perimeter',[(.46*math.copysign(abs(math.cos(a))**.35,math.cos(a)),side*.43,.215+.52*math.copysign(abs(math.sin(a))**.35,math.sin(a))) for a in [j*math.tau/64 for j in range(64)]],cream,radius=.019,closed=True)
  for side in [-1,1]:
   for row,zz in enumerate([-.12,.22,.55]):
    for yy in [-.18,.19]:ball('side quilt cell',(side*.51,yy,zz),(.082,.195,.162),taupe if row==1 else cream,fur=40,power=.80)
  for zz in [-.29,.055,.39,.72]:
   yarn('quilt seam cross row',[(-.44,-.416,zz),(0,-.427,zz+.012),(.44,-.416,zz)],cream,radius=.004)
 elif k=='crawler':
  rig(spec,dict(Body=(0,.25,.46),Head=(0,-.30,.65),ArmL=(-.40,-.16,.61),ArmR=(.40,-.16,.61),LegL=(-.28,.48,.36),LegR=(.28,.48,.36)))
  ball('horizontal low belly',(0,.08,.10),(.41,.52,.30),skin,fur=1200,power=.9);head((0,-.10,.14),(.49,.34,.27),power=.83,mouth_v=-.43,mouth_w=.52,teeth=5)
  for n in ['ArmL','ArmR']:limb(n,.49,.13,.18)
  for n in ['LegL','LegR']:limb(n,.34,.12,leg=True)
  pts=[]
  for j in range(13):
   a=-1.02+j*2.04/12;p,n=surface(Vector((0,math.sin(a),math.cos(a))),(.41,.52,.30),.9,0);pts.append(tuple(Vector((0,.08,.10))+p+n*.006))
  seam('projected crawling back seam',pts,material=oat,r=.0045)
  for n in ['ArmL','ArmR']:
   ball('crawler forearm repair',(0,-.18,-.20),(.085,.027,.09),patch,n,80,power=.65)
   for sign in [-1,1]:yarn('crawler repair stitch',[(-.04,-.212,-.20-sign*.04),(.04,-.212,-.20+sign*.04)],oat,n,.0038)
 elif k=='shielded':
  rig(spec,dict(Body=(0,.03,.83),Head=(.07,-.01,1.40),ArmL=(-.40,-.04,1.26),ArmR=(.29,.01,1.22),LegL=(-.18,.02,.64),LegR=(.18,.02,.64)))
  ball('narrow leaning chest',(0,.02,.23),(.27,.24,.45),skin,fur=850,pear=.10);head((.025,-.01,.38),(.31,.30,.40),power=.87,eyes=(-.32,.36),teeth=5)
  limb('ArmR',.63,.10,.12);limb('ArmL',.64,.21,.19)
  for n,w in [('ArmL',.20),('ArmR',.13)]:
   ball('sewn shoulder repair',(0,-.04,.045),(w,.145,.045),patch,n,70)
  for zz in [-.24,-.54]:cloth_band('shield forearm strap',.225,.27,-.05,zz,.06,oat,'ArmL')
  for n in ['LegL','LegR']:limb(n,.63,.12,leg=True)
  ball('felt shield',(-.04,-.30,-.35),(.38,.15,.57),accent,'ArmL',800,power=.65);ball('shield padded rim',(-.04,-.43,-.35),(.32,.035,.50),oat,'ArmL');ball('shield face',(-.04,-.46,-.35),(.29,.03,.46),accent,'ArmL')
  yarn('shield rear hand loop',[(-.20,-.10,-.58),(-.20,.02,-.47),(.12,.02,-.47),(.12,-.10,-.58)],oat,'ArmL',.018)
  yarn('shield stitched rear binding',[(-.04+.31*math.cos(a),-.17,-.35+.46*math.sin(a)) for a in [j*math.tau/48 for j in range(48)]],oat,'ArmL',.004,True)
  seam('projected shield central stitch',[(-.04,-.46-.03*math.sqrt(max(.01,1-((z+.35)/.46)**2))-.005,z) for z in [-.74,-.55,-.35,-.15,.04]],'ArmL')
 elif k=='bomber':
  rig(spec,dict(Body=(0,.04,.79),Head=(0,-.09,1.44),ArmL=(-.43,0,1.16),ArmR=(.43,0,1.16),LegL=(-.23,.02,.43),LegR=(.23,.02,.43)))
  ball('round bomb carrier torso',(0,.02,.20),(.51,.40,.55),skin,fur=1600,power=.93);head((0,-.02,.20),(.36,.31,.29),pear=.16,mouth_w=.43,teeth=4)
  for n in ['ArmL','ArmR']:limb(n,.50,.13,.16)
  for n in ['LegL','LegR']:limb(n,.42,.14,leg=True)
  # Bomb supply is actual volume on the back; the right hand holds the thrown payload.
  for x,z in [(-.28,.24),(0,.24),(.28,.24)]:
   ball('spare yarn bomb',(x,.47,z),(.18,.19,.18),accent,fur=260);wraps('spare bomb yarn',(x,.47,z),.19,accent,'Body');yarn('spare bomb cloth fuse',[(x,.47,z+.18),(x+.025,.48,z+.26),(x+.06,.47,z+.24)],oat,radius=.010)
  held=point('heldBomb','ArmR',(0,-.20,-.43));ball('held yarn bomb',(0,0,0),(.18,.18,.18),accent,'ArmR',350,parent=held)
  wraps('held bomb full winding',(0,0,0),.184,accent,'ArmR',held)
  ball('padded carrier backboard',(0,.48,.10),(.49,.075,.17),vest,fur=80,power=.65)
  for xx in [-.28,0,.28]:
   ball('stitched bomb pouch',(xx,.60,.10),(.165,.07,.15),vest,fur=100,power=.62)
   yarn('pouch top stitching',[(xx-.13,.676,.23),(xx,.682,.24),(xx+.13,.676,.23)],oat,radius=.004)
   for sign in [-1,1]:yarn('pouch repair cross',[(xx-.035,.677,.1-sign*.035),(xx+.035,.677,.1+sign*.035)],oat,radius=.004)
  for xx in [-.27,.27]:yarn('padded carrier shoulder strap',[(xx,-.33,.13),(xx,-.31,.39),(xx,-.12,.64),(xx,.16,.67),(xx,.43,.41),(xx,.48,.04)],vest,radius=.027)
  cloth_band('carrier waist belt',.50,.405,.02,.13,.065,vest,'Body')
  blob_seam('carrier back seam',(0,.02,.20),(.51,.40,.55),.93,0,material=patch)
  yarn('soft bomb fuse',[(0,0,.18),(.03,0,.27),(-.01,0,.31)],oat,'ArmR',.012,parent=held)
 elif k=='archer':
  rig(spec,dict(Body=(0,.12,.92),Head=(0,-.12,1.50),ArmL=(-.26,-.01,1.48),ArmR=(.26,-.01,1.48),LegL=(-.15,.05,.78),LegR=(.15,.05,.78)))
  ball('thin curved chest',(0,.02,.18),(.21,.22,.48),skin,fur=850,pear=-.12,rot=(.15,0,0));ball('stooped shoulder hump',(0,.17,.46),(.25,.22,.23),skin,fur=430)
  ball('long cloth quiver',(0,.37,.49),(.14,.13,.35),accent,fur=250)
  for z in [.24,.67]:yarn('quiver binding',[(.14*math.cos(a),.37+.13*math.sin(a),z) for a in [j*math.tau/36 for j in range(36)]],oat,radius=.005,closed=True)
  yarn('quiver shoulder strap',[(-.17,.22,.65),(-.19,-.18,.34),(.15,-.16,-.06)],vest,radius=.013)
  head((0,-.04,.36),(.26,.28,.34),pear=.15,eyes=(-.37,.35),mouth_v=-.50,mouth_w=.42,teeth=3)
  limb('ArmL',.62,.085,.10);limb('ArmR',.70,.09,.11);point('drawHand','ArmR',(0,-.12,-.70*.84))
  for n in ['LegL','LegR']:limb(n,.77,.085,leg=True)
  bow=point('bowMount','ArmL',(-.13,-.21,-.52));bow.rotation_euler.x=math.pi/2
  yarn('soft bow arc',[(.12,-.04,-.60),(-.08,-.07,-.32),(-.18,-.07,0),(-.08,-.07,.32),(.12,-.04,.60)],accent,'ArmL',.025,parent=bow)
  for label,pos in [('bowUpper',(.12,-.04,.60)),('bowLower',(.12,-.04,-.60)),('bowNock',(.12,-.04,0)),('bowBack',(.12,.25,0))]:
   p=point(label,'ArmL',pos);p.parent=bow
  string=point('nativeString','ArmL',(0,0,0));string.parent=bow;yarn('bow string',[(.12,-.04,-.60),(.12,-.04,0),(.12,-.04,.60)],oat,'ArmL',.003,parent=string)
  arrow=point('heldArrow','ArmL',(.12,-.04,0));arrow.parent=bow
  yarn('nocked arrow shaft',[(0,.30,0),(0,-.53,0)],vest,'ArmL',.007,parent=arrow);ball('soft arrow tip',(0,-.57,0),(.032,.075,.032),accent,'ArmL',parent=arrow)
  for side in [-1,1]:vane('nocked arrow felt vane',[(0,.34,0),(side*.065,.31,0),(side*.065,.19,0),(0,.24,0)],'ArmL',arrow)
  for z in [-.07,.07]:yarn('wrapped bow grip',[(-.02,-.07,z),(.03,-.08,z),(.08,-.07,z)],oat,'ArmL',.006,parent=bow)
  for x in [-.08,.02,.12]:yarn('back arrow shaft',[(x,.43,.25),(x,.43,.90)],vest,radius=.007);vane('quiver arrow felt vane',[(x,.43,.90),(x+.055,.43,.86),(x+.055,.43,.73),(x,.43,.79)],'Body')
 elif k=='boss-warden':
  rig(spec,dict(Body=(0,.07,1.07),Head=(0,-.13,1.62),ArmL=(-.54,0,1.51),ArmR=(.54,0,1.51),LegL=(-.28,.02,.57),LegR=(.28,.02,.57)))
  ball('massive low trapezoid torso',(0,.03,.18),(.56,.40,.68),skin,fur=1700,power=.82,pear=-.15);head((0,-.03,.23),(.36,.32,.34),power=.64,mouth_w=.49,teeth=5)
  for n in ['ArmL','ArmR']:
   ball('high sunk shoulder',(0,0,-.08),(.265,.29,.31),skin,n,650);limb(n,1.30,.22,.26)
  for n in ['LegL','LegR']:limb(n,.56,.18,leg=True)
  ball('grave cloth belly',(0,-.34,.12),(.40,.11,.46),accent,fur=600,power=.8)
  blob_seam('projected quilt belly seam',(0,-.34,.12),(.40,.11,.46),.8,0,material=oat,front=True)
  blob_seam('warden back heavy seam',(0,.03,.18),(.56,.40,.68),.82,-.15,material=oat)
  for n in ['ArmL','ArmR']:seam('large hand seam',[(-.10,-.33,-.92),(0,-.34,-1.0),(.10,-.33,-.92)],n,material=vest,r=.004)
  patch_border('warden panel binding',(0,-.34,.12),(.40,.11,.46),.8,oat)
  for xx,zz in [(-.28,-.24),(.28,.38)]:
   yy=.03+.43*math.sqrt(max(.1,1-(xx/.65)**2-(zz/.68)**2))+.004
   for sign in [-1,1]:yarn('warden back repair',[(xx-.025,yy,.18+zz-sign*.025),(xx+.025,yy,.18+zz+sign*.025)],ink,radius=.0045)
  ball('lock keyhole',(0,-.512,.20),(.032,.009,.032),ink)
  yarn('lock keyhole stem',[(0,-.52,.18),(0,-.52,.12)],ink,radius=.011)
  box('cloth lock',(0,-.46,.18),(.27,.09,.27),oat,radius=.04);yarn('lock loop',[(-.09,-.50,.31),(-.08,-.50,.46),(.08,-.50,.46),(.09,-.50,.31)],oat,radius=.018)
 elif k=='boss-leech':
  rig(spec,dict(Body=(0,.02,.92),Head=(0,-.03,1.64),ArmL=(-.33,.0,1.40),ArmR=(.33,.0,1.40),LegL=(-.15,.02,.42),LegR=(.15,.02,.42)))
  ball('long sack torso',(0,0,.18),(.235,.25,.68),skin,fur=1200,pear=.18);head((0,-.02,.33),(.245,.28,.43),pear=.23,eyes=(-.37,.34),mouth_v=-.42,mouth_w=.38,teeth=4)
  for sign in [-1,1]:ball('sloping shoulder join',(sign*.22,0,.48),(.15,.19,.20),skin,fur=280,rot=(0,sign*.2,0))
  for n in ['ArmL','ArmR']:
   limb(n,.99,.10,.16)
   cup(n,accent)
   yarn('soft sucker palm',[(.18*math.cos(a),-.13+.18*math.sin(a),-1.11) for a in [j*math.tau/40 for j in range(40)]],oat,n,.022,True)
  for n in ['LegL','LegR']:limb(n,.41,.105,leg=True)
  for n in ['ArmL','ArmR']:ball('leech shoulder repair',(0,-.02,.04),(.13,.13,.04),patch,n,60)
  blob_seam('leech back stitch',(0,0,.18),(.235,.25,.68),1,.18,material=accent)
  blob_seam('projected sack front repair',(0,0,.18),(.235,.25,.68),1,.18,material=accent,front=True)
 return current
built=[]
for spec in ROSTER:
 if spec['id']=='walker':
  col=bpy.data.collections.new('RONGBOY / walker');bpy.context.scene.collection.children.link(col)
  for ob in walker_objects:
   for old in list(ob.users_collection):old.objects.unlink(ob)
   col.objects.link(ob)
  walker['zombieType']='walker';walker['asset_version']='v6';walker['accepted_reference']='V2 solid face and limb geometry preserved; target palette, draped fibres and vest stitching';item=dict(spec,collection=col,root=walker)
  current=item;parts={o.get('part'):o for o in col.objects if o.get('part') and o.type=='EMPTY'};bpy.context.view_layer.update();inverse=parts['Body'].matrix_world.inverted()
  pts=[]
  for j in range(64):
   a=j*math.tau/64;pts.append(inverse@Vector((.315*.9*math.cos(a),.14+.145*math.sqrt(1-.9**2)+.005,1.0+.34*.9*math.sin(a))))
  for j in range(0,64,4):yarn('V6 vest back running stitch',[tuple(pts[j]),tuple(pts[(j+2)%64])],oat,radius=.004)
  for sign in [-1,1]:
   outline=[(sign*x,z) for x,z in [(.258,1.265),(.155,1.22),(.09,1.16),(.12,1.04),(.095,.80),(.15,.755),(.25,.76),(.26,.86)]]
   path=[];graph=bpy.context.evaluated_depsgraph_get()
   for x,z in outline:
    hits=[]
    for ob in list(parts['Body'].children_recursive):
     if ob.type!='MESH' or ob.get('fuzz') or ob.name.startswith('fuzz'):continue
     back=ob.matrix_world.inverted();ev=ob.evaluated_get(graph);ok,hit,n,face=ev.ray_cast(back@Vector((x,-2,z)),(back.to_3x3()@Vector((0,1,0))).normalized())
     if ok:hits.append((ob.matrix_world@hit).y)
    yy=min(hits)-.004 if hits else -.205*math.sqrt(max(.12,1-(x/.36)**2))-.04
    path.append(inverse@Vector((x,yy,z)))
   for a,b in zip(path,path[1:]):
    for k in range(3):yarn('V6 lapel hem stitch',[tuple(a.lerp(b,k/3)),tuple(a.lerp(b,(k+.55)/3))],oat,radius=.0035)

 else:
  item=build(spec);bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();coords=[]
  for ob in item['collection'].objects:
   if ob.type not in {'MESH','CURVE'} or ob.get('fuzz'):continue
   ev=ob.evaluated_get(graph);me=ev.to_mesh();coords.extend(ob.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear()
  lo=min(p.z for p in coords);hi=max(p.z for p in coords);target=(spec['height']+.017)/.78;f=(target-.022)/(hi-lo)
  for p in parts.values():p.location*=f;p.scale*=f;p.location.z+=.022-lo*f
 built.append(item)
# Fuse the padded volumes within a movable limb; keep six rig pivots and all equipment separate.
for item in built:
 if item['id']=='walker':continue
 names=['ArmL','ArmR']+(['LegL','LegR'] if item['id']=='leaper' else [])
 for name in names:
  ctrl=next(o for o in item['collection'].objects if o.get('part')==name and o.type=='EMPTY')
  selected=[o for o in item['collection'].objects if o.type=='MESH' and o.parent==ctrl and not o.get('fuzz') and len(o.data.materials)==1 and (o.data.materials[0]==skin or 'target olive wool' in o.data.materials[0].name)]
  if len(selected)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in selected:o.select_set(True)
  bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=bpy.context.object
  original=sum(max(1,len(f.vertices)-2) for f in o.data.polygons);span=max(max(v.co[i] for v in o.data.vertices)-min(v.co[i] for v in o.data.vertices) for i in range(3))
  mod=o.modifiers.new('Continuous stuffed felt limb','REMESH');mod.mode='VOXEL';mod.voxel_size=span/70;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
  smooth=o.modifiers.new('Soft wool padding transition','SMOOTH');smooth.factor=.35;smooth.iterations=2;bpy.ops.object.modifier_apply(modifier=smooth.name)
  dec=o.modifiers.new('Realtime limb budget','DECIMATE');dec.ratio=min(1,max(1300,min(4000,original))/max(1,len(o.data.polygons)));bpy.ops.object.modifier_apply(modifier=dec.name)
  for f in o.data.polygons:f.use_smooth=True
  o.name=item['id']+' / continuous stuffed '+name;o['structural_surface']=item['id'];print('FELT_LIMB',item['id'],name,len(o.data.polygons),flush=True)

# Drape short curved fibres over the finished cloth meshes, after limb fusion.
# These follow the real surface normals, rather than forming radial spikes.
import bisect
for item in built:
 col=item['collection']
 for ob in list(col.objects):
  if ob.get('fuzz') or ob.name.startswith('fuzz'):bpy.data.objects.remove(ob,do_unlink=True)
 bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();surfaces=[]
 for ob in list(col.objects):
  if ob.type!='MESH' or not any(m and m.use_nodes and any(n.type=='NORMAL_MAP' for n in m.node_tree.nodes) for m in ob.data.materials):continue
  ev=ob.evaluated_get(graph);me=ev.to_mesh();me.calc_loop_triangles();triangles=[];cdf=[];area=0
  for tri in me.loop_triangles:
   vs=[me.vertices[i].co.copy() for i in tri.vertices];a=(vs[1]-vs[0]).cross(vs[2]-vs[0]).length*.5
   if a<1e-10:continue
   ns=[me.vertex_normals[i].vector.copy() for i in tri.vertices];area+=a;cdf.append(area);triangles.append((vs,ns,tri.material_index))
  ev.to_mesh_clear()
  if area>0:surfaces.append((ob,triangles,cdf,area))
 total=sum(s[3] for s in surfaces);count_all=0
 for index,(ob,tris,cdf,area) in enumerate(surfaces):
  count=max(3,min(1800,round(3400*area/total)));rnd=random.Random(9021+index+ROSTER.index(next(s for s in ROSTER if s['id']==item['id']))*1000)
  verts=[];faces=[];normals=[];tones=[]
  span=max(max(v.co[i] for v in ob.data.vertices)-min(v.co[i] for v in ob.data.vertices) for i in range(3));length_scale=min(.025,max(.006,span*.085))
  for _ in range(count):
   vs,ns,mi=tris[bisect.bisect_left(cdf,rnd.random()*area)];u=math.sqrt(rnd.random());v=rnd.random();weights=(1-u,u*(1-v),u*v)
   p=sum((x*w for x,w in zip(vs,weights)),Vector());n=sum((x*w for x,w in zip(ns,weights)),Vector()).normalized()
   t=n.cross(Vector((.31,.72,.19))).normalized();b=n.cross(t).normalized();angle=rnd.random()*math.tau;t,b=t*math.cos(angle)+b*math.sin(angle),-t*math.sin(angle)+b*math.cos(angle)
   length=length_scale*rnd.uniform(.55,1.3);width=rnd.uniform(.00038,.00075);bend=length*rnd.uniform(-.35,.35);lift=rnd.uniform(.0011,.0030);j=len(verts);tone=rnd.uniform(.90,1.13)
   for f,w in [(0,1),(.5,.8),(1,.08)]:
    center=p+t*(length*(f-.5))+b*(math.sin(f*math.pi)*bend)+n*(.0007+math.sin(f*math.pi)*lift)
    for sign in [-1,1]:verts.append(center+b*(sign*width*w));normals.append(tuple(n));tones.append(tone)
   faces.extend([(j,j+1,j+3,j+2),(j+2,j+3,j+5,j+4)])
  me=bpy.data.meshes.new('Curved short wool fibre ribbons');me.from_pydata(verts,[],faces);me.update();me.normals_split_custom_set_from_vertices(normals)
  tint=me.color_attributes.new(name='Fibre tone',type='FLOAT_COLOR',domain='POINT')
  for i,tone in enumerate(tones):tint.data[i].color=(tone,tone,tone,1)
  f=bpy.data.objects.new(item['id']+' / fibre / '+ob.name,me);col.objects.link(f);f.parent=ob.parent;f.matrix_basis=ob.matrix_basis.copy();fibre_mat=ob.data.materials[0].copy();fibre_mat.name='fibre / '+ob.data.materials[0].name;bs=fibre_mat.node_tree.nodes.get('Principled BSDF');color=tuple(bs.inputs['Base Color'].default_value);bs.inputs['Base Color'].default_value=tuple(min(1,c*1.35) for c in color[:3])+(1,);fibre_mat.diffuse_color=tuple(min(1,c*1.35) for c in color[:3])+(1,);me.materials.append(fibre_mat);f['fuzz']=True;f['wool_profile']='curled_surface';count_all+=count
 print('CURVED_FIBRES',item['id'],count_all,flush=True)

DESIGN_FIT={'leaper': (0.95, 0.96), 'heavy': (0.96, 1.06), 'crawler': (1.08, 0.94), 'shielded': (0.85, 0.9), 'bomber': (0.96, 0.82), 'archer': (0.85, 0.78), 'boss-warden': (0.93, 1), 'boss-leech': (1.08, 0.85)}
for item in built:
 if item['id'] in DESIGN_FIT:
  sx,sy=DESIGN_FIT[item['id']];item['root'].scale=(sx,sy,1);item['root']['design_fit']=[sx,sy,1]

for item in built:
 target=OUT/'design'/(item['id']+'.png');item['root']['target_sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
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
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1400;scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.55,.55,.55,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.4;scene.view_settings.view_transform='AgX';scene['design_status']='V6 modeled against nine image_gen front/side/back targets; awaiting user judgement'
# Every textured surface needs UVs before material batches can merge in the browser.
for item in built:
 for ob in item['collection'].objects:
  if ob.type!='MESH' or ob.get('fuzz') or ob.data.uv_layers:continue
  me=ob.data;axes=sorted(range(3),key=lambda i:max(v.co[i] for v in me.vertices)-min(v.co[i] for v in me.vertices),reverse=True)[:2]
  lo=[min(v.co[a] for v in me.vertices) for a in axes];span=[max(v.co[a] for v in me.vertices)-lo[i] for i,a in enumerate(axes)];uv=me.uv_layers.new(name='UVMap')
  for f in me.polygons:
   for li in f.loop_indices:
    p=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=tuple((p[a]-lo[i])/max(.0001,span[i]) for i,a in enumerate(axes))

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rongboy-zombie-roster-v6.blend'),compress=True)
if '--render' in sys.argv:scene.render.filepath=str(OUT/'roster-native-overview.png');bpy.ops.render.render(write_still=True)
for item in built:item['root'].location=(0,0,0)
for ob in scene.objects:ob.select_set(False)
for item in built:
 for ob in item['collection'].objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'zombie-roster.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_yup=True)
public=[{k:item[k] for k in ['id','name','role','pose','accent','height','width']} for item in built]
(OUT/'catalog.json').write_text(json.dumps(dict(models=public,source='rongboy-zombie-roster-v6.blend',basis='AI palette and draped short-fibre pass; V2 walker solid shape retained',bytes=(OUT/'zombie-roster.glb').stat().st_size,skin_palette=SKIN_PALETTES,fibre_texture='design/felt-fibre-tile.png',fibre_mode='curved surface ribbons + 1024 neutral micro-albedo/normal'),ensure_ascii=False,indent=2))
(ROOT/'library/games/rongboy-roster.js').write_text('// Native V6 roster. Generated by rongboy_zombies_v6.py.\nexport const ZOMBIE_ROSTER = '+json.dumps(public,ensure_ascii=False,indent=2)+';\nexport const ZOMBIE_ALIASES={tank:"heavy",runner:"leaper",weaver:"leaper"};\n')
print('V6_DONE',len(public),(OUT/'zombie-roster.glb').stat().st_size,flush=True)
