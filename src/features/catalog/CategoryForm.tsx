import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { supabase } from '../../lib/supabase';
import { NotFoundPage } from '../../NotFoundPage';
import { CatalogError, useCatalog, useInvalidateCatalog } from './useCatalog';

export const CATEGORY_NAME_MAX = 40;
const RESERVED = ['incluidos', 'included'];
const normalize = (name: string) => name.trim().toLowerCase();

/** Crear o renombrar una categoría (no «Incluidos»). */
export function CategoryForm() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const catalog = useCatalog();
  const invalidate = useInvalidateCatalog();
  const existing = id ? catalog.data?.find((c) => c.id === id) : undefined;

  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name ?? '');
      setLoaded(true);
    }
  }, [existing, loaded]);

  const save = useMutation({
    mutationFn: async (value: string) => {
      const { error: dbError } = id
        ? await supabase.from('categories').update({ name: value }).eq('id', id)
        : await supabase.from('categories').insert({ name: value });
      if (dbError) throw new CatalogError(dbError.code, dbError.message);
    },
    onSuccess: async () => {
      await invalidate();
      navigate('/admin', { state: { notice: 'form.saved' } });
    },
    onError: (e) => {
      const code = e instanceof CatalogError ? e.code : undefined;
      setError(code === '23505' ? 'error.categoryNameTaken' : code === '23514' ? 'error.categoryNameReserved' : 'form.saveError');
    },
  });

  if (id && catalog.isSuccess && (!existing || existing.is_included)) return <NotFoundPage />;
  if (id && !loaded) return <main className="page" aria-busy="true" />;

  function validate(value: string): MessageKey | null {
    if (!value) return 'error.required';
    if (value.length > CATEGORY_NAME_MAX) return 'error.tooLong';
    if (RESERVED.includes(normalize(value))) return 'error.categoryNameReserved';
    const taken = catalog.data?.some(
      (c) => !c.archived_at && !c.is_included && c.id !== id && normalize(c.name ?? '') === normalize(value),
    );
    return taken ? 'error.categoryNameTaken' : null;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    const problem = validate(value);
    setError(problem);
    if (!problem) save.mutate(value);
  }

  return (
    <main className="page">
      <h1>{t(id ? 'admin.edit' : 'admin.newCategory')}</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="category-name">{t('form.name')}</label>
          <input
            id="category-name"
            className="input"
            value={name}
            maxLength={CATEGORY_NAME_MAX}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby="category-name-count category-name-error"
            onChange={(e) => setName(e.target.value)}
          />
          <span id="category-name-count" className="field__count">
            {t('form.charCount', { count: name.length, max: CATEGORY_NAME_MAX })}
          </span>
          <span id="category-name-error" role="alert" className="message message--error">
            {error && t(error, { max: CATEGORY_NAME_MAX })}
          </span>
        </div>
        <div className="field__actions">
          <button type="submit" className="button tap-target button--primary" disabled={save.isPending}>
            {t('form.save')}
          </button>
          <Link className="button tap-target" to="/admin">
            {t('form.cancel')}
          </Link>
        </div>
      </form>
    </main>
  );
}
