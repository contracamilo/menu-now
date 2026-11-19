import { Link } from 'react-router';
import { useI18n } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { priceLines } from '../../lib/money';
import { CatalogError, useCatalog, useCatalogAction, type AdminCategory, type AdminDish } from './useCatalog';

/** Catálogo del dueño: categorías y platos activos en orden, y sección de archivados (design D1). */
export function CatalogPage() {
  const { t, lang } = useI18n();
  const catalog = useCatalog();
  const action = useCatalogAction();

  const categoryName = (category: Pick<AdminCategory, 'is_included' | 'name'>) =>
    category.is_included ? t('category.included') : (category.name ?? '');
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-IE', { dateStyle: 'medium' }).format(new Date(iso));

  if (catalog.isPending) return <main className="page" aria-busy="true" />;
  if (catalog.isError) {
    return (
      <main className="page" role="alert">
        <p>{t('common.loadError')}</p>
        <button type="button" className="button tap-target button--primary" onClick={() => void catalog.refetch()}>
          {t('menu.retry')}
        </button>
      </main>
    );
  }

  const categories = catalog.data;
  const active = categories.filter((c) => !c.archived_at);
  const archivedCategories = categories.filter((c) => c.archived_at);
  const archivedDishes = active.flatMap((c) => c.dishes.filter((d) => d.archived_at).map((d) => ({ dish: d, category: c })));
  const hasDishes = categories.some((c) => c.dishes.length > 0);

  let actionError: MessageKey | null = null;
  if (action.error) {
    actionError = action.error instanceof CatalogError && action.error.code === '23505' ? 'error.categoryNameTaken' : 'form.saveError';
  }

  const pending = action.isPending;

  return (
    <main className="page catalog">
      <h1>{t('admin.title')}</h1>
      <p className="catalog__actions">
        <Link className="button tap-target button--primary" to="/admin/categories/new">
          {t('admin.newCategory')}
        </Link>
      </p>

      <p role="alert" className="message message--error">
        {actionError && t(actionError)}
      </p>

      {!hasDishes && <p className="notice">{t('admin.empty')}</p>}

      {active.map((category, index) => {
        const name = categoryName(category);
        const dishes = category.dishes.filter((d) => !d.archived_at);
        return (
          <section key={category.id} className="catalog-category" aria-labelledby={`admin-cat-${category.id}`}>
            <div className="catalog-category__header">
              <h2 id={`admin-cat-${category.id}`}>{name}</h2>
              <div className="row-actions">
                <MoveButtons
                  name={name}
                  first={index === 0}
                  last={index === active.length - 1}
                  disabled={pending}
                  onMove={(direction) => action.mutate({ kind: 'move', target: 'category', id: category.id, direction })}
                />
                {!category.is_included && (
                  <>
                    <Link className="button tap-target" to={`/admin/categories/${category.id}`}>
                      {t('admin.edit')}
                      {' '}
                      <span className="visually-hidden">{name}</span>
                    </Link>
                    <button
                      type="button"
                      className="button tap-target"
                      disabled={pending}
                      onClick={() => action.mutate({ kind: 'archive', target: 'category', id: category.id })}
                    >
                      {t('admin.archive')}
                      {' '}
                      <span className="visually-hidden">{name}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {category.is_included && <p className="hint">{t('admin.includedHint')}</p>}
            {dishes.length === 0 && <p className="notice">{t('admin.categoryHidden')}</p>}

            <ul className="catalog-dishes">
              {dishes.map((dish, dishIndex) => (
                <li key={dish.id} className="catalog-dish">
                  <DishSummary dish={dish} />
                  <div className="row-actions">
                    <MoveButtons
                      name={dish.name}
                      first={dishIndex === 0}
                      last={dishIndex === dishes.length - 1}
                      disabled={pending}
                      onMove={(direction) => action.mutate({ kind: 'move', target: 'dish', id: dish.id, direction })}
                    />
                    <Link className="button tap-target" to={`/admin/dishes/${dish.id}`}>
                      {t('admin.edit')}
                      {' '}
                      <span className="visually-hidden">{dish.name}</span>
                    </Link>
                    <button
                      type="button"
                      className="button tap-target"
                      disabled={pending}
                      onClick={() => action.mutate({ kind: 'archive', target: 'dish', id: dish.id })}
                    >
                      {t('admin.archive')}
                      {' '}
                      <span className="visually-hidden">{dish.name}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <Link className="button tap-target" to={`/admin/dishes/new?category=${category.id}`}>
              {t('admin.newDish')}
              {' '}
                      <span className="visually-hidden">({name})</span>
            </Link>
          </section>
        );
      })}

      {(archivedCategories.length > 0 || archivedDishes.length > 0) && (
        <section className="catalog-archived" aria-labelledby="admin-archived">
          <h2 id="admin-archived">{t('admin.archived')}</h2>

          {archivedCategories.map((category) => {
            const name = categoryName(category);
            return (
              <div key={category.id} className="catalog-archived__category">
                <h3>{name}</h3>
                <p className="hint">{t('admin.categoryArchivedHint')}</p>
                <div className="row-actions">
                  <Link className="button tap-target" to={`/admin/categories/${category.id}`}>
                    {t('admin.edit')}
                    {' '}
                      <span className="visually-hidden">{name}</span>
                  </Link>
                  <button
                    type="button"
                    className="button tap-target"
                    disabled={pending}
                    onClick={() => action.mutate({ kind: 'reactivate', target: 'category', id: category.id })}
                  >
                    {t('admin.reactivate')}
                    {' '}
                      <span className="visually-hidden">{name}</span>
                  </button>
                </div>
                {category.dishes.length > 0 && (
                  <ul className="catalog-dishes">
                    {category.dishes.map((dish) => (
                      <li key={dish.id} className="catalog-dish">
                        <DishSummary dish={dish} />
                        <Link className="button tap-target" to={`/admin/dishes/${dish.id}`}>
                          {t('admin.edit')}
                          {' '}
                      <span className="visually-hidden">{dish.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {archivedDishes.length > 0 && (
            <ul className="catalog-dishes">
              {archivedDishes.map(({ dish, category }) => (
                <li key={dish.id} className="catalog-dish">
                  <DishSummary dish={dish} />
                  <p className="hint">
                    {categoryName(category)} · {t('admin.archivedOn', { date: formatDate(dish.archived_at!) })}
                  </p>
                  <div className="row-actions">
                    <Link className="button tap-target" to={`/admin/dishes/${dish.id}`}>
                      {t('admin.edit')}
                      {' '}
                      <span className="visually-hidden">{dish.name}</span>
                    </Link>
                    <button
                      type="button"
                      className="button tap-target"
                      disabled={pending}
                      onClick={() => action.mutate({ kind: 'reactivate', target: 'dish', id: dish.id })}
                    >
                      {t('admin.reactivate')}
                      {' '}
                      <span className="visually-hidden">{dish.name}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function DishSummary({ dish }: { dish: AdminDish }) {
  const { lang } = useI18n();
  return (
    <div className="catalog-dish__summary">
      <h3 className="catalog-dish__name">{dish.name}</h3>
      <p className="catalog-dish__prices">{priceLines(dish, lang).join(' / ')}</p>
    </div>
  );
}

function MoveButtons({
  name,
  first,
  last,
  disabled,
  onMove,
}: {
  name: string;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button
        type="button"
        className="button tap-target button--icon"
        aria-label={t('admin.moveUp', { name })}
        disabled={disabled || first}
        onClick={() => onMove(-1)}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        className="button tap-target button--icon"
        aria-label={t('admin.moveDown', { name })}
        disabled={disabled || last}
        onClick={() => onMove(1)}
      >
        <span aria-hidden="true">↓</span>
      </button>
    </>
  );
}
