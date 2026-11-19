import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, type Zone } from '../i18n/I18nProvider';

export function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
}

/** Renderiza con QueryClient, router en memoria y, si se indica, I18nProvider de la zona. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', zone, queryClient = testQueryClient() }: { route?: string; zone?: Zone; queryClient?: QueryClient } = {},
) {
  const content = zone ? <I18nProvider zone={zone}>{ui}</I18nProvider> : ui;
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
