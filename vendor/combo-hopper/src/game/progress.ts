import type { BuffDef } from './registries/buffs';
import type { Star } from './star';

/**
 * 跨局元进度数据(GAME-005)。
 * - localStorage 持久化(无云存档,DEC-015)
 * - 玩家通关关 N → `markCleared(progress, N)` → `highestCleared` 自动更新
 * - buff picker 通过 `getUnlockedBuffs(BUFFS, highestCleared)` filter 已解锁的
 *
 * Pure data + pure functions —— 不触 localStorage(那是 `src/ui/storage.ts` 的事),
 * 不 import 任何 ui/ 模块(HARNESS §1.5)。
 */

export type Progress = {
  clearedLevels: number[];   // 已通关关号(递增 sorted unique)
  highestCleared: number;    // = max(clearedLevels) 或 0(初始)
  // ENG-021 (DEC-081):每关历史最好星级,key = LevelMeta.id(string · 远端包 id 稳定),
  // value = 1|2|3。未通关的关不在此 map(getBestStar 返 0)。additive — 旧存档无此字段时
  // normalizeProgress 补 {}(向后兼容,不 bump key)。
  bestStars: Record<string, Star>;
};

export const DEFAULT_PROGRESS: Progress = {
  clearedLevels: [],
  highestCleared: 0,
  bestStars: {},
};

/**
 * 标记关 N 已通关,返回新 Progress(immutable;旧 progress 不动)。
 * - 若 N 已在 clearedLevels 内 → 直接返原 progress(idempotent)
 * - 否则 push + 升序 sort,highestCleared 更新
 */
export function markCleared(progress: Progress, levelN: number): Progress {
  if (progress.clearedLevels.includes(levelN)) return progress;
  const newCleared = [...progress.clearedLevels, levelN].sort((a, b) => a - b);
  return {
    ...progress,  // 保留 bestStars 等附加字段
    clearedLevels: newCleared,
    highestCleared: Math.max(progress.highestCleared, levelN),
  };
}

/**
 * ENG-021:记录某关一次通关星级,与历史最好取大(immutable)。
 * - levelId = LevelMeta.id(string),star ∈ {1,2,3}
 * - 新星级 ≤ 已存最好 → 返回原 progress(idempotent · 防多余 save)
 */
export function recordStar(progress: Progress, levelId: string, star: Star): Progress {
  const prev = progress.bestStars[levelId] ?? 0;
  if (star <= prev) return progress;
  return {
    ...progress,
    bestStars: { ...progress.bestStars, [levelId]: star },
  };
}

/**
 * ENG-021:读某关历史最好星级。未通关返 0(给 UX-061 level-select 显示)。
 */
export function getBestStar(progress: Progress, levelId: string): 0 | Star {
  return progress.bestStars[levelId] ?? 0;
}

/**
 * ENG-021:补齐旧存档缺失的附加字段(向后兼容 · 不 bump localStorage key)。
 * 老 `progress:v1` 数据无 bestStars → 补 {}。load() 后调用,防 undefined 访问。
 */
export function normalizeProgress(raw: Partial<Progress> | null | undefined): Progress {
  return {
    clearedLevels: Array.isArray(raw?.clearedLevels) ? raw!.clearedLevels : [],
    highestCleared: typeof raw?.highestCleared === 'number' ? raw!.highestCleared : 0,
    bestStars: raw?.bestStars && typeof raw.bestStars === 'object' ? raw.bestStars : {},
  };
}

/**
 * 给定 buff 全集 + 当前 highestCleared,返回已解锁的 buff 子集。
 * - buff.unlockLevel = 0 → 总是解锁(starter)
 * - buff.unlockLevel ≤ highestCleared → 解锁
 * - GAME-015 / DEC-073:enabled === false 的 buff 暂移出可选池(soft-disable,实现保留可逆)
 */
export function getUnlockedBuffs(buffs: BuffDef[], highestCleared: number): BuffDef[] {
  return buffs.filter(b => b.enabled !== false && b.unlockLevel <= highestCleared);
}

/** Reset 元进度到初始态(dev / `?resetProgress` URL param 用) */
export function clearProgress(): Progress {
  return { ...DEFAULT_PROGRESS, clearedLevels: [], bestStars: {} };
}
