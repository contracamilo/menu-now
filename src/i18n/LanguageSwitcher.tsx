import type { Lang } from './I18nProvider';
import { useI18n } from './useT';

const langs: Lang[] = ['en', 'es'];

/** Selector de idioma: dos botones con `aria-pressed` (design D10). */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label={t('lang.label')}>
      {langs.map((code) => (
        <button
          key={code}
          type="button"
          className="tap-target lang-switcher__button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {t(`lang.${code}`)}
        </button>
      ))}
    </div>
  );
}
