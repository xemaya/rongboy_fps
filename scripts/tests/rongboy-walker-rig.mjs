// Exercise the actual exported mesh hierarchy, with textures omitted for headless geometry checks.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {repairWalkerRig} from '../../library/games/rongboy-runtime.js';
const bytes=await readFile(new URL('../../assets/rongboy/runtime/walker.glb',import.meta.url));
const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
json.images=[];json.textures=[];json.materials=json.materials.map(()=>({pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}));
const raw=Buffer.from(JSON.stringify(json)),padding=(4-raw.length%4)%4,jb=Buffer.concat([raw,Buffer.alloc(padding,32)]),bin=bytes.subarray(20+length),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+jb.length+bin.length,8);header.writeUInt32LE(jb.length,12);header.writeUInt32LE(0x4e4f534a,16);
const glb=Buffer.concat([header,jb,bin]),root=(await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'')).scene;
root.updateMatrixWorld(true);const before=new Map();root.traverse(o=>{if(o.isMesh)before.set(o.uuid,new T.Box3().setFromObject(o));});
repairWalkerRig(root);let checked=0;root.traverse(o=>{if(o.isMesh){const a=before.get(o.uuid),b=new T.Box3().setFromObject(o);assert.ok(a.min.distanceTo(b.min)<1e-6&&a.max.distanceTo(b.max)<1e-6,'Joint repair must preserve authored geometry');checked++;}});
let arm;root.traverse(o=>{if(o.userData.part==='ArmL'&&!o.isMesh&&!o.name.startsWith('Mesh'))arm=o;});assert.ok(Math.abs(arm.position.y-1.23)<.001);const rest=new T.Box3().setFromObject(arm).getCenter(new T.Vector3());arm.rotation.x=-1.18;root.updateMatrixWorld(true);const reach=new T.Box3().setFromObject(arm).getCenter(new T.Vector3());assert.ok(reach.z>rest.z+.15);assert.ok(reach.y>rest.y&&reach.y>1,'Reaching arm must rise in front of chest');
repairWalkerRig(root);assert.ok(Math.abs(arm.position.y-1.23)<.001,'Repair is idempotent');
console.log(`PASS native walker: ${checked} mesh bounds preserved; shoulder reach is forward and above floor`);
