import { crazyGames, firstRound } from './platform.js';
import { copy, initializeLanguage, language, t, urlLanguage } from './language.js';
import { MAP_CARDS } from './map-cards.js';
import { createGamepad } from './gamepad.js';
import { MENU, CHAPTERS, CHAPTER_ART, SCREEN_IDS, readMenuRoute, menuHref, playHref, challengeBookHref, challengePlayHref, pageHref } from './menu-flow.js';
import { readPreferences, writePreferences } from './preferences.js';
import { ZOMBIE_ROSTER } from '../../library/games/rongboy-roster.js';
import { ATTACKS } from './attacks.js';
import { KEYBOARD, GAMEPAD, drawHints, keyBadge, labelAction } from './input-hints.js';
import { CHALLENGES, findChallenge, hasStamp } from './challenges.js';

const $ = id => document.getElementById(id);
const cards = CHAPTERS.map(id => id === firstRound
  ? {id, name:'花园首战', mission:'清空花园'} : MAP_CARDS.find(card=>card.id===id));
const prefs = readPreferences();
const query = new URLSearchParams(location.search);
prefs.language = urlLanguage() ?? prefs.language;
let route = readMenuRoute(query);
const homeFocus = MENU.findIndex(([id]) => id === query.get('focus'));
let menuIndex = Math.max(0,homeFocus), practiceIndex = query.get('focus')==='weapons'?2:0;
let deviceIndex = 0, viewIndex = 0, leaving = false, frame = null, input = KEYBOARD;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const practice = [
  { name:'花园练习', title:'借墙破盾', hint:'用线轴手枪练蓄力破盾，也可以让毛球借墙打到盾后。' },
  { name:'兵种试战', title:'拆解招式', hint:'挑一个对手，看准它的起手，练躲避和反击。' },
  { name:'武器试验场', title:'走廊试射', hint:'试探照灯炮、电网和 4× 毛衣针，也能对比小丑盒和蒸笼的伤害。' },
];
const views = [['front','正面'],['side','侧面'],['back','背面']];
const settings = [
  { key:'language', label:'语言', choices:[['auto','自动'],['zh-CN','简体中文'],['en','English']] },
  { key:'sound', label:'声音', choices:[[true,'开'],[false,'关']] },
  { key:'quality', label:'画质', choices:[['auto','自动'],['high','清晰'],['low','流畅']] },
  { key:'motion', label:'镜头晃动', choices:[['system','标准'],['reduced','减弱']] },
];
let settingIndex = query.get('focus')==='controls' ? settings.length : 0;
const bindings = [
  ...(crazyGames ? [[['WASD','移动'],['鼠标','转向'],['鼠标左键','射击 / 蓄力'],['R','换弹'],['Q','换枪'],['Shift','跳跃'],['F','拾取 / 换地上的枪'],['E','投掷'],['G','切换炸弹'],['Esc','暂停']]] : []),
  [['WASD','移动'],['方向键','转向'],['空格','射击 / 蓄力'],['R','换弹'],['Q','换枪'],['Shift','跳跃'],['F','拾取 / 换地上的枪'],['E','投掷'],['G','切换炸弹'],['Esc','暂停']],
  [['左摇杆','移动'],['右摇杆','转向'],['R2','射击 / 蓄力'],['R1','换弹'],['L1','换枪'],['✕','跳跃'],['□','拾取 / 换地上的枪'],['L2','投掷'],['十字↓','切换炸弹'],['Options','暂停']],
];

const localLabels = new Map();
function appendLabel(host, label) {
  const node = document.createTextNode(t(label));
  host.append(node);
  localLabels.set(node,label);
}
function buttons(host, labels, style, onClick) {
  return labels.map((label,i)=>{
    const b=document.createElement('button');
    b.type='button';b.className=style;appendLabel(b,label);b.onclick=()=>onClick(i);
    host.append(b);return b;
  });
}
function mark(list, index) {
  for (const [i,b] of list.entries()) b.setAttribute('aria-pressed',String(i===index));
}
function focus(button, scroll=false) {
  button?.focus({preventScroll:true});
  if(scroll) button?.scrollIntoView({block:'nearest'});
}
const chooseHome = () => go(MENU[menuIndex][0]);
const homeButtons=buttons($('home-options'),MENU.map(x=>x[1]),'choice',i=>{
  menuIndex=i;chooseHome();
});
const cardsUI=buttons($('maps'),cards.map(card=>card.name),'card',i=>selectChapter(i,true));
for(const [i,card] of cards.entries()){
  const img=document.createElement('img'), name=document.createElement('span');
  img.src='menu-'+CHAPTER_ART[card.id]+'.webp';img.alt='';img.loading='lazy';name.append(cardsUI[i].firstChild);
  cardsUI[i].replaceChildren(img,name);
}
const practiceButtons=buttons($('practice-options'),practice.map(x=>x.name),'choice',i=>{
  practiceIndex=i;render(true);
});
const opponentButtons=buttons($('opponent-options'),ZOMBIE_ROSTER.map(e=>e.name),'choice',i=>selectEnemy(i));
const challengeButtons=buttons($('challenge-options'),CHALLENGES.map(challenge=>challenge.name),'choice',i=>selectChallenge(i));
const challengeStamps=challengeButtons.map(button=>{
  const stamp=document.createElement('span');
  stamp.className='ui-stamp';stamp.setAttribute('aria-hidden','true');
  button.append(stamp);
  return stamp;
});
const viewButtons=buttons($('views'),views.map(x=>x[1]),'pill',i=>{viewIndex=i;render(false);});
const deviceButtons=buttons($('devices'),[...(crazyGames ? ['鼠标'] : []),'键盘','手柄'],'pill',i=>{deviceIndex=i;render(true);});
const settingRows=settings.map((setting,index)=>{
  const row=document.createElement('div'),label=document.createElement('span'), values=document.createElement('div');
  row.className='setting';label.className='setting-title';appendLabel(label,setting.label);values.className='values';
  row.append(label,values);$('setting-options').append(row);
  const list=buttons(values,setting.choices.map(c=>c[1]),'pill',i=>{
    settingIndex=index;
    setPreference(setting,setting.choices[i][0]);
    if (!leaving) render(true);
  });
  return {row,list};
});

function setPreference(setting, value) {
  if (prefs[setting.key] === value) return;
  prefs[setting.key] = value;
  const saved = writePreferences(prefs);
  if (setting.key === 'language') {
    history.replaceState(null,'',menuHref('settings',null,null,null,saved ? null : value));
    refreshLocale();
  }
}

async function refreshLocale() {
  const previous = language;
  await initializeLanguage({waitForPlatformLocale:true});
  for (const [node,label] of localLabels) node.nodeValue=t(label);
  if (frame && previous!==language) model(false);
  render(false);
}

function syncPreferences() {
  const previous = prefs.language;
  Object.assign(prefs,readPreferences());
  prefs.language = urlLanguage() ?? prefs.language;
  if (prefs.language!==previous) refreshLocale();
}

const wrap = (value,size) => (value + size) % size;
function routeHref() {
  if (route.screen==='challenges') return challengeBookHref(route.challenge);
  const focus = route.screen==='settings' && settingIndex===settings.length ? 'controls' : null;
  return menuHref(route.screen,route.level,route.type,focus);
}
function replaceRoute() {
  history.replaceState(null,'',routeHref());
}
function go(screen) {
  route.screen=screen;
  history.pushState(null,'',routeHref());
  render(true);
}
function selectChapter(i,withFocus) {
  route.level=cards[i].id;replaceRoute();render(withFocus);
}
function selectEnemy(i) {
  route.type=ZOMBIE_ROSTER[i].id;viewIndex=0;replaceRoute();render(true);
}
function selectChallenge(i) {
  route.challenge=CHALLENGES[i].id;replaceRoute();render(true);
}
function model(show) {
  if(!show){frame?.remove();frame=null;return;}
  const view=views[viewIndex][0];
  if(!frame){
    frame=document.createElement('iframe');
    frame.title=t('已选敌人的 3D 模型');frame.tabIndex=-1;
    frame.src=pageHref('rongboy-menu-model.html',new URLSearchParams({type:route.type,view}),language);
    frame.onload=()=>postModel();
    $('model-slot').append(frame);
  }
  postModel();
}
function postModel(){
  frame?.contentWindow?.postMessage({kind:'rongboy-model',type:route.type,view:views[viewIndex][0],motion:prefs.motion!=='reduced'&&!reduceMotion.matches},location.origin);
}
reduceMotion.addEventListener('change',postModel);

function setInput(device) {
  if (input === device) return;
  input = device;
  drawCommands();
}

function drawCommands() {
  const {screen}=route;
  const hints={
    home:[[input.vertical,'选择'],[input.confirm,'进入']],
    chapters:[[input.horizontal,'切换地图']],
    settings:[[input.vertical,'选择'],[input.horizontal,'调整'],[input.confirm,'查看按键']],
    controls:[[input.horizontal,'切换设备']],
    practice:[[input.vertical,'切换练习']],
    opponents:[[input.vertical,'切换对手'],[input.horizontal,'切换角度']],
    challenges:[[input.vertical,'切换挑战']],
  };
  if (screen==='settings' && settingIndex!==settings.length) hints.settings.pop();
  drawHints($('hints'),hints[screen]);
  $('go-back').hidden=screen==='home';
  const backTo={controls:'返回设置',opponents:'返回练习'};
  labelAction($('go-back'),input.back,backTo[screen]||'返回主菜单');
  if (screen==='chapters') labelAction($('start'),input === KEYBOARD ? '↵' : input.confirm,'进入');
  if (screen==='practice') labelAction($('practice-start'),input.confirm,['开始练习','选择对手','开始试射'][practiceIndex]);
  if (screen==='opponents') labelAction($('model-action'),input.confirm,'开始试战');
  if (screen==='challenges') labelAction($('challenge-start'),input.confirm,hasStamp(route.challenge)?'再次挑战':'开始挑战');
}

function drawChallengeBook(id) {
  const selected=findChallenge(id);
  $('challenge-name').textContent=t(selected.name);
  $('challenge-goal').textContent=t(selected.goal);
  $('challenge-hint').textContent=t(selected.hint);
  $('challenge-time').textContent=copy(`限时 ${selected.seconds} 秒`, `${selected.seconds}s limit`);
  $('book-stamp').textContent=t(selected.stamp);
  $('book-stamp').hidden=!hasStamp(id);
  for (const [index,challenge] of CHALLENGES.entries()) {
    const button=challengeButtons[index], earned=hasStamp(challenge.id);
    const stamp=challengeStamps[index];
    button.setAttribute('aria-label',t(challenge.name)+(earned?copy('，已盖章',', stamp earned'):''));
    stamp.textContent=t(challenge.stamp);
    stamp.hidden=!earned;
  }
}

function render(withFocus) {
  const {screen,level,type,challenge}=route;
  document.body.dataset.screen=screen;
  for(const id of SCREEN_IDS) $(id).hidden=id!==screen;
  const art=screen==='chapters'?CHAPTER_ART[level]:screen==='practice'?'practice':['opponents','challenges'].includes(screen)?'workbench':'garden';
  $('scene').style.backgroundImage='url("menu-'+art+'.webp")';
  const title={home:'主菜单',chapters:'选关',settings:'设置',controls:'按键',practice:'练习',opponents:'兵种试战',challenges:'挑战簿'};
  document.title=t('绒仔')+' · '+t(title[screen]);
  drawCommands();
  let button,scroll=false;
  if(screen==='home'){mark(homeButtons,menuIndex);button=homeButtons[menuIndex];}
  if(screen==='chapters'){
    const i=cards.findIndex(c=>c.id===level),c=cards[i];
    mark(cardsUI,i);button=cardsUI[i];
    $('chapter-name').textContent=t(c.name);$('chapter-goal').textContent=t(c.mission);
  }
  if(screen==='settings'){
    settings.forEach((setting,i)=>{
      const {row,list}=settingRows[i], value=setting.choices.findIndex(([v])=>v===prefs[setting.key]);
      row.classList.toggle('active',settingIndex===i);
      mark(list,value);
      if(settingIndex===i) button=list[value];
    });
    if(settingIndex===settings.length)button=$('show-controls');
  }
  if(screen==='controls'){
    mark(deviceButtons,deviceIndex);button=deviceButtons[deviceIndex];
    $('bindings').replaceChildren(...bindings[deviceIndex].map(([key,action])=>{
      const row=document.createElement('div'),term=document.createElement('dt'),desc=document.createElement('dd');
      term.append(keyBadge(key));desc.textContent=t(action);row.append(term,desc);return row;
    }));
  }
  if(screen==='practice'){
    mark(practiceButtons,practiceIndex);button=practiceButtons[practiceIndex];
    $('practice-skill').textContent=t(practice[practiceIndex].title);
    $('practice-goal').textContent=t(practice[practiceIndex].hint);
  }
  model(screen==='opponents');
  if(screen==='opponents'){
    const i=ZOMBIE_ROSTER.findIndex(enemy=>enemy.id===type), attack=ATTACKS[type];
    $('enemy-attack').textContent=t(attack.name);
    $('enemy-tactic').textContent=t(attack.counter);
    mark(viewButtons,viewIndex);mark(opponentButtons,i);button=opponentButtons[i];scroll=true;
  }
  if(screen==='challenges'){
    const i=CHALLENGES.findIndex(spec=>spec.id===challenge);
    drawChallengeBook(challenge);mark(challengeButtons,i);button=challengeButtons[i];
  }
  if(withFocus)focus(button,scroll);
}

function leave(href){
  if(leaving)return;leaving=true;
  location.href=href;
}
function confirm(){
  if(leaving)return;
  switch(route.screen){
    case 'home': return chooseHome();
    case 'chapters': return leave(playHref(route.level,'chapters'));
    case 'settings': if(settingIndex===settings.length)return go('controls');return;
    case 'practice':
      if (practiceIndex===1) return go('opponents');
      return leave(playHref(practiceIndex===2?'weapon-range':'garden-wall','practice'));
    case 'opponents': return leave(playHref('training','practice',route.type));
    case 'challenges': return leave(challengePlayHref(route.challenge));
  }
}
function back(){
  if(leaving)return;
  switch(route.screen){
    case 'home': return;
    case 'controls':settingIndex=settings.length;return go('settings');
    case 'opponents':practiceIndex=1;return go('practice');
    default:menuIndex=Math.max(0,MENU.findIndex(([id])=>id===route.screen));return go('home');
  }
}
function move(axis,delta) {
  if(leaving)return;
  const vertical=axis==='y';
  switch(route.screen){
    case 'home': if(vertical)menuIndex=wrap(menuIndex+delta,MENU.length);break;
    case 'chapters': if(!vertical)return selectChapter(wrap(cards.findIndex(c=>c.id===route.level)+delta,cards.length),true);break;
    case 'settings':
      if(vertical)settingIndex=wrap(settingIndex+delta,settings.length+1);
      else if(settingIndex<settings.length){
        const setting=settings[settingIndex], {key,choices}=setting;
        setPreference(setting,choices[wrap(choices.findIndex(([v])=>v===prefs[key])+delta,choices.length)][0]);
      }
      break;
    case 'controls': if(!vertical)deviceIndex=wrap(deviceIndex+delta,bindings.length);break;
    case 'practice': if(vertical)practiceIndex=wrap(practiceIndex+delta,practice.length);break;
    case 'opponents':
      if(vertical)return selectEnemy(wrap(ZOMBIE_ROSTER.findIndex(e=>e.id===route.type)+delta,ZOMBIE_ROSTER.length));
      viewIndex=wrap(viewIndex+delta,views.length);
      break;
    case 'challenges': return selectChallenge(wrap(CHALLENGES.findIndex(spec=>spec.id===route.challenge)+delta,CHALLENGES.length));
  }
  render(true);
}

$('start').onclick=confirm;$('practice-start').onclick=confirm;$('show-controls').onclick=()=>{settingIndex=settings.length;go('controls');};
$('model-action').onclick=confirm;$('challenge-start').onclick=confirm;$('go-back').onclick=back;
addEventListener('popstate',()=>{
  route=readMenuRoute(new URLSearchParams(location.search));
  leaving=false;
  syncPreferences();
  render(true);
});
addEventListener('pageshow',event=>{
  if(event.persisted){leaving=false;syncPreferences();render(true);}
});
addEventListener('storage',()=>{if(route.screen==='challenges')render(false);});
const directions={arrowup:['y',-1],w:['y',-1],arrowdown:['y',1],s:['y',1],arrowleft:['x',-1],a:['x',-1],arrowright:['x',1],d:['x',1]};
addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const key=event.key.toLowerCase();
  if (directions[key]||['escape','enter','tab'].includes(key)) setInput(KEYBOARD);
  if(directions[key]){event.preventDefault();move(...directions[key]);}
  if(key==='escape'){event.preventDefault();if(!event.repeat)back();}
  if(key==='enter'){
    event.preventDefault();
    if(event.repeat)return;
    const active=document.activeElement;
    if(active===$('go-back'))back();
    else if(active?.tagName==='BUTTON' && (route.screen==='home' || route.screen==='settings' ||
      active.closest('#views,#devices') || active.getAttribute('aria-pressed')==='false')) active.click();
    else confirm();
  }
});
const pad=createGamepad();let lastDirection='',repeatAt=0;
function poll(now){
  requestAnimationFrame(poll);pad.poll();
  if(!pad.connected||leaving){lastDirection='';return;}
  if(pad.pressed('cross')){setInput(GAMEPAD);confirm();return;}
  if(pad.pressed('circle')){setInput(GAMEPAD);back();return;}
  const dir=pad.held('up')||pad.axes.y<-.55?'arrowup':pad.held('down')||pad.axes.y>.55?'arrowdown'
   :pad.held('left')||pad.axes.x<-.55?'arrowleft':pad.held('right')||pad.axes.x>.55?'arrowright':'';
  if(dir&&(dir!==lastDirection||now>=repeatAt)){setInput(GAMEPAD);repeatAt=now+(dir===lastDirection?130:360);move(...directions[dir]);}
  lastDirection=dir;
}
render(true);requestAnimationFrame(poll);
