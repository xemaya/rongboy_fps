// ENG-020 · 关卡 JSON schema 版本 + 轻量运行时校验(纯逻辑,IO-free)
//
// 这是 LevelMeta 的「序列化契约」:远端 manifest pack 里的关卡 JSON 经此校验
// 后才注入 LEVEL_REGISTRY。schema 以现 TS 类型(LevelMeta / Omit<Zombie,'id'>)
// 为单一真源,JSON 是它的序列化形式(spec §Coordination)。
//
// §1.5:本文件属 game 层,**不做 fetch / 不碰 DOM / 不读 localStorage**。校验是
// 纯函数 — 坏数据返回 null,由上层(level-loader)决定 skip 单关还是整包 fallback。

import type { LevelMeta } from './levels';
import type { Pos } from '../types';
import { ZOMBIE_REGISTRY } from './zombies';

// schemaVersion 单一真源。manifest / pack JSON 的 schemaVersion 必须 === 此值,
// 否则 graceful fallback(AC-3)。schema 字段含义变 → bump 此版本 + 旧客户端拒收。
export const LEVEL_SCHEMA_VERSION = 1;

// 已知 zombie type 集合,从 registry 派生(DRY:加新 zombie type 自动纳入校验)。
const KNOWN_ZOMBIE_TYPES = new Set<string>(ZOMBIE_REGISTRY.map(z => z.id));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function validatePos(raw: unknown, rows: number, cols: number): Pos | null {
  if (!isPlainObject(raw)) return null;
  const { r, c } = raw;
  if (!isInt(r) || !isInt(c)) return null;
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return { r, c };
}

function validateZombie(
  raw: unknown,
  rows: number,
  cols: number,
): LevelMeta['zombies'][number] | null {
  if (!isPlainObject(raw)) return null;
  const pos = validatePos(raw.pos, rows, cols);
  if (!pos) return null;
  if (typeof raw.type !== 'string' || !KNOWN_ZOMBIE_TYPES.has(raw.type)) return null;
  if (!isInt(raw.hpRemaining) || raw.hpRemaining <= 0) return null;
  if (typeof raw.stunned !== 'boolean') return null;

  const z: LevelMeta['zombies'][number] = {
    pos,
    type: raw.type as LevelMeta['zombies'][number]['type'],
    hpRemaining: raw.hpRemaining,
    stunned: raw.stunned,
  };
  // 可选字段:存在则必须是合法 int,否则整条 zombie 视为坏数据
  if (raw.internalTimer !== undefined) {
    if (!isInt(raw.internalTimer)) return null;
    z.internalTimer = raw.internalTimer;
  }
  if (raw.stunTurns !== undefined) {
    if (!isInt(raw.stunTurns) || raw.stunTurns < 0) return null;
    z.stunTurns = raw.stunTurns;
  }
  return z;
}

/**
 * 校验单关 raw JSON → 干净的 LevelMeta,任何结构问题返回 null(由上层 skip 单关)。
 * 不抛异常 — 坏数据不该崩全局(AC-2)。
 */
export function validateLevel(raw: unknown): LevelMeta | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.name !== 'string' || raw.name.length === 0) return null;
  if (!isInt(raw.rows) || raw.rows <= 0) return null;
  if (!isInt(raw.cols) || raw.cols <= 0) return null;

  const scoutStart = validatePos(raw.scoutStart, raw.rows, raw.cols);
  if (!scoutStart) return null;

  if (!Array.isArray(raw.zombies)) return null;
  const zombies: LevelMeta['zombies'] = [];
  for (const zr of raw.zombies) {
    const z = validateZombie(zr, raw.rows, raw.cols);
    if (!z) return null;  // 单只坏 zombie → 整关作废(布局完整性优先)
    zombies.push(z);
  }

  const level: LevelMeta = {
    id: raw.id,
    name: raw.name,
    rows: raw.rows,
    cols: raw.cols,
    scoutStart,
    zombies,
  };

  // ENG-021 (DEC-081):可选 par/star 基准。additive · schemaVersion 仍 1 — 旧 pack 无此
  // 字段照常通过。存在则必须是正整数,否则坏数据整关作废(par 错判星级是 craft 缺陷)。
  if (raw.optimal !== undefined) {
    if (!isInt(raw.optimal) || raw.optimal <= 0) return null;
    level.optimal = raw.optimal;
  }
  if (raw.par !== undefined) {
    if (!isInt(raw.par) || raw.par <= 0) return null;
    level.par = raw.par;
  }

  return level;
}

/**
 * 校验一个 pack(`{ schemaVersion, levels: [...] }`)。
 * - schemaVersion 不匹配 → 返回 null(整包拒收,上层 fallback / 警告)。
 * - levels 里坏关单独 skip(不崩全局),返回所有通过校验的关。
 */
export function validateLevelPack(raw: unknown): {
  ok: boolean;
  schemaMismatch: boolean;
  levels: LevelMeta[];
} {
  if (!isPlainObject(raw) || !Array.isArray(raw.levels)) {
    return { ok: false, schemaMismatch: false, levels: [] };
  }
  if (raw.schemaVersion !== LEVEL_SCHEMA_VERSION) {
    return { ok: false, schemaMismatch: true, levels: [] };
  }
  const levels: LevelMeta[] = [];
  for (const lr of raw.levels) {
    const lv = validateLevel(lr);
    if (lv) levels.push(lv);
  }
  return { ok: levels.length > 0, schemaMismatch: false, levels };
}

/** manifest 校验(`{ schemaVersion, packs: string[] }`)。 */
export function validateManifest(raw: unknown): {
  ok: boolean;
  schemaMismatch: boolean;
  packs: string[];
} {
  if (!isPlainObject(raw) || !Array.isArray(raw.packs)) {
    return { ok: false, schemaMismatch: false, packs: [] };
  }
  if (raw.schemaVersion !== LEVEL_SCHEMA_VERSION) {
    return { ok: false, schemaMismatch: true, packs: [] };
  }
  const packs = raw.packs.filter((p): p is string => typeof p === 'string' && p.length > 0);
  return { ok: packs.length > 0, schemaMismatch: false, packs };
}
