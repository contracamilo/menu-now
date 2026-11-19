import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kitchenOrder, serveKitchenOrders, signedInAs } from '../../test/fakeKitchen';
import { fail, fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderAdminApp } from '../../test/renderAdmin';
import type { KitchenOrder, KitchenStatus } from './types';

afterEach(() => {
  vi.useRealTimers();
});

/** Servidor en memoria: get_kitchen_orders, advance_order y cancel_order sobre la misma lista. */
function kitchenServer(initial: KitchenOrder[]) {
  let orders = initial;
  serveKitchenOrders(fakeSupabase, () => orders);
  const set = (id: string, patch: Partial<KitchenOrder>) => {
    orders = orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
    return orders.find((o) => o.id === id)!;
  };
  fakeSupabase.rpcs.advance_order = ({ p_order_id, p_from }) => {
    const order = orders.find((o) => o.id === p_order_id)!;
    if (order.status !== p_from) return ok({ status: 'conflict', current_status: order.status });
    const next: KitchenStatus = p_from === 'received' ? 'in_preparation' : 'served';
    const now = new Date().toISOString();
    return ok({ status: 'ok', order: set(order.id, next === 'served' ? { status: next, served_at: now } : { status: next, preparing_at: now }) });
  };
  fakeSupabase.rpcs.cancel_order = ({ p_order_id }) => {
    const order = orders.find((o) => o.id === p_order_id)!;
    if (order.status !== 'received') return ok({ status: 'conflict', current_status: order.status });
    return ok({ status: 'ok', order: set(order.id, { status: 'cancelled', cancelled_at: new Date().toISOString() }) });
  };
  return {
    /** Cambio hecho desde otra tablet, sin que esta reciba el evento. */
    elsewhere: set,
  };
}

const card = (number: number) => screen.getByRole('heading', { name: `Nº ${number}` }).closest('article') as HTMLElement;
const activeNumbers = () =>
  screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent).filter((text) => text?.startsWith('Nº'));

async function openPanel(orders: KitchenOrder[]) {
  signedInAs(fakeSupabase, 'staff');
  const server = kitchenServer(orders);
  renderAdminApp('/admin/kitchen');
  if (orders.some((o) => o.status === 'received' || o.status === 'in_preparation')) {
    await screen.findAllByRole('heading', { name: /^Nº/ });
  }
  return server;
}

describe('KitchenPage', () => {
  it('[kitchen-panel] «El personal ve los pedidos pendientes»: del más antiguo al más reciente, con mesa, estado, líneas y notas', async () => {
    await openPanel([
      kitchenOrder({ id: 'o5', number: 5, table_name: 'Terraza 1', created_at: '2026-11-19T13:09:00Z' }),
      kitchenOrder({
        id: 'o4',
        number: 4,
        table_name: 'Mesa 2',
        created_at: '2026-11-19T13:05:00Z',
        items: [
          { position: 1, dish_name: 'Croquetas', size_label: 'Ración', quantity: 2, note: 'Bien calientes' },
          { position: 2, dish_name: 'Caña', size_label: null, quantity: 1, note: null },
        ],
      }),
    ]);

    expect(activeNumbers()).toEqual(['Nº 4', 'Nº 5']);
    const four = within(card(4));
    expect(four.getByText('Mesa 2')).toBeInTheDocument();
    expect(four.getByText('Recibido')).toBeInTheDocument();
    expect(four.getByText('2 × Croquetas · Ración')).toBeInTheDocument();
    expect(four.getByText('Bien calientes')).toBeInTheDocument();
    expect(four.getByText('1 × Caña')).toBeInTheDocument();
  });

  it('[kitchen-panel] «Los pedidos servidos o cancelados no están en la vista activa»', async () => {
    await openPanel([
      kitchenOrder({ number: 2, status: 'served', preparing_at: '2026-11-19T12:15:00Z', served_at: '2026-11-19T12:40:00Z' }),
      kitchenOrder({ number: 3, status: 'cancelled', cancelled_at: '2026-11-19T12:55:00Z' }),
      kitchenOrder({ number: 4, status: 'in_preparation', preparing_at: '2026-11-19T13:06:00Z' }),
    ]);
    expect(activeNumbers()).toEqual(['Nº 4']);
    expect(screen.getByRole('link', { name: 'Pendientes (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Histórico de hoy (2)' })).toBeInTheDocument();
  });

  it('[kitchen-panel] «El tiempo transcurrido avanza solo»: de 7 a 10 min sin recargar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-19T13:12:00Z'));
    await openPanel([kitchenOrder({ number: 4, created_at: '2026-11-19T13:05:00Z' })]);
    expect(within(card(4)).getByText('Hace 7 min')).toBeInTheDocument();

    await act(async () => void (await vi.advanceTimersByTimeAsync(3 * 60_000)));
    expect(within(card(4)).getByText('Hace 10 min')).toBeInTheDocument();
  });

  it('el tiempo transcurrido usa la hora del servidor aunque el reloj de la tablet vaya adelantado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-19T13:12:00Z'));
    signedInAs(fakeSupabase, 'staff');
    fakeSupabase.rpcs.get_kitchen_orders = () =>
      ok({ server_now: '2026-11-19T13:02:00Z', orders: [kitchenOrder({ number: 4, created_at: '2026-11-19T13:00:00Z' })] });
    renderAdminApp('/admin/kitchen');
    expect(await screen.findByText('Hace 2 min')).toBeInTheDocument();
  });

  it('[kitchen-panel] «Primera hora del servicio»: mensaje de panel vacío', async () => {
    await openPanel([]);
    expect(await screen.findByText('No hay pedidos pendientes. Los nuevos aparecerán aquí solos.')).toBeInTheDocument();
  });

  it('[kitchen-panel] «La cocina empieza a preparar un pedido»: pasa a «En preparación» y solo ofrece «Servido»', async () => {
    await openPanel([kitchenOrder({ id: 'o4', number: 4 })]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Empezar el pedido nº 4' }));

    expect(await within(card(4)).findByText('En preparación')).toBeInTheDocument();
    expect(fakeSupabase.rpcCalls.find((c) => c.name === 'advance_order')?.args).toEqual({ p_order_id: 'o4', p_from: 'received' });
    expect(within(card(4)).getByRole('button', { name: 'Marcar como servido el pedido nº 4' })).toBeInTheDocument();
    expect(within(card(4)).queryByRole('button', { name: /Empezar|Cancelar/ })).not.toBeInTheDocument();
    // Accesibilidad del panel: el cambio de estado se anuncia
    expect(screen.getByText('Pedido nº 4: En preparación.')).toHaveAttribute('role', 'status');
  });

  it('[kitchen-panel] «El pedido sale a la mesa»: sale de la vista activa y pasa al histórico', async () => {
    await openPanel([kitchenOrder({ id: 'o4', number: 4, status: 'in_preparation', preparing_at: '2026-11-19T13:06:00Z' })]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Marcar como servido el pedido nº 4' }));

    expect(await screen.findByText('No hay pedidos pendientes. Los nuevos aparecerán aquí solos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Histórico de hoy (1)' })).toBeInTheDocument();
  });

  it('[kitchen-panel] «El panel no permite saltar estados»: un pedido «Recibido» no ofrece «Servido»', async () => {
    await openPanel([kitchenOrder({ number: 4 })]);
    expect(within(card(4)).queryByRole('button', { name: /servido/i })).not.toBeInTheDocument();
  });

  it('un error de red muestra kitchen.actionError y el pedido no cambia', async () => {
    await openPanel([kitchenOrder({ id: 'o4', number: 4 })]);
    fakeSupabase.rpcs.advance_order = () => fail('Failed to fetch');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Empezar el pedido nº 4' }));

    expect(await within(card(4)).findByRole('alert')).toHaveTextContent('No se ha podido guardar el cambio. Inténtalo de nuevo.');
    expect(within(card(4)).getByText('Recibido')).toBeInTheDocument();
    expect(within(card(4)).getByRole('button', { name: 'Empezar el pedido nº 4' })).toBeEnabled();
  });

  it('el botón queda deshabilitado mientras se envía', async () => {
    await openPanel([kitchenOrder({ id: 'o4', number: 4 })]);
    let release: () => void = () => {};
    fakeSupabase.rpcs.advance_order = () =>
      new Promise((resolve) => {
        release = () => resolve(ok({ status: 'conflict', current_status: 'received' }));
      });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Empezar el pedido nº 4' }));
    expect(screen.getByRole('button', { name: 'Empezar el pedido nº 4' })).toBeDisabled();
    expect(card(4)).toHaveAttribute('aria-busy', 'true');
    await act(async () => release());
  });

  it('[kitchen-panel] «El personal cancela un pedido recibido»: pide confirmar con número y mesa; después sale de la vista activa', async () => {
    await openPanel([kitchenOrder({ id: 'o5', number: 5, table_name: 'Mesa 6' })]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancelar el pedido nº 5' }));

    const dialog = screen.getByRole('dialog', { name: '¿Cancelar el pedido nº 5 de Mesa 6? No se puede deshacer.' });
    expect(fakeSupabase.rpcCalls.some((c) => c.name === 'cancel_order')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Sí, cancelar' }));

    expect(await screen.findByText('No hay pedidos pendientes. Los nuevos aparecerán aquí solos.')).toBeInTheDocument();
    expect(fakeSupabase.rpcCalls.find((c) => c.name === 'cancel_order')?.args).toEqual({ p_order_id: 'o5' });
    expect(screen.getByRole('link', { name: 'Histórico de hoy (1)' })).toBeInTheDocument();
  });

  it('[kitchen-panel] «El personal se arrepiente de cancelar»: el pedido sigue en «Recibido»', async () => {
    await openPanel([kitchenOrder({ id: 'o5', number: 5, table_name: 'Mesa 6' })]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancelar el pedido nº 5' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'No, volver' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(card(5)).getByText('Recibido')).toBeInTheDocument();
    expect(fakeSupabase.rpcCalls.some((c) => c.name === 'cancel_order')).toBe(false);
  });

  it('[kitchen-panel] «Un pedido en preparación no se puede cancelar»: sin acción de cancelar', async () => {
    await openPanel([kitchenOrder({ number: 4, status: 'in_preparation', preparing_at: '2026-11-19T13:06:00Z' })]);
    expect(within(card(4)).queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument();
  });

  it('[kitchen-panel] «Cancelar un pedido que otra tablet acaba de empezar»: avisa y muestra «En preparación»', async () => {
    const server = await openPanel([kitchenOrder({ id: 'o5', number: 5, table_name: 'Mesa 6' })]);
    server.elsewhere('o5', { status: 'in_preparation', preparing_at: '2026-11-19T13:10:00Z' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancelar el pedido nº 5' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, cancelar' }));

    expect(await screen.findByText('El pedido nº 5 ya había cambiado desde otro dispositivo. Ahora está: En preparación.')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(await within(card(5)).findByText('En preparación')).toBeInTheDocument();
    expect(within(card(5)).queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument();
  });

  it('[kitchen-panel] «El personal usa el panel en la barra»: cada botón se anuncia con su número de pedido', async () => {
    await openPanel([
      kitchenOrder({ number: 4, status: 'in_preparation', preparing_at: '2026-11-19T13:06:00Z' }),
      kitchenOrder({ number: 5, created_at: '2026-11-19T13:09:00Z' }),
    ]);
    const actions = [...screen.getAllByRole('button')].filter((b) => b.closest('article'));
    expect(actions.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Marcar como servido el pedido nº 4',
      'Empezar el pedido nº 5',
      'Cancelar el pedido nº 5',
    ]);
    for (const action of actions) expect(action).toHaveClass('kitchen-action');
  });
});
