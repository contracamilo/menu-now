import { Link } from 'react-router';
import { useI18n } from '../../i18n/useT';
import { byName, tableErrorKey, useTableAction, useTables, type AdminTable } from './useTables';

/** «Mesas» del dueño: activas por nombre y archivadas aparte (spec table-management, design D9). */
export function TablesPage() {
  const { t, lang } = useI18n();
  const tables = useTables();
  const action = useTableAction();

  if (tables.isPending) return <main className="page" aria-busy="true" />;
  if (tables.isError) {
    return (
      <main className="page" role="alert">
        <p>{t('common.loadError')}</p>
        <button type="button" className="button tap-target button--primary" onClick={() => void tables.refetch()}>
          {t('menu.retry')}
        </button>
      </main>
    );
  }

  const sorted = [...tables.data].sort(byName(lang));
  const active = sorted.filter((table) => !table.archived_at);
  const archived = sorted.filter((table) => table.archived_at);

  return (
    <main className="page tables">
      <h1>{t('admin.tables')}</h1>
      <p className="catalog__actions">
        <Link className="button tap-target button--primary" to="/admin/tables/new">
          {t('tables.new')}
        </Link>
      </p>

      <p role="alert" className="message message--error">
        {action.error && t(tableErrorKey(action.error))}
      </p>

      {active.length === 0 && <p className="notice">{t('tables.empty')}</p>}

      {active.length > 0 && (
        <ul className="catalog-dishes tables-list" aria-label={t('admin.tables')}>
          {active.map((table) => (
            <TableRow key={table.id} table={table}>
              <Link className="button tap-target" to={`/admin/tables/${table.id}/qr`}>
                {t('tables.showQr', { name: table.name })}
              </Link>
              <Link className="button tap-target" to={`/admin/tables/${table.id}`}>
                {t('admin.edit')} <span className="visually-hidden">{table.name}</span>
              </Link>
              <button
                type="button"
                className="button tap-target"
                disabled={action.isPending}
                onClick={() => action.mutate({ kind: 'archive', id: table.id })}
              >
                {t('admin.archive')} <span className="visually-hidden">{table.name}</span>
              </button>
            </TableRow>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="catalog-archived" aria-labelledby="tables-archived">
          <h2 id="tables-archived">{t('tables.archived')}</h2>
          <p className="hint">{t('tables.archivedHint')}</p>
          <ul className="catalog-dishes">
            {archived.map((table) => (
              <TableRow key={table.id} table={table}>
                <button
                  type="button"
                  className="button tap-target"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ kind: 'reactivate', id: table.id })}
                >
                  {t('admin.reactivate')} <span className="visually-hidden">{table.name}</span>
                </button>
              </TableRow>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function TableRow({ table, children }: { table: AdminTable; children: React.ReactNode }) {
  return (
    <li className="catalog-dish">
      <div className="catalog-dish__summary">
        <h3 className="catalog-dish__name">{table.name}</h3>
      </div>
      <div className="row-actions">{children}</div>
    </li>
  );
}
