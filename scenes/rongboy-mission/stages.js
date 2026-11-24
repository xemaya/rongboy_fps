// 一关分成几段，段和段之间的路上横一道门：这一段的事办完门才开，人走过去就进了下一段；倒下了从这一段的门口重来。
// 这里只管门和"现在在第几段"，不认识具体的关卡：每段要办什么事（ready）、进了新的一段叫醒谁，由用它的关卡定。不依赖 DOM。
//
// 门：{ x, z, tx, tz, width }。(tx, tz) 是单位向量，指向下一段；width 是门洞多宽。第 i 道门隔开第 i 段和第 i+1 段。
// 状态（并在关卡自己的状态里）：{ zone, opened: [开门的时刻或 null, ...], lit: [这一段办完了没有, ...] }

export const GATE_LIFT_SECONDS = .62;   // 门从开始开到人能过，要这么久
const GATE_STOP = .3;                   // 门关着的时候人被挡在门前这么远

// 小径（一串 { x, z, width } 的点，width 是半宽）上离 (x, z) 最近的那一点和小径在那里的走向：门横在路上
export function gateOnPath(path, x, z) {
  let best = 0, near = Infinity;
  path.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < near) { near = d; best = i; } });
  const p = path[best], a = path[Math.max(0, best - 3)], b = path[Math.min(path.length - 1, best + 3)], len = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: p.x, z: p.z, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len, width: p.width * 2 };
}

// zone：从第几段开始。前面几段的门开着、算办完了
export const makeStages = (gates, zone = 0) => ({
  zone,
  opened: gates.map((_, i) => i < zone ? -GATE_LIFT_SECONDS : null),
  lit: Array.from({ length: gates.length + 1 }, (_, i) => i < zone),
});

export const gatePassable = (st, i, time) => st.opened[i] !== null && time >= st.opened[i] + GATE_LIFT_SECONDS;

// 从第 zone 段重来时人站在哪：上一道门里面一步（第 0 段没有上一道门，返回 null：站在关卡的出发点）
export function stageStart(gates, zone, step = 1.3) {
  const gate = gates[zone - 1];
  return gate ? { x: gate.x + gate.tx * step, z: gate.z + gate.tz * step } : null;
}

// (x, z) 在第 i 道门的哪一边：负数是门前（这一段），正数是门后（下一段）
export const pastGate = (gate, x, z) => (x - gate.x) * gate.tx + (z - gate.z) * gate.tz;

function gateApproach(gate, x, z) {
  const along = pastGate(gate, x, z), side = Math.abs((z - gate.z) * gate.tx - (x - gate.x) * gate.tz);
  return along <= 2.5 && side <= gate.width / 2 + 1.5 ? along : -Infinity;
}

// 同一套门槛也用于移动和推挤之后的落点。
export function stageAllows(st, gates, time, x, z) {
  const gate = gates[st.zone];
  return !gate || gatePassable(st, st.zone, time) || gateApproach(gate, x, z) <= -GATE_STOP + 1e-8;
}

// 每一步调一次。ready：这一段的事办完了没有；carried：人这会儿不归自己走（坐在车上从门的上空飞过去不算过门）。
// 门关着就把人挡回门前（直接改 player 的 x、z）。返回这一步发生了什么：'open'（门刚开）| 'enter'（人刚进下一段）| null
export function advanceStages(st, gates, player, time, { ready, carried = false }) {
  const gate = gates[st.zone];
  if (!gate) return null;
  if (st.opened[st.zone] === null && ready) { st.opened[st.zone] = time; st.lit[st.zone] = true; return 'open'; }
  if (carried) return null;
  const along = gateApproach(gate, player.x, player.z);
  if (along < -GATE_STOP) return null;
  if (!gatePassable(st, st.zone, time)) { player.x -= gate.tx * (along + GATE_STOP); player.z -= gate.tz * (along + GATE_STOP); return null; }
  if (along < .25) return null;
  st.zone++;
  return 'enter';
}
