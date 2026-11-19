import { describe, expect, it } from 'vitest';
import { emptyDraft, orderReducer, orderTotal, unitCount, type DraftOrder, type NewLine, type OrderAction } from './orderReducer';

const cana: NewLine = { key: 'k-cana', dish_id: 'd-cana', size_id: 's-cana', dish_name: 'Caña', size_label: null, unit_price_cents: 180 };
const racion: NewLine = {
  key: 'k-racion',
  dish_id: 'd-croq',
  size_id: 's-racion',
  dish_name: 'Croquetas',
  size_label: 'Ración',
  unit_price_cents: 700,
};
const burger = (key: string): NewLine => ({
  key,
  dish_id: 'd-burger',
  size_id: 's-burger',
  dish_name: 'Hamburguesa',
  size_label: null,
  unit_price_cents: 1100,
});

const run = (...actions: OrderAction[]) => actions.reduce(orderReducer, emptyDraft);

describe('orderReducer', () => {
  it('[table-ordering] «El comensal añade un plato de un solo tamaño»: una línea con cantidad 1', () => {
    const state = run({ type: 'add', line: cana });
    expect(state.lines).toEqual([{ ...cana, quantity: 1, note: '' }]);
    expect(unitCount(state.lines)).toBe(1);
    expect(orderTotal(state.lines)).toBe(180);
  });

  it('[table-ordering] «El comensal pide el mismo plato con notas distintas»', () => {
    let state = run({ type: 'add', line: burger('b1') }, { type: 'setNote', key: 'b1', note: 'Poco hecha' });
    state = orderReducer(state, { type: 'add', line: burger('b2') });
    state = orderReducer(state, { type: 'setNote', key: 'b2', note: 'Muy hecha' });
    expect(state.lines.map((l) => [l.dish_name, l.quantity, l.note])).toEqual([
      ['Hamburguesa', 1, 'Poco hecha'],
      ['Hamburguesa', 1, 'Muy hecha'],
    ]);
  });

  it('añadir de nuevo el mismo plato y tamaño suma a la línea sin nota', () => {
    const state = run(
      { type: 'add', line: burger('b1') },
      { type: 'setNote', key: 'b1', note: 'Poco hecha' },
      { type: 'add', line: burger('b2') },
      { type: 'add', line: burger('b3') },
    );
    expect(state.lines.map((l) => [l.key, l.quantity, l.note])).toEqual([
      ['b1', 1, 'Poco hecha'],
      ['b2', 2, ''],
    ]);
  });

  it('[table-ordering] «El comensal cambia la cantidad y quita una línea»: entre 1 y 20', () => {
    let state = run({ type: 'add', line: cana }, { type: 'add', line: racion });
    state = orderReducer(state, { type: 'setQuantity', key: 'k-cana', quantity: 3 });
    state = orderReducer(state, { type: 'remove', key: 'k-racion' });
    expect(state.lines.map((l) => [l.dish_name, l.quantity])).toEqual([['Caña', 3]]);
    expect(orderReducer(state, { type: 'setQuantity', key: 'k-cana', quantity: 0 }).lines[0].quantity).toBe(1);
    expect(orderReducer(state, { type: 'setQuantity', key: 'k-cana', quantity: 21 }).lines[0].quantity).toBe(20);
    const full = orderReducer(state, { type: 'setQuantity', key: 'k-cana', quantity: 20 });
    expect(orderReducer(full, { type: 'add', line: cana })).toBe(full);
  });

  it('la nota no pasa de 140 caracteres', () => {
    const state = run({ type: 'add', line: cana }, { type: 'setNote', key: 'k-cana', note: 'a'.repeat(150) });
    expect(state.lines[0].note).toHaveLength(140);
  });

  it('[table-ordering] «Un plato se archiva mientras el comensal decide»: retira lo no disponible', () => {
    const state = run(
      { type: 'add', line: racion },
      { type: 'add', line: cana },
      { type: 'applyRejection', unavailable: [{ dish_id: 'd-croq', size_id: 's-racion', dish_name: 'Croquetas' }], priceChanges: [] },
    );
    expect(state.lines.map((l) => l.dish_name)).toEqual(['Caña']);
    expect(orderTotal(state.lines)).toBe(180);
  });

  it('[table-ordering] «El dueño cambia un precio mientras el comensal decide»: actualiza el precio', () => {
    const state = run(
      { type: 'add', line: cana },
      { type: 'setQuantity', key: 'k-cana', quantity: 2 },
      {
        type: 'applyRejection',
        unavailable: [],
        priceChanges: [{ dish_id: 'd-cana', size_id: 's-cana', dish_name: 'Caña', price_cents: 200 }],
      },
    );
    expect(orderTotal(state.lines)).toBe(400);
  });

  it('cualquier cambio en las líneas descarta el id del intento de envío', () => {
    const sent: DraftOrder = orderReducer(run({ type: 'add', line: cana }), { type: 'setOrderId', orderId: 'o-1' });
    expect(sent.orderId).toBe('o-1');
    expect(orderReducer(sent, { type: 'setQuantity', key: 'k-cana', quantity: 2 }).orderId).toBeNull();
    expect(orderReducer(sent, { type: 'setNote', key: 'k-cana', note: 'Fría' }).orderId).toBeNull();
    expect(orderReducer(sent, { type: 'clear' })).toEqual(emptyDraft);
  });
});
