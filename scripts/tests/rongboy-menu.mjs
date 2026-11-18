import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { buildMenuCards } from '../build-menu-cards.mjs';
import { LEVELS, ORDER } from '../../scenes/rongboy-mission/levels/index.js';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame } from '../../scenes/rongboy-mission/game.js';
const cards=await buildMenuCards();
assert.deepEqual(cards.filter(c=>c.id!=='training').map(c=>c.id),ORDER);
for(const id of ORDER){const card=cards.find(c=>c.id===id),level=compileLevel(LEVELS[id]);assert.equal(card.enemies,createGame({level}).total,id+' initial enemy count');assert.equal(card.floors,level.storeys.length);assert.ok(card.preview.startsWith('<svg'));assert.ok(card.preview.includes('出发点'));}
assert.equal(new Set(cards.map(c=>c.preview)).size,cards.length,'each map has its own actual layout');
const result=await build({entryPoints:['scenes/rongboy-mission/main.js'],bundle:true,minify:true,write:false,metafile:true,platform:'browser',format:'iife',target:'es2022'});
const inputs=Object.keys(result.metafile.inputs);assert.ok(inputs.every(p=>!p.endsWith('.glb')&&!p.includes('node_modules/three/')&&!p.includes('cine-engine/')), 'map selection must not load a renderer or figurine assets');
assert.ok(result.outputFiles[0].contents.byteLength<110000,'map selection script must remain under110kB');
console.log('PASS map cards match playable maps and the menu stays independent of3D startup');
