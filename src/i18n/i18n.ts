/**
 * Tiny, dependency-free i18n. The English text *is* the key: components
 * call t("Download PNG") and get the Japanese string when Japanese is on,
 * or the English one otherwise (and as a fallback for anything missing).
 * {name} placeholders are filled from params in both languages.
 *
 * Pure (no React, no DOM) so the lib/ modules can use it too.
 */
import { JA } from "./ja";

export type Lang = "en" | "ja";
export type Params = Record<string, string | number>;
export type Translate = (text: string, params?: Params) => string;

export const LANG_KEY = "kqs.lang";

export function format(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** English: just fills placeholders. The default everywhere, so tests stay in English. */
export const en: Translate = format;

export function translator(lang: Lang): Translate {
  if (lang === "en") return en;
  return (text, params) => format(JA[text] ?? text, params);
}

/** Saved choice first, then the browser's language. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "ja") return saved;
  } catch {
    /* storage disabled */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
}
