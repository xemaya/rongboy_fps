/**
 * localStorage adapter(GAME-005)
 * - Namespace `rongboy:` 防与其他网页 / 工具冲突
 * - try-catch wrap 防 quota 满 / private browsing / SSR
 * - JSON encode/decode 透明,泛型保 type safety
 *
 * 现存 keys:
 *   - `rongboy:progress:v1` — 元进度(`Progress` 类型)
 *   - `rongboy:banner:<kind>:<id>` — banner 已显示标记(`banner.ts` 内,本文件不管)
 */

const NS = 'rongboy:';

export function load<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(NS + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    // quota 满 / read-only 静默忽略;游戏不应因存档失败崩溃
  }
}

export function remove(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(NS + key);
  } catch {
    // ignore
  }
}
