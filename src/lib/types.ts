import type { Allergen } from './allergens';

export interface DishSize {
  id: string;
  label: string | null;
  price_cents: number;
  position: number;
}

export interface Dish {
  id: string;
  name: string;
  description: string | null;
  included_with: string | null;
  photo_path: string | null;
  allergens: Allergen[];
  no_allergens: boolean;
  position: number;
  dish_sizes: DishSize[];
}

export interface Category {
  id: string;
  is_included: boolean;
  /** null solo en «Incluidos»: la interfaz muestra `category.included`. */
  name: string | null;
  position: number;
}

export interface MenuCategory extends Category {
  dishes: Dish[];
}

export interface VenueSettings {
  name: string | null;
  logo_path: string | null;
}

/** Mesa del QR tal como la ve el comensal (`get_table`, design D4). */
export interface TableInfo {
  name: string;
  active: boolean;
}

/** Línea del pedido sin confirmar (design D7): copia de lo que el comensal vio al añadir. */
export interface DraftLine {
  key: string;
  dish_id: string;
  size_id: string;
  dish_name: string;
  size_label: string | null;
  unit_price_cents: number;
  quantity: number;
  note: string;
}

export type OrderStatus = 'received';

export interface PlacedOrderItem {
  dish_name: string;
  size_label: string | null;
  unit_price_cents: number;
  quantity: number;
  note: string | null;
}

/** Pedido registrado, con la copia de nombre, tamaño y precio de cada línea (design D2). */
export interface PlacedOrder {
  id: string;
  number: number;
  status: OrderStatus;
  table_name: string;
  total_cents: number;
  created_at: string;
  items: PlacedOrderItem[];
}

export interface UnavailableLine {
  dish_id: string;
  size_id: string;
  dish_name: string | null;
}

export interface PriceChange {
  dish_id: string;
  size_id: string;
  dish_name: string;
  price_cents: number;
}

/** Respuesta de `place_order` (design D3). */
export type PlaceOrderResult =
  | { status: 'placed'; order: PlacedOrder }
  | { status: 'rejected'; unavailable: UnavailableLine[]; price_changes: PriceChange[] }
  | { status: 'table_unavailable' };
