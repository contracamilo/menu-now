import { useEffect, useState } from 'react';
import { useT } from '../../i18n/useT';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Botón fijo para volver al inicio de la carta (spec menu, design D6). Aparece cuando el
 * comensal ha bajado más de una pantalla —también tras saltar desde el índice— y, al pulsarlo,
 * lleva arriba y pone el foco en el título para que teclado y lector empiecen de nuevo.
 */
export function BackToTop() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!visible) return null;

  function backToTop() {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
  }

  return (
    <button type="button" className="tap-target back-to-top" onClick={backToTop}>
      <span aria-hidden="true">↑</span> {t('menu.backToTop')}
    </button>
  );
}
