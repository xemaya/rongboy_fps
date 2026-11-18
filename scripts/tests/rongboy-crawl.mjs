import * as T from 'three';
import {loadFigurines} from '../../library/games/rongboy-runtime.js';
import {geometryOnlyGlb} from '../../scripts/tests/helpers/gltf-geometry.mjs';
import fs from 'node:fs';
const data=fs.readFileSync(new URL('../../assets/rongboy/second-trio/second-trio.glb',import.meta.url));
const factory=await loadFigurines({zombies:geometryOnlyGlb(data)});
import {poseRosterFigurine} from '../../library/games/rongboy-roster-pose.js';
import {createGame,step} from '../../scenes/rongboy-mission/game.js';
import {compileLevel} from '../../scenes/rongboy-mission/level.js';
import {trainingDef} from '../../scenes/rongboy-mission/levels/training.js';
import assert from 'node:assert/strict';

const actor=factory.create('crawler');
function soles(){actor.world.updateMatrixWorld(true);return ['ArmL','ArmR','LegL','LegR'].map(n=>new T.Box3().setFromObject(actor.parts.get(n),true).min.y);}
poseRosterFigurine(actor,0,false);const rest=soles();let minimum=4,worst=0,peak=0;
for(let i=0;i<64;i++){poseRosterFigurine(actor,i/64*.5/.72,true);const ys=soles().map((y,j)=>y-rest[j]);minimum=Math.min(minimum,ys.filter(v=>v<.002).length);worst=Math.min(worst,...ys);peak=Math.max(peak,...ys);assert.equal(actor.world.position.y,0);}
assert.ok(minimum>=2 && worst>-.003 && peak>.045);
const state=createGame({level:compileLevel(trainingDef('crawler'))});const e=state.enemies[0];let lands=0,hop=0;const actions=new Set();
for(let i=0;i<1400;i++){step(state,1/120,{});lands+=state.events.filter(v=>v.type==='land'&&v.id===e.id).length;state.events.length=0;actions.add(e.action);hop=Math.max(hop,Math.abs(e.y-e.base));}
assert.ok(actions.has('crawler-strike'));assert.equal(hop,0);assert.equal(lands,0);assert.ok(e.crawlDistance>.5);
console.log({minimumPlanted:minimum,penetration:worst,peakSwing:peak,hop,lands,travel:e.crawlDistance,actions:[...actions]});
