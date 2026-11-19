import { QueryClient } from '@tanstack/react-query';

// design D6: datos frescos al volver a la pestaña y error visible pronto
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, refetchOnWindowFocus: true, retry: 1 },
    },
  });
}
