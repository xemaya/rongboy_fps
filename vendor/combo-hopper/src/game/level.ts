import { Zombie } from './types';
import { LEVEL_REGISTRY } from './registries/levels';

export type LevelDef = {
  name: string;
  rows: number;
  cols: number;
  scoutStart: { r: number; c: number };
  zombies: Omit<Zombie, 'id'>[];
  // ENG-021 (DEC-081):谜题质量 par/star 基准。**可选 · additive**(schemaVersion 仍 1,
  // 旧 pack 无此字段不崩)。来源 = GAME-019 quality-export.json,由 tools/export-levels.ts
  // 注入种子包;CON-017/GAME-020 周更包/编辑器可 authored 覆写。
  //   optimal — 全 buff 最小通关回合(turns)→ 3★ 阈值
  //   par     — 2★ 阈值;缺省 = optimal + PAR_GRACE(见 src/game/star.ts)
  optimal?: number;
  par?: number;
};

export { LEVEL_REGISTRY as LEVELS, getLevel, listLevels } from './registries/levels';

export const LEVEL_1 = LEVEL_REGISTRY.find(l => l.id === 'level-1')!;
