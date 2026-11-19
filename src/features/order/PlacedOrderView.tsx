import { useI18n } from '../../i18n/useT';
import { formatPrice } from '../../lib/money';
import type { PlacedOrder } from '../../lib/types';
import { lineName } from './orderReducer';

/** Líneas, total y estado de un pedido registrado, con los datos copiados al confirmarlo. */
export function PlacedOrderView({ order }: { order: PlacedOrder }) {
  const { t, lang } = useI18n();
  const price = (cents: number) => formatPrice(cents, lang);
  return (
    <>
      <p className="order-page__table">{t('table.label', { name: order.table_name })}</p>
      <p className="order-status">{t('order.status', { status: t(`order.status.${order.status}`) })}</p>
      <ul className="order-lines">
        {order.items.map((item, index) => (
          <li key={index} className="order-line">
            <div className="order-line__head">
              <p className="order-line__name">
                {item.quantity} × {lineName(item)}
              </p>
              <p className="order-line__amount">{price(item.quantity * item.unit_price_cents)}</p>
            </div>
            {item.note && <p className="order-line__placed-note">{item.note}</p>}
          </li>
        ))}
      </ul>
      <p className="order-total">
        <span>{t('order.total')}</span> <strong>{price(order.total_cents)}</strong>
      </p>
    </>
  );
}
