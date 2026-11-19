import { describe, expect, it } from 'vitest';
import { translate } from '../../i18n/I18nProvider';
import type { Dish, MenuCategory } from '../../lib/types';
import { visibleCategories } from './visibleCategories';

const tEs = (key: Parameters<typeof translate>[1]) => translate('es', key);
const tEn = (key: Parameters<typeof translate>[1]) => translate('en', key);

function dish(name: string, position: number, sizes: Array<[string | null, number, number]> = [[null, 100, 1]]): Dish {
  return {
    id: name,
    name,
    description: null,
    included_with: null,
    photo_path: null,
    allergens: [],
    no_allergens: true,
    position,
    dish_sizes: sizes.map(([label, price_cents, pos]) => ({ id: `${name}-${pos}`, label, price_cents, position: pos })),
  };
}

function category(name: string | null, position: number, dishes: Dish[], is_included = false): MenuCategory {
  return { id: name ?? 'incluidos', name, position, is_included, dishes };
}

describe('visibleCategories', () => {
  it('[menu] «El comensal ve el orden decidido por el dueño»', () => {
    const result = visibleCategories(
      [
        category('Bebidas', 3, [dish('Caña', 1)]),
        category('Desayunos', 1, [dish('Tostada', 1)]),
        category('Bocadillos', 2, [dish('Tortilla', 3), dish('Calamares', 1), dish('Lomo', 2)]),
      ],
      tEs,
    );
    expect(result.map((c) => c.name)).toEqual(['Desayunos', 'Bocadillos', 'Bebidas']);
    expect(result[1].dishes.map((d) => d.name)).toEqual(['Calamares', 'Lomo', 'Tortilla']);
  });

  it('ordena los tamaños por posición', () => {
    const [croquetas] = visibleCategories(
      [category('Raciones', 1, [dish('Croquetas', 1, [['Plato', 1200, 3], ['Una', 150, 1], ['Ración', 700, 2]])])],
      tEs,
    )[0].dishes;
    expect(croquetas.dish_sizes.map((s) => s.label)).toEqual(['Una', 'Ración', 'Plato']);
  });

  it('[menu] «Una categoría se queda sin platos activos» (lógica): no se muestra', () => {
    const result = visibleCategories(
      [category('Postres', 1, []), category('Bebidas', 2, [dish('Caña', 1)]), category(null, 3, [], true)],
      tEs,
    );
    expect(result.map((c) => c.name)).toEqual(['Bebidas']);
  });

  it('traduce el nombre de «Incluidos» según el idioma', () => {
    const categories = [category(null, 1, [dish('Tapa del día', 1, [])], true)];
    expect(visibleCategories(categories, tEs)[0].name).toBe('Incluidos');
    expect(visibleCategories(categories, tEn)[0].name).toBe('Included');
  });

  it('sin categorías devuelve una lista vacía', () => {
    expect(visibleCategories([], tEs)).toEqual([]);
  });

  it('no modifica los datos recibidos', () => {
    const input = [category('B', 2, [dish('x', 2), dish('y', 1)]), category('A', 1, [dish('z', 1)])];
    const copy = structuredClone(input);
    visibleCategories(input, tEs);
    expect(input).toEqual(copy);
  });
});
