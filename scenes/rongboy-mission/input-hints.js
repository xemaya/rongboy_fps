import { t } from './language.js';
export const KEYBOARD = {
  vertical: ['↑', '↓'], horizontal: ['←', '→'], move: ['WASD'], look: ['方向键'],
  fire: '空格', switch: 'Q', throw: 'E', grenade:'G', exchange: 'F', reload: 'R', potion: 'H',
  pause: 'Esc', confirm: 'Enter', jump: 'Shift', back: 'Esc',
};
export const GAMEPAD = {
  vertical: ['↑', '↓'], horizontal: ['←', '→'], move: ['左摇杆'], look: ['右摇杆'],
  fire: 'R2', switch: 'L1', throw: 'L2', grenade:'十字↓', exchange: '□', reload: 'R1', potion: '△',
  pause: 'Options', confirm: '✕', jump: '✕', back: '○',
};

export function keyBadge(key) {
  const badge = document.createElement('kbd');
  badge.className = 'ui-key';
  if (key === '✕' || key === '○' || key === '□' || key === '△') badge.dataset.shape = 'pad';
  badge.textContent = t(key);
  return badge;
}

export function drawHints(host, commands) {
  host.replaceChildren(...commands.map(([keys, action]) => {
    const command = document.createElement('span'), badges = document.createElement('span');
    command.className = 'ui-command';
    badges.className = 'ui-keys';
    badges.append(...[keys].flat().map(keyBadge));
    command.append(badges, t(action));
    return command;
  }));
}

// The pause sheet puts names and keys in separate columns. Use individual
// keyboard keys or short names on the fixed-size caps.
export function drawPauseBindings(host, commands) {
  const groups = {
    WASD: ['W','A','S','D'],
    方向键: ['←','↑','↓','→'],
    左摇杆: ['LS'],
    右摇杆: ['RS'],
    '十字↓': ['D↓'],
    鼠标左键: ['左键'],
  };
  host.replaceChildren(...commands.map(([keys, action]) => {
    const row = document.createElement('div');
    row.className = 'pause-input-row';
    const label = document.createElement('dt');
    label.textContent = t(action);
    const caps = document.createElement('dd');
    caps.className = 'pause-keyset';
    const names = [keys].flat();
    caps.setAttribute('aria-label',names.map(t).join(' / '));
    for (const name of names) {
      for (const shown of groups[name] || [name]) caps.append(keyBadge(shown));
    }
    row.append(label,caps);
    return row;
  }));
}

export function labelAction(button, key, label) {
  button.replaceChildren(keyBadge(key), t(label));
  button.setAttribute('aria-label', t(label));
}
