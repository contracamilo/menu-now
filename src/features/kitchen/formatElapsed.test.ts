import { describe, expect, it } from 'vitest';
import { translate } from '../../i18n/I18nProvider';
import { formatElapsed } from './formatElapsed';

const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate('es', key, vars);
const min = 60_000;

describe('formatElapsed', () => {
  it.each([
    [0, 'Ahora mismo'],
    [59_999, 'Ahora mismo'],
    [-5 * min, 'Ahora mismo'],
    [1 * min, '1 min'],
    [7 * min + 30_000, '7 min'],
    [59 * min, '59 min'],
    [60 * min, '1 h 0 min'],
    // [kitchen-panel] «Un pedido lleva más de una hora»
    [75 * min, '1 h 15 min'],
    [130 * min, '2 h 10 min'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatElapsed(ms, t)).toBe(expected);
  });
});
