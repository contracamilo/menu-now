import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { installTables, table } from '../../test/fakeTables';
import type { AdminTable } from './useTables';
import { TableForm } from './TableForm';
import { TablesPage } from './TablesPage';

function setup(tables: AdminTable[], route = '/admin/tables') {
  installTables(tables);
  return renderWithProviders(
    <Routes>
      <Route path="/admin/tables" element={<TablesPage />} />
      <Route path="/admin/tables/new" element={<TableForm />} />
    </Routes>,
    { route, zone: 'admin' },
  );
}

const activeNames = () =>
  within(screen.getByRole('list', { name: 'Mesas' }))
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);
const archivedSection = () => screen.getByRole('region', { name: 'Mesas archivadas' });

describe('TablesPage', () => {
  it('[table-management] «El dueño crea una mesa»: aparece entre las activas', async () => {
    setup([table({ id: 'm1', name: 'Mesa 1' })], '/admin/tables/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Nombre de la mesa/), 'Terraza 2');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(activeNames()).toEqual(['Mesa 1', 'Terraza 2']));
  });

  it('ordena las activas por nombre con números naturales', async () => {
    setup([table({ id: 'a', name: 'Mesa 10' }), table({ id: 'b', name: 'Mesa 2' }), table({ id: 'c', name: 'Barra' })]);
    await screen.findByRole('list', { name: 'Mesas' });
    expect(activeNames()).toEqual(['Barra', 'Mesa 2', 'Mesa 10']);
  });

  it('[table-management] «El dueño archiva una mesa»: pasa a «Mesas archivadas» con su aviso', async () => {
    setup([table({ id: 'm1', name: 'Mesa 1' }), table({ id: 't2', name: 'Terraza 2' })]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Archivar Terraza 2' }));
    await waitFor(() => expect(within(archivedSection()).getByRole('heading', { name: 'Terraza 2' })).toBeInTheDocument());
    expect(within(archivedSection()).getByText('Mesa archivada: su QR abre la carta, pero no permite pedir.')).toBeInTheDocument();
    expect(activeNames()).toEqual(['Mesa 1']);
  });

  it('[table-management] «El dueño reactiva una mesa archivada»: vuelve a las activas', async () => {
    setup([table({ id: 't2', name: 'Terraza 2', archived_at: '2026-11-19T10:00:00Z' })]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reactivar Terraza 2' }));
    await waitFor(() => expect(activeNames()).toEqual(['Terraza 2']));
    expect(screen.queryByRole('region', { name: 'Mesas archivadas' })).not.toBeInTheDocument();
  });

  it('[table-management] «El dueño no puede reactivar una mesa con el nombre de otra activa»', async () => {
    setup([table({ id: 'nueva', name: 'Mesa 4' }), table({ id: 'vieja', name: 'Mesa 4', archived_at: '2026-11-19T10:00:00Z' })]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reactivar Mesa 4' }));
    expect(await screen.findByText('Ya existe una mesa activa con ese nombre.')).toBeInTheDocument();
    expect(within(archivedSection()).getByRole('heading', { name: 'Mesa 4' })).toBeInTheDocument();
  });

  it('[table-management] «El dueño abre "Mesas" por primera vez»: invita a crear mesas', async () => {
    setup([]);
    expect(
      await screen.findByText('Aún no hay mesas. Crea tus mesas para que los comensales puedan pedir desde ellas.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nueva mesa' })).toHaveAttribute('href', '/admin/tables/new');
  });

  it('cada mesa activa enlaza a su QR', async () => {
    setup([table({ id: 'm4', name: 'Mesa 4' })]);
    expect(await screen.findByRole('link', { name: 'Ver QR de Mesa 4' })).toHaveAttribute('href', '/admin/tables/m4/qr');
  });
});
