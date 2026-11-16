// Shared metre-scale geometry: rendering, navigation, aiming and ricochets use these boxes.
export const ROOM={halfX:9.6,halfZ:7.2,height:3.9};
export const COVERS=[
 {id:'thread-cabinet',x:0,z:-2.25,w:1.6,d:.72,h:2.35,color:0x778a76,kind:'cabinet'},
 {id:'work-table',x:0,z:.05,w:2.1,d:.82,h:.83,color:0xbb855d,kind:'bench'},
 {id:'west-shelf',x:-3.25,z:-.6,w:.85,d:2,h:1.95,color:0x8f9b7b,kind:'cabinet'},
 {id:'east-cushion',x:3.15,z:-.35,w:1.05,d:1.9,h:.96,color:0xc49960,kind:'cushion'},
 {id:'back-crate',x:-3.5,z:-3.25,w:1.55,d:.8,h:1.12,color:0xad7863,kind:'crate'},
 {id:'near-shelf',x:3.65,z:2.65,w:1.45,d:.7,h:1.8,color:0x9c9d7b,kind:'cabinet'},
 {id:'cutting-divider',x:-6.55,z:1.15,w:.82,d:3.15,h:2.15,color:0x829b90,kind:'cabinet'},
 {id:'cutting-table',x:-5.3,z:-3.65,w:2.55,d:1.0,h:.87,color:0xbd9773,kind:'bench'},
 {id:'west-rolls',x:-7.75,z:-5.8,w:1.55,d:1.05,h:1.25,color:0xa6ac7e,kind:'crate'},
 {id:'packing-shelf',x:6.5,z:-2.9,w:1.05,d:3.15,h:2.25,color:0x83977c,kind:'cabinet'},
 {id:'packing-table',x:5.35,z:4.75,w:2.6,d:1.0,h:.84,color:0xb58767,kind:'bench'},
 {id:'back-cushions',x:3.4,z:-5.55,w:2.5,d:.95,h:.9,color:0xc5a574,kind:'cushion'},
 {id:'front-crates',x:-4.4,z:5.65,w:1.7,d:1.0,h:1.2,color:0x9c8575,kind:'crate'},
 {id:'near-cushion',x:-2.75,z:2.85,w:1.4,d:.75,h:.7,color:0x9ca77b,kind:'cushion'},
].map(c=>({...c,minX:c.x-c.w/2,maxX:c.x+c.w/2,minZ:c.z-c.d/2,maxZ:c.z+c.d/2,minY:0,maxY:c.h}));

// Slab intersection also returns the surface normal. A finite segment, never an infinite ray.
export function segmentBox(a,b,box,pad=0){
 let near=0,far=1,nx=0,ny=0,nz=0;
 for(const [axis,min,max]of [['x','minX','maxX'],['y','minY','maxY'],['z','minZ','maxZ']]){
  const delta=b[axis]-a[axis],lo=box[min]-pad,hi=box[max]+pad;
  if(Math.abs(delta)<1e-10){if(a[axis]<lo||a[axis]>hi)return null;continue;}
  let t0=(lo-a[axis])/delta,t1=(hi-a[axis])/delta,sign=-1;
  if(t0>t1){[t0,t1]=[t1,t0];sign=1;}
  if(t0>=near){near=t0;nx=ny=nz=0;if(axis==='x')nx=sign;if(axis==='y')ny=sign;if(axis==='z')nz=sign;}
  far=Math.min(far,t1);if(near>far)return null;
 }
 return far>=0&&near<=1?{t:Math.max(0,near),nx,ny,nz}:null;
}
export function clearPath(a,b,r,covers=COVERS){return !covers.some(c=>segmentBox({x:a.x,y:.2,z:a.z},{x:b.x,y:.2,z:b.z},c,r));}
export function freePoint(x,z,r,covers=COVERS){return Math.abs(x)<ROOM.halfX-r&&Math.abs(z)<ROOM.halfZ-r&&!covers.some(c=>Math.hypot(x-Math.max(c.minX,Math.min(c.maxX,x)),z-Math.max(c.minZ,Math.min(c.maxZ,z)))<r);}
// Corner visibility graph. Cached per body width; live endpoints reconnect when a route is needed.
const graphs=new Map();
export function routeTo(from,to,r,covers=COVERS){
 if(clearPath(from,to,r,covers))return [{x:to.x,z:to.z}];
 const key=covers===COVERS?r:null;let graph=key!==null?graphs.get(key):null;
 if(!graph){const nodes=[];for(const c of covers)for(const x of [c.minX-r-.055,c.maxX+r+.055])for(const z of [c.minZ-r-.055,c.maxZ+r+.055])if(freePoint(x,z,r,covers))nodes.push({x,z});const edges=nodes.map(()=>[]);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(clearPath(nodes[i],nodes[j],r,covers)){const d=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z);edges[i].push([j,d]);edges[j].push([i,d]);}graph={nodes,edges};if(key!==null)graphs.set(key,graph);}
 const nodes=[...graph.nodes,{x:from.x,z:from.z},{x:to.x,z:to.z}],edges=graph.edges.map(e=>[...e]),start=nodes.length-2,end=start+1;edges.push([],[]);
 for(const i of [start,end])for(let j=0;j<i;j++)if(clearPath(nodes[i],nodes[j],r,covers)){const d=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z);edges[i].push([j,d]);edges[j].push([i,d]);}
 const distance=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set();distance[start]=0;
 for(let k=0;k<nodes.length;k++){let best=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(best<0||distance[i]<distance[best]))best=i;if(best<0||!Number.isFinite(distance[best]))break;if(best===end)break;done.add(best);for(const [j,d]of edges[best])if(distance[best]+d<distance[j]){distance[j]=distance[best]+d;prev[j]=best;}}
 if(!Number.isFinite(distance[end]))return [];const result=[];for(let i=end;i!==start;i=prev[i])result.unshift(nodes[i]);return result;
}
export function resolveCover(body,r,covers=COVERS){
 for(let pass=0;pass<2;pass++)for(const c of covers){const x=Math.max(c.minX,Math.min(c.maxX,body.x)),z=Math.max(c.minZ,Math.min(c.maxZ,body.z)),dx=body.x-x,dz=body.z-z,d=Math.hypot(dx,dz);if(d>=r)continue;
  if(d>1e-7){const nx=dx/d,nz=dz/d;body.x+=nx*(r-d+.001);body.z+=nz*(r-d+.001);const v=(body.vx||0)*nx+(body.vz||0)*nz;if(v<0){body.vx-=nx*v;body.vz-=nz*v;}}
  else{const sides=[[Math.abs(body.x-c.minX),-1,0],[Math.abs(c.maxX-body.x),1,0],[Math.abs(body.z-c.minZ),0,-1],[Math.abs(c.maxZ-body.z),0,1]].sort((a,b)=>a[0]-b[0]);const [,nx,nz]=sides[0];if(nx)body.x=(nx<0?c.minX:c.maxX)+nx*(r+.001);else body.z=(nz<0?c.minZ:c.maxZ)+nz*(r+.001);body.vx=body.vz=0;}
 }
}
