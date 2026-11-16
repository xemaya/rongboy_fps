// Keep real node hierarchies and mesh buffers, omit images for DOM-free GLTF loader tests.
export function geometryOnlyGlb(bytes){
 const size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size)),tail=bytes.subarray(20+size);
 json.images=[];json.textures=[];json.materials=json.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1],roughnessFactor:m.pbrMetallicRoughness?.roughnessFactor??1},extras:m.extras}));
 const raw=Buffer.from(JSON.stringify(json)),jb=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+jb.length+tail.length,8);header.writeUInt32LE(jb.length,12);header.writeUInt32LE(0x4e4f534a,16);return Buffer.concat([header,jb,tail]);
}
