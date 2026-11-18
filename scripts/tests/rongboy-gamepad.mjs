// 手柄读数的检查：不接真手柄，用假的 Gamepad 对象喂给 createGamepad。
//   node scripts/tests/rongboy-gamepad.mjs
// 查的是：PS5 的标准按钮编号、按下/松开的沿、扳机回差、摇杆死区和归一化、多个手柄、断开时把所有按着的键松开。
import assert from 'node:assert/strict';
import { createGamepad, BUTTONS } from '../../scenes/rongboy-mission/gamepad.js';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }

// 一个最小的 DualSense 读数：buttons 可以给按钮对象，axes 可以给四个数。
function padState({ buttons = {}, axes = [0, 0, 0, 0], id = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', mapping = 'standard', connected = true } = {}) {
  return {
    id, mapping, connected,
    axes,
    buttons: Array.from({ length: 18 }, (_, i) => {
      const v = buttons[i] ?? 0;
      return typeof v === 'number' ? { pressed: v >= 0.5, value: v } : v;
    }),
  };
}
const hold = (pad, index, value = 1) => { pad.buttons[index] = { pressed: value >= 0.5, value }; };
const release = (pad, index) => { pad.buttons[index] = { pressed: false, value: 0 }; };

test('PS5 的标准映射：✕ ○ □ △ L1 R1 L2 R2 Options 都在约定的编号上', () => {
  assert.deepEqual(BUTTONS, {
    cross: 0, circle: 1, square: 2, triangle: 3,
    l1: 4, r1: 5, l2: 6, r2: 7,
    create: 8, options: 9, l3: 10, r3: 11,
    up: 12, down: 13, left: 14, right: 15,
    ps: 16, touchpad: 17,
  });
});

test('按键沿：按住只算一次按下，松手那一帧算松开', () => {
  const pad = padState();
  const g = createGamepad({ getPads: () => [pad] });
  g.poll();
  assert.equal(g.connected, true);
  assert.equal(g.pressed('cross'), false);

  hold(pad, BUTTONS.cross);
  g.poll();
  assert.equal(g.pressed('cross'), true);          // 按下的那一帧
  assert.equal(g.held('cross'), true);
  assert.equal(g.anyPressed, true);

  g.poll();
  assert.equal(g.pressed('cross'), false);         // 第二帧不再重复
  assert.equal(g.held('cross'), true);

  release(pad, BUTTONS.cross);
  g.poll();
  assert.equal(g.released('cross'), true);
  assert.equal(g.held('cross'), false);
  assert.equal(g.pressed('cross'), false);
});

test('扳机有回差：推到 0.35 才按下，松到 0.22 才松开', () => {
  const pad = padState({ buttons: { [BUTTONS.r2]: 0.3 } });
  const g = createGamepad({ getPads: () => [pad] });
  g.poll();
  assert.equal(g.held('r2'), false, '0.30 还在死区里');

  hold(pad, BUTTONS.r2, 0.36);
  g.poll();
  assert.equal(g.pressed('r2'), true, '0.36 按下');
  assert.equal(g.triggers.r2, 0.36);

  hold(pad, BUTTONS.r2, 0.30);
  g.poll();
  assert.equal(g.held('r2'), true, '0.30 还在回差里，不松');
  assert.equal(g.released('r2'), false);

  hold(pad, BUTTONS.r2, 0.20);
  g.poll();
  assert.equal(g.released('r2'), true, '0.20 松手');
});

test('摇杆：0.16 死区以内不动，推满到 1，斜着推也是单位圆', () => {
  const pad = padState({ axes: [0.10, -0.12, 1, 0] });
  const g = createGamepad({ getPads: () => [pad] });
  g.poll();
  assert.deepEqual(g.axes, { x: 0, y: 0, lookX: 1, lookY: 0 }, '左摇杆在死区里；右摇杆推满');

  pad.axes = [0.8, 0.6, 0, -0.58];
  g.poll();
  assert.ok(Math.abs(Math.hypot(g.axes.x, g.axes.y) - 1) < 1e-9, '斜推归一化到单位圆');
  assert.deepEqual([g.axes.x, g.axes.y], [0.8, 0.6]);
  assert.ok(g.axes.lookY < 0, '右摇杆向上是负数');
});

test('多个手柄取第一个；没有手柄时 connected=false', () => {
  const first = padState({ id: 'first' }), second = padState({ id: 'second' });
  const g = createGamepad({ getPads: () => [null, second, first] });
  g.poll();
  assert.equal(g.id, 'second');
  assert.equal(g.connected, true);

  const empty = createGamepad({ getPads: () => [] });
  empty.poll();
  assert.equal(empty.connected, false);
  assert.deepEqual(empty.axes, { x: 0, y: 0, lookX: 0, lookY: 0 });
});

test('手柄拔掉的那一帧，所有按着的键都算松开（不会卡住开火）', () => {
  const pad = padState();
  let pads = [pad];
  const g = createGamepad({ getPads: () => pads });
  hold(pad, BUTTONS.r2, 1); hold(pad, BUTTONS.cross);
  g.poll();
  assert.equal(g.held('r2'), true);

  pads = [];
  g.poll();
  assert.equal(g.connected, false);
  assert.equal(g.released('r2'), true);
  assert.equal(g.released('cross'), true);
  assert.equal(g.held('r2'), false);
});

console.log(`\n${checks} 项手柄检查通过`);
