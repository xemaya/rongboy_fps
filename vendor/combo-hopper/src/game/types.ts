export type Pos = { r: number; c: number };

export type ZombieType =
  // act 1(关 1-10,V0 + crawler)
  | 'walker'
  | 'runner'
  | 'tank'
  | 'crawler'
  // act 2(关 11-20)
  | 'shielded'
  | 'bomber'
  | 'spawner'
  // act 3 + boss(关 21-30)
  | 'archer'
  | 'boss-warden'
  | 'boss-leech';

export type Zombie = {
  id: number;
  pos: Pos;
  type: ZombieType;
  hpRemaining: number;  // walker/runner: 1, tank: 2(可由 ZombieDef.initialHp 提供默认)
  stunned: boolean;     // tank 第 1 跳后变 true,下回合不动 + 不再 stun
  internalTimer?: number;  // zombie 私有状态(eg. spawner spawn 倒计时);各 type 自行解释
  // stun 剩余回合数(GAME-006 yarn-thread 引入)。undefined = 默认 1 回合(原 boolean 语义);
  // ≥ 2 表示多回合 stun。runZombieAI 每回合 -1,归 0 才 unstun
  stunTurns?: number;
};

export type Direction = { dr: -1 | 0 | 1; dc: -1 | 0 | 1 };

export const DIRS_8: Direction[] = [
  { dr: -1, dc:  0 }, { dr: -1, dc:  1 }, { dr:  0, dc:  1 }, { dr:  1, dc:  1 },
  { dr:  1, dc:  0 }, { dr:  1, dc: -1 }, { dr:  0, dc: -1 }, { dr: -1, dc: -1 },
];

export const DIRS_ORTHO: Direction[] = [
  { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
];

export type LegalJump = {
  mr: number; mc: number;        // 被跳过僵尸格(中间)
  lr: number; lc: number;        // 落地格
  distance: number;              // 默认 2;Surge / long-legs / final-bow 等可叠加到 3+
};

export type BuffId =
  // starter(6)
  | 'long-legs'
  | 'magnet-boots'
  | 'aftershock'
  | 'quick-step'
  | 'soft-landing'
  | 'lucky-charm'
  // uncommon(8)
  | 'springy-feet'
  | 'straight-shooter'
  | 'ground-pound'
  | 'coward-pause'
  | 'blast-radius'
  | 'domino'
  | 'headhunter'
  | 'iron-toe'
  // rare(6)
  | 'multitool'
  | 'chain-revive'
  | 'yarn-thread'
  | 'time-rewind'
  | 'final-bow'
  | 'butterfly-jump';

export type Phase = 'intro' | 'playing' | 'animating' | 'win' | 'lose';

export type State = {
  rows: number;     // 8
  cols: number;     // 8
  phase: Phase;
  scout: Pos;
  zombies: Zombie[];
  // 计分
  kills: number;
  combo: number;
  chainActive: boolean;
  // 里程碑(每条链内置位,链结束清零)
  surgeActive: boolean;          // 3 杀后,后续跳距 +1 可选
  quakeArmed: boolean;           // 5 杀后,下一跳落地 AOE
  apexUsesRemaining: number;     // 7 杀后,本链 +1 自由跳次数
  // 自由跳模式
  freeMoveMode: boolean;         // 玩家激活了 Apex 自由跳的下一动作
  // 持久(全局)
  buff: BuffId | null;
  // 计算缓存(每次 clickCell 后更新)
  legalJumps: LegalJump[];
  legalFreeMoves: Pos[];         // 自由跳模式下,8 邻空地
  legalWalks: Pos[];             // 仅正交空邻格,只在 chainActive=false 时有内容
  // GAME-006 引入(coward-pause / lucky-charm / time-rewind 用):
  lastTurnKills: number;         // 上回合结束时 state.kills 快照(coward-pause 算 delta 用)
  buffUsesRemaining: number;     // one-shot buff 全局可用次数(lucky-charm / time-rewind 共享,因 buff 互斥)
  initialScoutPos: Pos;          // 关卡开局 scout 位置(lucky-charm 复位用)
  // UX-025 (F13+F14): HUD shows total steps this level. Includes both jumps
  // (each link in a chain) and walks. Reset to 0 in createInitialState; +1 in
  // clickCell for walk / jump / apex-free-move paths. §8.11 → DEC raise.
  stepsThisLevel: number;
  // ENG-021 (DEC-081): turn counter for par/star. Incremented once per endTurn
  // that processes a real turn (chain-end, walk-auto-endturn, or pass). Distinct
  // from stepsThisLevel (which counts every jump link). Read at win to score stars.
  // §8.11 → DEC candidate raised in handback (additive State field).
  turnsThisLevel: number;
  // GAME-013 M4: snapshot of zombie ids that were `stunned` BEFORE the current
  // performJump body ran. Used by yarn-thread to skip zombies that got stunned
  // by the kill itself (eg. bomber explosion 8-邻 stun). Captured at performJump
  // entry; overwritten next call. Transient — outside performJump it may be
  // stale but no other code reads it. §8.11 → DEC candidate raise.
  preJumpStunnedIds: number[];
};

export type ClickResult = {
  state: State;
  events: ClickEvent[];          // 给 UI 播放的事件序列
};

/**
 * 死亡原因详细数据(DEC-036 Q2;由 deathCheck 产出,UI 显示用)。
 * `zombies` 是 scout ortho 邻造成围杀的 snapshot(防 mutation)。
 */
export type DeathCause = {
  scoutPos: Pos;
  zombies: Zombie[];
  // 'surrounded':ortho 邻 ≥2 zombie 围杀(DEC-039 默认)
  // 'projectile':远程攻击(archer 等;GAME-007 引入)
  reason: 'surrounded' | 'projectile';
};

export type ClickEvent =
  | { kind: 'jump'; from: Pos; over: Pos; to: Pos; killed: Zombie }
  | { kind: 'walk'; from: Pos; to: Pos }
  | { kind: 'aoe-kill'; pos: Pos; killed: Zombie }
  | { kind: 'milestone'; which: 'surge' | 'quake' | 'apex' }
  | { kind: 'chain-end'; finalCombo: number }
  | { kind: 'zombie-step'; zombie: Zombie; from: Pos; to: Pos }
  | { kind: 'zombie-spawn'; zombie: Zombie }
  | { kind: 'tank-stun'; zombie: Zombie }
  | { kind: 'death'; cause: DeathCause }
  // UX-022 (B-026): emitted when a buff hook intercepts a game-state
  // change so the UI can show a banner / SFX. `reason` is an open string
  // (per-buff convention) so future buffs (time-rewind, etc.) can extend
  // without re-shaping the union — see DEC-048 candidate raise.
  | { kind: 'buff-trigger'; buffId: BuffId; reason: string }
  // ENG-019 / DEC-074: vfx-support events. UI may default-ignore until
  // animation-runner adds branches; engine pushes them as hooks for vfx.
  | { kind: 'archer-volley'; from: Pos; rays: Array<{ dir: Direction; lastPos: Pos; hitScout: boolean }> }
  | { kind: 'jump-blocked'; over: Pos; reason: 'shielded' }
  | { kind: 'combo-drain'; from?: Pos; to: Pos; amount: number }
  | { kind: 'win' };
