import type { AdminCategory, AdminDish } from '../features/catalog/useCatalog';
import type { Allergen } from '../lib/allergens';
import { fakeSupabase, ok } from './fakeSupabase';

/** Plato de prueba para la administración. */
export function adminDish(
  partial: Partial<AdminDish> & Pick<AdminDish, 'id' | 'name' | 'category_id' | 'position'>,
): AdminDish {
  return {
    description: null,
    included_with: null,
    photo_path: null,
    allergens: [] as Allergen[],
    no_allergens: true,
    archived_at: null,
    dish_sizes: [{ id: `${partial.id}-s1`, label: null, price_cents: 450, position: 1 }],
    ...partial,
  };
}

export function adminCategory(
  partial: Partial<AdminCategory> & Pick<AdminCategory, 'id' | 'position'>,
): AdminCategory {
  return { name: null, is_included: false, archived_at: null, dishes: [], ...partial };
}

const idFilter = (filters: Array<[string, string, unknown]>) => filters.find(([, column]) => column === 'id')?.[2];

/**
 * Catálogo en memoria detrás del cliente falso: las lecturas devuelven el estado actual y
 * las escrituras (archivar, reactivar, mover) lo modifican, como haría la base de datos.
 */
export function installCatalog(initial: AdminCategory[]) {
  const state: AdminCategory[] = structuredClone(initial);
  const allDishes = () => state.flatMap((c) => c.dishes);

  fakeSupabase.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);

  fakeSupabase.tables.categories = (q) => {
    if (q.op === 'select') return ok(structuredClone(state));
    if (q.op === 'update') Object.assign(state.find((c) => c.id === idFilter(q.filters))!, q.payload);
    if (q.op === 'insert') {
      // Como el trigger de posición: al final
      const position = Math.max(0, ...state.map((c) => c.position)) + 1;
      state.push(adminCategory({ id: `nueva-${state.length + 1}`, position, ...(q.payload as object) }));
    }
    return ok(null);
  };

  fakeSupabase.tables.dishes = (q) => {
    if (q.op === 'update') Object.assign(allDishes().find((d) => d.id === idFilter(q.filters))!, q.payload);
    return ok(null);
  };

  function swapWithNeighbour<T extends { id: string; position: number }>(items: T[], id: string, direction: number) {
    const sorted = [...items].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((item) => item.id === id);
    const other = sorted[index + direction];
    if (index < 0 || !other) return;
    [sorted[index].position, other.position] = [other.position, sorted[index].position];
  }

  fakeSupabase.rpcs.move_dish = ({ p_id, p_direction }) => {
    const category = state.find((c) => c.dishes.some((d) => d.id === p_id))!;
    swapWithNeighbour(category.dishes.filter((d) => !d.archived_at), p_id as string, p_direction as number);
    return ok(null);
  };

  fakeSupabase.rpcs.move_category = ({ p_id, p_direction }) => {
    swapWithNeighbour(state.filter((c) => !c.archived_at), p_id as string, p_direction as number);
    return ok(null);
  };

  return state;
}
