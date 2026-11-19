import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { AdminLayout } from './AdminLayout';
import { RequireOwner } from './RequireOwner';

function LoginProbe() {
  const location = useLocation();
  return <p>Login {location.search}</p>;
}

function renderAdmin(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/login" element={<LoginProbe />} />
      <Route path="/admin/kitchen" element={<p>Panel de cocina</p>} />
      <Route
        path="/admin"
        element={
          <RequireOwner>
            <AdminLayout />
          </RequireOwner>
        }
      >
        <Route index element={<p>Datos del catálogo</p>} />
        <Route path="venue" element={<p>Datos de Mi local</p>} />
        <Route path="tables" element={<p>Datos de Mesas</p>} />
      </Route>
    </Routes>,
    { route, zone: 'admin' },
  );
}

function roles(byUser: Record<string, string>) {
  fakeSupabase.tables.backoffice_users = (q) => {
    const userId = q.filters.find(([, column]) => column === 'user_id')?.[2] as string;
    return ok(byUser[userId] ? { role: byUser[userId] } : null);
  };
  fakeSupabase.tables.venue_settings = () => ok([{ name: 'Bar Manolo', logo_path: null }]);
}

function owners(...ids: string[]) {
  roles(Object.fromEntries(ids.map((id) => [id, 'owner'])));
}

describe('RequireOwner', () => {
  it('[backoffice-access] «Acceso a la administración sin sesión»: redirige a login sin renderizar datos', async () => {
    owners('u1');
    renderAdmin('/admin/venue');
    expect(await screen.findByText('Login ?next=%2Fadmin%2Fvenue')).toBeInTheDocument();
    expect(screen.queryByText('Datos de Mi local')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    expect(fakeSupabase.calls.filter((c) => c.table === 'backoffice_users')).toHaveLength(0);
  });

  it('un usuario que no es dueño ve auth.notOwner y se cierra su sesión', async () => {
    owners('u1');
    fakeSupabase.session = { user: { id: 'u2', email: 'otro@bar.test' } };
    renderAdmin('/admin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuenta no tiene acceso a la administración.');
    expect(screen.queryByText('Datos del catálogo')).not.toBeInTheDocument();
    expect(fakeSupabase.session).toBeNull();
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/admin/login');
  });

  it('un dueño entra en la administración', async () => {
    owners('u1');
    fakeSupabase.session = { user: { id: 'u1', email: 'dueno@bar.test' } };
    renderAdmin('/admin');
    expect(await screen.findByText('Datos del catálogo')).toBeInTheDocument();
    expect(await screen.findByText('Bar Manolo')).toBeInTheDocument();
  });

  it('[backoffice-access] «El dueño cierra sesión»: tras cerrar, /admin vuelve a pedir login', async () => {
    owners('u1');
    fakeSupabase.session = { user: { id: 'u1', email: 'dueno@bar.test' } };
    const user = userEvent.setup();
    const first = renderAdmin('/admin');
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText(/^Login/)).toBeInTheDocument();
    expect(fakeSupabase.session).toBeNull();
    first.unmount();

    renderAdmin('/admin');
    expect(await screen.findByText('Login ?next=%2Fadmin')).toBeInTheDocument();
    expect(screen.queryByText('Datos del catálogo')).not.toBeInTheDocument();
  });

  it('[backoffice-access] «El personal inicia sesión en la tablet»: una sesión de personal que llega a /admin acaba en el panel', async () => {
    roles({ s1: 'staff' });
    fakeSupabase.session = { user: { id: 's1', email: 'barra@bar.test' } };
    renderAdmin('/admin');
    expect(await screen.findByText('Panel de cocina')).toBeInTheDocument();
    expect(fakeSupabase.session).not.toBeNull();
  });

  it.each(['/admin', '/admin/venue', '/admin/tables'])(
    '[backoffice-access] «El personal intenta abrir la carta en la administración»: %s lleva al panel sin datos de la administración',
    async (route) => {
      roles({ s1: 'staff' });
      fakeSupabase.session = { user: { id: 's1', email: 'barra@bar.test' } };
      renderAdmin(route);
      expect(await screen.findByText('Panel de cocina')).toBeInTheDocument();
      expect(screen.queryByText(/^Datos de/)).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(fakeSupabase.calls.filter((c) => c.table === 'venue_settings')).toHaveLength(0);
    },
  );
});
