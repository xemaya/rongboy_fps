const MOTION_KEYS = new Set(['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown']);
const HELD_KEYS = new Set([...MOTION_KEYS, ' ', 'e']);

// One held key can supply repeat events for the whole chord. Some OSes only
// repeat the newest key, so expiring each direction independently breaks diagonals.
const FIRST_REPEAT_GRACE_MS = 3500;
const REPEAT_GRACE_MS = 900;

const keyOf = event => event.key.toLowerCase();
const codeOf = event => event.code === 'Unidentified' ? '' : event.code;

export function createKeyboardInput(now = () => performance.now()) {
  const held = new Map();
  let motionUntil = Infinity;

  function has(action) {
    for (const value of held.values()) if (value === action) return true;
    return false;
  }

  function match(event) {
    const action = keyOf(event), code = codeOf(event);
    const physical = code || action;
    if (held.has(physical)) return physical;
    // Use the logical key when one side of the event pair lacks a code.
    if (code) return held.has(action) ? action : null;
    for (const [id, value] of held) if (value === action) return id;
    return null;
  }

  function press(event) {
    if (event.repeat) {
      if (match(event)) motionUntil = now() + REPEAT_GRACE_MS;
      return false;
    }
    const action = keyOf(event), physical = codeOf(event) || action;
    motionUntil = now() + FIRST_REPEAT_GRACE_MS;
    if (!HELD_KEYS.has(action) || held.has(physical)) return false;
    const alreadyHeld = has(action);
    held.set(physical, action);
    return !alreadyHeld;
  }

  function release(event) {
    const physical = match(event);
    if (physical === null) return null;
    const released = held.get(physical);
    held.delete(physical);
    motionUntil = now() + FIRST_REPEAT_GRACE_MS;
    return has(released) ? null : released;
  }

  function forget(action) {
    for (const [physical, value] of held) if (value === action) held.delete(physical);
  }

  function expireMotion() {
    if (now() < motionUntil) return;
    for (const [physical, action] of held) if (MOTION_KEYS.has(action)) held.delete(physical);
    motionUntil = Infinity;
  }

  function clear() {
    held.clear();
    motionUntil = Infinity;
  }

  return { has, press, release, forget, expireMotion, clear };
}
