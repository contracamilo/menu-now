import type { Dish, MenuCategory, TableInfo } from '../lib/types';
import { fakeSupabase, ok } from './fakeSupabase';

export const TOKEN = '44444444-4444-4444-8444-444444444444';

export function menuDish(partial: Partial<Dish> & Pick<Dish, 'id' | 'name' | 'position'>): Dish {
  return {
    description: null,
    included_with: null,
    photo_path: null,
    allergens: [],
    no_allergens: true,
    dish_sizes: [{ id: `${partial.id}-s1`, label: null, price_cents: 100, position: 1 }],
    ...partial,
  };
}

/** Carta pequeña para los tests del pedido: un plato de un tamaño, uno de tres e «Incluidos». */
export const orderMenu: MenuCategory[] = [
  {
    id: 'bebidas',
    name: 'Bebidas',
    is_included: false,
    position: 1,
    dishes: [
      menuDish({ id: 'cana', name: 'Caña', position: 1, dish_sizes: [{ id: 'cana-s', label: null, price_cents: 180, position: 1 }] }),
    ],
  },
  {
    id: 'raciones',
    name: 'Raciones',
    is_included: false,
    position: 2,
    dishes: [
      menuDish({
        id: 'croquetas',
        name: 'Croquetas',
        position: 1,
        dish_sizes: [
          { id: 'croq-una', label: 'Una', price_cents: 150, position: 1 },
          { id: 'croq-racion', label: 'Ración', price_cents: 700, position: 2 },
          { id: 'croq-plato', label: 'Plato', price_cents: 1200, position: 3 },
        ],
      }),
    ],
  },
  {
    id: 'incluidos',
    name: null,
    is_included: true,
    position: 3,
    dishes: [menuDish({ id: 'tapa', name: 'Tapa del día', position: 1, included_with: 'Con cada bebida', dish_sizes: [] })],
  },
];

/** Sirve la carta, el local y la mesa del QR (`null` = token desconocido). */
export function serveTableMenu(table: TableInfo | null = { name: 'Mesa 4', active: true }, menu = orderMenu) {
  fakeSupabase.tables.categories = () => ok(menu);
  fakeSupabase.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);
  fakeSupabase.tables['rpc/get_table'] = () => ok(table ? [table] : []);
}
