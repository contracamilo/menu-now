import type { KitchenOrder } from './types';

/** Momento en que un pedido salió de la vista activa (servido o cancelado). */
export function closedAt(order: KitchenOrder): string {
  return order.served_at ?? order.cancelled_at ?? order.created_at;
}

const time = (iso: string) => new Date(iso).getTime();

/**
 * Reparte los pedidos del día (design D8): activos («Recibido» / «En preparación») del más
 * antiguo al más reciente; histórico (servidos y cancelados) del cierre más reciente al más antiguo.
 */
export function splitKitchenOrders(orders: KitchenOrder[]): { active: KitchenOrder[]; history: KitchenOrder[] } {
  const active = orders
    .filter((o) => o.status === 'received' || o.status === 'in_preparation')
    .sort((a, b) => time(a.created_at) - time(b.created_at) || a.number - b.number);
  const history = orders
    .filter((o) => o.status === 'served' || o.status === 'cancelled')
    .sort((a, b) => time(closedAt(b)) - time(closedAt(a)) || b.number - a.number);
  return { active, history };
}
