import { useQuery, type QueryClient } from '@tanstack/react-query';
import { restGet } from '../../lib/rest';
import { takeEarly, VENUE_PARAMS } from '../../lib/publicQueries';
import type { VenueSettings } from '../../lib/types';

export const venueQueryKey = ['venue'] as const;

export async function fetchVenue(): Promise<VenueSettings> {
  // En `/`, la primera vez llega con la carta desde index.html (sin saltos en la cabecera)
  const rows = await (takeEarly<VenueSettings[]>('__menuNowEarlyVenue') ??
    restGet<VenueSettings[]>('venue_settings', VENUE_PARAMS));
  return rows[0] ?? { name: null, logo_path: null };
}

export const venueQuery = { queryKey: venueQueryKey, queryFn: fetchVenue };

export function useVenue() {
  return useQuery(venueQuery);
}

export function prefetchVenue(queryClient: QueryClient) {
  return queryClient.prefetchQuery(venueQuery);
}
