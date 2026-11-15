// ENG-021 · 星级裁决(DEC-081 口径)· game 层纯函数(无 IO / 无 DOM · §1.5)
//
// 口径(DEC-081):
//   3★ = optimal —— turnsUsed ≤ optimal(全 buff 最小通关回合)
//   2★ = par     —— turnsUsed ≤ par;par 缺省 = optimal + PAR_GRACE
//   1★ = 通关    —— 其余(只要赢了就 ≥ 1★)
//
// optimal/par 数据源:GAME-019 quality-export.json → tools/export-levels.ts 注入种子包
// (LevelMeta.optimal / .par)。两者皆缺(老 bundled fallback 关无此字段)→ 退化为 1★,
// 不崩 —— 通关仍记 1★(AC-3 graceful)。

// DEC-081:2★ 宽限回合。per-level authored par 覆写优先(LevelMeta.par);无则 optimal+此值。
export const PAR_GRACE = 2;

export type Star = 1 | 2 | 3;

export type StarBasis = {
  optimal?: number;
  par?: number;
};

/**
 * 给定本关用掉的回合数 turnsUsed + 该关 par/optimal 基准,算星级(DEC-081)。
 * 纯函数 —— 调用方负责"只在通关(win)时调用"。turnsUsed 应为通关那一刻的回合计数。
 */
export function computeStar(turnsUsed: number, basis: StarBasis): Star {
  const { optimal, par } = basis;

  // 3★:达到/优于全 buff 最优。optimal 缺失则无法判 3★。
  if (optimal !== undefined && turnsUsed <= optimal) return 3;

  // 2★:authored par 优先,否则 optimal + PAR_GRACE。两者皆无 → 跳过(只能 1★)。
  const effectivePar = par ?? (optimal !== undefined ? optimal + PAR_GRACE : undefined);
  if (effectivePar !== undefined && turnsUsed <= effectivePar) return 2;

  // 1★:通关即得。
  return 1;
}
