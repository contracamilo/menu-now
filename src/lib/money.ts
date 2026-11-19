import { translate, type Lang } from '../i18n/I18nProvider';
import type { Dish } from './types';

const locales: Record<Lang, string> = { es: 'es-ES', en: 'en-IE' };
const formatters = new Map<Lang, Intl.NumberFormat>();

/** «2,50 €» en español, «€2.50» en inglés (design D8). */
export function formatPrice(cents: number, lang: Lang): string {
  let formatter = formatters.get(lang);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locales[lang], { style: 'currency', currency: 'EUR' });
    formatters.set(lang, formatter);
  }
  return formatter.format(cents / 100);
}

export type ParsedPrice = { cents: number } | { error: 'error.price' | 'error.priceZero' };

/**
 * Convierte lo que escribe el dueño («2,50», «2.5», «3») en céntimos.
 * Acepta coma o punto decimal y como máximo dos decimales; rechaza 0, negativos y texto.
 */
export function parsePriceToCents(input: string): ParsedPrice {
  const match = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return { error: 'error.price' };
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents > 0 ? { cents } : { error: 'error.priceZero' };
}

/** Céntimos → texto editable en el formulario («2,50» / «2.50»). */
export function centsToInput(cents: number, lang: Lang): string {
  const text = (cents / 100).toFixed(2);
  return lang === 'es' ? text.replace('.', ',') : text;
}

/**
 * Líneas de precio de un plato en la carta (design D6):
 * un tamaño sin nombre → «1,80 €»; con nombre → «Ración · 7,00 €»; varios → una línea por
 * tamaño en su orden; plato incluido → el texto del dueño, sin precio.
 */
export function priceLines(dish: Pick<Dish, 'included_with' | 'dish_sizes'>, lang: Lang): string[] {
  if (dish.included_with) return [dish.included_with];
  return [...dish.dish_sizes]
    .sort((a, b) => a.position - b.position)
    .map((size) => {
      const price = formatPrice(size.price_cents, lang);
      return size.label ? translate(lang, 'menu.sizePrice', { size: size.label, price }) : price;
    });
}
