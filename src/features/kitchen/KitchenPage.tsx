import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n/useT';
import { useKitchen } from './KitchenLayout';
import { ActiveOrderCard, statusText } from './OrderCard';
import { useNow } from './useNow';
import type { KitchenOrder, OrderChangeResult } from './types';

interface CancelRequest {
  order: KitchenOrder;
  confirm: () => void;
}

/** Pendientes (`/admin/kitchen`): pedidos activos del día, del más antiguo al más reciente (design D8). */
export function KitchenPage() {
  const t = useT();
  const { query, data, active, realtime } = useKitchen();
  const now = useNow(30_000);
  const [conflict, setConflict] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [cancelRequest, setCancelRequest] = useState<CancelRequest | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (cancelRequest && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    } else if (!cancelRequest && element.open) {
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
    }
  }, [cancelRequest]);

  function onResult(order: KitchenOrder, result: OrderChangeResult) {
    if (result.status === 'ok') {
      setConflict(null);
      setStatus(t('kitchen.statusChanged', { number: order.number, status: statusText(t, result.order.status) }));
    } else if (result.status === 'conflict') {
      setConflict(t('kitchen.conflict', { number: order.number, status: statusText(t, result.current_status) }));
    }
  }

  function confirmCancel() {
    cancelRequest?.confirm();
    setCancelRequest(null);
  }

  if (!data) {
    if (!query.isError) return null;
    return (
      <main className="page" role="alert">
        <p>{t('common.loadError')}</p>
        <button type="button" className="button tap-target button--primary" onClick={() => void query.refetch()}>
          {t('menu.retry')}
        </button>
      </main>
    );
  }

  return (
    <main className="kitchen__main">
      {conflict && (
        <p role="alert" className="message message--error kitchen-conflict">
          {conflict}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {status}
      </p>
      {active.length === 0 ? (
        <p className="kitchen__empty">{t('kitchen.empty')}</p>
      ) : (
        <ol className="kitchen-grid">
          {active.map((order) => (
            <li key={order.id}>
              <ActiveOrderCard
                order={order}
                now={now}
                clockOffset={data.clockOffset}
                isNew={realtime.newIds.has(order.id)}
                onStart={(o) => realtime.clearNew(o.id)}
                onResult={onResult}
                onRequestCancel={(o, confirm) => setCancelRequest({ order: o, confirm })}
              />
            </li>
          ))}
        </ol>
      )}

      <dialog ref={dialog} className="size-picker kitchen-dialog" aria-labelledby="cancel-title" onClose={() => setCancelRequest(null)}>
        {cancelRequest && (
          <>
            <h2 id="cancel-title" className="size-picker__title">
              {t('kitchen.cancelConfirm', { number: cancelRequest.order.number, table: cancelRequest.order.table_name })}
            </h2>
            <div className="kitchen-dialog__actions">
              <button type="button" className="button kitchen-action" onClick={() => setCancelRequest(null)}>
                {t('kitchen.cancelNo')}
              </button>
              <button type="button" className="button kitchen-action kitchen-action--danger" onClick={confirmCancel}>
                {t('kitchen.cancelYes')}
              </button>
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
