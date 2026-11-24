// 能被急冻枪定住的机关（门栓、阀门、滑轨上的靶子……）：平时自己在动，急冻枪打中定住几秒；
// 定住的时候（有的不用定住）再挨一发，就算办成了。办成以后停在当时的位置，不再动。
// 不依赖 DOM，也不认识具体是哪一关的哪样东西：位置、挨打的范围、办成以后发生什么，都由用它的关卡定。
//
//   const m = makeMech();
//   每一步：if (stepMech(m, dt, time, 速度)) → 刚化开
//   位置：  基准 + mechSlide(m, 幅度)      （沿滑轨来回滑；不滑的机关不用管）
//   挨打：  hitMech(m, time, 是不是急冻枪, 选项) → 'frozen' | 'done' | 'block' | null
//   状态：  mechState(m, time) → 'moving' | 'frozen' | 'done'

export const makeMech = (done = false, phase = 0) => ({ done, phase, frozenUntil: 0, at: null });

export const mechState = (m, time) => m.done ? 'done' : m.frozenUntil > time ? 'frozen' : 'moving';

// 没定住就接着动。返回 true：这一步刚化开（定住的时间到了，还没办成）
export function stepMech(m, dt, time, speed = 0) {
  if (m.done || m.frozenUntil > time) return false;
  const thawed = m.frozenUntil > 0;
  if (thawed) { m.frozenUntil = 0; m.at = null; }
  m.phase += dt * speed;
  return thawed;
}

// 沿滑轨离基准多远（-amp 到 amp）。定住、办成以后是当时停下的地方
export const mechSlide = (m, amp) => m.at ?? Math.sin(m.phase) * amp;

// 挨了一发。选项：
//   hold      定住几秒
//   amp       滑动的幅度（记下停在哪要用）
//   other     别的枪打中算不算数：'frozen' 要先定住（没定住的弹开，返回 'block'）| 'always' 什么时候都算 | 'never' 永远弹开（要靠别的办法办成，比如按键）
//   iceTwice  定住以后急冻枪再补一发算不算办成（坐在车上来不及换枪的靶子用）
export function hitMech(m, time, ice, { hold = 3.5, amp = 0, other = 'frozen', iceTwice = false } = {}) {
  if (m.done) return null;
  const frozen = m.frozenUntil > time, stop = () => { m.at = m.at ?? Math.sin(m.phase) * amp; };
  if (ice && !(frozen && iceTwice)) { stop(); m.frozenUntil = time + hold; return 'frozen'; }   // 已经定住的再冻一发：时间重新算
  if (!ice && (other === 'never' || (other === 'frozen' && !frozen))) return 'block';
  stop(); m.done = true;
  return 'done';
}
