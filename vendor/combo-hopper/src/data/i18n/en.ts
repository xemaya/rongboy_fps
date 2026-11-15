// REL-002b · EN dict — source of truth for all player-facing strings.
// zh.ts mirrors this shape; missing keys fall back here via the i18n manager.
// CON-009 owns the zh translation (粤语口语风 per DEC-029).
//
// Conventions:
//   - key path uses dotted segments: `buff.<id>.name` / `ui.end-card.win.title`
//   - placeholders are interpolated by the caller (no {0}/%s convention here);
//     e.g. status messages with combo number do their own template-literal
//     interpolation, then pass the result to setStatus().

export const EN_DICT = {
  buff: {
    'long-legs': {
      name: 'Long Legs',
      // CON-012 (用户实测 风格 b):简化,去 milestone 黑话,留数字。
      // edge case "over 2 连续 zombies 只 kill 第 1"(CON-010 F8 / DEC-053 Q1a)
      // 实战体会;若玩家再 raise 重加(handback flag)
      description: 'Jump 3 cells (normally 2).',
    },
    'magnet-boots': {
      name: 'Magnet Boots',
      description: 'Each turn start, nearest zombie steps toward you.',
    },
    'aftershock': {
      name: 'Aftershock',
      description: 'Ground slam reaches 1 cell further.',
    },
    'quick-step': {
      name: 'Quick Step',
      description: 'Walk 2 cells in a line. No diagonal jumps.',
    },
    'soft-landing': {
      name: 'Soft Landing',
      description: 'After your first jump, one neighbor zombie stuns.',
    },
    'lucky-charm': {
      name: 'Lucky Charm',
      description: 'One free save: scout returns to start.',
    },
    'springy-feet': {
      name: 'Springy Feet',
      description: 'Sprint triggers at 2 kills (normally 3).',
    },
    'straight-shooter': {
      name: 'Straight Shooter',
      description: 'Ortho jumps only. Jump 3 cells (normally 2).',
    },
    'ground-pound': {
      name: 'Ground Pound',
      description: 'Turn stuns into kills: every landing wipes stunned zombies in the 4 cells next to you.',
    },
    'coward-pause': {
      name: 'Coward Pause',
      description: 'If you killed 0 last turn, all zombies freeze this turn.',
    },
    'blast-radius': {
      name: 'Blast Radius',
      description: 'Ground slam hits 8 directions (normally 4).',
    },
    'domino': {
      name: 'Domino',
      description: "First kill of a chain stuns the 8 cells around the victim.",
    },
    'headhunter': {
      name: 'Headhunter',
      description: 'Kill a runner: +1 bonus combo.',
    },
    'iron-toe': {
      name: 'Iron Toe',
      description: 'Armor breaker: one-shot tanks, spawners and bosses (HP ≥ 2) you normally can not stomp.',
    },
    'multitool': {
      name: 'Multitool',
      description: 'Jump 3 cells and ground slam reaches 1 cell further.',
    },
    'chain-revive': {
      name: 'Chain Revive',
      description: 'Combo 7 reward grants +1 extra free move (2 total).',
    },
    'yarn-thread': {
      name: 'Yarn Thread',
      description: 'Each kill: every stunned zombie stays frozen +1 turn.',
    },
    'time-rewind': {
      name: 'Time Rewind',
      description: 'One free save per run that keeps your spot: revive right where you stood (Lucky Charm sends you back to start).',
    },
    'final-bow': {
      name: 'Final Bow',
      description: 'At 5+ combo, jump 4 cells.',
    },
    'butterfly-jump': {
      name: 'Butterfly Jump',
      description: 'Turns the combo 7 reward into a kill: instead of a free step, jump over an adjacent zombie for free.',
    },
  },

  zombie: {
    'walker': { name: 'Walker', behavior: 'Walks 1 cell per turn' },
    'runner': { name: 'Runner', behavior: 'Walks 2 cells per turn' },
    'tank': { name: 'Tank', behavior: 'HP 2 — stuns when first hit' },
    'crawler': { name: 'Crawler', behavior: 'Does not move; static obstacle' },
    'shielded': { name: 'Shielded', behavior: 'Only ortho jumps land — diagonals blocked' },
    'bomber': { name: 'Bomber', behavior: 'On death, stuns all 8-neighbor zombies' },
    'spawner': { name: 'Spawner', behavior: 'HP 2 — every 3 turns spawns a walker nearby' },
    'archer': { name: 'Archer', behavior: 'Fires arrow each turn along 8 directions' },
    'boss-warden': { name: 'Warden', behavior: 'HP 4 — spawns a walker each time hit' },
    'boss-leech': { name: 'Leech', behavior: 'HP 5 — drains 1 combo when player reaches ≥3' },
  },

  ui: {
    'buff-picker': {
      prompt: 'Pick a buff to begin',
      'redraw-fmt': 'Re-draw (×{n})',
      'redraw-empty': 'No re-draws left',
    },
    'end-turn': { button: 'END TURN' },
    'hud': {
      kills: 'KILLS',
      combo: 'COMBO',
      buff: 'BUFF',
      // UX-025 (F13+F14): HUD stats — relative level / remaining zombies / steps taken
      level: 'LEVEL',
      zombiesLeft: 'ZOMBIES',
      steps: 'STEPS',
    },
    'end-card': {
      win: {
        'title-fmt': 'Level {n} Clear!',
        'title-all-cleared': 'All Cleared!',
        'msg-cleared-fmt': '{kills} kills, board cleared!',
        'msg-final-fmt': 'Level {n} done · {kills} kills',
        'btn-next': 'Next Level',
        'btn-replay': '↻ Replay',
        'btn-replay-fmt': '↻ Replay Level {n}',
        'btn-back-1': 'Back to Level 1',
      },
      lose: {
        title: 'Defeated',
        'msg-fmt': '{kills} kills.',
        'cause-singular-fmt': 'Surrounded by {n} zombie',
        'cause-plural-fmt': 'Surrounded by {n} zombies',
        // UX-053: distinct cause line when archer onTurnStart kills via
        // a projectile — the surrounded fmts confused the player into
        // thinking they were trapped by a swarm. Reason routing lives
        // in fsm.ts:showEndCard. content may polish phrasing later.
        'cause-projectile-fmt': 'Shot down by an Archer.',
        'btn-retry': '↻ Retry',
      },
    },
    pause: {
      title: 'Paused',
      'btn-resume': 'Resume',
      'btn-restart': 'Restart Level',
      'btn-quit': 'Quit to Level 1',
      // UX-024c: pause "back to main menu" button (Sprint 7 wave 2)
      'btn-back-to-menu': 'Back to Menu',
      'aria-label': 'Pause',
    },
    // UX-006a Main Menu (Sprint 7 wave 2)
    menu: {
      start: 'Start',
      levelSelect: 'Level Select',
      settings: 'Settings',
      quit: 'Quit',
      tagline: 'Rong, wrong forest',
    },
    // UX-006c Level Select (Sprint 7 wave 2)
    levelSelect: {
      title: 'Level Select',
      locked: 'Locked',
      back: 'Back',
    },
    // UX-061 · Star rating (DEC-081). Shown on level-select cells (best
    // earned) and the win end-card (this run's stars + par/optimal context).
    stars: {
      // aria-label on the star row: "{n} of 3 stars"
      'aria-fmt': '{n} of 3 stars',
      // win end-card: this run's turns vs the par/optimal targets
      'turns-fmt': 'Cleared in {turns} turns',
      'optimal-fmt': '3★ in {optimal}',
      'par-fmt': '2★ in {par}',
      // win end-card: best stars on record for this level
      'best-fmt': 'Best: {n}★',
    },
    // UX-006b Settings (Sprint 7 wave 2)
    settings: {
      title: 'Settings',
      language: 'Language',
      music: 'Music',
      sfx: 'SFX',
      back: 'Back',
    },
    // CON-010 F1 (DEC-053):opening 10s 末段 textbox 台词 — UX-023 渲染
    // 调性:童趣 + 紧张但不恐怖(brand 调性 DEC-030);brand 自称 "Rongboy" 锁
    opening: {
      line1: 'Zombies?! In my forest?!',
      line2: 'Better hop careful, Rongboy.',
      // UX-030 (R14) Fix 2: press-key prompt at opening end
      pressKey: 'Tap to start your adventure',
    },
    // UX-041: rules modal text-card title — displayed to player.
    // `ui.rules.title` (aria/alt fallback "Game rules") is kept as a
    // separate, accessibility-only label; this new key is the visible
    // header on the felt card.
    rules: {
      'title-display': 'How to Play',
    },
    // UX-064: rotate-to-landscape hint overlay (touch + portrait only,
    // web/itch mobile visitors). Desktop never sees this.
    orientation: {
      title: 'Rotate your phone',
      sub: 'Rongboy plays best in landscape.',
    },
  },

  status: {
    'click-first-jump': 'Click a yellow cell to start your first jump',
    'click-highlight': 'Click highlight (yellow = jump / or walk)',
    'chain-spent': 'Chain spent — press END TURN',
    'combo-fmt': 'Combo ×{combo} — continue or END TURN',
    'apex-prompt': 'Apex! Click any 8-neighbor empty cell for a free move / or keep jumping',
  },

  banner: {
    'lucky-charm': {
      title: 'Lucky Charm Activated!',
      sub: 'Scout returned to start',
    },
    danger: 'DANGER · zombies closing in',
  },

  milestone: {
    surge: 'Surge!',
    quake: 'Quake!',
    apex: 'Apex!',
  },

  // 5 core rules — 给 ART-018 / Sprint 7 ART-020 重出 infographic 用
  // CON-011 (DEC-054 Q2c):6 → 5 条,删原 #4 'Walking ends...'(F20 用户实测意义不明)
  // walk vs jump 区别仍由 levelIntro['1'] hot loop 教程承载
  rules: {
    '1': 'Click a yellow cell to leap over a zombie.',
    '2': 'Chain leaps = combo.',
    '3': '2 zombies in your 8 neighbors at turn end = surrounded.',
    '4': 'Pick a buff each level; clear levels to unlock more.',
    '5': 'Master all 30 levels.',
  },

  tutorial: {
    zombieIntro: {
      walker: 'Walkers shuffle one square per turn.',
      runner: "Runners dart two squares. They'll catch up fast.",
      tank: 'Tanks shrug off the first jump. Hop twice.',
      crawler: 'Crawlers stay put. Use them as stepping stones.',
      shielded: 'Shielded zombies only let you jump straight over.',
      bomber: 'Bombers burst on death. Neighbors freeze for a turn.',
      spawner: 'Spawners hatch a walker every three turns.',
      archer: 'Archers shoot a line each turn. Stay off it.',
      'boss-warden': 'The Warden calls a walker each time you jump it.',
      'boss-leech': 'The Leech sips one combo when you stack three.',
    },
    milestoneIntro: {
      surge: 'Surge! Your next jumps stretch to three squares.',
      quake: 'Quake armed. Your next landing rattles the squares nearby.',
      apex: 'Apex! Pick any empty neighbor and step onto it.',
    },
    levelIntro: {
      // CON-010 F5 (DEC-053 Q2a):强调 jump 必须 over **same-direction adj zombie**,
      // 落点在 zombie 直线后 — 关 1 是 player 首次见 yellow cell,hot loop 最自然
      '1': 'Click a yellow square — jumps go straight past the zombie.',
      '2': 'Chain three kills to wake the Surge.',
      '3': 'Runners catch up fast. Open a chain quickly.',
    },
    deathHints: [
      'The forest is patient.',
      'Rong, wrong forest. Try again.',
      'Shadows knew your stitches.',
      'One stitch loose. The thread will hold next time.',
      'Stillness keeps no secrets.',
      'Even small dolls leave footprints.',
      'Rongboy, breathe. The forest waits.',
    ],
  },

  // UX-006c · Sprint 7 wave 2 · R2 closed.
  // 30 level names mirroring `LEVEL_REGISTRY[i].name` in registries/levels.ts.
  // Keyed by 1-indexed level number so callers can do `t('levels.' + n)`.
  levels: {
    '1':  'Edge of the Path',
    '2':  'Rustling Bushes',
    '3':  'Quick Steps',
    '4':  'Stone Stumps',
    '5':  'Ambush Pocket',
    '6':  'The Heavy One',
    '7':  'Chain Builder',
    '8':  'Forest Fork',
    '9':  'Pre-Boss Test',
    '10': 'The Stout Warden',
    '11': 'Shielded Patrol',
    '12': 'Cross-Fire',
    '13': 'Ticking Trap',
    '14': 'Chain Reaction',
    '15': 'Locked Squares',
    '16': 'Apex Test',
    '17': 'Garden of Brood',
    '18': 'Roach Spread',
    '19': 'Pre-Warden Gauntlet',
    '20': 'The Crypt Warden',
    '21': 'Whispers Among Trees',
    '22': 'First Arrow',
    '23': 'Line of Sight',
    '24': 'Stone Sentinels',
    '25': 'The Brood Master',
    '26': 'Shielded Volley',
    '27': 'Threading the Needle',
    '28': 'Combo Drought',
    '29': 'Final Gauntlet',
    '30': 'The Soul Leech',
  },
} as const;

export type Dict = typeof EN_DICT;
