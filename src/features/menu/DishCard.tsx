import { useI18n } from '../../i18n/useT';
import { sortAllergens } from '../../lib/allergens';
import { publicImageUrl } from '../../lib/rest';
import { priceLines } from '../../lib/money';
import type { Dish } from '../../lib/types';

interface Props {
  dish: Dish;
  /** Las dos primeras fotos del listado se cargan sin diferir (design D6). */
  eagerPhoto?: boolean;
}

/** Un plato de la carta: nombre, precios, descripción, foto y alérgenos siempre visibles. */
export function DishCard({ dish, eagerPhoto = false }: Props) {
  const { lang, t } = useI18n();
  const titleId = `dish-${dish.id}`;
  const lines = priceLines(dish, lang);

  return (
    <article className={dish.photo_path ? 'dish dish--with-photo' : 'dish'} aria-labelledby={titleId}>
      <h3 id={titleId} className="dish__name">
        {dish.name}
      </h3>

      {dish.included_with ? (
        <p className="dish__included">{lines[0]}</p>
      ) : (
        <ul className="dish__prices">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {dish.description && <p className="dish__description">{dish.description}</p>}

      <div className="dish__allergens">
        {dish.no_allergens ? (
          <p className="dish__no-allergens">{t('menu.noAllergens')}</p>
        ) : (
          <>
            <p className="dish__allergens-label" id={`${titleId}-allergens`}>
              {t('menu.allergens')}
            </p>
            <ul className="allergen-list" aria-labelledby={`${titleId}-allergens`}>
              {sortAllergens(dish.allergens).map((code) => (
                <li key={code} className="allergen-chip">
                  {t(`allergen.${code}`)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {dish.photo_path && (
        <img
          className="dish__photo"
          src={publicImageUrl(dish.photo_path)}
          alt=""
          width={480}
          height={360}
          loading={eagerPhoto ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
    </article>
  );
}
