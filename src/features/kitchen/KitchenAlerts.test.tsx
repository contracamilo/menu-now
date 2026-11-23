import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kitchenOrder, serveKitchenOrders, signedInAs } from '../../test/fakeKitchen';
import { fakeSupabase } from '../../test/fakeSupabase';
import { renderAdminApp } from '../../test/renderAdmin';
import type { KitchenOrder } from './types';
import { NEW_FOR_MS, OFFLINE_AFTER_MS } from './useKitchenRealtime';

/** AudioContext simulado: cuenta los tonos que se arrancan (dos por aviso). */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static initialState: AudioContextState = 'running';
  state: AudioContextState = FakeAudioContext.initialState;
  currentTime = 0;
  destination = {};
  tones = 0;
  private listeners = new Set<() => void>();

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    return { frequency: { value: 0 }, connect: (node: unknown) => node, start: () => void (this.tones += 1), stop: () => {} };
  }
  createGain() {
    return { gain: { value: 0 }, connect: (node: unknown) => node };
  }
  resume() {
    this.state = 'running';
    this.listeners.forEach((l) => l());
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  addEventListener(_type: string, listener: () => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: string, listener: () => void) {
    this.listeners.delete(listener);
  }
}

const alerts = () => FakeAudioContext.instances.reduce((sum, ctx) => sum + ctx.tones, 0) / 2;
const card = (number: number) => screen.getByRole('heading', { name: `Nº ${number}` }).closest('article') as HTMLElement;

let orders: KitchenOrder[] = [];
async function openPanel(initial: KitchenOrder[]) {
  orders = initial;
  signedInAs(fakeSupabase, 'staff');
  serveKitchenOrders(fakeSupabase, () => orders);
  renderAdminApp('/admin/kitchen');
  await screen.findByRole('heading', { name: 'Pedidos' });
  if (initial.length > 0) await screen.findAllByRole('heading', { name: /^Nº/ });
}

/** Un comensal confirma un pedido: el servidor ya lo devuelve y Realtime emite el INSERT. */
function placeOrder(order: KitchenOrder, { emit = true } = {}) {
  orders = [...orders, order];
  if (emit) act(() => fakeSupabase.lastChannel('kitchen-orders').emitChange({ eventType: 'INSERT', new: { id: order.id } }));
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  FakeAudioContext.initialState = 'running';
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Avisos del panel de cocina', () => {
  it('[kitchen-panel] «Llega un pedido mientras el panel está abierto»: aparece sin recargar, resaltado y con un solo aviso sonoro', async () => {
    await openPanel([kitchenOrder({ id: 'o4', number: 4, created_at: '2026-11-19T13:05:00Z' })]);
    // Los pedidos presentes al abrir no suenan ni se resaltan
    expect(alerts()).toBe(0);
    expect(within(card(4)).queryByText('Nuevo')).not.toBeInTheDocument();

    placeOrder(kitchenOrder({ id: 'o5', number: 5, table_name: 'Mesa 6', created_at: '2026-11-19T13:09:00Z' }));

    expect(await screen.findByRole('heading', { name: 'Nº 5' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^Nº/ }).map((h) => h.textContent)).toEqual(['Nº 4', 'Nº 5']);
    expect(within(card(5)).getByText('Nuevo')).toBeInTheDocument();
    expect(card(5)).toHaveClass('kitchen-card--new');
    expect(alerts()).toBe(1);
  });

  it('varios pedidos en el mismo segundo suenan una sola vez', async () => {
    await openPanel([]);
    placeOrder(kitchenOrder({ id: 'o5', number: 5 }));
    placeOrder(kitchenOrder({ id: 'o6', number: 6 }));
    expect(await screen.findByRole('heading', { name: 'Nº 6' })).toBeInTheDocument();
    expect(alerts()).toBe(1);
  });

  it('[kitchen-panel] «Llega un pedido con lector de pantalla activo»: la región viva lo anuncia', async () => {
    await openPanel([]);
    placeOrder(kitchenOrder({ id: 'o5', number: 5, table_name: 'Mesa 6' }));
    const announcement = await screen.findByText('Nuevo pedido nº 5 de Mesa 6.');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
  });

  it('[kitchen-panel] «Accesibilidad del panel»: anuncia el cambio de estado hecho desde otra tablet', async () => {
    await openPanel([kitchenOrder({ id: 'o4', number: 4 })]);
    orders = [kitchenOrder({ id: 'o4', number: 4, status: 'in_preparation', preparing_at: '2026-11-19T13:06:00Z' })];
    act(() => fakeSupabase.lastChannel('kitchen-orders').emitChange({ eventType: 'UPDATE', new: { id: 'o4' } }));
    const announcement = await screen.findByText('Pedido nº 4: En preparación.');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    // Al abrir el panel no se anunciaba nada
    expect(screen.queryByText(/^Pedido nº 4: Recibido/)).not.toBeInTheDocument();
  });

  it('[kitchen-panel] «El resaltado desaparece al empezar el pedido»: la marca «Nuevo» se quita al pulsar «Empezar»', async () => {
    await openPanel([]);
    fakeSupabase.rpcs.advance_order = () => new Promise(() => {});
    placeOrder(kitchenOrder({ id: 'o5', number: 5 }));
    await screen.findByText('Nuevo');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Empezar el pedido nº 5' }));
    expect(within(card(5)).queryByText('Nuevo')).not.toBeInTheDocument();
  });

  it('[kitchen-panel] «El resaltado desaparece a los 2 minutos»', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openPanel([]);
    placeOrder(kitchenOrder({ id: 'o5', number: 5 }));
    expect(await screen.findByText('Nuevo')).toBeInTheDocument();
    await act(async () => void (await vi.advanceTimersByTimeAsync(NEW_FOR_MS)));
    expect(within(card(5)).queryByText('Nuevo')).not.toBeInTheDocument();
  });

  it('[kitchen-panel] «La tablet pierde la wifi durante el servicio»: banda tras 5 s y puesta al día al reconectar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openPanel([kitchenOrder({ id: 'o4', number: 4 })]);
    const channel = fakeSupabase.lastChannel('kitchen-orders');

    act(() => channel.emitStatus('CHANNEL_ERROR'));
    await act(async () => void (await vi.advanceTimersByTimeAsync(OFFLINE_AFTER_MS + 100)));
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión: los pedidos no se están actualizando. Reconectando…');

    // El pedido 7 llega mientras no hay conexión: el evento se pierde
    placeOrder(kitchenOrder({ id: 'o7', number: 7 }), { emit: false });
    act(() => channel.emitStatus('SUBSCRIBED'));

    expect(await screen.findByRole('heading', { name: 'Nº 7' })).toBeInTheDocument();
    expect(screen.queryByText(/Sin conexión/)).not.toBeInTheDocument();
  });

  it('[kitchen-panel] «El personal activa el sonido al abrir el panel»: con el audio suspendido ofrece activarlo y lo quita al activarlo', async () => {
    FakeAudioContext.initialState = 'suspended';
    await openPanel([]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Activar el aviso sonoro' }));
    expect(screen.queryByRole('button', { name: 'Activar el aviso sonoro' })).not.toBeInTheDocument();
    expect(FakeAudioContext.instances.at(-1)?.state).toBe('running');
    // y el siguiente pedido nuevo suena
    placeOrder(kitchenOrder({ id: 'o5', number: 5 }));
    expect(await screen.findByRole('heading', { name: 'Nº 5' })).toBeInTheDocument();
    expect(alerts()).toBe(1);
  });

  it('[kitchen-panel] «Un navegador que no permite mantener la pantalla encendida»: sin Wake Lock ni Web Audio el panel funciona sin errores', async () => {
    vi.stubGlobal('AudioContext', undefined);
    expect('wakeLock' in navigator).toBe(false);
    await openPanel([kitchenOrder({ id: 'o4', number: 4 })]);
    placeOrder(kitchenOrder({ id: 'o5', number: 5 }));
    expect(await screen.findByRole('heading', { name: 'Nº 5' })).toBeInTheDocument();
  });

  it('[kitchen-panel] «La tablet no se apaga durante el servicio»: con Wake Lock pide mantener la pantalla encendida', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    try {
      await openPanel([]);
      expect(request).toHaveBeenCalledWith('screen');
    } finally {
      delete (navigator as { wakeLock?: unknown }).wakeLock;
    }
  });
});
