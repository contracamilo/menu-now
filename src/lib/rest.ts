// Lecturas públicas sin supabase-js (design D7, «primera palanca»): la carta solo necesita
// dos GET anónimos a PostgREST y las URL públicas de las imágenes, así que su bundle no
// incluye el SDK. supabase-js queda para la administración (chunk diferido).
const baseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** GET anónimo a PostgREST: `params` son los parámetros de consulta (select, filtros, order…). */
export async function restGet<T>(table: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { apikey: anonKey, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** URL pública de un objeto del bucket `images`. */
export function publicImageUrl(path: string): string {
  return `${baseUrl}/storage/v1/object/public/images/${path.split('/').map(encodeURIComponent).join('/')}`;
}
