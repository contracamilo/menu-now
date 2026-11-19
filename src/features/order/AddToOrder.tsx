import { useRef } from 'react';
import { useI18n } from '../../i18n/useT';
import { formatPrice } from '../../lib/money';
import type { Dish, DishSize } from '../../lib/types';
import { useOrder } from './OrderProvider';
import { MAX_QUANTITY, orderTotal } from './orderReducer';

/**
 * Botón «Añadir» de un plato con precio (spec table-ordering «Añadir platos al pedido», design D8).
 * Con un tamaño añade directamente; con varios abre un selector de tamaño en un `<dialog>` nativo.
 * Los platos de «Incluidos» (sin tamaños) no tienen botón.
 */
export function AddToOrder({ dish }: { dish: Dish }) {
  const { t, lang } = useI18n();
  const { draft, add, announce } = useOrder();
  const dialog = useRef<HTMLDialogElement>(null);

  if (dish.included_with || dish.dish_sizes.length === 0) return null;
  const sizes = [...dish.dish_sizes].sort((a, b) => a.position - b.position);

  function addSize(size: DishSize) {
    const existing = draft.lines.find((l) => l.dish_id === dish.id && l.size_id === size.id && !l.note);
    const added = !existing || existing.quantity < MAX_QUANTITY;
    add({ dish_id: dish.id, size_id: size.id, dish_name: dish.name, size_label: size.label, unit_price_cents: size.price_cents });
    const total = orderTotal(draft.lines) + (added ? size.price_cents : 0);
    const name = size.label ? `${dish.name} · ${size.label}` : dish.name;
    announce(t('order.added', { dish: name, total: formatPrice(total, lang) }));
    closeDialog();
  }

  function openDialog() {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
  }

  function closeDialog() {
    const element = dialog.current;
    if (!element?.open) return;
    if (typeof element.close === 'function') element.close();
    else element.removeAttribute('open');
  }

  const titleId = `size-title-${dish.id}`;

  return (
    <>
      <button
        type="button"
        className="button tap-target button--primary dish__add"
        aria-label={t('order.addDish', { dish: dish.name })}
        aria-haspopup={sizes.length > 1 ? 'dialog' : undefined}
        onClick={() => (sizes.length > 1 ? openDialog() : addSize(sizes[0]))}
      >
        <span aria-hidden="true">+</span> {t('order.add')}
      </button>

      {sizes.length > 1 && (
        <dialog ref={dialog} className="size-picker" aria-labelledby={titleId}>
          <h2 id={titleId} className="size-picker__title">
            {t('order.chooseSize', { dish: dish.name })}
          </h2>
          <ul className="size-picker__list">
            {sizes.map((size) => (
              <li key={size.id}>
                <button type="button" className="button tap-target size-picker__option" onClick={() => addSize(size)}>
                  {t('menu.sizePrice', { size: size.label ?? '', price: formatPrice(size.price_cents, lang) })}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="button tap-target" onClick={closeDialog}>
            {t('form.cancel')}
          </button>
        </dialog>
      )}
    </>
  );
}
