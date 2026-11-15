"""Shared Blender figure-building helpers. Import only into a new asset scene; clears scene."""
import bpy, math, random
from mathutils import Vector
from math import sin,cos,pi
from bisect import bisect_left
random.seed(41);bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)
model=bpy.data.collections.new('RONGBOY / Walker figurine');bpy.context.scene.collection.children.link(model)
studio=bpy.data.collections.new('STUDIO / presentation only');bpy.context.scene.collection.children.link(studio)
fur_jobs=[]
def move(o,collection=model):
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o);return o

def srgb(v):return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
def color(hex):return tuple(srgb(int(hex[i:i+2],16)/255) for i in (1,3,5))+(1,)
def material(name,hex,rough=.85,felt=True):
 m=bpy.data.materials.new(name);m.diffuse_color=color(hex);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=color(hex);bs.inputs['Roughness'].default_value=rough
 if 'Sheen Weight' in bs.inputs:bs.inputs['Sheen Weight'].default_value=.32 if felt else .05
 tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=155 if felt else 65;tex.inputs['Detail'].default_value=3;tex.inputs['Roughness'].default_value=.72
 coord=n.new('ShaderNodeTexCoord');l.new(coord.outputs['Generated'],tex.inputs['Vector']);r=n.new('ShaderNodeValToRGB');base=color(hex);r.color_ramp.elements[0].position=.18;r.color_ramp.elements[0].color=tuple(v*.70 for v in base[:3])+(1,);r.color_ramp.elements[1].position=.82;r.color_ramp.elements[1].color=tuple(min(1,v*1.17) for v in base[:3])+(1,);l.new(tex.outputs['Fac'],r.inputs[0]);l.new(r.outputs['Color'],bs.inputs['Base Color'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28 if felt else .15;bump.inputs['Distance'].default_value=.014 if felt else .004;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal']);return m
M={
 'face':material('Wool / warm oatmeal skin','#e5be91'),
 'cheek':material('Wool / subtle apricot cheeks','#d99776'),
 'jacket':material('Wool / sand canvas jacket','#ab8b57'),
 'hat':material('Wool / soft camel explorer hat','#bb955f'),
 'pants':material('Wool / olive shorts','#626243'),
 'hair':material('Wool / chestnut tufts','#563b2a'),
 'scarf':material('Wool / ochre neckerchief','#e6b542'),
 'leather':material('Leather / chestnut boots and straps','#674631',.7,False),
 'sole':material('Rubber / dark stacked sole','#392e25',.9,False),
 'thread':material('Cotton / oatmeal stitching','#e2cca0',.9,True),
 'darkthread':material('Cotton / embroidered mouth','#6d4130'),
 'pack':material('Wool / moss canvas rucksack','#7e8153'),
 'roll':material('Wool / rolled oat blanket','#c9ae76'),
 'metal':material('Brass / worn buckles','#b89559',.4,False),
 'eye':material('Glass / dark brown bead eyes','#211b16',.18,False),
 'white':material('Glass / reflected catchlight','#fff2cc',.2,False),
}
M['metal'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.65

def finish(o,name,mat,collection=model):
 o.name=name;move(o,collection);o.data.materials.append(mat)
 if o.type=='MESH':
  for f in o.data.polygons:f.use_smooth=True
 return o

def uv(name,loc,scale,mat,fur=0,rot=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=loc);o=bpy.context.object;o.scale=scale
 if rot:o.rotation_euler=rot
 finish(o,name,mat)
 if fur:fur_jobs.append((o,fur,mat))
 return o

def cube(name,loc,scale,mat,bevel=.08,rot=None,fur=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if rot:o.rotation_euler=rot
 finish(o,name,mat);b=o.modifiers.new('Soft sewn corners','BEVEL');b.width=bevel;b.segments=5
 w=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 if fur:fur_jobs.append((o,fur,mat))
 return o

def path(name,pts,radius,mat,closed=False,collection=model):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=8;cu.bevel_depth=radius;cu.bevel_resolution=2
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for bp,pt in zip(sp.bezier_points,pts):bp.co=pt;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
 sp.use_cyclic_u=closed;o=bpy.data.objects.new(name,cu);collection.objects.link(o);cu.materials.append(mat);return o

def tube_between(name,a,b,r1,r2,mat):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,mat)

def stitches(name,points,count=20,size=.015,mat=None):
 mat=mat or M['thread'];pts=[Vector(v) for v in points];lens=[0]
 for a,b in zip(pts,pts[1:]):lens.append(lens[-1]+(b-a).length)
 for i in range(count):
  d=(i+.5)*lens[-1]/count;j=min(len(pts)-2,max(0,bisect_left(lens,d)-1));t=(d-lens[j])/max(.00001,lens[j+1]-lens[j]);v=pts[j].lerp(pts[j+1],t);direction=(pts[j+1]-pts[j]).normalized();path(name+f' {i:02}',[v-direction*size/2,v+direction*size/2],.004,mat)

def lathe(name,profile,mat,ellipse=(1,1),n=96,fur=0,warp=0):
 verts=[];faces=[]
 for radius,z in profile:
  for i in range(n):
   a=2*pi*i/n;rr=radius*(1+warp*.05*cos(a*3));verts.append((rr*cos(a)*ellipse[0],rr*sin(a)*ellipse[1],z+warp*(cos(a*2)+.3*sin(a*3))))
 for j in range(len(profile)-1):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 faces.extend([tuple(range(n-1,-1,-1)),tuple((len(profile)-1)*n+i for i in range(n))]);me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);model.objects.link(o);finish(o,name,mat)
 sub=o.modifiers.new('Hand shaped smooth surface','SUBSURF');sub.levels=2
 if fur:fur_jobs.append((o,fur,mat))
 return o


def fibers(o,count,mat):
 dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();tris=list(me.loop_triangles);total=0;cdf=[]
 for tri in tris:total+=tri.area;cdf.append(total)
 if not total:ev.to_mesh_clear();return
 cu=bpy.data.curves.new(o.name+' / wool fibers','CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=.00065;cu.bevel_resolution=0;cu.resolution_u=1
 matrix=o.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
 for i in range(count):
  tri=tris[min(len(tris)-1,bisect_left(cdf,random.random()*total))];a,b,c=[me.vertices[j].co for j in tri.vertices];u=random.random();v=random.random()
  if u+v>1:u=1-u;v=1-v
  p=matrix@(a+(b-a)*u+(c-a)*v);normal=(normal_matrix@tri.normal).normalized();tangent=normal.cross(Vector((random.random(),random.random(),random.random()))).normalized();length=random.uniform(.005,.014)
  sp=cu.splines.new('POLY');sp.points.add(2)
  for pt,vv in zip(sp.points,[p,p+normal*length*.65+tangent*length*.2,p+normal*length+tangent*length*.65]):pt.co=(*vv,1)
 ob=bpy.data.objects.new(o.name+' / fine wool nap',cu);model.objects.link(ob);cu.materials.append(mat);ob['detail']='Editable geometric wool fibers; optional at runtime distance';ev.to_mesh_clear()
