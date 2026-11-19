import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Category, Dish } from '../../lib/types';
import { menuQueryKey } from '../menu/useMenu';

export interface AdminDish extends Dish {
  category_id: string;
  archived_at: string | null;
}

export interface AdminCategory extends Category {
  archived_at: string | null;
  dishes: AdminDish[];
}

export const catalogQueryKey = ['admin', 'catalog'] as const;

// El dueño ve todo, incluido lo archivado (RLS: «owner read …»)
const CATALOG_SELECT =
  'id,is_included,name,position,archived_at,' +
  'dishes(id,category_id,name,description,included_with,photo_path,allergens,no_allergens,position,archived_at,' +
  'dish_sizes(id,label,price_cents,position))';

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export async function fetchCatalog(): Promise<AdminCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATALOG_SELECT)
    .order('position')
    .order('created_at')
    .order('position', { referencedTable: 'dishes' })
    .order('created_at', { referencedTable: 'dishes' });
  if (error) throw new Error(error.message);
  return [...((data ?? []) as unknown as AdminCategory[])].sort(byPosition).map((category) => ({
    ...category,
    dishes: [...category.dishes]
      .sort(byPosition)
      .map((dish) => ({ ...dish, dish_sizes: [...dish.dish_sizes].sort(byPosition) })),
  }));
}

export function useCatalog() {
  return useQuery({ queryKey: catalogQueryKey, queryFn: fetchCatalog, staleTime: 0 });
}

/** Tras cualquier cambio: se recarga el catálogo y la carta (por si el dueño la tiene abierta). */
export function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
      queryClient.invalidateQueries({ queryKey: menuQueryKey }),
    ]);
}

export type CatalogAction =
  | { kind: 'move'; target: 'dish' | 'category'; id: string; direction: -1 | 1 }
  | { kind: 'archive' | 'reactivate'; target: 'dish' | 'category'; id: string };

export class CatalogError extends Error {
  constructor(readonly code: string | undefined, message: string) {
    super(message);
  }
}

async function runAction(action: CatalogAction) {
  if (action.kind === 'move') {
    const fn = action.target === 'dish' ? 'move_dish' : 'move_category';
    const { error } = await supabase.rpc(fn, { p_id: action.id, p_direction: action.direction });
    if (error) throw new CatalogError(error.code, error.message);
    return;
  }
  const table = action.target === 'dish' ? 'dishes' : 'categories';
  const archived_at = action.kind === 'archive' ? new Date().toISOString() : null;
  const { error } = await supabase.from(table).update({ archived_at }).eq('id', action.id);
  if (error) throw new CatalogError(error.code, error.message);
}

export function useCatalogAction() {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: runAction, onSettled: invalidate });
}
