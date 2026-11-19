import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useT } from '../../i18n/useT';
import '../../styles/menu.scss';
import { useOrders } from './orderApi';
import { useOrder } from './OrderProvider';
import { PlacedOrderView } from './PlacedOrderView';

/** Confirmación y detalle de un pedido: número, mesa, líneas, total y estado (spec «Número y estado del pedido»). */
export default function OrderDetailPage() {
  const t = useT();
  const { token } = useOrder();
  const { orderId = '' } = useParams();
  const orders = useOrders(token, [orderId]);
  const order = orders.data?.[0];
  const heading = useRef<HTMLHeadingElement>(null);

  // El lector de pantalla y el teclado empiezan por el número del pedido
  useEffect(() => {
    if (order) heading.current?.focus();
  }, [order]);

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
  } else if (!order) content = <p className="status">{t('order.notFound')}</p>;
  else {
    content = (
      <>
        <h1 ref={heading} tabIndex={-1} className="order-number">
          {t('order.number', { number: order.number })}
        </h1>
        <PlacedOrderView order={order} />
        {order.status !== 'served' && (
          <p className="order-help">{t(order.status === 'cancelled' ? 'order.cancelledHelp' : 'order.receivedHelp')}</p>
        )}
      </>
    );
  }

  return (
    <main className="page order-page">
      {content}
      <div className="order-actions">
        <Link className="button tap-target button--primary" to={`/t/${token}`}>
          {t('order.backToMenu')}
        </Link>
        <Link className="button tap-target" to={`/t/${token}/orders`}>
          {t('orders.title')}
        </Link>
      </div>
    </main>
  );
}
