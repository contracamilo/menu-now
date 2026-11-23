import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { storageKey } from '../../i18n/I18nProvider';
import type { PlacedOrder } from '../../lib/types';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { serveTableMenu, TOKEN } from '../../test/fakeMenu';
import { renderWithProviders, testQueryClient } from '../../test/render';
import { TableApp } from './TableApp';

const plain = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ');

const order = (n: number): PlacedOrder => ({
  id: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
  number: n,
  status: 'received',
  table_name: 'Mesa 4',
  total_cents: 180 * n,
  created_at: '2026-11-19T12:30:00Z',
  items: [{ dish_name: 'Caña', size_label: null, unit_price_cents: 180, quantity: n, note: null }],
});

/** Servidor falso: solo devuelve los pedidos de hoy cuyo id se le pasa (como get_orders). */
function serveOrders(today: PlacedOrder[]) {
  fakeSupabase.rpcs.get_orders = (args) => ok(today.filter((o) => (args.p_order_ids as string[]).includes(o.id)));
}

function renderMine(storedIds: string[], queryClient = testQueryClient()) {
  localStorage.setItem(storageKey('menu'), 'es');
  localStorage.setItem(`menu-now.orders.${TOKEN}`, JSON.stringify(storedIds));
  serveTableMenu();
  return renderWithProviders(
    <Routes>
      <Route path="/t/:token/*" element={<TableApp />} />
    </Routes>,
    { route: `/t/${TOKEN}/orders`, zone: 'menu', queryClient },
  );
}

describe('MyOrdersPage', () => {
  it('[table-ordering] «El comensal consulta sus pedidos»: hora, total y estado en la lista; líneas al abrir uno', async () => {
    serveOrders([order(8), order(3)]);
    renderMine([order(8).id, order(3).id]);
    const links = await screen.findAllByRole('link', { name: /Pedido nº/ });
    expect(links.map((l) => l.querySelector('.order-card__number')!.textContent)).toEqual(['Pedido nº 8', 'Pedido nº 3']);
    expect(links[1]).toHaveTextContent(/Hecho a las \d{2}:\d{2}/);
    expect(plain(links[1].textContent)).toContain('5,40 €');
    expect(links[1]).toHaveTextContent('Estado: Recibido');
    expect(links[1]).toHaveAttribute('href', `/t/${TOKEN}/orders/${order(3).id}`);

    await userEvent.setup().click(links[1]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedido nº 3' })).toBeInTheDocument();
    expect(plain(screen.getByText(/3 × Caña/).textContent)).toBe('3 × Caña');
    expect(plain(document.querySelector('.order-total strong')!.textContent)).toBe('5,40 €');
    expect(screen.getByText('Estado: Recibido')).toBeInTheDocument();
  });

  it('[table-ordering] «El comensal no ve los pedidos de otro móvil»: solo pide los id de este móvil', async () => {
    serveOrders([order(3), order(5)]);
    renderMine([order(3).id]);
    await screen.findByText('Pedido nº 3');
    expect(screen.queryByText('Pedido nº 5')).not.toBeInTheDocument();
    expect(fakeSupabase.rpcCalls.find((c) => c.name === 'get_orders')?.args.p_order_ids).toEqual([order(3).id]);
  });

  it('olvida los pedidos que el servidor ya no devuelve (días anteriores)', async () => {
    serveOrders([order(3)]);
    renderMine([order(3).id, 'aaaaaaaa-0000-4000-8000-00000000ayer']);
    await screen.findByText('Pedido nº 3');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(`menu-now.orders.${TOKEN}`)!)).toEqual([order(3).id]));
  });

  it('sin pedidos en este móvil', async () => {
    serveOrders([]);
    renderMine([]);
    expect(await screen.findByText('Todavía no has hecho ningún pedido desde este móvil.')).toBeInTheDocument();
    expect(fakeSupabase.rpcCalls.some((c) => c.name === 'get_orders')).toBe(false);
  });

  it('[table-ordering] «El comensal comprueba si su pedido está en marcha»: al volver a «Mis pedidos» ve «En preparación»', async () => {
    let today = [order(3)];
    fakeSupabase.rpcs.get_orders = () => ok(today);
    const queryClient = testQueryClient();
    const first = renderMine([order(3).id], queryClient);
    expect(await screen.findByRole('link', { name: /Pedido nº 3/ })).toHaveTextContent('Estado: Recibido');
    first.unmount();

    // El personal pasa el pedido 3 a «En preparación»; el comensal vuelve a la pantalla
    today = [{ ...order(3), status: 'in_preparation' }];
    renderMine([order(3).id], queryClient);
    await waitFor(() => expect(screen.getByRole('link', { name: /Pedido nº 3/ })).toHaveTextContent('Estado: En preparación'));
    expect(fakeSupabase.rpcCalls.filter((c) => c.name === 'get_orders')).toHaveLength(2);
  });
});
