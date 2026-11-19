const KEY = 'rongboy.preferences';
const DEFAULTS = {sound:true, quality:'auto', motion:'system'};

export function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (value && typeof value === 'object') return {
      sound: typeof value.sound === 'boolean' ? value.sound : DEFAULTS.sound,
      quality: ['auto','high','low'].includes(value.quality) ? value.quality : DEFAULTS.quality,
      motion: ['system','reduced'].includes(value.motion) ? value.motion : DEFAULTS.motion,
    };
  } catch {} // Storage can be disabled in a private embedded browser.
  return {...DEFAULTS};
}

export function writePreferences(preferences) {
  try { localStorage.setItem(KEY,JSON.stringify(preferences)); } catch {}
}
