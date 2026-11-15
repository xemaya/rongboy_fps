import { getBuff } from './registries/buffs';
import { getZombie } from './registries/zombies';
import type { BuffId, ZombieType } from './types';
import { t } from '../i18n';

/**
 * Tooltip data API(DEC-036 Q3)— UI 调用查 buff / zombie 的可显示详情。
 * 不读 hook 实现,只返 metadata + hook 名称列表(供 "uses: X, Y" 类显示)。
 */

export type BuffTooltipData = {
  id: BuffId;
  name: string;
  description: string;
  tier: 'starter' | 'uncommon' | 'rare';
  hooksUsed: string[];
};

export type ZombieTooltipData = {
  type: ZombieType;
  name: string;
  initialHp: number;
  behaviorSummary: string;
  hooksUsed: string[];
};

export function getBuffTooltipData(id: BuffId): BuffTooltipData {
  const def = getBuff(id);
  return {
    id,
    name: def.name,
    description: def.description,
    tier: def.tier ?? 'starter',
    hooksUsed: Object.keys(def.hooks),
  };
}

/**
 * Zombie display metadata is resolved through the i18n dict each call
 * (REL-002b). EN strings live in `src/data/i18n/en.ts`; zh dict (CON-009)
 * mirrors the same shape. The dict fallback chain in `t()` returns EN when
 * a zh key is missing, so the UI never shows the raw key.
 */

export function getZombieTooltipData(type: ZombieType): ZombieTooltipData {
  const def = getZombie(type);
  return {
    type,
    name: t(`zombie.${type}.name`, type),
    initialHp: def.initialHp,
    behaviorSummary: t(`zombie.${type}.behavior`, ''),
    hooksUsed: Object.keys(def.hooks),
  };
}
