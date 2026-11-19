import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { adminCategory, adminDish, installCatalog } from '../../test/fakeCatalog';
import { fakeSupabase } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { AdminLayout } from '../backoffice/AdminLayout';
import { CatalogPage } from './CatalogPage';

const included = (position: number, dishes = [] as ReturnType<typeof adminDish>[]) =>
  adminCategory({ id: 'incluidos', is_included: true, position, dishes });

function renderCatalog() {
  return renderWithProviders(<CatalogPage />, { route: '/admin', zone: 'admin' });
}

const section = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('section')!;
const dishNames = (sectionName: string) =>
  within(section(sectionName))
    .queryAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);
const categoryNames = () =>
  screen
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent)
    .filter((name) => name !== 'Archivados');

describe('CatalogPage', () => {
  it('[catalog-management] «El dueño encuentra la categoría "Incluidos" desde el primer día»', async () => {
    installCatalog([included(1), adminCategory({ id: 'bebidas', name: 'Bebidas', position: 2 })]);
    const user = userEvent.setup();
    renderCatalog();

    const incluidos = await screen.findByRole('heading', { level: 2, name: 'Incluidos' });
    const box = incluidos.closest('section')!;
    expect(within(box).getByText(/Categoría del sistema para lo que va incluido/)).toBeInTheDocument();
    expect(within(box).queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument();
    expect(within(box).queryByRole('button', { name: /Archivar/ })).not.toBeInTheDocument();
    expect(screen.getByText('Aún no hay platos. Crea una categoría y añade tu primer plato.')).toBeInTheDocument();

    await user.click(within(box).getByRole('button', { name: 'Bajar Incluidos' }));
    await waitFor(() => expect(categoryNames()).toEqual(['Bebidas', 'Incluidos']));
    expect(fakeSupabase.rpcCalls).toEqual([{ name: 'move_category', args: { p_id: 'incluidos', p_direction: 1 } }]);
    expect(screen.getByRole('button', { name: 'Subir Incluidos' })).toBeEnabled();
  });

  it('[catalog-management] «El dueño archiva un plato y este se conserva»: pasa a «Archivados» con sus datos', async () => {
    installCatalog([
      adminCategory({
        id: 'raciones',
        name: 'Raciones',
        position: 1,
        dishes: [
          adminDish({ id: 'patatas', name: 'Patatas', category_id: 'raciones', position: 1 }),
          adminDish({
            id: 'croquetas',
            name: 'Croquetas',
            category_id: 'raciones',
            position: 2,
            dish_sizes: [
              { id: 'k1', label: 'Una', price_cents: 150, position: 1 },
              { id: 'k2', label: 'Ración', price_cents: 700, position: 2 },
            ],
          }),
        ],
      }),
    ]);
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole('button', { name: 'Archivar Croquetas' }));
    const archived = await screen.findByRole('heading', { level: 2, name: 'Archivados' });
    await waitFor(() => expect(dishNames('Raciones')).toEqual(['Patatas']));
    const archivedBox = archived.closest('section')!;
    const croquetas = within(archivedBox).getByRole('heading', { level: 3, name: 'Croquetas' }).closest('li')!;
    expect(croquetas).toHaveTextContent('Una · 1,50 € / Ración · 7,00 €');
    expect(croquetas).toHaveTextContent(/Raciones · Archivado el/);
    expect(within(croquetas).getByRole('link', { name: 'Editar Croquetas' })).toHaveAttribute('href', '/admin/dishes/croquetas');

    const update = fakeSupabase.calls.find((c) => c.table === 'dishes' && c.op === 'update');
    expect(update?.payload).toEqual({ archived_at: expect.any(String) });
    expect(update?.filters).toEqual([['eq', 'id', 'croquetas']]);
    expect(fakeSupabase.calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('[catalog-management] «El dueño reactiva un plato archivado»: vuelve a su posición', async () => {
    installCatalog([
      adminCategory({
        id: 'raciones',
        name: 'Raciones',
        position: 1,
        dishes: [
          adminDish({ id: 'patatas', name: 'Patatas', category_id: 'raciones', position: 1 }),
          adminDish({ id: 'croquetas', name: 'Croquetas', category_id: 'raciones', position: 2, archived_at: '2026-11-18T10:00:00Z' }),
          adminDish({ id: 'calamares', name: 'Calamares', category_id: 'raciones', position: 3 }),
        ],
      }),
    ]);
    const user = userEvent.setup();
    renderCatalog();

    await screen.findByRole('heading', { level: 2, name: 'Archivados' });
    expect(dishNames('Raciones')).toEqual(['Patatas', 'Calamares']);
    await user.click(screen.getByRole('button', { name: 'Reactivar Croquetas' }));
    await waitFor(() => expect(dishNames('Raciones')).toEqual(['Patatas', 'Croquetas', 'Calamares']));
    expect(screen.queryByRole('heading', { level: 2, name: 'Archivados' })).not.toBeInTheDocument();
  });

  it('[catalog-management] «El dueño archiva el último plato activo de una categoría»: aviso visible', async () => {
    installCatalog([
      adminCategory({
        id: 'postres',
        name: 'Postres',
        position: 1,
        dishes: [adminDish({ id: 'flan', name: 'Flan', category_id: 'postres', position: 1 })],
      }),
    ]);
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole('button', { name: 'Archivar Flan' }));
    await waitFor(() => expect(dishNames('Postres')).toEqual([]));
    expect(within(section('Postres')).getByText('Sin platos activos: no se muestra en la carta.')).toBeInTheDocument();
  });

  it('[catalog-management] «El dueño prepara un plato sin mostrarlo»: lo crea, lo archiva y lo reactiva', async () => {
    installCatalog([
      adminCategory({
        id: 'postres',
        name: 'Postres',
        position: 1,
        dishes: [
          adminDish({ id: 'flan', name: 'Flan', category_id: 'postres', position: 1 }),
          adminDish({ id: 'torrijas', name: 'Torrijas', category_id: 'postres', position: 2 }),
        ],
      }),
    ]);
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole('button', { name: 'Archivar Torrijas' }));
    await waitFor(() => expect(dishNames('Postres')).toEqual(['Flan']));
    await user.click(screen.getByRole('button', { name: 'Reactivar Torrijas' }));
    await waitFor(() => expect(dishNames('Postres')).toEqual(['Flan', 'Torrijas']));
    const payloads = fakeSupabase.calls.filter((c) => c.table === 'dishes' && c.op === 'update').map((c) => c.payload);
    expect(payloads).toEqual([{ archived_at: expect.any(String) }, { archived_at: null }]);
  });

  it('[catalog-management] «El dueño sube un plato en su categoría»', async () => {
    installCatalog([
      adminCategory({
        id: 'bocadillos',
        name: 'Bocadillos',
        position: 1,
        dishes: [
          adminDish({ id: 'calamares', name: 'Calamares', category_id: 'bocadillos', position: 1 }),
          adminDish({ id: 'lomo', name: 'Lomo', category_id: 'bocadillos', position: 2 }),
          adminDish({ id: 'tortilla', name: 'Tortilla', category_id: 'bocadillos', position: 3 }),
        ],
      }),
    ]);
    const user = userEvent.setup();
    renderCatalog();

    expect(await screen.findByRole('button', { name: 'Subir Calamares' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Tortilla' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Subir Tortilla' }));
    await waitFor(() => expect(dishNames('Bocadillos')).toEqual(['Calamares', 'Tortilla', 'Lomo']));
    expect(fakeSupabase.rpcCalls).toEqual([{ name: 'move_dish', args: { p_id: 'tortilla', p_direction: -1 } }]);
  });

  it('[catalog-management] «El dueño baja una categoría»', async () => {
    installCatalog([
      adminCategory({ id: 'desayunos', name: 'Desayunos', position: 1 }),
      adminCategory({ id: 'bocadillos', name: 'Bocadillos', position: 2 }),
      adminCategory({ id: 'bebidas', name: 'Bebidas', position: 3 }),
      included(4),
    ]);
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole('button', { name: 'Bajar Desayunos' }));
    await waitFor(() => expect(categoryNames()).toEqual(['Bocadillos', 'Desayunos', 'Bebidas', 'Incluidos']));
    expect(fakeSupabase.rpcCalls).toEqual([{ name: 'move_category', args: { p_id: 'desayunos', p_direction: 1 } }]);
  });

  it('archiva y reactiva una categoría; un nombre ya usado al reactivar muestra el error', async () => {
    installCatalog([
      adminCategory({
        id: 'tapas',
        name: 'Tapas',
        position: 1,
        dishes: [adminDish({ id: 'bravas', name: 'Bravas', category_id: 'tapas', position: 1 })],
      }),
    ]);
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole('button', { name: 'Archivar Tapas' }));
    const archived = (await screen.findByRole('heading', { level: 2, name: 'Archivados' })).closest('section')!;
    expect(within(archived).getByText('Categoría archivada: ni ella ni sus platos se muestran en la carta.')).toBeInTheDocument();
    expect(within(archived).getByRole('heading', { level: 3, name: 'Bravas' })).toBeInTheDocument();

    const original = fakeSupabase.tables.categories;
    fakeSupabase.tables.categories = (q) =>
      q.op === 'update' ? { data: null, error: { message: 'duplicate key', code: '23505' } } : original(q);
    await user.click(within(archived).getByRole('button', { name: 'Reactivar Tapas' }));
    expect(await screen.findByText('Ya existe una categoría activa con ese nombre.')).toBeInTheDocument();
  });

  it('[catalog-management] «El dueño usa la administración en inglés»', async () => {
    installCatalog([included(1)]);
    const user = userEvent.setup();
    const routes = (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<CatalogPage />} />
        </Route>
      </Routes>
    );
    const first = renderWithProviders(routes, { route: '/admin', zone: 'admin' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mi carta' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1, name: 'My menu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Included' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    first.unmount();

    // La próxima vez que abre la administración en ese móvil, sigue en inglés
    renderWithProviders(routes, { route: '/admin', zone: 'admin' });
    expect(await screen.findByRole('heading', { level: 1, name: 'My menu' })).toBeInTheDocument();
  });

  it('[catalog-management] «El dueño gestiona el catálogo desde su móvil»: todos los controles usan tap-target', async () => {
    installCatalog([
      adminCategory({
        id: 'raciones',
        name: 'Raciones',
        position: 1,
        dishes: [
          adminDish({ id: 'patatas', name: 'Patatas', category_id: 'raciones', position: 1 }),
          adminDish({ id: 'croquetas', name: 'Croquetas', category_id: 'raciones', position: 2, archived_at: '2026-11-18T10:00:00Z' }),
        ],
      }),
      adminCategory({ id: 'viejas', name: 'Viejas', position: 2, archived_at: '2026-11-01T00:00:00Z' }),
      included(3),
    ]);
    renderWithProviders(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<CatalogPage />} />
        </Route>
      </Routes>,
      { route: '/admin', zone: 'admin' },
    );
    await screen.findByRole('heading', { level: 2, name: 'Archivados' });
    const controls = [...screen.getAllByRole('button'), ...screen.getAllByRole('link')];
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) expect(control).toHaveClass('tap-target');
  });
});
