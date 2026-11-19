import type { TFunction } from '../../i18n/I18nProvider';

/** Tiempo transcurrido (design D8): «Ahora mismo», «{m} min» o, desde una hora, «{h} h {m} min». */
export function formatElapsed(ms: number, t: TFunction): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t('kitchen.justNow');
  if (minutes < 60) return t('kitchen.minutes', { m: minutes });
  return t('kitchen.hoursMinutes', { h: Math.floor(minutes / 60), m: minutes % 60 });
}
