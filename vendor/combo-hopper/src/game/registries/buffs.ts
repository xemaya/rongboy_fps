import { State, ClickEvent, BuffId, Zombie, Pos, DIRS_8, DIRS_ORTHO } from '../types';

import { LegalJump } from '../types';
import { getZombie } from './zombies';
import { inBounds, zombieAt } from '../grid-utils';
import { t } from '../../i18n';

// REL-003 F2a: buff name + description live as inline getters on each
// BUFF_REGISTRY entry below — re-resolving `t()` each access. The previous
// `...buffI18n(id)` spread pattern (REL-002b) baked the EN literal at module
// init because object spread evaluates getters and copies the *values*,
// not the accessors. Inline getters fix that — they're owned by the entry
// object directly and survive spread / Object.assign / etc.

export type BuffHook = {
  /** Additional jump distances beyond default [2] + Surge's [3]. */
  extraJumpDistances?: (state: State) => number[];

  /** Behavior at the start of endTurn, before zombie AI runs. */
  onEndTurn?: (state: State, events: ClickEvent[]) => void;

  /** Quake AOE — radius + direction class. Default { radius: 1, directions: 'ortho' }. */
  quakeAoe?: (state: State) => { radius: number; directions: 'ortho' | 'all' };

  /** Called on scout landing after jump+HP+onJumpedOver, before milestones. */
  onJumpLand?: (state: State, jump: LegalJump, events: ClickEvent[]) => void;

  /** Called when deathCheck hits in endTurn. Return true to prevent death this turn. */
  onDeathPrevent?: (state: State, events: ClickEvent[]) => boolean;

  /** Called after each kill in performJump (jump or AOE). killIndexInChain starts at 0. */
  onZombieKill?: (state: State, victim: Zombie, killIndexInChain: number, events: ClickEvent[]) => void;

  /** Override milestone thresholds. Direct override (no max merge — buff slot is single). */
  modifyMilestoneThresholds?: (state: State) => { surge?: number; quake?: number; apex?: number };

  /** Walk distance in cells along an orthogonal direction. Default 1 (single neighbor). */
  walkDistance?: (state: State) => number;

  /** Restrict legal jump directions. Default 'all'. */
  restrictJumpDirections?: (state: State) => 'ortho' | 'diag' | 'all';

  /** Bonus damage added to base 1 per jump. Default 0. */
  jumpDamageBonus?: (state: State, zombie: Zombie) => number;

  /** Called after milestone event is pushed. */
  onMilestone?: (state: State, which: 'surge' | 'quake' | 'apex', events: ClickEvent[]) => void;

  /** Apex behavior mode. Default 'free-move' (8-neighbor empty). 'free-jump' = jump over adjacent zombie 2 cells. */
  apexMode?: (state: State) => 'free-move' | 'free-jump';
};

export type BuffDef = {
  id: BuffId;
  name: string;
  description: string;
  icon: string;
  hooks: BuffHook;
  /** Rarity tier (GAME-006 全填). */
  tier: 'starter' | 'uncommon' | 'rare';
  /** 解锁所需通关关数(0 = starter 初始解锁;真正数字 GAME-005 元进度时校准). */
  unlockLevel: number;
  /**
   * GAME-015 · soft-disable 旗帜(DEC-073)。默认 true;
   * false = 暂移出玩家可选池(progress.ts::getUnlockedBuffs 过滤),
   * 但实现/类型/i18n/测试全部保留 → 可逆。后续 buff 系统优化可 re-enable。
   */
  enabled?: boolean;
};

// ENG-016 M5: inBounds / zombieAt 抽到 ../grid-utils.ts(避免循环 import + 3 副本)

/**
 * Internal helper:从 buff hook 内部增量调整 combo,并通知 zombie 的
 * onPlayerComboChange hook(用 'player-action' source,因 buff = 玩家选择)。
 * 不能 `import { setCombo } from '../state'`(循环依赖),inline 重做核心逻辑。
 */
function bumpCombo(state: State, delta: number, events: ClickEvent[]): void {
  if (delta === 0) return;
  const oldCombo = state.combo;
  state.combo = oldCombo + delta;
  for (const z of state.zombies) {
    const def = getZombie(z.type);
    def.hooks.onPlayerComboChange?.(z, state, oldCombo, state.combo, 'player-action', events);
  }
}

// Sprite 占位 — ART-015 Batch 3 ship 后整批改路径
// UX-058 (DEC-076): BASE_URL prefix · Tauri/dev=`/`、web subpath=`/rongboy/`。
const PLACEHOLDER_ICON = `${import.meta.env.BASE_URL}sprites/scout.png`;

export const BUFF_REGISTRY: BuffDef[] = [
  // ============================================================
  // Starter (6) — 初始 3 选 1 池
  // ============================================================
  {
    id: 'long-legs',
    get name() { return t('buff.long-legs.name'); },
    get description() { return t('buff.long-legs.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'starter',
    unlockLevel: 0,
    hooks: {
      extraJumpDistances: () => [3],
    },
  },
  {
    id: 'magnet-boots',
    get name() { return t('buff.magnet-boots.name'); },
    get description() { return t('buff.magnet-boots.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'starter',
    unlockLevel: 0,
    hooks: {
      onEndTurn: (state, events) => {
        let closest: Zombie | null = null;
        let bestDist = Infinity;
        for (const z of state.zombies) {
          const d = Math.abs(z.pos.r - state.scout.r) + Math.abs(z.pos.c - state.scout.c);
          if (d < bestDist) { bestDist = d; closest = z; }
        }
        if (closest && !closest.stunned) {
          const dr = Math.sign(state.scout.r - closest.pos.r) as -1 | 0 | 1;
          const dc = Math.sign(state.scout.c - closest.pos.c) as -1 | 0 | 1;
          const candidates: Pos[] = [];
          if (dr !== 0) candidates.push({ r: closest.pos.r + dr, c: closest.pos.c });
          if (dc !== 0) candidates.push({ r: closest.pos.r, c: closest.pos.c + dc });
          for (const next of candidates) {
            if (!inBounds(state, next.r, next.c)) continue;
            if (zombieAt(state, next.r, next.c)) continue;
            if (next.r === state.scout.r && next.c === state.scout.c) continue;
            events.push({ kind: 'zombie-step', zombie: closest, from: { ...closest.pos }, to: next });
            closest.pos = next;
            break;
          }
        }
      },
    },
  },
  {
    id: 'aftershock',
    get name() { return t('buff.aftershock.name'); },
    get description() { return t('buff.aftershock.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'starter',
    unlockLevel: 0,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      quakeAoe: () => ({ radius: 2, directions: 'ortho' }),
    },
  },
  {
    id: 'quick-step',
    get name() { return t('buff.quick-step.name'); },
    get description() { return t('buff.quick-step.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'starter',
    unlockLevel: 0,
    hooks: {
      walkDistance: () => 2,
      restrictJumpDirections: () => 'ortho',
    },
  },
  {
    id: 'soft-landing',
    get name() { return t('buff.soft-landing.name'); },
    get description() { return t('buff.soft-landing.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'starter',
    unlockLevel: 0,
    hooks: {
      onJumpLand: (state, _jump, _events) => {
        // 链首跳触发(performJump 已 setCombo 1,onJumpLand 在 milestone 前调用)
        if (state.combo !== 1) return;
        const candidates: Zombie[] = [];
        for (const dir of DIRS_8) {
          const r = state.scout.r + dir.dr;
          const c = state.scout.c + dir.dc;
          const z = state.zombies.find(z => z.pos.r === r && z.pos.c === c && !z.stunned);
          if (z) candidates.push(z);
        }
        if (candidates.length === 0) return;
        // deterministic 选择:id 最小
        candidates.sort((a, b) => a.id - b.id);
        candidates[0].stunned = true;
      },
    },
  },
  {
    id: 'lucky-charm',
    get name() { return t('buff.lucky-charm.name'); },
    get description() { return t('buff.lucky-charm.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'starter',
    unlockLevel: 0,
    hooks: {
      onDeathPrevent: (state, events) => {
        if (state.buffUsesRemaining <= 0) return false;
        state.buffUsesRemaining -= 1;
        state.scout = { ...state.initialScoutPos };
        // UX-022 (B-026): emit buff-trigger so the UI can show a banner +
        // SFX. Without this, the player just sees the scout snap back to
        // start with no explanation — read as a bug, not a save.
        events.push({ kind: 'buff-trigger', buffId: 'lucky-charm', reason: 'death-save' });
        return true;
      },
    },
  },

  // ============================================================
  // Uncommon (8)
  // ============================================================
  {
    id: 'springy-feet',
    get name() { return t('buff.springy-feet.name'); },
    get description() { return t('buff.springy-feet.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 15,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      modifyMilestoneThresholds: () => ({ surge: 2, apex: 8 }),
    },
  },
  {
    id: 'straight-shooter',
    get name() { return t('buff.straight-shooter.name'); },
    get description() { return t('buff.straight-shooter.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 20,
    hooks: {
      restrictJumpDirections: () => 'ortho',
      extraJumpDistances: () => [3],
    },
  },
  {
    id: 'ground-pound',
    get name() { return t('buff.ground-pound.name'); },
    get description() { return t('buff.ground-pound.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 13,
    // GAME-021 (DEC-079 E4) 回炉:identity = "stun→kill 转换器"。落地清掉
    // 正交邻的 stunned 僵尸 → 与内建 tank-stun(跳过多血僵尸定身)/ domino /
    // coward-pause 等 stun 源形成"先定后清"解法视角,8 个现役没有这条。
    hooks: {
      // GAME-013 M2 nerf (eng-010 review · "kills ALL stunned neighbors every land 过强"):
      // 限制到 4 ortho 邻(原 8 邻)— 杀伤面积减半,保留"chain finisher stun-clear"
      // 设计意图但封顶最多 4 杀/land(对角 stunned 须 ortho-jump 才能命中)。
      onJumpLand: (state, _jump, events) => {
        const toKill: Zombie[] = [];
        for (const dir of DIRS_ORTHO) {
          const r = state.scout.r + dir.dr;
          const c = state.scout.c + dir.dc;
          const z = state.zombies.find(z => z.pos.r === r && z.pos.c === c && z.stunned);
          if (z) toKill.push(z);
        }
        for (const z of toKill) {
          state.zombies = state.zombies.filter(o => o.id !== z.id);
          state.kills += 1;
          events.push({ kind: 'aoe-kill', pos: { ...z.pos }, killed: z });
          // 触发 +1 combo,通知 onPlayerComboChange(同 quake AOE 语义)
          bumpCombo(state, 1, events);
        }
      },
    },
  },
  {
    id: 'coward-pause',
    get name() { return t('buff.coward-pause.name'); },
    get description() { return t('buff.coward-pause.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 17,
    hooks: {
      // onEndTurn 在 zombie AI 之前调用 — 若 delta = 0,所有 zombie 临时 stun 一回合
      // GAME-013 M3 fix (eng-010 review · "skips already-stunned 弱于 spec"):
      // 已 stunned 的 zombie 同样刷新(stunTurns +1),否则 tank-stun / domino /
      // soft-landing 等先 stun 的 zombie 在 coward-pause 触发时反而漏掉 1 回合。
      onEndTurn: (state, _events) => {
        const delta = state.kills - state.lastTurnKills;
        if (delta !== 0) return;
        for (const z of state.zombies) {
          if (!z.stunned) {
            z.stunned = true;
            // 留 stunTurns undefined → 走默认 1 回合解除,下回合恢复正常
          } else {
            // 已 stunned → 延长 1 回合(防被 runZombieAI 即刻解除)
            z.stunTurns = (z.stunTurns ?? 1) + 1;
          }
        }
      },
    },
  },
  {
    id: 'blast-radius',
    get name() { return t('buff.blast-radius.name'); },
    get description() { return t('buff.blast-radius.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 20,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      quakeAoe: () => ({ radius: 1, directions: 'all' }),
      modifyMilestoneThresholds: () => ({ quake: 6 }),
    },
  },
  {
    id: 'domino',
    get name() { return t('buff.domino.name'); },
    get description() { return t('buff.domino.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 13,
    hooks: {
      onZombieKill: (state, victim, killIndex, _events) => {
        if (killIndex !== 0) return;
        for (const dir of DIRS_8) {
          const r = victim.pos.r + dir.dr;
          const c = victim.pos.c + dir.dc;
          const z = state.zombies.find(z => z.pos.r === r && z.pos.c === c && !z.stunned);
          if (z) z.stunned = true;
        }
      },
    },
  },
  {
    id: 'headhunter',
    get name() { return t('buff.headhunter.name'); },
    get description() { return t('buff.headhunter.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 15,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      onZombieKill: (state, victim, _killIndex, events) => {
        if (victim.type !== 'runner') return;
        bumpCombo(state, 1, events);
      },
    },
  },
  {
    id: 'iron-toe',
    get name() { return t('buff.iron-toe.name'); },
    get description() { return t('buff.iron-toe.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'uncommon',
    unlockLevel: 15,
    // GAME-021 (DEC-079 E4) 回炉:identity = "破甲一击"。HP≥2(tank/spawner/boss)
    // 一跳即死 → 把多血关的 HP 难题直接抹平,8 个现役无任何破甲手段(独占视角)。
    hooks: {
      // damage = 1 + bonus → 设 bonus = hp - 1 让 walker/runner (HP 1) 不影响,tank/boss 一击死
      jumpDamageBonus: (_state, zombie) => Math.max(0, zombie.hpRemaining - 1),
    },
  },

  // ============================================================
  // Rare (6)
  // ============================================================
  {
    id: 'multitool',
    get name() { return t('buff.multitool.name'); },
    get description() { return t('buff.multitool.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'rare',
    unlockLevel: 22,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      extraJumpDistances: () => [3],
      quakeAoe: () => ({ radius: 2, directions: 'ortho' }),
    },
  },
  {
    id: 'chain-revive',
    get name() { return t('buff.chain-revive.name'); },
    get description() { return t('buff.chain-revive.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'rare',
    unlockLevel: 28,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      onMilestone: (state, which, _events) => {
        // 微调 spec(原 spec 想 combo=10 触发,但 onMilestone 不在 combo 10 触发)
        // 实现等效效果:Apex 触发时给额外 1 use,变成 2 自由跳
        if (which === 'apex') {
          state.apexUsesRemaining += 1;
        }
      },
    },
  },
  {
    id: 'yarn-thread',
    get name() { return t('buff.yarn-thread.name'); },
    get description() { return t('buff.yarn-thread.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'rare',
    unlockLevel: 25,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      // GAME-013 M4 fix (eng-010 review · "extends stun on zombies stunned THIS kill 过强"):
      // 仅延长 performJump 启动前已 stunned 的 zombie。bomber 8-邻爆炸 stun + 同帧
      // onZombieKill 触发的 yarn-thread 之前会同时 +1 这些新 stun,使 bomber+yarn-thread
      // 协同过度叠加。改读 state.preJumpStunnedIds(state.ts::performJump 头部 snapshot)。
      onZombieKill: (state, _victim, _killIndex, _events) => {
        const preStunned = state.preJumpStunnedIds;
        for (const z of state.zombies) {
          if (z.stunned && preStunned.includes(z.id)) {
            z.stunTurns = (z.stunTurns ?? 1) + 1;
          }
        }
      },
    },
  },
  {
    id: 'time-rewind',
    get name() { return t('buff.time-rewind.name'); },
    get description() { return t('buff.time-rewind.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'rare',
    unlockLevel: 25,
    // GAME-021 (DEC-079 E4) 回炉:identity = "原地续命"。与 lucky-charm 是
    // 一对刻意的镜像选择(C2 挑工具 = 谜题一部分):lucky-charm 弹回起手(丢走位)、
    // time-rewind 原地复活(保留辛苦走到的关键格)→ 落点差异改变谜题算路。
    hooks: {
      // F7 fix (ENG-009): emit buff-trigger so the UI can show a banner +
      // SFX matching lucky-charm's pattern. Before the fix, time-rewind
      // silently swallowed the death — player saw "should be dead but
      // still alive" with zero feedback, reported in wave 1 image#11.
      onDeathPrevent: (state, events) => {
        if (state.buffUsesRemaining <= 0) return false;
        state.buffUsesRemaining -= 1;
        events.push({ kind: 'buff-trigger', buffId: 'time-rewind', reason: 'death-save' });
        return true;
      },
    },
  },
  {
    id: 'final-bow',
    get name() { return t('buff.final-bow.name'); },
    get description() { return t('buff.final-bow.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'rare',
    unlockLevel: 30,
    enabled: false,  // GAME-015 / DEC-073 soft-disable
    hooks: {
      extraJumpDistances: (state) => state.combo >= 5 ? [3, 4] : [],
    },
  },
  {
    id: 'butterfly-jump',
    get name() { return t('buff.butterfly-jump.name'); },
    get description() { return t('buff.butterfly-jump.description'); },
    icon: PLACEHOLDER_ICON,
    tier: 'rare',
    unlockLevel: 30,
    // GAME-021 (DEC-079 E4) 回炉:identity = "极位变杀招"。把 Apex(combo 7)
    // 从"自由挪位"质变成"免费多杀一只"——不是数值换皮,是 milestone 行为质变,
    // 解长链(combo≥7)缺最后一杀的密集关。情境牌(需链够长),但视角独特。
    hooks: {
      apexMode: () => 'free-jump',
    },
  },
];

export function getBuff(id: BuffId): BuffDef {
  const b = BUFF_REGISTRY.find(x => x.id === id);
  if (!b) throw new Error(`Unknown buff: ${id}`);
  return b;
}

// Backward-compat aliases for existing UI / test code.
export const BUFFS = BUFF_REGISTRY;
export function buffById(id: BuffId): BuffDef | undefined {
  return BUFF_REGISTRY.find(b => b.id === id);
}
