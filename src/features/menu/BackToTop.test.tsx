import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import type { MenuCategory } from '../../lib/types';
import { MenuPage } from './MenuPage';

const dish = (id: string, position: number) => ({
  id,
  name: id,
  description: null,
  included_with: null,
  photo_path: null,
  allergens: [],
  no_allergens: true,
  position,
  dish_sizes: [{ id: `${id}-1`, label: null, price_cents: 200, position: 1 }],
});

const catalog: MenuCategory[] = [
  { id: 'desayunos', name: 'Desayunos', is_included: false, position: 1, dishes: [dish('Tostada', 1)] },
  { id: 'bebidas', name: 'Bebidas', is_included: false, position: 2, dishes: [dish('Caña', 1)] },
];

// jsdom no desplaza la página: se simula window.scrollY y window.scrollTo
let scrollY = 0;
function scrollPageTo(y: number) {
  scrollY = y;
  fireEvent.scroll(window);
}

beforeEach(() => {
  scrollY = 0;
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
  window.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    scrollPageTo(typeof options === 'object' ? (options.top ?? 0) : 0);
  }) as typeof window.scrollTo;
  fakeSupabase.tables.categories = () => ok(catalog);
  fakeSupabase.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const backToTop = () => screen.queryByRole('button', { name: /Back to top/ });

describe('Volver arriba', () => {
  it('[menu] «El comensal abre la carta»: sin botón al principio', async () => {
    renderWithProviders(<MenuPage />, { zone: 'menu' });
    await screen.findByRole('heading', { level: 2, name: 'Bebidas' });
    expect(backToTop()).not.toBeInTheDocument();
  });

  it('[menu] «El comensal baja menos de una pantalla»: sigue sin botón', async () => {
    renderWithProviders(<MenuPage />, { zone: 'menu' });
    await screen.findByRole('heading', { level: 2, name: 'Bebidas' });
    scrollPageTo(300); // un poco, sin llegar a una pantalla (800 px)
    expect(backToTop()).not.toBeInTheDocument();
    scrollPageTo(800); // justo una pantalla: todavía no
    expect(backToTop()).not.toBeInTheDocument();
    scrollPageTo(801); // más de una pantalla
    expect(backToTop()).toBeInTheDocument();
  });

  it('[menu] «El comensal vuelve arriba tras elegir una categoría»', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MenuPage />, { zone: 'menu' });
    await user.click(await screen.findByRole('link', { name: 'Bebidas' }));
    scrollPageTo(2400); // el navegador salta al encabezado de «Bebidas»

    const button = backToTop();
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('tap-target');

    await user.click(button!);
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(screen.getByRole('heading', { level: 1, name: 'Bar Manolo' })).toHaveFocus();
    expect(backToTop()).not.toBeInTheDocument();
  });

  it('respeta «reducir movimiento»', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const user = userEvent.setup();
    renderWithProviders(<MenuPage />, { zone: 'menu' });
    await screen.findByRole('heading', { level: 2, name: 'Bebidas' });
    scrollPageTo(2400);
    await user.click(backToTop()!);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('se traduce con la interfaz', async () => {
    localStorage.setItem('menu-now.lang.menu', 'es');
    renderWithProviders(<MenuPage />, { zone: 'menu' });
    await screen.findByRole('heading', { level: 2, name: 'Bebidas' });
    scrollPageTo(2400);
    expect(screen.getByRole('button', { name: /Volver arriba/ })).toBeInTheDocument();
  });
});
