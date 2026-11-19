// Consultas públicas de la carta (design D6 de add-carta-digital y D6 de add-pedidos-mesa). Módulo sin dependencias: lo usan la app y el
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

/** Peticiones que index.html lanza en `/` y en `/t/<token>` antes de que cargue la app, y dónde las deja. */
export const EARLY_FETCHES = [
  { global: '__menuNowEarlyMenu', table: 'categories', params: MENU_PARAMS },
  { global: '__menuNowEarlyVenue', table: 'venue_settings', params: VENUE_PARAMS },
] as const;

/** La mesa del QR (`/t/<token>`, design D6): se pide con `rpc/get_table`. */
export const EARLY_TABLE_GLOBAL = '__menuNowEarlyTable';

export type EarlyGlobal = (typeof EARLY_FETCHES)[number]['global'] | typeof EARLY_TABLE_GLOBAL;

/** Token de mesa con formato UUID (cualquier versión). */
export const TABLE_TOKEN_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const TABLE_PATH = new RegExp(`^/t/(${TABLE_TOKEN_PATTERN})(?:/|$)`);

export const isTableToken = (token: string | undefined): token is string =>
  !!token && new RegExp(`^${TABLE_TOKEN_PATTERN}$`).test(token);

/** Token de la mesa si la ruta es de la carta de una mesa; `null` si no. */
export function tableTokenFromPath(pathname: string): string | null {
  return TABLE_PATH.exec(pathname)?.[1] ?? null;
}

/** ¿Muestra la ruta la carta (general o de una mesa)? */
export const isMenuPath = (pathname: string) => pathname === '/' || tableTokenFromPath(pathname) !== null;

/**
 * Script inline de index.html (design D6): en la carta pide la carta y los datos del local, y en
 * `/t/<token>` además la mesa, en paralelo con la descarga del JS. Sin token válido no pide la mesa.
 */
export function earlyFetchScript(base: string, key: string): string {
  const requests = EARLY_FETCHES.map(({ global, table, params }) => {
    const url = `${base}/rest/v1/${table}?${new URLSearchParams(params)}`;
    return `window.${global}=get(${JSON.stringify(url)});`;
  }).join('');
  const tableUrl = JSON.stringify(`${base}/rest/v1/rpc/get_table?p_token=`);
  return (
    `(function(){var p=location.pathname,m=p.match(${TABLE_PATH.toString()});if(p!=='/'&&!m)return;` +
    `var get=function(u){var r=fetch(u,{headers:{apikey:${JSON.stringify(key)},Accept:'application/json'}})` +
    `.then(function(x){if(!x.ok)throw new Error('HTTP '+x.status);return x.json()});r.catch(function(){});return r};` +
    `${requests}if(m)window.${EARLY_TABLE_GLOBAL}={token:m[1],rows:get(${tableUrl}+m[1])};})();`
  );
}

/** Recoge (una sola vez) la petición temprana de index.html, si existe. */
export function takeEarly<T>(global: EarlyGlobal): Promise<T> | undefined {
  const w = window as unknown as Record<string, Promise<T> | undefined>;
  const early = w[global];
  if (early) delete w[global];
  return early;
}

/** Recoge (una sola vez) la petición temprana de la mesa, solo si es la del token pedido. */
export function takeEarlyTable<T>(token: string): Promise<T> | undefined {
  const w = window as unknown as Record<string, { token: string; rows: Promise<T> } | undefined>;
  const early = w[EARLY_TABLE_GLOBAL];
  if (!early) return undefined;
  delete w[EARLY_TABLE_GLOBAL];
  return early.token === token ? early.rows : undefined;
}
