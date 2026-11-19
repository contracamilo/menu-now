import { describe, expect, it, vi } from 'vitest';
import { FakeSupabase, type FakeChange } from './fakeSupabase';

describe('FakeSupabase.channel', () => {
  it('entrega a la suscripción los cambios y los estados emitidos desde el test', async () => {
    const fake = new FakeSupabase();
    fake.autoSubscribe = false;
    const changes: FakeChange[] = [];
    const statuses = vi.fn();
    const channel = fake
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => changes.push(payload))
      .subscribe(statuses);

    expect(fake.lastChannel('kitchen-orders')).toBe(channel);
    channel.emitChange({ eventType: 'INSERT', new: { id: 'o5', number: 5 } });
    channel.emitStatus('CHANNEL_ERROR');

    expect(changes).toEqual([{ eventType: 'INSERT', schema: 'public', table: 'orders', new: { id: 'o5', number: 5 }, old: {} }]);
    expect(statuses).toHaveBeenCalledWith('CHANNEL_ERROR');

    await fake.removeChannel(channel);
    channel.emitChange({ eventType: 'UPDATE' });
    expect(changes).toHaveLength(1);
    expect(fake.channels).toHaveLength(0);
  });

  it('por defecto confirma la suscripción con SUBSCRIBED', async () => {
    const fake = new FakeSupabase();
    const statuses = vi.fn();
    fake.channel('c').subscribe(statuses);
    await Promise.resolve();
    expect(statuses).toHaveBeenCalledWith('SUBSCRIBED');
  });
});
