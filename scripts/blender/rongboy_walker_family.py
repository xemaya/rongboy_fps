"""Build the seven walker-family roles and two independent bosses from the approved felt bank.
Run from the repository with blender -b --python scripts/blender/rongboy_walker_family.py
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path.cwd()
SOURCE = ROOT / 'assets/rongboy/zombies-v6'
OUT = ROOT / 'assets/rongboy/zombies-v7'
OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / 'rongboy-zombie-roster-v6.blend'))
bpy.context.preferences.filepaths.save_version = 0
catalog = json.loads((SOURCE / 'catalog.json').read_text())
def collection(kind):
    return bpy.data.collections['RONGBOY / '+kind]
def root_of(col):
    return next(o for o in col.objects if o.get('zombieType'))
def pivots(col):
    return {o['part']:o for o in col.objects if o.type=='EMPTY' and o.get('part')}
def rotation(angle):
    return Matrix.Rotation(math.radians(angle),4,'X')
def shape(sx,sy,sz,tilt=0):
    return rotation(tilt) @ Matrix.Diagonal(Vector((sx,sy,sz,1)))
identity=Matrix.Identity(4)
walker=collection('walker')
base=pivots(walker)

# Offsets are measured from the feet, in the original walker rig's Blender units.
# Deform children around their own joints, leaving animation pivot scales uniform.
def stance(kind, name):
    side=-1 if name.endswith('L') else 1
    pos=base[name].location.copy()
    change=identity
    if kind=='crawler':
        if name=='Body': pos=Vector((0,.34,.51)); change=shape(1,1,.92,58)
        elif name=='Head': pos=Vector((0,-.12,.74)); change=shape(.92,.94,.88)
        elif name.startswith('Arm'): pos=Vector((side*.34,-.08,.68)); change=shape(1,1,.93,-8)
        else: pos=Vector((side*.17,.39,.49)); change=shape(1,1,.91,34)
    elif kind=='leaper':
        if name=='Body': pos.y+=.075;pos.z-=.09;change=shape(.94,1,.98,12)
        elif name=='Head':pos.y-=.045;pos.z-=.12
        elif name.startswith('Leg'):pos.y+=side*.09;pos.z-=.09;change=shape(1,1,.86)
        else:pos.y-=.045;pos.z-=.09
    elif kind in ('heavy','shielded','bomber'):
        breadth={'heavy':1.16,'shielded':1.18,'bomber':1.11}[kind]
        if name=='Body': change=shape(breadth,1.12,1)
        elif name.startswith(('Arm','Leg')):pos.x*=breadth
    elif kind=='archer' and name.startswith('Arm'):
        pos.y=-.08;pos.z-=.10;pos.x+=side*.035
    return pos,change

def copy_walker(kind,col,root):
    mapping={root_of(walker):root}
    matrices={}
    def visit(source):
        for child in source.children:
            obj=child.copy()
            if obj.type=='MESH' and 'part' in obj:del obj['part']
            obj.name=kind+' / '+child.name
            col.objects.link(obj)
            obj.parent=mapping[source]
            mapping[child]=obj
            if child in base.values():
                obj.location,matrices[child]=stance(kind,child['part'])
                obj['family_source']='walker/'+child['part']
            elif source in matrices:
                obj.matrix_basis=matrices[source] @ child.matrix_basis
            visit(child)
    visit(root_of(walker))
    return {name:mapping[p] for name,p in base.items()}

def mount(ob,parent,pos,scale=1):
    ob.parent=parent
    ob.matrix_basis=Matrix.Translation(Vector(pos)) @ Matrix.Scale(scale,4) @ ob.matrix_basis

for spec in catalog['models']:
    kind=spec['id']
    if kind=='walker' or kind.startswith('boss-'):
        continue
    col=collection(kind)
    root=root_of(col)
    old=pivots(col)
    root.scale=(1,1,1)
    keep=set()
    def retain(ob):
        keep.update([ob,*ob.children_recursive])
    for name,pivot in old.items():
        for ob in list(pivot.children):
            label=ob.name.split(' / ')[-1]
            if ob.get('fuzz') or 'fibre /' in ob.name:continue
            take=False
            if kind=='shielded' and name=='ArmL':
                take=label.startswith(('felt shield','shield padded','shield face','shield rear','shield stitched','projected shield'))
            elif kind=='bomber':
                take=ob.get('mechanism')=='heldBomb' or (name=='Body' and label.startswith(('spare ','stitched bomb pouch','padded carrier backboard','pouch ','carrier waist belt')))
            elif kind=='archer':
                take=ob.get('mechanism') in ('bowMount','drawHand') or (name=='Body' and label.startswith(('long cloth quiver','quiver ','back arrow')))
            elif kind=='heavy' and name=='Body':
                take=label.startswith(('inflated quilt cell','quilt cloth backing','rolled quilt perimeter')) and (ob.location.y<0 or (ob.type=='CURVE' and ob.data.splines[0].bezier_points[0].co.y<0))
            if take: retain(ob)
    # Preserve the original local transform of accessory roots when moving them onto the new pivots.
    props=[(ob,p['part']) for p in old.values() for ob in p.children if ob in keep]
    for ob,_ in props: ob.parent=None
    for ob in list(col.objects):
        if ob!=root and ob not in keep:bpy.data.objects.remove(ob,do_unlink=True)
    parts=copy_walker(kind,col,root)
    for ob,name in props:
        p=parts[name]
        if kind=='heavy':mount(ob,p,(0,-.053,.23),.46)
        elif kind=='shielded':mount(ob,p,(-.065,-.075,-.17),.79)
        elif kind=='bomber' and name=='Body':mount(ob,p,(0,-.04,.23),.78)
        elif kind=='bomber':ob.parent=p;ob.location=(.105,-.33,-.65)
        elif kind=='archer' and name=='Body':mount(ob,p,(.035,.01,.10),.80)
        elif ob.get('mechanism')=='drawHand':ob.parent=p;ob.location=(-.022,-.23,-.61)
        else:
            # Grip and nock sit on opposite sides of the bow. Put the nock behind
            # the grip along the shot axis so that the hands separate at full draw.
            ob.parent=p;ob.location=(.07,-.25,-.56);ob.rotation_euler.x=1.14
            for node in ob.children:
                tag=node.get('mechanism')
                if tag=='bowBack':node.location=(.18,.19,0)
                if tag=='heldArrow':
                    for piece in node.children:
                        if 'vane' in piece.name:piece.location.y-=.24
                        if 'shaft' in piece.name and piece.type=='CURVE':
                            for spline in piece.data.splines:
                                for knot in spline.bezier_points:
                                    if knot.co.y>0:knot.co.y=.10
                if tag=='bowNock':node.location=(.12,.065,0)
    root['family_source']='walker'
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    def local_vertices():
        for o in col.objects:
            if o.type not in ('MESH','CURVE'):continue
            ev=o.evaluated_get(graph);mesh=ev.to_mesh()
            matrix=root.matrix_world.inverted()@o.matrix_world
            try:
                for v in mesh.vertices:yield matrix@v.co
            finally:ev.to_mesh_clear()
    points=list(local_vertices());bottom=min(p.z for p in points);top=max(p.z for p in points)
    factor=(spec['height']+.017-.022*.78)/(.78*(top-bottom))
    for pivot in parts.values():
        pivot.location*=factor;pivot.location.z+=.022-bottom*factor;pivot.scale*=factor
    spec['width']=round((max(p.x for p in points)-min(p.x for p in points))*factor*.78,3)
    spec['base']='walker'
    print('WALKER_FAMILY',kind,len(props),flush=True)

catalog['models'][0]['base']='walker'
for spec in catalog['models'][-2:]:spec['base']='independent'
catalog['source']='rongboy-walker-family.blend'
catalog['basis']='Seven walker-family roles and two independent bosses'
catalog.pop('skin_palette',None)
catalog['fibre_texture']='../zombies-v6/design/felt-fibre-tile.png'
roles={'leaper':'前倾屈腿 · 蓄势跃击','heavy':'短棉胸甲 · 稳步推进','crawler':'低身撑地 · 贴地爬行','shielded':'宽肩布偶 · 持盾推进','bomber':'腰后备弹 · 捧弹抛投','archer':'分手持弓 · 搭箭拉弦'}
for spec in catalog['models']:
    if spec['id'] in roles:spec['role']=roles[spec['id']]
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/catalog['source']),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for spec in catalog['models']:
    col=collection(spec['id']);root_of(col).location=(0,0,0)
    for ob in col.objects:ob.select_set(True)
glb=OUT/'zombie-roster.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_yup=True)
catalog['bytes']=glb.stat().st_size
(OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
js=ROOT/'library/games/rongboy-roster.js'
alias=js.read_text().split('export const ZOMBIE_ALIASES=')[1]
js.write_text('// Generated by rongboy_walker_family.py\nexport const ZOMBIE_ROSTER = '+json.dumps(catalog['models'],ensure_ascii=False,indent=2)+';\nexport const ZOMBIE_ALIASES='+alias)
print('FAMILY_DONE',catalog['bytes'])
