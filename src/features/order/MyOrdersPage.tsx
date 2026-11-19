import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../i18n/useT';
import { formatPrice } from '../../lib/money';
import '../../styles/menu.scss';
import { useOrders } from './orderApi';
import { useOrder } from './OrderProvider';
import { readOrderIds, writeOrderIds } from './orderStorage';

/** «Mis pedidos»: los confirmados hoy desde este móvil en esta mesa (spec «Pedidos hechos desde el móvil»). */
export default function MyOrdersPage() {
  const { t, lang } = useI18n();
  const { token } = useOrder();
  const [ids] = useState(() => readOrderIds(token));
  const orders = useOrders(token, ids);

  // Se olvidan los id que el servidor ya no devuelve (días anteriores)
  useEffect(() => {
    if (!orders.data) return;
    const known = new Set(orders.data.map((order) => order.id));
    if (known.size !== ids.length) writeOrderIds(token, ids.filter((id) => known.has(id)));
  }, [orders.data, ids, token]);

  const time = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-IE', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  let content;
  if (orders.isPending) content = <p role="status" className="status">{t('menu.loading')}</p>;
  else if (orders.isError) {
    content = (
      <div role="alert" className="status">
        <p>{t('common.loadError')}</p>
        <button type="button" className="button tap-target button--primary" onClick={() => void orders.refetch()}>
          {t('menu.retry')}
        </button>
      </div>
    );
  } else if (orders.data.length === 0) content = <p className="status">{t('orders.empty')}</p>;
  else {
    content = (
      <ul className="order-cards">
        {orders.data.map((order) => (
          <li key={order.id}>
            <Link className="order-card" to={`/t/${token}/orders/${order.id}`}>
              <span className="order-card__number">{t('order.number', { number: order.number })}</span>
              <span>{t('orders.placedAt', { time: time(order.created_at) })}</span>
              <span>{formatPrice(order.total_cents, lang)}</span>
              <span>{t('order.status', { status: t(`order.status.${order.status}`) })}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="page order-page">
      <h1>{t('orders.title')}</h1>
      {content}
      <div className="order-actions">
        <Link className="button tap-target" to={`/t/${token}`}>
          {t('order.backToMenu')}
        </Link>
      </div>
    </main>
  );
}
