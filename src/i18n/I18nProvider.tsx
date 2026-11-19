import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { es, type MessageKey, type Messages } from './es';
import { en } from './en';

export type Lang = 'es' | 'en';
/** Cada zona tiene su idioma por defecto y recuerda su elección por separado (design D8). */
export type Zone = 'menu' | 'admin';

const dictionaries: Record<Lang, Messages> = { es, en };
const defaultLang: Record<Zone, Lang> = { menu: 'en', admin: 'es' };

export const storageKey = (zone: Zone) => `menu-now.lang.${zone}`;

function readStoredLang(zone: Zone): Lang {
  try {
    const stored = localStorage.getItem(storageKey(zone));
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    /* almacenamiento no disponible: idioma por defecto */
  }
  return defaultLang[zone];
}

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

export interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = dictionaries[lang][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function I18nProvider({ zone, children }: { zone: Zone; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang(zone));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(storageKey(zone), next);
      } catch {
        /* sin persistencia: la elección dura lo que la pestaña */
      }
    },
    [zone],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
