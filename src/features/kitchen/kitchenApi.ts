import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { KitchenOrder, KitchenOrdersResponse, KitchenStatus, OrderChangeResult } from './types';

export const kitchenOrdersKey = ['kitchen', 'orders'] as const;

export interface KitchenOrdersData {
  orders: KitchenOrder[];
  /** `server_now − hora local` al recibir la respuesta: corrige el reloj de la tablet (design D4, D8). */
  clockOffset: number;
}

async function fetchKitchenOrders(): Promise<KitchenOrdersData> {
  const { data, error } = await supabase.rpc('get_kitchen_orders');
  if (error) throw new Error(error.message);
  const response = data as KitchenOrdersResponse;
  return { orders: response.orders, clockOffset: Date.parse(response.server_now) - Date.now() };
}

/**
 * Pedidos del día de servicio (design D4–D5). La fuente de verdad es siempre el servidor: los
 * eventos de Realtime solo invalidan esta consulta. Si una relectura falla se conserva la última
 * lista conocida. El intervalo de 60 s es la red de seguridad por si se pierden eventos.
 */
export function useKitchenOrders() {
  return useQuery({
    queryKey: kitchenOrdersKey,
    queryFn: fetchKitchenOrders,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export type OrderAction = { kind: 'advance'; order: KitchenOrder } | { kind: 'cancel'; order: KitchenOrder };

async function runOrderAction(action: OrderAction): Promise<OrderChangeResult> {
  const { data, error } =
    action.kind === 'advance'
      ? await supabase.rpc('advance_order', { p_order_id: action.order.id, p_from: action.order.status })
      : await supabase.rpc('cancel_order', { p_order_id: action.order.id });
  if (error) throw new Error(error.message);
  return data as OrderChangeResult;
}

/** Empezar, servir o cancelar un pedido (design D3, D8). */
export function useOrderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runOrderAction,
    onSuccess: (result, action) => {
      const status: KitchenStatus | null =
        result.status === 'ok' ? result.order.status : result.status === 'conflict' ? result.current_status : null;
      if (status) {
        // Se refleja ya en la tarjeta; la relectura trae el resto (marcas de tiempo, otros cambios)
        queryClient.setQueryData<KitchenOrdersData>(kitchenOrdersKey, (current) =>
          current && {
            ...current,
            orders: current.orders.map((o) =>
              o.id === action.order.id ? { ...o, status, ...(result.status === 'ok' ? result.order : {}) } : o,
            ),
          },
        );
      }
      void queryClient.invalidateQueries({ queryKey: kitchenOrdersKey });
    },
  });
}
