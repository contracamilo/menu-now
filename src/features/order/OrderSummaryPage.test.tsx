import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { storageKey } from '../../i18n/I18nProvider';
import type { DraftLine, PlacedOrder, PlaceOrderResult } from '../../lib/types';
import { fail, fakeSupabase, ok } from '../../test/fakeSupabase';
import { serveTableMenu, TOKEN } from '../../test/fakeMenu';
import { renderWithProviders } from '../../test/render';
import { TableApp } from './TableApp';

const plain = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ');

const cana = (quantity = 2, price = 180): DraftLine => ({
  key: 'k-cana',
  dish_id: 'cana',
  size_id: 'cana-s',
  dish_name: 'Caña',
  size_label: null,
  unit_price_cents: price,
  quantity,
  note: '',
});
const racion: DraftLine = {
  key: 'k-racion',
  dish_id: 'croquetas',
  size_id: 'croq-racion',
  dish_name: 'Croquetas',
  size_label: 'Ración',
  unit_price_cents: 700,
  quantity: 1,
  note: 'Bien calientes',
};

const placed = (id: string, lines: DraftLine[], number = 3): PlacedOrder => ({
  id,
  number,
  status: 'received',
  table_name: 'Mesa 4',
  total_cents: lines.reduce((s, l) => s + l.quantity * l.unit_price_cents, 0),
  created_at: '2026-11-19T12:30:00Z',
  items: lines.map((l) => ({
    dish_name: l.dish_name,
    size_label: l.size_label,
    unit_price_cents: l.unit_price_cents,
    quantity: l.quantity,
    note: l.note || null,
  })),
});

function setup(lines: DraftLine[], table: { name: string; active: boolean } | null = { name: 'Mesa 4', active: true }) {
  localStorage.setItem(storageKey('menu'), 'es');
  localStorage.setItem(`menu-now.draft.${TOKEN}`, JSON.stringify({ orderId: null, lines }));
  serveTableMenu(table);
  return renderWithProviders(
    <Routes>
      <Route path="/t/:token/*" element={<TableApp />} />
    </Routes>,
    { route: `/t/${TOKEN}/order`, zone: 'menu' },
  );
}

/** place_order falso: registra cada llamada y responde con lo que devuelva `respond`. */
function servePlaceOrder(respond: (args: Record<string, unknown>) => PlaceOrderResult | 'network-error') {
  fakeSupabase.rpcs.place_order = (args) => {
    const result = respond(args);
    return result === 'network-error' ? fail('Failed to fetch') : ok(result);
  };
  fakeSupabase.rpcs.get_orders = () => ok([]);
}
const placeCalls = () => fakeSupabase.rpcCalls.filter((c) => c.name === 'place_order');
const lineNames = () => screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const total = () => plain(document.querySelector('.order-total strong')?.textContent ?? null);
const confirmButton = () => screen.getByRole('button', { name: 'Confirmar pedido' });

describe('OrderSummaryPage', () => {
  it('[table-ordering] «El comensal revisa su pedido»', async () => {
    setup([cana(), racion]);
    expect(await screen.findByText('Pedido para Mesa 4')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByRole('heading', { name: 'Caña' })).toBeInTheDocument();
    expect(within(items[0]).getByRole('group', { name: 'Cantidad de Caña' }).querySelector('.stepper__value')).toHaveTextContent('2');
    expect(plain(within(items[0]).getByText(/3,60/).textContent)).toBe('3,60 €');
    expect(within(items[1]).getByRole('heading', { name: 'Croquetas · Ración' })).toBeInTheDocument();
    expect(within(items[1]).getByRole('textbox')).toHaveValue('Bien calientes');
    expect(total()).toBe('10,60 €');
    expect(screen.getByText('Total (IVA incluido)')).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it('[table-ordering] «El comensal intenta confirmar un pedido vacío»', async () => {
    setup([]);
    expect(await screen.findByText('Tu pedido está vacío. Añade platos desde la carta.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
  });

  it('[table-ordering] «El comensal añade una nota a un plato»', async () => {
    setup([{ ...cana(1), dish_name: 'Bocadillo de lomo' }]);
    await userEvent.setup().type(await screen.findByRole('textbox', { name: /Nota/ }), 'Sin cebolla');
    expect(screen.getByRole('textbox', { name: /Nota/ })).toHaveValue('Sin cebolla');
    expect(JSON.parse(localStorage.getItem(`menu-now.draft.${TOKEN}`)!).lines[0].note).toBe('Sin cebolla');
  });

  it('[table-ordering] «El comensal intenta escribir una nota de más de 140 caracteres»', async () => {
    setup([cana(1)]);
    const note = await screen.findByRole('textbox', { name: /Nota/ });
    expect(note).toHaveAttribute('maxLength', '140');
    await userEvent.setup().type(note, 'a'.repeat(141));
    expect(note).toHaveValue('a'.repeat(140));
    expect(screen.getByText('140/140')).toBeInTheDocument();
  });

  it('[table-ordering] «El comensal cambia la cantidad y quita una línea»', async () => {
    setup([cana(1), racion]);
    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: 'Quitar una unidad de Caña' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Añadir una unidad de Caña' }));
    await user.click(screen.getByRole('button', { name: 'Añadir una unidad de Caña' }));
    await user.click(screen.getByRole('button', { name: 'Quitar Croquetas · Ración' }));
    expect(lineNames()).toEqual(['Caña']);
    expect(screen.getByRole('group', { name: 'Cantidad de Caña' }).querySelector('.stepper__value')).toHaveTextContent('3');
    expect(plain(screen.getByRole('status').textContent)).toBe('Croquetas · Ración quitado del pedido.');
  });

  it('no se puede subir una línea de 20', async () => {
    setup([cana(20)]);
    expect(await screen.findByRole('button', { name: 'Añadir una unidad de Caña' })).toBeDisabled();
  });

  it('[table-ordering] «El comensal confirma su pedido»: sin datos personales, y muestra la confirmación', async () => {
    servePlaceOrder((args) => ({ status: 'placed', order: placed(args.p_order_id as string, [cana(), racion]) }));
    setup([cana(), racion]);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedido nº 3' })).toBeInTheDocument();
    const [call] = placeCalls();
    expect(Object.keys(call.args).sort()).toEqual(['p_items', 'p_order_id', 'p_table_token']);
    expect(call.args.p_table_token).toBe(TOKEN);
    expect(call.args.p_items).toEqual([
      { dish_id: 'cana', size_id: 'cana-s', quantity: 2, note: null, unit_price_cents: 180 },
      { dish_id: 'croquetas', size_id: 'croq-racion', quantity: 1, note: 'Bien calientes', unit_price_cents: 700 },
    ]);
    expect(JSON.parse(localStorage.getItem(`menu-now.orders.${TOKEN}`)!)).toEqual([call.args.p_order_id]);
  });

  it('[table-ordering] «La mesa pide el postre después»: tras confirmar, el pedido queda vacío', async () => {
    servePlaceOrder((args) => ({ status: 'placed', order: placed(args.p_order_id as string, [cana()]) }));
    setup([cana()]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
    await user.click(await screen.findByRole('link', { name: 'Volver a la carta' }));
    await screen.findByRole('heading', { level: 2, name: 'Bebidas' });
    expect(screen.queryByRole('link', { name: /^Ver pedido/ })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(`menu-now.draft.${TOKEN}`)!).lines).toEqual([]);
  });

  it('[table-ordering] «El comensal pulsa confirmar dos veces»: una sola petición', async () => {
    let release: () => void = () => {};
    fakeSupabase.rpcs.place_order = (args) =>
      new Promise((resolve) => {
        release = () => resolve(ok({ status: 'placed', order: placed(args.p_order_id as string, [cana()]) }));
      });
    fakeSupabase.rpcs.get_orders = () => ok([]);
    setup([cana()]);
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Confirmar pedido' });
    await user.click(button);
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Enviando el pedido…' })).toBeDisabled();
    release();
    await screen.findByRole('heading', { level: 1, name: 'Pedido nº 3' });
    expect(placeCalls()).toHaveLength(1);
  });

  it('[table-ordering] «El comensal confirma sin conexión»: conserva el pedido y reintenta con el mismo id', async () => {
    let online = false;
    servePlaceOrder((args) => (online ? { status: 'placed', order: placed(args.p_order_id as string, [cana()]) } : 'network-error'));
    setup([cana()]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText('No hemos podido enviar el pedido. Tu pedido sigue aquí.')).toBeInTheDocument();
    expect(lineNames()).toEqual(['Caña']);
    online = true;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { level: 1, name: 'Pedido nº 3' });
    const [first, second] = placeCalls();
    expect(second.args.p_order_id).toBe(first.args.p_order_id);
  });

  it('[table-ordering] «Un plato se archiva mientras el comensal decide»', async () => {
    servePlaceOrder((args) =>
      (args.p_items as unknown[]).length === 2
        ? {
            status: 'rejected',
            unavailable: [{ dish_id: 'croquetas', size_id: 'croq-racion', dish_name: 'Croquetas' }],
            price_changes: [],
          }
        : { status: 'placed', order: placed(args.p_order_id as string, [cana(1)]) },
    );
    setup([{ ...racion, note: '' }, cana(1)]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
    expect(
      await screen.findByText(
        'Ya no están disponibles y los hemos quitado de tu pedido: Croquetas. Revisa tu pedido y confírmalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(lineNames()).toEqual(['Caña']);
    expect(total()).toBe('1,80 €');
    await user.click(confirmButton());
    await screen.findByRole('heading', { level: 1, name: 'Pedido nº 3' });
    expect((placeCalls()[1].args.p_items as unknown[]).length).toBe(1);
  });

  it('[table-ordering] «Todos los platos del pedido dejan de estar disponibles»', async () => {
    servePlaceOrder(() => ({
      status: 'rejected',
      unavailable: [{ dish_id: 'flan', size_id: 'flan-s', dish_name: 'Flan' }],
      price_changes: [],
    }));
    setup([{ ...cana(1), key: 'k-flan', dish_id: 'flan', size_id: 'flan-s', dish_name: 'Flan' }]);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByText('Ya no están disponibles: Flan. Tu pedido se ha quedado vacío.')).toBeInTheDocument();
    expect(screen.getByText('Tu pedido está vacío. Añade platos desde la carta.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
  });

  it('[table-ordering] «El dueño cambia un precio mientras el comensal decide»', async () => {
    servePlaceOrder((args) => {
      const [item] = args.p_items as Array<{ unit_price_cents: number }>;
      return item.unit_price_cents === 180
        ? {
            status: 'rejected',
            unavailable: [],
            price_changes: [{ dish_id: 'cana', size_id: 'cana-s', dish_name: 'Caña', price_cents: 200 }],
          }
        : { status: 'placed', order: placed(args.p_order_id as string, [cana(2, 200)]) };
    });
    setup([cana(2, 180)]);
    const user = userEvent.setup();
    expect(await screen.findByText('Pedido para Mesa 4')).toBeInTheDocument();
    expect(total()).toBe('3,60 €');
    await user.click(confirmButton());
    expect(
      await screen.findByText('Ha cambiado el precio de: Caña. Revisa el nuevo total y confírmalo de nuevo.'),
    ).toBeInTheDocument();
    expect(total()).toBe('4,00 €');
    await user.click(confirmButton());
    await screen.findByRole('heading', { level: 1, name: 'Pedido nº 3' });
    expect(plain(document.querySelector('.order-total strong')!.textContent)).toBe('4,00 €');
  });

  it('[table-ordering] «El dueño archiva la mesa mientras el comensal decide»', async () => {
    servePlaceOrder(() => ({ status: 'table_unavailable' }));
    setup([cana()]);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
    expect(
      await screen.findByText('Desde esta mesa ya no se pueden hacer pedidos. Pregunta al personal.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
    expect(lineNames()).toEqual(['Caña']);
  });

  it('desde una mesa ya archivada el resumen no permite confirmar', async () => {
    setup([cana()], { name: 'Terraza 2', active: false });
    expect(
      await screen.findByText('Desde esta mesa ya no se pueden hacer pedidos. Pregunta al personal.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument());
  });
});
