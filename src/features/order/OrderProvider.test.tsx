import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderProvider, useOrder } from './OrderProvider';
import { resetMemoryStorage } from './orderStorage';

let api: ReturnType<typeof useOrder>;

function Probe() {
  api = useOrder();
  return (
    <ul>
      {api.draft.lines.map((line) => (
        <li key={line.key}>
          {line.dish_name} × {line.quantity} {line.note}
        </li>
      ))}
    </ul>
  );
}

const mount = (token: string) =>
  render(
    <OrderProvider key={token} token={token}>
      <Probe />
    </OrderProvider>,
  );

function addCanaWithNote() {
  act(() => api.add({ dish_id: 'd-cana', size_id: 's-cana', dish_name: 'Caña', size_label: null, unit_price_cents: 180 }));
  act(() => api.dispatch({ type: 'setQuantity', key: api.draft.lines[0].key, quantity: 2 }));
  act(() => api.dispatch({ type: 'setNote', key: api.draft.lines[0].key, note: 'Muy frías' }));
}

afterEach(() => resetMemoryStorage());

describe('OrderProvider', () => {
  it('[table-ordering] «El comensal recarga la carta con platos en el pedido»: conserva líneas y notas', () => {
    const first = mount('mesa-4');
    addCanaWithNote();
    first.unmount();

    mount('mesa-4');
    expect(screen.getByText('Caña × 2 Muy frías')).toBeInTheDocument();
  });

  it('el pedido es de cada mesa: con otro token empieza vacío', () => {
    const first = mount('mesa-4');
    addCanaWithNote();
    first.unmount();

    mount('mesa-5');
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('sin localStorage funciona en memoria', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const first = mount('mesa-4');
    addCanaWithNote();
    expect(screen.getByText('Caña × 2 Muy frías')).toBeInTheDocument();
    first.unmount();
    mount('mesa-4');
    expect(screen.getByText('Caña × 2 Muy frías')).toBeInTheDocument();
  });

  it('ignora un borrador guardado corrupto', () => {
    localStorage.setItem('menu-now.draft.mesa-4', '{"lines":[{"nope":1}]');
    mount('mesa-4');
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
