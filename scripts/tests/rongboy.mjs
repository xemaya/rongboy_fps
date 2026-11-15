import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {build} from 'esbuild';
import * as R from '../../scenes/rongboy/rules.js';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.COMBO_HOPPER_ROOT||fileURLToPath(new URL('../../vendor/combo-hopper/',import.meta.url));
const temp=await mkdtemp(path.join(tmpdir(),'rongboy-rules-'));
const compiled=path.join(temp,'original-rules.mjs');
await build({stdin:{contents:['state','milestones','auto-end-turn'].map(name=>'export * from '+JSON.stringify(path.join(root,'src/game',name+'.ts'))+';').join(''),resolveDir:process.cwd()},bundle:true,format:'esm',outfile:compiled,define:{'import.meta.env.BASE_URL':'"./"'}});
const O=await import(pathToFileURL(compiled).href);
const lv=R.LEVELS_ACT_1[6];
const pack=JSON.parse(await readFile(root+'/public/levels/entry-campaign.json','utf8'));const online=pack.levels.find(x=>x.id==='level-7');assert.deepEqual(online.zombies,lv.zombies);assert.deepEqual(online.scoutStart,lv.scoutStart);
const initial=()=>{const s=R.createInitialState(8,8,lv.scoutStart,structuredClone(lv.zombies),'long-legs');R.recomputeLegalMoves(s);return s;};
let checks=0,seed=154;for(let run=0;run<100;run++){let a=initial(),b=initial();for(let i=0;i<30&&a.phase==='playing';i++){
 const targets=[...a.legalJumps.map(j=>[j.lr,j.lc]),...a.legalWalks.map(p=>[p.r,p.c]),...a.legalFreeMoves.map(p=>[p.r,p.c])];if(a.chainActive)targets.push('end');if(a.apexUsesRemaining&&!a.freeMoveMode)targets.push('apex');if(!targets.length)break;seed=(seed*1664525+1013904223)>>>0;const act=targets[seed%targets.length];
 const before=JSON.stringify(a),preview=structuredClone(a);if(Array.isArray(act))R.clickCell(preview,...act);assert.equal(JSON.stringify(a),before);
 const step=(m,s)=>{let e;if(act==='end')e=m.endTurn(s).events;else if(act==='apex'){m.activateApexMove(s);m.recomputeLegalMoves(s);e=[];}else e=m.clickCell(s,...act).events;if(m.shouldAutoEndTurn(s))e.push(...m.endTurn(s).events);return e;};assert.deepEqual(step(R,a),step(O,b));assert.deepEqual(a,b);checks++;
}}
const s=initial(),tape=JSON.parse(await readFile(new URL('../../scenes/rongboy/reference/solution.json',import.meta.url),'utf8')).actions;let maxCombo=0,tankHits=0;for(const p of tape){const ev=R.clickCell(s,...p).events;maxCombo=Math.max(maxCombo,s.combo);tankHits+=ev.filter(e=>e.kind==='tank-stun').length;if(R.shouldAutoEndTurn(s))R.endTurn(s);}assert.equal(s.phase,'win');assert.ok(maxCombo>=5);assert.ok(tankHits>0);assert.deepEqual(s,JSON.parse(await readFile(new URL('../../scenes/rongboy/reference/expected-final.json',import.meta.url),'utf8')));await rm(temp,{recursive:true,force:true});console.log(JSON.stringify({parityTransitions:checks,levelPackMatches:true,previewPure:true,solution:{phase:s.phase,actions:s.stepsThisLevel,turns:s.turnsThisLevel,maxCombo,tankHits}},null,2));
