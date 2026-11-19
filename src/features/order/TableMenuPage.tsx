import { Link } from 'react-router';
import { useI18n } from '../../i18n/useT';
import { formatPrice } from '../../lib/money';
import { MenuPage } from '../menu/MenuPage';
import { AddToOrder } from './AddToOrder';
import { useOrder } from './OrderProvider';
import { orderTotal, unitCount } from './orderReducer';
import { useTable } from './useTable';

/** Región viva que anuncia los cambios del pedido (spec «Accesibilidad del pedido»). */
export function OrderAnnouncer() {
  const { announcement } = useOrder();
  return (
    <p role="status" aria-live="polite" className="visually-hidden">
      {announcement}
    </p>
  );
}

/** Barra fija con las unidades y el total del pedido, que lleva al resumen (design D8). */
function OrderBar() {
  const { t, lang } = useI18n();
  const { token, draft } = useOrder();
  if (draft.lines.length === 0) return null;
  return (
    <div className="order-bar">
      <Link className="button tap-target button--primary order-bar__link" to={`/t/${token}/order`}>
        {t('order.bar', { count: unitCount(draft.lines), total: formatPrice(orderTotal(draft.lines), lang) })}
      </Link>
    </div>
  );
}

/**
 * Carta abierta desde el QR de una mesa (spec menu «Carta pública sin identificación» y
 * table-ordering «Pedir solo desde la carta de una mesa activa»).
 */
export function TableMenuPage() {
  const { t } = useI18n();
  const { token } = useOrder();
  const table = useTable(token);

  const info = table.data;
  const canOrder = info?.active === true;
  // Hueco reservado mientras llega la mesa, para que la cabecera no salte
  const detail = (
    <p className="venue-header__table">{info ? t('table.label', { name: info.name }) : table.isPending ? ' ' : null}</p>
  );

  let notice = null;
  if (info && !info.active) notice = <p className="order-notice">{t('table.unavailable')}</p>;
  else if (!table.isPending && !info) notice = <p className="order-notice">{t('table.scanToOrder')}</p>;

  return (
    <MenuPage
      headerDetail={detail}
      headerActions={
        info ? (
          <Link className="button tap-target" to={`/t/${token}/orders`}>
            {t('orders.title')}
          </Link>
        ) : null
      }
      notice={notice}
      renderDishAction={canOrder ? (dish) => <AddToOrder dish={dish} /> : undefined}
      footer={
        canOrder ? (
          <>
            <OrderBar />
            <OrderAnnouncer />
          </>
        ) : null
      }
    />
  );
}
