"""Build only the three costume-study actors from the V7 walker. Run in Blender from repo root."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

repo = Path.cwd()
sys.path.insert(0,str(repo/'scripts/blender'))
from rongboy_quilt_wrap import build_wrap, remove_old_vest
source = repo / 'assets/rongboy/zombies-v7'
dest = repo / 'assets/rongboy/walker-trio'
dest.mkdir(exist_ok=True)
catalog = json.loads((source/'catalog.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(source/catalog['source']))
bpy.context.preferences.filepaths.save_version = 0
base = bpy.data.collections['RONGBOY / walker']
kinds = ('walker','heavy','leaper')
palette = {
    'heavy': {'moss green wool':'8c8548','worn chestnut felt vest':'b3986e','plum brown cloth':'634f45'},
    'leaper': {'moss green wool':'9ba98a','worn chestnut felt vest':'a05542','plum brown cloth':'615342'},
}
def paint(mat,kind,part):
    if part=='Head' and 'vest' in mat.name:return mat
    key = next((key for key in palette[kind] if mat.name.endswith(key)),None)
    if not key:return mat
    name=kind+' / '+mat.name
    if name in bpy.data.materials:return bpy.data.materials[name]
    new=mat.copy();new.name=name
    rgb=[int(palette[kind][key][i:i+2],16)/255 for i in (0,2,4)]
    color=tuple(((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    new.diffuse_color=color
    new.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color
    return new

def remap(v,kind,part,material):
    x,y,z=v
    if part=='Body':
        if 'vest' in material or 'hem' in material or 'running stitch' in material:
            z=.64+(z-.64)*(.66 if kind=='heavy' else .80)
            x*=1.045;y*=1.045
        if kind=='heavy':
            belly=math.exp(-((z-.19)/.28)**2)
            return Vector((x*(1.13+.27*belly),y*(1.14+.36*belly)-.06*belly,z*1.34))
        return Vector((x*.86,y*.92-.09*z,z*1.045))
    if part.startswith('Leg'):
        if kind=='heavy':return Vector((x*1.20,y*1.08,z*.95))
        # Leave the foot full-sized. The extra length lies between ankle and knee.
        stretch=min(1,max(0,(-z-.02)/.40))
        if 'plum brown cloth' in material:z=.14+(z-.14)*.58
        return Vector((x*.89,y*.95,z-.211*stretch))
    if part.startswith('Arm'):return Vector((x*(1.14 if kind=='heavy' else .90),y,z*(1.09 if kind=='heavy' else 1.05)))
    return Vector((x,y,z))

def joint_position(name,kind,pos):
    side=-1 if name.endswith('L') else 1
    if kind=='heavy':
        if name=='Body':pos.z+=.015
        elif name=='Head':pos.z+=.30
        elif name.startswith('Leg'):pos.x*=1.22;pos.z-=.032
        else:pos.x*=1.27;pos.z+=.19
    else:
        pos.z+=.211
        if name=='Head':pos.z+=.035;pos.y-=.035
        if name.startswith('Leg'):pos.x*=.9;pos.y+=side*.046
        if name.startswith('Arm'):pos.x*=.90;pos.y-=.045
    return pos

def mesh_study(obj,matrix,kind,part,nearest,base_mesh):
    mesh=obj.data
    inverse=matrix.inverted()
    if obj.get('fuzz'):
        # Each strand is six connected vertices. Carry the underlying cloth dye/hem with it.
        mesh.materials.clear()
        for mat in base_mesh.data.materials:mesh.materials.append(paint(mat,kind,part))
        indices=[]
        for i in range(0,len(mesh.vertices),6):
            hit=nearest.find_nearest(base_mesh.matrix_local.inverted() @ (matrix @ mesh.vertices[i].co))
            idx=base_mesh.data.polygons[hit[2]].material_index
            indices.extend([idx]*6)
        for face in mesh.polygons:face.material_index=indices[face.vertices[0]]
        labels=[base_mesh.data.materials[i].name for i in indices]
    else:
        materials=list(mesh.materials)
        labels=['']*len(mesh.vertices)
        for f in mesh.polygons:
            for i in f.vertices:labels[i]=materials[f.material_index].name
        for i,mat in enumerate(materials):mesh.materials[i]=paint(mat,kind,part)
    for vertex,label in zip(mesh.vertices,labels):
        vertex.co=inverse@remap(matrix@vertex.co,kind,part,label)
    mesh.update()

def shin_and_cuff(col,p,kind):
    def soft(name,loc,size,material):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16)
        obj=bpy.context.object
        for c in list(obj.users_collection):c.objects.unlink(obj)
        col.objects.link(obj);obj.parent=p;obj.name=name
        obj.location=loc;obj.scale=size;obj.data.materials.append(material)
        for f in obj.data.polygons:f.use_smooth=True
    skin=paint(bpy.data.materials['v2 / Walker / moss green wool'],kind,p.name)
    trouser=paint(bpy.data.materials['v2 / Walker / plum brown cloth'],kind,p.name)
    soft('Exposed wool ankle',(0,-.02,-.61),(.105,.114,.215),skin)
    soft('Rolled trouser cuff',(0,-.015,-.445),(.135,.148,.052),trouser)

def make(kind):
    col=bpy.data.collections['RONGBOY / '+kind]
    root=next(o for o in col.objects if o.get('zombieType'))
    for obj in list(col.objects):
        if obj != root:bpy.data.objects.remove(obj,do_unlink=True)
    for parent in base.objects:
        if parent.type!='EMPTY' or not parent.get('part'):continue
        name=parent['part']
        p=parent.copy();col.objects.link(p);p.parent=root;p.name=kind+' / '+name
        p.location=joint_position(name,kind,parent.location.copy())
        solid=next(o for o in parent.children if o.type=='MESH' and not o.get('fuzz'))
        nearest=BVHTree.FromPolygons([v.co for v in solid.data.vertices],[f.vertices[:] for f in solid.data.polygons])
        for src in parent.children:
            obj=src.copy();obj.data=src.data.copy() if src.data else None
            col.objects.link(obj);obj.parent=p;obj.name=kind+' / '+src.name
            if obj.type=='MESH':
                if 'part' in obj:del obj['part']
                mesh_study(obj,src.matrix_local,kind,name,nearest,solid)
            elif obj.type=='CURVE':
                matrix=src.matrix_local
                for spline in obj.data.splines:
                    for pt in spline.bezier_points:pt.co=matrix.inverted()@remap(matrix@pt.co,kind,name,src.name)
        if kind=='heavy' and name=='Body':
            for obj in list(p.children):
                if obj.type=='CURVE':bpy.data.objects.remove(obj,do_unlink=True)
                else:remove_old_vest(obj)
            build_wrap(col,p)
        if kind=='leaper' and name.startswith('Leg'):shin_and_cuff(col,p,kind)
for kind in kinds[1:]:make(kind)
bpy.context.view_layer.update()
models=[]
for kind in kinds:
    col=bpy.data.collections['RONGBOY / '+kind]
    root=next(o for o in col.objects if o.get('zombieType'))
    root.location=(0,0,0)
    models.append(dict(id=kind,name={'walker':'跳跳','heavy':'棉甲','leaper':'跃行者'}[kind]))
catalog=dict(models=models,source='walker-trio.blend')
(dest/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False))
for col in list(bpy.data.collections):
    if col.name.startswith('RONGBOY / ') and col.name not in ['RONGBOY / '+k for k in kinds]:
        for obj in list(col.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(col)
bpy.ops.object.select_all(action='DESELECT')
for kind in kinds:
    for obj in bpy.data.collections['RONGBOY / '+kind].objects:obj.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(dest/catalog['source']),compress=True)
bpy.ops.export_scene.gltf(filepath=str(dest/'walker-trio.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True)
print('TRIO_DONE')
