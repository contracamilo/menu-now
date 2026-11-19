import type { KitchenOrder } from '../features/kitchen/types';
import { ok, type FakeSupabase } from './fakeSupabase';

let seq = 0;

/** Pedido del panel de cocina para tests, en «Recibido» salvo que se indique otra cosa. */
export function kitchenOrder(overrides: Partial<KitchenOrder> = {}): KitchenOrder {
  seq += 1;
  const number = overrides.number ?? seq;
  return {
    id: `order-${number}`,
    number,
    status: 'received',
    created_at: '2026-11-19T13:00:00Z',
    preparing_at: null,
    served_at: null,
    cancelled_at: null,
    table_name: 'Mesa 2',
    items: [{ position: 1, dish_name: 'Croquetas', size_label: 'Ración', quantity: 2, note: null }],
    ...overrides,
  };
}

/** Hora local de hoy en ISO (las horas del histórico se muestran en la zona horaria del navegador). */
export function todayAt(hours: number, minutes: number): string {
  const date = new Date(2026, 10, 19, hours, minutes);
  return date.toISOString();
}

/** El servidor devuelve `orders` (o lo que devuelva la función en cada lectura) en `get_kitchen_orders`. */
export function serveKitchenOrders(fake: FakeSupabase, orders: KitchenOrder[] | (() => KitchenOrder[])) {
  fake.rpcs.get_kitchen_orders = () =>
    ok({ server_now: new Date().toISOString(), orders: typeof orders === 'function' ? orders() : orders });
}

/** Sesión iniciada con ese rol en `backoffice_users` (null = cuenta sin rol) y local «Bar Manolo». */
export function signedInAs(fake: FakeSupabase, role: 'owner' | 'staff' | null, id = 'u1') {
  fake.session = { user: { id, email: `${id}@bar.test` } };
  fake.tables.backoffice_users = () => ok(role ? { role } : null);
  fake.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);
}
