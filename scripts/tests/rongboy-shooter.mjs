import assert from 'node:assert/strict';
import {createGame,spawn,fire,beginCharge,releaseCharge,step,consumeEvents,segmentCircle,CONFIG} from '../../scenes/rongboy-shooter/game.js';
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
const empty=()=>{const s=createGame();s.enemies=[];s.spawnIn=999;s.player={x:-2,z:0,vx:0,vz:0,aimX:1,aimZ:0};return s;};
test('swept ball collision catches a crossed target',()=>{assert.ok(Math.abs(segmentCircle(-2,0,2,0,0,0,.3)-.425)<1e-9);assert.equal(segmentCircle(-2,1,2,1,0,0,.3),null);const s=empty(),e=spawn(s,-.82,0);fire(s);step(s,.05);assert.equal(e.hp,2);assert.equal(s.hits,1);assert.equal(s.balls.length,0);});
test('charge releases one heavy shot with kill and push',()=>{const s=empty();beginCharge(s);for(let i=0;i<100;i++)step(s,.01);const e=spawn(s,-.82,0);assert.equal(s.shots,0);releaseCharge(s);assert.equal(s.shots,1);assert.ok(s.balls[0].power>.99);step(s,.05);assert.equal(e.alive,false);assert.ok(e.vx>5);assert.equal(s.kills,1);});
test('momentum transfers a knockdown through another toy',()=>{const s=empty(),a=spawn(s,0,0),b=spawn(s,.58,0);a.alive=false;a.vx=6;a.deathAge=.05;step(s,.02);assert.equal(b.alive,false);assert.ok(consumeEvents(s).some(e=>e.type==='knockdown'&&e.source==='collision'));});
test('contact damage respects invulnerability',()=>{const s=empty();s.player.x=0;spawn(s,.2,0);step(s,.01);assert.equal(s.health,2);step(s,.01);assert.equal(s.health,2);});
test('diagonal movement is normalized and stays on the table',()=>{const a=empty(),b=empty();step(a,.05,{x:1,z:1});step(b,.05,{x:1,z:0});assert.ok(Math.abs(Math.hypot(a.player.x+2,a.player.z)-(b.player.x+2))<1e-8);for(let i=0;i<200;i++)step(a,.05,{x:1,z:1});assert.ok(a.player.x<=CONFIG.halfX-.35);assert.ok(a.player.z<=CONFIG.halfZ-.35);});
test('cooldown prevents duplicated pointer/keyboard shots',()=>{const s=empty();assert.equal(fire(s),true);assert.equal(fire(s),false);assert.equal(s.shots,1);});
test('a full sixty-second simulation ends and stops mutating',()=>{const s=empty();for(let i=0;i<3601;i++)step(s,1/60);assert.equal(s.phase,'won');assert.equal(s.time,60);const t=JSON.stringify(s);step(s,.05);assert.equal(JSON.stringify(s),t);});
test('fresh restart has independent state',()=>{const a=createGame(),b=createGame();a.enemies[0].hp=0;a.health=0;assert.equal(b.health,3);assert.equal(b.enemies[0].hp,3);});
console.log(checks+' meaningful combat checks passed');
