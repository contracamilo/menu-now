// Colores de la interfaz (design D10, estilo suave). tokens.scss declara los mismos valores;
// contrast.test.ts comprueba que coinciden, que cada par texto/fondo llega a 7:1 y que el borde
// de los controles llega a 3:1 (WCAG 1.4.11).
export const colors = {
  text: '#1c1c1e',
  textSecondary: '#48484a',
  background: '#f2f2f4',
  surface: '#ffffff',
  accent: '#0b4a99',
  onAccent: '#ffffff',
  accentSoft: '#e8f0fb',
  chipBackground: '#eef2f7',
  noticeBackground: '#fff4d6',
  error: '#a0141e',
  success: '#1d5e2c',
  controlBorder: '#7c7c80',
} as const;

export type ColorToken = keyof typeof colors;

/** Todos los pares texto/fondo que usa la interfaz (≥ 7:1). */
export const contrastPairs: Record<string, [foreground: ColorToken, background: ColorToken]> = {
  body: ['text', 'surface'],
  bodyOnBackground: ['text', 'background'],
  secondary: ['textSecondary', 'surface'],
  secondaryOnBackground: ['textSecondary', 'background'],
  link: ['accent', 'surface'],
  linkOnBackground: ['accent', 'background'],
  selected: ['accent', 'accentSoft'],
  allergenChip: ['text', 'chipBackground'],
  allergyNotice: ['text', 'noticeBackground'],
  primaryButton: ['onAccent', 'accent'],
  error: ['error', 'surface'],
  errorOnBackground: ['error', 'background'],
  success: ['success', 'surface'],
  // Pedido desde la mesa (add-pedidos-mesa): avisos, barra, selector de tamaño, estado y tarjeta del QR
  orderNotice: ['text', 'accentSoft'],
  orderWarning: ['text', 'noticeBackground'],
  orderBar: ['onAccent', 'accent'],
  sizeOption: ['accent', 'surface'],
  orderStatus: ['success', 'surface'],
  qrCardUrl: ['textSecondary', 'surface'],
  // Panel de cocina (add-panel-cocina): estados, etiqueta «Nuevo», notas, banda sin conexión y diálogo
  kitchenReceived: ['accent', 'accentSoft'],
  kitchenInPreparation: ['text', 'noticeBackground'],
  kitchenServed: ['success', 'surface'],
  kitchenCancelled: ['error', 'chipBackground'],
  kitchenNew: ['onAccent', 'accent'],
  kitchenNote: ['textSecondary', 'surface'],
  kitchenOffline: ['onAccent', 'error'],
  kitchenDanger: ['error', 'surface'],
};

/** Bordes que identifican un control (≥ 3:1 con lo que tienen alrededor). */
export const nonTextPairs: Record<string, [foreground: ColorToken, background: ColorToken]> = {
  controlOnSurface: ['controlBorder', 'surface'],
  controlOnBackground: ['controlBorder', 'background'],
};
