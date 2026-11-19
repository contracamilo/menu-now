import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { adminCategory, installCatalog } from '../../test/fakeCatalog';
import { fakeSupabase } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { CatalogPage } from './CatalogPage';
import { CategoryForm } from './CategoryForm';

function setup(route = '/admin/categories/new') {
  installCatalog([
    adminCategory({ id: 'desayunos', name: 'Desayunos', position: 1 }),
    adminCategory({ id: 'bebidas', name: 'Bebidas', position: 2 }),
    adminCategory({ id: 'viejas', name: 'Raciones', position: 3, archived_at: '2026-11-01T00:00:00Z' }),
    adminCategory({ id: 'incluidos', is_included: true, position: 4 }),
  ]);
  return renderWithProviders(
    <Routes>
      <Route path="/admin" element={<CatalogPage />} />
      <Route path="/admin/categories/new" element={<CategoryForm />} />
      <Route path="/admin/categories/:id" element={<CategoryForm />} />
    </Routes>,
    { route, zone: 'admin' },
  );
}

async function saveName(name: string) {
  const user = userEvent.setup();
  const input = await screen.findByLabelText('Nombre');
  await user.clear(input);
  if (name) await user.type(input, name);
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
}

const writes = () => fakeSupabase.calls.filter((c) => c.table === 'categories' && c.op !== 'select');

describe('CategoryForm', () => {
  it('[catalog-management] «El dueño crea una categoría»: queda detrás de las existentes', async () => {
    setup();
    await saveName('Postres');
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Desayunos',
        'Bebidas',
        'Incluidos',
        'Postres',
        'Archivados',
      ]),
    );
    expect(writes().map((c) => [c.op, c.payload])).toEqual([['insert', { name: 'Postres' }]]);
  });

  it('[catalog-management] «El dueño intenta guardar una categoría sin nombre»', async () => {
    setup();
    await saveName('   ');
    expect(screen.getByRole('alert')).toHaveTextContent('Este campo es obligatorio.');
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(writes()).toHaveLength(0);
  });

  it('[catalog-management] «El dueño intenta repetir el nombre de una categoría activa»', async () => {
    setup();
    await saveName('bebidas');
    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una categoría activa con ese nombre.');
    expect(writes()).toHaveLength(0);
  });

  it('el mismo error si la base de datos rechaza el nombre repetido', async () => {
    setup();
    const original = fakeSupabase.tables.categories;
    fakeSupabase.tables.categories = (q) =>
      q.op === 'insert' ? { data: null, error: { message: 'duplicate', code: '23505' } } : original(q);
    await saveName('Tapas');
    expect(await screen.findByText('Ya existe una categoría activa con ese nombre.')).toBeInTheDocument();
  });

  it('permite repetir el nombre de una categoría archivada', async () => {
    setup();
    await saveName('raciones');
    await waitFor(() => expect(writes()).toHaveLength(1));
  });

  it.each(['Incluidos', ' INCLUDED '])('rechaza el nombre reservado «%s»', async (name) => {
    setup();
    await saveName(name);
    expect(screen.getByRole('alert')).toHaveTextContent('Ese nombre está reservado para la categoría «Incluidos».');
    expect(writes()).toHaveLength(0);
  });

  it('muestra el contador y limita a 40 caracteres', async () => {
    setup();
    const input = await screen.findByLabelText('Nombre');
    expect(input).toHaveAttribute('maxLength', '40');
    await userEvent.setup().type(input, 'Tapas');
    expect(screen.getByText('5/40')).toBeInTheDocument();
  });

  it('renombra una categoría existente', async () => {
    setup('/admin/categories/bebidas');
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Bebidas'));
    await saveName('Bebidas y refrescos');
    await waitFor(() => expect(writes().map((c) => c.payload)).toEqual([{ name: 'Bebidas y refrescos' }]));
    expect(writes()[0].filters).toEqual([['eq', 'id', 'bebidas']]);
  });

  it('«Incluidos» no se puede renombrar desde el formulario', async () => {
    setup('/admin/categories/incluidos');
    expect(await screen.findByRole('heading', { name: 'Esta página no existe.' })).toBeInTheDocument();
  });
});
