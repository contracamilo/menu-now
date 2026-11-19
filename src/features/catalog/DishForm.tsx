import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { ALLERGENS, type Allergen } from '../../lib/allergens';
import { centsToInput, parsePriceToCents } from '../../lib/money';
import { newImagePath, removeImage, uploadImage } from '../../lib/images';
import { supabase } from '../../lib/supabase';
import { NotFoundPage } from '../../NotFoundPage';
import { CatalogError, useCatalog, useInvalidateCatalog, type AdminDish } from './useCatalog';
import { DishPhotoField, type PhotoState } from './DishPhotoField';

export const DISH_NAME_MAX = 80;
export const DESCRIPTION_MAX = 160;
export const INCLUDED_WITH_MAX = 60;
export const SIZE_LABEL_MAX = 20;

interface SizeRow {
  key: string;
  id?: string;
  label: string;
  price: string;
}

interface Errors {
  name?: MessageKey;
  category?: MessageKey;
  includedWith?: MessageKey;
  sizes?: MessageKey;
  sizeRows?: Record<string, MessageKey>;
  allergens?: MessageKey;
  form?: MessageKey;
}

let rowCounter = 0;
const newRow = (partial: Partial<SizeRow> = {}): SizeRow => ({ key: `row-${++rowCounter}`, label: '', price: '', ...partial });

/** Crear o editar un plato (design D4: se guarda con la RPC atómica `save_dish`). */
export function DishForm() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const catalog = useCatalog();
  const invalidate = useInvalidateCatalog();

  const existing: AdminDish | undefined = useMemo(
    () => (id ? catalog.data?.flatMap((c) => c.dishes).find((d) => d.id === id) : undefined),
    [catalog.data, id],
  );
  // Un plato nuevo recibe su id en el cliente para poder subir la foto antes de guardar
  const [dishId] = useState(() => id ?? crypto.randomUUID());

  const [loaded, setLoaded] = useState(!id);
  const [categoryId, setCategoryId] = useState(params.get('category') ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includedWith, setIncludedWith] = useState('');
  const [sizes, setSizes] = useState<SizeRow[]>(() => [newRow()]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [noAllergens, setNoAllergens] = useState(false);
  const [photo, setPhoto] = useState<PhotoState>({ current: null, pending: null, removed: false });
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (existing && !loaded) {
      setCategoryId(existing.category_id);
      setName(existing.name);
      setDescription(existing.description ?? '');
      setIncludedWith(existing.included_with ?? '');
      setSizes(
        existing.dish_sizes.length > 0
          ? existing.dish_sizes.map((s) => newRow({ id: s.id, label: s.label ?? '', price: centsToInput(s.price_cents, lang) }))
          : [newRow()],
      );
      setAllergens(existing.allergens);
      setNoAllergens(existing.no_allergens);
      setPhoto({ current: existing.photo_path, pending: null, removed: false });
      setLoaded(true);
    }
  }, [existing, loaded, lang]);

  const categories = (catalog.data ?? []).filter((c) => !c.archived_at || c.id === existing?.category_id);
  const category = categories.find((c) => c.id === categoryId);
  const isIncluded = Boolean(category?.is_included);

  const save = useMutation({
    mutationFn: async (payload: { dish: Record<string, unknown>; sizes: Array<Record<string, unknown>> }) => {
      // Foto: se sube la nueva (nombre único) antes de guardar y se borra la anterior después
      let photoPath = photo.removed ? null : photo.current;
      if (photo.pending) {
        photoPath = newImagePath('dish', dishId);
        await uploadImage(photoPath, photo.pending.blob);
      }
      const { error } = await supabase.rpc('save_dish', {
        p_dish: { ...payload.dish, photo_path: photoPath },
        p_sizes: payload.sizes,
      });
      if (error) {
        if (photo.pending && photoPath) await removeImage(photoPath);
        throw new CatalogError(error.code, error.message);
      }
      if (photo.current && photo.current !== photoPath) await removeImage(photo.current);
    },
    onSuccess: async () => {
      await invalidate();
      navigate('/admin', { state: { notice: 'form.saved' } });
    },
    onError: (e) => {
      const duplicate = e instanceof CatalogError && e.code === '23505';
      setErrors(duplicate ? { sizes: 'error.sizeLabelDuplicate' } : { form: 'form.saveError' });
    },
  });

  if (id && catalog.isSuccess && !existing) return <NotFoundPage />;
  if (!catalog.isSuccess || (id && !loaded)) return <main className="page" aria-busy="true" />;

  function toggleAllergen(code: Allergen, checked: boolean) {
    setAllergens((list) => (checked ? [...list, code] : list.filter((a) => a !== code)));
    if (checked) setNoAllergens(false); // solo una declaración
  }

  function toggleNoAllergens(checked: boolean) {
    setNoAllergens(checked);
    if (checked) setAllergens([]);
  }

  function updateSize(key: string, change: Partial<SizeRow>) {
    setSizes((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  function moveSize(index: number, direction: -1 | 1) {
    setSizes((rows) => {
      const next = [...rows];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  function validate(): { errors: Errors; sizes: Array<Record<string, unknown>> } {
    const found: Errors = {};
    const payloadSizes: Array<Record<string, unknown>> = [];
    if (!name.trim()) found.name = 'error.required';
    if (!category) found.category = 'error.required';
    if (isIncluded) {
      if (!includedWith.trim()) found.includedWith = 'error.required';
    } else {
      const rowErrors: Record<string, MessageKey> = {};
      for (const row of sizes) {
        const parsed = parsePriceToCents(row.price);
        if ('error' in parsed) rowErrors[row.key] = parsed.error;
        else payloadSizes.push({ ...(row.id ? { id: row.id } : {}), label: row.label.trim() || null, price_cents: parsed.cents });
      }
      if (Object.keys(rowErrors).length > 0) found.sizeRows = rowErrors;
      const labels = sizes.map((row) => row.label.trim().toLowerCase());
      if (sizes.length === 0) found.sizes = 'error.required';
      else if (sizes.length > 1 && labels.some((label) => !label)) found.sizes = 'error.sizeLabelRequired';
      else if (new Set(labels).size !== labels.length) found.sizes = 'error.sizeLabelDuplicate';
    }
    if (!noAllergens && allergens.length === 0) found.allergens = 'error.allergenDeclaration';
    return { errors: found, sizes: payloadSizes };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validate();
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) return;
    save.mutate({
      dish: {
        id: dishId,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim() || null,
        included_with: isIncluded ? includedWith.trim() : null,
        allergens: ALLERGENS.filter((a) => allergens.includes(a)),
        no_allergens: noAllergens,
      },
      sizes: isIncluded ? [] : result.sizes,
    });
  }

  const err = (key: MessageKey | undefined, max?: number) => (key ? t(key, max ? { max } : undefined) : null);

  return (
    <main className="page">
      <h1>{t(id ? 'admin.edit' : 'admin.newDish')}</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="dish-category">{t('form.category')}</label>
          <select
            id="dish-category"
            className="select"
            value={categoryId}
            aria-invalid={errors.category ? true : undefined}
            aria-describedby="dish-category-error"
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="" disabled>
              —
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.is_included ? t('category.included') : c.name}
              </option>
            ))}
          </select>
          <span id="dish-category-error" className="message message--error">
            {err(errors.category)}
          </span>
        </div>

        <TextField
          id="dish-name"
          label={t('form.name')}
          value={name}
          max={DISH_NAME_MAX}
          error={err(errors.name)}
          onChange={setName}
        />

        <TextField
          id="dish-description"
          label={t('form.description')}
          value={description}
          max={DESCRIPTION_MAX}
          multiline
          onChange={setDescription}
        />

        {isIncluded ? (
          <TextField
            id="dish-included-with"
            label={t('form.includedWith')}
            hint={t('form.includedWithHint')}
            value={includedWith}
            max={INCLUDED_WITH_MAX}
            error={err(errors.includedWith)}
            onChange={setIncludedWith}
          />
        ) : (
          <fieldset className="field" aria-describedby="dish-sizes-error">
            <legend>{t('form.sizes')}</legend>
            {sizes.map((row, index) => {
              const label = row.label.trim() || String(index + 1);
              const rowError = errors.sizeRows?.[row.key];
              return (
                <div key={row.key} className="size-row">
                  <div className="field">
                    <label htmlFor={`${row.key}-label`}>{t('form.sizeLabel')}</label>
                    <input
                      id={`${row.key}-label`}
                      className="input"
                      value={row.label}
                      maxLength={SIZE_LABEL_MAX}
                      aria-invalid={errors.sizes && errors.sizes !== 'error.required' ? true : undefined}
                      onChange={(e) => updateSize(row.key, { label: e.target.value })}
                    />
                  </div>
                  <div className="field size-row__price">
                    <label htmlFor={`${row.key}-price`}>{t('form.sizePrice')}</label>
                    <input
                      id={`${row.key}-price`}
                      className="input"
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.price}
                      aria-invalid={rowError ? true : undefined}
                      aria-describedby={`${row.key}-error`}
                      onChange={(e) => updateSize(row.key, { price: e.target.value })}
                    />
                    <span id={`${row.key}-error`} className="message message--error">
                      {err(rowError)}
                    </span>
                  </div>
                  <div className="row-actions">
                    {sizes.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="button tap-target button--icon"
                          aria-label={t('admin.moveUp', { name: label })}
                          disabled={index === 0}
                          onClick={() => moveSize(index, -1)}
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button
                          type="button"
                          className="button tap-target button--icon"
                          aria-label={t('admin.moveDown', { name: label })}
                          disabled={index === sizes.length - 1}
                          onClick={() => moveSize(index, 1)}
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                        <button
                          type="button"
                          className="button tap-target"
                          onClick={() => setSizes((rows) => rows.filter((r) => r.key !== row.key))}
                        >
                          {t('form.removeSize', { label })}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <span id="dish-sizes-error" role="alert" className="message message--error">
              {err(errors.sizes)}
            </span>
            <div>
              <button type="button" className="button tap-target" onClick={() => setSizes((rows) => [...rows, newRow()])}>
                {t('form.addSize')}
              </button>
            </div>
          </fieldset>
        )}

        <fieldset className="field" aria-describedby="dish-allergens-error">
          <legend>{t('form.allergens')}</legend>
          <div className="checkbox-grid">
            {ALLERGENS.map((code) => (
              <label key={code} className="checkbox">
                <input
                  type="checkbox"
                  checked={allergens.includes(code)}
                  onChange={(e) => toggleAllergen(code, e.target.checked)}
                />
                {t(`allergen.${code}`)}
              </label>
            ))}
          </div>
          <label className="checkbox checkbox--strong">
            <input type="checkbox" checked={noAllergens} onChange={(e) => toggleNoAllergens(e.target.checked)} />
            {t('form.noAllergens')}
          </label>
          <span id="dish-allergens-error" role="alert" className="message message--error">
            {err(errors.allergens)}
          </span>
        </fieldset>

        <DishPhotoField value={photo} onChange={setPhoto} />

        <p role="alert" className="message message--error">
          {err(errors.form)}
        </p>
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

function TextField({
  id,
  label,
  hint,
  value,
  max,
  error,
  multiline = false,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  max: number;
  error?: string | null;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const props = {
    id,
    value,
    maxLength: max,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': `${id}-hint ${id}-count ${id}-error`,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
      {multiline ? (
        <textarea className="textarea" {...props} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" {...props} onChange={(e) => onChange(e.target.value)} />
      )}
      <span id={`${id}-count`} className="field__count">
        {t('form.charCount', { count: value.length, max })}
      </span>
      <span id={`${id}-error`} className="message message--error">
        {error}
      </span>
    </div>
  );
}
