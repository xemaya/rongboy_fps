// REL-002b · simple i18n manager.
//
// Design (DEC-050 简版 — 无 react-i18next 等重依赖):
//   - Static import of EN_DICT + ZH_DICT (no async load)
//   - t(key, fallback?) walks dotted key path; fallback chain:
//       current lang dict → EN dict (always available) → explicit fallback → key
//   - setLanguage('en' | 'zh') flips currentDict + saves to localStorage
//   - Auto-detect on initI18n(): localStorage > ?lang= URL param > navigator.language
//
// Storage key is `rongboy:lang` (the storage adapter adds the `rongboy:` prefix).
// Re-render on language change is the caller's responsibility (most player-facing
// strings are re-resolved during their next render anyway; full-screen flips
// after setLanguage typically come with a reload).

import { EN_DICT, ZH_DICT } from '../data/i18n';
import { load, save } from '../ui/storage';

export type Lang = 'en' | 'zh';
const LANG_STORAGE_KEY = 'lang';

let currentLang: Lang = 'en';
let currentDict: unknown = EN_DICT;

function detectLang(): Lang {
  // ?lang=en|zh URL param overrides everything else (dev/QA helper, AC-3 opt).
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang === 'en' || urlLang === 'zh') return urlLang;
  }
  const saved = load<Lang | null>(LANG_STORAGE_KEY, null);
  if (saved === 'en' || saved === 'zh') return saved;
  const sys = typeof navigator !== 'undefined' ? (navigator.language ?? 'en') : 'en';
  return sys.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function initI18n(): void {
  currentLang = detectLang();
  currentDict = currentLang === 'zh' ? ZH_DICT : EN_DICT;
}

function lookup(dict: unknown, parts: string[]): string | undefined {
  let val: unknown = dict;
  for (const p of parts) {
    if (val === null || typeof val !== 'object') return undefined;
    val = (val as Record<string, unknown>)[p];
    if (val === undefined) return undefined;
  }
  return typeof val === 'string' ? val : undefined;
}

export function t(keyPath: string, fallback?: string): string {
  const parts = keyPath.split('.');
  // current lang first
  const fromCurrent = lookup(currentDict, parts);
  if (fromCurrent !== undefined) return fromCurrent;
  // fallback to EN dict (always available — source of truth)
  if (currentDict !== EN_DICT) {
    const fromEn = lookup(EN_DICT, parts);
    if (fromEn !== undefined) return fromEn;
  }
  // explicit fallback or key itself
  return fallback ?? keyPath;
}

/**
 * Lookup that walks an array — used for tutorial.deathHints[i] which the
 * EN dict stores as a string[]. Returns fallback / `key[i]` placeholder if
 * the index is out of range or the path doesn't resolve to an array.
 */
export function tArrayItem(keyPath: string, index: number, fallback?: string): string {
  const parts = keyPath.split('.');
  const resolve = (dict: unknown): string | undefined => {
    let val: unknown = dict;
    for (const p of parts) {
      if (val === null || typeof val !== 'object') return undefined;
      val = (val as Record<string, unknown>)[p];
      if (val === undefined) return undefined;
    }
    if (Array.isArray(val) && index >= 0 && index < val.length) {
      const item = val[index];
      return typeof item === 'string' ? item : undefined;
    }
    return undefined;
  };
  const fromCurrent = resolve(currentDict);
  if (fromCurrent !== undefined) return fromCurrent;
  if (currentDict !== EN_DICT) {
    const fromEn = resolve(EN_DICT);
    if (fromEn !== undefined) return fromEn;
  }
  return fallback ?? `${keyPath}[${index}]`;
}

/**
 * Length of an array node (for callers iterating deathHints etc).
 * Returns 0 if the key doesn't resolve to an array.
 */
export function tArrayLength(keyPath: string): number {
  const parts = keyPath.split('.');
  let val: unknown = currentDict;
  for (const p of parts) {
    if (val === null || typeof val !== 'object') return 0;
    val = (val as Record<string, unknown>)[p];
    if (val === undefined) {
      // fall back to EN dict
      val = EN_DICT;
      for (const q of parts) {
        if (val === null || typeof val !== 'object') return 0;
        val = (val as Record<string, unknown>)[q];
        if (val === undefined) return 0;
      }
      break;
    }
  }
  return Array.isArray(val) ? val.length : 0;
}

export function setLanguage(lang: Lang): void {
  currentLang = lang;
  currentDict = lang === 'zh' ? ZH_DICT : EN_DICT;
  save(LANG_STORAGE_KEY, lang);
}

export function getLanguage(): Lang {
  return currentLang;
}
