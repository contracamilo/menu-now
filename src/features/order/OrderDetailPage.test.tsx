import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { storageKey } from '../../i18n/I18nProvider';
import type { PlacedOrder } from '../../lib/types';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { serveTableMenu, TOKEN } from '../../test/fakeMenu';
import { renderWithProviders } from '../../test/render';
import { TableApp } from './TableApp';

const plain = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ');

const order3: PlacedOrder = {
  id: 'aaaaaaaa-0000-4000-8000-000000000003',
  number: 3,
  status: 'received',
  table_name: 'Mesa 4',
  total_cents: 1060,
  created_at: '2026-11-19T12:30:00Z',
  items: [
    { dish_name: 'Caña', size_label: null, unit_price_cents: 180, quantity: 2, note: null },
    { dish_name: 'Croquetas', size_label: 'Ración', unit_price_cents: 700, quantity: 1, note: 'Bien calientes' },
  ],
};

function renderDetail(orderId: string) {
  localStorage.setItem(storageKey('menu'), 'es');
  serveTableMenu();
  return renderWithProviders(
    <Routes>
      <Route path="/t/:token/*" element={<TableApp />} />
    </Routes>,
    { route: `/t/${TOKEN}/orders/${orderId}`, zone: 'menu' },
  );
}

describe('OrderDetailPage', () => {
  it('[table-ordering] «El comensal ve la confirmación de su pedido»', async () => {
    fakeSupabase.rpcs.get_orders = () => ok([order3]);
    renderDetail(order3.id);
    const heading = await screen.findByRole('heading', { level: 1, name: 'Pedido nº 3' });
    expect(heading).toHaveFocus();
    expect(screen.getByText('Mesa: Mesa 4')).toBeInTheDocument();
    expect(screen.getByText('Estado: Recibido')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(plain(items[0].textContent)).toBe('2 × Caña3,60 €');
    expect(within(items[1]).getByText('1 × Croquetas · Ración')).toBeInTheDocument();
    expect(within(items[1]).getByText('Bien calientes')).toBeInTheDocument();
    expect(plain(document.querySelector('.order-total strong')!.textContent)).toBe('10,60 €');
    expect(fakeSupabase.rpcCalls.find((c) => c.name === 'get_orders')?.args).toEqual({
      p_table_token: TOKEN,
      p_order_ids: [order3.id],
    });
  });

  it('[table-ordering] «El dueño cambia un plato después de pedirlo»: muestra lo que se pidió, no la carta actual', async () => {
    // La carta ya dice «Croquetas caseras» a 8,00 €, pero el pedido guarda la copia de entonces
    fakeSupabase.rpcs.get_orders = () => ok([order3]);
    renderDetail(order3.id);
    expect(await screen.findByText('1 × Croquetas · Ración')).toBeInTheDocument();
    expect(screen.queryByText(/Croquetas caseras/)).not.toBeInTheDocument();
    expect(plain(screen.getByText(/7,00/).textContent)).toBe('7,00 €');
  });

  it('un pedido que este móvil no conoce no se muestra', async () => {
    fakeSupabase.rpcs.get_orders = () => ok([]);
    renderDetail('bbbbbbbb-0000-4000-8000-000000000009');
    expect(await screen.findByText('No encontramos este pedido en este móvil.')).toBeInTheDocument();
  });

  it('[table-ordering] «El comensal ve que su pedido se ha cancelado»: estado «Cancelado» y texto de ayuda', async () => {
    fakeSupabase.rpcs.get_orders = () => ok([{ ...order3, number: 8, status: 'cancelled' }]);
    renderDetail(order3.id);
    expect(await screen.findByText('Estado: Cancelado')).toBeInTheDocument();
    expect(screen.getByText('Este pedido se ha cancelado. Si tienes dudas, pregunta al personal.')).toBeInTheDocument();
  });

  it.each([
    ['in_preparation', 'Estado: En preparación', true],
    ['served', 'Estado: Servido', false],
  ] as const)('estado %s: muestra «%s»', async (status, text, help) => {
    fakeSupabase.rpcs.get_orders = () => ok([{ ...order3, status }]);
    renderDetail(order3.id);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(Boolean(screen.queryByText(/Lo estamos preparando|pregunta al personal/))).toBe(help);
  });
});
