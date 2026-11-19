export const KEYBOARD = {
  vertical: ['↑', '↓'], horizontal: ['←', '→'], move: ['WASD'], look: ['方向键'],
  fire: '空格', switch: 'Q', throw: 'E', grenade:'G', exchange: 'F', reload: 'R',
  pause: 'Esc', confirm: 'Enter', jump: 'Shift', back: 'Esc',
};
export const GAMEPAD = {
  vertical: ['↑', '↓'], horizontal: ['←', '→'], move: ['左摇杆'], look: ['右摇杆'],
  fire: 'R2', switch: 'L1', throw: 'L2', grenade:'十字↓', exchange: '□', reload: 'R1',
  pause: 'Options', confirm: '✕', jump: '✕', back: '○',
};

export function keyBadge(key) {
  const badge = document.createElement('kbd');
  badge.className = 'ui-key';
  if (key === '✕' || key === '○' || key === '□') badge.dataset.shape = 'pad';
  badge.textContent = key;
  return badge;
}

export function drawHints(host, commands) {
  host.replaceChildren(...commands.map(([keys, action]) => {
    const command = document.createElement('span'), badges = document.createElement('span');
    command.className = 'ui-command';
    badges.className = 'ui-keys';
    badges.append(...[keys].flat().map(keyBadge));
    command.append(badges, action);
    return command;
  }));
}

export function labelAction(button, key, label) {
  button.replaceChildren(keyBadge(key), label);
  button.setAttribute('aria-label', label);
}
