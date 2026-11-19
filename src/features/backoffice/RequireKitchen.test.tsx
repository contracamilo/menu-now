import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { RequireKitchen } from './RequireKitchen';

function LoginProbe() {
  const location = useLocation();
  return <p>Login {location.search}</p>;
}

function renderKitchen(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/login" element={<LoginProbe />} />
      <Route
        path="/admin/kitchen/*"
        element={
          <RequireKitchen>
            <p>Pedidos del día</p>
          </RequireKitchen>
        }
      />
    </Routes>,
    { route, zone: 'admin' },
  );
}

function roles(byUser: Record<string, string>) {
  fakeSupabase.tables.backoffice_users = (q) => {
    const userId = q.filters.find(([, column]) => column === 'user_id')?.[2] as string;
    return ok(byUser[userId] ? { role: byUser[userId] } : null);
  };
}

describe('RequireKitchen', () => {
  it('[kitchen-panel] «Acceso al panel sin sesión»: lleva al inicio de sesión sin mostrar pedidos', async () => {
    roles({ s1: 'staff' });
    renderKitchen('/admin/kitchen/history');
    expect(await screen.findByText('Login ?next=%2Fadmin%2Fkitchen%2Fhistory')).toBeInTheDocument();
    expect(screen.queryByText('Pedidos del día')).not.toBeInTheDocument();
  });

  it.each([
    ['personal', 'staff'],
    ['dueño', 'owner'],
  ])('admite al %s', async (_who, role) => {
    roles({ u1: role });
    fakeSupabase.session = { user: { id: 'u1', email: 'u1@bar.test' } };
    renderKitchen('/admin/kitchen');
    expect(await screen.findByText('Pedidos del día')).toBeInTheDocument();
  });

  it('una cuenta sin rol ve auth.notOwner y se cierra su sesión', async () => {
    roles({});
    fakeSupabase.session = { user: { id: 'u2', email: 'otro@bar.test' } };
    renderKitchen('/admin/kitchen');
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuenta no tiene acceso a la administración.');
    expect(screen.queryByText('Pedidos del día')).not.toBeInTheDocument();
    expect(fakeSupabase.session).toBeNull();
  });
});
