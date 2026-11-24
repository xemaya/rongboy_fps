const KEY = 'rongboy.preferences';
export const LANGUAGE_CHOICES = ['auto','zh-CN','en'];
const DEFAULTS = {sound:true, music:true, quality:'auto', motion:'system', language:'auto'};

export function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (value && typeof value === 'object') return {
      sound: typeof value.sound === 'boolean' ? value.sound : DEFAULTS.sound,
      music: typeof value.music === 'boolean' ? value.music : DEFAULTS.music,
      quality: ['auto','high','low'].includes(value.quality) ? value.quality : DEFAULTS.quality,
      motion: ['system','reduced'].includes(value.motion) ? value.motion : DEFAULTS.motion,
      language: LANGUAGE_CHOICES.includes(value.language) ? value.language : DEFAULTS.language,
    };
  } catch {} // Storage can be disabled in a private embedded browser.
  return {...DEFAULTS};
}

export function writePreferences(preferences) {
  try { localStorage.setItem(KEY,JSON.stringify(preferences)); return true; }
  catch { return false; }
}
