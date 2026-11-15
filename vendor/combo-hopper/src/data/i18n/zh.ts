// CON-009 · zh 字典(粤语口语风,DEC-029)
//
// 同 shape mirror `src/data/i18n/en.ts` EN_DICT,manager.ts t() 调用走 zh
// → EN fallback 链(zh 漏 key 自动用 EN 顶住,不爆 undefined)。
//
// 调性约定(DEC-029 / DEC-030):
//   - 粤语口语风(eg "嘅" / "咗" / "点" / "啦"),不用书面普通话
//   - 童趣 + 禁忌的弧线(felt 玩具 + 神秘森林)
//   - brand 字 "Rongboy" / "Rong, wrong forest" / "绒仔" 不译(锁 brand)
//   - 简洁,不啰嗦
//
// 同 shape 由 `tests/i18n-dict.test.ts` 守门(深 key set 对照 EN_DICT)。

export const ZH_DICT = {
  buff: {
    'long-legs': {
      name: '长脚',
      // CON-012 (用户实测 风格 b):简化,去 milestone 黑话,留数字。
      // edge case "一线 2 连续僵尸只杀第 1"(CON-010 F8 / DEC-053 Q1a)
      // 实战体会;若玩家再 raise 重加(handback flag)
      description: '能跳 3 格(平时 2 格)。',
    },
    'magnet-boots': {
      name: '磁靴',
      description: '每回合开始,最近嗰只僵尸行近你 1 步。',
    },
    'aftershock': {
      name: '余震',
      description: '震地多波及 1 圈。',
    },
    'quick-step': {
      name: '疾步',
      description: '走 2 格直线;本回合唔跳斜。',
    },
    'soft-landing': {
      name: '软落',
      description: '起手第一跳,定身旁边一只僵尸。',
    },
    'lucky-charm': {
      name: '幸运符',
      description: '一次免死:绒仔翻去起手位。',
    },
    'springy-feet': {
      name: '弹簧脚',
      description: '连杀 2 只就触发冲刺(原本 3 只)。',
    },
    'straight-shooter': {
      name: '直射',
      description: '净系正交跳;能跳 3 格(平时 2 格)。',
    },
    'ground-pound': {
      name: '震地踏',
      description: '定咗就当杀:每次落地清走脚边正交 4 格嘅定身僵尸。',
    },
    'coward-pause': {
      name: '怯停',
      description: '上回合零杀?咁今回合僵尸全部定。',
    },
    'blast-radius': {
      name: '扩爆',
      description: '震地波及四周 8 格(平时 4 格)。',
    },
    'domino': {
      name: '多米诺',
      description: '链中第一杀,佢周围 8 格僵尸全部定身。',
    },
    'headhunter': {
      name: '猎首',
      description: '杀奔行者额外 +1 连击。',
    },
    'iron-toe': {
      name: '铁尖鞋',
      description: '破甲一击:平时踩唔死嘅重装兵 / 巢 / Boss(血 ≥ 2),一跳即死。',
    },
    'multitool': {
      name: '多功能',
      description: '能跳 3 格,震地多波及 1 圈。',
    },
    'chain-revive': {
      name: '链重生',
      description: '7 连击奖励多送一次自由移动(共 2 次)。',
    },
    'yarn-thread': {
      name: '毛线串',
      description: '每杀一只,场上定咗嘅僵尸再停一回合。',
    },
    'time-rewind': {
      name: '时回',
      description: '本局一次免死,原地翻生唔挪位、守住辛苦行到嘅好位(幸运符系弹翻起手)。',
    },
    'final-bow': {
      name: '终章弓',
      description: '连击 5 以上,能跳 4 格。',
    },
    'butterfly-jump': {
      name: '蝶跳',
      description: '7 连击奖励变杀招:唔系免费行一步,而系免费跨过旁边僵尸杀多一只。',
    },
  },

  zombie: {
    'walker': { name: '行走者', behavior: '每回合行 1 格。' },
    'runner': { name: '奔行者', behavior: '每回合行 2 格。' },
    'tank': { name: '重装兵', behavior: '血量 2,首跳净系定身。' },
    'crawler': { name: '爬行者', behavior: '唔郁,纯做障碍。' },
    'shielded': { name: '持盾者', behavior: '净系正交跳得过,对角免问。' },
    'bomber': { name: '炸弹客', behavior: '死嗰阵,周围 8 邻僵尸全部定。' },
    'spawner': { name: '召唤巢', behavior: '血量 2,每 3 回合附近召出一只行走者。' },
    'archer': { name: '弓手', behavior: '每回合 8 个方向射一支箭。' },
    'boss-warden': { name: '守墓巨像', behavior: '血量 4,每被跳一次召出一只行走者。' },
    'boss-leech': { name: '噬连兽', behavior: '血量 5,你连击到 3 即抽走 1。' },
  },

  ui: {
    'buff-picker': {
      prompt: '拣件道具开局啦',
      'redraw-fmt': '换一批 (×{n})',
      'redraw-empty': '冇得再换喇',
    },
    'end-turn': { button: '结束回合' },
    'hud': {
      kills: '杀数',
      combo: '连击',
      buff: '道具',
      // UX-025 (F13+F14): 粤语口语 — 关数 / 剩余 / 步数
      level: '关数',
      zombiesLeft: '剩余',
      steps: '步数',
    },
    'end-card': {
      win: {
        'title-fmt': '第 {n} 关清咗!',
        'title-all-cleared': '全部清晒!',
        'msg-cleared-fmt': '杀咗 {kills} 只,棋盘清光!',
        'msg-final-fmt': '第 {n} 关搞掂 · 杀咗 {kills} 只',
        'btn-next': '下一关',
        'btn-replay': '↻ 重玩',
        'btn-replay-fmt': '↻ 重玩第 {n} 关',
        'btn-back-1': '返第 1 关',
      },
      lose: {
        title: '败咗',
        'msg-fmt': '杀咗 {kills} 只。',
        'cause-singular-fmt': '俾 {n} 只僵尸围住',
        'cause-plural-fmt': '俾 {n} 只僵尸围住',
        // UX-053(粤语口语 DEC-029)· content 可润色
        'cause-projectile-fmt': '俾弓箭射死。',
        'btn-retry': '↻ 再嚟',
      },
    },
    pause: {
      title: '暂停咗',
      'btn-resume': '继续',
      'btn-restart': '重玩本关',
      'btn-quit': '返第 1 关',
      // UX-024c: pause "回主菜单" button(粤语口语 DEC-029)
      'btn-back-to-menu': '返主菜单',
      'aria-label': '暂停',
    },
    // UX-006a Main Menu(粤语口语风 DEC-029)
    menu: {
      start: '开始',
      levelSelect: '选关',
      settings: '设置',
      quit: '走人',
      tagline: '绒仔唔好乱嚟!',
    },
    // UX-006c Level Select(粤语口语风 DEC-029)
    levelSelect: {
      title: '选关',
      locked: '未解锁',
      back: '返主菜单',
    },
    // UX-061 · 星级(DEC-081 · 粤语口语 DEC-029)。选关格显最好成绩,
    // 通关结算卡显本次星级 + par/optimal 提示。
    stars: {
      'aria-fmt': '3 粒星攞咗 {n} 粒',
      'turns-fmt': '{turns} 回合清咗',
      'optimal-fmt': '{optimal} 回合摞 3★',
      'par-fmt': '{par} 回合摞 2★',
      'best-fmt': '最好:{n}★',
    },
    // UX-006b Settings(粤语口语风 DEC-029)
    settings: {
      title: '设置',
      language: '语言',
      music: '音乐',
      sfx: '音效',
      back: '返主菜单',
    },
    // CON-010 F1 (DEC-053):opening 末段 textbox 台词(粤语口语风 DEC-029)
    // 调性:童趣 + 紧张但不恐怖;brand 自称 "绒仔" 锁(DEC-030)
    opening: {
      line1: '吓!点解会有僵尸㗎?!',
      line2: '绒仔,小心啲跳啦...',
      // UX-030 (R14) Fix 2: press-key 提示(粤语口语 DEC-029)
      pressKey: '点一下开始探险',
    },
    // UX-041: rules modal text-card title(粤语口语 DEC-029)
    rules: {
      'title-display': '点玩',
    },
    // UX-064: 转横屏引导遮罩(粤语口语 DEC-029,只对触屏竖屏出)
    orientation: {
      title: '转横屏玩',
      sub: '绒仔横屏玩先爽。',
    },
  },

  status: {
    'click-first-jump': '点黄色格仔嚟跳第一下',
    'click-highlight': '点高光位(黄色 = 跳 / 或者走)',
    'chain-spent': '链用晒啦 — 点「结束回合」',
    'combo-fmt': '连击 ×{combo} — 继续或者「结束回合」',
    'apex-prompt': '极!点 8 邻任何一个空格做免费移动 / 或者继续跳',
  },

  banner: {
    'lucky-charm': {
      title: '幸运符触发咗!',
      sub: '绒仔翻去起手位',
    },
    danger: '危险 · 僵尸围埋嚟',
  },

  milestone: {
    surge: '猛冲!',
    quake: '震!',
    apex: '极!',
  },

  // 5 core rules · 给 ART-018 / Sprint 7 ART-020 重出 infographic(粤语口语,DEC-029)
  // CON-011 (DEC-054 Q2c):6 → 5,删原 #4 '走/跳'(F20 用户实测意义不明)
  rules: {
    '1': '点黄色格仔,跳过僵尸。',
    '2': '连续跳 = 连击。',
    '3': '回合结束时,8 邻有 2 只或以上僵尸 = 围杀。',
    '4': '每关拣一件道具;通关解锁更多。',
    '5': '搞掂 30 关。',
  },

  tutorial: {
    zombieIntro: {
      walker: '行走者每回合行 1 格,慢慢地。',
      runner: '奔行者一跃 2 格,追得快。',
      tank: '重装兵首跳唔死,跳两下先郁得到。',
      crawler: '爬行者定喺度唔郁,做你嘅跳脚石。',
      shielded: '持盾者净系俾你正交跳过,对角免问。',
      bomber: '炸弹客死嗰阵爆,旁边僵尸定一回合。',
      spawner: '召唤巢每 3 回合孵一只行走者出嚟。',
      archer: '弓手每回合射一条直线,行开佢。',
      'boss-warden': '守墓巨像每被跳一次,就召一只行走者嚟撑场。',
      'boss-leech': '噬连兽喺你连击到 3,即刻吸走 1。',
    },
    milestoneIntro: {
      surge: '猛冲!之后嘅跳可以 3 格远。',
      quake: '震蓄势咗。下一跳落地,附近格仔会震。',
      apex: '极!揀任何一个空邻格,行过去。',
    },
    levelIntro: {
      // CON-010 F5 (DEC-053 Q2a):跳必须直线 over zombie,落点在僵尸正后方
      '1': '点黄色格仔 — 跳系直线,落僵尸正后方。',
      '2': '连杀 3 只,叫醒猛冲。',
      '3': '奔行者追得快,快啲开链。',
    },
    deathHints: [
      '森林好有耐性。',
      'Rong, wrong forest. 再嚟过。',
      '阴影认得你嗰啲针线。',
      '一针松咗。下次条线会顶住。',
      '唔郁守唔住秘密。',
      '再细嘅布偶都会留低脚印。',
      'Rongboy,唞下气。森林等紧你。',
    ],
  },

  // UX-006c · Sprint 7 wave 2 · R2 closed.
  // 30 关名 zh(粤语口语风 DEC-029 — 关名以描述为主,口语 flavor 见 menu/ui)
  levels: {
    '1':  '山林边',
    '2':  '灌木簌簌',
    '3':  '快步走',
    '4':  '石墩林',
    '5':  '埋伏袋',
    '6':  '大块头',
    '7':  '连击教学',
    '8':  '林间岔路',
    '9':  'Boss 前哨',
    '10': '壮硕守林人',
    '11': '盾兵巡逻',
    '12': '交叉火',
    '13': '倒数炸弹',
    '14': '连锁反应',
    '15': '锁格',
    '16': '极境试炼',
    '17': '卵阵花园',
    '18': '蟑螂蔓延',
    '19': '守林人前哨',
    '20': '墓地守林人',
    '21': '林间私语',
    '22': '第一箭',
    '23': '视线之内',
    '24': '石哨兵',
    '25': '卵阵主宰',
    '26': '盾兵齐射',
    '27': '穿针引线',
    '28': '连击枯井',
    '29': '终末试炼',
    '30': '灵魂吸血鬼',
  },
} as const;
