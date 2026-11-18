"""Build the crawler, shield bearer and yarn bomber from their three costume sheets."""
from pathlib import Path
import hashlib
import json
import math
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path.cwd()
OUT = ROOT/'assets/rongboy/second-trio'
SOURCE = ROOT/'assets/rongboy/zombies-v7'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'rongboy-walker-family.blend'))
bpy.context.preferences.filepaths.save_version=0
template=bpy.data.collections['RONGBOY / walker']
base={o['part']:o for o in template.objects if o.type=='EMPTY' and o.get('part')}
TAU=math.tau

import sys
sys.path.insert(0,str(ROOT/'scripts/blender'))
from rongboy_tailoring import dyed, mesh, soft, piping, grid, ribbon, contour, button, profile

indigo=dyed('ink denim','3d495b'); navy=dyed('midnight vest','303440')
leather=dyed('saddle felt','a77445'); gold=dyed('ochre binding','c4964b')
thread=dyed('running stitch','debf90');blue=dyed('storm blue shield','536a78')
ridge=dyed('shield ridge','83949c'); apron=dyed('apron canvas','996440')
pouch=dyed('pocket canvas','b07b4d'); russet=dyed('copper stitching','b25f39')
yarn=dyed('golden yarn','d69a3b');twist=dyed('golden yarn lights','e8b34c')
cream=dyed('undyed cotton tail','e4c9a0')
skin={'crawler':'93957e','shielded':'798358','bomber':'969054'}

def arm_patch(col,p,side):
    bpy.context.view_layer.update()
    solid=next(o for o in p.children if o.type=='MESH' and not o.get('fuzz'))
    tree=BVHTree.FromPolygons([solid.matrix_local@v.co for v in solid.data.vertices],
                             [f.vertices[:] for f in solid.data.polygons])
    y,z=-.14,-.21
    hit=tree.ray_cast((side,y,z),(-side,0,0))[0]
    if hit is None:raise ValueError('Elbow surface not found')
    x=hit.x-side*.012
    soft(col,p,'ochre elbow mend',(x,y,z),(.044,.098,.094),gold)
    lines=[]
    for i in range(12):
        def edge(a):return (x+side*.031,y+.074*math.cos(a),z+.073*math.sin(a))
        lines.append([edge(TAU*i/12),edge(TAU*(i+.53)/12)])
    piping(col,p,'elbow blanket stitches',lines,thread,.0038)

def crawler(col,parts):
    p=parts['Body']
    # Torso runs along Y between the raised head and haunches.
    def surface(a,t,offset=0):
        y=-.40+1.05*t
        cross=math.sqrt(max(.0004,1-(2*t-1)**2))
        return Vector(((.38*cross+offset)*math.sin(a),y,.015+(.25*cross+offset)*math.cos(a)))
    grid(col,p,'horizontal denim overalls',lambda u,v:surface(TAU*u,v),indigo,64,44)
    for s in (-1,1):
        path=[surface(s*(.94-1.83*t),.14+.67*t,.014) for t in (i/42 for i in range(43))]
        ribbon(col,p,'crossed ochre suspender',path,gold,.068)
    def pocket(u,v):return surface((u-.5)*1.14,.82+.15*v,.014)
    grid(col,p,'rear dungaree pocket',pocket,indigo,16,12,.012)
    contour(col,p,'pocket hem',lambda t:pocket(.5+.48*math.copysign(abs(math.cos(TAU*t))**.35,math.cos(TAU*t)),.5+.48*math.copysign(abs(math.sin(TAU*t))**.35,math.sin(TAU*t))),thread,.0033)
    for name,s in [('ArmL',-1),('ArmR',1)]:arm_patch(col,parts[name],s)
    for s in (-1,1):button(col,p,'brass bib button',(s*.17,-.34,.045),gold,.037)

def shield(col,p):
    # Layered stuffed kite with broad upper half, a pointed hem and a convex face.
    mount=bpy.data.objects.new('shield grip assembly',None)
    col.objects.link(mount);mount.parent=p;mount.location=(-.022,-.39,.018);p=mount
    def disk(a,t):
        k=math.sin(a)
        return Vector((-.04+.294*t*math.cos(a)*(.85+.44*k),-.29-.077*(1-t*t),-.47+.515*t*k))
    grid(col,p,'denim kite shield',lambda u,v:disk(-TAU*u,max(.001,v)),blue,64,16,.035)
    contour(col,p,'mustard rolled shield rim',lambda u:disk(TAU*u,1),gold,.021)
    path=[Vector((-.04,-.295-.077*(1-t*t),-.47+.50*t)) for t in (i/24-1 for i in range(49))]
    piping(col,p,'raised kite ridge',[path],ridge,.024)
    piping(col,p,'ridge running stitch',[[v+Vector((0,-.024,0)) for v in path[i:i+2]] for i in range(0,len(path)-1,3)],thread,.0035)
    for z in (-.36,-.59):
        line=[(-.19+.28*t,-.34+.195*math.sin(t*math.pi),z) for t in (i/24 for i in range(25))]
        piping(col,p,'rear padded grip',[line],leather,.023)

def shielded(col,parts,felt):
    p=parts['Body']
    lo,hi=-.07,.72
    at=profile([(lo,.24,.18,0),(.04,.36,.255,.01),(.27,.425,.30,.015),(.55,.53,.30,.018),(.63,.50,.265,.015),(hi,.22,.19,0)])
    grid(col,p,'broad shoulder chest',lambda u,v:at(TAU*u,lo+(hi-lo)*v),felt)
    def vest(u,v):
        gap=.035+.56*v**2.3
        a=gap+(TAU-2*gap)*u;top=.712-.10*max(0,math.cos(a))**3-.17*abs(math.sin(a))**8
        return at(a,.015+(top-.015)*v,.024)
    grid(col,p,'tailored navy vest',vest,navy,72,28,.012)
    for v in (0,1):piping(col,p,'vest binding',[[vest(i/80,v) for i in range(81)]],navy,.011)
    for a0,a1,z0,z1 in [(-.94,.86,.13,.68),(math.pi-.86,math.pi+.94,.68,.13)]:
        path=[at(a0+(a1-a0)*t,z0+(z1-z0)*t,.038) for t in (i/48 for i in range(49))]
        ribbon(col,p,'broad stitched bandolier',path,leather,.10)
    soft(col,p,'belt satchel',at(-.85,.14,.085),(.108,.078,.098),leather)
    shield(col,parts['ArmL'])

def yarnball(col,p,location,r,name):
    center=Vector(location);soft(col,p,name+' yarn core',center,(r,r,r),yarn)
    lines=[]
    # Wind groups of adjacent strands on changing axes around the stuffed centre.
    for i in range(6):
        axis=Vector((math.cos(i*2.4),math.sin(i*2.4),.27+math.sin(i*.93))).normalized()
        u=axis.cross(Vector((.14,.75,.37))).normalized();v=axis.cross(u)
        for k in range(4):
            shift=(k-1.5)*.112
            lines.append([center+r*(axis*shift+(u*math.cos(a)+v*math.sin(a))*math.sqrt(1-shift**2))*(1.01+.004*i) for a in (TAU*j/40 for j in range(41))])
    piping(col,p,name+' wound strands',lines,twist,r*.059)

def bomber(col,parts,felt):
    p=parts['Body'];lo,hi=-.14,.76
    at=profile([(lo,.12,.12,0),(-.06,.42,.30,0),(.13,.525,.39,0),(.30,.49,.366,0),(.51,.37,.29,.014),(.64,.28,.22,.015),(hi,.16,.15,0)])
    grid(col,p,'pear shaped stuffed body',lambda u,v:at(TAU*u,lo+(hi-lo)*v),felt,64,32)
    def bib(u,v):
        a=(u-.5)*2*(1.13-.52*v)
        return at(a,.014+v*.56,.018)
    grid(col,p,'caramel apron',bib,apron,38,24,.012)
    for edge in [lambda t:bib(t,0),lambda t:bib(t,1),lambda t:bib(0,t),lambda t:bib(1,t)]:
        piping(col,p,'apron seam',[[edge(i/64),edge((i+.55)/64)] for i in range(0,64,2)],russet,.0045)
    for s in (-1,1):
        path=[at(s*(.50+.65*t),.57+.135*t,.024) for t in (i/16 for i in range(17))]
        path += [at(s*(1.15+3.10*t),.705-.42*t,.024) for t in (i/44 for i in range(1,45))]
        ribbon(col,p,'cross back apron strap',path,leather,.067)
        def pocket(u,v):return at(s*.55+(u-.5)*.48,.075+v*.155,.040+.019*math.sin(math.pi*u))
        grid(col,p,'apron patch pocket',pocket,pouch,16,10,.008)
        for k in (0,1):
            piping(col,p,'pocket running stitch',[[pocket(.04+k*.92,j/24),pocket(.04+k*.92,(j+1)/24)] for j in range(1,23,2)],thread,.003)
        piping(col,p,'pocket top edge',[[pocket(i/24,1) for i in range(25)]],russet,.004)
    grid(col,p,'low waist belt',lambda u,v:at(1.07+(TAU-2.14)*u,.249+.062*v,.029),apron,64,3,.008)
    for i,a in enumerate((math.pi-.59,math.pi,math.pi+.59)):
        c=at(a,.30,.045);yarnball(col,p,c,.11,'spare '+str(i+1))
        def bag(u,v):return at(a+(u-.5)*.48,.148+v*.15,.072+.069*math.sin(math.pi*u))
        grid(col,p,'separate cartridge pouch',bag,pouch,18,12,.012)
        piping(col,p,'pouch bound lip',[[bag(j/24,1) for j in range(25)]],russet,.006)
    hand=parts['ArmR'];held=bpy.data.objects.new('held yarn ball',None);col.objects.link(held)
    held.parent=hand;held['mechanism']='heldBomb';held.location=(.085,-.293,-.513)
    yarnball(col,held,(0,0,0),.152,'held golden')
    piping(col,held,'cream yarn tail',[[(-.04,-.11,-.09),(-.062,-.15,-.17),(-.053,-.14,-.22),(-.069,-.135,-.27)]],cream,.013)

def limb_parts(kind):
    if kind=='crawler':
        return {'Body':((0,.10,.42),(1,1,1),0),'Head':((0,-.36,.59),(.87,.86,.86),-6),
                'Arm':((.295,-.25,.57),(1.18,1.17,.80),-14),'Leg':((.22,.49,.41),(.99,1.00,.67),0)}
    if kind=='shielded':
        return {'Body':((0,.01,.72),(1,1,1),0),'Head':((.045,-.016,1.36),(.82,.88,.9),0),
                'Arm':((.448,0,1.30),(1.15,1.22,1.04),0),'Leg':((.235,.016,.70),(1.12,1.08,1.06),0)}
    return {'Body':((0,0,.46),(1,1,1),0),'Head':((0,-.025,1.12),(.77,.81,.82),-2),
            'Arm':((.34,-.008,1.027),(.93,.96,.79),0),'Leg':((.218,.015,.40),(.90,.915,.60),0)}

def clone_limb(col,p,src,kind,group,scale,tilt):
    # Keep walker topology, surface wool and button settings; dye only named fabrics.
    body_skin=skin[kind]
    for child in src.children:
        obj=child.copy()
        if obj.data:obj.data=child.data.copy()
        obj.name=kind+' / '+child.name;col.objects.link(obj);obj.parent=p
        obj.matrix_basis=Matrix.Rotation(math.radians(tilt),4,'X') @ Matrix.Diagonal(Vector((*scale,1))) @ child.matrix_local
        if obj.type!='MESH':continue
        if 'part' in obj:del obj['part']
        for i,mat in enumerate(obj.data.materials):
            label=mat.name
            if label.endswith('moss green wool'):
                # Brown boot covers the foot on the shield bearer and crawler.
                color='775b44' if group=='Leg' and kind!='bomber' else body_skin
            elif label.endswith('plum brown cloth'):
                color=body_skin if kind=='crawler' else '695243'
            elif label.endswith('dark moss felt patch'):color='606045'
            else:continue
            obj.data.materials[i]=dyed(kind+' '+group+' '+label,color,mat)

def foot_level(p):
    bpy.context.view_layer.update()
    verts=[(o.matrix_world@v.co).z for o in p.children if o.type=='MESH' and not o.get('fuzz') for v in o.data.vertices]
    return min(verts)

names={'crawler':'爬行者','shielded':'持盾者','bomber':'炸弹客'}
heights={'crawler':1.02,'shielded':1.72,'bomber':1.47}
models=[]
for kind,title in names.items():
    col=bpy.data.collections.new('NEW / '+kind);bpy.context.scene.collection.children.link(col)
    root=bpy.data.objects.new('Costume / '+kind,None);col.objects.link(root)
    root['zombieType']=kind;root['family_source']='walker'
    root['target_sha256']=hashlib.sha256((OUT/'design'/(kind+'.png')).read_bytes()).hexdigest()
    parts={};spec=limb_parts(kind)
    for name in ('Body','Head','ArmL','ArmR','LegL','LegR'):
        group=name[:-1] if name.endswith(('L','R')) else name
        pos,scale,tilt=spec[group];x,y,z=pos
        side=-1 if name.endswith('L') else 1
        p=bpy.data.objects.new(kind+' pivot '+name,None);col.objects.link(p);p.parent=root
        p['part']=name;p.location=(x*side,y,z);parts[name]=p
        if group=='Body':continue
        if kind=='shielded' and name=='ArmL':
            p.location.y=-.072;scale=(1.37,1.34,1.03);tilt=-30
        clone_limb(col,p,base[name],kind,group,scale,tilt)
        if group=='Leg' or (kind=='crawler' and group=='Arm'):
            p.location.z+=.022-foot_level(p)
    if kind=='crawler':crawler(col,parts)
    elif kind=='shielded':shielded(col,parts,dyed('shielded body',skin[kind]))
    else:bomber(col,parts,dyed('bomber body',skin[kind]))
    bpy.context.view_layer.update()
    top=max((o.matrix_world@v.co).z for o in parts['Head'].children if o.type=='MESH' for v in o.data.vertices)
    scale=(heights[kind]+.017)/(.78*top)
    for p in parts.values():p.location*=scale;p.scale*=scale
    models.append(dict(id=kind,name=title,height=heights[kind]))
# Retain the studio lighting and camera; export only the three authored actors.
for col in list(bpy.data.collections):
    if col.name.startswith('RONGBOY / '):
        for obj in list(col.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(col)
bpy.ops.object.select_all(action='DESELECT')
for kind in names:
    col=bpy.data.collections['NEW / '+kind];col.name='RONGBOY / '+kind
    for obj in col.objects:obj.select_set(True)
catalog=dict(source='second-trio.blend',models=models)
(OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/catalog['source']),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'second-trio.glb'),export_format='GLB',use_selection=True,export_extras=True,export_apply=True,export_animations=False)
print('SECOND_TRIO_DONE')
