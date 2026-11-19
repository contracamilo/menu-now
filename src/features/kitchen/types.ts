export type KitchenStatus = 'received' | 'in_preparation' | 'served' | 'cancelled';

export interface KitchenOrderItem {
  position: number;
  dish_name: string;
  size_label: string | null;
  quantity: number;
  note: string | null;
}

/** Un pedido tal como lo devuelve `get_kitchen_orders` (design D4). */
export interface KitchenOrder {
  id: string;
  number: number;
  status: KitchenStatus;
  created_at: string;
  preparing_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
  table_name: string;
  items: KitchenOrderItem[];
}

export interface KitchenOrdersResponse {
  server_now: string;
  orders: KitchenOrder[];
}

/** Respuesta de `advance_order` / `cancel_order` (design D3). */
export type OrderChangeResult =
  | { status: 'ok'; order: Pick<KitchenOrder, 'id' | 'number' | 'status' | 'preparing_at' | 'served_at' | 'cancelled_at'> }
  | { status: 'conflict'; current_status: KitchenStatus }
  | { status: 'not_found' };
