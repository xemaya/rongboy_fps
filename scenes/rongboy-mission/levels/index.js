// 地图表。网址 ?level=<id> 选图，开始画面按 1、2… 也能换。
// LEVELS：能用网址打开的全部地图；ORDER：游戏里列出来的（新图先不进 ORDER，有人看过、玩过再进）。
// 这个文件由 node scripts/map.mjs register <id> [--listed] 改写，也可以手改。
import house from './house.js';
import museum from './museum.js';
import school from './school.js';
import cottage from './cottage.js';
import amusement from './amusement.js';
import amusementTour from './amusement-tour.js';

// 'amusement-whitebox' 是白盒阶段的旧网址，留着指向同一关
export const LEVELS = { house, museum, school, cottage, amusement, 'amusement-whitebox': amusement, 'amusement-tour': amusementTour };
export const ORDER = ['house', 'museum', 'school', 'cottage'];
// EXTRAS：也列在选关里、排在四张正式地图后面，但不走"按房间数僵尸"的那套检查，所以不进 ORDER。
// amusement 是布偶游乐场（四段加小丑首领，规则在 amusement.js）；amusement-tour 是没有敌人的游园。
export const EXTRAS = ['amusement', 'amusement-tour'];
