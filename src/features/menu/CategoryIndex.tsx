import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n/useT';

interface Props {
  categories: Array<{ id: string; name: string }>;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Índice de categorías en carrusel (spec menu, design D6): una sola fila con desplazamiento
 * lateral y una flecha en cada borde tras el que quedan categorías ocultas. Las flechas son una
 * ayuda para el dedo y el ratón; con teclado o lector de pantalla se recorren los enlaces.
 */
export function CategoryIndex({ categories }: Props) {
  const t = useT();
  const scroller = useRef<HTMLUListElement>(null);
  const [hidden, setHidden] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const before = el.scrollLeft > 1;
    const after = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setHidden((prev) => (prev.before === before && prev.after === after ? prev : { before, after }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure, categories]);

  function scroll(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    const left = direction * el.clientWidth * 0.8;
    if (typeof el.scrollBy === 'function') el.scrollBy({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
    else el.scrollLeft += left;
  }

  return (
    <nav className="menu-index" aria-label={t('menu.index')}>
      <ul ref={scroller} className="menu-index__track">
        {categories.map((category) => (
          <li key={category.id}>
            <a className="tap-target menu-index__link" href={`#cat-${category.id}`}>
              {category.name}
            </a>
          </li>
        ))}
      </ul>
      {hidden.before && (
        <div className="menu-index__edge menu-index__edge--before">
          <button
            type="button"
            className="tap-target menu-index__arrow"
            aria-hidden="true"
            tabIndex={-1}
            aria-label={t('menu.indexPrev')}
            title={t('menu.indexPrev')}
            onClick={() => scroll(-1)}
          >
            ‹
          </button>
        </div>
      )}
      {hidden.after && (
        <div className="menu-index__edge menu-index__edge--after">
          <button
            type="button"
            className="tap-target menu-index__arrow"
            aria-hidden="true"
            tabIndex={-1}
            aria-label={t('menu.indexNext')}
            title={t('menu.indexNext')}
            onClick={() => scroll(1)}
          >
            ›
          </button>
        </div>
      )}
    </nav>
  );
}
