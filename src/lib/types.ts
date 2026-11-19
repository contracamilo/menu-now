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
