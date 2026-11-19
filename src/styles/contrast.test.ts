import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colors, contrastPairs } from './tokens';

// Contraste WCAG 2.x: (L1 + 0,05) / (L2 + 0,05) con luminancia relativa sRGB
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [menu] «El comensal lee y toca la carta a pleno sol» (tokens; la revisión en pantalla real está en docs/a11y-review.md)
describe('contraste de los tokens de color', () => {
  it('calcula bien el contraste de referencia (negro sobre blanco = 21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it.each(Object.entries(contrastPairs))('el par «%s» llega a 7:1', (_name, [fg, bg]) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(7);
  });

  it('tokens.scss declara exactamente los mismos colores que tokens.ts', () => {
    const scss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.scss'), 'utf8');
    const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    for (const [token, hex] of Object.entries(colors)) {
      const match = new RegExp(`\\$color-${kebab(token)}:\\s*(#[0-9a-fA-F]{6});`).exec(scss);
      expect(match?.[1].toLowerCase(), `$color-${kebab(token)}`).toBe(hex);
    }
  });
});
