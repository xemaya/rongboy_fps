import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { buildMenuCards } from '../build-menu-cards.mjs';
import { LEVELS, ORDER, EXTRAS } from '../../scenes/rongboy-mission/levels/index.js';
import { compileLevel } from '../../scenes/rongboy-mission/level.js';
import { createGame } from '../../scenes/rongboy-mission/game.js';
const cards=await buildMenuCards();
assert.deepEqual(cards.filter(c=>c.id!=='training').map(c=>c.id),[...ORDER,...EXTRAS]);   // 游乐园列在四张正式关卡后面
for(const id of ORDER){const card=cards.find(c=>c.id===id),level=compileLevel(LEVELS[id]);assert.equal(card.enemies,createGame({level}).total,id+' initial enemy count');assert.equal(card.floors,level.storeys.length);assert.ok(card.preview.startsWith('<svg'));assert.ok(card.preview.includes('出发点'));}
{const drawn=cards.filter(c=>!EXTRAS.includes(c.id));assert.equal(new Set(drawn.map(c=>c.preview)).size,drawn.length,'each map has its own actual layout');}
const result=await build({entryPoints:['scenes/rongboy-mission/main.js'],bundle:true,minify:true,write:false,metafile:true,platform:'browser',format:'iife',target:'es2022'});
const inputs=Object.keys(result.metafile.inputs);assert.ok(inputs.every(p=>!p.endsWith('.glb')&&!p.includes('node_modules/three/')&&!p.includes('cine-engine/')), 'map selection must not load a renderer or figurine assets');
// 上限 2026-11-22 从 110 kB 提到 112 kB：选关里加了第五张图（游乐园），卡片、路由和一句英文一共多了约 300 字节，加之前是 109.8 kB。
assert.ok(result.outputFiles[0].contents.byteLength<112000,'map selection script must remain under112kB');
console.log('PASS map cards match playable maps and the menu stays independent of3D startup');

// Keep the user's chosen entry when a chapter or enemy encounter ends.
const { MENU, menuHref, readMenuRoute, playHref, exitPlayHref, modelPack, challengePlayHref, challengeBookHref } = await import('../../scenes/rongboy-mission/menu-flow.js');
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
assert.deepEqual(readPreferences(),{sound:true,quality:'auto',motion:'system',language:'auto'});
writePreferences({sound:false,quality:'low',motion:'reduced'});
assert.deepEqual(readPreferences(),{sound:false,quality:'low',motion:'reduced',language:'auto'});
writePreferences({ ...readPreferences(), language:'zh-CN' });
assert.equal(readPreferences().language,'zh-CN');
writePreferences({ ...readPreferences(), language:'unsupported' });
assert.equal(readPreferences().language,'auto');

const { resolveLanguage, english } = await import('../../scenes/rongboy-mission/language.js');
assert.equal(resolveLanguage('auto',{platform:true,locale:'zh-Hans-CN'}),'zh-CN');
assert.equal(resolveLanguage('auto',{platform:true,locale:'ja-JP'}),'en');
assert.equal(resolveLanguage('auto',{platform:true}),'en');
assert.equal(resolveLanguage('en',{platform:true,locale:'zh-CN'}),'en');
assert.equal(resolveLanguage('zh-CN',{platform:true,locale:'en-US'}),'zh-CN');
assert.equal(resolveLanguage('auto',{locale:'en-US'}),'en');
assert.equal(resolveLanguage('auto'),'zh-CN');
assert.equal(cards.find(c=>c.id==='house').name,'绒仔家');
assert.equal(english('绒仔家'),'Rongboy’s House');
assert.equal(english('花园首战'),'The Garden');
assert.equal(english('下一关'),'Next level');
globalThis.location = { search:'?lang=zh-CN' };
assert.equal(queryOf(playHref('school','chapters')).get('lang'),'zh-CN');
assert.equal(queryOf(exitPlayHref(queryOf(playHref('school','chapters')),'school')).get('lang'),'zh-CN');
assert.equal(queryOf(challengePlayHref('shield-bank')).get('lang'),'zh-CN');
assert.equal(queryOf(menuHref('settings',null,null,null,null)).get('lang'),null);
delete globalThis.location;


assert.equal(modelPack('shielded'),'second-trio.glb');
assert.equal(modelPack('boss-leech'),'final-trio.glb');
console.log('PASS menu routing and saved input/display preferences');

const releaseBundle=await build({
  entryPoints:['scenes/rongboy-mission/menu-flow.js'],
  bundle:true, write:false, format:'esm',
  define:{__RONGBOY_CRAZYGAMES__:'true'},
});
const release = await import('data:text/javascript;base64,'+Buffer.from(releaseBundle.outputFiles[0].contents).toString('base64'));
assert.deepEqual(release.MENU,[['chapters','开始游戏'],['settings','设置'],['practice','练习'],['challenges','挑战簿']]);
assert.equal(english(release.MENU[0][1]),'Play');
assert.equal(release.readMenuRoute(queryOf('index.html')).screen,'home');
assert.equal(release.readMenuRoute(queryOf(release.menuHref('chapters','garden-intro'))).level,'garden-intro');
assert.deepEqual(release.CHAPTERS,['garden-intro',...ORDER,...EXTRAS]);
const gardenPlay=release.playHref('garden-intro','chapters');
assert.equal(gardenPlay,'rongboy-play.html?level=garden-intro&from=chapters');
assert.equal(release.exitPlayHref(queryOf(gardenPlay),'garden-intro'),'rongboy-mission.html?screen=chapters&level=garden-intro');
console.log('PASS CrazyGames Play opens one level picker with an optional garden and a separate game page');
