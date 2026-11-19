import { useQuery, type QueryClient } from '@tanstack/react-query';
import { restGet } from '../../lib/rest';
import { isTableToken, takeEarlyTable } from '../../lib/publicQueries';
import type { TableInfo } from '../../lib/types';

export const tableQueryKey = (token: string) => ['table', token] as const;

/**
 * Mesa del QR (`get_table`, design D4): `null` si el token no tiene formato válido o no existe.
 * La primera vez usa la petición que index.html lanzó en paralelo con el JS (design D6).
 */
export async function fetchTable(token: string): Promise<TableInfo | null> {
  if (!isTableToken(token)) return null;
  const rows = await (takeEarlyTable<TableInfo[]>(token) ?? restGet<TableInfo[]>('rpc/get_table', { p_token: token }));
  return rows[0] ?? null;
}

const tableQuery = (token: string) => ({
  queryKey: tableQueryKey(token),
  queryFn: () => fetchTable(token),
  staleTime: 30_000,
});

export function useTable(token: string) {
  return useQuery(tableQuery(token));
}

export function prefetchTable(queryClient: QueryClient, token: string) {
  return queryClient.prefetchQuery(tableQuery(token));
}
