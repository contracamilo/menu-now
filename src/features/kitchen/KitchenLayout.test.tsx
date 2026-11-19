import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { kitchenOrder, serveKitchenOrders, signedInAs } from '../../test/fakeKitchen';
import { fakeSupabase } from '../../test/fakeSupabase';
import { renderAdminApp } from '../../test/renderAdmin';

describe('KitchenLayout', () => {
  it('[kitchen-panel] «El dueño abre el panel de cocina»: enlace «Cocina» en la administración y vuelta solo para el dueño', async () => {
    signedInAs(fakeSupabase, 'owner');
    serveKitchenOrders(fakeSupabase, [kitchenOrder({ number: 4 })]);
    const user = userEvent.setup();
    renderAdminApp('/admin');

    const nav = await screen.findByRole('navigation', { name: 'Mi carta' });
    await user.click(within(nav).getByRole('link', { name: 'Cocina' }));

    expect(await screen.findByRole('heading', { name: 'Nº 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar el pedido nº 4' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Volver a la administración' })).toHaveAttribute('href', '/admin');
  });

  it('el personal no ve el enlace de vuelta a la administración', async () => {
    signedInAs(fakeSupabase, 'staff');
    serveKitchenOrders(fakeSupabase, []);
    renderAdminApp('/admin/kitchen');
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    expect(await screen.findByText('Bar Manolo')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Volver a la administración' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pendientes (0)' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Histórico de hoy (0)' })).toHaveAttribute('href', '/admin/kitchen/history');
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument();
  });

  it('[backoffice-access] «El personal cierra sesión»: vuelve al inicio de sesión y no puede volver al panel', async () => {
    signedInAs(fakeSupabase, 'staff');
    serveKitchenOrders(fakeSupabase, [kitchenOrder({ number: 4 })]);
    const user = userEvent.setup();
    const first = renderAdminApp('/admin/kitchen');

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(fakeSupabase.session).toBeNull();
    first.unmount();

    renderAdminApp('/admin/kitchen');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nº 4' })).not.toBeInTheDocument();
  });
});
