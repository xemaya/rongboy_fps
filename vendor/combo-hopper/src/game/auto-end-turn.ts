import type { State } from './types';

/**
 * DEC-036 Q1a auto-endTurn:
 * scout 链激活中(chainActive=true)但所有合法行动数为 0 时,
 * UI 应延迟 800ms 自动 endTurn(给玩家看一眼 "no moves" 状态)。
 * 玩家在 800ms 内手动点 END TURN 也可,UI 须 clear timer。
 *
 * 此判定函数为纯函数,UI 层(src/ui/binding.ts)调度 setTimeout。
 */
export function shouldAutoEndTurn(state: State): boolean {
  if (!state.chainActive) return false;
  return state.legalJumps.length === 0
      && state.legalFreeMoves.length === 0
      && state.legalWalks.length === 0;
}

export const AUTO_END_TURN_DELAY_MS = 800;
