"""Round, soft toy morphology for the linked zombie cast (Blender only)."""
import bpy, math, random
from mathutils import Vector

def replace_base(material, primitive):
    col=bpy.data.collections.new('TEMP / plush V4 base');bpy.context.scene.collection.children.link(col)
    root=bpy.data.objects.new('PlushBase',None);col.objects.link(root)
    root['asset_version']='v4';root['design']='Round baby plush; one button, one bead, one milk tooth'
    pivots={'Body':(0,0,.48),'Head':(0,-.015,1.12),'ArmL':(-.36,0,.99),'ArmR':(.36,0,.99),'LegL':(-.18,.02,.39),'LegR':(.18,.02,.39)}
    parts={}
    for name,loc in pivots.items():
        ob=bpy.data.objects.new('CTRL / '+name,None);col.objects.link(ob);ob.parent=root;ob.location=loc;ob['part']=name;parts[name]=ob
    skin=material('V4 apple wool','#B0C799');light=material('V4 muzzle wool','#C4D5AB');patch=material('V4 soft patch','#94B083')
    oat=material('V4 butter button','#EACB83');cream=material('V4 warm thread','#F3E4C5');ink=material('V4 cocoa thread','#46513D');pink=material('V4 peach cheeks','#DBA291');cloth=material('V4 lavender dungarees','#A4A2B8')
    bead=material('V4 polished bead','#37473B');bead.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.32
    # One shared, tiny wool shell, retained as grazing-only fibers by the runtime.
    rnd=random.Random(941);vv=[];ff=[]
    for i in range(620):
        z=rnd.uniform(-1,1);a=rnd.random()*math.tau;r=math.sqrt(1-z*z);p=Vector((r*math.cos(a),r*math.sin(a),z));side=p.cross(Vector((.2,.7,.3))).normalized()*.0008;j=len(vv)
        vv.extend([p-side,p+side,p*(1+rnd.uniform(.006,.012))]);ff.append((j,j+1,j+2))
    fur=bpy.data.meshes.new('V4 shared short wool');fur.from_pydata(vv,[],ff);fur.update()
    def mesh(name,data,mat,part,pos,size=(1,1,1)):
        ob=bpy.data.objects.new(name,data);col.objects.link(ob);ob.parent=parts[part];ob.location=pos;ob.scale=size
        if not len(data.materials):data.materials.append(mat)
        ob.material_slots[0].link='OBJECT';ob.material_slots[0].material=mat;return ob
    def ball(name,pos,size,mat=skin,part='Head',wool=False):
        ob=mesh(name,primitive('sphere'),mat,part,pos,size)
        if wool:
            f=mesh('fuzz / '+name,fur,mat,part,pos,size);f['fuzz']=True
        return ob
    def line(name,points,mat=ink,part='Head',radius=.005):
        d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=4;d.bevel_depth=radius;d.bevel_resolution=2;s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
        for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
        o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=parts[part];d.materials.append(mat);return o
    def front(x,z,offset=.008):return -.43*math.sqrt(max(.03,1-(x/.56)**2-((z-.39)/.54)**2))-offset
    ball('V4 / round head',(0,0,.39),(.56,.43,.54),wool=True)
    for sign in [-1,1]:
        ball('V4 / plush ear',(sign*.535,.0,.35),(.105,.075,.13),wool=True)
        ball('V4 / ear inset',(sign*.568,-.055,.35),(.055,.025,.072),light)
        x=sign*.315;z=.20;ball('V4 / peach cheek',(x,front(x,z,.012),z),(.085,.022,.055),pink)
    # Features sit low on the large, unbroken forehead. Asymmetry reads as a toy.
    x=-.20;z=.37;y=front(x,z,.021)
    ball('V4 / butter button',(x,y,z),(.126,.034,.126),oat)
    for sign in [-1,1]:line('V4 / button thread',[(x-.045,y-.034,z-sign*.045),(x+.045,y-.034,z+sign*.045)],ink,radius=.007)
    x=.185;z=.355;y=front(x,z,.018)
    ball('V4 / bead eye',(x,y,z),(.073,.039,.083),bead)
    ball('V4 / eye sparkle',(x-.022,y-.039,z+.032),(.018,.010,.020),cream)
    ball('V4 / little nose',(0,front(0,.235,.015),.235),(.042,.032,.032),light)
    line('V4 / small smile',[(x,front(x,z,.018),z) for x,z in [(-.087,.155),(-.04,.12),(0,.114),(.055,.133),(.085,.158)]],ink,radius=.007)
    ball('V4 / one milk tooth',(.024,front(.024,.128,.027),.126),(.026,.015,.036),cream)
    # Conform the applique to the round skull; a flat oval would sink into it.
    vv=[(.25,front(.25,.715,.014),.715)];rings=[]
    for radius in [.5,1]:
        ring=[]
        for i in range(40):
            a=i*math.tau/40;c=math.cos(a);s=math.sin(a);x=.25+.108*radius*math.copysign(abs(c)**.62,c);z=.715+.079*radius*math.copysign(abs(s)**.62,s)
            ring.append(len(vv));vv.append((x,front(x,z,.014),z))
        rings.append(ring)
    ff=[(0,rings[0][i],rings[0][(i+1)%40]) for i in range(40)]+[(rings[0][i],rings[1][i],rings[1][(i+1)%40],rings[0][(i+1)%40]) for i in range(40)]
    d=bpy.data.meshes.new('V4 curved cloth applique');d.from_pydata(vv,[],ff);d.update();uv=d.uv_layers.new(name='UVMap')
    for f in d.polygons:
        f.use_smooth=True
        for li in f.loop_indices:
            co=d.vertices[d.loops[li].vertex_index].co;uv.data[li].uv=((co.x-.142)/.216,(co.z-.636)/.158)
    applique=mesh('V4 / sewn forehead patch',d,patch,'Head',(0,0,0));solid=applique.modifiers.new('Soft applique thickness','SOLIDIFY');solid.thickness=.004
    for i in [2,8,14,22,28,34]:
        x,_,z=vv[rings[1][i]];tx=(.25-x)*.10;tz=(.715-z)*.10;line('V4 / patch stitch',[(x-tx,front(x-tx,z-tz,.022),z-tz),(x+tx,front(x+tx,z+tz,.022),z+tz)],cream,radius=.0028)
    # One bean body and a short, soft romper replace the torn vest and exposed legs.
    ball('V4 / bean body',(0,0,.18),(.36,.28,.40),skin,'Body',True)
    ball('V4 / romper seat',(0,0,-.005),(.37,.29,.235),cloth,'Body',True)
    ball('V4 / rounded romper bib',(0,-.252,.245),(.23,.047,.225),cloth,'Body')
    for sign in [-1,1]:
        ball('V4 / romper strap',(sign*.225,-.16,.40),(.045,.08,.185),cloth,'Body')
        ball('V4 / romper button',(sign*.192,-.285,.365),(.033,.018,.034),oat,'Body')
    line('V4 / small pocket',[(-.09,-.30,.24),(-.08,-.308,.13),(0,-.312,.105),(.08,-.308,.13),(.09,-.30,.24)],cream,'Body',.004)
    for sign,n in [(-1,'ArmL'),(1,'ArmR')]:
        ball('V4 / upper arm',(0,0,-.09),(.127,.132,.18),skin,n,True)
        ball('V4 / short forearm',(0,-.015,-.265),(.135,.14,.17),skin,n,True)
        ball('V4 / mitten',(0,-.04,-.405),(.15,.14,.135),skin,n,True)
        ball('V4 / soft thumb',(-sign*.115,-.045,-.365),(.072,.10,.085),skin,n)
        line('V4 / mitten seam',[(-.02,-.175,-.43),(-.01,-.183,-.39),(-.01,-.17,-.36)],patch,n,.003)
    for n in ['LegL','LegR']:
        ball('V4 / short romper leg',(0,0,-.13),(.13,.14,.175),cloth,n,True)
        ball('V4 / round slipper',(0,-.085,-.27),(.155,.22,.11),skin,n,True)
        line('V4 / slipper stitch',[(-.075,-.28,-.255),(0,-.30,-.24),(.075,-.28,-.255)],cream,n,.003)
    bpy.context.view_layer.update()
    return root,[root]+list(root.children_recursive)

def cute_shape(kind,parts):
    def p(n,loc,scale):parts[n].location=loc;parts[n].scale=scale
    # These are deliberate toy proportions; final height is normalized to V3 bounds.
    shapes={
      'walker':(.48,(1,1,1),1.12,(1,1,1),.99,.36,(1,1,1),.39,1,.18),
      'runner':(.49,(.90,.93,.92),1.11,(.98,.96,.96),.96,.32,(.90,.95,.94),.42,1.10,.17),
      'weaver':(.48,(1.06,.95,1),1.12,(1.04,.97,.99),.98,.37,(1.0,.98,.97),.39,1,.20),
      'leaper':(.60,(.96,.96,.96),1.23,(1,.98,.98),1.10,.35,(.98,1,1.05),.50,1.30,.19),
      'heavy':(.50,(1.35,1.17,1.06),1.21,(1.13,1.05,1.03),1.02,.46,(1.20,1.10,1.04),.41,1.06,.23),
      'crawler':(.34,(1.2,1.5,.75),.66,(1.08,1,.84),.50,.39,(.98,1.03,.92),.26,.67,.24),
      'shielded':(.49,(1.08,1.04,1),1.12,(1.02,1,1),.99,.37,(1.04,1.03,1),.39,1,.21),
      'bomber':(.46,(1.50,1.25,1.05),1.09,(1,1,.96),.95,.43,(1.07,1.05,.97),.37,.96,.23),
      'spawner':(.35,(1.35,1.2,.90),.84,(1.08,.99,.91),.78,.38,(.95,1,.75),.28,.73,.22),
      'archer':(.49,(.95,1,1),1.13,(1,.99,1),.98,.34,(.97,1,1),.39,1,.18),
      'boss-warden':(.52,(1.70,1.45,1.20),1.24,(1.20,1.10,1.06),1.08,.56,(1.45,1.25,1.22),.44,1.14,.30),
      'boss-leech':(.51,(1.05,1.05,1.12),1.18,(1.05,1,1.03),1.01,.41,(1.12,1.12,1.34),.40,1.04,.20),
    }
    by,bs,hy,hs,ay,aw,asc,ly,ls,lw=shapes[kind]
    p('Body',(0,0,by),bs);p('Head',(0,-.015,hy),hs)
    for sign,n in [(-1,'ArmL'),(1,'ArmR')]:p(n,(sign*aw,0,ay),asc)
    for sign,n in [(-1,'LegL'),(1,'LegR')]:p(n,(sign*lw,.02,ly),(1,1,ls))
    for ob in list(parts['Head'].children_recursive):
        if not ob.get('gear'):continue
        # Existing role-specific hats follow the broader round skull.
        ob.location.x*=1.26;ob.location.y*=1.25;ob.location.z=.39+(ob.location.z-.36)*1.18
        ob.scale.x*=1.26;ob.scale.y*=1.25;ob.scale.z*=1.18
