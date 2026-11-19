import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { kitchenOrder, serveKitchenOrders, signedInAs } from '../../test/fakeKitchen';
import { renderWithProviders } from '../../test/render';
import { renderAdminApp } from '../../test/renderAdmin';
import { MenuPage } from '../menu/MenuPage';
import { LoginPage } from './LoginPage';
import { safeNext } from './session';

function renderLogin(route = '/admin/login') {
  fakeSupabase.users.set('dueno@bar.test', { id: 'u1', password: 'correcta-123' });
  return renderWithProviders(
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<p>Pantalla del catálogo</p>} />
      <Route path="/admin/venue" element={<p>Pantalla de Mi local</p>} />
    </Routes>,
    { route, zone: 'admin' },
  );
}

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo electrónico'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

const registerControl = /regist|sign ?up|crear (una )?cuenta|alta/i;

describe('LoginPage', () => {
  it('[backoffice-access] «El dueño inicia sesión»: llega a la pantalla que intentaba abrir', async () => {
    renderLogin('/admin/login?next=%2Fadmin%2Fvenue');
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    await signIn('dueno@bar.test', 'correcta-123');
    expect(await screen.findByText('Pantalla de Mi local')).toBeInTheDocument();
  });

  it('ignora un `next` externo y va a la administración', async () => {
    renderLogin('/admin/login?next=https%3A%2F%2Fmalo.example%2Fadmin');
    await signIn('dueno@bar.test', 'correcta-123');
    expect(await screen.findByText('Pantalla del catálogo')).toBeInTheDocument();
  });

  it.each([
    ['https://malo.example', '/admin'],
    ['//malo.example/admin', '/admin'],
    ['/', '/admin'],
    ['/admin/login', '/admin'],
    [null, '/admin'],
    ['/admin/dishes/1', '/admin/dishes/1'],
  ])('safeNext(%s) → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });

  it('[backoffice-access] «El dueño introduce una contraseña incorrecta»', async () => {
    renderLogin();
    await signIn('dueno@bar.test', 'incorrecta');
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(fakeSupabase.session).toBeNull();
    expect(screen.queryByText('Pantalla del catálogo')).not.toBeInTheDocument();
  });

  it('un correo inexistente muestra exactamente el mismo mensaje', async () => {
    renderLogin();
    await signIn('nadie@bar.test', 'loquesea-123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });

  it('[backoffice-access] «Nadie puede registrarse desde la aplicación»: ni en el login, ni en la carta, ni en el panel de cocina', async () => {
    renderLogin();
    const controls = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')];
    expect(controls.map((c) => c.textContent).join(' | ')).not.toMatch(registerControl);
    expect(screen.getByRole('link', { name: '¿Has olvidado tu contraseña?' })).toHaveAttribute('href', '/admin/forgot-password');

    fakeSupabase.tables.categories = () => ok([]);
    renderWithProviders(<MenuPage />, { zone: 'menu' });
    await screen.findByText("The menu isn't available yet. Please ask the staff.");
    const menuControls = [...screen.queryAllByRole('link'), ...screen.queryAllByRole('button')];
    expect(menuControls.map((c) => c.textContent).join(' | ')).not.toMatch(registerControl);
    cleanup();

    signedInAs(fakeSupabase, 'staff');
    serveKitchenOrders(fakeSupabase, [kitchenOrder({ number: 4 })]);
    renderAdminApp('/admin/kitchen');
    await screen.findByRole('heading', { name: 'Nº 4' });
    const panelControls = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')];
    expect(panelControls.map((c) => c.textContent).join(' | ')).not.toMatch(registerControl);
  });
});
