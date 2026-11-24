// 地图表。网址 ?level=<id> 选图，开始画面按 1、2… 也能换。
// LEVELS：能用网址打开的全部地图；ORDER：游戏里列出来的（新图先不进 ORDER，有人看过、玩过再进）。
// 这个文件由 node scripts/map.mjs register <id> [--listed] 改写，也可以手改。
import house from './house.js';
import museum from './museum.js';
import school from './school.js';
import cottage from './cottage.js';
import amusement from './amusement.js';

// 'amusement-whitebox'、'amusement-tour' 是合并之前的旧网址（白盒、直道那张"布偶游乐场"、没有敌人的游园），都指向现在这一关
export const LEVELS = { house, museum, school, cottage, amusement, 'amusement-whitebox': amusement, 'amusement-tour': amusement };
export const ORDER = ['house', 'museum', 'school', 'cottage'];
// EXTRAS：也列在选关里、排在四张正式地图后面，但不走"按房间数僵尸"的那套检查，所以不进 ORDER。
// amusement 是布偶游乐园（十站连成一关，最后打小丑；规则在 amusement.js）。
export const EXTRAS = ['amusement'];
