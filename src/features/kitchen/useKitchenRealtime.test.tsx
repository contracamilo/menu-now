import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kitchenOrder } from '../../test/fakeKitchen';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { useKitchenOrders } from './kitchenApi';
import { OFFLINE_AFTER_MS, useKitchenRealtime } from './useKitchenRealtime';
import type { KitchenOrder } from './types';

function Harness() {
  const orders = useKitchenOrders();
  const realtime = useKitchenRealtime();
  return (
    <div>
      <p>{realtime.offline ? 'desconectado' : 'conectado'}</p>
      <ul>
        {orders.data?.orders.map((o) => (
          <li key={o.id}>
            Pedido {o.number} {o.status} {realtime.newIds.has(o.id) ? 'nuevo' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

let serverOrders: KitchenOrder[] = [];
function serveOrders() {
  fakeSupabase.rpcs.get_kitchen_orders = () => ok({ server_now: new Date().toISOString(), orders: serverOrders });
}
const reads = () => fakeSupabase.rpcCalls.filter((c) => c.name === 'get_kitchen_orders').length;
const flush = () => act(async () => {});
/** Con temporizadores falsos: deja correr las promesas y los timeouts de 0 ms de TanStack Query. */
const tick = () => act(async () => void (await vi.advanceTimersByTimeAsync(10)));

afterEach(() => {
  vi.useRealTimers();
});

describe('useKitchenRealtime', () => {
  it('[kitchen-panel] «Dos tablets con el panel abierto»: un UPDATE de otro dispositivo relee el panel', async () => {
    serverOrders = [kitchenOrder({ id: 'o4', number: 4 })];
    serveOrders();
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/Pedido 4 received/)).toBeInTheDocument();
    const before = reads();

    serverOrders = [kitchenOrder({ id: 'o4', number: 4, status: 'in_preparation', preparing_at: '2026-11-19T13:06:00Z' })];
    act(() => fakeSupabase.lastChannel('kitchen-orders').emitChange({ eventType: 'UPDATE', new: { id: 'o4' } }));

    expect(await screen.findByText(/Pedido 4 in_preparation/)).toBeInTheDocument();
    expect(reads()).toBeGreaterThan(before);
  });

  it('un INSERT relee y marca el pedido como nuevo; los que ya estaban no', async () => {
    serverOrders = [kitchenOrder({ id: 'o4', number: 4 })];
    serveOrders();
    renderWithProviders(<Harness />);
    await screen.findByText(/Pedido 4/);

    serverOrders = [...serverOrders, kitchenOrder({ id: 'o5', number: 5 })];
    act(() => fakeSupabase.lastChannel('kitchen-orders').emitChange({ eventType: 'INSERT', new: { id: 'o5' } }));

    expect(await screen.findByText('Pedido 5 received nuevo')).toBeInTheDocument();
    expect(screen.getByText(/Pedido 4/)).not.toHaveTextContent('nuevo');
  });

  it('[kitchen-panel] «La tablet pierde la wifi durante el servicio» (lógica): desconectado tras 5 s y puesta al día al volver', async () => {
    vi.useFakeTimers();
    serverOrders = [kitchenOrder({ id: 'o4', number: 4 })];
    serveOrders();
    renderWithProviders(<Harness />);
    await tick();
    expect(screen.getByText(/Pedido 4/)).toBeInTheDocument();
    const channel = fakeSupabase.lastChannel('kitchen-orders');

    act(() => channel.emitStatus('CHANNEL_ERROR'));
    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS - 100));
    expect(screen.getByText('conectado')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText('desconectado')).toBeInTheDocument();

    // Mientras tanto un comensal confirma el pedido 7; el evento se pierde
    serverOrders = [...serverOrders, kitchenOrder({ id: 'o7', number: 7 })];
    const before = reads();
    act(() => channel.emitStatus('SUBSCRIBED'));
    await tick();

    expect(reads()).toBeGreaterThan(before);
    expect(screen.getByText(/Pedido 7/)).toBeInTheDocument();
    expect(screen.getByText('conectado')).toBeInTheDocument();
  });

  it('una reconexión instantánea no muestra el aviso', async () => {
    vi.useFakeTimers();
    serveOrders();
    renderWithProviders(<Harness />);
    await tick();
    const channel = fakeSupabase.lastChannel('kitchen-orders');
    act(() => channel.emitStatus('TIMED_OUT'));
    act(() => vi.advanceTimersByTime(1_000));
    act(() => channel.emitStatus('SUBSCRIBED'));
    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS * 2));
    expect(screen.getByText('conectado')).toBeInTheDocument();
  });

  it('relee cuando Realtime confirma que ya escucha la base de datos', async () => {
    serverOrders = [];
    serveOrders();
    renderWithProviders(<Harness />);
    await flush();
    await flush();
    // Un pedido confirmado entre SUBSCRIBED y el arranque real de postgres_changes: su INSERT no llega
    serverOrders = [kitchenOrder({ id: 'o4', number: 4 })];
    act(() =>
      fakeSupabase.lastChannel('kitchen-orders').emitSystem({ extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL' }),
    );
    expect(await screen.findByText(/Pedido 4/)).toBeInTheDocument();
  });

  it('al volver a ser visible relee el panel', async () => {
    serveOrders();
    renderWithProviders(<Harness />);
    await flush();
    await flush();
    const before = reads();
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await flush();
    expect(reads()).toBeGreaterThan(before);
  });

  it('al volver la red del navegador relee el panel', async () => {
    serveOrders();
    renderWithProviders(<Harness />);
    await flush();
    await flush();
    const before = reads();
    act(() => void window.dispatchEvent(new Event('online')));
    await flush();
    expect(reads()).toBeGreaterThan(before);
  });

  it('al desmontar elimina el canal', async () => {
    serveOrders();
    const view = renderWithProviders(<Harness />);
    await flush();
    const channel = fakeSupabase.lastChannel('kitchen-orders');
    view.unmount();
    expect(channel.removed).toBe(true);
    expect(fakeSupabase.channels).toHaveLength(0);
  });
});
