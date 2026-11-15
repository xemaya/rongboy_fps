import { State, ClickEvent, Zombie, ZombieType, Pos, DIRS_8 } from '../types';
import { inBounds, zombieAt, nextZombieId } from '../grid-utils';

export type ZombieHook = {
  /** 单回合走的步数。默认 1 */
  stepCount?: (zombie: Zombie, state: State) => number;

  /**
   * 玩家跳过此僵尸时调用。HP 扣减由 engine 通用层处理;hook 仅返回是否 stun
   * (Tank 还活着 → stun;walker/runner HP=0 死了 → engine 自动 remove)。
   * Hook 内可副作用(eg. bomber 死时 stun 邻;boss-warden 死时 spawn walker)。
   */
  onJumpedOver?: (zombie: Zombie, state: State, events: ClickEvent[]) => { stun: boolean };

  /** Can scout jump from `fromPos` over this zombie? Default true. */
  canBeJumpedOverFrom?: (zombie: Zombie, fromPos: Pos, state: State) => boolean;

  /** Called per zombie at endTurn start (after buff.onEndTurn, before zombie AI). */
  onTurnStart?: (zombie: Zombie, state: State, events: ClickEvent[]) => void;

  /** Called per zombie at endTurn end (after zombie AI, before deathCheck). */
  onTurnEnd?: (zombie: Zombie, state: State, events: ClickEvent[]) => void;

  /** Called via setCombo() when player combo changes. source='zombie-hook' prevents recursion. */
  onPlayerComboChange?: (
    zombie: Zombie,
    state: State,
    oldCombo: number,
    newCombo: number,
    source: 'player-action' | 'zombie-hook',
    events: ClickEvent[]
  ) => void;
};

export type ZombieDef = {
  id: ZombieType;
  initialHp: number;
  hooks: ZombieHook;
};

// =========================================================================
// 内部 helpers(grid 工具 import 自 grid-utils.ts · ENG-016 M5/H3)
// =========================================================================

/**
 * Spawn a walker inline(spawner / boss-warden 用).
 * 仿 state.ts::spawnZombie 但 inline 避免 import 循环 — id 走 nextZombieId(state)。
 * 在 zombie 8 邻空格(deterministic:sort by r,c 取第一个)中放置。
 */
function spawnWalkerAdjacent(parent: Zombie, state: State, events: ClickEvent[]): void {
  const candidates: Pos[] = [];
  for (const dir of DIRS_8) {
    const r = parent.pos.r + dir.dr;
    const c = parent.pos.c + dir.dc;
    if (!inBounds(state, r, c)) continue;
    if (zombieAt(state, r, c)) continue;
    if (r === state.scout.r && c === state.scout.c) continue;
    candidates.push({ r, c });
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.r - b.r || a.c - b.c);
  const pos = candidates[0];
  const newZombie: Zombie = {
    id: nextZombieId(state),
    pos,
    type: 'walker',
    hpRemaining: 1,
    stunned: false,
  };
  state.zombies.push(newZombie);
  events.push({ kind: 'zombie-spawn', zombie: newZombie });
}

// =========================================================================
// ZOMBIE_REGISTRY(10 entry — 3 V0 + 7 GAME-007)
// =========================================================================

export const ZOMBIE_REGISTRY: ZombieDef[] = [
  // ---------- act 1(4)----------
  {
    id: 'walker',
    initialHp: 1,
    hooks: {},
  },
  {
    id: 'runner',
    initialHp: 1,
    hooks: {
      stepCount: () => 2,
    },
  },
  {
    id: 'tank',
    initialHp: 2,
    hooks: {
      onJumpedOver: (z) => ({ stun: z.hpRemaining > 0 }),
    },
  },
  {
    id: 'crawler',
    initialHp: 1,
    hooks: {
      // 不动 — 占位静态障碍
      stepCount: () => 0,
    },
  },

  // ---------- act 2(3)----------
  {
    id: 'shielded',
    initialHp: 1,
    hooks: {
      // 仅正交方向(N/S/E/W)可跳过;对角线被挡
      canBeJumpedOverFrom: (z, fromPos) => {
        const dr = z.pos.r - fromPos.r;
        const dc = z.pos.c - fromPos.c;
        return dr === 0 || dc === 0;
      },
    },
  },
  {
    id: 'bomber',
    initialHp: 1,
    hooks: {
      // 死时 8 邻所有未眩晕僵尸 stun 1 回合(自己 HP 1 → engine 自动 remove)
      onJumpedOver: (z, state, events) => {
        for (const dir of DIRS_8) {
          const r = z.pos.r + dir.dr;
          const c = z.pos.c + dir.dc;
          const neighbor = state.zombies.find(o =>
            o.pos.r === r && o.pos.c === c && !o.stunned && o.id !== z.id
          );
          if (neighbor) {
            neighbor.stunned = true;
            events.push({ kind: 'tank-stun', zombie: neighbor });
          }
        }
        return { stun: false };
      },
    },
  },
  {
    id: 'spawner',
    initialHp: 2,
    hooks: {
      stepCount: () => 0,  // 不动
      onJumpedOver: (z) => ({ stun: z.hpRemaining > 0 }),  // tank-like 双击
      // 每 3 回合 internalTimer 倒计到 0,召唤 1 walker 到 8 邻 deterministic 空格
      onTurnEnd: (z, state, events) => {
        z.internalTimer = (z.internalTimer ?? 3) - 1;
        if (z.internalTimer <= 0) {
          z.internalTimer = 3;
          spawnWalkerAdjacent(z, state, events);
        }
      },
    },
  },

  // ---------- act 3 + boss(3)----------
  {
    id: 'archer',
    initialHp: 1,
    hooks: {
      stepCount: () => 0,  // 不动
      // 每回合开始 raycast 8 方向,命中 scout 即死(被挡的话无效)。
      // ENG-019 / DEC-074: 收集全 8 向 raycast 结果(lastPos + hitScout)→ push
      // archer-volley(每 archer 每回合一条),命中 ray 的 death event 紧随其后,
      // 让 UI 先画箭飞、再处理 endCard。命中/挡格判定逻辑不变。
      onTurnStart: (z, state, events) => {
        const rays: Array<{ dir: typeof DIRS_8[number]; lastPos: Pos; hitScout: boolean }> = [];
        let hit = false;
        for (const dir of DIRS_8) {
          let r = z.pos.r + dir.dr;
          let c = z.pos.c + dir.dc;
          let lastR = z.pos.r;
          let lastC = z.pos.c;
          let rayHit = false;
          while (inBounds(state, r, c)) {
            lastR = r;
            lastC = c;
            if (r === state.scout.r && c === state.scout.c) {
              rayHit = true;
              hit = true;
              break;
            }
            if (zombieAt(state, r, c)) break;  // blocker
            r += dir.dr;
            c += dir.dc;
          }
          rays.push({ dir, lastPos: { r: lastR, c: lastC }, hitScout: rayHit });
        }
        events.push({ kind: 'archer-volley', from: { ...z.pos }, rays });
        if (hit) {
          events.push({
            kind: 'death',
            cause: {
              scoutPos: { ...state.scout },
              zombies: [{ ...z }],
              reason: 'projectile',
            },
          });
          state.phase = 'lose';
        }
      },
    },
  },
  {
    id: 'boss-warden',
    initialHp: 4,
    hooks: {
      // 每被跳过 → tank-like 扣 1 HP + 触发 spawn 1 walker(spawn-on-hit 报复机制)
      onJumpedOver: (z, state, events) => {
        spawnWalkerAdjacent(z, state, events);
        return { stun: z.hpRemaining > 0 };
      },
    },
  },
  {
    id: 'boss-leech',
    initialHp: 5,
    hooks: {
      onJumpedOver: (z) => ({ stun: z.hpRemaining > 0 }),  // tank-like
      // 玩家 combo 涨且 ≥3 时,吸走 1 combo;防递归 — source='zombie-hook' 早 return
      // ENG-019 / DEC-074: push combo-drain event(amount = 实际被吸量),供 UI 画
      // combo 数字流向 leech 的动画;吸取数值逻辑不变。
      onPlayerComboChange: (z, state, oldCombo, newCombo, source, events) => {
        if (source === 'zombie-hook') return;  // 防递归(spec 强制)
        if (newCombo > oldCombo && newCombo >= 3) {
          // inline mutate(不再次 setCombo,避免触发其他 zombie hook 循环);
          // boss-leech 是当前唯一 onPlayerComboChange consumer,inline OK
          const drained = newCombo - Math.max(0, newCombo - 1);
          state.combo = Math.max(0, newCombo - 1);
          events.push({ kind: 'combo-drain', to: { ...z.pos }, amount: drained });
        }
      },
    },
  },
];

export function getZombie(id: ZombieType): ZombieDef {
  const z = ZOMBIE_REGISTRY.find(x => x.id === id);
  if (!z) throw new Error(`Unknown zombie type: ${id}`);
  return z;
}
