import { useT } from '../../i18n/useT';
import { useKitchen } from './KitchenLayout';
import { HistoryOrderCard } from './OrderCard';

/** Histórico de hoy (`/admin/kitchen/history`): servidos y cancelados, del cierre más reciente al más antiguo. */
export function HistoryPage() {
  const t = useT();
  const { query, data, history } = useKitchen();

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
      {history.length === 0 ? (
        <p className="kitchen__empty">{t('history.empty')}</p>
      ) : (
        <ol className="kitchen-grid">
          {history.map((order) => (
            <li key={order.id}>
              <HistoryOrderCard order={order} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
