import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { createQueryClient } from './queryClient';
import { prefetchMenu } from './features/menu/useMenu';
import { prefetchVenue } from './features/venue/useVenue';
import { prefetchTable } from './features/order/useTable';
import { isMenuPath, tableTokenFromPath } from './lib/publicQueries';
import './styles/global.scss';

const queryClient = createQueryClient();

// design D6: las peticiones salen al cargar el módulo, en paralelo, sin esperar al primer render
const { pathname } = window.location;
if (isMenuPath(pathname)) void prefetchMenu(queryClient);
void prefetchVenue(queryClient);
const token = tableTokenFromPath(pathname);
if (token) void prefetchTable(queryClient, token);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
