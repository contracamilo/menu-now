import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { I18nProvider } from './i18n/I18nProvider';
import { MenuPage } from './features/menu/MenuPage';
import { TableApp } from './features/order/TableApp';
import { NotFoundPage } from './NotFoundPage';

// Todo /admin/* va en un chunk aparte para que la carta no descargue código de administración
const AdminApp = lazy(() => import('./features/backoffice/AdminApp'));

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <I18nProvider zone="menu">
            <MenuPage />
          </I18nProvider>
        }
      />
      <Route
        path="/t/:token/*"
        element={
          <I18nProvider zone="menu">
            <TableApp />
          </I18nProvider>
        }
      />
      <Route
        path="/admin/*"
        element={
          <I18nProvider zone="admin">
            <Suspense fallback={null}>
              <AdminApp />
            </Suspense>
          </I18nProvider>
        }
      />
      <Route
        path="*"
        element={
          <I18nProvider zone="menu">
            <NotFoundPage />
          </I18nProvider>
        }
      />
    </Routes>
  );
}
