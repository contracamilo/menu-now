import { afterEach, describe, expect, it } from 'vitest';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
const EARLY_MENU_GLOBAL = '__menuNowEarlyMenu';
import { fetchMenu } from './useMenu';

const w = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete w[EARLY_MENU_GLOBAL];
});

describe('fetchMenu', () => {
  it('usa una sola vez la petición temprana de index.html y después pide directamente', async () => {
    const early = [{ id: 'temprana' }];
    w[EARLY_MENU_GLOBAL] = Promise.resolve(early);
    fakeSupabase.tables.categories = () => ok([{ id: 'directa' }]);

    expect(await fetchMenu()).toBe(early);
    expect(fakeSupabase.calls).toHaveLength(0);
    expect(w[EARLY_MENU_GLOBAL]).toBeUndefined();

    // Un reintento (p. ej. «Reintentar») va directo a PostgREST
    expect(await fetchMenu()).toEqual([{ id: 'directa' }]);
    expect(fakeSupabase.calls).toHaveLength(1);
  });

  it('sin petición temprana, pide directamente', async () => {
    fakeSupabase.tables.categories = () => ok([]);
    await fetchMenu();
    expect(fakeSupabase.calls.map((c) => c.table)).toEqual(['categories']);
  });
});
