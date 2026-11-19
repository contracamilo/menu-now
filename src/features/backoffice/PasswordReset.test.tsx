import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fail, fakeSupabase } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';

const SENT = 'Si el correo corresponde a una cuenta, recibirás un enlace para crear una contraseña nueva.';

function renderForgot() {
  return renderWithProviders(<ForgotPasswordPage />, { route: '/admin/forgot-password', zone: 'admin' });
}

function renderReset() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin" element={<p>Administración</p>} />
    </Routes>,
    { route: '/admin/reset-password', zone: 'admin' },
  );
}

async function requestReset(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo electrónico'), email);
  await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
}

describe('Restablecimiento de contraseña', () => {
  it('[backoffice-access] «El dueño pide restablecer su contraseña»', async () => {
    renderForgot();
    await requestReset('dueno@bar.test');
    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
    expect(fakeSupabase.resetRequests).toEqual([
      { email: 'dueno@bar.test', options: { redirectTo: `${window.location.origin}/admin/reset-password` } },
    ]);
  });

  it('[backoffice-access] «Se pide restablecer la contraseña de un correo sin cuenta»: mismo mensaje, también con error', async () => {
    fakeSupabase.resetHandler = () => fail('User not found');
    renderForgot();
    await requestReset('nadie@bar.test');
    expect(await screen.findByRole('status')).toHaveTextContent(SENT);
  });

  it('[backoffice-access] «El dueño crea una contraseña nueva»', async () => {
    let saved: string | undefined;
    fakeSupabase.updateUserHandler = ({ password }) => {
      saved = password;
      return { data: {}, error: null };
    };
    const user = userEvent.setup();
    renderReset();
    // supabase-js convierte el enlace en una sesión de recuperación
    fakeSupabase.emit('PASSWORD_RECOVERY', { user: { id: 'u1', email: 'dueno@bar.test' } });

    const input = await screen.findByLabelText('Contraseña nueva');
    await user.type(input, 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La contraseña debe tener al menos 8 caracteres.');
    expect(saved).toBeUndefined();

    await user.clear(input);
    await user.type(input, 'nueva-segura');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Administración')).toBeInTheDocument();
    expect(saved).toBe('nueva-segura');
  });

  it('[backoffice-access] «El dueño usa un enlace caducado o ya usado»: sin sesión de recuperación', async () => {
    renderReset();
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ha caducado. Pide uno nuevo.');
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '¿Has olvidado tu contraseña?' })).toHaveAttribute('href', '/admin/forgot-password');
  });

  it('si la sesión de recuperación ya no vale al guardar, no cambia nada y lo indica', async () => {
    fakeSupabase.session = { user: { id: 'u1', email: 'dueno@bar.test' } };
    fakeSupabase.updateUserHandler = () => fail('Auth session missing!');
    const user = userEvent.setup();
    renderReset();
    await user.type(await screen.findByLabelText('Contraseña nueva'), 'nueva-segura');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ha caducado.');
  });
});
