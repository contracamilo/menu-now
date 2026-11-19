import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Dish, MenuCategory } from '../../lib/types';
import { storageKey } from '../../i18n/I18nProvider';
import { fail, fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { MenuPage } from './MenuPage';

// Intl usa espacios duros en «2,50 €»; Testing Library los normaliza a espacios normales
const plain = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ');

function dish(partial: Partial<Dish> & Pick<Dish, 'id' | 'name' | 'position'>): Dish {
  return {
    description: null,
    included_with: null,
    photo_path: null,
    allergens: [],
    no_allergens: true,
    dish_sizes: [{ id: `${partial.id}-s1`, label: null, price_cents: 100, position: 1 }],
    ...partial,
  };
}

const catalog: MenuCategory[] = [
  {
    id: 'desayunos',
    name: 'Desayunos',
    is_included: false,
    position: 1,
    dishes: [
      dish({
        id: 'tostada',
        name: 'Tostada con tomate',
        position: 1,
        description: 'Pan de pueblo, tomate rallado y AOVE',
        photo_path: 'dishes/tostada/foto.jpg',
        allergens: ['gluten'],
        no_allergens: false,
        dish_sizes: [{ id: 't1', label: null, price_cents: 250, position: 1 }],
      }),
      dish({
        id: 'cafe',
        name: 'Café con leche',
        position: 2,
        description: 'Con leche entera',
        allergens: ['milk'],
        no_allergens: false,
        dish_sizes: [{ id: 'c1', label: null, price_cents: 160, position: 1 }],
      }),
      dish({ id: 'pincho', name: 'Pincho de tortilla', position: 3, description: 'Con cebolla', allergens: ['eggs'], no_allergens: false }),
    ],
  },
  {
    id: 'bocadillos',
    name: 'Bocadillos',
    is_included: false,
    position: 2,
    dishes: [
      dish({
        id: 'calamares',
        name: 'Calamares',
        position: 1,
        allergens: ['molluscs', 'gluten', 'eggs'],
        no_allergens: false,
      }),
      dish({
        id: 'croquetas',
        name: 'Croquetas',
        position: 2,
        dish_sizes: [
          { id: 'k3', label: 'Plato', price_cents: 1200, position: 3 },
          { id: 'k1', label: 'Una', price_cents: 150, position: 1 },
          { id: 'k2', label: 'Ración', price_cents: 700, position: 2 },
        ],
      }),
    ],
  },
  {
    id: 'bebidas',
    name: 'Bebidas',
    is_included: false,
    position: 3,
    dishes: [
      dish({ id: 'cana', name: 'Caña', position: 1, allergens: ['gluten'], no_allergens: false, dish_sizes: [{ id: 'n1', label: null, price_cents: 180, position: 1 }] }),
      dish({ id: 'agua', name: 'Agua mineral', position: 2, no_allergens: true }),
    ],
  },
  {
    id: 'incluidos',
    name: null,
    is_included: true,
    position: 4,
    dishes: [dish({ id: 'tapa', name: 'Tapa del día', position: 1, included_with: 'Con cada bebida', dish_sizes: [] })],
  },
  { id: 'postres', name: 'Postres', is_included: false, position: 5, dishes: [] },
];

function serve(categories: MenuCategory[] = catalog) {
  fakeSupabase.tables.categories = () => ok(categories);
  fakeSupabase.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);
}

function renderMenu(lang?: 'es' | 'en') {
  if (lang) localStorage.setItem(storageKey('menu'), lang);
  return renderWithProviders(<MenuPage />, { zone: 'menu' });
}

const article = (name: string) => screen.getByRole('article', { name });

describe('MenuPage', () => {
  it('[menu] «El comensal abre la carta desde el QR»: sin sesión, sin formularios ni petición de datos', async () => {
    serve();
    const { container } = renderMenu();
    expect(await screen.findByRole('heading', { level: 2, name: 'Desayunos' })).toBeInTheDocument();
    expect(fakeSupabase.session).toBeNull();
    expect(container.querySelector('form, input, textarea, select')).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // La consulta filtra lo archivado (también para un dueño con sesión abierta)
    const query = fakeSupabase.calls.find((c) => c.table === 'categories');
    expect(query?.filters).toEqual(
      expect.arrayContaining([
        ['param', 'archived_at', 'is.null'],
        ['param', 'dishes.archived_at', 'is.null'],
      ]),
    );
  });

  it('[menu] «El comensal salta a una categoría desde el índice»', async () => {
    serve();
    renderMenu();
    const nav = await screen.findByRole('navigation', { name: 'Categories' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Desayunos', 'Bocadillos', 'Bebidas', 'Included']);
    for (const link of links) {
      const target = document.getElementById(link.getAttribute('href')!.slice(1));
      expect(target?.tagName).toBe('H2');
      expect(target).toHaveTextContent(link.textContent!);
    }
  });

  it('[menu] «El comensal ve un plato con foto»', async () => {
    serve();
    renderMenu('es');
    const card = await screen.findByRole('article', { name: 'Tostada con tomate' });
    expect(within(card).getByText('2,50 €')).toBeInTheDocument();
    expect(within(card).getByText('Pan de pueblo, tomate rallado y AOVE')).toBeInTheDocument();
    const photo = card.querySelector('img');
    expect(photo).toHaveAttribute('src', expect.stringContaining('dishes/tostada/foto.jpg'));
    expect(photo).toHaveAttribute('width', '960');
    expect(photo).toHaveAttribute('height', '720');
    expect(within(card).getByText('Gluten')).toBeInTheDocument();
  });

  it('[menu] «El comensal ve un plato sin foto»', async () => {
    serve();
    renderMenu('es');
    const card = await screen.findByRole('article', { name: 'Café con leche' });
    expect(within(card).getByText('1,60 €')).toBeInTheDocument();
    expect(within(card).getByText('Con leche entera')).toBeInTheDocument();
    expect(within(card).getByText('Leche')).toBeInTheDocument();
    expect(card.querySelector('img')).toBeNull();
  });

  it('[menu] «El comensal ve un plato sin descripción»', async () => {
    serve();
    renderMenu('es');
    const card = await screen.findByRole('article', { name: 'Caña' });
    expect(card.querySelector('.dish__description')).toBeNull();
    expect(card).toHaveTextContent(`Caña${'1,80 €'}AlérgenosGluten`);
  });

  it('[menu] «El contenido del dueño no se traduce»', async () => {
    serve();
    const user = userEvent.setup();
    renderMenu();
    expect(await screen.findByRole('article', { name: 'Pincho de tortilla' })).toHaveTextContent('Con cebolla');
    await user.click(screen.getByRole('button', { name: 'Español' }));
    expect(article('Pincho de tortilla')).toHaveTextContent('Con cebolla');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(article('Pincho de tortilla')).toHaveTextContent('Con cebolla');
  });

  it('[menu] «El comensal ve un plato con varios tamaños»', async () => {
    serve();
    renderMenu('es');
    const card = await screen.findByRole('article', { name: 'Croquetas' });
    const items = within(within(card).getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => plain(li.textContent))).toEqual([
      'Una · 1,50 €',
      'Ración · 7,00 €',
      'Plato · 12,00 €',
    ]);
  });

  it('[menu] «El comensal ve un plato con un solo precio»', async () => {
    serve();
    renderMenu('es');
    const card = await screen.findByRole('article', { name: 'Caña' });
    const prices = within(card).getAllByRole('list')[0];
    expect(within(prices).getAllByRole('listitem').map((li) => plain(li.textContent))).toEqual(['1,80 €']);
  });

  it('[menu] «El comensal ve un plato incluido»', async () => {
    serve();
    renderMenu();
    const section = (await screen.findByRole('heading', { level: 2, name: 'Included' })).closest('section')!;
    const card = within(section).getByRole('article', { name: 'Tapa del día' });
    expect(card).toHaveTextContent('Con cada bebida');
    expect(card.textContent).not.toMatch(/€|\d/);
  });

  it('[menu] «El comensal ve los alérgenos de un plato sin tocar nada»', async () => {
    serve();
    renderMenu('es');
    const card = await screen.findByRole('article', { name: 'Calamares' });
    const list = within(card).getByRole('list', { name: 'Alérgenos' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Gluten', 'Huevos', 'Moluscos']);
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('[menu] «El comensal ve un plato declarado sin alérgenos»', async () => {
    serve();
    renderMenu('es');
    const card = await screen.findByRole('article', { name: 'Agua mineral' });
    expect(card).toHaveTextContent('No contiene alérgenos de declaración obligatoria');
  });

  it('[menu] «El comensal ve el aviso de alergias» (presente y sin botón de cerrar)', async () => {
    serve();
    renderMenu();
    const notice = await screen.findByRole('note');
    expect(notice).toHaveTextContent('If you have any allergy or intolerance, please ask the staff.');
    expect(within(notice).queryByRole('button')).not.toBeInTheDocument();
    // Va antes que el índice y que las categorías
    const nav = screen.getByRole('navigation');
    expect(notice.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Las únicas acciones de la página son el selector de idioma
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['English', 'Español']);
  });

  it('[menu] «El comensal cambia la interfaz a español» (por defecto inglés; persistencia)', async () => {
    serve();
    const user = userEvent.setup();
    const first = renderMenu();
    expect(await screen.findByRole('note')).toHaveTextContent('please ask the staff');
    expect(screen.getByRole('heading', { level: 2, name: 'Included' })).toBeInTheDocument();
    expect(within(article('Calamares')).getByText('Molluscs')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Español' }));
    expect(screen.getByRole('note')).toHaveTextContent('Si tienes alguna alergia o intolerancia, consulta al personal.');
    expect(screen.getByRole('heading', { level: 2, name: 'Incluidos' })).toBeInTheDocument();
    expect(within(article('Calamares')).getByText('Moluscos')).toBeInTheDocument();
    expect(screen.getByText('Precios con IVA incluido')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Categorías' })).toBeInTheDocument();
    first.unmount();

    // Vuelve a abrir la carta en el mismo móvil
    renderMenu();
    expect(await screen.findByRole('note')).toHaveTextContent('consulta al personal');
  });

  it('[menu] «El comensal usa la carta con lector de pantalla»', async () => {
    serve();
    renderMenu();
    expect(await screen.findByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Desayunos',
      'Bocadillos',
      'Bebidas',
      'Included',
    ]);
    const articles = screen.getAllByRole('article');
    expect(articles.map((a) => a.getAttribute('aria-labelledby') && document.getElementById(a.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Tostada con tomate',
      'Café con leche',
      'Pincho de tortilla',
      'Calamares',
      'Croquetas',
      'Caña',
      'Agua mineral',
      'Tapa del día',
    ]);
    // Cada plato se lee como: nombre → precios → descripción → alérgenos
    const card = article('Tostada con tomate');
    expect(card).toHaveTextContent(/^Tostada con tomate€2\.50Pan de pueblo, tomate rallado y AOVEAllergensGluten$/);
  });

  it('no muestra las categorías sin platos ni en la carta ni en el índice', async () => {
    serve();
    renderMenu('es');
    await screen.findByRole('navigation');
    expect(screen.queryByText('Postres')).not.toBeInTheDocument();
  });

  it('solo las dos primeras fotos se cargan sin diferir', async () => {
    serve([
      {
        ...catalog[0],
        dishes: ['a', 'b', 'c'].map((id, i) => dish({ id, name: id, position: i + 1, photo_path: `dishes/${id}.jpg` })),
      },
    ]);
    const { container } = renderMenu();
    await screen.findByRole('article', { name: 'a' });
    expect([...container.querySelectorAll('.dish img')].map((img) => img.getAttribute('loading'))).toEqual([
      'eager',
      'eager',
      'lazy',
    ]);
  });

  describe('estados de carga, vacío y error', () => {
    it('muestra un indicador pequeño mientras carga', async () => {
      fakeSupabase.tables.categories = () => new Promise(() => {});
      renderMenu();
      expect(await screen.findByRole('status')).toHaveTextContent('Loading the menu…');
    });

    it('[menu] «Primer arranque sin platos»', async () => {
      serve([{ id: 'incluidos', name: null, is_included: true, position: 1, dishes: [] }]);
      renderMenu();
      expect(await screen.findByText("The menu isn't available yet. Please ask the staff.")).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });

    it('[menu] «El comensal abre la carta sin conexión»', async () => {
      fakeSupabase.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);
      fakeSupabase.tables.categories = () => fail('Failed to fetch');
      const user = userEvent.setup();
      renderMenu();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("We couldn't load the menu.");
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

      // Recupera la conexión y pulsa reintentar
      fakeSupabase.tables.categories = () => ok(catalog);
      await user.click(within(alert).getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('heading', { level: 2, name: 'Desayunos' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
