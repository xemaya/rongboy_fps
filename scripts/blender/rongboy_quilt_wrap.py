"""Tailor the heavy's quilt shell in body-pivot space (Blender Z up)."""
import math
import bpy
import bmesh
from mathutils import Vector

def remove_old_vest(obj):
    """Remove the old open vest and the strands assigned to its fabric."""
    if obj.type!='MESH':return
    mesh=obj.data
    indices={i for i,m in enumerate(mesh.materials) if m and 'chestnut felt vest' in m.name}
    if not indices:return
    bm=bmesh.new()
    bm.from_mesh(mesh)
    # A raised chest mend on the old body crosses the wrap surface.
    yarn={i for i,m in enumerate(mesh.materials) if m and 'charcoal yarn' in m.name}
    faces=[f for f in bm.faces if f.material_index in indices or f.material_index in yarn]

    bmesh.ops.delete(bm,geom=faces,context='FACES')
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

def build_wrap(col,body):
    tau=math.tau
    def fabric(name,color):
        m=bpy.data.materials['v2 / Walker / moss green wool'].copy()
        m.name=name
        rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
        value=tuple(((c+.055)/1.055)**2.4 for c in rgb)+(1,)
        m.diffuse_color=value
        m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=value
        return m
    teal=fabric('Wrap / petrol felt','305751')
    honey=fabric('Wrap / ochre binding','BD8535')
    quilt_thread=fabric('Wrap / quilt thread','536760')
    thread=fabric('Wrap / waxed linen','E7C799')
    cord=fabric('Wrap / russet braid','743D25')
    wood=fabric('Wrap / maple toggle','C58D4B')
    def attach(name,data,mat):
        obj=bpy.data.objects.new(name,data);col.objects.link(obj)
        obj.parent=body;data.materials.append(mat)
        return obj
    # Body cross-sections (height, half width, front reach, rear reach).
    sections=[(.12,.379,.298,.286),(.22,.411,.327,.309),(.32,.428,.337,.325),
              (.42,.420,.325,.321),(.52,.392,.294,.304),(.62,.350,.253,.277),
              (.72,.298,.203,.241),(.83,.220,.139,.190)]
    def radial(z):
        for a,b in zip(sections,sections[1:]):
            if z<=b[0]:
                t=max(0,(z-a[0])/(b[0]-a[0]))
                return [x+(y-x)*t for x,y in zip(a[1:],b[1:])]
        return sections[-1][1:]
    def top(a):return .811-.084*max(0,math.cos(a))**3
    def hem(a):return .163+.018*math.cos(a-.6)
    def shell(a,z,extra=0):
        rx,front,rear=radial(z)
        phase=(z-.16-.17*math.sin(a)-.037*math.sin(2*a+.2))/.162
        channel=(.5-.5*math.cos(phase*tau))**.80
        rx+=.10*max(0,(z-.62)/.21)*abs(math.sin(a))**2
        pad=.009+.038*channel+extra
        return Vector(((rx+pad)*math.sin(a),(rear-front)/2-((front+rear)/2+pad)*math.cos(a),z))
    def tube(name,paths,mat,r):
        data=bpy.data.curves.new(name,'CURVE')
        data.dimensions='3D';data.bevel_depth=r;data.bevel_resolution=2;data.resolution_u=1
        for points,closed in paths:
            s=data.splines.new('POLY');s.points.add(len(points)-1)
            for p,v in zip(s.points,points):p.co=(*v,1)
            s.use_cyclic_u=closed
        return attach(name,data,mat)
    # Four angular panels, with true cutouts for both shoulders. The UV seam
    # runs down the back. Boundary vertices are welded after construction.
    count=144;layers=(28,24,15);verts=[];uvs=[];faces=[]
    def opening(a):
        side=abs((a+math.pi)%tau-math.pi)
        t=(side-math.pi/4)/(math.pi/2)
        return max(0,math.sin(math.pi*t))**.65 if 0<t<1 else 0
    def edges(a):
        spread=opening(a)
        return [hem(a),.608-.192*spread,.608+.164*spread,top(a)]
    for band,steps in enumerate(layers):
        start=len(verts)
        for i in range(count+1):
            a=-math.pi+tau*i/count
            bounds=edges(a)
            for j in range(steps+1):
                z=bounds[band]+(bounds[band+1]-bounds[band])*j/steps
                verts.append(shell(a,z));uvs.append((i/count,(z-.12)*1.65))
        for i in range(count):
            if band==1 and opening(-math.pi+tau*(i+.5)/count)>0:continue
            for j in range(steps):
                k=start+i*(steps+1)+j
                faces.append((k,k+steps+1,k+steps+2,k+1))
    # Collapse of the middle band outside armholes needs no surface area.
    mesh=bpy.data.meshes.new('Wrap tailoring')
    mesh.from_pydata(verts,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for f in mesh.polygons:
        f.use_smooth=True
        for li in f.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00004)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(mesh);bm.free();mesh.update()
    obj=attach('Heavy / tailored short wrap',mesh,teal)
    solid=obj.modifiers.new('Turned cloth lining','SOLIDIFY');solid.thickness=.012
    loops=[]
    for edge in (hem,top):loops.append(([shell(a,edge(a),.002) for a in [tau*i/count for i in range(count)]],True))
    for side in (-1,1):
        aa=[side*(math.pi/4+math.pi*.5*i/48) for i in range(49)]
        loop=[shell(a,edges(a)[1],.002) for a in aa]+[shell(a,edges(a)[2],.002) for a in reversed(aa[1:-1])]
        loops.append((loop,True))
    tube('Heavy / bound neck armholes and hem',loops,honey,.016)
    # Sloping crossing from neck, around the fastening, to the lower hem.
    control=[(-1.06,top(-1.06)),(-.65,.745),(-.05,.689),(.34,.645),(.46,.575),(.43,.492),(.32,.396),(.06,.308),(-.25,.244),(-.62,.198),(-.94,hem(-.94))]
    line=[]
    for i,((a,z),(b,w)) in enumerate(zip(control,control[1:])):
        for j in range(9):
            t=j/9
            line.append(shell(a+(b-a)*t,z+(w-z)*t,.019))
    line.append(shell(control[-1][0],control[-1][1],.019))
    tube('Heavy / crossover binding',[(line,False)],honey,.020)
    stitches=[]
    for path,closed in loops+[(line,False)]:
        for i in range(0,len(path)-2,4):
            a,b=path[i],path[i+2];out=Vector((a.x,a.y,0)).normalized()*.016
            stitches.append(([a+out,a.lerp(b,.65)+out],False))
    tube('Heavy / running topstitch',stitches,thread,.0025)
    quilt_stitches=[]
    for row in range(-1,6):
        for j in range(100):
            pair=[]
            for fraction in (0,.45):
                a=tau*(j+fraction)/100
                z=.16+row*.162+.17*math.sin(a)+.037*math.sin(2*a+.2)
                lo,bot,cap,hi=edges(a)
                if not lo+.013<z<hi-.013 or bot<z<cap:break
                pair.append(shell(a,z,.003))
            if len(pair)==2:quilt_stitches.append((pair,False))
    tube('Heavy / diagonal quilting stitches',quilt_stitches,quilt_thread,.0025)
    anchor=shell(.43,.57,.042)
    def ellipsoid(name,location,size,mat):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=18)
        o=bpy.context.object;o.name=name
        for c in list(o.users_collection):c.objects.unlink(o)
        col.objects.link(o);o.parent=body;o.location=location;o.scale=size;o.data.materials.append(mat)
        for f in o.data.polygons:f.use_smooth=True
        return o
    toggle=ellipsoid('Heavy / honey wood toggle',anchor,(.031,.031,.095),wood)
    toggle.rotation_euler.y=.075
    loop=[]
    for j in range(64):
        a=tau*j/64
        loop.append(anchor+Vector((.088*math.cos(a),-.023*math.sin(a)-.008,.014*math.sin(a))))
    tube('Heavy / russet loop',[(loop,True)],cord,.011)
