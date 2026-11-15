import { State, LegalJump, DIRS_8, Zombie, Pos, DeathCause } from './types';
import { getBuff } from './registries/buffs';
import { getZombie } from './registries/zombies';
import { inBounds, zombieAt } from './grid-utils';

export { DIRS_ORTHO } from './types';
export { inBounds, zombieAt } from './grid-utils';

export function legalJumps(state: State): LegalJump[] {
  const { scout } = state;
  const out: LegalJump[] = [];
  const distances: number[] = [2];
  if (state.surgeActive) distances.push(3);
  const buff = state.buff ? getBuff(state.buff) : null;
  const extras = buff?.hooks.extraJumpDistances?.(state) ?? [];
  for (const d of extras) {
    if (!distances.includes(d)) distances.push(d);
  }
  const dirRestrict = buff?.hooks.restrictJumpDirections?.(state) ?? 'all';
  const dirs = DIRS_8.filter(d => {
    if (dirRestrict === 'all') return true;
    const isOrtho = d.dr === 0 || d.dc === 0;
    return dirRestrict === 'ortho' ? isOrtho : !isOrtho;
  });
  for (const dir of dirs) {
    for (const dist of distances) {
      // 被跳过的僵尸始终在相邻位(+1)
      const overR = scout.r + dir.dr;
      const overC = scout.c + dir.dc;
      // 落地点是 dist 距离
      const lr = scout.r + dist * dir.dr;
      const lc = scout.c + dist * dir.dc;
      if (!inBounds(state, overR, overC) || !inBounds(state, lr, lc)) continue;
      const mid = zombieAt(state, overR, overC);
      if (!mid) continue;
      const midDef = getZombie(mid.type);
      if (midDef.hooks.canBeJumpedOverFrom?.(mid, scout, state) === false) continue;
      if (zombieAt(state, lr, lc)) continue;
      out.push({ mr: overR, mc: overC, lr, lc, distance: dist });
    }
  }
  return out;
}

function manhattanStepToward(from: Pos, to: Pos, state: State, occupied: Set<string>): Pos | null {
  const dr = Math.sign(to.r - from.r) as -1 | 0 | 1;
  const dc = Math.sign(to.c - from.c) as -1 | 0 | 1;
  // 优先正交:先垂直再水平
  const candidates: Pos[] = [];
  if (dr !== 0) candidates.push({ r: from.r + dr, c: from.c });
  if (dc !== 0) candidates.push({ r: from.r, c: from.c + dc });
  for (const next of candidates) {
    if (!inBounds(state, next.r, next.c)) continue;
    const key = `${next.r},${next.c}`;
    if (occupied.has(key)) continue;
    if (next.r === state.scout.r && next.c === state.scout.c) continue;  // 不踩玩家
    return next;
  }
  return null;
}

export function runZombieAI(state: State): void {
  // 按 id 升序处理冲突
  const sorted = [...state.zombies].sort((a, b) => a.id - b.id);
  const occupied = new Set(sorted.map(z => `${z.pos.r},${z.pos.c}`));

  for (const z of sorted) {
    // Stunned:本回合不动。stunTurns 倒计时(GAME-006 yarn-thread 引入):
    // - 默认 stun 1 回合(stunTurns undefined / ≤ 1 → 本回合不动 + 解除)
    // - yarn-thread 等 buff 可把 stunTurns 累加到 ≥2(本回合 -1 仍 > 0 → 保持 stunned)
    if (z.stunned) {
      const turns = z.stunTurns ?? 1;
      if (turns > 1) {
        z.stunTurns = turns - 1;
        continue;  // 仍 stunned 下回合再判
      }
      z.stunned = false;
      z.stunTurns = undefined;
      continue;
    }
    const zomDef = getZombie(z.type);
    const steps = zomDef.hooks.stepCount?.(z, state) ?? 1;
    for (let i = 0; i < steps; i++) {
      occupied.delete(`${z.pos.r},${z.pos.c}`);
      const next = manhattanStepToward(z.pos, state.scout, state, occupied);
      if (!next) {
        occupied.add(`${z.pos.r},${z.pos.c}`);
        break;
      }
      z.pos = next;
      occupied.add(`${next.r},${next.c}`);
    }
  }
}

/**
 * 死亡判定(DEC-041,2026-05-28 用户澄清原版 Zomboy 规则,supersedes DEC-039):
 * scout **8 邻**(4 ortho + 4 diagonal)有 **≥2 zombie** 即触发"围杀"。
 * 这是 parent project zomboy 的核心规则,Combo Hopper 沿用。
 */
export function deathCheck(state: State): DeathCause | null {
  const zombies: Zombie[] = [];
  for (const dir of DIRS_8) {
    const r = state.scout.r + dir.dr;
    const c = state.scout.c + dir.dc;
    const z = zombieAt(state, r, c);
    if (z) zombies.push(z);
  }
  if (zombies.length < 2) return null;  // DEC-041: 8 邻 ≥2 才算围杀
  return {
    scoutPos: { ...state.scout },
    zombies: zombies.map(z => ({ ...z })),  // snapshot,防 UI 后续 mutation 影响 cause data
    reason: 'surrounded',
  };
}

export function winCheck(state: State): boolean {
  return state.zombies.length === 0;
}
