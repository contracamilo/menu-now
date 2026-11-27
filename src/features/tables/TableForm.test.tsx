import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fakeSupabase } from '../../test/fakeSupabase';
import { installTables, table } from '../../test/fakeTables';
import { renderWithProviders } from '../../test/render';
import { TableForm } from './TableForm';
import { TablesPage } from './TablesPage';

function setup(route = '/admin/tables/new') {
  const state = installTables([
    table({ id: 'm4', name: 'Mesa 4' }),
    table({ id: 'vieja', name: 'Barra', archived_at: '2026-11-01T00:00:00Z' }),
  ]);
  renderWithProviders(
    <Routes>
      <Route path="/admin/tables" element={<TablesPage />} />
      <Route path="/admin/tables/new" element={<TableForm />} />
      <Route path="/admin/tables/:id" element={<TableForm />} />
    </Routes>,
    { route, zone: 'admin' },
  );
  return state;
}

async function saveName(name: string) {
  const user = userEvent.setup();
  const input = await screen.findByLabelText(/Nombre de la mesa/);
  await user.clear(input);
  if (name) await user.type(input, name);
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
}

const writes = () => fakeSupabase.calls.filter((c) => c.table === 'tables' && c.op !== 'select');

describe('TableForm', () => {
  it('[table-management] «El dueño intenta guardar una mesa sin nombre»', async () => {
    setup();
    await saveName('   ');
    expect(screen.getByRole('alert')).toHaveTextContent('Este campo es obligatorio.');
    expect(writes()).toHaveLength(0);
  });

  it('[table-management] «El dueño intenta repetir el nombre de una mesa activa»: conserva lo escrito', async () => {
    setup();
    await saveName('mesa 4');
    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una mesa activa con ese nombre.');
    expect(screen.getByLabelText(/Nombre de la mesa/)).toHaveValue('mesa 4');
    expect(writes()).toHaveLength(0);
  });

  it('el mismo error si la base de datos rechaza el nombre (23505)', async () => {
    setup();
    fakeSupabase.tables.tables = (q) =>
      q.op === 'insert' ? { data: null, error: { message: 'duplicate', code: '23505' } } : { data: [], error: null };
    await saveName('Terraza 1');
    expect(await screen.findByText('Ya existe una mesa activa con ese nombre.')).toBeInTheDocument();
  });

  it('permite el nombre de una mesa archivada y limita a 20 caracteres', async () => {
    setup();
    expect(await screen.findByLabelText(/Nombre de la mesa/)).toHaveAttribute('maxLength', '20');
    await saveName('barra');
    await waitFor(() => expect(writes().map((c) => c.payload)).toEqual([{ name: 'barra' }]));
  });

  it('[table-management] «El dueño escribe un nombre de mesa largo»: no admite más de 20 caracteres', async () => {
    setup();
    const user = userEvent.setup();
    const input = await screen.findByLabelText(/Nombre de la mesa/);
    await user.type(input, 'm'.repeat(25));
    expect(input).toHaveValue('m'.repeat(20));
    expect(screen.getByText('20/20')).toBeInTheDocument();
  });

  it('renombra una mesa sin tocar su token', async () => {
    const state = setup('/admin/tables/m4');
    await waitFor(() => expect(screen.getByLabelText(/Nombre de la mesa/)).toHaveValue('Mesa 4'));
    await saveName('Ventana 1');
    await waitFor(() => expect(writes().map((c) => c.payload)).toEqual([{ name: 'Ventana 1' }]));
    expect(state.find((t) => t.id === 'm4')).toMatchObject({ name: 'Ventana 1', token: 'token-m4' });
  });
});
