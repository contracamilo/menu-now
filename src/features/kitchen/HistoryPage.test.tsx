import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kitchenOrder, serveKitchenOrders, signedInAs, todayAt } from '../../test/fakeKitchen';
import { fakeSupabase } from '../../test/fakeSupabase';
import { renderAdminApp } from '../../test/renderAdmin';

describe('HistoryPage', () => {
  it('[kitchen-panel] «El personal consulta lo servido hoy»: primero el cancelado a las 12:55, después el servido a las 12:40', async () => {
    signedInAs(fakeSupabase, 'staff');
    serveKitchenOrders(fakeSupabase, [
      kitchenOrder({
        number: 2,
        table_name: 'Mesa 2',
        status: 'served',
        created_at: todayAt(12, 10),
        preparing_at: todayAt(12, 15),
        served_at: todayAt(12, 40),
        items: [{ position: 1, dish_name: 'Croquetas', size_label: 'Ración', quantity: 2, note: 'Bien calientes' }],
      }),
      kitchenOrder({ number: 3, table_name: 'Terraza 1', status: 'cancelled', created_at: todayAt(12, 20), cancelled_at: todayAt(12, 55) }),
      kitchenOrder({ number: 4, status: 'received', created_at: todayAt(13, 5) }),
    ]);
    renderAdminApp('/admin/kitchen/history');

    await screen.findByRole('heading', { name: 'Nº 3' });
    expect(screen.getAllByRole('heading', { name: /^Nº/ }).map((h) => h.textContent)).toEqual(['Nº 3', 'Nº 2']);
    const three = within(screen.getByRole('heading', { name: 'Nº 3' }).closest('article') as HTMLElement);
    expect(three.getByText('Cancelado')).toBeInTheDocument();
    expect(three.getByText('Cancelado a las 12:55')).toBeInTheDocument();
    expect(three.getByText('Terraza 1')).toBeInTheDocument();
    const two = within(screen.getByRole('heading', { name: 'Nº 2' }).closest('article') as HTMLElement);
    expect(two.getByText('Servido')).toBeInTheDocument();
    expect(two.getByText('Servido a las 12:40')).toBeInTheDocument();
    expect(two.getByText('2 × Croquetas · Ración')).toBeInTheDocument();
    expect(two.getByText('Bien calientes')).toBeInTheDocument();
    // Sin acciones y con el recuento en la pestaña
    expect(screen.queryAllByRole('button').filter((b) => b.closest('article'))).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Histórico de hoy (2)' })).toHaveAttribute('aria-current', 'page');
  });

  it('histórico vacío', async () => {
    signedInAs(fakeSupabase, 'staff');
    serveKitchenOrders(fakeSupabase, [kitchenOrder({ number: 4 })]);
    renderAdminApp('/admin/kitchen/history');
    expect(await screen.findByText('Hoy todavía no se ha servido ni cancelado ningún pedido.')).toBeInTheDocument();
  });
});
