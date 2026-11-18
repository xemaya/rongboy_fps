"""Shared needle-felt surfaces and sewn trim, in local pivot space."""
import math
import bpy
from mathutils import Vector
TAU=math.tau
def dyed(name,hex_color,source=None):
    key='Costume / '+name
    if key in bpy.data.materials:return bpy.data.materials[key]
    m=(source or bpy.data.materials['v2 / Walker / moss green wool']).copy()
    rgb=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
    color=tuple(((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    m.name=key;m.diffuse_color=color
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color
    return m

def mesh(col,p,name,verts,faces,mat,uv=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    layer=data.uv_layers.new(name='UVMap')
    for poly in data.polygons:
        poly.use_smooth=True
        for li in poly.loop_indices:
            i=data.loops[li].vertex_index;v=data.vertices[i].co
            layer.data[li].uv=uv[i] if uv else (v.x+v.y*.61,v.z)
    obj=bpy.data.objects.new(name,data);col.objects.link(obj);obj.parent=p
    data.materials.append(mat);return obj

def soft(col,p,name,xyz,size,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=20)
    o=bpy.context.object
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o);o.parent=p;o.name=name;o.location=xyz;o.scale=size
    o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=True
    return o

def piping(col,p,name,paths,mat,r):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D'
    data.resolution_u=1;data.bevel_depth=r;data.bevel_resolution=2
    for path in paths:
        line=data.splines.new('POLY');line.points.add(len(path)-1)
        for v,pt in zip(path,line.points):pt.co=(*v,1)
    o=bpy.data.objects.new(name,data);col.objects.link(o);o.parent=p;data.materials.append(mat)
    return o

def grid(col,p,name,fn,mat,w=48,h=20,thick=0):
    uv=[(i/w,j/h) for j in range(h+1) for i in range(w+1)]
    pts=[fn(u,v) for u,v in uv];faces=[]
    for j in range(h):
        for i in range(w):
            k=j*(w+1)+i;faces.append((k,k+1,k+w+2,k+w+1))
    o=mesh(col,p,name,pts,faces,mat,uv)
    if thick:
        mod=o.modifiers.new('Hem thickness','SOLIDIFY');mod.thickness=thick
    return o

def ribbon(col,p,name,path,mat,width,stitch=None):
    points=[Vector(v) for v in path];verts=[];faces=[]
    for i,v in enumerate(points):
        tangent=points[min(i+1,len(points)-1)]-points[max(0,i-1)]
        direction=Vector((1,0,0))-tangent.normalized()*tangent.normalized().x
        axis=direction.normalized()*width*.5
        verts.extend((v-axis,v+axis))
        if i:faces.append((2*i-2,2*i-1,2*i+1,2*i))
    obj=mesh(col,p,name,verts,faces,mat)
    mod=obj.modifiers.new('Double folded webbing','SOLIDIFY');mod.thickness=.009
    lines=[]
    for side in (0,1):
        edge=[verts[i].lerp(points[i//2],.19) for i in range(side,len(verts),2)]
        lines.extend([edge[j:j+2] for j in range(0,len(edge)-1,3)])
    piping(col,p,name+' seam',lines,stitch or dyed('running stitch','debf90'),.0028)

def contour(col,p,name,fn,mat,r=.006):
    piping(col,p,name,[[fn(i/96) for i in range(97)]],mat,r)

def button(col,p,name,pos,mat,r):
    x,y,z=pos;soft(col,p,name,pos,(r,.018,r),mat)
    piping(col,p,name+' X',[[(x-r*.40,y-.020,z-s*r*.40),(x+r*.40,y-.020,z+s*r*.40)] for s in (-1,1)],dyed('running stitch','debf90'),.0036)

def profile(rows):
    # Smooth changing cross-sections keep a stuffed form even when its body plan is asymmetric.
    def point(a,z,offset=0):
        idx=next((i for i in range(len(rows)-1) if z<=rows[i+1][0]),len(rows)-2)
        low,hi=rows[idx:idx+2];t=max(0,min(1,(z-low[0])/(hi[0]-low[0])))
        v=[]
        for k in (1,2,3):
            prev=rows[max(0,idx-1)];nxt=rows[min(idx+2,len(rows)-1)]
            d0=(hi[k]-prev[k])/(hi[0]-prev[0])*(hi[0]-low[0])
            d1=(nxt[k]-low[k])/(nxt[0]-low[0])*(hi[0]-low[0])
            v.append((2*t**3-3*t*t+1)*low[k]+(t**3-2*t*t+t)*d0+(-2*t**3+3*t*t)*hi[k]+(t**3-t*t)*d1)
        rx,ry,cy=v
        return Vector(((rx+offset)*math.sin(a),cy-(ry+offset)*math.cos(a),z))
    return point
