import { useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/useT';
import type { Lang, TFunction } from '../../i18n/I18nProvider';
import { useOrderAction } from './kitchenApi';
import { formatElapsed } from './formatElapsed';
import type { KitchenOrder, KitchenStatus, OrderChangeResult } from './types';

export const statusText = (t: TFunction, status: KitchenStatus) => t(`kitchen.status.${status}`);

export function formatClock(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-IE', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function CardBody({ order, children, aside }: { order: KitchenOrder; children?: ReactNode; aside?: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <header className="order-card__header">
        <h2 className="order-card__number">{t('kitchen.orderNumber', { number: order.number })}</h2>
        <p className="order-card__table">{t('kitchen.table', { table: order.table_name })}</p>
        {aside}
      </header>
      <p className={`order-card__status order-card__status--${order.status}`}>{statusText(t, order.status)}</p>
      {children}
      <ul className="order-card__items">
        {order.items.map((item) => (
          <li key={item.position} className="order-card__item">
            <span className="order-card__line">
              {item.quantity} × {item.dish_name}
              {item.size_label ? ` · ${item.size_label}` : ''}
            </span>
            {item.note && (
              <span className="order-card__note">
                <span aria-hidden="true">✎ </span>
                {item.note}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

interface ActiveProps {
  order: KitchenOrder;
  now: number;
  clockOffset: number;
  isNew: boolean;
  onStart: (order: KitchenOrder) => void;
  onResult: (order: KitchenOrder, result: OrderChangeResult) => void;
  /** Pide confirmar la cancelación; `confirm` la ejecuta desde esta tarjeta. */
  onRequestCancel: (order: KitchenOrder, confirm: () => void) => void;
}

/** Tarjeta de un pedido activo con sus acciones (design D8). */
export function ActiveOrderCard({ order, now, clockOffset, isNew, onStart, onResult, onRequestCancel }: ActiveProps) {
  const { t } = useI18n();
  const action = useOrderAction();
  const [failed, setFailed] = useState(false);

  function run(kind: 'advance' | 'cancel') {
    setFailed(false);
    action.mutate(
      { kind, order },
      { onSuccess: (result) => onResult(order, result), onError: () => setFailed(true) },
    );
  }

  const elapsedMs = now + clockOffset - Date.parse(order.created_at);
  const elapsed = elapsedMs < 60_000 ? t('kitchen.justNow') : t('kitchen.elapsed', { time: formatElapsed(elapsedMs, t) });
  const busy = action.isPending;

  return (
    <article className={`order-card${isNew ? ' order-card--new' : ''}`} aria-busy={busy || undefined}>
      <CardBody order={order} aside={isNew && <p className="order-card__new">{t('kitchen.new')}</p>}>
        <p className="order-card__elapsed">{elapsed}</p>
      </CardBody>
      {failed && (
        <p role="alert" className="message message--error">
          {t('kitchen.actionError')}
        </p>
      )}
      <div className="order-card__actions">
        {order.status === 'received' && (
          <>
            <button
              type="button"
              className="button button--primary kitchen-action"
              aria-label={t('kitchen.startOrder', { number: order.number })}
              disabled={busy}
              onClick={() => {
                onStart(order);
                run('advance');
              }}
            >
              {t('kitchen.start')}
            </button>
            <button
              type="button"
              className="button kitchen-action kitchen-action--cancel"
              aria-label={t('kitchen.cancelOrder', { number: order.number })}
              aria-haspopup="dialog"
              disabled={busy}
              onClick={() => onRequestCancel(order, () => run('cancel'))}
            >
              {t('kitchen.cancel')}
            </button>
          </>
        )}
        {order.status === 'in_preparation' && (
          <button
            type="button"
            className="button button--primary kitchen-action"
            aria-label={t('kitchen.serveOrder', { number: order.number })}
            disabled={busy}
            onClick={() => run('advance')}
          >
            {t('kitchen.serve')}
          </button>
        )}
      </div>
    </article>
  );
}

/** Tarjeta del histórico: sin acciones, con la hora en que se sirvió o se canceló (design D8). */
export function HistoryOrderCard({ order }: { order: KitchenOrder }) {
  const { t, lang } = useI18n();
  const closed =
    order.status === 'served' && order.served_at
      ? t('kitchen.servedAt', { time: formatClock(order.served_at, lang) })
      : order.cancelled_at
        ? t('kitchen.cancelledAt', { time: formatClock(order.cancelled_at, lang) })
        : null;
  return (
    <article className="order-card order-card--history">
      <CardBody order={order}>{closed && <p className="order-card__elapsed">{closed}</p>}</CardBody>
    </article>
  );
}
