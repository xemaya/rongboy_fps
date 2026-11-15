import { State, ClickEvent } from './types';
import { getBuff } from './registries/buffs';
import { MILESTONE_REGISTRY, MilestoneId } from './registries/milestones';

// ENG-017 R5: 阈值常量保留为 backward-compat re-export(测试和外部 import 仍引用)。
// 真值住在 MILESTONE_REGISTRY,这里只是别名以防 import 漂移。
export const MILESTONE_SURGE = MILESTONE_REGISTRY.find(m => m.id === 'surge')!.defaultThreshold;
export const MILESTONE_QUAKE = MILESTONE_REGISTRY.find(m => m.id === 'quake')!.defaultThreshold;
export const MILESTONE_APEX = MILESTONE_REGISTRY.find(m => m.id === 'apex')!.defaultThreshold;

/**
 * 在每次 kill 后调用,检查 combo 是否跨过里程碑门槛。
 * Buff modifyMilestoneThresholds hook 直接覆盖默认 3/5/7;buff 可同时升(blast-radius
 * quake 5→6)或降(springy-feet surge 3→2)。state.buff 单选,无多 buff 合并冲突。
 *
 * ENG-017 R5: 迭代 MILESTONE_REGISTRY,每个 milestone 自带 isAlreadyActive / activate;
 * applyMilestones 内部不再硬编码 3 个 if · 加 milestone(Frenzy 等)只动 registry。
 */
export function applyMilestones(state: State, events: ClickEvent[]): void {
  const activeBuff = state.buff ? getBuff(state.buff) : null;
  const override = activeBuff?.hooks.modifyMilestoneThresholds?.(state);
  for (const m of MILESTONE_REGISTRY) {
    const threshold = (override as Partial<Record<MilestoneId, number>> | undefined)?.[m.overrideKey] ?? m.defaultThreshold;
    if (state.combo >= threshold && !m.isAlreadyActive(state)) {
      m.activate(state);
      events.push({ kind: 'milestone', which: m.id });
      activeBuff?.hooks.onMilestone?.(state, m.id, events);
    }
  }
}

export function clearMilestones(state: State): void {
  for (const m of MILESTONE_REGISTRY) m.deactivate(state);
  state.freeMoveMode = false;
}

export function activateApexMove(state: State): void {
  if (state.apexUsesRemaining > 0) {
    state.freeMoveMode = true;
  }
}
