import { useQuery, type QueryClient } from '@tanstack/react-query';
import { restGet } from '../../lib/rest';
import type { MenuCategory } from '../../lib/types';

export const menuQueryKey = ['menu'] as const;

// design D6: una sola petición con platos y tamaños embebidos, siempre como anónimo.
// Se filtra lo archivado también aquí (además de RLS) para que la consulta sea explícita.
export const MENU_PARAMS = {
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

export function fetchMenu(): Promise<MenuCategory[]> {
  return restGet<MenuCategory[]>('categories', MENU_PARAMS);
}

export const menuQuery = { queryKey: menuQueryKey, queryFn: fetchMenu };

export function useMenu() {
  return useQuery(menuQuery);
}

export function prefetchMenu(queryClient: QueryClient) {
  return queryClient.prefetchQuery(menuQuery);
}
