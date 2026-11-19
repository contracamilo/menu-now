import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { CategoryIndex } from './CategoryIndex';

const categories = ['Desayunos', 'Bocadillos', 'Tapas', 'Raciones', 'Ensaladas', 'Postres', 'Bebidas', 'Cafés'].map(
  (name) => ({ id: name.toLowerCase(), name }),
);

/** jsdom no tiene maquetación: se simulan las medidas del carrusel y su desplazamiento. */
function layout(track: HTMLElement, { clientWidth, scrollWidth }: { clientWidth: number; scrollWidth: number }) {
  let scrollLeft = 0;
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(track, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = Math.max(0, Math.min(value, scrollWidth - clientWidth));
    },
  });
  track.scrollBy = ((options: ScrollToOptions) => {
    track.scrollLeft += options.left ?? 0;
    fireEvent.scroll(track);
  }) as typeof track.scrollBy;
  fireEvent.scroll(track);
  return {
    swipeTo(value: number) {
      track.scrollLeft = value;
      fireEvent.scroll(track);
    },
  };
}

// Las flechas son aria-hidden (ayuda visual): se localizan por su título
const next = () => screen.queryByTitle('Show more categories');
const prev = () => screen.queryByTitle('Show previous categories');

function renderIndex() {
  renderWithProviders(<CategoryIndex categories={categories} />, { zone: 'menu' });
  const nav = screen.getByRole('navigation', { name: 'Categories' });
  return { nav, track: within(nav).getByRole('list') };
}

describe('CategoryIndex', () => {
  it('[menu] «El comensal ve que hay más categorías en el índice»', async () => {
    const user = userEvent.setup();
    const { track } = renderIndex();
    const carousel = layout(track, { clientWidth: 300, scrollWidth: 900 });

    // Al abrir: flecha a la derecha, ninguna a la izquierda
    expect(next()).toBeInTheDocument();
    expect(prev()).not.toBeInTheDocument();

    // Al tocar la flecha, el índice se desplaza y aparece la flecha de la izquierda
    await user.click(next()!);
    expect(track.scrollLeft).toBe(240);
    expect(prev()).toBeInTheDocument();
    expect(next()).toBeInTheDocument();

    // Deslizando hasta la última categoría, desaparece la flecha de la derecha
    carousel.swipeTo(600);
    expect(next()).not.toBeInTheDocument();
    expect(prev()).toBeInTheDocument();

    await user.click(prev()!);
    expect(track.scrollLeft).toBe(360);
  });

  it('[menu] «Todas las categorías caben en el índice»: sin flechas', () => {
    const { track } = renderIndex();
    layout(track, { clientWidth: 900, scrollWidth: 900 });
    expect(next()).not.toBeInTheDocument();
    expect(prev()).not.toBeInTheDocument();
  });

  it('las flechas no estorban al teclado ni al lector de pantalla; los enlaces siguen siendo navegables', () => {
    const { nav, track } = renderIndex();
    layout(track, { clientWidth: 300, scrollWidth: 900 });
    expect(within(nav).queryByRole('button')).not.toBeInTheDocument();
    expect(next()).toHaveAttribute('tabindex', '-1');
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(
      categories.map((c) => `#cat-${c.id}`),
    );
    for (const link of within(nav).getAllByRole('link')) expect(link).toHaveClass('tap-target');
  });
});
