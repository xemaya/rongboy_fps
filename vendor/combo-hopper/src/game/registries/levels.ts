import { LevelDef } from '../level';
import { LEVELS_ACT_1 } from './levels-act1';
import { LEVELS_ACT_2 } from './levels-act2';
import { LEVELS_ACT_3 } from './levels-act3';

export type LevelMeta = LevelDef & {
  id: string;
};

// ENG-017 R3: levels.ts 拆分按 act(levels-act{1,2,3}.ts)。
// 30 关数据(CON-006/7/8 实施,严格匹配 team/content/notes/level-curve.md §1-§3)。
// DEC-041:每关 scout 起手 8 邻 ≤ 1 zombie(防进关瞬间围杀)— 见 tests/level.test.ts。
//
// ENG-020:这是**编译进 bundle 的 fallback 包**(无网 / 远端拉失败时的兜底,AC-2),
// 也是远端 entry-campaign.json 的种子(public/levels/entry-campaign.json,AC-7)。
export const BUNDLED_LEVELS: LevelMeta[] = [
  ...LEVELS_ACT_1,
  ...LEVELS_ACT_2,
  ...LEVELS_ACT_3,
];

// ENG-020:active registry —— 运行时可被远端关卡覆盖(setActiveLevels)。
// 默认 = bundled。getLevel / listLevels 读这里,所以注入远端关后全游戏自动用新数据。
// 注意:§1.5 本文件仍是 game 层纯逻辑 —— 只暴露一个 setter,**fetch / localStorage
// 在 app 层(src/level-loader.ts)**,不进这里。
let activeLevels: LevelMeta[] = [...BUNDLED_LEVELS];

// 向后兼容:旧代码 import { LEVEL_REGISTRY } 仍可用,= 当前 active 列表的快照入口。
// 历史上 LEVEL_REGISTRY 是常量;现改为 getter-backed 以反映远端注入。多数读点应改用
// listLevels(),但 level.ts 的 LEVEL_1 等仍引用此名,故保留。
export const LEVEL_REGISTRY: LevelMeta[] = BUNDLED_LEVELS;

/**
 * ENG-020:注入远端拉取 + 校验后的关卡列表,替换 active registry。
 * 由 app 层 loader 在 boot 之前调用(见 src/level-loader.ts → src/main.ts)。
 * 传空数组 = no-op(保持 bundled,防误清空)。
 */
export function setActiveLevels(levels: LevelMeta[]): void {
  if (!levels || levels.length === 0) return;
  activeLevels = [...levels];
}

/** 恢复到编译内置的 30 关(测试 / fallback 复位用)。 */
export function resetActiveLevels(): void {
  activeLevels = [...BUNDLED_LEVELS];
}

export function getLevel(id: string): LevelMeta {
  const lv = activeLevels.find(l => l.id === id);
  if (!lv) throw new Error(`Unknown level: ${id}`);
  return lv;
}

export function listLevels(): LevelMeta[] {
  return [...activeLevels];
}
