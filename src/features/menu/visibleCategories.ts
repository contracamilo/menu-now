import type { TFunction } from '../../i18n/I18nProvider';
import type { MenuCategory } from '../../lib/types';

export type VisibleCategory = MenuCategory & { name: string };

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/**
 * Lo que ve el comensal (spec menu): categorías y platos en el orden del dueño, sin las
 * categorías que se quedan sin platos (también «Incluidos»), y con el nombre de «Incluidos»
 * en el idioma de la interfaz.
 */
export function visibleCategories(categories: readonly MenuCategory[], t: TFunction): VisibleCategory[] {
  return [...categories]
    .sort(byPosition)
    .filter((category) => category.dishes.length > 0)
    .map((category) => ({
      ...category,
      name: category.is_included ? t('category.included') : (category.name ?? ''),
      dishes: [...category.dishes]
        .sort(byPosition)
        .map((dish) => ({ ...dish, dish_sizes: [...dish.dish_sizes].sort(byPosition) })),
    }));
}
