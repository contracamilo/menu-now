import { describe, expect, it } from 'vitest';
import { centsToInput, formatPrice, parsePriceToCents, priceLines } from './money';

// Intl usa espacios duros; se normalizan para comparar
const plain = (s: string) => s.replace(/ | /g, ' ');

describe('formatPrice', () => {
  it('formatea en español como «2,50 €»', () => {
    expect(plain(formatPrice(250, 'es'))).toBe('2,50 €');
  });
  it('formatea en inglés como «€2.50»', () => {
    expect(formatPrice(250, 'en')).toBe('€2.50');
  });
});

describe('parsePriceToCents', () => {
  it.each([
    ['2,50', 250],
    ['2.50', 250],
    ['2,5', 250],
    ['3', 300],
    [' 12.00 ', 1200],
    ['0,01', 1],
  ])('acepta «%s» → %i céntimos', (input, cents) => {
    expect(parsePriceToCents(input)).toEqual({ cents });
  });

  it.each(['0', '0,00', '0.0'])('rechaza «%s» como precio cero', (input) => {
    expect(parsePriceToCents(input)).toEqual({ error: 'error.priceZero' });
  });

  it.each(['-2', '-0,50', 'dos euros', 'abc', '', '2,505', '1.234', '2,', '€2'])('rechaza «%s»', (input) => {
    expect(parsePriceToCents(input)).toEqual({ error: 'error.price' });
  });
});

describe('centsToInput', () => {
  it('usa la coma en español y el punto en inglés', () => {
    expect(centsToInput(250, 'es')).toBe('2,50');
    expect(centsToInput(250, 'en')).toBe('2.50');
  });
});

describe('priceLines', () => {
  const size = (position: number, label: string | null, price_cents: number) => ({
    id: `s${position}`,
    position,
    label,
    price_cents,
  });

  it('un tamaño sin nombre muestra solo el precio', () => {
    expect(priceLines({ included_with: null, dish_sizes: [size(1, null, 180)] }, 'es').map(plain)).toEqual(['1,80 €']);
  });

  it('un tamaño con nombre muestra nombre y precio', () => {
    expect(priceLines({ included_with: null, dish_sizes: [size(1, 'Ración', 700)] }, 'es').map(plain)).toEqual([
      'Ración · 7,00 €',
    ]);
  });

  it('varios tamaños, una línea por tamaño en su orden', () => {
    const dish = {
      included_with: null,
      dish_sizes: [size(3, 'Plato', 1200), size(1, 'Una', 150), size(2, 'Ración', 700)],
    };
    expect(priceLines(dish, 'en')).toEqual(['Una · €1.50', 'Ración · €7.00', 'Plato · €12.00']);
  });

  it('un plato incluido muestra el texto del dueño y ningún precio', () => {
    const lines = priceLines({ included_with: 'Con cada bebida', dish_sizes: [] }, 'en');
    expect(lines).toEqual(['Con cada bebida']);
    expect(lines.join(' ')).not.toMatch(/€|\d/);
  });
});
