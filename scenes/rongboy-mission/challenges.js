export const CHALLENGES = [
  {
    id: 'shield-bank', name: '借墙打背', stamp: '巧', goal: '借墙反弹，打中持盾者的后背',
    hint: '瞄持盾者右侧的青色墙板，让毛球绕过盾面。',
    unit: '盾后命中', target: 1, seconds: 45,
  },
  {
    id: 'static-followup', name: '静电接力', stamp: '连', goal: '一张飞网定住两只，切手枪击倒这两只',
    hint: '用静电枪瞄准两只之间，让飞网一起罩住它们。趁两只还定着，切手枪各补一发。',
    unit: '接力击倒', target: 2, seconds: 40,
  },
  {
    id: 'dodge-arrows', name: '三箭全躲', stamp: '闪', goal: '无伤躲过弓手三支箭',
    hint: '瞄准线变红才换方向。让三支箭都落空，留着弓手继续出招。',
    unit: '躲过的箭', target: 3, seconds: 40,
  },
];

export function findChallenge(id) {
  return CHALLENGES.find(challenge => challenge.id === id);
}

export function readPlayChallenge(query) {
  if (query.get('level') === 'challenge') return findChallenge(query.get('challenge')) ?? CHALLENGES[0];
  return null;
}

const stampKey = id => 'rongboy.challenge-stamp.' + id;

export function hasStamp(id) {
  try { return localStorage.getItem(stampKey(id)) === '1'; }
  catch { return false; }
}

export function saveStamp(id) {
  try { localStorage.setItem(stampKey(id), '1'); return true; }
  catch { return false; }
}
