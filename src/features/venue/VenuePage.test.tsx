import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { fileOf, MB, stubCanvas } from '../../test/canvas';
import { VenuePage } from './VenuePage';

function venue(name: string | null, logo_path: string | null) {
  fakeSupabase.tables.venue_settings = (q) => (q.op === 'select' ? ok([{ name, logo_path }]) : ok(null));
}

const updates = () => fakeSupabase.calls.filter((c) => c.table === 'venue_settings' && c.op === 'update');

describe('VenuePage («Mi local»)', () => {
  it('[venue-settings] «El dueño pone el nombre y el logo de su local»', async () => {
    stubCanvas();
    venue(null, null);
    const user = userEvent.setup();
    renderWithProviders(<VenuePage />, { zone: 'admin' });

    expect(await screen.findByText('Añade el nombre de tu local para que aparezca en la carta.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre del local'), 'Bar Manolo');
    await user.upload(screen.getByLabelText('Elegir logo'), fileOf(1 * MB, 'image/png', 'logo.png'));
    expect(await screen.findByLabelText('Cambiar logo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Cambios guardados. Ya se ven en la carta.')).toBeInTheDocument();
    const upload = fakeSupabase.storageCalls.find((c) => c.op === 'upload');
    expect(upload?.path).toMatch(/^venue\/logo-.+\.png$/);
    expect(updates()[0].payload).toEqual({ name: 'Bar Manolo', logo_path: upload?.path });
  });

  it('[venue-settings] «El dueño escribe un nombre de local largo»: no admite más de 60 caracteres', async () => {
    venue(null, null);
    const user = userEvent.setup();
    renderWithProviders(<VenuePage />, { zone: 'admin' });
    const input = await screen.findByLabelText('Nombre del local');
    await user.type(input, 'b'.repeat(65));
    expect(input).toHaveValue('b'.repeat(60));
    expect(screen.getByText('60/60')).toBeInTheDocument();
  });

  it('[venue-settings] «El dueño intenta guardar sin nombre»', async () => {
    venue(null, null);
    const user = userEvent.setup();
    renderWithProviders(<VenuePage />, { zone: 'admin' });

    await screen.findByLabelText('Nombre del local');
    await user.type(screen.getByLabelText('Nombre del local'), '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del local')).toHaveAttribute('aria-invalid', 'true');
    expect(updates()).toHaveLength(0);
  });

  it('[venue-settings] «El dueño intenta subir un logo de más de 5 MB» (el nombre se conserva)', async () => {
    venue(null, null);
    const user = userEvent.setup();
    renderWithProviders(<VenuePage />, { zone: 'admin' });

    await user.type(await screen.findByLabelText('Nombre del local'), 'Bar Manolo');
    await user.upload(screen.getByLabelText('Elegir logo'), fileOf(8 * MB, 'image/png', 'logo.png'));

    expect(await screen.findByRole('alert')).toHaveTextContent('La imagen pesa demasiado. El tamaño máximo es 5 MB.');
    expect(screen.getByLabelText('Nombre del local')).toHaveValue('Bar Manolo');
    expect(fakeSupabase.storageCalls).toHaveLength(0);
  });

  it('quita el logo: guarda logo_path a null y borra la imagen anterior', async () => {
    venue('Bar Manolo', 'venue/logo-viejo.png');
    const user = userEvent.setup();
    renderWithProviders(<VenuePage />, { zone: 'admin' });

    await waitFor(() => expect(screen.getByLabelText('Nombre del local')).toHaveValue('Bar Manolo'));
    await user.click(screen.getByRole('button', { name: 'Quitar logo' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByText('Cambios guardados. Ya se ven en la carta.');
    expect(updates()[0].payload).toEqual({ name: 'Bar Manolo', logo_path: null });
    expect(fakeSupabase.storageCalls).toContainEqual({ op: 'remove', path: ['venue/logo-viejo.png'] });
  });
});
