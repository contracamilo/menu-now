import { useQuery, type QueryClient } from '@tanstack/react-query';
import { restGet } from '../../lib/rest';
import type { VenueSettings } from '../../lib/types';

export const venueQueryKey = ['venue'] as const;

export async function fetchVenue(): Promise<VenueSettings> {
  const rows = await restGet<VenueSettings[]>('venue_settings', { select: 'name,logo_path' });
  return rows[0] ?? { name: null, logo_path: null };
}

export const venueQuery = { queryKey: venueQueryKey, queryFn: fetchVenue };

export function useVenue() {
  return useQuery(venueQuery);
}

export function prefetchVenue(queryClient: QueryClient) {
  return queryClient.prefetchQuery(venueQuery);
}
