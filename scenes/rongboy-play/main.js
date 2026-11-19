import { MAP_CARDS } from '../rongboy-mission/map-cards.js';
import { CHAPTER_ART, exitPlayHref } from '../rongboy-mission/menu-flow.js';
import { ZOMBIE_ROSTER } from '../../library/games/rongboy-roster.js';
import { readPlayChallenge } from '../rongboy-mission/challenges.js';

// Paint the selected scene before initializing WebGL, map geometry and models.
const query=new URLSearchParams(location.search),id=query.get('level');
const selected=MAP_CARDS.find(card=>card.id===id)||MAP_CARDS[0];
const opponent=ZOMBIE_ROSTER.find(enemy=>enemy.id===query.get('type'));
const challenge=readPlayChallenge(query);
const name=challenge?.name ?? (id==='weapon-range'?'武器试验场':id==='garden-wall'?'花园练习':id==='training'&&opponent?opponent.name+'试战':selected.name);
const theme=Object.hasOwn(CHAPTER_ART,id) ? CHAPTER_ART[id] : ['training','garden-wall','challenge','weapon-range'].includes(id)?'practice':'garden';
const loading=document.getElementById('loading'),status=document.getElementById('loadingStatus'),back=document.getElementById('loadBack');
loading.style.setProperty('--level-scene','url("menu-'+theme+'.webp")');
document.title='绒仔 · '+name;
document.getElementById('loadingTitle').textContent=name;
status.textContent='正在准备关卡…';
back.href=exitPlayHref(query,id||selected.id);
function fail(){
  status.textContent='加载失败，请返回后重试。';
  back.hidden=false;
}
addEventListener('error',fail);
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  setTimeout(()=>import('../rongboy-mission/play.js').catch(fail),0);
}));
