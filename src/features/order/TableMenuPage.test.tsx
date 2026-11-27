import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { storageKey } from '../../i18n/I18nProvider';
import { fakeSupabase } from '../../test/fakeSupabase';
import { serveTableMenu, TOKEN } from '../../test/fakeMenu';
import { renderWithProviders } from '../../test/render';
import { TableApp } from './TableApp';

const plain = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ');

function renderTable(token = TOKEN) {
  localStorage.setItem(storageKey('menu'), 'es');
  return renderWithProviders(
    <Routes>
      <Route path="/t/:token/*" element={<TableApp />} />
    </Routes>,
    { route: `/t/${token}`, zone: 'menu' },
  );
}

const article = (name: string) => screen.getByRole('article', { name });
const orderBar = () => screen.getByRole('link', { name: /^Ver pedido/ });

describe('TableMenuPage', () => {
  it('[menu] «El comensal abre la carta desde el QR» / [table-ordering] «… desde el QR de su mesa»', async () => {
    serveTableMenu();
    const { container } = renderTable();
    expect(await screen.findByText('Mesa: Mesa 4')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Bebidas' })).toBeInTheDocument();
    expect(within(article('Caña')).getByRole('button', { name: 'Añadir Caña' })).toBeInTheDocument();
    expect(within(article('Croquetas')).getByRole('button', { name: 'Añadir Croquetas' })).toBeInTheDocument();
    // Ningún dato personal: ni sesión ni campos que rellenar
    expect(fakeSupabase.session).toBeNull();
    expect(container.querySelector('input, textarea, select')).toBeNull();
    expect(screen.queryByText('Para pedir, escanea el código QR de tu mesa o pregunta al personal.')).not.toBeInTheDocument();
    // La mesa se pide con su token
    const tableCall = fakeSupabase.calls.find((c) => c.table === 'rpc/get_table');
    expect(tableCall?.filters).toEqual([['param', 'p_token', TOKEN]]);
  });

  it('[table-ordering] «El comensal escanea el QR de una mesa archivada»: carta sin botones y con aviso', async () => {
    serveTableMenu({ name: 'Terraza 2', active: false });
    renderTable();
    expect(await screen.findByText('Desde esta mesa no se pueden hacer pedidos. Pregunta al personal.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Bebidas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Añadir/ })).not.toBeInTheDocument();
  });

  it.each([
    ['desconocido', TOKEN, null],
    ['mal formado', 'no-es-un-token', { name: 'X', active: true }],
  ])('un token %s abre la carta en modo consulta', async (_label, token, table) => {
    serveTableMenu(table);
    renderTable(token);
    expect(await screen.findByText('Para pedir, escanea el código QR de tu mesa o pregunta al personal.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Bebidas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Añadir/ })).not.toBeInTheDocument();
    if (token === 'no-es-un-token') expect(fakeSupabase.calls.some((c) => c.table === 'rpc/get_table')).toBe(false);
  });

  it('[menu] «Todas las mesas ven la misma carta»: la consulta de la carta no depende de la mesa', async () => {
    serveTableMenu();
    const first = renderTable(TOKEN);
    await screen.findByRole('heading', { level: 2, name: 'Bebidas' });
    const query1 = fakeSupabase.calls.find((c) => c.table === 'categories');
    first.unmount();
    fakeSupabase.calls = [];
    renderTable('11111111-1111-4111-8111-111111111111');
    await screen.findByRole('heading', { level: 2, name: 'Bebidas' });
    const query2 = fakeSupabase.calls.find((c) => c.table === 'categories');
    expect(query2).toEqual(query1);
  });

  it('[table-ordering] «El comensal añade un plato de un solo tamaño»: la barra muestra 1 unidad y 1,80 €', async () => {
    serveTableMenu();
    renderTable();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Añadir Caña' }));
    expect(plain(orderBar().textContent)).toBe('Ver pedido · 1 · 1,80 €');
    expect(orderBar()).toHaveAttribute('href', `/t/${TOKEN}/order`);
  });

  it('[table-ordering] «El comensal con el pedido vacío no ve la barra del pedido»', async () => {
    serveTableMenu();
    renderTable();
    await screen.findByRole('button', { name: 'Añadir Caña' });
    expect(screen.queryByRole('link', { name: /^Ver pedido/ })).not.toBeInTheDocument();
    expect(document.querySelector('.order-bar')).toBeNull();
  });

  it('[table-ordering] «El comensal elige el tamaño de un plato con varios tamaños»', async () => {
    serveTableMenu();
    renderTable();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Añadir Croquetas' }));
    const dialog = screen.getByRole('dialog', { name: 'Elige el tamaño de Croquetas' });
    expect(within(dialog).getAllByRole('button').map((b) => plain(b.textContent))).toEqual([
      'Una · 1,50 €',
      'Ración · 7,00 €',
      'Plato · 12,00 €',
      'Cancelar',
    ]);
    await user.click(within(dialog).getByRole('button', { name: /Ración/ }));
    expect(plain(orderBar().textContent)).toBe('Ver pedido · 1 · 7,00 €');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(`menu-now.draft.${TOKEN}`)!).lines[0]).toMatchObject({
      dish_name: 'Croquetas',
      size_label: 'Ración',
      unit_price_cents: 700,
    });
  });

  it('[table-ordering] «El comensal no puede pedir un plato incluido»', async () => {
    serveTableMenu();
    renderTable();
    await screen.findByRole('heading', { level: 2, name: 'Incluidos' });
    const tapa = article('Tapa del día');
    expect(within(tapa).getByText('Con cada bebida')).toBeInTheDocument();
    expect(within(tapa).queryByRole('button')).not.toBeInTheDocument();
  });

  it('[table-ordering] «El comensal pide con lector de pantalla»: anuncia lo añadido y el total', async () => {
    serveTableMenu();
    renderTable();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Añadir Caña' }));
    await waitFor(() => expect(plain(screen.getByRole('status').textContent)).toBe('Caña añadido. Total: 1,80 €'));
    await user.click(screen.getByRole('button', { name: 'Añadir Caña' }));
    await waitFor(() => expect(plain(screen.getByRole('status').textContent)).toBe('Caña añadido. Total: 3,60 €'));
    expect(plain(orderBar().textContent)).toBe('Ver pedido · 2 · 3,60 €');
  });

  it('[table-ordering] «El comensal llega al máximo de líneas»: lo ve y se le anuncia, y no se añade la línea', async () => {
    const lines = Array.from({ length: 50 }, (_, i) => ({
      key: `k-${i}`,
      dish_id: `d-${i}`,
      size_id: `s-${i}`,
      dish_name: `Plato ${i}`,
      size_label: null,
      unit_price_cents: 100,
      quantity: 1,
      note: '',
    }));
    localStorage.setItem(`menu-now.draft.${TOKEN}`, JSON.stringify({ orderId: null, lines }));
    serveTableMenu();
    renderTable();
    const user = userEvent.setup();
    const notice = 'Has llegado al máximo de 50 líneas. Confirma este pedido y haz otro para seguir pidiendo.';
    expect(await screen.findByText(notice)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Añadir Caña' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(notice));
    expect(JSON.parse(localStorage.getItem(`menu-now.draft.${TOKEN}`)!).lines).toHaveLength(50);
  });

  it('enlaza a «Mis pedidos» de la mesa', async () => {
    serveTableMenu();
    renderTable();
    expect(await screen.findByRole('link', { name: 'Mis pedidos' })).toHaveAttribute('href', `/t/${TOKEN}/orders`);
  });
});
