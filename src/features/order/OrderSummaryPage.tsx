import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../../i18n/useT';
import { formatPrice } from '../../lib/money';
import type { DraftLine, PlaceOrderResult } from '../../lib/types';
import '../../styles/menu.scss';
import { ordersQueryKey, placeOrder } from './orderApi';
import { useOrder } from './OrderProvider';
import { lineName, lineTotal, MAX_QUANTITY, NOTE_MAX, orderTotal } from './orderReducer';
import { rememberOrderId } from './orderStorage';
import { OrderAnnouncer } from './TableMenuPage';
import { tableQueryKey, useTable } from './useTable';

type Notice =
  | { kind: 'rejected'; unavailable: string[]; priceChanged: string[]; empty: boolean }
  | { kind: 'tableUnavailable' }
  | { kind: 'sendError' };

const newOrderId = () => crypto.randomUUID();

/** Resumen del pedido sin confirmar y confirmación (spec table-ordering, design D8). */
export default function OrderSummaryPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, draft, dispatch, announce } = useOrder();
  const table = useTable(token);
  const [notice, setNotice] = useState<Notice | null>(null);
  const price = (cents: number) => formatPrice(cents, lang);
  const total = orderTotal(draft.lines);

  const send = useMutation({
    mutationFn: ({ orderId, lines }: { orderId: string; lines: DraftLine[] }) => placeOrder(token, orderId, lines),
    onSuccess: (result: PlaceOrderResult, { lines }) => {
      if (result.status === 'placed') {
        rememberOrderId(token, result.order.id);
        queryClient.setQueryData(ordersQueryKey(token, [result.order.id]), [result.order]);
        dispatch({ type: 'clear' });
        navigate(`/t/${token}/orders/${result.order.id}`);
        return;
      }
      if (result.status === 'table_unavailable') {
        setNotice({ kind: 'tableUnavailable' });
        void queryClient.invalidateQueries({ queryKey: tableQueryKey(token) });
        return;
      }
      const nameOf = (dishId: string, sizeId: string, fallback: string | null) =>
        fallback ?? lines.find((l) => l.dish_id === dishId && l.size_id === sizeId)?.dish_name ?? '';
      const unavailable = [...new Set(result.unavailable.map((u) => nameOf(u.dish_id, u.size_id, u.dish_name)))];
      const priceChanged = [...new Set(result.price_changes.map((p) => p.dish_name))];
      const gone = new Set(result.unavailable.map((u) => `${u.dish_id}:${u.size_id}`));
      dispatch({ type: 'applyRejection', unavailable: result.unavailable, priceChanges: result.price_changes });
      setNotice({
        kind: 'rejected',
        unavailable,
        priceChanged,
        empty: lines.every((l) => gone.has(`${l.dish_id}:${l.size_id}`)),
      });
    },
    onError: () => setNotice({ kind: 'sendError' }),
  });

  const tableBlocked = notice?.kind === 'tableUnavailable' || table.data === null || table.data?.active === false;
  const canConfirm = draft.lines.length > 0 && !tableBlocked;

  function confirm() {
    if (send.isPending || !canConfirm) return;
    // El mismo id mientras el pedido no cambie: reintentar no crea otro pedido (design D7)
    const orderId = draft.orderId ?? newOrderId();
    if (!draft.orderId) dispatch({ type: 'setOrderId', orderId });
    setNotice(null);
    send.mutate({ orderId, lines: draft.lines });
  }

  function setQuantity(line: DraftLine, quantity: number) {
    dispatch({ type: 'setQuantity', key: line.key, quantity });
    const nextTotal = total + (quantity - line.quantity) * line.unit_price_cents;
    announce(t('order.quantityChanged', { dish: lineName(line), quantity, total: price(nextTotal) }));
  }

  function remove(line: DraftLine) {
    dispatch({ type: 'remove', key: line.key });
    announce(t('order.removed', { dish: lineName(line) }));
  }

  return (
    <main className="page order-page">
      <h1>{t('order.title')}</h1>
      {table.data && <p className="order-page__table">{t('order.forTable', { table: table.data.name })}</p>}

      <div role="alert" className="order-alerts">
        {notice?.kind === 'rejected' && notice.unavailable.length > 0 && (
          <p className="order-notice order-notice--warning">
            {t(notice.empty ? 'order.allUnavailable' : 'order.unavailable', { dishes: notice.unavailable.join(', ') })}
          </p>
        )}
        {notice?.kind === 'rejected' && notice.priceChanged.length > 0 && (
          <p className="order-notice order-notice--warning">
            {t('order.priceChanged', { dishes: notice.priceChanged.join(', ') })}
          </p>
        )}
        {tableBlocked && !table.isPending && <p className="order-notice order-notice--warning">{t('order.tableUnavailable')}</p>}
        {notice?.kind === 'sendError' && (
          <div className="order-notice order-notice--warning">
            <p>{t('order.sendError')}</p>
            <button type="button" className="button tap-target button--primary" onClick={confirm}>
              {t('order.retry')}
            </button>
          </div>
        )}
      </div>

      {draft.lines.length === 0 ? (
        <p className="status">{t('order.empty')}</p>
      ) : (
        <ul className="order-lines">
          {draft.lines.map((line) => {
            const name = lineName(line);
            const noteId = `note-${line.key}`;
            return (
              <li key={line.key} className="order-line">
                <div className="order-line__head">
                  <h2 className="order-line__name">{name}</h2>
                  <p className="order-line__amount">{price(lineTotal(line))}</p>
                </div>
                <div className="order-line__controls">
                  <div className="stepper" role="group" aria-label={t('order.quantity', { dish: name })}>
                    <button
                      type="button"
                      className="button tap-target button--icon"
                      aria-label={t('order.decrease', { dish: name })}
                      disabled={line.quantity <= 1}
                      onClick={() => setQuantity(line, line.quantity - 1)}
                    >
                      <span aria-hidden="true">−</span>
                    </button>
                    <span className="stepper__value">{line.quantity}</span>
                    <button
                      type="button"
                      className="button tap-target button--icon"
                      aria-label={t('order.increase', { dish: name })}
                      disabled={line.quantity >= MAX_QUANTITY}
                      onClick={() => setQuantity(line, line.quantity + 1)}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                  <span className="order-line__unit">× {price(line.unit_price_cents)}</span>
                  <button type="button" className="button tap-target" onClick={() => remove(line)}>
                    {t('order.remove', { dish: name })}
                  </button>
                </div>
                <div className="field">
                  <label htmlFor={noteId}>
                    {t('order.note')} <span className="visually-hidden">({name})</span>
                  </label>
                  <textarea
                    id={noteId}
                    className="textarea order-line__note"
                    rows={2}
                    maxLength={NOTE_MAX}
                    value={line.note}
                    placeholder={t('order.noteHint')}
                    aria-describedby={`${noteId}-count`}
                    onChange={(e) => dispatch({ type: 'setNote', key: line.key, note: e.target.value })}
                  />
                  <span id={`${noteId}-count`} className="field__count">
                    {t('form.charCount', { count: line.note.length, max: NOTE_MAX })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draft.lines.length > 0 && (
        <p className="order-total">
          <span>{t('order.total')}</span> <strong>{price(total)}</strong>
        </p>
      )}

      <div className="order-actions">
        {canConfirm && (
          <button
            type="button"
            className="button tap-target button--primary order-actions__confirm"
            aria-busy={send.isPending || undefined}
            disabled={send.isPending}
            onClick={confirm}
          >
            {send.isPending ? t('order.sending') : t('order.confirm')}
          </button>
        )}
        <Link className="button tap-target" to={`/t/${token}`}>
          {t('order.keepOrdering')}
        </Link>
      </div>
      <OrderAnnouncer />
    </main>
  );
}
