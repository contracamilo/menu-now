// Consultas públicas de la carta (design D6). Módulo sin dependencias: lo usan la app y el
// build (vite.config.ts), que las lanza desde index.html mientras se descarga el JS.

export const MENU_PARAMS: Record<string, string> = {
  select:
    'id,is_included,name,position,' +
    'dishes(id,name,description,included_with,photo_path,allergens,no_allergens,position,' +
    'dish_sizes(id,label,price_cents,position))',
  archived_at: 'is.null',
  'dishes.archived_at': 'is.null',
  order: 'position,created_at',
  'dishes.order': 'position,created_at',
  'dishes.dish_sizes.order': 'position',
};

export const VENUE_PARAMS: Record<string, string> = { select: 'name,logo_path' };

/** Peticiones que index.html lanza en `/` antes de que cargue la app, y dónde las deja. */
export const EARLY_FETCHES = [
  { global: '__menuNowEarlyMenu', table: 'categories', params: MENU_PARAMS },
  { global: '__menuNowEarlyVenue', table: 'venue_settings', params: VENUE_PARAMS },
] as const;

export type EarlyGlobal = (typeof EARLY_FETCHES)[number]['global'];

/** Recoge (una sola vez) la petición temprana de index.html, si existe. */
export function takeEarly<T>(global: EarlyGlobal): Promise<T> | undefined {
  const w = window as unknown as Record<string, Promise<T> | undefined>;
  const early = w[global];
  if (early) delete w[global];
  return early;
}
