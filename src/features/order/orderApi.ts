import { useQuery } from '@tanstack/react-query';
import { restRpc } from '../../lib/rest';
import type { DraftLine, PlacedOrder, PlaceOrderResult } from '../../lib/types';

/** Confirma el pedido (design D3). El precio de cada línea es el que vio el comensal, solo para compararlo. */
export function placeOrder(token: string, orderId: string, lines: DraftLine[]): Promise<PlaceOrderResult> {
  return restRpc<PlaceOrderResult>('place_order', {
    p_order_id: orderId,
    p_table_token: token,
    p_items: lines.map((line) => ({
      dish_id: line.dish_id,
      size_id: line.size_id,
      quantity: line.quantity,
      note: line.note.trim() || null,
      unit_price_cents: line.unit_price_cents,
    })),
  });
}

export const ordersQueryKey = (token: string, ids: string[]) => ['orders', token, ...ids] as const;

/** Pedidos de hoy de esta mesa cuyos id conoce el móvil (`get_orders`, design D4). */
export function useOrders(token: string, ids: string[]) {
  return useQuery({
    queryKey: ordersQueryKey(token, ids),
    queryFn: () =>
      ids.length === 0
        ? Promise.resolve<PlacedOrder[]>([])
        : restRpc<PlacedOrder[]>('get_orders', { p_table_token: token, p_order_ids: ids }),
    staleTime: 30_000,
  });
}
