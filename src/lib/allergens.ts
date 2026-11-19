// Los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011, Anexo II,
// en el orden del Anexo. Coincide con el tipo `public.allergen` de la base de datos.
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

export type Allergen = (typeof ALLERGENS)[number];

/** Ordena una lista de alérgenos según el Anexo II. */
export function sortAllergens(list: readonly Allergen[]): Allergen[] {
  return [...list].sort((a, b) => ALLERGENS.indexOf(a) - ALLERGENS.indexOf(b));
}
