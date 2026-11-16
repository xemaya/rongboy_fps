import fs from 'node:fs';import path from 'node:path';
import * as esbuild from '/Users/huanghaibin/Workspace/games/rongboy_fps/node_modules/esbuild/lib/main.js';
const repo='/Users/huanghaibin/Workspace/games/rongboy_fps',b='/tmp/rongboy-intro-ai',dir=b+'/ricochet-v2-page';fs.mkdirSync(dir,{recursive:true});
const entry=b+'/ricochet-v2-entry.js';fs.writeFileSync(entry,`import {SHOTS,BALL_PATH} from '${repo}/scenes/rongboy-intro/timeline.js';\nimport '${repo}/scenes/rongboy-intro/main.js';\nBALL_PATH[1][1]=1.31;BALL_PATH[2][1]=1.31;const shot=SHOTS.find(s=>s.id==='06-ricochet');shot.from={p:[-.5,2.4,6.4],at:[.4,1,-.1],fov:48};shot.to={...shot.from,p:shot.from.p.slice(),at:shot.from.at.slice()};\nconst original=window.render;window.render=t=>original(12.125+t/2);window.DUR=77/24*2;`);
const result=await esbuild.build({entryPoints:[entry],bundle:true,format:'iife',target:'es2022',loader:{'.glb':'binary','.mp3':'dataurl'},minify:true,write:false});
const html=fs.readFileSync(repo+'/scenes/rongboy-intro/index.html','utf8').replace('#title{position:absolute;','#title{display:none!important;position:absolute;').replace('/*__BUNDLE__*/',()=>result.outputFiles[0].text.replace(/<\/script/g,'<\\/script'));
fs.writeFileSync(dir+'/index.html',html);console.log('new readable ricochet camera built; original x/z path preserved; bounce height1.31; temporary frontal camera');
