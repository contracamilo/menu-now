import { useMemo } from 'react';
import { useT } from '../../i18n/useT';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { VenueHeader } from '../venue/VenueHeader';
import { BackToTop } from './BackToTop';
import { CategoryIndex } from './CategoryIndex';
import { DishCard } from './DishCard';
import { useAfterFirstPaint } from './useAfterFirstPaint';
import { useMenu } from './useMenu';
import { visibleCategories } from './visibleCategories';
import '../../styles/menu.scss';

/** Carta pública del comensal (spec menu, design D6 y D10). */
export function MenuPage() {
  const t = useT();
  const menu = useMenu();
  const categories = useMemo(() => visibleCategories(menu.data ?? [], t), [menu.data, t]);

  // Las fotos se piden tras pintar el texto: así el texto es lo primero y el LCP (design D6)
  const showPhotos = useAfterFirstPaint(categories.length > 0);

  // Índices de las dos primeras fotos del listado, que no se difieren
  const eagerIds = useMemo(
    () =>
      new Set(
        categories
          .flatMap((c) => c.dishes)
          .filter((d) => d.photo_path)
          .slice(0, 2)
          .map((d) => d.id),
      ),
    [categories],
  );

  let content;
  if (menu.isPending) {
    content = (
      <p role="status" className="status">
        {t('menu.loading')}
      </p>
    );
  } else if (menu.isError) {
    content = (
      <div role="alert" className="status">
        <p>{t('menu.error')}</p>
        <button type="button" className="button tap-target button--primary" onClick={() => void menu.refetch()}>
          {t('menu.retry')}
        </button>
      </div>
    );
  } else if (categories.length === 0) {
    content = (
      <p role="status" className="status">
        {t('menu.empty')}
      </p>
    );
  } else {
    content = (
      <>
        <p role="note" className="allergy-notice">
          {t('menu.allergyNotice')}
        </p>

        <CategoryIndex categories={categories} />

        <p className="vat-note">{t('menu.vatIncluded')}</p>

        {categories.map((category) => (
          <section key={category.id} className="menu-category" aria-labelledby={`cat-${category.id}`}>
            <h2 id={`cat-${category.id}`} className="menu-category__title">
              {category.name}
            </h2>
            {category.dishes.map((dish) => (
              <DishCard key={dish.id} dish={dish} showPhoto={showPhotos} eagerPhoto={eagerIds.has(dish.id)} />
            ))}
          </section>
        ))}
      </>
    );
  }

  return (
    <main className="page menu-page">
      <VenueHeader>
        <LanguageSwitcher />
      </VenueHeader>
      {content}
      <BackToTop />
    </main>
  );
}
