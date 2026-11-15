import { State } from '../types';

/**
 * ENG-017 R5: Milestone registry abstraction(eng-011 review)。
 *
 * 行为不变 · 抽出数据驱动:applyMilestones / clearMilestones 读 MILESTONE_REGISTRY,
 * 不再硬编码 surge/quake/apex 三块 if。加 milestone(如 Frenzy combo 10)从此只需
 * append 一个 entry + 1 个 State 字段,不动 applyMilestones 内部。
 *
 * 注意:
 * - State 上的具体字段(`surgeActive` / `quakeArmed` / `apexUsesRemaining`)保留,
 *   `rules.ts::legalJumps` / `state.ts::clickCell` / `performJump` 仍直接读这些字段。
 *   registry 只把"激活 / 清零 / 阈值"集中,**不**把 boolean / number 字段抽掉。
 * - `overrideKey` 对应 BuffHook.modifyMilestoneThresholds 返回的 `{ surge?, quake?, apex? }` key。
 *   新 milestone 接入 buff 阈值 override 系统时需扩 BuffHook 类型(§8.11 raise candidate)。
 */

export type MilestoneId = 'surge' | 'quake' | 'apex';

export type MilestoneDef = {
  id: MilestoneId;
  defaultThreshold: number;
  /** Buff `modifyMilestoneThresholds` 返回里的 key(目前与 id 同名)。 */
  overrideKey: MilestoneId;
  /** combo ≥ threshold 时是否还未激活(防重入)。 */
  isAlreadyActive: (state: State) => boolean;
  /** 设置 State 上的对应字段(surgeActive/quakeArmed/apexUsesRemaining)。 */
  activate: (state: State) => void;
  /** 链结束时重置 State 上的对应字段。 */
  deactivate: (state: State) => void;
};

export const MILESTONE_REGISTRY: MilestoneDef[] = [
  {
    id: 'surge',
    defaultThreshold: 3,
    overrideKey: 'surge',
    isAlreadyActive: (s) => s.surgeActive,
    activate: (s) => { s.surgeActive = true; },
    deactivate: (s) => { s.surgeActive = false; },
  },
  {
    id: 'quake',
    defaultThreshold: 5,
    overrideKey: 'quake',
    isAlreadyActive: (s) => s.quakeArmed,
    activate: (s) => { s.quakeArmed = true; },
    deactivate: (s) => { s.quakeArmed = false; },
  },
  {
    id: 'apex',
    defaultThreshold: 7,
    overrideKey: 'apex',
    isAlreadyActive: (s) => s.apexUsesRemaining > 0,
    activate: (s) => { s.apexUsesRemaining = 1; },
    deactivate: (s) => { s.apexUsesRemaining = 0; },
  },
];

export function getMilestone(id: MilestoneId): MilestoneDef {
  const m = MILESTONE_REGISTRY.find(x => x.id === id);
  if (!m) throw new Error(`Unknown milestone: ${id}`);
  return m;
}
