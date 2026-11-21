import assert from 'node:assert/strict';
import { createKeyboardInput } from '../../scenes/rongboy-mission/keyboard-input.js';

let time = 0;
const keys = createKeyboardInput(() => time);
const event = (key, code, repeat = false) => ({ key, code, repeat });
const forward = event('w','KeyW');
const right = event('d','KeyD');

assert.ok(keys.press(forward));
assert.ok(keys.press(right));
assert.equal(keys.release(event('ω','KeyW')),'w','release uses the original physical key after a layout change');
assert.ok(!keys.has('w') && keys.has('d'));
assert.equal(keys.release(event('D','Unidentified')),'d','fall back to the key name when the release lacks code');
assert.ok(!keys.has('d'));
keys.press(event('w',''));
assert.equal(keys.release(forward),'w','also recover when the press lacks code');

keys.press(forward);
assert.equal(keys.press(event('w','KeyZ')),false,'a second physical key for an active action does not fire it twice');
assert.equal(keys.release(forward),null);
assert.ok(keys.has('w'),'the other physical binding is still held');
assert.equal(keys.release(event('w','KeyZ')),'w');

keys.press(forward);
time = 2300;
keys.expireMotion();
assert.ok(keys.has('w'),'allow the OS to delay the first repeat');
time = 3501;
keys.expireMotion();
assert.ok(!keys.has('w'),'one lost release without repeats cannot leave movement on indefinitely');
assert.equal(keys.press(event('w','KeyW',true)),false);
assert.ok(!keys.has('w'),'a repeat cannot revive an expired press');

keys.press(forward);
keys.press(right);
for (let i = 0; i < 12; i++) {
  time += 350;
  assert.equal(keys.press(event('d','KeyD',true)),false);
  keys.expireMotion();
  assert.ok(keys.has('w') && keys.has('d'),'one repeated key keeps a deliberate diagonal alive');
}
assert.equal(keys.release(right),'d');
time += 1400;
keys.expireMotion();
assert.ok(keys.has('w'),'releasing the repeating key gives the remaining direction time to repeat');
keys.press(event('w','KeyW',true));
time += 901;
keys.expireMotion();
assert.ok(!keys.has('w'),'movement stops when the repeat stream stops without a release');

keys.press(forward);
keys.clear();
assert.equal(keys.press(event('w','KeyW',true)),false);
assert.ok(!keys.has('w'),'focus loss requires a fresh press');
assert.ok(keys.press(forward));
assert.ok(keys.press(event(' ','Space')));
assert.equal(keys.press(event(' ','Space',true)),false,'repeat does not restart a shot');
keys.forget(' ');
assert.equal(keys.release(event(' ','Space')),null,'weapon switching cancels the old keyboard shot');

console.log('PASS physical releases, repeat expiry, held diagonals, and input reset');
