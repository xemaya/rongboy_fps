import { MAP_CARDS } from '../rongboy-mission/map-cards.js';
// Paint the loading screen before initializing the selected world and its models.
const status=document.getElementById('loadingStatus');
const selected=MAP_CARDS.find(c=>c.id===new URLSearchParams(location.search).get('level'))||MAP_CARDS[0];
document.title='Rongboy · '+selected.name;document.getElementById('loadingTitle').textContent='正在前往'+selected.name;
addEventListener('error',e=>{status.textContent='加载失败，请返回菜单重试。';document.getElementById('loadBack').hidden=false;});
requestAnimationFrame(()=>requestAnimationFrame(()=>{setTimeout(()=>import('../rongboy-mission/play.js').catch(e=>{status.textContent='加载失败：'+e.message;document.getElementById('loadBack').hidden=false;}),0);}));
