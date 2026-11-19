import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { NotFoundPage } from '../../NotFoundPage';
import { normalizeTableName, TABLE_NAME_MAX, tableErrorKey, useTableAction, useTables } from './useTables';

/** Crear o renombrar una mesa (spec table-management «Gestión de mesas»). Renombrar no cambia el QR. */
export function TableForm() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const tables = useTables();
  const action = useTableAction();
  const existing = id ? tables.data?.find((table) => table.id === id) : undefined;

  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (id && tables.isSuccess && !existing) return <NotFoundPage />;
  if (id && !loaded) return <main className="page" aria-busy="true" />;

  function validate(value: string): MessageKey | null {
    if (!value) return 'error.required';
    if (value.length > TABLE_NAME_MAX) return 'error.tooLong';
    const taken = tables.data?.some(
      (table) => !table.archived_at && table.id !== id && normalizeTableName(table.name) === normalizeTableName(value),
    );
    return taken ? 'error.tableNameTaken' : null;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    const problem = validate(value);
    setError(problem);
    if (problem) return;
    action.mutate(id ? { kind: 'rename', id, name: value } : { kind: 'create', name: value }, {
      onSuccess: () => navigate('/admin/tables'),
      onError: (e) => setError(tableErrorKey(e)),
    });
  }

  return (
    <main className="page">
      <h1>{t(id ? 'admin.edit' : 'tables.new')}</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="table-name">{t('tables.name')}</label>
          <input
            id="table-name"
            className="input"
            value={name}
            maxLength={TABLE_NAME_MAX}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby="table-name-count table-name-error"
            onChange={(e) => setName(e.target.value)}
          />
          <span id="table-name-count" className="field__count">
            {t('form.charCount', { count: name.length, max: TABLE_NAME_MAX })}
          </span>
          <span id="table-name-error" role="alert" className="message message--error">
            {error && t(error, { max: TABLE_NAME_MAX })}
          </span>
        </div>
        <div className="field__actions">
          <button type="submit" className="button tap-target button--primary" disabled={action.isPending}>
            {t('form.save')}
          </button>
          <Link className="button tap-target" to="/admin/tables">
            {t('form.cancel')}
          </Link>
        </div>
      </form>
    </main>
  );
}
