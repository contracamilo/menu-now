import { Route, Routes } from 'react-router';
import AdminApp from '../features/backoffice/AdminApp';
import { renderWithProviders } from './render';

/** Renderiza la zona privada real (`/admin/*`), como en App, con el idioma de la administración. */
export function renderAdminApp(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
    </Routes>,
    { route, zone: 'admin' },
  );
}
