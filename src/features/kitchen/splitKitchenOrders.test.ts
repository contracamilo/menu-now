import { describe, expect, it } from 'vitest';
import { kitchenOrder } from '../../test/fakeKitchen';
import { splitKitchenOrders } from './splitKitchenOrders';

describe('splitKitchenOrders', () => {
  it('[kitchen-panel] «Los pedidos servidos o cancelados no están en la vista activa»: reparte los cuatro estados', () => {
    const orders = [
      kitchenOrder({ number: 2, status: 'served', created_at: '2026-11-19T12:10:00Z', preparing_at: '2026-11-19T12:15:00Z', served_at: '2026-11-19T12:40:00Z' }),
      kitchenOrder({ number: 3, status: 'cancelled', created_at: '2026-11-19T12:20:00Z', cancelled_at: '2026-11-19T12:55:00Z' }),
      kitchenOrder({ number: 4, status: 'in_preparation', created_at: '2026-11-19T13:05:00Z', preparing_at: '2026-11-19T13:06:00Z' }),
      kitchenOrder({ number: 5, status: 'received', created_at: '2026-11-19T13:09:00Z' }),
    ];
    const { active, history } = splitKitchenOrders(orders);
    expect(active.map((o) => o.number)).toEqual([4, 5]);
    expect(history.map((o) => o.number)).toEqual([3, 2]);
  });

  it('activos del más antiguo al más reciente aunque lleguen desordenados', () => {
    const { active } = splitKitchenOrders([
      kitchenOrder({ number: 6, created_at: '2026-11-19T13:20:00Z' }),
      kitchenOrder({ number: 4, created_at: '2026-11-19T13:05:00Z' }),
      kitchenOrder({ number: 5, created_at: '2026-11-19T13:09:00Z' }),
    ]);
    expect(active.map((o) => o.number)).toEqual([4, 5, 6]);
  });

  it('[kitchen-panel] «El personal consulta lo servido hoy»: histórico por hora de cierre, del más reciente al más antiguo', () => {
    const { history } = splitKitchenOrders([
      kitchenOrder({ number: 2, status: 'served', preparing_at: '2026-11-19T12:15:00Z', served_at: '2026-11-19T12:40:00Z' }),
      kitchenOrder({ number: 3, status: 'cancelled', cancelled_at: '2026-11-19T12:55:00Z' }),
      kitchenOrder({ number: 1, status: 'served', preparing_at: '2026-11-19T12:01:00Z', served_at: '2026-11-19T13:30:00Z' }),
    ]);
    expect(history.map((o) => o.number)).toEqual([1, 3, 2]);
  });
});
