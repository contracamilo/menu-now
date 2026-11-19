import { useQuery, type QueryClient } from '@tanstack/react-query';
import { restGet } from '../../lib/rest';
import type { MenuCategory } from '../../lib/types';
import { MENU_PARAMS, takeEarly } from '../../lib/publicQueries';

export { MENU_PARAMS };

export const menuQueryKey = ['menu'] as const;

/**
 * Una sola petición anónima con platos y tamaños embebidos (design D6); se filtra lo archivado
 * también aquí (además de RLS) para que la consulta sea explícita. La primera vez usa la
 * petición que index.html lanzó en paralelo con la descarga del JS; los reintentos van directos.
 */
export function fetchMenu(): Promise<MenuCategory[]> {
  return takeEarly<MenuCategory[]>('__menuNowEarlyMenu') ?? restGet<MenuCategory[]>('categories', MENU_PARAMS);
}

export const menuQuery = { queryKey: menuQueryKey, queryFn: fetchMenu };

export function useMenu() {
  return useQuery(menuQuery);
}

export function prefetchMenu(queryClient: QueryClient) {
  return queryClient.prefetchQuery(menuQuery);
}
