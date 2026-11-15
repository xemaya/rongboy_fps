// vendor/combo-hopper/src/game/types.ts
var DIRS_8 = [
  { dr: -1, dc: 0 },
  { dr: -1, dc: 1 },
  { dr: 0, dc: 1 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: -1 },
  { dr: 0, dc: -1 },
  { dr: -1, dc: -1 }
];
var DIRS_ORTHO = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 }
];

// vendor/combo-hopper/src/game/grid-utils.ts
function inBounds(state, r, c) {
  return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
}
function zombieAt(state, r, c) {
  return state.zombies.find((z) => z.pos.r === r && z.pos.c === c) ?? null;
}
function nextZombieId(state) {
  return state.zombies.reduce((m, z) => Math.max(m, z.id), 0) + 1;
}

// vendor/combo-hopper/src/game/registries/zombies.ts
function spawnWalkerAdjacent(parent, state, events) {
  const candidates = [];
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
  const newZombie = {
    id: nextZombieId(state),
    pos,
    type: "walker",
    hpRemaining: 1,
    stunned: false
  };
  state.zombies.push(newZombie);
  events.push({ kind: "zombie-spawn", zombie: newZombie });
}
var ZOMBIE_REGISTRY = [
  // ---------- act 1(4)----------
  {
    id: "walker",
    initialHp: 1,
    hooks: {}
  },
  {
    id: "runner",
    initialHp: 1,
    hooks: {
      stepCount: () => 2
    }
  },
  {
    id: "tank",
    initialHp: 2,
    hooks: {
      onJumpedOver: (z) => ({ stun: z.hpRemaining > 0 })
    }
  },
  {
    id: "crawler",
    initialHp: 1,
    hooks: {
      // 不动 — 占位静态障碍
      stepCount: () => 0
    }
  },
  // ---------- act 2(3)----------
  {
    id: "shielded",
    initialHp: 1,
    hooks: {
      // 仅正交方向(N/S/E/W)可跳过;对角线被挡
      canBeJumpedOverFrom: (z, fromPos) => {
        const dr = z.pos.r - fromPos.r;
        const dc = z.pos.c - fromPos.c;
        return dr === 0 || dc === 0;
      }
    }
  },
  {
    id: "bomber",
    initialHp: 1,
    hooks: {
      // 死时 8 邻所有未眩晕僵尸 stun 1 回合(自己 HP 1 → engine 自动 remove)
      onJumpedOver: (z, state, events) => {
        for (const dir of DIRS_8) {
          const r = z.pos.r + dir.dr;
          const c = z.pos.c + dir.dc;
          const neighbor = state.zombies.find(
            (o) => o.pos.r === r && o.pos.c === c && !o.stunned && o.id !== z.id
          );
          if (neighbor) {
            neighbor.stunned = true;
            events.push({ kind: "tank-stun", zombie: neighbor });
          }
        }
        return { stun: false };
      }
    }
  },
  {
    id: "spawner",
    initialHp: 2,
    hooks: {
      stepCount: () => 0,
      // 不动
      onJumpedOver: (z) => ({ stun: z.hpRemaining > 0 }),
      // tank-like 双击
      // 每 3 回合 internalTimer 倒计到 0,召唤 1 walker 到 8 邻 deterministic 空格
      onTurnEnd: (z, state, events) => {
        z.internalTimer = (z.internalTimer ?? 3) - 1;
        if (z.internalTimer <= 0) {
          z.internalTimer = 3;
          spawnWalkerAdjacent(z, state, events);
        }
      }
    }
  },
  // ---------- act 3 + boss(3)----------
  {
    id: "archer",
    initialHp: 1,
    hooks: {
      stepCount: () => 0,
      // 不动
      // 每回合开始 raycast 8 方向,命中 scout 即死(被挡的话无效)。
      // ENG-019 / DEC-074: 收集全 8 向 raycast 结果(lastPos + hitScout)→ push
      // archer-volley(每 archer 每回合一条),命中 ray 的 death event 紧随其后,
      // 让 UI 先画箭飞、再处理 endCard。命中/挡格判定逻辑不变。
      onTurnStart: (z, state, events) => {
        const rays = [];
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
            if (zombieAt(state, r, c)) break;
            r += dir.dr;
            c += dir.dc;
          }
          rays.push({ dir, lastPos: { r: lastR, c: lastC }, hitScout: rayHit });
        }
        events.push({ kind: "archer-volley", from: { ...z.pos }, rays });
        if (hit) {
          events.push({
            kind: "death",
            cause: {
              scoutPos: { ...state.scout },
              zombies: [{ ...z }],
              reason: "projectile"
            }
          });
          state.phase = "lose";
        }
      }
    }
  },
  {
    id: "boss-warden",
    initialHp: 4,
    hooks: {
      // 每被跳过 → tank-like 扣 1 HP + 触发 spawn 1 walker(spawn-on-hit 报复机制)
      onJumpedOver: (z, state, events) => {
        spawnWalkerAdjacent(z, state, events);
        return { stun: z.hpRemaining > 0 };
      }
    }
  },
  {
    id: "boss-leech",
    initialHp: 5,
    hooks: {
      onJumpedOver: (z) => ({ stun: z.hpRemaining > 0 }),
      // tank-like
      // 玩家 combo 涨且 ≥3 时,吸走 1 combo;防递归 — source='zombie-hook' 早 return
      // ENG-019 / DEC-074: push combo-drain event(amount = 实际被吸量),供 UI 画
      // combo 数字流向 leech 的动画;吸取数值逻辑不变。
      onPlayerComboChange: (z, state, oldCombo, newCombo, source, events) => {
        if (source === "zombie-hook") return;
        if (newCombo > oldCombo && newCombo >= 3) {
          const drained = newCombo - Math.max(0, newCombo - 1);
          state.combo = Math.max(0, newCombo - 1);
          events.push({ kind: "combo-drain", to: { ...z.pos }, amount: drained });
        }
      }
    }
  }
];
function getZombie(id) {
  const z = ZOMBIE_REGISTRY.find((x) => x.id === id);
  if (!z) throw new Error(`Unknown zombie type: ${id}`);
  return z;
}

// vendor/combo-hopper/src/data/i18n/en.ts
var EN_DICT = {
  buff: {
    "long-legs": {
      name: "Long Legs",
      // CON-012 (用户实测 风格 b):简化,去 milestone 黑话,留数字。
      // edge case "over 2 连续 zombies 只 kill 第 1"(CON-010 F8 / DEC-053 Q1a)
      // 实战体会;若玩家再 raise 重加(handback flag)
      description: "Jump 3 cells (normally 2)."
    },
    "magnet-boots": {
      name: "Magnet Boots",
      description: "Each turn start, nearest zombie steps toward you."
    },
    "aftershock": {
      name: "Aftershock",
      description: "Ground slam reaches 1 cell further."
    },
    "quick-step": {
      name: "Quick Step",
      description: "Walk 2 cells in a line. No diagonal jumps."
    },
    "soft-landing": {
      name: "Soft Landing",
      description: "After your first jump, one neighbor zombie stuns."
    },
    "lucky-charm": {
      name: "Lucky Charm",
      description: "One free save: scout returns to start."
    },
    "springy-feet": {
      name: "Springy Feet",
      description: "Sprint triggers at 2 kills (normally 3)."
    },
    "straight-shooter": {
      name: "Straight Shooter",
      description: "Ortho jumps only. Jump 3 cells (normally 2)."
    },
    "ground-pound": {
      name: "Ground Pound",
      description: "Turn stuns into kills: every landing wipes stunned zombies in the 4 cells next to you."
    },
    "coward-pause": {
      name: "Coward Pause",
      description: "If you killed 0 last turn, all zombies freeze this turn."
    },
    "blast-radius": {
      name: "Blast Radius",
      description: "Ground slam hits 8 directions (normally 4)."
    },
    "domino": {
      name: "Domino",
      description: "First kill of a chain stuns the 8 cells around the victim."
    },
    "headhunter": {
      name: "Headhunter",
      description: "Kill a runner: +1 bonus combo."
    },
    "iron-toe": {
      name: "Iron Toe",
      description: "Armor breaker: one-shot tanks, spawners and bosses (HP \u2265 2) you normally can not stomp."
    },
    "multitool": {
      name: "Multitool",
      description: "Jump 3 cells and ground slam reaches 1 cell further."
    },
    "chain-revive": {
      name: "Chain Revive",
      description: "Combo 7 reward grants +1 extra free move (2 total)."
    },
    "yarn-thread": {
      name: "Yarn Thread",
      description: "Each kill: every stunned zombie stays frozen +1 turn."
    },
    "time-rewind": {
      name: "Time Rewind",
      description: "One free save per run that keeps your spot: revive right where you stood (Lucky Charm sends you back to start)."
    },
    "final-bow": {
      name: "Final Bow",
      description: "At 5+ combo, jump 4 cells."
    },
    "butterfly-jump": {
      name: "Butterfly Jump",
      description: "Turns the combo 7 reward into a kill: instead of a free step, jump over an adjacent zombie for free."
    }
  },
  zombie: {
    "walker": { name: "Walker", behavior: "Walks 1 cell per turn" },
    "runner": { name: "Runner", behavior: "Walks 2 cells per turn" },
    "tank": { name: "Tank", behavior: "HP 2 \u2014 stuns when first hit" },
    "crawler": { name: "Crawler", behavior: "Does not move; static obstacle" },
    "shielded": { name: "Shielded", behavior: "Only ortho jumps land \u2014 diagonals blocked" },
    "bomber": { name: "Bomber", behavior: "On death, stuns all 8-neighbor zombies" },
    "spawner": { name: "Spawner", behavior: "HP 2 \u2014 every 3 turns spawns a walker nearby" },
    "archer": { name: "Archer", behavior: "Fires arrow each turn along 8 directions" },
    "boss-warden": { name: "Warden", behavior: "HP 4 \u2014 spawns a walker each time hit" },
    "boss-leech": { name: "Leech", behavior: "HP 5 \u2014 drains 1 combo when player reaches \u22653" }
  },
  ui: {
    "buff-picker": {
      prompt: "Pick a buff to begin",
      "redraw-fmt": "Re-draw (\xD7{n})",
      "redraw-empty": "No re-draws left"
    },
    "end-turn": { button: "END TURN" },
    "hud": {
      kills: "KILLS",
      combo: "COMBO",
      buff: "BUFF",
      // UX-025 (F13+F14): HUD stats — relative level / remaining zombies / steps taken
      level: "LEVEL",
      zombiesLeft: "ZOMBIES",
      steps: "STEPS"
    },
    "end-card": {
      win: {
        "title-fmt": "Level {n} Clear!",
        "title-all-cleared": "All Cleared!",
        "msg-cleared-fmt": "{kills} kills, board cleared!",
        "msg-final-fmt": "Level {n} done \xB7 {kills} kills",
        "btn-next": "Next Level",
        "btn-replay": "\u21BB Replay",
        "btn-replay-fmt": "\u21BB Replay Level {n}",
        "btn-back-1": "Back to Level 1"
      },
      lose: {
        title: "Defeated",
        "msg-fmt": "{kills} kills.",
        "cause-singular-fmt": "Surrounded by {n} zombie",
        "cause-plural-fmt": "Surrounded by {n} zombies",
        // UX-053: distinct cause line when archer onTurnStart kills via
        // a projectile — the surrounded fmts confused the player into
        // thinking they were trapped by a swarm. Reason routing lives
        // in fsm.ts:showEndCard. content may polish phrasing later.
        "cause-projectile-fmt": "Shot down by an Archer.",
        "btn-retry": "\u21BB Retry"
      }
    },
    pause: {
      title: "Paused",
      "btn-resume": "Resume",
      "btn-restart": "Restart Level",
      "btn-quit": "Quit to Level 1",
      // UX-024c: pause "back to main menu" button (Sprint 7 wave 2)
      "btn-back-to-menu": "Back to Menu",
      "aria-label": "Pause"
    },
    // UX-006a Main Menu (Sprint 7 wave 2)
    menu: {
      start: "Start",
      levelSelect: "Level Select",
      settings: "Settings",
      quit: "Quit",
      tagline: "Rong, wrong forest"
    },
    // UX-006c Level Select (Sprint 7 wave 2)
    levelSelect: {
      title: "Level Select",
      locked: "Locked",
      back: "Back"
    },
    // UX-061 · Star rating (DEC-081). Shown on level-select cells (best
    // earned) and the win end-card (this run's stars + par/optimal context).
    stars: {
      // aria-label on the star row: "{n} of 3 stars"
      "aria-fmt": "{n} of 3 stars",
      // win end-card: this run's turns vs the par/optimal targets
      "turns-fmt": "Cleared in {turns} turns",
      "optimal-fmt": "3\u2605 in {optimal}",
      "par-fmt": "2\u2605 in {par}",
      // win end-card: best stars on record for this level
      "best-fmt": "Best: {n}\u2605"
    },
    // UX-006b Settings (Sprint 7 wave 2)
    settings: {
      title: "Settings",
      language: "Language",
      music: "Music",
      sfx: "SFX",
      back: "Back"
    },
    // CON-010 F1 (DEC-053):opening 10s 末段 textbox 台词 — UX-023 渲染
    // 调性:童趣 + 紧张但不恐怖(brand 调性 DEC-030);brand 自称 "Rongboy" 锁
    opening: {
      line1: "Zombies?! In my forest?!",
      line2: "Better hop careful, Rongboy.",
      // UX-030 (R14) Fix 2: press-key prompt at opening end
      pressKey: "Tap to start your adventure"
    },
    // UX-041: rules modal text-card title — displayed to player.
    // `ui.rules.title` (aria/alt fallback "Game rules") is kept as a
    // separate, accessibility-only label; this new key is the visible
    // header on the felt card.
    rules: {
      "title-display": "How to Play"
    },
    // UX-064: rotate-to-landscape hint overlay (touch + portrait only,
    // web/itch mobile visitors). Desktop never sees this.
    orientation: {
      title: "Rotate your phone",
      sub: "Rongboy plays best in landscape."
    }
  },
  status: {
    "click-first-jump": "Click a yellow cell to start your first jump",
    "click-highlight": "Click highlight (yellow = jump / or walk)",
    "chain-spent": "Chain spent \u2014 press END TURN",
    "combo-fmt": "Combo \xD7{combo} \u2014 continue or END TURN",
    "apex-prompt": "Apex! Click any 8-neighbor empty cell for a free move / or keep jumping"
  },
  banner: {
    "lucky-charm": {
      title: "Lucky Charm Activated!",
      sub: "Scout returned to start"
    },
    danger: "DANGER \xB7 zombies closing in"
  },
  milestone: {
    surge: "Surge!",
    quake: "Quake!",
    apex: "Apex!"
  },
  // 5 core rules — 给 ART-018 / Sprint 7 ART-020 重出 infographic 用
  // CON-011 (DEC-054 Q2c):6 → 5 条,删原 #4 'Walking ends...'(F20 用户实测意义不明)
  // walk vs jump 区别仍由 levelIntro['1'] hot loop 教程承载
  rules: {
    "1": "Click a yellow cell to leap over a zombie.",
    "2": "Chain leaps = combo.",
    "3": "2 zombies in your 8 neighbors at turn end = surrounded.",
    "4": "Pick a buff each level; clear levels to unlock more.",
    "5": "Master all 30 levels."
  },
  tutorial: {
    zombieIntro: {
      walker: "Walkers shuffle one square per turn.",
      runner: "Runners dart two squares. They'll catch up fast.",
      tank: "Tanks shrug off the first jump. Hop twice.",
      crawler: "Crawlers stay put. Use them as stepping stones.",
      shielded: "Shielded zombies only let you jump straight over.",
      bomber: "Bombers burst on death. Neighbors freeze for a turn.",
      spawner: "Spawners hatch a walker every three turns.",
      archer: "Archers shoot a line each turn. Stay off it.",
      "boss-warden": "The Warden calls a walker each time you jump it.",
      "boss-leech": "The Leech sips one combo when you stack three."
    },
    milestoneIntro: {
      surge: "Surge! Your next jumps stretch to three squares.",
      quake: "Quake armed. Your next landing rattles the squares nearby.",
      apex: "Apex! Pick any empty neighbor and step onto it."
    },
    levelIntro: {
      // CON-010 F5 (DEC-053 Q2a):强调 jump 必须 over **same-direction adj zombie**,
      // 落点在 zombie 直线后 — 关 1 是 player 首次见 yellow cell,hot loop 最自然
      "1": "Click a yellow square \u2014 jumps go straight past the zombie.",
      "2": "Chain three kills to wake the Surge.",
      "3": "Runners catch up fast. Open a chain quickly."
    },
    deathHints: [
      "The forest is patient.",
      "Rong, wrong forest. Try again.",
      "Shadows knew your stitches.",
      "One stitch loose. The thread will hold next time.",
      "Stillness keeps no secrets.",
      "Even small dolls leave footprints.",
      "Rongboy, breathe. The forest waits."
    ]
  },
  // UX-006c · Sprint 7 wave 2 · R2 closed.
  // 30 level names mirroring `LEVEL_REGISTRY[i].name` in registries/levels.ts.
  // Keyed by 1-indexed level number so callers can do `t('levels.' + n)`.
  levels: {
    "1": "Edge of the Path",
    "2": "Rustling Bushes",
    "3": "Quick Steps",
    "4": "Stone Stumps",
    "5": "Ambush Pocket",
    "6": "The Heavy One",
    "7": "Chain Builder",
    "8": "Forest Fork",
    "9": "Pre-Boss Test",
    "10": "The Stout Warden",
    "11": "Shielded Patrol",
    "12": "Cross-Fire",
    "13": "Ticking Trap",
    "14": "Chain Reaction",
    "15": "Locked Squares",
    "16": "Apex Test",
    "17": "Garden of Brood",
    "18": "Roach Spread",
    "19": "Pre-Warden Gauntlet",
    "20": "The Crypt Warden",
    "21": "Whispers Among Trees",
    "22": "First Arrow",
    "23": "Line of Sight",
    "24": "Stone Sentinels",
    "25": "The Brood Master",
    "26": "Shielded Volley",
    "27": "Threading the Needle",
    "28": "Combo Drought",
    "29": "Final Gauntlet",
    "30": "The Soul Leech"
  }
};

// vendor/combo-hopper/src/i18n/manager.ts
var currentDict = EN_DICT;
function lookup(dict, parts) {
  let val = dict;
  for (const p of parts) {
    if (val === null || typeof val !== "object") return void 0;
    val = val[p];
    if (val === void 0) return void 0;
  }
  return typeof val === "string" ? val : void 0;
}
function t(keyPath, fallback) {
  const parts = keyPath.split(".");
  const fromCurrent = lookup(currentDict, parts);
  if (fromCurrent !== void 0) return fromCurrent;
  if (currentDict !== EN_DICT) {
    const fromEn = lookup(EN_DICT, parts);
    if (fromEn !== void 0) return fromEn;
  }
  return fallback ?? keyPath;
}

// vendor/combo-hopper/src/game/registries/buffs.ts
function bumpCombo(state, delta, events) {
  if (delta === 0) return;
  const oldCombo = state.combo;
  state.combo = oldCombo + delta;
  for (const z of state.zombies) {
    const def = getZombie(z.type);
    def.hooks.onPlayerComboChange?.(z, state, oldCombo, state.combo, "player-action", events);
  }
}
var PLACEHOLDER_ICON = `${"./"}sprites/scout.png`;
var BUFF_REGISTRY = [
  // ============================================================
  // Starter (6) — 初始 3 选 1 池
  // ============================================================
  {
    id: "long-legs",
    get name() {
      return t("buff.long-legs.name");
    },
    get description() {
      return t("buff.long-legs.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "starter",
    unlockLevel: 0,
    hooks: {
      extraJumpDistances: () => [3]
    }
  },
  {
    id: "magnet-boots",
    get name() {
      return t("buff.magnet-boots.name");
    },
    get description() {
      return t("buff.magnet-boots.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "starter",
    unlockLevel: 0,
    hooks: {
      onEndTurn: (state, events) => {
        let closest = null;
        let bestDist = Infinity;
        for (const z of state.zombies) {
          const d = Math.abs(z.pos.r - state.scout.r) + Math.abs(z.pos.c - state.scout.c);
          if (d < bestDist) {
            bestDist = d;
            closest = z;
          }
        }
        if (closest && !closest.stunned) {
          const dr = Math.sign(state.scout.r - closest.pos.r);
          const dc = Math.sign(state.scout.c - closest.pos.c);
          const candidates = [];
          if (dr !== 0) candidates.push({ r: closest.pos.r + dr, c: closest.pos.c });
          if (dc !== 0) candidates.push({ r: closest.pos.r, c: closest.pos.c + dc });
          for (const next of candidates) {
            if (!inBounds(state, next.r, next.c)) continue;
            if (zombieAt(state, next.r, next.c)) continue;
            if (next.r === state.scout.r && next.c === state.scout.c) continue;
            events.push({ kind: "zombie-step", zombie: closest, from: { ...closest.pos }, to: next });
            closest.pos = next;
            break;
          }
        }
      }
    }
  },
  {
    id: "aftershock",
    get name() {
      return t("buff.aftershock.name");
    },
    get description() {
      return t("buff.aftershock.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "starter",
    unlockLevel: 0,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
    hooks: {
      quakeAoe: () => ({ radius: 2, directions: "ortho" })
    }
  },
  {
    id: "quick-step",
    get name() {
      return t("buff.quick-step.name");
    },
    get description() {
      return t("buff.quick-step.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "starter",
    unlockLevel: 0,
    hooks: {
      walkDistance: () => 2,
      restrictJumpDirections: () => "ortho"
    }
  },
  {
    id: "soft-landing",
    get name() {
      return t("buff.soft-landing.name");
    },
    get description() {
      return t("buff.soft-landing.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "starter",
    unlockLevel: 0,
    hooks: {
      onJumpLand: (state, _jump, _events) => {
        if (state.combo !== 1) return;
        const candidates = [];
        for (const dir of DIRS_8) {
          const r = state.scout.r + dir.dr;
          const c = state.scout.c + dir.dc;
          const z = state.zombies.find((z2) => z2.pos.r === r && z2.pos.c === c && !z2.stunned);
          if (z) candidates.push(z);
        }
        if (candidates.length === 0) return;
        candidates.sort((a, b) => a.id - b.id);
        candidates[0].stunned = true;
      }
    }
  },
  {
    id: "lucky-charm",
    get name() {
      return t("buff.lucky-charm.name");
    },
    get description() {
      return t("buff.lucky-charm.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "starter",
    unlockLevel: 0,
    hooks: {
      onDeathPrevent: (state, events) => {
        if (state.buffUsesRemaining <= 0) return false;
        state.buffUsesRemaining -= 1;
        state.scout = { ...state.initialScoutPos };
        events.push({ kind: "buff-trigger", buffId: "lucky-charm", reason: "death-save" });
        return true;
      }
    }
  },
  // ============================================================
  // Uncommon (8)
  // ============================================================
  {
    id: "springy-feet",
    get name() {
      return t("buff.springy-feet.name");
    },
    get description() {
      return t("buff.springy-feet.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
    unlockLevel: 15,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
    hooks: {
      modifyMilestoneThresholds: () => ({ surge: 2, apex: 8 })
    }
  },
  {
    id: "straight-shooter",
    get name() {
      return t("buff.straight-shooter.name");
    },
    get description() {
      return t("buff.straight-shooter.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
    unlockLevel: 20,
    hooks: {
      restrictJumpDirections: () => "ortho",
      extraJumpDistances: () => [3]
    }
  },
  {
    id: "ground-pound",
    get name() {
      return t("buff.ground-pound.name");
    },
    get description() {
      return t("buff.ground-pound.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
    unlockLevel: 13,
    // GAME-021 (DEC-079 E4) 回炉:identity = "stun→kill 转换器"。落地清掉
    // 正交邻的 stunned 僵尸 → 与内建 tank-stun(跳过多血僵尸定身)/ domino /
    // coward-pause 等 stun 源形成"先定后清"解法视角,8 个现役没有这条。
    hooks: {
      // GAME-013 M2 nerf (eng-010 review · "kills ALL stunned neighbors every land 过强"):
      // 限制到 4 ortho 邻(原 8 邻)— 杀伤面积减半,保留"chain finisher stun-clear"
      // 设计意图但封顶最多 4 杀/land(对角 stunned 须 ortho-jump 才能命中)。
      onJumpLand: (state, _jump, events) => {
        const toKill = [];
        for (const dir of DIRS_ORTHO) {
          const r = state.scout.r + dir.dr;
          const c = state.scout.c + dir.dc;
          const z = state.zombies.find((z2) => z2.pos.r === r && z2.pos.c === c && z2.stunned);
          if (z) toKill.push(z);
        }
        for (const z of toKill) {
          state.zombies = state.zombies.filter((o) => o.id !== z.id);
          state.kills += 1;
          events.push({ kind: "aoe-kill", pos: { ...z.pos }, killed: z });
          bumpCombo(state, 1, events);
        }
      }
    }
  },
  {
    id: "coward-pause",
    get name() {
      return t("buff.coward-pause.name");
    },
    get description() {
      return t("buff.coward-pause.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
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
          } else {
            z.stunTurns = (z.stunTurns ?? 1) + 1;
          }
        }
      }
    }
  },
  {
    id: "blast-radius",
    get name() {
      return t("buff.blast-radius.name");
    },
    get description() {
      return t("buff.blast-radius.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
    unlockLevel: 20,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
    hooks: {
      quakeAoe: () => ({ radius: 1, directions: "all" }),
      modifyMilestoneThresholds: () => ({ quake: 6 })
    }
  },
  {
    id: "domino",
    get name() {
      return t("buff.domino.name");
    },
    get description() {
      return t("buff.domino.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
    unlockLevel: 13,
    hooks: {
      onZombieKill: (state, victim, killIndex, _events) => {
        if (killIndex !== 0) return;
        for (const dir of DIRS_8) {
          const r = victim.pos.r + dir.dr;
          const c = victim.pos.c + dir.dc;
          const z = state.zombies.find((z2) => z2.pos.r === r && z2.pos.c === c && !z2.stunned);
          if (z) z.stunned = true;
        }
      }
    }
  },
  {
    id: "headhunter",
    get name() {
      return t("buff.headhunter.name");
    },
    get description() {
      return t("buff.headhunter.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
    unlockLevel: 15,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
    hooks: {
      onZombieKill: (state, victim, _killIndex, events) => {
        if (victim.type !== "runner") return;
        bumpCombo(state, 1, events);
      }
    }
  },
  {
    id: "iron-toe",
    get name() {
      return t("buff.iron-toe.name");
    },
    get description() {
      return t("buff.iron-toe.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "uncommon",
    unlockLevel: 15,
    // GAME-021 (DEC-079 E4) 回炉:identity = "破甲一击"。HP≥2(tank/spawner/boss)
    // 一跳即死 → 把多血关的 HP 难题直接抹平,8 个现役无任何破甲手段(独占视角)。
    hooks: {
      // damage = 1 + bonus → 设 bonus = hp - 1 让 walker/runner (HP 1) 不影响,tank/boss 一击死
      jumpDamageBonus: (_state, zombie) => Math.max(0, zombie.hpRemaining - 1)
    }
  },
  // ============================================================
  // Rare (6)
  // ============================================================
  {
    id: "multitool",
    get name() {
      return t("buff.multitool.name");
    },
    get description() {
      return t("buff.multitool.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "rare",
    unlockLevel: 22,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
    hooks: {
      extraJumpDistances: () => [3],
      quakeAoe: () => ({ radius: 2, directions: "ortho" })
    }
  },
  {
    id: "chain-revive",
    get name() {
      return t("buff.chain-revive.name");
    },
    get description() {
      return t("buff.chain-revive.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "rare",
    unlockLevel: 28,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
    hooks: {
      onMilestone: (state, which, _events) => {
        if (which === "apex") {
          state.apexUsesRemaining += 1;
        }
      }
    }
  },
  {
    id: "yarn-thread",
    get name() {
      return t("buff.yarn-thread.name");
    },
    get description() {
      return t("buff.yarn-thread.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "rare",
    unlockLevel: 25,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
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
      }
    }
  },
  {
    id: "time-rewind",
    get name() {
      return t("buff.time-rewind.name");
    },
    get description() {
      return t("buff.time-rewind.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "rare",
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
        events.push({ kind: "buff-trigger", buffId: "time-rewind", reason: "death-save" });
        return true;
      }
    }
  },
  {
    id: "final-bow",
    get name() {
      return t("buff.final-bow.name");
    },
    get description() {
      return t("buff.final-bow.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "rare",
    unlockLevel: 30,
    enabled: false,
    // GAME-015 / DEC-073 soft-disable
    hooks: {
      extraJumpDistances: (state) => state.combo >= 5 ? [3, 4] : []
    }
  },
  {
    id: "butterfly-jump",
    get name() {
      return t("buff.butterfly-jump.name");
    },
    get description() {
      return t("buff.butterfly-jump.description");
    },
    icon: PLACEHOLDER_ICON,
    tier: "rare",
    unlockLevel: 30,
    // GAME-021 (DEC-079 E4) 回炉:identity = "极位变杀招"。把 Apex(combo 7)
    // 从"自由挪位"质变成"免费多杀一只"——不是数值换皮,是 milestone 行为质变,
    // 解长链(combo≥7)缺最后一杀的密集关。情境牌(需链够长),但视角独特。
    hooks: {
      apexMode: () => "free-jump"
    }
  }
];
function getBuff(id) {
  const b = BUFF_REGISTRY.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown buff: ${id}`);
  return b;
}

// vendor/combo-hopper/src/game/rules.ts
function legalJumps(state) {
  const { scout } = state;
  const out = [];
  const distances = [2];
  if (state.surgeActive) distances.push(3);
  const buff = state.buff ? getBuff(state.buff) : null;
  const extras = buff?.hooks.extraJumpDistances?.(state) ?? [];
  for (const d of extras) {
    if (!distances.includes(d)) distances.push(d);
  }
  const dirRestrict = buff?.hooks.restrictJumpDirections?.(state) ?? "all";
  const dirs = DIRS_8.filter((d) => {
    if (dirRestrict === "all") return true;
    const isOrtho = d.dr === 0 || d.dc === 0;
    return dirRestrict === "ortho" ? isOrtho : !isOrtho;
  });
  for (const dir of dirs) {
    for (const dist of distances) {
      const overR = scout.r + dir.dr;
      const overC = scout.c + dir.dc;
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
function manhattanStepToward(from, to, state, occupied) {
  const dr = Math.sign(to.r - from.r);
  const dc = Math.sign(to.c - from.c);
  const candidates = [];
  if (dr !== 0) candidates.push({ r: from.r + dr, c: from.c });
  if (dc !== 0) candidates.push({ r: from.r, c: from.c + dc });
  for (const next of candidates) {
    if (!inBounds(state, next.r, next.c)) continue;
    const key = `${next.r},${next.c}`;
    if (occupied.has(key)) continue;
    if (next.r === state.scout.r && next.c === state.scout.c) continue;
    return next;
  }
  return null;
}
function runZombieAI(state) {
  const sorted = [...state.zombies].sort((a, b) => a.id - b.id);
  const occupied = new Set(sorted.map((z) => `${z.pos.r},${z.pos.c}`));
  for (const z of sorted) {
    if (z.stunned) {
      const turns = z.stunTurns ?? 1;
      if (turns > 1) {
        z.stunTurns = turns - 1;
        continue;
      }
      z.stunned = false;
      z.stunTurns = void 0;
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
function deathCheck(state) {
  const zombies = [];
  for (const dir of DIRS_8) {
    const r = state.scout.r + dir.dr;
    const c = state.scout.c + dir.dc;
    const z = zombieAt(state, r, c);
    if (z) zombies.push(z);
  }
  if (zombies.length < 2) return null;
  return {
    scoutPos: { ...state.scout },
    zombies: zombies.map((z) => ({ ...z })),
    // snapshot,防 UI 后续 mutation 影响 cause data
    reason: "surrounded"
  };
}
function winCheck(state) {
  return state.zombies.length === 0;
}

// vendor/combo-hopper/src/game/registries/milestones.ts
var MILESTONE_REGISTRY = [
  {
    id: "surge",
    defaultThreshold: 3,
    overrideKey: "surge",
    isAlreadyActive: (s) => s.surgeActive,
    activate: (s) => {
      s.surgeActive = true;
    },
    deactivate: (s) => {
      s.surgeActive = false;
    }
  },
  {
    id: "quake",
    defaultThreshold: 5,
    overrideKey: "quake",
    isAlreadyActive: (s) => s.quakeArmed,
    activate: (s) => {
      s.quakeArmed = true;
    },
    deactivate: (s) => {
      s.quakeArmed = false;
    }
  },
  {
    id: "apex",
    defaultThreshold: 7,
    overrideKey: "apex",
    isAlreadyActive: (s) => s.apexUsesRemaining > 0,
    activate: (s) => {
      s.apexUsesRemaining = 1;
    },
    deactivate: (s) => {
      s.apexUsesRemaining = 0;
    }
  }
];

// vendor/combo-hopper/src/game/milestones.ts
var MILESTONE_SURGE = MILESTONE_REGISTRY.find((m) => m.id === "surge").defaultThreshold;
var MILESTONE_QUAKE = MILESTONE_REGISTRY.find((m) => m.id === "quake").defaultThreshold;
var MILESTONE_APEX = MILESTONE_REGISTRY.find((m) => m.id === "apex").defaultThreshold;
function applyMilestones(state, events) {
  const activeBuff = state.buff ? getBuff(state.buff) : null;
  const override = activeBuff?.hooks.modifyMilestoneThresholds?.(state);
  for (const m of MILESTONE_REGISTRY) {
    const threshold = override?.[m.overrideKey] ?? m.defaultThreshold;
    if (state.combo >= threshold && !m.isAlreadyActive(state)) {
      m.activate(state);
      events.push({ kind: "milestone", which: m.id });
      activeBuff?.hooks.onMilestone?.(state, m.id, events);
    }
  }
}
function clearMilestones(state) {
  for (const m of MILESTONE_REGISTRY) m.deactivate(state);
  state.freeMoveMode = false;
}
function activateApexMove(state) {
  if (state.apexUsesRemaining > 0) {
    state.freeMoveMode = true;
  }
}

// vendor/combo-hopper/src/game/state.ts
function createInitialState(rows, cols, scout, zombies, buff) {
  let nextId = 1;
  return {
    rows,
    cols,
    phase: "playing",
    scout: { ...scout },
    zombies: zombies.map((z) => ({
      ...z,
      id: nextId++,
      hpRemaining: z.hpRemaining ?? getZombie(z.type).initialHp
    })),
    kills: 0,
    combo: 0,
    chainActive: false,
    surgeActive: false,
    quakeArmed: false,
    apexUsesRemaining: 0,
    freeMoveMode: false,
    buff,
    legalJumps: [],
    legalFreeMoves: [],
    legalWalks: [],
    // GAME-006 新字段
    lastTurnKills: 0,
    buffUsesRemaining: 1,
    // one-shot buff 全局 1 次/局(lucky-charm / time-rewind)
    initialScoutPos: { ...scout },
    // lucky-charm 复位锚点
    // UX-025 (F13+F14): HUD step counter — reset per level
    stepsThisLevel: 0,
    // ENG-021: 回合计数(turns)— par/star 用(DEC-081)。每次 endTurn 处理一个回合 +1
    // (walk 自动 endTurn 也算一回合 · pass 也算)。≠ stepsThisLevel(后者数链内每跳)。
    turnsThisLevel: 0,
    // GAME-013 M4: transient snapshot, overwritten per performJump
    preJumpStunnedIds: []
  };
}
function recomputeLegalMoves(state) {
  if (state.phase !== "playing") {
    state.legalJumps = [];
    state.legalFreeMoves = [];
    state.legalWalks = [];
    return;
  }
  state.legalJumps = legalJumps(state);
  const buff = state.buff ? getBuff(state.buff) : null;
  if (!state.chainActive) {
    const walkDist = buff?.hooks.walkDistance?.(state) ?? 1;
    const walks = [];
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
  if (state.apexUsesRemaining > 0 && state.freeMoveMode) {
    const apexMode = buff?.hooks.apexMode?.(state) ?? "free-move";
    if (apexMode === "free-jump") {
      state.legalFreeMoves = DIRS_8.filter((d) => zombieAt(state, state.scout.r + d.dr, state.scout.c + d.dc)).map((d) => ({ r: state.scout.r + 2 * d.dr, c: state.scout.c + 2 * d.dc })).filter((p) => inBounds(state, p.r, p.c) && !zombieAt(state, p.r, p.c));
    } else {
      state.legalFreeMoves = DIRS_8.map((d) => ({ r: state.scout.r + d.dr, c: state.scout.c + d.dc })).filter((p) => inBounds(state, p.r, p.c) && !zombieAt(state, p.r, p.c));
    }
  } else {
    state.legalFreeMoves = [];
  }
}
function clickCell(state, r, c) {
  const events = [];
  if (state.phase !== "playing") return { state, events };
  if (state.freeMoveMode && state.legalFreeMoves.some((p) => p.r === r && p.c === c)) {
    const buff = state.buff ? getBuff(state.buff) : null;
    const apexMode = buff?.hooks.apexMode?.(state) ?? "free-move";
    if (apexMode === "free-jump") {
      const fromPos = { ...state.scout };
      const dr = Math.sign(r - state.scout.r);
      const dc = Math.sign(c - state.scout.c);
      const midR = state.scout.r + dr;
      const midC = state.scout.c + dc;
      const victim = zombieAt(state, midR, midC);
      state.scout = { r, c };
      state.apexUsesRemaining--;
      state.freeMoveMode = false;
      state.stepsThisLevel++;
      if (victim) {
        victim.hpRemaining = Math.max(0, victim.hpRemaining - 1);
        const vDef = getZombie(victim.type);
        const side = vDef.hooks.onJumpedOver?.(victim, state, events) ?? { stun: false };
        events.push({ kind: "jump", from: fromPos, over: { r: midR, c: midC }, to: { r, c }, killed: victim });
        if (victim.hpRemaining <= 0) {
          state.zombies = state.zombies.filter((z) => z.id !== victim.id);
          state.kills++;
          const killIndex = state.combo;
          setCombo(state, state.combo + 1, "player-action", events);
          buff?.hooks.onZombieKill?.(state, victim, killIndex, events);
        } else if (side.stun) {
          victim.stunned = true;
          events.push({ kind: "tank-stun", zombie: victim });
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
  if (state.legalWalks.some((p) => p.r === r && p.c === c)) {
    const from = { ...state.scout };
    state.scout = { r, c };
    state.stepsThisLevel++;
    events.push({ kind: "walk", from, to: { r, c } });
    const endResult = endTurn(state);
    return { state: endResult.state, events: [...events, ...endResult.events] };
  }
  const jump = state.legalJumps.find((j) => j.lr === r && j.lc === c);
  if (!jump) {
    const blockedOver = detectShieldedDiagonalBlock(state, r, c);
    if (blockedOver) events.push({ kind: "jump-blocked", over: blockedOver, reason: "shielded" });
    return { state, events };
  }
  state.stepsThisLevel++;
  performJump(state, jump, events);
  return { state, events };
}
function detectShieldedDiagonalBlock(state, r, c) {
  if (!inBounds(state, r, c)) return null;
  const dr = r - state.scout.r;
  const dc = c - state.scout.c;
  if (dr === 0 || dc === 0) return null;
  if (Math.abs(dr) !== Math.abs(dc)) return null;
  if (Math.abs(dr) < 2) return null;
  const stepDr = Math.sign(dr);
  const stepDc = Math.sign(dc);
  const midR = state.scout.r + stepDr;
  const midC = state.scout.c + stepDc;
  const mid = zombieAt(state, midR, midC);
  if (!mid || mid.type !== "shielded") return null;
  if (zombieAt(state, r, c)) return null;
  return { r: midR, c: midC };
}
function performJump(state, jump, events) {
  const from = { ...state.scout };
  const overZombie = zombieAt(state, jump.mr, jump.mc);
  const activeBuff = state.buff ? getBuff(state.buff) : null;
  state.preJumpStunnedIds = state.zombies.filter((z) => z.stunned).map((z) => z.id);
  events.push({ kind: "jump", from, over: { r: jump.mr, c: jump.mc }, to: { r: jump.lr, c: jump.lc }, killed: overZombie });
  const damageBonus = activeBuff?.hooks.jumpDamageBonus?.(state, overZombie) ?? 0;
  const damage = 1 + damageBonus;
  overZombie.hpRemaining = Math.max(0, overZombie.hpRemaining - damage);
  const zomDef = getZombie(overZombie.type);
  const sideEffect = zomDef.hooks.onJumpedOver?.(overZombie, state, events) ?? { stun: false };
  if (overZombie.hpRemaining <= 0) {
    state.zombies = state.zombies.filter((z) => z.id !== overZombie.id);
    const killIndex = state.combo;
    activeBuff?.hooks.onZombieKill?.(state, overZombie, killIndex, events);
  } else if (sideEffect.stun) {
    overZombie.stunned = true;
    events.push({ kind: "tank-stun", zombie: overZombie });
  }
  state.scout = { r: jump.lr, c: jump.lc };
  state.kills++;
  setCombo(state, state.combo + 1, "player-action", events);
  state.chainActive = true;
  if (state.quakeArmed) {
    const aoe = activeBuff?.hooks.quakeAoe?.(state) ?? { radius: 1, directions: "ortho" };
    const dirs = aoe.directions === "all" ? DIRS_8 : DIRS_ORTHO;
    const posMap = /* @__PURE__ */ new Map();
    for (const z of state.zombies) posMap.set(`${z.pos.r},${z.pos.c}`, z);
    const victimIds = /* @__PURE__ */ new Set();
    for (const dir of dirs) {
      for (let d = 1; d <= aoe.radius; d++) {
        const ar = state.scout.r + dir.dr * d;
        const ac = state.scout.c + dir.dc * d;
        const victim = posMap.get(`${ar},${ac}`);
        if (victim && !victimIds.has(victim.id)) {
          victimIds.add(victim.id);
          state.kills++;
          const aoeKillIndex = state.combo;
          setCombo(state, state.combo + 1, "player-action", events);
          events.push({ kind: "aoe-kill", pos: { r: ar, c: ac }, killed: victim });
          activeBuff?.hooks.onZombieKill?.(state, victim, aoeKillIndex, events);
        }
      }
    }
    if (victimIds.size > 0) {
      state.zombies = state.zombies.filter((z) => !victimIds.has(z.id));
    }
    state.quakeArmed = false;
  }
  activeBuff?.hooks.onJumpLand?.(state, jump, events);
  applyMilestones(state, events);
  recomputeLegalMoves(state);
}
function setCombo(state, newCombo, source, events) {
  const oldCombo = state.combo;
  if (newCombo === oldCombo) return;
  state.combo = newCombo;
  for (const z of state.zombies) {
    const def = getZombie(z.type);
    def.hooks.onPlayerComboChange?.(z, state, oldCombo, newCombo, source, events);
  }
}
function runOnDeathPrevent(state, activeBuff, events) {
  if (state.phase !== "lose") return false;
  const prevented = activeBuff?.hooks.onDeathPrevent?.(state, events) ?? false;
  if (prevented) {
    state.phase = "playing";
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].kind === "death") {
        events.splice(i, 1);
        break;
      }
    }
  }
  return prevented;
}
function endTurn(state) {
  const events = [];
  if (state.phase !== "playing") return { state, events };
  state.turnsThisLevel++;
  events.push({ kind: "chain-end", finalCombo: state.combo });
  clearMilestones(state);
  setCombo(state, 0, "player-action", events);
  state.chainActive = false;
  if (winCheck(state)) {
    state.phase = "win";
    events.push({ kind: "win" });
    return { state, events };
  }
  const activeBuff = state.buff ? getBuff(state.buff) : null;
  activeBuff?.hooks.onEndTurn?.(state, events);
  for (const z of [...state.zombies]) {
    const def = getZombie(z.type);
    def.hooks.onTurnStart?.(z, state, events);
  }
  runOnDeathPrevent(state, activeBuff, events);
  if (state.phase !== "playing") {
    return { state, events };
  }
  const before = new Map(state.zombies.map((z) => [z.id, { ...z.pos }]));
  runZombieAI(state);
  for (const z of state.zombies) {
    const prev = before.get(z.id);
    if (prev && (z.pos.r !== prev.r || z.pos.c !== prev.c)) {
      events.push({ kind: "zombie-step", zombie: z, from: prev, to: { ...z.pos } });
    }
  }
  for (const z of [...state.zombies]) {
    const def = getZombie(z.type);
    def.hooks.onTurnEnd?.(z, state, events);
  }
  const deathCause = deathCheck(state);
  if (deathCause !== null) {
    const prevented = activeBuff?.hooks.onDeathPrevent?.(state, events) ?? false;
    if (!prevented) {
      state.phase = "lose";
      events.push({ kind: "death", cause: deathCause });
      return { state, events };
    }
  }
  state.lastTurnKills = state.kills;
  recomputeLegalMoves(state);
  return { state, events };
}

// vendor/combo-hopper/src/game/auto-end-turn.ts
function shouldAutoEndTurn(state) {
  if (!state.chainActive) return false;
  return state.legalJumps.length === 0 && state.legalFreeMoves.length === 0 && state.legalWalks.length === 0;
}
var AUTO_END_TURN_DELAY_MS = 800;

// vendor/combo-hopper/src/game/registries/levels-act1.ts
var LEVELS_ACT_1 = [
  {
    id: "level-1",
    name: "Edge of the Path",
    // Layout: 1 walker 直接相邻 scout(tutorial:首关即时 jump)+ 4 walkers row 3 排横
    // 略调 level-curve.md §1 关 1 ASCII(原 5 walker 全 row 3 → 1 挪 row 6),保持 5 walker thesis
    scoutStart: { r: 7, c: 3 },
    rows: 8,
    cols: 8,
    zombies: [
      { pos: { r: 6, c: 3 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 4 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 5 }, type: "walker", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-2",
    name: "Rustling Bushes",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 4 },
    zombies: [
      { pos: { r: 2, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 3 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 5 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 4 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 6 }, type: "walker", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-3",
    name: "Quick Steps",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 4 },
    zombies: [
      { pos: { r: 1, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 1, c: 4 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 5 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 1 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 6 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 5, c: 3 }, type: "walker", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-4",
    name: "Stone Stumps",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 3 },
    zombies: [
      { pos: { r: 1, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 1, c: 5 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 1 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 4 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 3 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 5 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 5, c: 2 }, type: "walker", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-5",
    name: "Ambush Pocket",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 4 },
    zombies: [
      { pos: { r: 1, c: 3 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 1, c: 4 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 5 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 3 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 4 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 6, c: 3 }, type: "crawler", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-6",
    name: "The Heavy One",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 4 },
    zombies: [
      { pos: { r: 1, c: 3 }, type: "tank", hpRemaining: 2, stunned: false },
      { pos: { r: 2, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 5 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 3 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 1 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 3 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 6 }, type: "walker", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-7",
    name: "Chain Builder",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 2 },
    zombies: [
      { pos: { r: 1, c: 4 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 1, c: 6 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 3 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 6 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 3 }, type: "tank", hpRemaining: 2, stunned: false },
      { pos: { r: 5, c: 5 }, type: "crawler", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-8",
    name: "Forest Fork",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 4 },
    zombies: [
      { pos: { r: 1, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 1, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 1, c: 6 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 1 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 2 }, type: "tank", hpRemaining: 2, stunned: false },
      { pos: { r: 3, c: 5 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 1 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 6 }, type: "crawler", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-9",
    name: "Pre-Boss Test",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 4 },
    zombies: [
      { pos: { r: 0, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 0, c: 5 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 1, c: 6 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 1 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 3 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 2 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 6 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 3 }, type: "tank", hpRemaining: 2, stunned: false },
      { pos: { r: 5, c: 4 }, type: "runner", hpRemaining: 1, stunned: false }
    ]
  },
  {
    id: "level-10",
    name: "The Stout Warden",
    rows: 8,
    cols: 8,
    scoutStart: { r: 7, c: 4 },
    zombies: [
      // tank-elite:type 'tank' + hpRemaining 3(数据 override,DEC-034)
      { pos: { r: 1, c: 3 }, type: "tank", hpRemaining: 3, stunned: false },
      { pos: { r: 2, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 2, c: 6 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 3, c: 1 }, type: "crawler", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 3 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 4, c: 6 }, type: "runner", hpRemaining: 1, stunned: false },
      { pos: { r: 5, c: 1 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 5, c: 6 }, type: "walker", hpRemaining: 1, stunned: false },
      { pos: { r: 6, c: 3 }, type: "crawler", hpRemaining: 1, stunned: false }
    ]
  }
];
export {
  AUTO_END_TURN_DELAY_MS,
  LEVELS_ACT_1,
  activateApexMove,
  clickCell,
  createInitialState,
  endTurn,
  recomputeLegalMoves,
  shouldAutoEndTurn
};
