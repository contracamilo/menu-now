import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { fakeSupabase } from '../../test/fakeSupabase';
import { installTables, table } from '../../test/fakeTables';
import { renderWithProviders } from '../../test/render';
import { qrMatrix } from './qr';
import { TableQrPage } from './TableQrPage';

function setup(id = 'm4') {
  const state = installTables([
    table({ id: 'm1', name: 'Mesa 1', token: '11111111-1111-4111-8111-111111111111' }),
    table({ id: 'm4', name: 'Mesa 4', token: '44444444-4444-4444-8444-444444444444' }),
  ]);
  const view = renderWithProviders(
    <Routes>
      <Route path="/admin/tables/:id/qr" element={<TableQrPage />} />
    </Routes>,
    { route: `/admin/tables/${id}/qr`, zone: 'admin' },
  );
  return { state, ...view };
}

const encodedUrl = async () => (await screen.findByRole('img')).getAttribute('data-url');

describe('TableQrPage', () => {
  it('[table-management] «El dueño imprime el QR de una mesa»: tarjeta con el nombre y la URL de la mesa', async () => {
    setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    expect(await screen.findByRole('heading', { level: 1, name: 'Mesa 4' })).toBeInTheDocument();
    expect(await screen.findByText('Bar Manolo')).toBeInTheDocument();
    expect(await encodedUrl()).toBe(`${window.location.origin}/t/44444444-4444-4444-8444-444444444444`);
    expect(screen.getByText('Escanea para ver la carta y pedir · Scan to see the menu and order')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('[table-management] «Dos mesas tienen QR distintos»', async () => {
    const first = setup('m1');
    const url1 = await encodedUrl();
    first.unmount();
    setup('m4');
    const url4 = await encodedUrl();
    expect(url1).not.toBe(url4);
    expect(qrMatrix(url1!).path).not.toBe(qrMatrix(url4!).path);
  });

  it('[table-management] «Renombrar una mesa no invalida su QR impreso»: la URL no cambia', async () => {
    const { state, unmount } = setup();
    const before = await encodedUrl();
    unmount();
    state.find((t) => t.id === 'm4')!.name = 'Ventana 1';
    const renamed = structuredClone(state);
    fakeSupabase.tables.tables = () => ({ data: renamed, error: null });
    renderWithProviders(
      <Routes>
        <Route path="/admin/tables/:id/qr" element={<TableQrPage />} />
      </Routes>,
      { route: '/admin/tables/m4/qr', zone: 'admin' },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Ventana 1' })).toBeInTheDocument();
    expect(await encodedUrl()).toBe(before);
  });

  it('descarga el QR como SVG con el nombre de la mesa', async () => {
    setup();
    await encodedUrl();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('qr-mesa-4.svg');
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descargar' }));
    expect(click).toHaveBeenCalledOnce();
  });
});
