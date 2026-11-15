import { State, ClickResult, ClickEvent, Zombie, ZombieType, BuffId, LegalJump, Pos, DIRS_8 } from './types';
import { legalJumps, DIRS_ORTHO, runZombieAI, deathCheck, winCheck } from './rules';
import { inBounds, zombieAt, nextZombieId } from './grid-utils';
import { applyMilestones, clearMilestones } from './milestones';
import { getBuff } from './registries/buffs';
import { getZombie } from './registries/zombies';

export function createInitialState(
  rows: number,
  cols: number,
  scout: Pos,
  zombies: Omit<Zombie, 'id'>[],
  buff: BuffId | null
): State {
  // H3: id 走 max+1。空起始 → 第 1 个拿 1。
  let nextId = 1;
  return {
    rows, cols, phase: 'playing',
    scout: { ...scout },
    zombies: zombies.map(z => ({
      ...z,
      id: nextId++,
      hpRemaining: z.hpRemaining ?? getZombie(z.type).initialHp,
    })),
    kills: 0, combo: 0, chainActive: false,
    surgeActive: false, quakeArmed: false, apexUsesRemaining: 0, freeMoveMode: false,
    buff,
    legalJumps: [],
    legalFreeMoves: [],
    legalWalks: [],
    // GAME-006 新字段
    lastTurnKills: 0,
    buffUsesRemaining: 1,          // one-shot buff 全局 1 次/局(lucky-charm / time-rewind)
    initialScoutPos: { ...scout }, // lucky-charm 复位锚点
    // UX-025 (F13+F14): HUD step counter — reset per level
    stepsThisLevel: 0,
    // ENG-021: 回合计数(turns)— par/star 用(DEC-081)。每次 endTurn 处理一个回合 +1
    // (walk 自动 endTurn 也算一回合 · pass 也算)。≠ stepsThisLevel(后者数链内每跳)。
    turnsThisLevel: 0,
    // GAME-013 M4: transient snapshot, overwritten per performJump
    preJumpStunnedIds: [],
  };
}

export function recomputeLegalMoves(state: State): void {
  if (state.phase !== 'playing') {
    state.legalJumps = [];
    state.legalFreeMoves = [];
    state.legalWalks = [];
    return;
  }
  state.legalJumps = legalJumps(state);

  const buff = state.buff ? getBuff(state.buff) : null;

  // Walks: 只在 chain 未开始时可用。walkDistance hook 允许沿正交方向走 N 格(路径必须连续空)
  if (!state.chainActive) {
    const walkDist = buff?.hooks.walkDistance?.(state) ?? 1;
    const walks: Pos[] = [];
    for (const d of DIRS_ORTHO) {
      for (let step = 1; step <= walkDist; step++) {
        const p = { r: state.scout.r + d.dr * step, c: state.scout.c + d.dc * step };
        if (!inBounds(state, p.r, p.c)) break;
        if (zombieAt(state, p.r, p.c)) break;
        walks.push(p);
      }
    }
    state.legalWalks = walks;
  } else {
    state.legalWalks = [];
  }

  // Free moves (Apex) — apexMode hook 决定行为
  if (state.apexUsesRemaining > 0 && state.freeMoveMode) {
    const apexMode = buff?.hooks.apexMode?.(state) ?? 'free-move';
    if (apexMode === 'free-jump') {
      // 8 邻有 zombie + 那方向再 1 格空 = legal target
      state.legalFreeMoves = DIRS_8
        .filter(d => zombieAt(state, state.scout.r + d.dr, state.scout.c + d.dc))
        .map(d => ({ r: state.scout.r + 2 * d.dr, c: state.scout.c + 2 * d.dc }))
        .filter(p => inBounds(state, p.r, p.c) && !zombieAt(state, p.r, p.c));
    } else {
      // default 'free-move':8 邻空地
      state.legalFreeMoves = DIRS_8
        .map(d => ({ r: state.scout.r + d.dr, c: state.scout.c + d.dc }))
        .filter(p => inBounds(state, p.r, p.c) && !zombieAt(state, p.r, p.c));
    }
  } else {
    state.legalFreeMoves = [];
  }
}

export function clickCell(state: State, r: number, c: number): ClickResult {
  const events: ClickEvent[] = [];
  if (state.phase !== 'playing') return { state, events };

  // 优先 Apex 自由跳:freeMoveMode + 点的是 legalFreeMoves 之一
  if (state.freeMoveMode && state.legalFreeMoves.some(p => p.r === r && p.c === c)) {
    const buff = state.buff ? getBuff(state.buff) : null;
    const apexMode = buff?.hooks.apexMode?.(state) ?? 'free-move';
    if (apexMode === 'free-jump') {
      // 跳过中间 zombie + 移动到 2 格外。中间格已由 recomputeLegalMoves 保证有 zombie。
      const fromPos: Pos = { ...state.scout };
      const dr = Math.sign(r - state.scout.r) as -1 | 0 | 1;
      const dc = Math.sign(c - state.scout.c) as -1 | 0 | 1;
      const midR = state.scout.r + dr;
      const midC = state.scout.c + dc;
      const victim = zombieAt(state, midR, midC);
      state.scout = { r, c };
      state.apexUsesRemaining--;
      state.freeMoveMode = false;
      state.stepsThisLevel++;
      if (victim) {
        // engine 通用 HP 扣减(沿用 performJump 逻辑的简化版,不触 quake / milestone)
        victim.hpRemaining = Math.max(0, victim.hpRemaining - 1);
        const vDef = getZombie(victim.type);
        const side = vDef.hooks.onJumpedOver?.(victim, state, events) ?? { stun: false };
        events.push({ kind: 'jump', from: fromPos, over: { r: midR, c: midC }, to: { r, c }, killed: victim });
        if (victim.hpRemaining <= 0) {
          state.zombies = state.zombies.filter(z => z.id !== victim.id);
          // ENG-016 H1: free-jump kill 与 performJump 对齐 — kills++ / combo++ / onZombieKill
          state.kills++;
          const killIndex = state.combo;  // pre-increment value = index in chain
          setCombo(state, state.combo + 1, 'player-action', events);
          buff?.hooks.onZombieKill?.(state, victim, killIndex, events);
        } else if (side.stun) {
          victim.stunned = true;
          events.push({ kind: 'tank-stun', zombie: victim });
        }
      }
    } else {
      state.scout = { r, c };
      state.apexUsesRemaining--;
      state.freeMoveMode = false;
      state.stepsThisLevel++;
    }
    recomputeLegalMoves(state);
    return { state, events };
  }

  // Walk: 走 1 格正交 + 立即触发回合末
  if (state.legalWalks.some(p => p.r === r && p.c === c)) {
    const from = { ...state.scout };
    state.scout = { r, c };
    state.stepsThisLevel++;
    events.push({ kind: 'walk', from, to: { r, c } });
    // Walk 自动触发 endTurn 逻辑(链没启动,但回合还是要结束,僵尸 AI 走)
    const endResult = endTurn(state);
    return { state: endResult.state, events: [...events, ...endResult.events] };
  }

  // 标准跳:点的是 LANDING 格 (lr, lc)
  const jump = state.legalJumps.find(j => j.lr === r && j.lc === c);
  if (!jump) {
    // ENG-019 / DEC-074: jump-blocked detection — 点的若是"对角且 mid 是 shielded
    // 在阻挡"的位置,push jump-blocked 供 UI 出"盾挡火花"。判定逻辑不变(legalJumps
    // 仍 filter 掉这条),只是把"对角被盾挡"这一具体 case 暴露为事件。
    const blockedOver = detectShieldedDiagonalBlock(state, r, c);
    if (blockedOver) events.push({ kind: 'jump-blocked', over: blockedOver, reason: 'shielded' });
    return { state, events };
  }

  state.stepsThisLevel++;
  performJump(state, jump, events);
  return { state, events };
}

/**
 * ENG-019 / DEC-074:判断"点击 (r,c) 是否是被 shielded 对角挡的跳尝试"。
 * 条件:对角方向 + chebyshev distance ≥ 2 + mid (+1) 是 shielded + 落地 in-bounds & 空。
 * 不读 state.legalJumps(它已被 filter,这里独立计算)。surge / extra distances 都 cover。
 */
function detectShieldedDiagonalBlock(state: State, r: number, c: number): Pos | null {
  if (!inBounds(state, r, c)) return null;
  const dr = r - state.scout.r;
  const dc = c - state.scout.c;
  if (dr === 0 || dc === 0) return null;          // 必须对角
  if (Math.abs(dr) !== Math.abs(dc)) return null;  // chebyshev = 沿对角线
  if (Math.abs(dr) < 2) return null;
  const stepDr = Math.sign(dr) as -1 | 1;
  const stepDc = Math.sign(dc) as -1 | 1;
  const midR = state.scout.r + stepDr;
  const midC = state.scout.c + stepDc;
  const mid = zombieAt(state, midR, midC);
  if (!mid || mid.type !== 'shielded') return null;
  if (zombieAt(state, r, c)) return null;          // 落地有 zombie 不算"本可合法"
  return { r: midR, c: midC };
}

function performJump(state: State, jump: LegalJump, events: ClickEvent[]): void {
  const from: Pos = { ...state.scout };
  const overZombie = zombieAt(state, jump.mr, jump.mc)!;
  const activeBuff = state.buff ? getBuff(state.buff) : null;

  // GAME-013 M4: snapshot pre-jump stunned ids so yarn-thread can distinguish
  // "old stun" from "new stun caused by this kill" (eg. bomber explosion).
  state.preJumpStunnedIds = state.zombies.filter(z => z.stunned).map(z => z.id);

  events.push({ kind: 'jump', from, over: { r: jump.mr, c: jump.mc }, to: { r: jump.lr, c: jump.lc }, killed: overZombie });

  // === HP 扣减通用层(DEC-034 Refactor 2)===
  const damageBonus = activeBuff?.hooks.jumpDamageBonus?.(state, overZombie) ?? 0;
  const damage = 1 + damageBonus;
  overZombie.hpRemaining = Math.max(0, overZombie.hpRemaining - damage);

  const zomDef = getZombie(overZombie.type);
  const sideEffect = zomDef.hooks.onJumpedOver?.(overZombie, state, events) ?? { stun: false };

  if (overZombie.hpRemaining <= 0) {
    state.zombies = state.zombies.filter(z => z.id !== overZombie.id);
    const killIndex = state.combo;  // pre-increment value = index in chain
    activeBuff?.hooks.onZombieKill?.(state, overZombie, killIndex, events);
  } else if (sideEffect.stun) {
    overZombie.stunned = true;
    events.push({ kind: 'tank-stun', zombie: overZombie });
  }

  state.scout = { r: jump.lr, c: jump.lc };
  state.kills++;
  setCombo(state, state.combo + 1, 'player-action', events);
  state.chainActive = true;

  // Quake AOE(DEC-034 Refactor 1:quakeAoe 合并 radius + directions)
  // ENG-016 H2: 单 pass 建 pos map + 收集 victim ids,最后一次性 filter,避免 O(n²) + 引用脆性
  if (state.quakeArmed) {
    const aoe = activeBuff?.hooks.quakeAoe?.(state) ?? { radius: 1, directions: 'ortho' as const };
    const dirs = aoe.directions === 'all' ? DIRS_8 : DIRS_ORTHO;
    const posMap = new Map<string, Zombie>();
    for (const z of state.zombies) posMap.set(`${z.pos.r},${z.pos.c}`, z);
    const victimIds = new Set<number>();
    for (const dir of dirs) {
      for (let d = 1; d <= aoe.radius; d++) {
        const ar = state.scout.r + dir.dr * d;
        const ac = state.scout.c + dir.dc * d;
        const victim = posMap.get(`${ar},${ac}`);
        if (victim && !victimIds.has(victim.id)) {
          victimIds.add(victim.id);
          state.kills++;
          const aoeKillIndex = state.combo;
          setCombo(state, state.combo + 1, 'player-action', events);
          events.push({ kind: 'aoe-kill', pos: { r: ar, c: ac }, killed: victim });
          activeBuff?.hooks.onZombieKill?.(state, victim, aoeKillIndex, events);
        }
      }
    }
    if (victimIds.size > 0) {
      state.zombies = state.zombies.filter(z => !victimIds.has(z.id));
    }
    state.quakeArmed = false;
  }

  // onJumpLand:HP+onJumpedOver+AOE 之后,milestones 之前
  activeBuff?.hooks.onJumpLand?.(state, jump, events);

  applyMilestones(state, events);

  recomputeLegalMoves(state);
}

/**
 * setCombo helper(DEC-034 setCombo / onPlayerComboChange):
 * - 统一 combo 修改入口
 * - 调用所有 zombie 的 onPlayerComboChange hook
 * - source='zombie-hook' 时供 hook 内部 setCombo 用,防递归(hook 检查 source 自行短路)
 */
export function setCombo(
  state: State,
  newCombo: number,
  source: 'player-action' | 'zombie-hook',
  events: ClickEvent[]
): void {
  const oldCombo = state.combo;
  if (newCombo === oldCombo) return;
  state.combo = newCombo;
  for (const z of state.zombies) {
    const def = getZombie(z.type);
    def.hooks.onPlayerComboChange?.(z, state, oldCombo, newCombo, source, events);
  }
}

/**
 * spawnZombie API(DEC-034 §3 Engine API):
 * - 新 zombie 加入 state.zombies + push zombie-spawn event
 * - hpRemaining 从 ZombieDef.initialHp 取
 */
export function spawnZombie(
  state: State,
  atPos: Pos,
  type: ZombieType,
  events: ClickEvent[]
): Zombie {
  const def = getZombie(type);
  const newZombie: Zombie = {
    id: nextZombieId(state),
    pos: { ...atPos },
    type,
    hpRemaining: def.initialHp,
    stunned: false,
  };
  state.zombies.push(newZombie);
  events.push({ kind: 'zombie-spawn', zombie: newZombie });
  return newZombie;
}

/**
 * ENG-012: archer onTurnStart 预设 phase='lose' + push death event 后调用。
 * 给当前 buff 一次 onDeathPrevent 机会:成功则改 phase 回 'playing' 并移除预 push 的 death event。
 */
function runOnDeathPrevent(
  state: State,
  activeBuff: ReturnType<typeof getBuff> | null,
  events: ClickEvent[]
): boolean {
  if (state.phase !== 'lose') return false;
  const prevented = activeBuff?.hooks.onDeathPrevent?.(state, events) ?? false;
  if (prevented) {
    state.phase = 'playing';
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].kind === 'death') {
        events.splice(i, 1);
        break;
      }
    }
  }
  return prevented;
}

/**
 * 玩家点 END TURN 时调用。处理:
 * 1. 链结算 + 清里程碑
 * 2. 磁靴 buff:最近僵尸朝玩家走 1 步(在 zombie AI 之前)
 * 3. 僵尸 AI 跑完
 * 4. 死亡判定 / 胜利判定
 * 5. 重算合法跳
 */
export function endTurn(state: State): ClickResult {
  const events: ClickEvent[] = [];
  if (state.phase !== 'playing') return { state, events };

  // ENG-021: 一个真实回合开始结算 → turns +1。放 phase guard 之后,使早退(已 win/lose)
  // 不误增;winCheck 提前判时该回合(打完最后一击的回合)已计入,与 solver 的 end-turn
  // 计数口径一致(solver turns == 通关时 turnsThisLevel)。
  state.turnsThisLevel++;

  // 链结算(ENG-016 L2: perfectSweep flag 删 — 无 UI 消费者 · §8.11 raise)
  events.push({ kind: 'chain-end', finalCombo: state.combo });

  clearMilestones(state);
  setCombo(state, 0, 'player-action', events);
  state.chainActive = false;

  // 胜利提前判:杀光僵尸了
  if (winCheck(state)) {
    state.phase = 'win';
    events.push({ kind: 'win' });
    return { state, events };
  }

  // Buff onEndTurn hook(e.g. magnet-boots 拉僵尸 — 逻辑在 registries/buffs.ts)
  const activeBuff = state.buff ? getBuff(state.buff) : null;
  activeBuff?.hooks.onEndTurn?.(state, events);

  // Zombie onTurnStart hook(buff.onEndTurn 之后,zombie AI 之前)
  for (const z of [...state.zombies]) {
    const def = getZombie(z.type);
    def.hooks.onTurnStart?.(z, state, events);
  }

  // ENG-012: archer onTurnStart 可能已设 phase='lose' + 预 push death event
  // 给 buff 一次拦截机会,成功则 phase 改回 'playing',死亡事件被移除
  runOnDeathPrevent(state, activeBuff, events);

  // GAME-007 archer 守门:onTurnStart 中可能直接终结(archer raycast 命中 scout
  // → state.phase = 'lose')。如果发生,跳过后续 AI / hook / deathCheck
  if (state.phase !== 'playing') {
    return { state, events };
  }

  // 僵尸 AI(用 id 对齐避免 spawnZombie 期间数组变化导致 forEach 错位)
  const before = new Map(state.zombies.map(z => [z.id, { ...z.pos }]));
  runZombieAI(state);
  for (const z of state.zombies) {
    const prev = before.get(z.id);
    if (prev && (z.pos.r !== prev.r || z.pos.c !== prev.c)) {
      events.push({ kind: 'zombie-step', zombie: z, from: prev, to: { ...z.pos } });
    }
  }

  // Zombie onTurnEnd hook(zombie AI 之后,deathCheck 之前)
  for (const z of [...state.zombies]) {
    const def = getZombie(z.type);
    def.hooks.onTurnEnd?.(z, state, events);
  }

  // 死亡判定 — onDeathPrevent hook 可阻止本次死亡(DEC-036 Q2:cause 现为 DeathCause 详细对象)
  const deathCause = deathCheck(state);
  if (deathCause !== null) {
    const prevented = activeBuff?.hooks.onDeathPrevent?.(state, events) ?? false;
    if (!prevented) {
      state.phase = 'lose';
      events.push({ kind: 'death', cause: deathCause });
      return { state, events };
    }
  }

  // GAME-006 coward-pause:本回合结束后,记录 kills snapshot 给下回合 buff.onEndTurn 读
  state.lastTurnKills = state.kills;

  recomputeLegalMoves(state);
  return { state, events };
}
