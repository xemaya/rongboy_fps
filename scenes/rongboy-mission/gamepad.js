// 手柄：PS5 的 DualSense 在浏览器里走标准映射，按钮编号就是下面这一套（Xbox / Switch 手柄的位置也一样）。
// 这个文件不碰画面和规则：它只把 navigator.getGamepads() 的原始读数整理成
//   poll() 之后这一帧按下了什么、松开了什么、两根摇杆推了多少。
// 没有手柄、浏览器不支持、或者手柄断开了，poll() 之后 connected 是 false，调用方继续用键盘就行。
//
// 用法（每帧调一次 poll，然后读同一帧的结果）：
//   const pad = createGamepad();
//   function frame() { pad.poll(); if (pad.pressed('cross')) …; if (pad.held('r2')) …; }
// 按键的按下/松开是沿触发：按住不放只会在第一帧算 pressed，松手那一帧算 released。
// L2 / R2 是扳机，带一点回差（推到 0.35 算按下，松到 0.22 才算松开），手感不会在临界点上抖。

export const BUTTONS = {
  cross: 0, circle: 1, square: 2, triangle: 3,
  l1: 4, r1: 5, l2: 6, r2: 7,
  create: 8, options: 9, l3: 10, r3: 11,
  up: 12, down: 13, left: 14, right: 15,
  ps: 16, touchpad: 17,
};

const TRIGGERS = new Set(['l2', 'r2']);

// 摇杆的死区：中心附近总有一点漂移，0.16 以内当作没推。推满时回到 1，中间是线性的
// （平滑曲线交给调用方按用途自己加，走路和转视角要的手感不一样）。
function deadstick(x, y, deadzone) {
  const m = Math.hypot(x, y);
  if (m <= deadzone) return [0, 0];
  const k = (m - deadzone) / (1 - deadzone) / m;
  return [x * k, y * k];
}

export function createGamepad({ getPads, deadzone = 0.16, press = 0.35, release = 0.22 } = {}) {
  const read = getPads || (() => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []));
  const state = { connected: false, id: '', mapping: '', axes: { x: 0, y: 0, lookX: 0, lookY: 0 }, triggers: { l2: 0, r2: 0 }, buttons: {} };
  let held = new Set(), down = new Set(), up = new Set();

  function poll() {
    down = new Set(); up = new Set();
    let pad = null;
    try {
      for (const p of read() || []) if (p && p.connected !== false) { pad = p; break; }
    } catch { pad = null; }

    const current = new Set(), triggers = { l2: 0, r2: 0 };
    let axes = { x: 0, y: 0, lookX: 0, lookY: 0 };
    if (pad) {
      for (const [name, index] of Object.entries(BUTTONS)) {
        const button = pad.buttons?.[index];
        const value = typeof button === 'number' ? button : button?.value ?? (button?.pressed ? 1 : 0);
        const on = TRIGGERS.has(name) ? (held.has(name) ? value >= release : value >= press) : !!(button?.pressed ?? value >= 0.5);
        if (on) current.add(name);
        if (TRIGGERS.has(name)) triggers[name] = value;
      }
      const [x, y] = deadstick(pad.axes?.[0] || 0, pad.axes?.[1] || 0, deadzone);
      const [lookX, lookY] = deadstick(pad.axes?.[2] || 0, pad.axes?.[3] || 0, deadzone);
      axes = { x, y, lookX, lookY };
      state.connected = true; state.id = pad.id || '手柄'; state.mapping = pad.mapping || '';
    } else {
      state.connected = false; state.id = ''; state.mapping = '';
    }

    for (const name of current) if (!held.has(name)) down.add(name);
    for (const name of held) if (!current.has(name)) up.add(name);
    held = current;
    state.axes = axes; state.triggers = triggers;
    state.buttons = Object.fromEntries([...current].map(name => [name, true]));
    return state;
  }

  return {
    poll,
    get state() { return state; },
    get connected() { return state.connected; },
    get id() { return state.id; },
    get mapping() { return state.mapping; },
    get axes() { return state.axes; },
    get triggers() { return state.triggers; },
    held: name => held.has(name),
    pressed: name => down.has(name),
    released: name => up.has(name),
    get anyPressed() { return down.size > 0; },
    get anyReleased() { return up.size > 0; },
  };
}
