"""Build the field archer, gate warden and siphon from the final set of turnarounds."""
import bmesh
import bpy, json, math, hashlib, sys
from mathutils import Vector, Matrix
from pathlib import Path
root=Path.cwd();out=root/'assets/rongboy/final-trio'
sys.path.insert(0,str(root/'scripts/blender'))
from rongboy_tailoring import dyed,mesh,soft,piping,grid,ribbon,profile
from rongboy_quilt_wrap import remove_old_vest
source=root/'assets/rongboy/zombies-v7'
bpy.ops.wm.open_mainfile(filepath=str(source/'rongboy-walker-family.blend'))
bpy.context.preferences.filepaths.save_version=0
tau=2*math.pi
olive=dyed('warden lichen','777549');slate=dyed('graphite apron','514947')
brown=dyed('oiled russet strap','795339');honey=dyed('brass lock','bb883d')
linen=dyed('knuckle binding','b29368');stitch=dyed('saddle stitch','d5bb91')
umber=dyed('boot wool','614b3e');hole=dyed('lock embroidery','423b35')
sage=dyed('siphon wool','928c79');plum=dyed('siphon plum','826078')
lip=dyed('cup petal lip','b891a7');inner=dyed('cup throat','65464f')
teal=dyed('pine cape','365451');ochre=dyed('archer quiver','aa7639')

def arc(fn,n=48):return [fn(i/n) for i in range(n+1)]
def dashed(c,p,name,path,mat=stitch,r=.004):
    piping(c,p,name,[path[i:i+2] for i in range(0,len(path)-1,3)],mat,r)
def trim(c,p,name,path,mat,r):piping(c,p,name,[path],mat,r)
def clean(c,p):
    for o in list(p.children_recursive)[::-1]:bpy.data.objects.remove(o,do_unlink=True)
def tube(c,p,name,path,radius,material):
    points=[Vector(v) for v in path]
    sides=24;verts=[];uv=[];faces=[]
    for i,pt in enumerate(points):
        t=i/(len(points)-1)
        direction=(points[min(len(points)-1,i+1)]-points[max(0,i-1)]).normalized()
        u=direction.cross(Vector((0,1,0))).normalized();v=direction.cross(u)
        for j in range(sides+1):
            a=tau*j/sides
            verts.append(pt+radius(t)*(math.cos(a)*u+math.sin(a)*v));uv.append((j/sides,t))
    for i in range(len(points)-1):
        for j in range(sides):
            k=i*(sides+1)+j;faces.append((k,k+1,k+sides+2,k+sides+1))
    return mesh(c,p,name,verts,faces,material,uv)
def mechanism(c,p,name,pos):
    o=bpy.data.objects.new(name,None);c.objects.link(o);o.parent=p;o.location=pos;o['mechanism']=name
    return o
def rings(c,p,name,at,lo,hi,mat):
    grid(c,p,name,lambda u,v:at(tau*u,lo+(hi-lo)*v),mat,72,38)
def recolor(o,palette):
    if o.type not in ('MESH','CURVE'):return
    o.data=o.data.copy()
    for i,m in enumerate(o.data.materials):
        for key,color in palette.items():
            if key in m.name:
                o.data.materials[i]=dyed(o.name.split(' / ')[0]+' '+key,color,m);break
def archer(c,parts):
    p=parts['Body']
    for o in list(p.children):
        if 'lapel' in o.name or 'V6 vest' in o.name or 'quiver shoulder strap' in o.name:
            bpy.data.objects.remove(o,do_unlink=True);continue
        if o.type=='MESH' and ('Mesh / Body' in o.name or o.get('fuzz')) and 'quiver' not in o.name:
            o.data=o.data.copy();remove_old_vest(o)
        if 'quiver' in o.name and 'vane' not in o.name and o.type in ('MESH','CURVE'):
            o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(ochre)
    for n in ('LegL','LegR'):
        for o in parts[n].children:recolor(o,{'moss green wool':'70543f','plum brown cloth':'654b50'})
        parts[n].location.y+=.052 if n=='LegL' else -.052
    for o in list(p.children):
        if any(k in o.name for k in ('long cloth quiver','quiver binding','back arrow shaft','quiver arrow felt vane')):
            extra=.18 if 'arrow' in o.name else 0
            o.matrix_basis=(Matrix.Translation(Vector((.14,.014,.048+extra)))
                           @ Matrix.Rotation(math.radians(20),4,'Y') @ o.matrix_basis)
            if 'vane' in o.name:
                o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(teal)
    def cape(u,v):
        a=tau*u
        dr=.15+.11*max(0,-math.sin(a))+.06*(1-math.cos(a))
        return Vector(((.145+v*dr)*math.sin(a),.023-(.16+.11*v)*math.cos(a),.635-v*(.17+.26*(1-math.sin(a))*.5+.12*(1-math.cos(a))*.5)))
    grid(c,p,'teal one-shoulder mantle',lambda u,v:cape(1-u,v),teal,72,26,.014)
    dashed(c,p,'mantle blanket stitch',arc(lambda t:cape(t,.965),108))
    path=arc(lambda t:Vector((.24-.49*t,-.17-.068*math.sin(t*math.pi),.62-.60*t)))
    ribbon(c,p,'front ochre quiver sling',path,ochre,.062)
    soft(c,p,'woven clasp',path[5],(.044,.021,.043),honey)
    for o in parts['ArmL'].children_recursive:
        if 'soft arrow tip' in o.name and o.type=='MESH':
            o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(linen)

def warden(c,parts):
    p=parts['Body'];clean(c,p);p.location=(0,.02,.53);p.scale=(1,1,1)
    at=profile([(-.06,.35,.28,0),(.12,.60,.38,0),(.43,.66,.45,0),(.9,.72,.49,.02),(1.31,.81,.43,.03),(1.54,.76,.37,.02),(1.67,.52,.32,-.030),(1.76,.39,.252,-.110),(1.835,.29,.182,-.174)])
    rings(c,p,'warden barrel',at,-.06,1.835,olive)
    for low,high,offset in [(.035,.49,.032),(.21,.78,.052)]:
        band=lambda u,v:at(tau*u,low+(high-low)*v,offset)
        grid(c,p,'layered apron hem',band,slate,72,12,.016)
        dashed(c,p,'hem stitches',arc(lambda t:at(tau*t,low+.035,offset+.004),120))
    bib=lambda u,v:at((u-.5)*(2.54-.64*v),.26+.79*v,.068)
    grid(c,p,'slate apron bib',bib,slate,52,24,.014)
    for side in (-1,1):
        path=arc(lambda t:at(side*(.58+.40*t),1.0+.60*t,.084),28)
        path+=arc(lambda t:at(side*(.98+3.08*t),1.60-.88*t,.050),60)[1:]
        ribbon(c,p,'crossed load strap',path,brown,.136)
    # Stuffed rounded-rectangle padlock hanging proud of the bib.
    def lock_face(a,k,y):
        def squircle(x):return math.copysign(abs(x)**.52,x)
        return Vector((.245*k*squircle(math.cos(a)),y,.68+.196*k*squircle(math.sin(a))))
    grid(c,p,'padded brass lock',lambda u,v:lock_face(-tau*u,max(.001,v),-.615+.035*v**2),honey,60,20,.045)
    trim(c,p,'lock shackle',arc(lambda t:(-.145*math.cos(math.pi*t),-.548,.86+.176*math.sin(math.pi*t))),honey,.035)
    dashed(c,p,'padlock stitches',arc(lambda t:lock_face(tau*t,.89,-.592),96))
    soft(c,p,'keyhole eye',(0,-.623,.716),(.049,.012,.051),hole)
    mesh(c,p,'keyhole stem',[(-.017,-.627,.70),(.017,-.627,.70),(.039,-.625,.609),(-.039,-.625,.609)],[(3,2,1,0)],hole)
    h=parts['Head'];h.location=(0,-.205,2.03);h.scale=(1.23,1.03,1.03)
    for o in h.children:recolor(o,{'target olive wool':'777549'})
    for s,n in [(-1,'ArmL'),(1,'ArmR')]:
        arm=parts[n];arm.location=(s*.805,.012,2.035);arm.scale=(1.29,1.14,1.16)
        for o in arm.children:recolor(o,{'target olive wool':'777549'})
        def cuff(u,v):
            a=tau*u
            return (.256*math.sin(a),-.12-.229*math.cos(a),-1.225+.105*v)
        grid(c,arm,'hammer mitten binding',cuff,linen,48,8,.014)
        for v in (.18,.82):dashed(c,arm,'cuff stitch',arc(lambda t:cuff(t,v),90),stitch,.003)
    for n,s in [('LegL',-1),('LegR',1)]:
        leg=parts[n];leg.location.x=s*.428
        for o in leg.children:recolor(o,{'target olive wool':'614b3e'})

def leech(c,parts):
    body=parts['Body'];clean(c,body);body.scale=(1,1,1);body.location=(0,0,.23)
    at=profile([(-.035,.081,.085,0),(.11,.163,.16,0),(.38,.226,.194,.018),(.58,.202,.166,.016),(.92,.132,.133,.005),(1.13,.146,.154,0),(1.25,.10,.118,0),(1.44,.068,.081,-.01),(1.55,.075,.093,-.022),(1.64,.090,.120,-.040),(1.72,.119,.159,-.050),(1.81,.135,.169,-.055)])
    rings(c,body,'narrow pear sack and neck',at,-.035,1.81,sage)
    for a in [0,math.pi]:
        path=arc(lambda t:at(a+.39*math.sin(t*tau*1.65),.02+1.18*t,.012),84)
        trim(c,body,'winding plum welting',path,plum,.017)
        out=Vector((0,-.018*math.cos(a),0));dashed(c,body,'welt thread',[q+out for q in path],stitch,.003)
    def cowl(u,v):
        a=tau*u
        return Vector(((.083+.155*v)*math.sin(a),(.104+.106*v)*math.cos(a),1.345-.164*v-.034*v**3*math.cos(8*a)))
    grid(c,body,'eight scallop cowl',cowl,plum,96,18,.013)
    trim(c,body,'cowl edge',arc(lambda t:cowl(t,1),112),lip,.009)
    trim(c,body,'neck roll',arc(lambda t:cowl(t,0),72),plum,.020)
    h=parts['Head'];h.location=(0,-.04,1.88);h.scale=(.77,.90,1.04)
    for o in h.children:recolor(o,{'target olive wool':'928c79'})
    for n,s in [('ArmL',-1),('ArmR',1)]:
        arm=parts[n];clean(c,arm);arm.scale=(1,1,1);arm.location=(s*.127,0,1.476)
        soft(c,arm,'covered shoulder join',(0,0,0),(.085,.085,.09),sage)
        upper=arc(lambda t:(s*(.045*t+.099*t*t),.026*math.sin(t*math.pi),-.45*t),24)
        tube(c,arm,'flexible upper hose',upper,lambda t:.058+.015*(1-t),sage)
        elbow=mechanism(c,arm,'hoseElbow'+n[-1],upper[-1])
        soft(c,elbow,'smooth hose bend',(0,0,0),(.059,.060,.063),sage)
        lower=arc(lambda t:(s*(.20*t+.038*math.sin(t*math.pi)),-.14*t*t,-.43*t),26)
        tube(c,elbow,'curved distal hose',lower,lambda t:.058+.043*t*t,sage)
        cup=mechanism(c,elbow,'suctionCup'+n[-1],lower[-1]);cup.rotation_euler.x=.26
        soft(c,elbow,'cup socket',lower[-1],(.104,.106,.10),sage)
        ringspec=[(.086,.037),(.121,.015),(.19,-.040),(.225,-.110),(.237,-.155),(.222,-.174),(.197,-.153),(.136,-.069),(.064,-.040),(.002,-.038)]
        verts=[];faces=[];uv=[]
        for i,(r,y) in enumerate(ringspec):
            for j in range(49):
                a=tau*j/48;verts.append((r*math.cos(a),y,r*math.sin(a)));uv.append((j/48,i/9))
        for i in range(len(ringspec)-1):
            for j in range(48):
                k=i*49+j;faces.append((k,k+1,k+50,k+49))
        o=mesh(c,cup,'deep felt suction bell',verts,faces,plum,uv)
        o.data.materials.append(inner)
        o.data.materials.append(dyed('deep plum cup centre','422d39'))
        for f in o.data.polygons:
            if f.index>=5*48:f.material_index=1
            if f.index>=7*48:f.material_index=2
        dashed(c,cup,'suction throat stitches',arc(lambda t:(.090*math.cos(tau*t),-.057,.090*math.sin(tau*t)),72),lip,.0027)
        trim(c,cup,'rolled lavender cup lip',arc(lambda t:(.228*math.cos(tau*t),-.161,.228*math.sin(tau*t)),72),lip,.019)
        dashed(c,cup,'cup rim embroidery',arc(lambda t:(.215*math.cos(tau*t),-.173,.215*math.sin(tau*t)),96),stitch,.0036)
    for n,s in [('LegL',-1),('LegR',1)]:
        leg=parts[n];leg.location=(s*.099,0,.246);leg.scale=(.84,.8,.53)
        for o in leg.children:recolor(o,{'target olive wool':'847e68','plum brown cloth':'756f5b'})

def join_boss_skin(rig,parts,torso_name,mat):
    """Union *closed* solids. Keep the original face surface and its UVs above the join."""
    body,head=parts['Body'],parts['Head']
    torso=bpy.data.objects[torso_name]
    skull=next(o for o in head.children if 'sculpted head' in o.name and not o.get('fuzz'))
    def close_mesh(o):
        o.data=o.data.copy()
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
        boundaries=[e for e in bm.edges if e.is_boundary]
        if boundaries:bmesh.ops.holes_fill(bm,edges=boundaries,sides=0)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(o.data);bm.free();o.data.update()
    close_mesh(torso)
    close_mesh(skull)
    # Use one cloth dye at the splice, including on any former head polygons.
    skull.data.materials.clear();skull.data.materials.append(mat)
    bpy.context.view_layer.update()
    modifier=torso.modifiers.new('Continuous shoulder neck and skull','BOOLEAN')
    modifier.operation='UNION';modifier.solver='EXACT';modifier.object=skull
    bpy.context.view_layer.objects.active=torso
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    close_mesh(torso)
    bm=bmesh.new();bm.from_mesh(torso.data)
    assert len(bm.verts)>100 and all(e.is_manifold for e in bm.edges), 'open neck on '+torso_name
    visited=set();stack=[next(iter(bm.verts))]
    while stack:
        v=stack.pop()
        if v in visited:continue
        visited.add(v)
        stack.extend(e.other_vert(v) for e in v.link_edges)
    assert len(visited)==len(bm.verts),'disconnected skull on '+torso_name
    bm.free()
    for poly in torso.data.polygons:poly.use_smooth=True
    torso.name=rig['zombieType']+' / continuous head-neck-body'
    bpy.data.objects.remove(skull,do_unlink=True)
    # Bind face, patch and surface fibres at their exact authored rest positions.
    children=[head]
    if rig['zombieType']=='boss-leech':
        children.extend([parts['ArmL'],parts['ArmR']])
    for joint in children:
        bind=joint.matrix_world.copy()
        joint.parent=body
        joint.matrix_basis=body.matrix_world.inverted()@bind
    rig['continuous_neck']=True

kinds={'archer':('弓手',archer),'boss-warden':('守墓巨像',warden),'boss-leech':('噬连兽',leech)}
for name,(_,build) in kinds.items():
    col=bpy.data.collections['RONGBOY / '+name];rig=next(o for o in col.objects if o.get('zombieType'))
    rig.location=(0,0,0);rig['final_costume']=True
    rig['target_sha256']=hashlib.sha256((out/'design'/f'{name}.png').read_bytes()).hexdigest()
    if name.startswith('boss'):rig.scale=(1,1,1)
    parts={o['part']:o for o in col.objects if o.type=='EMPTY' and o.get('part')}
    build(col,parts)
    if name=='boss-warden':join_boss_skin(rig,parts,'warden barrel',olive)
    if name=='boss-leech':join_boss_skin(rig,parts,'narrow pear sack and neck',sage)
for col in list(bpy.data.collections):
    if col.name.startswith('RONGBOY / ') and col.name.removeprefix("RONGBOY / ") not in (*kinds,'walker'):
        for o in list(col.objects):bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(col)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
rows=[]
for k,(name,_) in kinds.items():
    col=bpy.data.collections['RONGBOY / '+k]
    for o in col.objects:o.select_set(True)
    rows.append(dict(id=k,name=name))
(out/'catalog.json').write_text(json.dumps(dict(source='final-trio.blend',models=rows),ensure_ascii=False,indent=2))
reserve=bpy.data.collections['RONGBOY / walker']
next(o for o in reserve.objects if o.get('zombieType')).location=(20,20,0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'final-trio.blend'),compress=True)
# The warden's existing summon attack draws the walker from this bank as well.
reserve=bpy.data.collections['RONGBOY / walker']
next(o for o in reserve.objects if o.get('zombieType')).location=(0,0,0)
for o in reserve.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'final-trio.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animation_mode='ACTIONS',export_animations=False,export_extras=True)
print('FINAL_TRIO_DONE')
