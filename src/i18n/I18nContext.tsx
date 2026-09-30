import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANG_KEY, en, initialLang, translator, type Lang, type Translate } from "./i18n";

export interface I18n {
  lang: Lang;
  t: Translate;
  setLang: (lang: Lang) => void;
}

// Defaults to English so components also render outside the provider (tests).
export const I18nContext = createContext<I18n>({ lang: "en", t: en, setLang: () => {} });

export const useI18n = () => useContext(I18nContext);

/** Owns the language state; App puts the result into I18nContext. */
export function useLangState(): I18n {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* storage disabled: language still applies for this visit */
    }
  }, [lang]);
  const t = useMemo(() => translator(lang), [lang]);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  return useMemo(() => ({ lang, t, setLang }), [lang, t, setLang]);
}

/**
 * Fill {name} slots in an already-translated string with React nodes, so
 * a word order that differs between languages can still wrap part of the
 * sentence in <strong>, <code> or a link.
 */
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const m = /^\{(\w+)\}$/.exec(piece);
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : piece}</Fragment>;
  });
}
