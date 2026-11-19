// Colores de la interfaz (design D10). tokens.scss declara los mismos valores;
// contrast.test.ts comprueba que coinciden y que cada par texto/fondo llega a 7:1.
export const colors = {
  text: '#111111',
  textSecondary: '#333333',
  background: '#ffffff',
  accent: '#0b3d5c',
  onAccent: '#ffffff',
  chipBackground: '#fff1c2',
  noticeBackground: '#ffe08a',
  error: '#8b0000',
  success: '#0b5323',
  border: '#111111',
} as const;

export type ColorToken = keyof typeof colors;

/** Todos los pares texto/fondo que usa la interfaz. */
export const contrastPairs: Record<string, [foreground: ColorToken, background: ColorToken]> = {
  body: ['text', 'background'],
  secondary: ['textSecondary', 'background'],
  link: ['accent', 'background'],
  allergenChip: ['text', 'chipBackground'],
  allergyNotice: ['text', 'noticeBackground'],
  primaryButton: ['onAccent', 'accent'],
  pressedToggle: ['onAccent', 'accent'],
  error: ['error', 'background'],
  success: ['success', 'background'],
};
