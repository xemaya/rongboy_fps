import { State, Zombie } from './types';

/**
 * ENG-016 M5/H3: shared grid + zombie utilities.
 * 抽出避免 rules.ts / buffs.ts / zombies.ts 三份重复(eng-010 M5)。
 * 不依赖任何 registry,所以 rules.ts 和 registries/*.ts 都可以 import。
 */

export function inBounds(state: State, r: number, c: number): boolean {
  return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
}

export function zombieAt(state: State, r: number, c: number): Zombie | null {
  return state.zombies.find(z => z.pos.r === r && z.pos.c === c) ?? null;
}

/**
 * H3 单一 ID strategy:取场上 zombie max id + 1。
 * createInitialState 起始空 zombies → 第一个 spawn 拿 1。无 cross-level 漏号风险。
 */
export function nextZombieId(state: State): number {
  return state.zombies.reduce((m, z) => Math.max(m, z.id), 0) + 1;
}
