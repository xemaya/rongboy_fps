// 地图表。网址 ?level=<id> 选图，开始画面按 1、2… 也能换。
// LEVELS：能用网址打开的全部地图；ORDER：游戏里列出来的（新图先不进 ORDER，有人看过、玩过再进）。
// 这个文件由 node scripts/map.mjs register <id> [--listed] 改写，也可以手改。
import house from './house.js';
import museum from './museum.js';
import school from './school.js';
import cottage from './cottage.js';
import amusementTour from './amusement-tour.js';

export const LEVELS = { house, museum, school, cottage, 'amusement-tour':amusementTour };
export const ORDER = ['house', 'museum', 'school', 'cottage'];
// EXTRAS：也列在选关里、排在正式关卡后面，但不是打僵尸的关（没有敌人、没有武器），所以不进 ORDER。
export const EXTRAS = ['amusement-tour'];
