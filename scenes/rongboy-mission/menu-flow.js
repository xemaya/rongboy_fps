import { urlLanguage } from './language.js';
import { crazyGames, firstRound, playPage } from './platform.js';
import { ZOMBIE_ROSTER } from '../../library/games/rongboy-roster.js';
import { CHALLENGES, findChallenge } from './challenges.js';

export const MENU = [
  ['chapters',crazyGames ? '开始游戏' : '选关'], ['settings','设置'], ['practice','练习'], ['challenges','挑战簿'],
];
export const CHAPTERS = [...(crazyGames ? [firstRound] : []),'house','museum','school','cottage','amusement-tour'];
export const CHAPTER_ART = {[firstRound]:'practice',house:'garden',museum:'museum',school:'school',cottage:'cottage','amusement-tour':'park'};
export const SCREEN_IDS = new Set(['home','chapters','settings','controls','practice','opponents','challenges']);
const kinds = ZOMBIE_ROSTER.map(enemy => enemy.id);

export function readMenuRoute(query) {
  const level = query.get('level');
  const explicit = query.get('screen');
  const type = query.get('type');
  const oldGallery = explicit === 'codex' || explicit === 'enemy';
  const screen = SCREEN_IDS.has(explicit) ? explicit : oldGallery || level === 'training' ? 'opponents' : CHAPTERS.includes(level) ? 'chapters' : 'home';
  return { screen, level: CHAPTERS.includes(level) ? level : CHAPTERS[0],
    type: kinds.includes(type) ? type : kinds[0],
    challenge: findChallenge(query.get('challenge'))?.id ?? CHALLENGES[0].id };
}

export function pageHref(path, query, locale = urlLanguage()) {
  if (locale) query.set('lang',locale);
  return query.size ? path + '?' + query : path;
}

export function menuHref(screen, level, type, focus, locale) {
  const q = new URLSearchParams();
  if (screen !== 'home') q.set('screen',screen);
  if (screen === 'chapters') q.set('level',level);
  if (screen === 'opponents' && kinds.includes(type)) q.set('type',type);
  if (focus) q.set('focus',focus);
  return pageHref('rongboy-mission.html',q,locale);
}

export const modelPack = type => crazyGames ? 'zombie-roster.glb' : kinds.indexOf(type) < 3 ? 'walker-trio.glb'
  : kinds.indexOf(type) < 6 ? 'second-trio.glb' : 'final-trio.glb';

export function playHref(level, source, type) {
  const q = new URLSearchParams({level,from:source});
  if (type && kinds.includes(type)) q.set('type',type);
  return pageHref(playPage,q);
}

export function challengeBookHref(id) {
  return pageHref('rongboy-mission.html',new URLSearchParams({screen:'challenges',challenge:id}));
}

export function challengePlayHref(id) {
  return pageHref(playPage,new URLSearchParams({level:'challenge',challenge:id}));
}

export function exitPlayHref(query, level) {
  if (level === 'challenge') return challengeBookHref(findChallenge(query.get('challenge'))?.id ?? CHALLENGES[0].id);
  if (level === 'training') return menuHref('opponents', null, query.get('type'));
  if (level === firstRound && query.get('from') !== 'chapters') return menuHref('home');
  if (level === 'garden-wall') return menuHref('practice');
  if (level === 'weapon-range') return menuHref('practice', null, null, 'weapons');
  return menuHref('chapters',level);
}
