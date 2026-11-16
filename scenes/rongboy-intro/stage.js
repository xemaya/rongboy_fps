import * as T from 'three';
import {createMaterialLibrary} from '../../cine-engine/engine/index.js';
import {plushMaterials} from '../../cine-engine/library/surfaces/plush.js';
import {PlushKit,sofa,cabinet,bookshelf,table,rug,windowUnit,picture,flower} from '../../cine-engine/library/structures/plush.js';
export function createIntroStage(cine){
 const lib=createMaterialLibrary(cine.renderer,{resolution:1024}),M=plushMaterials(lib),k=new PlushKit(),root=new T.Group();cine.scene.add(root);
 const wall=M('felt',0xeee0c6),trim=M('toy_wood'),sage=M('quilt',0x91a897);
 k.soft(M('boards',0xc7a47b),16,.16,16,0,-.08,1,{r:.02});
 const block=(x,w,y,h)=>k.soft(wall,w,h,.22,x,y,-2.60,{r:.035});
 block(-3.25,1.0,1.65,3.3);block(-.075,2.15,1.65,3.3);block(3.125,1.05,1.65,3.3);
 block(-1.95,1.6,.425,.85);block(-1.95,1.6,2.775,1.05);block(1.8,1.6,2.75,1.1);
 k.soft(wall,.30,3.3,9,3.60,1.65,1.75,{r:.035});
 k.soft(wall,.22,3.3,8.6,-3.75,1.65,1.6,{r:.025});
 const ceiling=M('felt',0xe9dfc8);k.soft(ceiling,7.6,.13,8.7,-.05,3.34,1.6,{r:.025});
 for(const [x,w]of [[-3.25,1],[-.075,2.15],[3.125,1.05]]){k.soft(sage,w,.66,.04,x,.34,-2.46,{r:.012});k.soft(trim,w,.055,.065,x,.69,-2.44,{r:.01});k.soft(trim,w,.10,.065,x,.05,-2.44,{r:.012});}
 k.soft(sage,.04,.66,9,3.43,.34,1.75,{r:.01});k.soft(trim,.065,.055,9,3.42,.69,1.75,{r:.01});
 for(const x of [1.0,2.6])k.soft(trim,.15,2.22,.30,x,1.11,-2.60,{r:.025});k.soft(trim,1.76,.15,.30,1.8,2.22,-2.60,{r:.025});
 const originalSheer=M.sheer;M.sheer=()=>new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
 windowUnit(k,M,{line:-2.6,at:-1.95,w:1.6,sill:.85,head:2.25,t:.22,inside:1,alongZ:false,drape:0xc68c75,glow:.15});M.sheer=originalSheer;
 // A cool, shallow exterior keeps the archer readable through the actual window opening.
 k.soft(M('felt',0x9dbdc0),8,3.5,.16,0,1.7,-4.2,{r:.02});
 for(const x of [-3.2,-1.8,.0,2.7])k.sphere(M('terry',0x799b78),.65,x,.52,-3.80,{sy:.7,seg:16,rings:10});
 bookshelf(k,M,{id:'intro-shelf',x:-3.1,z:-1.8,w:.70,d:.50,h:1.85,color:0xa08063,face:'s'});
 cabinet(k,M,{id:'intro-cabinet',x:2.92,z:-.65,w:.65,d:.55,h:.88,color:0xb49c7e,face:'w'});
 table(k,M,{id:'intro-console',x:-2.85,z:.10,w:.7,d:1.1,h:.62,color:0xc0a078,face:'e'},'console');
 const sofaKit=new PlushKit();sofa(sofaKit,M,{id:'intro-sofa',x:-.15,z:2.62,w:1.85,d:1.05,h:.72,color:0xb6846e,accent:0xc4b287,face:'s'});
 rug(k,M,{x:-.2,z:1.2,w:3.15,d:3.5,color:0x93a591});
 picture(k,M,{x:.25,y:1.78,z:-2.46,w:.62,h:.60,normal:[0,0,1],color:0xccb276,seed:42});
 picture(k,M,{x:3.43,y:1.74,z:1.0,w:.65,h:.80,normal:[-1,0,0],color:0xc28b75,seed:28});
 for(let i=0;i<4;i++)flower(k,M,-2.75+i*.11,.64,.1+(i%2)*.12,[0xd7ae70,0xc88f7a][i%2],.8);
 k.soft(trim,7.6,.16,.17,-.05,3.18,-2.45,{r:.02});
 const sofaMeshes=sofaKit.build();root.add(...sofaMeshes);const sofaRest=sofaMeshes.map(m=>({m,base:m.geometry.attributes.position.array.slice()}));
 const fixed=k.build();for(const m of fixed)if(m.material===ceiling)m.castShadow=false;root.add(...fixed);
 const dk=new PlushKit();dk.soft(M('boards',0xb28a62),1.46,2.05,.105,.73,1.025,0,{r:.045});dk.soft(M('quilt',0xa6b4a2),1.12,1.55,.018,.73,1.03,.062,{r:.035});dk.loop(M.thread,[[.22,.30,.08],[1.25,.30,.08],[1.25,1.75,.08],[.22,1.75,.08],[.22,.30,.08]]);dk.sphere(M.button(0xd6b46e),.055,1.25,1.05,.10,{seg:12,rings:8});
 const door=new T.Group();door.position.set(1.05,0,-2.56);door.add(...dk.build());root.add(door);
 const light=new T.HemisphereLight(0xf4e4cd,0xa3a081,1.35);root.add(light);const fill=new T.DirectionalLight(0xffefdb,1.1);fill.position.set(-3,3,5);root.add(fill);
 const windowLight=new T.PointLight(0xb9d6d9,6,7,2);windowLight.position.set(-1.95,1.8,-2.15);root.add(windowLight);
 return {root,door,lib,update(state){for(const {m,base}of sofaRest){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=base[i*3],y=base[i*3+1],z=base[i*3+2],w=y>.30&&y<.57&&z>2.40?Math.exp(-Math.pow((x+.15)/.60,4)-Math.pow((z-3.02)/.60,4)):0,u=Math.max(0,Math.min(1,(y-.30)/.17));p.setY(i,y-state.sit*.125*w*u);}p.needsUpdate=true;m.geometry.computeVertexNormals();}}};
}
