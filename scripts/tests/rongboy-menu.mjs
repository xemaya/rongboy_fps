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

// Keep the user's chosen entry when a chapter or enemy encounter ends.
const { MENU, readMenuRoute, playHref, exitPlayHref, modelPack, challengePlayHref, challengeBookHref } = await import('../../scenes/rongboy-mission/menu-flow.js');
const queryOf = href => new URL(href,'http://localhost/').searchParams;
assert.equal(readMenuRoute(queryOf('rongboy-mission.html')).screen,'home');
assert.deepEqual(readMenuRoute(queryOf('rongboy-mission.html?level=museum')),
  {screen:'chapters',level:'museum',type:'walker',challenge:'shield-bank'});
assert.equal(exitPlayHref(queryOf(playHref('museum','chapters')),'museum'),'rongboy-mission.html?screen=chapters&level=museum');
assert.equal(exitPlayHref(queryOf(playHref('garden-wall','practice')),'garden-wall'),'rongboy-mission.html?screen=practice');
assert.equal(exitPlayHref(queryOf(playHref('training','practice','shielded')),'training'),'rongboy-mission.html?screen=opponents&type=shielded');
assert.equal(exitPlayHref(queryOf(playHref('training','codex','shielded')),'training'),'rongboy-mission.html?screen=opponents&type=shielded');
assert.equal(readMenuRoute(queryOf('rongboy-mission.html?screen=enemy&type=archer')).screen,'opponents');
assert.equal(readMenuRoute(queryOf('rongboy-mission.html?screen=codex&type=archer')).type,'archer');
assert.equal(MENU.at(-1)[0],'challenges');
assert.equal(readMenuRoute(queryOf(challengeBookHref('dodge-arrows'))).challenge,'dodge-arrows');
assert.equal(exitPlayHref(queryOf(challengePlayHref('static-followup')),'challenge'),challengeBookHref('static-followup'));
const { readPreferences, writePreferences } = await import('../../scenes/rongboy-mission/preferences.js');
const storage = new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
assert.deepEqual(readPreferences(),{sound:true,quality:'auto',motion:'system'});
writePreferences({sound:false,quality:'low',motion:'reduced'});
assert.deepEqual(readPreferences(),{sound:false,quality:'low',motion:'reduced'});
assert.equal(modelPack('shielded'),'second-trio.glb');
assert.equal(modelPack('boss-leech'),'final-trio.glb');
console.log('PASS menu routing and saved input/display preferences');
