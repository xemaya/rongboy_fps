import { MAP_CARDS } from '../rongboy-mission/map-cards.js';
import { CHAPTER_ART, exitPlayHref } from '../rongboy-mission/menu-flow.js';
import { ZOMBIE_ROSTER } from '../../library/games/rongboy-roster.js';
import { connectCrazyGames, crazyGames, firstRound } from '../rongboy-mission/platform.js';
import { loadInterfaceFonts } from '../rongboy-mission/interface-font.js';
import { initializeLanguage, language, t } from '../rongboy-mission/language.js';
import { readPlayChallenge } from '../rongboy-mission/challenges.js';

// Paint the selected scene before initializing WebGL, map geometry and models.
const query=new URLSearchParams(location.search),id=query.get('level') || (crazyGames ? firstRound : null);
const selected=MAP_CARDS.find(card=>card.id===id)||MAP_CARDS[0];
const opponent=ZOMBIE_ROSTER.find(enemy=>enemy.id===query.get('type'));
const challenge=readPlayChallenge(query);
const name=id===firstRound?'花园首战':challenge?.name ?? (id==='amusement-tour'?'布偶游乐园':id==='weapon-range'?'武器试验场':id==='garden-wall'?'花园练习':id==='training'&&opponent?opponent.name+'试战':selected.name);
const theme=Object.hasOwn(CHAPTER_ART,id) ? CHAPTER_ART[id] : ['training','garden-wall','challenge','weapon-range'].includes(id)?'practice':'garden';
const loading=document.getElementById('loading'),status=document.getElementById('loadingStatus'),back=document.getElementById('loadBack');
loading.style.setProperty('--level-scene','url("menu-'+theme+'.webp")');
function showLoading() {
  document.title=t('绒仔')+' · '+t(name);
  document.getElementById('loadingTitle').textContent=t(name);
  status.textContent=t('正在准备关卡…');
  back.href=exitPlayHref(query,id||selected.id);
}
function fail(){
  status.textContent=t('加载失败，请返回后重试。');
  back.hidden=false;
}
addEventListener('error',fail);
const localeReady = initializeLanguage();
const sdkReady = connectCrazyGames();
showLoading();
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  setTimeout(async () => {
    try {
      await localeReady;
      showLoading();
      const { boot } = await import('../rongboy-mission/play.js');
      await loadInterfaceFonts(language);
      await boot(sdkReady);
    } catch { fail(); }
  },0);
}));
